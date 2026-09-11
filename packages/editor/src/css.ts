import { injectChromeStyles } from "./chrome.js"

/** ID used to prevent duplicate style injection. */
export const EDITOR_STYLE_ID = "bpmnkit-editor-styles-v1"

/** ID used to prevent duplicate HUD style injection. */
export const HUD_STYLE_ID = "bpmnkit-editor-hud-styles-v1"

/** CSS for editor-specific overlays injected once into `<head>`. */
export const EDITOR_CSS = `
/* Visually-hidden live region for screen-reader announcements */
.bpmnkit-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Keyboard-focus ring on the editor host — distinct from the selection outline */
.bpmnkit-canvas-host:focus-visible {
  outline: 2px dashed var(--bpmnkit-ds-accent, #a8503a);
  outline-offset: -2px;
}

/* Selection outline */
.bpmnkit-sel-indicator {
  fill: none;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 1;
  stroke-dasharray: 4 3;
  pointer-events: none;
}

/* Resize handle */
.bpmnkit-resize-handle {
  fill: #fff;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 1.5;
  cursor: nwse-resize;
}
.bpmnkit-resize-handle[data-bpmnkit-handle="n"],
.bpmnkit-resize-handle[data-bpmnkit-handle="s"] {
  cursor: ns-resize;
}
.bpmnkit-resize-handle[data-bpmnkit-handle="e"],
.bpmnkit-resize-handle[data-bpmnkit-handle="w"] {
  cursor: ew-resize;
}
.bpmnkit-resize-handle[data-bpmnkit-handle="ne"],
.bpmnkit-resize-handle[data-bpmnkit-handle="sw"] {
  cursor: nesw-resize;
}
.bpmnkit-resize-handle[data-bpmnkit-handle="nw"],
.bpmnkit-resize-handle[data-bpmnkit-handle="se"] {
  cursor: nwse-resize;
}

/* Connection port */
.bpmnkit-conn-port {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  stroke: none;
  cursor: crosshair;
  opacity: 0.7;
}
.bpmnkit-conn-port:hover {
  opacity: 1;
}

/* Rubber-band selection */
.bpmnkit-rubber-band {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  fill-opacity: 0.06;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Ghost element (create / connect preview) */
.bpmnkit-ghost {
  opacity: 0.45;
  pointer-events: none;
}

/* Ghost connection line */
.bpmnkit-ghost-conn {
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  fill: none;
  pointer-events: none;
}

/* Ghost connection over a target the rules forbid */
.bpmnkit-ghost-conn-invalid {
  stroke: var(--bpmnkit-danger, #dc2626);
}

/* Resize preview rect */
.bpmnkit-resize-preview {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  fill-opacity: 0.06;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Alignment guide lines (snap helpers) */
.bpmnkit-align-guide {
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 1;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Edge transparent hit area (wide stroke for easier clicking) */
.bpmnkit-edge-hitarea {
  fill: none;
  stroke: transparent;
  stroke-width: 12;
  cursor: pointer;
}

/* Edge hover dot (waypoint insertion indicator) */
.bpmnkit-edge-hover-dot {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  stroke: #fff;
  stroke-width: 1.5;
  pointer-events: none;
  opacity: 0.85;
}
[data-theme="dark"] .bpmnkit-edge-hover-dot { fill: var(--bpmnkit-ds-accent-on-dark, #c9755c); }

/* Edge waypoint angle balls (visible on edge hover) */
.bpmnkit-edge-waypoint-ball {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  stroke: #fff;
  stroke-width: 1.5;
  cursor: move;
}
.bpmnkit-edge-waypoint-ball:hover { fill: var(--bpmnkit-ds-accent, #a8503a); }
[data-theme="dark"] .bpmnkit-edge-waypoint-ball { fill: var(--bpmnkit-ds-accent-on-dark, #c9755c); }

/* Edge endpoint drag handles */
.bpmnkit-edge-endpoint {
  fill: var(--bpmnkit-ds-accent, #a8503a);
  stroke: #fff;
  stroke-width: 1.5;
  cursor: grab;
}
.bpmnkit-edge-endpoint:hover {
  fill: var(--bpmnkit-ds-accent, #a8503a);
}

/* Ghost polyline when dragging an edge endpoint */
.bpmnkit-endpoint-ghost {
  fill: none;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
  pointer-events: none;
}

/* Edge split target highlight (shown while dragging a shape over an edge) */
.bpmnkit-edge-split-highlight .bpmnkit-edge-path {
  stroke: var(--bpmnkit-success, #22c55e);
  stroke-width: 2.5;
}

/* Distance/spacing guide arrows */
.bpmnkit-dist-guide {
  stroke: var(--bpmnkit-warn, #f97316);
  stroke-width: 1;
  fill: none;
  pointer-events: none;
}

/* Space tool split indicator line */
.bpmnkit-space-line {
  stroke: var(--bpmnkit-warn, #f59e0b);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  pointer-events: none;
}

/* Label editor */
.bpmnkit-label-editor {
  position: absolute;
  min-width: 40px;
  min-height: 16px;
  padding: 1px 3px;
  background: #fff;
  border: 1px solid var(--bpmnkit-ds-accent, #a8503a);
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  font-size: 11px;
  text-align: center;
  outline: none;
  z-index: 10;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Boundary event attach highlight */
.bpmnkit-boundary-host {
  fill: none;
  stroke: var(--bpmnkit-ds-accent, #a8503a);
  stroke-width: 2;
  stroke-dasharray: 6 3;
  pointer-events: none;
  opacity: 0.7;
}

/* Duplicate-ID warning banner */
.bpmnkit-editor-warning-banner {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  max-width: calc(100% - 32px);
  padding: 6px 12px;
  background: #fef3c7;
  border: 1px solid #f59e0b;
  color: #92400e;
  font-size: 12px;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-canvas-host[data-theme="dark"] .bpmnkit-editor-warning-banner {
  background: #451a03;
  border-color: #d97706;
  color: #fde68a;
}

/* Coarse pointers (touch): enlarge drag targets to a finger-friendly ≥24px.
   Resize handles are 7px rects centred on the corner; grow + recentre them.
   Endpoint / waypoint / port circles grow via the SVG geometry 'r' property. */
@media (pointer: coarse) {
  .bpmnkit-resize-handle {
    width: 24px;
    height: 24px;
    transform: translate(-8.5px, -8.5px);
  }
  .bpmnkit-edge-endpoint,
  .bpmnkit-edge-waypoint-ball,
  .bpmnkit-conn-port {
    r: 12px;
  }
}
`

