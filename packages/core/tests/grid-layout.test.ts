import { beforeEach, describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type {
	BpmnAssociation,
	BpmnCollaboration,
	BpmnDefinitions,
	BpmnElementType,
	BpmnFlowElement,
	BpmnMessageFlow,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "../src/bpmn/bpmn-model.js"
import { checkDiCompleteness } from "../src/bpmn/di-check.js"
import { Bpmn, resetIdCounter } from "../src/index.js"
import { associationWaypoints, packAnnotations } from "../src/layout/annotations.js"
import {
	buildFlowGraph,
	formsLoop,
	hasOtherIncoming,
	isFutureIncoming,
} from "../src/layout/grid/flow-graph.js"
import { gridLayoutFlowNodes } from "../src/layout/grid/grid-engine.js"
import {
	collapseCollinear,
	connectElements,
	ensureExitBottom,
} from "../src/layout/grid/grid-router.js"
import type { RoutableNode } from "../src/layout/grid/grid-router.js"
import { Grid } from "../src/layout/grid/grid.js"
import { createGridLayout } from "../src/layout/grid/walker.js"
import { assertNoOverlap } from "../src/layout/overlap.js"
import type { Bounds, LayoutNode } from "../src/layout/types.js"

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

const SHIFT = { x: 0, y: 0 }
const NO_EXPANDED = new Map<number, number>()

function routable(id: string, row: number, col: number, w = 100, h = 80): RoutableNode {
	return {
		id,
		row,
		col,
		bounds: { x: col * 150 + (150 - w) / 2, y: row * 140 + (140 - h) / 2, width: w, height: h },
	}
}

function assertOrthogonal(wps: Array<{ x: number; y: number }>) {
	for (let i = 1; i < wps.length; i++) {
		const a = wps[i - 1]
		const b = wps[i]
		if (!a || !b) continue
		expect(a.x === b.x || a.y === b.y).toBe(true)
	}
}

describe("Grid Manhattan router", () => {
	it("same-row forward: straight 2-point line at centre height", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0)
		const b = routable("b", 0, 1)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toEqual([
			{ x: a.bounds.x + a.bounds.width, y: 70 },
			{ x: b.bounds.x, y: 70 },
		])
	})

	it("diagonal down-right with a free corridor: 3 points, out the bottom, into the left", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0, 50, 50) // gateway
		const b = routable("b", 1, 1)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(3)
		expect(wps[0]).toEqual({ x: 75, y: a.bounds.y + a.bounds.height }) // bottom of gateway
		expect(wps[2]).toEqual({ x: b.bounds.x, y: 210 }) // left of task, centre of row 1
		assertOrthogonal(wps)
	})

	it("back-edge (target left of source) routes below both with 4 points", () => {
		const g = new Grid<{ id: string }>()
		const src = routable("gw", 0, 2, 50, 50)
		const tgt = routable("t", 0, 1)
		const wps = connectElements(src, tgt, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(4)
		expect(wps[0]?.y).toBe(src.bounds.y + src.bounds.height) // exits bottom
		expect(wps[1]?.y).toBe(140) // one cell height below row-0 top
		expect(wps[3]?.y).toBe(tgt.bounds.y + tgt.bounds.height) // enters bottom
		assertOrthogonal(wps)
	})

	it("self-loop routes out right and back in the top with 5 points", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0)
		const wps = connectElements(a, a, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(5)
		assertOrthogonal(wps)
	})

	it("blocked same-row corridor routes underneath", () => {
		const g = new Grid<{ id: string }>()
		g.add({ id: "a" }, [0, 0])
		g.add({ id: "x" }, [0, 1]) // blocker
		g.add({ id: "b" }, [0, 2])
		const wps = connectElements(routable("a", 0, 0), routable("b", 0, 2), g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(4)
		expect(wps[1]?.y).toBe(140)
		assertOrthogonal(wps)
	})

	it("same column, unblocked, target below: straight 2-point vertical line", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 0, 0)
		const b = routable("b", 1, 0)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toEqual([
			{ x: a.bounds.x + a.bounds.width / 2, y: a.bounds.y + a.bounds.height },
			{ x: b.bounds.x + b.bounds.width / 2, y: b.bounds.y },
		])
	})

	it("same column, unblocked, target above: straight 2-point vertical line, docks swapped", () => {
		const g = new Grid<{ id: string }>()
		const a = routable("a", 1, 0)
		const b = routable("b", 0, 0)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toEqual([
			{ x: a.bounds.x + a.bounds.width / 2, y: a.bounds.y },
			{ x: b.bounds.x + b.bounds.width / 2, y: b.bounds.y + b.bounds.height },
		])
	})

	it("same column, blocked corridor, target below: 5-point right-hand detour", () => {
		const g = new Grid<{ id: string }>()
		g.add({ id: "a" }, [0, 0])
		g.add({ id: "x" }, [1, 0]) // blocker directly in the vertical corridor
		g.add({ id: "b" }, [2, 0])
		const a = routable("a", 0, 0)
		const b = routable("b", 2, 0)
		const wps = connectElements(a, b, g, SHIFT, NO_EXPANDED)
		expect(wps).toHaveLength(5)
		expect(wps).toEqual([
			{ x: a.bounds.x + a.bounds.width, y: 70 }, // out the right of a, centre height
			{ x: 150, y: 70 }, // one half-cell-width right of the column
			{ x: 150, y: 280 }, // down to target centre minus half a cell height
			{ x: b.bounds.x + b.bounds.width / 2, y: 280 }, // back over target's column
			{ x: b.bounds.x + b.bounds.width / 2, y: b.bounds.y }, // in the top of b
		])
		assertOrthogonal(wps)
	})

	it("ensureExitBottom rewrites an edge to leave through the boundary event's bottom", () => {
		const be = { x: 132, y: 122, width: 36, height: 36 }
		const wps = ensureExitBottom(be, [
			{ x: 168, y: 140 },
			{ x: 300, y: 140 },
		])
		expect(wps[0]).toEqual({ x: 150, y: 158 })
		assertOrthogonal(wps)
	})

	it("collapseCollinear removes redundant midpoints", () => {
		expect(
			collapseCollinear([
				{ x: 0, y: 0 },
				{ x: 50, y: 0 },
				{ x: 100, y: 0 },
				{ x: 100, y: 80 },
			]),
		).toEqual([
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 80 },
		])
	})
})

