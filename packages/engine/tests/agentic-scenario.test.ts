import {
	AI_AGENT_JOB_WORKER_TASK_TYPE,
	Bpmn,
	buildAiAgentSubProcess,
	resetIdCounter,
} from "@bpmnkit/core"
import { beforeEach, describe, expect, it } from "vitest"
import { Engine } from "../src/engine.js"
import { runScenario } from "../src/scenario.js"

describe("AI Agent Sub-process — mocked scenario execution", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	function agentProcessDefs() {
		const agent = buildAiAgentSubProcess({
			id: "triage_agent",
			model: { provider: "anthropic", inputs: {} },
			systemPrompt: "Triage the ticket.",
			userPrompt: "=ticketText",
			tools: [
				{
					id: "notify_slack",
					description: "Notify #ops.",
					serviceTask: { name: "Notify", taskType: "io.camunda:slack:1" },
				},
			],
		})
		return Bpmn.createProcess("support-triage")
			.startEvent("start")
			.adHocSubProcess("triage_agent", agent.content, agent.options)
			.serviceTask("close_ticket", { name: "Close ticket", taskType: "close:1" })
			.endEvent("end")
			.build()
	}

	it("dispatches the agent as a job — a scenario can mock it black-box like any other task", async () => {
		const engine = new Engine()
		const defs = agentProcessDefs()

		const result = await runScenario(engine, defs, {
			id: "s1",
			name: "Agent resolves the ticket",
			mocks: {
				[AI_AGENT_JOB_WORKER_TASK_TYPE]: { outputs: { agent: { status: "resolved" } } },
				"close:1": { outputs: {} },
			},
			expect: {
				path: ["start", "triage_agent", "close_ticket", "end"],
				variables: { agent: { status: "resolved" } },
			},
		})

		expect(result.errors).toEqual([])
		expect(result.passed).toBe(true)
		expect(result.visitedElements).toContain("triage_agent")
	})

	it("without a mock, the process still completes (consistent with every other unmocked task) but the agent's output variable is never set", async () => {
		const engine = new Engine()
		const defs = agentProcessDefs()

		const result = await runScenario(engine, defs, {
			id: "s2",
			name: "No agent worker registered",
			mocks: { "close:1": { outputs: {} } },
			expect: { path: ["start", "triage_agent", "close_ticket", "end"] },
		})

		expect(result.passed).toBe(true)
		// The engine's FEEL evaluator resolves an unbound name to null rather than
		// throwing, so the ioMapping output evaluates "=agent" to null — not the
		// mocked object from the other test.
		expect(result.finalVariables.agent).toBeNull()
	})
})
