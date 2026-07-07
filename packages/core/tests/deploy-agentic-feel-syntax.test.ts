import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, buildAiAgentSubProcess, optimize, resetIdCounter } from "../src/index.js"

describe("optimize() — deploy profile", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("flags a service task with no zeebe:taskDefinition type", () => {
		const defs = Bpmn.createProcess("proc").startEvent("s").endEvent("e").build()
		// Manually strip the task type to simulate a hand-edited/incomplete process.
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		proc.flowElements.push({
			type: "serviceTask",
			id: "bare",
			name: "Bare",
			incoming: [],
			outgoing: [],
			extensionElements: [],
			unknownAttributes: {},
		})
		const report = optimize(defs, { categories: ["deploy"] })
		expect(
			report.findings.some(
				(f) => f.id === "deploy/service-task-no-type" && f.elementIds.includes("bare"),
			),
		).toBe(true)
	})

	it("flags a message intermediate catch with no correlation key", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.intermediateCatchEvent("wait", { messageName: "payment-confirmed" })
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["deploy"] })
		expect(report.findings.some((f) => f.id === "deploy/message-catch-no-correlation")).toBe(true)
	})

	it("does not flag a correlated message catch", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.intermediateCatchEvent("wait", {
				messageName: "payment-confirmed",
				correlationKey: "=orderId",
			})
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["deploy"] })
		expect(report.findings.some((f) => f.id === "deploy/message-catch-no-correlation")).toBe(false)
	})

	it("flags a call activity with no called process id", () => {
		const defs = Bpmn.createProcess("proc").startEvent("s").endEvent("e").build()
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		proc.flowElements.push({
			type: "callActivity",
			id: "call",
			incoming: [],
			outgoing: [],
			extensionElements: [],
			unknownAttributes: {},
		})
		const report = optimize(defs, { categories: ["deploy"] })
		expect(report.findings.some((f) => f.id === "deploy/call-activity-no-process")).toBe(true)
	})

	it("flags a non-executable process", () => {
		const defs = Bpmn.createProcess("proc").executable(false).startEvent("s").endEvent("e").build()
		const report = optimize(defs, { categories: ["deploy"] })
		expect(report.findings.some((f) => f.id === "deploy/process-not-executable")).toBe(true)
	})

	it("reports connector/missing-required via an injected resolver", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.serviceTask("notify", {
				name: "Notify",
				taskType: "io.camunda:slack:1",
				modelerTemplate: "io.camunda.connectors.Slack.v1",
				ioMapping: { inputs: [{ source: "chat.postMessage", target: "method" }] },
			})
			.endEvent("e")
			.build()
		const report = optimize(defs, {
			categories: ["connector"],
			resolveConnectorRequirements: (templateId, boundKeys) => {
				if (templateId !== "io.camunda.connectors.Slack.v1") return []
				const required = ["method", "token", "data.channel"]
				return required.filter((k) => !boundKeys.includes(k))
			},
		})
		const missing = report.findings.filter((f) => f.id === "connector/missing-required")
		expect(missing.map((f) => f.message).join(" ")).toContain("token")
		expect(missing.map((f) => f.message).join(" ")).toContain("data.channel")
	})
})

describe("optimize() — feel-syntax", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("flags an invalid FEEL condition on a sequence flow, including inside a sub-process", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.subProcess("sub", (b) => {
				b.exclusiveGateway("gw")
					.branch("a", (bb) => bb.condition("=this is ) not valid feel (").connectTo("end2"))
					.branch("b", (bb) => bb.defaultFlow().connectTo("end2"))
					.endEvent("end2")
			})
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["feel-syntax"] })
		expect(report.findings.some((f) => f.id === "feel-syntax/parse-error")).toBe(true)
	})

	it("does not flag a valid FEEL condition", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("a", (b) => b.condition("=amount > 1000").connectTo("e"))
			.branch("b", (b) => b.defaultFlow().connectTo("e"))
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["feel-syntax"] })
		expect(report.findings).toEqual([])
	})

	it("does not flag a literal (non-FEEL) io-mapping value", () => {
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.serviceTask("t", {
				name: "T",
				taskType: "x:1",
				ioMapping: { inputs: [{ source: "literal-value", target: "foo" }] },
			})
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["feel-syntax"] })
		expect(report.findings).toEqual([])
	})
})

