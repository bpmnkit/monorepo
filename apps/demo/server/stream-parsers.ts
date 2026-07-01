import type { TokenUsage } from "../shared/recording-types.js"

/**
 * Defensively extracts streamed text from one line of the `claude` CLI's
 * `--output-format stream-json --include-partial-messages` NDJSON output.
 * Returns null for any line that isn't a text delta — this is untrusted
 * subprocess output, so every field is checked before use.
 */
export function extractDeltaText(event: unknown): string | null {
	if (typeof event !== "object" || event === null) return null
	if (!("type" in event) || event.type !== "stream_event") return null
	if (!("event" in event) || typeof event.event !== "object" || event.event === null) return null
	const inner = event.event as Record<string, unknown>
	if (inner.type !== "content_block_delta") return null
	if (typeof inner.delta !== "object" || inner.delta === null) return null
	const delta = inner.delta as Record<string, unknown>
	if (delta.type !== "text_delta") return null
	return typeof delta.text === "string" ? delta.text : null
}

/**
 * Defensively extracts token usage from the `claude` CLI's final NDJSON
 * `result` line for a `-p` run. Returns null for any non-matching or
 * malformed line — same untrusted-input posture as extractDeltaText.
 */
export function extractResultUsage(event: unknown): TokenUsage | null {
	if (typeof event !== "object" || event === null) return null
	if (!("type" in event) || event.type !== "result") return null
	if (!("usage" in event) || typeof event.usage !== "object" || event.usage === null) return null
	const usage = event.usage as Record<string, unknown>
	if (typeof usage.input_tokens !== "number" || typeof usage.output_tokens !== "number") return null
	return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens }
}
