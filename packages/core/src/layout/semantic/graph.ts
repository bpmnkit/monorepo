import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"

/** Flow-node types that end a path — used to score candidate spine edges. */
const END_TYPES = new Set(["endEvent"])

/**
 * Adjacency for one process scope, with cycles broken and ranks assigned.
 *
 * Boundary events are not ranked themselves: they dock onto their host, and an
 * implicit host → handler edge carries their successors forward instead. That
 * keeps a handler path strictly to the right of the activity it guards.
 */
export interface SemanticGraph {
	/** Rankable flow nodes, in declaration order. Boundary events excluded. */
	nodes: BpmnFlowElement[]
	byId: Map<string, BpmnFlowElement>
	outgoing: Map<string, BpmnSequenceFlow[]>
	incoming: Map<string, BpmnSequenceFlow[]>
	/** hostId → boundary events attached to it, in declaration order. */
	attachers: Map<string, BpmnBoundaryEvent[]>
	/** Ids of sequence flows that close a cycle; excluded from ranking. */
	backEdges: Set<string>
	/** Weakly connected components, each a node-id list in declaration order. */
	components: string[][]
	/** Semantic start node id per component, index-aligned with `components`. */
	starts: string[]
	/** Longest-path rank per node id. */
	ranks: Map<string, number>
}

/**
 * The node a flow leaves from for layout purposes. A flow out of a boundary
 * event belongs to the host's position, not the event's.
 */
function effectiveSource(flow: BpmnSequenceFlow, byId: Map<string, BpmnFlowElement>): string {
	const source = byId.get(flow.sourceRef)
	if (source?.type === "boundaryEvent") return (source as BpmnBoundaryEvent).attachedToRef
	return flow.sourceRef
}

export function buildSemanticGraph(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): SemanticGraph {
	const byId = new Map<string, BpmnFlowElement>()
	for (const el of flowElements) byId.set(el.id, el)

	const nodes: BpmnFlowElement[] = []
	const attachers = new Map<string, BpmnBoundaryEvent[]>()
	for (const el of flowElements) {
		if (el.type === "boundaryEvent") {
			const be = el as BpmnBoundaryEvent
			const list = attachers.get(be.attachedToRef)
			if (list) list.push(be)
			else attachers.set(be.attachedToRef, [be])
		} else {
			nodes.push(el)
		}
	}

	const outgoing = new Map<string, BpmnSequenceFlow[]>()
	const incoming = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of sequenceFlows) {
		const from = effectiveSource(flow, byId)
		if (!byId.has(from) || !byId.has(flow.targetRef)) continue
		const out = outgoing.get(from)
		if (out) out.push(flow)
		else outgoing.set(from, [flow])
		const inc = incoming.get(flow.targetRef)
		if (inc) inc.push(flow)
		else incoming.set(flow.targetRef, [flow])
	}

	const graph: SemanticGraph = {
		nodes,
		byId,
		outgoing,
		incoming,
		attachers,
		backEdges: new Set(),
		components: [],
		starts: [],
		ranks: new Map(),
	}

	findComponents(graph)
	markBackEdges(graph)
	assignRanks(graph)
	return graph
}

/** Weakly connected components, discovered in declaration order. */
function findComponents(graph: SemanticGraph): void {
	const seen = new Set<string>()
	for (const node of graph.nodes) {
		if (seen.has(node.id)) continue
		const members: string[] = []
		const stack = [node.id]
		while (stack.length > 0) {
			const id = stack.pop()
			if (id === undefined || seen.has(id)) continue
			seen.add(id)
			members.push(id)
			for (const f of graph.outgoing.get(id) ?? []) stack.push(f.targetRef)
			for (const f of graph.incoming.get(id) ?? []) stack.push(effectiveSource(f, graph.byId))
		}
		// Declaration order within the component keeps ties deterministic.
		const order = new Map(graph.nodes.map((n, i) => [n.id, i]))
		members.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
		graph.components.push(members)
		graph.starts.push(pickStart(members, graph))
	}
}

/**
 * A component starts at its earliest declared start event, else its earliest
 * node with no incoming flow, else its earliest declared node.
 */
function pickStart(members: string[], graph: SemanticGraph): string {
	const startEvent = members.find((id) => graph.byId.get(id)?.type === "startEvent")
	if (startEvent) return startEvent
	const source = members.find((id) => (graph.incoming.get(id) ?? []).length === 0)
	return source ?? members[0] ?? ""
}

/**
 * Depth-first from each semantic start; an edge onto a node already on the
 * traversal stack closes a cycle and is excluded from ranking.
 */
function markBackEdges(graph: SemanticGraph): void {
	const state = new Map<string, "open" | "done">()

	const visit = (id: string): void => {
		state.set(id, "open")
		for (const flow of graph.outgoing.get(id) ?? []) {
			const target = flow.targetRef
			const targetState = state.get(target)
			if (targetState === "open") graph.backEdges.add(flow.id)
			else if (targetState === undefined) visit(target)
		}
		state.set(id, "done")
	}

	for (const start of graph.starts) if (start && !state.has(start)) visit(start)
	// Nodes only reachable through a cycle still need a traversal root.
	for (const node of graph.nodes) if (!state.has(node.id)) visit(node.id)
}

/**
 * Longest-path ranks over the acyclic remainder, then a bounded fixed point so
 * a boundary handler never precedes the activity it is attached to.
 */
function assignRanks(graph: SemanticGraph): void {
	const { ranks } = graph
	for (const node of graph.nodes) ranks.set(node.id, 0)

	const forward = (id: string): BpmnSequenceFlow[] =>
		(graph.outgoing.get(id) ?? []).filter((f) => !graph.backEdges.has(f.id))

	// Longest path: relax every edge until no rank grows. |V| passes suffice
	// because the remaining graph is acyclic.
	for (let pass = 0; pass < graph.nodes.length + 1; pass++) {
		let changed = false
		for (const node of graph.nodes) {
			const rank = ranks.get(node.id) ?? 0
			for (const flow of forward(node.id)) {
				const target = ranks.get(flow.targetRef) ?? 0
				if (target < rank + 1) {
					ranks.set(flow.targetRef, rank + 1)
					changed = true
				}
			}
		}
		if (!changed) break
	}

	// Normalize each component so its start sits at rank 0.
	for (let i = 0; i < graph.components.length; i++) {
		const members = graph.components[i]
		if (!members) continue
		let min = Number.POSITIVE_INFINITY
		for (const id of members) min = Math.min(min, ranks.get(id) ?? 0)
		if (min === 0 || !Number.isFinite(min)) continue
		for (const id of members) ranks.set(id, (ranks.get(id) ?? 0) - min)
	}
}

/** True when an end event is reachable from `id` without traversing a back edge. */
export function reachesEnd(graph: SemanticGraph, id: string): boolean {
	const seen = new Set<string>()
	const stack = [id]
	while (stack.length > 0) {
		const current = stack.pop()
		if (current === undefined || seen.has(current)) continue
		seen.add(current)
		const node = graph.byId.get(current)
		if (node && END_TYPES.has(node.type)) return true
		const out = graph.outgoing.get(current) ?? []
		if (out.length === 0 && seen.size > 1) return true // a terminal node ends the path
		for (const flow of out) {
			if (!graph.backEdges.has(flow.id)) stack.push(flow.targetRef)
		}
	}
	return false
}
