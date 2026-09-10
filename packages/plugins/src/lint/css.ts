/** ID used to prevent duplicate style injection. */
export const LINT_STYLE_ID = "bpmnkit-lint-styles-v1"

/**
 * CSS for the lint plugin, injected once into `<head>`.
 *
 * Severity colours are the brand tokens with hex fallbacks: danger for an
 * error, warn for a warning, accent for information.
 */
export const LINT_CSS = `
.bpmnkit-lint-error .bpmnkit-shape-body,
.bpmnkit-lint-error .bpmnkit-callactivity-body,
.bpmnkit-lint-error .bpmnkit-eventsubprocess-body,
.bpmnkit-lint-error .bpmnkit-event-body,
.bpmnkit-lint-error .bpmnkit-end-body,
.bpmnkit-lint-error .bpmnkit-gw-body,
.bpmnkit-lint-error .bpmnkit-data-body,
.bpmnkit-lint-error .bpmnkit-datastore-body,
.bpmnkit-lint-error .bpmnkit-group-body {
  stroke: var(--bpmnkit-danger, #dc2626) !important;
  stroke-width: 2.5 !important;
}
.bpmnkit-lint-error .bpmnkit-edge-path {
  stroke: var(--bpmnkit-danger, #dc2626) !important;
  stroke-width: 2.5 !important;
}

.bpmnkit-lint-warning .bpmnkit-shape-body,
.bpmnkit-lint-warning .bpmnkit-callactivity-body,
.bpmnkit-lint-warning .bpmnkit-eventsubprocess-body,
.bpmnkit-lint-warning .bpmnkit-event-body,
.bpmnkit-lint-warning .bpmnkit-end-body,
.bpmnkit-lint-warning .bpmnkit-gw-body,
.bpmnkit-lint-warning .bpmnkit-data-body,
.bpmnkit-lint-warning .bpmnkit-datastore-body,
.bpmnkit-lint-warning .bpmnkit-group-body {
  stroke: var(--bpmnkit-warn, #d97706) !important;
  stroke-width: 2 !important;
}
.bpmnkit-lint-warning .bpmnkit-edge-path {
  stroke: var(--bpmnkit-warn, #d97706) !important;
  stroke-width: 2 !important;
}

.bpmnkit-lint-info .bpmnkit-shape-body,
.bpmnkit-lint-info .bpmnkit-callactivity-body,
.bpmnkit-lint-info .bpmnkit-eventsubprocess-body,
.bpmnkit-lint-info .bpmnkit-event-body,
.bpmnkit-lint-info .bpmnkit-end-body,
.bpmnkit-lint-info .bpmnkit-gw-body,
.bpmnkit-lint-info .bpmnkit-data-body,
.bpmnkit-lint-info .bpmnkit-datastore-body,
.bpmnkit-lint-info .bpmnkit-group-body {
  stroke: var(--bpmnkit-accent, #1a56db) !important;
  stroke-dasharray: 4 3 !important;
}

/* The element the summary control last stepped to. */
@keyframes bpmnkit-lint-focus-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0)); }
  50%      { filter: drop-shadow(0 0 10px var(--bpmnkit-accent, #1a56db)); }
}
.bpmnkit-lint-focus {
  animation: bpmnkit-lint-focus-pulse 0.6s ease-in-out 2;
}

/* ── Summary control ─────────────────────────────────────────────────────── */

.bpmnkit-lint-summary {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  background: var(--bpmnkit-panel-bg, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 11px;
  line-height: 1.4;
  color: var(--bpmnkit-fg, #1a1a2e);
  cursor: pointer;
  user-select: none;
}
.bpmnkit-lint-summary:hover {
  background: var(--bpmnkit-surface-2, #eeeef8);
}
.bpmnkit-lint-summary:focus-visible {
  outline: 2px solid var(--bpmnkit-accent, #1a56db);
  outline-offset: 1px;
}
/* Our own display:flex outranks the UA stylesheet's [hidden] rule. */
.bpmnkit-lint-summary[hidden] {
  display: none;
}
.bpmnkit-lint-count {
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.bpmnkit-lint-count[data-severity="error"] {
  color: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-lint-count[data-severity="warning"] {
  color: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-lint-count[data-severity="info"] {
  color: var(--bpmnkit-accent, #1a56db);
}
.bpmnkit-lint-clean {
  color: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-lint-note {
  color: var(--bpmnkit-fg-muted, #6666a0);
  font-style: italic;
}
.bpmnkit-lint-platform {
  color: var(--bpmnkit-fg-muted, #6666a0);
  border-left: 1px solid var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
  padding-left: 8px;
}
`

/** Injects {@link LINT_CSS} into `<head>` once per document. */
export function injectLintStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(LINT_STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = LINT_STYLE_ID
	style.textContent = LINT_CSS
	document.head.appendChild(style)
}
