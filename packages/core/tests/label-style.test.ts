import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { collectLabelStyles, labelFontCss, resolveLabelFont } from "../src/bpmn/label-style.js"
import { exportSvg } from "../src/bpmn/svg.js"

const fixture = (name: string): string =>
	readFileSync(join(import.meta.dirname, "fixtures", "roundtrip", name), "utf8")

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="d" targetNamespace="t">
  <bpmn:process id="proc">
    <bpmn:task id="styled" name="Styled"/>
    <bpmn:task id="plain" name="Plain"/>
    <bpmn:task id="unknown" name="Unknown"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="dg">
    <bpmndi:BPMNPlane id="pl" bpmnElement="proc">
      <bpmndi:BPMNShape id="styled_di" bpmnElement="styled">
        <dc:Bounds x="0" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel labelStyle="LS1"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="plain_di" bpmnElement="plain">
        <dc:Bounds x="200" y="0" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="unknown_di" bpmnElement="unknown">
        <dc:Bounds x="400" y="0" width="100" height="80"/>
        <bpmndi:BPMNLabel labelStyle="nope"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
    <bpmndi:BPMNLabelStyle id="LS1">
      <dc:Font name="Times &lt;New&gt; Roman" size="14.5" isBold="true" isItalic="true" isUnderline="true" isStrikeThrough="false"/>
    </bpmndi:BPMNLabelStyle>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

describe("label styles", () => {
	it("indexes every BPMNLabelStyle in the document, whatever its prefix", () => {
		const styles = collectLabelStyles(Bpmn.parse(fixture("miwg-A.2.1.bpmn")))
		expect(styles.size).toBe(10)
		expect(styles.get("_cVJGoDOCEeSknpIVFCxNIQ")).toEqual({ name: "Arial", size: 11 })
		expect(styles.get("_cVFcQTOCEeSknpIVFCxNIQ")).toEqual({ name: "Segoe UI", size: 12 })
	})

	it("reads every Font attribute and drops unusable values", () => {
		const styles = collectLabelStyles(Bpmn.parse(XML))
		expect(styles.get("LS1")).toEqual({
			name: "Times <New> Roman",
			size: 14.5,
			isBold: true,
			isItalic: true,
			isUnderline: true,
			isStrikeThrough: false,
		})
	})

	it("resolves only a label's own labelStyle reference — no default, no fallback", () => {
		const defs = Bpmn.parse(XML)
		const styles = collectLabelStyles(defs)
		const shapes = defs.diagrams[0]?.plane.shapes ?? []
		const labelOf = (id: string) => shapes.find((s) => s.bpmnElement === id)?.label
		expect(resolveLabelFont(labelOf("styled"), styles)?.size).toBe(14.5)
		expect(resolveLabelFont(labelOf("plain"), styles)).toBeUndefined()
		expect(resolveLabelFont(labelOf("unknown"), styles)).toBeUndefined()
		// labelStyle is an xsd:QName — a prefixed reference resolves by local part.
		expect(resolveLabelFont({ unknownAttributes: { labelStyle: "di:LS1" } }, styles)?.size).toBe(
			14.5,
		)
	})

	it("converts a font to CSS with the default stack as fallback", () => {
		expect(
			labelFontCss({ name: 'a"b, sans-serif', size: 9, isStrikeThrough: true }, "system-ui", 11),
		).toEqual({
			fontFamily: '"a\\"b", sans-serif, system-ui',
			fontSize: 9,
			fontWeight: "normal",
			fontStyle: "normal",
			textDecoration: "line-through",
		})
		expect(labelFontCss({}, "system-ui", 11).fontFamily).toBe("system-ui")
	})
})

describe("exportSvg label styles", () => {
	it("draws a styled label in its font and leaves the others on the default", () => {
		const svg = exportSvg(Bpmn.parse(XML))
		const styleOf = (text: string): string =>
			new RegExp(`<text style="([^"]*)"[^>]*>${text}</text>`).exec(svg)?.[1] ?? ""
		const styled = styleOf("Styled")
		expect(styled).toContain(
			"font-family:&quot;Times &lt;New&gt; Roman&quot;, system-ui,-apple-system,sans-serif",
		)
		expect(styled).toContain("font-size:14.5px")
		expect(styled).toContain("font-weight:bold")
		expect(styled).toContain("font-style:italic")
		expect(styled).toContain("text-decoration:underline")
		for (const text of ["Plain", "Unknown"]) {
			const style = styleOf(text)
			expect(style).toContain("font-family:system-ui,-apple-system,sans-serif;font-size:11px")
			expect(style).not.toContain("font-weight")
		}
	})

	it("renders a MIWG reference model's label styles (C.4.0: arial,helvetica,sans-serif 11)", () => {
		const svg = exportSvg(Bpmn.parse(fixture("miwg-C.4.0.bpmn")))
		expect(svg).toContain(
			"font-family:&quot;arial&quot;, &quot;helvetica&quot;, sans-serif, system-ui,-apple-system,sans-serif;font-size:11px",
		)
	})
})
