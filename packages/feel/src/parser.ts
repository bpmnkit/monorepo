import type { BinaryOp, FeelNode } from "./ast.js"
import { tokenize } from "./lexer.js"
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

class Parser {
	private tokens: FeelToken[]
	private pos = 0
	readonly errors: ParseError[] = []

	constructor(input: string) {
		this.tokens = tokenize(input).filter((t) => t.kind !== "whitespace" && t.kind !== "comment")
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

	/** Try to extend a single name token into a multi-word built-in name. */
	private resolveMultiwordName(first: string): string {
		let name = first
		while (true) {
			// Only try to extend if current is a known prefix
			if (!BUILTIN_PREFIXES.has(name)) break
			const next = this.peek()
			if (!next || (next.kind !== "name" && next.kind !== "keyword")) break
			const extended = `${name} ${next.value}`
			if (BUILTIN_NAMES.has(extended) || BUILTIN_PREFIXES.has(extended)) {
				this.advance()
				name = extended
			} else {
				break
			}
		}
		return name
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
			// ** is right-associative
			const rightPrec = op === "**" ? prec - 1 : prec
			const right = this.parseExpression(rightPrec)
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
			this.advance()
			return { kind: "path", base: left, key: nameTok.value, start: left.start, end: nameTok.end }
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
			const raw = tok.value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")
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
		// Peek: name colon value pattern?
		const t0 = this.peek(0)
		const t1 = this.peek(1)
		return !!(
			t0 &&
			(t0.kind === "name" || t0.kind === "keyword") &&
			t1 &&
			t1.kind === "punct" &&
			t1.value === ":"
		)
	}

	private parseNamedCall(callee: string, start: number): FeelNode | null {
		const args: Array<{ name: string; value: FeelNode }> = []
		if (!this.check("punct", ")")) {
			const parsePair = (): boolean => {
				const nameTok = this.advance()
				if (!nameTok) return false
				if (!this.expect("punct", ":")) return false
				const val = this.parseExpression(0)
				if (!val) return false
				args.push({ name: nameTok.value, value: val })
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
			const domain = this.parseExpression(0)
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
			const domain = this.parseExpression(0)
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
		if (!this.check("punct", ")")) {
			const p = this.advance()
			if (p) params.push(p.value)
			while (this.consume("punct", ",")) {
				const q = this.advance()
				if (q) params.push(q.value)
			}
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
					key = t.value.slice(1, -1)
				} else if (this.check("name") || this.check("keyword")) {
					const t = this.advance()
					if (!t) return false
					key = t.value
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

	private parseInTestExpr(): FeelNode | null {
		// x in (a, b, c) or x in [1..5] or x in expr
		if (this.check("punct", "(")) {
			// Parenthesized list of tests or a range
			return this.parseParenOrRange()
		}
		if (this.check("punct", "[")) {
			return this.parseListOrRange()
		}
		return this.parseExpression(30)
	}

	private parseTypeName(): string | null {
		const tok = this.peek()
		if (!tok || (tok.kind !== "name" && tok.kind !== "keyword")) return null
		this.advance()
		const name = tok.value
		// Handle multi-word type names: "date and time", "years and months duration", etc.
		const multiTypes: Record<string, string> = {
			date: "date",
			time: "time",
			number: "number",
			string: "string",
			boolean: "boolean",
			context: "context",
			list: "list",
			function: "function",
			duration: "duration",
			Any: "Any",
		}
		if (multiTypes[name]) return name
		// Try to extend: "date and time", "years and months duration"
		const next1 = this.peek()
		if (next1?.kind === "keyword" && next1.value === "and") {
			const saved = this.pos
			this.advance() // consume "and"
			const next2 = this.peek()
			if (next2?.kind === "name" && next2.value === "time") {
				this.advance()
				return "date and time"
			}
			if (next2?.kind === "name" && next2.value === "months") {
				this.advance()
				const next3 = this.peek()
				if (next3?.kind === "name" && next3.value === "duration") {
					this.advance()
					return "years and months duration"
				}
			}
			this.pos = saved
		}
		return name
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

		// Comparison operator prefix: < 5, >= 10, etc.
		if (
			tok.kind === "op" &&
			(tok.value === "<" || tok.value === "<=" || tok.value === ">" || tok.value === ">=")
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

export function parseExpression(input: string): ParseResult {
	const p = new Parser(input)
	const ast = p.parseExpression(0)
	p.checkDone()
	return { ast, errors: p.errors }
}

export function parseUnaryTests(input: string): ParseResult {
	if (input.trim() === "-") {
		return { ast: { kind: "any-input", start: 0, end: input.length }, errors: [] }
	}
	const p = new Parser(input)
	const ast = p.parseUnaryTests()
	return { ast, errors: p.errors }
}
