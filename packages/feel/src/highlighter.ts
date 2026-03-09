import { builtinNames } from "./builtins.js"
import { tokenize } from "./lexer.js"
import type { FeelToken } from "./lexer.js"

export type HighlightKind =
	| "keyword"
	| "operator"
	| "literal-number"
	| "literal-string"
	| "literal-temporal"
	| "literal-bool"
	| "literal-null"
	| "literal-range"
	| "builtin"
	| "variable"
	| "comment"
	| "punctuation"
	| "plain"

export interface AnnotatedToken {
	kind: HighlightKind
	value: string
	start: number
	end: number
}

const BUILTINS = new Set(builtinNames())

// Multi-word built-in names for lookahead annotation
const BUILTIN_PREFIXES = ((): Set<string> => {
	const s = new Set<string>()
	for (const name of BUILTINS) {
		const parts = name.split(" ")
		for (let i = 1; i < parts.length; i++) {
			s.add(parts.slice(0, i).join(" "))
		}
	}
	return s
})()

function classifyToken(
	tok: FeelToken,
	allTokens: FeelToken[],
	idx: number,
): { kind: HighlightKind; name?: string } {
	switch (tok.kind) {
		case "number":
			return { kind: "literal-number" }
		case "string":
			return { kind: "literal-string" }
		case "temporal":
			return { kind: "literal-temporal" }
		case "comment":
			return { kind: "comment" }
		case "whitespace":
			return { kind: "plain" }
		case "unknown":
			return { kind: "plain" }
		case "backtick":
			return { kind: "variable" }
		case "op":
		case "punct":
			return { kind: tok.kind === "punct" ? "punctuation" : "operator" }
		case "keyword": {
			if (tok.value === "true" || tok.value === "false") return { kind: "literal-bool" }
			if (tok.value === "null") return { kind: "literal-null" }
			return { kind: "keyword" }
		}
		case "name": {
			// Try to match multi-word builtin
			let name = tok.value
			let lookahead = idx + 1
			while (BUILTIN_PREFIXES.has(name)) {
				// Skip whitespace
				while (lookahead < allTokens.length && allTokens[lookahead]?.kind === "whitespace") {
					lookahead++
				}
				const next = allTokens[lookahead]
				if (!next || (next.kind !== "name" && next.kind !== "keyword")) break
				const extended = `${name} ${next.value}`
				if (BUILTINS.has(extended) || BUILTIN_PREFIXES.has(extended)) {
					name = extended
					lookahead++
				} else {
					break
				}
			}
			if (BUILTINS.has(name)) return { kind: "builtin", name }
			return { kind: "variable" }
		}
	}
}

/** Annotate token stream with semantic highlight kinds. */
export function annotate(input: string): AnnotatedToken[] {
	const tokens = tokenize(input)
	const result: AnnotatedToken[] = []
	let i = 0

	while (i < tokens.length) {
		const tok = tokens[i]
		if (!tok) {
			i++
			continue
		}

		// Try multi-word built-in name
		if (tok.kind === "name") {
			let name = tok.value
			let end = i + 1
			let endPos = tok.end

			// Greedy multi-word match
			let lookahead = end
			while (BUILTIN_PREFIXES.has(name)) {
				const wsStart = lookahead
				while (lookahead < tokens.length && tokens[lookahead]?.kind === "whitespace") lookahead++
				const next = tokens[lookahead]
				if (!next || (next.kind !== "name" && next.kind !== "keyword")) {
					lookahead = wsStart
					break
				}
				const extended = `${name} ${next.value}`
				if (BUILTINS.has(extended) || BUILTIN_PREFIXES.has(extended)) {
					name = extended
					lookahead++
					end = lookahead
					endPos = next.end
				} else {
					lookahead = wsStart
					break
				}
			}

			if (BUILTINS.has(name) && end > i + 1) {
				// Multi-word builtin: emit all tokens as builtin
				for (let j = i; j < end; j++) {
					const t = tokens[j]
					if (!t) continue
					result.push({
						kind: t.kind === "whitespace" ? "plain" : "builtin",
						value: t.value,
						start: t.start,
						end: t.end,
					})
				}
				i = end
				continue
			}
		}

		const { kind } = classifyToken(tok, tokens, i)
		result.push({ kind, value: tok.value, start: tok.start, end: tok.end })
		i++
	}

	return result
}

function escapeHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/** Render annotated tokens to HTML with span wrappers. */
export function highlightToHtml(input: string): string {
	if (!input.trim()) return escapeHtml(input) || '<span class="feel-empty">-</span>'
	const tokens = annotate(input)
	return tokens
		.map((t) => {
			const escaped = escapeHtml(t.value)
			if (t.kind === "plain") return escaped
			return `<span class="feel-${t.kind}">${escaped}</span>`
		})
		.join("")
}

/** Backward-compatible alias. */
export const highlightFeel = highlightToHtml
