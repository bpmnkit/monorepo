/** ID used to prevent duplicate style injection. */
export const DIFF_STYLE_ID = "bpmnkit-diff-styles-v1"

/**
 * CSS for the diff plugin, injected once into `<head>`.
 *
 * Every colour is a brand token with a hex fallback, so the plugin looks right
 * inside an app that imports `@bpmnkit/ui` and still works standalone.
 */
export const DIFF_CSS = `
.bpmnkit-diff-added .bpmnkit-shape-body,
.bpmnkit-diff-added .bpmnkit-callactivity-body,
.bpmnkit-diff-added .bpmnkit-eventsubprocess-body,
.bpmnkit-diff-added .bpmnkit-event-body,
.bpmnkit-diff-added .bpmnkit-end-body,
.bpmnkit-diff-added .bpmnkit-gw-body,
.bpmnkit-diff-added .bpmnkit-data-body,
.bpmnkit-diff-added .bpmnkit-datastore-body,
.bpmnkit-diff-added .bpmnkit-group-body {
  stroke: var(--bpmnkit-success, #16a34a) !important;
  stroke-width: 2.5 !important;
  fill: color-mix(in srgb, var(--bpmnkit-success, #16a34a) 12%, transparent) !important;
}
.bpmnkit-diff-added .bpmnkit-edge-path {
  stroke: var(--bpmnkit-success, #16a34a) !important;
  stroke-width: 2.5 !important;
}
.bpmnkit-diff-added .bpmnkit-arrow-fill {
  fill: var(--bpmnkit-success, #16a34a) !important;
}

.bpmnkit-diff-removed .bpmnkit-shape-body,
.bpmnkit-diff-removed .bpmnkit-callactivity-body,
.bpmnkit-diff-removed .bpmnkit-eventsubprocess-body,
.bpmnkit-diff-removed .bpmnkit-event-body,
.bpmnkit-diff-removed .bpmnkit-end-body,
.bpmnkit-diff-removed .bpmnkit-gw-body,
.bpmnkit-diff-removed .bpmnkit-data-body,
.bpmnkit-diff-removed .bpmnkit-datastore-body,
.bpmnkit-diff-removed .bpmnkit-group-body {
  stroke: var(--bpmnkit-danger, #dc2626) !important;
  stroke-width: 2.5 !important;
  stroke-dasharray: 6 3 !important;
  fill: color-mix(in srgb, var(--bpmnkit-danger, #dc2626) 12%, transparent) !important;
}
.bpmnkit-diff-removed .bpmnkit-edge-path {
  stroke: var(--bpmnkit-danger, #dc2626) !important;
  stroke-width: 2.5 !important;
  stroke-dasharray: 6 3 !important;
}
.bpmnkit-diff-removed .bpmnkit-arrow-fill {
  fill: var(--bpmnkit-danger, #dc2626) !important;
}

.bpmnkit-diff-changed .bpmnkit-shape-body,
.bpmnkit-diff-changed .bpmnkit-callactivity-body,
.bpmnkit-diff-changed .bpmnkit-eventsubprocess-body,
.bpmnkit-diff-changed .bpmnkit-event-body,
.bpmnkit-diff-changed .bpmnkit-end-body,
.bpmnkit-diff-changed .bpmnkit-gw-body,
.bpmnkit-diff-changed .bpmnkit-data-body,
.bpmnkit-diff-changed .bpmnkit-datastore-body,
.bpmnkit-diff-changed .bpmnkit-group-body {
  stroke: var(--bpmnkit-warn, #d97706) !important;
  stroke-width: 2.5 !important;
  fill: color-mix(in srgb, var(--bpmnkit-warn, #d97706) 12%, transparent) !important;
}
.bpmnkit-diff-changed .bpmnkit-edge-path {
  stroke: var(--bpmnkit-warn, #d97706) !important;
  stroke-width: 2.5 !important;
}
.bpmnkit-diff-changed .bpmnkit-arrow-fill {
  fill: var(--bpmnkit-warn, #d97706) !important;
}

.bpmnkit-diff-moved .bpmnkit-shape-body,
.bpmnkit-diff-moved .bpmnkit-callactivity-body,
.bpmnkit-diff-moved .bpmnkit-eventsubprocess-body,
.bpmnkit-diff-moved .bpmnkit-event-body,
.bpmnkit-diff-moved .bpmnkit-end-body,
.bpmnkit-diff-moved .bpmnkit-gw-body,
.bpmnkit-diff-moved .bpmnkit-data-body,
.bpmnkit-diff-moved .bpmnkit-datastore-body,
.bpmnkit-diff-moved .bpmnkit-group-body {
  stroke: var(--bpmnkit-accent, #1a56db) !important;
  stroke-width: 2 !important;
  stroke-dasharray: 3 3 !important;
}
.bpmnkit-diff-moved .bpmnkit-edge-path {
  stroke: var(--bpmnkit-accent, #1a56db) !important;
  stroke-width: 2 !important;
  stroke-dasharray: 3 3 !important;
}
.bpmnkit-diff-moved .bpmnkit-arrow-fill {
  fill: var(--bpmnkit-accent, #1a56db) !important;
}

/* ── Legend ──────────────────────────────────────────────────────────────── */

.bpmnkit-diff-legend {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--bpmnkit-panel-bg, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
  font-size: 11px;
  line-height: 1.4;
  color: var(--bpmnkit-fg, #1a1a2e);
  pointer-events: none;
}
/* Our own display:flex outranks the UA stylesheet's [hidden] rule. */
.bpmnkit-diff-legend[hidden] {
  display: none;
}
.bpmnkit-diff-legend-title {
  font-weight: 600;
  color: var(--bpmnkit-fg-muted, #6666a0);
}
.bpmnkit-diff-legend-note {
  color: var(--bpmnkit-fg-muted, #6666a0);
  font-style: italic;
}
.bpmnkit-diff-legend-row {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.bpmnkit-diff-legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex: none;
}
.bpmnkit-diff-legend-swatch[data-category="added"] {
  background: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-diff-legend-swatch[data-category="removed"] {
  background: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-diff-legend-swatch[data-category="changed"] {
  background: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-diff-legend-swatch[data-category="moved"] {
  background: var(--bpmnkit-accent, #1a56db);
}
`

/** Injects {@link DIFF_CSS} into `<head>` once per document. */
export function injectDiffStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(DIFF_STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = DIFF_STYLE_ID
	style.textContent = DIFF_CSS
	document.head.appendChild(style)
}
