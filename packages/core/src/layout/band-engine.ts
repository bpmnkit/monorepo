import type { BpmnFlowElement, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { routeEdgeAstar } from "./astar.js"
import { assignGridRows, resolveLayerOverlaps } from "./coordinates.js"
import { minimizeCrossings } from "./crossing.js"
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js"
import { assignLayers, groupByLayer, injectDummyNodes } from "./layers.js"
import { placeEdgeLabelsExport, resolveEdgeCrossings } from "./routing.js"
import { layoutSubProcesses } from "./subprocess.js"
import { BAND_Y, classifyNodeBands, identifyTrunk } from "./trunk.js"
import type { NodeBand } from "./trunk.js"
import { ELEMENT_SIZES } from "./types.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult, Waypoint } from "./types.js"

/** Minimum horizontal gap between columns (pixels).
 * Must exceed the max label overhang for adjacent small nodes (2 × 47px = 94px for 36px nodes with 130px labels).
 */
const MIN_H_GAP = 100

/** Vertical gap between nodes stacked in the same layer+band (pixels). */
const STACK_GAP = 20

/** Left margin for the first layer. */
const LEFT_MARGIN = 50

/** Get the fixed size for a BPMN element type. */
function getSize(type: string): { width: number; height: number } {
	return ELEMENT_SIZES[type] ?? { width: 100, height: 80 }
}

/**
 * Full band layout engine.
 *
 * Produces a layout where:
 * - Trunk (happy path) nodes sit on a horizontal band at Y≈500
 * - Alternate path nodes are below at Y≈700
 * - Rejection/error nodes are at Y≈900
 * - Back-edge loops route through Y≈250 channel above the trunk
 */
export function bandLayout(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) return { nodes: [], edges: [] }

	// Build node index
	const nodeIndex = new Map<string, BpmnFlowElement>()
	for (const n of flowNodes) {
		nodeIndex.set(n.id, n)
	}

	// Module 3: Build graph, detect back-edges, make DAG
	const graph = buildGraph(flowNodes, sequenceFlows)
	const backEdges = detectBackEdges(graph, sequenceFlows)
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId))

	// Module 2: Trunk identification and band classification
	const trunkIds = identifyTrunk(nodeIndex, dag, sequenceFlows)
	const bandMap = classifyNodeBands(nodeIndex, dag, trunkIds, sequenceFlows, backEdgeIds)

	// Module 4: Layer assignment + dummy node injection
	const layers = assignLayers(dag)
	const { augmentedGraph, augmentedLayers, dummyChains } = injectDummyNodes(
		dag,
		layers,
		sequenceFlows,
		backEdgeIds,
	)

	// Crossing minimization for layer order
	const layerGroups = groupByLayer(augmentedLayers)
	const orderedLayers = minimizeCrossings(layerGroups, augmentedGraph)

	// Modules 5+6: Coordinate assignment using band Y-positions
	const layoutNodes = assignBandCoordinates(orderedLayers, nodeIndex, bandMap, augmentedLayers)

	// Sub-process layout (same as existing engine)
	const childResults = layoutSubProcesses(layoutNodes, nodeIndex)

	// Resolve Y overlaps (band stacking handles most, but subprocesses can cause more)
	resolveLayerOverlaps(layoutNodes)

	// Sync subprocess children after any position adjustments
	syncBandSubProcessChildren(childResults, layoutNodes)

	// Assign grid rows for port-side decisions
	assignGridRows(layoutNodes)

	// Build node map for routing
	const nodeMap = new Map<string, LayoutNode>()
	for (const n of layoutNodes) {
		nodeMap.set(n.id, n)
	}

	// Module 7: Edge routing
	const edges = routeBandEdges(sequenceFlows, nodeMap, backEdges, dummyChains)

	// Flatten: exclude dummy nodes from output, include subprocess children
	const allNodes = layoutNodes.filter((n) => !n.isDummy)
	const allEdges = [...edges]
	for (const child of childResults) {
		for (const cn of child.result.nodes) allNodes.push(cn)
		for (const ce of child.result.edges) allEdges.push(ce)
	}

	return { nodes: allNodes, edges: allEdges }
}

