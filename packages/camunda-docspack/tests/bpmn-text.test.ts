import { describe, expect, it } from "vitest"
import { bpmnToText } from "../src/bpmn-text.js"

/** A gateway with named, conditioned outgoing flows — the shape the naming pages teach. */
const GATEWAY = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="Definitions_1"
    targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="start" name="Invoice to&#10;be checked" />
    <bpmn:task id="check" name="Check invoice" />
    <bpmn:exclusiveGateway id="gw" name="Invoice &#10;correct?" />
    <bpmn:task id="pay" name="Pay invoice" />
    <bpmn:task id="reject" name="Reject payment of invoice" />
    <bpmn:endEvent id="paid" name="Invoice paid" />
    <bpmn:endEvent id="rejected" name="Invoice rejected" />
    <bpmn:sequenceFlow id="f0" sourceRef="start" targetRef="check" />
    <bpmn:sequenceFlow id="f1" sourceRef="check" targetRef="gw" />
    <bpmn:sequenceFlow id="f2" name="Yes" sourceRef="gw" targetRef="pay">
      <bpmn:conditionExpression>=correct</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f3" name="No" sourceRef="gw" targetRef="reject">
      <bpmn:conditionExpression>=not(correct)</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f4" sourceRef="pay" targetRef="paid" />
    <bpmn:sequenceFlow id="f5" sourceRef="reject" targetRef="rejected" />
  </bpmn:process>
</bpmn:definitions>`

/** A loop back to its gateway, and no `id` on `<definitions>` — both occur upstream. */
const LOOP = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL"
    targetNamespace="http://bpmn.io/schema/bpmn">
  <process id="Process_2" isExecutable="true">
    <startEvent id="s" name="Order received" />
    <inclusiveGateway id="g" />
    <task id="pack" name="Package goods" />
    <sequenceFlow id="a" sourceRef="s" targetRef="g" />
    <sequenceFlow id="b" name="Always" sourceRef="g" targetRef="pack" />
    <sequenceFlow id="c" sourceRef="pack" targetRef="g" />
  </process>
</definitions>`

describe("bpmnToText", () => {
	it("keeps every element name whole", () => {
		const out = bpmnToText(GATEWAY)
		expect(out).toContain('"Reject payment of invoice"')
		expect(out).toContain('end "Invoice paid"')
	})

	it("names the flow labels and their conditions, which the pages are about", () => {
		const out = bpmnToText(GATEWAY)
		expect(out).toContain("[Yes: =correct]")
		expect(out).toContain("[No: =not(correct)]")
	})

	it("says what kind of gateway it is", () => {
		expect(bpmnToText(GATEWAY)).toContain('exclusive gateway "Invoice correct?"')
	})

	it("collapses the newlines a modeller wraps labels with", () => {
		expect(bpmnToText(GATEWAY)).toContain('start "Invoice to be checked"')
	})

	it("parses a diagram with no id on <definitions>, which the schema allows", () => {
		expect(bpmnToText(LOOP)).toContain('start "Order received"')
	})

	it("terminates a loop instead of unrolling it", () => {
		const out = bpmnToText(LOOP)
		expect(out).toContain("(back to inclusive gateway)")
		expect(out.split("Package goods").length - 1).toBe(1)
	})

	it("stays far smaller than the box-art renderer it replaces", () => {
		// renderBpmnAscii produces ~1,680 characters for this diagram, with names truncated.
		expect(bpmnToText(GATEWAY).length).toBeLessThan(400)
	})
})
