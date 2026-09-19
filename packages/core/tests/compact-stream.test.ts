import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"

import { Bpmn, compactify, createCompactStream } from "../src/index.js"
import type { BpmnDefinitions } from "../src/index.js"

/**
 * Captured from a real `claude --include-partial-messages` run: the argument
 * the model streamed into `mcp__bpmn__replace_diagram` when asked for a
 * customer order process. The wrapper it opens with — `{"diagram": {` — does
 * not close until the final two characters, which is the whole reason a stream
 * cannot be read by parsing it.
 */
const STREAMED = readFileSync(
	fileURLToPath(new URL("./recordings/streamed-replace-diagram.json", import.meta.url)),
	"utf8",
)

/** Feeds text one character at a time, the worst case a token stream can be. */
function drip(
	text: string,
	base?: Parameters<typeof createCompactStream>[0],
): {
	frames: BpmnDefinitions[]
	firstAt: number
} {
	const stream = createCompactStream(base)
	const frames: BpmnDefinitions[] = []
	let firstAt = -1
	for (let i = 0; i < text.length; i++) {
		const frame = stream.push(text[i] as string)
		if (frame) {
			if (firstAt < 0) firstAt = i + 1
			frames.push(frame)
		}
	}
	return { frames, firstAt }
}

const names = (defs: BpmnDefinitions): string[] =>
	defs.processes[0]?.flowElements.map((el) => el.name ?? el.id) ?? []

describe("createCompactStream", () => {
	describe("a real streamed tool argument", () => {
		const { frames, firstAt } = drip(STREAMED)

		it("renders long before the document is parseable", () => {
			expect(() => JSON.parse(STREAMED.slice(0, firstAt))).toThrow()
			expect(firstAt).toBeLessThan(STREAMED.length / 2)
		})

		it("reaches the diagram the model was writing", () => {
			const last = frames.at(-1)
			expect(last).toBeDefined()
			expect(names(last as BpmnDefinitions)).toEqual([
				"Order Received",
				"Check Stock",
				"In Stock?",
				"Charge Card",
				"Ship Order",
				"Notify Customer of Unavailability",
				"Order Fulfilled",
				"Order Cancelled",
			])
			expect((last as BpmnDefinitions).processes[0]?.sequenceFlows).toHaveLength(7)
		})

		it("only ever grows — a frame never drops what an earlier one showed", () => {
			let previous = 0
			for (const frame of frames) {
				const count = frame.processes[0]?.flowElements.length ?? 0
				expect(count).toBeGreaterThanOrEqual(previous)
				previous = count
			}
		})

		it("gives every frame to a renderer, not just the last", () => {
			expect(frames.length).toBeGreaterThan(5)
			for (const frame of frames) expect(() => Bpmn.export(frame)).not.toThrow()
		})
	})

	it("shows the diagram being edited, not the fragment being added to it", () => {
		const base = compactify(
			Bpmn.parse(
				Bpmn.export(
					Bpmn.createProcess("Process_1")
						.name("Order")
						.startEvent("start", { name: "Order Received" })
						.build(),
				),
			),
		)
		const { frames } = drip(
			'{"processId":"Process_1","elements":[{"id":"ship","type":"serviceTask","name":"Ship Order"}],"flows":[{"id":"f1","from":"start","to":"ship"}]}',
			{ base },
		)
		const last = frames.at(-1) as BpmnDefinitions
		expect(names(last)).toEqual(["Order Received", "Ship Order"])
		expect(last.processes[0]?.sequenceFlows).toHaveLength(1)
		expect(last.processes[0]?.id).toBe("Process_1")
	})

	it("takes an element whose own nested objects close before it does", () => {
		const { frames } = drip(
			'{"elements":[{"id":"call","type":"serviceTask","name":"Fetch Order","jobType":"io.camunda:http-json:1","taskHeaders":{"url":"https://example.com","method":"GET"}}]}',
		)
		const last = frames.at(-1) as BpmnDefinitions
		expect(names(last)).toEqual(["Fetch Order"])
	})

	it("keeps a container's contents inside it rather than beside it", () => {
		const { frames } = drip(
			'{"elements":[{"id":"sub","type":"subProcess","name":"Handle Payment","children":{"elements":[{"id":"inner","type":"serviceTask","name":"Charge Card"}],"flows":[]}}]}',
		)
		const last = frames.at(-1) as BpmnDefinitions
		expect(names(last)).toEqual(["Handle Payment"])
	})

	it("ignores a default flow rather than throwing when its gateway is still to come", () => {
		const { frames } = drip(
			'{"flows":[{"id":"f1","from":"gw","to":"end","isDefault":true}],"elements":[{"id":"gw","type":"exclusiveGateway","name":"Valid?"},{"id":"end","type":"endEvent","name":"Done"}]}',
		)
		const last = frames.at(-1) as BpmnDefinitions
		expect(names(last)).toEqual(["Valid?", "Done"])
		expect(last.processes[0]?.flowElements[0]?.type).toBe("exclusiveGateway")
	})

	it("reads the same elements out of prose as out of a tool argument", () => {
		const prose = [
			"Here is the process you asked for:",
			"```json",
			'{ "id": "D", "processes": [ { "id": "P", "elements": [',
			'  { "id": "start", "type": "startEvent", "name": "Order Received" },',
			'  { "id": "end", "type": "endEvent", "name": "Order Fulfilled" }',
			'], "flows": [{ "id": "f1", "from": "start", "to": "end" }] } ] }',
			"```",
		].join("\n")
		const last = drip(prose).frames.at(-1) as BpmnDefinitions
		expect(names(last)).toEqual(["Order Received", "Order Fulfilled"])
	})

	it("reports nothing for text that carries no diagram", () => {
		const { frames } = drip('I\'ll build that for you. { not json } {"a": 1}')
		expect(frames).toEqual([])
	})

	it("never throws, whatever it is fed", () => {
		const stream = createCompactStream()
		expect(() => {
			stream.push('{"id":"x","type":"notAType"}')
			stream.push('{"id":"","type":"startEvent"}')
			stream.push('{"id":"y","type":"startEvent","name":')
			stream.push("}}}]]]")
			stream.push('{"id":"z","from":"a"}')
		}).not.toThrow()
	})
})