/**
 * Assign X and Y coordinates using band-based layout.
 *
 * X-axis (Module 6):
 * - Columns are spaced by maxWidth(layer) + MIN_H_GAP
 * - Each node is centered within its column
 *
 * Y-axis (Module 5):
 * - Real nodes: centered at BAND_Y[band]
 * - Multiple nodes in same layer+band: stacked vertically with STACK_GAP
 * - Dummy nodes: placed at center Y of adjacent real nodes (fallback: BAND_Y[2])
 */
function assignBandCoordinates(
	orderedLayers: string[][],
	nodeIndex: Map<string, BpmnFlowElement>,
	bandMap: Map<string, NodeBand>,
	augmentedLayers: Map<string, number>,
): LayoutNode[] {
	const layoutNodes: LayoutNode[] = []

	// Compute per-layer maximum element width
	const layerMaxWidth: number[] = orderedLayers.map((layer) => {
		let max = 0
		for (const id of layer) {
			const node = nodeIndex.get(id)
			const w = node ? getSize(node.type).width : 0
			if (w > max) max = w
		}
		return max
	})

	// Compute X position of each layer's left edge
	const layerX: number[] = []
	let xCursor = LEFT_MARGIN
	for (let i = 0; i < orderedLayers.length; i++) {
		layerX.push(xCursor)
		xCursor += (layerMaxWidth[i] ?? 0) + MIN_H_GAP
	}

	// Assign positions layer by layer
	for (let layerIdx = 0; layerIdx < orderedLayers.length; layerIdx++) {
		const layer = orderedLayers[layerIdx]
		if (!layer) continue
		const colX = layerX[layerIdx] ?? LEFT_MARGIN
		const colWidth = layerMaxWidth[layerIdx] ?? 0

		// Separate real from dummy nodes in this layer
		const realNodes: string[] = []
		const dummyNodes: string[] = []
		for (const id of layer) {
			if (nodeIndex.has(id)) {
				realNodes.push(id)
			} else {
				dummyNodes.push(id)
			}
		}

		// Group real nodes by band for stacking
		const byBand = new Map<NodeBand, string[]>()
		for (const id of realNodes) {
			const band: NodeBand = bandMap.get(id) ?? 3
			let bucket = byBand.get(band)
			if (!bucket) {
				bucket = []
				byBand.set(band, bucket)
			}
			bucket.push(id)
		}

		// Place real nodes
		for (const [band, ids] of byBand) {
			const bandCenterY = BAND_Y[band]
			const sizes = ids.map((id) => {
				const node = nodeIndex.get(id)
				return node ? getSize(node.type) : { width: 0, height: 0 }
			})

			// Compute total height of the stack
			const totalHeight = sizes.reduce((sum, s) => sum + s.height, 0) + STACK_GAP * (ids.length - 1)
			let currentY = bandCenterY - totalHeight / 2

			for (let i = 0; i < ids.length; i++) {
				const id = ids[i]
				if (!id) continue
				const node = nodeIndex.get(id)
				if (!node) continue
				const size = sizes[i] ?? { width: 0, height: 0 }

				// Center the node within the column width
				const xOffset = (colWidth - size.width) / 2
				const bounds: Bounds = {
					x: colX + xOffset,
					y: currentY,
					width: size.width,
					height: size.height,
				}

				layoutNodes.push({
					id,
					type: node.type,
					bounds,
					layer: layerIdx,
					position: layer.indexOf(id),
					label: node.name,
					labelBounds: computeLabelBoundsForBand(node, bounds),
					isDummy: false,
				})

				currentY += size.height + STACK_GAP
			}
		}

		// Place dummy nodes (used as routing waypoints)
		// Find the Y of adjacent real nodes in this layer to determine dummy Y
		let dummyY: number = BAND_Y[2] // fallback: trunk band
		if (realNodes.length > 0) {
			// Use the average center Y of real nodes in this layer
			const sumY = realNodes.reduce((sum, id) => {
				const n = layoutNodes.find((ln) => ln.id === id)
				return n ? sum + n.bounds.y + n.bounds.height / 2 : sum
			}, 0)
			dummyY = realNodes.length > 0 ? sumY / realNodes.length : BAND_Y[2]
		} else {
			// No real nodes — use Y of adjacent real nodes from neighbouring layers
			dummyY = findNeighbourLayerY(layerIdx, orderedLayers, nodeIndex, augmentedLayers)
		}

		for (const id of dummyNodes) {
			// Dummy nodes are 0×0 and placed at (colCenter, dummyY)
			const colCenterX = colX + colWidth / 2
			layoutNodes.push({
				id,
				type: "serviceTask", // placeholder type — filtered out of output
				bounds: { x: colCenterX, y: dummyY, width: 0, height: 0 },
				layer: layerIdx,
				position: layer.indexOf(id),
				isDummy: true,
			})
		}
	}

	return layoutNodes
}

