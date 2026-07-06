import { Bpmn } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { BpmnCanvas } from "../src/canvas.js"
import { OverlayManager } from "../src/overlays.js"
import type { OverlayHost } from "../src/overlays.js"
import { computeDiagramBounds } from "../src/renderer.js"
import type { CanvasPlugin, ScreenBox } from "../src/types.js"

// ── Fixture ───────────────────────────────────────────────────────────────────

const SIMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task" name="Do Work">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="82" y="82" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="60" y="122" width="80" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_di" bpmnElement="task">
        <dc:Bounds x="200" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="382" y="82" width="36" height="36"/>
        <bpmndi:BPMNLabel><dc:Bounds x="362" y="122" width="76" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="118" y="100"/>
        <di:waypoint x="200" y="100"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="300" y="100"/>
        <di:waypoint x="382" y="100"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "800px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BpmnCanvas", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	it("mounts a host element inside the container", () => {
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host).not.toBeNull()
	})

	it("renders shapes for all BPMN elements", () => {
		const shapes = container.querySelectorAll("[data-bpmnkit-id]")
		// start, task, end = 3 shapes
		expect(shapes.length).toBeGreaterThanOrEqual(3)
	})

	it("renders edges for sequence flows", () => {
		const edges = container.querySelectorAll(".bpmnkit-edge")
		expect(edges.length).toBe(2)
	})

	it("fires diagram:load event with the parsed definitions", () => {
		const cb = vi.fn()
		const c = new BpmnCanvas({ container: makeContainer(), grid: false })
		c.on("diagram:load", cb)
		c.load(SIMPLE_XML)
		expect(cb).toHaveBeenCalledOnce()
	})

	it("fires element:click when an element is clicked", () => {
		const cb = vi.fn()
		canvas.on("element:click", cb)

		const taskShape = container.querySelector<SVGGElement>('[data-bpmnkit-id="task"]')
		expect(taskShape).not.toBeNull()
		// Dispatch on a child element to test .closest() lookup
		if (!taskShape) throw new Error("shape not found")
		const child = taskShape.querySelector("rect") ?? taskShape
		child.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		expect(cb).toHaveBeenCalledWith("task", expect.anything())
	})

	it("clears the canvas on clear()", () => {
		canvas.clear()
		const shapes = container.querySelectorAll("[data-bpmnkit-id]")
		expect(shapes.length).toBe(0)
	})

	it("installs plugins and provides the API", () => {
		const install = vi.fn()
		const plugin: CanvasPlugin = { name: "test", install }
		const c = new BpmnCanvas({ container: makeContainer(), plugins: [plugin], grid: false })
		expect(install).toHaveBeenCalledOnce()
		const api = install.mock.calls[0]?.[0]
		expect(typeof api.getShapes).toBe("function")
		expect(typeof api.getEdges).toBe("function")
		expect(typeof api.on).toBe("function")
		c.destroy()
	})

	it("calls plugin uninstall on destroy()", () => {
		const uninstall = vi.fn()
		const plugin: CanvasPlugin = { name: "test2", install: () => {}, uninstall }
		const c = new BpmnCanvas({ container: makeContainer(), plugins: [plugin], grid: false })
		c.destroy()
		expect(uninstall).toHaveBeenCalledOnce()
	})

	it("applies dark theme via data-theme attribute", () => {
		canvas.setTheme("dark")
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.getAttribute("data-theme")).toBe("dark")
	})

	it("removes data-theme in light mode", () => {
		canvas.setTheme("dark")
		canvas.setTheme("light")
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.hasAttribute("data-theme")).toBe(false)
	})

	it("on() returns an unsubscribe function", () => {
		const cb = vi.fn()
		const off = canvas.on("diagram:clear", cb)
		off()
		canvas.clear()
		expect(cb).not.toHaveBeenCalled()
	})

	it("removes the host on destroy()", () => {
		canvas.destroy()
		expect(container.querySelector(".bpmnkit-canvas-host")).toBeNull()
	})
})

