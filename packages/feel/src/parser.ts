import type { BinaryOp, FeelNode } from "./ast.js"
import { tokenize, unescapeString } from "./lexer.js"
import type { FeelToken } from "./lexer.js"

export interface ParseError {
	message: string
	start: number
	end: number
}

export interface ParseResult {
	ast: FeelNode | null
	errors: ParseError[]
}

// All known multi-word built-in names
const BUILTIN_NAMES = new Set([
	"string length",
	"upper case",
	"lower case",
	"substring before",
	"substring after",
	"string join",
	"list contains",
	"insert before",
	"index of",
	"distinct values",
	"get value",
	"get entries",
	"context put",
	"context merge",
	"is defined",
	"day of week",
	"day of year",
	"week of year",
	"month of year",
	"last day of month",
	"years and months duration",
	"date and time",
	"round half up",
	"round half down",
	"round up",
	"round down",
	"get or else",
	"met by",
	"overlaps before",
	"overlaps after",
	"started by",
	"finished by",
	"random number",
	"starts with",
	"ends with",
])

// All strict prefixes of multi-word built-in names
const BUILTIN_PREFIXES = ((): Set<string> => {
	const s = new Set<string>()
	for (const name of BUILTIN_NAMES) {
		const parts = name.split(" ")
		for (let i = 1; i < parts.length; i++) {
			s.add(parts.slice(0, i).join(" "))
		}
	}
	return s
})()

/** Every strict prefix of the given multi-word names. */
function prefixesOf(names: Iterable<string>): Set<string> {
	const prefixes = new Set<string>()
	for (const name of names) {
		if (!name.includes(" ")) continue
		const parts = name.split(" ")
		for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join(" "))
	}
	return prefixes
}

export interface ParseOptions {
	/**
	 * Names that are in scope where the expression is evaluated. FEEL names may
	 * contain spaces, so `a b + 1` can only be read as a reference to `a b`
	 * when the parser is told that `a b` exists. Without this, only multi-word
	 * built-in names are recognized.
	 */
	names?: Iterable<string>
}

// The property names FEEL spells with a space. A path key is matched against
// this fixed set rather than joining words greedily, so `a.b and c` still
// reads as a conjunction.
const MULTIWORD_PROPERTIES = ["time offset", "start included", "end included"]

// The symbols a FEEL name may contain besides letters, digits and spaces.
const NAME_SYMBOLS = new Set([".", "/", "-", "'", "+", "*"])

// Multi-word type names, longest first: a prefix must not win over the whole name.
const MULTIWORD_TYPES = ["years and months duration", "days and time duration", "date and time"]

class Parser {
	private tokens: FeelToken[]
	private pos = 0
	private readonly names: ReadonlySet<string>
	private readonly namePrefixes: ReadonlySet<string>
	readonly errors: ParseError[] = []

	constructor(input: string, options: ParseOptions = {}) {
		this.tokens = tokenize(input).filter((t) => t.kind !== "whitespace" && t.kind !== "comment")
		const scopeNames = options.names ? [...options.names].filter((n) => n.includes(" ")) : []
		this.names = new Set(scopeNames)
		this.namePrefixes = prefixesOf(scopeNames)
	}

	private isKnownName(name: string): boolean {
		return BUILTIN_NAMES.has(name) || this.names.has(name)
	}

	private isKnownPrefix(name: string): boolean {
		return BUILTIN_PREFIXES.has(name) || this.namePrefixes.has(name)
	}

	private peek(offset = 0): FeelToken | undefined {
		return this.tokens[this.pos + offset]
	}

	private advance(): FeelToken | undefined {
		const tok = this.tokens[this.pos]
		if (tok) this.pos++
		return tok
	}

	private check(kind: FeelToken["kind"], value?: string): boolean {
		const tok = this.peek()
		if (!tok || tok.kind !== kind) return false
		return value === undefined || tok.value === value
	}

	private consume(kind: FeelToken["kind"], value?: string): FeelToken | undefined {
		if (!this.check(kind, value)) return undefined
		return this.advance()
	}

