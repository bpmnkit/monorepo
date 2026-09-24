import { describe, expect, it } from "vitest"
import type { CheckResult } from "./protocol.js"
import { formatCheckDetails, formatCheckLine, formatTally, paint } from "./report.js"

const plain = paint(false)

const green: CheckResult = {
	path: "orders/order.bpmn",
	kind: "bpmn",
	at: "2026-09-24T10:00:00.000Z",
	lint: { errors: 0, warnings: 1, infos: 0, findings: [] },
	tests: {
		engine: "ts",
		passed: 2,
		failed: 0,
		scenarios: [
			{ name: "a", passed: true, durationMs: 1, problems: [] },
			{ name: "b", passed: true, durationMs: 1, problems: [] },
		],
	},
}

const red: CheckResult = {
	...green,
	path: "refund.bpmn",
	lint: {
		errors: 1,
		warnings: 0,
		infos: 0,
		findings: [{ severity: "error", category: "flow", message: "Dead end", elementIds: ["t1"] }],
	},
	tests: {
		engine: "wasm",
		passed: 0,
		failed: 1,
		scenarios: [{ name: "refunds", passed: false, durationMs: 3, problems: ["variables.x: nope"] }],
	},
}

describe("casen dev terminal report", () => {
	it("prints one line per file", () => {
		expect(formatCheckLine(green, plain)).toBe("✓ orders/order.bpmn  lint 0✖ 1⚠  tests 2/2")
		expect(formatCheckLine(red, plain)).toBe("✖ refund.bpmn  lint 1✖ 0⚠  tests 0/1 (wasm)")
		expect(
			formatCheckLine({ ...green, lint: undefined, tests: undefined, parseError: "x" }, plain),
		).toBe("✖ orders/order.bpmn  does not parse")
	})

	it("lists what failed under a failing file, and nothing under a passing one", () => {
		expect(formatCheckDetails(green)).toEqual([])
		expect(formatCheckDetails(red)).toEqual([
			"lint flow [t1]: Dead end",
			"FAIL refunds",
			"  variables.x: nope",
		])
	})

	it("caps the detail so one broken file cannot scroll the rest away", () => {
		const many: CheckResult = {
			...red,
			tests: {
				engine: "ts",
				passed: 0,
				failed: 10,
				scenarios: Array.from({ length: 10 }, (_, i) => ({
					name: `s${i}`,
					passed: false,
					durationMs: 1,
					problems: [],
				})),
			},
		}
		const lines = formatCheckDetails(many)
		expect(lines).toHaveLength(7)
		expect(lines[6]).toMatch(/^… 5 more/)
	})

	it("tallies the project", () => {
		expect(formatTally([green], plain)).toBe("1 file · all green")
		expect(formatTally([green, red], plain)).toBe("2 files · 1 failing: refund.bpmn")
	})
})
