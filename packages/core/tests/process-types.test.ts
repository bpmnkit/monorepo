import ts from "typescript"
import { describe, expect, it } from "vitest"
import { Bpmn, extractProcessContract, generateProcessTypes } from "../src/index.js"

const NS = `xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"`

/** Order fulfilment: io mappings, headers, an error boundary, messages, signal, escalation. */
const ORDER = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="D1" targetNamespace="x">
  <bpmn:error id="Err_Declined" name="Declined" errorCode="PAYMENT_DECLINED" />
  <bpmn:error id="Err_Stock" errorCode="OUT_OF_STOCK" />
  <bpmn:escalation id="Esc_Late" escalationCode="LATE" />
  <bpmn:signal id="Sig_Cancel" name="cancel-all" />
  <bpmn:message id="Msg_Paid" name="payment-received">
    <bpmn:extensionElements><zeebe:subscription correlationKey="=orderId" /></bpmn:extensionElements>
  </bpmn:message>
  <bpmn:message id="Msg_Start" name="order-placed" />
  <bpmn:message id="Msg_Notify" name="notify-customer" />
  <bpmn:process id="order-process" isExecutable="true">
    <bpmn:startEvent id="Start"><bpmn:outgoing>f1</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="Msg_Start" />
    </bpmn:startEvent>
    <bpmn:serviceTask id="Charge"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="charge-card" />
        <zeebe:ioMapping>
          <zeebe:input source="=order.total" target="amount" />
          <zeebe:input source="=order.id" target="odd-key" />
          <zeebe:output source="=transactionId" target="txId" />
          <zeebe:output source="=if approved then receipt else null" target="receipt" />
          <zeebe:output source="=amount" target="chargedAmount" />
        </zeebe:ioMapping>
        <zeebe:taskHeaders>
          <zeebe:header key="provider" value="stripe" />
          <zeebe:header key="retry-policy" value="say &quot;hi&quot; */" />
        </zeebe:taskHeaders>
      </bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:boundaryEvent id="Declined" attachedToRef="Charge"><bpmn:outgoing>f9</bpmn:outgoing>
      <bpmn:errorEventDefinition errorRef="Err_Declined" />
    </bpmn:boundaryEvent>
    <bpmn:serviceTask id="Ship"><bpmn:incoming>f2</bpmn:incoming><bpmn:outgoing>f3</bpmn:outgoing>
      <bpmn:extensionElements><zeebe:taskDefinition type="ship-order" /></bpmn:extensionElements>
    </bpmn:serviceTask>
    <bpmn:exclusiveGateway id="Gw"><bpmn:incoming>f3</bpmn:incoming><bpmn:outgoing>f4</bpmn:outgoing><bpmn:outgoing>f5</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:sendTask id="Notify" messageRef="Msg_Notify"><bpmn:incoming>f4</bpmn:incoming><bpmn:outgoing>f6</bpmn:outgoing>
      <bpmn:extensionElements><zeebe:taskDefinition type="io.camunda:notify:1" /></bpmn:extensionElements>
    </bpmn:sendTask>
    <bpmn:intermediateCatchEvent id="WaitPaid"><bpmn:incoming>f6</bpmn:incoming><bpmn:outgoing>f7</bpmn:outgoing>
      <bpmn:messageEventDefinition messageRef="Msg_Paid" />
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateThrowEvent id="Late"><bpmn:incoming>f5</bpmn:incoming><bpmn:outgoing>f8</bpmn:outgoing>
      <bpmn:escalationEventDefinition escalationRef="Esc_Late" />
    </bpmn:intermediateThrowEvent>
    <bpmn:endEvent id="End"><bpmn:incoming>f7</bpmn:incoming><bpmn:incoming>f8</bpmn:incoming></bpmn:endEvent>
    <bpmn:endEvent id="EndCancel"><bpmn:incoming>f9</bpmn:incoming>
      <bpmn:signalEventDefinition signalRef="Sig_Cancel" />
    </bpmn:endEvent>
    <bpmn:userTask id="Review">
      <bpmn:extensionElements><zeebe:userTask /><zeebe:taskDefinition type="not-a-job" /></bpmn:extensionElements>
    </bpmn:userTask>
    <bpmn:sequenceFlow id="f1" sourceRef="Start" targetRef="Charge" />
    <bpmn:sequenceFlow id="f2" sourceRef="Charge" targetRef="Ship" />
    <bpmn:sequenceFlow id="f3" sourceRef="Ship" targetRef="Gw" />
    <bpmn:sequenceFlow id="f4" sourceRef="Gw" targetRef="Notify"><bpmn:conditionExpression>=trackingNumber != null</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f5" sourceRef="Gw" targetRef="Late"><bpmn:conditionExpression>=delayed and txId != null</bpmn:conditionExpression></bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="f6" sourceRef="Notify" targetRef="WaitPaid" />
    <bpmn:sequenceFlow id="f7" sourceRef="WaitPaid" targetRef="End" />
    <bpmn:sequenceFlow id="f8" sourceRef="Late" targetRef="End" />
    <bpmn:sequenceFlow id="f9" sourceRef="Declined" targetRef="EndCancel" />
  </bpmn:process>
  <bpmn:process id="sketch" isExecutable="false">
    <bpmn:serviceTask id="Ignored"><bpmn:extensionElements><zeebe:taskDefinition type="never-typed" /></bpmn:extensionElements></bpmn:serviceTask>
  </bpmn:process>