	private expect(kind: FeelToken["kind"], value?: string): FeelToken | undefined {
		const tok = this.consume(kind, value)
		if (!tok) {
			const cur = this.peek()
			const pos = cur ? cur.start : (this.tokens[this.tokens.length - 1]?.end ?? 0)
			const label = value ?? kind
			this.errors.push({ message: `Expected ${label}`, start: pos, end: pos + 1 })
		}
		return tok
	}

	/**
	 * Extends a single name token into the longest multi-word name in scope,
	 * built-in or supplied by the caller. Words consumed while reaching for a
	 * longer name that does not exist are given back, so `date and` falls back
	 * to `date` rather than becoming a name nothing can resolve.
	 */
	private resolveMultiwordName(first: string): string {
		let name = first
		let longest = first
		let longestPos = this.pos
		while (this.isKnownPrefix(name)) {
			const next = this.peek()
			if (!next || (next.kind !== "name" && next.kind !== "keyword")) break
			const extended = `${name} ${next.value}`
			if (!this.isKnownName(extended) && !this.isKnownPrefix(extended)) break
			this.advance()
			name = extended
			if (this.isKnownName(name)) {
				longest = name
				longestPos = this.pos
			}
		}
		this.pos = longestPos
		return longest
	}

	// -------------------------------------------------------------------------
	// Expression parsing (Pratt)
	// -------------------------------------------------------------------------

	parseExpression(minPrec = 0): FeelNode | null {
		const tok = this.peek()
		if (!tok) return null

		let left = this.parsePrefix()
		if (!left) return null

		while (true) {
			const prec = this.infixPrec()
			if (prec <= minPrec) break
			const next = this.parseInfix(left, prec)
			if (!next) break
			left = next
		}

		return left
	}

	private infixPrec(): number {
		const tok = this.peek()
		if (!tok) return 0
		if (tok.kind === "keyword" && tok.value === "or") return 10
		if (tok.kind === "keyword" && tok.value === "and") return 20
		if (tok.kind === "keyword" && tok.value === "between") return 30
		if (tok.kind === "keyword" && tok.value === "in") return 30
		if (tok.kind === "keyword" && tok.value === "instance") return 30
		if (tok.kind === "op") {
			if (
				tok.value === "=" ||
				tok.value === "!=" ||
				tok.value === "<" ||
				tok.value === "<=" ||
				tok.value === ">" ||
				tok.value === ">="
			)
				return 30
			if (tok.value === "+" || tok.value === "-") return 40
			if (tok.value === "*" || tok.value === "/") return 50
			if (tok.value === "**") return 60
		}
		if (tok.kind === "punct" && tok.value === ".") return 80
		if (tok.kind === "punct" && tok.value === "[") return 80
		if (tok.kind === "punct" && tok.value === "(") return 80
		return 0
	}

