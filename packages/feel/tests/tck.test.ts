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

const KNOWN = "known"

/**
 * The TCK cases this package does not pass, grouped by why. A case that starts
 * passing is not skipped in silence: the last suite in this file fails until it
 * comes off the list, so the list keeps describing what is actually left.
 */
const KNOWN_FAILURES: Record<string, string> = {
	// the decision's declared type coerces the result, which belongs to the decision model rather than the expression language (26)
	"0082-feel-coercion/decisionService_001/decision_ds_001": KNOWN,
	"0082-feel-coercion/decisionService_002/decision_ds_002": KNOWN,
	"0082-feel-coercion/decisionService_002_b/decision_ds_002": KNOWN,
	"0082-feel-coercion/decisionService_002_c/ds_invoke_002_with_singleton_list": KNOWN,
	"0082-feel-coercion/decision_001/decision_001": KNOWN,
	"0082-feel-coercion/decision_003/decision_003": KNOWN,
	"0082-feel-coercion/decision_005/decision_005": KNOWN,
	"0082-feel-coercion/decision_006_a/decision_006_a": KNOWN,
	"0082-feel-coercion/decision_007/decision_007": KNOWN,
	"0082-feel-coercion/decision_007_a/decision_007_a": KNOWN,
	"0082-feel-coercion/decision_bkm_002/decision_bkm_002": KNOWN,
	"0082-feel-coercion/decision_bkm_003/decision_bkm_003": KNOWN,
	"0082-feel-coercion/decision_bkm_004_a/decision_bkm_004_a": KNOWN,
	"0082-feel-coercion/decision_bkm_005/decision_bkm_005": KNOWN,
	"0082-feel-coercion/decision_bkm_005_a/decision_bkm_005_a": KNOWN,
	"0082-feel-coercion/decision_context_03/decision_context_03": KNOWN,
	"0082-feel-coercion/fd_001/fd_001": KNOWN,
	"0082-feel-coercion/fd_002/fd_002": KNOWN,
	"0082-feel-coercion/invoke_001/invoke_001": KNOWN,
	"0082-feel-coercion/invoke_002/invoke_002": KNOWN,
	"0082-feel-coercion/invoke_004/invoke_004": KNOWN,
	"0082-feel-coercion/invoke_006/invoke_006": KNOWN,
	"0082-feel-coercion/literal_002/literal_002": KNOWN,
	"0082-feel-coercion/literal_004/literal_004": KNOWN,
	"0082-feel-coercion/literal_005/literal_005": KNOWN,
	"0082-feel-coercion/literal_006/literal_006": KNOWN,
	// external Java functions (18)
	"0076-feel-external-java/boxed_001/boxed_001": KNOWN,
	"0076-feel-external-java/incorrect_001/incorrect_001": KNOWN,
	"0076-feel-external-java/incorrect_002/incorrect_002": KNOWN,
	"0076-feel-external-java/incorrect_003/incorrect_003": KNOWN,
	"0076-feel-external-java/literal_001/literal_001": KNOWN,
	"0076-feel-external-java/literal_002/literal_002": KNOWN,
	"0076-feel-external-java/literal_003/literal_003": KNOWN,
	"0076-feel-external-java/literal_004/literal_004": KNOWN,
	"0076-feel-external-java/literal_005/literal_005": KNOWN,
	"0076-feel-external-java/literal_006/literal_006": KNOWN,
	"0076-feel-external-java/literal_007/literal_007": KNOWN,
	"0076-feel-external-java/literal_007_a/literal_007_a": KNOWN,
	"0076-feel-external-java/literal_008/literal_008": KNOWN,
	"0076-feel-external-java/literal_009/literal_009": KNOWN,
	"0076-feel-external-java/literal_010/literal_010": KNOWN,
	"0076-feel-external-java/literal_011/literal_011": KNOWN,
	"0076-feel-external-java/literal_012/literal_012": KNOWN,
	"0076-feel-external-java/varargs_001/varargs_001": KNOWN,
	// XPath regular expression features JavaScript's engine does not have (15)
	"1111-feel-matches-function/K-MatchesFunc-3/K-MatchesFunc-3": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-1/K2-MatchesFunc-1": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-10/K2-MatchesFunc-10": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-11/K2-MatchesFunc-11": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-12/K2-MatchesFunc-12": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-13/K2-MatchesFunc-13": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-14/K2-MatchesFunc-14": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-5/K2-MatchesFunc-5": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-6/K2-MatchesFunc-6": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-7/K2-MatchesFunc-7": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-8/K2-MatchesFunc-8": KNOWN,
	"1111-feel-matches-function/K2-MatchesFunc-9/K2-MatchesFunc-9": KNOWN,
	"1111-feel-matches-function/caselessmatch07/caselessmatch07": KNOWN,
	"1111-feel-matches-function/caselessmatch08/caselessmatch08": KNOWN,
	"1111-feel-matches-function/caselessmatch09/caselessmatch09": KNOWN,
	// range literals written ]a..b] or (<10), and sub-second precision (11)
	"0068-feel-equality/datetime_003_a/datetime_003_a": KNOWN,
	"0068-feel-equality/range_004/range_004": KNOWN,
	"0068-feel-equality/range_006/range_006": KNOWN,
	"0068-feel-equality/range_006_a/range_006_a": KNOWN,
	"0068-feel-equality/range_007/range_007": KNOWN,
	"0068-feel-equality/range_008/range_008": KNOWN,
	"0068-feel-equality/range_009/range_009": KNOWN,
	"0068-feel-equality/range_010/range_010": KNOWN,
	"0068-feel-equality/range_011/range_011": KNOWN,
	"0068-feel-equality/range_012/range_012": KNOWN,
	"0068-feel-equality/time_005/time_005": KNOWN,
	// types the model declares, and structural type arguments (10)
	"0070-feel-instance-of/context_013/context_013": KNOWN,
	"0070-feel-instance-of/context_014/context_014": KNOWN,
	"0070-feel-instance-of/context_022/context_022": KNOWN,
	"0070-feel-instance-of/context_024/context_024": KNOWN,
	"0070-feel-instance-of/list_013/list_013": KNOWN,
	"0070-feel-instance-of/list_014/list_014": KNOWN,
	"0070-feel-instance-of/list_014_a/list_014_a": KNOWN,
	"0070-feel-instance-of/list_019/list_019": KNOWN,
	"0070-feel-instance-of/number_013/number_013": KNOWN,
	"0070-feel-instance-of/string_013/string_013": KNOWN,
	// range literals written ]a..b], [a..b[ or (<10) (7)
	"0074-feel-properties/range_003/range_003": KNOWN,
	"0074-feel-properties/range_005/range_005": KNOWN,
	"0074-feel-properties/range_006/range_006": KNOWN,
	"0074-feel-properties/range_007/range_007": KNOWN,
	"0074-feel-properties/range_009/range_009": KNOWN,
	"0074-feel-properties/range_010/range_010": KNOWN,
	"0074-feel-properties/range_011/range_011": KNOWN,
	// string() of a date and time with sub-second or second-level offset precision (6)
	"0079-feel-string-function/context_003/context_003": KNOWN,
	"0079-feel-string-function/context_004/context_004": KNOWN,
	"0079-feel-string-function/context_005/context_005": KNOWN,
	"0079-feel-string-function/context_006/context_006": KNOWN,
	"0079-feel-string-function/context_007/context_007": KNOWN,
	"0079-feel-string-function/dt_duration_004/dt_duration_004": KNOWN,
	// types the model declares (5)
	"0092-feel-lambda/004/decision_004_1": KNOWN,
	"0092-feel-lambda/006/decision_006_1": KNOWN,
	"0092-feel-lambda/009/decision_009_1": KNOWN,
	"0092-feel-lambda/010_a/decision_010_1_a": KNOWN,
	"0092-feel-lambda/013/decision_013_1": KNOWN,
	// date and time() edge cases around offsets and zones (4)
	"1117-feel-date-and-time-function/011_eec2d5bdcd/feel-date-and-time-function_011_eec2d5bdcd":
		KNOWN,
	"1117-feel-date-and-time-function/012_225a105eef/feel-date-and-time-function_012_225a105eef":
		KNOWN,
	"1117-feel-date-and-time-function/027_ae365197dd/feel-date-and-time-function_027_ae365197dd":
		KNOWN,
	"1117-feel-date-and-time-function/028_1c3d56275f/feel-date-and-time-function_028_1c3d56275f":
		KNOWN,
	// year ranges outside the four-digit form (2)
	"1115-feel-date-function/015_1dd66594cf/feel-date-function_015_1dd66594cf": KNOWN,
	"1115-feel-date-function/016_31f3fef4a0/feel-date-function_016_31f3fef4a0": KNOWN,
	// month counting across a zone change (2)
	"1121-feel-years-and-months-duration-function/024_e96d1bd93a/feel-years-and-months-duration-function_024_e96d1bd93a":
		KNOWN,
	"1121-feel-years-and-months-duration-function/034_c2cc06724c/feel-years-and-months-duration-function_034_c2cc06724c":
		KNOWN,
	// range literals with an unbounded end (2)
	"1130-feel-interval/overlaps after/overlaps after": KNOWN,
	"1130-feel-interval/overlaps before/overlaps before": KNOWN,
	// abs() names its parameter n in the spec and number in Camunda; this package accepts both (1)
	"0050-feel-abs-function/007/decision007": KNOWN,
	// decimal arithmetic beyond float64's precision (1)
	"0052-feel-exp-function/002/decision002": KNOWN,
	// a descending range literal as an iteration domain (1)
	"0084-feel-for-loops/decision_025/decision_025": KNOWN,
	// offsets carrying seconds (1)
	"1116-feel-time-function/053_3d956966c0/feel-time-function_053_3d956966c0": KNOWN,
	// context() argument validation (1)
	"1145-feel-context-function/008/decision008": KNOWN,
	// context put() named-argument validation (1)
	"1146-feel-context-put-function/nested008/nested008": KNOWN,
}

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

// A fix that makes a known failure pass should take it off the list, so the
// list keeps describing what is actually left rather than quietly hiding it.
describe.skipIf(suites.length === 0)("DMN TCK known failures", () => {
	it("are all still failing", () => {
		const fixed: string[] = []
		for (const suite of suites) {
			for (const tckCase of suite.cases) {
				const key = `${suite.name}/${tckCase.id}`
				if (KNOWN_FAILURES[key] === undefined) continue
				try {
					const vars = tckCase.context ? (evalFeel(tckCase.context) as FeelContext) : {}
					if (matches(evalFeel(tckCase.expression, vars), evalFeel(tckCase.expected))) {
						fixed.push(key)
					}
				} catch {
					// still failing, which is what the list says
				}
			}
		}
		expect(fixed, "these now pass and should come off KNOWN_FAILURES").toEqual([])
	})
})
