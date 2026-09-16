import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { evaluate } from "../src/evaluator.js"
import { parseExpression } from "../src/parser.js"
import type { FeelContext, FeelValue } from "../src/types.js"

/**
 * Runs the FEEL test cases of the DMN TCK.
 *
 *   pnpm --filter @bpmnkit/feel tck
 *
 * The cases are produced by `tasks/extract-tck-tests.mjs` from a dmn-tck
 * checkout and are not committed, so this suite reports that they are missing
 * rather than failing when the TCK is not on disk.
 *
 * The TCK tests whole decision models, of which this package implements only
 * the expression language, so three groups of cases can never pass here and
 * are counted as failures rather than quietly dropped: decisions whose
 * declared typeRef coerces the result (0082-feel-coercion), decisions that
 * invoke another decision (0092-feel-lambda), and external Java functions
 * (0076-feel-external-java).
 */

interface TckCase {
	id: string
	description: string
	context: string | null
	expression: string
	expected: string
}

interface TckSuite {
	name: string
	testName: string
	cases: TckCase[]
}

const tckDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "tck")

function loadSuites(): TckSuite[] {
	if (!fs.existsSync(tckDir)) return []
	return fs
		.readdirSync(tckDir)
		.filter((f) => f.endsWith(".json"))
		.sort()
		.map((f) => JSON.parse(fs.readFileSync(path.join(tckDir, f), "utf8")) as TckSuite)
}

/** Cases the package does not pass yet, each with the reason it is held back. */
const KNOWN_FAILURES: Record<string, string> = {}

/**
 * DMN specifies decimal arithmetic to 34 significant digits, and this package
 * computes in float64, so results agree to roughly 15. The TCK also writes its
 * expected values at a precision of its own choosing (exp(4) is recorded as
 * 54.59815003). Numbers therefore compare to a relative 1e-9, which is far
 * inside that gap and far outside any real disagreement.
 */
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
		const keys = Object.keys(actual)
		if (keys.length !== Object.keys(expected).length) return false
		return keys.every((key) =>
			matches(
				(actual as Record<string, FeelValue>)[key] ?? null,
				(expected as Record<string, FeelValue>)[key] ?? null,
			),
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

const suites = loadSuites()

describe.skipIf(suites.length === 0)("DMN TCK", () => {
	for (const suite of suites) {
		describe(suite.name, () => {
			for (const tckCase of suite.cases) {
				const key = `${suite.name}/${tckCase.id}`
				const reason = KNOWN_FAILURES[key]
				const label = tckCase.description
					? `${tckCase.id}: ${tckCase.description}`
					: `${tckCase.id}: ${tckCase.expression}`

				it.skipIf(reason !== undefined)(label, () => {
					const vars = tckCase.context ? (evalFeel(tckCase.context) as FeelContext) : {}
					const expected = evalFeel(tckCase.expected)
					const actual = evalFeel(tckCase.expression, vars)
					if (!matches(actual, expected)) expect(actual).toEqual(expected)
				})
			}
		})
	}
})

describe.skipIf(suites.length > 0)("DMN TCK", () => {
	it.skip("not extracted — see tasks/extract-tck-tests.mjs", () => {})
})
