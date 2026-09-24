import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/index.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:camunda="http://camunda.org/schema/1.0/bpmn" id="d" targetNamespace="x">
  <bpmn:error id="Err" errorCode="E1"/>
  <bpmn:process id="p" isExecutable="true">
    <bpmn:serviceTask id="t">
      <bpmn:multiInstanceLoopCharacteristics camunda:collection="\${items}" camunda:elementVariable="item"/>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="b" attachedToRef="t">
      <bpmn:errorEventDefinition errorRef="Err" camunda:errorCodeVariable="code" camunda:errorMessageVariable="msg"/>
    </bpmn:boundaryEvent>
    <bpmn:intermediateThrowEvent id="send">
      <bpmn:messageEventDefinition camunda:type="external" camunda:topic="notify"/>
    </bpmn:intermediateThrowEvent>
  </bpmn:process>
</bpmn:definitions>`

describe("foreign attributes on event definitions and loops", () => {
	it("are read into unknownAttributes and written back", () => {
		const defs = Bpmn.parse(XML)
		const els = defs.processes[0]?.flowElements ?? []
		const task = els.find((e) => e.id === "t")
		const boundary = els.find((e) => e.id === "b")
		const send = els.find((e) => e.id === "send")
		expect(
			task && "loopCharacteristics" in task && task.loopCharacteristics?.unknownAttributes,
		).toEqual({
			"camunda:collection": "${items}",
			"camunda:elementVariable": "item",
		})
		expect(
			boundary && "eventDefinitions" in boundary && boundary.eventDefinitions[0]?.unknownAttributes,
		).toEqual({
			"camunda:errorCodeVariable": "code",
			"camunda:errorMessageVariable": "msg",
		})
		expect(
			send && "eventDefinitions" in send && send.eventDefinitions[0]?.unknownAttributes,
		).toEqual({
			"camunda:type": "external",
			"camunda:topic": "notify",
		})

		const out = Bpmn.export(defs)
		for (const text of [
			'camunda:collection="${items}"',
			'camunda:elementVariable="item"',
			'camunda:errorCodeVariable="code"',
			'camunda:errorMessageVariable="msg"',
			'camunda:type="external"',
			'camunda:topic="notify"',
		]) {
			expect(out).toContain(text)
		}
		expect(Bpmn.export(Bpmn.parse(out))).toBe(out)
	})
})
