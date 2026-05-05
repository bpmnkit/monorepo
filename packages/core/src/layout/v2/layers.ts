import type { BpmnFlowElement } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { V2Graph as GraphClass } from "./graph.js"
import type { V2Node } from "./types.js"

const GATEWAY_TYPES = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

function isGateway(type: string): boolean {
	return GATEWAY_TYPES.has(type)
}

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

			// Find deepest layer between split and join (exclusive of join)
			let maxBranchLayer = splitNode.layer
			for (const id of reachable) {
				if (id === candidateId) continue
				const n = dag.nodes.get(id)
				if (n) maxBranchLayer = Math.max(maxBranchLayer, n.layer)
			}

			const joinNode = dag.nodes.get(candidateId)
			if (!joinNode) break
			const required = maxBranchLayer + 1
			if (joinNode.layer < required) {
				const shift = required - joinNode.layer
				// Cascade: push join and all nodes that come after it
				for (const [, n] of dag.nodes) {
					if (n.layer >= joinNode.layer && n.id !== splitId) n.layer += shift
				}
			}
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
export function injectDummies(dag: V2Graph, _originalEdgeIds: Set<string>): V2Graph {
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
