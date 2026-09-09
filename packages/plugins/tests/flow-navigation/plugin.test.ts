import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { describe, expect, it } from "vitest"
import {
	FLOW_NAVIGATION_STYLE_ID,
	createFlowNavigationPlugin,
} from "../../src/flow-navigation/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * start → gateway → (a | b) → join → end.
 *
 * The gateway is the case the plugin exists for: after appending a task behind
 * it there is no keyboard way back to append the other branch.
 */
const BRANCHING = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"><bpmn:outgoing>f0</bpmn:outgoing></bpmn:startEvent>
    <bpmn:exclusiveGateway id="gw" name="Which?"><bpmn:incoming>f0</bpmn:incoming><bpmn:outgoing>fa</bpmn:outgoing><bpmn:outgoing>fb</bpmn:outgoing></bpmn:exclusiveGateway>
    <bpmn:task id="a" name="A"><bpmn:incoming>fa</bpmn:incoming></bpmn:task>
    <bpmn:task id="b" name="B"><bpmn:incoming>fb</bpmn:incoming></bpmn:task>
    <bpmn:sequenceFlow id="f0" sourceRef="start" targetRef="gw" />
    <bpmn:sequenceFlow id="fa" sourceRef="gw" targetRef="a" />
    <bpmn:sequenceFlow id="fb" sourceRef="gw" targetRef="b" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="gw"><dc:Bounds x="200" y="93" width="50" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="a"><dc:Bounds x="320" y="40" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s4" bpmnElement="b"><dc:Bounds x="320" y="160" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="e0" bpmnElement="f0"><di:waypoint x="136" y="118"/><di:waypoint x="200" y="118"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="ea" bpmnElement="fa"><di:waypoint x="250" y="118"/><di:waypoint x="320" y="80"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="eb" bpmnElement="fb"><di:waypoint x="250" y="118"/><di:waypoint x="320" y="200"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

/** A collapsed sub-process with a plane of its own — the drill-in case. */
const WITH_SUBPROCESS = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:subProcess id="sub" name="Fulfilment"><bpmn:incoming>f1</bpmn:incoming>
      <bpmn:task id="inner" name="Pick" />
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="sub" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="sub" isExpanded="false"><dc:Bounds x="200" y="80" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="d2"><bpmndi:BPMNPlane id="p2" bpmnElement="sub">
    <bpmndi:BPMNShape id="s3" bpmnElement="inner"><dc:Bounds x="160" y="80" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	document.body.appendChild(el)
	return el
}

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

function mount(xml: string, options?: Parameters<typeof createFlowNavigationPlugin>[0]) {
	const nav = createFlowNavigationPlugin(options)
	const outer = makeContainer()
	const canvasProbe = probe()
	const canvas = new BpmnCanvas({ container: outer, xml, fit: "none", plugins: [nav, canvasProbe] })
	// The canvas builds its own host div inside the element it is given, and both
	// its keyboard handler and this plugin listen on that — so that is where a
	// key has to land for the test to mean anything.
	return { nav, container: canvasProbe.api.container, canvas, canvasApi: canvasProbe.api }
}

/** Dispatches a key the way the browser would: capture phase, cancellable. */
function press(
	container: HTMLElement,
	key: string,
	modifiers: { shiftKey?: boolean } = {},
): KeyboardEvent {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...modifiers,
	})
	container.dispatchEvent(event)
	return event
}

/**
 * Presses a key and reports whether it reached the canvas's own handler.
 *
 * `defaultPrevented` cannot answer that: the canvas calls `preventDefault()` on
 * Tab itself, so it is true on the fall-through path too. What distinguishes
 * the cases is propagation — verified in Chromium, a capture listener runs
 * before a bubble listener on the same node even when registered later, and
 * stopping propagation there suppresses it.
 */
function pressObserving(
	container: HTMLElement,
	key: string,
	modifiers: { shiftKey?: boolean; ctrlKey?: boolean } = {},
): { event: KeyboardEvent; reachedCanvas: boolean } {
	let reachedCanvas = false
	const spy = (): void => {
		reachedCanvas = true
	}
	container.addEventListener("keydown", spy)
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
		...modifiers,
	})
	container.dispatchEvent(event)
	container.removeEventListener("keydown", spy)
	return { event, reachedCanvas }
}

