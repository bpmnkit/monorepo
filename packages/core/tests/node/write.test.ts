import {
	chmodSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Bpmn } from "../../src/bpmn/index.js"
import { semanticHash } from "../../src/bpmn/semantic-hash.js"
import { sha256Hex } from "../../src/bpmn/sha256.js"
import { WriteError } from "../../src/errors.js"
import { writeBpmn } from "../../src/node/write.js"

const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S" name="Start"><bpmn:outgoing>F</bpmn:outgoing></bpmn:startEvent>
    <bpmn:endEvent id="E"><bpmn:incoming>F</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`

describe("writeBpmn", () => {
	let directory: string
	let output: string

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), "bpmnkit-write-"))
		output = join(directory, "flow.bpmn")
	})

	afterEach(() => {
		rmSync(directory, { force: true, recursive: true })
	})

	function temporaries(): string[] {
		return readdirSync(directory).filter((name) => name.endsWith(".tmp"))
	}

	it("writes a model that reads back as the same model", async () => {
		const definitions = Bpmn.parse(MINIMAL)
		const result = await writeBpmn(definitions, { output })

		expect(result.destination).toBe(output)
		expect(result.semanticHash).toBe(semanticHash(definitions))
		expect(semanticHash(Bpmn.parse(readFileSync(output, "utf-8")))).toBe(result.semanticHash)
	})

	it("reports the bytes and digest of what it actually wrote", async () => {
		const result = await writeBpmn(Bpmn.parse(MINIMAL), { output })
		const written = readFileSync(output, "utf-8")

		expect(result.bytes).toBe(Buffer.byteLength(written, "utf-8"))
		expect(result.outputSha256).toBe(sha256Hex(written))
	})

	it("leaves no temporary file behind", async () => {
		await writeBpmn(Bpmn.parse(MINIMAL), { output })
		expect(temporaries()).toEqual([])
	})

	it("refuses to replace an existing file", async () => {
		writeFileSync(output, "existing", "utf-8")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output })).rejects.toBeInstanceOf(WriteError)
		expect(readFileSync(output, "utf-8")).toBe("existing")
		expect(temporaries()).toEqual([])
	})

	it("says how to replace it", async () => {
		writeFileSync(output, "existing", "utf-8")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output })).rejects.toThrow(/force: true/)
	})

	it("replaces an existing file when forced", async () => {
		writeFileSync(output, "existing", "utf-8")
		await writeBpmn(Bpmn.parse(MINIMAL), { output, force: true })
		expect(readFileSync(output, "utf-8")).toContain("<bpmn:definitions")
	})

	it("keeps the permissions the replaced file had", async () => {
		writeFileSync(output, "existing", "utf-8")
		chmodSync(output, 0o640)
		await writeBpmn(Bpmn.parse(MINIMAL), { output, force: true })
		expect(statSync(output).mode & 0o777).toBe(0o640)
	})

	it("reports no changes when creating a new file", async () => {
		const result = await writeBpmn(Bpmn.parse(MINIMAL), { output })
		expect(result.changes).toBeUndefined()
	})

	it("reports what it changed about the file it replaced", async () => {
		await writeBpmn(Bpmn.parse(MINIMAL), { output })

		const edited = Bpmn.parse(MINIMAL)
		const start = edited.processes[0]?.flowElements[0]
		if (start) start.name = "Request received"

		const result = await writeBpmn(edited, { output, force: true })
		expect(result.changes?.changed.map((entry) => entry.id)).toEqual(["S"])
		expect(result.changes?.added).toEqual([])
		expect(result.changes?.removed).toEqual([])
	})

	it("still writes when the file being replaced cannot be parsed", async () => {
		writeFileSync(output, "not bpmn at all", "utf-8")
		const result = await writeBpmn(Bpmn.parse(MINIMAL), { output, force: true })
		expect(result.changes).toBeUndefined()
		expect(readFileSync(output, "utf-8")).toContain("<bpmn:definitions")
	})

	it("regenerates the diagram on layout auto without changing the model", async () => {
		const definitions = Bpmn.parse(MINIMAL)
		const before = semanticHash(definitions)

		const result = await writeBpmn(definitions, { output, layout: "auto" })

		expect(result.semanticHash).toBe(before)
		expect(readFileSync(output, "utf-8")).toContain("BPMNShape")
	})

	it("does not mutate the model it was given", async () => {
		const definitions = Bpmn.parse(MINIMAL)
		const snapshot = JSON.stringify(definitions)
		await writeBpmn(definitions, { output, layout: "auto" })
		expect(JSON.stringify(definitions)).toBe(snapshot)
	})

	it("preserves the diagram by default", async () => {
		const definitions = Bpmn.parse(Bpmn.SAMPLE_XML)
		const positions = definitions.diagrams[0]?.plane.shapes.map((shape) => shape.bounds.x)

		await writeBpmn(definitions, { output })

		const written = Bpmn.parse(readFileSync(output, "utf-8"))
		expect(written.diagrams[0]?.plane.shapes.map((shape) => shape.bounds.x)).toEqual(positions)
	})

	it("lets exactly one of two concurrent writes create the file", async () => {
		// Both calls see the destination missing, so the early guard passes for
		// each and only the exclusive create at the end can separate them. This is
		// the race the hard link exists for.
		const results = await Promise.allSettled([
			writeBpmn(Bpmn.parse(MINIMAL), { output }),
			writeBpmn(Bpmn.parse(MINIMAL), { output }),
		])

		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
		const rejected = results.find((result) => result.status === "rejected")
		expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(WriteError)
		expect(readFileSync(output, "utf-8")).toContain("<bpmn:definitions")
		expect(temporaries()).toEqual([])
	})

	it("fails when the destination directory does not exist", async () => {
		const missing = join(directory, "nope", "flow.bpmn")
		await expect(writeBpmn(Bpmn.parse(MINIMAL), { output: missing })).rejects.toBeInstanceOf(
			WriteError,
		)
	})
})
