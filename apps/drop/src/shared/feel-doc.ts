/**
 * The shape of a shared FEEL statement, and how text becomes one.
 *
 * A FEEL expression on its own is rarely enough to read: `order.amount * (1 +
 * vat)` says nothing until you know what `order` and `vat` were. So what a drop
 * stores is the expression *and* the context it was written against — the same
 * two boxes the FEEL playground has — and the viewer evaluates them together.
 *
 * Two input spellings are accepted, and both end up as the same document:
 *
 * - a plain `.feel` file, which is the expression and nothing else; and
 * - a JSON document `{ expression, context?, mode? }`, which is what the
 *   playground's "Share" button and the composer on `/drop` post.
 *
 * No DOM and no Worker APIs: the Worker validates uploads with this, and the
 * browser bundles use the same code so a rejection happens before the upload
 * rather than after it.
 */
import { type FeelContext, type FeelValue, parseExpression, parseUnaryTests } from "@bpmnkit/feel"

/** How the expression is read: a value expression, or a decision-table input entry. */
export type FeelMode = "expression" | "unary-tests"

/** A shared FEEL statement: what to evaluate, and what it may read. */
export interface FeelDocument {
	expression: string
	/** The variables in scope. `?` is the value under test in `unary-tests` mode. */
	context: FeelContext
	mode: FeelMode
}

/** Longest expression a drop will carry — a statement, not a program. */
export const MAX_FEEL_EXPRESSION_CHARS = 10_000

/** Thrown when text cannot become a {@link FeelDocument}. The message is for the writer. */
export class FeelDocumentError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "FeelDocumentError"
	}
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** The canonical on-disk form: stable key order, so the same statement hashes the same. */
export function serializeFeelDocument(doc: FeelDocument): string {
	return `${JSON.stringify({ expression: doc.expression, context: doc.context, mode: doc.mode }, null, 2)}\n`
}

/**
 * Turns uploaded text into a document, or explains why it cannot.
 *
 * The expression is parsed here rather than only when it is displayed: a drop
 * that does not parse is a link that renders an error, and refusing it at the
 * upload is the same gate every other kind passes through.
 */
export function parseFeelDocument(text: string): FeelDocument {
	const trimmed = text.trim()
	if (trimmed === "") throw new FeelDocumentError("the FEEL expression is empty")

	let expression = trimmed
	let context: FeelContext = {}
	let mode: FeelMode = "expression"

	// A leading `{` is ambiguous — it opens both a JSON document and a FEEL
	// context literal — so a parse failure falls through to "it is an expression"
	// rather than becoming an error about JSON the writer never wrote.
	if (trimmed.startsWith("{")) {
		let parsed: unknown
		try {
			parsed = JSON.parse(trimmed)
		} catch {
			parsed = undefined
		}
		if (isPlainObject(parsed) && "expression" in parsed) {
			if (typeof parsed.expression !== "string") {
				throw new FeelDocumentError('"expression" must be a string')
			}
			expression = parsed.expression.trim()
			if (expression === "") throw new FeelDocumentError("the FEEL expression is empty")

			if (parsed.context !== undefined) {
				if (!isPlainObject(parsed.context)) {
					throw new FeelDocumentError('"context" must be a JSON object of variables')
				}
				context = parsed.context as FeelContext
			}
			if (parsed.mode !== undefined) {
				if (parsed.mode !== "expression" && parsed.mode !== "unary-tests") {
					throw new FeelDocumentError('"mode" must be "expression" or "unary-tests"')
				}
				mode = parsed.mode
			}
		}
	}

	if (expression.length > MAX_FEEL_EXPRESSION_CHARS) {
		throw new FeelDocumentError(
			`the expression exceeds the ${MAX_FEEL_EXPRESSION_CHARS}-character limit`,
		)
	}

	const { errors } =
		mode === "expression" ? parseExpression(expression) : parseUnaryTests(expression)
	if (errors.length > 0) {
		throw new FeelDocumentError(errors.map((e) => e.message).join("; "))
	}

	return { expression, context, mode }
}

/**
 * A label for the tab strip: the first line of the expression, shortened.
 *
 * The expression *is* the name — a FEEL statement has no id to fall back on —
 * so this is the one place the content doubles as its own title.
 */
export function feelLabel(doc: FeelDocument): string {
	const firstLine = doc.expression.split("\n")[0]?.trim() ?? ""
	return firstLine.length > 48 ? `${firstLine.slice(0, 47)}…` : firstLine
}

/** The value a unary test runs against: whatever the context bound to `?`. */
export function unaryInput(doc: FeelDocument): FeelValue {
	return doc.context["?"] ?? null
}

/**
 * Two boxes of text as a document, or the reason they are not one yet.
 *
 * The composer on `/drop` and the editor on a share page have the same pair of
 * boxes and the same job: the context is JSON while the expression is FEEL, and
 * a failure has to name which half is wrong — the expression is usually fine and
 * the writer is looking at the other side of the panel.
 *
 * Shape only. Whether the expression *parses* is `parseExpression`'s answer and
 * whether it *runs* is the evaluator's, and both are shown live beside the box
 * rather than being raised here.
 */
export function composeFeelDocument(
	expression: string,
	contextText: string,
	mode: FeelMode,
): { ok: true; doc: FeelDocument } | { ok: false; message: string } {
	const text = expression.trim()
	if (text === "") return { ok: false, message: "Write an expression." }

	const raw = contextText.trim()
	let parsed: unknown = {}
	if (raw !== "") {
		try {
			parsed = JSON.parse(raw)
		} catch {
			return { ok: false, message: "The context is not valid JSON." }
		}
	}
	if (!isPlainObject(parsed)) {
		return { ok: false, message: "The context must be a JSON object of variables." }
	}
	return { ok: true, doc: { expression: text, context: parsed as FeelContext, mode } }
}
