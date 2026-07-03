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
})
