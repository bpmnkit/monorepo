/**
 * The gate on what may become a drop's state.
 *
 * The risk this file is really about is not a permissive check — that shows up
 * as a broken diagram someone reports. It is a *strict* one: a rule that refuses
 * documents the editor produces legitimately would make real drops unwritable,
 * with the refusal arriving as a mysterious rejection mid-drag. So the first
 * test here is that the SDK's own showcase file passes, and the ops the editor
 * actually emits keep passing after they are applied.
 */
import { Bpmn, applyAutoLayout } from "@bpmnkit/core"
import { type EditorOp, applyOp } from "@bpmnkit/editor/headless"
import { describe, expect, it } from "vitest"
import { checkIntegrity, describeProblem } from "../src/lib/integrity.js"
import { SAMPLE_BPMN_XML, SIMPLE_BPMN } from "./fixtures.js"

const simple = () => Bpmn.parse(SIMPLE_BPMN)

describe("documents that must pass", () => {
	it("accepts the SDK's showcase diagram", () => {
		expect(checkIntegrity(Bpmn.parse(SAMPLE_BPMN_XML))).toBeNull()
	})

	it("accepts a plain process", () => {
		expect(checkIntegrity(simple())).toBeNull()
	})

	it("accepts what the editor's own ops produce", () => {
		const bounds = { x: 400, y: 200, width: 100, height: 80 }
		const ops: EditorOp[] = [
			{ kind: "createShape", type: "userTask", bounds, seed: "s1" },
			{ kind: "createBoundaryEvent", hostId: "task", eventDefType: "timer", bounds, seed: "s2" },
			{ kind: "createAnnotationFor", sourceId: "task", bounds, sourceBounds: bounds, seed: "s3" },
			{
				kind: "createConnected",
				sourceId: "task",
				type: "exclusiveGateway",
				bounds,
				waypoints: [
					{ x: 300, y: 100 },
					{ x: 400, y: 240 },
				],
				seed: "s4",
			},
			{ kind: "delete", ids: ["task"] },
			{ kind: "autoLayout" },
		]
		let defs = simple()
		for (const op of ops) {
			defs = applyOp(defs, op).defs
			expect(checkIntegrity(defs), `after ${op.kind}`).toBeNull()
		}
	})

	it("accepts a re-laid-out diagram", () => {
		expect(checkIntegrity(applyAutoLayout(Bpmn.parse(SAMPLE_BPMN_XML)))).toBeNull()
	})
})

describe("documents that must not", () => {
	it("catches two elements under one id", () => {
		const defs = simple()
		const process = defs.processes[0]
		const task = process?.flowElements.find((e) => e.id === "task")
		if (!process || !task) throw new Error("fixture changed")
		process.flowElements.push({ ...task, id: "start" })
		expect(checkIntegrity(defs)).toEqual({ kind: "duplicate-id", detail: "start" })
	})

	it("catches a DI id colliding with a model id", () => {
		const defs = simple()
		const shape = defs.diagrams[0]?.plane.shapes[0]
		if (!shape) throw new Error("fixture changed")
		shape.id = "task"
		expect(checkIntegrity(defs)?.kind).toBe("duplicate-id")
	})

	it("catches a flow whose target is gone", () => {
		const defs = simple()
		const process = defs.processes[0]
		if (!process) throw new Error("fixture changed")
		process.flowElements = process.flowElements.filter((e) => e.id !== "end")
		expect(checkIntegrity(defs)).toMatchObject({ kind: "dangling-ref" })
		expect(checkIntegrity(defs)?.detail).toBe("flow2 → end")
	})

	it("catches a boundary event attached to nothing", () => {
		const defs = simple()
		const process = defs.processes[0]
		if (!process) throw new Error("fixture changed")
		process.flowElements.push({
			type: "boundaryEvent",
			id: "boundary1",
			attachedToRef: "ghost",
			cancelActivity: true,
			incoming: [],
			outgoing: [],
			extensionElements: [],
			unknownAttributes: {},
		} as unknown as (typeof process.flowElements)[number])
		expect(checkIntegrity(defs)).toMatchObject({
			kind: "dangling-ref",
			detail: "boundary1 → ghost",
		})
	})

	it("catches an element with no shape to draw it", () => {
		const defs = simple()
		const plane = defs.diagrams[0]?.plane
		if (!plane) throw new Error("fixture changed")
		plane.shapes = plane.shapes.filter((s) => s.bpmnElement !== "end")
		expect(checkIntegrity(defs)).toEqual({ kind: "missing-di", detail: "end" })
	})

	it("catches a shape drawn for an element that is not there", () => {
		const defs = simple()
		const plane = defs.diagrams[0]?.plane
		const first = plane?.shapes[0]
		if (!plane || !first) throw new Error("fixture changed")
		plane.shapes.push({ ...first, id: "ghost_di", bpmnElement: "ghost" })
		expect(checkIntegrity(defs)).toMatchObject({ kind: "orphan-di" })
	})

	it("reports the first cause, not the consequences", () => {
		// Removing the task dangles both flows; one reason is what a writer needs.
		const defs = simple()
		const process = defs.processes[0]
		const plane = defs.diagrams[0]?.plane
		if (!process || !plane) throw new Error("fixture changed")
		process.flowElements = process.flowElements.filter((e) => e.id !== "task")
		plane.shapes = plane.shapes.filter((s) => s.bpmnElement !== "task")
		expect(checkIntegrity(defs)).toEqual({ kind: "dangling-ref", detail: "flow1 → task" })
	})
})

describe("explaining a refusal", () => {
	it("names the element in plain words for every kind", () => {
		const kinds = ["duplicate-id", "dangling-ref", "orphan-di", "missing-di"] as const
		for (const kind of kinds) {
			const text = describeProblem({ kind, detail: "task" })
			expect(text).toContain("task")
			expect(text).not.toContain(kind)
		}
	})
})
