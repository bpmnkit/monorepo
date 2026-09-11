import { injectChromeStyles } from "@bpmnkit/editor"

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
  stroke: var(--bpmnkit-chrome-accent) !important;
  stroke-dasharray: 4 3 !important;
}

/* The element the summary control last stepped to. */
@keyframes bpmnkit-lint-focus-pulse {
  0%, 100% { filter: drop-shadow(0 0 6px rgba(0, 0, 0, 0)); }
  50%      { filter: drop-shadow(0 0 10px var(--bpmnkit-chrome-accent)); }
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
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  font-family: var(--bpmnkit-chrome-font);
  font-size: 11px;
  line-height: 1.4;
  color: var(--bpmnkit-chrome-ink);
  cursor: pointer;
  user-select: none;
}
.bpmnkit-lint-summary:hover {
  background: var(--bpmnkit-chrome-ground-2);
}
.bpmnkit-lint-summary:focus-visible {
  outline: 2px solid var(--bpmnkit-chrome-accent);
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
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-lint-clean {
  color: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-lint-note {
  color: var(--bpmnkit-chrome-ink-4);
  font-style: italic;
}
.bpmnkit-lint-platform {
  color: var(--bpmnkit-chrome-ink-4);
  border-left: 1px solid var(--bpmnkit-chrome-line);
  padding-left: 8px;
}
`

/** Injects {@link LINT_CSS} into `<head>` once per document. */
export function injectLintStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(LINT_STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = LINT_STYLE_ID
	style.textContent = LINT_CSS
	document.head.appendChild(style)
}
