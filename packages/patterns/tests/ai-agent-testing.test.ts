import "@bpmnkit/engine/testing/vitest"
import { createProcessTest } from "@bpmnkit/engine/testing"
import type { AgentCassette, ProcessTest } from "@bpmnkit/engine/testing"
import { afterEach, describe, expect, it } from "vitest"
import { AI_AGENT_TASK_TYPE } from "../src/templates/ai-task.js"
import { getTemplate, templateFiles } from "../src/templates/index.js"

/** The BPMN `casen template use` writes for a template — what a team would put under test. */
function templateXml(id: string): string {
	const template = getTemplate(id)
	if (template === undefined) throw new Error(`no template ${id}`)
	const file = templateFiles(template).find((f) => f.path.endsWith(".bpmn"))
	if (file === undefined) throw new Error(`template ${id} writes no .bpmn`)
	return file.content
}

let t: ProcessTest | undefined
afterEach(() => t?.dispose())

describe("ai-agent-tool-loop under deterministic tests", () => {
	/** A transcript as it would be recorded from a real run and replayed. */
	const damagedOrder: AgentCassette = {
		version: 1,
		agent: "support-agent",
		turns: [
			{
				toolCalls: [
					{ id: "toolu_01", name: "lookup-order", arguments: { orderId: "1042" } },
					{ id: "toolu_02", name: "search-kb", arguments: { query: "damaged item return" } },
				],
			},
			{
				toolCalls: [
					{
						id: "toolu_03",
						name: "create-ticket",
						arguments: { summary: "Order 1042 arrived damaged" },
					},
				],
			},
			{
				responseJson: {
					answer: "Sorry about that — ticket T-77 is open and a replacement ships this week.",
					resolved: true,
				},
			},
		],
	}

	it("replays the agent's tool choices and answers the customer", async () => {
		t = await createProcessTest({ bpmn: templateXml("ai-agent-tool-loop") })
		const orders = t.mockJob("order-lookup", (job) => ({
			order: { id: job.variables.orderId, status: "delivered", damaged: true },
		}))
		t.mockJob("kb-search", { result: { articles: ["Returns and damaged items"] } })
		const tickets = t.mockJob("ticket-create", { result: { ticketId: "T-77" } })
		const email = t.mockJob("email-send", { result: {} })
		const agent = t.mockAiAgent("support-agent", damagedOrder)

		const run = await t.start("ai-agent-tool-loop", {
			customerMessage: "My order 1042 arrived broken.",
		})

		expect(run).toHaveCompleted()
		expect(run).toHavePassedInOrder(["support-agent", "resolved-gw", "send-answer", "answered"])
		expect(agent).toHaveCalledTools([
			{ name: "lookup-order", arguments: { orderId: "1042" } },
			{ name: "search-kb", arguments: { query: expect.stringContaining("damaged") } },
			{ name: "create-ticket", arguments: { summary: "Order 1042 arrived damaged" } },
		])
		// fromAi() hands the model's arguments to the tool's job …
		expect(orders.calls[0]?.variables.orderId).toBe("1042")
		expect(tickets.calls[0]?.variables.summary).toBe("Order 1042 arrived damaged")
		// … and each tool's result comes back to the model in toolCallResults.
		expect(agent.requests[1]?.toolCallResults).toEqual([
			{
				id: "toolu_01",
				name: "lookup-order",
				content: { id: "1042", status: "delivered", damaged: true },
			},
			{ id: "toolu_02", name: "search-kb", content: ["Returns and damaged items"] },
		])
		expect(agent.requests[2]?.toolCallResults).toEqual([
			{ id: "toolu_03", name: "create-ticket", content: "T-77" },
		])
		expect(email.calls[0]?.variables.body).toBe(
			"Sorry about that — ticket T-77 is open and a replacement ships this week.",
		)
		expect(agent.remainingTurns).toBe(0)

		expect(t.coverage().tools).toMatchObject({ total: 3, covered: 3 })
	})

	it("hands over to a person when the agent gives up", async () => {
		t = await createProcessTest({ bpmn: templateXml("ai-agent-tool-loop") })
		t.mockJob("kb-search", { result: { articles: [] } })
		t.mockJob("userTask", { result: {} })
		const agent = t.mockAiAgent("support-agent", [
			{ toolCalls: [{ name: "search-kb", arguments: { query: "legal complaint" } }] },
			{ responseJson: { answer: "", resolved: false } },
		])

		const run = await t.start("ai-agent-tool-loop", { customerMessage: "I want a lawyer." })

		expect(run).toHavePassedInOrder(["search-kb", "support-agent", "human-takeover", "handed-over"])
		expect(run).toHaveNotPassed(["lookup-order", "create-ticket", "send-answer"])
		expect(agent).toHaveCalledTools(["search-kb"])
	})

	it("fails loudly when a replayed transcript names a tool the model no longer has", async () => {
		t = await createProcessTest({ bpmn: templateXml("ai-agent-tool-loop") })
		t.mockAiAgent("support-agent", [{ toolCalls: [{ name: "issue-refund", arguments: {} }] }])

		const run = await t.start("ai-agent-tool-loop", { customerMessage: "Refund me" })

		expect(run).toHaveFailed(
			'unknown tool "issue-refund". Tools of "support-agent": search-kb, lookup-order, create-ticket',
		)
	})
})

describe("ai-orchestrator-workers under deterministic tests", () => {
	it("delegates to worker tools that are model calls themselves", async () => {
		t = await createProcessTest({ bpmn: templateXml("ai-orchestrator-workers") })
		// The worker tools are AI Agent Tasks — one model call each, mocked by their prompt.
		const workers = t.mockJob(AI_AGENT_TASK_TYPE, (job) => ({
			agent: { responseText: `findings for: ${String(job.variables["data.userPrompt.prompt"])}` },
		}))
		t.mockJob("wiki-page-publish", { result: { pageUrl: "https://wiki.example.com/heat-pumps" } })
		const orchestrator = t.mockAiAgent("orchestrator", [
			{
				toolCalls: [
					{ name: "research-web", arguments: { instructions: "EU heat-pump sales 2020-2025" } },
					{ name: "analyse-data", arguments: { data: "year,units\n2020,1.6M\n2022,3.0M" } },
				],
			},
			{ responseJson: { report: "Sales roughly doubled.", confidence: 0.9 } },
		])

		const run = await t.start("ai-orchestrator-workers", { question: "How did sales develop?" })

		expect(run).toHaveCompleted()
		expect(run).toHaveNotPassed(["expert-review"])
		expect(run).toHaveVariables({ reportUrl: "https://wiki.example.com/heat-pumps" })
		expect(workers.calls.map((c) => c.elementId)).toEqual(["research-web", "analyse-data"])
		expect(orchestrator.requests[1]?.toolCallResults.map((r) => r.content)).toEqual([
			"findings for: EU heat-pump sales 2020-2025",
			"findings for: year,units\n2020,1.6M\n2022,3.0M",
		])
		expect(t.coverage().tools.uncovered).toEqual(["summarise-source"])
	})
})
