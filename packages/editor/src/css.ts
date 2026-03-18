/** ID used to prevent duplicate style injection. */
export const EDITOR_STYLE_ID = "bpmnkit-editor-styles-v1"

/** ID used to prevent duplicate HUD style injection. */
export const HUD_STYLE_ID = "bpmnkit-editor-hud-styles-v1"

/** CSS for editor-specific overlays injected once into `<head>`. */
export const EDITOR_CSS = `
/* Selection outline */
.bpmnkit-sel-indicator {
  fill: none;
  stroke: var(--bpmnkit-accent, #1a56db);
  stroke-width: 1.5;
  pointer-events: none;
}

/* Resize handle */
.bpmnkit-resize-handle {
  fill: #fff;
  stroke: var(--bpmnkit-accent, #1a56db);
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
  fill: var(--bpmnkit-accent, #1a56db);
  stroke: none;
  cursor: crosshair;
  opacity: 0.7;
}
.bpmnkit-conn-port:hover {
  opacity: 1;
}

/* Rubber-band selection */
.bpmnkit-rubber-band {
  fill: rgba(0, 102, 204, 0.05);
  stroke: var(--bpmnkit-accent, #1a56db);
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
  stroke: var(--bpmnkit-accent, #1a56db);
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  fill: none;
  pointer-events: none;
}

/* Resize preview rect */
.bpmnkit-resize-preview {
  fill: rgba(0, 102, 204, 0.05);
  stroke: var(--bpmnkit-accent, #1a56db);
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Alignment guide lines (snap helpers) */
.bpmnkit-align-guide {
  stroke: var(--bpmnkit-accent-bright, #6b9df7);
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
  fill: var(--bpmnkit-accent, #1a56db);
  stroke: #fff;
  stroke-width: 1.5;
  pointer-events: none;
  opacity: 0.85;
}
[data-theme="dark"] .bpmnkit-edge-hover-dot { fill: var(--bpmnkit-accent, #6b9df7); }

/* Edge waypoint angle balls (visible on edge hover) */
.bpmnkit-edge-waypoint-ball {
  fill: var(--bpmnkit-accent, #1a56db);
  stroke: #fff;
  stroke-width: 1.5;
  cursor: move;
}
.bpmnkit-edge-waypoint-ball:hover { fill: var(--bpmnkit-accent, #1a56db); }
[data-theme="dark"] .bpmnkit-edge-waypoint-ball { fill: var(--bpmnkit-accent, #6b9df7); }

/* Edge endpoint drag handles */
.bpmnkit-edge-endpoint {
  fill: var(--bpmnkit-accent, #1a56db);
  stroke: #fff;
  stroke-width: 1.5;
  cursor: grab;
}
.bpmnkit-edge-endpoint:hover {
  fill: var(--bpmnkit-accent, #1a56db);
}

/* Ghost polyline when dragging an edge endpoint */
.bpmnkit-endpoint-ghost {
  fill: none;
  stroke: var(--bpmnkit-accent, #1a56db);
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
  border: 1px solid var(--bpmnkit-accent, #1a56db);
  border-radius: 2px;
  font-family: system-ui, -apple-system, sans-serif;
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
  stroke: var(--bpmnkit-accent, #1a56db);
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
  border-radius: 6px;
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
`

/** Injects the editor stylesheet into `<head>` if not already present. */
export function injectEditorStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(EDITOR_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = EDITOR_STYLE_ID
	style.textContent = EDITOR_CSS
	document.head.appendChild(style)
}

/** CSS for the editor HUD — panels, buttons, dropdowns, group picker.
 *  Dark theme is the default. Light theme is activated by setting
 *  `data-bpmnkit-hud-theme="light"` on `document.body`. */
