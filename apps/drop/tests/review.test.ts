import { describe, expect, it } from "vitest"
import { deterministicSuggestions } from "../src/lib/review.js"

// A process with well-known modeling problems: an exclusive gateway with no
// default flow / no conditions, a service task with no output mapping.
const BAD_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="p" isExecutable="true">
    <bpmn:startEvent id="s"><bpmn:outgoing>f0</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="gw" name="Decide">
      <bpmn:incoming>f0</bpmn:incoming><bpmn:outgoing>f1</bpmn:outgoing><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="e1"><bpmn:incoming>f1</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="e2"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f0" sourceRef="s" targetRef="gw"/>
    <bpmn:sequenceFlow id="f1" sourceRef="gw" targetRef="e1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="gw" targetRef="e2"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="p">
    <bpmndi:BPMNShape id="s_di" bpmnElement="s"><dc:Bounds x="0" y="0" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="gw_di" bpmnElement="gw"><dc:Bounds x="100" y="0" width="50" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="e1_di" bpmnElement="e1"><dc:Bounds x="200" y="0" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="e2_di" bpmnElement="e2"><dc:Bounds x="200" y="100" width="36" height="36"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe("deterministicSuggestions", () => {
	it("flags a gateway without a default flow, most-severe first", () => {
		const s = deterministicSuggestions(BAD_BPMN)
		expect(s.length).toBeGreaterThan(0)
		// sorted: no info appears before an error
		const sev = s.map((x) => x.severity)
		expect(sev.indexOf("error")).toBeLessThanOrEqual(
			sev.lastIndexOf("info") === -1 ? 999 : sev.indexOf("info"),
		)
		// the gateway default-flow finding is present and references the gateway
		const gw = s.find(
			(x) => /default (sequence )?flow/i.test(x.title) || /default flow/i.test(x.why),
		)
		expect(gw).toBeTruthy()
		expect(s.some((x) => x.elementId === "gw")).toBe(true)
	})

	it("carries a hostile element name through as plain string data", () => {
		// A malicious name decodes to real markup — that's expected; the security
		// guarantee is that the panel renders every field via textContent (verified
		// end-to-end with Playwright), never innerHTML. Here we only assert the
		// finding is a string field, i.e. inert JSON data with no code path.
		const hostile = BAD_BPMN.replace('name="Decide"', 'name="&lt;img src=x onerror=alert(1)&gt;"')
		const s = deterministicSuggestions(hostile)
		const named = s.find((x) => x.title.includes("img src=x onerror=alert(1)"))
		expect(named).toBeTruthy()
		expect(typeof named?.title).toBe("string")
	})

	it("respects the limit", () => {
		expect(deterministicSuggestions(BAD_BPMN, 2).length).toBeLessThanOrEqual(2)
	})
})
