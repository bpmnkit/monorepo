import { Bpmn } from "@bpmnkit/core"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BpmnCanvas } from "../src/canvas.js"
import { computeDiagramBounds } from "../src/renderer.js"
import type { CanvasPlugin } from "../src/types.js"

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
