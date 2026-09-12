export { SAMPLE_BPMN_XML } from "@bpmnkit/core"

export const SAMPLE_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_test" name="Pricing" namespace="http://bpmn.io/schema/dmn">
  <decision id="Decision_price" name="Determine Price">
    <decisionTable id="table_1" hitPolicy="UNIQUE">
      <input id="in_1" label="Category">
        <inputExpression id="ie_1" typeRef="string"><text>category</text></inputExpression>
      </input>
      <output id="out_1" label="Price" name="price" typeRef="number"/>
    </decisionTable>
  </decision>
</definitions>`

export const SAMPLE_FORM_JSON = JSON.stringify({
	components: [
		{ type: "textfield", key: "name", label: "Name", id: "Field_1" },
		{ type: "checkbox", key: "agree", label: "Agree", id: "Field_2" },
	],
	type: "default",
	id: "Form_registration",
	executionPlatform: "Camunda Cloud",
	executionPlatformVersion: "8.5.0",
	schemaVersion: 16,
})

/**
 * A small, complete BPMN document — model *and* diagram — for the room's tests.
 *
 * `SAMPLE_BPMN_XML` is the SDK's showcase file and is far larger than anything
 * an op test needs to read; this one is small enough that a failure points at
 * the element it is about.
 */
export const SIMPLE_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task" name="Do Work">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_di" bpmnElement="task">
        <dc:Bounds x="200" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="382" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="118" y="100"/>
        <di:waypoint x="200" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="300" y="100"/>
        <di:waypoint x="382" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

/** The filename `seedFile` gives that document. */
export const SEEDED_FILE = "order.bpmn"
