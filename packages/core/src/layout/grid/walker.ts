// packages/core/src/layout/grid/walker.ts
import type { BpmnFlowElement } from "../../bpmn/bpmn-model.js"
import type { FlowGraph } from "./flow-graph.js"
import { formsLoop, hasOtherIncoming, isFutureIncoming, isTaskLike } from "./flow-graph.js"
import { Grid } from "./grid.js"

const COMPACT_MAX_COLS = 4

/**
 * Place every element of the graph into a Grid via the bpmn-io DFS walk.
 * `compact` bypasses the walk and packs row-major (adHoc tool palettes).
 */
export function createGridLayout(
	graph: FlowGraph,
	opts: { compact?: boolean } = {},
): Grid<BpmnFlowElement> {
	const grid = new Grid<BpmnFlowElement>()

	if (opts.compact) {
		for (let i = 0; i < graph.elements.length; i++) {
			const el = graph.elements[i]
			if (el) grid.add(el, [Math.floor(i / COMPACT_MAX_COLS), i % COMPACT_MAX_COLS])
		}
		return grid
	}

	const visited = new Set<string>()

	while (visited.size < graph.elements.length) {
		let starts = graph.elements.filter((el) => !visited.has(el.id) && !hasOtherIncoming(el, graph))
		if (starts.length === 0) {
			// pure cycles or unreachable joins — force-start with the first leftover
			const leftover = graph.elements.find((el) => !visited.has(el.id))
			starts = leftover ? [leftover] : []
		}
		if (starts.length === 0) break
		const stack: BpmnFlowElement[] = []
		for (const s of starts) {
			grid.add(s)
			visited.add(s.id)
			stack.push(s)
		}
		walk(grid, graph, visited, stack)
	}

	return grid
}

function walk(
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
	stack: BpmnFlowElement[],
): void {
	while (stack.length > 0) {
		const current = stack.pop()
		if (!current) break
		incomingStep(current, grid, graph)
		const next = [
			...outgoingStep(current, grid, graph, visited, stack),
			...attacherStep(current, grid, graph, visited),
		]
		for (const el of next) stack.push(el)
	}
}

/** Realign a join with its feeders before its successors are placed. */
function incomingStep(el: BpmnFlowElement, grid: Grid<BpmnFlowElement>, graph: FlowGraph): void {
	const sources = (graph.incoming.get(el.id) ?? [])
		.map((f) => graph.byId.get(f.sourceRef))
		.filter((s): s is BpmnFlowElement => s !== undefined)
	if (sources.length > 1) {
		grid.adjustColumnForMultipleIncoming(sources, el)
		grid.adjustRowForMultipleIncoming(sources, el)
	}
}

/** Place successors: first one to the right (happy path), the rest stacked below. */
function outgoingStep(
	el: BpmnFlowElement,
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
	stack: BpmnFlowElement[],
): BpmnFlowElement[] {
	const targets = (graph.outgoing.get(el.id) ?? [])
		.map((f) => graph.byId.get(f.targetRef))
		.filter((t): t is BpmnFlowElement => t !== undefined)

	if (targets.length > 1 && targets.every((t) => isTaskLike(t.type))) {
		grid.adjustGridPosition(el)
	}

	let previous: BpmnFlowElement | null = null
	const placed: BpmnFlowElement[] = []

	for (let i = 0; i < targets.length; i++) {
		const target = targets[i]
		if (!target || visited.has(target.id)) continue

		if (
			(previous !== null || stack.length > 0) &&
			isFutureIncoming(target, visited, graph) &&
			!formsLoop(target, visited, graph)
		) {
			continue // defer join until its last feeder is processed
		}

		if (previous === null) {
			grid.addAfter(el, target)
		} else if (el.type === "exclusiveGateway" && target.type === "exclusiveGateway") {
			grid.addAfter(previous, target)
		} else {
			const anchor = targets[i - 1]
			grid.addBelow(anchor && grid.find(anchor)[0] >= 0 ? anchor : previous, target)
		}

		if (target.id !== el.id) previous = target
		placed.unshift(target)
		visited.add(target.id)
	}

	// exclusive gateways first → popped from the LIFO stack last
	return [
		...placed.filter((t) => t.type === "exclusiveGateway"),
		...placed.filter((t) => t.type !== "exclusiveGateway"),
	]
}

/** Place the successors of this host's boundary events one row down, one col right. */
function attacherStep(
	host: BpmnFlowElement,
	grid: Grid<BpmnFlowElement>,
	graph: FlowGraph,
	visited: Set<string>,
): BpmnFlowElement[] {
	const out: BpmnFlowElement[] = []
	for (const be of graph.attachers.get(host.id) ?? []) {
		const targets = (graph.outgoing.get(be.id) ?? [])
			.map((f) => graph.byId.get(f.targetRef))
			.filter((t): t is BpmnFlowElement => t !== undefined)
			.reverse()
		for (const target of targets) {
			if (visited.has(target.id)) continue
			const [r, c] = grid.find(host)
			if (r < 0) continue
			if (grid.get(r + 1, c) !== undefined || grid.get(r + 1, c + 1) !== undefined) {
				grid.createRow(r)
			}
			grid.add(target, [r + 1, c + 1])
			visited.add(target.id)
			out.push(target)
		}
	}
	return out
}
