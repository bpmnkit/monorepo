/**
 * End-to-end scenario runner tests using the same import path as apps/studio.
 * Imports from @bpmnkit/engine/wasm-runner (the built dist), not from source.
 *
 * Suite 1 — synthetic fixtures (self-contained, fast)
 *   BPMN: Start → BusinessRuleTask (DMN: validate-order → validationErrors)
 *         → ExclusiveGateway → End_OK (if no errors) or End_ERR (if errors)
 *   DMN:  amount < 0 → error = "Amount must be positive" (COLLECT hit policy)
 *
 * Suite 2 — webhook-call process (inlined from test.bpmn + dmn.dmn)
 *   BPMN: Start → BusinessRuleTask (DMN: StartEvent_webhook-call_inputValidation → validationErrors)
 *         → Gateway (default=error end) → service task → timer → end
 *   DMN:  validates `asd` (string, required) and `sss` (number, 1–12, required)
 */
import { runScenarioWasm } from "@bpmnkit/engine/wasm-runner"
import { describe, expect, it } from "vitest"

// ── Fixtures ──────────────────────────────────────────────────────────────────

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

/** Resolves the DMN for the decision referenced in the BPMN. */
function getDmn(decisionId: string): string | null {
	return decisionId === "validate-order" ? DMN_XML : null
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("scenario runner — DMN business rule task + exclusive gateway", () => {
	it("invalid amount: DMN result variable appears in finalVariables", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{ id: "s1", name: "Invalid amount", inputs: { amount: -5 } },
			getDmn,
		)

		// No errors or failures
		expect(result.errors, `errors: ${JSON.stringify(result.errors)}`).toHaveLength(0)
		expect(result.failures, `failures: ${JSON.stringify(result.failures)}`).toHaveLength(0)
		expect(result.passed).toBe(true)

		// DMN result variable must be present
		expect(
			result.finalVariables,
			`finalVariables: ${JSON.stringify(result.finalVariables)}`,
		).toHaveProperty("validationErrors")

		// DMN collected one error entry
		expect(result.finalVariables.validationErrors).toEqual(["Amount must be positive"])

		// Input variable preserved
		expect(result.finalVariables.amount).toBe(-5)
	})

	it("invalid amount: process takes the error path (End_ERR)", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s2",
				name: "Invalid amount path",
				inputs: { amount: -5 },
				expect: { path: ["Start_1", "BRT_1", "GW_1", "End_ERR"] },
			},
			getDmn,
		)

		expect(result.errors).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
		expect(result.visitedElements).toContain("End_ERR")
		expect(result.visitedElements).not.toContain("End_OK")
	})

	it("invalid amount: FEEL condition for error path is captured", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{ id: "s3", name: "Invalid amount FEEL", inputs: { amount: -5 } },
			getDmn,
		)

		expect(result.feelEvals, `feelEvals: ${JSON.stringify(result.feelEvals)}`).toHaveLength(1)

		const eval0 = result.feelEvals[0]
		expect(eval0).toBeDefined()
		// Must come from the gateway, not from a plain sequence flow
		expect(eval0?.elementId).toBe("GW_1")
		expect(eval0?.property).toBe("condition")
		// The error-path condition was taken
		expect(eval0?.expression).toContain("validationErrors != null")
		expect(eval0?.result).toBe(true)
	})

	it("valid amount: no DMN errors, process takes the OK path", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s4",
				name: "Valid amount",
				inputs: { amount: 100 },
				expect: { path: ["Start_1", "BRT_1", "GW_1", "End_OK"] },
			},
			getDmn,
		)

		expect(result.errors).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
		expect(result.visitedElements).toContain("End_OK")
		expect(result.visitedElements).not.toContain("End_ERR")

		// DMN result variable exists but is empty (no rules fired)
		expect(result.finalVariables).toHaveProperty("validationErrors")
		expect(result.finalVariables.validationErrors).toEqual([])
	})

	it("valid amount: FEEL condition for OK path is captured", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{ id: "s5", name: "Valid amount FEEL", inputs: { amount: 100 } },
			getDmn,
		)

		expect(result.feelEvals).toHaveLength(1)

		const eval0 = result.feelEvals[0]
		expect(eval0?.elementId).toBe("GW_1")
		expect(eval0?.property).toBe("condition")
		expect(eval0?.expression).toContain("validationErrors = null or count(validationErrors) = 0")
		expect(eval0?.result).toBe(true)
	})

	it("variable assertions pass when values match", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s6",
				name: "Variable assertion",
				inputs: { amount: -5 },
				expect: {
					variables: { validationErrors: ["Amount must be positive"] },
				},
			},
			getDmn,
		)

		expect(result.failures).toHaveLength(0)
		expect(result.passed).toBe(true)
	})

	it("variable assertions fail when values mismatch", async () => {
		const result = await runScenarioWasm(
			BPMN_XML,
			{
				id: "s7",
				name: "Variable mismatch",
				inputs: { amount: -5 },
				expect: {
					variables: { validationErrors: [] },
				},
			},
			getDmn,
		)

		expect(result.passed).toBe(false)
		expect(result.failures).toHaveLength(1)
		expect(result.failures[0]?.field).toBe("variables.validationErrors")
	})
})

