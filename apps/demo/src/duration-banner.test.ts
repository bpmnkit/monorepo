import { describe, expect, it } from "vitest"
import { buildDurationBanner } from "./duration-banner.js"
import type { PanelRunResult } from "./sources.js"

function result(durationMs: number): PanelRunResult {
	return { chunks: [], durationMs, result: { type: "bpmn", xml: "<xml/>" } }
}

describe("buildDurationBanner", () => {
	it("reports With SDK as faster when it finished first", () => {
		const banner = buildDurationBanner(result(12300), result(45100))
		expect(banner).toBe(
			"With SDK: 12.3s · Without SDK: 45.1s · With SDK was 3.7× faster than Without SDK",
		)
	})

	it("reports Without SDK as faster when it finished first", () => {
		const banner = buildDurationBanner(result(9000), result(3000))
		expect(banner).toBe(
			"With SDK: 9.0s · Without SDK: 3.0s · Without SDK was 3.0× faster than With SDK",
		)
	})

	it("handles equal durations without dividing by a larger-than-actual number", () => {
		const banner = buildDurationBanner(result(5000), result(5000))
		expect(banner).toBe(
			"With SDK: 5.0s · Without SDK: 5.0s · With SDK was 1.0× faster than Without SDK",
		)
	})
})
