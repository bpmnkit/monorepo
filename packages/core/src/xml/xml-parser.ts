import type { XmlElement } from "../types/xml-element.js"

// ---------------------------------------------------------------------------
// Event scanner
// ---------------------------------------------------------------------------

/** What a sink wants the scanner to do with an element after its start tag. */
export const Visit = {
	/** Report child elements and character data. */
	All: 0,
	/**
	 * Skip the element's content: the scanner fast-forwards past the matching
	 * end tag without building attributes or decoding text for anything inside,
	 * and `end` is not called for it.
	 */
	Skip: 1,
	/** Report child elements but drop character data without decoding it. */
	ElementsOnly: 2,
} as const
export type Visit = (typeof Visit)[keyof typeof Visit]

/** Receives the events of one XML document from {@link scanXml}. */
export interface XmlSink {
	/**
	 * @param name qualified name, e.g. "bpmn:task"
	 * @param local name without its prefix, e.g. "task" (same string as `name` when unprefixed)
	 * @param selfClosing true for `<a/>`; `end` follows immediately
	 */
	start(
		name: string,
		local: string,
		attributes: Record<string, string>,
		selfClosing: boolean,
	): Visit
	/** Character data or CDATA directly inside the current element, entities decoded. */
	text(text: string): void
	end(name: string): void
}

/**
 * Scan an XML document, reporting the root element and everything inside it to
 * `sink`. Returns false when the document has no root element. Content after
 * the root element is ignored.
 */
export function scanXml(xml: string, sink: XmlSink): boolean {
	return new XmlScanner(xml).scan(sink)
}

/**
 * Parse an XML string into an XmlElement tree.
 * Returns the root element with all namespace prefixes preserved.
 * @throws Error if the XML has no root element.
 */
export function parseXml(xml: string): XmlElement {
	const builder = new TreeBuilder()
	if (!scanXml(xml, builder) || builder.root === undefined) {
		throw new Error("Failed to parse XML: no root element found")
	}
	return builder.root
}

/** Sink that materialises the document as an XmlElement tree. */
class TreeBuilder implements XmlSink {
	root: XmlElement | undefined
	private readonly stack: XmlElement[] = []

	start(name: string, _local: string, attributes: Record<string, string>): Visit {
		const el: XmlElement = { name, attributes, children: [] }
		const parent = this.stack[this.stack.length - 1]
		if (parent) parent.children.push(el)
		else this.root = el
		this.stack.push(el)
		return Visit.All
	}

	text(text: string): void {
		const el = this.stack[this.stack.length - 1] as XmlElement
		el.text = el.text === undefined ? text : el.text + text
	}

	end(): void {
		this.stack.pop()
	}
}

// Character codes the scanner switches on. Comparing codes avoids allocating a
// one-character string for every position visited.
const LT = 0x3c // <
const GT = 0x3e // >
const SLASH = 0x2f // /
const EQ = 0x3d // =
const QUESTION = 0x3f // ?
const BANG = 0x21 // !
const DQUOTE = 0x22 // "
const SQUOTE = 0x27 // '
const COLON = 0x3a // :
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d

class XmlScanner {
	private readonly s: string
	private readonly n: number
	private i = 0
	/** Index of the first ":" in the name most recently read, or -1. */
	private colon = -1
	/** Position of the next "&" at or after the last place we looked, or -1 for none. */
	private nextAmp = 0

	constructor(source: string) {
		this.s = source
		this.n = source.length
	}

	scan(sink: XmlSink): boolean {
		while (this.i < this.n) {
			this.skipWhitespace()
			if (this.i >= this.n) break
			if (this.s.charCodeAt(this.i) !== LT) {
				// text outside root — skip
				this.i++
				continue
			}
			const next = this.s.charCodeAt(this.i + 1)
			if (next === QUESTION) {
				this.skipPi()
			} else if (next === BANG) {
				if (this.s.startsWith("<!--", this.i)) this.skipComment()
				else this.skipBang()
			} else {
				this.element(sink)
				return true
			}
		}
		return false
	}