	private parseInfix(left: FeelNode, prec: number): FeelNode | null {
		const tok = this.peek()
		if (!tok) return null

		// Binary operators: or, and
		if (tok.kind === "keyword" && (tok.value === "or" || tok.value === "and")) {
			this.advance()
			const op = tok.value as BinaryOp
			const right = this.parseExpression(prec - (op === "**" ? 1 : 0))
			if (!right) return null
			return { kind: "binary", op, left, right, start: left.start, end: right.end }
		}

		// Comparison operators
		if (
			tok.kind === "op" &&
			(tok.value === "=" ||
				tok.value === "!=" ||
				tok.value === "<" ||
				tok.value === "<=" ||
				tok.value === ">" ||
				tok.value === ">=")
		) {
			this.advance()
			const op = tok.value as BinaryOp
			const right = this.parseExpression(prec)
			if (!right) return null
			return { kind: "binary", op, left, right, start: left.start, end: right.end }
		}

		// Arithmetic
		if (
			tok.kind === "op" &&
			(tok.value === "+" ||
				tok.value === "-" ||
				tok.value === "*" ||
				tok.value === "/" ||
				tok.value === "**")
		) {
			this.advance()
			const op = tok.value as BinaryOp
			// FEEL makes every infix operator left-associative, "**" included:
			// 2 ** 3 ** 2 is (2 ** 3) ** 2.
			const right = this.parseExpression(prec)
			if (!right) {
				const pos = tok.end
				this.errors.push({
					message: `Expected expression after '${op}'`,
					start: pos,
					end: pos + 1,
				})
				return null
			}
			return { kind: "binary", op, left, right, start: left.start, end: right.end }
		}

		// between
		if (tok.kind === "keyword" && tok.value === "between") {
			this.advance()
			const low = this.parseExpression(40) // above + -
			if (!low) return null
			if (!this.expect("keyword", "and")) return null
			const high = this.parseExpression(40)
			if (!high) return null
			return { kind: "between", value: left, low, high, start: left.start, end: high.end }
		}

		// in
		if (tok.kind === "keyword" && tok.value === "in") {
			this.advance()
			const test = this.parseInTestExpr()
			if (!test) return null
			return { kind: "in-test", value: left, test, start: left.start, end: test.end }
		}

		// instance of
		if (tok.kind === "keyword" && tok.value === "instance") {
			this.advance()
			if (!this.expect("keyword", "of")) return null
			const typeName = this.parseTypeName()
			if (!typeName) return null
			return {
				kind: "instance-of",
				value: left,
				typeName,
				start: left.start,
				end: this.pos > 0 ? (this.tokens[this.pos - 1]?.end ?? left.end) : left.end,
			}
		}

		// Path access: expr.name
		if (tok.kind === "punct" && tok.value === ".") {
			this.advance()
			const nameTok = this.peek()
			if (!nameTok || (nameTok.kind !== "name" && nameTok.kind !== "keyword")) {
				this.errors.push({ message: "Expected name after '.'", start: tok.start, end: tok.end })
				return null
			}
			let key = nameTok.value
			let end = nameTok.end
			const multiword = MULTIWORD_PROPERTIES.find((p) => this.tryConsumeWords(p))
			if (multiword) {
				key = multiword
				end = this.tokens[this.pos - 1]?.end ?? nameTok.end
			} else {
				this.advance()
			}
			return { kind: "path", base: left, key, start: left.start, end }
		}

		// Invocation of a function-valued expression: expr(args)
		if (tok.kind === "punct" && tok.value === "(") {
			this.advance()
			const args: FeelNode[] = []
			if (!this.check("punct", ")")) {
				const arg = this.parseExpression(0)
				if (arg) args.push(arg)
				while (this.consume("punct", ",")) {
					const a = this.parseExpression(0)
					if (a) args.push(a)
				}
			}
			const close = this.expect("punct", ")")
			return {
				kind: "call-expr",
				target: left,
				args,
				start: left.start,
				end: close?.end ?? args[args.length - 1]?.end ?? left.end,
			}
		}

		// Filter: expr[condition]
		if (tok.kind === "punct" && tok.value === "[") {
			this.advance()
			const cond = this.parseExpression(0)
			if (!cond) return null
			const close = this.expect("punct", "]")
			return {
				kind: "filter",
				base: left,
				condition: cond,
				start: left.start,
				end: close?.end ?? cond.end,
			}
		}

		return null
	}

