import { describe, expect, it } from "vitest"
import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnLane,
	BpmnLaneSet,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSubProcess,
} from "../src/bpmn/bpmn-model.js"
import { layoutProcess } from "../src/layout/layout-engine.js"
import type { Bounds, LayoutNode, LayoutResult } from "../src/layout/types.js"

function node(id: string, type: BpmnFlowElement["type"] = "serviceTask"): BpmnFlowElement {
	const base = {
		id,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [],
		unknownAttributes: {},
	}
	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] }
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] }
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" }
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		default:
			return { ...base, type: "serviceTask" }
	}
}

function boundary(id: string, host: string, kind?: "error" | "escalation"): BpmnBoundaryEvent {
	return {
		id,
		type: "boundaryEvent",
		attachedToRef: host,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
		eventDefinitions: kind ? [{ type: kind }] : [],
	}
}

function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} }
}

function lane(id: string, flowNodeRefs: string[], childLaneSet?: BpmnLaneSet): BpmnLane {
	return { id, flowNodeRefs, unknownAttributes: {}, ...(childLaneSet ? { childLaneSet } : {}) }
}

function proc(
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	laneSet?: BpmnLaneSet,
): BpmnProcess {
	return {
		id: "p",
		flowElements,
		sequenceFlows,
		extensionElements: [],
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
		...(laneSet ? { laneSet } : {}),
	}
}

function byId(result: LayoutResult): Map<string, LayoutNode> {
	return new Map(result.nodes.map((n) => [n.id, n]))
}

function centreY(b: Bounds): number {
	return b.y + b.height / 2
}

/** A linear start → task → task → end process. */
function linear(): BpmnProcess {
	return proc(
		[node("s", "startEvent"), node("a"), node("b"), node("e", "endEvent")],
		[flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e")],
	)
}

describe("semantic layout — spine", () => {
	it("runs the primary path left to right on one centre line", () => {
		const nodes = byId(layoutProcess(linear()))
		const ys = ["s", "a", "b", "e"].map((id) =>
			centreY(nodes.get(id)?.bounds ?? { x: 0, y: 0, width: 0, height: 0 }),
		)
		expect(new Set(ys).size).toBe(1)

		const xs = ["s", "a", "b", "e"].map((id) => nodes.get(id)?.bounds.x ?? 0)
		for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] ?? 0)
	})

	it("routes a spine edge as a single straight segment", () => {
		const result = layoutProcess(linear())
		const edge = result.edges.find((e) => e.id === "f2")
		expect(edge?.waypoints).toHaveLength(2)
		expect(edge?.waypoints[0]?.y).toBe(edge?.waypoints[1]?.y)
	})

	it("keeps a dead end off the spine even when it is declared first", () => {
		// The gateway's first branch stops immediately; the second reaches the end.
		const process = proc(
			[
				node("s", "startEvent"),
				node("gw", "exclusiveGateway"),
				node("stop"),
				node("go"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "gw"),
				flow("f2", "gw", "stop"),
				flow("f3", "gw", "go"),
				flow("f4", "go", "e"),
			],
		)
		const nodes = byId(layoutProcess(process))
		const spineY = centreY(nodes.get("gw")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 })
		expect(centreY(nodes.get("go")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 })).toBe(spineY)
		expect(centreY(nodes.get("stop")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 })).not.toBe(
			spineY,
		)
	})

	it("is deterministic for the same input", () => {
		const a = JSON.stringify(layoutProcess(linear()))
		const b = JSON.stringify(layoutProcess(linear()))
		expect(a).toBe(b)
	})
})