	/** Scan the element starting at `i` (which is "<") and everything inside it. */
	private element(sink: XmlSink): void {
		const s = this.s
		// Open elements, innermost last, with whether each one wants character data.
		const open: string[] = []
		const wantText: boolean[] = []
		if (this.openTag(sink, open, wantText) === 0) return

		while (open.length > 0) {
			if (this.i >= this.n) throw new Error(`Expected "</" at position ${this.i}`)
			const c = s.charCodeAt(this.i)
			if (c !== LT) {
				if (wantText[wantText.length - 1]) sink.text(this.readText())
				else this.skipText()
				continue
			}
			const next = s.charCodeAt(this.i + 1)
			if (next === SLASH) {
				this.i += 2
				const closing = this.readName()
				const name = open[open.length - 1] as string
				if (closing !== name) {
					throw new Error(`Mismatched closing tag: expected </${name}>, got </${closing}>`)
				}
				this.skipWhitespace()
				this.expectChar(GT, ">")
				open.pop()
				wantText.pop()
				sink.end(name)
			} else if (next === BANG) {
				if (s.startsWith("<!--", this.i)) {
					this.skipComment()
				} else if (s.startsWith("<![CDATA[", this.i)) {
					if (wantText[wantText.length - 1]) sink.text(this.readCData())
					else this.skipCData()
				} else {
					// Unknown declaration inside content — treat it as an element and
					// let the name reader fail on it, as before.
					this.openTag(sink, open, wantText)
				}
			} else if (next === QUESTION) {
				this.skipPi()
			} else {
				this.openTag(sink, open, wantText)
			}
		}
	}

	/**
	 * Read a start tag at `i`, report it, and push it onto `open` unless it was
	 * self-closing or the sink skipped it. Returns the new depth of `open`.
	 */
	private openTag(sink: XmlSink, open: string[], wantText: boolean[]): number {
		const s = this.s
		this.i++ // <
		const name = this.readName()
		const local = this.colon >= 0 ? s.substring(this.colon + 1, this.i) : name
		const attributes: Record<string, string> = {}
		this.readAttributes(attributes)
		this.skipWhitespace()

		if (s.charCodeAt(this.i) === SLASH && s.charCodeAt(this.i + 1) === GT) {
			this.i += 2
			if (sink.start(name, local, attributes, true) !== Visit.Skip) sink.end(name)
			return open.length
		}

		this.expectChar(GT, ">")
		const visit = sink.start(name, local, attributes, false)
		if (visit === Visit.Skip) {
			this.skipContent(name)
			return open.length
		}
		open.push(name)
		wantText.push(visit === Visit.All)
		return open.length
	}

	/**
	 * Fast-forward past the content and end tag of the element `name` whose
	 * start tag was just consumed, validating nesting but allocating nothing.
	 */
	private skipContent(name: string): void {
		const s = this.s
		// Open elements below `name`, as (start, length) spans into the source.
		const spans: number[] = []
		let depth = 1
		while (depth > 0) {
			const lt = s.indexOf("<", this.i)
			if (lt === -1) throw new Error(`Expected "</" at position ${this.n}`)
			this.i = lt
			const next = s.charCodeAt(lt + 1)
			if (next === SLASH) {
				this.i += 2
				const start = this.i
				this.skipName()
				const length = this.i - start
				if (spans.length === 0) {
					if (length !== name.length || !s.startsWith(name, start)) {
						throw new Error(
							`Mismatched closing tag: expected </${name}>, got </${s.substring(start, this.i)}>`,
						)
					}
				} else {
					const openLength = spans.pop() as number
					const openStart = spans.pop() as number
					if (!this.sameSpan(openStart, openLength, start, length)) {
						throw new Error(
							`Mismatched closing tag: expected </${s.substring(openStart, openStart + openLength)}>, got </${s.substring(start, this.i)}>`,
						)
					}
				}
				this.skipWhitespace()
				this.expectChar(GT, ">")
				depth--
			} else if (next === BANG && s.startsWith("<!--", lt)) {
				this.skipComment()
			} else if (next === BANG && s.startsWith("<![CDATA[", lt)) {
				const end = s.indexOf("]]>", lt + 9)
				if (end === -1) throw new Error("Unterminated CDATA section")
				this.i = end + 3
			} else if (next === QUESTION) {
				this.skipPi()
			} else {
				this.i++
				const start = this.i
				this.skipName()
				const length = this.i - start
				this.skipAttributes()
				this.skipWhitespace()
				if (s.charCodeAt(this.i) === SLASH && s.charCodeAt(this.i + 1) === GT) {
					this.i += 2
					continue
				}
				this.expectChar(GT, ">")
				spans.push(start, length)
				depth++
			}
		}
	}

