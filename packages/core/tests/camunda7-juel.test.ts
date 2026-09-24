import { type FeelValue, evaluate, parseExpression } from "@bpmnkit/feel"
import { describe, expect, it } from "vitest"
import { translateJuelToFeel } from "../src/index.js"

/**
 * The JUEL → FEEL translation table. Each row is a Camunda 7 expression and
 * the FEEL it must become; the `manual` rows are what must be refused rather
 * than guessed at.
 */
const TRANSLATED: ReadonlyArray<[juel: string, feel: string]> = [
	["${approved}", "approved"],
	["${order.customer.vip}", "order.customer.vip"],
	["#{amount}", "amount"],
	["${'EUR'}", '"EUR"'],
	['${"say \\"hi\\""}', '"say \\"hi\\""'],
	["${42}", "42"],
	["${3.25}", "3.25"],
	["${true}", "true"],
	["${null}", "null"],
	["${a == b}", "a = b"],
	["${status eq 'open'}", 'status = "open"'],
	["${a != b}", "a != b"],
	["${a ne b}", "a != b"],
	["${total < 100}", "total < 100"],
	["${total lt 100}", "total < 100"],
	["${total >= 100}", "total >= 100"],
	["${total ge 100}", "total >= 100"],
	["${total gt 100}", "total > 100"],
	["${total le 100}", "total <= 100"],
	["${a && b}", "a and b"],
	["${a and b}", "a and b"],
	["${a || b}", "a or b"],
	["${a or b and c}", "a or b and c"],
	["${(a or b) and c}", "(a or b) and c"],
	["${!approved}", "not(approved)"],
	["${not approved}", "not(approved)"],
	["${!(a && b)}", "not((a and b))"],
	["${a + b * c}", "a + b * c"],
	["${(a + b) * c}", "(a + b) * c"],
	["${a - (b - c)}", "a - (b - c)"],
	["${a div 2}", "a / 2"],
	["${-x}", "-x"],
	["${a < b == c}", "(a < b) = c"],
	["${approved && order.total <= 1000}", "approved and order.total <= 1000"],
	["${ order.total > 100 }", "order.total > 100"],
]

const REFUSED: ReadonlyArray<[juel: string, because: RegExp]> = [
	["${execution.getVariable('x')}", /engine object/],
	["${task.assignee}", /engine object/],
	["${authenticatedUserId}", /engine object/],
	["${inventory.reserve(order)}", /method or function call/],
	["${now()}", /method or function call/],
	["${empty items}", /empty/],
	["${a ? b : c}", /conditional operator/],
	["${items[0]}", /indexing/],
	["${count % 2}", /remainder/],
	["${count mod 2}", /remainder/],
	["Hello ${name}", /string templating/],
	["plain text", /not a JUEL expression/],
	["${nrOfInstances > 2}", /multi-instance/],
	["${for}", /not a valid FEEL name/],
	["${a$b}", /not a valid FEEL name/],
	["${1e3}", /no exact FEEL form/],
	["${10L}", /no exact FEEL form/],
	["${(a}", /unbalanced/],
	["${'open}", /unterminated/],
	["${}", /empty expression/],
	["${a @ b}", /unexpected character/],
]

describe("translateJuelToFeel", () => {
	for (const [juel, feel] of TRANSLATED) {
		it(`translates ${juel}`, () => {
			expect(translateJuelToFeel(juel)).toEqual({ ok: true, feel })
		})
	}

	for (const [juel, because] of REFUSED) {
		it(`refuses ${juel}`, () => {
			const result = translateJuelToFeel(juel)
			expect(result.ok).toBe(false)
			if (!result.ok) expect(result.reason).toMatch(because)
		})
	}

	it("renames the multi-instance counters inside a completion condition", () => {
		expect(
			translateJuelToFeel("${nrOfCompletedInstances / nrOfInstances >= 0.6}", {
				multiInstance: true,
			}),
		).toEqual({ ok: true, feel: "numberOfCompletedInstances / numberOfInstances >= 0.6" })
		expect(translateJuelToFeel("${nrOfActiveInstances == 0}", { multiInstance: true })).toEqual({
			ok: true,
			feel: "numberOfActiveInstances = 0",
		})
	})

	it("emits FEEL the FEEL parser accepts for every translated row", () => {
		for (const [juel] of TRANSLATED) {
			const result = translateJuelToFeel(juel)
			if (!result.ok) throw new Error(`${juel} did not translate`)
			expect(parseExpression(result.feel).errors, juel).toEqual([])
		}
	})

	it("evaluates to what JUEL evaluates to on non-null operands", () => {
		// Expected values are JUEL's, computed by hand from the EL 2.2 rules.
		const vars: Record<string, FeelValue> = {
			approved: true,
			a: true,
			b: false,
			c: true,
			total: 150,
			x: 4,
			status: "open",
			order: { total: 900, customer: { vip: true } },
		}
		const cases: ReadonlyArray<[juel: string, expected: FeelValue]> = [
			["${approved && order.total <= 1000}", true],
			["${a or b and c}", true],
			["${(a or b) and c}", true],
			["${!(a && b)}", true],
			["${status eq 'open'}", true],
			["${total ge 100 and total lt 200}", true],
			["${order.customer.vip != false}", true],
			["${total + x * 2}", 158],
			["${(total - x) div 2}", 73],
			["${-x + 10}", 6],
		]
		for (const [juel, expected] of cases) {
			const result = translateJuelToFeel(juel)
			if (!result.ok) throw new Error(`${juel} did not translate: ${result.reason}`)
			const { ast } = parseExpression(result.feel)
			if (ast === null) throw new Error(`${result.feel} did not parse`)
			expect(evaluate(ast, { vars }), juel).toEqual(expected)
		}
	})
})
