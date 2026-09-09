import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { Bpmn } from "../../src/bpmn/index.js"
import { WriteVerificationError } from "../../src/errors.js"
import { writeBpmn } from "../../src/node/write.js"

/**
 * The reason the write boundary exists: if serialising the model does not
 * reproduce it, the write must fail rather than put the damaged file on disk.
 *
 * The serialiser is replaced with one that drops content, which is the failure
 * mode this guards against — the real serialiser is correct, so the only honest
 * way to test the guard is to break it deliberately.
 */
vi.mock("../../src/bpmn/bpmn-serializer.js", async (importOriginal) => {
	const original = await importOriginal<typeof import("../../src/bpmn/bpmn-serializer.js")>()
	return {
		serializeBpmn: (definitions: Parameters<typeof original.serializeBpmn>[0]) => {
			const xml = original.serializeBpmn(definitions)
			return lossy
				? xml.replace(/<bpmn:endEvent[^>]*\/>|<bpmn:endEvent[\s\S]*?<\/bpmn:endEvent>/, "")
				: xml
		},
	}
})

let lossy = false

const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`

describe("writeBpmn verification", () => {
	let directory: string

	beforeAll(() => {
		directory = mkdtempSync(join(tmpdir(), "bpmnkit-write-verify-"))
	})

	afterAll(() => {
		lossy = false
		rmSync(directory, { force: true, recursive: true })
	})

	it("writes normally while the serialiser is intact", async () => {
		lossy = false
		const output = join(directory, "intact.bpmn")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output })).resolves.toMatchObject({
			destination: output,
		})
	})

	it("refuses the write when serialising loses an element", async () => {
		lossy = true
		const output = join(directory, "lossy.bpmn")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output })).rejects.toBeInstanceOf(
			WriteVerificationError,
		)
	})

	it("names the lost element in the error", async () => {
		lossy = true
		const output = join(directory, "named.bpmn")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output })).rejects.toThrow(/Lost: E\b/)
	})

	it("carries the diff on the error for a caller to inspect", async () => {
		lossy = true
		const output = join(directory, "diff.bpmn")
		const error = await writeBpmn(Bpmn.parse(MINIMAL), { output }).catch((thrown) => thrown)
		expect(error).toBeInstanceOf(WriteVerificationError)
		expect((error as WriteVerificationError).changes.removed).toEqual(["E"])
	})

	it("leaves nothing behind when it refuses — no file, no temporary", async () => {
		lossy = true
		const output = join(directory, "absent.bpmn")
		await writeBpmn(Bpmn.parse(MINIMAL), { output }).catch(() => undefined)
		expect(readdirSync(directory).filter((name) => name.includes("absent"))).toEqual([])
	})

	it("does not replace an existing good file with a damaged one", async () => {
		const output = join(directory, "guarded.bpmn")
		lossy = false
		await writeBpmn(Bpmn.parse(MINIMAL), { output })
		const good = readdirSync(directory).includes("guarded.bpmn")
		expect(good).toBe(true)

		lossy = true
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output, force: true })).rejects.toBeInstanceOf(
			WriteVerificationError,
		)
		// The original must still be the one that parses cleanly.
		const { readFileSync } = await import("node:fs")
		expect(Bpmn.parse(readFileSync(output, "utf-8")).processes[0]?.flowElements).toHaveLength(2)
	})
})
