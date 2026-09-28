import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Bpmn } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { writeModelXml } from "../src/model-write.js"

describe("writeModelXml", () => {
	let dir: string
	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "model-write-"))
	})
	afterEach(() => {
		rmSync(dir, { recursive: true, force: true })
	})

	const xml = (name: string): string =>
		Bpmn.export(
			Bpmn.createProcess("p").startEvent("s").serviceTask("t", { name }).endEvent("e").build(),
		)

	it("writes BPMN that reads back as the same model", async () => {
		const path = join(dir, "flow.bpmn")
		const result = await writeModelXml(path, xml("Ship"))
		expect(result.changes).toBeNull()
		expect(Bpmn.parse(readFileSync(path, "utf8")).processes[0]?.id).toBe("p")
	})

	it("reports what an update changed", async () => {
		const path = join(dir, "flow.bpmn")
		await writeModelXml(path, xml("Ship"))
		const result = await writeModelXml(path, xml("Ship order"))
		expect(result.changes).toBe("0 added, 0 removed, 1 changed")
	})

	it("refuses XML that does not parse and leaves the file alone", async () => {
		const path = join(dir, "flow.bpmn")
		writeFileSync(path, "original")
		await expect(writeModelXml(path, "<not bpmn")).rejects.toThrow(/does not parse/)
		expect(readFileSync(path, "utf8")).toBe("original")
		expect(existsSync(join(dir, "other.bpmn"))).toBe(false)
	})
})
