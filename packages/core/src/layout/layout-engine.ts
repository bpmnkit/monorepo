import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { bandLayout } from "./band-engine.js"
import { buildBlockTree } from "./block-builder.js"
import { applyBlockLayout } from "./block-layout.js"
import {
	alignBaselinePath,
	assignCoordinates,
	assignGridRows,
	resolveLayerOverlaps,
} from "./coordinates.js"
import { minimizeCrossings } from "./crossing.js"
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js"
import { assignLayers, groupByLayer, injectDummyNodes } from "./layers.js"
import { assertNoOverlap } from "./overlap.js"
import { routeEdges } from "./routing.js"
import { layoutSubProcesses } from "./subprocess.js"
import type { LayoutNode, LayoutResult, SubProcessChildResult } from "./types.js"

/**
 * Auto-layout a BPMN process using the Sugiyama/layered algorithm.
 *
 * Phases:
 * 1. Cycle removal — DFS back-edge detection and reversal
 * 2. Layer assignment — Longest-path layering
 * 3. Crossing minimization — Barycenter heuristic
 * 4. Coordinate assignment — Fixed element sizes with spacing
 * 5. Sub-process layout — Recursive nested passes
 * 6. Edge routing — Orthogonal waypoints
 * 7. Overlap assertion — Post-condition validation
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	const result = layoutFlowNodes(process.flowElements, process.sequenceFlows)
	assertNoOverlap(result)
	return result
}

/**
 * Layout a set of flow nodes and sequence flows.
 * Used both for top-level processes and recursively for sub-processes.
 */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) {
		return { nodes: [], edges: [] }
	}

	// Build node index
	const nodeIndex = new Map<string, BpmnFlowElement>()
	for (const node of flowNodes) {
		nodeIndex.set(node.id, node)
	}

	// Phase 1: Build graph and detect/remove cycles
	const graph = buildGraph(flowNodes, sequenceFlows)
	const backEdges = detectBackEdges(graph, sequenceFlows)
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph

	// Phase 2: Try block-based layout (primary path for structured processes)
	// Block layout only works well for processes without back-edges (loops).
	let layoutNodes: LayoutNode[]
	const blockTree = backEdges.length === 0 ? buildBlockTree(dag, nodeIndex) : null
	const usedBlockLayout = blockTree !== null

	const dummyChains = new Map<string, string[]>()
	if (blockTree) {
		layoutNodes = applyBlockLayout(blockTree, nodeIndex)
	} else {
		// Band layout is a complete replacement (handles routing internally).
		// Return early — subprocess handling is performed inside bandLayout.
		return bandLayout(flowNodes, sequenceFlows)
	}

	// Phase 5: Sub-process layout — expand containers and lay out children
	const childResults = layoutSubProcesses(layoutNodes, nodeIndex)

	// After subprocess expansion, push nodes that now overlap with expanded containers.
	// For block layout, assign unique layer indices first so resolveLayerOverlaps works
	// correctly (block layout nodes all start at layer=0).
	if (usedBlockLayout && childResults.length > 0) {
		// Assign each block-layout node a unique layer so overlap resolution doesn't
		// collapse them all into the same bucket and push them vertically apart.
		for (let idx = 0; idx < layoutNodes.length; idx++) {
			const n = layoutNodes[idx]
			if (n) n.layer = idx
		}
	}

	resolveSubProcessOverlaps(layoutNodes)

	// Phase 5b: Resolve Y-direction overlaps caused by subprocess expansion.
	// Expanded subprocesses grow in-place and can overlap same-layer siblings.
	// For block layout without subprocesses, skip this — overlaps are impossible by construction.
	if (!usedBlockLayout || childResults.length > 0) {
		resolveLayerOverlaps(layoutNodes)
	}

	// Phase 5c: Sync child positions to their subprocess containers.
	// resolveLayerOverlaps (including its Y-normalization pass) may have shifted
	// subprocess containers after their children were already translated to
	// absolute coordinates — children must follow.
	syncSubProcessChildren(childResults, layoutNodes)

	// Assign grid-row indices based on final center-Y positions (eliminates pixel-tolerance
	// guessing in port-side decisions).
	assignGridRows(layoutNodes)

	// Phase 6: Edge routing (uses original back-edges for routing, not reversed)
	const nodeMap = new Map<string, LayoutNode>()
	for (const node of layoutNodes) {
		nodeMap.set(node.id, node)
	}

	const edges = routeEdges(sequenceFlows, nodeMap, backEdges, dummyChains)

	// Flatten child results into the main layout, excluding dummy nodes
	const allNodes = layoutNodes.filter((n) => !n.isDummy)
	const allEdges = [...edges]
	for (const child of childResults) {
		for (const cn of child.result.nodes) {
			allNodes.push(cn)
		}
		for (const ce of child.result.edges) {
			allEdges.push(ce)
		}
	}

	return { nodes: allNodes, edges: allEdges }
}

