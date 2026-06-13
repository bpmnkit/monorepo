import { describe, expect, it } from "vitest"
import { handleSdkExecute, handleSdkSearch } from "../src/sdk-code-mode.js"
import { SDK_SPEC } from "../src/sdk-spec.js"

// Minimal valid BPMN XML for testing
const MINIMAL_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
    <bpmn:endEvent id="EndEvent_1"/>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="StartEvent_1" targetRef="EndEvent_1"/>
  </bpmn:process>
</bpmn:definitions>`

describe("SDK_SPEC", () => {
	it("contains all 5 expected SDK functions", () => {
		const fns = Object.keys(SDK_SPEC.functions)
		expect(fns).toContain("sdk.parse")
		expect(fns).toContain("sdk.exportXml")
		expect(fns).toContain("sdk.optimize")
		expect(fns).toContain("sdk.layout")
		expect(fns).toContain("sdk.analyzeVariables")
	})

	it("each function spec has description, params, returns, example", () => {
		for (const [name, s] of Object.entries(SDK_SPEC.functions)) {
			expect(s.description, `${name}.description`).toBeTruthy()
			expect(s.params, `${name}.params`).toBeTruthy()
			expect(s.returns, `${name}.returns`).toBeTruthy()
			expect(s.example, `${name}.example`).toBeTruthy()
		}
	})
})

describe("sdk_search", () => {
	it("filters function names by substring", async () => {
		const result = await handleSdkSearch(
			`return Object.keys(spec.functions).filter(k => k.includes('Xml'))`,
		)
		expect(JSON.parse(result)).toContain("sdk.exportXml")
	})

	it("returns compact diagram shape", async () => {
		const result = await handleSdkSearch("return spec.compactDiagram.shape")
		const shape = JSON.parse(result)
		expect(shape.processes).toBeDefined()
		expect(shape.processes[0].elements).toBeDefined()
	})

	it("times out on infinite loop", async () => {
		await expect(handleSdkSearch("while(true){}")).rejects.toThrow()
	}, 10000)
})

describe("sdk_execute", () => {
	it("parses BPMN XML and returns process id", async () => {
		const result = await handleSdkExecute(
			"const d = JSON.parse(sdk.parse(xml)); return d.processes[0].id",
			MINIMAL_BPMN,
		)
		expect(JSON.parse(result)).toBe("Process_1")
	})

	it("round-trips XML through parse and exportXml", async () => {
		const result = await handleSdkExecute(
			`const compact = sdk.parse(xml); const xml2 = sdk.exportXml(compact); return xml2.includes('<bpmn:process')`,
			MINIMAL_BPMN,
		)
		expect(JSON.parse(result)).toBe(true)
	})

	it("runs optimize and returns a findings array", async () => {
		const result = await handleSdkExecute(
			"const compact = sdk.parse(xml); const { findings } = JSON.parse(sdk.optimize(compact)); return Array.isArray(findings)",
			MINIMAL_BPMN,
		)
		expect(JSON.parse(result)).toBe(true)
	})

	it("works without xml argument", async () => {
		const result = await handleSdkExecute("return 42")
		expect(JSON.parse(result)).toBe(42)
	})
})
