import { describe, expect, it } from "vitest"
import { evaluate } from "../src/evaluator.js"
import { unescapeString } from "../src/lexer.js"
import type { ParseOptions } from "../src/parser.js"
import { parseExpression } from "../src/parser.js"
import type { FeelValue } from "../src/types.js"

function eval_(
	input: string,
	vars: Record<string, FeelValue> = {},
	options?: ParseOptions,
): FeelValue {
	const { ast } = parseExpression(input, options)
	if (!ast) return null
	return evaluate(ast, { vars })
}

/** Parses with the variables in scope, the way a caller with a context would. */
function evalInScope(input: string, vars: Record<string, FeelValue>): FeelValue {
	return eval_(input, vars, { names: Object.keys(vars) })
}

function parseErrors(input: string): string[] {
	return parseExpression(input).errors.map((e) => e.message)
}

// Divergences from the DMN spec and the Camunda FEEL engine, each found by
// differential testing against another FEEL implementation.
describe("spec compliance", () => {
	describe("string escapes", () => {
		it("decodes the escapes FEEL defines", () => {
			expect(eval_('"a\\nb"')).toBe("a\nb")
			expect(eval_('"a\\tb"')).toBe("a\tb")
			expect(eval_('"a\\rb"')).toBe("a\rb")
			expect(eval_('"a\\\'b"')).toBe("a'b")
			expect(eval_('"a\\"b"')).toBe('a"b')
			expect(eval_('"a\\\\b"')).toBe("a\\b")
		})
		it("decodes unicode escapes", () => {
			expect(eval_('"\\u0041"')).toBe("A")
			expect(eval_('"\\U01F40E"')).toBe("\u{1F40E}")
		})
		it("leaves an unrecognized escape as written", () => {
			expect(unescapeString("\\q")).toBe("\\q")
			expect(unescapeString("\\u00")).toBe("\\u00")
			expect(unescapeString("trailing\\")).toBe("trailing\\")
		})
		it("takes as many digits as still form a code point", () => {
			// 0x11FFFF is past the last code point, so only five digits are taken.
			expect(unescapeString("\\U11FFFF")).toBe("\u{11FFF}F")
		})
		it("decodes escapes in context keys", () => {
			expect(eval_('{"a\\nb": 1}')).toEqual({ "a\nb": 1 })
		})
		it("counts characters, not UTF-16 units", () => {
			expect(eval_('string length("\\U01F40E")')).toBe(1)
			expect(eval_('substring("\\U01F40Eab", 2)')).toBe("ab")
		})
	})

	describe("named arguments", () => {
		it("binds by name, not by position", () => {
			expect(eval_('substring(start position: 2, string: "hello")')).toBe("ello")
			expect(eval_('replace(replacement: "x", pattern: "b", input: "abc")')).toBe("axc")
		})
		it("accepts parameter names containing spaces", () => {
			expect(eval_('substring(string: "hello", start position: 2)')).toBe("ello")
		})
		it("picks the signature matching the given names", () => {
			expect(eval_('substring(string: "hello", start position: 2, length: 2)')).toBe("el")
			expect(eval_('number(from: "1,5", grouping separator: null, decimal separator: ",")')).toBe(
				1.5,
			)
		})
		it("returns null for a parameter the built-in does not declare", () => {
			expect(eval_('substring(str: "hello", start position: 2)')).toBe(null)
		})
		it("binds named arguments of user-defined functions", () => {
			expect(eval_("f(b: 1, a: 5)", { f: eval_("function(a, b) a - b") })).toBe(4)
		})
		it("gives a user-defined function null for a parameter it does not declare", () => {
			expect(eval_("f(c: 1)", { f: eval_("function(a) a") })).toBe(null)
		})
	})

	describe("context entries", () => {
		it("sees the entries declared before it", () => {
			expect(eval_("{a: 1, b: a + 1}")).toEqual({ a: 1, b: 2 })
			expect(eval_("{a: 1, b: {c: a}}.b.c")).toBe(1)
		})
		it("does not see the entries declared after it", () => {
			expect(eval_("{b: a + 1, a: 1}.b")).toBe(null)
		})
		it("prefers an entry over an outer variable of the same name", () => {
			expect(eval_("{a: 2, b: a}.b", { a: 1 })).toBe(2)
		})
	})

	describe("calendar validity", () => {
		it("rejects a date that does not exist", () => {
			expect(eval_('date("2021-02-29")')).toBe(null)
			expect(eval_('date("2020-02-30")')).toBe(null)
			expect(eval_('date("2020-13-01")')).toBe(null)
			expect(eval_("date(2020, 2, 30)")).toBe(null)
		})
		it("accepts a leap day in a leap year", () => {
			expect(eval_('date("2020-02-29")')).toMatchObject({ year: 2020, month: 2, day: 29 })
		})
		it("rejects a time that does not exist", () => {
			expect(eval_('time("25:00:00")')).toBe(null)
			expect(eval_('time("10:61:00")')).toBe(null)
			expect(eval_("time(24, 0, 1)")).toBe(null)
		})
		it("clamps the day when adding months", () => {
			expect(eval_('string(date("2020-01-31") + duration("P1M"))')).toBe("2020-02-29")
			expect(eval_('string(date("2021-01-31") + duration("P1M"))')).toBe("2021-02-28")
			expect(eval_('string(date("2020-03-31") - duration("P1M"))')).toBe("2020-02-29")
			expect(eval_('string(date("2020-01-31") + duration("P1Y"))')).toBe("2021-01-31")
		})
	})

	describe("range iteration domains", () => {
		it("iterates a range in for", () => {
			expect(eval_("for i in 1..3 return i * i")).toEqual([1, 4, 9])
		})
		it("counts down when the range runs backwards", () => {
			expect(eval_("for i in 3..1 return i")).toEqual([3, 2, 1])
		})
		it("iterates a range in some and every", () => {
			expect(eval_("some x in 1..3 satisfies x > 2")).toBe(true)
			expect(eval_("every x in 1..3 satisfies x > 0")).toBe(true)
		})
		it("combines a range with a list domain", () => {
			expect(eval_("for x in [1,2], y in 1..2 return x * y")).toEqual([1, 2, 2, 4])
		})
	})

	describe("invoking a function value", () => {
		it("invokes a function held in a context", () => {
			expect(eval_("{f: function(a) a * 2}.f(3)")).toBe(6)
		})
		it("invokes a function literal", () => {
			expect(eval_("(function(a) a + 1)(2)")).toBe(3)
		})
		it("invokes a function held in a variable", () => {
			expect(eval_("fns.double(4)", { fns: { double: eval_("function(a) a * 2") } })).toBe(8)
		})
		it("returns null when the target is not a function", () => {
			expect(eval_("{f: 1}.f(3)")).toBe(null)
		})
	})

	describe("operator associativity", () => {
		// FEEL makes every infix operator left-associative, "**" included.
		it("evaluates exponentiation left to right", () => {
			expect(eval_("2 ** 3 ** 2")).toBe(64)
		})
	})

	describe("names containing spaces", () => {
		it("resolves a multi-word name that is in scope", () => {
			expect(evalInScope("a b + 1", { "a b": 1 })).toBe(2)
			expect(evalInScope("total order amount * 2", { "total order amount": 21 })).toBe(42)
		})
		it("prefers the longest name in scope", () => {
			expect(evalInScope("a b c", { "a b": 1, "a b c": 5 })).toBe(5)
		})
		it("gives back words that do not complete a name", () => {
			expect(parseErrors("a b")).toEqual(["Unexpected token 'b'"])
		})
		it("still reads built-in names without being told the scope", () => {
			expect(eval_('date and time("2020-01-01T10:00:00").year')).toBe(2020)
		})
		it("does not swallow a keyword that follows a name", () => {
			expect(evalInScope("x and y", { x: true, y: false, "x z": 1 })).toBe(false)
		})
	})

	describe("conversions", () => {
		it("converts null to null, not to the text null", () => {
			expect(eval_("string(null)")).toBe(null)
		})
		it("renders lists and contexts", () => {
			expect(eval_("string([1,2])")).toBe("[1, 2]")
			expect(eval_('string(["a",1])')).toBe('["a", 1]')
			expect(eval_('string({a: "x"})')).toBe('{a: "x"}')
			expect(eval_("string({a: {b: 1}})")).toBe("{a: {b: 1}}")
			expect(eval_("string([])")).toBe("[]")
		})
		it("counts a list, and nothing else", () => {
			expect(eval_("count([1,2])")).toBe(2)
			expect(eval_("count([])")).toBe(0)
			expect(eval_("count(null)")).toBe(null)
		})
		it("reads numbers with separators", () => {
			expect(eval_('number("1,000.5", ",", ".")')).toBe(1000.5)
			expect(eval_('number("1.000,5", ".", ",")')).toBe(1000.5)
			expect(eval_('number("1000")')).toBe(1000)
		})
		it("rejects separators that are the same or unsupported", () => {
			expect(eval_('number("1,000.5", ".", ".")')).toBe(null)
			expect(eval_('number("1,000.5", ";", ".")')).toBe(null)
		})
	})

	describe("regular expression flags", () => {
		it("applies the dot-all flag", () => {
			expect(eval_('matches("a\\nb", "a.b", "s")')).toBe(true)
			expect(eval_('matches("a\\nb", "a.b")')).toBe(false)
		})
		it("applies the case-insensitive and multi-line flags", () => {
			expect(eval_('matches("ABC", "abc", "i")')).toBe(true)
			expect(eval_('matches("a\\nb", "^b$", "m")')).toBe(true)
		})
		it("treats the pattern as a literal under the q flag", () => {
			expect(eval_('matches("a.c", "a.c", "q")')).toBe(true)
			expect(eval_('matches("abc", "a.c", "q")')).toBe(false)
		})
		it("ignores pattern whitespace under the x flag", () => {
			expect(eval_('matches("abc", "a b c", "x")')).toBe(true)
			expect(eval_('matches("a c", "a[ ]c", "x")')).toBe(true)
		})
		it("returns null for a flag FEEL does not define", () => {
			expect(eval_('matches("abc", "abc", "z")')).toBe(null)
		})
	})
})
