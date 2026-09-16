export type FeelTokenKind =
	| "number"
	| "string"
	| "temporal"
	| "name"
	| "keyword"
	| "op"
	| "punct"
	| "comment"
	| "whitespace"
	| "backtick"
	| "unknown"

export interface FeelToken {
	kind: FeelTokenKind
	value: string
	start: number
	end: number
}

const KEYWORDS = new Set([
	"true",
	"false",
	"null",
	"if",
	"then",
	"else",
	"for",
	"in",
	"return",
	"some",
	"every",
	"satisfies",
	"function",
	"external",
	"not",
	"and",
	"or",
	"between",
	"instance",
	"of",
])

// Character codes; comparing codes avoids allocating a one-character string
// for every position the scanner visits.
const SLASH = 0x2f
const STAR = 0x2a
const AT = 0x40
const DQUOTE = 0x22
const BACKSLASH = 0x5c
const BACKTICK = 0x60
const SPACE = 0x20
const TAB = 0x09
const LF = 0x0a
const CR = 0x0d
const DOT = 0x2e
const GT = 0x3e
const LT = 0x3c
const BANG = 0x21
const PLUS = 0x2b
const MINUS = 0x2d
const EQ = 0x3d
const UNDERSCORE = 0x5f

function isDigit(c: number): boolean {
	return c >= 0x30 && c <= 0x39
}

function isLetter(c: number): boolean {
	return (c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a)
}

function isWhitespace(c: number): boolean {
	return c === SPACE || c === TAB || c === LF || c === CR
}

const SINGLE_OPS = new Set("+-*/=<>?".split("").map((c) => c.charCodeAt(0)))
const PUNCT = new Set("()[]{},:".split("").map((c) => c.charCodeAt(0)))

/** End of an exponent starting at `i` ("e4", "e+4", "e-4"), or `i` if none. */
function readExponent(input: string, i: number): number {
	const c = input.charCodeAt(i)
	if (c !== 0x65 && c !== 0x45) return i
	let j = i + 1
	const sign = input.charCodeAt(j)
	if (sign === PLUS || sign === MINUS) j++
	if (!isDigit(input.charCodeAt(j))) return i
	while (j < input.length && isDigit(input.charCodeAt(j))) j++
	return j
}

