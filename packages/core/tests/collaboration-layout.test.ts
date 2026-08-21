import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type {
	BpmnBounds,
	BpmnCollaboration,
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnMessageFlow,
	BpmnParticipant,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSubProcess,
} from "../src/bpmn/bpmn-model.js"

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

function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} }
}

function messageFlow(id: string, source: string, target: string): BpmnMessageFlow {
	return { id, sourceRef: source, targetRef: target, unknownAttributes: {} }
}

function process(
	id: string,
	elements: BpmnFlowElement[],
	flows: BpmnSequenceFlow[] = [],
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

function defsOf(
	processes: BpmnProcess[],
	participants: BpmnParticipant[],
	messageFlows: BpmnMessageFlow[],
	diagrams: BpmnDefinitions["diagrams"] = [],
): BpmnDefinitions {
	const collab: BpmnCollaboration = {
		id: "collab",
		participants,
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
		processes,
		collaborations: [collab],
		messages: [],
		errors: [],
		signals: [],
		escalations: [],
		diagrams,
	}
}

function participant(id: string, processRef: string): BpmnParticipant {
	return { id, processRef, unknownAttributes: {} }
}

function shapesOf(defs: BpmnDefinitions): Map<string, BpmnBounds> {
	const plane = defs.diagrams[0]?.plane
	return new Map((plane?.shapes ?? []).map((s) => [s.bpmnElement, s.bounds]))
}

function centreX(b: BpmnBounds): number {
	return b.x + b.width / 2
}

describe("collaboration — pool ordering", () => {
	it("puts pools that exchange messages next to each other", () => {
		// Declared A, B, C; only A and C talk, so B has no reason to sit between them.
		const a = process("pa", [node("a1")])
		const b = process("pb", [node("b1")])
		const c = process("pc", [node("c1")])
		const defs = defsOf(
			[a, b, c],
			[participant("A", "pa"), participant("B", "pb"), participant("C", "pc")],
			[messageFlow("m1", "a1", "c1"), messageFlow("m2", "c1", "a1")],
		)

		const shapes = shapesOf(applyAutoLayout(defs))
		const order = ["A", "B", "C"]
			.map((id) => ({ id, y: shapes.get(id)?.y ?? 0 }))
			.sort((x, y) => x.y - y.y)
			.map((entry) => entry.id)
		const distance = Math.abs(order.indexOf("A") - order.indexOf("C"))
		expect(distance).toBe(1)
	})

	it("keeps the declared order when no messages are exchanged", () => {
		const a = process("pa", [node("a1")])
		const b = process("pb", [node("b1")])
		const c = process("pc", [node("c1")])
		const defs = defsOf(
			[a, b, c],
			[participant("A", "pa"), participant("B", "pb"), participant("C", "pc")],
			[],
		)

		const shapes = shapesOf(applyAutoLayout(defs))
		const order = ["A", "B", "C"]
			.map((id) => ({ id, y: shapes.get(id)?.y ?? 0 }))
			.sort((x, y) => x.y - y.y)
			.map((entry) => entry.id)
		expect(order).toEqual(["A", "B", "C"])
	})
})

describe("collaboration — horizontal alignment", () => {
	it("slides a pool sideways so its message flow runs straight down", () => {
		// "sender" holds one task; in "receiver" the partner sits two ranks in, so
		// without alignment the message would have to travel sideways to reach it.
		const sender = process("ps", [node("s1")])
		const receiver = process(
			"pr",
			[node("r0", "startEvent"), node("r1"), node("r2")],
			[flow("rf1", "r0", "r1"), flow("rf2", "r1", "r2")],
		)
		const defs = defsOf(
			[sender, receiver],
			[participant("S", "ps"), participant("R", "pr")],
			[messageFlow("m1", "s1", "r2")],
		)

		const laid = applyAutoLayout(defs)
		const shapes = shapesOf(laid)
		const source = shapes.get("s1")
		const target = shapes.get("r2")
		expect(source && target).toBeTruthy()
		if (!source || !target) return
		expect(centreX(source)).toBe(centreX(target))

		const edge = laid.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === "m1")
		expect(edge?.waypoints).toHaveLength(2)
	})

	it("keeps every element inside its own pool after sliding", () => {
		const sender = process("ps", [node("s1")])
		const receiver = process(
			"pr",
			[node("r0", "startEvent"), node("r1"), node("r2")],
			[flow("rf1", "r0", "r1"), flow("rf2", "r1", "r2")],
		)
		const defs = defsOf(
			[sender, receiver],
			[participant("S", "ps"), participant("R", "pr")],
			[messageFlow("m1", "s1", "r2")],
		)

		const shapes = shapesOf(applyAutoLayout(defs))
		for (const [poolId, members] of [
			["S", ["s1"]],
			["R", ["r0", "r1", "r2"]],
		] as const) {
			const pool = shapes.get(poolId)
			expect(pool).toBeDefined()
			if (!pool) continue
			for (const id of members) {
				const member = shapes.get(id)
				expect(member).toBeDefined()
				if (!member) continue
				expect(member.x).toBeGreaterThanOrEqual(pool.x)
				expect(member.x + member.width).toBeLessThanOrEqual(pool.x + pool.width)
			}
		}
	})
})