// ── Suite 2: real files (test.bpmn + dmn.dmn) ────────────────────────────────

const REAL_BPMN = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="Definitions_webhook-call" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:error id="Error_tONEiTac" name="VALIDATION_FAILED" errorCode="VALIDATION_FAILED"/>
  <bpmn:error id="Error_5tm7CQPQ" name="VALIDATION_FAILED" errorCode="VALIDATION_FAILED"/>
  <bpmn:process id="webhook-call" name="webhook call" isExecutable="true">
    <bpmn:startEvent id="StartEvent_webhook-call" name="">
      <bpmn:outgoing>Flow_N5WaR3Re</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="serviceTask_zu501th" name="webhook.site">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="io.camunda:http-json:1"/>
        <zeebe:ioMapping>
          <zeebe:input source="noAuth" target="authentication.type"/>
          <zeebe:input source="get" target="method"/>
          <zeebe:input source="https://webhook.site/b130c815-ca1d-4acf-9b1f-4ee9ddb46e28" target="url"/>
          <zeebe:input source="basicAuthHeader" target="authentication.clientAuthentication"/>
          <zeebe:input source="20" target="connectionTimeoutInSeconds"/>
        </zeebe:ioMapping>
        <zeebe:taskHeaders>
          <zeebe:header key="resultExpression" value="={\\"mytest\\": true}"/>
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_pfu9qcs</bpmn:incoming>
      <bpmn:outgoing>Flow_2b3k22u</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="endEvent_qcppg7o">
      <bpmn:incoming>Flow_mamqlb4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:intermediateCatchEvent id="messageCatchEvent_po6kuv5" name="">
      <bpmn:incoming>Flow_2b3k22u</bpmn:incoming>
      <bpmn:outgoing>Flow_mamqlb4</bpmn:outgoing>
      <bpmn:timerEventDefinition>
        <bpmn:timeDuration>PT15S</bpmn:timeDuration>
      </bpmn:timerEventDefinition>
    </bpmn:intermediateCatchEvent>
    <bpmn:businessRuleTask id="Activity_u72oalRR" name="Validate Input">
      <bpmn:extensionElements>
        <zeebe:calledDecision decisionId="StartEvent_webhook-call_inputValidation" resultVariable="validationErrors"/>
      </bpmn:extensionElements>
      <bpmn:incoming>Flow_N5WaR3Re</bpmn:incoming>
      <bpmn:outgoing>Flow_uiSCZwWx</bpmn:outgoing>
    </bpmn:businessRuleTask>
    <bpmn:exclusiveGateway id="Gateway_FfzaKwa9" name="Input valid?" default="Flow_vOWQuhs8">
      <bpmn:incoming>Flow_uiSCZwWx</bpmn:incoming>
      <bpmn:outgoing>Flow_pfu9qcs</bpmn:outgoing>
      <bpmn:outgoing>Flow_vOWQuhs8</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:endEvent id="Event_eReDBgY3" name="Invalid Input">
      <bpmn:incoming>Flow_vOWQuhs8</bpmn:incoming>
      <bpmn:errorEventDefinition errorRef="Error_5tm7CQPQ"/>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_2b3k22u" sourceRef="serviceTask_zu501th" targetRef="messageCatchEvent_po6kuv5"/>
    <bpmn:sequenceFlow id="Flow_mamqlb4" sourceRef="messageCatchEvent_po6kuv5" targetRef="endEvent_qcppg7o"/>
    <bpmn:sequenceFlow id="Flow_pfu9qcs" sourceRef="Gateway_FfzaKwa9" targetRef="serviceTask_zu501th">
      <bpmn:conditionExpression>= count(validationErrors) = 0</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="Flow_N5WaR3Re" sourceRef="StartEvent_webhook-call" targetRef="Activity_u72oalRR"/>
    <bpmn:sequenceFlow id="Flow_uiSCZwWx" sourceRef="Activity_u72oalRR" targetRef="Gateway_FfzaKwa9"/>
    <bpmn:sequenceFlow id="Flow_vOWQuhs8" sourceRef="Gateway_FfzaKwa9" targetRef="Event_eReDBgY3"/>
  </bpmn:process>
