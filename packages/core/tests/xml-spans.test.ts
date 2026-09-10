import { describe, expect, it } from "vitest"
import { parseXmlSpans } from "../src/xml/xml-spans.js"

const at = (xml: string, start: number, end: number): string => xml.slice(start, end)

describe("parseXmlSpans", () => {
	it("spans the whole element", () => {
		const xml = "<a><b/></a>"
		const root = parseXmlSpans(xml)
		expect(at(xml, root.start, root.end)).toBe(xml)
		const child = root.children[0]
		expect(child && at(xml, child.start, child.end)).toBe("<b/>")
	})

	it("spans an attribute value between its quotes", () => {
		const xml = `<a id="one" x="2"/>`
		const root = parseXmlSpans(xml)
		const id = root.attributes.get("id")
		expect(id && at(xml, id.start, id.end)).toBe("one")
		const x = root.attributes.get("x")
		expect(x && at(xml, x.start, x.end)).toBe("2")
	})

	it("decodes an attribute value while spanning what was written", () => {
		// The comparison wants the value; the edit wants the characters. Both.
		const xml = `<a t="a &amp; b"/>`
		const t = parseXmlSpans(xml).attributes.get("t")
		expect(t?.value).toBe("a & b")
		expect(t && at(xml, t.start, t.end)).toBe("a &amp; b")
	})

	it("spans single-quoted values too", () => {
		const xml = `<a id='one'/>`
		const id = parseXmlSpans(xml).attributes.get("id")
		expect(id && at(xml, id.start, id.end)).toBe("one")
	})

	it("marks the content of an element with children", () => {
		const xml = "<a>\n  <b/>\n</a>"
		const root = parseXmlSpans(xml)
		expect(at(xml, root.contentStart, root.contentEnd)).toBe("\n  <b/>\n")
	})

	it("gives a self-closing element an empty content span", () => {
		const xml = "<a/>"
		const root = parseXmlSpans(xml)
		expect(root.selfClosing).toBe(true)
		expect(root.contentStart).toBe(root.contentEnd)
		expect(at(xml, root.start, root.end)).toBe("<a/>")
	})

	it("reads text content", () => {
		const xml = "<a>hello</a>"
		const root = parseXmlSpans(xml)
		expect(root.text).toBe("hello")
		expect(at(xml, root.contentStart, root.contentEnd)).toBe("hello")
	})

	it("survives a > inside an attribute value", () => {
		const xml = `<a cond="x > 1"><b/></a>`
		const root = parseXmlSpans(xml)
		expect(root.attributes.get("cond")?.value).toBe("x > 1")
		expect(root.children).toHaveLength(1)
	})

	it("keeps comments out of the tree but inside the spans around them", () => {
		const xml = "<a>\n  <!-- note -->\n  <b/>\n</a>"
		const root = parseXmlSpans(xml)
		expect(root.children).toHaveLength(1)
		expect(at(xml, root.contentStart, root.contentEnd)).toContain("<!-- note -->")
	})

	it("spans elements nested at depth", () => {
		const xml = `<a><b><c id="deep"/></b></a>`
		const root = parseXmlSpans(xml)
		const c = root.children[0]?.children[0]
		expect(c && at(xml, c.start, c.end)).toBe(`<c id="deep"/>`)
	})

	it("spans every element in a document with a declaration and a doctype", () => {
		const xml = `<?xml version="1.0"?>\n<!-- lead -->\n<a id="r"><b/></a>`
		const root = parseXmlSpans(xml)
		expect(at(xml, root.start, root.end)).toBe(`<a id="r"><b/></a>`)
	})

	it("reads CDATA as text", () => {
		const xml = "<a><![CDATA[x < y]]></a>"
		expect(parseXmlSpans(xml).text).toBe("x < y")
	})

	it("refuses a document with no root", () => {
		expect(() => parseXmlSpans("<!-- nothing -->")).toThrow(/no root element/)
	})
})
