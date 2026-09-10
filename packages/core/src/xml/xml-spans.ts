/**
 * An XML document parsed into a tree that remembers where everything was.
 *
 * `parseXml` builds a clean tree with the source thrown away, which is right
 * for everything that reads a document. Rewriting one in place needs the
 * opposite: the exact offsets of each tag and each attribute value, so an edit
 * can replace four characters instead of regenerating the file.
 *
 * @packageDocumentation
 */

import { Visit, type XmlCursor, type XmlSink, scanXml } from "./xml-parser.js"

/** An attribute, and where its value sits between the quotes. */
export interface SpannedAttribute {
	/** The value with entities decoded — what a comparison should use. */
	readonly value: string
	/** Offset of the first character of the value, inside the quotes. */
	readonly start: number
	/** Offset just past the last character of the value. */
	readonly end: number
}

/** An element, and where it was written. */
export interface SpannedElement {
	/** Qualified name, e.g. `bpmn:serviceTask`. */
	readonly name: string
	readonly attributes: Map<string, SpannedAttribute>
	readonly children: SpannedElement[]
	/** Character data directly inside, entities decoded, concatenated. */
	text: string
	/** Offset of the `<` opening the start tag. */
	readonly start: number
	/** Offset just past the `>` closing the whole element. */
	end: number
	/** Offset just past the `>` closing the start tag. */
	readonly contentStart: number
	/** Offset of the `<` opening the end tag; equals {@link end} when self-closing. */
	contentEnd: number
	readonly selfClosing: boolean
}

class SpanBuilder implements XmlSink {
	root: SpannedElement | undefined
	private position!: XmlCursor
	private readonly stack: SpannedElement[] = []

	cursor(cursor: XmlCursor): void {
		this.position = cursor
	}

	start(
		name: string,
		_local: string,
		attributes: Record<string, string>,
		selfClosing: boolean,
	): Visit {
		const spans = new Map<string, SpannedAttribute>()
		for (const [key, value] of Object.entries(attributes)) {
			const span = this.position.attributeSpan(key)
			// A span is always there for an attribute the scanner just read; the
			// fallback keeps the tree usable rather than asserting about it.
			spans.set(key, {
				value,
				start: span?.start ?? this.position.tagStart,
				end: span?.end ?? this.position.tagStart,
			})
		}

		const element: SpannedElement = {
			name,
			attributes: spans,
			children: [],
			text: "",
			start: this.position.tagStart,
			end: this.position.tagEnd,
			contentStart: this.position.tagEnd,
			contentEnd: this.position.tagEnd,
			selfClosing,
		}

		this.stack[this.stack.length - 1]?.children.push(element)
		if (this.root === undefined) this.root = element
		this.stack.push(element)
		return Visit.All
	}

	text(text: string): void {
		const element = this.stack[this.stack.length - 1]
		if (element !== undefined) element.text += text
	}

	end(): void {
		const element = this.stack.pop()
		if (element === undefined) return
		element.contentEnd = this.position.endTagStart
		element.end = this.position.endTagEnd
	}
}

/**
 * Parses a document into a tree that knows its own offsets.
 *
 * @param xml - A well-formed XML document.
 * @throws Error when there is no root element, or the document is malformed.
 */
export function parseXmlSpans(xml: string): SpannedElement {
	const builder = new SpanBuilder()
	if (!scanXml(xml, builder) || builder.root === undefined) {
		throw new Error("Failed to parse XML: no root element found")
	}
	return builder.root
}