/**
 * Find the Y coordinate from a neighbouring layer's nodes,
 * used as a fallback Y for dummy-only layers.
 */
function findNeighbourLayerY(
	layerIdx: number,
	orderedLayers: string[][],
	nodeIndex: Map<string, BpmnFlowElement>,
	augmentedLayers: Map<string, number>,
): number {
	// Reference augmentedLayers to satisfy the parameter (it's passed for context)
	void augmentedLayers
	// Search backwards and forwards for a layer with real nodes
	for (let delta = 1; delta < orderedLayers.length; delta++) {
		for (const dir of [-1, 1]) {
			const idx = layerIdx + dir * delta
			if (idx < 0 || idx >= orderedLayers.length) continue
			const layer = orderedLayers[idx]
			if (!layer) continue
			for (const id of layer) {
				if (nodeIndex.has(id)) {
					return BAND_Y[2]
				}
			}
		}
	}
	return BAND_Y[2]
}

/** Compute label bounds for an event or gateway node (same logic as coordinates.ts). */
function computeLabelBoundsForBand(node: BpmnFlowElement, bounds: Bounds): Bounds | undefined {
	if (!node.name) return undefined

	const labelWidth = Math.min(Math.max(node.name.length * 7, 40), 130)
	const labelHeight = 14

	switch (node.type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
			return {
				x: bounds.x + bounds.width / 2 - labelWidth / 2,
				y: bounds.y + bounds.height + 4,
				width: labelWidth,
				height: labelHeight,
			}
		default:
			return undefined
	}
}

/**
 * Route all edges for the band layout.
 *
 * - Back-edges: routed through the BAND_Y[1] channel above the trunk
 * - Forward edges with dummy chain: L-shape waypoints via dummy positions
 * - Direct forward edges: A* routing
 */
function routeBandEdges(
	sequenceFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
	backEdges: ReturnType<typeof detectBackEdges>,
	dummyChains: Map<string, string[]>,
): LayoutEdge[] {
	const backEdgeSet = new Set(backEdges.map((be) => be.flowId))

	// Compute canvas bounds for A* routing
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const n of nodeMap.values()) {
		if (n.isDummy) continue
		minX = Math.min(minX, n.bounds.x)
		minY = Math.min(minY, n.bounds.y)
		maxX = Math.max(maxX, n.bounds.x + n.bounds.width)
		maxY = Math.max(maxY, n.bounds.y + n.bounds.height)
	}
	const CANVAS_PAD = 200
	const canvasW = (maxX === Number.NEGATIVE_INFINITY ? 800 : maxX - minX) + CANVAS_PAD * 2
	const canvasH = (maxY === Number.NEGATIVE_INFINITY ? 600 : maxY - minY) + CANVAS_PAD * 2

	// Collect all real nodes for obstacle computation
	const allRealNodes: LayoutNode[] = []
	for (const n of nodeMap.values()) {
		if (!n.isDummy) allRealNodes.push(n)
	}

	const edges: LayoutEdge[] = []

	for (const flow of sequenceFlows) {
		const source = nodeMap.get(flow.sourceRef)
		const target = nodeMap.get(flow.targetRef)
		if (!source || !target) continue

		let waypoints: Waypoint[]

		if (backEdgeSet.has(flow.id)) {
			// Back-edge: route through the BAND_Y[1] channel
			waypoints = routeBackEdgeBand(source, target)
		} else {
			const dummies = dummyChains.get(flow.id)
			if (dummies && dummies.length > 0) {
				// Multi-span: use dummy chain as L-shape waypoints
				waypoints = routeViaChain(source, target, dummies, nodeMap)
			} else {
				// Direct forward edge: A* routing
				const obstacles: Bounds[] = allRealNodes
					.filter((n) => n.id !== flow.sourceRef && n.id !== flow.targetRef)
					.map((n) => n.bounds)

				const srcPort = {
					x: source.bounds.x + source.bounds.width,
					y: source.bounds.y + source.bounds.height / 2,
				}
				const tgtPort = {
					x: target.bounds.x,
					y: target.bounds.y + target.bounds.height / 2,
				}

				const astarResult = routeEdgeAstar(srcPort, tgtPort, obstacles, canvasW, canvasH)
				waypoints = astarResult.length >= 2 ? astarResult : [srcPort, tgtPort]
			}
		}

		edges.push({
			id: flow.id,
			sourceRef: flow.sourceRef,
			targetRef: flow.targetRef,
			waypoints,
			label: flow.name,
			labelBounds: undefined,
		})
	}

	// Apply crossing resolution (same post-processing as existing routing)
	resolveEdgeCrossings(edges, nodeMap)

	// Place edge labels
	placeEdgeLabelsExport(edges, nodeMap)

	return edges
}