describe("Grid engine (integration)", () => {
	it("linear flow: centred in consecutive cells on one centreline", () => {
		const els = [node("s", "startEvent"), node("a", "userTask"), node("e", "endEvent")]
		const flows = [flow("f1", "s", "a"), flow("f2", "a", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		expect(byId.get("s")?.bounds).toEqual({ x: 57, y: 52, width: 36, height: 36 })
		expect(byId.get("a")?.bounds).toEqual({ x: 175, y: 30, width: 100, height: 80 })
		expect(byId.get("e")?.bounds).toEqual({ x: 357, y: 52, width: 36, height: 36 })
		// shared centreline
		expect(new Set(r.nodes.map((n) => n.bounds.y + n.bounds.height / 2))).toEqual(new Set([70]))
		expect(r.edges).toHaveLength(2)
	})

	it("boundary event sits on the host's bottom edge and its chain routes from it", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be", "boundaryEvent", { attachedToRef: "host" }),
			node("rec", "userTask"),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e"), flow("f3", "be", "rec")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const host = byId.get("host")
		const be = byId.get("be")
		if (!host || !be) throw new Error("missing nodes")
		expect(be.bounds.y + be.bounds.height / 2).toBe(host.bounds.y + host.bounds.height)
		expect(be.bounds.x + 18).toBe(host.bounds.x + host.bounds.width / 2)
		const chain = r.edges.find((edge) => edge.id === "f3")
		expect(chain?.waypoints[0]).toEqual({
			x: Math.round(be.bounds.x + 18),
			y: Math.round(be.bounds.y + 36),
		})
	})

	it("expanded subprocess encloses its children; children are absolute", () => {
		const child1 = node("c1", "userTask")
		const child2 = node("c2", "userTask")
		const sub = node("sub", "subProcess", {
			flowElements: [child1, child2],
			sequenceFlows: [flow("cf", "c1", "c2")],
		})
		const els = [node("s", "startEvent"), sub, node("e", "endEvent")]
		const flows = [flow("f1", "s", "sub"), flow("f2", "sub", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const subNode = byId.get("sub")
		if (!subNode) throw new Error("missing sub")
		expect(subNode.isExpanded).toBe(true)
		expect(subNode.bounds.width).toBe(2 * 150 + 100)
		expect(subNode.bounds.height).toBe(1 * 140 + 80)
		for (const id of ["c1", "c2"]) {
			const c = byId.get(id)
			if (!c) throw new Error(`missing ${id}`)
			expect(c.bounds.x).toBeGreaterThanOrEqual(subNode.bounds.x)
			expect(c.bounds.x + c.bounds.width).toBeLessThanOrEqual(
				subNode.bounds.x + subNode.bounds.width,
			)
			expect(c.bounds.y).toBeGreaterThanOrEqual(subNode.bounds.y)
			expect(c.bounds.y + c.bounds.height).toBeLessThanOrEqual(
				subNode.bounds.y + subNode.bounds.height,
			)
		}
		expect(r.edges.map((edge) => edge.id).sort()).toEqual(["cf", "f1", "f2"])
	})

	it("every edge is orthogonal and no shapes overlap (fan of 3 branches + join + loop)", () => {
		const els = [
			node("s", "startEvent"),
			node("gw", "inclusiveGateway"),
			node("a", "userTask"),
			node("b", "userTask"),
			node("c", "userTask"),
			node("j", "inclusiveGateway"),
			node("chk", "exclusiveGateway"),
			node("e", "endEvent"),
		]
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "a"),
			flow("f3", "gw", "b"),
			flow("f4", "gw", "c"),
			flow("f5", "a", "j"),
			flow("f6", "b", "j"),
			flow("f7", "c", "j"),
			flow("f8", "j", "chk"),
			flow("f9", "chk", "e"),
			flow("f10", "chk", "gw"), // loop back
		]
		const r = gridLayoutFlowNodes(els, flows)
		expect(r.nodes).toHaveLength(8)
		expect(r.edges).toHaveLength(10)
		for (const edge of r.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const p = edge.waypoints[i - 1]
				const q = edge.waypoints[i]
				if (!p || !q) continue
				expect(p.x === q.x || p.y === q.y).toBe(true)
			}
		}
		assertNoOverlap({ nodes: r.nodes, edges: [] })
	})

	it("multi-attacher spacing: n boundary events divide the host's width into n+1 gaps", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be1", "boundaryEvent", { attachedToRef: "host" }),
			node("be2", "boundaryEvent", { attachedToRef: "host" }),
			node("be3", "boundaryEvent", { attachedToRef: "host" }),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const host = byId.get("host")
		if (!host) throw new Error("missing host")
		const n = 3
		for (let i = 0; i < n; i++) {
			const be = byId.get(`be${i + 1}`)
			if (!be) throw new Error(`missing be${i + 1}`)
			const expectedX = host.bounds.x + ((i + 1) * host.bounds.width) / (n + 1) - 18
			expect(be.bounds.x).toBeCloseTo(expectedX, 5)
		}
		// sanity: the three x-positions are distinct and increasing
		const xs = [1, 2, 3].map((i) => byId.get(`be${i}`)?.bounds.x ?? 0)
		expect(xs[0]).toBeLessThan(xs[1] ?? 0)
		expect(xs[1]).toBeLessThan(xs[2] ?? 0)
	})

	it("named boundary event gets a labelBounds centred below its own shape", () => {
		const els = [
			node("s", "startEvent"),
			node("host", "userTask"),
			node("be", "boundaryEvent", { attachedToRef: "host", name: "Timeout" }),
			node("e", "endEvent"),
		]
		const flows = [flow("f1", "s", "host"), flow("f2", "host", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const be = byId.get("be")
		if (!be) throw new Error("missing be")
		expect(be.label).toBe("Timeout")
		const lb = be.labelBounds
		if (!lb) throw new Error("missing labelBounds")
		// label below the shape (shape_bottom + 4), centred horizontally under it —
		// same convention as computeLabelBounds in coordinates.ts:141-178
		expect(lb.y).toBe(be.bounds.y + be.bounds.height + 4)
		expect(lb.x + lb.width / 2).toBeCloseTo(be.bounds.x + be.bounds.width / 2, 5)
	})

	it("a named flow node's labelBounds is positioned relative to its final (post-shift) bounds", () => {
		// c1 lives inside an expanded subprocess, so its bounds include the
		// CHILD_SHIFT_X/Y offset applied in emitLevel before computeLabelBounds runs.
		const child1 = node("c1", "startEvent", { name: "Child Start" })
		const child2 = node("c2", "endEvent")
		const sub = node("sub", "subProcess", {
			flowElements: [child1, child2],
			sequenceFlows: [flow("cf", "c1", "c2")],
		})
		const els = [node("s", "startEvent"), sub, node("e", "endEvent")]
		const flows = [flow("f1", "s", "sub"), flow("f2", "sub", "e")]
		const r = gridLayoutFlowNodes(els, flows)
		const byId = new Map(r.nodes.map((n) => [n.id, n]))
		const c1 = byId.get("c1")
		if (!c1) throw new Error("missing c1")
		expect(c1.label).toBe("Child Start")
		const lb = c1.labelBounds
		if (!lb) throw new Error("missing labelBounds")
		expect(lb.y).toBe(c1.bounds.y + c1.bounds.height + 4)
		expect(lb.x + lb.width / 2).toBeCloseTo(c1.bounds.x + c1.bounds.width / 2, 5)
		// c1's bounds are absolute (shifted into the subprocess), not (0,0)-relative
		expect(c1.bounds.x).toBeGreaterThan(0)
		expect(c1.bounds.y).toBeGreaterThan(0)
	})

	it("a named sequence flow is wired through to edge.label and placeEdgeLabels populates labelBounds", () => {
		const els = [node("s", "startEvent"), node("a", "userTask"), node("e", "endEvent")]
		const namedFlow = { ...flow("f2", "a", "e"), name: "Approved" }
		const r = gridLayoutFlowNodes(els, [flow("f1", "s", "a"), namedFlow])
		const edge = r.edges.find((e) => e.id === "f2")
		if (!edge) throw new Error("missing edge f2")
		expect(edge.label).toBe("Approved")
		expect(edge.labelBounds).toBeDefined()
	})
})

describe("Annotation packing", () => {
	function layoutNode(id: string, bounds: Bounds, extra: Partial<LayoutNode> = {}): LayoutNode {
		return { id, type: "userTask", bounds, layer: 0, position: 0, ...extra }
	}

	function textAnnotation(id: string, text: string): BpmnTextAnnotation {
		return { id, text, unknownAttributes: {} }
	}

	function association(id: string, sourceRef: string, targetRef: string): BpmnAssociation {
		return { id, sourceRef, targetRef, unknownAttributes: {} }
	}

	function makeProcess(
		textAnnotations: BpmnTextAnnotation[],
		associations: BpmnAssociation[],
	): BpmnProcess {
		return {
			id: "p1",
			extensionElements: [],
			flowElements: [],
			sequenceFlows: [],
			textAnnotations,
			associations,
			unknownAttributes: {},
		}
	}

	/** Two rects are safely separated if they're apart by `gap` on the x or y axis. */
	function separatedBy(a: Bounds, b: Bounds, gap: number): boolean {
		const ax2 = a.x + a.width
		const bx2 = b.x + b.width
		const ay2 = a.y + a.height
		const by2 = b.y + b.height
		return ax2 + gap <= b.x || bx2 + gap <= a.x || ay2 + gap <= b.y || by2 + gap <= a.y
	}

	it("height grows with annotation text length", () => {
		const task = layoutNode("t1", { x: 100, y: 100, width: 100, height: 80 })
		const longText = "word ".repeat(60).trim() // 300 chars, wraps to many lines
		const process = makeProcess(
			[textAnnotation("ann1", longText)],
			[association("a1", "t1", "ann1")],
		)
		const bounds = packAnnotations(process, [task]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		expect(bounds.width).toBe(200)
		expect(bounds.height).toBeGreaterThan(30)
	})

	it("two annotations linked to the same task don't overlap each other or the task", () => {
		const task = layoutNode("t1", { x: 200, y: 200, width: 100, height: 80 })
		const process = makeProcess(
			[textAnnotation("ann1", "first note"), textAnnotation("ann2", "second note")],
			[association("a1", "t1", "ann1"), association("a2", "t1", "ann2")],
		)
		const map = packAnnotations(process, [task])
		const b1 = map.get("ann1")
		const b2 = map.get("ann2")
		if (!b1 || !b2) throw new Error("missing annotation bounds")
		expect(separatedBy(b1, b2, 20)).toBe(true)
		expect(separatedBy(b1, task.bounds, 30)).toBe(true)
		expect(separatedBy(b2, task.bounds, 30)).toBe(true)
	})

	it("an annotation linked to an element clearly below the main flow is placed below it", () => {
		// "main" establishes mainFlowY (center-Y 140); "below" sits far south of it.
		const main = layoutNode("main", { x: 100, y: 100, width: 100, height: 80 })
		const below = layoutNode("below", { x: 100, y: 400, width: 100, height: 80 })
		const process = makeProcess(
			[textAnnotation("ann1", "note")],
			[association("a1", "below", "ann1")],
		)
		const bounds = packAnnotations(process, [main, below]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		expect(bounds.y).toBeGreaterThanOrEqual(below.bounds.y + below.bounds.height)
	})

	it("skyline packing shifts an annotation horizontally rather than pay a large vertical cost", () => {
		const task = layoutNode("task", { x: 300, y: 300, width: 100, height: 80 })
		// Blocks the natural (dx=0) slot directly above the task with a narrow
		// obstacle (kept under 60px tall so it doesn't skew mainFlowY); a +120
		// horizontal shift clears it entirely in x, which is far cheaper than
		// pushing the annotation all the way above the obstacle's top.
		const obstacle = layoutNode("obs", { x: 260, y: 135, width: 40, height: 59 })
		const process = makeProcess([textAnnotation("ann1", "hi")], [association("a1", "task", "ann1")])
		const bounds = packAnnotations(process, [task, obstacle]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		const naturalX = Math.round(350 - bounds.width / 2)
		expect(bounds.x).not.toBe(naturalX)
		expect(separatedBy(bounds, obstacle.bounds, 30)).toBe(true)
		expect(separatedBy(bounds, task.bounds, 30)).toBe(true)
	})

	it("a text annotation with no association still gets a fallback bounds entry", () => {
		const task = layoutNode("t1", { x: 100, y: 100, width: 100, height: 80 })
		const process = makeProcess([textAnnotation("ann1", "floating note")], [])
		const bounds = packAnnotations(process, [task]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		expect(bounds.width).toBeGreaterThan(0)
		expect(bounds.height).toBeGreaterThan(0)
	})

	it("a text annotation whose association target is missing from layoutNodes still gets a fallback bounds entry", () => {
		const task = layoutNode("t1", { x: 100, y: 100, width: 100, height: 80 })
		const process = makeProcess(
			[textAnnotation("ann1", "note")],
			[association("a1", "missing-element", "ann1")],
		)
		const bounds = packAnnotations(process, [task]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		expect(bounds.width).toBeGreaterThan(0)
		expect(bounds.height).toBeGreaterThan(0)
	})

	it("two unlinked annotations don't overlap each other or an already-placed linked annotation", () => {
		const task = layoutNode("t1", { x: 200, y: 200, width: 100, height: 80 })
		const process = makeProcess(
			[
				textAnnotation("linked", "linked note"),
				textAnnotation("free1", "floating 1"),
				textAnnotation("free2", "floating 2"),
			],
			[association("a1", "t1", "linked")],
		)
		const map = packAnnotations(process, [task])
		const linkedB = map.get("linked")
		const free1B = map.get("free1")
		const free2B = map.get("free2")
		if (!linkedB || !free1B || !free2B) throw new Error("missing annotation bounds")
		expect(separatedBy(free1B, free2B, 20)).toBe(true)
		expect(separatedBy(free1B, linkedB, 20)).toBe(true)
		expect(separatedBy(free2B, linkedB, 20)).toBe(true)
	})

	it("associationWaypoints for an annotation strictly above returns clamped edge-to-edge points", () => {
		const elem: Bounds = { x: 100, y: 200, width: 100, height: 80 }
		const ann: Bounds = { x: 50, y: 50, width: 200, height: 40 } // ann bottom (90) <= elem top (200)
		const { pElem, pAnn } = associationWaypoints(elem, ann)
		expect(pElem.y).toBe(elem.y)
		expect(pAnn.y).toBe(ann.y + ann.height)
		expect(pElem.x).toBeGreaterThanOrEqual(elem.x)
		expect(pElem.x).toBeLessThanOrEqual(elem.x + elem.width)
		expect(pAnn.x).toBeGreaterThanOrEqual(ann.x)
		expect(pAnn.x).toBeLessThanOrEqual(ann.x + ann.width)
	})

	it("associationWaypoints for an annotation to the right returns clamped edge-to-edge points on the right side", () => {
		const elem: Bounds = { x: 100, y: 200, width: 100, height: 80 } // x: 100-200, y: 200-280
		const ann: Bounds = { x: 250, y: 190, width: 100, height: 150 } // x >= elem right edge (200); y-ranges overlap
		const { pElem, pAnn } = associationWaypoints(elem, ann)
		expect(pElem.x).toBe(elem.x + elem.width)
		expect(pAnn.x).toBe(ann.x)
		expect(pElem.y).toBe(265) // clampY(ann center-y 265, elem) -> within [200, 280]
		expect(pAnn.y).toBe(240) // clampY(elem center-y 240, ann) -> within [190, 340]
	})

	it("associationWaypoints for an annotation to the left returns clamped edge-to-edge points on the left side", () => {
		const elem: Bounds = { x: 300, y: 200, width: 100, height: 80 } // x: 300-400, y: 200-280
		const ann: Bounds = { x: 50, y: 190, width: 100, height: 150 } // ann right edge (150) < elem.x; y-ranges overlap
		const { pElem, pAnn } = associationWaypoints(elem, ann)
		expect(pElem.x).toBe(elem.x)
		expect(pAnn.x).toBe(ann.x + ann.width)
		expect(pElem.y).toBe(265) // clampY(ann center-y 265, elem) -> within [200, 280]
		expect(pAnn.y).toBe(240) // clampY(elem center-y 240, ann) -> within [190, 340]
	})

	it("skyline packing pushes a below annotation downward to clear an obstacle", () => {
		// "main" establishes mainFlowY (center-Y 140); "task" sits far south of it so its
		// annotation's natural side is "below". An obstacle sits right at the natural
		// below-slot (task bottom + PREFERRED_OFFSET), forcing the push-loop to move the
		// annotation down; the push distance (40px) stays cheaper than any horizontal
		// shift (min 60px), so dx=0 remains the winning candidate and only y moves.
		const main = layoutNode("main", { x: 100, y: 100, width: 100, height: 80 })
		const task = layoutNode("task", { x: 300, y: 400, width: 100, height: 80 })
		const obstacle = layoutNode("obs", { x: 300, y: 530, width: 60, height: 10 })
		const process = makeProcess([textAnnotation("ann1", "hi")], [association("a1", "task", "ann1")])
		const bounds = packAnnotations(process, [task, main, obstacle]).get("ann1")
		if (!bounds) throw new Error("missing ann1 bounds")
		const naturalX = Math.round(350 - bounds.width / 2)
		expect(bounds.x).toBe(naturalX)
		expect(bounds.y).toBe(570)
		expect(separatedBy(bounds, obstacle.bounds, 30)).toBe(true)
	})
})

describe("Message flow DI", () => {
	function participantProcess(
		id: string,
		elements: BpmnFlowElement[],
		flows: BpmnSequenceFlow[],
	): BpmnProcess {
		return {
			id,
			extensionElements: [],
			flowElements: elements,
			sequenceFlows: flows,
			textAnnotations: [],
			associations: [],
			unknownAttributes: {},
		}
	}

	function messageFlow(id: string, sourceRef: string, targetRef: string): BpmnMessageFlow {
		return { id, sourceRef, targetRef, unknownAttributes: {} }
	}

	function collabDefs(
		proc1: BpmnProcess,
		proc2: BpmnProcess,
		messageFlows: BpmnMessageFlow[],
	): BpmnDefinitions {
		const collab: BpmnCollaboration = {
			id: "collab",
			participants: [
				{ id: "part1", processRef: proc1.id, unknownAttributes: {} },
				{ id: "part2", processRef: proc2.id, unknownAttributes: {} },
			],
			messageFlows,
			textAnnotations: [],
			associations: [],
			extensionElements: [],
			unknownAttributes: {},
		}
		return {
			id: "defs",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			namespaces: {},
			unknownAttributes: {},
			processes: [proc1, proc2],
			collaborations: [collab],
			messages: [],
			errors: [],
			signals: [],
			escalations: [],
			diagrams: [],
		}
	}

	it("aligned source/target x renders a straight 2-point edge, source-bottom to target-top", () => {
		const proc1 = participantProcess("proc1", [node("t1", "serviceTask")], [])
		const proc2 = participantProcess("proc2", [node("t2", "serviceTask")], [])
		const defs = collabDefs(proc1, proc2, [messageFlow("mf1", "t1", "t2")])
		const result = applyAutoLayout(defs)
		const diagram = result.diagrams[0]
		if (!diagram) throw new Error("missing diagram")
		const edge = diagram.plane.edges.find((e) => e.bpmnElement === "mf1")
		if (!edge) throw new Error("missing message flow edge")
		const t1Shape = diagram.plane.shapes.find((s) => s.bpmnElement === "t1")
		const t2Shape = diagram.plane.shapes.find((s) => s.bpmnElement === "t2")
		if (!t1Shape || !t2Shape) throw new Error("missing shapes")
		const sx = t1Shape.bounds.x + t1Shape.bounds.width / 2
		const tx = t2Shape.bounds.x + t2Shape.bounds.width / 2
		// precondition: this fixture must actually land on the aligned-x branch
		expect(sx).toBe(tx)
		expect(edge.waypoints).toEqual([
			{ x: sx, y: t1Shape.bounds.y + t1Shape.bounds.height },
			{ x: tx, y: t2Shape.bounds.y },
		])
		assertOrthogonal(edge.waypoints)
	})

	it("misaligned source/target x renders a 4-point orthogonal edge through a shared mid-y corridor", () => {
		const proc1 = participantProcess("proc1", [node("t1", "serviceTask")], [])
		const proc2 = participantProcess(
			"proc2",
			[node("s2", "startEvent"), node("t2", "serviceTask"), node("e2", "endEvent")],
			[flow("f1", "s2", "t2"), flow("f2", "t2", "e2")],
		)
		const defs = collabDefs(proc1, proc2, [messageFlow("mf2", "t1", "e2")])
		const result = applyAutoLayout(defs)
		const diagram = result.diagrams[0]
		if (!diagram) throw new Error("missing diagram")
		const edge = diagram.plane.edges.find((e) => e.bpmnElement === "mf2")
		if (!edge) throw new Error("missing message flow edge")
		const srcShape = diagram.plane.shapes.find((s) => s.bpmnElement === "t1")
		const tgtShape = diagram.plane.shapes.find((s) => s.bpmnElement === "e2")
		if (!srcShape || !tgtShape) throw new Error("missing shapes")
		const sx = srcShape.bounds.x + srcShape.bounds.width / 2
		const tx = tgtShape.bounds.x + tgtShape.bounds.width / 2
		// precondition: this fixture must actually land on the misaligned-x branch
		expect(sx).not.toBe(tx)
		expect(edge.waypoints).toHaveLength(4)
		expect(edge.waypoints[0]).toEqual({ x: sx, y: srcShape.bounds.y + srcShape.bounds.height })
		expect(edge.waypoints[3]).toEqual({ x: tx, y: tgtShape.bounds.y })
		expect(edge.waypoints[1]?.y).toBe(edge.waypoints[2]?.y)
		assertOrthogonal(edge.waypoints)
	})

	it("a message flow from the lower pool to the upper pool exits the source's top and enters the target's bottom", () => {
		const proc1 = participantProcess("proc1", [node("t1", "serviceTask")], [])
		const proc2 = participantProcess("proc2", [node("t2", "serviceTask")], [])
		const defs = collabDefs(proc1, proc2, [messageFlow("mf5", "t2", "t1")])
		const result = applyAutoLayout(defs)
		const diagram = result.diagrams[0]
		if (!diagram) throw new Error("missing diagram")
		const edge = diagram.plane.edges.find((e) => e.bpmnElement === "mf5")
		if (!edge) throw new Error("missing message flow edge")
		const t1Shape = diagram.plane.shapes.find((s) => s.bpmnElement === "t1")
		const t2Shape = diagram.plane.shapes.find((s) => s.bpmnElement === "t2")
		if (!t1Shape || !t2Shape) throw new Error("missing shapes")
		expect(edge.waypoints[0]).toEqual({
			x: t2Shape.bounds.x + t2Shape.bounds.width / 2,
			y: t2Shape.bounds.y,
		})
		expect(edge.waypoints[edge.waypoints.length - 1]).toEqual({
			x: t1Shape.bounds.x + t1Shape.bounds.width / 2,
			y: t1Shape.bounds.y + t1Shape.bounds.height,
		})
		assertOrthogonal(edge.waypoints)
	})

	it("a message flow between participant ids docks on the pool shapes themselves", () => {
		const proc1 = participantProcess("proc1", [node("t1", "serviceTask")], [])
		const proc2 = participantProcess("proc2", [node("t2", "serviceTask")], [])
		const defs = collabDefs(proc1, proc2, [messageFlow("mf3", "part1", "part2")])
		const result = applyAutoLayout(defs)
		const diagram = result.diagrams[0]
		if (!diagram) throw new Error("missing diagram")
		const edge = diagram.plane.edges.find((e) => e.bpmnElement === "mf3")
		if (!edge) throw new Error("missing message flow edge")
		const pool1 = diagram.plane.shapes.find((s) => s.bpmnElement === "part1")
		const pool2 = diagram.plane.shapes.find((s) => s.bpmnElement === "part2")
		if (!pool1 || !pool2) throw new Error("missing pool shapes")
		expect(edge.waypoints[0]).toEqual({
			x: pool1.bounds.x + pool1.bounds.width / 2,
			y: pool1.bounds.y + pool1.bounds.height,
		})
		expect(edge.waypoints[edge.waypoints.length - 1]).toEqual({
			x: pool2.bounds.x + pool2.bounds.width / 2,
			y: pool2.bounds.y,
		})
		assertOrthogonal(edge.waypoints)
	})

	it("a message flow referencing an unknown element is skipped without throwing", () => {
		const proc1 = participantProcess("proc1", [node("t1", "serviceTask")], [])
		const proc2 = participantProcess("proc2", [node("t2", "serviceTask")], [])
		const defs = collabDefs(proc1, proc2, [messageFlow("mf4", "t1", "does-not-exist")])
		const result = applyAutoLayout(defs)
		const diagram = result.diagrams[0]
		if (!diagram) throw new Error("missing diagram")
		expect(diagram.plane.edges.find((e) => e.bpmnElement === "mf4")).toBeUndefined()
	})
})

describe("DI completeness", () => {
	function emptyDefs(
		processes: BpmnProcess[],
		collaborations: BpmnCollaboration[] = [],
	): BpmnDefinitions {
		return {
			id: "defs",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			namespaces: {},
			unknownAttributes: {},
			processes,
			collaborations,
			messages: [],
			errors: [],
			signals: [],
			escalations: [],
			diagrams: [],
		}
	}

	function baseProcess(
		id: string,
		flowElements: BpmnFlowElement[],
		sequenceFlows: BpmnSequenceFlow[],
		extra: Partial<BpmnProcess> = {},
	): BpmnProcess {
		return {
			id,
			extensionElements: [],
			flowElements,
			sequenceFlows,
			textAnnotations: [],
			associations: [],
			unknownAttributes: {},
			...extra,
		}
	}

	it("(a) reports nothing missing for a linear process", () => {
		const proc = baseProcess(
			"proc",
			[node("s", "startEvent"), node("t", "serviceTask"), node("e", "endEvent")],
			[flow("f1", "s", "t"), flow("f2", "t", "e")],
		)
		const result = applyAutoLayout(emptyDefs([proc]))
		expect(checkDiCompleteness(result)).toEqual({ missingShapes: [], missingEdges: [] })
	})

	it("(b) reports nothing missing for a boundary event + subprocess + annotation", () => {
		const sub = node("sub", "subProcess", {
			flowElements: [
				node("i-s", "startEvent"),
				node("i-t", "serviceTask"),
				node("i-e", "endEvent"),
			],
			sequenceFlows: [flow("if1", "i-s", "i-t"), flow("if2", "i-t", "i-e")],
			textAnnotations: [],
			associations: [],
		})
		const be = node("be", "boundaryEvent", { attachedToRef: "sub" })
		const ann: BpmnTextAnnotation = { id: "ann1", text: "Watch this", unknownAttributes: {} }
		const assoc: BpmnAssociation = {
			id: "assoc1",
			sourceRef: "sub",
			targetRef: "ann1",
			unknownAttributes: {},
		}
		const proc = baseProcess(
			"proc",
			[node("s", "startEvent"), sub, be, node("recover", "serviceTask"), node("e", "endEvent")],
			[
				flow("f1", "s", "sub"),
				flow("f2", "sub", "e"),
				flow("f3", "be", "recover"),
				flow("f4", "recover", "e"),
			],
			{ textAnnotations: [ann], associations: [assoc] },
		)
		const result = applyAutoLayout(emptyDefs([proc]))
		expect(checkDiCompleteness(result)).toEqual({ missingShapes: [], missingEdges: [] })
	})

	it("(c) reports nothing missing for a two-pool collaboration with a message flow", () => {
		const proc1 = baseProcess(
			"proc1",
			[node("s1", "startEvent"), node("t1", "serviceTask"), node("e1", "endEvent")],
			[flow("f1", "s1", "t1"), flow("f2", "t1", "e1")],
		)
		const proc2 = baseProcess(
			"proc2",
			[node("s2", "startEvent"), node("t2", "serviceTask"), node("e2", "endEvent")],
			[flow("f3", "s2", "t2"), flow("f4", "t2", "e2")],
		)
		const collab: BpmnCollaboration = {
			id: "collab",
			participants: [
				{ id: "part1", processRef: "proc1", unknownAttributes: {} },
				{ id: "part2", processRef: "proc2", unknownAttributes: {} },
			],
			messageFlows: [{ id: "mf1", sourceRef: "t1", targetRef: "t2", unknownAttributes: {} }],
			textAnnotations: [],
			associations: [],
			extensionElements: [],
			unknownAttributes: {},
		}
		const result = applyAutoLayout(emptyDefs([proc1, proc2], [collab]))
		expect(checkDiCompleteness(result)).toEqual({ missingShapes: [], missingEdges: [] })
	})

	it("negative: a hand-built defs missing one shape is caught in missingShapes", () => {
		const proc = baseProcess(
			"proc",
			[node("s", "startEvent"), node("t", "serviceTask"), node("e", "endEvent")],
			[flow("f1", "s", "t"), flow("f2", "t", "e")],
		)
		const defs: BpmnDefinitions = emptyDefs([proc])
		defs.diagrams = [
			{
				id: "d1",
				plane: {
					id: "p1",
					bpmnElement: "proc",
					shapes: [
						{
							id: "s_di",
							bpmnElement: "s",
							bounds: { x: 0, y: 0, width: 36, height: 36 },
							unknownAttributes: {},
						},
						// "t" shape intentionally omitted
						{
							id: "e_di",
							bpmnElement: "e",
							bounds: { x: 200, y: 0, width: 36, height: 36 },
							unknownAttributes: {},
						},
					],
					edges: [
						{ id: "f1_di", bpmnElement: "f1", waypoints: [], unknownAttributes: {} },
						{ id: "f2_di", bpmnElement: "f2", waypoints: [], unknownAttributes: {} },
					],
				},
			},
		]
		const result = checkDiCompleteness(defs)
		expect(result.missingShapes).toEqual(["t"])
		expect(result.missingEdges).toEqual([])
	})

	// -------------------------------------------------------------------
	// (d) Sample of real fixtures already exercised elsewhere in the suite
	// (builder-layout-integration.test.ts, bpmn-builder.test.ts,
	// layout.test.ts), run through the actual applyAutoLayout output.
	// -------------------------------------------------------------------
	describe("sampled real fixtures", () => {
		beforeEach(() => {
			resetIdCounter()
		})

		it("gateway-branching order-processing workflow", () => {
			const defs = Bpmn.createProcess("order")
				.withAutoLayout()
				.name("Order Processing")
				.startEvent("start", { name: "Order Received" })
				.serviceTask("validate", { name: "Validate", taskType: "validate-order" })
				.exclusiveGateway("check")
				.branch("valid", (b) =>
					b
						.serviceTask("process", { name: "Process", taskType: "process-order" })
						.serviceTask("ship", { name: "Ship", taskType: "ship-order" }),
				)
				.branch("invalid", (b) =>
					b.serviceTask("reject", { name: "Reject", taskType: "reject-order" }),
				)
				.exclusiveGateway("merge")
				.endEvent("end", { name: "Done" })
				.build()
			expect(checkDiCompleteness(defs)).toEqual({ missingShapes: [], missingEdges: [] })
		})

		it("ad-hoc subprocess with disconnected children", () => {
			const defs = Bpmn.createProcess("p1")
				.withAutoLayout()
				.startEvent("s")
				.adHocSubProcess(
					"sub",
					(b) => b.serviceTask("c1", { taskType: "x" }).serviceTask("c2", { taskType: "y" }),
					{ name: "SubProcess" },
				)
				.endEvent("e")
				.build()
			expect(checkDiCompleteness(defs)).toEqual({ missingShapes: [], missingEdges: [] })
		})

		it("subprocess nested two levels deep", () => {
			const defs = Bpmn.createProcess("proc")
				.withAutoLayout()
				.startEvent("s")
				.subProcess("outer", (sp) => {
					sp.subProcess("inner", (inner) => {
						inner.startEvent("i-s").serviceTask("i-t", { taskType: "inner-work" }).endEvent("i-e")
					})
				})
				.endEvent("e")
				.build()
			expect(checkDiCompleteness(defs)).toEqual({ missingShapes: [], missingEdges: [] })
		})

		it("event sub-process (triggeredByEvent) nested inside a subprocess", () => {
			const defs = Bpmn.createProcess("proc")
				.withAutoLayout()
				.startEvent("s")
				.subProcess("outer", (sp) => {
					sp.startEvent("outer-s")
						.eventSubProcess("evtsub", (sub) => {
							sub.startEvent("err-start").endEvent("err-end")
						})
						.endEvent("outer-e")
				})
				.endEvent("e")
				.build()
			expect(checkDiCompleteness(defs)).toEqual({ missingShapes: [], missingEdges: [] })
		})

		it("two-lane pool: lanes are ignored, member elements are still checked", () => {
			const laneANodes = [node("a1", "serviceTask"), node("a2", "serviceTask")]
			const laneBNodes = [node("b1", "serviceTask")]
			const allNodes = [...laneANodes, ...laneBNodes]
			const proc = baseProcess("proc", allNodes, [flow("f1", "a1", "b1")], {
				laneSet: {
					id: "ls1",
					lanes: [
						{ id: "laneA", flowNodeRefs: laneANodes.map((n) => n.id), unknownAttributes: {} },
						{ id: "laneB", flowNodeRefs: laneBNodes.map((n) => n.id), unknownAttributes: {} },
					],
				},
			})
			const collab: BpmnCollaboration = {
				id: "collab",
				participants: [{ id: "part1", processRef: "proc", unknownAttributes: {} }],
				messageFlows: [],
				textAnnotations: [],
				associations: [],
				extensionElements: [],
				unknownAttributes: {},
			}
			const result = applyAutoLayout(emptyDefs([proc], [collab]))
			expect(checkDiCompleteness(result)).toEqual({ missingShapes: [], missingEdges: [] })
		})

		it("literal eventSubProcess and transaction element types are recursed into", () => {
			const evtSub = node("evtsub", "eventSubProcess", {
				flowElements: [node("err-s", "startEvent"), node("err-e", "endEvent")],
				sequenceFlows: [flow("ef1", "err-s", "err-e")],
				textAnnotations: [],
				associations: [],
			})
			const txn = node("txn", "transaction", {
				flowElements: [
					node("tx-s", "startEvent"),
					node("tx-t", "serviceTask"),
					node("tx-e", "endEvent"),
				],
				sequenceFlows: [flow("tf1", "tx-s", "tx-t"), flow("tf2", "tx-t", "tx-e")],
				textAnnotations: [],
				associations: [],
			})
			const proc = baseProcess(
				"proc",
				[node("s", "startEvent"), evtSub, txn, node("e", "endEvent")],
				[flow("f1", "s", "txn"), flow("f2", "txn", "e")],
			)
			const result = applyAutoLayout(emptyDefs([proc]))
			expect(checkDiCompleteness(result)).toEqual({ missingShapes: [], missingEdges: [] })
		})
	})
})
