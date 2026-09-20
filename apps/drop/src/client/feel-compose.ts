/**
 * The FEEL composer on `/drop`: write a statement, watch it evaluate, share it.
 *
 * Dropping a file assumes you have one. A FEEL expression is usually something
 * you are in the middle of writing — in a gateway condition, in a decision
 * table, in a message to a colleague who cannot see your screen — so this is
 * the drop zone for people who have text rather than a file.
 *
 * It posts to the same endpoint the drop zone posts to, as a `.feel` file, so a
 * composed statement clears exactly the gate an uploaded one does: same parser,
 * same caps, same Terms acknowledgment, same short link at the end.
 */
import type { FeelContext } from "@bpmnkit/feel"
import type { FeelDocument, FeelMode } from "../shared/feel-doc.js"
import { evaluateFeelDocument } from "../shared/feel-eval.js"

interface Example {
	readonly label: string
	readonly expression: string
	readonly context: string
	readonly mode: FeelMode
}

// Three, not seven: this is a starting point for sharing your own expression,
// not the playground's tour of the language — that lives on bpmnkit.com.
const EXAMPLES: readonly Example[] = [
	{
		label: "Order total",
		expression: "order.amount * (1 + vat)",
		context: '{\n  "order": { "amount": 100 },\n  "vat": 0.19\n}',
		mode: "expression",
	},
	{
		label: "Gateway condition",
		expression: 'if amount > 1000 then "manual review" else "auto approve"',
		context: '{\n  "amount": 2500\n}',
		mode: "expression",
	},
	{
		label: "Decision-table entry",
		expression: "[18..65]",
		context: '{\n  "?": 30\n}',
		mode: "unary-tests",
	},
]

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null

export function mountFeelComposer(): void {
	const expr = $<HTMLTextAreaElement>("feelExpr")
	const context = $<HTMLTextAreaElement>("feelContext")
	const result = $("feelResult")
	const shareBtn = $<HTMLButtonElement>("feelShare")
	const out = $("feelOut")
	const url = $<HTMLInputElement>("feelUrl")
	const open = $<HTMLAnchorElement>("feelOpen")
	const copy = $<HTMLButtonElement>("feelCopy")
	const errors = $("feelErrors")
	const examples = $("feelExamples")
	if (!expr || !context || !result || !shareBtn || !out || !url || !open || !copy || !errors) return

	const modeButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-fc-mode]")]
	let mode: FeelMode = "expression"

	/** The document as the boxes currently stand, or the reason it is not one yet. */
	function read(): { ok: true; doc: FeelDocument } | { ok: false; message: string } {
		const text = expr?.value.trim() ?? ""
		if (text === "") return { ok: false, message: "Write an expression to share." }
		const raw = context?.value.trim() ?? ""
		let parsed: unknown = {}
		if (raw !== "") {
			try {
				parsed = JSON.parse(raw)
			} catch {
				// Naming the offending box matters: the expression is usually fine
				// and the reader is looking at the wrong half of the panel.
				return { ok: false, message: "The context is not valid JSON." }
			}
		}
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			return { ok: false, message: "The context must be a JSON object of variables." }
		}
		return { ok: true, doc: { expression: text, context: parsed as FeelContext, mode } }
	}

	function run(): void {
		if (!result) return
		const state = read()
		if (!state.ok) {
			result.textContent = state.message
			result.className = "feel-result feel-result--err"
			return
		}
		const outcome = evaluateFeelDocument(state.doc)
		result.textContent = outcome.ok ? outcome.value : outcome.message
		result.className = outcome.ok ? "feel-result" : "feel-result feel-result--err"
	}

	function setMode(next: FeelMode): void {
		mode = next
		for (const button of modeButtons) {
			const active = button.dataset.fcMode === next
			button.classList.toggle("active", active)
			button.setAttribute("aria-pressed", String(active))
		}
		if (context) context.placeholder = next === "expression" ? "{}" : '{ "?": 30 }'
		run()
	}

	function showError(message: string): void {
		if (!errors) return
		errors.textContent = message
		errors.classList.remove("hidden")
	}

	async function share(): Promise<void> {
		if (!errors || !out || !url || !open || !shareBtn) return
		errors.classList.add("hidden")
		const state = read()
		if (!state.ok) return showError(state.message)

		const outcome = evaluateFeelDocument(state.doc)
		if (!outcome.ok) return showError(`That expression does not run: ${outcome.message}`)

		const body = new FormData()
		const file = new File([JSON.stringify(state.doc, null, 2)], "expression.feel", {
			type: "application/json",
		})
		body.append("files", file, file.name)

		shareBtn.disabled = true
		try {
			const res = await fetch("/drop/api/drops", { method: "POST", body })
			const payload = (await res.json()) as { url?: string; error?: string; details?: string[] }
			if (!res.ok || !payload.url) {
				return showError(payload.details?.join("\n") ?? payload.error ?? "Sharing failed.")
			}
			url.value = new URL(payload.url, location.origin).href
			open.href = payload.url
			out.classList.remove("hidden")
		} catch {
			showError("Network error — please try again.")
		} finally {
			shareBtn.disabled = false
		}
	}

	expr.addEventListener("input", run)
	context.addEventListener("input", run)
	for (const button of modeButtons) {
		button.addEventListener("click", () => {
			const next = button.dataset.fcMode
			if (next === "expression" || next === "unary-tests") setMode(next)
		})
	}
	shareBtn.addEventListener("click", () => void share())
	copy.addEventListener("click", async () => {
		await navigator.clipboard.writeText(url.value)
		copy.textContent = "Copied"
		setTimeout(() => {
			copy.textContent = "Copy"
		}, 1500)
	})

	if (examples) {
		for (const example of EXAMPLES) {
			const button = document.createElement("button")
			button.type = "button"
			button.textContent = example.label
			button.addEventListener("click", () => {
				expr.value = example.expression
				context.value = example.context
				setMode(example.mode)
			})
			examples.append(button)
		}
	}

	const first = EXAMPLES[0]
	if (first) {
		expr.value = first.expression
		context.value = first.context
		setMode(first.mode)
	}
}
