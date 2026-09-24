import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
	AI_AGENT_JOB_WORKER_TASK_TYPE,
	Bpmn,
	buildAiAgentSubProcess,
	resetIdCounter,
} from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Engine } from "../src/engine.js"
import "../src/testing/vitest.js"
import {
	createProcessTest,
	formatCoverage,
	parseAgentCassette,
	readAgentCassette,
	writeAgentCassette,
} from "../src/testing/index.js"
import type { AgentCassette, ProcessTest } from "../src/testing/index.js"
import type { Job } from "../src/types.js"

/** A support agent with three tools, then a gateway on its answer — like the ai-agent-tool-loop template. */
function supportProcess() {
	resetIdCounter()
	const agent = buildAiAgentSubProcess({
		id: "agent",
		model: { provider: "anthropic", inputs: {} },
		systemPrompt: "Help the customer.",
		userPrompt: "=message",
		maxModelCalls: 4,
		tools: [
			{
				id: "search-kb",
				description: "Search the help centre.",
				serviceTask: { name: "Search", taskType: "kb-search" },
				params: [{ name: "query", description: "Search terms", target: "query" }],
				resultSource: "=articles",
			},
			{
				id: "lookup-order",
				description: "Get an order.",
				serviceTask: { name: "Look up order", taskType: "order-lookup" },
				params: [
					{ name: "orderId", description: "The order number", target: "orderId" },
					{
						name: "includeItems",
						description: "Also list the items",
						type: "boolean",
						required: false,
						target: "includeItems",
					},
				],
				resultSource: "=order",
			},
			{
				id: "create-ticket",
				description: "Open a ticket for the warehouse.",
				serviceTask: { name: "Create ticket", taskType: "ticket-create" },
				params: [{ name: "summary", description: "The problem", target: "summary" }],
				resultSource: "=ticketId",
			},
		],
	})
	return Bpmn.createProcess("support")
		.startEvent("start")
		.adHocSubProcess("agent", agent.content, agent.options)
		.exclusiveGateway("resolved")
		.branch("yes", (b) =>
			b
				.condition("=agent.responseJson.resolved")
				.serviceTask("send-answer", { name: "Send answer", taskType: "email-send" })
				.endEvent("answered"),
		)
		.branch("no", (b) => b.defaultFlow().userTask("human").endEvent("handed-over"))
		.build()
}

const WHERE_IS_MY_ORDER = [
	{
		toolCalls: [
			{ name: "lookup-order", arguments: { orderId: "1042" } },
			{ name: "search-kb", arguments: { query: "delivery times" } },
		],
	},
	{ responseJson: { answer: "It ships tomorrow.", resolved: true } },
] as const

