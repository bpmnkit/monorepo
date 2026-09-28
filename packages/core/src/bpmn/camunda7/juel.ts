import { parseExpression } from "@bpmnkit/feel"

/**
 * JUEL → FEEL translation for the subset where the two languages provably
 * agree on non-null operands: variable paths, literals, comparisons, boolean
 * connectives and arithmetic other than remainder.
 *
 * Everything else — method calls, `empty`, the ternary, indexing, `%`, the
 * engine objects `execution` / `task` — is refused with a reason rather than
 * guessed at. A refused expression becomes a `manual` migration finding.
 */

/** The outcome of {@link translateJuelToFeel}. `feel` carries no leading `=`. */
export type JuelToFeelResult = { ok: true; feel: string } | { ok: false; reason: string }

export interface JuelToFeelOptions {
	/**
	 * The expression is a multi-instance completion condition, where Camunda 7's
	 * `nrOfInstances` / `nrOfActiveInstances` / `nrOfCompletedInstances` have
	 * direct Camunda 8 counterparts.
	 */
	multiInstance?: boolean
}

/** Whether a text contains a JUEL expression (`${…}` or `#{…}`) anywhere. */
export function containsJuel(text: string): boolean {
	return text.includes("${") || text.includes("#{")
}

/** A FEEL string literal for `value`. */
export function feelString(value: string): string {
	const escaped = value
		.replace(/\\/g, "\\\\")
		.replace(/"/g, '\\"')
		.replace(/\n/g, "\\n")
		.replace(/\r/g, "\\r")
		.replace(/\t/g, "\\t")
	return `"${escaped}"`
}

const FEEL_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

/** Words FEEL reserves, which therefore cannot stand as a bare variable name. */
const FEEL_RESERVED = new Set([
	"true",
	"false",
	"null",
	"and",
	"or",
	"not",
	"if",
	"then",
	"else",
	"for",
	"in",
	"return",
	"some",
	"every",
	"satisfies",
	"between",
	"instance",
	"of",
	"function",
])

/** Objects the Camunda 7 engine injects into expressions; Camunda 8 has none of them. */
const C7_ENGINE_OBJECTS = new Set([
	"execution",
	"task",
	"externalTask",
	"authenticatedUserId",
	"variableScope",
	"connector",
	"caseExecution",
	"dateTime",
])

const MULTI_INSTANCE_RENAMES: Readonly<Record<string, string>> = {
	nrOfInstances: "numberOfInstances",
	nrOfActiveInstances: "numberOfActiveInstances",
	nrOfCompletedInstances: "numberOfCompletedInstances",
}

/** Whether `name` can be written as a bare FEEL variable name. */
export function isFeelName(name: string): boolean {
	return FEEL_NAME.test(name) && !FEEL_RESERVED.has(name)
}

// ---------------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------------

type Token =
	| { kind: "num"; text: string }
	| { kind: "str"; value: string }
	| { kind: "id"; text: string }
	| { kind: "op"; text: string }

class Refusal extends Error {}

const OPERATORS = ["&&", "||", "==", "!=", "<=", ">=", "!", "<", ">", "+", "-", "*", "/", "%"]
const PUNCTUATION = new Set(["(", ")", ".", ",", "?", ":", "[", "]", "{", "}"])

function lex(source: string): Token[] {
	const tokens: Token[] = []
	let i = 0
	while (i < source.length) {
		const ch = source.charAt(i)
		if (/\s/.test(ch)) {
			i++
			continue
		}
		if (/[0-9]/.test(ch)) {
			const match = /^[0-9]+(\.[0-9]+)?/.exec(source.slice(i))
			const text = match?.[0] ?? ch
			if (/^[eEdDfFlL.]/.test(source.charAt(i + text.length))) {
				throw new Refusal(`numeric literal "${source.slice(i)}" has no exact FEEL form`)
			}
			tokens.push({ kind: "num", text })
			i += text.length
			continue
		}
		if (ch === "'" || ch === '"') {
			let value = ""
			let j = i + 1
			for (;;) {
				if (j >= source.length) throw new Refusal("unterminated string literal")
				const c = source.charAt(j)
				if (c === "\\") {
					value += source.charAt(j + 1)
					j += 2
					continue
				}
				if (c === ch) break
				value += c
				j++
			}
			tokens.push({ kind: "str", value })
			i = j + 1
			continue
		}
		if (/[A-Za-z_$]/.test(ch)) {
			const match = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(source.slice(i))
			const text = match?.[0] ?? ch
			tokens.push({ kind: "id", text })
			i += text.length
			continue
		}
		const op = OPERATORS.find((candidate) => source.startsWith(candidate, i))
		if (op !== undefined) {
			tokens.push({ kind: "op", text: op })
			i += op.length
			continue
		}
		if (PUNCTUATION.has(ch)) {
			tokens.push({ kind: "op", text: ch })
			i++
			continue
		}
		throw new Refusal(`unexpected character "${ch}"`)
	}
	return tokens
}

// ---------------------------------------------------------------------------
// Parser — JUEL precedence, emitting FEEL with minimal parentheses
// ---------------------------------------------------------------------------

/** FEEL precedence of the node's outermost operator; higher binds tighter. */
const Prec = {
	Or: 1,
	And: 2,
	Compare: 3,
	Add: 4,
	Mul: 5,
	Unary: 6,
	Atom: 7,
} as const

interface Emitted {
	text: string
	prec: number
}

const COMPARISON: Readonly<Record<string, string>> = {
	"==": "=",
	eq: "=",
	"!=": "!=",
	ne: "!=",
	"<": "<",
	lt: "<",
	">": ">",
	gt: ">",
	"<=": "<=",
	le: "<=",
	">=": ">=",
	ge: ">=",
}

class JuelParser {
	private pos = 0

	constructor(
		private readonly tokens: Token[],
		private readonly options: JuelToFeelOptions,
	) {}

	parse(): Emitted {
		if (this.tokens.length === 0) throw new Refusal("empty expression")
		const result = this.or()
		const rest = this.peek()
		if (rest !== undefined) throw new Refusal(`unsupported syntax at "${tokenText(rest)}"`)
		return result
	}

	private peek(): Token | undefined {
		return this.tokens[this.pos]
	}

	/** Consumes the next token when it is one of `words` (operator or keyword). */
	private accept(...words: string[]): string | undefined {
		const token = this.peek()
		if (token === undefined) return undefined
		const text = token.kind === "op" || token.kind === "id" ? token.text : undefined
		if (text !== undefined && words.includes(text)) {
			this.pos++
			return text
		}
		return undefined
	}

	private binary(
		next: () => Emitted,
		operators: readonly string[],
		prec: number,
		spell: (op: string) => string,
	): Emitted {
		let left = next()
		for (;;) {
			const op = this.accept(...operators)
			if (op === undefined) return left
			const right = next()
			// FEEL comparisons do not chain, so a comparison operand of a comparison is always wrapped.
			const leftText =
				left.prec < prec || (prec === Prec.Compare && left.prec === prec)
					? `(${left.text})`
					: left.text
			const rightText = right.prec <= prec ? `(${right.text})` : right.text
			left = { text: `${leftText} ${spell(op)} ${rightText}`, prec }
		}
	}

	private or(): Emitted {
		const result = this.binary(
			() => this.and(),
			["||", "or"],
			Prec.Or,
			() => "or",
		)
		if (this.peek()?.kind === "op" && tokenText(this.peek()) === "?") {
			throw new Refusal(
				"the conditional operator ?: coerces its condition; rewrite as if-then-else",
			)
		}
		return result
	}

	private and(): Emitted {
		return this.binary(
			() => this.equality(),
			["&&", "and"],
			Prec.And,
			() => "and",
		)
	}

	private equality(): Emitted {
		return this.binary(
			() => this.relational(),
			["==", "!=", "eq", "ne"],
			Prec.Compare,
			(op) => COMPARISON[op] ?? op,
		)
	}

	private relational(): Emitted {
		return this.binary(
			() => this.additive(),
			["<", ">", "<=", ">=", "lt", "gt", "le", "ge"],
			Prec.Compare,
			(op) => COMPARISON[op] ?? op,
		)
	}

	private additive(): Emitted {
		return this.binary(
			() => this.multiplicative(),
			["+", "-"],
			Prec.Add,
			(op) => op,
		)
	}

	private multiplicative(): Emitted {
		const result = this.binary(
			() => this.unary(),
			["*", "/", "div"],
			Prec.Mul,
			(op) => (op === "div" ? "/" : op),
		)
		if (this.accept("%", "mod") !== undefined) {
			throw new Refusal("remainder (%) has a different sign rule in FEEL's modulo()")
		}
		return result
	}

	private unary(): Emitted {
		if (this.accept("!", "not") !== undefined) {
			const operand = this.unary()
			return { text: `not(${operand.text})`, prec: Prec.Atom }
		}
		if (this.accept("-") !== undefined) {
			const operand = this.unary()
			const text = operand.prec <= Prec.Unary ? `(${operand.text})` : operand.text
			return { text: `-${text}`, prec: Prec.Unary }
		}
		if (this.accept("empty") !== undefined) {
			throw new Refusal('"empty" is true for null, "" and empty collections alike')
		}
		return this.value()
	}

	private value(): Emitted {
		const token = this.peek()
		if (token === undefined) throw new Refusal("expression ends early")
		this.pos++
		if (token.kind === "num") return { text: token.text, prec: Prec.Atom }
		if (token.kind === "str") return { text: feelString(token.value), prec: Prec.Atom }
		if (token.kind === "op") {
			if (token.text === "(") {
				const inner = this.or()
				if (this.accept(")") === undefined) throw new Refusal("unbalanced parentheses")
				return { text: `(${inner.text})`, prec: Prec.Atom }
			}
			throw new Refusal(`unsupported syntax at "${token.text}"`)
		}
		if (token.text === "true" || token.text === "false" || token.text === "null") {
			return { text: token.text, prec: Prec.Atom }
		}
		const path = [this.name(token.text, true)]
		for (;;) {
			const next = this.peek()
			if (next?.kind === "op" && next.text === "[") {
				throw new Refusal("indexing ([…]) is zero-based in JUEL and one-based in FEEL")
			}
			if (next?.kind === "op" && next.text === "(") {
				throw new Refusal(`method or function call "${path.join(".")}(…)" has no FEEL equivalent`)
			}
			if (this.accept(".") === undefined) break
			const member = this.peek()
			if (member?.kind !== "id") throw new Refusal("a property name must follow '.'")
			this.pos++
			path.push(this.name(member.text, false))
		}
		return { text: path.join("."), prec: Prec.Atom }
	}

	private name(text: string, head: boolean): string {
		if (head && C7_ENGINE_OBJECTS.has(text)) {
			throw new Refusal(`"${text}" is a Camunda 7 engine object with no Camunda 8 counterpart`)
		}
		if (head && text in MULTI_INSTANCE_RENAMES) {
			const renamed = MULTI_INSTANCE_RENAMES[text]
			if (this.options.multiInstance !== true || renamed === undefined) {
				throw new Refusal(`"${text}" exists only in a multi-instance completion condition`)
			}
			return renamed
		}
		if (!isFeelName(text)) throw new Refusal(`"${text}" is not a valid FEEL name`)
		return text
	}
}

function tokenText(token: Token | undefined): string {
	if (token === undefined) return ""
	return token.kind === "str" ? token.value : token.text
}

/**
 * Translates one JUEL expression — the whole text must be a single `${…}` or
 * `#{…}` — into FEEL.
 *
 * @example
 * translateJuelToFeel("${order.total > 100 && approved}")
 * // → { ok: true, feel: "order.total > 100 and approved" }
 */
export function translateJuelToFeel(
	expression: string,
	options: JuelToFeelOptions = {},
): JuelToFeelResult {
	const trimmed = expression.trim()
	if (!/^[$#]\{[\s\S]*\}$/.test(trimmed)) {
		return {
			ok: false,
			reason: containsJuel(trimmed)
				? "text mixed with ${…} is string templating, which FEEL does not do implicitly"
				: "not a JUEL expression",
		}
	}
	try {
		const emitted = new JuelParser(lex(trimmed.slice(2, -1)), options).parse()
		const { errors } = parseExpression(emitted.text)
		if (errors.length > 0) {
			return { ok: false, reason: `translation is not valid FEEL: ${errors[0]?.message ?? ""}` }
		}
		return { ok: true, feel: emitted.text }
	} catch (error) {
		if (error instanceof Refusal) return { ok: false, reason: error.message }
		throw error
	}
}
