import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { Bpmn, createCompactStream } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"

import { readStreamJsonLine } from "../src/adapters/claude.js"

/**
 * A recorded `claude --output-format stream-json --include-partial-messages`
 * run: the model was asked for a customer order process and reached for
 * `mcp__bpmn__replace_diagram`, after two calls to a tool of its own. Session
 * ids and thinking signatures are trimmed; the event shapes and their order are
 * the CLI's.
 */
const RECORDED = readFileSync(
	fileURLToPath(new URL("./recordings/claude-stream-json.jsonl", import.meta.url)),
	"utf8",
).split("\n")

function replay(): { text: string; toolInput: string } {
	const toolBlocks = new Map<number, string>()
	let text = ""
	let toolInput = ""
	for (const line of RECORDED) {
		readStreamJsonLine(
			line,
			toolBlocks,
			(chunk) => {
				text += chunk
			},
			(chunk) => {
				toolInput += chunk
			},
		)
	}
	return { text, toolInput }
}

describe("readStreamJsonLine", () => {
	const { text, toolInput } = replay()

	it("reassembles the diagram tool's arguments from its fragments", () => {
		const parsed = JSON.parse(toolInput) as { diagram: { processes: Array<{ id: string }> } }
		expect(parsed.diagram.processes[0]?.id).toBe("Process_OrderFulfillment")
	})

	it("leaves out the arguments of tools that are not building the diagram", () => {
		expect(toolInput).not.toContain("max_results")
		expect(toolInput).not.toContain("select:")
	})

	it("still reports assistant text, which is how the reply gets written", () => {
		expect(text).toContain("Order")
		expect(text.length).toBeGreaterThan(20)
	})

	it("ignores a partial-message stream it is not asked to read", () => {
		const toolBlocks = new Map<number, string>()
		let seen = ""
		for (const line of RECORDED) {
			readStreamJsonLine(line, toolBlocks, (chunk) => {
				seen += chunk
			})
		}
		expect(seen).toBe(text)
	})

	/**
	 * The point of the whole path: a diagram is renderable while its tool call is
	 * still being written, not only once it returns.
	 */
	it("yields a renderable diagram partway through the tool call", () => {
		const stream = createCompactStream()
		const toolBlocks = new Map<number, string>()
		let consumed = 0
		let firstFrameAfter = -1
		let frames = 0

		for (const line of RECORDED) {
			readStreamJsonLine(
				line,
				toolBlocks,
				() => {},
				(chunk) => {
					consumed += chunk.length
					const defs = stream.push(chunk)
					if (!defs) return
					frames++
					if (firstFrameAfter < 0) firstFrameAfter = consumed
					expect(() => Bpmn.export(defs)).not.toThrow()
				},
			)
		}

		expect(frames).toBeGreaterThan(3)
		expect(firstFrameAfter).toBeGreaterThan(0)
		expect(firstFrameAfter).toBeLessThan(toolInput.length / 2)
	})
})