/**
 * Run the Sugiyama layered layout pipeline.
 * Used as fallback for unstructured or loop-containing processes.
 *
 * Phases:
 * 1. Longest-path layer assignment
 * 2. Dummy-node injection for multi-span edges
 * 3. Barycenter crossing minimization
 * 4. Grid coordinate assignment
 * 5. Overlap resolution (safety net)
 */
function sugiyamaLayout(
	dag: ReturnType<typeof buildGraph>,
	nodeIndex: Map<string, BpmnFlowElement>,
	backEdges: ReturnType<typeof detectBackEdges>,
	sequenceFlows: BpmnSequenceFlow[],
): { layoutNodes: LayoutNode[]; dummyChains: Map<string, string[]> } {
	// Phase 1: Layer assignment
	const layers = assignLayers(dag)

	// Phase 2: Inject dummy nodes for edges that skip layers
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId))
	const { augmentedGraph, augmentedLayers, dummyChains } = injectDummyNodes(
		dag,
		layers,
		sequenceFlows,
		backEdgeIds,
	)

	// Phase 3: Group by layer and minimize crossings (using augmented graph with dummies)
	const layerGroups = groupByLayer(augmentedLayers)
	const orderedLayers = minimizeCrossings(layerGroups, augmentedGraph)

	// Phase 4: Coordinate assignment (dummy nodes get 0×0 size at grid-cell centers)
	const layoutNodes = assignCoordinates(orderedLayers, nodeIndex)

	// Phase 5a: Align main-path nodes to a common baseline Y.
	// Grid placement alone can't guarantee this when branch nodes share a layer with
	// baseline nodes and skew the layer's vertical centering.
	alignBaselinePath(layoutNodes, dag, backEdges)

	// Phase 5b: Resolve any Y-overlaps between real nodes in the same layer
	resolveLayerOverlaps(layoutNodes)

	return { layoutNodes, dummyChains }
}

/**
 * After subprocess expansion, cascade-shift all subsequent layers
 * so that inter-layer spacing is preserved.
 */
function resolveSubProcessOverlaps(nodes: LayoutNode[]): void {
	const expanded = nodes.filter((n) => n.isExpanded)
	if (expanded.length === 0) return

	// Group nodes by layer
	const byLayer = new Map<number, LayoutNode[]>()
	for (const n of nodes) {
		const arr = byLayer.get(n.layer)
		if (arr) arr.push(n)
		else byLayer.set(n.layer, [n])
	}

	const layers = [...byLayer.keys()].sort((a, b) => a - b)
	const MIN_GAP = 50

	// Cascade: ensure each layer starts after previous layer's rightmost edge
	for (let i = 1; i < layers.length; i++) {
		const prevKey = layers[i - 1]
		const curKey = layers[i]
		if (prevKey === undefined || curKey === undefined) continue
		const prevNodes = byLayer.get(prevKey)
		const curNodes = byLayer.get(curKey)
		if (!prevNodes || !curNodes) continue

		// Find rightmost edge in previous layer (including labels)
		let prevRight = 0
		for (const n of prevNodes) {
			prevRight = Math.max(prevRight, n.bounds.x + n.bounds.width)
			if (n.labelBounds) {
				prevRight = Math.max(prevRight, n.labelBounds.x + n.labelBounds.width)
			}
		}

		// Find leftmost edge in current layer
		let curLeft = Number.POSITIVE_INFINITY
		for (const n of curNodes) {
			curLeft = Math.min(curLeft, n.bounds.x)
		}

		const gap = curLeft - prevRight
		if (gap < MIN_GAP) {
			const dx = MIN_GAP - gap
			for (const n of curNodes) {
				n.bounds.x += dx
				if (n.labelBounds) {
					n.labelBounds.x += dx
				}
			}
		}
	}
}

/**
 * After post-expansion adjustments (resolveSubProcessOverlaps, resolveLayerOverlaps),
 * subprocess containers may have been shifted. Translate their children by the same
 * delta so that children remain correctly positioned inside their parent.
 */
function syncSubProcessChildren(
	childResults: SubProcessChildResult[],
	layoutNodes: LayoutNode[],
): void {
	if (childResults.length === 0) return

	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) nodeMap.set(n.id, n)

	for (const cr of childResults) {
		const parent = nodeMap.get(cr.parentId)
		if (!parent) continue
		const dx = parent.bounds.x - cr.parentX
		const dy = parent.bounds.y - cr.parentY
		if (dx === 0 && dy === 0) continue

		for (const child of cr.result.nodes) {
			child.bounds.x += dx
			child.bounds.y += dy
			if (child.labelBounds) {
				child.labelBounds.x += dx
				child.labelBounds.y += dy
			}
		}
		for (const edge of cr.result.edges) {
			for (const wp of edge.waypoints) {
				wp.x += dx
				wp.y += dy
			}
			if (edge.labelBounds) {
				edge.labelBounds.x += dx
				edge.labelBounds.y += dy
			}
		}
	}
}
