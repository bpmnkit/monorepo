/**
 * Running a shared FEEL statement against its own context.
 *
 * Kept apart from the view because it is the part with an answer: the share
 * page, the composer's live preview and the tests all need the value, and only
 * one of the three has a DOM. No DOM and no Worker APIs, like everything in
 * `shared/`.
 */
import { evaluate, evaluateUnaryTests, parseExpression, parseUnaryTests } from "@bpmnkit/feel"
import type { FeelValue } from "@bpmnkit/feel"
import { type FeelDocument, unaryInput } from "./feel-doc.js"

/** The outcome of running a statement: a rendered value, or something to fix. */
export type FeelOutcome = { ok: true; value: string } | { ok: false; message: string }

/** How a value is written out — the same shapes the playground and the editor show. */
export function renderFeelValue(value: FeelValue): string {
	if (value === null) return "null"
	if (typeof value === "string") return `"${value}"`
	if (typeof value === "boolean" || typeof value === "number") return String(value)
	return JSON.stringify(value, null, 2)
}

/** Parses and evaluates a document against its own context. Never throws. */
export function evaluateFeelDocument(doc: FeelDocument): FeelOutcome {
	const vars = doc.context as Record<string, FeelValue>
	if (doc.mode === "expression") {
		const { ast, errors } = parseExpression(doc.expression)
		if (errors.length > 0 || !ast) {
			return { ok: false, message: errors.map((e) => e.message).join("; ") || "Could not parse." }
		}
		try {
			return { ok: true, value: renderFeelValue(evaluate(ast, { vars })) }
		} catch (e) {
			return { ok: false, message: e instanceof Error ? e.message : String(e) }
		}
	}

	// Unary tests are what a decision-table input entry holds, so the value under
	// test is whatever the context bound to `?`.
	const input = unaryInput(doc)
	const { ast, errors } = parseUnaryTests(doc.expression)
	if (errors.length > 0 || !ast) {
		return { ok: false, message: errors.map((e) => e.message).join("; ") || "Could not parse." }
	}
	try {
		return { ok: true, value: renderFeelValue(evaluateUnaryTests(ast, input, { vars, input })) }
	} catch (e) {
		return { ok: false, message: e instanceof Error ? e.message : String(e) }
	}
}