describe("semantic layout — bands", () => {
	it("puts an error handler below the spine and an escalation handler above", () => {
		const host = node("task")
		const process = proc(
			[
				node("s", "startEvent"),
				host,
				boundary("err", "task", "error"),
				boundary("esc", "task", "escalation"),
				node("recover"),
				node("notify"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "task"),
				flow("f2", "task", "e"),
				flow("f3", "err", "recover"),
				flow("f4", "esc", "notify"),
			],
		)
		const nodes = byId(layoutProcess(process))
		const spineY = centreY(nodes.get("task")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 })
		expect(
			centreY(nodes.get("recover")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 }),
		).toBeGreaterThan(spineY)
		expect(
			centreY(nodes.get("notify")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 }),
		).toBeLessThan(spineY)
	})

	it("docks boundary events on the host edge that faces their handler", () => {
		const process = proc(
			[
				node("s", "startEvent"),
				node("task"),
				boundary("err", "task", "error"),
				boundary("esc", "task", "escalation"),
				node("recover"),
				node("notify"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "task"),
				flow("f2", "task", "e"),
				flow("f3", "err", "recover"),
				flow("f4", "esc", "notify"),
			],
		)
		const nodes = byId(layoutProcess(process))
		const host = nodes.get("task")?.bounds
		const err = nodes.get("err")?.bounds
		const esc = nodes.get("esc")?.bounds
		expect(host && err && esc).toBeTruthy()
		if (!host || !err || !esc) return
		expect(centreY(err)).toBe(host.y + host.height)
		expect(centreY(esc)).toBe(host.y)
	})
})

describe("semantic layout — lanes", () => {
	const laneProcess = (): BpmnProcess =>
		proc(
			[node("s", "startEvent"), node("a"), node("b"), node("e", "endEvent")],
			[flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e")],
			{ lanes: [lane("top", ["s", "a"]), lane("bottom", ["b", "e"])] },
		)

	it("places every node inside the lane that claims it", () => {
		const result = layoutProcess(laneProcess())
		const nodes = byId(result)
		const lanes = new Map((result.lanes ?? []).map((l) => [l.id, l.bounds]))
		expect(lanes.size).toBe(2)

		for (const [laneId, members] of [
			["top", ["s", "a"]],
			["bottom", ["b", "e"]],
		] as const) {
			const band = lanes.get(laneId)
			expect(band).toBeDefined()
			if (!band) continue
			for (const id of members) {
				const b = nodes.get(id)?.bounds
				expect(b).toBeDefined()
				if (!b) continue
				expect(b.y).toBeGreaterThanOrEqual(band.y)
				expect(b.y + b.height).toBeLessThanOrEqual(band.y + band.height)
			}
		}
	})

	it("stacks lanes in declaration order without gaps or overlap", () => {
		const lanes = layoutProcess(laneProcess()).lanes ?? []
		expect(lanes.map((l) => l.id)).toEqual(["top", "bottom"])
		expect(lanes[1]?.bounds.y).toBe((lanes[0]?.bounds.y ?? 0) + (lanes[0]?.bounds.height ?? 0))
	})

	it("keeps left-to-right flow when lanes move nodes vertically", () => {
		const nodes = byId(layoutProcess(laneProcess()))
		const xs = ["s", "a", "b", "e"].map((id) => nodes.get(id)?.bounds.x ?? 0)
		for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] ?? 0)
	})

	it("spans a parent lane across the lanes nested inside it", () => {
		const process = proc(
			[node("s", "startEvent"), node("a"), node("e", "endEvent")],
			[flow("f1", "s", "a"), flow("f2", "a", "e")],
			{
				lanes: [lane("parent", [], { lanes: [lane("inner1", ["s", "a"]), lane("inner2", ["e"])] })],
			},
		)
		const lanes = new Map((layoutProcess(process).lanes ?? []).map((l) => [l.id, l.bounds]))
		const parent = lanes.get("parent")
		const inner1 = lanes.get("inner1")
		const inner2 = lanes.get("inner2")
		expect(parent && inner1 && inner2).toBeTruthy()
		if (!parent || !inner1 || !inner2) return
		expect(parent.y).toBe(Math.min(inner1.y, inner2.y))
		expect(parent.y + parent.height).toBe(
			Math.max(inner1.y + inner1.height, inner2.y + inner2.height),
		)
	})
})

