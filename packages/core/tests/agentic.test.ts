import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, buildAiAgentSubProcess, resetIdCounter } from "../src/index.js"

describe("buildAiAgentSubProcess", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("throws when no tools are given", () => {
		expect(() =>
			buildAiAgentSubProcess({
				id: "agent",
				model: { provider: "anthropic", inputs: {} },
				systemPrompt: "You are helpful.",
				userPrompt: "=userMessage",
				tools: [],
			}),
		).toThrow(/at least one tool/)
	})

	it("throws on duplicate tool ids", () => {
		expect(() =>
			buildAiAgentSubProcess({
				id: "agent",
				model: { provider: "anthropic", inputs: {} },
				systemPrompt: "You are helpful.",
				userPrompt: "=userMessage",
				tools: [
					{
						id: "search",
						description: "Search",
						serviceTask: { name: "Search", taskType: "http:1" },
					},
					{
						id: "search",
						description: "Search again",
						serviceTask: { name: "S2", taskType: "http:1" },
					},
				],
			}),
		).toThrow(/duplicate tool id/)
	})

	it("builds a deployable ad-hoc sub-process with root-node tools, fromAi params, and provider bindings", () => {
		const agent = buildAiAgentSubProcess({
			id: "agent",
			name: "Support Triage Agent",
			model: {
				provider: "anthropic",
				inputs: {
					"provider.anthropic.model.model": "claude-sonnet-5",
					"provider.anthropic.authentication.apiKey": "{{secrets.ANTHROPIC_API_KEY}}",
				},
			},
			systemPrompt: "You triage customer support requests.",
			userPrompt: "=requestText",
			maxModelCalls: 5,
			tools: [
				{
					id: "notify_slack",
					description: "Posts a message to the #ops Slack channel.",
					serviceTask: {
						name: "Notify #ops",
						taskType: "io.camunda:slack:1",
						ioMapping: { inputs: [{ source: "chat.postMessage", target: "method" }] },
					},
					params: [
						{
							name: "message",
							description: "The message text.",
							type: "string",
							target: "data.text",
						},
						{
							name: "urgent",
							description: "Whether to flag as urgent.",
							type: "boolean",
							required: false,
							target: "data.urgent",
						},
					],
				},
				{
					id: "escalate_to_human",
					description: "Escalates the request to a human agent.",
					serviceTask: { name: "Escalate", taskType: "escalate:1" },
				},
			],
		})

		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.adHocSubProcess("agent", agent.content, agent.options)
			.endEvent("e")
			.build()

		const process = defs.processes[0]
		const el = process?.flowElements.find((n) => n.id === "agent")
		expect(el?.type).toBe("adHocSubProcess")
		if (el?.type !== "adHocSubProcess") throw new Error("expected adHocSubProcess")

		// Job-worker implementation: taskDefinition present on the ad-hoc sub-process itself.
		const taskDef = el.extensionElements.find((e) => e.name === "zeebe:taskDefinition")
		expect(taskDef?.attributes.type).toBe("io.camunda.agenticai:aiagent-job-worker:1")

		// Provider + prompt + limit bindings.
		const ioMapping = el.extensionElements.find((e) => e.name === "zeebe:ioMapping")
		const inputByTarget = Object.fromEntries(
			(ioMapping?.children ?? [])
				.filter((c) => c.name === "zeebe:input")
				.map((c) => [c.attributes.target, c.attributes.source]),
		)
		expect(inputByTarget["provider.type"]).toBe("anthropic")
		expect(inputByTarget["provider.anthropic.model.model"]).toBe("claude-sonnet-5")
		expect(inputByTarget["provider.anthropic.authentication.apiKey"]).toBe(
			"{{secrets.ANTHROPIC_API_KEY}}",
		)
		expect(inputByTarget["data.systemPrompt.prompt"]).toBe("You triage customer support requests.")
		expect(inputByTarget["data.userPrompt.prompt"]).toBe("=requestText")
		expect(inputByTarget["data.memory.storage.type"]).toBe("in-process")
		expect(inputByTarget["data.limits.maxModelCalls"]).toBe("5")

		// Output aggregation.
		const adHoc = el.extensionElements.find((e) => e.name === "zeebe:adHoc")
		expect(adHoc?.attributes.outputCollection).toBe("toolCallResults")
		expect(adHoc?.attributes.outputElement).toContain("toolCall._meta.id")

		// Tools: root nodes with no incoming/outgoing sequence flows.
		expect(el.flowElements).toHaveLength(2)
		expect(el.sequenceFlows).toHaveLength(0)
		const slackTool = el.flowElements.find((n) => n.id === "notify_slack")
		expect(slackTool?.documentation).toBe("Posts a message to the #ops Slack channel.")
		expect(slackTool?.incoming).toHaveLength(0)

		const slackToolIo = slackTool?.extensionElements.find((e) => e.name === "zeebe:ioMapping")
		const slackInputs = Object.fromEntries(
			(slackToolIo?.children ?? [])
				.filter((c) => c.name === "zeebe:input")
				.map((c) => [c.attributes.target, c.attributes.source]),
		)
		expect(slackInputs.method).toBe("chat.postMessage")
		expect(slackInputs["data.text"]).toBe(
			'=fromAi(toolCall.message, "The message text.", "string")',
		)
		expect(slackInputs["data.urgent"]).toBe(
			'=fromAi(toolCall.urgent, "Whether to flag as urgent.", "boolean", null, { required: false })',
		)
		const slackOutputs = (slackToolIo?.children ?? []).filter((c) => c.name === "zeebe:output")
		expect(slackOutputs).toEqual([
			{
				name: "zeebe:output",
				attributes: { source: "=response", target: "toolCallResult" },
				children: [],
			},
		])

		// Full round-trip through export/parse produces valid, stable XML.
		const xml = Bpmn.export(defs)
		expect(xml).toContain("io.camunda.agenticai:aiagent-job-worker:1")
		const reparsed = Bpmn.parse(xml)
		const reagent = reparsed.processes[0]?.flowElements.find((n) => n.id === "agent")
		expect(reagent?.type).toBe("adHocSubProcess")
		if (reagent?.type === "adHocSubProcess") {
			expect(reagent.flowElements).toHaveLength(2)
		}
	})

	it("supports a completion condition and cancelRemainingInstances override", () => {
		const agent = buildAiAgentSubProcess({
			id: "agent",
			model: { provider: "openai", inputs: {} },
			systemPrompt: "Assist.",
			userPrompt: "=msg",
			completionCondition: "=agentDone = true",
			cancelRemainingInstances: false,
			tools: [
				{
					id: "noop",
					description: "Does nothing.",
					serviceTask: { name: "Noop", taskType: "noop:1" },
				},
			],
		})
		expect(agent.options.completionCondition).toBe("=agentDone = true")
		expect(agent.options.cancelRemainingInstances).toBe(false)
	})
})
