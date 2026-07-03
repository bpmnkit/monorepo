import { describe, expect, it } from "vitest"
import type { BpmnElementType, BpmnFlowElement, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js"
import {
	buildFlowGraph,
	formsLoop,
	hasOtherIncoming,
	isFutureIncoming,
} from "../src/layout/grid/flow-graph.js"
import { createGridLayout } from "../src/layout/grid/walker.js"

// biome-ignore lint/suspicious/noExportsInTest: exported for use by other test files
export function node(
	id: string,
	type: BpmnElementType,
	extra: Record<string, unknown> = {},
): BpmnFlowElement {
	return {
		id,
		type,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: [],
		...extra,
	} as unknown as BpmnFlowElement
}

// biome-ignore lint/suspicious/noExportsInTest: exported for use by other test files
export function flow(id: string, sourceRef: string, targetRef: string): BpmnSequenceFlow {
	return { id, sourceRef, targetRef, extensionElements: [], unknownAttributes: {} }
}

describe("FlowGraph", () => {
	it("excludes boundary events from placeable elements and binds attachers", () => {
		const host = node("host", "userTask")
		const be = node("be", "boundaryEvent", { attachedToRef: "host" })
		const g = buildFlowGraph([host, be], [])
		expect(g.elements.map((e) => e.id)).toEqual(["host"])
		expect(g.attachers.get("host")?.map((e) => e.id)).toEqual(["be"])
	})

	it("hasOtherIncoming: boundary-event feeds count unless the event is attached to the element itself", () => {
		const host = node("host", "userTask")
		const be = node("be", "boundaryEvent", { attachedToRef: "host" })
		const rec = node("rec", "userTask")
		// rec is fed by host's boundary event → real incoming (placed by the
		// attacher step, NOT as a traversal start)
		const g = buildFlowGraph([host, be, rec], [flow("f1", "be", "rec")])
		expect(hasOtherIncoming(rec, g)).toBe(true)
		// host fed only by its OWN boundary event → no real incoming → start
		const g2 = buildFlowGraph([host, be], [flow("f2", "be", "host")])
		expect(hasOtherIncoming(host, g2)).toBe(false)
	})

	it("hasOtherIncoming is true for a normally-fed element and false for self-loops", () => {
		const a = node("a", "userTask")
		const b = node("b", "userTask")
		const g = buildFlowGraph([a, b], [flow("f1", "a", "b"), flow("f2", "b", "b")])
		expect(hasOtherIncoming(a, g)).toBe(false)
		expect(hasOtherIncoming(b, g)).toBe(true)
		const g2 = buildFlowGraph([b], [flow("f2", "b", "b")])
		expect(hasOtherIncoming(b, g2)).toBe(false)
	})

	it("isFutureIncoming: join with an unvisited feeder", () => {
		const a = node("a", "userTask")
		const b = node("b", "userTask")
		const j = node("j", "exclusiveGateway")
		const g = buildFlowGraph([a, b, j], [flow("f1", "a", "j"), flow("f2", "b", "j")])
		expect(isFutureIncoming(j, new Set(["a"]), g)).toBe(true)
		expect(isFutureIncoming(j, new Set(["a", "b"]), g)).toBe(false)
	})

	it("formsLoop: unvisited feeder reachable downstream means a cycle", () => {
		const gw = node("gw", "exclusiveGateway")
		const t = node("t", "userTask")
		// gw → t → gw  (t is gw's unvisited feeder AND downstream of gw)
		const g = buildFlowGraph([gw, t], [flow("f1", "gw", "t"), flow("f2", "t", "gw")])
		expect(formsLoop(gw, new Set(), g)).toBe(true)
	})
})

describe("Grid placement walker", () => {
	function positions(g: ReturnType<typeof createGridLayout>) {
		return Object.fromEntries(g.elementsByPosition().map((e) => [e.element.id, [e.row, e.col]]))
	}

	it("linear flow: one row, consecutive columns", () => {
		const els = [
			node("s", "startEvent"),
			node("a", "userTask"),
			node("b", "serviceTask"),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e")]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p).toEqual({ s: [0, 0], a: [0, 1], b: [0, 2], e: [0, 3] })
	})

	it("split/join: first branch straight, second below, join realigned to top row after furthest feeder", () => {
		const els = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("a", "userTask"),
			node("b", "userTask"),
			node("j", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "a"),
			flow("f3", "gw", "b"),
			flow("f4", "a", "j"),
			flow("f5", "b", "j"),
			flow("f6", "j", "e"),
		]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p.gw).toEqual([0, 1])
		expect(p.a).toEqual([0, 2])
		expect(p.b).toEqual([1, 2])
		expect(p.j).toEqual([0, 3])
		expect(p.e).toEqual([0, 4])
	})

	it("boundary event successor goes down-right of the host", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be", "boundaryEvent", { attachedToRef: "host" }),
			node("rec", "userTask"),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e"), flow("f3", "be", "rec")]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		expect(p.host).toEqual([0, 1])
		expect(p.rec).toEqual([1, 2])
		expect(p.be).toBeUndefined() // boundary events are not grid cells
	})

	it("loop: closing edge target keeps its earlier column, all elements placed", () => {
		const els = [
			node("s", "startEvent"),
			node("t", "userTask"),
			node("gw", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "t"),
			flow("f2", "t", "gw"),
			flow("f3", "gw", "e"),
			flow("f4", "gw", "t"), // back to t
		]
		const g = createGridLayout(buildFlowGraph(els, flows))
		expect(g.getElementsTotal()).toBe(4)
		const p = positions(g)
		expect(p.t?.[1]).toBeLessThan(p.gw?.[1] ?? 0)
	})

	it("disconnected fragments each start a new row; nothing is lost", () => {
		const els = [node("a", "userTask"), node("b", "userTask"), node("c", "userTask")]
		const flows = [flow("f1", "a", "b")]
		const g = createGridLayout(buildFlowGraph(els, flows))
		expect(g.getElementsTotal()).toBe(3)
	})

	it("compact mode packs row-major with max 4 columns", () => {
		const els = Array.from({ length: 6 }, (_, i) => node(`t${i}`, "userTask"))
		const g = createGridLayout(buildFlowGraph(els, []), { compact: true })
		const p = positions(g)
		expect(p.t0).toEqual([0, 0])
		expect(p.t3).toEqual([0, 3])
		expect(p.t4).toEqual([1, 0])
		expect(p.t5).toEqual([1, 1])
	})

	it("join realignment: a longer branch deferred behind a shorter one forces the join off its naive cell", () => {
		// Branch A (a1-a2-a3, 3 hops) is explored depth-first and reaches its
		// furthest column *before* branch B (b1-b2, 2 hops) even starts, so
		// a3's attempt to place j is correctly deferred (b2 is still unvisited).
		// b2 then naively addAfter's j right next to itself — landing it one
		// row below and several columns behind a3, its real furthest feeder.
		// adjustColumnForMultipleIncoming/adjustRowForMultipleIncoming must
		// both fire to pull j up to a3's row and past a3's column.
		const els = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("a1", "userTask"),
			node("a2", "userTask"),
			node("a3", "userTask"),
			node("b1", "userTask"),
			node("b2", "userTask"),
			node("j", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "a1"),
			flow("f3", "gw", "b1"),
			flow("f4", "a1", "a2"),
			flow("f5", "a2", "a3"),
			flow("f6", "a3", "j"),
			flow("f7", "b1", "b2"),
			flow("f8", "b2", "j"),
			flow("f9", "j", "e"),
		]
		const p = positions(createGridLayout(buildFlowGraph(els, flows)))
		// Naive placement (no realignment) would put j at [1, 4] — right after
		// b2. The real furthest feeder is a3 at [0, 4], so the join must be
		// pulled up to row 0 and past column 4.
		expect(p.a3).toEqual([0, 4])
		expect(p.b2).toEqual([1, 3])
		expect(p.j).toEqual([0, 5])
	})

	it("formsLoop lets a join with a still-unvisited feeder proceed when that feeder is downstream of the join itself", () => {
		// j is a join (incoming from p AND from c), but c only becomes
		// reachable *through* j (j -> c -> j). When p tries to place j,
		// isFutureIncoming(j) is true (c isn't visited yet) but deferring
		// would deadlock forever since c can never be visited before j
		// exists. formsLoop must detect the cycle and let placement proceed.
		// The sibling branch q keeps the stack non-empty so the outer guard
		// `(previous !== null || stack.length > 0)` doesn't short-circuit
		// before formsLoop is even evaluated.
		const els = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("p", "userTask"),
			node("q", "userTask"),
			node("j", "exclusiveGateway"),
			node("c", "userTask"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "p"),
			flow("f3", "gw", "q"),
			flow("f4", "p", "j"),
			flow("f5", "c", "j"),
			flow("f6", "j", "c"),
			flow("f7", "j", "e"),
		]
		const g = createGridLayout(buildFlowGraph(els, flows))
		// If formsLoop were ignored, p's attempt to place j would be deferred
		// forever (isFutureIncoming(j) stays true since c can never be
		// visited before j exists). j would then only get placed via the
		// pure-cycle "force-start leftover" fallback, which pushes a brand
		// new (later emptied, but never removed) row before realignment
		// pulls j back near p — leaving a stray extra row behind. With
		// formsLoop correctly short-circuiting the defer, j is placed
		// in-line by p and no extra row is ever created.
		expect(g.getElementsTotal()).toBe(7)
		expect(g.getGridDimensions()[0]).toBe(2)
		const p2 = positions(g)
		expect(p2.p).toEqual([0, 2])
		expect(p2.j).toEqual([0, 3])
	})

	it("exclusive-gateway targets are popped last: a plain-task sibling's own fan-out collides with it mid-walk", () => {
		// x fans out to g (exclusiveGateway) and t (plain task) in that flow
		// order. The gateway-first sort pushes g onto the stack before t, so
		// t (and its child t2) is fully explored *before* g is. That means
		// g's own fan-out (g_a straight across, g_b below it) runs into a
		// cell that t2 already claimed below g_a — forcing Grid.addBelow's
		// row-splice collision path and pushing t/t2 down a row. Without the
		// sort, g would pop first, g_b would claim that cell before t2
		// exists, and t2 would instead splice in *next to* g_b — no extra
		// row, and g_b shifted one column right instead. Neither outcome is
		// "corrected" afterwards (none of these nodes are joins), so this
		// survives join-realignment in a way a shared-join proxy does not.
		const els = [
			node("s", "startEvent"),
			node("x", "userTask"),
			node("g", "exclusiveGateway"),
			node("g_a", "userTask"),
			node("g_b", "userTask"),
			node("t", "userTask"),
			node("t2", "userTask"),
		]
		const flows = [
			flow("f1", "s", "x"),
			flow("f2", "x", "g"),
			flow("f3", "x", "t"),
			flow("f4", "g", "g_a"),
			flow("f5", "g", "g_b"),
			flow("f6", "t", "t2"),
		]
		const g = createGridLayout(buildFlowGraph(els, flows))
		const p = positions(g)
		// Without the gateway-first sort, g would pop before t: g_b would
		// claim [1, 3] first, t2 would splice in next to it, giving g_b
		// = [1, 4], t = [1, 2], t2 = [1, 3], and only 2 rows total.
		expect(g.getGridDimensions()[0]).toBe(3)
		expect(p.g_b).toEqual([1, 3])
		expect(p.t).toEqual([2, 2])
		expect(p.t2).toEqual([2, 3])
	})

	it("pure cycle with no external entry point still places every element via the force-start fallback", () => {
		// a -> b -> c -> a: every element has a real incoming edge, so
		// `starts` is empty on every iteration of the outer while-loop.
		// Without the force-start-leftover fallback, the loop would break
		// immediately and nothing would ever be placed.
		const els = [node("a", "userTask"), node("b", "userTask"), node("c", "userTask")]
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c"), flow("f3", "c", "a")]
		const g = createGridLayout(buildFlowGraph(els, flows))
		expect(g.getElementsTotal()).toBe(3)
		const p = positions(g)
		expect(p.a).toEqual([0, 0])
		expect(p.b).toEqual([0, 1])
		expect(p.c).toEqual([0, 2])
	})
})
