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

export function tokenize(input: string): FeelToken[] {
	const tokens: FeelToken[] = []
	let i = 0
	const len = input.length

	const ch = (offset = 0): string => input.charAt(i + offset)
	const slice = (start: number, end: number): string => input.slice(start, end)

	while (i < len) {
		const start = i

		// Line comment
		if (ch() === "/" && ch(1) === "/") {
			i += 2
			while (i < len && ch() !== "\n") i++
			tokens.push({ kind: "comment", value: slice(start, i), start, end: i })
			continue
		}

		// Block comment
		if (ch() === "/" && ch(1) === "*") {
			i += 2
			while (i < len && !(ch() === "*" && ch(1) === "/")) i++
			i += 2
			tokens.push({ kind: "comment", value: slice(start, i), start, end: i })
			continue
		}

		// Temporal literal @"..."
		if (ch() === "@" && ch(1) === '"') {
			i += 2
			while (i < len && ch() !== '"') {
				if (ch() === "\\") i++
				i++
			}
			i++ // closing "
			tokens.push({ kind: "temporal", value: slice(start, i), start, end: i })
			continue
		}

		// String literal
		if (ch() === '"') {
			i++
			while (i < len && ch() !== '"') {
				if (ch() === "\\") i++
				i++
			}
			i++ // closing "
			tokens.push({ kind: "string", value: slice(start, i), start, end: i })
			continue
		}

		// Backtick name
		if (ch() === "`") {
			i++
			while (i < len && ch() !== "`") i++
			i++ // closing `
			tokens.push({
				kind: "backtick",
				value: slice(start + 1, i - 1),
				start,
				end: i,
			})
			continue
		}

		// Whitespace
		if (ch() === " " || ch() === "\t" || ch() === "\n" || ch() === "\r") {
			while (i < len && (ch() === " " || ch() === "\t" || ch() === "\n" || ch() === "\r")) i++
			tokens.push({ kind: "whitespace", value: slice(start, i), start, end: i })
			continue
		}

		// Two-char operators (check before single-char)
		const two = slice(i, i + 2)
		if (
			two === "**" ||
			two === ">=" ||
			two === "<=" ||
			two === "!=" ||
			two === "->" ||
			two === ".."
		) {
			tokens.push({ kind: "op", value: two, start, end: i + 2 })
			i += 2
			continue
		}
		// "==" is not standard FEEL but users familiar with JS/Java write it; treat as "=".
		if (two === "==") {
			tokens.push({ kind: "op", value: "=", start, end: i + 2 })
			i += 2
			continue
		}

		// Single-char operators
		if ("+-*/=<>?".includes(ch())) {
			tokens.push({ kind: "op", value: ch(), start, end: i + 1 })
			i++
			continue
		}

		// Punctuation
		if ("()[]{},:".includes(ch())) {
			tokens.push({ kind: "punct", value: ch(), start, end: i + 1 })
			i++
			continue
		}

		// Dot (not ..)
		if (ch() === ".") {
			tokens.push({ kind: "punct", value: ".", start, end: i + 1 })
			i++
			continue
		}

		// Number (only consume one decimal point, and only if followed by a digit)
		if (ch() >= "0" && ch() <= "9") {
			while (i < len && ch() >= "0" && ch() <= "9") i++
			// Consume decimal fraction only if next char is '.' followed by a digit (not '..')
			if (i < len && ch() === "." && i + 1 < len && ch(1) >= "0" && ch(1) <= "9") {
				i++ // consume the '.'
				while (i < len && ch() >= "0" && ch() <= "9") i++
			}
			tokens.push({ kind: "number", value: slice(start, i), start, end: i })
			continue
		}

		// Identifier / keyword
		if ((ch() >= "a" && ch() <= "z") || (ch() >= "A" && ch() <= "Z") || ch() === "_") {
			while (
				i < len &&
				((ch() >= "a" && ch() <= "z") ||
					(ch() >= "A" && ch() <= "Z") ||
					(ch() >= "0" && ch() <= "9") ||
					ch() === "_")
			)
				i++
			const word = slice(start, i)
			const kind: FeelTokenKind = KEYWORDS.has(word) ? "keyword" : "name"
			tokens.push({ kind, value: word, start, end: i })
			continue
		}

		// Unknown character
		tokens.push({ kind: "unknown", value: ch(), start, end: i + 1 })
		i++
	}

	return tokens
}
