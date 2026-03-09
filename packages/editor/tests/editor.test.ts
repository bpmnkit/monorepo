import { Bpmn } from "@bpmn-sdk/core"
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { BpmnEditor } from "../src/editor.js"

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeContainer(): HTMLElement {
	const el = document.createElement("div")
	el.style.width = "800px"
	el.style.height = "600px"
	document.body.appendChild(el)
	return el
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("BpmnEditor", () => {
	let container: HTMLElement
	let editor: BpmnEditor

	beforeEach(() => {
		container = makeContainer()
		editor = new BpmnEditor({ container, xml: SIMPLE_XML, grid: false })
	})

	it("mounts a host element inside the container", () => {
		const host = container.querySelector(".bpmn-canvas-host")
		expect(host).not.toBeNull()
	})

	it("renders shapes for all BPMN elements", () => {
		const shapes = container.querySelectorAll("[data-bpmn-id]")
		expect(shapes.length).toBeGreaterThanOrEqual(3)
	})

	it("constructor without xml mounts an empty canvas", () => {
		const c = new BpmnEditor({ container: makeContainer(), grid: false })
		const host = c.container ?? container.querySelector(".bpmn-canvas-host")
		expect(host).not.toBeNull()
		c.destroy()
	})

	it("load(xml) renders shapes", () => {
		const c = new BpmnEditor({ container: makeContainer(), grid: false })
		c.load(SIMPLE_XML)
		const shapes = c.getShapesForTest()
		expect(shapes.length).toBeGreaterThanOrEqual(3)
		c.destroy()
	})

	it("exportXml() returns parseable BPMN XML", () => {
		const xml = editor.exportXml()
		expect(xml).toContain("<")
		const parsed = Bpmn.parse(xml)
		expect(parsed.processes.length).toBeGreaterThanOrEqual(1)
	})

	it("setTool('create:serviceTask') fires editor:tool event", () => {
		const cb = vi.fn()
		editor.on("editor:tool", cb)
		editor.setTool("create:serviceTask")
		expect(cb).toHaveBeenCalledWith("create:serviceTask")
	})

	it("setTool changes the tool mode", () => {
		editor.setTool("create:serviceTask")
		editor.setTool("select")
		// No error thrown
	})

	it("deleteSelected() with selection fires diagram:change", () => {
		editor.setSelection(["start"])
		const cb = vi.fn()
		editor.on("diagram:change", cb)
		editor.deleteSelected()
		expect(cb).toHaveBeenCalledOnce()
	})

	it("deleteSelected() removes the shape from the diagram", () => {
		editor.setSelection(["start"])
		editor.deleteSelected()
		const xml = editor.exportXml()
		const parsed = Bpmn.parse(xml)
		const proc = parsed.processes[0]
		if (!proc) throw new Error("no process")
		const startEl = proc.flowElements.find((el) => el.id === "start")
		expect(startEl).toBeUndefined()
	})

	it("undo() restores the previous state and fires diagram:change", () => {
		editor.setSelection(["start"])
		editor.deleteSelected()

		const cb = vi.fn()
		editor.on("diagram:change", cb)
		editor.undo()
		expect(cb).toHaveBeenCalledOnce()

		// Shape should be back
		const xml = editor.exportXml()
		const parsed = Bpmn.parse(xml)
		const proc = parsed.processes[0]
		if (!proc) throw new Error("no process")
		expect(proc.flowElements.find((el) => el.id === "start")).toBeDefined()
	})

	it("canUndo() is false initially", () => {
		expect(editor.canUndo()).toBe(false)
	})

	it("canUndo() is true after a change", () => {
		editor.setSelection(["start"])
		editor.deleteSelected()
		expect(editor.canUndo()).toBe(true)
	})

	it("canRedo() is false initially", () => {
		expect(editor.canRedo()).toBe(false)
	})

	it("canRedo() is true after undo", () => {
		editor.setSelection(["start"])
		editor.deleteSelected()
		editor.undo()
		expect(editor.canRedo()).toBe(true)
	})

	it("on('editor:select') fires when setSelection is called", () => {
		const cb = vi.fn()
		editor.on("editor:select", cb)
		editor.setSelection(["start", "task"])
		expect(cb).toHaveBeenCalledWith(["start", "task"])
	})

	it("on() returns an unsubscribe function", () => {
		const cb = vi.fn()
		const off = editor.on("editor:tool", cb)
		off()
		editor.setTool("pan")
		expect(cb).not.toHaveBeenCalled()
	})

	it("destroy() removes the host element", () => {
		editor.destroy()
		expect(container.querySelector(".bpmn-canvas-host")).toBeNull()
	})
})

// Extend BpmnEditor for testing (white-box access to shapes)
declare module "../src/editor.js" {
	interface BpmnEditor {
		getShapesForTest(): unknown[]
		container: HTMLElement
	}
}

// Monkey-patch for test access
Object.defineProperty(BpmnEditor.prototype, "getShapesForTest", {
	value(this: BpmnEditor) {
		// @ts-expect-error — private access for testing
		return this._shapes as unknown[]
	},
})

Object.defineProperty(BpmnEditor.prototype, "container", {
	get(this: BpmnEditor) {
		// @ts-expect-error — private access for testing
		return this._host as HTMLElement
	},
})
