/**
 * Editing a shared FEEL statement, on the page that shows it.
 *
 * The usual reason to open somebody else's expression is to try it with your
 * own numbers — change the amount, see whether the gateway still goes the way
 * they said it does. That must not touch their link. So this is the composer's
 * two boxes, opened on what the drop currently says, evaluating locally on
 * every keystroke, and **nothing leaves the browser until Save is pressed**.
 *
 * Which is also why a drop that cannot be written to still opens here: only
 * Save is refused, and *Share as new* is the way out for the copy you made
 * while playing with it.
 *
 * The saving itself belongs to the page, not to this module — it is the page
 * that has the socket, the challenge dialog and the notice bar — so it arrives
 * as a callback and the outcome comes back as a resolved or rejected promise.
 */
import { type FeelDocument, type FeelMode, composeFeelDocument } from "../shared/feel-doc.js"
import { evaluateFeelDocument } from "../shared/feel-eval.js"

export interface FeelEditorOptions {
	container: HTMLElement
	/** The statement as the drop currently has it. */
	doc: FeelDocument
	filename: string
	/** Why this drop cannot be saved to, or null when it can. */
	readOnly: string | null
	/** Writes the statement to the drop. Rejects with a message worth showing. */
	save(doc: FeelDocument): Promise<void>
	/** Posts the statement as a new drop of its own, and goes there. */
	shareCopy(doc: FeelDocument): Promise<void>
}

export interface FeelEditor {
	/** True when the boxes no longer say what the drop says. */
	dirty(): boolean
	destroy(): void
}

function labelled(text: string, body: HTMLElement): HTMLElement {
	const wrap = document.createElement("div")
	const label = document.createElement("div")
	label.className = "feel-label"
	label.textContent = text
	wrap.append(label, body)
	return wrap
}

function button(text: string, className = "hv-btn"): HTMLButtonElement {
	const el = document.createElement("button")
	el.type = "button"
	el.className = className
	el.textContent = text
	return el
}

function area(rows: number, className?: string): HTMLTextAreaElement {
	const el = document.createElement("textarea")
	el.rows = rows
	el.spellcheck = false
	el.autocapitalize = "off"
	el.setAttribute("autocomplete", "off")
	el.setAttribute("autocorrect", "off")
	if (className) el.className = className
	return el
}