describe("computeDiagramBounds", () => {
	it("returns null for empty diagram", () => {
		const defs = Bpmn.parse(SIMPLE_XML)
		// Override plane to empty
		const firstDiagram = defs.diagrams[0]
		if (!firstDiagram) throw new Error("no diagram")
		const diagCopy = {
			...defs,
			diagrams: [{ ...firstDiagram, plane: { ...firstDiagram.plane, shapes: [], edges: [] } }],
		}
		expect(computeDiagramBounds(diagCopy)).toBeNull()
	})

	it("computes correct bounding box", () => {
		const defs = Bpmn.parse(SIMPLE_XML)
		const bounds = computeDiagramBounds(defs)
		expect(bounds).not.toBeNull()
		if (!bounds) throw new Error("expected bounds")
		expect(bounds.minX).toBeLessThanOrEqual(82)
		expect(bounds.minY).toBeLessThanOrEqual(60)
		expect(bounds.maxX).toBeGreaterThanOrEqual(418) // 382 + 36
		expect(bounds.maxY).toBeGreaterThanOrEqual(140) // 60 + 80
	})

	it("renders connector template icon as <image> when zeebe:modelerTemplateIcon is set", () => {
		const ICON_URI =
			"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4="
		const defs = Bpmn.createProcess("proc")
			.withAutoLayout()
			.startEvent("start")
			.serviceTask("task", {
				name: "Kafka Publish",
				taskType: "io.camunda:connector-kafka:1",
				modelerTemplate: "io.camunda.connectors.KAFKA.v1",
				modelerTemplateIcon: ICON_URI,
			})
			.endEvent("end")
			.build()

		const iconContainer = makeContainer()
		const c = new BpmnCanvas({ container: iconContainer, grid: false })
		c.loadDefinitions(defs)

		const taskShape = iconContainer.querySelector('[data-bpmnkit-id="task"]')
		if (!taskShape) throw new Error("task shape not found")
		const img = taskShape.querySelector("image")
		expect(img).not.toBeNull()
		expect(img?.getAttribute("href")).toBe(ICON_URI)
		// Gear icon SVG paths should NOT be present
		expect(taskShape.querySelector("circle")).toBeNull()
	})
})

// ── Rendering coverage (P0 correctness) ─────────────────────────────────────────

/** Parses and renders `xml` into a fresh container, returning the container. */
function renderXml(xml: string): HTMLElement {
	const container = makeContainer()
	const c = new BpmnCanvas({ container, grid: false })
	c.load(xml)
	return container
}

function shapeHtml(container: HTMLElement, id: string): string {
	const el = container.querySelector(`[data-bpmnkit-id="${id}"]`)
	if (!el) throw new Error(`shape ${id} not found`)
	return el.innerHTML
}

const ACTIVITY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:serviceTask id="mi" name="MI">
      <bpmn:multiInstanceLoopCharacteristics/>
    </bpmn:serviceTask>
    <bpmn:serviceTask id="miSeq" name="MI Seq">
      <bpmn:multiInstanceLoopCharacteristics isSequential="true"/>
    </bpmn:serviceTask>
    <bpmn:userTask id="comp" name="Comp" isForCompensation="true"/>
    <bpmn:callActivity id="call" name="Call"/>
    <bpmn:serviceTask id="plain" name="Plain"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="mi_di" bpmnElement="mi"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="miSeq_di" bpmnElement="miSeq"><dc:Bounds x="160" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="comp_di" bpmnElement="comp"><dc:Bounds x="320" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="call_di" bpmnElement="call"><dc:Bounds x="480" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="plain_di" bpmnElement="plain"><dc:Bounds x="640" y="0" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe("activity markers", () => {
	let container: HTMLElement
	beforeEach(() => {
		container = renderXml(ACTIVITY_XML)
	})

	it("draws a parallel multi-instance marker on a task", () => {
		expect(shapeHtml(container, "mi")).toContain("M-4 -5v10M0 -5v10M4 -5v10")
	})

	it("draws a sequential multi-instance marker on a task", () => {
		expect(shapeHtml(container, "miSeq")).toContain("M-5 -4h10M-5 0h10M-5 4h10")
	})

	it("draws a compensation marker on a task", () => {
		expect(shapeHtml(container, "comp")).toContain("M1 -3.5l-5 3.5 5 3.5z")
	})

	it("draws the collapsed `+` marker on a call activity", () => {
		expect(shapeHtml(container, "call")).toContain("M0 -4v8M-4 0h8")
	})

	it("does not draw activity markers on a plain task", () => {
		const html = shapeHtml(container, "plain")
		expect(html).not.toContain("M0 -4v8M-4 0h8")
		expect(html).not.toContain("M-4 -5v10")
	})
})