	private sameSpan(aStart: number, aLength: number, bStart: number, bLength: number): boolean {
		if (aLength !== bLength) return false
		const s = this.s
		for (let k = 0; k < aLength; k++) {
			if (s.charCodeAt(aStart + k) !== s.charCodeAt(bStart + k)) return false
		}
		return true
	}

	private readAttributes(attrs: Record<string, string>): void {
		const s = this.s
		while (this.i < this.n) {
			this.skipWhitespace()
			const ch = s.charCodeAt(this.i)
			if (ch === GT || ch === SLASH) return
			const key = this.readName()
			this.skipWhitespace()
			this.expectChar(EQ, "=")
			this.skipWhitespace()
			attrs[key] = this.readAttrValue()
		}
	}

	/** Like readAttributes, but validates only; nothing is built. */
	private skipAttributes(): void {
		const s = this.s
		while (this.i < this.n) {
			this.skipWhitespace()
			const ch = s.charCodeAt(this.i)
			if (ch === GT || ch === SLASH) return
			this.skipName()
			this.skipWhitespace()
			this.expectChar(EQ, "=")
			this.skipWhitespace()
			const quote = s.charCodeAt(this.i)
			if (quote !== DQUOTE && quote !== SQUOTE) {
				throw new Error(`Expected quote at position ${this.i}`)
			}
			this.i++
			const end = s.indexOf(quote === DQUOTE ? '"' : "'", this.i)
			this.i = end === -1 ? this.n + 1 : end + 1
		}
	}

	private readAttrValue(): string {
		const quote = this.s.charCodeAt(this.i)
		if (quote !== DQUOTE && quote !== SQUOTE) {
			throw new Error(`Expected quote at position ${this.i}`)
		}
		this.i++
		const start = this.i
		let end = this.s.indexOf(quote === DQUOTE ? '"' : "'", start)
		if (end === -1) end = this.n
		this.i = end + 1 // skip closing quote
		return this.slice(start, end)
	}

	/**
	 * Substring with entities decoded. Values rarely contain "&", so instead of
	 * scanning each one, the position of the next "&" is remembered and only
	 * refreshed once the scan has moved past it.
	 */
	private slice(start: number, end: number): string {
		let amp = this.nextAmp
		if (amp !== -1 && amp < start) {
			amp = this.s.indexOf("&", start)
			this.nextAmp = amp
		}
		const value = this.s.substring(start, end)
		return amp !== -1 && amp < end ? decodeXmlEntities(value) : value
	}

	private readText(): string {
		const start = this.i
		let end = this.s.indexOf("<", start)
		if (end === -1) end = this.n
		this.i = end
		return this.slice(start, end)
	}

	private skipText(): void {
		const end = this.s.indexOf("<", this.i)
		this.i = end === -1 ? this.n : end
	}

	private skipCData(): void {
		const end = this.s.indexOf("]]>", this.i + 9)
		if (end === -1) throw new Error("Unterminated CDATA section")
		this.i = end + 3
	}

	private readName(): string {
		const start = this.i
		this.skipName()
		return this.s.substring(start, this.i)
	}

	/** Advance past a name, recording the position of its first ":" in `colon`. */
	private skipName(): void {
		const s = this.s
		let i = this.i
		let colon = -1
		while (i < this.n) {
			const c = s.charCodeAt(i)
			if (c === SPACE || c === TAB || c === LF || c === CR || c === GT || c === SLASH || c === EQ)
				break
			if (c === COLON && colon === -1) colon = i
			i++
		}
		this.colon = colon
		this.i = i
	}

	private readCData(): string {
		this.i += 9 // skip <![CDATA[
		const end = this.s.indexOf("]]>", this.i)
		if (end === -1) throw new Error("Unterminated CDATA section")
		const text = this.s.substring(this.i, end)
		this.i = end + 3
		return text
	}

	private skipPi(): void {
		this.i += 2 // skip <?
		const end = this.s.indexOf("?>", this.i)
		this.i = end === -1 ? this.n : end + 2
	}

	private skipComment(): void {
		this.i += 4 // skip <!--
		const end = this.s.indexOf("-->", this.i)
		this.i = end === -1 ? this.n : end + 3
	}

