import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import { DIFF_STYLE_ID, createBpmnDiff } from "../../src/diff/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeXml(options: { taskX?: number; taskName?: string; extraTask?: boolean } = {}): string {
	const { taskX = 200, taskName = "Do work", extraTask = false } = options
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task" name="${taskName}">
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:serviceTask>
    ${extraTask ? '<bpmn:serviceTask id="extra" name="Extra" />' : ""}
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_di" bpmnElement="task">
        <dc:Bounds x="${taskX}" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      ${
				extraTask
					? `<bpmndi:BPMNShape id="extra_di" bpmnElement="extra">
        <dc:Bounds x="400" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>`
					: ""
			}
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="${taskX}" y="118"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "800px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

function markerOf(container: HTMLElement, id: string): string[] {
	const el = container.querySelector(`[data-bpmnkit-id="${id}"]`)
	return [...(el?.classList ?? [])].filter((c) => c.startsWith("bpmnkit-diff-"))
}

/** Every diff marker currently painted on a canvas, legend chrome excluded. */
function markersIn(container: HTMLElement): Element[] {
	const svg = container.querySelector("svg")
	return [...(svg?.querySelectorAll("[class*='bpmnkit-diff-']") ?? [])]
}

/** The canvas applies a viewport on the next animation frame, so mirroring lands there. */
function nextFrame(): Promise<void> {
	return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}

/** Captures the `CanvasApi` a canvas hands its plugins — the only viewport handle. */
function probe(): CanvasPlugin & { api: CanvasApi } {
	const plugin = {
		name: "probe",
		api: null as unknown as CanvasApi,
		install(api: CanvasApi) {
			plugin.api = api
		},
	}
	return plugin
}

/**
 * Mounts both canvases of a diff pair and returns everything a test needs.
 *
 * Auto-fit is off: happy-dom does no layout, so the canvas would fit against a
 * zero-size box on a later frame and land on a viewport no assertion can name.
 * Every viewport here is one a test set deliberately.
 */