describe("semantic layout — cycles and containers", () => {
	it("routes a loop back below the nodes it spans", () => {
		const process = proc(
			[node("s", "startEvent"), node("a"), node("b"), node("e", "endEvent")],
			[flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "a"), flow("f4", "b", "e")],
		)
		const result = layoutProcess(process)
		const nodes = byId(result)
		const loop = result.edges.find((edge) => edge.id === "f3")
		expect(loop).toBeDefined()
		if (!loop) return

		const lowest = Math.max(
			...["a", "b"].map((id) => {
				const b = nodes.get(id)?.bounds
				return b ? b.y + b.height : 0
			}),
		)
		expect(Math.max(...loop.waypoints.map((wp) => wp.y))).toBeGreaterThan(lowest)
	})

	it("sizes an expanded sub-process around its children", () => {
		const sub = node("sub", "subProcess") as BpmnSubProcess
		sub.flowElements = [node("c1"), node("c2")]
		sub.sequenceFlows = [flow("cf", "c1", "c2")]

		const process = proc(
			[node("s", "startEvent"), sub, node("e", "endEvent")],
			[flow("f1", "s", "sub"), flow("f2", "sub", "e")],
		)
		const nodes = byId(layoutProcess(process))
		const container = nodes.get("sub")?.bounds
		expect(container).toBeDefined()
		if (!container) return

		for (const id of ["c1", "c2"]) {
			const child = nodes.get(id)?.bounds
			expect(child).toBeDefined()
			if (!child) continue
			expect(child.x).toBeGreaterThan(container.x)
			expect(child.y).toBeGreaterThan(container.y)
			expect(child.x + child.width).toBeLessThan(container.x + container.width)
			expect(child.y + child.height).toBeLessThan(container.y + container.height)
		}
	})

	it("lays out disconnected components without overlapping them", () => {
		const process = proc(
			[node("s1", "startEvent"), node("a"), node("s2", "startEvent"), node("b")],
			[flow("f1", "s1", "a"), flow("f2", "s2", "b")],
		)
		const nodes = byId(layoutProcess(process))
		const first = nodes.get("a")?.bounds
		const second = nodes.get("b")?.bounds
		expect(first && second).toBeTruthy()
		if (!first || !second) return
		const disjoint =
			first.y + first.height <= second.y ||
			second.y + second.height <= first.y ||
			first.x + first.width <= second.x ||
			second.x + second.width <= first.x
		expect(disjoint).toBe(true)
	})
})

describe("semantic layout — engine selection", () => {
	it("still exposes the grid engine on request", () => {
		const semantic = layoutProcess(linear(), "semantic")
		const grid = layoutProcess(linear(), "grid")
		expect(semantic.nodes).toHaveLength(grid.nodes.length)
		expect(JSON.stringify(semantic)).not.toBe(JSON.stringify(grid))
	})
})

