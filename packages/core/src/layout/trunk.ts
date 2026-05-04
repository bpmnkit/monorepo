import type { BpmnFlowElement, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import type { DirectedGraph } from "./graph.js"

/** Pattern matching node/edge names associated with rejection or error paths. */
export const REJECTION_PATTERN = /reject|escalat|error|cancel|declin/i

/**
 * Y-coordinates for each band level.
 * Band 0: rarely used (reserved above channel)
 * Band 1: back-edge return channel (loops route through here)
 * Band 2: trunk / happy path
 * Band 3: alternate paths
 * Band 4: rejection / error paths
 * Band 5: rarely used (below rejection)
 */
export const BAND_Y = { 0: 100, 1: 250, 2: 500, 3: 700, 4: 900, 5: 1100 } as const

/** Band classification for a node (0–5). */
export type NodeBand = 0 | 1 | 2 | 3 | 4 | 5

/** Extra cost added to edges and nodes that match rejection terms in Dijkstra. */
const REJECTION_COST = 10000

/**
 * Identify the trunk (happy-path) node set via Dijkstra from startEvent to endEvent(s).
 * Edges and nodes with rejection-related names are penalised (cost += REJECTION_COST)
 * so that the shortest path prefers non-rejection routes.
 *
 * Returns the set of node IDs on the best (lowest-cost) path to any endEvent.
 * Returns an empty Set when no startEvent is present.
 */
export function identifyTrunk(
	nodeIndex: Map<string, BpmnFlowElement>,
	dag: DirectedGraph,
	sequenceFlows: BpmnSequenceFlow[],
): Set<string> {
	// Find start event
	let startId: string | undefined
	for (const [id, node] of nodeIndex) {
		if (node.type === "startEvent") {
			startId = id
			break
		}
	}
	if (!startId) return new Set()

	// Index flows by sourceRef for fast lookup
	const flowsBySource = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of sequenceFlows) {
		let bucket = flowsBySource.get(flow.sourceRef)
		if (!bucket) {
			bucket = []
			flowsBySource.set(flow.sourceRef, bucket)
		}
		bucket.push(flow)
	}

	// Dijkstra — track cost and predecessor for path reconstruction
	const dist = new Map<string, number>()
	const prev = new Map<string, string>()
	const visited = new Set<string>()

	for (const id of dag.nodes) {
		dist.set(id, Number.POSITIVE_INFINITY)
	}
	dist.set(startId, 0)

	// Simple priority queue using a sorted array (graph is small)
	const queue: Array<{ id: string; cost: number }> = [{ id: startId, cost: 0 }]

	while (queue.length > 0) {
		// Find minimum-cost unvisited node
		queue.sort((a, b) => a.cost - b.cost)
		const entry = queue.shift()
		if (!entry) break
		const { id: u } = entry
		if (visited.has(u)) continue
		visited.add(u)

		const succs = dag.successors.get(u) ?? []
		const outFlows = flowsBySource.get(u) ?? []

		for (const v of succs) {
			// Find the flow connecting u → v (prefer non-rejection flows)
			const connectingFlow = outFlows.find((f) => f.targetRef === v)
			let edgeCost = 1
			// Penalise edges with rejection terms in their name
			if (connectingFlow?.name && REJECTION_PATTERN.test(connectingFlow.name)) {
				edgeCost += REJECTION_COST
			}
			// Penalise target nodes with rejection terms in their name
			const targetNode = nodeIndex.get(v)
			if (targetNode?.name && REJECTION_PATTERN.test(targetNode.name)) {
				edgeCost += REJECTION_COST
			}

			const alt = (dist.get(u) ?? Number.POSITIVE_INFINITY) + edgeCost
			if (alt < (dist.get(v) ?? Number.POSITIVE_INFINITY)) {
				dist.set(v, alt)
				prev.set(v, u)
				queue.push({ id: v, cost: alt })
			}
		}
	}

	// Find the end event(s) with the lowest cost
	let bestEndId: string | undefined
	let bestCost = Number.POSITIVE_INFINITY
	for (const [id, node] of nodeIndex) {
		if (node.type !== "endEvent") continue
		const cost = dist.get(id) ?? Number.POSITIVE_INFINITY
		if (cost < bestCost) {
			bestCost = cost
			bestEndId = id
		}
	}

	if (!bestEndId || bestCost === Number.POSITIVE_INFINITY) return new Set()

	// Reconstruct path from startId to bestEndId
	const trunk = new Set<string>()
	let currentId: string | undefined = bestEndId
	while (currentId) {
		trunk.add(currentId)
		currentId = prev.get(currentId)
	}

	return trunk
}

/**
 * Classify every node into a band (0–5).
 *
 * Rules (in priority order):
 * - Trunk nodes → band 2
 * - Nodes that are source of a back-edge → band 1
 * - Nodes with rejection terms in name → band 4
 * - Nodes reached via rejection-labelled incoming edges → band 4
 * - Everything else → band 3
 */
export function classifyNodeBands(
	nodeIndex: Map<string, BpmnFlowElement>,
	dag: DirectedGraph,
	trunkIds: ReadonlySet<string>,
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: ReadonlySet<string>,
): Map<string, NodeBand> {
	const bands = new Map<string, NodeBand>()

	// Build set of back-edge source node IDs
	const backEdgeSources = new Set<string>()
	for (const flow of sequenceFlows) {
		if (backEdgeIds.has(flow.id)) {
			backEdgeSources.add(flow.sourceRef)
		}
	}

	// Build map of nodeId → incoming flows for rejection-edge detection
	const incomingFlows = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of sequenceFlows) {
		let bucket = incomingFlows.get(flow.targetRef)
		if (!bucket) {
			bucket = []
			incomingFlows.set(flow.targetRef, bucket)
		}
		bucket.push(flow)
	}

	for (const id of dag.nodes) {
		const node = nodeIndex.get(id)

		// Priority 1: trunk nodes
		if (trunkIds.has(id)) {
			bands.set(id, 2)
			continue
		}

		// Priority 2: back-edge sources (loop source nodes)
		if (backEdgeSources.has(id)) {
			bands.set(id, 1)
			continue
		}

		// Priority 3 & 4: rejection classification
		let isRejection = false

		// Node name matches rejection pattern
		if (node?.name && REJECTION_PATTERN.test(node.name)) {
			isRejection = true
		}

		// Any incoming edge has a rejection-labelled name
		if (!isRejection) {
			const incoming = incomingFlows.get(id) ?? []
			for (const flow of incoming) {
				if (flow.name && REJECTION_PATTERN.test(flow.name)) {
					isRejection = true
					break
				}
			}
		}

		if (isRejection) {
			bands.set(id, 4)
			continue
		}

		// Default: alternate path
		bands.set(id, 3)
	}

	return bands
}
