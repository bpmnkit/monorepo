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

		// Number (only consume one decimal point, and only if followed by a digit)
		if (isDigit(c)) {
			while (i < len && isDigit(input.charCodeAt(i))) i++
			// Consume decimal fraction only if next char is '.' followed by a digit (not '..')
			if (i + 1 < len && input.charCodeAt(i) === DOT && isDigit(input.charCodeAt(i + 1))) {
				i++ // consume the '.'
				while (i < len && isDigit(input.charCodeAt(i))) i++
			}
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