describe("collaboration — endpoints and empty pools", () => {
	it("docks a message flow on the collapsed sub-process holding its endpoint", () => {
		const sub = node("sub", "subProcess") as BpmnSubProcess
		sub.flowElements = [node("inner")]
		sub.sequenceFlows = []

		const sender = process("ps", [node("s1")])
		const receiver = process("pr", [node("r0", "startEvent"), sub], [flow("rf1", "r0", "sub")])
		// Existing DI marks the sub-process collapsed, so "inner" lives on its own
		// plane and cannot be docked on directly.
		const defs = defsOf(
			[sender, receiver],
			[participant("S", "ps"), participant("R", "pr")],
			[messageFlow("m1", "s1", "inner")],
			[
				{
					id: "d1",
					plane: {
						id: "p1",
						bpmnElement: "collab",
						shapes: [
							{
								id: "sub_di",
								bpmnElement: "sub",
								isExpanded: false,
								bounds: { x: 0, y: 0, width: 100, height: 80 },
								unknownAttributes: {},
							},
						],
						edges: [],
					},
				},
			],
		)

		const laid = applyAutoLayout(defs)
		const edge = laid.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === "m1")
		expect(edge).toBeDefined()
		if (!edge) return

		const shapes = shapesOf(laid)
		const subBounds = shapes.get("sub")
		expect(subBounds).toBeDefined()
		expect(shapes.has("inner")).toBe(false)
		if (!subBounds) return

		const dock = edge.waypoints[edge.waypoints.length - 1]
		expect(dock).toBeDefined()
		if (!dock) return
		expect(dock.x).toBeGreaterThanOrEqual(subBounds.x)
		expect(dock.x).toBeLessThanOrEqual(subBounds.x + subBounds.width)
		expect([subBounds.y, subBounds.y + subBounds.height]).toContain(dock.y)
	})

	it("keeps a black-box pool wide enough for the docks it receives", () => {
		// A black box is sized from the pools around it, so a partner element far
		// to the right must still dock inside it.
		const talker = process(
			"pt",
			[node("t0", "startEvent"), node("t1"), node("t2"), node("t3"), node("t4")],
			[
				flow("tf1", "t0", "t1"),
				flow("tf2", "t1", "t2"),
				flow("tf3", "t2", "t3"),
				flow("tf4", "t3", "t4"),
			],
		)
		const defs = defsOf(
			[talker],
			[participant("T", "pt"), { id: "Box", unknownAttributes: {} }],
			[messageFlow("m1", "t4", "Box")],
		)

		const laid = applyAutoLayout(defs)
		const shapes = shapesOf(laid)
		const box = shapes.get("Box")
		const edge = laid.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === "m1")
		expect(box && edge).toBeTruthy()
		if (!box || !edge) return

		const dock = edge.waypoints[edge.waypoints.length - 1]
		expect(dock).toBeDefined()
		if (!dock) return
		expect(dock.x).toBeGreaterThanOrEqual(box.x)
		expect(dock.x).toBeLessThanOrEqual(box.x + box.width)
	})
})
