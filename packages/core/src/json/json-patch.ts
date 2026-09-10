/**
 * Rewriting a JSON document in place, so an edit reads as an edit.
 *
 * The same problem [`xml-patch.ts`](../xml/xml-patch.ts) solves for XML, and
 * mostly the same answer: take the file as it stands and the file as the
 * serializer would write it, and return the second's content carried by the
 * first's bytes. A form saved from a visual editor otherwise comes back with
 * this toolkit's indentation and this toolkit's key order, and one changed
 * label reads as a rewritten file.
 *
 * ## Why this one checks itself
 *
 * The XML version cannot know whether sibling order carries meaning in a
 * particular document, so it offers strategies and makes the caller verify.
 * JSON needs none of that, because JSON has no schema-dependent semantics to
 * be wrong about:
 *
 * - **An object is an unordered collection of members** (RFC 8259 §4), so
 *   keeping the file's own key order is not a guess about a schema; it is what
 *   the format says. Key order is never information.
 * - **An array is an ordered sequence** (§5), so item order always follows the
 *   update. A form's components are its components in order.
 *
 * That makes deep equality — insensitive to key order, sensitive to item order
 * — an exact statement of "this says what the update says", and the patch
 * checks itself against it before returning. No reader has to be supplied and
 * no strategy has to be chosen.
 *
 * @packageDocumentation
 */

import { type JsonMember, type JsonNode, parseJsonSpans } from "./json-spans.js"

/** A replacement of one region of the original document. */
interface Edit {
	readonly start: number
	readonly end: number
	readonly text: string
}

/** How a preserving write turned out. */
export interface PreservedJson {
	/** The document to write. */
	readonly json: string
	/**
	 * `preserved` when the file's own formatting was kept; `rewritten` when the
	 * update was used as it stands, because nothing better could be checked.
	 */
	readonly outcome: "preserved" | "rewritten"
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"])

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
 * Deep equality with JSON's own rules: members unordered, items ordered.
 *
 * This is the whole correctness argument. A patch that satisfies it says
 * exactly what the update says, and one that does not is thrown away.
 */
function sameValue(a: unknown, b: unknown): boolean {
	if (a === b) return true
	if (Array.isArray(a) || Array.isArray(b)) {
		if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
		return a.every((item, index) => sameValue(item, b[index]))
	}
	if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false

	const left = a as Record<string, unknown>
	const right = b as Record<string, unknown>
	const keys = Object.keys(left)
	if (keys.length !== Object.keys(right).length) return false
	return keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]))
}

/**
 * A value written the same way however it was formatted.
 *
 * Used to recognise the same array item in two documents. The source text will
 * not do: the update is indented differently by definition, so comparing what
 * was written would find nothing in common and rewrite every array in the file.
 */
function canonical(node: JsonNode): string {
	if (node.kind === "object") {
		const members = (node.members ?? [])
			.map((member) => `${JSON.stringify(member.key)}:${canonical(member.value)}`)
			.sort()
		return `{${members.join(",")}}`
	}
	if (node.kind === "array") {
		return `[${(node.items ?? []).map(canonical).join(",")}]`
	}
	return JSON.stringify(node.value ?? null)
}

/**
 * An item's identity, for lining up two versions of the same array.
 *
 * An `id` is the answer whenever there is one — a form component always has one
 * — because that is what survives an edit to everything else about it. Without
 * one the item's value stands in, so identical items pair up and a changed one
 * is replaced where it stands.
 */
function itemKey(node: JsonNode): string {
	if (node.kind === "object") {
		const id = node.members?.find((member) => member.key === "id")
		if (id !== undefined && id.value.kind === "string") return `#${String(id.value.value)}`
	}
	return canonical(node)
}

/**
 * Lines up two sequences by longest common subsequence.
 *
 * Returns, for each index in `a`, the index in `b` it pairs with, or -1.
 * Array order is meaning in JSON, so this has to produce the reordering the
 * two sequences differ by rather than patching each item where it stands.
 */
function align(a: readonly string[], b: readonly string[]): number[] {
	const rows = a.length
	const columns = b.length
	const table = Array.from({ length: rows + 1 }, () => new Int32Array(columns + 1))
	for (let i = rows - 1; i >= 0; i -= 1) {
		for (let j = columns - 1; j >= 0; j -= 1) {
			const row = table[i] as Int32Array
			const next = table[i + 1] as Int32Array
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
		} else if (
			((table[i + 1] as Int32Array)[j] as number) >= ((table[i] as Int32Array)[j + 1] as number)
		) {
			i += 1
		} else {
			j += 1
		}
	}
	return pairing
}

/** How a document indents one level, read from its first indented line. */
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

