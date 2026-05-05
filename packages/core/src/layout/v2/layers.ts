import type { BpmnFlowElement } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { V2Graph as GraphClass } from "./graph.js"
import type { V2Node } from "./types.js"
import { CELL_SIZE, isGateway } from "./types.js"

function isSplitGateway(id: string, graph: V2Graph): boolean {
	return isGateway(graph.nodes.get(id)?.type ?? "") && graph.getSuccessors(id).length > 1
}

function isJoinGateway(id: string, graph: V2Graph): boolean {
	return isGateway(graph.nodes.get(id)?.type ?? "") && graph.getPredecessors(id).length > 1
}

/**
 * Topological layer assignment (longest-path from sources).
 * Sets node.layer in-place on the DAG graph.
 */
export function assignLayers(dag: V2Graph): void {
	// Kahn's algorithm for topological sort + longest-path layer
	const inDegree = new Map<string, number>()
	for (const id of dag.nodes.keys()) inDegree.set(id, 0)
	for (const [, e] of dag.edges) {
		inDegree.set(e.targetId, (inDegree.get(e.targetId) ?? 0) + 1)
	}

	const queue: string[] = []
	for (const [id, deg] of inDegree) {
		if (deg === 0) {
			const n = dag.nodes.get(id)
			if (n) n.layer = 0
			queue.push(id)
		}
	}

	while (queue.length > 0) {
		const id = queue.shift()
		if (id === undefined) break
		const node = dag.nodes.get(id)
		if (!node) continue
		for (const succId of dag.getSuccessors(id)) {
			const succ = dag.nodes.get(succId)
			if (!succ) continue
			succ.layer = Math.max(succ.layer, node.layer + 1)
			const newDeg = (inDegree.get(succId) ?? 1) - 1
			inDegree.set(succId, newDeg)
			if (newDeg === 0) queue.push(succId)
		}
	}
}

/**
 * Gateway-gateway alignment:
 * For every split/join gateway pair, find the deepest layer in the branch paths
 * and set join.layer = maxBranchLayer + 1.
 * Mutates node.layer in-place.
 */
// _nodeIndex reserved for future gateway type narrowing (e.g., event-based gateways)
export function alignGatewayPairs(dag: V2Graph, _nodeIndex: Map<string, BpmnFlowElement>): void {
	for (const [splitId] of dag.nodes) {
		if (!isSplitGateway(splitId, dag)) continue
		const splitNode = dag.nodes.get(splitId)
		if (!splitNode) continue

		// BFS to find all nodes reachable from this split
		const reachable = new Set<string>()
		const bfsQ = [...dag.getSuccessors(splitId)]
		while (bfsQ.length > 0) {
			const cur = bfsQ.shift()
			if (cur === undefined || reachable.has(cur)) continue
			reachable.add(cur)
			bfsQ.push(...dag.getSuccessors(cur))
		}

		// Among reachable join gateways, find the one directly joined to this split:
		// the join gateway whose ALL predecessors are reachable from the split (or are the split itself).
		for (const candidateId of reachable) {
			if (!isJoinGateway(candidateId, dag)) continue
			const preds = dag.getPredecessors(candidateId)
			const allFromSplit = preds.every((p) => reachable.has(p) || p === splitId)
			if (!allFromSplit) continue

			// Build the set of nodes reachable FROM the join (its downstream).
			// This lets us exclude downstream nodes when computing maxBranchLayer,
			// and restrict the cascade shift to only the join and its successors.
			const fromJoin = new Set<string>()
			const joinBfsQueue = [...dag.getSuccessors(candidateId)]
			while (joinBfsQueue.length > 0) {
				const cur = joinBfsQueue.shift()
				if (cur === undefined || fromJoin.has(cur)) continue
				fromJoin.add(cur)
				joinBfsQueue.push(...dag.getSuccessors(cur))
			}

			// Only count nodes between split and join (exclude the join itself and downstream nodes).
			// This prevents nodes after the join from inflating maxBranchLayer.
			let maxBranchLayer = splitNode.layer
			for (const id of reachable) {
				if (id === candidateId || fromJoin.has(id)) continue
				const n = dag.nodes.get(id)
				if (n) maxBranchLayer = Math.max(maxBranchLayer, n.layer)
			}

			const joinNode = dag.nodes.get(candidateId)
			if (!joinNode) continue
			const required = maxBranchLayer + 1
			if (joinNode.layer < required) {
				const shift = required - joinNode.layer
				// Only shift the join and its downstream nodes — not unrelated branches.
				joinNode.layer += shift
				for (const id of fromJoin) {
					const n = dag.nodes.get(id)
					if (n) n.layer += shift
				}
			}
			break
		}
	}
}