describe("engine — ad-hoc sub-process run by a job worker", () => {
	it("activates the elements a job result names, collects their results and asks again", async () => {
		const engine = new Engine()
		engine.deploy({ bpmn: supportProcess() })
		const agentJobs: Array<Record<string, unknown>> = []
		engine.registerJobWorker(AI_AGENT_JOB_WORKER_TASK_TYPE, (job) => {
			agentJobs.push(job.variables)
			if (agentJobs.length === 1) {
				job.complete(
					{},
					{
						type: "adHocSubProcess",
						activateElements: [
							{
								elementId: "lookup-order",
								variables: {
									toolCall: { orderId: "7", _meta: { id: "c1", name: "lookup-order" } },
								},
							},
						],
					},
				)
			} else {
				job.complete(
					{ agent: { responseJson: { resolved: false } } },
					{ type: "adHocSubProcess", isCompletionConditionFulfilled: true },
				)
			}
		})
		const lookups: Job[] = []
		engine.registerJobWorker("order-lookup", (job) => {
			lookups.push(job)
			job.complete({ order: { id: job.variables.orderId, status: "shipped" } })
		})
		engine.registerJobWorker("userTask", (job) => job.complete())

		const instance = engine.start("support", { message: "Where is order 7?" })
		const done = new Promise<Record<string, unknown>>((resolve) =>
			instance.onChange((e) => e.type === "process:completed" && resolve(e.variables)),
		)
		const variables = await done

		expect(lookups[0]?.variables.orderId).toBe("7")
		expect(agentJobs[0]?.toolCallResults).toEqual([])
		expect(agentJobs[0]?.adHocSubProcessElements).toEqual([
			{
				elementId: "search-kb",
				elementName: "Search",
				documentation: "Search the help centre.",
				properties: {},
				parameters: [{ name: "query", description: "Search terms" }],
			},
			{
				elementId: "lookup-order",
				elementName: "Look up order",
				documentation: "Get an order.",
				properties: {},
				parameters: [
					{ name: "orderId", description: "The order number" },
					{
						name: "includeItems",
						description: "Also list the items",
						type: "boolean",
						options: { required: false },
					},
				],
			},
			expect.objectContaining({ elementId: "create-ticket" }),
		])
		expect(agentJobs[1]?.toolCallResults).toEqual([
			{ id: "c1", name: "lookup-order", content: { id: "7", status: "shipped" } },
		])
		// Tool variables stay inside their activation; the collection and the mapped output leave.
		expect(variables.toolCallResult).toBeUndefined()
		expect(variables.toolCall).toBeUndefined()
		expect(variables.toolCallResults).toEqual(agentJobs[1]?.toolCallResults)
		expect(variables.agent).toEqual({ responseJson: { resolved: false } })
	})

	it("fails the instance when a job result names an element the sub-process cannot activate", async () => {
		const engine = new Engine()
		engine.deploy({ bpmn: supportProcess() })
		engine.registerJobWorker(AI_AGENT_JOB_WORKER_TASK_TYPE, (job) =>
			job.complete({}, { type: "adHocSubProcess", activateElements: [{ elementId: "resolved" }] }),
		)
		const instance = engine.start("support", {})
		const error = await new Promise<string>((resolve) =>
			instance.onChange((e) => e.type === "process:failed" && resolve(e.error)),
		)
		expect(error).toBe(
			'Ad-hoc sub-process "agent": "resolved" is not an element it can activate (activatable: search-kb, lookup-order, create-ticket)',
		)
	})

	it("rejects a job result that both activates elements and completes", async () => {
		const engine = new Engine()
		engine.deploy({ bpmn: supportProcess() })
		engine.registerJobWorker(AI_AGENT_JOB_WORKER_TASK_TYPE, (job) =>
			job.complete(
				{},
				{
					type: "adHocSubProcess",
					activateElements: [{ elementId: "search-kb" }],
					isCompletionConditionFulfilled: true,
				},
			),
		)
		const instance = engine.start("support", {})
		const error = await new Promise<string>((resolve) =>
			instance.onChange((e) => e.type === "process:failed" && resolve(e.error)),
		)
		expect(error).toMatch(/both activates elements and fulfils the completion condition/)
	})
})

