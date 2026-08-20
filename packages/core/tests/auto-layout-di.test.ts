import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnMessageFlow,
	BpmnParticipant,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnSubProcess,
	BpmnTextAnnotation,
} from "../src/bpmn/bpmn-model.js"
import { checkDiCompleteness } from "../src/bpmn/di-check.js"
import { planeForElement } from "../src/bpmn/di-planes.js"

function node(id: string, type: BpmnFlowElement["type"] = "serviceTask"): BpmnFlowElement {
	const base = {
		id,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [],
		unknownAttributes: {},
	}
	if (type === "startEvent") return { ...base, type: "startEvent", eventDefinitions: [] }
	if (type === "endEvent") return { ...base, type: "endEvent", eventDefinitions: [] }
	if (type === "subProcess") {
		return {
			...base,
			type: "subProcess",
			flowElements: [],
			sequenceFlows: [],
			textAnnotations: [],
			associations: [],
		}
	}
	return { ...base, type: "serviceTask" }
}

function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} }
}

function proc(
	id: string,
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	textAnnotations: BpmnTextAnnotation[] = [],
): BpmnProcess {
	return {
		id,
		extensionElements: [],
		flowElements,
		sequenceFlows,
		textAnnotations,
		associations: [],
		unknownAttributes: {},
	}
}

function defsOf(
	processes: BpmnProcess[],
	options: {
		participants?: BpmnParticipant[]
		messageFlows?: BpmnMessageFlow[]
		diagrams?: BpmnDefinitions["diagrams"]
	} = {},
): BpmnDefinitions {
	return {
		id: "defs",
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {},
		unknownAttributes: {},
		processes,
		collaborations: options.participants
			? [
					{
						id: "collab",
						participants: options.participants,
						messageFlows: options.messageFlows ?? [],
						unknownAttributes: {},
					},
				]
			: [],
		messages: [],
		errors: [],
		signals: [],
		escalations: [],
		diagrams: options.diagrams ?? [],
	}
}

/** start → task → end, the smallest process that produces a pool worth drawing. */
function linear(id: string): BpmnProcess {
	return proc(
		id,
		[node(`${id}_s`, "startEvent"), node(`${id}_a`), node(`${id}_e`, "endEvent")],
		[flow(`${id}_f1`, `${id}_s`, `${id}_a`), flow(`${id}_f2`, `${id}_a`, `${id}_e`)],
	)
}

describe("auto-layout DI — black-box pools", () => {
	const blackBoxDefs = (): BpmnDefinitions =>
		defsOf([linear("p1")], {
			participants: [
				{ id: "poolA", processRef: "p1", unknownAttributes: {} },
				{ id: "poolB", unknownAttributes: {} },
			],
			messageFlows: [{ id: "mf1", sourceRef: "p1_a", targetRef: "poolB", unknownAttributes: {} }],
		})

	it("draws a participant that references no process", () => {
		const shapes = applyAutoLayout(blackBoxDefs()).diagrams[0]?.plane.shapes ?? []
		const pool = shapes.find((s) => s.bpmnElement === "poolB")
		expect(pool).toBeDefined()
		expect(pool?.bounds.height).toBeGreaterThan(0)
		expect(pool?.bounds.width).toBeGreaterThan(0)
	})

	it("routes message flows that dock onto a black-box pool", () => {
		const result = applyAutoLayout(blackBoxDefs())
		const edge = result.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === "mf1")
		expect(edge).toBeDefined()
		expect(edge?.waypoints.length).toBeGreaterThanOrEqual(2)
		expect(checkDiCompleteness(result).missingEdges).toEqual([])
	})

	it("stacks a black-box pool clear of the pool above it", () => {
		const shapes = applyAutoLayout(blackBoxDefs()).diagrams[0]?.plane.shapes ?? []
		const a = shapes.find((s) => s.bpmnElement === "poolA")?.bounds
		const b = shapes.find((s) => s.bpmnElement === "poolB")?.bounds
		expect(a && b).toBeTruthy()
		if (!a || !b) return
		expect(b.y).toBeGreaterThanOrEqual(a.y + a.height)
	})

	it("keeps participants in declaration order", () => {
		const defs = defsOf([linear("p1")], {
			participants: [
				{ id: "empty", unknownAttributes: {} },
				{ id: "full", processRef: "p1", unknownAttributes: {} },
			],
		})
		const shapes = applyAutoLayout(defs).diagrams[0]?.plane.shapes ?? []
		const first = shapes.find((s) => s.bpmnElement === "empty")?.bounds
		const second = shapes.find((s) => s.bpmnElement === "full")?.bounds
		expect(first && second).toBeTruthy()
		if (!first || !second) return
		expect(first.y).toBeLessThan(second.y)
	})
})

