import { injectChromeStyles } from "@bpmnkit/editor"

export const STYLE_ID = "bpmnkit-live-mode-v1"

/* Flat, square, hairline-ruled. Connection state — off / connecting / live /
   error / blocked — is semantic and keeps its own scale; the one-accent rule
   does not reach it. */
export const CSS = `
/* ── Toggle button ─────────────────────────────────────────────────────────── */
.bpmnkit-live-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 12px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12px;
  cursor: pointer;
}
.bpmnkit-live-toggle:hover {
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-live-toggle--on {
  border-color: var(--bpmnkit-success, #16a34a);
  color: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-live-toggle--blocked {
  border-color: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
}

/* ── Status mark ───────────────────────────────────────────────────────────── */
.bpmnkit-live-status {
  display: inline-block;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  padding: 3px 8px;
  background: transparent;
  color: var(--bpmnkit-chrome-ink-4);
  border: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-live-status--off { color: var(--bpmnkit-chrome-ink-4); }
.bpmnkit-live-status--connecting {
  color: var(--bpmnkit-warn, #d97706);
  border-color: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-live-status--live {
  color: var(--bpmnkit-success, #16a34a);
  border-color: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-live-status--error,
.bpmnkit-live-status--blocked {
  color: var(--bpmnkit-danger, #dc2626);
  border-color: var(--bpmnkit-danger, #dc2626);
}

/* ── Conflict banner ───────────────────────────────────────────────────────── */
.bpmnkit-live-conflict {
  font-family: var(--bpmnkit-chrome-font);
  background: transparent;
  border: 1px solid var(--bpmnkit-danger, #dc2626);
  padding: 12px 14px;
  margin: 8px 0;
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  color: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-live-conflict-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-danger, #dc2626);
  margin-bottom: 8px;
}
.bpmnkit-live-conflict-list {
  list-style: none;
  padding-left: 0;
  margin-bottom: 10px;
}
.bpmnkit-live-conflict-item {
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-4);
  font-family: var(--bpmnkit-chrome-mono);
  padding: 3px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-live-conflict-item:last-child { border-bottom: none; }
.bpmnkit-live-btn {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
  padding: 4px 10px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
}
.bpmnkit-live-btn:hover {
  background: var(--bpmnkit-chrome-hover);
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}

/* ── Variable inspector tooltip ────────────────────────────────────────────── */
.bpmnkit-live-vars-tooltip {
  position: fixed;
  z-index: 9999;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 10px 12px;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 12.5px;
  min-width: 160px;
  max-width: 300px;
  pointer-events: none;
}
.bpmnkit-live-vars-row {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding: 4px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-live-vars-row:last-child {
  border-bottom: none;
}
.bpmnkit-live-vars-name {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  flex-shrink: 0;
}
.bpmnkit-live-vars-value {
  color: var(--bpmnkit-chrome-ink-2);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`

export function injectLiveModeStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
