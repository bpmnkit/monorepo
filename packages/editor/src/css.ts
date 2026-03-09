/** ID used to prevent duplicate style injection. */
export const EDITOR_STYLE_ID = "bpmn-editor-styles-v1"

/** ID used to prevent duplicate HUD style injection. */
export const HUD_STYLE_ID = "bpmn-editor-hud-styles-v1"

/** CSS for editor-specific overlays injected once into `<head>`. */
export const EDITOR_CSS = `
/* Selection outline */
.bpmn-sel-indicator {
  fill: none;
  stroke: #0066cc;
  stroke-width: 1.5;
  pointer-events: none;
}

/* Resize handle */
.bpmn-resize-handle {
  fill: #fff;
  stroke: #0066cc;
  stroke-width: 1.5;
  cursor: nwse-resize;
}
.bpmn-resize-handle[data-bpmn-handle="n"],
.bpmn-resize-handle[data-bpmn-handle="s"] {
  cursor: ns-resize;
}
.bpmn-resize-handle[data-bpmn-handle="e"],
.bpmn-resize-handle[data-bpmn-handle="w"] {
  cursor: ew-resize;
}
.bpmn-resize-handle[data-bpmn-handle="ne"],
.bpmn-resize-handle[data-bpmn-handle="sw"] {
  cursor: nesw-resize;
}
.bpmn-resize-handle[data-bpmn-handle="nw"],
.bpmn-resize-handle[data-bpmn-handle="se"] {
  cursor: nwse-resize;
}

/* Connection port */
.bpmn-conn-port {
  fill: #0066cc;
  stroke: none;
  cursor: crosshair;
  opacity: 0.7;
}
.bpmn-conn-port:hover {
  opacity: 1;
}

/* Rubber-band selection */
.bpmn-rubber-band {
  fill: rgba(0, 102, 204, 0.05);
  stroke: #0066cc;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Ghost element (create / connect preview) */
.bpmn-ghost {
  opacity: 0.45;
  pointer-events: none;
}

/* Ghost connection line */
.bpmn-ghost-conn {
  stroke: #0066cc;
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  fill: none;
  pointer-events: none;
}

/* Resize preview rect */
.bpmn-resize-preview {
  fill: rgba(0, 102, 204, 0.05);
  stroke: #0066cc;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Alignment guide lines (snap helpers) */
.bpmn-align-guide {
  stroke: #4c8ef7;
  stroke-width: 1;
  stroke-dasharray: 4 2;
  pointer-events: none;
}

/* Edge transparent hit area (wide stroke for easier clicking) */
.bpmn-edge-hitarea {
  fill: none;
  stroke: transparent;
  stroke-width: 12;
  cursor: pointer;
}

/* Edge hover dot (waypoint insertion indicator) */
.bpmn-edge-hover-dot {
  fill: #0066cc;
  stroke: #fff;
  stroke-width: 1.5;
  pointer-events: none;
  opacity: 0.85;
}
[data-theme="dark"] .bpmn-edge-hover-dot { fill: #4c8ef7; }

/* Edge waypoint angle balls (visible on edge hover) */
.bpmn-edge-waypoint-ball {
  fill: #0066cc;
  stroke: #fff;
  stroke-width: 1.5;
  cursor: move;
}
.bpmn-edge-waypoint-ball:hover { fill: #0052a3; }
[data-theme="dark"] .bpmn-edge-waypoint-ball { fill: #4c8ef7; }

/* Edge endpoint drag handles */
.bpmn-edge-endpoint {
  fill: #0066cc;
  stroke: #fff;
  stroke-width: 1.5;
  cursor: grab;
}
.bpmn-edge-endpoint:hover {
  fill: #0052a3;
}

/* Ghost polyline when dragging an edge endpoint */
.bpmn-endpoint-ghost {
  fill: none;
  stroke: #0066cc;
  stroke-width: 1.5;
  stroke-dasharray: 5 3;
  pointer-events: none;
}

/* Edge split target highlight (shown while dragging a shape over an edge) */
.bpmn-edge-split-highlight .bpmn-edge-path {
  stroke: #22c55e;
  stroke-width: 2.5;
}

/* Distance/spacing guide arrows */
.bpmn-dist-guide {
  stroke: #f97316;
  stroke-width: 1;
  fill: none;
  pointer-events: none;
}

/* Space tool split indicator line */
.bpmn-space-line {
  stroke: #f59e0b;
  stroke-width: 1.5;
  stroke-dasharray: 6 3;
  pointer-events: none;
}

/* Label editor */
.bpmn-label-editor {
  position: absolute;
  min-width: 40px;
  min-height: 16px;
  padding: 1px 3px;
  background: #fff;
  border: 1px solid #0066cc;
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
.bpmn-boundary-host {
  fill: none;
  stroke: #2563eb;
  stroke-width: 2;
  stroke-dasharray: 6 3;
  pointer-events: none;
  opacity: 0.7;
}

/* Duplicate-ID warning banner */
.bpmn-editor-warning-banner {
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
.bpmn-canvas-host[data-theme="dark"] .bpmn-editor-warning-banner {
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
 *  `data-bpmn-hud-theme="light"` on `document.body`. */
export const HUD_CSS = `
/* ── HUD base ────────────────────────────────────────────────────── */
.hud { position: fixed; z-index: 100; }