describe("event definition markers", () => {
	const MULTI_DEF_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:startEvent id="start"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:intermediateCatchEvent id="multi">
      <bpmn:incoming>f1</bpmn:incoming><bpmn:outgoing>f2</bpmn:outgoing>
      <bpmn:messageEventDefinition/>
      <bpmn:timerEventDefinition/>
    </bpmn:intermediateCatchEvent>
    <bpmn:endEvent id="end"><bpmn:incoming>f2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="multi"/>
    <bpmn:sequenceFlow id="f2" sourceRef="multi" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="proc_diag"><bpmndi:BPMNPlane id="proc_plane" bpmnElement="proc">
    <bpmndi:BPMNShape id="start_di" bpmnElement="start"><dc:Bounds x="100" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="multi_di" bpmnElement="multi"><dc:Bounds x="200" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="end_di" bpmnElement="end"><dc:Bounds x="300" y="100" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="136" y="118"/><di:waypoint x="200" y="118"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="f2_di" bpmnElement="f2"><di:waypoint x="236" y="118"/><di:waypoint x="300" y="118"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	it("renders a multiple pentagon for an event with >1 definition", () => {
		const container = renderXml(MULTI_DEF_XML)
		const html = shapeHtml(container, "multi")
		expect(html).toContain("M0 -5.5L5.2")
		// Not the individual timer clock marker
		expect(html).not.toContain("M0 -3.5v3.5l2 2")
	})
})

describe("connection decorations", () => {
	const FLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:task id="t1"><bpmn:outgoing>cond</bpmn:outgoing></bpmn:task>
    <bpmn:task id="t2"><bpmn:incoming>cond</bpmn:incoming></bpmn:task>
    <bpmn:sequenceFlow id="cond" sourceRef="t1" targetRef="t2">
      <bpmn:conditionExpression>ok</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:textAnnotation id="note"><bpmn:text>hi</bpmn:text></bpmn:textAnnotation>
    <bpmn:association id="assoc" sourceRef="t1" targetRef="note" associationDirection="One"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="proc_diag"><bpmndi:BPMNPlane id="proc_plane" bpmnElement="proc">
    <bpmndi:BPMNShape id="t1_di" bpmnElement="t1"><dc:Bounds x="100" y="100" width="80" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="t2_di" bpmnElement="t2"><dc:Bounds x="260" y="100" width="80" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="note_di" bpmnElement="note"><dc:Bounds x="100" y="200" width="100" height="40"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="cond_di" bpmnElement="cond"><di:waypoint x="180" y="125"/><di:waypoint x="260" y="125"/></bpmndi:BPMNEdge>
    <bpmndi:BPMNEdge id="assoc_di" bpmnElement="assoc"><di:waypoint x="140" y="150"/><di:waypoint x="140" y="200"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	const MSGFLOW_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:collaboration id="c">
    <bpmn:participant id="p1" processRef="pr1"/>
    <bpmn:participant id="p2" processRef="pr2"/>
    <bpmn:messageFlow id="mf" sourceRef="a" targetRef="b"/>
  </bpmn:collaboration>
  <bpmn:process id="pr1"><bpmn:task id="a"/></bpmn:process>
  <bpmn:process id="pr2"><bpmn:task id="b"/></bpmn:process>
  <bpmndi:BPMNDiagram id="c_diag"><bpmndi:BPMNPlane id="c_plane" bpmnElement="c">
    <bpmndi:BPMNShape id="p1_di" bpmnElement="p1" isHorizontal="true"><dc:Bounds x="0" y="0" width="400" height="120"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="a_di" bpmnElement="a"><dc:Bounds x="60" y="40" width="80" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="p2_di" bpmnElement="p2" isHorizontal="true"><dc:Bounds x="0" y="160" width="400" height="120"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="b_di" bpmnElement="b"><dc:Bounds x="60" y="200" width="80" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="mf_di" bpmnElement="mf"><di:waypoint x="100" y="90"/><di:waypoint x="100" y="200"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	it("draws a conditional diamond at the source of a conditional flow from a task", () => {
		const container = renderXml(FLOW_XML)
		const path = container.querySelector('[data-bpmnkit-id="cond"] path.bpmnkit-edge-path')
		expect(path?.getAttribute("marker-start")).toContain("conditional")
	})

	it("draws an open arrowhead on a directed association", () => {
		const container = renderXml(FLOW_XML)
		const path = container.querySelector('[data-bpmnkit-id="assoc"] path')
		expect(path?.getAttribute("marker-end")).toContain("open-arrow")
	})

	it("draws a source circle and open arrowhead on a message flow", () => {
		const container = renderXml(MSGFLOW_XML)
		const path = container.querySelector('[data-bpmnkit-id="mf"] path')
		expect(path?.getAttribute("marker-start")).toContain("msgstart")
		expect(path?.getAttribute("marker-end")).toContain("open-arrow")
	})
})

// ── Connection docking (P1-6) ────────────────────────────────────────────────────

