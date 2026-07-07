import { beforeEach, describe, expect, it } from "vitest"
import { Bpmn, compilePlan, extractPlan, mergePlan, resetIdCounter } from "../src/index.js"
import type { ProcessPlan } from "../src/index.js"

describe("extractPlan", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("lifts a linear plan-compiled process back into ProcessPlan form", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc", name: "Order Process" },
			steps: [
				{ kind: "start", id: "s" },
				{
					kind: "serviceTask",
					id: "ship",
					name: "Ship order",
					jobType: "shipping:1",
					inputs: { orderId: "=orderId" },
					outputs: { trackingId: "=response.trackingId" },
				},
				{ kind: "end", id: "e" },
			],
		}
		const compiled = compilePlan(plan)
		expect(compiled.problems).toEqual([])
		const defs = Bpmn.parse(compiled.xml as string)

		const { plan: extracted, unsupported } = extractPlan(defs)
		expect(unsupported).toEqual([])
		expect(extracted.process.id).toBe("proc")
		expect(extracted.steps.map((s) => s.kind)).toEqual(["start", "serviceTask", "end"])
		const ship = extracted.steps.find((s) => s.id === "ship")
		expect(ship?.kind).toBe("serviceTask")
		if (ship?.kind === "serviceTask") {
			expect(ship.jobType).toBe("shipping:1")
			expect(ship.inputs).toEqual({ orderId: "=orderId" })
			expect(ship.outputs).toEqual({ trackingId: "=response.trackingId" })
		}
	})

	it("lifts a reconverging exclusive-gateway split into a gateway step", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start", id: "s" },
				{
					kind: "gateway",
					id: "gw",
					gatewayType: "exclusive",
					branches: [
						{
							condition: "=amount > 1000",
							steps: [{ kind: "userTask", id: "review", candidateGroups: "managers" }],
						},
						{ default: true, steps: [] },
					],
				},
				{ kind: "end", id: "e" },
			],
		}
		const compiled = compilePlan(plan)
		expect(compiled.problems).toEqual([])
		const defs = Bpmn.parse(compiled.xml as string)

		const { plan: extracted, unsupported } = extractPlan(defs)
		expect(unsupported).toEqual([])
		const gw = extracted.steps.find((s) => s.id === "gw")
		expect(gw?.kind).toBe("gateway")
		if (gw?.kind === "gateway") {
			expect(gw.branches).toHaveLength(2)
			expect(gw.branches.some((b) => b.condition === "=amount > 1000")).toBe(true)
			expect(gw.branches.some((b) => b.default)).toBe(true)
		}
	})

	it("reports an AI Agent ad-hoc sub-process as unsupported instead of guessing", () => {
		const plan: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start", id: "s" },
				{
					kind: "aiAgent",
					id: "agent",
					provider: "anthropic",
					model: "claude-sonnet-5",
					systemPrompt: "Help.",
					userPrompt: "=msg",
					tools: [{ id: "noop", description: "Does nothing.", jobType: "noop:1" }],
				},
				{ kind: "end", id: "e" },
			],
		}
		const compiled = compilePlan(plan)
		const defs = Bpmn.parse(compiled.xml as string)
		const { unsupported } = extractPlan(defs)
		expect(unsupported.some((u) => u.id === "agent")).toBe(true)
	})
})

describe("mergePlan", () => {
	beforeEach(() => {
		resetIdCounter()
	})

	it("adds a new step to an existing process, reusing the process id and start event id", () => {
		const original: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start", id: "s" },
				{ kind: "serviceTask", id: "ship", jobType: "shipping:1" },
				{ kind: "end", id: "e" },
			],
		}
		const compiled = compilePlan(original)
		expect(compiled.problems).toEqual([])
		const existingDefs = Bpmn.parse(compiled.xml as string)

		const delta: ProcessPlan = {
			version: 1,
			process: { id: "proc" },
			steps: [
				{ kind: "start", id: "s" },
				{ kind: "serviceTask", id: "ship", jobType: "shipping:1" },
				{ kind: "serviceTask", id: "notify", name: "Notify customer", jobType: "email:1" },
				{ kind: "end", id: "e" },
			],
		}
		const merged = mergePlan(existingDefs, delta)
		expect(merged.problems).toEqual([])
		const reparsed = Bpmn.parse(merged.xml as string)
		const ids = reparsed.processes[0]?.flowElements.map((e) => e.id).sort()
		expect(ids).toEqual(["e", "notify", "s", "ship"])
	})
})
