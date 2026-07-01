import { describe, expect, it } from "vitest"
import { formatTokenCount } from "./format-tokens.js"

describe("formatTokenCount", () => {
	it("renders numbers under 1000 as-is", () => {
		expect(formatTokenCount(0)).toBe("0")
		expect(formatTokenCount(340)).toBe("340")
		expect(formatTokenCount(999)).toBe("999")
	})

	it("renders numbers at or above 1000 as one-decimal thousands", () => {
		expect(formatTokenCount(1000)).toBe("1.0k")
		expect(formatTokenCount(8140)).toBe("8.1k")
		expect(formatTokenCount(15999)).toBe("16.0k")
	})
})
