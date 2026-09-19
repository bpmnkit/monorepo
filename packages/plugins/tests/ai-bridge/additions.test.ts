import { BpmnCanvas } from "@bpmnkit/canvas"
import { Bpmn, expand } from "@bpmnkit/core"
import type { BpmnDefinitions, CompactDiagram } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"

import { additionsToMark } from "../../src/ai-bridge/panel.js"

/**
 * A preview frame arriving mid-stream shows the diagram the AI is writing. What
 * it does not say on its own is which of it was already there, so the elements
 * it is adding are outlined — but only when there is a diagram to contrast them
 * with.
 */

const NEW_CLASS = "bpmnkit-highlight--new"

function diagram(
	elements: CompactDiagram["processes"][number]["elements"],
	flows: CompactDiagram["processes"][number]["flows"] = [],
): BpmnDefinitions {
	return expand({ id: "Definitions_1", processes: [{ id: "Process_1", elements, flows }] })
}

const ORDER_RECEIVED = { id: "start", type: "startEvent", name: "Order Received" } as const
const CHARGE_CARD = { id: "charge", type: "serviceTask", name: "Charge Card" } as const
const SHIP_ORDER = { id: "ship", type: "serviceTask", name: "Ship Order" } as const

describe("additionsToMark", () => {
	/** A process that is already connected — something additions can be new to. */
	const before = diagram([ORDER_RECEIVED, CHARGE_CARD], [{ id: "f1", from: "start", to: "charge" }])

	it("marks what the diagram being edited does not have", () => {
		expect(additionsToMark(before, ["start", "charge", "f1", "ship", "f2"])).toEqual(["ship", "f2"])
	})

	it("marks nothing when the AI has added nothing yet", () => {
		expect(additionsToMark(before, ["start", "charge", "f1"])).toEqual([])
	})

	it("marks nothing when there is no diagram at all", () => {
		expect(additionsToMark(null, ["start", "charge"])).toEqual([])
	})

	/**
	 * A new file in the editor is one unconnected start event, so "has elements"
	 * is not the question — everything the model then writes would be marked,
	 * which says no more than marking none of it.
	 */
	it("marks nothing against a blank file, which is a start event and no flows", () => {
		const blank = Bpmn.parse(Bpmn.makeEmpty("Process_1", "New Process"))
		expect(blank.processes[0]?.flowElements).toHaveLength(1)
		expect(additionsToMark(blank, ["StartEvent_Process_1", "charge", "ship"])).toEqual([])
	})

	it("counts a container's contents as already there", () => {
		const nested = diagram(
			[
				ORDER_RECEIVED,
				{
					id: "sub",
					type: "subProcess",
					name: "Handle Payment",
					children: { elements: [CHARGE_CARD], flows: [] },
				},
			],
			[{ id: "f1", from: "start", to: "sub" }],
		)
		expect(additionsToMark(nested, ["start", "sub", "charge", "ship"])).toEqual(["ship"])
	})
})

describe("marking a rendered preview", () => {
	const containers: HTMLElement[] = []
	const canvases: BpmnCanvas[] = []

	afterEach(() => {
		for (const canvas of canvases) canvas.destroy()
		canvases.length = 0
		for (const container of containers) container.remove()
		containers.length = 0
	})

	function render(defs: BpmnDefinitions): BpmnCanvas {
		const container = document.createElement("div")
		document.body.append(container)
		containers.push(container)
		const canvas = new BpmnCanvas({ container, xml: Bpmn.export(defs), grid: false })
		canvases.push(canvas)
		return canvas
	}

	/**
	 * The panel marks straight after `load` rather than from a
	 * `requestAnimationFrame`, which only holds if the shapes are on the DOM by
	 * the time it returns.
	 */
	it("lands the class on the shapes as soon as the frame is loaded", () => {
		const before = diagram(
			[ORDER_RECEIVED, CHARGE_CARD],
			[{ id: "f0", from: "start", to: "charge" }],
		)
		const canvas = render(
			diagram(
				[ORDER_RECEIVED, CHARGE_CARD, SHIP_ORDER],
				[
					{ id: "f0", from: "start", to: "charge" },
					{ id: "f1", from: "charge", to: "ship" },
				],
			),
		)

		const rendered: string[] = []
		canvas.forEachElement((el) => rendered.push(el.id))
		canvas.highlight(additionsToMark(before, rendered), "new")

		expect(canvas.hasMarker("ship", NEW_CLASS)).toBe(true)
		expect(canvas.hasMarker("f1", NEW_CLASS)).toBe(true)
		expect(canvas.hasMarker("start", NEW_CLASS)).toBe(false)
		expect(canvas.hasMarker("charge", NEW_CLASS)).toBe(false)
	})

	it("re-marks a frame that replaced the one before it", () => {
		const before = diagram(
			[ORDER_RECEIVED, CHARGE_CARD],
			[{ id: "f0", from: "start", to: "charge" }],
		)
		const canvas = render(
			diagram(
				[ORDER_RECEIVED, CHARGE_CARD, SHIP_ORDER],
				[
					{ id: "f0", from: "start", to: "charge" },
					{ id: "f1", from: "charge", to: "ship" },
				],
			),
		)

		const mark = (): void => {
			const rendered: string[] = []
			canvas.forEachElement((el) => rendered.push(el.id))
			canvas.highlight(additionsToMark(before, rendered), "new")
		}
		mark()
		expect(canvas.hasMarker("ship", NEW_CLASS)).toBe(true)

		// `load` clears highlights, so the next frame has to mark again — including
		// the element that arrived with it.
		canvas.load(
			Bpmn.export(
				diagram(
					[ORDER_RECEIVED, CHARGE_CARD, SHIP_ORDER, { id: "end", type: "endEvent" }],
					[
						{ id: "f0", from: "start", to: "charge" },
						{ id: "f1", from: "charge", to: "ship" },
						{ id: "f2", from: "ship", to: "end" },
					],
				),
			),
			{ keepViewport: true },
		)
		expect(canvas.hasMarker("ship", NEW_CLASS)).toBe(false)
		mark()
		expect(canvas.hasMarker("ship", NEW_CLASS)).toBe(true)
		expect(canvas.hasMarker("end", NEW_CLASS)).toBe(true)
		expect(canvas.hasMarker("start", NEW_CLASS)).toBe(false)
	})
})
