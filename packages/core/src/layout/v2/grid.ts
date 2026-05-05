import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import {
	CELL_SIZE,
	LEFT_MARGIN,
	MIN_COL_GAP,
	REJECTION_PATTERN,
	STACK_V_GAP,
	TRACK_Y,
	isGateway,
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
 * Count real (non-dummy) successors or predecessors of a node.
 */
function realAdjCount(ids: string[], graph: V2Graph): number {
	return ids.filter((id) => !(graph.nodes.get(id)?.isDummy ?? false)).length
}

/**
 * After global track assignment, reassign tracks within each split-join gateway pair
 * so the branch with the most real nodes occupies track 2 (same Y as the gateways).
 * Other branches are assigned tracks 3 (below) and 4 in descending size order.
 *
 * Back-edge sources (track 1) and dummy nodes are never reassigned.
 * Must be called after assignTracks and before assignCoordinates.
 */
export function reassignGatewayBranchTracks(graph: V2Graph): void {
	for (const [splitId, splitNode] of graph.nodes) {
		if (!isGateway(splitNode.type) || splitNode.isDummy) continue
		if (realAdjCount(graph.getSuccessors(splitId), graph) <= 1) continue

		// BFS to find all nodes reachable from split
		const reachable = new Set<string>()
		const bfsQ = [...graph.getSuccessors(splitId)]
		while (bfsQ.length > 0) {
			const cur = bfsQ.shift()
			if (cur === undefined || reachable.has(cur)) continue
			reachable.add(cur)
			bfsQ.push(...graph.getSuccessors(cur))
		}

		// Find the matching join gateway (all non-dummy predecessors come from split's reachable set)
		let joinId: string | undefined
		for (const candidateId of reachable) {
			const candidate = graph.nodes.get(candidateId)
			if (!candidate || !isGateway(candidate.type) || candidate.isDummy) continue
			if (realAdjCount(graph.getPredecessors(candidateId), graph) <= 1) continue
			const preds = graph
				.getPredecessors(candidateId)
				.filter((p) => !(graph.nodes.get(p)?.isDummy ?? false))
			if (preds.every((p) => reachable.has(p) || p === splitId)) {
				joinId = candidateId
				break
			}
		}
		if (!joinId) continue

		// Collect downstream of join (to exclude from interior)
		const fromJoin = new Set<string>()
		const joinQ = [...graph.getSuccessors(joinId)]
		while (joinQ.length > 0) {
			const cur = joinQ.shift()
			if (cur === undefined || fromJoin.has(cur)) continue
			fromJoin.add(cur)
			joinQ.push(...graph.getSuccessors(cur))
		}

		// BFS from each real direct successor of split to build per-branch node lists.
		// Back-edge sources (track 1) and rejection nodes (track 4) are excluded so
		// that their special Y bands are preserved.
		const assigned = new Set<string>()
		const branches: string[][] = []

		for (const succId of graph.getSuccessors(splitId)) {
			if (succId === joinId) continue
			const succNode = graph.nodes.get(succId)
			if (succNode?.isDummy) continue

			const branchNodes: string[] = []
			const visited = new Set<string>([splitId])
			const q: string[] = [succId]

			while (q.length > 0) {
				const cur: string | undefined = q.shift()
				if (cur === undefined || visited.has(cur) || cur === joinId) continue
				visited.add(cur)
				if (fromJoin.has(cur)) continue

				const n = graph.nodes.get(cur)
				if (n && !n.isDummy && !n.isBackEdgeSource && n.track !== 4 && !assigned.has(cur)) {
					branchNodes.push(cur)
					assigned.add(cur)
				}
				q.push(...graph.getSuccessors(cur))
			}

			if (branchNodes.length > 0) branches.push(branchNodes)
		}

		if (branches.length <= 1) continue

		// Largest branch → same track as the split gateway, smaller branches cascade below.
		// This ensures nested pairs stay relative to their parent pair's Y band.
		branches.sort((a, b) => b.length - a.length)
		const splitTrack = splitNode.track as number
		for (let i = 0; i < branches.length; i++) {
			const track = Math.min(5, splitTrack + i) as NodeTrack
			for (const nodeId of branches[i] ?? []) {
				const n = graph.nodes.get(nodeId)
				if (n) n.track = track
			}
		}
	}
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

	// Build virtual spacer max width per layer (isDummy with width > 0)
	const spacerWidths = new Map<number, number>()
	for (const [, n] of graph.nodes) {
		if (n.isDummy && n.width > 0) {
			spacerWidths.set(n.layer, Math.max(spacerWidths.get(n.layer) ?? 0, n.width))
		}
	}

	// Calculate X for each layer
	const layerX = new Map<number, number>()
	let currentX = snap(LEFT_MARGIN)

	for (const layer of sortedLayers) {
		layerX.set(layer, currentX)
		const byTrack = layerGroups.get(layer)

		// Find effective column width: max of (node width, annotation half-width, virtual spacer width)
		let maxW = spacerWidths.get(layer) ?? 0
		let hasGateway = false
		for (const ids of byTrack?.values() ?? []) {
			for (const id of ids) {
				const n = graph.nodes.get(id)
				if (!n) continue
				const effectiveW = Math.max(n.width, (n.annotationWidth ?? 0) / 2)
				maxW = Math.max(maxW, effectiveW)
				if (isGateway(n.type)) hasGateway = true
			}
		}

		// Rule 5: Extra gap for gateway columns to provide routing lane clearance
		const gap = hasGateway ? MIN_COL_GAP + CELL_SIZE : MIN_COL_GAP
		currentX = snap(currentX + maxW + gap)
	}

	// Place dummy nodes
	for (const [, n] of graph.nodes) {
		if (!n.isDummy) continue
		const lx = layerX.get(n.layer) ?? snap(LEFT_MARGIN)
		n.x = lx
		n.y = TRACK_Y[2] // dummy has height=0, center on trunk
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
				// Round to nearest pixel; do NOT snap to CELL_SIZE so that center-Y
				// stays at TRACK_Y regardless of element height.
				n.y = Math.round(curY)
				curY += n.height + STACK_V_GAP
			}
		}

		// Resolve cross-track overlaps within this layer: if a higher-track stack
		// bleeds into lower-track territory, shift the higher stack down.
		resolveCrossTrackOverlaps(graph, byTrack, STACK_V_GAP)
	}

	// Rule 1: Lock trunk nodes at track 2 to exact TRACK_Y[2] center.
	// Skip nodes reassigned to a different track by reassignGatewayBranchTracks.
	for (const [, n] of graph.nodes) {
		if (!n.isDummy && n.isTrunk && n.track === 2) {
			n.y = TRACK_Y[2] - Math.round(n.height / 2)
		}
	}
}

