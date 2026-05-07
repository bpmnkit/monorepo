import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import {
	BRANCH_GAP,
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
 * Build a forward-only adjacency map, excluding back-edges.
 * Back-edge traversal contaminates branch detection by marking branch nodes
 * as "downstream of join", causing repositioning to find empty branches and bail.
 */
function buildForwardAdj(graph: V2Graph): Map<string, string[]> {
	const adj = new Map<string, string[]>()
	for (const [, e] of graph.edges) {
		if (e.isBackEdge) continue
		const list = adj.get(e.sourceId) ?? []
		list.push(e.targetId)
		adj.set(e.sourceId, list)
	}
	return adj
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
	const fwd = buildForwardAdj(graph)

	for (const [splitId, splitNode] of graph.nodes) {
		if (!isGateway(splitNode.type) || splitNode.isDummy) continue
		if (realAdjCount(graph.getSuccessors(splitId), graph) <= 1) continue

		// BFS to find all nodes reachable from split (forward edges only)
		const reachable = new Set<string>()
		const bfsQ = [...(fwd.get(splitId) ?? [])]
		while (bfsQ.length > 0) {
			const cur = bfsQ.shift()
			if (cur === undefined || reachable.has(cur)) continue
			reachable.add(cur)
			bfsQ.push(...(fwd.get(cur) ?? []))
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

		// Collect downstream of join (forward edges only — back-edges would traverse
		// back into branches, incorrectly excluding them from repositioning)
		const fromJoin = new Set<string>()
		const joinQ = [...(fwd.get(joinId) ?? [])]
		while (joinQ.length > 0) {
			const cur = joinQ.shift()
			if (cur === undefined || fromJoin.has(cur)) continue
			fromJoin.add(cur)
			joinQ.push(...(fwd.get(cur) ?? []))
		}

		// BFS from each real direct successor of split to build per-branch node lists.
		// Back-edge sources (track 1) and rejection nodes (track 4) are excluded so
		// that their special Y bands are preserved.
		const assigned = new Set<string>()
		const branches: string[][] = []

		for (const succId of fwd.get(splitId) ?? []) {
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
				q.push(...(fwd.get(cur) ?? []))
			}

			if (branchNodes.length > 0) branches.push(branchNodes)
		}

		if (branches.length === 0) continue

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

/**
 * Find all split-join gateway pairs in the graph.
 * Returns pairs sorted by split layer descending so innermost pairs are first.
 */
function findGatewayPairs(graph: V2Graph): Array<{ splitId: string; joinId: string }> {
	const pairs: Array<{ splitId: string; joinId: string; splitLayer: number }> = []
	const fwd = buildForwardAdj(graph)

	for (const [splitId, splitNode] of graph.nodes) {
		if (!isGateway(splitNode.type) || splitNode.isDummy) continue
		if (realAdjCount(graph.getSuccessors(splitId), graph) <= 1) continue

		const reachable = new Set<string>()
		const bfsQ = [...(fwd.get(splitId) ?? [])]
		while (bfsQ.length > 0) {
			const cur = bfsQ.shift()
			if (cur === undefined || reachable.has(cur)) continue
			reachable.add(cur)
			bfsQ.push(...(fwd.get(cur) ?? []))
		}

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

		pairs.push({ splitId, joinId, splitLayer: splitNode.layer })
	}

	return pairs.sort((a, b) => b.splitLayer - a.splitLayer)
}

/**
 * Reposition the branches of a single split-join gateway pair so that the longest
 * branch is centered at the gateway's Y, with shorter branches interleaved above
 * and below using actual bounding-box dimensions.
 *
 * Operates on already-placed nodes (runs after assignCoordinates).
 * By processing pairs innermost-first, inner pair dimensions are already final
 * when the outer pair is processed.
 */
function repositionOnePair(graph: V2Graph, splitId: string, joinId: string): void {
	const splitNode = graph.nodes.get(splitId)
	if (!splitNode) return

	const gatewayY = splitNode.y + splitNode.height / 2
	const fwd = buildForwardAdj(graph)

	// Collect nodes downstream of join (forward edges only — back-edges would traverse
	// back into branches, incorrectly excluding them from repositioning)
	const fromJoin = new Set<string>()
	const joinQ = [...(fwd.get(joinId) ?? [])]
	while (joinQ.length > 0) {
		const cur = joinQ.shift()
		if (cur === undefined || fromJoin.has(cur)) continue
		fromJoin.add(cur)
		joinQ.push(...(fwd.get(cur) ?? []))
	}

	// Build per-branch node lists from each direct real successor of split
	const branches: string[][] = []
	for (const succId of fwd.get(splitId) ?? []) {
		if (succId === joinId) continue
		const succNode = graph.nodes.get(succId)
		if (!succNode || succNode.isDummy) continue

		const branchNodes: string[] = []
		const visited = new Set<string>([splitId])
		const q: string[] = [succId]
		while (q.length > 0) {
			const cur: string | undefined = q.shift()
			if (cur === undefined || visited.has(cur) || cur === joinId) continue
			visited.add(cur)
			if (fromJoin.has(cur)) continue
			const n = graph.nodes.get(cur)
			if (n && !n.isDummy) branchNodes.push(cur)
			q.push(...(fwd.get(cur) ?? []))
		}
		if (branchNodes.length > 0) branches.push(branchNodes)
	}

	if (branches.length <= 1) return

	// Compute the actual bounding box of each branch using current node positions
	type BranchInfo = {
		nodeIds: string[]
		top: number
		bottom: number
		height: number
		centerY: number
		nodeCount: number
	}
	const infos: BranchInfo[] = branches.map((nodeIds) => {
		let top = Number.POSITIVE_INFINITY
		let bottom = Number.NEGATIVE_INFINITY
		for (const id of nodeIds) {
			const n = graph.nodes.get(id)
			if (!n) continue
			top = Math.min(top, n.y)
			bottom = Math.max(bottom, n.y + n.height)
		}
		const height = bottom - top
		return { nodeIds, top, bottom, height, centerY: (top + bottom) / 2, nodeCount: nodeIds.length }
	})

	// Sort by node count descending: most-elements branch → center (gatewayY).
	// Tiebreak by bounding-box height so visually larger branches stay central.
	infos.sort((a, b) => b.nodeCount - a.nodeCount || b.height - a.height)

	// Place: branch[0] → at gatewayY, branch[1] → below, branch[2] → above,
	//        branch[3] → further below, branch[4] → further above, ...
	const centerHeight = infos[0]?.height ?? 0
	let aboveTop = gatewayY - centerHeight / 2
	let belowBottom = gatewayY + centerHeight / 2
	const targetCenterYs: number[] = [gatewayY]

	for (let i = 1; i < infos.length; i++) {
		const h = infos[i]?.height ?? 0
		if (i % 2 === 1) {
			// below
			const cy = belowBottom + BRANCH_GAP + h / 2
			targetCenterYs.push(cy)
			belowBottom = cy + h / 2
		} else {
			// above
			const cy = aboveTop - BRANCH_GAP - h / 2
			targetCenterYs.push(cy)
			aboveTop = cy - h / 2
		}
	}

	// Shift each branch to its target center Y.
	// A node can appear in multiple branches (reachable from several split successors).
	// Prevent double-shifting: first branch to claim a node wins.
	const shifted = new Set<string>()
	for (let i = 0; i < infos.length; i++) {
		const info = infos[i]
		const targetCY = targetCenterYs[i]
		if (!info || targetCY === undefined) continue
		const shift = Math.round(targetCY - info.centerY)
		if (shift === 0) {
			for (const id of info.nodeIds) shifted.add(id)
			continue
		}
		for (const id of info.nodeIds) {
			if (shifted.has(id)) continue
			shifted.add(id)
			const n = graph.nodes.get(id)
			if (n) n.y += shift
		}
	}
}

/**
 * After assignCoordinates, re-center the branches of each gateway pair so the
 * longest branch sits at the gateway's Y and shorter branches are distributed
 * symmetrically above and below based on actual bounding-box heights.
 *
 * Pairs are processed innermost-first so outer pairs account for already-compacted
 * inner pair dimensions.
 */
export function repositionGatewayBranches(graph: V2Graph): void {
	for (const { splitId, joinId } of findGatewayPairs(graph)) {
		repositionOnePair(graph, splitId, joinId)
	}
}

// ---------------------------------------------------------------------------
// Debug / diagnostics
// ---------------------------------------------------------------------------

export interface GatewayBranch {
	nodeIds: string[]
	labels: string[]
	centerY: number
	height: number
}

export interface GatewayPairInfo {
	splitId: string
	joinId: string
	splitLabel: string
	joinLabel: string
	gatewayY: number
	layer: number
	branches: GatewayBranch[]
	/** Bounding box covering split, join, and all branch nodes. */
	bounds: { x: number; y: number; width: number; height: number }
	/** IDs of nested pairs (split IDs) found inside any branch of this pair. */
	nestedPairSplitIds: string[]
}

/**
 * Return a structured description of every split-join gateway pair in the graph,
 * including the nodes in each branch and their final Y positions.
 * Call this after assignCoordinates + repositionGatewayBranches.
 */
export function describeGatewayTree(
	graph: V2Graph,
	labelOf: (id: string) => string,
): GatewayPairInfo[] {
	const pairs = findGatewayPairs(graph) // innermost first
	const fwd = buildForwardAdj(graph)

	const result: GatewayPairInfo[] = []

	for (const { splitId, joinId } of pairs) {
		const splitNode = graph.nodes.get(splitId)
		const joinNode = graph.nodes.get(joinId)
		if (!splitNode || !joinNode) continue

		const gatewayY = splitNode.y + splitNode.height / 2

		// Collect downstream of join (forward edges only)
		const fromJoin = new Set<string>()
		const joinQ = [...(fwd.get(joinId) ?? [])]
		while (joinQ.length > 0) {
			const cur = joinQ.shift()
			if (cur === undefined || fromJoin.has(cur)) continue
			fromJoin.add(cur)
			joinQ.push(...(fwd.get(cur) ?? []))
		}

		// Per-branch node lists
		const branches: GatewayBranch[] = []
		for (const succId of fwd.get(splitId) ?? []) {
			if (succId === joinId) continue
			const succNode = graph.nodes.get(succId)
			if (!succNode || succNode.isDummy) continue

			const branchNodes: string[] = []
			const visited = new Set<string>([splitId])
			const q: string[] = [succId]
			while (q.length > 0) {
				const cur: string | undefined = q.shift()
				if (cur === undefined || visited.has(cur) || cur === joinId) continue
				visited.add(cur)
				if (fromJoin.has(cur)) continue
				const n = graph.nodes.get(cur)
				if (n && !n.isDummy) branchNodes.push(cur)
				q.push(...(fwd.get(cur) ?? []))
			}
			if (branchNodes.length === 0) continue

			let top = Number.POSITIVE_INFINITY
			let bottom = Number.NEGATIVE_INFINITY
			for (const id of branchNodes) {
				const n = graph.nodes.get(id)
				if (!n) continue
				top = Math.min(top, n.y)
				bottom = Math.max(bottom, n.y + n.height)
			}

			branches.push({
				nodeIds: branchNodes,
				labels: branchNodes.map(labelOf),
				centerY: (top + bottom) / 2,
				height: bottom - top,
			})
		}

		// Find nested pairs inside this pair's overall interior
		const allInterior = new Set<string>()
		for (const b of branches) {
			for (const id of b.nodeIds) allInterior.add(id)
		}
		const nestedPairSplitIds = pairs
			.filter(
				(p) => p.splitId !== splitId && allInterior.has(p.splitId) && allInterior.has(p.joinId),
			)
			.map((p) => p.splitId)

		// Bounding box over split + join + all branch nodes
		const allNodeIds = [splitId, joinId, ...branches.flatMap((b) => b.nodeIds)]
		let minX = Number.POSITIVE_INFINITY
		let minY = Number.POSITIVE_INFINITY
		let maxX = Number.NEGATIVE_INFINITY
		let maxY = Number.NEGATIVE_INFINITY
		for (const id of allNodeIds) {
			const n = graph.nodes.get(id)
			if (!n) continue
			minX = Math.min(minX, n.x)
			minY = Math.min(minY, n.y)
			maxX = Math.max(maxX, n.x + n.width)
			maxY = Math.max(maxY, n.y + n.height)
		}
		const bounds = {
			x: Math.round(minX),
			y: Math.round(minY),
			width: Math.round(maxX - minX),
			height: Math.round(maxY - minY),
		}

		result.push({
			splitId,
			joinId,
			splitLabel: labelOf(splitId),
			joinLabel: labelOf(joinId),
			gatewayY,
			layer: splitNode.layer,
			branches,
			bounds,
			nestedPairSplitIds,
		})
	}

	// Return outermost first (reverse innermost-first order)
	return result.reverse()
}
