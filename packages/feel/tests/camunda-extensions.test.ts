import { describe, expect, it } from "vitest"
import { evaluate } from "../src/evaluator.js"
import { parseExpression } from "../src/parser.js"
import type { FeelValue } from "../src/types.js"

function feel(input: string, vars: Record<string, FeelValue> = {}): FeelValue {
	const { ast, errors } = parseExpression(input)
	if (!ast || errors.length > 0) throw new Error(`cannot parse ${input}: ${errors[0]?.message}`)
	return evaluate(ast, { vars })
}

/** Evaluates both sides and compares, so expectations can be written as FEEL. */
function same(input: string, expected: string, vars: Record<string, FeelValue> = {}): void {
	expect(feel(input, vars)).toEqual(feel(expected))
}

describe("Camunda built-in extensions", () => {
	describe("assert()", () => {
		it("returns the value when the condition holds", () => {
			expect(feel("assert(x, x != null)", { x: "value" })).toBe("value")
			expect(feel(`assert(x, x >= 0, "'x' should be positive")`, { x: 4 })).toBe(4)
		})
		it("is an error, reported as null, when it does not", () => {
			expect(feel("assert(x, x >= 0)", { x: -1 })).toBeNull()
			expect(feel("assert(x, x != null)")).toBeNull()
			// Only true passes: a condition that is not a boolean does not hold.
			expect(feel(`assert(1, "yes")`)).toBeNull()
		})
		it("binds its parameters by name", () => {
			expect(feel("assert(condition: true, value: 5)")).toBe(5)
		})
	})

	describe("fromAi()", () => {
		it("returns the value unchanged, whatever else it is given", () => {
			const vars = { toolCall: { userId: 42 } }
			expect(feel("fromAi(toolCall.userId)", vars)).toBe(42)
			expect(feel(`fromAi(toolCall.userId, "The user's ID", "number")`, vars)).toBe(42)
			expect(feel(`fromAi(value: toolCall.userId, type: "number")`, vars)).toBe(42)
			expect(feel("fromAi(value: toolCall.userId, options: {required: false})", vars)).toBe(42)
		})
	})

	describe("string functions", () => {
		it("is blank()", () => {
			expect(feel('is blank("")')).toBe(true)
			expect(feel('is blank(" \t\n")')).toBe(true)
			expect(feel('is blank(" a ")')).toBe(false)
			expect(feel("is blank(1)")).toBeNull()
		})
		it("trim()", () => {
			expect(feel('trim("  hello   world  ")')).toBe("hello   world")
			expect(feel("trim(null)")).toBeNull()
		})
		it("extract()", () => {
			same('extract("references are 1234, 1256, 1378", "12[0-9]*")', '["1234", "1256"]')
			same('extract("abc", "[0-9]+")', "[]")
			expect(feel('extract("abc", "(")')).toBeNull()
		})
		it("uuid() is a version 4 UUID, different on each call", () => {
			const a = feel("uuid()")
			expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
			expect(feel("uuid()")).not.toBe(a)
		})
		it("to base64() and from base64() round-trip UTF-8", () => {
			expect(feel('to base64("FEEL")')).toBe("RkVFTA==")
			expect(feel('from base64("RkVFTA==")')).toBe("FEEL")
			expect(feel('to base64("Grüße €")')).toBe("R3LDvMOfZSDigqw=")
			expect(feel('from base64(to base64("日本 🎉"))')).toBe("日本 🎉")
		})
		it("from base64() of something that is not Base64 is null", () => {
			expect(feel('from base64("not base64!")')).toBeNull()
			expect(feel('from base64("abc")')).toBeNull()
			// Well-formed Base64 of bytes that are not UTF-8 text.
			expect(feel('from base64("/w==")')).toBeNull()
		})
	})

	describe("list functions", () => {
		it("is empty()", () => {
			expect(feel("is empty([])")).toBe(true)
			expect(feel("is empty([null])")).toBe(false)
			expect(feel('is empty("")')).toBeNull()
		})
		it("partition()", () => {
			same("partition([1,2,3,4,5], 2)", "[[1,2], [3,4], [5]]")
			same("partition([1,2], 5)", "[[1,2]]")
			same("partition([], 2)", "[]")
			expect(feel("partition([1,2], 0)")).toBeNull()
			expect(feel("partition([1,2], -1)")).toBeNull()
			expect(feel("partition([1,2], 1.5)")).toBeNull()
		})
		it("duplicate values(), in the order they first occur", () => {
			same("duplicate values([1,2,3,2,1])", "[1,2]")
			same("duplicate values([3,1,1,3,3])", "[3,1]")
			same("duplicate values([1,2,3])", "[]")
			same(
				'duplicate values([{a: 1}, {a: 1}, @"2020-01-01", date("2020-01-01")])',
				'[{a: 1}, @"2020-01-01"]',
			)
		})
	})

	describe("JSON", () => {
		it("to json()", () => {
			expect(feel('to json({a: 1, b: [true, null, "x"]})')).toBe('{"a":1,"b":[true,null,"x"]}')
			expect(feel('to json(@"2023-06-14")')).toBe('"2023-06-14"')
			expect(feel('to json(@"P3Y")')).toBe('"P3Y"')
			expect(feel('to json(@"PT90M")')).toBe('"PT1H30M"')
			expect(feel('to json(@"2025-11-24T10:00:00@Europe/Berlin")')).toBe(
				'"2025-11-24T10:00:00+01:00[Europe/Berlin]"',
			)
			expect(feel('to json(@"2025-07-24T10:00:00@Europe/Berlin")')).toBe(
				'"2025-07-24T10:00:00+02:00[Europe/Berlin]"',
			)
			expect(feel("to json(function(x) x)")).toBeNull()
		})
		it("from json()", () => {
			same('from json("{\\"a\\": 1, \\"b\\": [1, \\"x\\", null]}")', '{a: 1, b: [1, "x", null]}')
			// A date in JSON is a string: JSON has no date type to say otherwise.
			expect(feel('from json("\\"2023-06-14\\"")')).toBe("2023-06-14")
			expect(feel('from json("{oops")')).toBeNull()
		})
		it("from json() keeps a __proto__ key as an entry", () => {
			const value = feel('from json("{\\"__proto__\\": {\\"polluted\\": true}}")') as Record<
				string,
				FeelValue
			>
			expect(Object.keys(value)).toEqual(["__proto__"])
			expect(Object.getPrototypeOf(value)).toBe(Object.prototype)
			expect(({} as Record<string, unknown>).polluted).toBeUndefined()
		})
	})
})

