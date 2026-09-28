import type { CanvasApi } from "@bpmnkit/canvas"
import { describe, expect, it } from "vitest"
import { createTokenHighlightPlugin } from "../../src/token-highlight/index.js"

const SVG_NS = "http://www.w3.org/2000/svg"

function setup(): {
	shape: SVGGElement
	emit: (event: Record<string, unknown>) => void
} {
	const viewportEl = document.createElementNS(SVG_NS, "g")
	const shape = document.createElementNS(SVG_NS, "g")
	shape.setAttribute("data-bpmnkit-id", "task")
	viewportEl.appendChild(shape)

	const plugin = createTokenHighlightPlugin()
	plugin.install({ viewportEl, on: () => () => {} } as unknown as CanvasApi)

	let listener: (event: Record<string, unknown>) => void = () => {}
	plugin.api.trackInstance({
		onChange(cb) {
			listener = cb
			return () => {}
		},
	})
	return { shape, emit: (event) => listener(event) }
}

describe("token highlight — trackInstance", () => {
	it("clears the active highlight of an element an interrupting event terminated", () => {
		const { shape, emit } = setup()
		emit({ type: "element:entering", elementId: "task" })
		expect(shape.classList.contains("bpmnkit-token-active")).toBe(true)

		emit({ type: "element:terminated", elementId: "task" })
		expect(shape.classList.contains("bpmnkit-token-active")).toBe(false)
		expect(shape.classList.contains("bpmnkit-token-visited")).toBe(false)
	})
})
