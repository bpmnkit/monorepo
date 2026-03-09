const MODAL_STYLE_ID = "bpmn-hud-modal-styles"

function injectModalStyles(): void {
	if (document.getElementById(MODAL_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MODAL_STYLE_ID
	style.textContent = `
.bpmn-hud-modal-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.bpmn-hud-modal {
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
.bpmn-hud-modal-title {
  font-size: 14px; font-weight: 600;
  color: rgba(255,255,255,0.95);
}
.bpmn-hud-modal-input {
  width: 100%; padding: 6px 10px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 13px;
  outline: none;
  box-sizing: border-box;
}
.bpmn-hud-modal-input:focus { border-color: rgba(60,120,220,0.6); }
.bpmn-hud-modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.bpmn-hud-modal-btn {
  font-size: 13px; padding: 6px 14px; border-radius: 6px;
  cursor: pointer; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
}
.bpmn-hud-modal-btn:hover { background: rgba(255,255,255,0.1); }
.bpmn-hud-modal-btn--primary {
  background: rgba(60,120,220,0.5);
  border-color: rgba(60,120,220,0.7);
  color: #fff;
}
.bpmn-hud-modal-btn--primary:hover { background: rgba(60,120,220,0.65); }
/* Light theme */
[data-bpmn-hud-theme="light"] .bpmn-hud-modal {
  background: rgba(252,252,254,0.98);
  border-color: rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.8);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-title { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.15);
  color: rgba(0,0,0,0.9);
}
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-input:focus { border-color: rgba(0,80,200,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-btn {
  border-color: rgba(0,0,0,0.12);
  background: rgba(0,0,0,0.04);
  color: rgba(0,0,0,0.7);
}
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-btn:hover { background: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-btn--primary {
  background: rgba(0,80,200,0.85);
  border-color: rgba(0,80,200,0.9);
  color: #fff;
}
[data-bpmn-hud-theme="light"] .bpmn-hud-modal-btn--primary:hover { background: rgba(0,80,200,1); }
`
	document.head.appendChild(style)
}

/**
 * Shows a simple input modal with a title, pre-filled input, and Cancel/Confirm buttons.
 * Calls `onConfirm` with the trimmed input value when confirmed (empty values are ignored).
 */
export function showHudInputModal(
	title: string,
	defaultValue: string,
	onConfirm: (value: string) => void,
): void {
	injectModalStyles()

	const overlay = document.createElement("div")
	overlay.className = "bpmn-hud-modal-overlay"

	const dialog = document.createElement("div")
	dialog.className = "bpmn-hud-modal"

	const titleEl = document.createElement("div")
	titleEl.className = "bpmn-hud-modal-title"
	titleEl.textContent = title

	const input = document.createElement("input")
	input.type = "text"
	input.className = "bpmn-hud-modal-input"
	input.value = defaultValue

	const actions = document.createElement("div")
	actions.className = "bpmn-hud-modal-actions"

	const cancelBtn = document.createElement("button")
	cancelBtn.className = "bpmn-hud-modal-btn"
	cancelBtn.textContent = "Cancel"

	const confirmBtn = document.createElement("button")
	confirmBtn.className = "bpmn-hud-modal-btn bpmn-hud-modal-btn--primary"
	confirmBtn.textContent = "Confirm"

	function close(): void {
		overlay.remove()
		document.removeEventListener("keydown", handleKey)
	}

	function confirm(): void {
		const value = input.value.trim()
		if (!value) return
		close()
		onConfirm(value)
	}

	cancelBtn.addEventListener("click", close)
	confirmBtn.addEventListener("click", confirm)

	function handleKey(e: KeyboardEvent): void {
		if (e.key === "Escape") close()
		else if (e.key === "Enter") confirm()
	}
	document.addEventListener("keydown", handleKey)

	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) close()
	})

	actions.append(cancelBtn, confirmBtn)
	dialog.append(titleEl, input, actions)
	overlay.append(dialog)
	document.body.append(overlay)

	requestAnimationFrame(() => {
		input.select()
		input.focus()
	})
}
