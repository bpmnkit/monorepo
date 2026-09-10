import { describe, expect, it } from "vitest"
import { parseJsonSpans } from "../src/json/json-spans.js"

const at = (json: string, start: number, end: number): string => json.slice(start, end)

describe("parseJsonSpans", () => {
	it("spans the whole document", () => {
		const json = `{"a": 1}`
		const root = parseJsonSpans(json)
		expect(at(json, root.start, root.end)).toBe(json)
		expect(root.kind).toBe("object")
	})

	it("spans a member's key and its value separately", () => {
		const json = `{\n  "name": "Reason"\n}`
		const member = parseJsonSpans(json).members?.[0]
		expect(member?.key).toBe("name")
		expect(member && at(json, member.start, member.end)).toBe(`"name": "Reason"`)
		expect(member && at(json, member.value.start, member.value.end)).toBe(`"Reason"`)
	})

	it("decodes a string while spanning what was written", () => {
		// The comparison wants the value; an edit wants the characters. Both.
		const json = `{"t": "caf\\u00e9"}`
		const value = parseJsonSpans(json).members?.[0]?.value
		expect(value?.value).toBe("café")
		expect(value && at(json, value.start, value.end)).toBe(`"caf\\u00e9"`)
	})

	it("decodes an escaped key", () => {
		expect(parseJsonSpans(`{"a\\nb": 1}`).members?.[0]?.key).toBe("a\nb")
	})

	it("reads every scalar kind", () => {
		const root = parseJsonSpans(`{"s":"x","n":-1.5e2,"t":true,"f":false,"z":null}`)
		expect(root.members?.map((m) => [m.key, m.value.kind, m.value.value])).toEqual([
			["s", "string", "x"],
			["n", "number", -150],
			["t", "boolean", true],
			["f", "boolean", false],
			["z", "null", null],
		])
	})

	it("spans array items", () => {
		const json = "[1, 22, 333]"
		const items = parseJsonSpans(json).items ?? []
		expect(items.map((item) => at(json, item.start, item.end))).toEqual(["1", "22", "333"])
	})

	it("handles empty containers", () => {
		expect(parseJsonSpans("{}").members).toEqual([])
		expect(parseJsonSpans("[]").items).toEqual([])
	})

	it("keeps members in the order they were written", () => {
		expect(parseJsonSpans(`{"z":1,"a":2}`).members?.map((m) => m.key)).toEqual(["z", "a"])
	})

	it("spans values nested at depth", () => {
		const json = `{"a": {"b": [{"c": "deep"}]}}`
		const deep = parseJsonSpans(json).members?.[0]?.value.members?.[0]?.value.items?.[0]
		expect(deep && at(json, deep.start, deep.end)).toBe(`{"c": "deep"}`)
	})

	it("is not confused by braces inside a string", () => {
		const json = `{"a": "}{[,", "b": 2}`
		expect(parseJsonSpans(json).members?.map((m) => m.key)).toEqual(["a", "b"])
	})

	it("is not confused by an escaped quote", () => {
		expect(parseJsonSpans(`{"a": "say \\"hi\\""}`).members?.[0]?.value.value).toBe('say "hi"')
	})

	it("accepts leading and trailing whitespace", () => {
		expect(parseJsonSpans(`\n  {"a": 1}\n`).kind).toBe("object")
	})

	it("refuses text that is not one document", () => {
		expect(() => parseJsonSpans(`{"a":1} {"b":2}`)).toThrow(/trailing content/)
	})

	it("refuses an unterminated string", () => {
		expect(() => parseJsonSpans(`{"a": "oops}`)).toThrow(/Unterminated string/)
	})

	it("refuses a missing brace", () => {
		expect(() => parseJsonSpans(`{"a": 1`)).toThrow()
	})

	it("refuses a bare word", () => {
		expect(() => parseJsonSpans("nope")).toThrow()
	})
})
