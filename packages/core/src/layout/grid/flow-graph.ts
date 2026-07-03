import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"

/** Resolved adjacency for one nesting level of a process. */
export interface FlowGraph {
	/** Grid-placeable elements — boundary events are excluded (they ride on their host). */
	elements: BpmnFlowElement[]
	byId: Map<string, BpmnFlowElement>
	outgoing: Map<string, BpmnSequenceFlow[]>
	incoming: Map<string, BpmnSequenceFlow[]>
	/** hostId → boundary events attached to it, in document order. */
	attachers: Map<string, BpmnBoundaryEvent[]>
}

const TASK_TYPES = new Set([
	"task",
	"userTask",
	"serviceTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
])

/** bpmn:Task subtypes — used for the "right-align before a task-only fan-out" rule. */
export function isTaskLike(type: string): boolean {
	return TASK_TYPES.has(type)
}

export function buildFlowGraph(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): FlowGraph {
	const byId = new Map<string, BpmnFlowElement>()
	for (const n of flowNodes) byId.set(n.id, n)

	const outgoing = new Map<string, BpmnSequenceFlow[]>()
	const incoming = new Map<string, BpmnSequenceFlow[]>()
	for (const f of sequenceFlows) {
		if (!outgoing.has(f.sourceRef)) outgoing.set(f.sourceRef, [])
		outgoing.get(f.sourceRef)?.push(f)
		if (!incoming.has(f.targetRef)) incoming.set(f.targetRef, [])
		incoming.get(f.targetRef)?.push(f)
	}

	const attachers = new Map<string, BpmnBoundaryEvent[]>()
	const elements: BpmnFlowElement[] = []
	for (const n of flowNodes) {
		if (n.type === "boundaryEvent") {
			const be = n as BpmnBoundaryEvent
			if (!attachers.has(be.attachedToRef)) attachers.set(be.attachedToRef, [])
			attachers.get(be.attachedToRef)?.push(be)
		} else {
			elements.push(n)
		}
	}

	return { elements, byId, outgoing, incoming, attachers }
}

function isBoundaryAttachedTo(source: BpmnFlowElement | undefined, elId: string): boolean {
	return source?.type === "boundaryEvent" && (source as BpmnBoundaryEvent).attachedToRef === elId
}

/**
 * True iff the element has a "real" predecessor — an incoming flow that is
 * neither a self-loop nor sourced from a boundary event / its own attacher.
 * Elements without one become traversal starting points.
 */
export function hasOtherIncoming(el: BpmnFlowElement, graph: FlowGraph): boolean {
	const flows = graph.incoming.get(el.id) ?? []
	for (const f of flows) {
		if (f.sourceRef === el.id) continue
		const source = graph.byId.get(f.sourceRef)
		if (source?.type !== "boundaryEvent") return true
		if (!isBoundaryAttachedTo(source, el.id)) return true
	}
	return false
}

/** True iff el is a join (>1 incoming) with at least one not-yet-visited feeder. */
export function isFutureIncoming(
	el: BpmnFlowElement,
	visited: Set<string>,
	graph: FlowGraph,
): boolean {
	const flows = graph.incoming.get(el.id) ?? []
	if (flows.length <= 1) return false
	return flows.some((f) => !visited.has(f.sourceRef))
}

/** True iff some unvisited feeder of el is reachable downstream FROM el (a cycle). */
export function formsLoop(el: BpmnFlowElement, visited: Set<string>, graph: FlowGraph): boolean {
	const unvisitedFeeders = (graph.incoming.get(el.id) ?? [])
		.map((f) => f.sourceRef)
		.filter((id) => !visited.has(id))
	for (const feeder of unvisitedFeeders) {
		if (isReachable(el.id, feeder, graph)) return true
	}
	return false
}

function isReachable(fromId: string, targetId: string, graph: FlowGraph): boolean {
	const seen = new Set<string>()
	const stack = [fromId]
	while (stack.length > 0) {
		const id = stack.pop()
		if (id === undefined || seen.has(id)) continue
		seen.add(id)
		for (const f of graph.outgoing.get(id) ?? []) {
			if (f.targetRef === targetId) return true
			stack.push(f.targetRef)
		}
	}
	return false
}
