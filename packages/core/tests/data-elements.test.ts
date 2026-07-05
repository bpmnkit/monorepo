import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { isBpmnDataObjectReference, isBpmnDataStoreReference } from "../src/bpmn/type-guards.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="d" targetNamespace="t">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:task id="t" name="Do"/>
    <bpmn:dataObject id="do" name="Order"/>
    <bpmn:dataObjectReference id="dor" name="Order Ref" dataObjectRef="do" isCollection="true"/>
    <bpmn:dataStoreReference id="dsr" name="Store" dataStoreRef="store"/>
    <bpmn:group id="grp" categoryValueRef="cat1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="t_di" bpmnElement="t"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="dor_di" bpmnElement="dor"><dc:Bounds x="160" y="0" width="36" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="dsr_di" bpmnElement="dsr"><dc:Bounds x="220" y="0" width="50" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="grp_di" bpmnElement="grp"><dc:Bounds x="-10" y="-10" width="300" height="120"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe("data objects, stores, and groups", () => {
	it("parses data objects, references, stores, and groups", () => {
		const defs = Bpmn.parse(XML)
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")

		const dor = proc.flowElements.find(isBpmnDataObjectReference)
		expect(dor?.dataObjectRef).toBe("do")
		expect(dor?.isCollection).toBe(true)

		const dsr = proc.flowElements.find(isBpmnDataStoreReference)
		expect(dsr?.dataStoreRef).toBe("store")

		expect(proc.flowElements.some((e) => e.type === "dataObject")).toBe(true)
		expect(proc.groups).toHaveLength(1)
		expect(proc.groups[0]?.categoryValueRef).toBe("cat1")
	})

	it("round-trips them through parse → export", () => {
		const xml2 = Bpmn.export(Bpmn.parse(XML))
		expect(xml2).toContain("<bpmn:dataObject ")
		expect(xml2).toContain('dataObjectRef="do"')
		expect(xml2).toContain('isCollection="true"')
		expect(xml2).toContain('dataStoreRef="store"')
		expect(xml2).toContain("<bpmn:group ")
		expect(xml2).toContain('categoryValueRef="cat1"')

		// Re-parse to confirm structural stability.
		const defs2 = Bpmn.parse(xml2)
		const proc = defs2.processes[0]
		expect(proc?.flowElements.filter((e) => e.type.startsWith("data"))).toHaveLength(3)
		expect(proc?.groups).toHaveLength(1)
	})
})
