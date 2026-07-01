import { describe, expect, it } from "vitest"
import { buildComparisonBanner } from "./comparison-banner.js"
import type { PanelRunResult } from "./sources.js"

function result(
	durationMs: number,
	usage?: { inputTokens: number; outputTokens: number },
): PanelRunResult {
	return { chunks: [], durationMs, usage: usage ?? null, result: { type: "bpmn", xml: "<xml/>" } }
}

describe("buildComparisonBanner", () => {
	it("reports With SDK as faster when it finished first (no usage data)", () => {
		const banner = buildComparisonBanner(result(12300), result(45100))
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})

	it("reports Without SDK as faster when it finished first (no usage data)", () => {
		const banner = buildComparisonBanner(result(9000), result(3000))
		expect(banner).toBe(
			"With SDK: 9.0s · Without SDK: 3.0s · Without SDK was 3.0× faster than With SDK",
		)
	})

	it("handles equal durations without dividing by a larger-than-actual number", () => {
		const banner = buildComparisonBanner(result(5000), result(5000))
		expect(banner).toBe(
			"With SDK: 5.0s · Without SDK: 5.0s · With SDK was 1.0× faster than Without SDK",
		)
	})

	it("includes token usage when both sides have it, naming With SDK as using more input tokens", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 8100, outputTokens: 340 }),
			result(45100, { inputTokens: 450, outputTokens: 890 }),
		)
		expect(banner).toBe(
			"With SDK: 12.3s, 8.1k in / 340 out · " +
				"Without SDK: 45.1s, 450 in / 890 out · " +
				"With SDK was 3.7× faster than Without SDK, " +
				"With SDK used 18.0× more input tokens than Without SDK",
		)
	})

	it("names Without SDK as using more input tokens when it actually does", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 100, outputTokens: 50 }),
			result(45100, { inputTokens: 900, outputTokens: 890 }),
		)
		expect(banner).toBe(
			"With SDK: 12.3s, 100 in / 50 out · " +
				"Without SDK: 45.1s, 900 in / 890 out · " +
				"With SDK was 3.7× faster than Without SDK, " +
				"Without SDK used 9.0× more input tokens than With SDK",
		)
	})

	it("falls back to the duration-only line when only one side has usage data", () => {
		const banner = buildComparisonBanner(
			result(12300, { inputTokens: 8100, outputTokens: 340 }),
			result(45100),
		)
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})
})