describe("connection docking", () => {
	// A diagonal flow from a task into a circular catch event. The event bounds
	// are 200,200 36×36 → centre (218,218), radius 18.
	const DOCK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:task id="t"><bpmn:outgoing>f</bpmn:outgoing></bpmn:task>
    <bpmn:intermediateCatchEvent id="ev"><bpmn:incoming>f</bpmn:incoming></bpmn:intermediateCatchEvent>
    <bpmn:sequenceFlow id="f" sourceRef="t" targetRef="ev"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="t_di" bpmnElement="t"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ev_di" bpmnElement="ev"><dc:Bounds x="200" y="200" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="f_di" bpmnElement="f"><di:waypoint x="50" y="80"/><di:waypoint x="200" y="200"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	it("crops the connection endpoint onto the circular event outline", () => {
		const container = renderXml(DOCK_XML)
		const d = container
			.querySelector('[data-bpmnkit-id="f"] path.bpmnkit-edge-path')
			?.getAttribute("d")
		if (!d) throw new Error("no path")
		const m = d.match(/L([-\d.]+),([-\d.]+)[^L]*$/)
		if (!m) throw new Error(`no terminal L in ${d}`)
		const ex = Number.parseFloat(m[1] ?? "")
		const ey = Number.parseFloat(m[2] ?? "")
		// Endpoint lies on the circle (distance 18 from the centre)…
		expect(Math.hypot(ex - 218, ey - 218)).toBeCloseTo(18, 3)
		// …and is no longer the raw bounding-box corner (200,200).
		expect(Math.abs(ex - 200)).toBeGreaterThan(1)
	})
})

// ── Marker API (P1-3) ───────────────────────────────────────────────────────────

describe("marker API", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	it("adds, queries, and removes a marker on a shape", () => {
		canvas.addMarker("task", "foo")
		expect(canvas.hasMarker("task", "foo")).toBe(true)
		expect(container.querySelector('[data-bpmnkit-id="task"]')?.classList.contains("foo")).toBe(
			true,
		)
		canvas.removeMarker("task", "foo")
		expect(canvas.hasMarker("task", "foo")).toBe(false)
	})

	it("toggles a marker", () => {
		canvas.toggleMarker("task", "x")
		expect(canvas.hasMarker("task", "x")).toBe(true)
		canvas.toggleMarker("task", "x")
		expect(canvas.hasMarker("task", "x")).toBe(false)
	})

	it("adds a marker on an edge", () => {
		canvas.addMarker("flow1", "hl")
		expect(container.querySelector('[data-bpmnkit-id="flow1"]')?.classList.contains("hl")).toBe(
			true,
		)
	})

	it("is a no-op for unknown ids", () => {
		expect(() => canvas.addMarker("nope", "x")).not.toThrow()
		expect(canvas.hasMarker("nope", "x")).toBe(false)
	})

	it("clears markers when a new diagram loads", () => {
		canvas.addMarker("task", "foo")
		canvas.load(SIMPLE_XML)
		expect(canvas.hasMarker("task", "foo")).toBe(false)
	})

	it("highlight and clearHighlights go through the marker API", () => {
		canvas.highlight(["task"], "changed")
		expect(canvas.hasMarker("task", "bpmnkit-highlight--changed")).toBe(true)
		canvas.clearHighlights()
		expect(canvas.hasMarker("task", "bpmnkit-highlight--changed")).toBe(false)
	})
})

// ── Interaction events (P1-4) ────────────────────────────────────────────────────

describe("interaction events", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	function childOf(id: string): Element {
		const el = container.querySelector(`[data-bpmnkit-id="${id}"]`)
		if (!el) throw new Error(`shape ${id} not found`)
		return el.querySelector("rect") ?? el
	}

	it("emits element:dblclick", () => {
		const cb = vi.fn()
		canvas.on("element:dblclick", cb)
		childOf("task").dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
		expect(cb).toHaveBeenCalledWith("task", expect.anything())
	})

	it("emits element:contextmenu", () => {
		const cb = vi.fn()
		canvas.on("element:contextmenu", cb)
		childOf("task").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }))
		expect(cb).toHaveBeenCalledWith("task", expect.anything())
	})

	it("emits element:hover then element:out as the pointer moves", () => {
		const hover = vi.fn()
		const out = vi.fn()
		canvas.on("element:hover", hover)
		canvas.on("element:out", out)
		childOf("task").dispatchEvent(new MouseEvent("pointermove", { bubbles: true }))
		expect(hover).toHaveBeenCalledWith("task", expect.anything())
		// Move onto the empty background (svg root) → leave the element.
		const svg = container.querySelector("svg")
		if (!svg) throw new Error("no svg")
		svg.dispatchEvent(new MouseEvent("pointermove", { bubbles: true }))
		expect(out).toHaveBeenCalledWith("task")
	})

	it("emits canvas:click when the background is clicked", () => {
		const cb = vi.fn()
		canvas.on("canvas:click", cb)
		const svg = container.querySelector("svg")
		if (!svg) throw new Error("no svg")
		svg.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		expect(cb).toHaveBeenCalledOnce()
	})
})

