import { describe, expect, it, vi } from "vitest"
import type { AiWorkerConfig } from "../config.js"
import * as llmModule from "../llm.js"
import { classify } from "./classify.js"

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

describe("classify", () => {
	it("returns complete with valid category", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({ category: "billing", confidence: 0.9, rationale: "mentions invoice" }),
		)
		const result = await classify(
			makeJob({ input: "I need help with my invoice", categories: ["billing", "technical"] }),
			cfg,
		)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.category).toBe("billing")
			expect(result.variables.confidence).toBe(0.9)
		}
	})

	it("returns error when model returns category outside allowed list", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({ category: "other", confidence: 0.5, rationale: "unsure" }),
		)
		const result = await classify(
			makeJob({ input: "anything", categories: ["billing", "technical"] }),
			cfg,
		)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") {
			expect(result.errorCode).toBe("AI_INVALID_CATEGORY")
		}
	})

	it("returns error when model returns non-JSON", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue("Sorry, I cannot classify this.")
		const result = await classify(
			makeJob({ input: "anything", categories: ["billing", "technical"] }),
			cfg,
		)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") {
			expect(result.errorCode).toBe("AI_PARSE_ERROR")
		}
	})

	it("returns fail on RetryableError", async () => {
		vi.spyOn(llmModule, "callLlm").mockRejectedValue(new llmModule.RetryableError("rate limited"))
		const result = await classify(makeJob({ input: "anything", categories: ["billing"] }), cfg)
		expect(result.outcome).toBe("fail")
		if (result.outcome === "fail") {
			expect(result.retryBackOff).toBe(30_000)
		}
	})

	it("returns error on hard API failure", async () => {
		vi.spyOn(llmModule, "callLlm").mockRejectedValue(new Error("invalid api key"))
		const result = await classify(makeJob({ input: "anything", categories: ["billing"] }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") {
			expect(result.errorCode).toBe("AI_API_ERROR")
		}
	})

	it("returns error when categories variable is missing", async () => {
		const result = await classify(makeJob({ input: "text" }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") {
			expect(result.errorCode).toBe("AI_INVALID_INPUT")
		}
	})

	it("handles markdown code-fence wrapped JSON", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			`\`\`\`json\n${JSON.stringify({ category: "billing", confidence: 0.8, rationale: "invoice" })}\n\`\`\``,
		)
		const result = await classify(
			makeJob({ input: "invoice question", categories: ["billing", "technical"] }),
			cfg,
		)
		expect(result.outcome).toBe("complete")
	})
})
