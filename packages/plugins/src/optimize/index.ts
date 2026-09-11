import { Bpmn, optimize } from "@bpmnkit/core"
import type { BpmnDefinitions, OptimizationFinding } from "@bpmnkit/core"
import { injectChromeStyles } from "@bpmnkit/editor"

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLE_ID = "opt-dialog-styles"

function injectStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	/* Flat, square, hairline-ruled; grounds come from the shared chrome tokens.
	   Finding severity — error / warning / info — is semantic state and keeps its
	   own scale; the one-accent rule does not reach it. */
	style.textContent = `
.opt-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: var(--bpmnkit-chrome-scrim);
  display: flex; align-items: center; justify-content: center;
}
.opt-panel {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  width: 540px; max-width: 95vw; max-height: 80vh;
  display: flex; flex-direction: column;
  color: var(--bpmnkit-chrome-ink-2);
  font-family: var(--bpmnkit-chrome-font);
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  overflow: hidden;
}
.opt-header {
  padding: 18px 20px 14px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.opt-title {
  font-size: 17px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bpmnkit-chrome-ink);
  margin: 0 0 4px;
}
.opt-subtitle {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4);
  margin: 0;
}
.opt-body {
  flex: 1; overflow-y: auto;
}
.opt-finding {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.opt-finding:last-child { border-bottom: none; }
.opt-finding-cb { margin-top: 3px; flex-shrink: 0; cursor: pointer; accent-color: var(--bpmnkit-chrome-accent); }
.opt-badge {
  flex-shrink: 0;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  margin-top: 3px; min-width: 58px;
}
.opt-badge-error   { color: var(--bpmnkit-danger, #dc2626); }
.opt-badge-warning { color: var(--bpmnkit-warn, #d97706); }
.opt-badge-info    { color: var(--bpmnkit-chrome-ink-4); }
.opt-finding-body { flex: 1; min-width: 0; }
.opt-finding-msg  { color: var(--bpmnkit-chrome-ink); line-height: 1.5; word-break: break-word; }
.opt-finding-sug  {
  font-family: var(--bpmnkit-chrome-mono);
  color: var(--bpmnkit-chrome-ink-4); font-size: 12px; margin-top: 4px; line-height: 1.5;
}
.opt-empty {
  padding: 32px; text-align: center;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4);
}
.opt-result {
  display: flex; align-items: flex-start; gap: 12px;
  padding: 10px 20px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.opt-result:last-child { border-bottom: none; }
.opt-result-icon  {
  flex-shrink: 0; margin-top: 1px;
  color: var(--bpmnkit-success, #16a34a); font-size: 14px; font-variant-emoji: text;
}
.opt-result-body  { flex: 1; min-width: 0; }
.opt-result-desc  { color: var(--bpmnkit-chrome-ink-2); line-height: 1.5; }
.opt-result-open {
  margin-top: 8px;
  font-family: var(--bpmnkit-chrome-mono); font-size: 11px;
  background: transparent; border: 1px solid var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent); padding: 4px 10px;
  cursor: pointer;
}
.opt-result-open:hover { background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg); }
.opt-footer {
  padding: 14px 20px;
  border-top: 1px solid var(--bpmnkit-chrome-line);
  display: flex; gap: 10px; justify-content: flex-end;
  flex-shrink: 0;
}
.opt-btn {
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px; padding: 7px 16px;
  cursor: pointer;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
}
.opt-btn:hover:not(:disabled) { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.opt-btn:disabled { opacity: 0.35; cursor: default; }
.opt-btn-primary {
  background: var(--bpmnkit-chrome-accent);
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
}
.opt-btn-primary:hover:not(:disabled) {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
  border-color: var(--bpmnkit-ds-accent-hover, #8f412e);
  color: var(--bpmnkit-chrome-accent-fg);
}
`
	document.head.appendChild(style)
}

// ── Dialog helpers ────────────────────────────────────────────────────────────

function makeHeader(title: string, subtitle: string): HTMLElement {
	const header = document.createElement("div")
	header.className = "opt-header"
	const h = document.createElement("div")
	h.className = "opt-title"
	h.textContent = title
	const s = document.createElement("div")
	s.className = "opt-subtitle"
	s.textContent = subtitle
	header.append(h, s)
	return header
}

function makeFooter(...buttons: HTMLButtonElement[]): HTMLElement {
	const footer = document.createElement("div")
	footer.className = "opt-footer"
	footer.append(...buttons)
	return footer
}

