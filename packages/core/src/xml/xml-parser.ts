import type { XmlElement } from "../types/xml-element.js"

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse an XML string into an XmlElement tree.
 * Returns the root element with all namespace prefixes preserved.
 * @throws Error if the XML has no root element.
 */
export function parseXml(xml: string): XmlElement {
	const p = new XmlReader(xml)
	const root = p.parseDocument()
	if (!root) throw new Error("Failed to parse XML: no root element found")
	return root
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
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d

class XmlReader {
	private s: string
	private n: number
	private i = 0

	constructor(source: string) {
		this.s = source
		this.n = source.length
	}

	parseDocument(): XmlElement | undefined {
		let root: XmlElement | undefined
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
				root = this.parseElement()
				break
			}
		}
		return root
	}

	private parseElement(): XmlElement {
		// Caller guarantees s[i] === "<".
		this.i++
		const name = this.readName()
		const attributes: Record<string, string> = {}
		this.readAttributes(attributes)
		this.skipWhitespace()

		const s = this.s
		if (s.charCodeAt(this.i) === SLASH && s.charCodeAt(this.i + 1) === GT) {
			// self-closing
			this.i += 2
			return { name, attributes, children: [] }
		}

		this.expectChar(GT, ">")

		const children: XmlElement[] = []
		let text: string | undefined

		while (this.i < this.n) {
			const c = s.charCodeAt(this.i)
			if (c === LT) {
				const next = s.charCodeAt(this.i + 1)
				if (next === SLASH) break
				if (next === BANG) {
					if (s.startsWith("<!--", this.i)) {
						this.skipComment()
					} else if (s.startsWith("<![CDATA[", this.i)) {
						const cd = this.readCData()
						text = text === undefined ? cd : text + cd
					} else {
						// Unknown declaration inside content — treat it as an element and
						// let the name reader fail on it, as before.
						children.push(this.parseElement())
					}
				} else if (next === QUESTION) {
					this.skipPi()
				} else {
					children.push(this.parseElement())
				}
			} else {
				const t = this.readText()
				if (t.length > 0) {
					text = text === undefined ? t : text + t
				}
			}
		}

		// closing tag </name>
		if (s.charCodeAt(this.i) !== LT || s.charCodeAt(this.i + 1) !== SLASH) {
			throw new Error(`Expected "</" at position ${this.i}`)
		}
		this.i += 2
		const closing = this.readName()
		if (closing !== name) {
			throw new Error(`Mismatched closing tag: expected </${name}>, got </${closing}>`)
		}
		this.skipWhitespace()
		this.expectChar(GT, ">")

		const el: XmlElement = { name, attributes, children }
		if (text !== undefined) el.text = text
		return el
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

	private readAttrValue(): string {
		const quote = this.s.charCodeAt(this.i)
		if (quote !== DQUOTE && quote !== SQUOTE) {
			throw new Error(`Expected quote at position ${this.i}`)
		}
		this.i++
		const start = this.i
		let end = this.s.indexOf(quote === DQUOTE ? '"' : "'", start)
		if (end === -1) end = this.n
		const value = this.s.substring(start, end)
		this.i = end + 1 // skip closing quote
		return decodeXmlEntities(value)
	}

	private readText(): string {
		const start = this.i
		let end = this.s.indexOf("<", start)
		if (end === -1) end = this.n
		this.i = end
		return decodeXmlEntities(this.s.substring(start, end))
	}

	private readName(): string {
		const s = this.s
		const start = this.i
		let i = start
		while (i < this.n) {
			const c = s.charCodeAt(i)
			if (c === SPACE || c === TAB || c === LF || c === CR || c === GT || c === SLASH || c === EQ)
				break
			i++
		}
		this.i = i
		return s.substring(start, i)
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
