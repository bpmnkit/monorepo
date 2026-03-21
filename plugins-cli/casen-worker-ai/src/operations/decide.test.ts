import { describe, expect, it, vi } from "vitest"
import type { AiWorkerConfig } from "../config.js"
import * as llmModule from "../llm.js"
import { decide } from "./decide.js"

const cfg: AiWorkerConfig = {
	apiKey: "test",
	model: "claude-test",
	maxTokens: 512,
	timeoutMs: 5000,
}

function makeJob(variables: Record<string, unknown>) {
	return {
		jobKey: "1",
		processDefinitionId: "p1",
		elementId: "e1",
		processInstanceKey: "i1",
		variables,
	}
}

describe("decide", () => {
	it("returns complete with decision=true", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({ decision: true, rationale: "Meets all criteria.", confidence: 0.92 }),
		)
		const result = await decide(
			makeJob({ question: "Should we approve?", context: "Score 720, amount 30000" }),
			cfg,
		)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.decision).toBe(true)
			expect(result.variables.confidence).toBe(0.92)
		}
	})

	it("returns complete with decision=false", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({ decision: false, rationale: "Exceeds threshold.", confidence: 0.87 }),
		)
		const result = await decide(makeJob({ question: "Approve?", context: "debt ratio 55%" }), cfg)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.decision).toBe(false)
		}
	})

	it("returns error on parse failure", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue("I recommend approval based on the data.")
		const result = await decide(makeJob({ question: "Approve?", context: "context" }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") expect(result.errorCode).toBe("AI_PARSE_ERROR")
	})

	it("returns fail on RetryableError", async () => {
		vi.spyOn(llmModule, "callLlm").mockRejectedValue(new llmModule.RetryableError("503"))
		const result = await decide(makeJob({ question: "Approve?", context: "context" }), cfg)
		expect(result.outcome).toBe("fail")
		if (result.outcome === "fail") expect(result.retries).toBe(2)
	})

	it("includes policy in prompt when provided", async () => {
		const spy = vi
			.spyOn(llmModule, "callLlm")
			.mockResolvedValue(
				JSON.stringify({ decision: false, rationale: "Violates policy.", confidence: 0.95 }),
			)
		await decide(
			makeJob({
				question: "Approve?",
				context: "score 650",
				policy: "Minimum score is 680.",
			}),
			cfg,
		)
		const call = spy.mock.calls[0]
		const [, userMessage] = call ?? []
		expect(userMessage).toContain("Minimum score is 680.")
	})
})