describe("semantic layout — rank refinements", () => {
	/**
	 * split ⇒ {a, b} ⇒ inner join, plus a third branch straight to the outer
	 * join, so both gateways really are joins.
	 */
	function nestedJoins(outerType: BpmnFlowElement["type"]): BpmnProcess {
		return proc(
			[
				node("s", "startEvent"),
				node("split", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("c"),
				node("inner", "exclusiveGateway"),
				{ ...node("outer", "exclusiveGateway"), type: outerType } as BpmnFlowElement,
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "split"),
				flow("f2", "split", "a"),
				flow("f3", "split", "b"),
				flow("f4", "split", "c"),
				flow("f5", "a", "inner"),
				flow("f6", "b", "inner"),
				flow("f7", "inner", "outer"),
				flow("f8", "c", "outer"),
				flow("f9", "outer", "e"),
			],
		)
	}

	it("lets nested joins of one gateway type share a rank and connect vertically", () => {
		const result = layoutProcess(nestedJoins("exclusiveGateway"))
		const nodes = byId(result)
		const inner = nodes.get("inner")?.bounds
		const outer = nodes.get("outer")?.bounds
		expect(inner && outer).toBeTruthy()
		if (!inner || !outer) return
		expect(outer.x).toBe(inner.x)

		const edge = result.edges.find((e) => e.id === "f7")
		expect(edge?.waypoints).toHaveLength(2)
		expect(edge?.waypoints[0]?.x).toBe(edge?.waypoints[1]?.x)
	})

	it("keeps the forward step between joins of different gateway types", () => {
		const nodes = byId(layoutProcess(nestedJoins("parallelGateway")))
		const inner = nodes.get("inner")?.bounds
		const outer = nodes.get("outer")?.bounds
		expect(inner && outer).toBeTruthy()
		if (!inner || !outer) return
		expect(outer.x).toBeGreaterThan(inner.x + inner.width)
	})

	it("gives a node no traversal reaches a band of its own", () => {
		// "x" feeds into the flow without being reachable from the start, so no
		// spine or branch walk ever claims it.
		const process = proc(
			[node("s", "startEvent"), node("a"), node("b"), node("e", "endEvent"), node("x")],
			[flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e"), flow("f4", "x", "a")],
		)
		const nodes = byId(layoutProcess(process))
		const start = nodes.get("s")?.bounds
		const stray = nodes.get("x")?.bounds
		expect(start && stray).toBeTruthy()
		if (!start || !stray) return

		const overlaps =
			start.x < stray.x + stray.width &&
			stray.x < start.x + start.width &&
			start.y < stray.y + stray.height &&
			stray.y < start.y + start.height
		expect(overlaps).toBe(false)
		expect(centreY(stray)).not.toBe(centreY(start))
	})
})

describe("semantic layout — crossing reduction", () => {
	/**
	 * Two branches whose nodes never share a rank, but whose edges do: A leaves
	 * at the first gateway and rejoins at the last join, B leaves and rejoins
	 * inside that span.
	 */
	function interleavedBranches(): BpmnProcess {
		return proc(
			[
				node("s", "startEvent"),
				node("g1", "exclusiveGateway"),
				node("g2", "exclusiveGateway"),
				node("x"),
				node("y"),
				node("j2", "exclusiveGateway"),
				node("j1", "exclusiveGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "g1"),
				flow("f2", "g1", "g2"),
				flow("f3", "g2", "j2"),
				flow("f4", "j2", "j1"),
				flow("f5", "j1", "e"),
				flow("a1", "g1", "x"),
				flow("a2", "x", "j1"),
				flow("b1", "g2", "y"),
				flow("b2", "y", "j2"),
			],
		)
	}

	it("keeps two branches apart when only their edges overlap", () => {
		// Packing bands by the ranks their nodes occupy would put both on one
		// band — x sits at one rank, y at the next — and the edge from x back to
		// its join would then run straight through y's band.
		const nodes = byId(layoutProcess(interleavedBranches()))
		const x = nodes.get("x")
		const y = nodes.get("y")
		expect(x && y).toBeTruthy()
		if (!x || !y) return
		expect(x.position).not.toBe(y.position)
		expect(Math.sign(x.position)).toBe(Math.sign(y.position))
		expect(centreY(x.bounds)).not.toBe(centreY(y.bounds))
	})

	it("leaves a branch and its own join on the same side of the spine", () => {
		const result = layoutProcess(interleavedBranches())
		const nodes = byId(result)
		const spineY = centreY(nodes.get("g1")?.bounds ?? { x: 0, y: 0, width: 0, height: 0 })
		for (const id of ["x", "y"]) {
			const branch = nodes.get(id)
			expect(branch).toBeDefined()
			if (!branch) continue
			expect(centreY(branch.bounds)).toBeGreaterThan(spineY)
		}
	})
})