export function mountFeelEditor(options: FeelEditorOptions): FeelEditor {
	/** What the drop says — the baseline both "dirty" and Reset are measured against. */
	let saved = options.doc
	let mode: FeelMode = options.doc.mode

	const expr = area(8)
	expr.value = options.doc.expression
	expr.setAttribute("aria-label", "FEEL expression")
	const context = area(8)
	context.value = JSON.stringify(options.doc.context, null, 2)
	context.setAttribute("aria-label", "Context")

	const result = document.createElement("pre")
	result.className = "feel-result"

	const modes: Array<[FeelMode, HTMLButtonElement]> = [
		["expression", button("Expression", "")],
		["unary-tests", button("Unary tests", "")],
	]
	const modeBar = document.createElement("div")
	modeBar.className = "fc-modes"
	modeBar.append(...modes.map(([, el]) => el))

	const bar = document.createElement("div")
	bar.className = "panel-bar"
	const name = document.createElement("span")
	name.className = "grow"
	name.textContent = options.filename
	bar.append(name, modeBar)

	const main = document.createElement("div")
	main.className = "fc-main"
	main.append(bar, expr)

	const side = document.createElement("div")
	side.className = "fc-side"
	side.append(labelled("Context — JSON the expression reads", context), labelled("Result", result))

	const panel = document.createElement("div")
	panel.className = "fc"
	panel.append(main, side)

	const saveBtn = button("Save to this drop", "hv-btn hv-btn--go")
	const copyBtn = button("Share as new")
	const resetBtn = button("Reset")
	const status = document.createElement("span")
	status.className = "fe-status"

	const actions = document.createElement("div")
	actions.className = "fe-actions"
	actions.append(saveBtn, copyBtn, resetBtn, status)

	const root = document.createElement("div")
	root.className = "feel-doc"
	root.append(panel, actions)
	options.container.replaceChildren(root)

	/** The document the boxes describe, or why they do not describe one. */
	const read = () => composeFeelDocument(expr.value, context.value, mode)

	/**
	 * Whether the boxes say something other than the drop does.
	 *
	 * Compared as documents rather than as text: the context box is JSON the
	 * writer may have reformatted, and a save that only reindented it would
	 * store the same statement. Text that does not compose counts as changed —
	 * there is something in there that is not what the drop says.
	 */
	function dirty(): boolean {
		const state = read()
		if (!state.ok) return true
		return (
			state.doc.expression !== saved.expression ||
			state.doc.mode !== saved.mode ||
			JSON.stringify(state.doc.context) !== JSON.stringify(saved.context)
		)
	}

	function say(text: string, isError = false): void {
		status.textContent = text
		status.className = isError ? "fe-status fe-status--err" : "fe-status"
	}

	/** Re-evaluates, repaints the preview, and settles what the buttons allow. */
	function run(): void {
		const state = read()
		const outcome = state.ok ? evaluateFeelDocument(state.doc) : null
		if (!state.ok) {
			result.textContent = state.message
		} else if (outcome) {
			result.textContent = outcome.ok ? outcome.value : outcome.message
		}
		result.className = state.ok && outcome?.ok ? "feel-result" : "feel-result feel-result--err"

		const runnable = state.ok && outcome?.ok === true
		saveBtn.disabled = !runnable || !dirty() || options.readOnly !== null
		saveBtn.title = options.readOnly ?? ""
		copyBtn.disabled = !runnable
		resetBtn.disabled = !dirty()
	}

	function setMode(next: FeelMode): void {
		mode = next
		for (const [value, el] of modes) {
			const active = value === next
			el.classList.toggle("active", active)
			el.setAttribute("aria-pressed", String(active))
		}
		context.placeholder = next === "expression" ? "{}" : '{ "?": 30 }'
		run()
	}

	function open(doc: FeelDocument): void {
		expr.value = doc.expression
		context.value = JSON.stringify(doc.context, null, 2)
		setMode(doc.mode)
	}

	async function busy<T>(el: HTMLButtonElement, work: () => Promise<T>): Promise<T | null> {
		el.disabled = true
		try {
			return await work()
		} catch (error) {
			say(error instanceof Error ? error.message : "That did not go through.", true)
			return null
		} finally {
			run()
		}
	}

	saveBtn.addEventListener("click", () => {
		const state = read()
		if (!state.ok) return
		say("Saving…")
		void busy(saveBtn, async () => {
			await options.save(state.doc)
			saved = state.doc
			say("Saved — this is what the link shows now.")
		})
	})

	copyBtn.addEventListener("click", () => {
		const state = read()
		if (!state.ok) return
		say("Making a copy…")
		void busy(copyBtn, () => options.shareCopy(state.doc))
	})

	resetBtn.addEventListener("click", () => {
		open(saved)
		say(baseline())
	})

	const onInput = () => {
		run()
		say(dirty() ? "Unsaved — your changes are in this browser only." : baseline())
	}
	expr.addEventListener("input", onInput)
	context.addEventListener("input", onInput)
	for (const [value, el] of modes) {
		el.addEventListener("click", () => {
			setMode(value)
			say(dirty() ? "Unsaved — your changes are in this browser only." : baseline())
		})
	}

	/** What the status line says when the boxes agree with the drop. */
	function baseline(): string {
		return options.readOnly ?? "Try your own values — nothing is sent until you save."
	}

	setMode(mode)
	say(baseline())

	return {
		dirty,
		destroy(): void {
			root.remove()
		},
	}
}
