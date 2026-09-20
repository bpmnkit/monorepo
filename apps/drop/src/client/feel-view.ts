/**
 * How a shared FEEL statement is shown.
 *
 * A dropped diagram renders; a dropped expression has to do the equivalent, or
 * the link is just a paste of text somebody could have sent in chat. So the
 * view is the statement, the variables it reads, and what it evaluates to —
 * computed in the reader's browser by the same `@bpmnkit/feel` the playground
 * and the editor use, rather than a value the uploader typed in by hand.
 *
 * Shared by the share page's viewer and by the composer on `/drop`, so the
 * preview somebody shares is literally the page the recipient opens. The
 * evaluation itself lives in `shared/feel-eval.ts`, which has no DOM.
 */
import { highlightToHtml } from "@bpmnkit/feel"
import type { FeelDocument } from "../shared/feel-doc.js"
import { evaluateFeelDocument } from "../shared/feel-eval.js"

function block(label: string, body: HTMLElement): HTMLElement {
	const wrap = document.createElement("div")
	wrap.className = "feel-block"
	const head = document.createElement("div")
	head.className = "feel-label"
	head.textContent = label
	wrap.append(head, body)
	return wrap
}

/**
 * Draws the whole statement into `container`, replacing what was there.
 *
 * The expression goes through the highlighter, which escapes as it annotates —
 * everything else is `textContent`, because a drop's contents are whatever a
 * stranger uploaded.
 */
export function renderFeelDocument(container: HTMLElement, doc: FeelDocument): void {
	const expr = document.createElement("pre")
	expr.className = "feel-expr"
	expr.innerHTML = highlightToHtml(doc.expression)

	const contextBody = document.createElement("pre")
	contextBody.className = "feel-json"
	const keys = Object.keys(doc.context)
	contextBody.textContent =
		keys.length === 0
			? "{}  — this expression reads no variables"
			: JSON.stringify(doc.context, null, 2)

	const outcome = evaluateFeelDocument(doc)
	const resultBody = document.createElement("pre")
	resultBody.className = outcome.ok ? "feel-result" : "feel-result feel-result--err"
	resultBody.textContent = outcome.ok ? outcome.value : outcome.message

	const split = document.createElement("div")
	split.className = "feel-split"
	split.append(block("Context", contextBody), block(outcome.ok ? "Result" : "Error", resultBody))

	const root = document.createElement("div")
	root.className = "feel-doc"
	root.append(
		block(doc.mode === "unary-tests" ? "Unary tests" : "Expression", expr),
		split,
		note(doc),
	)
	container.replaceChildren(root)
}

/** One line of context about what the reader is looking at. */
function note(doc: FeelDocument): HTMLElement {
	const el = document.createElement("p")
	el.className = "feel-note"
	el.textContent =
		doc.mode === "unary-tests"
			? "Evaluated as a decision-table input entry against ? from the context, in your browser."
			: "Evaluated in your browser by @bpmnkit/feel — nothing is sent anywhere."
	return el
}
