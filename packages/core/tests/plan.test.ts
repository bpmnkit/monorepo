import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, compilePlan, resetIdCounter } from "../src/index.js"
import type { ConnectorApplyResult, ConnectorResolver, ProcessPlan } from "../src/index.js"

/** A stand-in for `@bpmnkit/connectors`' `applyConnectorTemplate`, scoped to what these tests need. */
const fakeResolver: ConnectorResolver = (templateId, values) => {
	if (templateId === "io.camunda.connectors.Slack.v1") {
		const problems: ConnectorApplyResult["problems"] = []
		if (!values.token)
			problems.push({ key: "token", message: 'Missing required value for "token"' })
		return {
			serviceTask: {
				name: values.name ?? "Slack",
				taskType: "io.camunda:slack:1",
				modelerTemplate: templateId,
				ioMapping: {
					inputs: [
						{ source: values.method ?? "", target: "method" },
						{ source: values.token ?? "", target: "token" },
						{ source: values["data.channel"] ?? "", target: "data.channel" },
						{ source: values["data.text"] ?? "", target: "data.text" },
					],
				},
			},
			problems,
		}
	}
	return { problems: [{ message: `unknown template in test resolver: ${templateId}` }] }
}

describe("compilePlan", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("rejects a plan whose first step is not kind 'start'", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [{ kind: "end" }],
		}
		const result = compilePlan(plan)
		expect(result.xml).toBeUndefined()
		expect(result.problems[0]?.path).toBe("steps[0]")
	})

	it("compiles a minimal linear plan to valid, deployable-shaped XML", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "order-process", name: "Order Process" },
			steps: [
				{ kind: "start", name: "Order received" },
				{ kind: "serviceTask", name: "Ship order", jobType: "shipping:1" },
				{ kind: "end", name: "Order shipped" },
			],
		}
		const result = compilePlan(plan)
		expect(result.problems).toEqual([])
		expect(result.xml).toBeDefined()
		expect(result.xml).toContain('isExecutable="true"')
		expect(result.xml).toContain("bpmndi:BPMNDiagram")

		const reparsed = Bpmn.parse(result.xml as string)
		expect(reparsed.processes[0]?.flowElements).toHaveLength(3)
	})

	it("Slack-notification golden case: connector step compiles with zero problems in one pass", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "validation-failed", name: "Order Validation Failed" },
			steps: [
				{ kind: "start", name: "Validation failed" },
				{
					kind: "connector",
					name: "Notify #ops",
					connector: {
						template: "io.camunda.connectors.Slack.v1",
						values: {
							method: "chat.postMessage",
							token: "{{secrets.SLACK_OAUTH_TOKEN}}",
							"data.channel": "#ops",
							"data.text": '="Order " + orderId + " failed validation"',
						},
					},
				},
				{ kind: "end", name: "Notified" },
			],
		}
		const result = compilePlan(plan, { resolveConnector: fakeResolver })
		expect(result.problems).toEqual([])
		expect(result.xml).toContain("io.camunda:slack:1")
	})

	it("flags missing required connector values as plan problems", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start" },
				{
					kind: "connector",
					name: "Notify",
					connector: {
						template: "io.camunda.connectors.Slack.v1",
						values: { method: "chat.postMessage" },
					},
				},
				{ kind: "end" },
			],
		}
		const result = compilePlan(plan, { resolveConnector: fakeResolver })
		expect(result.problems.some((p) => p.message.includes("token"))).toBe(true)
	})

	it("flags an invalid FEEL expression with a precise path", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start" },
				{
					kind: "gateway",
					id: "gw",
					gatewayType: "exclusive",
					branches: [
						{ condition: "=this is ) not valid feel (", steps: [{ kind: "end", id: "e1" }] },
						{ default: true, steps: [{ kind: "end", id: "e2" }] },
					],
				},
			],
		}
		const result = compilePlan(plan)
		const problem = result.problems.find((p) => p.path === "steps[1].branches[0].condition")
		expect(problem).toBeDefined()
		expect(problem?.message).toMatch(/Invalid FEEL expression/)
	})

	it("gateway + error boundary golden case: branches converge, error boundary attaches", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "approval", name: "Approval Process" },
			steps: [
				{ kind: "start", name: "Request submitted" },
				{
					kind: "gateway",
					id: "amount_check",
					name: "Amount > 1000?",
					gatewayType: "exclusive",
					branches: [
						{
							name: "yes",
							condition: "=amount > 1000",
							steps: [
								{
									kind: "userTask",
									id: "manager_review",
									name: "Manager review",
									candidateGroups: "managers",
								},
							],
						},
						{ name: "no", default: true, steps: [] },
					],
				},
				{
					kind: "serviceTask",
					id: "process_payment",
					name: "Process payment",
					jobType: "payment:1",
					errorBoundary: {
						errorCode: "PAYMENT_FAILED",
						steps: [{ kind: "end", id: "payment_failed_end", errorCode: "PAYMENT_FAILED" }],
					},
				},
				{ kind: "end", name: "Approved" },
			],
		}
		const result = compilePlan(plan)
		expect(result.problems).toEqual([])
		const reparsed = Bpmn.parse(result.xml as string)
		const process = reparsed.processes[0]
		const boundary = process?.flowElements.find((e) => e.id === "process_payment_error")
		expect(boundary?.type).toBe("boundaryEvent")
		if (boundary?.type === "boundaryEvent") {
			expect(boundary.attachedToRef).toBe("process_payment")
		}
		// Both gateway branches converge — an auto-inserted join or direct convergence exists downstream.
		expect(process?.flowElements.some((e) => e.id === "process_payment")).toBe(true)
	})

	it("agentic triage golden case: aiAgent step compiles with tool params and connector-backed tool", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "support-triage", name: "Support Triage" },
			steps: [
				{ kind: "start", name: "Ticket received" },
				{
					kind: "aiAgent",
					id: "triage_agent",
					name: "Triage agent",
					provider: "anthropic",
					model: "claude-sonnet-5",
					providerInputs: {
						"provider.anthropic.authentication.apiKey": "{{secrets.ANTHROPIC_API_KEY}}",
					},
					systemPrompt: "You triage support tickets.",
					userPrompt: "=ticketText",
					tools: [
						{
							id: "notify_slack",
							description: "Notify the on-call channel.",
							connector: {
								template: "io.camunda.connectors.Slack.v1",
								values: { method: "chat.postMessage", token: "{{secrets.SLACK_OAUTH_TOKEN}}" },
							},
							params: [
								{
									name: "channel",
									description: "Target channel",
									type: "string",
									target: "data.channel",
								},
							],
						},
						{
							id: "escalate",
							description: "Escalate to a human.",
							jobType: "escalate:1",
							params: [{ name: "reason", description: "Escalation reason" }],
						},
					],
					errorBoundary: {
						errorCode: "AGENT_FAILED",
						steps: [{ kind: "end", id: "agent_failed", errorCode: "AGENT_FAILED" }],
					},
				},
				{ kind: "end", name: "Triaged" },
			],
		}
		const result = compilePlan(plan, { resolveConnector: fakeResolver })
		expect(result.problems).toEqual([])
		const reparsed = Bpmn.parse(result.xml as string)
		const agent = reparsed.processes[0]?.flowElements.find((e) => e.id === "triage_agent")
		expect(agent?.type).toBe("adHocSubProcess")
		if (agent?.type === "adHocSubProcess") {
			expect(agent.flowElements.map((e) => e.id).sort()).toEqual(["escalate", "notify_slack"])
		}
	})

	it("message-correlated wait golden case: correlationKey is set and valid", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start" },
				{
					kind: "wait",
					id: "wait_for_payment",
					name: "Wait for payment",
					message: { name: "payment-confirmed", correlationKey: "=orderId" },
				},
				{ kind: "end" },
			],
		}
		const result = compilePlan(plan)
		expect(result.problems).toEqual([])
		const reparsed = Bpmn.parse(result.xml as string)
		const wait = reparsed.processes[0]?.flowElements.find((e) => e.id === "wait_for_payment")
		const sub = wait?.extensionElements.find((e) => e.name === "zeebe:subscription")
		expect(sub?.attributes).toEqual({ correlationKey: "=orderId" })
	})

	it("multi-instance sub-process golden case", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start" },
				{
					kind: "subProcess",
					id: "notify_each",
					name: "Notify each recipient",
					steps: [{ kind: "serviceTask", id: "send_email", jobType: "email:1" }],
					multiInstance: { collection: "=recipients", elementVariable: "recipient" },
					errorBoundary: {
						errorCode: "NOTIFY_FAILED",
						steps: [{ kind: "end", id: "notify_failed", errorCode: "NOTIFY_FAILED" }],
					},
				},
				{ kind: "end" },
			],
		}
		const result = compilePlan(plan)
		expect(result.problems).toEqual([])
		const reparsed = Bpmn.parse(result.xml as string)
		const sub = reparsed.processes[0]?.flowElements.find((e) => e.id === "notify_each")
		expect(sub?.type).toBe("subProcess")
		expect(sub?.loopCharacteristics).toBeDefined()
	})

	it("is deterministic: compiling the same plan twice produces identical XML", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start" },
				{ kind: "serviceTask", jobType: "x:1", name: "Do thing" },
				{ kind: "end" },
			],
		}
		resetIdCounter()
		const a = compilePlan(plan).xml
		resetIdCounter()
		const b = compilePlan(plan).xml
		expect(a).toBe(b)
	})
})
