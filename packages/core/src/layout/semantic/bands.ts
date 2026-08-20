import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { SemanticGraph } from "./graph.js"
import { reachesEnd } from "./graph.js"

/**
 * Vertical narrative roles for one process scope.
 *
 * Band 0 is the spine — the primary path from the start event to an end event.
 * Positive bands sit below it, negative bands above. Branch meaning decides the
 * side: error handlers go down, escalation handlers go up, and plain
 * alternatives alternate down/up so neither side runs away from the spine.
 */
export interface BandLayout {
	/** node id → band. 0 is the spine, > 0 below it, < 0 above it. */
	bands: Map<string, number>
	/** Ids of the nodes on the primary path. */
	spine: Set<string>
	/** Flow ids that continue the spine and should be routed as one segment. */
	straightFlows: Set<string>
}

/** A contiguous run of nodes that leaves the spine and rejoins (or ends). */
interface Branch {
	nodes: string[]
	side: 1 | -1
	/** How far this branch already is from the spine, in branch hops. */
	depth: number
	minRank: number
	maxRank: number
}

function isDefaultFlow(source: BpmnFlowElement | undefined, flow: BpmnSequenceFlow): boolean {
	if (!source) return false
	const gateway = source as { default?: string }
	return gateway.default !== undefined && gateway.default === flow.id
}

/** Escalation handlers read as "upward" exceptions; everything else reads downward. */
function boundarySide(event: BpmnBoundaryEvent): 1 | -1 {
	return event.eventDefinitions.some((d) => d.type === "escalation") ? -1 : 1
}

export function assignBands(graph: SemanticGraph): BandLayout {
	const bands = new Map<string, number>()
	const spine = new Set<string>()
	const straightFlows = new Set<string>()
	const branches: Branch[] = []

	for (const start of graph.starts) {
		if (!start) continue
		traceSpine(graph, start, spine, straightFlows)
	}
	for (const id of spine) bands.set(id, 0)

	// Branch off the spine first, then off already-placed branches, so a nested
	// alternative always fans farther from the spine than its parent.
	const sources: Array<{ id: string; depth: number; side: 1 | -1 }> = []
	for (const node of graph.nodes) {
		if (spine.has(node.id)) sources.push({ id: node.id, depth: 0, side: 1 })
	}

	const assigned = new Set<string>(spine)
	for (let i = 0; i < sources.length; i++) {
		const source = sources[i]
		if (!source) continue
		for (const branch of branchesFrom(graph, source, assigned)) {
			branches.push(branch)
			for (const id of branch.nodes) {
				assigned.add(id)
				sources.push({ id, depth: branch.depth, side: branch.side })
			}
		}
	}

	// Anything still unassigned (unreachable from any start) trails on the spine.
	for (const node of graph.nodes) if (!assigned.has(node.id)) bands.set(node.id, 0)

	for (const [id, band] of compact(branches)) bands.set(id, band)
	return { bands, spine, straightFlows }
}

/**
 * The spine is picked one edge at a time: prefer a target that can still reach
 * an end event, then the gateway's default flow, then declaration order. That
 * stops a dead-end alternative from becoming the main narrative just because it
 * was declared first.
 */
function traceSpine(
	graph: SemanticGraph,
	start: string,
	spine: Set<string>,
	straightFlows: Set<string>,
): void {
	let current = start
	while (!spine.has(current)) {
		spine.add(current)
		const candidates = (graph.outgoing.get(current) ?? []).filter(
			(f) => !graph.backEdges.has(f.id) && !spine.has(f.targetRef),
		)
		if (candidates.length === 0) return

		const source = graph.byId.get(current)
		const scored = candidates.map((flow, index) => ({
			flow,
			index,
			// A handler path leaving a boundary event is an exception, never the
			// narrative — it only continues the spine if nothing else can.
			handler: flow.sourceRef === current ? 0 : 1,
			ends: reachesEnd(graph, flow.targetRef) ? 0 : 1,
			isDefault: isDefaultFlow(source, flow) ? 0 : 1,
		}))
		scored.sort(
			(a, b) =>
				a.handler - b.handler || a.ends - b.ends || a.isDefault - b.isDefault || a.index - b.index,
		)

		const next = scored[0]
		if (!next) return
		straightFlows.add(next.flow.id)
		current = next.flow.targetRef
	}
}

