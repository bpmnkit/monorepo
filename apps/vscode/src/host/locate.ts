/**
 * Where an element with a given id is written in a BPMN/DMN source file.
 *
 * The analysis in `@bpmnkit/core` works on a parsed model and reports element
 * *ids*; the Problems panel needs a *range*. Without this every finding would
 * land on line 1, and clicking one would tell the reader nothing they did not
 * already know.
 *
 * A parser would be the obvious tool and is the wrong one: `Bpmn.parse()`
 * deliberately throws source positions away, and the file on screen may not
 * even parse. So this is a scanner over the raw text — it never has to be
 * right about the document's meaning, only about where a piece of it was
 * typed.
 *
 * @packageDocumentation
 */

/** A region of the source file, as an offset and a length in UTF-16 units. */
export interface SourceSpan {
	readonly offset: number
	readonly length: number
}

/**
 * Diagram-interchange tags, by local name.
 *
 * A `BPMNShape` carries an `id` of its own and a `bpmnElement` pointing at what
 * it draws, so its id never collides with a semantic one in practice. The
 * distinction is kept anyway: an exporter that reuses ids across the two halves
 * would otherwise send the reader to the picture instead of the process.
 */
const DIAGRAM_TAGS: ReadonlySet<string> = new Set([
	"BPMNDiagram",
	"BPMNPlane",
	"BPMNShape",
	"BPMNEdge",
	"BPMNLabel",
	"DMNDI",
	"DMNDiagram",
	"DMNShape",
	"DMNEdge",
])

/** Matches an `id` attribute, and not `decisionId`, `formId` or `ns:id`. */
const ID_ATTRIBUTE = /(?:^|\s)id\s*=\s*(?:"([^"]*)"|'([^']*)')/

function isNameStart(ch: string): boolean {
	return /[A-Za-z_]/.test(ch)
}

function isNameChar(ch: string): boolean {
	return /[A-Za-z0-9_.:-]/.test(ch)
}

/** End of the tag name that starts at `from`. */
function tagNameEnd(xml: string, from: number): number {
	const first = xml[from]
	if (first === undefined || !isNameStart(first)) return from
	let i = from + 1
	while (i < xml.length) {
		const ch = xml[i]
		if (ch === undefined || !isNameChar(ch)) break
		i += 1
	}
	return i
}

/**
 * Index of the `>` closing the tag whose attributes start at `from`.
 *
 * Quoted attribute values are skipped, so a `>` inside a FEEL expression —
 * which is common and legal — does not end the tag early.
 */
function tagEnd(xml: string, from: number): number {
	let quote: string | null = null
	for (let i = from; i < xml.length; i += 1) {
		const ch = xml[i]
		if (quote !== null) {
			if (ch === quote) quote = null
			continue
		}
		if (ch === '"' || ch === "'") quote = ch
		else if (ch === ">") return i
	}
	return xml.length
}

/** Index just past `token`, or the end of the string when it is absent. */
function skipPast(xml: string, token: string, from: number): number {
	const at = xml.indexOf(token, from)
	return at < 0 ? xml.length : at + token.length
}

/**
 * Every `id` in a document, mapped to the span of the tag declaring it.
 *
 * The span covers the tag name — `bpmn:serviceTask`, not the whole element —
 * because that is the smallest region that identifies the element on screen.
 *
 * A duplicate id keeps its first occurrence, and a semantic tag always wins
 * over a diagram-interchange one no matter which came first.
 *
 * @param xml - The raw file text. It does not have to be well-formed.
 */
export function indexElementIds(xml: string): Map<string, SourceSpan> {
	const found = new Map<string, SourceSpan>()
	const fromDiagram = new Set<string>()

	let i = 0
	while (i < xml.length) {
		const lt = xml.indexOf("<", i)
		if (lt < 0) break

		const next = xml[lt + 1]
		if (next === "!") {
			if (xml.startsWith("<!--", lt)) i = skipPast(xml, "-->", lt + 4)
			else if (xml.startsWith("<![CDATA[", lt)) i = skipPast(xml, "]]>", lt + 9)
			else i = skipPast(xml, ">", lt + 2)
			continue
		}
		if (next === "?") {
			i = skipPast(xml, "?>", lt + 2)
			continue
		}
		if (next === "/") {
			i = skipPast(xml, ">", lt + 2)
			continue
		}

		const nameEnd = tagNameEnd(xml, lt + 1)
		if (nameEnd === lt + 1) {
			i = lt + 1
			continue
		}

		const close = tagEnd(xml, nameEnd)
		const name = xml.slice(lt + 1, nameEnd)
		const match = ID_ATTRIBUTE.exec(xml.slice(nameEnd, close))
		i = close + 1

		const id = match?.[1] ?? match?.[2]
		if (id === undefined || id === "") continue

		const local = name.slice(name.indexOf(":") + 1)
		const isDiagram = DIAGRAM_TAGS.has(local)
		// A semantic tag replaces a diagram one; nothing replaces a semantic one.
		if (found.has(id) && !(isDiagram === false && fromDiagram.has(id))) continue

		found.set(id, { offset: lt + 1, length: nameEnd - lt - 1 })
		if (isDiagram) fromDiagram.add(id)
		else fromDiagram.delete(id)
	}

	return found
}
