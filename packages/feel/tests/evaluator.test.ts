import { describe, expect, it } from "vitest"
import { evaluate, evaluateUnaryTests } from "../src/evaluator.js"
import type { EvalContext } from "../src/evaluator.js"
import { parseExpression, parseUnaryTests } from "../src/parser.js"
import type { FeelValue } from "../src/types.js"

function eval_(input: string, vars: Record<string, FeelValue> = {}): FeelValue {
	const { ast } = parseExpression(input)
	if (!ast) return null
	return evaluate(ast, { vars })
}

function evalUT(input: string, inputVal: FeelValue, vars: Record<string, FeelValue> = {}): boolean {
	const { ast } = parseUnaryTests(input)
	if (!ast) return false
	return evaluateUnaryTests(ast, inputVal, { vars, input: inputVal })
}

describe("evaluate", () => {
	describe("literals", () => {
		it("evaluates numbers", () => {
			expect(eval_("42")).toBe(42)
			expect(eval_("3.14")).toBe(3.14)
		})
		it("evaluates strings", () => {
			expect(eval_('"hello"')).toBe("hello")
		})
		it("evaluates booleans", () => {
			expect(eval_("true")).toBe(true)
			expect(eval_("false")).toBe(false)
		})
		it("evaluates null", () => {
			expect(eval_("null")).toBe(null)
		})
		it("evaluates temporal date", () => {
			expect(eval_('@"2021-01-01"')).toMatchObject({ type: "date", year: 2021, month: 1, day: 1 })
		})
	})

	describe("variables", () => {
		it("looks up variables", () => {
			expect(eval_("x", { x: 10 })).toBe(10)
		})
		it("returns null for undefined variables", () => {
			expect(eval_("unknownVar")).toBe(null)
		})
	})

	describe("arithmetic", () => {
		it("adds numbers", () => {
			expect(eval_("1 + 2")).toBe(3)
		})
		it("subtracts numbers", () => {
			expect(eval_("5 - 3")).toBe(2)
		})
		it("multiplies numbers", () => {
			expect(eval_("3 * 4")).toBe(12)
		})
		it("divides numbers", () => {
			expect(eval_("10 / 2")).toBe(5)
		})
		it("divides by zero returns null", () => {
			expect(eval_("1 / 0")).toBe(null)
		})
		it("raises to power", () => {
			expect(eval_("2 ** 10")).toBe(1024)
		})
		it("null arithmetic returns null", () => {
			expect(eval_("null + 1")).toBe(null)
		})
		it("concatenates strings", () => {
			expect(eval_('"a" + "b"')).toBe("ab")
		})
		it("unary minus", () => {
			expect(eval_("-5")).toBe(-5)
		})
	})

	describe("comparison", () => {
		it("equals", () => {
			expect(eval_("1 = 1")).toBe(true)
			expect(eval_("1 = 2")).toBe(false)
		})
		it("not equals", () => {
			expect(eval_("1 != 2")).toBe(true)
		})
		it("less than", () => {
			expect(eval_("1 < 2")).toBe(true)
		})
		it("greater than or equal", () => {
			expect(eval_("5 >= 5")).toBe(true)
		})
	})

	describe("logical operators", () => {
		it("and short-circuits on false", () => {
			expect(eval_("false and null")).toBe(false)
		})
		it("or short-circuits on true", () => {
			expect(eval_("true or null")).toBe(true)
		})
		it("null and true is null", () => {
			expect(eval_("null and true")).toBe(null)
		})
		it("null or false is null", () => {
			expect(eval_("null or false")).toBe(null)
		})
	})

	describe("if-then-else", () => {
		it("takes then branch when true", () => {
			expect(eval_("if true then 1 else 2")).toBe(1)
		})
		it("takes else branch when false", () => {
			expect(eval_("if false then 1 else 2")).toBe(2)
		})
		it("takes else branch when null", () => {
			expect(eval_("if null then 1 else 2")).toBe(2)
		})
	})

	describe("collections", () => {
		it("evaluates list", () => {
			expect(eval_("[1, 2, 3]")).toEqual([1, 2, 3])
		})
		it("evaluates context", () => {
			expect(eval_("{a: 1, b: 2}")).toEqual({ a: 1, b: 2 })
		})
	})

	describe("path access", () => {
		it("accesses context property", () => {
			expect(eval_("ctx.name", { ctx: { name: "Alice" } })).toBe("Alice")
		})
		it("returns null for missing property", () => {
			expect(eval_("ctx.missing", { ctx: {} })).toBe(null)
		})
		it("returns null for null base", () => {
			expect(eval_("null.foo")).toBe(null)
		})
		it("maps path over list", () => {
			expect(eval_("items.value", { items: [{ value: 1 }, { value: 2 }] })).toEqual([1, 2])
		})
	})

	describe("filter", () => {
		it("filters list by condition", () => {
			expect(eval_("[1, 2, 3][item > 1]")).toEqual([2, 3])
		})
	})

	describe("between", () => {
		it("returns true when in range", () => {
			expect(eval_("5 between 1 and 10")).toBe(true)
		})
		it("returns false when out of range", () => {
			expect(eval_("0 between 1 and 10")).toBe(false)
		})
	})

	describe("in test", () => {
		it("tests membership in range", () => {
			expect(eval_("3 in [1..5]")).toBe(true)
		})
		it("tests equality", () => {
			expect(eval_('"visa" in "visa"')).toBe(true)
		})
	})

	describe("for expression", () => {
		it("maps over list", () => {
			expect(eval_("for x in [1, 2, 3] return x * 2")).toEqual([2, 4, 6])
		})
	})

	describe("quantifiers", () => {
		it("some returns true if any match", () => {
			expect(eval_("some x in [1, 2, 3] satisfies x > 2")).toBe(true)
		})
		it("some returns false if none match", () => {
			expect(eval_("some x in [1, 2, 3] satisfies x > 10")).toBe(false)
		})
		it("every returns true if all match", () => {
			expect(eval_("every x in [1, 2, 3] satisfies x > 0")).toBe(true)
		})
		it("every returns false if any fail", () => {
			expect(eval_("every x in [1, 2, 3] satisfies x > 1")).toBe(false)
		})
	})

	describe("function calls", () => {
		it("calls string length", () => {
			expect(eval_('string length("hello")')).toBe(5)
		})
		it("calls contains", () => {
			expect(eval_('contains("hello world", "world")')).toBe(true)
		})
		it("calls upper case", () => {
			expect(eval_('upper case("hello")')).toBe("HELLO")
		})
		it("calls floor", () => {
			expect(eval_("floor(3.7)")).toBe(3)
		})
		it("calls ceiling", () => {
			expect(eval_("ceiling(3.2)")).toBe(4)
		})
		it("calls abs", () => {
			expect(eval_("abs(-5)")).toBe(5)
		})
		it("calls not(false)", () => {
			expect(eval_("not(false)")).toBe(true)
		})
		it("calls count", () => {
			expect(eval_("count([1, 2, 3])")).toBe(3)
		})
		it("calls min", () => {
			expect(eval_("min([3, 1, 2])")).toBe(1)
		})
		it("calls max", () => {
			expect(eval_("max([3, 1, 2])")).toBe(3)
		})
		it("calls sum", () => {
			expect(eval_("sum([1, 2, 3])")).toBe(6)
		})
		it("calls mean", () => {
			expect(eval_("mean([1, 2, 3])")).toBe(2)
		})
		it("calls date()", () => {
			expect(eval_('date("2021-01-15")')).toMatchObject({
				type: "date",
				year: 2021,
				month: 1,
				day: 15,
			})
		})
		it("calls decimal", () => {
			expect(eval_("decimal(3.14159, 2)")).toBe(3.14)
		})
		it("calls starts with", () => {
			expect(eval_('starts with("hello", "he")')).toBe(true)
		})
		it("calls ends with", () => {
			expect(eval_('ends with("hello", "lo")')).toBe(true)
		})
		it("calls substring", () => {
			expect(eval_('substring("hello", 2, 3)')).toBe("ell")
		})
		it("calls append", () => {
			expect(eval_("append([1, 2], 3)")).toEqual([1, 2, 3])
		})
		it("calls concatenate", () => {
			expect(eval_("concatenate([1, 2], [3, 4])")).toEqual([1, 2, 3, 4])
		})
		it("calls reverse", () => {
			expect(eval_("reverse([1, 2, 3])")).toEqual([3, 2, 1])
		})
		it("calls is defined", () => {
			expect(eval_("is defined(x)", { x: 1 })).toBe(true)
			expect(eval_("is defined(y)")).toBe(false)
		})
	})

	describe("temporal arithmetic", () => {
		it("adds years-months duration to date", () => {
			const result = eval_('date("2021-01-15") + duration("P1Y")')
			expect(result).toMatchObject({ type: "date", year: 2022, month: 1, day: 15 })
		})
	})

	describe("instance of", () => {
		it("checks number type", () => {
			expect(eval_("42 instance of number")).toBe(true)
			expect(eval_('"hello" instance of number')).toBe(false)
		})
		it("checks string type", () => {
			expect(eval_('"hi" instance of string')).toBe(true)
		})
	})

	describe("function definition", () => {
		it("produces a function value", () => {
			const { ast } = parseExpression("function(x) x * 2")
			if (!ast) throw new Error("parse failed")
			const fn = evaluate(ast, { vars: {} })
			expect(fn).toMatchObject({ type: "function" })
		})
		it("function stored in variable is callable", () => {
			const { ast } = parseExpression("double(3)")
			if (!ast) throw new Error("parse failed")
			const { ast: fnAst } = parseExpression("function(x) x * 2")
			if (!fnAst) throw new Error("parse failed")
			const fnVal = evaluate(fnAst, { vars: {} })
			expect(evaluate(ast, { vars: { double: fnVal } })).toBe(6)
		})
	})
})

describe("evaluateUnaryTests", () => {
	it("any input (-) always matches", () => {
		expect(evalUT("-", 42)).toBe(true)
		expect(evalUT("-", "anything")).toBe(true)
	})

	it("equality test", () => {
		expect(evalUT('"visa"', "visa")).toBe(true)
		expect(evalUT('"visa"', "master")).toBe(false)
	})

	it("comparison test < 5", () => {
		expect(evalUT("< 5", 3)).toBe(true)
		expect(evalUT("< 5", 7)).toBe(false)
	})

	it("range test [1..5]", () => {
		expect(evalUT("[1..5]", 3)).toBe(true)
		expect(evalUT("[1..5]", 6)).toBe(false)
	})

	it("multiple tests (disjunction)", () => {
		expect(evalUT('"visa", "master"', "visa")).toBe(true)
		expect(evalUT('"visa", "master"', "amex")).toBe(false)
	})

	it("not(...)", () => {
		expect(evalUT('not("visa")', "master")).toBe(true)
		expect(evalUT('not("visa")', "visa")).toBe(false)
	})
})
