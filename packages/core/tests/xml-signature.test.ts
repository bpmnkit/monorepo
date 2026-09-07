import { describe, expect, it } from "vitest"
import { diffSignatures, formatChange, xmlSignature } from "./support/xml-signature.js"

/**
 * The round-trip gate is only as trustworthy as the scanner that feeds it, and
 * the scanner is hand-rolled precisely so it shares no code with the parser
 * under test. These cases pin its behaviour.
 */
describe("xmlSignature", () => {
	it("counts elements, attributes, parentage and text", () => {
		const signature = xmlSignature('<a x="1"><b>hi</b><b/></a>')
		expect(signature.get("element:a")).toBe(1)
		expect(signature.get("element:b")).toBe(2)
		expect(signature.get("attr:a@x")).toBe(1)
		expect(signature.get("child:a > b")).toBe(2)
		expect(signature.get("text:b")).toBe(1)
	})

	it("keeps namespace prefixes distinct", () => {
		const signature = xmlSignature("<bpmn:task/><zeebe:task/>")
		expect(signature.get("element:bpmn:task")).toBe(1)
		expect(signature.get("element:zeebe:task")).toBe(1)
	})

	it("ignores xmlns declarations but keeps prefixed attributes", () => {
		const signature = xmlSignature('<a xmlns:z="urn:z" xmlns="urn:d" z:k="v"/>')
		expect([...signature.keys()].filter((key) => key.includes("xmlns"))).toEqual([])
		expect(signature.get("attr:a@z:k")).toBe(1)
	})

	it("does not mistake markup inside attribute values for tags", () => {
		const signature = xmlSignature(`<a title='a &gt; b' expr="x < y /> z" other="1"/>`)
		expect(signature.get("element:a")).toBe(1)
		expect(signature.get("attr:a@expr")).toBe(1)
		expect(signature.get("attr:a@other")).toBe(1)
		expect(signature.get("element:y")).toBeUndefined()
	})

	it("skips comments, processing instructions and the doctype", () => {
		const signature = xmlSignature('<?xml version="1.0"?><!DOCTYPE a><!-- <ghost/> --><a/>')
		expect(signature.get("element:a")).toBe(1)
		expect(signature.get("element:ghost")).toBeUndefined()
	})

	it("reads CDATA as text, not as markup", () => {
		const signature = xmlSignature("<a><![CDATA[ x < 1 && <b/> ]]></a>")
		expect(signature.get("text:a")).toBe(1)
		expect(signature.get("element:b")).toBeUndefined()
	})

	it("does not count whitespace-only content as text", () => {
		expect(xmlSignature("<a>\n\t  \n</a>").get("text:a")).toBeUndefined()
	})

	it("is independent of attribute and sibling order", () => {
		const left = xmlSignature('<a><b x="1" y="2"/><c/></a>')
		const right = xmlSignature('<a><c/><b y="2" x="1"/></a>')
		expect(diffSignatures(left, right)).toEqual([])
	})

	it("registers a reparented element even though it still exists", () => {
		const before = xmlSignature("<root><a><x/></a><b/></root>")
		const after = xmlSignature("<root><a/><b><x/></b></root>")
		expect(diffSignatures(before, after).map(formatChange)).toEqual([
			"child:a > x: 1 -> 0",
			"child:b > x: 0 -> 1",
		])
	})

	it("excludes diagram interchange on request", () => {
		const xml =
			'<bpmn:definitions><bpmn:task/><bpmndi:BPMNShape id="s"><dc:Bounds x="1"/></bpmndi:BPMNShape></bpmn:definitions>'
		const kept = xmlSignature(xml)
		const dropped = xmlSignature(xml, { excludeDi: true })
		expect(kept.get("element:bpmndi:BPMNShape")).toBe(1)
		expect(dropped.get("element:bpmndi:BPMNShape")).toBeUndefined()
		expect(dropped.get("attr:dc:Bounds@x")).toBeUndefined()
		expect(dropped.get("element:bpmn:task")).toBe(1)
	})

	it("reports a dropped element, attribute and text body", () => {
		const before = xmlSignature('<a><b k="1">text</b></a>')
		const after = xmlSignature("<a><b/></a>")
		expect(diffSignatures(before, after).map(formatChange)).toEqual([
			"attr:b@k: 1 -> 0",
			"text:b: 1 -> 0",
		])
	})
})