export const HUD_CSS = `
/* ── HUD base ────────────────────────────────────────────────────── */
.hud { position: absolute; z-index: 100; }

/* ── Dark theme (default) ────────────────────────────────────────── */
.panel {
  display: flex; align-items: center; gap: 2px; padding: 4px;
  background: var(--bpmnkit-panel-bg, rgba(13, 13, 22, 0.92));
  backdrop-filter: blur(10px);
  border: 1px solid var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.35);
}

/* ── HUD positions ───────────────────────────────────────────────── */
#hud-top-center    { top: 0; left: 50%; transform: translateX(-50%); height: 36px; }
#hud-bottom-left   { bottom: 10px; left: 10px; }
#hud-bottom-center { bottom: 10px; left: 50%; transform: translateX(-50%); }
#ctx-toolbar { display: none; transform: translateX(-50%); }
#cfg-toolbar { display: none; transform: translate(-50%, -100%); }

/* ── Top center: strip floating card, merge into tab bar ─────────── */
#hud-top-center.panel {
  background: transparent;
  backdrop-filter: none;
  border: none;
  border-radius: 0;
  box-shadow: none;
  padding: 0 2px;
  /* Pass clicks through the transparent background to the tab bar center slot. */
  pointer-events: none;
}
#hud-top-center.panel > * {
  pointer-events: auto;
}

/* ── Icon buttons ────────────────────────────────────────────────── */
.hud-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--bpmnkit-fg-muted, rgba(255,255,255,0.6));
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  padding: 0; flex-shrink: 0;
}
.hud-btn:hover  { background: rgba(255,255,255,0.08); color: var(--bpmnkit-fg, #cdd6f4); }
.hud-btn.active { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.2); }
.hud-btn:disabled { opacity: 0.28; cursor: default; }
.hud-btn:disabled:hover { background: transparent; color: rgba(255,255,255,0.6); }
.hud-btn svg { width: 16px; height: 16px; pointer-events: none; }

/* ── Group button: small chevron at bottom-right corner ──────────── */
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
#tool-groups { display: flex; align-items: center; gap: 2px; }

/* ── Separator ───────────────────────────────────────────────────── */
.hud-sep { width: 1px; height: 20px; background: var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08)); margin: 0 2px; flex-shrink: 0; }

/* ── Zoom widget ─────────────────────────────────────────────────── */
#btn-zoom-current {
  padding: 0 10px; height: 32px;
  background: transparent; border: 1px solid transparent; border-radius: 7px;
  color: rgba(255,255,255,0.6); cursor: pointer;
  font-size: 12px; font-weight: 600;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap;
}
#btn-zoom-current:hover { background: rgba(255,255,255,0.08); color: #fff; }

#zoom-expanded { display: none; align-items: center; gap: 2px; }
#zoom-expanded.open { display: flex; }

#btn-zoom-pct {
  padding: 0 8px; height: 30px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  color: rgba(255,255,255,0.75); cursor: pointer;
  font-size: 12px; font-weight: 600;
  transition: background 0.1s, color 0.1s;
  white-space: nowrap; min-width: 60px; text-align: center;
}
#btn-zoom-pct:hover { background: rgba(255,255,255,0.12); color: #fff; }

/* ── Dropdown menus ──────────────────────────────────────────────── */
.dropdown {
  position: absolute; display: none; flex-direction: column;
  gap: 1px; padding: 4px;
  background: var(--bpmnkit-panel-bg, rgba(13, 13, 22, 0.92));
  backdrop-filter: blur(12px);
  border: 1px solid var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08));
  border-radius: 9px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  z-index: 200; min-width: 150px;
}
.dropdown.open { display: flex; }

.drop-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border: none; background: transparent;
  color: rgba(255,255,255,0.75); cursor: pointer;
  border-radius: 6px; font-size: 12px; text-align: left; width: 100%;
  transition: background 0.1s;
}
.drop-item:hover { background: rgba(255,255,255,0.08); color: #fff; }
.drop-item .di-check { width: 14px; height: 14px; flex-shrink: 0; color: var(--bpmnkit-accent, #6b9df7); }
.drop-item .di-icon  { width: 14px; height: 14px; flex-shrink: 0; opacity: 0.7; }
.drop-item svg { width: 14px; height: 14px; }
.drop-sep { height: 1px; background: rgba(255,255,255,0.08); margin: 3px 0; }
.drop-label {
  padding: 4px 10px 2px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.06em;
  color: rgba(255,255,255,0.3); text-transform: uppercase;
}

/* ── Group element picker ────────────────────────────────────────── */
.group-picker {
  position: absolute;
  display: flex; flex-direction: row;
  gap: 2px; padding: 4px;
  background: var(--bpmnkit-panel-bg, rgba(13, 13, 22, 0.92));
  backdrop-filter: blur(12px);
  border: 1px solid var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08));
  border-radius: 9px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  z-index: 300;
}
.group-picker-label {
  padding: 2px 6px 4px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.05em;
  color: rgba(255,255,255,0.3); text-transform: uppercase;
  white-space: nowrap; align-self: center;
  border-right: 1px solid rgba(255,255,255,0.08);
  margin-right: 2px;
}

/* ── Light theme overrides ───────────────────────────────────────── */
[data-bpmnkit-hud-theme="light"] .panel {
  background: var(--bpmnkit-panel-bg, rgba(255,255,255,0.92));
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
[data-bpmnkit-hud-theme="light"] #hud-top-center.panel {
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
}
[data-bpmnkit-hud-theme="light"] .hud-btn { color: var(--bpmnkit-fg-muted, #6666a0); }
[data-bpmnkit-hud-theme="light"] .hud-btn:hover { background: rgba(0,0,0,0.06); color: var(--bpmnkit-fg, #1a1a2e); }
[data-bpmnkit-hud-theme="light"] .hud-btn.active { background: rgba(0,0,0,0.08); color: var(--bpmnkit-fg, #1a1a2e); border-color: rgba(0,0,0,0.15); }
[data-bpmnkit-hud-theme="light"] .hud-btn:disabled:hover { background: transparent; color: var(--bpmnkit-fg-muted, #6666a0); }
[data-bpmnkit-hud-theme="light"] .hud-sep { background: var(--bpmnkit-panel-border, rgba(0,0,0,0.08)); }
[data-bpmnkit-hud-theme="light"] #btn-zoom-current { color: var(--bpmnkit-fg-muted, #6666a0); }
[data-bpmnkit-hud-theme="light"] #btn-zoom-current:hover { background: rgba(0,0,0,0.06); color: var(--bpmnkit-fg, #1a1a2e); }
[data-bpmnkit-hud-theme="light"] #btn-zoom-pct {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: var(--bpmnkit-fg-muted, #6666a0);
}
[data-bpmnkit-hud-theme="light"] #btn-zoom-pct:hover { background: rgba(0,0,0,0.08); color: var(--bpmnkit-fg, #1a1a2e); }
[data-bpmnkit-hud-theme="light"] .dropdown {
  background: var(--bpmnkit-panel-bg, rgba(255,255,255,0.92));
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
}
[data-bpmnkit-hud-theme="light"] .drop-item { color: var(--bpmnkit-fg-muted, #6666a0); }
[data-bpmnkit-hud-theme="light"] .drop-item:hover { background: rgba(0,0,0,0.05); color: var(--bpmnkit-fg, #1a1a2e); }
[data-bpmnkit-hud-theme="light"] .drop-sep { background: var(--bpmnkit-border, #d0d0e8); }
[data-bpmnkit-hud-theme="light"] .drop-label { color: rgba(0,0,0,0.35); }
[data-bpmnkit-hud-theme="light"] .group-picker {
  background: var(--bpmnkit-panel-bg, rgba(255,255,255,0.92));
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
}
[data-bpmnkit-hud-theme="light"] .group-picker-label {
  color: rgba(0,0,0,0.35);
  border-right-color: rgba(0,0,0,0.08);
}

/* ── Neon theme overrides ────────────────────────────────────────── */
[data-bpmnkit-hud-theme="neon"] .panel {
  background: oklch(8% 0.03 270 / 0.96);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 2px 16px oklch(65% 0.28 280 / 0.12), 0 0 0 1px oklch(65% 0.28 280 / 0.1);
}
[data-bpmnkit-hud-theme="neon"] #hud-top-center.panel {
  background: transparent; backdrop-filter: none; border: none; box-shadow: none;
}
[data-bpmnkit-hud-theme="neon"] .hud-btn { color: oklch(65% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .hud-btn:hover { background: oklch(65% 0.28 280 / 0.12); color: oklch(88% 0.02 270); }
[data-bpmnkit-hud-theme="neon"] .hud-btn.active { background: oklch(65% 0.28 280 / 0.18); color: oklch(73% 0.16 280); border-color: oklch(65% 0.28 280 / 0.35); }
[data-bpmnkit-hud-theme="neon"] .hud-sep { background: oklch(65% 0.28 280 / 0.15); }
[data-bpmnkit-hud-theme="neon"] .dropdown {
  background: oklch(8% 0.03 270 / 0.97);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 6px 24px oklch(0% 0 0 / 0.6), 0 0 0 1px oklch(65% 0.28 280 / 0.1);
}
[data-bpmnkit-hud-theme="neon"] .drop-item { color: oklch(65% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .drop-item:hover { background: oklch(65% 0.28 280 / 0.1); color: oklch(88% 0.02 270); }
[data-bpmnkit-hud-theme="neon"] .drop-sep { background: oklch(65% 0.28 280 / 0.15); }
[data-bpmnkit-hud-theme="neon"] .drop-label { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .group-picker {
  background: oklch(8% 0.03 270 / 0.97);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 6px 24px oklch(0% 0 0 / 0.6);
}
[data-bpmnkit-hud-theme="neon"] .group-picker-label { color: oklch(50% 0.06 280); border-right-color: oklch(65% 0.28 280 / 0.15); }

/* ── Reference link button (wider text variant of hud-btn) ──────── */
.ref-link-btn {
  height: 32px; padding: 0 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  font-size: 12px;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
  align-self: center;
}
.ref-link-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
[data-bpmnkit-hud-theme="light"] .ref-link-btn { color: var(--bpmnkit-fg-muted, #6666a0); }
[data-bpmnkit-hud-theme="light"] .ref-link-btn:hover { background: rgba(0,0,0,0.06); color: var(--bpmnkit-fg, #1a1a2e); }

/* ── Color swatches ──────────────────────────────────────────────── */
.bpmnkit-color-swatches { display: flex; gap: 4px; padding: 2px 4px; align-items: center; }
.bpmnkit-color-swatch {
  width: 16px; height: 16px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; flex-shrink: 0;
  transition: transform 0.1s;
  padding: 0;
}
.bpmnkit-color-swatch:hover { transform: scale(1.2); }
.bpmnkit-color-swatch.active { border-color: rgba(255,255,255,0.8); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-color-swatch.active { border-color: rgba(0,0,0,0.5); }
.bpmnkit-color-swatch--default {
  background: transparent; border-color: rgba(255,255,255,0.25);
  position: relative; overflow: hidden;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-color-swatch--default { border-color: rgba(0,0,0,0.2); }
.bpmnkit-color-swatch--default::after {
  content: ''; position: absolute;
  top: 1px; left: 50%; transform: translateX(-50%) rotate(-45deg);
  width: 1.5px; height: calc(100% - 2px);
  background: rgba(200,50,50,0.65); border-radius: 1px;
}

/* ── Contextual Ask-AI button (tinted blue) ──────────────────────── */
.ctx-ask-ai-btn { color: var(--bpmnkit-accent-bright, #89b4fa); opacity: 0.8; }
.ctx-ask-ai-btn:hover { background: rgba(76, 142, 247, 0.15); color: #a8c8ff; opacity: 1; }
[data-bpmnkit-hud-theme="light"] .ctx-ask-ai-btn { color: var(--bpmnkit-accent, #1a56db); opacity: 0.7; }
[data-bpmnkit-hud-theme="light"] .ctx-ask-ai-btn:hover { background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)); color: var(--bpmnkit-accent, #1a56db); opacity: 1; }

/* ── New-diagram onboarding overlay ──────────────────────────────── */
#bpmnkit-empty-state {
  position: absolute; z-index: 50;
  top: 36px; left: 0; bottom: 0; right: 0;
  display: flex; align-items: center; justify-content: center;
  background: var(--bpmnkit-bg, #0d0d16);
}
[data-bpmnkit-hud-theme="light"] #bpmnkit-empty-state { background: var(--bpmnkit-bg, #f4f4f8); }
[data-bpmnkit-hud-theme="neon"] #bpmnkit-empty-state { background: oklch(5% 0.025 270); }

.bpmnkit-onboard-inner {
  display: flex; flex-direction: column; align-items: center;
  gap: 28px; padding: 24px; max-width: 580px; width: 100%;
}
.bpmnkit-onboard-header { text-align: center; }
.bpmnkit-onboard-title {
  color: rgba(255,255,255,0.82); font-size: 16px; font-weight: 600; margin: 0 0 7px;
}
.bpmnkit-onboard-sub {
  color: rgba(255,255,255,0.36); font-size: 13px; margin: 0;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-title { color: rgba(0,0,0,0.72); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-sub   { color: rgba(0,0,0,0.38); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-title { color: oklch(88% 0.02 270); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-sub   { color: oklch(50% 0.06 280); }

.bpmnkit-onboard-actions { display: flex; gap: 10px; width: 100%; }

.bpmnkit-onboard-btn {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start;
  gap: 10px; padding: 16px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; cursor: pointer; text-align: left;
  color: inherit; transition: background 0.15s, border-color 0.15s;
}
.bpmnkit-onboard-btn:hover {
  background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn:hover {
  background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.14);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn {
  background: oklch(65% 0.28 280 / 0.05); border-color: oklch(65% 0.28 280 / 0.15);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn:hover {
  background: oklch(65% 0.28 280 / 0.1); border-color: oklch(65% 0.28 280 / 0.28);
}

.bpmnkit-onboard-btn-icon {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.65); flex-shrink: 0;
}
.bpmnkit-onboard-btn-icon svg { width: 16px; height: 16px; pointer-events: none; }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn-icon {
  background: rgba(0,0,0,0.07); color: rgba(0,0,0,0.55);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn-icon {
  background: oklch(65% 0.28 280 / 0.1); color: oklch(73% 0.16 280);
}

.bpmnkit-onboard-btn--ai .bpmnkit-onboard-btn-icon {
  background: rgba(76,142,247,0.18); color: #8ab8ff;
}
.bpmnkit-onboard-btn--ai:hover { border-color: rgba(76,142,247,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn--ai .bpmnkit-onboard-btn-icon {
  background: rgba(26,86,219,0.1); color: #1a56db;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn--ai:hover { border-color: rgba(26,86,219,0.28); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn--ai .bpmnkit-onboard-btn-icon {
  background: oklch(72% 0.18 185 / 0.15); color: oklch(72% 0.18 185);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn--ai:hover { border-color: oklch(72% 0.18 185 / 0.35); }

.bpmnkit-onboard-btn-label { display: flex; flex-direction: column; gap: 3px; }
.bpmnkit-onboard-btn-title {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0;
}
.bpmnkit-onboard-btn-desc {
  font-size: 11px; color: rgba(255,255,255,0.32); margin: 0; line-height: 1.4;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn-title { color: rgba(0,0,0,0.72); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-btn-desc  { color: rgba(0,0,0,0.36); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn-title { color: oklch(82% 0.04 270); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-btn-desc  { color: oklch(50% 0.06 280); }

.bpmnkit-onboard-links { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.bpmnkit-onboard-links a {
  color: rgba(255,255,255,0.22); font-size: 11px; text-decoration: none; transition: color 0.1s;
}
.bpmnkit-onboard-links a:hover { color: rgba(255,255,255,0.55); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-links a { color: rgba(0,0,0,0.25); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-onboard-links a:hover { color: rgba(0,0,0,0.6); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-links a { color: oklch(45% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-onboard-links a:hover { color: oklch(65% 0.1 280); }

@media (max-width: 520px) {
  .bpmnkit-onboard-actions { flex-direction: column; }
  .bpmnkit-onboard-btn { flex-direction: row; align-items: center; gap: 12px; }
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
.bpmnkit-sim-active #hud-top-center { top: 36px; }

/* ── Simulation active banner ────────────────────────────────────── */
#bpmnkit-sim-banner {
  position: absolute;
  top: 0; left: 0; right: 0;
  z-index: 150;
  display: flex; align-items: center; justify-content: center; gap: 12px;
  padding: 7px 16px;
  background: rgba(217, 119, 6, 0.18);
  border-bottom: 1px solid rgba(217, 119, 6, 0.35);
  backdrop-filter: blur(6px);
  font-size: 12px; font-weight: 500;
  color: rgba(255, 193, 87, 0.95);
  pointer-events: auto;
}
#bpmnkit-sim-banner.hidden { display: none; }
#bpmnkit-sim-banner-exit {
  padding: 3px 10px; border-radius: 5px;
  background: rgba(217, 119, 6, 0.22);
  border: 1px solid rgba(217, 119, 6, 0.4);
  color: inherit; cursor: pointer; font-size: 11px; font-weight: 600;
  transition: background 0.1s;
}
#bpmnkit-sim-banner-exit:hover { background: rgba(217, 119, 6, 0.35); }
[data-bpmnkit-hud-theme="light"] #bpmnkit-sim-banner {
  background: rgba(254, 243, 199, 0.95);
  border-bottom-color: rgba(217, 119, 6, 0.25);
  color: #92400e;
}
[data-bpmnkit-hud-theme="light"] #bpmnkit-sim-banner-exit {
  background: rgba(217, 119, 6, 0.1); border-color: rgba(217, 119, 6, 0.3);
}

/* ── Context menu ────────────────────────────────────────────────── */
#bpmnkit-ctx-menu { min-width: 160px; }

/* ── Element search bar ──────────────────────────────────────────── */
#bpmnkit-search-bar {
  position: absolute;
  top: 44px; left: 50%; transform: translateX(-50%);
  z-index: 120;
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  background: rgba(22, 22, 30, 0.92);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
#bpmnkit-search-bar.hidden { display: none; }
#bpmnkit-search-input {
  width: 220px; padding: 3px 6px;
  background: transparent; border: none;
  color: #fff; font-size: 13px; outline: none;
}
#bpmnkit-search-input::placeholder { color: rgba(255,255,255,0.35); }
#bpmnkit-search-count {
  font-size: 11px; color: rgba(255,255,255,0.45); white-space: nowrap; min-width: 40px;
}
#bpmnkit-search-close {
  background: transparent; border: none; color: rgba(255,255,255,0.4);
  cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px;
}
#bpmnkit-search-close:hover { color: #fff; }
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-bar {
  background: rgba(252, 252, 254, 0.96);
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 4px 16px rgba(0,0,0,0.12);
}
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-input { color: rgba(0,0,0,0.9); }
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-input::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-count { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-close { color: rgba(0,0,0,0.35); }
[data-bpmnkit-hud-theme="light"] #bpmnkit-search-close:hover { color: rgba(0,0,0,0.8); }

/* ── Keyboard shortcuts modal ────────────────────────────────────── */
#bpmnkit-shortcuts-modal {
  position: absolute; inset: 0; z-index: 200;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(4px);
}
#bpmnkit-shortcuts-modal.hidden { display: none; }
#bpmnkit-shortcuts-inner {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-panel-border, rgba(255,255,255,0.08));
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  padding: 20px 24px;
  min-width: 320px; max-width: 480px;
  color: rgba(255,255,255,0.85);
}
[data-bpmnkit-hud-theme="light"] #bpmnkit-shortcuts-inner {
  background: var(--bpmnkit-surface, #fff);
  border-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  color: rgba(0,0,0,0.8);
}
#bpmnkit-shortcuts-inner h3 { margin: 0 0 14px; font-size: 14px; font-weight: 700; }
.bpmnkit-sc-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 12px;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-sc-row { border-bottom-color: rgba(0,0,0,0.06); }
.bpmnkit-sc-row:last-child { border-bottom: none; }
.bpmnkit-sc-key {
  font-family: var(--font-mono, monospace);
  background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px; padding: 1px 6px; font-size: 11px;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-sc-key {
  background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.12); color: rgba(0,0,0,0.7);
}
#bpmnkit-shortcuts-close {
  display: block; margin: 14px auto 0; padding: 6px 20px;
  background: var(--bpmnkit-surface-2, rgba(255,255,255,0.08)); border: 1px solid var(--bpmnkit-panel-border, rgba(255,255,255,0.08));
  border-radius: 6px; color: rgba(255,255,255,0.7); cursor: pointer; font-size: 12px;
  transition: background 0.1s;
}
#bpmnkit-shortcuts-close:hover { background: rgba(255,255,255,0.14); color: #fff; }
[data-bpmnkit-hud-theme="light"] #bpmnkit-shortcuts-close {
  background: var(--bpmnkit-surface-2, rgba(0,0,0,0.05)); border-color: var(--bpmnkit-border, #d0d0e8); color: rgba(0,0,0,0.6);
}

/* ── Mobile: collapsible center toolbars ─────────────────────────── */
#btn-bc-toggle, #btn-tc-toggle { display: none; }

@media (max-width: 600px) {
  #hud-top-center { display: none !important; }
  #hud-bottom-left { display: none !important; }

  #hud-bottom-center {
    left: 10px;
    transform: none;
  }

  #btn-bc-toggle { display: flex; }

  /* Collapsed: hide all children except the toggle button */
  #hud-bottom-center:not(.expanded) > *:not(#btn-bc-toggle) { display: none; }

  /* Expanded: highlight the toggle button as a close affordance */
  #hud-bottom-center.expanded #btn-bc-toggle {
    background: rgba(255,255,255,0.08); color: #fff;
  }
  [data-bpmnkit-hud-theme="light"] #hud-bottom-center.expanded #btn-bc-toggle {
    background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9);
  }
}

/* Hide bottom toolbar on welcome screen */
.bpmnkit-welcome-active #hud-bottom-center { display: none !important; }
`

/** Injects the HUD stylesheet into `<head>` if not already present. */
export function injectHudStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(HUD_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = HUD_STYLE_ID
	style.textContent = HUD_CSS
	document.head.appendChild(style)
}
