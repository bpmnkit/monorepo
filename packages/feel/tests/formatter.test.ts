import { describe, expect, it } from "vitest"
import type { FeelNode } from "../src/ast.js"
import { formatFeel } from "../src/formatter.js"
import { parseExpression, parseUnaryTests } from "../src/parser.js"

function fmt(input: string): string {
	const { ast } = parseExpression(input)
	if (!ast) return ""
	return formatFeel(ast)
}

describe("formatFeel", () => {
	it("formats number literals", () => {
		expect(fmt("42")).toBe("42")
		expect(fmt("3.14")).toBe("3.14")
	})

	it("formats string literals", () => {
		expect(fmt('"hello"')).toBe('"hello"')
	})

	it("formats boolean literals", () => {
		expect(fmt("true")).toBe("true")
		expect(fmt("false")).toBe("false")
	})

	it("formats null", () => {
		expect(fmt("null")).toBe("null")
	})

	it("formats temporal", () => {
		expect(fmt('@"2021-01-01"')).toBe('@"2021-01-01"')
	})

	it("formats name", () => {
		expect(fmt("myVar")).toBe("myVar")
	})

	it("formats binary expressions", () => {
		expect(fmt("1 + 2")).toBe("1 + 2")
		expect(fmt("a and b")).toBe("a and b")
	})

	it("formats unary minus", () => {
		expect(fmt("-5")).toBe("-5")
	})

	it("formats list", () => {
		expect(fmt("[1, 2, 3]")).toBe("[1, 2, 3]")
	})

	it("formats context", () => {
		expect(fmt("{a: 1}")).toBe("{a: 1}")
	})

	it("formats function call", () => {
		expect(fmt('string length("hi")')).toBe('string length("hi")')
	})

	it("formats if-then-else", () => {
		expect(fmt("if x > 0 then x else 0")).toBe("if x > 0 then x else 0")
	})

	it("formats range", () => {
		expect(fmt("[1..5]")).toBe("[1..5]")
		expect(fmt("(1..5)")).toBe("(1..5)")
	})

	it("formats path access", () => {
		expect(fmt("a.b")).toBe("a.b")
	})

	it("formats between", () => {
		expect(fmt("x between 1 and 10")).toBe("x between 1 and 10")
	})

	it("formats instance of", () => {
		expect(fmt("x instance of number")).toBe("x instance of number")
	})

	it("formats for expression", () => {
		expect(fmt("for x in [1, 2] return x * 2")).toBe("for x in [1, 2] return x * 2")
	})

	it("formats function definition", () => {
		expect(fmt("function(x) x + 1")).toBe("function(x) x + 1")
	})

	it("round-trips simple expressions", () => {
		const cases = ["42", '"hello"', "true", "null", "1 + 2", "a and b", "[1, 2, 3]", "{a: 1}"]
		for (const c of cases) {
			const formatted = fmt(c)
			const { ast: ast2 } = parseExpression(formatted)
			if (!ast2) throw new Error(`Failed to re-parse: ${formatted}`)
			expect(formatFeel(ast2)).toBe(formatted)
		}
	})

	it("formats any-input", () => {
		// any-input is only produced by parseUnaryTests
		const { ast: utAst } = parseUnaryTests("-")
		if (!utAst) return
		expect(formatFeel(utAst)).toBe("-")
	})
})
