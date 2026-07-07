import type { PlanScenario } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { toScenarioSidecar } from "./synth.js"

describe("toScenarioSidecar", () => {
	it("converts a plan scenario with an outputs mock into the ScenarioLike shape", () => {
		const tests: PlanScenario[] = [
			{
				name: "Happy path",
				mocks: { "test:notify:1": { outputs: { notified: true } } },
				expect: { path: ["start", "notify", "end"], variables: { notified: true } },
			},
		]
		expect(toScenarioSidecar(tests)).toEqual([
			{
				id: "Happy_path",
				name: "Happy path",
				inputs: undefined,
				mocks: { "test:notify:1": { outputs: { notified: true } } },
				expect: { path: ["start", "notify", "end"], variables: { notified: true } },
			},
		])
	})

	it("stringifies an error mock's code and message", () => {
		const tests: PlanScenario[] = [
			{
				name: "Worker errors out",
				mocks: { "test:notify:1": { error: { code: "SEND_FAILED", message: "timeout" } } },
			},
		]
		const [sidecar] = toScenarioSidecar(tests) as Array<{
			mocks: Record<string, { error: string }>
		}>
		expect(sidecar.mocks["test:notify:1"]?.error).toBe("SEND_FAILED: timeout")
	})

	it("de-duplicates ids when scenario names slugify to the same value", () => {
		const tests: PlanScenario[] = [{ name: "Case A" }, { name: "Case A" }]
		const ids = (toScenarioSidecar(tests) as Array<{ id: string }>).map((s) => s.id)
		expect(ids).toEqual(["Case_A", "Case_A_2"])
	})
})