// ── Viewport / navigation API (P1-7) ─────────────────────────────────────────────

describe("viewport API", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	it("zoom(scale) sets an absolute scale reported by viewbox()", () => {
		canvas.zoom(2)
		expect(canvas.viewbox().scale).toBe(2)
	})

	it("getAbsoluteBBox transforms diagram bounds into screen space", () => {
		canvas.zoom(2, { x: 0, y: 0 })
		// task bounds are x=200 y=60 w=100 h=80 in SIMPLE_XML; at scale 2, tx=ty=0.
		expect(canvas.getAbsoluteBBox("task")).toEqual({ x: 400, y: 120, width: 200, height: 160 })
	})

	it("getAbsoluteBBox returns null for an unknown id", () => {
		expect(canvas.getAbsoluteBBox("nope")).toBeNull()
	})

	it("scrollToElement centres the element at the viewport centre", () => {
		canvas.zoom(2, { x: 0, y: 0 })
		canvas.scrollToElement("task")
		const box = canvas.getAbsoluteBBox("task")
		const vb = canvas.viewbox()
		if (!box) throw new Error("no box")
		// Element centre x maps to the viewport centre x (clientWidth/2).
		expect(box.x + box.width / 2).toBeCloseTo((vb.width * vb.scale) / 2, 5)
	})
})

// ── Overlays (P1-2) ──────────────────────────────────────────────────────────────

describe("overlays", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	function overlayLayer(): HTMLElement {
		const layer = container.querySelector<HTMLElement>(".bpmnkit-overlays")
		if (!layer) throw new Error("no overlay layer")
		return layer
	}

	it("adds an overlay node into the overlay layer", () => {
		const id = canvas.overlays.add("task", { position: { top: 0, left: 0 }, html: "<b>hi</b>" })
		expect(typeof id).toBe("string")
		expect(overlayLayer().querySelector("b")?.textContent).toBe("hi")
	})

	it("get() and remove() work by id and by filter", () => {
		canvas.overlays.add("task", { position: { top: 0 }, html: "a", type: "badge" })
		const id2 = canvas.overlays.add("start", { position: { top: 0 }, html: "b", type: "badge" })
		expect(canvas.overlays.get({ type: "badge" })).toHaveLength(2)
		expect(canvas.overlays.get({ element: "task" })).toHaveLength(1)
		canvas.overlays.remove(id2)
		expect(canvas.overlays.get()).toHaveLength(1)
		canvas.overlays.remove({ type: "badge" })
		expect(canvas.overlays.get()).toHaveLength(0)
	})

	it("hides an overlay whose element is missing", () => {
		canvas.overlays.add("nope", { position: { top: 0 }, html: "x" })
		const node = overlayLayer().firstElementChild as HTMLElement
		expect(node.style.display).toBe("none")
	})

	it("clears overlays when a new diagram loads", () => {
		canvas.overlays.add("task", { position: { top: 0 }, html: "x" })
		canvas.load(SIMPLE_XML)
		expect(canvas.overlays.get()).toHaveLength(0)
	})

	it("removes the overlay layer on destroy", () => {
		canvas.destroy()
		expect(container.querySelector(".bpmnkit-overlays")).toBeNull()
	})
})