/** The text of a value from the update, re-indented for where it is going. */
function transplant(updated: string, node: JsonNode, indent: string, original: string): string {
	return reindent(
		updated.slice(node.start, node.end),
		indentAt(updated, node.start),
		indent,
		indentUnit(updated),
		indentUnit(original),
	)
}

interface Context {
	readonly original: string
	readonly updated: string
	readonly edits: Edit[]
}

function diffValue(context: Context, a: JsonNode, b: JsonNode): void {
	if (a.kind !== b.kind) {
		context.edits.push({
			start: a.start,
			end: a.end,
			text: transplant(context.updated, b, indentAt(context.original, a.start), context.original),
		})
		return
	}

	if (a.kind === "object") {
		diffObject(context, a, b)
		return
	}
	if (a.kind === "array") {
		diffArray(context, a, b)
		return
	}

	// A scalar. Compare the *values*: `1.0` and `1` are the same number, and
	// `"é"` and `"é"` are the same string. Rewriting one as the other is a
	// diff that says nothing.
	if (a.value === b.value) return
	context.edits.push({
		start: a.start,
		end: a.end,
		text: context.updated.slice(b.start, b.end),
	})
}

function diffObject(context: Context, a: JsonNode, b: JsonNode): void {
	const { original, updated, edits } = context
	const present = new Map((a.members ?? []).map((member) => [member.key, member]))
	const wanted = new Map((b.members ?? []).map((member) => [member.key, member]))

	for (const member of a.members ?? []) {
		const match = wanted.get(member.key)
		if (match === undefined) {
			edits.push(removeMember(original, a, member))
			continue
		}
		diffValue(context, member.value, match.value)
	}

	const additions = (b.members ?? []).filter((member) => !present.has(member.key))
	if (additions.length === 0) return

	const survivors = (a.members ?? []).filter((member) => wanted.has(member.key))
	const indent = memberIndent(original, a, survivors[0])
	const text = additions
		.map(
			(member) =>
				`"${escapeKey(member.key)}": ${transplant(updated, member.value, indent, original)}`,
		)
		.join(`,\n${indent}`)

	const last = survivors[survivors.length - 1]
	if (last !== undefined) {
		edits.push({ start: last.end, end: last.end, text: `,\n${indent}${text}` })
		return
	}
	// The object is losing every member it had and gaining these, or was empty.
	// Either way its whole body is written out.
	edits.push({
		start: a.start + 1,
		end: a.end - 1,
		text: `\n${indent}${text}\n${indentAt(original, a.start)}`,
	})
}

/** Where a new member's line should start. */
function memberIndent(original: string, a: JsonNode, sample: JsonMember | undefined): string {
	if (sample !== undefined) return indentAt(original, sample.start)
	return `${indentAt(original, a.start)}${indentUnit(original)}`
}

function escapeKey(key: string): string {
	// `JSON.stringify` owns the escape rules; strip the quotes it adds.
	return JSON.stringify(key).slice(1, -1)
}

/**
 * Removes a member, along with one comma and the whitespace that put it on its
 * own line.
 *
 * The comma taken is the one *after* it, unless it is the last member, in which
 * case the one before it goes instead — leave either behind and the document
 * stops being JSON.
 */
function removeMember(original: string, owner: JsonNode, member: JsonMember): Edit {
	const start = whitespaceStart(original, member.start)
	let end = member.end
	while (end < original.length && WHITESPACE.has(original[end] as string)) end += 1
	if (original[end] === ",") return { start, end: end + 1, text: "" }

	// Last one: take the comma in front instead, if there is one.
	const before = whitespaceStart(original, member.start)
	if (original[before - 1] === ",") {
		return { start: before - 1, end: member.end, text: "" }
	}
	// The only member. The braces close on an empty body.
	return { start: owner.start + 1, end: owner.end - 1, text: "" }
}

function diffArray(context: Context, a: JsonNode, b: JsonNode): void {
	const { original, updated, edits } = context
	const items = a.items ?? []
	const wanted = b.items ?? []
	const pairing = align(items.map(itemKey), wanted.map(itemKey))
	const matched = new Set(pairing.filter((index) => index >= 0))

	// A wholesale change reads worse as a hundred small edits than as one
	// replacement, and pairing nothing means there is no structure to keep.
	if (matched.size === 0 && (items.length > 0 || wanted.length > 0)) {
		edits.push({
			start: a.start,
			end: a.end,
			text: transplant(updated, b, indentAt(original, a.start), original),
		})
		return
	}

	const indent =
		items[0] === undefined
			? `${indentAt(original, a.start)}${indentUnit(original)}`
			: indentAt(original, (items[0] as JsonNode).start)

	for (const [index, item] of items.entries()) {
		const match = pairing[index] ?? -1
		if (match < 0) {
			edits.push(removeItem(original, a, item, index, items))
			continue
		}
		diffValue(context, item, wanted[match] as JsonNode)
	}

	for (const [index, item] of wanted.entries()) {
		if (matched.has(index)) continue
		const at = insertionPoint(original, items, pairing, index)
		const text = transplant(updated, item, indent, original)
		edits.push(
			at.after
				? { start: at.offset, end: at.offset, text: `,\n${indent}${text}` }
				: { start: at.offset, end: at.offset, text: `${text},\n${indent}` },
		)
	}
}

