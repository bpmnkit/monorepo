import { describe, expect, it } from "vitest"
import type { FeelNode } from "../src/ast.js"
import { parseExpression, parseUnaryTests } from "../src/parser.js"

function ast(input: string): FeelNode | null {
	return parseExpression(input).ast
}

function utAst(input: string): FeelNode | null {
	return parseUnaryTests(input).ast
}

function noErrors(input: string): void {
	const result = parseExpression(input)
	expect(result.errors).toHaveLength(0)
}

describe("parseExpression", () => {
	describe("literals", () => {
		it("parses number", () => {
			expect(ast("42")).toMatchObject({ kind: "number", value: 42 })
		})
		it("parses negative number via unary minus", () => {
			expect(ast("-1")).toMatchObject({
				kind: "unary-minus",
				operand: { kind: "number", value: 1 },
			})
		})
		it("parses string", () => {
			expect(ast('"hello"')).toMatchObject({ kind: "string", value: "hello" })
		})
		it("parses string with escape", () => {
			expect(ast('"a\\"b"')).toMatchObject({ kind: "string", value: 'a"b' })
		})
		it("parses boolean true", () => {
			expect(ast("true")).toMatchObject({ kind: "boolean", value: true })
		})
		it("parses boolean false", () => {
			expect(ast("false")).toMatchObject({ kind: "boolean", value: false })
		})
		it("parses null", () => {
			expect(ast("null")).toMatchObject({ kind: "null" })
		})
		it("parses temporal", () => {
			expect(ast('@"2021-01-01"')).toMatchObject({ kind: "temporal", raw: '@"2021-01-01"' })
		})
	})

	describe("arithmetic", () => {
		it("parses addition", () => {
			expect(ast("1 + 2")).toMatchObject({
				kind: "binary",
				op: "+",
				left: { value: 1 },
				right: { value: 2 },
			})
		})
		it("parses multiplication before addition", () => {
			const n = ast("1 + 2 * 3")
			expect(n).toMatchObject({ kind: "binary", op: "+", right: { kind: "binary", op: "*" } })
		})
		it("parses exponentiation right-associative", () => {
			const n = ast("2 ** 3 ** 4")
			expect(n).toMatchObject({ kind: "binary", op: "**", right: { kind: "binary", op: "**" } })
		})
	})

	describe("comparison", () => {
		it("parses equality", () => {
			expect(ast("a = 1")).toMatchObject({ kind: "binary", op: "=" })
		})
		it("parses not equal", () => {
			expect(ast("a != 1")).toMatchObject({ kind: "binary", op: "!=" })
		})
		it("parses less than", () => {
			expect(ast("a < 5")).toMatchObject({ kind: "binary", op: "<" })
		})
	})

	describe("logical", () => {
		it("parses and", () => {
			expect(ast("a and b")).toMatchObject({ kind: "binary", op: "and" })
		})
		it("parses or", () => {
			expect(ast("a or b")).toMatchObject({ kind: "binary", op: "or" })
		})
	})

	describe("if-then-else", () => {
		it("parses if expression", () => {
			const n = ast("if x > 0 then x else -x")
			expect(n).toMatchObject({ kind: "if" })
		})
	})

	describe("for expression", () => {
		it("parses for loop", () => {
			const n = ast("for x in [1, 2, 3] return x * 2")
			expect(n).toMatchObject({ kind: "for", bindings: [{ name: "x" }] })
		})
	})

	describe("quantifiers", () => {
		it("parses some", () => {
			expect(ast("some x in [1,2,3] satisfies x > 2")).toMatchObject({ kind: "some" })
		})
		it("parses every", () => {
			expect(ast("every x in [1,2,3] satisfies x > 0")).toMatchObject({ kind: "every" })
		})
	})

	describe("collections", () => {
		it("parses list", () => {
			expect(ast("[1, 2, 3]")).toMatchObject({
				kind: "list",
				items: [{ value: 1 }, { value: 2 }, { value: 3 }],
			})
		})
		it("parses empty list", () => {
			expect(ast("[]")).toMatchObject({ kind: "list", items: [] })
		})
		it("parses context", () => {
			expect(ast("{a: 1, b: 2}")).toMatchObject({
				kind: "context",
				entries: [{ key: "a" }, { key: "b" }],
			})
		})
	})

	describe("ranges", () => {
		it("parses inclusive range", () => {
			expect(ast("[1..5]")).toMatchObject({
				kind: "range",
				startIncluded: true,
				endIncluded: true,
				low: { value: 1 },
				high: { value: 5 },
			})
		})
		it("parses exclusive range", () => {
			expect(ast("(1..5)")).toMatchObject({
				kind: "range",
				startIncluded: false,
				endIncluded: false,
			})
		})
		it("parses half-open range", () => {
			expect(ast("[1..5)")).toMatchObject({
				kind: "range",
				startIncluded: true,
				endIncluded: false,
			})
		})
	})

	describe("function calls", () => {
		it("parses call", () => {
			expect(ast("contains(a, b)")).toMatchObject({ kind: "call", callee: "contains" })
		})
		it("parses multi-word builtin call", () => {
			expect(ast('string length("hello")')).toMatchObject({
				kind: "call",
				callee: "string length",
			})
		})
		it("parses named arg call", () => {
			expect(ast("substring(string: s, start position: 1)")).toMatchObject({
				kind: "call-named",
				callee: "substring",
			})
		})
	})

	describe("path and filter", () => {
		it("parses path", () => {
			expect(ast("a.b")).toMatchObject({ kind: "path", base: { name: "a" }, key: "b" })
		})
		it("parses filter", () => {
			expect(ast("list[item > 1]")).toMatchObject({ kind: "filter" })
		})
	})

	describe("between and in", () => {
		it("parses between", () => {
			expect(ast("x between 1 and 10")).toMatchObject({ kind: "between" })
		})
		it("parses in", () => {
			expect(ast("x in [1..5]")).toMatchObject({ kind: "in-test" })
		})
	})

	describe("instance of", () => {
		it("parses instance of", () => {
			expect(ast("x instance of number")).toMatchObject({
				kind: "instance-of",
				typeName: "number",
			})
		})
	})

	describe("function definition", () => {
		it("parses function definition", () => {
			expect(ast("function(x) x + 1")).toMatchObject({ kind: "function-def", params: ["x"] })
		})
	})

	describe("error recovery", () => {
		it("reports errors but returns partial AST", () => {
			const { errors } = parseExpression("1 + ")
			expect(errors.length).toBeGreaterThan(0)
		})
		it("reports error for trailing unconsumed tokens", () => {
			const { errors } = parseExpression("foo bar")
			expect(errors.length).toBeGreaterThan(0)
		})
		it("reports no errors for valid complete expression", () => {
			expect(parseExpression("foo + bar").errors).toHaveLength(0)
			expect(parseExpression("contains(a, b)").errors).toHaveLength(0)
			expect(parseExpression("x > 5 and y < 10").errors).toHaveLength(0)
		})
	})
})

describe("parseUnaryTests", () => {
	it("parses dash (any input)", () => {
		expect(utAst("-")).toMatchObject({ kind: "any-input" })
	})

	it("parses single equality test", () => {
		expect(utAst('"visa"')).toMatchObject({ kind: "string", value: "visa" })
	})

	it("parses comparison test", () => {
		expect(utAst("< 5")).toMatchObject({ kind: "binary", op: "<" })
	})

	it("parses range test", () => {
		expect(utAst("[1..5]")).toMatchObject({ kind: "range" })
	})

	it("parses multiple tests", () => {
		const n = utAst('"visa", "master"')
		expect(n).toMatchObject({ kind: "unary-test-list" })
	})

	it("parses not(...)", () => {
		expect(utAst('not("visa")')).toMatchObject({ kind: "unary-not" })
	})
})
