import { describe, expect, it } from "vitest"
import { parseXml } from "../src/xml/xml-parser.js"
import { preserveFormatting } from "../src/xml/xml-patch.js"

/**
 * The safety property, checked on every case below: whatever the patch does to
 * the bytes, the document it produces must say what `updated` says.
 */
function samePayload(a: string, b: string): void {
	const normalise = (xml: string): unknown => {
		const strip = (node: {
			name: string
			attributes: Record<string, string>
			children: unknown[]
			text?: string
		}): unknown => ({
			name: node.name,
			attributes: node.attributes,
			text: (node.text ?? "").trim(),
			children: (node.children as (typeof node)[]).map(strip),
		})
		return strip(parseXml(xml) as never)
	}
	expect(normalise(a)).toEqual(normalise(b))
}

/** Applies the patch and asserts it kept the meaning of `updated`. */
function patch(original: string, updated: string, options = {}): string {
	const result = preserveFormatting(original, updated, options)
	samePayload(result, updated)
	return result
}

describe("preserveFormatting", () => {
	it("returns the original untouched when nothing changed", () => {
		const original = `<a>\n  <b id="1" x="2"/>\n</a>`
		expect(patch(original, `<a><b id="1" x="2"/></a>`)).toBe(original)
	})

	it("changes one attribute value and nothing else", () => {
		const original = `<a>\n\t<b id="1" x="2"/>\n</a>`
		expect(patch(original, `<a><b id="1" x="9"/></a>`)).toBe(`<a>\n\t<b id="1" x="9"/>\n</a>`)
	})

	it("adds an attribute after the ones already there", () => {
		const original = `<a><b id="1"/></a>`
		expect(patch(original, `<a><b id="1" name="n"/></a>`)).toBe(`<a><b id="1" name="n"/></a>`)
	})

	it("adds an attribute without doubling the space before a spaced close", () => {
		const original = `<a><b id="1" /></a>`
		expect(patch(original, `<a><b id="1" name="n"/></a>`)).toBe(`<a><b id="1" name="n" /></a>`)
	})

	it("removes an attribute along with the space in front of it", () => {
		const original = `<a><b id="1" gone="x" kept="y"/></a>`
		expect(patch(original, `<a><b id="1" kept="y"/></a>`)).toBe(`<a><b id="1" kept="y"/></a>`)
	})

	it("keeps an attribute the update dropped when asked to", () => {
		const original = `<a><b id="1" isExecutable="false"/></a>`
		const kept = preserveFormatting(original, `<a><b id="1"/></a>`, { droppedAttributes: "keep" })
		expect(kept).toBe(original)
	})

	it("leaves a value alone when only its spelling differs", () => {
		// `&#10;` and `&#xA;` are the same newline. Rewriting one into the other
		// is a diff that says nothing.
		const original = `<a t="one&#10;two"/>`
		expect(patch(original, `<a t="one&#xA;two"/>`)).toBe(original)
	})

	it("escapes a value it does write", () => {
		const original = `<a t="plain"/>`
		const result = patch(original, `<a t="x &amp; y"/>`)
		expect(result).toBe(`<a t="x &amp; y"/>`)
	})

	it("keeps comments between the elements around them", () => {
		const original = `<a>\n  <!-- why this exists -->\n  <b id="1" x="2"/>\n</a>`
		expect(patch(original, `<a><b id="1" x="3"/></a>`)).toContain("<!-- why this exists -->")
	})

	it("keeps a comment when the element beside it is deleted", () => {
		const original = `<a>\n  <!-- keep me -->\n  <b id="1"/>\n  <c id="2"/>\n</a>`
		const result = patch(original, `<a><c id="2"/></a>`)
		expect(result).toContain("<!-- keep me -->")
		expect(result).not.toContain(`id="1"`)
	})

	it("replaces text content", () => {
		const original = `<a>\n  <b id="1">old</b>\n</a>`
		expect(patch(original, `<a><b id="1">new</b></a>`)).toBe(`<a>\n  <b id="1">new</b>\n</a>`)
	})

	it("treats whitespace-only content as formatting on both sides", () => {
		const original = "<a>\n</a>"
		expect(patch(original, "<a></a>")).toBe(original)
	})

	it("gives a self-closing element content by writing it out again", () => {
		const original = `<a><b id="1"/></a>`
		expect(patch(original, `<a><b id="1">text</b></a>`)).toBe(`<a><b id="1">text</b></a>`)
	})

	it("deletes a child and the line it sat on", () => {
		const original = `<a>\n  <b id="1"/>\n  <c id="2"/>\n</a>`
		expect(patch(original, `<a><b id="1"/></a>`)).toBe(`<a>\n  <b id="1"/>\n</a>`)
	})

	it("inserts a new child at the indentation its siblings use", () => {
		const original = `<a>\n    <b id="1"/>\n</a>`
		const result = patch(original, `<a>\n  <b id="1"/>\n  <c id="2"/>\n</a>`)
		expect(result).toBe(`<a>\n    <b id="1"/>\n    <c id="2"/>\n</a>`)
	})

	it("re-indents a nested block it inserts, in the original's own step", () => {
		// The update indents two spaces and the original four, so the inserted
		// block's inner line lands at eight — one of *this* file's steps deeper —
		// rather than keeping the update's two.
		const original = `<a>\n    <b id="1"/>\n</a>`
		const updated = `<a>\n  <b id="1"/>\n  <c id="2">\n    <d id="3"/>\n  </c>\n</a>`
		expect(patch(original, updated)).toBe(
			`<a>\n    <b id="1"/>\n    <c id="2">\n        <d id="3"/>\n    </c>\n</a>`,
		)
	})

	it("inserts before the sibling that follows it", () => {
		const original = `<a>\n  <b id="1"/>\n  <d id="3"/>\n</a>`
		const result = patch(original, `<a><b id="1"/><c id="2"/><d id="3"/></a>`)
		expect(result.indexOf(`id="2"`)).toBeGreaterThan(result.indexOf(`id="1"`))
		expect(result.indexOf(`id="2"`)).toBeLessThan(result.indexOf(`id="3"`))
	})

	it("inserts into a parent that had no children", () => {
		const original = "<a>\n</a>"
		expect(patch(original, `<a>\n  <b id="1"/>\n</a>`)).toContain(`<b id="1"/>`)
	})

	it("reorders children by default, because order can carry meaning", () => {
		const original = `<a>\n  <b id="1"/>\n  <c id="2"/>\n</a>`
		const result = patch(original, `<a><c id="2"/><b id="1"/></a>`)
		expect(result.indexOf(`id="2"`)).toBeLessThan(result.indexOf(`id="1"`))
	})

	it("leaves children where they were when told order says nothing", () => {
		const original = `<a>\n  <b id="1"/>\n  <c id="2"/>\n</a>`
		const result = preserveFormatting(original, `<a><c id="2"/><b id="1"/></a>`, {
			siblingOrder: "keep",
		})
		expect(result).toBe(original)
	})

	it("patches an id-less element in place rather than rewriting it", () => {
		// Without pairing by name this becomes a delete and an insert, and every
		// line inside comes back in the update's formatting.
		const original = `<a>\n  <loop sequential="false">\n    <!-- kept -->\n    <inner x="1"/>\n  </loop>\n</a>`
		const updated = `<a><loop sequential="true"><inner x="1"/></loop></a>`
		const result = patch(original, updated)
		expect(result).toContain("<!-- kept -->")
		expect(result).toContain(`<loop sequential="true">`)
	})

	it("replaces an element outright when the pairing lands on a different tag", () => {
		const original = `<a>\n  <b id="1" x="2"/>\n</a>`
		expect(patch(original, `<a><c id="1" x="2"/></a>`)).toContain("<c ")
	})

	it("handles a document whose root has attributes and namespaces", () => {
		const original = `<?xml version="1.0"?>\n<r xmlns:n="urn:n" id="root">\n  <n:b id="1"/>\n</r>`
		const result = patch(original, `<r xmlns:n="urn:n" id="root"><n:b id="1" v="2"/></r>`)
		expect(result.startsWith(`<?xml version="1.0"?>`)).toBe(true)
		expect(result).toContain(`<n:b id="1" v="2"/>`)
	})

	// ── Falling back ──────────────────────────────────────────────────────────

	it("returns the update when the original will not parse", () => {
		expect(preserveFormatting("<a", `<a id="1"/>`)).toBe(`<a id="1"/>`)
	})

	it("returns the update when it will not parse", () => {
		expect(preserveFormatting(`<a id="1"/>`, "<a")).toBe("<a")
	})

	it("returns the update when the root element is a different one", () => {
		expect(preserveFormatting("<a/>", "<b/>")).toBe("<b/>")
	})

	it("never loses a difference, however oddly the original is written", () => {
		const original = `<a\n   id = 'quoted'\n   note="x"\n>\n\t<b id='1'   x='2'/>\n</a>`
		patch(original, `<a id="quoted" note="y"><b id="1" x="3"/></a>`)
	})
})