/**
 * After initial placement, shift stacks in higher-numbered tracks downward
 * if they physically overlap with stacks in lower-numbered tracks.
 */
function resolveCrossTrackOverlaps(
	graph: V2Graph,
	byTrack: Map<NodeTrack, string[]>,
	gap: number,
): void {
	const sortedTracks = [...byTrack.keys()].sort((a, b) => a - b)
	for (let i = 0; i < sortedTracks.length - 1; i++) {
		const lowerTrack = sortedTracks[i]
		const upperTrack = sortedTracks[i + 1]
		if (lowerTrack === undefined || upperTrack === undefined) continue
		const lowerIds = byTrack.get(lowerTrack) ?? []
		const upperIds = byTrack.get(upperTrack) ?? []

		// Find the bottom edge of the lower-track stack
		let lowerBottom = Number.NEGATIVE_INFINITY
		for (const id of lowerIds) {
			const n = graph.nodes.get(id)
			if (n) lowerBottom = Math.max(lowerBottom, n.y + n.height)
		}
		if (!Number.isFinite(lowerBottom)) continue

		// Find the top edge of the upper-track stack
		let upperTop = Number.POSITIVE_INFINITY
		for (const id of upperIds) {
			const n = graph.nodes.get(id)
			if (n) upperTop = Math.min(upperTop, n.y)
		}
		if (!Number.isFinite(upperTop)) continue

		const overlap = lowerBottom + gap - upperTop
		if (overlap > 0) {
			// Shift the entire upper stack down by the overlap amount
			for (const id of upperIds) {
				const n = graph.nodes.get(id)
				if (n) n.y += overlap
			}
		}
	}
}
