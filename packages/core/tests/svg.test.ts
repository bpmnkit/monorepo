import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type {
	BpmnCollaboration,
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../src/bpmn/bpmn-model.js"
import { Bpmn } from "../src/bpmn/index.js"
import { exportSvg } from "../src/bpmn/svg.js"

// Build a reusable process with a variety of element types
function buildProcess() {
	return Bpmn.createProcess("test")
		.startEvent("start", { name: "Start" })
		.serviceTask("svc", { name: "Service Task", taskType: "my-worker" })
		.userTask("usr", { name: "Review", formId: "f1" })
		.exclusiveGateway("gw", { name: "OK?" })
		.branch("yes", (b) => b.condition("= approved").endEvent("end-ok", { name: "Done" }))
		.branch("no", (b) => b.defaultFlow().endEvent("end-no", { name: "Rejected" }))
		.withAutoLayout()
		.build()
}

describe("exportSvg", () => {
	it("returns a valid SVG string", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toMatch(/^<svg /)
		expect(svg).toMatch(/<\/svg>$/)
		expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
	})

	it("contains a viewBox", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toMatch(/viewBox="[\d. -]+"/)
	})

	it("includes element labels", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toContain("Service Task")
		expect(svg).toContain("Review")
		expect(svg).toContain("OK?")
		expect(svg).toContain("Start")
	})

	it("uses light theme colors by default", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		// Light theme background
		expect(svg).toContain("#f8f9fa")
		expect(svg).toContain("#ffffff")
	})

	it("uses dark theme colors when requested", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs, { theme: "dark" })
		expect(svg).toContain("#1e1e2e")
		expect(svg).toContain("#2a2a3e")
	})

	it("respects custom padding", () => {
		const defs = buildProcess()
		const svg0 = exportSvg(defs, { padding: 0 })
		const svg50 = exportSvg(defs, { padding: 50 })
		// Larger padding → larger width/height values in the SVG
		const w0 = Number(svg0.match(/width="([\d.]+)"/)?.[1] ?? 0)
		const w50 = Number(svg50.match(/width="([\d.]+)"/)?.[1] ?? 0)
		expect(w50).toBeGreaterThan(w0)
	})

	it("includes an arrow marker in defs", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		expect(svg).toContain("<defs>")
		expect(svg).toContain('<marker id="arr"')
	})

	it("emits edge paths", () => {
		const defs = buildProcess()
		const svg = exportSvg(defs)
		// Should have sequence flow paths with marker-end
		expect(svg).toContain('marker-end="url(#arr)"')
	})

	it("handles a process with no DI gracefully", () => {
		// Build without autoLayout — no diagrams array populated
		const defs = Bpmn.createProcess("empty").startEvent("s").endEvent("e").build()
		// Remove diagram data
		defs.diagrams = []
		const svg = exportSvg(defs)
		expect(svg).toMatch(/^<svg /)
	})

	it("produces the same output for repeated calls (deterministic)", () => {
		const defs = buildProcess()
		expect(exportSvg(defs)).toBe(exportSvg(defs))
	})

	it("renders all gateway types without throwing", () => {
		const types = ["exclusiveGateway", "parallelGateway", "inclusiveGateway"] as const
		for (const gwType of types) {
			const defs = Bpmn.createProcess("gw-test")
				.startEvent("s")
				[gwType]("gw")
				.branch("a", (b) => b.endEvent("e1"))
				.branch("b", (b) => b.endEvent("e2"))
				.withAutoLayout()
				.build()
			expect(() => exportSvg(defs)).not.toThrow()
		}
	})

	it("renders task types with icons without throwing", () => {
		const defs = Bpmn.createProcess("icons")
			.startEvent("s")
			.userTask("u", { name: "User" })
			.serviceTask("svc", { name: "Service", taskType: "t" })
			.scriptTask("sc", { name: "Script" })
			.businessRuleTask("br", { name: "Rule", decisionId: "d" })
			.endEvent("e")
			.withAutoLayout()
			.build()
		expect(() => exportSvg(defs)).not.toThrow()
		const svg = exportSvg(defs)
		expect(svg).toContain("User")
		expect(svg).toContain("Service")
	})

	it("renders pool backgrounds before child shapes so the opaque pool body doesn't paint over them", () => {
		// Regression test: pool/lane shapes are appended to the DI shapes array
		// *after* their child flow-node shapes (see applyAutoLayout), but renderPool()/
		// renderLane() emit an opaque full-size background rect. If the SVG emitted
		// shapes in DI-array order, that opaque rect painted over every element and
		// edge nested inside the pool, making the diagram interior look blank.
		const process: BpmnProcess = {
			id: "proc",
			isExecutable: true,
			extensionElements: [],
			flowElements: [
				{
					id: "s",
					type: "startEvent",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
					eventDefinitions: [],
				} as unknown as BpmnFlowElement,
				{
					id: "t",
					type: "userTask",
					name: "Pack items",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
				} as unknown as BpmnFlowElement,
				{
					id: "e",
					type: "endEvent",
					incoming: [],
					outgoing: [],
					extensionElements: [],
					unknownAttributes: {},
					eventDefinitions: [],
				} as unknown as BpmnFlowElement,
			],
			sequenceFlows: [
				{ id: "f1", sourceRef: "s", targetRef: "t", extensionElements: [], unknownAttributes: {} },
				{ id: "f2", sourceRef: "t", targetRef: "e", extensionElements: [], unknownAttributes: {} },
			] as BpmnSequenceFlow[],
			textAnnotations: [],
			associations: [],
			unknownAttributes: {},
		}
		const collaboration: BpmnCollaboration = {
			id: "collab",
			participants: [{ id: "pool1", name: "Warehouse", processRef: "proc", unknownAttributes: {} }],
			messageFlows: [],
			textAnnotations: [],
			associations: [],
			extensionElements: [],
			unknownAttributes: {},
		}
		const defs: BpmnDefinitions = {
			id: "defs",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			namespaces: {},
			unknownAttributes: {},
			errors: [],
			escalations: [],
			messages: [],
			signals: [],
			collaborations: [collaboration],
			processes: [process],
			diagrams: [],
		}

		const svg = exportSvg(applyAutoLayout(defs))

		const poolLabelIdx = svg.indexOf(">Warehouse<")
		const taskLabelIdx = svg.indexOf(">Pack items<")
		expect(poolLabelIdx).toBeGreaterThan(-1)
		expect(taskLabelIdx).toBeGreaterThan(-1)
		expect(poolLabelIdx).toBeLessThan(taskLabelIdx)
	})
})