describe("Camunda temporal behaviour", () => {
	it("last day of month() is a date", () => {
		same('last day of month(date("2022-10-01"))', 'date("2022-10-31")')
		same('last day of month(date("2024-02-10"))', 'date("2024-02-29")')
		same('last day of month(date and time("2022-10-16T12:00:00"))', 'date("2022-10-31")')
		expect(feel('last day of month("2022-10-01")')).toBeNull()
	})

	it("adds and subtracts durations to a time, around the clock", () => {
		same('time("08:00:00") + duration("PT1H")', 'time("09:00:00")')
		same('time("23:00:00") + duration("PT2H")', 'time("01:00:00")')
		same('time("08:00:00") - duration("PT2H")', 'time("06:00:00")')
		same('time("01:00:00+02:00") - duration("PT2H")', 'time("23:00:00+02:00")')
		expect(feel('time("08:00:00") + duration("P1M")')).toBeNull()
	})

	it("subtracts times", () => {
		same('time("08:00:00") - time("06:00:00")', 'duration("PT2H")')
		same('time("08:00:00Z") - time("08:00:00+02:00")', 'duration("PT2H")')
		// A local time and one at an offset have no common clock.
		expect(feel('time("08:00:00") - time("06:00:00Z")')).toBeNull()
	})

	it("divides a duration by a duration", () => {
		expect(feel('duration("P5D") / duration("P1D")')).toBe(5)
		expect(feel('duration("P1Y") / duration("P1M")')).toBe(12)
		expect(feel('duration("P1D") / duration("PT0S")')).toBeNull()
		expect(feel('duration("P1Y") / duration("P1D")')).toBeNull()
	})

	it("time() accepts a leading time designator", () => {
		same('time("T23:59:00")', 'time("23:59:00")')
		same(
			'date and time(date("2012-12-24"), time("T23:59:00"))',
			'date and time("2012-12-24T23:59:00")',
		)
	})

	it("reads Java's offset-and-zone form as the zone", () => {
		same(
			'date and time("2018-04-29T09:30:00+02:00[Europe/Berlin]")',
			'date and time("2018-04-29T09:30:00@Europe/Berlin")',
		)
		expect(feel('date and time("2018-04-29T09:30:00+02:00[Not/AZone]")')).toBeNull()
	})

	it("date and time(value, timezone) moves an instant to another zone's clock", () => {
		same(
			'date and time(@"2020-07-31T14:27:30@Europe/Berlin", "America/Los_Angeles")',
			'date and time("2020-07-31T05:27:30@America/Los_Angeles")',
		)
		same(
			'date and time(@"2020-07-31T14:27:30+02:00", "Z")',
			'date and time("2020-07-31T12:27:30Z")',
		)
		same(
			'date and time(@"2020-07-31T23:30:00Z", "+05:30")',
			'date and time("2020-08-01T05:00:00+05:30")',
		)
		// Winter time: Berlin is an hour ahead of UTC, not two.
		same(
			'date and time(@"2020-01-31T12:00:00Z", "Europe/Berlin")',
			'date and time("2020-01-31T13:00:00@Europe/Berlin")',
		)
	})

	it("date and time(value, timezone) is null for a local value or an unknown zone", () => {
		expect(feel('date and time(@"2020-07-31T14:27:30", "Z")')).toBeNull()
		expect(feel('date and time(@"2020-07-31T14:27:30Z", "Mars/Olympus")')).toBeNull()
	})
})

describe("overlaps before() and overlaps after()", () => {
	it("do not overlap where an open end touches", () => {
		expect(feel("overlaps before([1..3], (3..5])")).toBe(false)
		expect(feel("overlaps before([1..3], [3..5])")).toBe(true)
		expect(feel("overlaps after((5..8], [1..5))")).toBe(false)
		expect(feel("overlaps after([5..8], [1..5])")).toBe(true)
	})
	it("allow a shared end where the second range's end is closed", () => {
		expect(feel("overlaps before([1..5], [3..5])")).toBe(true)
		expect(feel("overlaps before([1..5], [3..5))")).toBe(false)
		expect(feel("overlaps after([3..5], [1..5])")).toBe(true)
	})
})
