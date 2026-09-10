/**
 * A JSON document parsed into a tree that remembers where everything was.
 *
 * `JSON.parse` gives values with the source thrown away, which is right for
 * everything that reads a document. Rewriting one in place needs the opposite:
 * the exact offsets of each value and each member, so an edit can replace one
 * string instead of regenerating the file.
 *
 * Deliberately not a validator. It accepts what `JSON.parse` accepts and does
 * not try to describe what is wrong with anything else — the caller has already
 * decided this is JSON, and a document that will not parse simply gets no tree.
 *
 * @packageDocumentation
 */

/** What a value is, without looking at it. */
export type JsonKind = "object" | "array" | "string" | "number" | "boolean" | "null"

/** A value, and where it was written. */
export interface JsonNode {
	readonly kind: JsonKind
	/** The value itself, for scalars. Objects and arrays carry their parts. */
	readonly value?: string | number | boolean | null
	/** Members in written order, for an object. */
	readonly members?: JsonMember[]
	/** Items in written order, for an array. */
	readonly items?: JsonNode[]
	/** Offset of the value's first character. */
	readonly start: number
	/** Offset just past the value's last character. */
	readonly end: number
}

/** One `"key": value` pair, and where it was written. */
export interface JsonMember {
	/** The key with its escapes decoded — what a comparison should use. */
	readonly key: string
	readonly value: JsonNode
	/** Offset of the key's opening quote. */
	readonly start: number
	/** Offset just past the member's value; the same as `value.end`. */
	readonly end: number
}

const WHITESPACE = new Set([" ", "\t", "\n", "\r"])

class JsonScanner {
	private i = 0

	constructor(private readonly source: string) {}

	parse(): JsonNode {
		this.skipWhitespace()
		const node = this.value()
		this.skipWhitespace()
		if (this.i !== this.source.length) {
			throw new Error(`Unexpected trailing content at position ${this.i}`)
		}
		return node
	}

	private skipWhitespace(): void {
		while (this.i < this.source.length && WHITESPACE.has(this.source[this.i] as string)) {
			this.i += 1
		}
	}

	private expect(character: string): void {
		if (this.source[this.i] !== character) {
			throw new Error(`Expected "${character}" at position ${this.i}`)
		}
		this.i += 1
	}

	private value(): JsonNode {
		const start = this.i
		const character = this.source[this.i]

		if (character === "{") return this.object(start)
		if (character === "[") return this.array(start)
		if (character === '"') {
			const decoded = this.string()
			return { kind: "string", value: decoded, start, end: this.i }
		}
		if (this.source.startsWith("true", this.i)) {
			this.i += 4
			return { kind: "boolean", value: true, start, end: this.i }
		}
		if (this.source.startsWith("false", this.i)) {
			this.i += 5
			return { kind: "boolean", value: false, start, end: this.i }
		}
		if (this.source.startsWith("null", this.i)) {
			this.i += 4
			return { kind: "null", value: null, start, end: this.i }
		}
		return this.number(start)
	}

	private object(start: number): JsonNode {
		this.expect("{")
		const members: JsonMember[] = []
		this.skipWhitespace()
		if (this.source[this.i] === "}") {
			this.i += 1
			return { kind: "object", members, start, end: this.i }
		}

		for (;;) {
			this.skipWhitespace()
			const memberStart = this.i
			const key = this.string()
			this.skipWhitespace()
			this.expect(":")
			this.skipWhitespace()
			const value = this.value()
			members.push({ key, value, start: memberStart, end: value.end })

			this.skipWhitespace()
			if (this.source[this.i] === ",") {
				this.i += 1
				continue
			}
			this.expect("}")
			return { kind: "object", members, start, end: this.i }
		}
	}

	private array(start: number): JsonNode {
		this.expect("[")
		const items: JsonNode[] = []
		this.skipWhitespace()
		if (this.source[this.i] === "]") {
			this.i += 1
			return { kind: "array", items, start, end: this.i }
		}

		for (;;) {
			this.skipWhitespace()
			items.push(this.value())
			this.skipWhitespace()
			if (this.source[this.i] === ",") {
				this.i += 1
				continue
			}
			this.expect("]")
			return { kind: "array", items, start, end: this.i }
		}
	}

	/** Reads a quoted string, leaving `i` past the closing quote. */
	private string(): string {
		const start = this.i
		this.expect('"')
		while (this.i < this.source.length) {
			const character = this.source[this.i]
			if (character === "\\") {
				this.i += 2
				continue
			}
			if (character === '"') {
				this.i += 1
				// Let `JSON.parse` own the escape rules rather than repeating them.
				return JSON.parse(this.source.slice(start, this.i)) as string
			}
			this.i += 1
		}
		throw new Error(`Unterminated string at position ${start}`)
	}

	private number(start: number): JsonNode {
		while (this.i < this.source.length && /[-+0-9.eE]/.test(this.source[this.i] as string)) {
			this.i += 1
		}
		const text = this.source.slice(start, this.i)
		const parsed = Number(text)
		if (text === "" || Number.isNaN(parsed)) {
			throw new Error(`Expected a value at position ${start}`)
		}
		return { kind: "number", value: parsed, start, end: this.i }
	}
}

/**
 * Parses a document into a tree that knows its own offsets.
 *
 * @param text - A JSON document.
 * @throws Error when it is not one.
 */
export function parseJsonSpans(text: string): JsonNode {
	return new JsonScanner(text).parse()
}
