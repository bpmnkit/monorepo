import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { evaluate } from "../src/evaluator.js"
import { parseExpression } from "../src/parser.js"
import type { FeelContext, FeelValue } from "../src/types.js"
import {
	type CamundaCase,
	DEFAULT_CHUNKS_DIR,
	extractCamundaExamples,
} from "../tasks/extract-camunda-examples.mjs"

/**
 * Checks this package against the worked examples of Camunda 8's FEEL
 * documentation, which describe what Zeebe's engine (feel-scala) does —
 * including its extensions to DMN, such as `assert`, `partition` or
 * `context put` with a path.
 *
 * The examples are extracted at run time from @bpmnkit/camunda-docspack, which
 * is in this repository, by `tasks/extract-camunda-examples.mjs`; nothing
 * derived from the documentation (CC BY-SA 3.0) is committed here. Run
 * `node tasks/extract-camunda-examples.mjs --skipped` to see the examples that
 * are not runnable standalone and why.
 *
 * A documented error matches when the evaluation fails to parse, throws, or
 * yields null: following DMN, this package reports an evaluation error as
 * null, where Camunda fails the evaluation. That is a difference in how an
 * error surfaces, not in which expressions are erroneous.
 */

const cases: CamundaCase[] = fs.existsSync(DEFAULT_CHUNKS_DIR) ? extractCamundaExamples().cases : []

/**
 * The documented examples this package does not match, keyed by case id (the
 * expression, plus its binding), with the reason. A case that starts matching
 * fails the last suite in this file until it comes off the list.
 */
const KNOWN_DIFFERENCES: Record<string, string> = {
	// The page's signature is round up(n, scale), as in DMN, and this package
	// holds to it; these examples leave the scale out. Held back until Camunda's
	// engine is confirmed to accept a one-argument call.
	"round up(5.5)": "round up() without a scale",
	"round up(-5.5)": "round up() without a scale",
	// A local date and time names no instant, so this package has none to move
	// into another zone. Camunda reads it on the engine's own clock, and the
	// documented 12:27:30Z holds only where that clock is two hours ahead of UTC.
	'date and time(@"2020-07-31T14:27:30", "Z")':
		"a local date and time depends on the engine's default zone",
}

/** Same tolerance, and for the same reason, as the TCK suite: float64 against decimal. */
const NUMERIC_TOLERANCE = 1e-9

function matches(actual: FeelValue, expected: FeelValue): boolean {
	if (typeof actual === "number" && typeof expected === "number") {
		if (actual === expected) return true
		const scale = Math.max(Math.abs(actual), Math.abs(expected), 1)
		return Math.abs(actual - expected) / scale < NUMERIC_TOLERANCE
	}
	if (Array.isArray(actual) && Array.isArray(expected)) {
		return (
			actual.length === expected.length &&
			actual.every((item, i) => matches(item, expected[i] ?? null))
		)
	}
	if (
		actual !== null &&
		expected !== null &&
		typeof actual === "object" &&
		typeof expected === "object" &&
		!Array.isArray(actual) &&
		!Array.isArray(expected)
	) {
		const a = actual as Record<string, FeelValue | undefined>
		const e = expected as Record<string, FeelValue | undefined>
		// An absent optional field (a time's offset, say) is the same as an undefined one.
		const keys = new Set([...Object.keys(a), ...Object.keys(e)])
		return [...keys].every((key) =>
			a[key] === undefined || e[key] === undefined
				? a[key] === e[key]
				: matches(a[key] ?? null, e[key] ?? null),
		)
	}
	return Object.is(actual, expected)
}

function evalFeel(expression: string, vars: FeelContext = {}): FeelValue {
	const { ast, errors } = parseExpression(expression, { names: Object.keys(vars) })
	if (!ast || errors.length > 0) {
		throw new Error(`cannot parse ${JSON.stringify(expression)}: ${errors[0]?.message}`)
	}
	return evaluate(ast, { vars })
}

/** Whether the case matches its documented result; throws with the detail when it does not. */
function check(c: CamundaCase): void {
	const vars = c.context ? (evalFeel(c.context) as FeelContext) : {}
	if (c.error) {
		let actual: FeelValue
		try {
			actual = evalFeel(c.expression, vars)
		} catch {
			return
		}
		if (actual !== null) {
			throw new Error(`expected an error (null), got ${JSON.stringify(actual)}`)
		}
		return
	}
	const expected = evalFeel(c.expected ?? "null")
	const actual = evalFeel(c.expression, vars)
	if (!matches(actual, expected)) expect(actual).toEqual(expected)
}

describe.skipIf(cases.length === 0)("Camunda FEEL documentation examples", () => {
	for (const c of cases) {
		const reason = KNOWN_DIFFERENCES[c.id]
		const label = `${c.id} => ${c.error ? "error" : c.expected}`
		it.skipIf(reason !== undefined)(label, () => check(c))
	}
})

describe.skipIf(cases.length > 0)("Camunda FEEL documentation examples", () => {
	it.skip("no @bpmnkit/camunda-docspack chunks on disk", () => {})
})

describe.skipIf(cases.length === 0)("Camunda FEEL known differences", () => {
	it("are all still different", () => {
		const fixed: string[] = []
		for (const c of cases) {
			if (KNOWN_DIFFERENCES[c.id] === undefined) continue
			try {
				check(c)
				fixed.push(c.id)
			} catch {
				// still different, which is what the list says
			}
		}
		expect(fixed, "these now match and should come off KNOWN_DIFFERENCES").toEqual([])
	})
})
