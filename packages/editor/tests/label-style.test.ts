// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { BpmnEditor } from "../src/editor.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:startEvent id="start" name="Begin"/>
    <bpmn:task id="styled" name="Styled"/>
    <bpmn:task id="plain" name="Plain"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg">
    <bpmndi:BPMNPlane id="pl" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="0" y="20" width="36" height="36"/>
        <bpmndi:BPMNLabel labelStyle="LS1"><dc:Bounds x="-10" y="60" width="56" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="styled_di" bpmnElement="styled">
        <dc:Bounds x="100" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel labelStyle="LS1"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="plain_di" bpmnElement="plain">
        <dc:Bounds x="300" y="0" width="100" height="80"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
    <bpmndi:BPMNLabelStyle id="LS1">
      <dc:Font name="Arial" size="16" isBold="true" isItalic="false" isUnderline="true" isStrikeThrough="false"/>
    </bpmndi:BPMNLabelStyle>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const editors: BpmnEditor[] = []

function mount(): { ed: BpmnEditor; container: HTMLElement } {
	const container = document.createElement("div")
	container.style.width = "800px"
	container.style.height = "600px"
	document.body.appendChild(container)
	const ed = new BpmnEditor({ container, xml: XML, grid: false })
	editors.push(ed)
	return { ed, container }
}

afterEach(() => {
	for (const ed of editors.splice(0)) ed.destroy()
	document.body.innerHTML = ""
})

describe("label styles in the editor", () => {
	it("edits a styled label in its DI font", () => {
		const { ed, container } = mount()
		ed.editLabel("styled")
		const div = container.querySelector<HTMLElement>(".bpmnkit-label-editor")
		expect(div).toBeTruthy()
		expect(div?.style.fontFamily).toContain("Arial")
		expect(div?.style.fontSize).toBe("16px")
		expect(div?.style.fontWeight).toBe("bold")
		expect(div?.style.textDecoration).toBe("underline")
	})

	it("edits an unstyled label in the editor's own font", () => {
		const { ed, container } = mount()
		ed.editLabel("plain")
		const div = container.querySelector<HTMLElement>(".bpmnkit-label-editor")
		expect(div).toBeTruthy()
		expect(div?.style.fontFamily).toBe("")
		expect(div?.style.fontSize).toBe("")
	})

	it("keeps the labelStyle reference when the text is edited", () => {
		const { ed, container } = mount()
		ed.editLabel("styled")
		const div = container.querySelector<HTMLElement>(".bpmnkit-label-editor")
		if (!div) throw new Error("no label editor")
		div.textContent = "Renamed"
		div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
		const xml = ed.exportXml()
		expect(xml).toContain('name="Renamed"')
		expect(xml).toMatch(/bpmnElement="styled">[\s\S]*?<bpmndi:BPMNLabel labelStyle="LS1"/)
		expect(xml).toContain('<bpmndi:BPMNLabelStyle id="LS1">')
	})

	it("keeps the labelStyle reference when an external label is moved", () => {
		const { ed } = mount()
		ed.setLabelPosition("start", "top")
		const label = ed
			.getDefinitions()
			?.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === "start")?.label
		expect(label?.unknownAttributes?.labelStyle).toBe("LS1")
		expect(label?.bounds?.y).toBeLessThan(20)
	})
})