/** Where a new item belongs, and whether it follows what is already there. */
function insertionPoint(
	original: string,
	items: readonly JsonNode[],
	pairing: readonly number[],
	index: number,
): { offset: number; after: boolean } {
	for (let before = index - 1; before >= 0; before -= 1) {
		const inA = pairing.indexOf(before)
		if (inA >= 0) return { offset: (items[inA] as JsonNode).end, after: true }
	}
	for (let after = index + 1; after < pairing.length + items.length; after += 1) {
		const inA = pairing.indexOf(after)
		if (inA >= 0) return { offset: (items[inA] as JsonNode).start, after: false }
	}
	// Nothing kept on either side of it. Reachable only with at least one item
	// paired — an array with none goes through the wholesale branch above — but
	// stated rather than assumed, because being wrong here would be an exception.
	const last = items[items.length - 1]
	if (last === undefined) return { offset: original.length, after: true }
	return { offset: whitespaceStart(original, last.end), after: true }
}

/** Removes an array item and one comma, the same way {@link removeMember} does. */
function removeItem(
	original: string,
	owner: JsonNode,
	item: JsonNode,
	index: number,
	items: readonly JsonNode[],
): Edit {
	const start = whitespaceStart(original, item.start)
	let end = item.end
	while (end < original.length && WHITESPACE.has(original[end] as string)) end += 1
	if (original[end] === ",") return { start, end: end + 1, text: "" }

	if (index > 0) {
		const before = whitespaceStart(original, item.start)
		if (original[before - 1] === ",") return { start: before - 1, end: item.end, text: "" }
	}
	if (items.length === 1) return { start: owner.start + 1, end: owner.end - 1, text: "" }
	return { start, end: item.end, text: "" }
}

/** Applies edits to the source, refusing any pair that overlaps. */
function applyEdits(source: string, edits: readonly Edit[]): string {
	const ordered = [...edits].sort((x, y) => x.start - y.start || x.end - y.end)
	const parts: string[] = []
	let cursor = 0
	for (const edit of ordered) {
		if (edit.start < cursor) throw new Error("overlapping edits")
		parts.push(source.slice(cursor, edit.start), edit.text)
		cursor = edit.end
	}
	parts.push(source.slice(cursor))
	return parts.join("")
}

/**
 * Rewrites `original` to say what `updated` says, changing as little as it can.
 *
 * The result is `updated`'s document written with `original`'s formatting: its
 * indentation, its key order, its number and string spellings. A member nobody
 * touched comes back byte for byte.
 *
 * The patch is checked against `updated` before it is returned — object members
 * compared without regard to order, array items with — so a result that would
 * say anything else is discarded in favour of `updated` itself. That is also
 * what happens when either document will not parse. Calling this is never worse
 * than not.
 *
 * @param original - The document as it stands.
 * @param updated - The same document as the serializer would write it now.
 *
 * @example
 * ```typescript
 * const onDisk = await readFile("approval.form", "utf8");
 * const { json } = preserveJsonFormatting(onDisk, Form.export(edited));
 * // Renaming one label changes one line, whatever indentation the file uses.
 * ```
 */
export function preserveJsonFormatting(original: string, updated: string): PreservedJson {
	const rewritten: PreservedJson = { json: updated, outcome: "rewritten" }

	let a: JsonNode
	let b: JsonNode
	let wanted: unknown
	try {
		a = parseJsonSpans(original)
		b = parseJsonSpans(updated)
		wanted = JSON.parse(updated)
	} catch {
		return rewritten
	}

	let candidate: string
	try {
		const edits: Edit[] = []
		diffValue({ original, updated, edits }, a, b)
		if (edits.length === 0) return { json: original, outcome: "preserved" }
		candidate = applyEdits(original, edits)
	} catch {
		return rewritten
	}

	try {
		if (!sameValue(JSON.parse(candidate), wanted)) return rewritten
	} catch {
		return rewritten
	}
	return { json: candidate, outcome: "preserved" }
}