describe("OverlayManager (positioning)", () => {
	function makeStub() {
		let scale = 1
		const boxes = new Map<string, ScreenBox | null>()
		let cb: () => void = () => {}
		const hostEl = document.createElement("div")
		document.body.appendChild(hostEl)
		const host: OverlayHost = {
			hostEl,
			getScale: () => scale,
			getBBox: (id) => boxes.get(id) ?? null,
			onViewportChange: (fn) => {
				cb = fn
				return () => {}
			},
		}
		return {
			host,
			setScale: (s: number) => {
				scale = s
			},
			setBox: (id: string, b: ScreenBox) => boxes.set(id, b),
			fire: () => cb(),
			node: () => hostEl.querySelector<HTMLElement>(".bpmnkit-overlays > div"),
		}
	}

	it("anchors from top/left at the element's box", () => {
		const stub = makeStub()
		stub.setBox("a", { x: 10, y: 20, width: 30, height: 40 })
		const m = new OverlayManager(stub.host)
		m.add("a", { position: { top: 2, left: 3 }, html: "x" })
		const node = stub.node()
		expect(node?.style.left).toBe("13px")
		expect(node?.style.top).toBe("22px")
	})

	it("anchors from right/bottom with translate", () => {
		const stub = makeStub()
		stub.setBox("a", { x: 0, y: 0, width: 100, height: 50 })
		const m = new OverlayManager(stub.host)
		m.add("a", { position: { right: 5, bottom: 5 }, html: "x", scale: false })
		const node = stub.node()
		expect(node?.style.left).toBe("95px")
		expect(node?.style.top).toBe("45px")
		expect(node?.style.transform).toContain("translateX(-100%)")
		expect(node?.style.transform).toContain("translateY(-100%)")
	})

	it("hides and shows across its zoom range on viewport change", () => {
		const stub = makeStub()
		stub.setBox("a", { x: 0, y: 0, width: 10, height: 10 })
		const m = new OverlayManager(stub.host)
		m.add("a", { position: { top: 0 }, html: "x", show: { maxZoom: 2 } })
		const node = stub.node()
		expect(node?.style.display).toBe("")
		stub.setScale(5)
		stub.fire()
		expect(node?.style.display).toBe("none")
		stub.setScale(1)
		stub.fire()
		expect(node?.style.display).toBe("")
	})

	it("scales 1:1 with zoom by default", () => {
		const stub = makeStub()
		stub.setBox("a", { x: 0, y: 0, width: 10, height: 10 })
		const m = new OverlayManager(stub.host)
		m.add("a", { position: { top: 0 }, html: "x" })
		stub.setScale(3)
		stub.fire()
		expect(stub.node()?.style.transform).toContain("scale(3)")
	})
})

// ── Multi-plane rendering & drilldown (P0-1) ─────────────────────────────────────

describe("collapsed sub-process drilldown", () => {
	// Parent plane holds a collapsed sub-process "sub"; a second BPMNDiagram
	// carries "sub"'s own plane with a start/task/end.
	const DRILL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:startEvent id="s"><bpmn:outgoing>f1</bpmn:outgoing></bpmn:startEvent>
    <bpmn:subProcess id="sub" name="Handle">
      <bpmn:incoming>f1</bpmn:incoming>
      <bpmn:startEvent id="cs"><bpmn:outgoing>cf</bpmn:outgoing></bpmn:startEvent>
      <bpmn:task id="ct" name="Inner"><bpmn:incoming>cf</bpmn:incoming></bpmn:task>
      <bpmn:sequenceFlow id="cf" sourceRef="cs" targetRef="ct"/>
    </bpmn:subProcess>
    <bpmn:sequenceFlow id="f1" sourceRef="s" targetRef="sub"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="s_di" bpmnElement="s"><dc:Bounds x="40" y="40" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="sub_di" bpmnElement="sub" isExpanded="false"><dc:Bounds x="140" y="20" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="f1_di" bpmnElement="f1"><di:waypoint x="76" y="58"/><di:waypoint x="140" y="60"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="dg2"><bpmndi:BPMNPlane id="pl2" bpmnElement="sub">
    <bpmndi:BPMNShape id="cs_di" bpmnElement="cs"><dc:Bounds x="40" y="40" width="36" height="36"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="ct_di" bpmnElement="ct"><dc:Bounds x="140" y="20" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNEdge id="cf_di" bpmnElement="cf"><di:waypoint x="76" y="58"/><di:waypoint x="140" y="60"/></bpmndi:BPMNEdge>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	function makeCanvas(): { container: HTMLElement; canvas: BpmnCanvas } {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, grid: false })
		canvas.load(DRILL_XML)
		return { container, canvas }
	}

	it("renders the parent plane with a drilldown button on the collapsed sub-process", () => {
		const { container } = makeCanvas()
		expect(container.querySelector('[data-bpmnkit-id="sub"]')).not.toBeNull()
		expect(container.querySelector('[data-bpmnkit-drilldown="sub"]')).not.toBeNull()
		// Inner content is not rendered on the parent plane.
		expect(container.querySelector('[data-bpmnkit-id="ct"]')).toBeNull()
	})

	it("getPlanes lists both the process and the sub-process planes", () => {
		const { canvas } = makeCanvas()
		const planes = canvas.getPlanes().map((p) => p.id)
		expect(planes).toEqual(["proc", "sub"])
	})

	it("showPlane drills into the sub-process and fires plane:change", () => {
		const { container, canvas } = makeCanvas()
		const cb = vi.fn()
		canvas.on("plane:change", cb)
		canvas.showPlane("sub")
		expect(cb).toHaveBeenCalledWith("proc", "sub")
		expect(container.querySelector('[data-bpmnkit-id="ct"]')).not.toBeNull()
		// Parent-only element is gone.
		expect(container.querySelector('[data-bpmnkit-id="s"]')).toBeNull()
	})

	it("clicking the drilldown button opens the sub-process plane", () => {
		const { container } = makeCanvas()
		const btn = container.querySelector('[data-bpmnkit-drilldown="sub"]')
		if (!btn) throw new Error("no drilldown button")
		btn.dispatchEvent(new MouseEvent("click", { bubbles: true }))
		expect(container.querySelector('[data-bpmnkit-id="ct"]')).not.toBeNull()
	})

	it("shows a breadcrumb that navigates back to the parent", () => {
		const { container, canvas } = makeCanvas()
		expect(container.querySelector<HTMLElement>(".bpmnkit-breadcrumb")?.style.display).toBe("none")
		canvas.showPlane("sub")
		const crumbs = container.querySelectorAll(".bpmnkit-breadcrumb-crumb")
		expect(crumbs).toHaveLength(2)
		expect(crumbs[1]?.textContent).toBe("Handle")
		// Click the root crumb to navigate back.
		;(crumbs[0] as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true }))
		expect(container.querySelector('[data-bpmnkit-id="s"]')).not.toBeNull()
		expect(container.querySelector<HTMLElement>(".bpmnkit-breadcrumb")?.style.display).toBe("none")
	})

	it("does not draw a drilldown button for a single-plane diagram", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
		expect(container.querySelector("[data-bpmnkit-drilldown]")).toBeNull()
		expect(canvas.getPlanes().map((p) => p.id)).toEqual(["proc"])
	})
})