function mountPair(
	beforeXml: string,
	afterXml: string,
	options?: Parameters<typeof createBpmnDiff>[0],
) {
	const diff = createBpmnDiff(options)
	const leftEl = makeContainer()
	const rightEl = makeContainer()
	const leftProbe = probe()
	const rightProbe = probe()
	const left = new BpmnCanvas({
		container: leftEl,
		xml: beforeXml,
		fit: "none",
		plugins: [diff.before, leftProbe],
	})
	const right = new BpmnCanvas({
		container: rightEl,
		xml: afterXml,
		fit: "none",
		plugins: [diff.after, rightProbe],
	})
	return { diff, leftEl, rightEl, left, right, leftApi: leftProbe.api, rightApi: rightProbe.api }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createBpmnDiff", () => {
	it("names the two plugins by side", () => {
		const diff = createBpmnDiff()
		expect(diff.before.name).toBe("bpmn-diff-before")
		expect(diff.after.name).toBe("bpmn-diff-after")
	})

	it("injects styles into <head>", () => {
		mountPair(makeXml(), makeXml())
		expect(document.getElementById(DIFF_STYLE_ID)).not.toBeNull()
	})

	it("has no result until both sides have loaded", () => {
		const diff = createBpmnDiff()
		const container = makeContainer()
		new BpmnCanvas({ container, xml: makeXml(), plugins: [diff.before] })
		expect(diff.api.getResult()).toBeNull()
	})

	it("computes the diff once the second side loads, whichever order", () => {
		const diff = createBpmnDiff()
		const rightEl = makeContainer()
		const leftEl = makeContainer()
		// After first, before second — the reverse of the usual mount order.
		new BpmnCanvas({ container: rightEl, xml: makeXml({ extraTask: true }), plugins: [diff.after] })
		expect(diff.api.getResult()).toBeNull()
		new BpmnCanvas({ container: leftEl, xml: makeXml(), plugins: [diff.before] })
		expect(diff.api.getResult()?.added).toEqual(["extra"])
	})

	it("marks an added element on the after canvas only", () => {
		const { leftEl, rightEl } = mountPair(makeXml(), makeXml({ extraTask: true }))
		expect(markerOf(rightEl, "extra")).toEqual(["bpmnkit-diff-added"])
		expect(markerOf(leftEl, "extra")).toEqual([])
	})

	it("marks a removed element on the before canvas only", () => {
		const { leftEl, rightEl } = mountPair(makeXml({ extraTask: true }), makeXml())
		expect(markerOf(leftEl, "extra")).toEqual(["bpmnkit-diff-removed"])
		expect(markerOf(rightEl, "extra")).toEqual([])
	})

	it("marks a changed element on both canvases", () => {
		const { leftEl, rightEl } = mountPair(makeXml(), makeXml({ taskName: "Renamed" }))
		expect(markerOf(leftEl, "task")).toEqual(["bpmnkit-diff-changed"])
		expect(markerOf(rightEl, "task")).toEqual(["bpmnkit-diff-changed"])
	})

	it("marks a moved element and its edge on both canvases", () => {
		const { leftEl, rightEl } = mountPair(makeXml(), makeXml({ taskX: 300 }))
		expect(markerOf(leftEl, "task")).toEqual(["bpmnkit-diff-moved"])
		expect(markerOf(rightEl, "flow1")).toEqual(["bpmnkit-diff-moved"])
	})

	it("marks nothing when the two models are identical", () => {
		const { leftEl, rightEl, diff } = mountPair(makeXml(), makeXml())
		expect(diff.api.getResult()?.total).toBe(0)
		expect(markersIn(leftEl)).toHaveLength(0)
		expect(markersIn(rightEl)).toHaveLength(0)
	})

	it("reports the diff through onDiff", () => {
		const seen: number[] = []
		mountPair(makeXml(), makeXml({ extraTask: true }), { onDiff: (r) => seen.push(r.total) })
		expect(seen).toEqual([1])
	})

	// ── Legend ────────────────────────────────────────────────────────────────

	it("renders a legend row per non-empty category", () => {
		const { rightEl } = mountPair(makeXml(), makeXml({ extraTask: true, taskName: "Renamed" }))
		const legend = rightEl.querySelector(".bpmnkit-diff-legend")
		expect(legend?.hasAttribute("hidden")).toBe(false)
		const rows = [...(legend?.querySelectorAll(".bpmnkit-diff-legend-row") ?? [])].map(
			(row) => row.textContent,
		)
		expect(rows).toEqual(["1 added", "1 changed"])
	})

	it("says so when there are no changes", () => {
		const { leftEl } = mountPair(makeXml(), makeXml())
		expect(leftEl.querySelector(".bpmnkit-diff-legend-title")?.textContent).toBe("No changes")
	})

	it("omits the legend when asked", () => {
		const { leftEl } = mountPair(makeXml(), makeXml(), { legend: false })
		expect(leftEl.querySelector(".bpmnkit-diff-legend")).toBeNull()
	})

	// ── Viewport sync ─────────────────────────────────────────────────────────

	it("mirrors a pan from one canvas onto the other", async () => {
		const { leftApi, rightApi } = mountPair(makeXml(), makeXml())
		leftApi.setViewport({ tx: 42, ty: 17, scale: 1.5 })
		await nextFrame()
		expect(rightApi.getViewport()).toMatchObject({ tx: 42, ty: 17, scale: 1.5 })
	})

	it("mirrors in both directions", async () => {
		const { leftApi, rightApi } = mountPair(makeXml(), makeXml())
		rightApi.setViewport({ tx: -10, ty: 5, scale: 0.75 })
		await nextFrame()
		expect(leftApi.getViewport()).toMatchObject({ tx: -10, ty: 5, scale: 0.75 })
		leftApi.setViewport({ tx: 3, ty: 3, scale: 2 })
		await nextFrame()
		expect(rightApi.getViewport()).toMatchObject({ tx: 3, ty: 3, scale: 2 })
	})

	it("settles instead of echoing a mirrored viewport back and forth", async () => {
		const { leftApi, rightApi } = mountPair(makeXml(), makeXml())
		leftApi.setViewport({ tx: 20, ty: 20, scale: 1.25 })
		// One frame carries the mirror across; the echo must find nothing to do, so
		// a later frame cannot still be moving either side.
		await nextFrame()
		const settled = { left: leftApi.getViewport(), right: rightApi.getViewport() }
		await nextFrame()
		await nextFrame()
		expect(leftApi.getViewport()).toEqual(settled.left)
		expect(rightApi.getViewport()).toEqual(settled.right)
		expect(settled.left).toEqual(settled.right)
	})

	it("converges both panes on the most recent pan", async () => {
		const diff = createBpmnDiff()
		const rightProbe = probe()
		const leftProbe = probe()
		new BpmnCanvas({
			container: makeContainer(),
			xml: makeXml(),
			fit: "none",
			plugins: [diff.after, rightProbe],
		})
		// A viewport the alignment pushes onto the before pane, still unapplied when
		// the next pan arrives — the newer pan is the one both panes must end on.
		rightProbe.api.setViewport({ tx: 55, ty: 66, scale: 1.25 })
		new BpmnCanvas({
			container: makeContainer(),
			xml: makeXml(),
			fit: "none",
			plugins: [diff.before, leftProbe],
		})
		rightProbe.api.setViewport({ tx: 10, ty: 20, scale: 2 })

		await nextFrame()
		await nextFrame()
		expect(rightProbe.api.getViewport()).toMatchObject({ tx: 10, ty: 20, scale: 2 })
		expect(leftProbe.api.getViewport()).toMatchObject({ tx: 10, ty: 20, scale: 2 })
	})

	it("aligns the earlier pane onto the later one when the diff is first computed", () => {
		const diff = createBpmnDiff()
		const rightProbe = probe()
		const leftProbe = probe()
		new BpmnCanvas({
			container: makeContainer(),
			xml: makeXml(),
			fit: "none",
			plugins: [diff.after, rightProbe],
		})
		rightProbe.api.setViewport({ tx: 55, ty: 66, scale: 1.25 })
		new BpmnCanvas({
			container: makeContainer(),
			xml: makeXml(),
			fit: "none",
			plugins: [diff.before, leftProbe],
		})
		expect(leftProbe.api.getViewport()).toMatchObject({ tx: 55, ty: 66, scale: 1.25 })
	})

	it("leaves the viewports alone when sync is off", async () => {
		const { leftApi, rightApi } = mountPair(makeXml(), makeXml(), { syncViewports: false })
		const untouched = rightApi.getViewport()
		leftApi.setViewport({ tx: 99, ty: 99, scale: 3 })
		await nextFrame()
		expect(rightApi.getViewport()).toEqual(untouched)
	})

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	it("clear() removes markers and the result", () => {
		const { diff, rightEl } = mountPair(makeXml(), makeXml({ extraTask: true }))
		expect(markerOf(rightEl, "extra")).toEqual(["bpmnkit-diff-added"])
		diff.api.clear()
		expect(diff.api.getResult()).toBeNull()
		expect(markerOf(rightEl, "extra")).toEqual([])
		expect(rightEl.querySelector(".bpmnkit-diff-legend")?.hasAttribute("hidden")).toBe(true)
	})

	it("destroying one canvas drops the diff from the other", () => {
		const { diff, left, rightEl } = mountPair(makeXml(), makeXml({ extraTask: true }))
		left.destroy()
		expect(diff.api.getResult()).toBeNull()
		expect(markerOf(rightEl, "extra")).toEqual([])
	})

	it("repaints after the canvas reloads a different model", () => {
		const { diff, right, rightEl } = mountPair(makeXml(), makeXml())
		expect(diff.api.getResult()?.total).toBe(0)
		right.load(makeXml({ extraTask: true }))
		expect(diff.api.getResult()?.added).toEqual(["extra"])
		expect(markerOf(rightEl, "extra")).toEqual(["bpmnkit-diff-added"])
	})
})