	private parsePrefix(): FeelNode | null {
		const tok = this.peek()
		if (!tok) return null

		// Unary minus
		if (tok.kind === "op" && tok.value === "-") {
			this.advance()
			const operand = this.parseExpression(70)
			if (!operand) return null
			return { kind: "unary-minus", operand, start: tok.start, end: operand.end }
		}

		// Number literal
		if (tok.kind === "number") {
			this.advance()
			return { kind: "number", value: Number(tok.value), start: tok.start, end: tok.end }
		}

		// String literal
		if (tok.kind === "string") {
			this.advance()
			const raw = unescapeString(tok.value.slice(1, -1))
			return { kind: "string", value: raw, start: tok.start, end: tok.end }
		}

		// Temporal literal
		if (tok.kind === "temporal") {
			this.advance()
			return { kind: "temporal", raw: tok.value, start: tok.start, end: tok.end }
		}

		// Backtick name
		if (tok.kind === "backtick") {
			this.advance()
			return { kind: "name", name: tok.value, start: tok.start, end: tok.end }
		}

		// Boolean / null keywords
		if (tok.kind === "keyword") {
			if (tok.value === "true") {
				this.advance()
				return { kind: "boolean", value: true, start: tok.start, end: tok.end }
			}
			if (tok.value === "false") {
				this.advance()
				return { kind: "boolean", value: false, start: tok.start, end: tok.end }
			}
			if (tok.value === "null") {
				this.advance()
				return { kind: "null", start: tok.start, end: tok.end }
			}

			// if-then-else
			if (tok.value === "if") return this.parseIf()
			// for
			if (tok.value === "for") return this.parseFor()
			// some / every
			if (tok.value === "some" || tok.value === "every") return this.parseQuantifier(tok.value)
			// function
			if (tok.value === "function") return this.parseFunctionDef()
			// not(...) — could be negation or not() built-in
			if (tok.value === "not") return this.parseNot()
		}

		// Name or function call
		if (tok.kind === "name") {
			this.advance()
			const name = this.resolveMultiwordName(tok.value)
			return this.parseNameOrCall(name, tok.start)
		}

		// Grouped expression or range open
		if (tok.kind === "punct" && tok.value === "(") {
			return this.parseParenOrRange()
		}

		// List
		if (tok.kind === "punct" && tok.value === "[") {
			return this.parseListOrRange()
		}

		// Context
		if (tok.kind === "punct" && tok.value === "{") {
			return this.parseContext()
		}

		// ? — implicit input for unary test mode (also valid in expression as input reference)
		if (tok.kind === "op" && tok.value === "?") {
			this.advance()
			return { kind: "name", name: "?", start: tok.start, end: tok.end }
		}

		this.errors.push({
			message: `Unexpected token '${tok.value}'`,
			start: tok.start,
			end: tok.end,
		})
		this.advance() // skip for error recovery
		return null
	}

	// -------------------------------------------------------------------------
	// Helpers
	// -------------------------------------------------------------------------

	private parseNameOrCall(name: string, start: number): FeelNode | null {
		// Check for function call: name(args)
		if (this.check("punct", "(")) {
			this.advance() // consume (
			// Check for named args: name: value pattern
			if (this.isNamedArgList()) {
				return this.parseNamedCall(name, start)
			}
			const args: FeelNode[] = []
			if (!this.check("punct", ")")) {
				const arg = this.parseExpression(0)
				if (arg) args.push(arg)
				while (this.consume("punct", ",")) {
					const a = this.parseExpression(0)
					if (a) args.push(a)
				}
			}
			const close = this.expect("punct", ")")
			return {
				kind: "call",
				callee: name,
				args,
				start,
				end: close?.end ?? args[args.length - 1]?.end ?? start,
			}
		}
		return { kind: "name", name, start, end: this.tokens[this.pos - 1]?.end ?? start }
	}

	private isNamedArgList(): boolean {
		// Peek: one or more name words followed by a colon? Parameter names may
		// have spaces, as in `substring(start position: 2, string: "hello")`.
		let offset = 0
		while (true) {
			const tok = this.peek(offset)
			if (!tok || (tok.kind !== "name" && tok.kind !== "keyword")) break
			offset++
		}
		if (offset === 0) return false
		const after = this.peek(offset)
		return after?.kind === "punct" && after.value === ":"
	}

	private parseNamedCall(callee: string, start: number): FeelNode | null {
		const args: Array<{ name: string; value: FeelNode }> = []
		if (!this.check("punct", ")")) {
			const parsePair = (): boolean => {
				const words: string[] = []
				while (this.check("name") || this.check("keyword")) {
					const word = this.advance()
					if (word) words.push(word.value)
				}
				if (words.length === 0) {
					const t = this.peek()
					this.errors.push({
						message: "Expected parameter name",
						start: t?.start ?? 0,
						end: t?.end ?? 0,
					})
					return false
				}
				if (!this.expect("punct", ":")) return false
				const val = this.parseExpression(0)
				if (!val) return false
				args.push({ name: words.join(" "), value: val })
				return true
			}
			if (!parsePair()) return null
			while (this.consume("punct", ",")) {
				if (!parsePair()) break
			}
		}
		const close = this.expect("punct", ")")
		return { kind: "call-named", callee, args, start, end: close?.end ?? start }
	}

