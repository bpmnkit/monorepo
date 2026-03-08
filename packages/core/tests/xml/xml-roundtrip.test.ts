import { describe, expect, it } from "vitest";
import { parseXml, serializeXml } from "../../src/xml/xml-parser.js";

describe("XML Parser", () => {
	it("parses a simple XML element", () => {
		const xml = '<?xml version="1.0"?><root id="1"><child name="a"/></root>';
		const el = parseXml(xml);
		expect(el.name).toBe("root");
		expect(el.attributes.id).toBe("1");
		expect(el.children).toHaveLength(1);
		expect(el.children[0].name).toBe("child");
		expect(el.children[0].attributes.name).toBe("a");
	});

	it("preserves namespace prefixes in element names", () => {
		const xml =
			'<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"><bpmn:process id="p"/></bpmn:definitions>';
		const el = parseXml(xml);
		expect(el.name).toBe("bpmn:definitions");
		expect(el.children[0].name).toBe("bpmn:process");
	});

	it("preserves namespace prefixes in attributes", () => {
		const xml =
			'<root xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><child xsi:type="bpmn:tFormalExpression"/></root>';
		const el = parseXml(xml);
		expect(el.children[0].attributes["xsi:type"]).toBe("bpmn:tFormalExpression");
	});

	it("preserves text content", () => {
		const xml = "<root><text>Hello World</text></root>";
		const el = parseXml(xml);
		expect(el.children[0].text).toBe("Hello World");
	});

	it("throws on empty XML", () => {
		expect(() => parseXml("")).toThrow();
	});

	it("throws on XML with no root element", () => {
		expect(() => parseXml('<?xml version="1.0"?>')).toThrow("Failed to parse XML");
	});
});

describe("XML Serializer", () => {
	it("produces valid XML with declaration", () => {
		const xml = '<?xml version="1.0"?><root id="1"><child/></root>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('<?xml version="1.0" encoding="UTF-8"?>');
		expect(output).toContain('<root id="1">');
	});

	it("preserves namespace declarations", () => {
		const xml =
			'<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"><bpmn:process id="p"/></bpmn:definitions>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"');
		expect(output).toContain('xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"');
	});

	it("self-closes empty elements", () => {
		const xml = '<root><empty id="e"/></root>';
		const el = parseXml(xml);
		const output = serializeXml(el);
		expect(output).toContain('<empty id="e"/>');
	});
});

describe("XML entity decoding", () => {
	it("decodes numeric character references in attribute values", () => {
		const xml = '<root name="Data Mapping&#10;epicIssueNumber"/>';
		const el = parseXml(xml);
		expect(el.attributes.name).toBe("Data Mapping\nepicIssueNumber");
	});

	it("decodes predefined XML entities in attribute values", () => {
		const xml = '<root title="a &amp; b &lt; c &gt; d"/>';
		const el = parseXml(xml);
		expect(el.attributes.title).toBe("a & b < c > d");
	});

	it("preserves round-trip for attribute values with special chars", () => {
		const xml = '<root name="a &amp; b"/>';
		const el = parseXml(xml);
		expect(el.attributes.name).toBe("a & b");
		const out = serializeXml(el);
		expect(out).toContain('name="a &amp; b"');
		const re = parseXml(out);
		expect(re.attributes.name).toBe("a & b");
	});
});

describe("XML attribute escaping", () => {
	it("escapes double quotes in attribute values", () => {
		const element = {
			name: "root",
			attributes: {},
			children: [
				{
					name: "child",
					attributes: { source: '=x + "/path"', target: "url" },
					children: [],
				},
			],
		};

		const xml = serializeXml(element);
		expect(xml).toContain("&quot;/path&quot;");
		expect(xml).not.toContain('"/path"');

		// Roundtrip: parse the escaped XML and verify value is decoded
		const parsed = parseXml(xml);
		const child = parsed.children[0];
		expect(child?.attributes.source).toBe('=x + "/path"');
	});
});
