/**
 * Rewriting a document in place, so an edit reads as an edit.
 *
 * A serializer given a model produces its own formatting: its indentation, its
 * attribute order, its choice of `&#10;` over `&#xA;`. That is correct output
 * and a terrible diff. Move one element in a visual editor and every line of
 * the file changes, so the commit says "the whole diagram" when it means "a box
 * moved forty pixels" — and a reviewer has no way to tell those apart.
 *
 * {@link preserveFormatting} closes that gap without either side having to know
 * about the other. It takes the document as it was and the document as the
 * serializer would write it, and returns a third: the *content* of the second
 * carried by the *bytes* of the first, everywhere the two agree. No model is
 * involved, which is why it serves BPMN, DMN, forms and anything else this
 * toolkit learns to write.
 *
 * @packageDocumentation
 */

import { escapeAttr, escapeText } from "./xml-parser.js"
import { type SpannedElement, parseXmlSpans } from "./xml-spans.js"

/** How to treat children that appear in both documents in a different order. */
export type SiblingOrder =
	/**
	 * Reorder to match `updated`. Correct for any document, and the default:
	 * sibling order carries meaning in plenty of XML, and nothing here can tell
	 * which document that is.
	 */
	| "follow"
	/**
	 * Leave matched children where the original had them, patching each in
	 * place. Only correct where sibling order says nothing — which is a fact
	 * about a *schema*, so a caller choosing this should check the result rather
	 * than assume it. `exportPreserving` in the BPMN module is the worked
	 * example: it tries this, verifies the parsed model is unchanged, and falls
	 * back when it is not.
	 */
	| "keep"

export interface PreserveOptions {
	/** Default `"follow"`. */
	readonly siblingOrder?: SiblingOrder
	/**
	 * What to do about an attribute the original has and the update does not.
	 *
	 * - `"remove"` (default) — take it out, because the update says so.
	 * - `"keep"` — leave it. A serializer omits an attribute set to its schema
	 *   default, so `isExecutable="false"` disappears from a file that said it
	 *   out loud. Keeping it is only safe when re-reading the result gives the
	 *   same model, which is a check the caller has to make; see
	 *   `exportPreserving` in the BPMN module.
	 */
	readonly droppedAttributes?: "remove" | "keep"
}

/** The choices a walk was started with, carried down the tree. */
interface Settings {
	readonly siblingOrder: SiblingOrder
	readonly droppedAttributes: "remove" | "keep"
}