	/**
	 * Parses the domain of a `for`/`some`/`every` binding. Unlike other
	 * positions, a range may appear here undelimited: `for i in 1..3`.
	 */
	private parseIterationDomain(): FeelNode | null {
		const domain = this.parseExpression(0)
		if (!domain) return null
		if (!this.check("op", "..")) return domain
		this.advance()
		const high = this.parseExpression(0)
		if (!high) return null
		return {
			kind: "range",
			startIncluded: true,
			low: domain,
			high,
			endIncluded: true,
			start: domain.start,
			end: high.end,
		}
	}

	/**
	 * Reads a context key, which runs up to the colon and so can be gathered
	 * without ambiguity. A FEEL name may hold spaces and the symbols listed in
	 * NAME_SYMBOLS, which is what lets `{_2021-01-11: ...}` and `{foo+bar: ...}`
	 * be keys rather than arithmetic.
	 */
	private parseContextKey(): string {
		let key = ""
		let previousWasWord = false
		while (true) {
			const tok = this.peek()
			if (!tok) break
			const isWord = tok.kind === "name" || tok.kind === "keyword" || tok.kind === "number"
			const isSymbol = tok.kind === "op" && NAME_SYMBOLS.has(tok.value)
			if (!isWord && !isSymbol) break
			// Two words in a row are separated by the space that separated them.
			if (isWord && previousWasWord) key += " "
			key += tok.value
			previousWasWord = isWord
			this.advance()
		}
		return key
	}

	private parseIf(): FeelNode | null {
		const start = this.peek()?.start ?? 0
		this.advance() // consume "if"
		const condition = this.parseExpression(0)
		if (!condition) return null
		if (!this.expect("keyword", "then")) return null
		const then = this.parseExpression(0)
		if (!then) return null
		if (!this.expect("keyword", "else")) return null
		const els = this.parseExpression(0)
		if (!els) return null
		return { kind: "if", condition, then, else: els, start, end: els.end }
	}

	private parseFor(): FeelNode | null {
		const start = this.peek()?.start ?? 0
		this.advance() // consume "for"
		const bindings: Array<{ name: string; domain: FeelNode }> = []
		const parseBinding = (): boolean => {
			const nameTok = this.advance()
			if (!nameTok || (nameTok.kind !== "name" && nameTok.kind !== "backtick")) return false
			const varName = nameTok.value
			if (!this.expect("keyword", "in")) return false
			const domain = this.parseIterationDomain()
			if (!domain) return false
			bindings.push({ name: varName, domain })
			return true
		}
		if (!parseBinding()) return null
		while (this.consume("punct", ",")) {
			if (!parseBinding()) break
		}
		if (!this.expect("keyword", "return")) return null
		const body = this.parseExpression(0)
		if (!body) return null
		return { kind: "for", bindings, body, start, end: body.end }
	}

	private parseQuantifier(kind: "some" | "every"): FeelNode | null {
		const start = this.peek()?.start ?? 0
		this.advance() // consume "some" or "every"
		const bindings: Array<{ name: string; domain: FeelNode }> = []
		const parseBinding = (): boolean => {
			const nameTok = this.advance()
			if (!nameTok || (nameTok.kind !== "name" && nameTok.kind !== "backtick")) return false
			const varName = nameTok.value
			if (!this.expect("keyword", "in")) return false
			const domain = this.parseIterationDomain()
			if (!domain) return false
			bindings.push({ name: varName, domain })
			return true
		}
		if (!parseBinding()) return null
		while (this.consume("punct", ",")) {
			if (!parseBinding()) break
		}
		if (!this.expect("keyword", "satisfies")) return null
		const satisfies = this.parseExpression(0)
		if (!satisfies) return null
		return { kind, bindings, satisfies, start, end: satisfies.end }
	}

	private parseFunctionDef(): FeelNode | null {
		const start = this.peek()?.start ?? 0
		this.advance() // consume "function"
		if (!this.expect("punct", "(")) return null
		const params: string[] = []
		// A parameter may declare a type, which this package does not check:
		// `function(a: number) a + 1`.
		const parseParam = (): void => {
			const name = this.advance()
			if (name) params.push(name.value)
			if (this.consume("punct", ":")) this.parseTypeName()
		}
		if (!this.check("punct", ")")) {
			parseParam()
			while (this.consume("punct", ",")) parseParam()
		}
		if (!this.expect("punct", ")")) return null
		const body = this.parseExpression(0)
		if (!body) return null
		return { kind: "function-def", params, body, start, end: body.end }
	}

