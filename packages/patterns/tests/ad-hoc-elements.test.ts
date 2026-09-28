import { AI_AGENT_JOB_WORKER_TASK_TYPE, Bpmn } from "@bpmnkit/core"
import { Engine } from "@bpmnkit/engine"
import { runScenarioWasm } from "@bpmnkit/engine/wasm-runner"
import { describe, expect, it } from "vitest"
import { getTemplate, templateFiles } from "../src/templates/index.js"

/** The `adHocSubProcessElements` the TypeScript engine gives the agent's job. */
async function elementsOnTypeScript(bpmnXml: string): Promise<unknown> {
	const engine = new Engine()
	engine.deploy({ bpmn: Bpmn.parse(bpmnXml) })
	let seen: unknown
	engine.registerJobWorker(AI_AGENT_JOB_WORKER_TASK_TYPE, (job) => {
		seen = job.variables.adHocSubProcessElements
		job.complete({ agent: { responseJson: { answer: "done", resolved: true } } })
	})
	engine.registerJobWorker("email-send", (job) => job.complete())
	const instance = engine.start("ai-agent-tool-loop", { customerMessage: "Where is order 1042?" })
	await new Promise<void>((resolve) =>
		instance.onChange((e) => {
			if (e.type === "process:completed") resolve()
		}),
	)
	return seen
}

describe("adHocSubProcessElements", () => {
	it("is the same on the TypeScript engine and on Reebe for the ai-agent-tool-loop template", async () => {
		const template = getTemplate("ai-agent-tool-loop")
		if (template === undefined) throw new Error("ai-agent-tool-loop template missing")
		const bpmnXml = templateFiles(template).find((f) => f.path.endsWith(".bpmn"))?.content
		if (bpmnXml === undefined) throw new Error("no .bpmn file")
		const scenario = template.scenarios.find((s) => s.id === "resolved")
		if (scenario === undefined) throw new Error("resolved scenario missing")

		const onTypeScript = await elementsOnTypeScript(bpmnXml)
		const onReebe = (await runScenarioWasm(bpmnXml, scenario)).finalVariables
			.adHocSubProcessElements

		// Zeebe's shape: parameters named by their whole reference, and no `properties`
		// key for an element without any.
		expect(onTypeScript).toStrictEqual([
			{
				elementId: "search-kb",
				elementName: "Search knowledge base",
				documentation: "Search the help centre for articles that answer a question.",
				parameters: [{ name: "toolCall.query", description: "Search terms" }],
			},
			{
				elementId: "lookup-order",
				elementName: "Look up order",
				documentation: "Get the status, items and tracking link of an order.",
				parameters: [{ name: "toolCall.orderId", description: "The order number" }],
			},
			{
				elementId: "create-ticket",
				elementName: "Create ticket",
				documentation: "Open a ticket for the warehouse team when an order needs manual action.",
				parameters: [{ name: "toolCall.summary", description: "One-line summary of the problem" }],
			},
		])
		expect(onReebe).toStrictEqual(onTypeScript)
	})
})