/**
 * For every direct split-gateway→join-gateway edge (span=1 after alignGatewayPairs),
 * shift the join and all its downstream nodes +1 layer, then insert a 40×40 virtual
 * spacer dummy at the intermediate layer to hold column width for the empty bypass path.
 * Mutates node.layer in-place and adds spacer nodes to the dag.
 */
export function injectVirtualSpacers(dag: V2Graph): void {
	let spacerCounter = 0

	for (const [splitId] of dag.nodes) {
		if (!isSplitGateway(splitId, dag)) continue
		const splitNode = dag.nodes.get(splitId)
		if (!splitNode) continue

		for (const succId of dag.getSuccessors(splitId)) {
			if (!isJoinGateway(succId, dag)) continue
			const joinNode = dag.nodes.get(succId)
			if (!joinNode) continue
			// Only inject when split and join are directly adjacent (bypass has no nodes)
			if (joinNode.layer !== splitNode.layer + 1) continue

			// BFS downstream from join to shift along with it
			const fromJoin = new Set<string>()
			const q = [...dag.getSuccessors(succId)]
			while (q.length > 0) {
				const cur = q.shift()
				if (cur === undefined || fromJoin.has(cur)) continue
				fromJoin.add(cur)
				q.push(...dag.getSuccessors(cur))
			}
			joinNode.layer += 1
			for (const id of fromJoin) {
				const n = dag.nodes.get(id)
				if (n) n.layer += 1
			}

			// Insert virtual spacer at the new intermediate layer to claim column width
			const spacer: V2Node = {
				id: `__spacer_${splitId}_${spacerCounter++}`,
				type: "virtual_spacer",
				width: CELL_SIZE,
				height: CELL_SIZE,
				x: 0,
				y: 0,
				layer: splitNode.layer + 1,
				track: 2,
				isTrunk: false,
				isBackEdgeSource: false,
				isDummy: true,
			}
			dag.addNode(spacer)
			break
		}
	}
}

/**
 * Inject dummy nodes for edges that span more than one layer.
 * A dummy node has isDummy=true and width/height=0.
 * Returns the augmented graph (new nodes/edges added, originals preserved).
 * Edges with "__rev" suffix (DAG-only back-edge reversals) are kept as-is.
 */
export function injectDummies(dag: V2Graph): V2Graph {
	const augmented = new GraphClass()
	for (const n of dag.nodes.values()) augmented.addNode(n)

	let dummyCounter = 0

	for (const [, e] of dag.edges) {
		// Keep synthetic reversal edges without dummy injection
		if (e.id.endsWith("__rev")) {
			augmented.addEdge(e)
			continue
		}

		const srcNode = dag.nodes.get(e.sourceId)
		const tgtNode = dag.nodes.get(e.targetId)
		if (!srcNode || !tgtNode) {
			augmented.addEdge(e)
			continue
		}

		const layerSpan = tgtNode.layer - srcNode.layer

		if (layerSpan <= 1) {
			augmented.addEdge(e)
			continue
		}

		// Insert dummy nodes at each intermediate layer
		let prevId = e.sourceId
		for (let l = srcNode.layer + 1; l < tgtNode.layer; l++) {
			const dummyId = `__dummy_${e.id}_${dummyCounter++}`
			const dummy: V2Node = {
				id: dummyId,
				type: "dummy",
				width: 0,
				height: 0,
				x: 0,
				y: 0,
				layer: l,
				track: 2,
				isTrunk: false,
				isBackEdgeSource: false,
				isDummy: true,
			}
			augmented.addNode(dummy)
			augmented.addEdge({
				id: `${e.id}_seg_${l}`,
				sourceId: prevId,
				targetId: dummyId,
				isBackEdge: false,
				waypoints: [],
			})
			prevId = dummyId
		}
		augmented.addEdge({
			id: `${e.id}_seg_${tgtNode.layer}`,
			sourceId: prevId,
			targetId: e.targetId,
			isBackEdge: false,
			waypoints: [],
		})
	}

	return augmented
}
