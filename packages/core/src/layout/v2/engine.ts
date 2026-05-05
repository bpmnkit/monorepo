// packages/core/src/layout/v2/engine.ts
import type {
	BpmnAssociation,
	BpmnElementType,
	BpmnFlowElement,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "../../bpmn/bpmn-model.js"
import type { LayoutEdge, LayoutNode, LayoutResult } from "../types.js"
import { ELEMENT_SIZES } from "../types.js"
import { layoutAnnotations } from "./annotations.js"
import { detectBackEdges, makeDAG } from "./dag.js"
import { V2Graph } from "./graph.js"
import { assignCoordinates, assignTracks } from "./grid.js"
import { alignGatewayPairs, assignLayers, injectDummies } from "./layers.js"
import { assignPorts } from "./ports.js"
import { routeAllEdges } from "./router.js"
import { identifyTrunk } from "./trunk.js"
import type { V2Node } from "./types.js"

function getSize(type: string): { width: number; height: number } {
	return ELEMENT_SIZES[type as keyof typeof ELEMENT_SIZES] ?? { width: 100, height: 80 }
}

/**
 * Build V2Graph from BPMN flow elements and sequence flows.
 * Computes annotation widths for each node to enable dynamic X-gap calculation.
 */
function buildV2Graph(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	textAnnotations: BpmnTextAnnotation[],
	associations: BpmnAssociation[],
): { graph: V2Graph; nodeIndex: Map<string, BpmnFlowElement> } {
	const graph = new V2Graph()
	const nodeIndex = new Map<string, BpmnFlowElement>()

	// Build annotation width map: nodeId → max annotation width
	const annotationIds = new Set(textAnnotations.map((t) => t.id))
	const annWidths = new Map<string, number>()
	for (const a of associations) {
		const nodeId = annotationIds.has(a.sourceRef) ? a.targetRef : a.sourceRef
		const annId = annotationIds.has(a.sourceRef) ? a.sourceRef : a.targetRef
		const ta = textAnnotations.find((t) => t.id === annId)
		if (ta) {
			const w = Math.min(200, Math.max(80, (ta.text?.length ?? 10) * 5))
			annWidths.set(nodeId, Math.max(annWidths.get(nodeId) ?? 0, w))
		}
	}

	for (const n of flowNodes) {
		nodeIndex.set(n.id, n)
		const size = getSize(n.type)
		const v2node: V2Node = {
			id: n.id,
			type: n.type,
			...size,
			x: 0,
			y: 0,
			layer: 0,
			track: 2,
			isTrunk: false,
			isBackEdgeSource: false,
			isDummy: false,
			label: n.name,
			annotationWidth: annWidths.get(n.id),
		}
		graph.addNode(v2node)
	}

	for (const f of sequenceFlows) {
		graph.addEdge({
			id: f.id,
			sourceId: f.sourceRef,
			targetId: f.targetRef,
			isBackEdge: false,
			waypoints: [],
			label: f.name,
		})
	}

	return { graph, nodeIndex }
}

const LABEL_CHAR_WIDTH = 7
const LABEL_HEIGHT = 14
const LABEL_MIN_WIDTH = 40
const LABEL_MAX_WIDTH = 120

/**
 * Compute label bounds for nodes that have a label.
 * Events and gateways get labels below; tasks get labels inside (no separate labelBounds).
 */
function computeNodeLabelBounds(
	n: V2Node,
): { x: number; y: number; width: number; height: number } | undefined {
	if (!n.label) return undefined
	const isSmallElement =
		n.type === "startEvent" ||
		n.type === "endEvent" ||
		n.type === "intermediateThrowEvent" ||
		n.type === "intermediateCatchEvent" ||
		n.type === "boundaryEvent" ||
		n.type.includes("Gateway") ||
		n.type.includes("gateway")
	if (!isSmallElement) return undefined

	const labelWidth = Math.min(
		Math.max(n.label.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH),
		LABEL_MAX_WIDTH,
	)
	return {
		x: n.x + n.width / 2 - labelWidth / 2,
		y: n.y + n.height + 4,
		width: labelWidth,
		height: LABEL_HEIGHT,
	}
}

/**
 * Convert V2Graph back to LayoutResult (the stable external interface).
 * Filters out dummy nodes and only includes original sequence flow edges.
 */
function toLayoutResult(graph: V2Graph, originalEdgeIds: Set<string>): LayoutResult {
	const nodes: LayoutNode[] = []
	for (const [, n] of graph.nodes) {
		if (n.isDummy) continue
		nodes.push({
			id: n.id,
			type: n.type as BpmnElementType,
			bounds: { x: n.x, y: n.y, width: n.width, height: n.height },
			layer: n.layer,
			position: n.track,
			label: n.label,
			labelBounds: computeNodeLabelBounds(n),
		})
	}

	const edges: LayoutEdge[] = []
	for (const [, e] of graph.edges) {
		if (!originalEdgeIds.has(e.id)) continue
		if (e.waypoints.length === 0) continue
		edges.push({
			id: e.id,
			sourceRef: e.sourceId,
			targetRef: e.targetId,
			waypoints: e.waypoints,
			label: e.label,
		})
	}

	return { nodes, edges }
}

/**
 * Main layout entry point for the v2 engine.
 *
 * Pipeline:
 *   1. Build graph                     (Module 1)
 *   2. Identify trunk via BFS          (Module 2)
 *   3. Detect cycles, make DAG         (Module 3)
 *   4. Assign layers, align gateways,
 *      inject dummy nodes              (Module 4)
 *   5. Assign tracks + coordinates     (Module 5)
 *   6. Assign ports                    (Module 6)
 *   7. Route edges                     (Module 7)
 *   8. Re-attach annotations           (Module 8)
 */
export function layoutV2(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	textAnnotations: BpmnTextAnnotation[] = [],
	associations: BpmnAssociation[] = [],
): LayoutResult {
	if (flowNodes.length === 0) return { nodes: [], edges: [] }

	// Module 1: Build graph
	const { graph, nodeIndex } = buildV2Graph(flowNodes, sequenceFlows, textAnnotations, associations)
	const originalEdgeIds = new Set(sequenceFlows.map((f) => f.id))

	// Module 3: Cycle detection + DAG construction
	const backEdges = detectBackEdges(graph)
	const backEdgeIds = new Set(backEdges.map((b) => b.edgeId))
	const dag = makeDAG(graph, backEdges)

	// Module 2: Trunk identification (uses DAG — back-edges already reversed)
	const trunkIds = identifyTrunk(dag, nodeIndex, sequenceFlows)

	// Module 4: Layer assignment + gateway alignment + dummy injection
	// dag shares node objects with graph, so mutations propagate back
	assignLayers(dag)
	alignGatewayPairs(dag, nodeIndex)
	const augmented = injectDummies(dag)

	// Re-add edges that were either excluded from the DAG (back-edges) or replaced
	// by dummy-node segments (multi-span forward edges). Both need to be routed
	// directly using their real source/target nodes.
	for (const [, e] of graph.edges) {
		if (!augmented.edges.has(e.id)) {
			augmented.addEdge(e)
		}
	}

	// Module 5: Track assignment + coordinates
	assignTracks(augmented, trunkIds, backEdgeIds, sequenceFlows, nodeIndex)
	assignCoordinates(augmented)

	// Module 6: Port assignment
	const ports = assignPorts(augmented)

	// Module 7: Edge routing
	routeAllEdges(augmented, ports)

	// Convert back to LayoutResult (excludes dummies and synthetic edges)
	const result = toLayoutResult(augmented, originalEdgeIds)

	// Module 8: Annotation re-attachment
	const annResults = layoutAnnotations(textAnnotations, associations, augmented)
	for (const ann of annResults) {
		result.nodes.push({
			id: ann.annotationId,
			// textAnnotation is not in BpmnElementType; cast needed for layout output only
			type: "textAnnotation" as BpmnElementType,
			bounds: { x: ann.x, y: ann.y, width: ann.width, height: ann.height },
			layer: -1,
			position: 0,
		})
		if (ann.waypoints.length > 0) {
			const assoc = associations.find(
				(a) => a.sourceRef === ann.annotationId || a.targetRef === ann.annotationId,
			)
			if (assoc) {
				result.edges.push({
					id: assoc.id,
					sourceRef: assoc.sourceRef,
					targetRef: assoc.targetRef,
					waypoints: ann.waypoints,
				})
			}
		}
	}

	return result
}