function marked(container: HTMLElement, cls: string): string[] {
	return [...container.querySelectorAll(`.${cls}`)].map(
		(el) => el.getAttribute("data-bpmnkit-id") ?? "",
	)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createFlowNavigationPlugin", () => {
	it("is named flow-navigation and injects its styles", () => {
		const { nav } = mount(BRANCHING)
		expect(nav.name).toBe("flow-navigation")
		expect(document.getElementById(FLOW_NAVIGATION_STYLE_ID)).not.toBeNull()
	})

	it("starts at the start event when nothing is selected", () => {
		const { nav, container } = mount(BRANCHING)
		press(container, "Tab")
		expect(nav.api.getCursor()).toBe("start")
	})

	it("follows the only outgoing flow to its target", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("start")
		press(container, "Tab")
		expect(nav.api.getCursor()).toBe("gw")
	})

	it("offers a choice at a fan-out rather than guessing", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		// The cursor stays put; one of the outgoing flows is selected instead.
		expect(nav.api.getCursor()).toBe("gw")
		expect(nav.api.getCandidate()).toBe("fa")
	})

	it("cycles between the outgoing flows", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		press(container, "Tab")
		expect(nav.api.getCandidate()).toBe("fb")
		press(container, "Tab")
		expect(nav.api.getCandidate()).toBe("fa")
	})

	it("Enter follows the selected flow", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		press(container, "Tab")
		press(container, "Enter")
		expect(nav.api.getCursor()).toBe("b")
		expect(nav.api.getCandidate()).toBeNull()
	})

	it("Shift+Tab goes back the way it came", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab", { shiftKey: true })
		expect(nav.api.getCursor()).toBe("start")
	})

	it("Shift+Tab cycles backwards through a fan-out", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		press(container, "Tab", { shiftKey: true })
		expect(nav.api.getCandidate()).toBe("fb")
	})

	it("Escape drops a flow selection", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		press(container, "Escape")
		expect(nav.api.getCandidate()).toBeNull()
		expect(nav.api.getCursor()).toBe("gw")
	})

	it("marks the cursor and the candidate on the canvas", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("gw")
		press(container, "Tab")
		expect(marked(container, "bpmnkit-flownav-cursor")).toEqual(["gw"])
		expect(marked(container, "bpmnkit-flownav-candidate")).toEqual(["fa"])
	})

	it("follows a click, so the keyboard continues from where the user is", () => {
		const { nav, canvasApi } = mount(BRANCHING)
		canvasApi.emit("element:click", "a", new PointerEvent("pointerdown"))
		expect(nav.api.getCursor()).toBe("a")
	})

	it("follows the editor's selection, which is what it reports instead of clicks", () => {
		// Regression: a browser run showed the cursor stuck at the start event in
		// the studio, because `BpmnEditor` emits `editor:select` and only the
		// viewer emits `element:click`.
		const { nav, canvasApi } = mount(BRANCHING)
		const emit = canvasApi.emit as unknown as (event: string, ids: string[]) => void
		emit("editor:select", ["gw"])
		expect(nav.api.getCursor()).toBe("gw")
	})

	it("ignores a multi-selection, which has no single place to continue from", () => {
		const { nav, canvasApi } = mount(BRANCHING)
		nav.api.setCursor("start")
		const emit = canvasApi.emit as unknown as (event: string, ids: string[]) => void
		emit("editor:select", ["gw", "a"])
		expect(nav.api.getCursor()).toBe("start")
	})

	// ── Falling through ───────────────────────────────────────────────────────

	it("keeps the key from the canvas when it moved", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("start")
		const { event, reachedCanvas } = pressObserving(container, "Tab")
		expect(nav.api.getCursor()).toBe("gw")
		expect(event.defaultPrevented).toBe(true)
		expect(reachedCanvas).toBe(false)
	})

	it("lets a dead end fall through to the canvas's own Tab", () => {
		// `a` has no outgoing flow. Swallowing Tab there would trap the user on a
		// leaf; the canvas's document-order walk should still get the event.
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("a")
		expect(pressObserving(container, "Tab").reachedCanvas).toBe(true)
	})

	it("ignores a key with a modifier the browser owns", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("start")
		const { reachedCanvas } = pressObserving(container, "Tab", { ctrlKey: true })
		expect(reachedCanvas).toBe(true)
		expect(nav.api.getCursor()).toBe("start")
	})

	// ── Planes ────────────────────────────────────────────────────────────────

	it("Enter drills into a collapsed sub-process", () => {
		const { nav, container, canvasApi } = mount(WITH_SUBPROCESS)
		nav.api.setCursor("sub")
		press(container, "Enter")
		// The sub-process plane is now showing, so its child is rendered.
		expect(canvasApi.getShapes().map((s) => s.id)).toContain("inner")
	})

	it("u drills back out to the root plane", () => {
		const { nav, container, canvasApi } = mount(WITH_SUBPROCESS)
		nav.api.setCursor("sub")
		press(container, "Enter")
		press(container, "u")
		expect(canvasApi.getShapes().map((s) => s.id)).toContain("start")
	})

	it("does not pretend to drill into an element with no plane", () => {
		const { nav, container } = mount(BRANCHING)
		nav.api.setCursor("a")
		expect(press(container, "Enter").defaultPrevented).toBe(false)
	})

	it("resets the cursor when the plane changes", () => {
		const { nav, container } = mount(WITH_SUBPROCESS)
		nav.api.setCursor("sub")
		press(container, "Enter")
		expect(nav.api.getCursor()).toBeNull()
	})

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	it("reports each move through onMove", () => {
		const moves: string[] = []
		const { nav, container } = mount(BRANCHING, { onMove: (id) => moves.push(id) })
		nav.api.setCursor("start")
		press(container, "Tab")
		expect(moves).toEqual(["start", "gw"])
	})

	it("stops listening once the canvas is destroyed", () => {
		const { nav, container, canvas } = mount(BRANCHING)
		nav.api.setCursor("start")
		canvas.destroy()
		expect(press(container, "Tab").defaultPrevented).toBe(false)
		expect(nav.api.getCursor()).toBeNull()
	})
})
