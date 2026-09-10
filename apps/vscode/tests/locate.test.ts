import { describe, expect, it } from "vitest"
import { indexElementIds } from "../src/host/locate.js"

/** The span's text, so assertions read as what the reader would see squiggled. */
function at(xml: string, id: string): string | null {
	const span = indexElementIds(xml).get(id)
	return span === undefined ? null : xml.slice(span.offset, span.offset + span.length)
}

describe("indexElementIds", () => {
	it("spans the tag name, not the whole element", () => {
		const xml = `<bpmn:process id="p"><bpmn:serviceTask id="t" name="Ship" /></bpmn:process>`
		expect(at(xml, "t")).toBe("bpmn:serviceTask")
		expect(at(xml, "p")).toBe("bpmn:process")
	})

	it("reports the offset the tag name actually starts at", () => {
		const xml = `<a id="x"/>`
		expect(indexElementIds(xml).get("x")).toEqual({ offset: 1, length: 1 })
	})

	it("ignores attributes that merely end in id", () => {
		const xml = `<bpmn:userTask id="approve"><zeebe:formDefinition formId="f" /></bpmn:userTask>`
		const ids = indexElementIds(xml)
		expect([...ids.keys()]).toEqual(["approve"])
	})

	it("ignores a bpmnElement reference", () => {
		const xml = `<bpmndi:BPMNShape id="s1" bpmnElement="task" />`
		expect(at(xml, "task")).toBeNull()
		expect(at(xml, "s1")).toBe("bpmndi:BPMNShape")
	})

	it("prefers the semantic tag when diagram interchange reuses an id", () => {
		// Not legal XML, but exporters have shipped worse; the reader wants the
		// process element, not the picture of it.
		const xml = `<bpmndi:BPMNShape id="dup" /><bpmn:task id="dup" />`
		expect(at(xml, "dup")).toBe("bpmn:task")
	})

	it("keeps the first of two semantic tags sharing an id", () => {
		const xml = `<bpmn:task id="dup" name="first" /><bpmn:userTask id="dup" name="second" />`
		expect(at(xml, "dup")).toBe("bpmn:task")
	})

	it("does not read ids out of a comment", () => {
		const xml = `<!-- <bpmn:task id="ghost" /> --><bpmn:task id="real" />`
		expect([...indexElementIds(xml).keys()]).toEqual(["real"])
	})

	it("does not read ids out of CDATA", () => {
		const xml = `<doc><![CDATA[<bpmn:task id="ghost"/>]]></doc><bpmn:task id="real"/>`
		expect([...indexElementIds(xml).keys()]).toEqual(["real"])
	})

	it("skips the XML declaration", () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<bpmn:task id="t"/>`
		expect(at(xml, "t")).toBe("bpmn:task")
	})

	it("survives a > inside an attribute value", () => {
		// A FEEL condition with a comparison is the everyday case, and a naive
		// scan for the next ">" would end the tag in the middle of it.
		const xml = `<bpmn:sequenceFlow id="f" name="a > b"><bpmn:task id="after"/>`
		expect(at(xml, "f")).toBe("bpmn:sequenceFlow")
		expect(at(xml, "after")).toBe("bpmn:task")
	})

	it("reads single-quoted values", () => {
		expect(at(`<bpmn:task id='t'/>`, "t")).toBe("bpmn:task")
	})

	it("tolerates whitespace around the equals sign", () => {
		expect(at(`<bpmn:task id = "t"/>`, "t")).toBe("bpmn:task")
	})

	it("returns nothing for a file with no ids", () => {
		expect(indexElementIds("<bpmn:definitions />").size).toBe(0)
	})

	it("still places an element whose tag is not closed yet", () => {
		// The file is linted while it is being typed, so the last tag is routinely
		// half-written. Terminating is the invariant; finding the id is the bonus.
		expect(at(`<bpmn:task id="t"`, "t")).toBe("bpmn:task")
	})

	it("does not hang on an unterminated comment", () => {
		expect(indexElementIds(`<!-- <bpmn:task id="t"/>`).size).toBe(0)
	})

	it("finds ids nested at any depth", () => {
		const xml = `<a id="1"><b id="2"><c id="3"/></b></a>`
		expect([...indexElementIds(xml).keys()]).toEqual(["1", "2", "3"])
	})
})