</bpmn:definitions>`

/** A second file: colliding job type names, a shared job type, sub-process scopes, an AI agent. */
const RETURNS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions ${NS} id="D2" targetNamespace="x">
  <bpmn:error id="Err_Any" name="anything" />
  <bpmn:process id="returns" isExecutable="true">
    <bpmn:serviceTask id="ShipA"><bpmn:extensionElements>
      <zeebe:taskDefinition type="ship_order" />
    </bpmn:extensionElements></bpmn:serviceTask>
    <bpmn:serviceTask id="ShipAgain"><bpmn:extensionElements>
      <zeebe:taskDefinition type="ship-order" />
      <zeebe:ioMapping><zeebe:input source="=1" target="parcel" /></zeebe:ioMapping>
      <zeebe:taskHeaders><zeebe:header key="carrier" value="dhl" /></zeebe:taskHeaders>
    </bpmn:extensionElements></bpmn:serviceTask>
    <bpmn:subProcess id="Sub">
      <bpmn:serviceTask id="Inner"><bpmn:extensionElements>
        <zeebe:taskDefinition type="1st step" />
      </bpmn:extensionElements></bpmn:serviceTask>
      <bpmn:serviceTask id="Dyn"><bpmn:extensionElements>
        <zeebe:taskDefinition type="=kind + &quot;-worker&quot;" />
      </bpmn:extensionElements></bpmn:serviceTask>
    </bpmn:subProcess>
    <bpmn:boundaryEvent id="SubErr" attachedToRef="Sub">
      <bpmn:errorEventDefinition errorRef="Err_Any" />
    </bpmn:boundaryEvent>
    <bpmn:adHocSubProcess id="Agent">
      <bpmn:extensionElements><zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1" /></bpmn:extensionElements>
    </bpmn:adHocSubProcess>
  </bpmn:process>
</bpmn:definitions>`

const order = Bpmn.parse(ORDER)
const returns = Bpmn.parse(RETURNS)

describe("extractProcessContract", () => {
	const contract = extractProcessContract([order, returns])
	const job = (type: string) => {
		const found = contract.jobs.find((j) => j.type === type)
		if (!found) throw new Error(`no job ${type}`)
		return found
	}

	it("lists executable processes only, sorted", () => {
		expect(contract.processIds).toEqual(["order-process", "returns"])
		expect(contract.jobs.map((j) => j.type)).not.toContain("never-typed")
	})

	it("excludes user tasks and dynamic job types, and records the dynamic ones", () => {
		expect(contract.jobs.map((j) => j.type)).toEqual([
			"1st step",
			"charge-card",
			"io.camunda.agenticai:aiagent-job-worker:1",
			"io.camunda:notify:1",
			"ship-order",
			"ship_order",
		])
		expect(contract.dynamicJobTypes.map((r) => r.elementId)).toEqual(["Dyn"])
	})

	it("takes input mapping targets as required variables", () => {
		expect(job("charge-card").variables).toEqual([
			{ name: "amount", required: true },
			{ name: "odd-key", required: true },
		])
	})

	it("takes output sources as the worker's output, minus its own inputs", () => {
		// `=transactionId` is a plain reference, so required; the `if` is not guaranteed;
		// `=amount` reads the element's own input, which the worker does not supply.
		expect(job("charge-card").output).toEqual([
			{ name: "approved", required: false },
			{ name: "receipt", required: false },
			{ name: "transactionId", required: true },
		])
	})

	it("falls back to variable flow for a job with no mappings", () => {
		const ship = job("ship-order")
		// Upstream scope on the incoming flow (produced by Charge) — optional.
		expect(ship.variables.find((v) => v.name === "txId")).toEqual({
			name: "txId",
			required: false,
		})
		// Charge's input targets are local to Charge, so they never reach Ship.
		expect(ship.variables.map((v) => v.name)).not.toContain("amount")
		// What downstream reads and nothing sets.
		expect(ship.output).toEqual([
			{ name: "delayed", required: false },
			{ name: "trackingNumber", required: false },
		])
	})

	it("merges elements sharing a job type — a key is required only when every element has it", () => {
		const ship = job("ship-order")
		expect(ship.elements.map((e) => `${e.processId}#${e.elementId}`)).toEqual([
			"order-process#Ship",
			"returns#ShipAgain",
		])
		expect(ship.variables.find((v) => v.name === "parcel")).toEqual({
			name: "parcel",
			required: false,
		})
		expect(ship.headers).toEqual([{ key: "carrier", values: ["dhl"], required: false }])
	})

	it("reads task headers with their literal values", () => {
		expect(job("charge-card").headers).toEqual([
			{ key: "provider", values: ["stripe"], required: true },
			{ key: "retry-policy", values: ['say "hi" */'], required: true },
		])
	})

	it("types throwable errors from boundary events on the element and its scopes", () => {
		expect(job("charge-card").errors).toEqual(["PAYMENT_DECLINED"])
		expect(job("ship-order").errors).toEqual([])
		// The sub-process boundary references an error with no code: a catch-all.
		expect(job("1st step").errors).toBe("any")
	})

	it("collects messages with correlation keys, signals, errors and escalations", () => {
		expect(contract.messages.map((m) => [m.name, m.correlationKeys])).toEqual([
			["notify-customer", []],
			["order-placed", []],
			["payment-received", ["=orderId"]],
		])
		expect(contract.signals.map((s) => s.code)).toEqual(["cancel-all"])
		expect(contract.errors.map((e) => e.code)).toEqual(["PAYMENT_DECLINED"])
		expect(contract.escalations.map((e) => e.code)).toEqual(["LATE"])
	})
})

