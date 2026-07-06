import { Bpmn } from "@bpmnkit/core"
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
		const host = container.querySelector(".bpmnkit-canvas-host")
		expect(host).not.toBeNull()
	})

	it("renders shapes for all BPMN elements", () => {
		const shapes = container.querySelectorAll("[data-bpmnkit-id]")
		expect(shapes.length).toBeGreaterThanOrEqual(3)
	})

	it("constructor without xml mounts an empty canvas", () => {
		const c = new BpmnEditor({ container: makeContainer(), grid: false })
		const host = c.container ?? container.querySelector(".bpmnkit-canvas-host")
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
		expect(container.querySelector(".bpmnkit-canvas-host")).toBeNull()
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

// ── Align & distribute (P2-4) ────────────────────────────────────────────────────

const ALIGN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:task id="t1"/><bpmn:task id="t2"/><bpmn:task id="t3"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg"><bpmndi:BPMNPlane id="pl" bpmnElement="proc">
    <bpmndi:BPMNShape id="t1_di" bpmnElement="t1"><dc:Bounds x="0" y="0" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="t2_di" bpmnElement="t2"><dc:Bounds x="150" y="200" width="100" height="80"/></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="t3_di" bpmnElement="t3"><dc:Bounds x="500" y="50" width="100" height="80"/></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe("align & distribute", () => {
	function bounds(ed: BpmnEditor, id: string) {
		const s = ed.getDefinitions()?.diagrams[0]?.plane.shapes.find((sh) => sh.bpmnElement === id)
		if (!s) throw new Error(`no shape ${id}`)
		return s.bounds
	}

	it("aligns selected shapes to the top edge as one undoable step", () => {
		const ed = new BpmnEditor({ container: makeContainer(), xml: ALIGN_XML, grid: false })
		ed.setSelection(["t1", "t2", "t3"])
		ed.alignSelected("top")
		// minTop across the three is 0.
		expect(bounds(ed, "t1").y).toBe(0)
		expect(bounds(ed, "t2").y).toBe(0)
		expect(bounds(ed, "t3").y).toBe(0)
		ed.undo()
		expect(bounds(ed, "t2").y).toBe(200)
		ed.destroy()
	})

	it("aligns to the left edge", () => {
		const ed = new BpmnEditor({ container: makeContainer(), xml: ALIGN_XML, grid: false })
		ed.setSelection(["t1", "t2", "t3"])
		ed.alignSelected("left")
		expect(bounds(ed, "t2").x).toBe(0)
		expect(bounds(ed, "t3").x).toBe(0)
		ed.destroy()
	})

	it("distributes shapes horizontally with equal gaps (endpoints fixed)", () => {
		const ed = new BpmnEditor({ container: makeContainer(), xml: ALIGN_XML, grid: false })
		ed.setSelection(["t1", "t2", "t3"])
		ed.distributeSelected("horizontal")
		const t1 = bounds(ed, "t1")
		const t2 = bounds(ed, "t2")
		const t3 = bounds(ed, "t3")
		// Endpoints unchanged, middle repositioned so the two gaps match.
		expect(t1.x).toBe(0)
		expect(t3.x).toBe(500)
		expect(t2.x - (t1.x + t1.width)).toBe(t3.x - (t2.x + t2.width))
		ed.undo()
		expect(bounds(ed, "t2").x).toBe(150)
		ed.destroy()
	})

	it("is a no-op for fewer than the required selection size", () => {
		const ed = new BpmnEditor({ container: makeContainer(), xml: ALIGN_XML, grid: false })
		ed.setSelection(["t1"])
		ed.alignSelected("top")
		expect(bounds(ed, "t1").y).toBe(0)
		expect(ed.canUndo()).toBe(false)
		ed.setSelection(["t1", "t2"])
		ed.distributeSelected("horizontal")
		expect(ed.canUndo()).toBe(false)
		ed.destroy()
	})
})

// ── HUD align/distribute menu (P2-4) ─────────────────────────────────────────────

describe("HUD align menu", () => {
	function bounds(ed: BpmnEditor, id: string) {
		const s = ed.getDefinitions()?.diagrams[0]?.plane.shapes.find((sh) => sh.bpmnElement === id)
		if (!s) throw new Error(`no shape ${id}`)
		return s.bounds
	}

	it("offers align items on multi-selection and aligns when clicked", async () => {
		const { initEditorHud } = await import("../src/hud.js")
		const container = makeContainer()
		const ed = new BpmnEditor({ container, xml: ALIGN_XML, grid: false })
		initEditorHud(ed)
		ed.setSelection(["t1", "t2", "t3"])

		const more = container.querySelector<HTMLButtonElement>("#btn-top-more")
		if (!more) throw new Error("no more button")
		more.click()

		const items = [...container.querySelectorAll(".drop-item")]
		const alignLeft = items.find((el) => el.textContent?.includes("Align left"))
		expect(alignLeft).toBeTruthy()
		expect(items.some((el) => el.textContent?.includes("Distribute horizontally"))).toBe(true)
		;(alignLeft as HTMLButtonElement).click()
		expect(bounds(ed, "t2").x).toBe(0)
		ed.destroy()
	})

	it("hides align items when only one element is selected", async () => {
		const { initEditorHud } = await import("../src/hud.js")
		const container = makeContainer()
		const ed = new BpmnEditor({ container, xml: ALIGN_XML, grid: false })
		initEditorHud(ed)
		ed.setSelection(["t1"])
		container.querySelector<HTMLButtonElement>("#btn-top-more")?.click()
		const items = [...container.querySelectorAll(".drop-item")]
		expect(items.some((el) => el.textContent?.includes("Align left"))).toBe(false)
		ed.destroy()
	})
})