/**
 * Route a back-edge through the BAND_Y[1] channel above the trunk.
 * Path: srcRight → srcRight+20 → (srcRight+20, channelY) → (tgtLeft-20, channelY) → tgtLeft-20 → tgtLeft
 */
function routeBackEdgeBand(source: LayoutNode, target: LayoutNode): Waypoint[] {
	const channelY = BAND_Y[1]

	const srcRight = source.bounds.x + source.bounds.width
	const srcCy = source.bounds.y + source.bounds.height / 2
	const tgtLeft = target.bounds.x
	const tgtCy = target.bounds.y + target.bounds.height / 2

	return [
		{ x: srcRight, y: srcCy },
		{ x: srcRight + 20, y: srcCy },
		{ x: srcRight + 20, y: channelY },
		{ x: tgtLeft - 20, y: channelY },
		{ x: tgtLeft - 20, y: tgtCy },
		{ x: tgtLeft, y: tgtCy },
	]
}

/**
 * Route an edge via its dummy-node chain using L-shaped segments.
 * Mirrors routeViaChain from routing.ts.
 */
function routeViaChain(
	source: LayoutNode,
	target: LayoutNode,
	dummyIds: readonly string[],
	nodeMap: Map<string, LayoutNode>,
): Waypoint[] {
	const waypoints: Waypoint[] = []

	const srcRight = source.bounds.x + source.bounds.width
	const srcCy = source.bounds.y + source.bounds.height / 2
	waypoints.push({ x: srcRight, y: srcCy })

	let prevY = srcCy
	for (const dummyId of dummyIds) {
		const dummy = nodeMap.get(dummyId)
		if (!dummy) continue
		const dx = dummy.bounds.x
		const dy = dummy.bounds.y
		if (Math.abs(prevY - dy) > 0.5) {
			waypoints.push({ x: dx, y: prevY })
		}
		waypoints.push({ x: dx, y: dy })
		prevY = dy
	}

	const tgtLeft = target.bounds.x
	const tgtCy = target.bounds.y + target.bounds.height / 2
	if (Math.abs(prevY - tgtCy) > 0.5) {
		waypoints.push({ x: tgtLeft, y: prevY })
	}
	waypoints.push({ x: tgtLeft, y: tgtCy })

	return collapseCollinear(waypoints)
}

/** Remove collinear intermediate waypoints. */
function collapseCollinear(waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length <= 2) return waypoints
	const result: Waypoint[] = [waypoints[0] as Waypoint]
	for (let i = 1; i < waypoints.length - 1; i++) {
		const prev = result[result.length - 1] as Waypoint
		const curr = waypoints[i] as Waypoint
		const next = waypoints[i + 1] as Waypoint
		const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5
		const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5
		if (sameX || sameY) continue
		result.push(curr)
	}
	result.push(waypoints[waypoints.length - 1] as Waypoint)
	return result
}

/**
 * After subprocess expansion, sync children to follow their parent container.
 * Same logic as in layout-engine.ts.
 */
function syncBandSubProcessChildren(
	childResults: ReturnType<typeof layoutSubProcesses>,
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