function makeBtn(label: string, primary = false): HTMLButtonElement {
	const btn = document.createElement("button")
	btn.className = primary ? "opt-btn opt-btn-primary" : "opt-btn"
	btn.textContent = label
	return btn
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function showOptimizeDialog(
	defs: BpmnDefinitions,
	reload: (xml: string) => void,
	openTab: (xml: string, name: string) => void,
): void {
	injectStyles()

	const report = optimize(defs)
	const findings = report.findings

	const overlay = document.createElement("div")
	overlay.className = "opt-overlay"
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})

	const panel = document.createElement("div")
	panel.className = "opt-panel"

	function showPhase1(): void {
		panel.innerHTML = ""

		const fixableCount = findings.filter((f) => f.applyFix !== undefined).length
		const subtitleText =
			findings.length === 0
				? "No issues found"
				: `${findings.length} finding${findings.length !== 1 ? "s" : ""} · ${fixableCount} auto-fixable`

		panel.append(makeHeader("Optimize Diagram", subtitleText))

		const body = document.createElement("div")
		body.className = "opt-body"

		const checkboxes = new Map<OptimizationFinding, HTMLInputElement>()

		if (findings.length === 0) {
			const empty = document.createElement("div")
			empty.className = "opt-empty"
			empty.textContent = "✓ No optimization opportunities found."
			body.append(empty)
		} else {
			for (const finding of findings) {
				const row = document.createElement("div")
				row.className = "opt-finding"

				const cb = document.createElement("input")
				cb.type = "checkbox"
				cb.className = "opt-finding-cb"
				cb.checked = finding.applyFix !== undefined
				cb.disabled = finding.applyFix === undefined
				checkboxes.set(finding, cb)

				const badge = document.createElement("span")
				badge.className = `opt-badge opt-badge-${finding.severity}`
				badge.textContent = finding.severity

				const fbody = document.createElement("div")
				fbody.className = "opt-finding-body"

				const msg = document.createElement("div")
				msg.className = "opt-finding-msg"
				msg.textContent = finding.message

				const sug = document.createElement("div")
				sug.className = "opt-finding-sug"
				sug.textContent = finding.suggestion

				fbody.append(msg, sug)
				row.append(cb, badge, fbody)
				body.append(row)
			}
		}

		const btnClose = makeBtn("Close")
		btnClose.addEventListener("click", () => overlay.remove())

		const btnApply = makeBtn(`Apply ${fixableCount} Fix${fixableCount !== 1 ? "es" : ""}`, true)
		btnApply.disabled = fixableCount === 0

		btnApply.addEventListener("click", () => {
			const selected = findings.filter((f) => {
				const cb = checkboxes.get(f)
				return f.applyFix !== undefined && cb?.checked === true
			})
			if (selected.length === 0) return

			const results: Array<{ description: string; generated?: BpmnDefinitions }> = []
			for (const finding of selected) {
				if (!finding.applyFix) continue
				results.push(finding.applyFix(defs))
			}

			reload(Bpmn.export(defs))
			showPhase2(results)
		})

		panel.append(body, makeFooter(btnClose, btnApply))
	}

	function showPhase2(results: Array<{ description: string; generated?: BpmnDefinitions }>): void {
		panel.innerHTML = ""

		const subtitle = `${results.length} fix${results.length !== 1 ? "es" : ""} applied successfully`
		panel.append(makeHeader("Fixes Applied", subtitle))

		const body = document.createElement("div")
		body.className = "opt-body"

		for (const result of results) {
			const row = document.createElement("div")
			row.className = "opt-result"

			const icon = document.createElement("div")
			icon.className = "opt-result-icon"
			icon.textContent = "✓"

			const rbody = document.createElement("div")
			rbody.className = "opt-result-body"

			const desc = document.createElement("div")
			desc.className = "opt-result-desc"
			desc.textContent = result.description
			rbody.append(desc)

			if (result.generated) {
				const gen = result.generated
				const openBtn = document.createElement("button")
				openBtn.className = "opt-result-open"
				openBtn.textContent = "Open generated process in new tab"
				openBtn.addEventListener("click", () => {
					openTab(Bpmn.export(gen), "Extracted Process")
				})
				rbody.append(openBtn)
			}

			row.append(icon, rbody)
			body.append(row)
		}

		const btnDone = makeBtn("Done", true)
		btnDone.addEventListener("click", () => overlay.remove())

		panel.append(body, makeFooter(btnDone))
	}

	showPhase1()
	overlay.append(panel)
	document.body.append(overlay)
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const OPTIMIZE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14L8 7"/><path d="M11 2l.75 2.25L14 5l-2.25.75L11 8l-.75-2.25L8 5l2.25-.75z"/></svg>`

export interface OptimizePluginOptions {
	/** Returns the current diagram definitions, or null if no diagram is loaded. */
	getDefinitions: () => BpmnDefinitions | null
	/** Reloads the editor with the given XML. */
	reload: (xml: string) => void
	/** Opens a new BPMN tab with the given XML and name. */
	openTab: (xml: string, name: string) => void
}

/**
 * Creates an optimize plugin that provides a button for triggering
 * the two-phase diagram optimization dialog.
 *
 * The returned `button` should be passed to `initEditorHud` as `optimizeButton`.
 */
export function createOptimizePlugin(options: OptimizePluginOptions): {
	name: string
	install(): void
	button: HTMLButtonElement
} {
	const button = document.createElement("button")
	button.title = "Optimize"
	button.innerHTML = OPTIMIZE_ICON

	button.addEventListener("click", () => {
		const defs = options.getDefinitions()
		if (!defs) return
		showOptimizeDialog(defs, options.reload, options.openTab)
	})

	return {
		name: "optimize",
		install(): void {},
		button,
	}
}