// ── Data objects / stores / groups (P0-2) ────────────────────────────────────────

describe("data elements & groups", () => {
	const DATA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:task id="t" name="Do"/>
    <bpmn:dataObjectReference id="dor" name="Order" isCollection="true"/>
    <bpmn:dataStoreReference id="dsr" name="Store"/>
    <bpmn:group id="grp"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="grp_di" bpmnElement="grp"><dc:Bounds x="-10" y="-10" width="320" height="140"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="t_di" bpmnElement="t"><dc:Bounds x="20" y="20" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="dor_di" bpmnElement="dor"><dc:Bounds x="160" y="20" width="36" height="50"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="dsr_di" bpmnElement="dsr"><dc:Bounds x="220" y="20" width="50" height="50"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

	it("renders a data object reference with the collection marker", () => {
		const container = renderXml(DATA_XML)
		const html = shapeHtml(container, "dor")
		expect(html).toContain("bpmnkit-data-body")
		// collection marker (three vertical bars)
		expect(html).toContain("M-3 -5v9M0 -5v9M3 -5v9")
	})

	it("renders a data store reference as a cylinder", () => {
		const container = renderXml(DATA_XML)
		expect(shapeHtml(container, "dsr")).toContain("bpmnkit-datastore-body")
	})

	it("renders a group as a dashed box", () => {
		const container = renderXml(DATA_XML)
		const group = container.querySelector('[data-bpmnkit-id="grp"]')
		expect(group?.querySelector(".bpmnkit-group-body")).not.toBeNull()
	})

	it("renders external labels for data references", () => {
		const container = renderXml(DATA_XML)
		// The data-object name renders as an external label in the labels layer.
		const labels = [...container.querySelectorAll("text")].map((t) => t.textContent)
		expect(labels).toContain("Order")
		expect(labels).toContain("Store")
	})
})

// ── Element registry & incremental update (P1-1) ─────────────────────────────────

describe("element registry", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	it("getElement / getGraphics resolve by id", () => {
		expect(canvas.getElement("task")?.id).toBe("task")
		expect(canvas.getGraphics("task")).toBe(container.querySelector('[data-bpmnkit-id="task"]'))
		expect(canvas.getElement("nope")).toBeUndefined()
	})

	it("forEachElement visits every shape and edge", () => {
		const ids = new Set<string>()
		canvas.forEachElement((el) => ids.add(el.id))
		expect(ids).toEqual(new Set(["start", "task", "end", "flow1", "flow2"]))
	})
})

