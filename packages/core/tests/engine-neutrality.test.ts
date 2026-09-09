import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { detectExecutionPlatform } from "../src/bpmn/lint.js"
import { ensureZeebeExtension } from "../src/bpmn/zeebe-extensions.js"

/**
 * A diagram authored somewhere vendor-neutral: no `modeler:executionPlatform`,
 * no Camunda namespaces, nothing claiming an engine.
 */
const NEUTRAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://example.com/neutral">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="task" name="Do work"><bpmn:incoming>f1</bpmn:incoming></bpmn:serviceTask>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="task" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="task"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

const CAMUNDA_CLOUD = NEUTRAL.replace(
	'id="Definitions_1"',
	'xmlns:modeler="http://camunda.org/schema/modeler/1.0" modeler:executionPlatform="Camunda Cloud" modeler:executionPlatformVersion="8.6.0" id="Definitions_1"',
)

describe("engine neutrality", () => {
	it("a neutral model survives a round trip without gaining an engine", () => {
		// The invariant: opening a diagram authored elsewhere and writing it back
		// must not quietly enrol it in Camunda 8.
		const xml = Bpmn.export(Bpmn.parse(NEUTRAL))
		expect(xml).not.toContain("executionPlatform")
		expect(detectExecutionPlatform(Bpmn.parse(xml)).id).toBe("none")
	})

	it("a neutral model survives an edit without gaining an engine", () => {
		const defs = Bpmn.parse(NEUTRAL)
		const task = defs.processes[0]?.flowElements.find((e) => e.id === "task")
		if (task === undefined) throw new Error("fixture lost its task")
		task.name = "Renamed"

		const xml = Bpmn.export(defs)
		expect(xml).not.toContain("executionPlatform")
		expect(xml).toContain('name="Renamed"')
	})

	it("adding a Camunda extension does not stamp a platform on the document", () => {
		// Configuring one task for an engine is not the same as declaring that the
		// whole model targets it — that claim is the author's to make.
		const defs = Bpmn.parse(NEUTRAL)
		const task = defs.processes[0]?.flowElements.find((e) => e.id === "task")
		if (task === undefined) throw new Error("fixture lost its task")
		ensureZeebeExtension(task, "zeebe:taskDefinition").attributes.type = "worker"

		expect(Bpmn.export(defs)).not.toContain("executionPlatform")
	})

	it("adding a Camunda extension declares the namespace it uses", () => {
		// Regression: the serializer emitted only the namespaces the model was
		// parsed with, so a neutral file given a zeebe extension exported a prefix
		// bound to nothing — not namespace-well-formed, and rejectable.
		const defs = Bpmn.parse(NEUTRAL)
		const task = defs.processes[0]?.flowElements.find((e) => e.id === "task")
		if (task === undefined) throw new Error("fixture lost its task")
		ensureZeebeExtension(task, "zeebe:taskDefinition").attributes.type = "worker"

		const xml = Bpmn.export(defs)
		expect(xml).toContain('xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"')
		expect(xml).toContain('<zeebe:taskDefinition type="worker"/>')

		// And the result is readable again, with the extension intact.
		const reparsed = Bpmn.parse(xml)
		const reparsedTask = reparsed.processes[0]?.flowElements.find((e) => e.id === "task")
		expect(reparsedTask?.extensionElements?.[0]?.name).toBe("zeebe:taskDefinition")
	})

	it("does not declare namespaces the document never uses", () => {
		const xml = Bpmn.export(Bpmn.parse(NEUTRAL))
		expect(xml).not.toContain("xmlns:zeebe")
		expect(xml).not.toContain("xmlns:camunda")
	})

	it("keeps a declaration the model already made, rather than replacing it", () => {
		const custom = NEUTRAL.replace(
			'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"',
			'xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://example.com/our-own-zeebe"',
		)
		const xml = Bpmn.export(Bpmn.parse(custom))
		expect(xml).toContain('xmlns:zeebe="http://example.com/our-own-zeebe"')
		expect(xml).not.toContain("http://camunda.org/schema/zeebe/1.0")
	})

	it("a model that does name an engine keeps it verbatim", () => {
		// The invariant runs both ways: we neither add a platform nor drop one.
		const xml = Bpmn.export(Bpmn.parse(CAMUNDA_CLOUD))
		expect(detectExecutionPlatform(Bpmn.parse(xml))).toEqual({
			id: "camunda-cloud",
			name: "Camunda Cloud",
			version: "8.6.0",
		})
	})
})