	private parseNot(): FeelNode | null {
		const start = this.peek()?.start ?? 0
		this.advance() // consume "not"
		if (!this.check("punct", "(")) {
			// not as prefix operator for boolean: not expression
			const operand = this.parseExpression(70)
			if (!operand) return null
			return {
				kind: "call",
				callee: "not",
				args: [operand],
				start,
				end: operand.end,
			}
		}
		this.advance() // consume (
		const expr = this.parseExpression(0)
		if (!expr) return null
		const close = this.expect("punct", ")")
		return { kind: "call", callee: "not", args: [expr], start, end: close?.end ?? expr.end }
	}

	private parseParenOrRange(): FeelNode | null {
		const open = this.peek()
		if (!open) return null
		const start = open.start
		this.advance() // consume (

		const expr = this.parseExpression(0)
		if (!expr) return null

		// Range: (a..b]
		if (this.check("op", "..")) {
			this.advance()
			const high = this.parseExpression(0)
			if (!high) return null
			const close = this.advance()
			const endIncluded = close?.value === "]"
			return {
				kind: "range",
				startIncluded: false,
				low: expr,
				high,
				endIncluded,
				start,
				end: close?.end ?? high.end,
			}
		}

		this.expect("punct", ")")
		return expr
	}

	private parseListOrRange(): FeelNode | null {
		const open = this.peek()
		if (!open) return null
		const start = open.start
		this.advance() // consume [

		// Empty list
		if (this.check("punct", "]")) {
			this.advance()
			return { kind: "list", items: [], start, end: open.end + 1 }
		}

		const first = this.parseExpression(0)
		if (!first) return null

		// Range: [a..b)  or  [a..b]
		if (this.check("op", "..")) {
			this.advance()
			const high = this.parseExpression(0)
			if (!high) return null
			const close = this.advance()
			const endIncluded = close?.value === "]"
			return {
				kind: "range",
				startIncluded: true,
				low: first,
				high,
				endIncluded,
				start,
				end: close?.end ?? high.end,
			}
		}

		// List
		const items: FeelNode[] = [first]
		while (this.consume("punct", ",")) {
			const item = this.parseExpression(0)
			if (item) items.push(item)
		}
		const close = this.expect("punct", "]")
		return { kind: "list", items, start, end: close?.end ?? first.end }
	}

	private parseContext(): FeelNode | null {
		const open = this.peek()
		if (!open) return null
		const start = open.start
		this.advance() // consume {

		const entries: Array<{ key: string; value: FeelNode }> = []
		if (!this.check("punct", "}")) {
			const parseEntry = (): boolean => {
				// Key: string literal or name
				let key: string
				if (this.check("string")) {
					const t = this.advance()
					if (!t) return false
					key = unescapeString(t.value.slice(1, -1))
				} else if (this.check("name") || this.check("keyword")) {
					key = this.parseContextKey()
				} else {
					const t = this.peek()
					this.errors.push({
						message: "Expected context key",
						start: t?.start ?? 0,
						end: t?.end ?? 0,
					})
					return false
				}
				if (!this.expect("punct", ":")) return false
				const val = this.parseExpression(0)
				if (!val) return false
				entries.push({ key, value: val })
				return true
			}
			if (!parseEntry()) {
				// error recovery: skip to }
				while (this.peek() && !this.check("punct", "}")) this.advance()
			} else {
				while (this.consume("punct", ",")) {
					if (!parseEntry()) break
				}
			}
		}
		const close = this.expect("punct", "}")
		return { kind: "context", entries, start, end: close?.end ?? start }
	}

	/**
	 * Parses the right-hand side of `in`, which FEEL defines as a positive
	 * unary test rather than an expression: `x in <= 10`, `x in [1..5]`,
	 * `x in (1, < 5, >= 10)`, `x in y`.
	 */
	private parseInTestExpr(): FeelNode | null {
		if (this.check("punct", "(")) return this.parseInParen()
		return this.parseOneUnaryTest()
	}

