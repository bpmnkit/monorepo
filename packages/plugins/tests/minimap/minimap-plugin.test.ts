import { BpmnCanvas } from "@bpmnkit/canvas"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MINIMAP_STYLE_ID, createMinimapPlugin } from "../../src/minimap/index.js"
import { Minimap } from "../../src/minimap/minimap.js"

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
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_di" bpmnElement="task">
        <dc:Bounds x="200" y="60" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="382" y="82" width="36" height="36"/>
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "800px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("createMinimapPlugin", () => {
	it("injects minimap styles into <head>", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMinimapPlugin()] })
		expect(document.getElementById(MINIMAP_STYLE_ID)).not.toBeNull()
	})

	it("mounts the minimap DOM inside the canvas host", () => {
		const container = makeContainer()
		new BpmnCanvas({ container, plugins: [createMinimapPlugin()] })
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host?.querySelector(".bpmnkit-minimap")).not.toBeNull()
	})

	it("updates minimap shapes on diagram:load", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, plugins: [createMinimapPlugin()] })
		canvas.load(SIMPLE_XML)
		const host = container.querySelector(".bpmnkit-canvas-host")
		const shapes = host?.querySelectorAll(".bpmnkit-minimap-shape")
		expect(shapes?.length).toBeGreaterThanOrEqual(3)
	})

	it("clears minimap shapes on diagram:clear", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, plugins: [createMinimapPlugin()] })
		canvas.load(SIMPLE_XML)
		canvas.clear()
		const host = container.querySelector(".bpmnkit-canvas-host")
		const shapes = host?.querySelectorAll(".bpmnkit-minimap-shape")
		expect(shapes?.length).toBe(0)
	})

	it("removes the minimap on uninstall (destroy)", () => {
		const container = makeContainer()
		const canvas = new BpmnCanvas({ container, plugins: [createMinimapPlugin()] })
		canvas.destroy()
		// container.innerHTML was cleared by destroy, so just verify no minimap exists
		expect(container.querySelector(".bpmnkit-minimap")).toBeNull()
	})

	it("each plugin instance is independent", () => {
		const c1 = makeContainer()
		const c2 = makeContainer()
		new BpmnCanvas({ container: c1, plugins: [createMinimapPlugin()] })
		new BpmnCanvas({ container: c2, plugins: [createMinimapPlugin()] })
		const mm1 = c1.querySelector(".bpmnkit-minimap")
		const mm2 = c2.querySelector(".bpmnkit-minimap")
		expect(mm1).not.toBeNull()
		expect(mm2).not.toBeNull()
		expect(mm1).not.toBe(mm2)
	})
})

describe("Minimap", () => {
	let container: HTMLElement
	let navigateCb: ReturnType<typeof vi.fn>
	let minimap: Minimap

	beforeEach(() => {
		container = makeContainer()
		navigateCb = vi.fn()
		minimap = new Minimap(container, navigateCb)
	})

	it("appends .bpmnkit-minimap to the container", () => {
		expect(container.querySelector(".bpmnkit-minimap")).not.toBeNull()
	})

	it("clear() removes rendered shapes and edges", async () => {
		const { Bpmn } = await import("@bpmnkit/core")
		const defs = Bpmn.parse(SIMPLE_XML)
		minimap.update(defs)
		minimap.clear()
		expect(container.querySelectorAll(".bpmnkit-minimap-shape").length).toBe(0)
		expect(container.querySelectorAll(".bpmnkit-minimap-edge").length).toBe(0)
	})

	it("destroy() removes the minimap from the DOM", () => {
		minimap.destroy()
		expect(container.querySelector(".bpmnkit-minimap")).toBeNull()
	})
})