	private skipBang(): void {
		// Skip <!DOCTYPE ...> and similar
		this.i += 2
		let depth = 1
		while (this.i < this.n && depth > 0) {
			const c = this.s.charCodeAt(this.i)
			if (c === LT) depth++
			else if (c === GT) depth--
			this.i++
		}
	}

	private skipWhitespace(): void {
		const s = this.s
		let i = this.i
		while (i < this.n) {
			const c = s.charCodeAt(i)
			if (c !== SPACE && c !== TAB && c !== LF && c !== CR) break
			i++
		}
		this.i = i
	}

	private expectChar(code: number, shown: string): void {
		if (this.s.charCodeAt(this.i) !== code) {
			throw new Error(`Expected "${shown}" at position ${this.i}`)
		}
		this.i++
	}
}

// ---------------------------------------------------------------------------
// Entity helpers
// ---------------------------------------------------------------------------

const ENTITY_RE = /&(?:amp|lt|gt|quot|apos|#x[0-9a-fA-F]+|#[0-9]+);/g

function decodeEntity(m: string): string {
	if (m === "&amp;") return "&"
	if (m === "&lt;") return "<"
	if (m === "&gt;") return ">"
	if (m === "&quot;") return '"'
	if (m === "&apos;") return "'"
	if (m.startsWith("&#x")) return String.fromCodePoint(Number.parseInt(m.slice(3, -1), 16))
	return String.fromCodePoint(Number.parseInt(m.slice(2, -1), 10))
}

/** Decode XML predefined and numeric character entities in a string. */
function decodeXmlEntities(s: string): string {
	if (!s.includes("&")) return s
	return s.replace(ENTITY_RE, decodeEntity)
}

// ---------------------------------------------------------------------------
// Serializer
// ---------------------------------------------------------------------------

/**
 * Serialize an XmlElement tree to an XML string.
 * Produces a well-formed XML document with declaration.
 */
export function serializeXml(element: XmlElement): string {
	return `<?xml version="1.0" encoding="UTF-8"?>\n${writeElement(element, 0)}\n`
}

/** Indentation strings by depth, built once and reused across documents. */
const INDENTS: string[] = []
function indentFor(depth: number): string {
	let s = INDENTS[depth]
	if (s === undefined) {
		s = "  ".repeat(depth)
		INDENTS[depth] = s
	}
	return s
}

function writeElement(el: XmlElement, depth: number): string {
	const indent = indentFor(depth)
	let out = `${indent}<${el.name}`

	const attributes = el.attributes
	for (const key in attributes) {
		const value = attributes[key]
		// el.attributes is typed Record<string, string>, but content built from
		// generated/untyped code can leave a value undefined at runtime — skip
		// rather than crash the whole serialization on one bad attribute.
		if (typeof value !== "string") continue
		out += ` ${key}="${escapeAttr(value)}"`
	}

	const children = el.children
	const hasChildren = children.length > 0
	const hasText = el.text !== undefined

	if (!hasChildren && !hasText) return `${out}/>\n`

	out += ">"
	if (hasText) out += escapeText(el.text as string)

	if (hasChildren) {
		out += "\n"
		for (const child of children) out += writeElement(child, depth + 1)
		out += indent
	}

	return `${out}</${el.name}>\n`
}

// One regex test decides whether a value needs escaping at all; most do not,
// and the ones that do are rewritten in a single pass instead of six.
const ATTR_ESCAPE_RE = /[&<"\n\r\t]/
const ATTR_ESCAPE_ALL_RE = /[&<"\n\r\t]/g
const TEXT_ESCAPE_RE = /[&<>]/
const TEXT_ESCAPE_ALL_RE = /[&<>]/g

const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	// Whitespace that XML parsers would normalize in attribute values.
	"\n": "&#10;",
	"\r": "&#13;",
	"\t": "&#9;",
}

function escapeChar(ch: string): string {
	return ESCAPES[ch] ?? ch
}

function escapeAttr(value: string): string {
	if (!ATTR_ESCAPE_RE.test(value)) return value
	return value.replace(ATTR_ESCAPE_ALL_RE, escapeChar)
}

function escapeText(value: string): string {
	if (!TEXT_ESCAPE_RE.test(value)) return value
	return value.replace(TEXT_ESCAPE_ALL_RE, escapeChar)
}