describe("incremental update", () => {
	let container: HTMLElement
	let canvas: BpmnCanvas

	beforeEach(() => {
		container = makeContainer()
		canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
	})

	it("re-renders only the target element, leaving others' graphics identical", () => {
		const startG = canvas.getGraphics("start")
		const endG = canvas.getGraphics("end")
		const taskG = canvas.getGraphics("task")

		canvas.updateElement("task")

		// Siblings keep their exact <g> nodes (not re-rendered)…
		expect(canvas.getGraphics("start")).toBe(startG)
		expect(canvas.getGraphics("end")).toBe(endG)
		// …while the target got a fresh node.
		expect(canvas.getGraphics("task")).not.toBe(taskG)
	})

	it("preserves marker classes across an update", () => {
		canvas.addMarker("task", "mk")
		canvas.updateElement("task")
		expect(canvas.hasMarker("task", "mk")).toBe(true)
		expect(canvas.getGraphics("task")?.classList.contains("mk")).toBe(true)
	})

	it("mutates only the target element's graphics (MutationObserver)", () => {
		const host = container.querySelector(".bpmnkit-canvas-host")
		if (!host) throw new Error("no host")
		const obs = new MutationObserver(() => {})
		obs.observe(host, { childList: true, subtree: true })

		canvas.updateElement("task")

		const records = obs.takeRecords()
		obs.disconnect()
		const touched = new Set<string>()
		for (const r of records) {
			for (const n of [...Array.from(r.addedNodes), ...Array.from(r.removedNodes)]) {
				const id = (n as Element).getAttribute?.("data-bpmnkit-id")
				if (id) touched.add(id)
			}
		}
		expect([...touched]).toEqual(["task"])
	})
})

// ── DI completeness & auto-layout fallback (P0-6) ────────────────────────────────

describe("DI completeness", () => {
	// A process with no BPMNDiagram at all → every element lacks DI.
	const NO_DI_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="d" targetNamespace="t">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="s"><bpmn:outgoing>f</bpmn:outgoing></bpmn:startEvent>
    <bpmn:task id="t" name="Work"><bpmn:incoming>f</bpmn:incoming></bpmn:task>
    <bpmn:sequenceFlow id="f" sourceRef="s" targetRef="t"/>
  </bpmn:process>
</bpmn:definitions>`

	let warnSpy: ReturnType<typeof vi.spyOn>
	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
	})
	afterEach(() => {
		warnSpy.mockRestore()
	})

	it("reports missing DI and renders nothing by default", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, xml: NO_DI_XML, grid: false })
		const w = canvas.getImportWarnings()
		expect(w.missingShapes).toContain("s")
		expect(w.missingShapes).toContain("t")
		expect(w.missingEdges).toContain("f")
		expect(container.querySelector("[data-bpmnkit-id]")).toBeNull()
		expect(warnSpy).toHaveBeenCalledOnce()
	})

	it("auto-lays out missing DI when layoutMissingDi is 'all'", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({
			container,
			xml: NO_DI_XML,
			grid: false,
			layoutMissingDi: "all",
		})
		expect(container.querySelector('[data-bpmnkit-id="t"]')).not.toBeNull()
		expect(container.querySelector('[data-bpmnkit-id="s"]')).not.toBeNull()
		// Warnings still describe the source gaps.
		expect(canvas.getImportWarnings().missingShapes).toContain("t")
	})

	it("never mutates the caller's model when auto-laying out", () => {
		const defs = Bpmn.parse(NO_DI_XML)
		expect(defs.diagrams).toHaveLength(0)
		const container = makeContainer()
		new BpmnCanvas({ container, grid: false, layoutMissingDi: "all" }).loadDefinitions(defs)
		// The original defs is untouched (applyAutoLayout returned a copy).
		expect(defs.diagrams).toHaveLength(0)
	})

	it("passes warnings to the diagram:load event", () => {
		const container = makeContainer()
		const c = new BpmnCanvas({ container, grid: false })
		const cb = vi.fn()
		c.on("diagram:load", cb)
		c.load(NO_DI_XML)
		expect(cb).toHaveBeenCalledOnce()
		const warnings = cb.mock.calls[0]?.[1]
		expect(warnings.missingShapes).toContain("t")
	})

	it("reports no warnings for a complete diagram", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, xml: SIMPLE_XML, grid: false })
		const w = canvas.getImportWarnings()
		expect(w.missingShapes).toHaveLength(0)
		expect(w.missingEdges).toHaveLength(0)
		expect(warnSpy).not.toHaveBeenCalled()
	})
})
