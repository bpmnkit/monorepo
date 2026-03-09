const STYLE_ID = "stor-dialog-styles"

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = `
.stor-dialog-overlay {
  position: fixed; inset: 0; z-index: 500;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.stor-dialog {
  background: rgba(22, 22, 30, 0.97);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  padding: 20px;
  min-width: 300px; max-width: 90vw;
  color: rgba(255,255,255,0.85);
  font-family: system-ui, -apple-system, sans-serif;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
  display: flex; flex-direction: column; gap: 12px;
}
.stor-dialog-title {
  font-size: 14px; font-weight: 600;
  color: rgba(255,255,255,0.95);
}
.stor-dialog-msg {
  font-size: 13px; color: rgba(255,255,255,0.65); line-height: 1.4;
}
.stor-dialog-input {
  width: 100%; padding: 6px 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.stor-dialog-input:focus { border-color: rgba(60,120,220,0.6); }
.stor-dialog-actions { display: flex; gap: 8px; justify-content: flex-end; }
.stor-dialog-btn {
  font-size: 13px; padding: 6px 14px; border-radius: 6px;
  cursor: pointer; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
}
.stor-dialog-btn:hover { background: rgba(255,255,255,0.1); }
.stor-dialog-btn--primary {
  background: rgba(60,120,220,0.5);
  border-color: rgba(60,120,220,0.7);
  color: #fff;
}
.stor-dialog-btn--primary:hover { background: rgba(60,120,220,0.65); }
.stor-dialog-btn--danger {
  background: rgba(200,40,40,0.5);
  border-color: rgba(200,40,40,0.7);
  color: #fff;
}
.stor-dialog-btn--danger:hover { background: rgba(200,40,40,0.65); }
/* Light theme */
[data-bpmn-hud-theme="light"] .stor-dialog {
  background: rgba(252,252,254,0.98);
  border-color: rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.8);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .stor-dialog-title { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .stor-dialog-msg { color: rgba(0,0,0,0.55); }
[data-bpmn-hud-theme="light"] .stor-dialog-input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.15);
  color: rgba(0,0,0,0.9);
}
[data-bpmn-hud-theme="light"] .stor-dialog-input:focus { border-color: rgba(0,80,200,0.4); }
[data-bpmn-hud-theme="light"] .stor-dialog-btn {
  border-color: rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.04);
  color: rgba(0,0,0,0.7);
}
[data-bpmn-hud-theme="light"] .stor-dialog-btn:hover { background: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .stor-dialog-btn--primary {
  background: rgba(0,80,200,0.85);
  border-color: rgba(0,80,200,0.9);
  color: #fff;
}
[data-bpmn-hud-theme="light"] .stor-dialog-btn--primary:hover { background: rgba(0,80,200,1); }
[data-bpmn-hud-theme="light"] .stor-dialog-btn--danger {
  background: rgba(180,30,30,0.85);
  border-color: rgba(180,30,30,0.9);
  color: #fff;
}
[data-bpmn-hud-theme="light"] .stor-dialog-btn--danger:hover { background: rgba(180,30,30,1); }
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
