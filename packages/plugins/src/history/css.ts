import { injectChromeStyles } from "@bpmnkit/editor"

const STYLE_ID = "bpmnkit-history-styles"

export function injectHistoryStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	/* Flat, square, hairline-ruled. Grounds come from the shared chrome tokens,
	   so this is one set of rules rather than a dark one plus a light copy. */
	style.textContent = `
/* ── History pane ────────────────────────────────────────────────────────── */
.bpmnkit-hist-pane {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  font-family: var(--bpmnkit-chrome-font);
}
.bpmnkit-hist-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 14px; height: 34px; flex-shrink: 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-hist-header-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-hist-refresh {
  width: 24px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none;
  color: var(--bpmnkit-chrome-ink-4); cursor: pointer;
  font-family: var(--bpmnkit-chrome-mono); font-size: 13px; line-height: 1;
  font-variant-emoji: text;
}
.bpmnkit-hist-refresh:hover { color: var(--bpmnkit-chrome-ink); background: var(--bpmnkit-chrome-hover); }
.bpmnkit-hist-list {
  flex: 1; overflow-y: auto; padding: 0 0 8px;
}
.bpmnkit-hist-list::-webkit-scrollbar { width: 4px; }
.bpmnkit-hist-list::-webkit-scrollbar-track { background: transparent; }
.bpmnkit-hist-list::-webkit-scrollbar-thumb { background: var(--bpmnkit-chrome-line); }
.bpmnkit-hist-group-label {
  padding: 14px 14px 6px;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-hist-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 7px 14px; gap: 10px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-hist-item:hover { background: var(--bpmnkit-chrome-hover); }
.bpmnkit-hist-item-time {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12.5px; color: var(--bpmnkit-chrome-ink-2);
  font-variant-numeric: tabular-nums; flex: 1;
}
.bpmnkit-hist-restore {
  flex-shrink: 0;
  font-family: var(--bpmnkit-chrome-mono); font-size: 11px; padding: 3px 10px;
  background: transparent; border: 1px solid var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
  cursor: pointer;
}
.bpmnkit-hist-restore:hover {
  background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg);
}
.bpmnkit-hist-empty {
  padding: 32px 20px; text-align: center;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4); line-height: 1.65;
}
/* ── Confirm dialog ──────────────────────────────────────────────────────── */
.bpmnkit-hist-confirm-overlay {
  position: fixed; inset: 0; z-index: 10100;
  background: var(--bpmnkit-chrome-scrim);
  display: flex; align-items: center; justify-content: center;
}
.bpmnkit-hist-confirm-panel {
  background: var(--bpmnkit-chrome-ground); border: 1px solid var(--bpmnkit-chrome-line);
  padding: 24px 26px; width: 320px;
  font-family: var(--bpmnkit-chrome-font);
}
.bpmnkit-hist-confirm-title {
  font-size: 15px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bpmnkit-chrome-ink); margin-bottom: 8px;
}
.bpmnkit-hist-confirm-body {
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  color: var(--bpmnkit-chrome-ink-2); line-height: 1.55; margin-bottom: 20px;
}
.bpmnkit-hist-confirm-actions { display: flex; justify-content: flex-end; gap: 10px; }
.bpmnkit-hist-confirm-cancel {
  padding: 7px 16px; background: transparent;
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-2);
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px; cursor: pointer;
}
.bpmnkit-hist-confirm-cancel:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.bpmnkit-hist-confirm-ok {
  padding: 7px 16px; background: var(--bpmnkit-chrome-accent);
  border: 1px solid var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px; cursor: pointer;
}
.bpmnkit-hist-confirm-ok:hover { background: var(--bpmnkit-ds-accent-hover, #8f412e); border-color: var(--bpmnkit-ds-accent-hover, #8f412e); color: var(--bpmnkit-chrome-accent-fg); }
`
	document.head.appendChild(style)
}