/**
 * Collect the alternatives leaving one node: its non-spine sequence flows plus
 * the handler paths of any boundary event attached to it.
 */
function branchesFrom(
	graph: SemanticGraph,
	source: { id: string; depth: number; side: 1 | -1 },
	assigned: Set<string>,
): Branch[] {
	const out: Branch[] = []
	const node = graph.byId.get(source.id)

	const alternatives = (graph.outgoing.get(source.id) ?? []).filter(
		(f) => !graph.backEdges.has(f.id) && !assigned.has(f.targetRef),
	)

	// A gateway with a default flow keeps its alternatives on one side; without
	// one they alternate below / above / farther below / farther above.
	const hasDefault = alternatives.some((f) => isDefaultFlow(node, f))
	let below = 0
	let above = 0
	for (let i = 0; i < alternatives.length; i++) {
		const flow = alternatives[i]
		if (!flow) continue
		const handler = handlerSideOf(graph, source.id, flow)
		let side: 1 | -1
		if (handler !== undefined) side = handler
		else if (hasDefault) side = 1
		else side = i % 2 === 0 ? 1 : -1
		const step = side === 1 ? ++below : ++above
		const branch = follow(graph, flow.targetRef, side, source.depth + step, assigned)
		if (branch) out.push(branch)
	}
	return out
}

/** The side a flow inherits when it leaves a boundary event of this host. */
function handlerSideOf(
	graph: SemanticGraph,
	hostId: string,
	flow: BpmnSequenceFlow,
): 1 | -1 | undefined {
	if (flow.sourceRef === hostId) return undefined
	const event = (graph.attachers.get(hostId) ?? []).find((e) => e.id === flow.sourceRef)
	return event ? boundarySide(event) : undefined
}

/** Follow a branch forward until it rejoins placed flow or runs out. */
function follow(
	graph: SemanticGraph,
	entry: string,
	side: 1 | -1,
	depth: number,
	assigned: Set<string>,
): Branch | null {
	const nodes: string[] = []
	const local = new Set<string>()
	let current: string | undefined = entry
	let minRank = Number.POSITIVE_INFINITY
	let maxRank = Number.NEGATIVE_INFINITY

	while (current !== undefined && !assigned.has(current) && !local.has(current)) {
		nodes.push(current)
		local.add(current)
		const rank = graph.ranks.get(current) ?? 0
		minRank = Math.min(minRank, rank)
		maxRank = Math.max(maxRank, rank)
		const next: BpmnSequenceFlow | undefined = (graph.outgoing.get(current) ?? []).find(
			(f) => !graph.backEdges.has(f.id) && !assigned.has(f.targetRef) && !local.has(f.targetRef),
		)
		current = next?.targetRef
	}

	if (nodes.length === 0) return null
	return { nodes, side, depth, minRank, maxRank }
}

/**
 * Pack branches into physical bands. A band reservation covers the ranks the
 * branch spans, so two branches that never overlap horizontally can share one
 * band; overlapping narratives cannot.
 */
function compact(branches: Branch[]): Map<string, number> {
	const bands = new Map<string, number>()

	for (const side of [1, -1] as const) {
		const mine = branches
			.filter((b) => b.side === side)
			.sort((a, b) => a.depth - b.depth || a.minRank - b.minRank)
		/** physical level (1-based) → rank intervals already reserved on it. */
		const reserved: Array<Array<[number, number]>> = []

		for (const branch of mine) {
			let level = 0
			while (true) {
				const slots = reserved[level]
				if (!slots) {
					reserved[level] = [[branch.minRank, branch.maxRank]]
					break
				}
				const overlaps = slots.some(([from, to]) => branch.minRank <= to && from <= branch.maxRank)
				if (!overlaps) {
					slots.push([branch.minRank, branch.maxRank])
					break
				}
				level++
			}
			for (const id of branch.nodes) bands.set(id, side * (level + 1))
		}
	}

	return bands
}
