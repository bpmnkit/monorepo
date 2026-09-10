import { describe, expect, it } from "vitest"
import { preserveJsonFormatting } from "../src/json/json-patch.js"

/**
 * Applies the patch and asserts it kept the meaning of `updated`.
 *
 * The check the patcher runs on itself, run again from outside: members
 * compared without regard to order, items with. Every case below goes through
 * it, so no test can pass by producing a document that says something else.
 */
function patch(original: string, updated: string): string {
	const { json } = preserveJsonFormatting(original, updated)
	expect(sorted(JSON.parse(json))).toEqual(sorted(JSON.parse(updated)))
	return json
}

/** A value with every object's keys in a fixed order, so a comparison ignores it. */
function sorted(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(sorted)
	if (typeof value !== "object" || value === null) return value
	return Object.fromEntries(
		Object.keys(value as Record<string, unknown>)
			.sort()
			.map((key) => [key, sorted((value as Record<string, unknown>)[key])]),
	)
}

describe("preserveJsonFormatting", () => {
	it("returns the original untouched when nothing changed", () => {
		const original = `{\n  "a": 1,\n  "b": 2\n}\n`
		expect(patch(original, `{"b":2,"a":1}`)).toBe(original)
	})

	it("reports which it used", () => {
		expect(preserveJsonFormatting(`{"a":1}`, `{"a":2}`).outcome).toBe("preserved")
		expect(preserveJsonFormatting("not json", `{"a":2}`).outcome).toBe("rewritten")
	})

	// ── Formatting the update cannot know about ───────────────────────────────

	it("keeps the file's indentation, whatever it is", () => {
		const tabs = `{\n\t"a": {\n\t\t"b": 1\n\t}\n}\n`
		expect(patch(tabs, `{\n  "a": {\n    "b": 2\n  }\n}`)).toBe(`{\n\t"a": {\n\t\t"b": 2\n\t}\n}\n`)
	})

	it("keeps the file's key order, which JSON says is not information", () => {
		const original = `{\n  "z": 1,\n  "a": 2\n}`
		expect(patch(original, `{"a":2,"z":9}`)).toBe(`{\n  "z": 9,\n  "a": 2\n}`)
	})

	it("keeps a trailing newline", () => {
		expect(patch(`{"a": 1}\n`, `{"a": 2}`)).toBe(`{"a": 2}\n`)
	})

	it("leaves a number alone when only its spelling differs", () => {
		// `1.0` and `1` are the same number. Rewriting one as the other is a diff
		// that says nothing.
		const original = `{"a": 1.0, "b": 1e2}`
		expect(patch(original, `{"a": 1, "b": 100}`)).toBe(original)
	})

	it("leaves a string alone when only its escaping differs", () => {
		const original = `{"a": "caf\\u00e9"}`
		expect(patch(original, `{"a": "café"}`)).toBe(original)
	})

	// ── Editing ───────────────────────────────────────────────────────────────

	it("changes one value and nothing else", () => {
		const original = `{\n  "a": "old",\n  "b": "kept"\n}`
		expect(patch(original, `{"a":"new","b":"kept"}`)).toBe(`{\n  "a": "new",\n  "b": "kept"\n}`)
	})

	it("adds a member after the ones already there", () => {
		const original = `{\n  "a": 1\n}`
		expect(patch(original, `{"a":1,"b":2}`)).toBe(`{\n  "a": 1,\n  "b": 2\n}`)
	})

	it("adds a member to an empty object", () => {
		expect(patch("{}", `{"a":1}`)).toBe(`{\n  "a": 1\n}`)
	})

	it("removes a member and the comma that held it in place", () => {
		const original = `{\n  "a": 1,\n  "gone": 2,\n  "b": 3\n}`
		expect(patch(original, `{"a":1,"b":3}`)).toBe(`{\n  "a": 1,\n  "b": 3\n}`)
	})

	it("removes the last member, taking the comma in front of it", () => {
		const original = `{\n  "a": 1,\n  "gone": 2\n}`
		expect(patch(original, `{"a":1}`)).toBe(`{\n  "a": 1\n}`)
	})

	it("removes the only member", () => {
		expect(patch(`{\n  "gone": 1\n}`, "{}")).toBe("{}")
	})

	it("replaces a value whose kind changed", () => {
		const original = `{\n  "a": "text"\n}`
		expect(patch(original, `{"a": [1, 2]}`)).toBe(`{\n  "a": [1, 2]\n}`)
	})

	// ── Arrays ────────────────────────────────────────────────────────────────

	it("edits one item in place", () => {
		const original = `[\n  {"id": "x", "n": 1},\n  {"id": "y", "n": 2}\n]`
		expect(patch(original, `[{"id":"x","n":1},{"id":"y","n":9}]`)).toBe(
			`[\n  {"id": "x", "n": 1},\n  {"id": "y", "n": 9}\n]`,
		)
	})

	it("appends an item, in the text the update wrote for it", () => {
		// A value that is new has no formatting in the original to keep, so the
		// update's own text is transplanted and re-indented. In practice that text
		// comes from `JSON.stringify(..., null, 2)`; here it is minified, and the
		// transplant shows through.
		const original = `[\n  {"id": "x"}\n]`
		expect(patch(original, `[{"id":"x"},{"id":"y"}]`)).toBe(`[\n  {"id": "x"},\n  {"id":"y"}\n]`)
	})

	it("inserts an item in the middle", () => {
		const original = `[\n  {"id": "x"},\n  {"id": "z"}\n]`
		const result = patch(original, `[{"id":"x"},{"id":"y"},{"id":"z"}]`)
		expect(result).toBe(`[\n  {"id": "x"},\n  {"id":"y"},\n  {"id": "z"}\n]`)
	})

	it("inserts an item at the front", () => {
		const original = `[\n  {"id": "y"}\n]`
		expect(patch(original, `[{"id":"x"},{"id":"y"}]`)).toBe(`[\n  {"id":"x"},\n  {"id": "y"}\n]`)
	})

	it("re-indents a block it inserts to the depth it is going to", () => {
		const original = `{\n\t"v": [\n\t\t{"id": "x"}\n\t]\n}`
		const updated = `{\n  "v": [\n    {\n      "id": "x"\n    },\n    {\n      "id": "y"\n    }\n  ]\n}`
		expect(patch(original, updated)).toBe(
			`{\n\t"v": [\n\t\t{"id": "x"},\n\t\t{\n\t\t\t"id": "y"\n\t\t}\n\t]\n}`,
		)
	})

	it("removes an item", () => {
		const original = `[\n  {"id": "x"},\n  {"id": "gone"},\n  {"id": "y"}\n]`
		expect(patch(original, `[{"id":"x"},{"id":"y"}]`)).toBe(`[\n  {"id": "x"},\n  {"id": "y"}\n]`)
	})

	it("follows a reordering, because array order is meaning in JSON", () => {
		const original = `[\n  {"id": "x"},\n  {"id": "y"}\n]`
		const result = patch(original, `[{"id":"y"},{"id":"x"}]`)
		expect(JSON.parse(result).map((item: { id: string }) => item.id)).toEqual(["y", "x"])
	})

	it("recognises the same item however the update indented it", () => {
		// Comparing what was written would find nothing in common and rewrite
		// every array in the file.
		const original = `{\n\t"v": [\n\t\t{"label": "Yes"},\n\t\t{"label": "No"}\n\t]\n}`
		const updated = `{\n  "v": [\n    {\n      "label": "Yes"\n    },\n    {\n      "label": "No"\n    }\n  ]\n}`
		expect(patch(original, updated)).toBe(original)
	})

	it("empties an array", () => {
		expect(patch(`{\n  "a": [\n    1\n  ]\n}`, `{"a":[]}`)).toBe(`{\n  "a": []\n}`)
	})

	it("fills an empty array by writing it out", () => {
		// Nothing to pair with means nothing to keep, so the array is replaced
		// whole rather than assembled from edits that have no anchor.
		expect(patch(`{\n  "a": []\n}`, `{"a":[1]}`)).toBe(`{\n  "a": [1]\n}`)
	})

	// ── Falling back ──────────────────────────────────────────────────────────

	it("returns the update when the original will not parse", () => {
		expect(preserveJsonFormatting("{oops", `{"a":1}`).json).toBe(`{"a":1}`)
	})

	it("returns the update when it will not parse", () => {
		expect(preserveJsonFormatting(`{"a":1}`, "{oops").json).toBe("{oops")
	})

	it("returns the update when the document is a different shape entirely", () => {
		expect(patch(`{"a":1}`, "[1,2,3]")).toBe("[1,2,3]")
	})

	it("survives a document with duplicate keys by falling back", () => {
		// `JSON.parse` keeps the last of a duplicated key and this walk sees the
		// first, so the check is what stops a wrong answer being returned.
		const result = preserveJsonFormatting(`{"a": 1, "a": 2}`, `{"a": 3}`)
		expect(JSON.parse(result.json)).toEqual({ a: 3 })
	})
})