	/**
	 * A parenthesized `in` operand is a range, a comma-separated list of unary
	 * tests, or a plain grouped expression.
	 */
	private parseInParen(): FeelNode | null {
		const open = this.peek()
		if (!open) return null
		const start = open.start
		this.advance() // consume (

		const first = this.parseOneUnaryTest()
		if (!first) return null

		if (this.check("op", "..")) {
			this.advance()
			const high = this.parseExpression(0)
			if (!high) return null
			const close = this.advance()
			return {
				kind: "range",
				startIncluded: false,
				low: first,
				high,
				endIncluded: close?.value === "]",
				start,
				end: close?.end ?? high.end,
			}
		}

		if (this.check("punct", ",")) {
			const tests: FeelNode[] = [first]
			while (this.consume("punct", ",")) {
				const test = this.parseOneUnaryTest()
				if (test) tests.push(test)
			}
			const close = this.expect("punct", ")")
			return {
				kind: "unary-test-list",
				tests,
				start,
				end: close?.end ?? tests[tests.length - 1]?.end ?? start,
			}
		}

		this.expect("punct", ")")
		return first
	}

	/**
	 * Parses a type name after `instance of`. Multi-word names are tried
	 * longest-first, since "date" is also the start of "date and time". Type
	 * arguments (`list<number>`, `function<number> -> string`) are consumed and
	 * ignored: this package checks the outer type only.
	 */
	private parseTypeName(): string | null {
		const tok = this.peek()
		if (!tok || (tok.kind !== "name" && tok.kind !== "keyword")) return null

		let name: string | null = null
		for (const candidate of MULTIWORD_TYPES) {
			if (this.tryConsumeWords(candidate)) {
				name = candidate
				break
			}
		}
		if (name === null) {
			this.advance()
			name = tok.value
		}

		this.skipTypeArguments()
		return name
	}

	/** Consumes the tokens spelling `phrase`, or nothing if they do not follow. */
	private tryConsumeWords(phrase: string): boolean {
		const words = phrase.split(" ")
		for (let i = 0; i < words.length; i++) {
			const tok = this.peek(i)
			if (!tok || (tok.kind !== "name" && tok.kind !== "keyword") || tok.value !== words[i]) {
				return false
			}
		}
		this.pos += words.length
		return true
	}

	/** Skips `<...>` type arguments and a `-> type` function result. */
	private skipTypeArguments(): void {
		if (this.check("op", "<")) {
			let depth = 0
			while (this.peek()) {
				if (this.check("op", "<")) depth++
				else if (this.check("op", ">")) depth--
				else if (this.check("op", ">=")) depth-- // ">>" lexes as one token pair
				this.advance()
				if (depth === 0) break
			}
		}
		if (this.check("op", "->")) {
			this.advance()
			this.parseTypeName()
		}
	}

	// -------------------------------------------------------------------------
	// Unary-test mode
	// -------------------------------------------------------------------------

	parseUnaryTests(): FeelNode | null {
		const start = this.peek()?.start ?? 0

		// "-" means any input
		if (this.check("op", "-") && this.tokens.length === 1) {
			this.advance()
			const tok = this.tokens[0]
			return { kind: "any-input", start: tok?.start ?? 0, end: tok?.end ?? 1 }
		}

		const tests: FeelNode[] = []
		const test = this.parseOneUnaryTest()
		if (!test) return null
		tests.push(test)

		while (this.consume("punct", ",")) {
			const t = this.parseOneUnaryTest()
			if (t) tests.push(t)
		}

		if (tests.length === 1) {
			const t = tests[0]
			if (t) return t
		}
		const last = tests[tests.length - 1]
		return { kind: "unary-test-list", tests, start, end: last?.end ?? start }
	}

