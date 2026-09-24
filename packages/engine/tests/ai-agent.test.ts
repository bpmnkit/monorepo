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
		// Zeebe's shape: a parameter is named by its whole reference, and empty fields
		// (here `properties`) are left out.
		expect(agentJobs[0]?.adHocSubProcessElements).toStrictEqual([
			{
				elementId: "search-kb",
				elementName: "Search",
				documentation: "Search the help centre.",
				parameters: [{ name: "toolCall.query", description: "Search terms" }],
			},
			{
				elementId: "lookup-order",
				elementName: "Look up order",
				documentation: "Get an order.",
				parameters: [
					{ name: "toolCall.orderId", description: "The order number" },
					{
						name: "toolCall.includeItems",
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

	// The fixtures of Zeebe's AdHocSubProcessElementsVariableTest.
	it("gives adHocSubProcessElements Zeebe's shape", async () => {
		const input = (source: string, target: string) =>
			`<zeebe:input source="${source.replaceAll('"', "&quot;")}" target="${target}"/>`
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="d" targetNamespace="t">
  <bpmn:process id="process" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:adHocSubProcess id="ad-hoc">
      <bpmn:extensionElements><zeebe:taskDefinition type="agent-worker"/></bpmn:extensionElements>
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:task id="Simple_Task" name="Simple Task">
        <bpmn:documentation>The Simple Task documentation</bpmn:documentation>
        <bpmn:extensionElements><zeebe:properties><zeebe:property name="someProperty" value="someValue"/></zeebe:properties></bpmn:extensionElements>
      </bpmn:task>
      <bpmn:task id="Task_With_Properties" name="Task With Properties">
        <bpmn:extensionElements><zeebe:properties>
          <zeebe:property name="io.camunda.test.property1" value="value1"/>
          <zeebe:property name="io.camunda.test.property3" value=""/>
          <zeebe:property name="io.camunda.test.property4" value="   "/>
          <zeebe:property name="io.camunda.test.property5"/>
        </zeebe:properties></bpmn:extensionElements>
      </bpmn:task>
      <bpmn:serviceTask id="Service_Task" name="Service Task">
        <bpmn:extensionElements>
          <zeebe:taskDefinition type="serviceTaskJobType"/>
          <zeebe:ioMapping>
            ${input('=fromAi(toolCall.a, "Input A", "number")', "inputA")}
            ${input('=fromAi(b, "Input B", "number")', "inputB")}
            ${input('=string(fromAi(toolCall.c, "Input C", "number"))', "inputC")}
            ${input("=123456", "inputD")}
          </zeebe:ioMapping>
        </bpmn:extensionElements>
      </bpmn:serviceTask>
      <bpmn:task id="A_Task_With_Follow_Up"><bpmn:outgoing>f3</bpmn:outgoing></bpmn:task>
      <bpmn:task id="Follow_Up_Task"><bpmn:incoming>f3</bpmn:incoming></bpmn:task>
      <bpmn:sequenceFlow id="f3" sourceRef="A_Task_With_Follow_Up" targetRef="Follow_Up_Task"/>
      <bpmn:scriptTask id="A_Complex_Tool" name="A complex tool">
        <bpmn:extensionElements>
          <zeebe:script expression="=anArrayVariable" resultVariable="complexToolResult"/>
          <zeebe:ioMapping>
            ${input('=fromAi(toolCall.anEnumValue, "An enum value", "string", { enum: ["A", "B", "C"] })', "anEnumValue")}
            ${input('={ foo: [fromAi(firstValue), string(fromAi(toolCall.secondValue, "The second value", "integer"))], bar: { baz: fromAi(description: "The third value to add", value: toolCall.thirdValue) } }', "multiple")}
          </zeebe:ioMapping>
        </bpmn:extensionElements>
      </bpmn:scriptTask>
    </bpmn:adHocSubProcess>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="ad-hoc"/>
    <bpmn:sequenceFlow id="f2" sourceRef="ad-hoc" targetRef="end"/>
  </bpmn:process>
</bpmn:definitions>`
		const engine = new Engine()
		engine.deploy({ bpmn: Bpmn.parse(xml) })
		let elements: unknown
		engine.registerJobWorker("agent-worker", (job) => {
			elements = job.variables.adHocSubProcessElements
			job.complete({}, { type: "adHocSubProcess", isCompletionConditionFulfilled: true })
		})
		const instance = engine.start("process", {})
		await new Promise<void>((resolve) =>
			instance.onChange((e) => e.type === "process:completed" && resolve()),
		)
		// Compared as JSON, so a key that should be left out cannot hide as `undefined`.
		expect(JSON.stringify(elements, null, 1)).toBe(
			JSON.stringify(
				[
					{
						elementId: "Simple_Task",
						elementName: "Simple Task",
						documentation: "The Simple Task documentation",
						properties: { someProperty: "someValue" },
					},
					{
						elementId: "Task_With_Properties",
						elementName: "Task With Properties",
						properties: {
							"io.camunda.test.property1": "value1",
							"io.camunda.test.property3": null,
							"io.camunda.test.property4": "   ",
							"io.camunda.test.property5": null,
						},
					},
					{
						elementId: "Service_Task",
						elementName: "Service Task",
						parameters: [
							{ name: "toolCall.a", description: "Input A", type: "number" },
							{ name: "b", description: "Input B", type: "number" },
							{ name: "toolCall.c", description: "Input C", type: "number" },
						],
					},
					{ elementId: "A_Task_With_Follow_Up" },
					{
						elementId: "A_Complex_Tool",
						elementName: "A complex tool",
						parameters: [
							{
								name: "toolCall.anEnumValue",
								description: "An enum value",
								type: "string",
								schema: { enum: ["A", "B", "C"] },
							},
							{ name: "firstValue" },
							{ name: "toolCall.secondValue", description: "The second value", type: "integer" },
							{ name: "toolCall.thirdValue", description: "The third value to add" },
						],
					},
				],
				null,
				1,
			),
		)
	})
})

describe("fromAi() calls Zeebe rejects at deployment", () => {
	const tools = (source: string) => `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="d" targetNamespace="t">
  <bpmn:process id="process" isExecutable="true">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:subProcess id="outer"><bpmn:incoming>f1</bpmn:incoming>
      <bpmn:startEvent id="inner-start"><bpmn:outgoing>f2</bpmn:outgoing></bpmn:startEvent>
      <bpmn:adHocSubProcess id="agent"><bpmn:incoming>f2</bpmn:incoming>
        <bpmn:serviceTask id="tool">
          <bpmn:extensionElements>
            <zeebe:taskDefinition type="tool"/>
            <zeebe:ioMapping><zeebe:input source="${source.replaceAll('"', "&quot;")}" target="x"/></zeebe:ioMapping>
          </bpmn:extensionElements>
        </bpmn:serviceTask>
      </bpmn:adHocSubProcess>
      <bpmn:sequenceFlow id="f2" sourceRef="inner-start" targetRef="agent"/>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="outer"/>
  </bpmn:process>
</bpmn:definitions>`
	const deployError = (source: string) => {
		const engine = new Engine()
		expect(() => engine.deploy({ bpmn: Bpmn.parse(tools(source)) })).toThrow()
		try {
			engine.deploy({ bpmn: Bpmn.parse(tools(source)) })
		} catch (error) {
			expect(engine.getDeployedProcesses()).toEqual([])
			return (error as Error).message
		}
		return ""
	}
	const prefix = "Failed to extract ad-hoc activity parameters for element 'tool'. "

	// The cases of Zeebe's TaggedParameterExtractorTest, which Reebe checks too.
	it("rejects a value that is not a reference", () => {
		const expected = `${prefix}Expected fromAi() parameter 'value' to be a reference (e.g. 'toolCall.customParameter'), but received`
		expect(deployError('=fromAi("toolCall.myVariable")')).toBe(
			`${expected} string 'toolCall.myVariable'.`,
		)
		expect(deployError("=fromAi(10)")).toBe(`${expected} 10.`)
		expect(deployError("=fromAi([])")).toBe(`${expected} ConstList(List()).`)
		expect(deployError("=fromAi(fromAi(toolCall.myVariable))")).toMatch(
			/but received FunctionInvocation\(fromAi/,
		)
	})

	it("rejects a description or type that is not a string, or a schema or options that is not a context", () => {
		expect(deployError("=fromAi(value: toolCall.myVariable, description: 10)")).toBe(
			`${prefix}Expected fromAi() parameter 'description' to be a string, but received '10'.`,
		)
		expect(deployError('=fromAi(value: toolCall.myVariable, type: "str" + "ing")')).toMatch(
			/parameter 'type' to be a string, but received 'Addition\(ConstString\(str\),ConstString\(ing\)\)'\.$/,
		)
		expect(deployError('=fromAi(value: toolCall.myVariable, schema: "dummy")')).toBe(
			`${prefix}Expected fromAi() parameter 'schema' to be a context (map), but received 'dummy'.`,
		)
		expect(deployError("=fromAi(toolCall.id, null)")).toBe(
			`${prefix}Expected fromAi() parameter 'description' to be a string, but received 'ConstNull'.`,
		)
		expect(deployError('=fromAi(toolCall.x, "X", "string", { enum: other })')).toBe(
			`${prefix}Unsupported expression value in fromAi() function invocation: Ref`,
		)
	})

	it("deploys valid calls", () => {
		const engine = new Engine()
		engine.deploy({
			bpmn: Bpmn.parse(tools('=fromAi(toolCall.x, "X", "string", { minimum: -1 })')),
		})
		expect(engine.getDeployedProcesses()).toEqual(["process"])
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

	it("offers the model a toolCall.<name> parameter as <name>, and fails for one it cannot offer", async () => {
		// `arguments` use the connector's names: `orderId` for `toolCall.orderId`.
		const lookups = t.mockJob("order-lookup", { result: {} })
		t.mockAiAgent("agent", WHERE_IS_MY_ORDER)
		expect(await t.start("support", {})).toHaveCompleted()
		expect(lookups.calls[0]?.variables.orderId).toBe("1042")
		expect(lookups.calls[0]?.variables.toolCall).toEqual({
			orderId: "1042",
			_meta: { id: "call_1_1", name: "lookup-order" },
		})

		const xml = Bpmn.export(supportProcess())
		expect(xml).toContain("fromAi(toolCall.summary")
		const other = await createProcessTest({
			bpmn: xml.replace("fromAi(toolCall.summary", "fromAi(summary"),
		})
		other.mockAiAgent("agent", [{ toolCalls: [{ name: "create-ticket", arguments: {} }] }])
		expect(await other.start("support", {})).toHaveFailed(
			`AI agent "agent": failed to generate ad-hoc tool schema for element 'create-ticket'. Parameter name 'summary' is not part of expected namespace 'toolCall.'.`,
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
