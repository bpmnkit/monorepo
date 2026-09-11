import { injectChromeStyles } from "@bpmnkit/editor"

const STYLE_ID = "stor-dialog-styles"

function injectStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	/* Flat, square, hairline-ruled; grounds come from the shared chrome tokens,
	   so this is one set of rules rather than a dark one plus a light copy. */
	style.textContent = `
.stor-dialog-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: var(--bpmnkit-chrome-scrim);
  display: flex; align-items: center; justify-content: center;
}
.stor-dialog {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 24px 26px;
  min-width: 320px; max-width: 90vw;
  color: var(--bpmnkit-chrome-ink-2);
  font-family: var(--bpmnkit-chrome-font);
  display: flex; flex-direction: column; gap: 14px;
}
.stor-dialog-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
}
.stor-dialog-msg {
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  color: var(--bpmnkit-chrome-ink-2); line-height: 1.5;
}
.stor-dialog-input {
  width: 100%; padding: 7px 9px;
  background: transparent;
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-family: var(--bpmnkit-chrome-mono); font-size: 12.5px;
  outline: none;
  box-sizing: border-box;
}
.stor-dialog-input:focus { border-color: var(--bpmnkit-chrome-accent); }
.stor-dialog-actions { display: flex; gap: 10px; justify-content: flex-end; }
.stor-dialog-btn {
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px; padding: 7px 16px;
  cursor: pointer;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
}
.stor-dialog-btn:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.stor-dialog-btn--primary {
  background: var(--bpmnkit-chrome-accent);
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
}
.stor-dialog-btn--primary:hover {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
  border-color: var(--bpmnkit-ds-accent-hover, #8f412e);
  color: var(--bpmnkit-chrome-accent-fg);
}
/* Destructive is semantic state, exempt from the one-accent rule. */
.stor-dialog-btn--danger {
  background: var(--bpmnkit-danger, #dc2626);
  border-color: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-chrome-accent-fg);
}
.stor-dialog-btn--danger:hover { background: var(--bpmnkit-danger, #dc2626); color: var(--bpmnkit-chrome-accent-fg); }
`
	document.head.appendChild(style)
}

/** Shows a modal input dialog. Returns the trimmed value or null if cancelled. */
export function showInputDialog(opts: {
	title: string
	defaultValue?: string
	placeholder?: string
	confirmLabel?: string
}): Promise<string | null> {
	return new Promise((resolve) => {
		injectStyles()

		const overlay = document.createElement("div")
		overlay.className = "stor-dialog-overlay"

		const dialog = document.createElement("div")
		dialog.className = "stor-dialog"

		const titleEl = document.createElement("div")
		titleEl.className = "stor-dialog-title"
		titleEl.textContent = opts.title

		const input = document.createElement("input")
		input.type = "text"
		input.className = "stor-dialog-input"
		input.value = opts.defaultValue ?? ""
		if (opts.placeholder) input.placeholder = opts.placeholder

		const actions = document.createElement("div")
		actions.className = "stor-dialog-actions"

		const cancelBtn = document.createElement("button")
		cancelBtn.className = "stor-dialog-btn"
		cancelBtn.textContent = "Cancel"

		const confirmBtn = document.createElement("button")
		confirmBtn.className = "stor-dialog-btn stor-dialog-btn--primary"
		confirmBtn.textContent = opts.confirmLabel ?? "OK"

		function close(value: string | null): void {
			overlay.remove()
			document.removeEventListener("keydown", handleKey)
			resolve(value)
		}

		cancelBtn.addEventListener("click", () => close(null))
		confirmBtn.addEventListener("click", () => close(input.value.trim() || null))

		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") close(null)
			else if (e.key === "Enter") close(input.value.trim() || null)
		}
		document.addEventListener("keydown", handleKey)

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close(null)
		})

		actions.append(cancelBtn, confirmBtn)
		dialog.append(titleEl, input, actions)
		overlay.append(dialog)
		document.body.append(overlay)

		requestAnimationFrame(() => {
			input.select()
			input.focus()
		})
	})
}

/** Shows a modal confirmation dialog. Returns true if confirmed, false if cancelled. */
export function showConfirmDialog(opts: {
	title: string
	message: string
	confirmLabel?: string
	danger?: boolean
}): Promise<boolean> {
	return new Promise((resolve) => {
		injectStyles()

		const overlay = document.createElement("div")
		overlay.className = "stor-dialog-overlay"

		const dialog = document.createElement("div")
		dialog.className = "stor-dialog"

		const titleEl = document.createElement("div")
		titleEl.className = "stor-dialog-title"
		titleEl.textContent = opts.title

		const msgEl = document.createElement("div")
		msgEl.className = "stor-dialog-msg"
		msgEl.textContent = opts.message

		const actions = document.createElement("div")
		actions.className = "stor-dialog-actions"

		const cancelBtn = document.createElement("button")
		cancelBtn.className = "stor-dialog-btn"
		cancelBtn.textContent = "Cancel"

		const confirmBtn = document.createElement("button")
		confirmBtn.className = opts.danger
			? "stor-dialog-btn stor-dialog-btn--danger"
			: "stor-dialog-btn stor-dialog-btn--primary"
		confirmBtn.textContent = opts.confirmLabel ?? "Confirm"

		function close(result: boolean): void {
			overlay.remove()
			document.removeEventListener("keydown", handleKey)
			resolve(result)
		}

		cancelBtn.addEventListener("click", () => close(false))
		confirmBtn.addEventListener("click", () => close(true))

		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") close(false)
			else if (e.key === "Enter") close(true)
		}
		document.addEventListener("keydown", handleKey)

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) close(false)
		})

		actions.append(cancelBtn, confirmBtn)
		dialog.append(titleEl, msgEl, actions)
		overlay.append(dialog)
		document.body.append(overlay)

		requestAnimationFrame(() => confirmBtn.focus())
	})
}