describe("optimize() — agentic", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	function agentDefs(overrides?: { badFromAi?: boolean }) {
		const agent = buildAiAgentSubProcess({
			id: "agent",
			model: { provider: "anthropic", inputs: {} },
			systemPrompt: "Help.",
			userPrompt: "=msg",
			tools: [
				{
					id: "search",
					description: "Search the KB.",
					serviceTask: { name: "Search", taskType: "http:1" },
					params: [{ name: "query", description: "Search query", target: "q" }],
				},
			],
		})
		if (overrides?.badFromAi) {
			const searchTool = agent.content
			// Corrupt the first tool's fromAi() reference to something invalid.
			const scratchBuild = Bpmn.createProcess("scratch")
				.startEvent("s")
				.adHocSubProcess("agent", searchTool, agent.options)
				.endEvent("e")
				.build()
			const proc = scratchBuild.processes[0]
			const tool = proc?.flowElements.find((e) => e.id === "agent")
			if (tool?.type === "adHocSubProcess") {
				const searchEl = tool.flowElements.find((e) => e.id === "search")
				const io = searchEl?.extensionElements.find((e) => e.name === "zeebe:ioMapping")
				const input = (
					io as { children?: Array<{ attributes: Record<string, string> }> }
				)?.children?.find((c) => c.attributes.target === "q")
				if (input) input.attributes.source = '=fromAi(badRef.query, "Search query", "string")'
			}
			return scratchBuild
		}
		return Bpmn.createProcess("proc")
			.startEvent("s")
			.adHocSubProcess("agent", agent.content, agent.options)
			.endEvent("e")
			.build()
	}

	it("does not flag a well-formed AI Agent sub-process", () => {
		const defs = agentDefs()
		const report = optimize(defs, { categories: ["agentic"] })
		expect(report.findings.filter((f) => f.severity === "error")).toEqual([])
	})

	it("flags a tool with an incoming sequence flow as not a root node", () => {
		const agent = buildAiAgentSubProcess({
			id: "agent",
			model: { provider: "anthropic", inputs: {} },
			systemPrompt: "Help.",
			userPrompt: "=msg",
			tools: [
				{ id: "t1", description: "Tool 1", serviceTask: { name: "T1", taskType: "a:1" } },
				{ id: "t2", description: "Tool 2", serviceTask: { name: "T2", taskType: "b:1" } },
			],
		})
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.adHocSubProcess(
				"agent",
				(b) => {
					agent.content(b)
					// Manually wire t1 -> t2 to simulate a non-root tool.
				},
				agent.options,
			)
			.endEvent("e")
			.build()
		const proc = defs.processes[0]
		const agentEl = proc?.flowElements.find((e) => e.id === "agent")
		if (agentEl?.type === "adHocSubProcess") {
			const t2 = agentEl.flowElements.find((e) => e.id === "t2")
			if (t2) t2.incoming.push("Flow_fake")
		}
		const report = optimize(defs, { categories: ["agentic"] })
		expect(
			report.findings.some((f) => f.id === "agentic/tool-not-root" && f.elementIds.includes("t2")),
		).toBe(true)
	})

	it("flags a tool with no documentation", () => {
		const agent = buildAiAgentSubProcess({
			id: "agent",
			model: { provider: "anthropic", inputs: {} },
			systemPrompt: "Help.",
			userPrompt: "=msg",
			tools: [{ id: "t1", description: "", serviceTask: { name: "T1", taskType: "a:1" } }],
		})
		const defs = Bpmn.createProcess("proc")
			.startEvent("s")
			.adHocSubProcess("agent", agent.content, agent.options)
			.endEvent("e")
			.build()
		const report = optimize(defs, { categories: ["agentic"] })
		expect(report.findings.some((f) => f.id === "agentic/tool-no-description")).toBe(true)
	})

	it("flags a fromAi() call that doesn't reference toolCall.*", () => {
		const defs = agentDefs({ badFromAi: true })
		const report = optimize(defs, { categories: ["agentic"] })
		expect(report.findings.some((f) => f.id === "agentic/fromai-bad-ref")).toBe(true)
	})
})