</bpmn:definitions>`

const REAL_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_XDtK7Y3g" name="DRD" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="StartEvent_webhook-call_inputValidation" name="Input Validation">
    <decisionTable id="DecisionTable_6qHdqreS" hitPolicy="COLLECT">
      <input id="Input_msMzUkR9" label="asd">
        <inputExpression id="InputExpression_CfeRNVex">
          <text>asd</text>
        </inputExpression>
      </input>
      <input id="Input_sU4qCTdq" label="sss">
        <inputExpression id="InputExpression_xTskM4TK">
          <text>sss</text>
        </inputExpression>
      </input>
      <output id="Output_yndz1jsC" label="Error" name="error" typeRef="string"/>
      <rule id="DecisionRule_c9gRACEM">
        <inputEntry id="UnaryTests_FT0B7jI6"><text>null</text></inputEntry>
        <inputEntry id="UnaryTests_hON5Hi61"><text></text></inputEntry>
        <outputEntry id="LiteralExpression_6NszA3zV"><text>"asd is required"</text></outputEntry>
      </rule>
      <rule id="DecisionRule_dBdGcZjc">
        <inputEntry id="UnaryTests_Ww3xWdsO"><text>not(instance of string)</text></inputEntry>
        <inputEntry id="UnaryTests_epJa7bBY"><text></text></inputEntry>
        <outputEntry id="LiteralExpression_defNpDrj"><text>"asd must be a string"</text></outputEntry>
      </rule>
      <rule id="DecisionRule_MkGkwDKy">
        <inputEntry id="UnaryTests_16En3NuF"><text></text></inputEntry>
        <inputEntry id="UnaryTests_XIlGDROi"><text>null</text></inputEntry>
        <outputEntry id="LiteralExpression_ucrDfUFz"><text>"sss is required"</text></outputEntry>
      </rule>
      <rule id="DecisionRule_DVKTXS7S">
        <inputEntry id="UnaryTests_PvKFMJM7"><text></text></inputEntry>
        <inputEntry id="UnaryTests_3UAZFh97"><text>not(instance of number)</text></inputEntry>
        <outputEntry id="LiteralExpression_GxdBp4M2"><text>"sss must be a number"</text></outputEntry>
      </rule>
      <rule id="DecisionRule_Oz8O7LbA">
        <inputEntry id="UnaryTests_43dVhsnH"><text></text></inputEntry>
        <inputEntry id="UnaryTests_gXjDgK6F"><text>&lt; 1</text></inputEntry>
        <outputEntry id="LiteralExpression_ENeJWDv2"><text>"sss must be &gt;= 1"</text></outputEntry>
      </rule>
      <rule id="DecisionRule_CtcDTOBG">
        <inputEntry id="UnaryTests_mIqjaOH3"><text></text></inputEntry>
        <inputEntry id="UnaryTests_nrNmswzy"><text>&gt; 12</text></inputEntry>
        <outputEntry id="LiteralExpression_iYYed7zJ"><text>"sss must be &lt;= 12"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`

// Decision ID referenced in test.bpmn via calledDecision
const REAL_DECISION_ID = "StartEvent_webhook-call_inputValidation"

function getRealDmn(decisionId: string): string | null {
	return decisionId === REAL_DECISION_ID ? REAL_DMN : null
}

// The service task type used in the BPMN
const HTTP_JOB_TYPE = "io.camunda:http-json:1"