describe("generateProcessTypes", () => {
	const source = generateProcessTypes([order, returns])

	it("starts with the do-not-edit header", () => {
		expect(source.split("\n")[0]).toBe("// generated by casen gen types — do not edit")
	})

	it("is deterministic regardless of input order", () => {
		expect(generateProcessTypes([returns, order])).toBe(source)
	})

	it("gives colliding job types distinct names", () => {
		expect(source).toContain("export interface ShipOrderVariables")
		expect(source).toContain("export interface ShipOrder2Variables")
		expect(source).toContain("export interface Job1stStepVariables")
	})

	it("quotes odd keys and escapes comment terminators", () => {
		expect(source).toContain('\t"odd-key": unknown')
		expect(source).toContain('readonly "retry-policy": "say \\"hi\\" */"')
		expect(source).not.toMatch(/\/\*\*[^\n]*\*\/[^\n]*\*\//)
	})

	it("documents correlation keys", () => {
		expect(source).toContain("Correlation key: =orderId")
		expect(source).toContain('"payment-received": { correlationKey: "=orderId" }')
	})

	it("compiles, and rejects typos in keys, job types and codes", () => {
		const consumer = `
declare const vars: JobTypes["charge-card"]["variables"]
const amount: unknown = vars.amount
// @ts-expect-error — typo in a variable name
vars.amont
const out: JobTypes["charge-card"]["output"] = { transactionId: "t1" }
// @ts-expect-error — required output missing
const missing: JobTypes["charge-card"]["output"] = { approved: true }
const code: JobTypes["charge-card"]["errors"] = "PAYMENT_DECLINED"
// @ts-expect-error — not a code any catch event handles
const badCode: JobTypes["charge-card"]["errors"] = "PAYMENT_DECLIND"
const anyCode: JobTypes["1st step"]["errors"] = "whatever"
const provider: "stripe" = ({} as JobTypes["charge-card"]["headers"]).provider
// @ts-expect-error — unknown job type
type Nope = JobTypes["charge-crad"]
const t: JobType = "ship_order"
const m: MessageName = "payment-received"
const e: ErrorCode = "PAYMENT_DECLINED"
const p: ProcessId = "returns"
export { amount, out, missing, code, badCode, anyCode, provider, t, m, e, p }
`
		expect(typeErrors(source + consumer)).toEqual([])
	})

	it("renders a model with nothing in it", () => {
		const empty = generateProcessTypes(
			Bpmn.parse(`<bpmn:definitions ${NS} id="D" targetNamespace="x" />`),
		)
		expect(empty).toContain("export type JobTypes = {}")
		expect(empty).toContain("export const jobTypes = [] as const")
		expect(typeErrors(empty)).toEqual([])
	})
})

/** Type-check one in-memory module under strict settings; returns the diagnostics as text. */
function typeErrors(source: string): string[] {
	const options: ts.CompilerOptions = {
		strict: true,
		noEmit: true,
		target: ts.ScriptTarget.ES2022,
		module: ts.ModuleKind.ESNext,
		types: [],
		lib: ["lib.es2022.d.ts"],
	}
	const file = "/virtual/generated.ts"
	const host = ts.createCompilerHost(options)
	const getSourceFile = host.getSourceFile.bind(host)
	host.getSourceFile = (name, version, ...rest) =>
		name === file
			? ts.createSourceFile(name, source, version)
			: getSourceFile(name, version, ...rest)
	const program = ts.createProgram([file], options, host)
	return ts
		.getPreEmitDiagnostics(program)
		.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n"))
}
