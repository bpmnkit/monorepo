import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Bpmn, expand } from "@bpmnkit/core"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { watchOutputFile } from "../src/preview-watch.js"

/**
 * The diagram used to appear only once the model stopped talking: `/chat` read
 * the MCP output file a single time, after the adapter stream resolved. That
 * file is rewritten on every mutating tool call, so the shape of the process is
 * on disk long before then. These cover turning those writes into preview
 * frames without ever reporting one that will not render.
 */
describe("watchOutputFile", () => {
	let dir: string
	let file: string
	let stop: (() => void) | null

	/** What the MCP server writes after a tool call adds one task. */
	const xmlWith = (taskName: string): string =>
		Bpmn.export(
			expand({
				id: "Definitions_1",
				processes: [
					{
						id: "Process_1",
						elements: [
							{ id: "start", type: "startEvent", name: "Order Received" },
							{ id: "t1", type: "serviceTask", name: taskName },
						],
						flows: [{ id: "f1", from: "start", to: "t1" }],
					},
				],
			}),
		)

	beforeEach(() => {
		dir = mkdtempSync(join(tmpdir(), "preview-watch-"))
		file = join(dir, "output.json")
		stop = null
	})

	afterEach(() => {
		stop?.()
		rmSync(dir, { recursive: true, force: true })
	})

	it("reports each write, so a diagram built over several tool calls arrives as frames", async () => {
		const frames: string[] = []
		stop = watchOutputFile(dir, file, (xml) => frames.push(xml))

		writeFileSync(file, xmlWith("Charge Card"))
		await vi.waitFor(() => expect(frames).toHaveLength(1))

		writeFileSync(file, xmlWith("Ship Order"))
		await vi.waitFor(() => expect(frames).toHaveLength(2))

		expect(frames[0]).toContain("Charge Card")
		expect(frames[1]).toContain("Ship Order")
	})

	it("waits for the file the MCP server only creates on its first tool call", async () => {
		const frames: string[] = []
		stop = watchOutputFile(dir, file, (xml) => frames.push(xml))

		writeFileSync(join(dir, "mcp.json"), "{}")
		writeFileSync(file, xmlWith("Charge Card"))

		await vi.waitFor(() => expect(frames).toHaveLength(1))
		expect(frames[0]).toContain("Charge Card")
	})

	it("never reports XML that will not parse", async () => {
		const frames: string[] = []
		stop = watchOutputFile(dir, file, (xml) => frames.push(xml))

		// A read can land between the open and the flush. Whether this run catches
		// the truncated state is up to the OS; that no frame carries it is not.
		writeFileSync(file, xmlWith("Charge Card").slice(0, 120))
		writeFileSync(file, xmlWith("Charge Card"))

		await vi.waitFor(() => expect(frames.length).toBeGreaterThan(0))
		for (const frame of frames) expect(() => Bpmn.parse(frame)).not.toThrow()
	})

	it("does not repeat a frame when the watcher fires twice for one write", async () => {
		const frames: string[] = []
		stop = watchOutputFile(dir, file, (xml) => frames.push(xml))

		const xml = xmlWith("Charge Card")
		writeFileSync(file, xml)
		writeFileSync(file, xml)

		await vi.waitFor(() => expect(frames).toHaveLength(1))
		writeFileSync(file, xmlWith("Ship Order"))
		await vi.waitFor(() => expect(frames).toHaveLength(2))
	})
})