describe("scenario runner — webhook-call process + input validation DMN", () => {
	// ── Working DMN rules (equality / range checks) ──────────────────────────

	it("asd missing, sss valid: DMN fires 'asd is required', process takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r1",
				name: "asd missing",
				inputs: { sss: 5 },
				expect: {
					path: [
						"StartEvent_webhook-call",
						"Activity_u72oalRR",
						"Gateway_FfzaKwa9",
						"Event_eReDBgY3",
					],
					variables: { validationErrors: ["asd is required"] },
				},
			},
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.failures).toHaveLength(0)
		expect(result.passed).toBe(false)
		expect(result.finalVariables.validationErrors).toEqual(["asd is required"])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
		expect(result.visitedElements).not.toContain("serviceTask_zu501th")
	})

	it("sss too low (0): DMN fires 'sss must be >= 1', process takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r2",
				name: "sss too low",
				inputs: { asd: "hello", sss: 0 },
				expect: { variables: { validationErrors: ["sss must be >= 1"] } },
			},
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.failures).toHaveLength(0)
		expect(result.finalVariables.validationErrors).toEqual(["sss must be >= 1"])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
	})

	it("sss too high (13): DMN fires 'sss must be <= 12', process takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r3",
				name: "sss too high",
				inputs: { asd: "hello", sss: 13 },
				expect: { variables: { validationErrors: ["sss must be <= 12"] } },
			},
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.failures).toHaveLength(0)
		expect(result.finalVariables.validationErrors).toEqual(["sss must be <= 12"])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
	})

	// ── Cases where WASM DMN returns no result (post-hoc FEEL evaluation runs) ──
	// When WASM's DMN produces no variable (null result, no VARIABLE event emitted),
	// the runner falls back to the FEEL engine for post-hoc BRT evaluation.

	it("both fields missing: FEEL fires all matching rules, gateway takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{ id: "r4", name: "Both fields missing", inputs: {} },
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.finalVariables.validationErrors).toEqual([
			"asd is required",
			"asd must be a string",
			"sss is required",
			"sss must be a number",
		])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
		expect(result.visitedElements).not.toContain("serviceTask_zu501th")
	})

	it("sss missing, asd valid: FEEL fires sss-null and sss-type rules, gateway takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{ id: "r5", name: "sss missing", inputs: { asd: "hello" } },
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.finalVariables.validationErrors).toEqual([
			"sss is required",
			"sss must be a number",
		])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
	})

	it("asd wrong type (number): WASM returns [], gateway takes happy path", async () => {
		// WASM DMN captures validationErrors=[] so post-hoc FEEL is skipped
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r6",
				name: "asd wrong type (number)",
				inputs: { asd: 42, sss: 5 },
				mocks: { [HTTP_JOB_TYPE]: { outputs: {} } },
			},
			getRealDmn,
		)

		expect(result.errors).toHaveLength(0)
		expect(result.finalVariables.validationErrors).toEqual([])
		// Happy path taken because validationErrors is empty
		expect(result.visitedElements).toContain("serviceTask_zu501th")
	})

	it("sss wrong type (string): FEEL fires not(instance of number), gateway takes error end", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{ id: "r7", name: "sss wrong type (string)", inputs: { asd: "hello", sss: "oops" } },
			getRealDmn,
		)

		// Zeebe raises an incident for an error end event nothing catches, and so does Reebe.
		expect(result.errors).toEqual([
			{
				elementId: "Event_eReDBgY3",
				message: expect.stringContaining("'VALIDATION_FAILED', but it was not caught"),
			},
		])
		expect(result.finalVariables.validationErrors).toEqual(["sss must be a number"])
		expect(result.visitedElements).toContain("Event_eReDBgY3")
	})

	// ── Happy path ────────────────────────────────────────────────────────────

	it("valid input: DMN returns [], gateway takes happy path, service task is reached", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r8",
				name: "Valid input",
				inputs: { asd: "hello", sss: 5 },
				mocks: { [HTTP_JOB_TYPE]: { outputs: { response: { status: 200, body: {} } } } },
				expect: {
					path: [
						"StartEvent_webhook-call",
						"Activity_u72oalRR",
						"Gateway_FfzaKwa9",
						"serviceTask_zu501th",
					],
					variables: { validationErrors: [] },
				},
			},
			getRealDmn,
		)

		expect(result.errors).toHaveLength(0)
		expect(result.failures).toHaveLength(0)
		expect(result.passed).toBe(true)
		expect(result.finalVariables.validationErrors).toEqual([])
		expect(result.visitedElements).toContain("serviceTask_zu501th")
		expect(result.visitedElements).not.toContain("Event_eReDBgY3")
	})

	it("valid input: FEEL condition on gateway happy-path flow is captured", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r9",
				name: "Valid input FEEL",
				inputs: { asd: "hello", sss: 5 },
				mocks: { [HTTP_JOB_TYPE]: { outputs: {} } },
			},
			getRealDmn,
		)

		expect(result.feelEvals.length).toBeGreaterThan(0)

		const gatewayEval = result.feelEvals.find((e) => e.elementId === "Gateway_FfzaKwa9")
		expect(gatewayEval).toBeDefined()
		expect(gatewayEval?.property).toBe("condition")
		expect(gatewayEval?.expression).toContain("count(validationErrors) = 0")
		expect(gatewayEval?.result).toBe(true)
	})

	it("invalid input: default gateway flow has no conditionExpression, so feelEvals is empty", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{ id: "r10", name: "No FEEL for default flow", inputs: { sss: 5 } },
			getRealDmn,
		)

		expect(result.feelEvals).toHaveLength(0)
		expect(result.visitedElements).toContain("Event_eReDBgY3")
	})

	it("valid input: variable assertion on validationErrors passes", async () => {
		const result = await runScenarioWasm(
			REAL_BPMN,
			{
				id: "r11",
				name: "Assert empty validationErrors",
				inputs: { asd: "hello", sss: 6 },
				mocks: { [HTTP_JOB_TYPE]: { outputs: {} } },
				expect: { variables: { validationErrors: [] } },
			},
			getRealDmn,
		)

		expect(result.failures).toHaveLength(0)
		expect(result.passed).toBe(true)
	})
})
