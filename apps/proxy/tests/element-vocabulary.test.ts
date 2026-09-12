import { allElementTypes } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"

import { elementTypeDescription } from "../src/element-vocabulary.js"
import { COMPACT_FORMAT } from "../src/prompt.js"

/**
 * The MCP tool schema used to name its element types in a hand-written string,
 * and that string fell behind: it advertised 18 types while the compact path
 * accepted 23. An agent had no way to discover `receiveTask`, `task`,
 * `complexGateway`, `transaction` or `eventSubProcess`, so it reached for the
 * XML instead. The description is now rendered from the core catalog.
 */
describe("element type description", () => {
	const description = elementTypeDescription()

	it("names every element type the SDK models", () => {
		const missing = allElementTypes().filter((type) => !description.includes(type))
		expect(
			missing,
			"These types are modelled but absent from the tool schema description.",
		).toEqual([])
	})

	it("names the five that used to be missing", () => {
		for (const type of [
			"receiveTask",
			"task",
			"complexGateway",
			"transaction",
			"eventSubProcess",
		]) {
			expect(description, `${type} is not advertised`).toContain(type)
		}
	})

	it("lists every group", () => {
		for (const label of ["Events:", "Tasks:", "Gateways:", "Containers:", "Data:"]) {
			expect(description).toContain(label)
		}
	})
})

/**
 * The compact-format prompt is the other list the model reads, and it carries
 * per-type hints ("add formId", "add decisionId") that no generator can write.
 * So it stays hand-written — but it has to stay complete, which is what this
 * enforces. A type absent from the prompt is a type the model will not use.
 */
describe("the compact-format prompt", () => {
	const prompt = COMPACT_FORMAT

	it("mentions every element type", () => {
		const missing = allElementTypes().filter((type) => !new RegExp(`\\b${type}\\b`).test(prompt))
		expect(
			missing,
			"These types are modelled but the prompt never names them, so the model will not emit them. Add them to COMPACT_FORMAT with whatever hint they need.",
		).toEqual([])
	})
})