export function tokenize(input: string): FeelToken[] {
	const tokens: FeelToken[] = []
	let i = 0
	const len = input.length

	while (i < len) {
		const start = i
		const c = input.charCodeAt(i)
		// NaN past the end never equals any code, so lookahead needs no bounds check.
		const next = input.charCodeAt(i + 1)

		// Line comment
		if (c === SLASH && next === SLASH) {
			i += 2
			while (i < len && input.charCodeAt(i) !== LF) i++
			tokens.push({ kind: "comment", value: input.slice(start, i), start, end: i })
			continue
		}

		// Block comment
		if (c === SLASH && next === STAR) {
			i += 2
			while (i < len && !(input.charCodeAt(i) === STAR && input.charCodeAt(i + 1) === SLASH)) i++
			i += 2
			tokens.push({ kind: "comment", value: input.slice(start, i), start, end: i })
			continue
		}

		// Temporal literal @"..."
		if (c === AT && next === DQUOTE) {
			i += 2
			while (i < len && input.charCodeAt(i) !== DQUOTE) {
				if (input.charCodeAt(i) === BACKSLASH) i++
				i++
			}
			i++ // closing "
			tokens.push({ kind: "temporal", value: input.slice(start, i), start, end: i })
			continue
		}

		// String literal
		if (c === DQUOTE) {
			i++
			while (i < len && input.charCodeAt(i) !== DQUOTE) {
				if (input.charCodeAt(i) === BACKSLASH) i++
				i++
			}
			i++ // closing "
			tokens.push({ kind: "string", value: input.slice(start, i), start, end: i })
			continue
		}

		// Backtick name
		if (c === BACKTICK) {
			i++
			while (i < len && input.charCodeAt(i) !== BACKTICK) i++
			i++ // closing `
			tokens.push({
				kind: "backtick",
				value: input.slice(start + 1, i - 1),
				start,
				end: i,
			})
			continue
		}

		// Whitespace
		if (isWhitespace(c)) {
			while (i < len && isWhitespace(input.charCodeAt(i))) i++
			tokens.push({ kind: "whitespace", value: input.slice(start, i), start, end: i })
			continue
		}

		// Two-char operators (check before single-char)
		if (
			(c === STAR && next === STAR) ||
			(c === GT && next === EQ) ||
			(c === LT && next === EQ) ||
			(c === BANG && next === EQ) ||
			(c === MINUS && next === GT) ||
			(c === DOT && next === DOT)
		) {
			tokens.push({ kind: "op", value: input.slice(i, i + 2), start, end: i + 2 })
			i += 2
			continue
		}
		// "==" is not standard FEEL but users familiar with JS/Java write it; treat as "=".
		if (c === EQ && next === EQ) {
			tokens.push({ kind: "op", value: "=", start, end: i + 2 })
			i += 2
			continue
		}

		// Single-char operators
		if (SINGLE_OPS.has(c)) {
			tokens.push({ kind: "op", value: input[i] as string, start, end: i + 1 })
			i++
			continue
		}

		// Punctuation
		if (PUNCT.has(c)) {
			tokens.push({ kind: "punct", value: input[i] as string, start, end: i + 1 })
			i++
			continue
		}

		// Dot (not ..)
		if (c === DOT) {
			tokens.push({ kind: "punct", value: ".", start, end: i + 1 })
			i++
			continue
		}

		// Number: digits, an optional fraction, an optional exponent. A leading
		// "." is allowed (".872"), and ".." is never part of a number.
		if (isDigit(c) || (c === DOT && isDigit(next))) {
			while (i < len && isDigit(input.charCodeAt(i))) i++
			// Consume decimal fraction only if next char is '.' followed by a digit (not '..')
			if (i + 1 < len && input.charCodeAt(i) === DOT && isDigit(input.charCodeAt(i + 1))) {
				i++ // consume the '.'
				while (i < len && isDigit(input.charCodeAt(i))) i++
			}
			const exponent = readExponent(input, i)
			if (exponent > i) i = exponent
			tokens.push({ kind: "number", value: input.slice(start, i), start, end: i })
			continue
		}

		// Identifier / keyword
		if (isLetter(c) || c === UNDERSCORE) {
			i++
			while (i < len) {
				const w = input.charCodeAt(i)
				if (!isLetter(w) && !isDigit(w) && w !== UNDERSCORE) break
				i++
			}
			const word = input.slice(start, i)
			const kind: FeelTokenKind = KEYWORDS.has(word) ? "keyword" : "name"
			tokens.push({ kind, value: word, start, end: i })
			continue
		}

		// Unknown character
		tokens.push({ kind: "unknown", value: input[i] as string, start, end: i + 1 })
		i++
	}

	return tokens
}

const SIMPLE_ESCAPES: Record<string, string> = {
	"'": "'",
	'"': '"',
	"\\": "\\",
	n: "\n",
	r: "\r",
	t: "\t",
}

/** Decodes a \u/\U escape at `i`, or returns null when it is not a valid one. */
function readCodePoint(body: string, i: number): { text: string; length: number } | null {
	const kind = body[i + 1]
	const maxDigits = kind === "u" ? 4 : 6
	const digits = /^[0-9a-fA-F]+/.exec(body.slice(i + 2, i + 2 + maxDigits))?.[0] ?? ""
	// \u takes exactly four digits; \U takes as many as still form a code point,
	// so "\U101EF0" is \U101EF followed by a literal "0".
	const minLength = kind === "u" ? 4 : 1
	for (let len = digits.length; len >= minLength; len--) {
		if (kind === "u" && len !== 4) break
		const code = Number.parseInt(digits.slice(0, len), 16)
		if (code <= 0x10ffff) return { text: String.fromCodePoint(code), length: 2 + len }
	}
	return null
}

/**
 * Decodes the escape sequences of a FEEL string literal body (the text between
 * the quotes). Recognizes \' \" \\ \n \r \t, \uXXXX and the extended
 * \UXXXXXX form; an unrecognized sequence is left as written, since dropping
 * the backslash would silently alter the author's data.
 */
export function unescapeString(body: string): string {
	if (!body.includes("\\")) return body
	let out = ""
	let i = 0
	while (i < body.length) {
		const c = body[i] as string
		if (c !== "\\" || i + 1 >= body.length) {
			out += c
			i++
			continue
		}
		const simple = SIMPLE_ESCAPES[body[i + 1] as string]
		if (simple !== undefined) {
			out += simple
			i += 2
			continue
		}
		const next = body[i + 1]
		if (next === "u" || next === "U") {
			const decoded = readCodePoint(body, i)
			if (decoded) {
				out += decoded.text
				i += decoded.length
				continue
			}
		}
		out += c
		i++
	}
	return out
}
