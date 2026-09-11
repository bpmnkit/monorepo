import { injectChromeStyles } from "@bpmnkit/editor"

export const ASCII_VIEW_STYLE_ID = "bpmnkit-ascii-view-styles-v1"

/* Flat, square, hairline-ruled. Grounds come from the shared chrome tokens, so
   this sheet is one set of rules rather than a dark one plus a light copy. */
export const ASCII_VIEW_CSS = `
.bpmnkit-ascii-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: var(--bpmnkit-chrome-scrim);
  display: flex; align-items: center; justify-content: center;
}
.bpmnkit-ascii-panel {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  width: 80vw; max-width: 900px; max-height: 80vh;
  display: flex; flex-direction: column;
  font-family: var(--bpmnkit-chrome-font);
  overflow: hidden;
}
.bpmnkit-ascii-header {
  padding: 0 18px; height: 46px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  display: flex; align-items: center; justify-content: space-between;
  flex-shrink: 0;
}
.bpmnkit-ascii-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  margin: 0;
}
.bpmnkit-ascii-actions { display: flex; align-items: stretch; border: 1px solid var(--bpmnkit-chrome-line); }
.bpmnkit-ascii-btn {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12px; padding: 5px 12px;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-ascii-actions > * + * { border-left: 1px solid var(--bpmnkit-chrome-line-soft); }
.bpmnkit-ascii-btn:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
/* Success is semantic state, exempt from the one-accent rule. */
.bpmnkit-ascii-btn-copied {
  background: var(--bpmnkit-success, #16a34a) !important;
  color: var(--bpmnkit-ds-ink-on-dark, #f4f5f7) !important;
}
.bpmnkit-ascii-body {
  flex: 1; overflow: auto; padding: 16px 18px;
  background: var(--bpmnkit-chrome-ground-2);
}
.bpmnkit-ascii-pre {
  margin: 0;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-code, 13px); line-height: 1.45;
  color: var(--bpmnkit-chrome-ink-2);
  white-space: pre;
}
`

export function injectAsciiViewStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(ASCII_VIEW_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = ASCII_VIEW_STYLE_ID
	style.textContent = ASCII_VIEW_CSS
	document.head.appendChild(style)
}
