/**
 * Integration test for runScenarioWasm with a DMN-backed business rule task and gateway.
 * Mirrors the user's test.bpmn + dmn.dmn scenario.
 */
import { describe, expect, it } from "vitest"
import { runScenarioWasm } from "../src/wasm-runner.js"

const DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/"
             id="Definitions_dmn" name="dmn" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="validate-order" name="Validate Order">
    <decisionTable id="DecisionTable_1" hitPolicy="COLLECT">
      <input id="Input_1" label="amount">
        <inputExpression id="InputExpression_1" typeRef="number">
          <text>amount</text>
        </inputExpression>
      </input>
      <output id="Output_1" name="error" typeRef="string"/>
      <rule id="Rule_1">
        <inputEntry id="InputEntry_1"><text>&lt; 0</text></inputEntry>
        <outputEntry id="OutputEntry_1"><text>"Amount must be positive"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`

const BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="test-process" isExecutable="true">
    <bpmn:startEvent id="Start_1">
      <bpmn:outgoing>f1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:businessRuleTask id="BRT_1" name="Validate">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="validate-order" resultVariable="validationErrors"/>
      </bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:exclusiveGateway id="GW_1" name="Valid?">
      <bpmn:incoming>f2</bpmn:incoming>
      <bpmn:outgoing>f_ok</bpmn:outgoing>
      <bpmn:outgoing>f_err</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="End_OK">
      <bpmn:incoming>f_ok</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:endEvent id="End_ERR">
      <bpmn:incoming>f_err</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="Start_1" targetRef="BRT_1"/>
    <bpmn:sequenceFlow id="f2" sourceRef="BRT_1" targetRef="GW_1"/>
    <bpmn:sequenceFlow id="f_ok" sourceRef="GW_1" targetRef="End_OK">
      <bpmn:conditionExpression>=validationErrors = null or count(validationErrors) = 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f_err" sourceRef="GW_1" targetRef="End_ERR">
      <bpmn:conditionExpression>=validationErrors != null and count(validationErrors) > 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
  </bpmn:process>
</bpmn:definitions>`

describe("runScenarioWasm — DMN + gateway", () => {
	it("captures the DMN result variable in finalVariables", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s1",
				name: "Invalid amount",
				inputs: { amount: -5 },
			},
			(decisionId) => (BPMN_XML.includes(decisionId) ? DMN_XML : null),
		)

		console.log("finalVariables:", JSON.stringify(result.finalVariables, null, 2))
		console.log("visitedElements:", result.visitedElements)
		console.log("feelEvals:", JSON.stringify(result.feelEvals, null, 2))
		console.log("errors:", result.errors)

		expect(result.errors).toHaveLength(0)
		expect(result.finalVariables).toHaveProperty("validationErrors")
	})

	it("captures FEEL evaluations from the gateway", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s2",
				name: "Valid amount",
				inputs: { amount: 100 },
			},
			(decisionId) => (BPMN_XML.includes(decisionId) ? DMN_XML : null),
		)

		console.log("feelEvals:", JSON.stringify(result.feelEvals, null, 2))
		console.log("finalVariables:", JSON.stringify(result.finalVariables, null, 2))
		console.log("visitedElements:", result.visitedElements)
		console.log("errors:", result.errors)

		expect(result.feelEvals.length).toBeGreaterThan(0)
	})
})

const SERVICE_TASK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
                  id="Definitions_2" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="job-process" isExecutable="true">
    <bpmn:startEvent id="s"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="t">
      <bpmn:extensionElements><zeebe:taskDefinition type="work"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="e"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="t"/>
    <bpmn:sequenceFlow id="f2" sourceRef="t" targetRef="e"/>
  </bpmn:process>
</bpmn:definitions>`

describe("runScenarioWasm — job outputs", () => {
	it("merges a mocked job's outputs into the process without output mappings", async () => {
		const result = await runScenarioWasm(SERVICE_TASK_XML, {
			id: "s2",
			name: "Job outputs",
			inputs: { a: 1 },
			mocks: { work: { outputs: { out: 42 } } },
			expect: { variables: { out: 42 } },
		})
		expect(result.errors).toEqual([])
		expect(result.finalVariables).toMatchObject({ a: 1, out: 42 })
		expect(result.passed).toBe(true)
	})
})
