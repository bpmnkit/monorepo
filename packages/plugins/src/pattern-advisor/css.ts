import { injectChromeStyles } from "@bpmnkit/editor"

export const STYLE_ID = "bpmnkit-pattern-advisor-v1"

export const CSS = `
/* ── Side panel ───────────────────────────────────────────────────────────── */
.bpmnkit-pa-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
  color: var(--bpmnkit-chrome-ink);
  background: var(--bpmnkit-chrome-ground);
}

.bpmnkit-pa-header {
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.bpmnkit-pa-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bpmnkit-chrome-ink);
  margin: 0;
}

.bpmnkit-pa-counts {
  display: flex;
  gap: 6px;
  align-items: center;
}

.bpmnkit-pa-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 1px 5px;
  letter-spacing: 0.02em;
}
.bpmnkit-pa-badge-error {
  background: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-pa-badge-warning {
  background: var(--bpmnkit-warn, #d97706);
  color: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-pa-badge-info {
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
}

.bpmnkit-pa-body {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0 8px;
}

.bpmnkit-pa-empty {
  padding: 24px 16px;
  text-align: center;
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 12px;
  line-height: 1.5;
}

/* ── Finding group ─────────────────────────────────────────────────────────── */
.bpmnkit-pa-group {
  padding: 6px 0 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  margin-bottom: 0;
}
.bpmnkit-pa-group:last-child {
  border-bottom: none;
}

.bpmnkit-pa-group-header {
  font-family: var(--bpmnkit-chrome-mono);
  padding: 2px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmnkit-chrome-ink-4);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ── Individual finding ────────────────────────────────────────────────────── */
.bpmnkit-pa-finding {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 12px;
}

.bpmnkit-pa-severity {
  font-family: var(--bpmnkit-chrome-mono);
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 2px 5px;
  margin-top: 1px;
  white-space: nowrap;
}
.bpmnkit-pa-severity-error {
  background: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-pa-severity-warning {
  background: var(--bpmnkit-warn, #d97706);
  color: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-pa-severity-info {
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
}

.bpmnkit-pa-finding-body {
  flex: 1;
  min-width: 0;
}

.bpmnkit-pa-finding-msg {
  color: var(--bpmnkit-chrome-ink);
  line-height: 1.45;
  word-break: break-word;
  font-size: 12.5px;
}

.bpmnkit-pa-finding-sug {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 11.5px;
  margin-top: 2px;
  line-height: 1.4;
}

.bpmnkit-pa-finding-actions {
  display: flex;
  gap: 6px;
  margin-top: 5px;
  flex-wrap: wrap;
}

.bpmnkit-pa-btn {
  font-size: 11px;
  padding: 2px 8px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink);
  cursor: pointer;
  white-space: nowrap;
}
.bpmnkit-pa-btn:hover {
  background: var(--bpmnkit-chrome-accent-subtle);
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}

.bpmnkit-pa-btn-fix {
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-pa-btn-fix:hover {
  background: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
}

/* ── Canvas element badges ─────────────────────────────────────────────────── */
.bpmnkit-pa-error-ring > .bpmnkit-shape-body,
.bpmnkit-pa-error-ring > rect:first-child {
  stroke: var(--bpmnkit-danger, #dc2626) !important;
  stroke-width: 2.5px !important;
}
.bpmnkit-pa-warning-ring > .bpmnkit-shape-body,
.bpmnkit-pa-warning-ring > rect:first-child {
  stroke: var(--bpmnkit-warn, #d97706) !important;
  stroke-width: 2px !important;
}
.bpmnkit-pa-info-ring > .bpmnkit-shape-body,
.bpmnkit-pa-info-ring > rect:first-child {
  stroke: var(--bpmnkit-chrome-accent) !important;
  stroke-width: 1.5px !important;
}
`

export function injectPatternAdvisorStyles(): void {
	injectChromeStyles()
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
