import { describe, expect, it } from "vitest"
import { extractDeltaText, extractResultUsage } from "./stream-parsers.js"

describe("extractDeltaText", () => {
	it("extracts text from a valid content_block_delta line", () => {
		const line = {
			type: "stream_event",
			event: { type: "content_block_delta", delta: { type: "text_delta", text: "hello" } },
		}
		expect(extractDeltaText(line)).toBe("hello")
	})

	it("returns null for a non-stream_event line", () => {
		expect(extractDeltaText({ type: "result", usage: {} })).toBeNull()
	})

	it("returns null for a stream_event that isn't a content_block_delta", () => {
		const line = { type: "stream_event", event: { type: "message_start" } }
		expect(extractDeltaText(line)).toBeNull()
	})

	it("returns null for a content_block_delta that isn't a text_delta", () => {
		const line = {
			type: "stream_event",
			event: { type: "content_block_delta", delta: { type: "input_json_delta" } },
		}
		expect(extractDeltaText(line)).toBeNull()
	})

	it("returns null for non-object input", () => {
		expect(extractDeltaText(null)).toBeNull()
		expect(extractDeltaText("not an object")).toBeNull()
		expect(extractDeltaText(42)).toBeNull()
	})
})

describe("extractResultUsage", () => {
	it("extracts and maps usage from a valid result line", () => {
		const line = { type: "result", usage: { input_tokens: 355, output_tokens: 5311 } }
		expect(extractResultUsage(line)).toEqual({ inputTokens: 355, outputTokens: 5311 })
	})

	it("returns null for a non-result line", () => {
		const line = { type: "stream_event", event: { type: "message_start" } }
		expect(extractResultUsage(line)).toBeNull()
	})

	it("returns null when usage is missing", () => {
		expect(extractResultUsage({ type: "result" })).toBeNull()
	})

	it("returns null when usage is not an object", () => {
		expect(extractResultUsage({ type: "result", usage: "not an object" })).toBeNull()
	})

	it("returns null when input_tokens or output_tokens is missing or the wrong type", () => {
		expect(extractResultUsage({ type: "result", usage: { output_tokens: 5311 } })).toBeNull()
		expect(extractResultUsage({ type: "result", usage: { input_tokens: 355 } })).toBeNull()
		expect(
			extractResultUsage({
				type: "result",
				usage: { input_tokens: "355", output_tokens: 5311 },
			}),
		).toBeNull()
	})

	it("returns null for non-object input", () => {
		expect(extractResultUsage(null)).toBeNull()
		expect(extractResultUsage("not an object")).toBeNull()
		expect(extractResultUsage(42)).toBeNull()
	})
})
