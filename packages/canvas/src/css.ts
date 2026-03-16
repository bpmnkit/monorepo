/** ID used to prevent duplicate style injection. */
export const STYLE_ID = "bpmnkit-canvas-styles-v1"

/** Complete CSS for the BpmnCanvas component, injected once into `<head>`. */
export const CANVAS_CSS = `
.bpmnkit-canvas-host {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  -webkit-user-select: none;
  user-select: none;
  touch-action: none;
  background: var(--bpmnkit-bg, #f8f9fa);
}
.bpmnkit-canvas-host *,
.bpmnkit-canvas-host *::before,
.bpmnkit-canvas-host *::after {
  box-sizing: border-box;
}
.bpmnkit-canvas-host > svg {
  display: block;
  width: 100%;
  height: 100%;
  cursor: default;
}
.bpmnkit-canvas-host.is-panning > svg {
  cursor: grabbing;
}
.bpmnkit-canvas-host > svg:focus {
  outline: none;
}

/* ── Shapes ─────────────────────────────────────────────────────── */
.bpmnkit-shape {
  cursor: pointer;
  outline: none;
}
.bpmnkit-shape:focus .bpmnkit-shape-body,
.bpmnkit-shape:focus .bpmnkit-event-body,
.bpmnkit-shape:focus .bpmnkit-gw-body,
.bpmnkit-shape:focus .bpmnkit-pool-body,
.bpmnkit-shape:focus .bpmnkit-lane-body {
  stroke: var(--bpmnkit-focus, #0066cc);
  stroke-width: 2.5;
}
.bpmnkit-shape.bpmnkit-selected .bpmnkit-shape-body,
.bpmnkit-shape.bpmnkit-selected .bpmnkit-event-body,
.bpmnkit-shape.bpmnkit-selected .bpmnkit-gw-body,
.bpmnkit-shape.bpmnkit-selected .bpmnkit-pool-body,
.bpmnkit-shape.bpmnkit-selected .bpmnkit-lane-body {
  stroke: var(--bpmnkit-highlight, #0066cc);
  stroke-width: 2.5;
}

.bpmnkit-shape-body,
.bpmnkit-event-body,
.bpmnkit-gw-body {
  fill: var(--bpmnkit-shape-fill, #ffffff);
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmnkit-end-body {
  fill: var(--bpmnkit-shape-fill, #ffffff);
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 3;
}
.bpmnkit-event-inner {
  fill: none;
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmnkit-event-inner-dashed {
  fill: none;
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 4 2;
}
.bpmnkit-eventsubprocess-body {
  fill: var(--bpmnkit-shape-fill, #ffffff);
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}
.bpmnkit-callactivity-body {
  fill: var(--bpmnkit-shape-fill, #ffffff);
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 3;
}

/* ── Icons ───────────────────────────────────────────────────────── */
.bpmnkit-icon {
  fill: none;
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  pointer-events: none;
}
.bpmnkit-icon-solid {
  fill: var(--bpmnkit-shape-stroke, #404040);
  stroke: none;
  pointer-events: none;
}
.bpmnkit-gw-marker {
  fill: var(--bpmnkit-shape-stroke, #404040);
  stroke: none;
  pointer-events: none;
}
.bpmnkit-gw-marker-stroke {
  fill: none;
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 2.5;
  stroke-linecap: round;
  pointer-events: none;
}

/* ── Pool / Lane ─────────────────────────────────────────────────── */
.bpmnkit-pool-body,
.bpmnkit-lane-body {
  fill: var(--bpmnkit-shape-fill, #ffffff);
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
}
.bpmnkit-pool-header,
.bpmnkit-lane-header {
  fill: var(--bpmnkit-pool-header, rgba(0,0,0,0.04));
  stroke: var(--bpmnkit-shape-stroke, #404040);
  stroke-width: 1.5;
}
[data-theme="dark"] .bpmnkit-pool-header,
[data-theme="dark"] .bpmnkit-lane-header {
  fill: rgba(255,255,255,0.06);
}

/* ── Message flow ─────────────────────────────────────────────────── */
.bpmnkit-msgflow-path {
  fill: none;
  stroke: var(--bpmnkit-flow-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
}

/* ── Edges ───────────────────────────────────────────────────────── */
.bpmnkit-edge {
  cursor: pointer;
}
.bpmnkit-edge-path {
  fill: none;
  stroke: var(--bpmnkit-flow-stroke, #404040);
  stroke-width: 1.5;
}
.bpmnkit-edge-assoc {
  fill: none;
  stroke: var(--bpmnkit-flow-stroke, #404040);
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
}
.bpmnkit-edge-default-slash {
  stroke: var(--bpmnkit-flow-stroke, #404040);
  stroke-width: 1.5;
}
.bpmnkit-arrow-fill {
  fill: var(--bpmnkit-flow-stroke, #404040);
}

/* ── Labels ─────────────────────────────────────────────────────── */
.bpmnkit-label {
  fill: var(--bpmnkit-text, #333333);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 11px;
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
  /* White halo behind text so labels never visually merge with edge lines */
  paint-order: stroke;
  stroke: var(--bpmnkit-bg, #f8f9fa);
  stroke-width: 4px;
  stroke-linejoin: round;
}

/* ── Light theme (default) ───────────────────────────────────────── */
.bpmnkit-canvas-host {
  --bpmnkit-bg: #f8f9fa;
  --bpmnkit-grid: rgba(0, 0, 0, 0.14);
  --bpmnkit-shape-fill: #ffffff;
  --bpmnkit-shape-stroke: #404040;
  --bpmnkit-flow-stroke: #404040;
  --bpmnkit-text: var(--bpmnkit-fg, #333333);
  --bpmnkit-highlight: var(--bpmnkit-accent, #1a56db);
  --bpmnkit-focus: #0066cc;
  --bpmnkit-overlay-bg: rgba(248, 249, 250, 0.92);
  --bpmnkit-overlay-border: rgba(0, 0, 0, 0.12);
}

/* ── Dark theme ──────────────────────────────────────────────────── */
.bpmnkit-canvas-host[data-theme="dark"] {
  --bpmnkit-bg: #0d0d16;
  --bpmnkit-grid: rgba(255, 255, 255, 0.07);
  --bpmnkit-shape-fill: #1e1e2e;
  --bpmnkit-shape-stroke: #8888bb;
  --bpmnkit-flow-stroke: #7777aa;
  --bpmnkit-text: var(--bpmnkit-fg, #cdd6f4);
  --bpmnkit-highlight: var(--bpmnkit-accent-bright, #89b4fa);
  --bpmnkit-focus: #89b4fa;
  --bpmnkit-overlay-bg: rgba(30, 30, 46, 0.92);
  --bpmnkit-overlay-border: rgba(255, 255, 255, 0.1);
}
.bpmnkit-canvas-host[data-theme="dark"] .bpmnkit-edge-hover-dot { fill: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-canvas-host[data-theme="dark"] .bpmnkit-edge-waypoint-ball { fill: var(--bpmnkit-accent, #6b9df7); }

/* ── Neon theme ──────────────────────────────────────────────────── */
.bpmnkit-canvas-host[data-theme="neon"] {
  --bpmnkit-bg: oklch(5% 0.025 270);
  --bpmnkit-grid: oklch(65% 0.28 280 / 0.22);
  --bpmnkit-shape-fill: oklch(7% 0.03 270 / 0.9);
  --bpmnkit-shape-stroke: oklch(65% 0.28 280);
  --bpmnkit-flow-stroke: oklch(72% 0.18 185);
  --bpmnkit-text: oklch(88% 0.02 270);
  --bpmnkit-highlight: oklch(72% 0.18 185);
  --bpmnkit-focus: oklch(65% 0.28 280);
  --bpmnkit-overlay-bg: oklch(8% 0.03 270 / 0.96);
  --bpmnkit-overlay-border: oklch(65% 0.28 280 / 0.25);
}
.bpmnkit-canvas-host[data-theme="neon"] .bpmnkit-pool-header,
.bpmnkit-canvas-host[data-theme="neon"] .bpmnkit-lane-header {
  fill: oklch(65% 0.28 280 / 0.07);
}
.bpmnkit-canvas-host[data-theme="neon"] .bpmnkit-edge-hover-dot { fill: oklch(72% 0.18 185); }
.bpmnkit-canvas-host[data-theme="neon"] .bpmnkit-edge-waypoint-ball { fill: oklch(72% 0.18 185); }
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