describe("auto-layout DI — planes", () => {
	function withSubProcess(collapsedInInput: boolean): BpmnDefinitions {
		const sub = node("sub", "subProcess") as BpmnSubProcess
		sub.flowElements = [node("c1"), node("c2")]
		sub.sequenceFlows = [flow("cf", "c1", "c2")]

		return defsOf(
			[
				proc(
					"p1",
					[node("s", "startEvent"), sub, node("e", "endEvent")],
					[flow("f1", "s", "sub"), flow("f2", "sub", "e")],
				),
			],
			{
				diagrams: [
					{
						id: "D1",
						plane: {
							id: "P1",
							bpmnElement: "p1",
							shapes: [
								{
									id: "sub_di",
									bpmnElement: "sub",
									bounds: { x: 0, y: 0, width: 100, height: 80 },
									isExpanded: !collapsedInInput,
									unknownAttributes: {},
								},
							],
							edges: [],
						},
					},
				],
			},
		)
	}

	it("gives a collapsed sub-process its own plane", () => {
		const result = applyAutoLayout(withSubProcess(true))
		const plane = planeForElement(result, "sub")
		expect(plane).toBeDefined()
		expect(plane?.shapes.map((s) => s.bpmnElement).sort()).toEqual(["c1", "c2"])

		// The children are no longer on the root plane, and the activity is collapsed.
		const root = result.diagrams[0]?.plane
		expect(root?.shapes.some((s) => s.bpmnElement === "c1")).toBe(false)
		expect(root?.shapes.find((s) => s.bpmnElement === "sub")?.isExpanded).toBe(false)
	})

	it("keeps an expanded sub-process on its parent plane", () => {
		const result = applyAutoLayout(withSubProcess(false))
		expect(planeForElement(result, "sub")).toBeUndefined()
		const root = result.diagrams[0]?.plane
		expect(root?.shapes.some((s) => s.bpmnElement === "c1")).toBe(true)
		expect(root?.shapes.find((s) => s.bpmnElement === "sub")?.isExpanded).toBe(true)
	})

	it("emits DI for every element of a collapsed scope", () => {
		expect(checkDiCompleteness(applyAutoLayout(withSubProcess(true)))).toEqual({
			missingShapes: [],
			missingEdges: [],
		})
	})

	it("gives a second root process a plane of its own", () => {
		const result = applyAutoLayout(defsOf([linear("p1"), linear("p2")]))
		const second = planeForElement(result, "p2")
		expect(second).toBeDefined()
		expect(second?.shapes.map((s) => s.bpmnElement).sort()).toEqual(["p2_a", "p2_e", "p2_s"])
		expect(result.diagrams[0]?.plane.shapes.some((s) => s.bpmnElement === "p2_a")).toBe(false)
	})

	it("places a process that is nothing but an annotation", () => {
		const defs = defsOf([
			proc(
				"p1",
				[],
				[],
				[{ id: "note", text: "just a note", unknownAttributes: {} } as BpmnTextAnnotation],
			),
		])
		const shapes = applyAutoLayout(defs).diagrams[0]?.plane.shapes ?? []
		expect(shapes.find((s) => s.bpmnElement === "note")).toBeDefined()
	})
})
