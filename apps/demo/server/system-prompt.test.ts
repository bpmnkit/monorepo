import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { WITHOUT_SDK_SYSTEM_PROMPT, buildSdkSystemPrompt } from "./system-prompt.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../../")

describe("buildSdkSystemPrompt", () => {
	it("returns a non-empty string", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(typeof prompt).toBe("string")
		expect(prompt.length).toBeGreaterThan(500)
	})

	it("includes the SDK package name", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("@bpmnkit/core")
	})

	it("includes the example loan approval code", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("LoanApproval")
	})

	it("includes the output instruction", () => {
		const prompt = buildSdkSystemPrompt(REPO_ROOT)
		expect(prompt).toContain("process.stdout.write")
	})
})

describe("WITHOUT_SDK_SYSTEM_PROMPT", () => {
	it("instructs raw XML output", () => {
		expect(WITHOUT_SDK_SYSTEM_PROMPT).toContain("XML")
	})
})