/** Injects the editor stylesheet into `<head>` if not already present. */
export function injectEditorStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(EDITOR_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = EDITOR_STYLE_ID
	style.textContent = EDITOR_CSS
	document.head.appendChild(style)
}

/** CSS for the editor HUD — panels, buttons, dropdowns, group picker.
 *  Flat, square and hairline-ruled per the bpmnkit.com design system.
 *  Dark ground is the default; `data-bpmnkit-hud-theme="light"` (or
 *  `"neon"`) on `document.body` switches it. */
export const HUD_CSS = `
/* ── HUD chrome ──────────────────────────────────────────────────────
   The bpmnkit.com design system applied to the editor's chrome: flat
   (no shadow, gradient or blur), square, and bounded by 1px hairlines.
   The per-theme grounds it reads are declared once in chrome.ts.
   The diagram itself is renderer-owned and untouched by this sheet.
   ──────────────────────────────────────────────────────────────────── */
.hud { position: absolute; z-index: 100; }

/* A toolbar or palette is ONE bordered box with internal hairlines —
   never individually bordered buttons and never gaps. */
.panel {
  display: flex; align-items: stretch;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  /* Stated, not inherited: hosts differ on whether they set a global reset. */
  box-sizing: border-box;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
}


/* ── HUD positions ───────────────────────────────────────────────── */
/* Sits in the tab bar's centre slot: a 28px group with 4px clear of the bar's
   own rules top and bottom, so the two borders never sit on each other. */
#hud-top-center    { top: 3px; left: 50%; transform: translateX(-50%); height: 30px; }
#hud-bottom-left   { bottom: 16px; left: 16px; }
#hud-bottom-center { bottom: 16px; left: 50%; transform: translateX(-50%); }
#ctx-toolbar { display: none; transform: translateX(-50%); }
#cfg-toolbar { display: none; transform: translate(-50%, -100%); }

/* ── Icon buttons ────────────────────────────────────────────────── */
.hud-btn {
  display: flex; align-items: center; justify-content: center;
  width: 34px; height: 28px;
  background: transparent;
  border: none;
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  padding: 0; flex-shrink: 0;
  font-family: inherit;
  font-size: 13px;
  /* Never let a Unicode glyph be promoted to a colour emoji. */
  font-variant-emoji: text;
}
.hud-btn:hover  { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.hud-btn.active { background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg); }
.hud-btn:disabled { opacity: 0.3; cursor: default; }
.hud-btn:disabled:hover { background: transparent; color: var(--bpmnkit-chrome-ink-2); }
.hud-btn svg { width: 16px; height: 16px; pointer-events: none; }

/* The palette's targets are a touch larger than the toolbar's; the zoom
   cluster shares the palette's height so the bottom strip reads as one row. */
#hud-bottom-center .hud-btn { width: 36px; height: 32px; }
#hud-bottom-left .hud-btn { height: 32px; }

/* One hairline BETWEEN adjacent items, never on a group's outer edge — so a
   group's ends stay clean and an explicit .hud-sep never doubles up with one.
   Declared after the button rules on purpose: they zero their own borders, and
   the .panel-plus-id form outranks the id-scoped zoom buttons. */
.panel > * + *,
.panel #tool-groups > * + *,
.panel #zoom-expanded > * + * { border-left: 1px solid var(--bpmnkit-chrome-line-soft); }
/* The mobile collapse toggles are hidden siblings on desktop, so the item after
   one would otherwise draw a hairline flush against the group's own border. */
#hud-top-center > #btn-tc-toggle + *,
#hud-bottom-center > #btn-bc-toggle + * { border-left: none; }

/* ── Group button: small marker at the bottom-right corner ───────── */
.hud-btn[data-group] { position: relative; }
.hud-btn[data-group]::after {
  content: '';
  position: absolute; bottom: 3px; right: 3px;
  width: 0; height: 0;
  border-left: 3px solid transparent;
  border-top: 3px solid currentColor;
  opacity: 0.55;
}

/* ── Tool groups container ───────────────────────────────────────── */
#tool-groups { display: flex; align-items: stretch; }

/* ── Separator — a structural rule, not a soft internal one ──────── */
.hud-sep {
  width: 1px; flex: none; align-self: stretch;
  background: var(--bpmnkit-chrome-line);
  border-left: none;
}
.panel > .hud-sep + * { border-left: none; }

/* ── Zoom widget ─────────────────────────────────────────────────── */
#btn-zoom-current {
  padding: 0 12px; height: 32px;
  background: transparent; border: none;
  color: var(--bpmnkit-chrome-ink-2); cursor: pointer;
  font-family: inherit; font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
#btn-zoom-current:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }

#zoom-expanded { display: none; align-items: stretch; }
#zoom-expanded.open { display: flex; }

#btn-zoom-pct {
  padding: 0 10px; height: 32px;
  background: transparent; border: none;
  color: var(--bpmnkit-chrome-ink-2); cursor: pointer;
  font-family: inherit; font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap; min-width: 60px; text-align: center;
}
#btn-zoom-pct:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }

/* ── Dropdown menus ──────────────────────────────────────────────── */
.dropdown {
  position: absolute; display: none; flex-direction: column;
  padding: 0;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  z-index: 200; min-width: 170px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
}
.dropdown.open { display: flex; }

.drop-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 12px;
  border: none; background: transparent;
  color: var(--bpmnkit-chrome-ink-2); cursor: pointer;
  font-family: inherit; font-size: 12px; text-align: left; width: 100%;
  font-variant-emoji: text;
}
.drop-item:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.drop-item .di-check { width: 14px; height: 14px; flex-shrink: 0; color: var(--bpmnkit-chrome-accent); }
.drop-item .di-icon  { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.7; }
.drop-item svg { width: 14px; height: 14px; }
.drop-sep { height: 1px; background: var(--bpmnkit-chrome-line-soft); }
.drop-label {
  padding: 8px 12px 6px;
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  color: var(--bpmnkit-chrome-ink-4); text-transform: uppercase;
}

/* ── Group element picker ────────────────────────────────────────── */
.group-picker {
  position: absolute;
  display: flex; flex-direction: row; align-items: stretch;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  z-index: 300;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
}
.group-picker-label {
  display: flex; align-items: center;
  padding: 0 10px;
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  color: var(--bpmnkit-chrome-ink-4); text-transform: uppercase;
  white-space: nowrap;
  border-right: 1px solid var(--bpmnkit-chrome-line);
}

/* ── Reference link button (wider text variant of hud-btn) ──────── */
.ref-link-btn {
  height: 28px; padding: 0 10px;
  background: transparent;
  border: none;
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  font-family: inherit; font-size: 12px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}
.ref-link-btn:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }

/* ── Colour swatches — element fills, exempt from the one-accent rule ── */
.bpmnkit-color-swatches { display: flex; gap: 4px; padding: 0 8px; align-items: center; }
.bpmnkit-color-swatch {
  width: 16px; height: 16px; cursor: pointer;
  border: 1px solid var(--bpmnkit-chrome-line); flex-shrink: 0;
  padding: 0;
}
.bpmnkit-color-swatch.active { border-color: var(--bpmnkit-chrome-accent); }
.bpmnkit-color-swatch--default {
  background: transparent;
  position: relative; overflow: hidden;
}
.bpmnkit-color-swatch--default::after {
  content: ''; position: absolute;
  top: 0; left: 50%; transform: translateX(-50%) rotate(-45deg);
  width: 1px; height: 100%;
  background: currentColor; color: var(--bpmnkit-chrome-ink-4);
}

/* ── Contextual Ask-AI button ────────────────────────────────────── */
.ctx-ask-ai-btn { color: var(--bpmnkit-chrome-accent); }
.ctx-ask-ai-btn:hover { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-accent); }

/* ── New-diagram onboarding overlay ──────────────────────────────── */
#bpmnkit-empty-state {
  position: absolute; z-index: 50;
  top: 36px; left: 0; bottom: 0; right: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bpmnkit-bg, #0d0d16);
}
[data-bpmnkit-hud-theme="light"] #bpmnkit-empty-state { background: var(--bpmnkit-ds-canvas, #fbfbfc); }
[data-bpmnkit-hud-theme="neon"] #bpmnkit-empty-state { background: oklch(5% 0.025 270); }

.bpmnkit-onboard-inner {
  display: flex; flex-direction: column; align-items: center;
  gap: 28px; padding: 24px; max-width: 580px; width: 100%;
}
.bpmnkit-onboard-header { text-align: center; }
.bpmnkit-onboard-title {
  color: var(--bpmnkit-chrome-ink); font-size: 17px; font-weight: 700;
  letter-spacing: -0.025em; margin: 0 0 8px;
}
.bpmnkit-onboard-sub {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4); margin: 0;
}

/* One bordered box subdivided by hairlines — not gapped cards. */
.bpmnkit-onboard-actions {
  display: flex; width: 100%;
  border: 1px solid var(--bpmnkit-chrome-line); background: var(--bpmnkit-chrome-ground);
}

.bpmnkit-onboard-btn {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start;
  gap: 12px; padding: 18px 16px;
  background: transparent;
  border: none; border-right: 1px solid var(--bpmnkit-chrome-line-soft);
  cursor: pointer; text-align: left;
  color: inherit;
}
.bpmnkit-onboard-btn:last-child { border-right: none; }
.bpmnkit-onboard-btn:hover { background: var(--bpmnkit-chrome-hover); }

.bpmnkit-onboard-btn-icon {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  border: 1px solid var(--bpmnkit-chrome-line); color: var(--bpmnkit-chrome-ink-2); flex-shrink: 0;
}
.bpmnkit-onboard-btn-icon svg { width: 16px; height: 16px; pointer-events: none; }
.bpmnkit-onboard-btn--ai .bpmnkit-onboard-btn-icon { color: var(--bpmnkit-chrome-accent); border-color: var(--bpmnkit-chrome-accent); }

.bpmnkit-onboard-btn-label { display: flex; flex-direction: column; gap: 4px; }
.bpmnkit-onboard-btn-title {
  font-size: 14px; font-weight: 700; color: var(--bpmnkit-chrome-ink); margin: 0;
}
.bpmnkit-onboard-btn-desc {
  font-size: 12px; color: var(--bpmnkit-chrome-ink-4); margin: 0; line-height: 1.5;
}

.bpmnkit-onboard-links { display: flex; gap: 18px; flex-wrap: wrap; justify-content: center; }
.bpmnkit-onboard-links a {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  color: var(--bpmnkit-chrome-ink-4); font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase; text-decoration: none;
}
.bpmnkit-onboard-links a:hover { color: var(--bpmnkit-chrome-accent); }

@media (max-width: 520px) {
  .bpmnkit-onboard-actions { flex-direction: column; }
  .bpmnkit-onboard-btn { flex-direction: row; align-items: center; gap: 12px; border-right: none; border-bottom: 1px solid var(--bpmnkit-chrome-line-soft); }
  .bpmnkit-onboard-btn:last-child { border-bottom: none; }
  .bpmnkit-onboard-btn-label { flex-direction: column; }
}

/* ── Top-center overflow guard ───────────────────────────────────── */
#hud-top-center {
  max-width: calc(100% - 24px);
  overflow-x: auto; overflow-y: visible;
  scrollbar-width: none;
}
#hud-top-center::-webkit-scrollbar { display: none; }

/* ── Push HUD toolbar down when simulation banner is visible ─────── */
.bpmnkit-sim-active #hud-top-center { top: 39px; }

/* ── Simulation active banner ────────────────────────────────────── */
#bpmnkit-sim-banner {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 150;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 8px 16px;
  background: var(--bpmnkit-chrome-ground);
  border-bottom: 1px solid var(--bpmnkit-chrome-accent);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-accent);
  pointer-events: auto;
}
#bpmnkit-sim-banner.hidden { display: none; }
#bpmnkit-sim-banner-exit {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid var(--bpmnkit-chrome-accent);
  color: inherit; cursor: pointer;
  font-family: inherit; font-size: inherit; letter-spacing: inherit;
}
#bpmnkit-sim-banner-exit:hover { background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg); }

/* ── Context menu ────────────────────────────────────────────────── */
#bpmnkit-ctx-menu { min-width: 170px; }

/* ── Element search bar ──────────────────────────────────────────── */
#bpmnkit-search-bar {
  position: absolute;
  top: 44px; left: 50%; transform: translateX(-50%);
  z-index: 120;
  display: flex; align-items: center; gap: 10px;
  padding: 6px 12px;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
}
#bpmnkit-search-bar.hidden { display: none; }
#bpmnkit-search-input {
  width: 220px; padding: 2px 0;
  background: transparent; border: none;
  color: var(--bpmnkit-chrome-ink); font-family: inherit; font-size: 12.5px; outline: none;
}
#bpmnkit-search-input::placeholder { color: var(--bpmnkit-chrome-ink-4); }
#bpmnkit-search-count {
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  color: var(--bpmnkit-chrome-ink-4); white-space: nowrap; min-width: 44px;
}
#bpmnkit-search-close {
  background: transparent; border: none; color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer; font-family: inherit; font-size: 14px; line-height: 1; padding: 0 2px;
  font-variant-emoji: text;
}
#bpmnkit-search-close:hover { color: var(--bpmnkit-chrome-ink); }

/* ── Keyboard shortcuts modal ────────────────────────────────────── */
#bpmnkit-shortcuts-modal {
  position: absolute; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: color-mix(in srgb, var(--bpmnkit-ds-dark, #14161a) 55%, transparent);
}
#bpmnkit-shortcuts-modal.hidden { display: none; }
#bpmnkit-shortcuts-inner {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 24px 26px;
  min-width: 320px; max-width: 480px;
  color: var(--bpmnkit-chrome-ink-2);
}
#bpmnkit-shortcuts-inner h3 {
  margin: 0 0 16px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  text-transform: uppercase; font-weight: 400; color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-sc-row {
  display: flex; justify-content: space-between; align-items: center; gap: 24px;
  padding: 7px 0; border-bottom: 1px solid var(--bpmnkit-chrome-line-soft); font-size: 12.5px;
}
.bpmnkit-sc-row:last-child { border-bottom: none; }
.bpmnkit-sc-key {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 1px 7px; font-size: 11px; color: var(--bpmnkit-chrome-ink);
  white-space: nowrap;
}
#bpmnkit-shortcuts-close {
  display: block; margin: 18px auto 0; padding: 7px 20px;
  background: var(--bpmnkit-ds-accent, #a8503a); border: none;
  color: #fff; cursor: pointer;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace); font-size: 12px;
}
#bpmnkit-shortcuts-close:hover { background: var(--bpmnkit-ds-accent-hover, #8f412e); }

/* ── Mobile: collapsible center toolbars ─────────────────────────── */
#btn-bc-toggle, #btn-tc-toggle { display: none; }

@media (max-width: 600px) {
  #hud-top-center { display: none !important; }
  #hud-bottom-left { display: none !important; }

  #hud-bottom-center {
    left: 16px;
    transform: none;
  }

  #btn-bc-toggle { display: flex; }
  #hud-bottom-center > #btn-bc-toggle + * { border-left: 1px solid var(--bpmnkit-chrome-line-soft); }

  /* Collapsed: hide all children except the toggle button */
  #hud-bottom-center:not(.expanded) > *:not(#btn-bc-toggle) { display: none; }

  /* Expanded: highlight the toggle button as a close affordance */
  #hud-bottom-center.expanded #btn-bc-toggle {
    background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg);
  }
}

/* Hide bottom toolbar on welcome screen */
.bpmnkit-welcome-active #hud-bottom-center { display: none !important; }
`

/** Injects the HUD stylesheet into `<head>` if not already present. */
export function injectHudStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(HUD_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = HUD_STYLE_ID
	style.textContent = HUD_CSS
	document.head.appendChild(style)
}
