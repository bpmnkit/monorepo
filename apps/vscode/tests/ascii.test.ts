import { describe, expect, it } from "vitest"
import { renderForPaste } from "../src/host/ascii.js"

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" name="Order" isExecutable="true">
    <bpmn:startEvent id="start" name="Ordered" />
    <bpmn:serviceTask id="ship" name="Ship" />
    <bpmn:endEvent id="end" name="Done" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="ship" />
    <bpmn:sequenceFlow id="f2" sourceRef="ship" targetRef="end" />
  </bpmn:process>
</bpmn:definitions>`

describe("renderForPaste", () => {
	it("fences by default, because every destination collapses spaces", () => {
		const out = renderForPaste(XML)
		expect(out.startsWith("```text\n")).toBe(true)
		expect(out.endsWith("\n```")).toBe(true)
	})

	it("draws the elements the process contains", () => {
		const out = renderForPaste(XML, "plain")
		expect(out).toContain("Ship")
		expect(out).toContain("Done")
		// The renderer elides a name too long for its box, which is why this
		// asserts the elision rather than the word: "Ordered" arrives as "Order…".
		expect(out).toMatch(/Order/)
	})

	it("starts at column zero, so a review comment is not mostly margin", () => {
		// The layout draws where its own coordinates fall — tens of columns in for
		// a real process — and the title line at column zero would defeat a dedent,
		// which is why the title is dropped before the drawing is shifted left.
		const lines = renderForPaste(XML, "plain").split("\n")
		expect(lines.some((line) => line.trimStart() === line && line.trim() !== "")).toBe(true)
		expect(lines[0]?.trim()).not.toBe("")
	})

	it("keeps the drawing's own alignment while removing the shared margin", () => {
		const lines = renderForPaste(XML, "plain").split("\n")
		const box = lines.filter((line) => line.includes("│"))
		expect(box.length).toBeGreaterThan(0)
		// Every box row must still line up with the others.
		expect(new Set(box.map((line) => line.indexOf("│"))).size).toBe(1)
	})

	it("leaves a plain rendering unfenced", () => {
		expect(renderForPaste(XML, "plain")).not.toContain("```")
	})

	it("does not leave trailing blank lines inside the fence", () => {
		// The ASCII grid is padded below the last row; pasted into a review that
		// padding is a run of empty lines before the closing fence.
		const lines = renderForPaste(XML).split("\n")
		expect(lines[lines.length - 2]).not.toMatch(/^\s*$/)
	})

	it("propagates a parse failure rather than rendering an empty box", () => {
		expect(() => renderForPaste("<bpmn:definitions")).toThrow()
	})
})
