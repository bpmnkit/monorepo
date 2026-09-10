import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LINT_STYLE_ID, createLintPlugin } from "../../src/lint/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A service task with no `zeebe:taskDefinition`. On a Camunda Cloud model that
 * is a deploy error; on a model naming no engine it is not a finding at all.
 */
function makeXml(options: { platform?: string; taskName?: string } = {}): string {
	const { platform, taskName = "Charge card" } = options
	const modelerNs =
		platform === undefined
			? ""
			: ` xmlns:modeler="http://camunda.org/schema/modeler/1.0" modeler:executionPlatform="${platform}" modeler:executionPlatformVersion="8.6.0"`

	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"${modelerNs}
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Order received"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="charge" name="${taskName}"><bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing></bpmn:serviceTask>
    <bpmn:endEvent id="end" name="Done"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="charge" />
    <bpmn:sequenceFlow id="f2" sourceRef="charge" targetRef="end" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="charge"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="end"><dc:Bounds x="360" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="e1" bpmnElement="f1"><di:waypoint x="136" y="118"/><di:waypoint x="200" y="118"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="e2" bpmnElement="f2"><di:waypoint x="300" y="118"/><di:waypoint x="360" y="118"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
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

/** Captures the `CanvasApi` a canvas hands its plugins. */
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

function mount(xml: string, options?: Parameters<typeof createLintPlugin>[0]) {
	const lint = createLintPlugin(options)
	const container = makeContainer()
	const canvasProbe = probe()
	const canvas = new BpmnCanvas({
		container,
		xml,
		fit: "none",
		plugins: [lint, canvasProbe],
	})
	return { lint, container, canvas, canvasApi: canvasProbe.api }
}

function markersOn(container: HTMLElement, id: string): string[] {
	const el = container.querySelector(`[data-bpmnkit-id="${id}"]`)
	return [...(el?.classList ?? [])].filter((c) => c.startsWith("bpmnkit-lint-"))
}

function control(container: HTMLElement): HTMLButtonElement | null {
	return container.querySelector(".bpmnkit-lint-summary")
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createLintPlugin", () => {
	it("is named lint and injects its styles", () => {
		const { lint, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		expect(lint.name).toBe("lint")
		expect(document.getElementById(LINT_STYLE_ID)).not.toBeNull()
		expect(container).toBeDefined()
	})

	it("marks an offending element with its severity", () => {
		const { container, lint } = mount(makeXml({ platform: "Camunda Cloud" }))
		expect(lint.api.getReport()?.total).toBeGreaterThan(0)
		expect(markersOn(container, "charge")).toEqual(["bpmnkit-lint-error"])
	})

	it("marks an element once, with its worst severity", () => {
		const { container } = mount(makeXml({ platform: "Camunda Cloud" }))
		const markers = markersOn(container, "charge")
		expect(markers).toHaveLength(1)
	})

	it("does not judge an engine-neutral model against Camunda deployability", () => {
		// The same diagram, no execution platform: the deploy error disappears
		// and the task is not marked as broken.
		const { container, lint } = mount(makeXml())
		expect(lint.api.getReport()?.platform.id).toBe("none")
		expect(markersOn(container, "charge")).toEqual([])
	})

	it("reports through onReport with plain, forwardable data", () => {
		const seen: unknown[] = []
		mount(makeXml({ platform: "Camunda Cloud" }), { onReport: (r) => seen.push(r) })
		expect(seen).toHaveLength(1)
		expect(JSON.parse(JSON.stringify(seen[0]))).toEqual(seen[0])
	})

	it("passes lint options through to the analysis", () => {
		const { lint } = mount(makeXml({ platform: "Camunda Cloud" }), { categories: ["naming"] })
		expect(lint.api.getReport()?.categories).toEqual(["naming"])
	})

	// ── Control ───────────────────────────────────────────────────────────────

	it("shows a count per non-empty severity", () => {
		const { container, lint } = mount(makeXml({ platform: "Camunda Cloud" }))
		const counts = [...(control(container)?.querySelectorAll(".bpmnkit-lint-count") ?? [])]
		expect(counts.length).toBeGreaterThan(0)
		const report = lint.api.getReport()
		const shown = counts.map((c) => (c as HTMLElement).dataset.severity)
		for (const severity of shown) {
			expect(report?.counts[severity as "error"]).toBeGreaterThan(0)
		}
	})

	it("says so when a model is clean", () => {
		const { container } = mount(makeXml(), { categories: ["flow"] })
		expect(control(container)?.querySelector(".bpmnkit-lint-clean")?.textContent).toBe(
			"No findings",
		)
	})

	it("says which rules ran when the model names no engine", () => {
		const { container } = mount(makeXml())
		expect(control(container)?.querySelector(".bpmnkit-lint-platform")?.textContent).toContain(
			"structural rules only",
		)
	})

	it("stays quiet about the engine when the model names one", () => {
		const { container } = mount(makeXml({ platform: "Camunda Cloud" }))
		expect(control(container)?.querySelector(".bpmnkit-lint-platform")).toBeNull()
	})

	it("omits the control when asked", () => {
		const { container } = mount(makeXml({ platform: "Camunda Cloud" }), { control: false })
		expect(control(container)).toBeNull()
	})

	// ── Stepping ──────────────────────────────────────────────────────────────

	it("steps to an offending element and pulses it", () => {
		const { lint, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		const id = lint.api.next()
		expect(id).toBe("charge")
		expect(markersOn(container, "charge")).toContain("bpmnkit-lint-focus")
	})

	it("wraps around rather than running off the end", () => {
		const { lint } = mount(makeXml({ platform: "Camunda Cloud" }))
		const first = lint.api.next()
		const seen = new Set([first])
		for (let i = 0; i < 12; i++) seen.add(lint.api.next())
		// Whatever the set of offending elements, stepping always returns one.
		expect(seen.has(null)).toBe(false)
		expect(seen.has(first)).toBe(true)
	})

	it("returns null when there is nothing to step to", () => {
		const { lint } = mount(makeXml(), { categories: ["flow"] })
		expect(lint.api.getReport()?.total).toBe(0)
		expect(lint.api.next()).toBeNull()
	})

	it("steps when the control is clicked", () => {
		const { container } = mount(makeXml({ platform: "Camunda Cloud" }))
		control(container)?.click()
		expect(markersOn(container, "charge")).toContain("bpmnkit-lint-focus")
	})

	// ── Enabling ──────────────────────────────────────────────────────────────

	it("setEnabled(false) removes the markers and hides the control", () => {
		const { lint, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		expect(markersOn(container, "charge")).not.toEqual([])
		lint.api.setEnabled(false)
		expect(markersOn(container, "charge")).toEqual([])
		expect(control(container)?.hasAttribute("hidden")).toBe(true)
		expect(lint.api.next()).toBeNull()
	})

	it("setEnabled(true) puts them back without re-running the analysis", () => {
		const { lint, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		const before = lint.api.getReport()
		lint.api.setEnabled(false)
		lint.api.setEnabled(true)
		expect(markersOn(container, "charge")).toEqual(["bpmnkit-lint-error"])
		expect(lint.api.getReport()).toBe(before)
	})

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	it("re-lints when the canvas loads a different model", () => {
		const { lint, canvas, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		expect(markersOn(container, "charge")).toEqual(["bpmnkit-lint-error"])
		canvas.load(makeXml())
		expect(lint.api.getReport()?.platform.id).toBe("none")
		expect(markersOn(container, "charge")).toEqual([])
	})

	it("clears everything when the canvas is destroyed", () => {
		const { lint, canvas, container } = mount(makeXml({ platform: "Camunda Cloud" }))
		canvas.destroy()
		expect(control(container)).toBeNull()
		expect(lint.api.getReport()).toBeNull()
	})
})

// ── Debounce ──────────────────────────────────────────────────────────────────

describe("createLintPlugin — debounce", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})
	afterEach(() => {
		vi.useRealTimers()
	})

	it("runs once for a burst of edits rather than once per edit", () => {
		const reports: unknown[] = []
		const { canvasApi } = mount(makeXml({ platform: "Camunda Cloud" }), {
			onReport: (r) => reports.push(r),
		})
		expect(reports).toHaveLength(1) // the initial load

		const defs = { diagrams: [], processes: [], unknownAttributes: {} }
		for (let i = 0; i < 5; i++) {
			canvasApi.emit("diagram:change" as never, defs as never)
		}
		expect(reports).toHaveLength(1) // still nothing — the edits are in flight

		vi.advanceTimersByTime(300)
		expect(reports).toHaveLength(2) // one run for the whole burst
	})

	it("honours a custom debounce interval", () => {
		const reports: unknown[] = []
		const { canvasApi } = mount(makeXml({ platform: "Camunda Cloud" }), {
			debounceMs: 1000,
			onReport: (r) => reports.push(r),
		})
		const defs = { diagrams: [], processes: [], unknownAttributes: {} }
		canvasApi.emit("diagram:change" as never, defs as never)

		vi.advanceTimersByTime(300)
		expect(reports).toHaveLength(1)
		vi.advanceTimersByTime(700)
		expect(reports).toHaveLength(2)
	})

	it("does not run a pending analysis after uninstall", () => {
		const reports: unknown[] = []
		const { canvas, canvasApi } = mount(makeXml({ platform: "Camunda Cloud" }), {
			onReport: (r) => reports.push(r),
		})
		const defs = { diagrams: [], processes: [], unknownAttributes: {} }
		canvasApi.emit("diagram:change" as never, defs as never)
		canvas.destroy()

		vi.advanceTimersByTime(1000)
		expect(reports).toHaveLength(1)
	})
})
