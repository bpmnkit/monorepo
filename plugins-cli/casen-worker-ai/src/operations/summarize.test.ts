import { describe, expect, it, vi } from "vitest"
import type { AiWorkerConfig } from "../config.js"
import * as llmModule from "../llm.js"
import { summarize } from "./summarize.js"

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

describe("summarize", () => {
	it("returns complete with summary and wordCount", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({ summary: "A short summary.", wordCount: 3 }),
		)
		const result = await summarize(makeJob({ input: "Long text here..." }), cfg)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.summary).toBe("A short summary.")
			expect(result.variables.wordCount).toBe(3)
		}
	})

	it("returns error on parse failure", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue("Here is the summary: blah blah.")
		const result = await summarize(makeJob({ input: "text" }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") expect(result.errorCode).toBe("AI_PARSE_ERROR")
	})

	it("returns fail on RetryableError", async () => {
		vi.spyOn(llmModule, "callLlm").mockRejectedValue(new llmModule.RetryableError("timeout"))
		const result = await summarize(makeJob({ input: "text" }), cfg)
		expect(result.outcome).toBe("fail")
	})
})
