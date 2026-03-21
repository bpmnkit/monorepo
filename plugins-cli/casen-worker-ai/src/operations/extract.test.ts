import { describe, expect, it, vi } from "vitest"
import type { AiWorkerConfig } from "../config.js"
import * as llmModule from "../llm.js"
import { extract } from "./extract.js"

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

describe("extract", () => {
	it("returns complete with extracted fields and empty missingFields", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({
				extracted: { vendorName: "Acme Corp", totalAmount: 1250.0 },
				missingFields: [],
			}),
		)
		const result = await extract(
			makeJob({
				input: "Invoice from Acme Corp, total $1250",
				fields: ["vendorName", "totalAmount"],
			}),
			cfg,
		)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.extracted).toEqual({ vendorName: "Acme Corp", totalAmount: 1250.0 })
			expect(result.variables.missingFields).toEqual([])
		}
	})

	it("returns complete even when some fields are missing", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue(
			JSON.stringify({
				extracted: { vendorName: "Acme Corp", invoiceDate: null },
				missingFields: ["invoiceDate"],
			}),
		)
		const result = await extract(
			makeJob({ input: "Invoice from Acme Corp", fields: ["vendorName", "invoiceDate"] }),
			cfg,
		)
		expect(result.outcome).toBe("complete")
		if (result.outcome === "complete") {
			expect(result.variables.missingFields).toEqual(["invoiceDate"])
		}
	})

	it("returns error when fields variable is missing", async () => {
		const result = await extract(makeJob({ input: "text" }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") expect(result.errorCode).toBe("AI_INVALID_INPUT")
	})

	it("returns error on parse failure", async () => {
		vi.spyOn(llmModule, "callLlm").mockResolvedValue("The fields are: name=Acme")
		const result = await extract(makeJob({ input: "text", fields: ["name"] }), cfg)
		expect(result.outcome).toBe("error")
		if (result.outcome === "error") expect(result.errorCode).toBe("AI_PARSE_ERROR")
	})

	it("returns fail on RetryableError", async () => {
		vi.spyOn(llmModule, "callLlm").mockRejectedValue(new llmModule.RetryableError("rate limited"))
		const result = await extract(makeJob({ input: "text", fields: ["name"] }), cfg)
		expect(result.outcome).toBe("fail")
	})
})