describe("mockAiAgent — scripted turns", () => {
	let t: ProcessTest

	beforeEach(async () => {
		t = await createProcessTest({ bpmn: supportProcess() })
		t.mockJob("order-lookup", (job) => ({
			order: { id: job.variables.orderId, status: "shipped" },
		}))
		t.mockJob("kb-search", { result: { articles: ["Delivery times"] } })
		t.mockJob("email-send", { result: {} })
	})

	afterEach(() => t.dispose())

	it("runs the tools each turn calls and ends with the agent's response", async () => {
		const lookups = t.mockJob("order-lookup", (job) => ({
			order: { id: job.variables.orderId, status: "shipped" },
		}))
		const agent = t.mockAiAgent("agent", WHERE_IS_MY_ORDER)

		const run = await t.start("support", { message: "Where is order 1042?" })

		expect(run).toHaveCompleted()
		expect(run).toHavePassedInOrder(["agent", "send-answer", "answered"])
		expect(run).toHavePassed(["lookup-order", "search-kb"])
		expect(run).toHaveNotPassed(["create-ticket"])
		expect(agent).toHaveCalledTools([
			{ name: "lookup-order", arguments: { orderId: "1042" } },
			"search-kb",
		])
		expect(agent).not.toHaveCalledTools(["search-kb", "lookup-order"])
		expect(lookups.calls[0]?.variables.orderId).toBe("1042")
		expect(agent.requests.map((r) => r.modelCall)).toEqual([1, 2])
		expect(agent.requests[1]?.toolCallResults).toEqual([
			{ id: "call_1_1", name: "lookup-order", content: { id: "1042", status: "shipped" } },
			{ id: "call_1_2", name: "search-kb", content: ["Delivery times"] },
		])
		expect(run).toHaveVariables({
			agent: {
				responseText: '{"answer":"It ships tomorrow.","resolved":true}',
				responseJson: { answer: "It ships tomorrow.", resolved: true },
				context: { state: "READY", metrics: { modelCalls: 2 } },
			},
		})
		expect(agent.remainingTurns).toBe(0)
	})

	it("fails the run clearly on a tool the agent does not have", async () => {
		t.mockAiAgent("agent", [{ toolCalls: [{ name: "refund-order", arguments: {} }] }])
		const run = await t.start("support", {})
		expect(run).toHaveFailed(
			'AI agent "agent", model call 1, tool call 1: unknown tool "refund-order". Tools of "agent": search-kb, lookup-order, create-ticket',
		)
	})

	it("checks arguments against the tool's fromAi() parameters", async () => {
		t.mockAiAgent("agent", [{ toolCalls: [{ name: "lookup-order", arguments: { order: "1" } }] }])
		const unknownArg = await t.start("support", {})
		expect(unknownArg).toHaveFailed(
			'tool "lookup-order" has no parameter "order". Its fromAi() parameters: orderId, includeItems',
		)

		t.mockAiAgent("agent", [{ toolCalls: [{ name: "lookup-order" }] }])
		const missing = await t.start("support", {})
		expect(missing).toHaveFailed(
			'tool "lookup-order" needs "orderId", which the call does not give',
		)
	})

	it("says so when the process asks for a turn the script lacks", async () => {
		t.mockAiAgent("agent", [WHERE_IS_MY_ORDER[0]])
		const run = await t.start("support", {})
		expect(run).toHaveFailed(
			'AI agent "agent", model call 2: the script has no turn 2 — it has 1, all played. The agent asked the model again with results from lookup-order, search-kb. Add a turn, or re-record the cassette.',
		)
	})

	it("stops at the connector's maxModelCalls", async () => {
		const turn = { toolCalls: [{ name: "search-kb", arguments: { query: "x" } }] }
		t.mockAiAgent("agent", [turn, turn, turn, turn, turn])
		const run = await t.start("support", {})
		expect(run).toHaveFailed('AI agent "agent" reached its limit of 4 model calls')
	})

	it("waits at a tool without a mock until the test completes it", async () => {
		const tickets = t.mockAiAgent("agent", [
			{ toolCalls: [{ name: "create-ticket", arguments: { summary: "Parcel lost" } }] },
			{ responseJson: { resolved: false } },
		])
		t.mockJob("userTask", { result: {} })

		const run = await t.start("support", {})
		expect(run).toBeWaitingAt(["agent", "create-ticket"])
		expect(run.jobs.map((j) => [j.elementId, j.variables.summary])).toEqual([
			["create-ticket", "Parcel lost"],
		])

		await run.completeJob("create-ticket", { ticketId: "T-9" })
		expect(tickets.requests[1]?.toolCallResults).toEqual([
			{ id: "call_1_1", name: "create-ticket", content: "T-9" },
		])
		expect(run).toHavePassedInOrder(["create-ticket", "agent", "human", "handed-over"])
	})

	it("consumes turns across runs, one agent run after another", async () => {
		t.mockJob("userTask", { result: {} })
		const agent = t.mockAiAgent("agent", [
			{ responseJson: { resolved: true } },
			{ responseJson: { resolved: false } },
		])
		expect(await t.start("support", {})).toHavePassed(["answered"])
		expect(await t.start("support", {})).toHavePassed(["handed-over"])
		expect(agent.remainingTurns).toBe(0)
	})

	it("reports which tools the runs called", async () => {
		t.mockAiAgent("agent", WHERE_IS_MY_ORDER)
		await t.start("support", {})
		const { tools } = t.coverage()
		expect(tools).toEqual({ total: 3, covered: 2, percent: 66.7, uncovered: ["create-ticket"] })
		expect(formatCoverage(t.coverage())).toContain("tools never called: create-ticket")
	})

	it("refuses an element that is not an AI agent, and a restored mock stops answering", async () => {
		expect(() => t.mockAiAgent("send-answer", [])).toThrow(
			'mockAiAgent: "send-answer" is not an AI agent — an ad-hoc sub-process with a zeebe:taskDefinition — in the deployed BPMN. AI agents: agent',
		)
		t.mockAiAgent("agent", WHERE_IS_MY_ORDER).restore()
		expect(await t.start("support", {})).toHaveFailed('No AI agent mock for "agent"')
	})
})

