import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { orderXml } from "./fixtures.test-helpers.js"
import { etagOf } from "./project.js"
import { WriteError, writeVerified } from "./write.js"

let dir: string
let file: string

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), "casen-dev-write-"))
	file = join(dir, "order.bpmn")
})

afterEach(() => {
	rmSync(dir, { recursive: true, force: true })
})

/** The fixture as someone else's tool might have written it: twice the indentation. */
function handFormatted(xml: string): string {
	return xml.replace(/^( +)/gm, (indent) => indent + indent)
}

async function rejection(promise: Promise<unknown>): Promise<WriteError> {
	try {
		await promise
	} catch (error) {
		if (error instanceof WriteError) return error
		throw error
	}
	throw new Error("expected the write to be refused")
}

describe("writeVerified", () => {
	it("writes an edit into the existing file, keeping its formatting", async () => {
		const original = handFormatted(orderXml())
		writeFileSync(file, original)

		const result = await writeVerified(file, "bpmn", orderXml("Reserve stock"), etagOf(original))

		const onDisk = readFileSync(file, "utf8")
		expect(result.outcome).toBe("preserved")
		expect(result.text).toBe(onDisk)
		expect(result.etag).toBe(etagOf(onDisk))
		const before = original.split("\n")
		const after = onDisk.split("\n")
		expect(after).toHaveLength(before.length)
		const changed = after.filter((line, i) => line !== before[i])
		expect(changed).toHaveLength(1)
		expect(changed[0]).toContain('name="Reserve stock"')
	})

	it("refuses a write based on an older version of the file", async () => {
		writeFileSync(file, orderXml())
		const error = await rejection(
			writeVerified(file, "bpmn", orderXml("Mine"), etagOf("something older")),
		)
		expect(error.status).toBe(409)
		expect(error.currentEtag).toBe(etagOf(orderXml()))
		expect(readFileSync(file, "utf8")).toBe(orderXml())
	})

	it("refuses to create a file that already exists", async () => {
		writeFileSync(file, orderXml())
		const error = await rejection(writeVerified(file, "bpmn", orderXml("Mine"), null))
		expect(error.status).toBe(409)
	})

	it("refuses a document that does not parse, and leaves the file alone", async () => {
		writeFileSync(file, orderXml())
		const error = await rejection(writeVerified(file, "bpmn", "<not-bpmn", etagOf(orderXml())))
		expect(error.status).toBe(400)
		expect(error.message).toMatch(/does not parse as bpmn/)
		expect(readFileSync(file, "utf8")).toBe(orderXml())
	})

	it("refuses a tests sidecar that is not a list of scenarios", async () => {
		const sidecar = join(dir, "order.bpmn.tests.json")
		const error = await rejection(writeVerified(sidecar, "tests", '{"id":"x"}', null))
		expect(error.status).toBe(400)
	})

	it("creates a new tests sidecar and leaves no temporary file behind", async () => {
		const sidecar = join(dir, "order.bpmn.tests.json")
		const result = await writeVerified(sidecar, "tests", "[]\n", null)
		expect(result.outcome).toBe("created")
		expect(readFileSync(sidecar, "utf8")).toBe("[]\n")
		expect(readdirSync(dir)).toEqual(["order.bpmn.tests.json"])
	})
})
