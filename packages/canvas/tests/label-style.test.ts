// @vitest-environment happy-dom
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { afterEach, describe, expect, it } from "vitest"
import { BpmnCanvas } from "../src/canvas.js"
import { wrapText } from "../src/measure.js"

// Three tasks: one whose label references a bold/italic/underlined/struck
// 16px style, one without a BPMNLabel style, one pointing at a missing id —
// plus a styled external event label and a styled sequence-flow label.
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:startEvent id="start" name="Begin"/>
    <bpmn:task id="styled" name="Styled"/>
    <bpmn:task id="plain" name="Plain"/>
    <bpmn:task id="unknown" name="Unknown"/>
    <bpmn:sequenceFlow id="f" name="yes" sourceRef="styled" targetRef="plain"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg">
    <bpmndi:BPMNPlane id="pl" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="0" y="20" width="36" height="36"/>
        <bpmndi:BPMNLabel labelStyle="LS_serif"><dc:Bounds x="-10" y="60" width="56" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="styled_di" bpmnElement="styled">
        <dc:Bounds x="100" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel labelStyle="LS_big"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="plain_di" bpmnElement="plain">
        <dc:Bounds x="300" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="unknown_di" bpmnElement="unknown">
        <dc:Bounds x="500" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel labelStyle="LS_missing"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="f_di" bpmnElement="f">
        <di:waypoint x="200" y="40"/>
        <di:waypoint x="300" y="40"/>
        <bpmndi:BPMNLabel labelStyle="LS_serif"><dc:Bounds x="240" y="20" width="20" height="14"/></bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
    <bpmndi:BPMNLabelStyle id="LS_big">
      <dc:Font name='Comic "Neue"' size="16" isBold="true" isItalic="true" isUnderline="true" isStrikeThrough="true"/>
    </bpmndi:BPMNLabelStyle>
    <bpmndi:BPMNLabelStyle id="LS_serif">
      <dc:Font name="Georgia, serif" size="9.0" isBold="false" isItalic="false" isUnderline="false" isStrikeThrough="false"/>
    </bpmndi:BPMNLabelStyle>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const containers: HTMLElement[] = []
const canvases: BpmnCanvas[] = []

function mount(xml: string): HTMLElement {
	const container = document.createElement("div")
	container.style.width = "800px"
	container.style.height = "600px"
	document.body.appendChild(container)
	containers.push(container)
	canvases.push(new BpmnCanvas({ container, xml, grid: false }))
	return container
}

afterEach(() => {
	for (const c of canvases.splice(0)) c.destroy()
	for (const c of containers.splice(0)) c.remove()
})

/** The label `<text>` elements inside a shape's group. */
function shapeTexts(container: HTMLElement, id: string): SVGTextElement[] {
	return [
		...container.querySelectorAll<SVGTextElement>(`[data-bpmnkit-id="${id}"] text.bpmnkit-label`),
	]
}

describe("BPMNLabelStyle fonts", () => {
	it("draws a styled label in its style's font, size, weight, style and decoration", () => {
		const container = mount(XML)
		const [text] = shapeTexts(container, "styled")
		expect(text?.textContent).toBe("Styled")
		const style = text?.getAttribute("style") ?? ""
		expect(style).toContain('font-family: "Comic \\"Neue\\"", system-ui, -apple-system, sans-serif')
		expect(style).toContain("font-size: 16px")
		expect(style).toContain("font-weight: bold")
		expect(style).toContain("font-style: italic")
		expect(style).toContain("text-decoration: underline line-through")
	})

	it("leaves a label without a style to the default .bpmnkit-label font", () => {
		const container = mount(XML)
		const [text] = shapeTexts(container, "plain")
		expect(text?.textContent).toBe("Plain")
		expect(text?.hasAttribute("style")).toBe(false)
	})

	it("falls back to the default font for an unknown labelStyle id", () => {
		const container = mount(XML)
		const [text] = shapeTexts(container, "unknown")
		expect(text?.textContent).toBe("Unknown")
		expect(text?.hasAttribute("style")).toBe(false)
	})

	it("styles external event labels and sequence-flow labels too", () => {
		const container = mount(XML)
		const texts = [...container.querySelectorAll<SVGTextElement>("text.bpmnkit-label")]
		const begin = texts.find((t) => t.textContent === "Begin")
		const yes = texts.find((t) => t.textContent === "yes")
		for (const t of [begin, yes]) {
			const style = t?.getAttribute("style") ?? ""
			// A comma-separated name keeps generic keywords bare.
			expect(style).toContain('font-family: "Georgia", serif, system-ui')
			expect(style).toContain("font-size: 9px")
			expect(style).not.toContain("font-weight")
			expect(style).not.toContain("text-decoration")
		}
	})

	it("renders a MIWG reference model's label styles (A.2.1: Arial 11)", () => {
		const path = join(
			dirname(fileURLToPath(import.meta.url)),
			"../../core/tests/fixtures/roundtrip/miwg-A.2.1.bpmn",
		)
		const container = mount(readFileSync(path, "utf8"))
		const texts = shapeTexts(container, "_To9ZpzOCEeSknpIVFCxNIQ")
		expect(texts.length).toBeGreaterThan(0)
		for (const t of texts) {
			expect(t.getAttribute("style")).toContain('font-family: "Arial", system-ui')
			expect(t.getAttribute("style")).toContain("font-size: 11px")
		}
	})

	it("wraps and spaces lines by the resolved font size", () => {
		const big = {
			fontFamily: "x",
			fontSize: 22,
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "none",
		} as const
		// Fits at the default 11px, overflows at 22px.
		expect(wrapText("Approve order", 100)).toEqual(["Approve order"])
		expect(wrapText("Approve order", 100, big)).toEqual(["Approve", "order"])

		const xml = XML.replace('name="Styled"', 'name="Approve the customer order"')
		const container = mount(xml)
		const ys = shapeTexts(container, "styled").map((t) => Number(t.getAttribute("y")))
		expect(ys.length).toBeGreaterThan(1)
		// Line height scales with the font: 14px at 11px → ~20.4px at 16px.
		expect((ys[1] ?? 0) - (ys[0] ?? 0)).toBeCloseTo((16 * 14) / 11)
	})
})
