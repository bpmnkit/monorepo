import { injectChromeStyles } from "./chrome.js"
const MODAL_STYLE_ID = "bpmnkit-hud-modal-styles"

function injectModalStyles(): void {
	injectChromeStyles()
	if (document.getElementById(MODAL_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MODAL_STYLE_ID
	style.textContent = `
.bpmnkit-hud-modal-overlay {
  position: fixed; inset: 0; z-index: 300;
  background: color-mix(in srgb, var(--bpmnkit-ds-dark, #14161a) 55%, transparent);
  display: flex; align-items: center; justify-content: center;
}
.bpmnkit-hud-modal {
  background: var(--bpmnkit-chrome-ground, #ffffff);
  border: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14));
  padding: 24px 26px;
  min-width: 320px; max-width: 90vw;
  color: var(--bpmnkit-chrome-ink-2, #c8ccd2);
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  display: flex; flex-direction: column; gap: 14px;
}
.bpmnkit-hud-modal-title {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--bpmnkit-chrome-ink-4, #9aa1aa);
}
.bpmnkit-hud-modal-input {
  width: 100%; padding: 7px 9px;
  background: transparent;
  border: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14));
  color: var(--bpmnkit-chrome-ink, #f4f5f7);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 12.5px;
  outline: none;
  box-sizing: border-box;
}
.bpmnkit-hud-modal-input:focus { border-color: var(--bpmnkit-chrome-accent, #c9755c); }
.bpmnkit-hud-modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
.bpmnkit-hud-modal-btn {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 12px; padding: 7px 16px;
  cursor: pointer;
  border: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14));
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2, #c8ccd2);
}
.bpmnkit-hud-modal-btn:hover { background: var(--bpmnkit-chrome-hover, rgba(255,255,255,0.07)); color: var(--bpmnkit-chrome-ink, #f4f5f7); }
.bpmnkit-hud-modal-btn--primary {
  background: var(--bpmnkit-ds-accent, #a8503a);
  border-color: var(--bpmnkit-ds-accent, #a8503a);
  color: #fff;
}
.bpmnkit-hud-modal-btn--primary:hover {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
  border-color: var(--bpmnkit-ds-accent-hover, #8f412e);
  color: #fff;
}
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
	overlay.className = "bpmnkit-hud-modal-overlay"

	const dialog = document.createElement("div")
	dialog.className = "bpmnkit-hud-modal"

	const titleEl = document.createElement("div")
	titleEl.className = "bpmnkit-hud-modal-title"
	titleEl.textContent = title

	const input = document.createElement("input")
	input.type = "text"
	input.className = "bpmnkit-hud-modal-input"
	input.value = defaultValue

	const actions = document.createElement("div")
	actions.className = "bpmnkit-hud-modal-actions"

	const cancelBtn = document.createElement("button")
	cancelBtn.className = "bpmnkit-hud-modal-btn"
	cancelBtn.textContent = "Cancel"

	const confirmBtn = document.createElement("button")
	confirmBtn.className = "bpmnkit-hud-modal-btn bpmnkit-hud-modal-btn--primary"
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
