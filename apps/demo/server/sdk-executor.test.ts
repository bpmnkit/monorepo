import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { executeSdkCode } from "./sdk-executor.js"

const REPO_ROOT = join(fileURLToPath(import.meta.url), "../../../..")

describe("executeSdkCode", () => {
	it("executes valid SDK code and returns BPMN XML", async () => {
		const tsCode = `
import { Bpmn } from "@bpmnkit/core"
const definitions = Bpmn.createProcess("test-process")
  .name("Test Process")
  .startEvent("start", { name: "Start" })
  .endEvent("end", { name: "End" })
  .build()
process.stdout.write(Bpmn.export(definitions))
`
		const xml = await executeSdkCode(tsCode, REPO_ROOT)
		expect(xml).toContain("<?xml")
		expect(xml).toContain("bpmn:definitions")
		expect(xml).toContain("test-process")
	}, 30_000)

	it("throws on invalid TypeScript", async () => {
		await expect(executeSdkCode("THIS IS NOT VALID TS @@@", REPO_ROOT)).rejects.toThrow()
	}, 15_000)

	it("throws when code writes nothing to stdout", async () => {
		await expect(executeSdkCode("const x = 1", REPO_ROOT)).rejects.toThrow("no output")
	}, 15_000)
})
