import type { LintDiagnostic, LintReport } from "@bpmnkit/core"
import { Bpmn, lintDiagram } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { placeDiagnostics, summarise } from "../src/host/diagnostics.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" />
    <bpmn:userTask id="approve" name="Approve" />
    <bpmn:endEvent id="end" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="approve" />
    <bpmn:sequenceFlow id="f2" sourceRef="approve" targetRef="end" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="approve"><dc:Bounds x="200" y="60" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="end"><dc:Bounds x="360" y="80" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

function finding(overrides: Partial<LintDiagnostic> = {}): LintDiagnostic {
	return {
		id: "pattern/example",
		severity: "warning",
		category: "pattern",
		message: "Something is off.",
		suggestion: "Do the other thing.",
		processId: "proc",
		elementIds: ["approve"],
		fixable: false,
		...overrides,
	}
}

function report(diagnostics: LintDiagnostic[]): LintReport {
	return {
		diagnostics,
		platform: { id: "none" },
		categories: ["pattern"],
		counts: { error: 0, warning: diagnostics.length, info: 0 },
		total: diagnostics.length,
	}
}

const spanText = (xml: string, span: { offset: number; length: number }): string =>
	xml.slice(span.offset, span.offset + span.length)

describe("placeDiagnostics", () => {
	it("puts a finding on the element it names", () => {
		const [placed] = placeDiagnostics(XML, report([finding()]))
		expect(placed).toBeDefined()
		expect(spanText(XML, placed?.span ?? { offset: 0, length: 0 })).toBe("bpmn:userTask")
		expect(placed?.code).toBe("pattern/example")
	})

	it("emits one row per offending element, not one per finding", () => {
		const placed = placeDiagnostics(XML, report([finding({ elementIds: ["start", "approve"] })]))
		expect(placed.map((p) => spanText(XML, p.span))).toEqual(["bpmn:startEvent", "bpmn:userTask"])
	})

	it("keeps the suggestion separate from the message", () => {
		// The Problems panel shows the message; the suggestion becomes a child row,
		// so folding it into the message would say the same thing twice.
		const [placed] = placeDiagnostics(XML, report([finding()]))
		expect(placed?.message).toBe("Something is off.")
		expect(placed?.suggestion).toBe("Do the other thing.")
	})

	it("falls back to the process when a finding names no element", () => {
		const [placed] = placeDiagnostics(XML, report([finding({ elementIds: [] })]))
		expect(spanText(XML, placed?.span ?? { offset: 0, length: 0 })).toBe("bpmn:process")
	})

	it("falls back to the process when the element is not in this file", () => {
		const [placed] = placeDiagnostics(XML, report([finding({ elementIds: ["ghost"] })]))
		expect(spanText(XML, placed?.span ?? { offset: 0, length: 0 })).toBe("bpmn:process")
	})

	it("falls back to the whole file when even the process is missing", () => {
		const placed = placeDiagnostics(
			XML,
			report([finding({ elementIds: ["ghost"], processId: "also-ghost" })]),
		)
		expect(placed[0]?.span).toEqual({ offset: 0, length: 0 })
	})

	it("collapses rows that two missing elements pushed onto the same fallback", () => {
		const placed = placeDiagnostics(XML, report([finding({ elementIds: ["ghost-a", "ghost-b"] })]))
		expect(placed).toHaveLength(1)
	})

	it("keeps two different findings on the same element", () => {
		const placed = placeDiagnostics(
			XML,
			report([finding(), finding({ id: "flow/other", message: "And another." })]),
		)
		expect(placed.map((p) => p.code)).toEqual(["pattern/example", "flow/other"])
	})

	it("places every finding a real analysis produces", () => {
		const analysis = lintDiagram(Bpmn.parse(XML))
		expect(analysis.total).toBeGreaterThan(0)
		for (const placed of placeDiagnostics(XML, analysis)) {
			// Every span must land on a tag name, never mid-attribute.
			expect(XML[placed.span.offset - 1]).toBe("<")
			expect(spanText(XML, placed.span)).toMatch(/^[A-Za-z_][\w.:-]*$/)
		}
	})
})

describe("summarise", () => {
	it("names the platform whose rules ran", () => {
		expect(summarise(report([]))).toBe("No findings (no execution platform)")
	})

	it("counts each severity it has", () => {
		const one = report([finding()])
		expect(summarise(one)).toBe("1 warning (no execution platform)")
	})

	it("pluralises and reports the declared platform", () => {
		const two: LintReport = {
			...report([finding(), finding({ id: "x" })]),
			platform: { id: "camunda-cloud", name: "Camunda Cloud", version: "8.7.0" },
			counts: { error: 2, warning: 0, info: 0 },
		}
		expect(summarise(two)).toBe("2 errors (Camunda Cloud)")
	})
})