/** A replacement of one region of the original document. */
interface Edit {
	readonly start: number
	readonly end: number
	readonly text: string
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"])

function isBlank(text: string): boolean {
	return text.trim() === ""
}

/** Offset of the first whitespace character in the run before `offset`. */
function whitespaceStart(source: string, offset: number): number {
	let start = offset
	while (start > 0 && WHITESPACE.has(source[start - 1] as string)) start -= 1
	return start
}

/** The indentation of the line `offset` sits on, when it starts that line. */
function indentAt(source: string, offset: number): string {
	const start = whitespaceStart(source, offset)
	const lineStart = source.lastIndexOf("\n", offset - 1) + 1
	return start <= lineStart ? source.slice(lineStart, offset) : ""
}

/**
 * Where a whole attribute begins, walking back from its value.
 *
 * The scanner reports where a *value* sits; removing an attribute needs the
 * name and the `=` and the space in front of them as well, or the document is
 * left holding a stray `foo=` and stops parsing.
 */
function attributeStart(source: string, valueStart: number): number {
	// The opening quote, then whitespace, then "=", then whitespace, then the
	// name, then the whitespace separating it from whatever came before.
	let i = valueStart - 1
	while (i > 0 && WHITESPACE.has(source[i - 1] as string)) i -= 1
	if (source[i - 1] === "=") i -= 1
	while (i > 0 && WHITESPACE.has(source[i - 1] as string)) i -= 1
	while (i > 0 && !WHITESPACE.has(source[i - 1] as string) && source[i - 1] !== '"') i -= 1
	return whitespaceStart(source, i)
}

/** Where a new attribute goes: after the last one, before the tag closes. */
function attributeInsertPoint(source: string, element: SpannedElement): number {
	const close = element.contentStart - (element.selfClosing ? 2 : 1)
	return whitespaceStart(source, close)
}

/**
 * A child's identity, for lining up two versions of the same parent.
 *
 * An `id` is the answer whenever there is one, which in BPMN is nearly always.
 * Without one — a `di:waypoint`, a `bpmn:incoming` — the name plus what the
 * element says is enough: two waypoints with the same coordinates really are
 * interchangeable, so pairing them either way round is correct.
 */
function childKey(element: SpannedElement): string {
	const id = element.attributes.get("id")
	if (id !== undefined) return `#${id.value}`

	const attributes = [...element.attributes]
		.map(([name, attribute]) => `${name}=${attribute.value}`)
		.sort()
		.join(" ")
	return `${element.name} ${attributes} ${element.text.trim()}`
}

/**
 * Lines up two sequences by longest common subsequence.
 *
 * Returns, for each index in `a`, the index in `b` it pairs with, or -1. An
 * alignment rather than a set of pairs, because reordered children have to come
 * out reordered: matching on keys alone would rewrite each element where it
 * stands and silently keep the old order.
 */
function align(a: readonly string[], b: readonly string[]): number[] {
	const rows = a.length
	const columns = b.length
	// A standard LCS table. The sequences are one element's children, so the
	// quadratic cost is bounded by how many children a single element has.
	const table: number[][] = Array.from({ length: rows + 1 }, () =>
		new Array<number>(columns + 1).fill(0),
	)
	for (let i = rows - 1; i >= 0; i -= 1) {
		for (let j = columns - 1; j >= 0; j -= 1) {
			const row = table[i] as number[]
			const next = table[i + 1] as number[]
			row[j] =
				a[i] === b[j]
					? (next[j + 1] as number) + 1
					: Math.max(next[j] as number, row[j + 1] as number)
		}
	}

	const pairing = new Array<number>(rows).fill(-1)
	let i = 0
	let j = 0
	while (i < rows && j < columns) {
		if (a[i] === b[j]) {
			pairing[i] = j
			i += 1
			j += 1
		} else if ((table[i + 1]?.[j] ?? 0) >= (table[i]?.[j + 1] ?? 0)) {
			i += 1
		} else {
			j += 1
		}
	}
	return pairing
}

/**
 * Pairs each child with the first unused child of the same key, whatever
 * position it holds.
 *
 * Where {@link align} produces the reordering the two sequences differ by, this
 * produces none: an element that moved is patched where it already stands.
 */
function matchByKey(a: readonly string[], b: readonly string[]): number[] {
	const available = new Map<string, number[]>()
	for (const [index, key] of b.entries()) {
		const list = available.get(key)
		if (list === undefined) available.set(key, [index])
		else list.push(index)
	}
	return a.map((key) => available.get(key)?.shift() ?? -1)
}

/**
 * Pairs up leftovers that share a tag name, in order.
 *
 * The key-based passes above only recognise an element that is *identical* or
 * carries the same `id`. That leaves out an id-less element whose attributes
 * changed — a `dc:Bounds` that moved, a `bpmn:multiInstanceLoopCharacteristics`
 * that lost a flag — and without this those are deleted and written out again,
 * which throws away the formatting of everything inside them. Pairing them
 * turns that back into an attribute edit.
 *
 * Only elements *without* an `id` are paired here, and that restriction is what
 * keeps it from undoing a deliberate move: an element carrying an id has an
 * identity, so one the earlier pass could not place really did change position
 * and has to be moved. An element without one is known by where it sits, so a
 * leftover in the same relative position is the same element, changed.
 *
 * Both lists are walked forward only, so the pairs this adds never cross the
 * ones already made and the resulting edits stay in document order.
 */
function pairRemainingByName(
	a: readonly SpannedElement[],
	b: readonly SpannedElement[],
	pairing: number[],
): void {
	const taken = new Set(pairing.filter((index) => index >= 0))
	let cursor = 0
	for (const [index, child] of a.entries()) {
		if ((pairing[index] ?? -1) >= 0) {
			// Never pair across an existing match: doing so would reorder edits.
			cursor = Math.max(cursor, (pairing[index] as number) + 1)
			continue
		}
		if (child.attributes.has("id")) continue
		for (let j = cursor; j < b.length; j += 1) {
			const candidate = b[j] as SpannedElement
			if (taken.has(j) || candidate.name !== child.name || candidate.attributes.has("id")) continue
			pairing[index] = j
			taken.add(j)
			cursor = j + 1
			break
		}
	}
}

/** Everything that has to change inside one matched pair of elements. */
function diffElement(
	original: string,
	updated: string,
	a: SpannedElement,
	b: SpannedElement,
	edits: Edit[],
	settings: Settings,
): void {
	if (a.name !== b.name) {
		// The pairing put two different elements together — a renamed tag, or an
		// id reused for something else. Neither can be patched attribute by
		// attribute, so the whole element is replaced.
		edits.push({ start: a.start, end: a.end, text: updated.slice(b.start, b.end) })
		return
	}

	diffAttributes(original, a, b, edits, settings)

	if (a.children.length === 0 && b.children.length === 0) {
		diffText(a, b, edits)
		return
	}
	diffChildren(original, updated, a, b, edits, settings)
}

function diffAttributes(
	original: string,
	a: SpannedElement,
	b: SpannedElement,
	edits: Edit[],
	settings: Settings,
): void {
	for (const [name, wanted] of b.attributes) {
		const present = a.attributes.get(name)
		if (present === undefined) {
			const at = attributeInsertPoint(original, a)
			edits.push({ start: at, end: at, text: ` ${name}="${escapeAttr(wanted.value)}"` })
			continue
		}
		// Compare decoded values. `&#10;` and `&#xA;` are the same newline, and
		// rewriting one into the other is a diff that says nothing.
		if (present.value === wanted.value) continue
		edits.push({ start: present.start, end: present.end, text: escapeAttr(wanted.value) })
	}

	if (settings.droppedAttributes === "keep") return
	for (const [name, present] of a.attributes) {
		if (b.attributes.has(name)) continue
		edits.push({ start: attributeStart(original, present.start), end: present.end + 1, text: "" })
	}
}

function diffText(a: SpannedElement, b: SpannedElement, edits: Edit[]): void {
	if (a.text === b.text) return
	// Whitespace-only content on both sides is formatting, not content: an
	// element pretty-printed as `<a>\n</a>` says exactly what `<a></a>` says.
	if (isBlank(a.text) && isBlank(b.text)) return

	// There is nothing to replace inside a self-closing tag, so an element that
	// gains content has to be written out again.
	if (a.selfClosing) {
		edits.push({
			start: a.start,
			end: a.end,
			text: `<${a.name}${attributesOf(a, b)}>${escapeText(b.text)}</${a.name}>`,
		})
		return
	}
	edits.push({ start: a.contentStart, end: a.contentEnd, text: escapeText(b.text) })
}

/**
 * The attribute list for an element being written out again.
 *
 * Takes `b`'s values in `a`'s order, so an element that has to be regenerated
 * still comes out looking as much like the original as it can.
 */
function attributesOf(a: SpannedElement, b: SpannedElement): string {
	const parts: string[] = []
	for (const [name] of a.attributes) {
		const wanted = b.attributes.get(name)
		if (wanted !== undefined) parts.push(` ${name}="${escapeAttr(wanted.value)}"`)
	}
	for (const [name, wanted] of b.attributes) {
		if (!a.attributes.has(name)) parts.push(` ${name}="${escapeAttr(wanted.value)}"`)
	}
	return parts.join("")
}

function diffChildren(
	original: string,
	updated: string,
	a: SpannedElement,
	b: SpannedElement,
	edits: Edit[],
	settings: Settings,
): void {
	const aKeys = a.children.map(childKey)
	const bKeys = b.children.map(childKey)
	const pairing = settings.siblingOrder === "keep" ? matchByKey(aKeys, bKeys) : align(aKeys, bKeys)
	pairRemainingByName(a.children, b.children, pairing)
	const matchedInB = new Set(pairing.filter((index) => index >= 0))

	// What indentation new children should take: whatever the existing ones use,
	// and failing that one step in from the parent.
	const sample = a.children[0]
	const indent =
		sample === undefined
			? `${indentAt(original, a.start)}${indentUnit(original)}`
			: indentAt(original, sample.start)

	for (const [index, child] of a.children.entries()) {
		const match = pairing[index] ?? -1
		if (match < 0) {
			// Take the whitespace that put the child on its own line with it;
			// anything else between siblings — a comment — stays where it is.
			edits.push({ start: whitespaceStart(original, child.start), end: child.end, text: "" })
			continue
		}
		diffElement(original, updated, child, b.children[match] as SpannedElement, edits, settings)
	}

	for (const [index, child] of b.children.entries()) {
		if (matchedInB.has(index)) continue
		const at = insertionPoint(original, a, pairing, b, index)
		const written = reindent(
			updated.slice(child.start, child.end),
			indentAt(updated, child.start),
			indent,
			indentUnit(updated),
			indentUnit(original),
		)
		edits.push({ start: at, end: at, text: `\n${indent}${written}` })
	}
}

/** Where a new child belongs in the original text. */
function insertionPoint(
	original: string,
	a: SpannedElement,
	pairing: readonly number[],
	b: SpannedElement,
	index: number,
): number {
	// Straight after the original sibling paired with the nearest kept child
	// before it.
	for (let before = index - 1; before >= 0; before -= 1) {
		const inA = pairing.indexOf(before)
		if (inA >= 0) return (a.children[inA] as SpannedElement).end
	}
	// Nothing kept before it, so in front of the first surviving child — or at
	// the end of the parent's content, when none survive.
	for (let after = index + 1; after < b.children.length; after += 1) {
		const inA = pairing.indexOf(after)
		if (inA >= 0) return whitespaceStart(original, (a.children[inA] as SpannedElement).start)
	}
	return whitespaceStart(original, a.contentEnd)
}

/** The document's own indentation step, read from its first indented line. */
function indentUnit(source: string): string {
	const match = /\n([ \t]+)\S/.exec(source)
	return match?.[1] ?? "  "
}

/**
 * Re-indents a block written at one depth so it sits at another.
 *
 * By depth, not by string replacement: the two documents may not indent with
 * the same characters at all, and a block moved from a two-space update into a
 * tab-indented file has to have its *inner* lines converted too, or it arrives
 * with tabs outside and spaces inside.
 */
function reindent(
	text: string,
	from: string,
	to: string,
	fromUnit: string,
	toUnit: string,
): string {
	if (from === to && fromUnit === toUnit) return text
	const lines = text.split("\n")
	return lines
		.map((line, index) => {
			if (index === 0) return line
			const body = line.trimStart()
			const indent = line.slice(0, line.length - body.length)
			if (!indent.startsWith(from)) return line
			const deeper = indent.slice(from.length)
			const depth = fromUnit === "" ? 0 : Math.floor(deeper.length / fromUnit.length)
			return `${to}${toUnit.repeat(depth)}${body}`
		})
		.join("\n")
}

/** Applies edits to the source, refusing any pair that overlaps. */
function applyEdits(source: string, edits: readonly Edit[]): string {
	const ordered = [...edits].sort((x, y) => x.start - y.start || x.end - y.end)
	const parts: string[] = []
	let cursor = 0
	for (const edit of ordered) {
		if (edit.start < cursor) {
			// Two edits claiming the same characters mean the walk paired one
			// element with two, and the result would be nonsense. Refuse to produce
			// it; the caller falls back to the plain serialization.
			throw new Error("overlapping edits")
		}
		parts.push(source.slice(cursor, edit.start), edit.text)
		cursor = edit.end
	}
	parts.push(source.slice(cursor))
	return parts.join("")
}

/**
 * Rewrites `original` to say what `updated` says, changing as little as it can.
 *
 * The result is `updated`'s document — the same elements, attributes and text —
 * written with `original`'s formatting wherever the two agree. An element
 * nobody touched comes back byte for byte, comments and all; a moved shape
 * comes back as two changed numbers.
 *
 * Falls back to returning `updated` unchanged whenever it cannot do better:
 * either document failing to parse, a different root element, or an alignment
 * that would produce overlapping edits. The result is then exactly what the
 * caller would have written anyway, so calling this is never worse than not.
 *
 * @param original - The document as it stands.
 * @param updated - The same document as the serializer would write it now.
 * @param options - `siblingOrder` decides what happens to children that appear
 *   in both documents in a different order. See {@link SiblingOrder}.
 *
 * @example
 * ```typescript
 * const onDisk = await readFile("order.bpmn", "utf8");
 * const next = preserveFormatting(onDisk, Bpmn.export(edited));
 * // `next` differs from `onDisk` only where `edited` differs from what it held.
 * ```
 */
export function preserveFormatting(
	original: string,
	updated: string,
	options: PreserveOptions = {},
): string {
	let before: SpannedElement
	let after: SpannedElement
	try {
		before = parseXmlSpans(original)
		after = parseXmlSpans(updated)
	} catch {
		return updated
	}

	if (before.name !== after.name) return updated

	try {
		const edits: Edit[] = []
		diffElement(original, updated, before, after, edits, {
			siblingOrder: options.siblingOrder ?? "follow",
			droppedAttributes: options.droppedAttributes ?? "remove",
		})
		if (edits.length === 0) return original
		return applyEdits(original, edits)
	} catch {
		return updated
	}
}

/** How a verified preserve turned out, for a caller that wants to know. */
export interface VerifiedPreserve {
	/** The document to write. */
	readonly xml: string
	/**
	 * Which rung produced it.
	 *
	 * - `preserved` — the file's own order and formatting were kept.
	 * - `reordered` — formatting kept, children reordered as the update wants.
	 *   Reached when the document really does depend on sibling order.
	 * - `rewritten` — the update itself, because neither of the above survived
	 *   the check. Nothing is lost; the file is simply reformatted.
	 */
	readonly outcome: "preserved" | "reordered" | "rewritten"
}

/**
 * Preserves as much of `original` as a reader of the document will allow.
 *
 * The choices {@link preserveFormatting} cannot make safely on its own —
 * whether sibling order carries meaning, whether an attribute the update
 * dropped was a schema default — are made here by *trying and checking*. Each
 * candidate is parsed with the caller's own reader and compared against the
 * update; the first that reads the same is used, and the update itself is the
 * floor. So the aggressive strategies are never assumed to be safe for a
 * particular schema, only observed to be safe for a particular document.
 *
 * @param original - The document as it stands.
 * @param updated - The same document as the serializer would write it now.
 * @param read - Parses a document into something comparable with
 *   `JSON.stringify`. Anything it cannot parse counts as a failed check.
 */
export function preserveFormattingVerified(
	original: string,
	updated: string,
	read: (xml: string) => unknown,
): VerifiedPreserve {
	let wanted: string
	try {
		wanted = JSON.stringify(read(updated))
	} catch {
		return { xml: updated, outcome: "rewritten" }
	}

	// Most to least faithful to the file.
	const attempts = [
		["preserved", { siblingOrder: "keep", droppedAttributes: "keep" }],
		["preserved", { siblingOrder: "keep" }],
		["reordered", { siblingOrder: "follow" }],
	] as const

	for (const [outcome, options] of attempts) {
		const candidate = preserveFormatting(original, updated, options)
		// `preserveFormatting` returns the update when it cannot do better, which
		// needs no checking: it is the floor already.
		if (candidate === updated) continue
		try {
			if (JSON.stringify(read(candidate)) === wanted) return { xml: candidate, outcome }
		} catch {
			// A candidate that will not parse is simply not a candidate.
		}
	}

	return { xml: updated, outcome: "rewritten" }
}