/* ── Dark theme (default) ────────────────────────────────────────── */
.panel {
  display: flex; align-items: center; gap: 2px; padding: 4px;
  background: rgba(22, 22, 30, 0.88);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
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
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
  padding: 0; flex-shrink: 0;
}
.hud-btn:hover  { background: rgba(255,255,255,0.08); color: #fff; }
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
.hud-sep { width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 2px; flex-shrink: 0; }

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
  position: fixed; display: none; flex-direction: column;
  gap: 1px; padding: 4px;
  background: rgba(20, 20, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
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
.drop-item .di-check { width: 14px; height: 14px; flex-shrink: 0; color: #4c8ef7; }
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
  position: fixed;
  display: flex; flex-direction: row;
  gap: 2px; padding: 4px;
  background: rgba(20, 20, 28, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
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
[data-bpmn-hud-theme="light"] .panel {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
[data-bpmn-hud-theme="light"] #hud-top-center.panel {
  background: transparent;
  backdrop-filter: none;
  border: none;
  box-shadow: none;
}
[data-bpmn-hud-theme="light"] .hud-btn { color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] .hud-btn:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .hud-btn.active { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.9); border-color: rgba(0,0,0,0.15); }
[data-bpmn-hud-theme="light"] .hud-btn:disabled:hover { background: transparent; color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] .hud-sep { background: rgba(0,0,0,0.1); }
[data-bpmn-hud-theme="light"] #btn-zoom-current { color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] #btn-zoom-current:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] #btn-zoom-pct {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.65);
}
[data-bpmn-hud-theme="light"] #btn-zoom-pct:hover { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .dropdown {
  background: rgba(252, 252, 254, 0.98);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .drop-item { color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .drop-item:hover { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .drop-sep { background: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .drop-label { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .group-picker {
  background: rgba(252, 252, 254, 0.98);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .group-picker-label {
  color: rgba(0,0,0,0.35);
  border-right-color: rgba(0,0,0,0.08);
}

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
[data-bpmn-hud-theme="light"] .ref-link-btn { color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] .ref-link-btn:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }

/* ── Color swatches ──────────────────────────────────────────────── */
.bpmn-color-swatches { display: flex; gap: 4px; padding: 2px 4px; align-items: center; }
.bpmn-color-swatch {
  width: 16px; height: 16px; border-radius: 50%; cursor: pointer;
  border: 2px solid transparent; flex-shrink: 0;
  transition: transform 0.1s;
  padding: 0;
}
.bpmn-color-swatch:hover { transform: scale(1.2); }
.bpmn-color-swatch.active { border-color: rgba(255,255,255,0.8); }
[data-bpmn-hud-theme="light"] .bpmn-color-swatch.active { border-color: rgba(0,0,0,0.5); }
.bpmn-color-swatch--default {
  background: transparent; border-color: rgba(255,255,255,0.25);
  position: relative; overflow: hidden;
}
[data-bpmn-hud-theme="light"] .bpmn-color-swatch--default { border-color: rgba(0,0,0,0.2); }
.bpmn-color-swatch--default::after {
  content: ''; position: absolute;
  top: 1px; left: 50%; transform: translateX(-50%) rotate(-45deg);
  width: 1.5px; height: calc(100% - 2px);
  background: rgba(200,50,50,0.65); border-radius: 1px;
}

/* ── Contextual Ask-AI button (tinted blue) ──────────────────────── */
.ctx-ask-ai-btn { color: rgba(120, 170, 255, 0.8); }
.ctx-ask-ai-btn:hover { background: rgba(76, 142, 247, 0.15); color: #a8c8ff; }
[data-bpmn-hud-theme="light"] .ctx-ask-ai-btn { color: rgba(26, 86, 219, 0.7); }
[data-bpmn-hud-theme="light"] .ctx-ask-ai-btn:hover { background: rgba(26, 86, 219, 0.08); color: #1a56db; }

/* ── New-diagram onboarding overlay ──────────────────────────────── */
#bpmn-empty-state {
  position: fixed; z-index: 50;
  top: 36px; left: 0; bottom: 0;
  right: calc(var(--bpmn-dock-width, 0px));
  display: flex; align-items: center; justify-content: center;
  background: #13131f;
}
[data-bpmn-hud-theme="light"] #bpmn-empty-state { background: #eeeef6; }

.bpmn-onboard-inner {
  display: flex; flex-direction: column; align-items: center;
  gap: 28px; padding: 24px; max-width: 580px; width: 100%;
}
.bpmn-onboard-header { text-align: center; }
.bpmn-onboard-title {
  color: rgba(255,255,255,0.82); font-size: 16px; font-weight: 600; margin: 0 0 7px;
}
.bpmn-onboard-sub {
  color: rgba(255,255,255,0.36); font-size: 13px; margin: 0;
}
[data-bpmn-hud-theme="light"] .bpmn-onboard-title { color: rgba(0,0,0,0.72); }
[data-bpmn-hud-theme="light"] .bpmn-onboard-sub   { color: rgba(0,0,0,0.38); }

.bpmn-onboard-actions { display: flex; gap: 10px; width: 100%; }

.bpmn-onboard-btn {
  flex: 1; display: flex; flex-direction: column; align-items: flex-start;
  gap: 10px; padding: 16px 14px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; cursor: pointer; text-align: left;
  color: inherit; transition: background 0.15s, border-color 0.15s;
}
.bpmn-onboard-btn:hover {
  background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.14);
}
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08);
}
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn:hover {
  background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.14);
}

.bpmn-onboard-btn-icon {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 8px;
  background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.65); flex-shrink: 0;
}
.bpmn-onboard-btn-icon svg { width: 16px; height: 16px; pointer-events: none; }
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn-icon {
  background: rgba(0,0,0,0.07); color: rgba(0,0,0,0.55);
}

.bpmn-onboard-btn--ai .bpmn-onboard-btn-icon {
  background: rgba(76,142,247,0.18); color: #8ab8ff;
}
.bpmn-onboard-btn--ai:hover { border-color: rgba(76,142,247,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn--ai .bpmn-onboard-btn-icon {
  background: rgba(26,86,219,0.1); color: #1a56db;
}
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn--ai:hover { border-color: rgba(26,86,219,0.28); }

.bpmn-onboard-btn-label { display: flex; flex-direction: column; gap: 3px; }
.bpmn-onboard-btn-title {
  font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.8); margin: 0;
}
.bpmn-onboard-btn-desc {
  font-size: 11px; color: rgba(255,255,255,0.32); margin: 0; line-height: 1.4;
}
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn-title { color: rgba(0,0,0,0.72); }
[data-bpmn-hud-theme="light"] .bpmn-onboard-btn-desc  { color: rgba(0,0,0,0.36); }

.bpmn-onboard-links { display: flex; gap: 16px; flex-wrap: wrap; justify-content: center; }
.bpmn-onboard-links a {
  color: rgba(255,255,255,0.22); font-size: 11px; text-decoration: none; transition: color 0.1s;
}
.bpmn-onboard-links a:hover { color: rgba(255,255,255,0.55); }
[data-bpmn-hud-theme="light"] .bpmn-onboard-links a { color: rgba(0,0,0,0.25); }
[data-bpmn-hud-theme="light"] .bpmn-onboard-links a:hover { color: rgba(0,0,0,0.6); }

@media (max-width: 520px) {
  .bpmn-onboard-actions { flex-direction: column; }
  .bpmn-onboard-btn { flex-direction: row; align-items: center; gap: 12px; }
  .bpmn-onboard-btn-label { flex-direction: column; }
}

/* ── Mobile: collapsible center toolbars ─────────────────────────── */
#btn-bc-toggle, #btn-tc-toggle { display: none; }

@media (max-width: 600px) {
  #btn-bc-toggle, #btn-tc-toggle { display: flex; }

  /* Collapsed: hide all children except the toggle button */
  #hud-bottom-center:not(.expanded) > *:not(#btn-bc-toggle) { display: none; }
  #hud-top-center:not(.expanded) > *:not(#btn-tc-toggle) { display: none; }

  /* Expanded: highlight the toggle button as a close affordance */
  #hud-bottom-center.expanded #btn-bc-toggle,
  #hud-top-center.expanded #btn-tc-toggle {
    background: rgba(255,255,255,0.08); color: #fff;
  }
  [data-bpmn-hud-theme="light"] #hud-bottom-center.expanded #btn-bc-toggle,
  [data-bpmn-hud-theme="light"] #hud-top-center.expanded #btn-tc-toggle {
    background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9);
  }
}
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
