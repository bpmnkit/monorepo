// packages/core/src/layout/v2/trunk.ts
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { V2Graph } from "./graph.js"
import { REJECTION_PATTERN } from "./types.js"

/**
 * Weighted BFS (Dijkstra) from startEvent to the lowest-cost endEvent.
 * Flows/nodes with rejection terms are penalised (+10000).
 * Default-flagged outgoing flows from gateways get 0 cost (preferred).
 * Returns the set of node IDs on the winning path.
 */
export function identifyTrunk(
	graph: V2Graph,
	nodeIndex: Map<string, BpmnFlowElement>,
	sequenceFlows: BpmnSequenceFlow[],
): Set<string> {
	let startId: string | undefined
	for (const [id, n] of nodeIndex) {
		if (n.type === "startEvent") {
			startId = id
			break
		}
	}
	if (!startId) return new Set()

	// Index flows by source for O(1) lookup
	const flowsBySource = new Map<string, BpmnSequenceFlow[]>()
	for (const f of sequenceFlows) {
		const bucket = flowsBySource.get(f.sourceRef) ?? []
		bucket.push(f)
		flowsBySource.set(f.sourceRef, bucket)
	}

	// Collect default flow IDs from gateways
	const defaultFlowIds = new Set<string>()
	for (const n of nodeIndex.values()) {
		if ("default" in n && n.default) defaultFlowIds.add(n.default)
	}

	const dist = new Map<string, number>()
	const prev = new Map<string, string>()
	const visited = new Set<string>()
	for (const id of graph.nodes.keys()) dist.set(id, Number.POSITIVE_INFINITY)
	dist.set(startId, 0)

	const queue: Array<{ id: string; cost: number }> = [{ id: startId, cost: 0 }]

	while (queue.length > 0) {
		queue.sort((a, b) => a.cost - b.cost)
		const entry = queue.shift()
		if (!entry || visited.has(entry.id)) continue
		visited.add(entry.id)

		for (const succId of graph.getSuccessors(entry.id)) {
			const connectingFlow = (flowsBySource.get(entry.id) ?? []).find((f) => f.targetRef === succId)
			let edgeCost = defaultFlowIds.has(connectingFlow?.id ?? "") ? 0 : 1
			if (connectingFlow?.name && REJECTION_PATTERN.test(connectingFlow.name)) edgeCost += 10000
			const targetNode = nodeIndex.get(succId)
			if (targetNode?.name && REJECTION_PATTERN.test(targetNode.name)) edgeCost += 10000

			const alt = (dist.get(entry.id) ?? Number.POSITIVE_INFINITY) + edgeCost
			if (alt < (dist.get(succId) ?? Number.POSITIVE_INFINITY)) {
				dist.set(succId, alt)
				prev.set(succId, entry.id)
				queue.push({ id: succId, cost: alt })
			}
		}
	}

	// Find best endEvent
	let bestEndId: string | undefined
	let bestCost = Number.POSITIVE_INFINITY
	for (const [id, n] of nodeIndex) {
		if (n.type !== "endEvent") continue
		const cost = dist.get(id) ?? Number.POSITIVE_INFINITY
		if (cost < bestCost) {
			bestCost = cost
			bestEndId = id
		}
	}

	if (!bestEndId || bestCost === Number.POSITIVE_INFINITY) return new Set()

	// Reconstruct path
	const trunk = new Set<string>()
	let cur: string | undefined = bestEndId
	while (cur) {
		trunk.add(cur)
		cur = prev.get(cur)
	}
	return trunk
}
