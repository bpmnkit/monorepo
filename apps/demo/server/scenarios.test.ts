import { describe, expect, it } from "vitest"
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario } from "./scenarios.js"

describe("SCENARIOS", () => {
	it("has exactly loan-approval, quote-to-cash, and kyc in that order", () => {
		expect(SCENARIOS.map((s) => s.id)).toEqual(["loan-approval", "quote-to-cash", "kyc"])
	})

	it("each scenario prompt mentions its own domain", () => {
		const loanApproval = SCENARIOS.find((s) => s.id === "loan-approval")
		const quoteToCash = SCENARIOS.find((s) => s.id === "quote-to-cash")
		const kyc = SCENARIOS.find((s) => s.id === "kyc")
		expect(loanApproval?.prompt.toLowerCase()).toContain("loan")
		expect(quoteToCash?.prompt.toLowerCase()).toContain("quote")
		expect(kyc?.prompt.toLowerCase()).toContain("kyc")
	})

	it("each scenario has the output-only footer instruction", () => {
		for (const s of SCENARIOS) {
			expect(s.prompt).toContain("Output code only")
		}
	})
})

describe("DEFAULT_SCENARIO_ID", () => {
	it("is loan-approval", () => {
		expect(DEFAULT_SCENARIO_ID).toBe("loan-approval")
	})
})

describe("getScenario", () => {
	it("returns the matching scenario by id", () => {
		expect(getScenario("kyc")?.label).toBe("KYC")
	})

	it("returns undefined for an unknown id", () => {
		expect(getScenario("not-a-real-scenario")).toBeUndefined()
	})
})
