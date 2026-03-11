/** ID used to prevent duplicate style injection. */
export const STYLE_ID = "bpmn-canvas-styles-v1"

/** Complete CSS for the BpmnCanvas component, injected once into `<head>`. */
export const CANVAS_CSS = `
.bpmn-canvas-host {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
  background: var(--bpmn-bg, #f8f9fa);
}
.bpmn-canvas-host *,
.bpmn-canvas-host *::before,
.bpmn-canvas-host *::after {
  box-sizing: border-box;
}
.bpmn-canvas-host > svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}
.bpmn-canvas-host.is-panning > svg {
  cursor: grabbing;
}
.bpmn-canvas-host > svg:focus {
  outline: none;
}

/* ── Shapes ─────────────────────────────────────────────────────── */
.bpmn-shape {
  cursor: pointer;
  outline: none;
}
.bpmn-shape:focus .bpmn-shape-body,
.bpmn-shape:focus .bpmn-event-body,
.bpmn-shape:focus .bpmn-gw-body,
.bpmn-shape:focus .bpmn-pool-body,
.bpmn-shape:focus .bpmn-lane-body {
  stroke: var(--bpmn-focus, #0066cc);
  stroke-width: 2.5;
}
.bpmn-shape.bpmn-selected .bpmn-shape-body,
.bpmn-shape.bpmn-selected .bpmn-event-body,
.bpmn-shape.bpmn-selected .bpmn-gw-body,
.bpmn-shape.bpmn-selected .bpmn-pool-body,
.bpmn-shape.bpmn-selected .bpmn-lane-body {
  stroke: var(--bpmn-highlight, #0066cc);
  stroke-width: 2.5;
}

.bpmn-shape-body,
.bpmn-event-body,
.bpmn-gw-body {
  fill: var(--bpmn-shape-fill, #ffffff);
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmn-end-body {
  fill: var(--bpmn-shape-fill, #ffffff);
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 3;
}
.bpmn-event-inner {
  fill: none;
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmn-event-inner-dashed {
  fill: none;
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 4 2;
}
.bpmn-eventsubprocess-body {
  fill: var(--bpmn-shape-fill, #ffffff);
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}
.bpmn-callactivity-body {
  fill: var(--bpmn-shape-fill, #ffffff);
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 3;
}

/* ── Icons ───────────────────────────────────────────────────────── */
.bpmn-icon {
  fill: none;
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.bpmn-icon-solid {
  fill: var(--bpmn-shape-stroke, #404040);
  stroke: none;
  pointer-events: none;
}
.bpmn-gw-marker {
  fill: var(--bpmn-shape-stroke, #404040);
  stroke: none;
  pointer-events: none;
}
.bpmn-gw-marker-stroke {
  fill: none;
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 2.5;
  stroke-linecap: round;
  pointer-events: none;
}

/* ── Pool / Lane ─────────────────────────────────────────────────── */
.bpmn-pool-body,
.bpmn-lane-body {
  fill: var(--bpmn-shape-fill, #ffffff);
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmn-pool-header,
.bpmn-lane-header {
  fill: var(--bpmn-pool-header, rgba(0,0,0,0.04));
  stroke: var(--bpmn-shape-stroke, #404040);
  stroke-width: 1.5;
}
[data-theme="dark"] .bpmn-pool-header,
[data-theme="dark"] .bpmn-lane-header {
  fill: rgba(255,255,255,0.06);
}

/* ── Message flow ─────────────────────────────────────────────────── */
.bpmn-msgflow-path {
  fill: none;
  stroke: var(--bpmn-flow-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
}

/* ── Edges ───────────────────────────────────────────────────────── */
.bpmn-edge {
  cursor: default;
}
.bpmn-edge-path {
  fill: none;
  stroke: var(--bpmn-flow-stroke, #404040);
  stroke-width: 1.5;
}
.bpmn-edge-assoc {
  fill: none;
  stroke: var(--bpmn-flow-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}
.bpmn-edge-default-slash {
  stroke: var(--bpmn-flow-stroke, #404040);
  stroke-width: 1.5;
}
.bpmn-arrow-fill {
  fill: var(--bpmn-flow-stroke, #404040);
}

/* ── Labels ─────────────────────────────────────────────────────── */
.bpmn-label {
  fill: var(--bpmn-text, #333333);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  /* White halo behind text so labels never visually merge with edge lines */
  paint-order: stroke;
  stroke: var(--bpmn-bg, #f8f9fa);
  stroke-width: 4px;
  stroke-linejoin: round;
}

/* ── Light theme (default) ───────────────────────────────────────── */
.bpmn-canvas-host {
  --bpmn-bg: #f8f9fa;
  --bpmn-grid: rgba(0, 0, 0, 0.14);
  --bpmn-shape-fill: #ffffff;
  --bpmn-shape-stroke: #404040;
  --bpmn-flow-stroke: #404040;
  --bpmn-text: #333333;
  --bpmn-highlight: #0066cc;
  --bpmn-focus: #0066cc;
  --bpmn-overlay-bg: rgba(248, 249, 250, 0.92);
  --bpmn-overlay-border: rgba(0, 0, 0, 0.12);
}

/* ── Dark theme ──────────────────────────────────────────────────── */
.bpmn-canvas-host[data-theme="dark"] {
  --bpmn-bg: #1e1e2e;
  --bpmn-grid: rgba(255, 255, 255, 0.07);
  --bpmn-shape-fill: #2a2a3e;
  --bpmn-shape-stroke: #8888bb;
  --bpmn-flow-stroke: #7777aa;
  --bpmn-text: #cdd6f4;
  --bpmn-highlight: #89b4fa;
  --bpmn-focus: #89b4fa;
  --bpmn-overlay-bg: rgba(30, 30, 46, 0.92);
  --bpmn-overlay-border: rgba(255, 255, 255, 0.1);
}
`

/**
 * Injects the canvas stylesheet into `<head>` if not already present.
 * Safe to call multiple times — only one `<style>` tag is ever inserted.
 */
export function injectStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CANVAS_CSS
	document.head.appendChild(style)
}