describe("mockAiAgent — record and replay", () => {
	let dir: string

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), "bpmnkit-cassette-"))
	})

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true })
	})

	async function supportTest(): Promise<ProcessTest> {
		const t = await createProcessTest({ bpmn: supportProcess() })
		t.mockJob("order-lookup", (job) => ({ order: { id: job.variables.orderId, status: "lost" } }))
		t.mockJob("ticket-create", { result: { ticketId: "T-1" } })
		t.mockJob("userTask", { result: {} })
		return t
	}

	it("records what a handler decided and replays it from the file", async () => {
		const live = await supportTest()
		// Stands in for the user's own model adapter: it decides from what the agent sees.
		const recorder = live.mockAiAgent("agent", (request) => {
			if (request.modelCall === 1) {
				return { toolCalls: [{ id: "a", name: "lookup-order", arguments: { orderId: "5" } }] }
			}
			const order = request.toolCallResults[0]?.content as { status: string }
			if (order.status === "lost" && request.modelCall === 2) {
				return { toolCalls: [{ id: "b", name: "create-ticket", arguments: { summary: "Lost" } }] }
			}
			return { responseText: "A ticket is open.", responseJson: { resolved: false } }
		})
		const recorded = await live.start("support", {})
		live.dispose()
		expect(recorded).toHaveCompleted()

		const file = join(dir, "lost-order.cassette.json")
		await writeAgentCassette(file, recorder.cassette())
		expect(JSON.parse(await readFile(file, "utf8"))).toEqual({
			version: 1,
			agent: "agent",
			turns: [
				{ toolCalls: [{ id: "a", name: "lookup-order", arguments: { orderId: "5" } }] },
				{ toolCalls: [{ id: "b", name: "create-ticket", arguments: { summary: "Lost" } }] },
				{ responseText: "A ticket is open.", responseJson: { resolved: false } },
			],
		})

		const replay = await supportTest()
		const agent = replay.mockAiAgent("agent", await readAgentCassette(file))
		const run = await replay.start("support", {})
		replay.dispose()

		expect(run).toHavePassedInOrder(["lookup-order", "create-ticket", "agent", "handed-over"])
		expect(agent.toolCalls).toEqual(recorder.toolCalls)
		expect(agent.cassette()).toEqual(recorder.cassette())
	})

	it("refuses a cassette recorded for another agent", async () => {
		const t = await supportTest()
		const cassette: AgentCassette = { version: 1, agent: "billing-agent", turns: [] }
		expect(() => t.mockAiAgent("agent", cassette)).toThrow(
			'mockAiAgent("agent"): the cassette was recorded for AI agent "billing-agent"',
		)
		t.dispose()
	})
})

describe("parseAgentCassette", () => {
	it("accepts JSON text and parsed JSON", () => {
		const cassette = { version: 1, turns: [{ responseText: "Hi" }] }
		expect(parseAgentCassette(JSON.stringify(cassette))).toEqual(cassette)
		expect(parseAgentCassette(cassette)).toEqual(cassette)
	})

	it.each([
		["not JSON", "{", /Invalid agent cassette: .*JSON/],
		["a wrong version", { version: 2, turns: [] }, /version must be 1, got 2/],
		[
			"a misspelt field",
			{ version: 1, turns: [{ tool_calls: [] }] },
			/turns\[0\] has unknown field "tool_calls"/,
		],
		[
			"an empty toolCalls",
			{ version: 1, turns: [{ toolCalls: [] }] },
			/turns\[0\]\.toolCalls must be a non-empty array/,
		],
		[
			"a call without a name",
			{ version: 1, turns: [{ toolCalls: [{ id: "x" }] }] },
			/turns\[0\]\.toolCalls\[0\]\.name must be a non-empty string/,
		],
		[
			"a repeated call id",
			{
				version: 1,
				turns: [
					{
						toolCalls: [
							{ id: "x", name: "a" },
							{ id: "x", name: "b" },
						],
					},
				],
			},
			/turns\[0\]\.toolCalls\[1\]\.id repeats "x"/,
		],
		[
			"arguments that are a list",
			{ version: 1, turns: [{ toolCalls: [{ name: "a", arguments: [1] }] }] },
			/arguments must be an object/,
		],
		[
			"an empty turn",
			{ version: 1, turns: [{}] },
			/turns\[0\] must have toolCalls, or responseText and\/or responseJson/,
		],
	])("rejects %s", (_name, value, error) => {
		expect(() => parseAgentCassette(value, "agent cassette")).toThrow(error)
	})
})
