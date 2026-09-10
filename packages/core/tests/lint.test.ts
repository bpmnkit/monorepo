import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { detectExecutionPlatform, lintDiagram } from "../src/bpmn/lint.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A service task and nothing else — enough for the deploy rules to have an opinion. */
function makeXml(
	options: { platform?: string; version?: string; taskType?: string; withPlane?: boolean } = {},
): string {
	const { platform, version = "8.6.0", taskType, withPlane = true } = options
	const modelerNs =
		platform === undefined
			? ""
			: ` xmlns:modeler="http://camunda.org/schema/modeler/1.0" modeler:executionPlatform="${platform}" modeler:executionPlatformVersion="${version}"`
	const zeebeNs = ' xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"'
	const taskDef =
		taskType === undefined
			? ""
			: `<bpmn:extensionElements><zeebe:taskDefinition type="${taskType}" /></bpmn:extensionElements>`

	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"${zeebeNs}${modelerNs}
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="charge" name="Charge card">${taskDef}<bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="charge" />
    <bpmn:sequenceFlow id="f2" sourceRef="charge" targetRef="end" />
  </bpmn:process>
  ${
		withPlane
			? `<bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="charge"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="end"><dc:Bounds x="360" y="100" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`
			: ""
	}
</bpmn:definitions>`
}

function lint(xml: string, options?: Parameters<typeof lintDiagram>[1]) {
	return lintDiagram(Bpmn.parse(xml), options)
}

// ── Platform detection ────────────────────────────────────────────────────────

describe("detectExecutionPlatform", () => {
	it("reports none when the model names no engine", () => {
		expect(detectExecutionPlatform(Bpmn.parse(makeXml()))).toEqual({ id: "none" })
	})

	it("reads Camunda Cloud and its version", () => {
		const platform = detectExecutionPlatform(Bpmn.parse(makeXml({ platform: "Camunda Cloud" })))
		expect(platform).toEqual({ id: "camunda-cloud", name: "Camunda Cloud", version: "8.6.0" })
	})

	it("distinguishes Camunda Platform from Camunda Cloud", () => {
		const platform = detectExecutionPlatform(Bpmn.parse(makeXml({ platform: "Camunda Platform" })))
		expect(platform.id).toBe("camunda-platform")
	})

	it("treats an unrecognised platform name as none", () => {
		expect(detectExecutionPlatform(Bpmn.parse(makeXml({ platform: "Flowable" }))).id).toBe("none")
	})
})

// ── Engine rules ──────────────────────────────────────────────────────────────

describe("lintDiagram — engine rules", () => {
	it("does not accuse an engine-neutral model of being undeployable", () => {
		// The measured false alarm: `deploy` calls a plain service task an error
		// for having no zeebe:taskDefinition, on a diagram never meant for Zeebe.
		const report = lint(makeXml())
		expect(report.platform.id).toBe("none")
		expect(report.diagnostics.map((d) => d.category)).not.toContain("deploy")
		expect(report.categories).not.toContain("deploy")
	})

	it("applies deploy rules once the model names Camunda Cloud", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud" }))
		expect(report.diagnostics.some((d) => d.category === "deploy")).toBe(true)
		expect(report.categories).toContain("deploy")
	})

	it("still reports structural findings on an engine-neutral model", () => {
		// Dropping the engine layer must not silence everything else.
		const report = lint(makeXml())
		expect(report.total).toBeGreaterThan(0)
	})

	it("runs engine rules on request even without a platform", () => {
		const report = lint(makeXml(), { forceEngineRules: true })
		expect(report.diagnostics.some((d) => d.category === "deploy")).toBe(true)
	})

	it("narrows to the categories asked for", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud" }), { categories: ["naming"] })
		expect(report.categories).toEqual(["naming"])
		expect(report.diagnostics.every((d) => d.category === "naming")).toBe(true)
	})

	it("drops engine categories from an explicit request on a neutral model", () => {
		const report = lint(makeXml(), { categories: ["naming", "deploy"] })
		expect(report.categories).toEqual(["naming"])
	})
})

// ── Diagnostics ───────────────────────────────────────────────────────────────

describe("lintDiagram — diagnostics", () => {
	it("survives a JSON round trip, which an OptimizationFinding does not", () => {
		// The whole point of the shape: `applyFix` is a function and cannot cross
		// a postMessage or a JSON boundary.
		const report = lint(makeXml({ platform: "Camunda Cloud" }))
		expect(report.diagnostics.length).toBeGreaterThan(0)
		expect(JSON.parse(JSON.stringify(report))).toEqual(report)
	})

	it("says whether a fix exists rather than carrying one", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud" }))
		for (const diagnostic of report.diagnostics) {
			expect(typeof diagnostic.fixable).toBe("boolean")
			expect(diagnostic).not.toHaveProperty("applyFix")
		}
	})

	it("names the plane an element is drawn on", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud" }))
		const onCharge = report.diagnostics.find((d) => d.elementIds.includes("charge"))
		expect(onCharge?.plane).toBe("proc")
	})

	it("omits the plane when the element is not drawn", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud", withPlane: false }))
		expect(report.diagnostics.every((d) => d.plane === undefined)).toBe(true)
	})

	it("counts by severity, and the total matches", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud" }))
		const summed = report.counts.error + report.counts.warning + report.counts.info
		expect(summed).toBe(report.total)
		expect(report.total).toBe(report.diagnostics.length)
	})

	it("reports a clean, fully specified model with no deploy errors", () => {
		const report = lint(makeXml({ platform: "Camunda Cloud", taskType: "charge-worker" }))
		expect(
			report.diagnostics.filter((d) => d.category === "deploy" && d.severity === "error"),
		).toHaveLength(0)
	})
})