	private parseOneUnaryTest(): FeelNode | null {
		const tok = this.peek()
		if (!tok) return null

		// "-" = any input
		if (tok.kind === "op" && tok.value === "-") {
			this.advance()
			return { kind: "any-input", start: tok.start, end: tok.end }
		}

		// not(...) wrapping
		if (tok.kind === "keyword" && tok.value === "not") {
			const start = tok.start
			this.advance()
			if (!this.expect("punct", "(")) return null
			const inner = this.parseUnaryTestsInner()
			const close = this.expect("punct", ")")
			return { kind: "unary-not", tests: inner, start, end: close?.end ?? start }
		}

		// Comparison operator prefix: < 5, >= 10, = 3, != 4
		if (
			tok.kind === "op" &&
			(tok.value === "<" ||
				tok.value === "<=" ||
				tok.value === ">" ||
				tok.value === ">=" ||
				tok.value === "=" ||
				tok.value === "!=")
		) {
			const start = tok.start
			this.advance()
			const expr = this.parseExpression(0)
			if (!expr) return null
			const op = tok.value as BinaryOp
			const input: FeelNode = { kind: "name", name: "?", start: tok.start, end: tok.start }
			return { kind: "binary", op, left: input, right: expr, start, end: expr.end }
		}

		// Ranges
		if (tok.kind === "punct" && (tok.value === "[" || tok.value === "(")) {
			return this.parseListOrRange() ?? this.parseParenOrRange()
		}

		// "instance of X" in unary-test context — implicit input "?" is the subject
		if (tok.kind === "keyword" && tok.value === "instance") {
			const start = tok.start
			this.advance()
			if (!this.expect("keyword", "of")) return null
			const typeName = this.parseTypeName()
			if (!typeName) return null
			const implicitInput: FeelNode = { kind: "name", name: "?", start, end: start }
			return {
				kind: "instance-of",
				value: implicitInput,
				typeName,
				start,
				end: this.pos > 0 ? (this.tokens[this.pos - 1]?.end ?? start) : start,
			}
		}

		// Expression equality test
		return this.parseExpression(0)
	}

	private parseUnaryTestsInner(): FeelNode[] {
		const tests: FeelNode[] = []
		const t = this.parseOneUnaryTest()
		if (t) tests.push(t)
		while (this.consume("punct", ",")) {
			const next = this.parseOneUnaryTest()
			if (next) tests.push(next)
		}
		return tests
	}

	/** Push an error if there are unconsumed tokens remaining. */
	checkDone(): void {
		const tok = this.tokens[this.pos]
		if (tok) {
			this.errors.push({
				message: `Unexpected token '${tok.value}'`,
				start: tok.start,
				end: tok.end,
			})
		}
	}
}

// Expression text is static model content that engines and decision tables
// evaluate over and over, so parse results are memoized. Results are treated
// as immutable by every consumer; the caches are bounded and simply reset when
// full.
const PARSE_CACHE_LIMIT = 2048
const expressionCache = new Map<string, ParseResult>()
const unaryTestsCache = new Map<string, ParseResult>()

function remember(cache: Map<string, ParseResult>, key: string, result: ParseResult): ParseResult {
	if (cache.size >= PARSE_CACHE_LIMIT) cache.clear()
	cache.set(key, result)
	return result
}

/**
 * Cache key for a parse. Scope names change how an expression parses, so they
 * are part of the key; only names with spaces can, so the rest are left out to
 * keep the key small.
 */
function cacheKey(input: string, options: ParseOptions | undefined): string {
	if (!options?.names) return input
	const relevant = [...options.names].filter((n) => n.includes(" ")).sort()
	return relevant.length === 0 ? input : `${input}\u0000${relevant.join("\u0001")}`
}

export function parseExpression(input: string, options?: ParseOptions): ParseResult {
	const key = cacheKey(input, options)
	const cached = expressionCache.get(key)
	if (cached !== undefined) return cached
	const p = new Parser(input, options)
	const ast = p.parseExpression(0)
	p.checkDone()
	return remember(expressionCache, key, { ast, errors: p.errors })
}

export function parseUnaryTests(input: string, options?: ParseOptions): ParseResult {
	const key = cacheKey(input, options)
	const cached = unaryTestsCache.get(key)
	if (cached !== undefined) return cached
	if (input.trim() === "-") {
		return remember(unaryTestsCache, key, {
			ast: { kind: "any-input", start: 0, end: input.length },
			errors: [],
		})
	}
	const p = new Parser(input, options)
	const ast = p.parseUnaryTests()
	return remember(unaryTestsCache, key, { ast, errors: p.errors })
}
