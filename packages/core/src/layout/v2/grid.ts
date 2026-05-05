import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import {
	CELL_SIZE,
	LEFT_MARGIN,
	MIN_COL_GAP,
	REJECTION_PATTERN,
	STACK_V_GAP,
	TRACK_Y,
} from "./types.js"
import type { NodeTrack } from "./types.js"

/**
 * Classify each node into a track (Y-band):
 *   Track 2 = trunk (happy path)      — isTrunk=true
 *   Track 1 = back-edge source nodes  — isBackEdgeSource=true
 *   Track 4 = rejection/error paths
 *   Track 3 = everything else (alternate paths)
 *
 * Dummy nodes are assigned to track 2.
 * Mutates node.track, node.isTrunk, node.isBackEdgeSource in-place.
 */
export function assignTracks(
	graph: V2Graph,
	trunkIds: Set<string>,
	backEdgeIds: Set<string>,
	sequenceFlows: BpmnSequenceFlow[],
	nodeIndex: Map<string, BpmnFlowElement>,
): void {
	// Build set of back-edge source node IDs (from sequence flow IDs)
	const backEdgeSources = new Set<string>()
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) backEdgeSources.add(f.sourceRef)
	}

	// Build incoming flows per node for rejection edge detection
	const incomingFlows = new Map<string, BpmnSequenceFlow[]>()
	for (const f of sequenceFlows) {
		const bucket = incomingFlows.get(f.targetRef) ?? []
		bucket.push(f)
		incomingFlows.set(f.targetRef, bucket)
	}

	for (const [id, node] of graph.nodes) {
		if (node.isDummy) {
			node.track = 2
			continue
		}

		if (trunkIds.has(id)) {
			node.track = 2
			node.isTrunk = true
			continue
		}
		if (backEdgeSources.has(id)) {
			node.track = 1
			node.isBackEdgeSource = true
			continue
		}

		const bpmnNode = nodeIndex.get(id)
		let isRejection = !!(bpmnNode?.name && REJECTION_PATTERN.test(bpmnNode.name))
		if (!isRejection) {
			const incoming = incomingFlows.get(id) ?? []
			isRejection = incoming.some((f) => f.name && REJECTION_PATTERN.test(f.name))
		}

		node.track = isRejection ? 4 : 3
	}
}

/**
 * Snap a value to the nearest multiple of CELL_SIZE.
 */
function snap(v: number): number {
	return Math.round(v / CELL_SIZE) * CELL_SIZE
}

/**
 * Group real (non-dummy) node IDs by layer, then by track within each layer.
 */
function groupByLayerAndTrack(graph: V2Graph): Map<number, Map<NodeTrack, string[]>> {
	const result = new Map<number, Map<NodeTrack, string[]>>()
	for (const [id, n] of graph.nodes) {
		if (n.isDummy) continue
		let byTrack = result.get(n.layer)
		if (!byTrack) {
			byTrack = new Map()
			result.set(n.layer, byTrack)
		}
		const bucket = byTrack.get(n.track) ?? []
		bucket.push(id)
		byTrack.set(n.track, bucket)
	}
	return result
}

/**
 * Assign X/Y pixel coordinates to all nodes using TRACK_Y bands and CELL_SIZE snapping.
 *
 * X: Layers are placed left to right. Each column X is:
 *      X_layer[0] = LEFT_MARGIN (snapped)
 *      X_layer[i+1] = X_layer[i] + max(widestNodeInLayer, maxAnnotationWidth/2) + MIN_COL_GAP
 *    All X values are snapped to CELL_SIZE.
 *
 * Y: node.y = TRACK_Y[track] - height/2 (snapped to CELL_SIZE).
 *    When multiple nodes share the same layer+track, they are stacked vertically
 *    starting from TRACK_Y[track] - totalHeight/2, with STACK_V_GAP between them.
 *
 * Dummy nodes are placed at X of their layer and Y of TRACK_Y[2].
 *
 * Mutates node.x and node.y in-place on all nodes.
 */
export function assignCoordinates(graph: V2Graph): void {
	const layerGroups = groupByLayerAndTrack(graph)
	// Collect ALL layer values (including dummy-only layers)
	const allLayerNums = new Set<number>()
	for (const n of graph.nodes.values()) allLayerNums.add(n.layer)
	const sortedLayers = [...allLayerNums].sort((a, b) => a - b)

	// Calculate X for each layer
	const layerX = new Map<number, number>()
	let currentX = snap(LEFT_MARGIN)

	for (const layer of sortedLayers) {
		layerX.set(layer, currentX)
		const byTrack = layerGroups.get(layer)

		// Find effective column width: max of (node width, annotation half-width)
		let maxW = 0
		for (const ids of byTrack?.values() ?? []) {
			for (const id of ids) {
				const n = graph.nodes.get(id)
				if (!n) continue
				const effectiveW = Math.max(n.width, (n.annotationWidth ?? 0) / 2)
				maxW = Math.max(maxW, effectiveW)
			}
		}

		currentX = snap(currentX + maxW + MIN_COL_GAP)
	}

	// Place dummy nodes
	for (const [, n] of graph.nodes) {
		if (!n.isDummy) continue
		const lx = layerX.get(n.layer) ?? snap(LEFT_MARGIN)
		n.x = lx
		n.y = snap(TRACK_Y[2]) // dummy has height=0, center on trunk
	}

	// Place real nodes
	for (const layer of sortedLayers) {
		const byTrack = layerGroups.get(layer)
		const lx = layerX.get(layer)
		if (!byTrack || lx === undefined) continue

		for (const [track, ids] of byTrack) {
			const trackCenterY = TRACK_Y[track as NodeTrack]
			const sorted = [...ids].sort() // deterministic ordering by id
			const totalH =
				sorted.reduce((acc, id) => acc + (graph.nodes.get(id)?.height ?? 0), 0) +
				STACK_V_GAP * (sorted.length - 1)
			let curY = trackCenterY - totalH / 2

			for (const id of sorted) {
				const n = graph.nodes.get(id)
				if (!n) continue
				n.x = lx
				n.y = snap(curY)
				curY += n.height + STACK_V_GAP
			}
		}
	}
}
