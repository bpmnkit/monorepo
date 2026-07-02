import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { executeCompactDsl } from "./compact-executor.js"

describe("executeCompactDsl", () => {
	it("produces valid BPMN XML for a simple process", () => {
		const dsl = `process P "Simple"
start s "Start"
end e "End"
s -> e
`
		const xml = executeCompactDsl(dsl)
		expect(xml).toContain("<?xml")
		expect(xml).toContain('id="P"')
		expect(xml).toContain("bpmn:startEvent")
		expect(xml).toContain("bpmn:endEvent")
	})

	it("throws when the DSL is malformed", () => {
		expect(() => executeCompactDsl("not valid dsl")).toThrow()
	})

	it("produces valid BPMN XML for the loan-approval fixture", () => {
		const dsl = readFileSync(
			fileURLToPath(new URL("./fixtures/loan-approval.dsl", import.meta.url)),
			"utf-8",
		)
		const xml = executeCompactDsl(dsl)
		expect(xml).toContain("bpmn:process")
		expect(xml).toContain('id="LoanApproval"')
	})
})
