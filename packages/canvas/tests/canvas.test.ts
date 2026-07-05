import { Bpmn } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
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
