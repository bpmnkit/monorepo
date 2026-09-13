import { injectStyle } from "@bpmnkit/ui"

const OPERATE_STYLE_ID = "bpmnkit-operate-styles-v3"

/**
 * Operate's layout CSS, on the bpmnkit.com design system.
 *
 * Colours, type and spacing are the `--bpmnkit-ds-*` tokens `@bpmnkit/ui` owns
 * — the same set the landing site, Drop and the editor chrome read — so Operate
 * looks like the product it is part of rather than a dashboard that happens to
 * ship beside it. Call `injectUiStyles()` before this.
 *
 * Dark and the white-label `neon` theme are expressed by **redeclaring the DS
 * tokens on `.op-root`** rather than by a second set of variables. Every rule
 * below, and every shared component from `@bpmnkit/ui` rendered inside the
 * root, then themes itself with no further work; and because the declaration is
 * scoped to `.op-root`, nothing outside Operate sees it.
 *
 * The system's form, which the rules below are required to keep:
 *   · square — no `border-radius` anywhere in the chrome
 *   · flat — no shadow, gradient or blur; depth is a 1px hairline
 *   · one accent, and mono for every label, count, id and status readout
 *   · grids are one bordered box subdivided by hairlines, never gapped cards
 *
 * Semantic colour is exempt, as it is everywhere else in the repo: incident and
 * status state, and the chart's series, carry their own hues.
 */
const OPERATE_CSS = `
/* ── Layout ─────────────────────────────────────────────────────────────── */
.op-root {
  font-family: var(--bpmnkit-ds-font-sans);
  font-size: var(--bpmnkit-ds-t-body-sm);
  color: var(--bpmnkit-ds-ink);
  background: var(--bpmnkit-ds-bg);
  height: 100%;

  /* Chrome measurements the DS does not name. */
  --op-nav-width: 216px;
  --op-accent-subtle: rgba(168, 80, 58, 0.1);

  /* Series colours for the activity chart — data, not chrome, so exempt from
     the one-accent rule. Tuned to sit beside the accent rather than shout. */
  --op-c-amber: #b07a1e;
  --op-c-green: #3f7d5c;
  --op-c-purple: #6a5f9c;
}

/* Dark: the DS tokens themselves are redeclared, so the shared components
   follow without knowing a theme exists. */
.op-root[data-theme="dark"] {
  --bpmnkit-ds-bg: #0f1114;
  --bpmnkit-ds-surface: #16181d;
  --bpmnkit-ds-canvas: #16181d;
  --bpmnkit-ds-ink: #f4f5f7;
  --bpmnkit-ds-ink-2: #c8ccd2;
  --bpmnkit-ds-ink-3: #a6acb5;
  --bpmnkit-ds-ink-4: #8b929c;
  --bpmnkit-ds-line: #2c3038;
  --bpmnkit-ds-line-soft: #22252b;
  --bpmnkit-ds-line-strong: #3a3f48;
  --bpmnkit-ds-accent: #c9755c;
  --bpmnkit-ds-accent-hover: #d98a72;
  --op-accent-subtle: rgba(201, 117, 92, 0.14);
  --op-c-amber: #e8a54e;
  --op-c-green: #4fbd8b;
  --op-c-purple: #9d93d8;
}

/* Neon stays a deliberate white-label theme and keeps its own hue, the way the
   editor's chrome does. */
.op-root[data-theme="neon"] {
  --bpmnkit-ds-bg: oklch(8% 0.025 270);
  --bpmnkit-ds-surface: oklch(11% 0.03 270);
  --bpmnkit-ds-canvas: oklch(11% 0.03 270);
  --bpmnkit-ds-ink: oklch(90% 0.02 270);
  --bpmnkit-ds-ink-2: oklch(76% 0.06 275);
  --bpmnkit-ds-ink-3: oklch(66% 0.07 278);
  --bpmnkit-ds-ink-4: oklch(56% 0.08 280);
  --bpmnkit-ds-line: oklch(65% 0.28 280 / 0.26);
  --bpmnkit-ds-line-soft: oklch(65% 0.28 280 / 0.14);
  --bpmnkit-ds-line-strong: oklch(65% 0.28 280 / 0.45);
  --bpmnkit-ds-accent: oklch(72% 0.18 185);
  --bpmnkit-ds-accent-hover: oklch(80% 0.18 185);
  --op-accent-subtle: oklch(72% 0.18 185 / 0.14);
  --op-c-amber: #e8a54e;
  --op-c-green: #3bba7c;
  --op-c-purple: #a07cf5;
}
.op-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}
.op-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.op-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */
/* A rail on the page ground, separated by the one hairline the system allows —
   not a dark slab. Items are mono, the way every label on the site is, and the
   active one is marked by an accent rule rather than a filled pill. */
.op-nav {
  width: var(--op-nav-width);
  background: var(--bpmnkit-ds-bg);
  display: flex;
  flex-direction: column;
  padding: 0;
  flex-shrink: 0;
  border-right: 1px solid var(--bpmnkit-ds-line);
}
.op-nav-logo {
  display: flex;
  align-items: baseline;
  gap: var(--bpmnkit-ds-sp-2);
  height: var(--bpmnkit-ds-topbar-height);
  padding: 0 var(--bpmnkit-ds-sp-4);
  font-family: var(--bpmnkit-ds-font-mono);
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  flex-shrink: 0;
}
.op-logo-mark {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--bpmnkit-ds-ink);
}
.op-logo-kit { color: var(--bpmnkit-ds-accent); }
.op-logo-app {
  font-size: var(--bpmnkit-ds-t-mono-micro);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--bpmnkit-ds-ink-4);
}
.op-nav-list {
  list-style: none;
  padding: var(--bpmnkit-ds-sp-2) 0;
  margin: 0;
  display: flex;
  flex-direction: column;
}
.op-nav-item {
  display: flex;
  align-items: center;
  gap: var(--bpmnkit-ds-sp-2);
  width: 100%;
  padding: 7px var(--bpmnkit-ds-sp-4);
  background: none;
  border: none;
  border-left: 2px solid transparent;
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: var(--bpmnkit-ds-t-mono-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  text-align: left;
  transition: color 0.15s, border-color 0.15s;
}
.op-nav-item:hover {
  color: var(--bpmnkit-ds-ink);
}
.op-nav-item--active {
  border-left-color: var(--bpmnkit-ds-accent);
  color: var(--bpmnkit-ds-accent);
}
.op-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}
.op-nav-icon svg { width: 100%; height: 100%; pointer-events: none; }

/* ── Header ─────────────────────────────────────────────────────────────── */
.op-header {
  height: var(--bpmnkit-ds-topbar-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bpmnkit-ds-surface);
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  flex-shrink: 0;
}
/* Mono and spaced like the site's eyebrows, but not uppercased: the title
   carries an instance key on a detail page, and pi-1 is not PI-1. */
.op-header-title {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: var(--bpmnkit-ds-t-mono-eyebrow);
  font-weight: 400;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-ds-ink);
  margin: 0;
}
.op-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.op-profile-select {
  background: var(--bpmnkit-ds-bg);
  color: var(--bpmnkit-ds-ink);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-profile-select:focus { border-color: var(--bpmnkit-ds-accent); }

/* ── Filter bar ──────────────────────────────────────────────────────────── */
.op-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.op-proc-filter-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
}
.op-proc-filter-label { font-size: 12px; color: var(--bpmnkit-ds-ink-3); white-space: nowrap; }
.op-proc-filter-select {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 3px 8px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-sans);
  max-width: 200px;
}
.op-proc-filter-select:focus { outline: none; border-color: var(--bpmnkit-ds-accent); }

/* ── Process breadcrumb ──────────────────────────────────────────────────── */
.op-proc-breadcrumb { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; }
.op-proc-root { color: var(--bpmnkit-ds-ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-proc-sep { color: var(--bpmnkit-ds-ink-3); opacity: 0.5; flex-shrink: 0; }
.op-proc-leaf { color: var(--bpmnkit-ds-ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-filter-btn {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 4px 12px;
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: var(--bpmnkit-ds-t-mono-label);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.op-filter-btn:hover {
  color: var(--bpmnkit-ds-ink);
  border-color: var(--bpmnkit-ds-line-strong);
}
.op-filter-btn--active {
  background: var(--op-accent-subtle);
  border-color: var(--bpmnkit-ds-accent);
  color: var(--bpmnkit-ds-accent);
}

/* ── Card grid ───────────────────────────────────────────────────────────── */
/* One bordered box subdivided by hairlines. The 1px gap over the line colour is
   how the system draws a grid — gapped cards with their own borders would read
   as five objects where there is one readout. */
.op-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1px;
  background: var(--bpmnkit-ds-line);
  border: 1px solid var(--bpmnkit-ds-line);
  margin-bottom: var(--bpmnkit-ds-sp-5);
}

/* ── Dashboard metric card ───────────────────────────────────────────────── */
.op-dash-card {
  background: var(--bpmnkit-ds-surface);
  padding: var(--bpmnkit-ds-sp-4) var(--bpmnkit-ds-sp-4) var(--bpmnkit-ds-sp-5);
  display: flex;
  flex-direction: column;
  gap: var(--bpmnkit-ds-sp-3);
  cursor: pointer;
  transition: background 0.15s;
}
.op-dash-card:hover {
  background: var(--bpmnkit-ds-bg);
}
.op-dash-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--bpmnkit-ds-sp-2);
}
.op-dash-card-label {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: var(--bpmnkit-ds-t-mono-label);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-ds-ink-4);
  line-height: 1.4;
  margin-top: 2px;
}
/* The icon is a mark, not a tile: no filled chip, and it takes the card's own
   accent so a metric in an alarming state reads before the number does. */
.op-dash-card-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--accent, var(--bpmnkit-ds-ink-4));
  display: flex;
  align-items: center;
  justify-content: center;
}
.op-dash-card-icon svg {
  width: 16px;
  height: 16px;
  display: block;
}
.op-dash-card-value {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 32px;
  font-weight: 400;
  line-height: 1;
  color: var(--accent, var(--bpmnkit-ds-ink));
  letter-spacing: -0.02em;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.op-loading {
  padding: 40px;
  text-align: center;
  color: var(--bpmnkit-ds-ink-3);
  font-size: 13px;
}

/* ── Instance detail ─────────────────────────────────────────────────────── */
.op-instance-detail {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.op-breadcrumb { margin-bottom: 10px; }
.op-back-btn {
  background: none;
  border: none;
  color: var(--bpmnkit-ds-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-back-btn:hover { text-decoration: underline; }
.op-instance-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.op-instance-key {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  background: var(--bpmnkit-ds-bg);
  padding: 2px 8px;
}
.op-instance-biz {
  font-weight: 600;
  color: var(--bpmnkit-ds-ink);
}
.op-instance-time {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
}
.op-detail-layout {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}
.op-detail-canvas {
  flex: 1;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  overflow: hidden;
  min-height: 0;
}
.op-detail-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  overflow: hidden;
}
.op-detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--bpmnkit-ds-line);
}
.op-detail-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-detail-tab:hover { color: var(--bpmnkit-ds-ink); }
.op-detail-tab--active {
  color: var(--bpmnkit-ds-ink);
  border-bottom-color: var(--bpmnkit-ds-accent);
}
.op-detail-panel {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}
/* ── Variables panel ─────────────────────────────────────────────────────── */
.op-var-panel { padding: 0; }
.op-var-controls {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--bpmnkit-ds-surface);
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  padding: 10px 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.op-var-controls-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.op-var-controls-sep { flex: 1; }
.op-var-sort-btn {
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--bpmnkit-ds-ink);
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-var-sort-btn:hover { border-color: var(--bpmnkit-ds-accent); color: var(--bpmnkit-ds-accent); }
.op-var-type-btn {
  background: none;
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 2px 7px;
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-mono);
}
.op-var-type-btn:hover { color: var(--bpmnkit-ds-ink); border-color: var(--bpmnkit-ds-accent); }
.op-var-type-btn--active { background: var(--bpmnkit-ds-accent); border-color: var(--bpmnkit-ds-accent); color: #fff; }
.op-var-controls .op-search { max-width: 100%; }
.op-var-list { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
.op-var-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; background: var(--bpmnkit-ds-bg); min-width: 0; }
.op-var-row--clickable { cursor: pointer; }
.op-var-row--clickable:hover { background: var(--bpmnkit-ds-line-soft); outline: 1px solid var(--bpmnkit-ds-line); }
.op-var-name { font-family: var(--bpmnkit-ds-font-mono); font-size: 12px; color: var(--bpmnkit-ds-ink); flex-shrink: 0; }
.op-var-type {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 10px;
  padding: 1px 4px;
  flex-shrink: 0;
  opacity: 0.75;
}
.op-var-type--string { background: color-mix(in srgb, var(--op-c-green) 15%, transparent); color: var(--op-c-green); }
.op-var-type--number { background: color-mix(in srgb, var(--op-c-amber) 15%, transparent); color: var(--op-c-amber); }
.op-var-type--boolean { background: color-mix(in srgb, var(--op-c-purple) 15%, transparent); color: var(--op-c-purple); }
.op-var-type--json { background: color-mix(in srgb, var(--bpmnkit-ds-accent) 15%, transparent); color: var(--bpmnkit-ds-accent); }
.op-var-type--null { background: var(--bpmnkit-ds-line-soft); color: var(--bpmnkit-ds-ink-3); }
.op-var-value { font-family: var(--bpmnkit-ds-font-mono); font-size: 12px; color: var(--bpmnkit-ds-ink-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }

/* ── Variable modal ──────────────────────────────────────────────────────── */
.op-modal-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.op-modal {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  width: min(680px, 90%);
  max-height: 88%;
  height: 88%;
  display: flex;
  flex-direction: column;
}
.op-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  flex-shrink: 0;
}
.op-modal-title { font-family: var(--bpmnkit-ds-font-mono); font-size: 13px; color: var(--bpmnkit-ds-ink); flex-shrink: 0; }
.op-modal-search-input {
  flex: 1;
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 4px 8px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
  min-width: 0;
}
.op-modal-search-input:focus { border-color: var(--bpmnkit-ds-accent); }
.op-modal-search-input::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-modal-close {
  background: none;
  border: none;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  flex-shrink: 0;
}
.op-modal-close:hover { color: var(--bpmnkit-ds-ink); background: var(--bpmnkit-ds-bg); }
.op-modal-body {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  padding: 14px 16px;
  margin: 0;
  overflow: auto;
  white-space: pre;
  line-height: 1.7;
  flex: 1;
}

/* ── JSON syntax colors ──────────────────────────────────────────────────── */
.op-json-key { color: var(--bpmnkit-ds-accent); }
.op-json-string { color: var(--op-c-green); }
.op-json-number { color: var(--op-c-amber); }
.op-json-bool { color: var(--op-c-purple); }
.op-json-null { color: var(--bpmnkit-ds-ink-3); font-style: italic; }
.op-json-match { background: rgba(255, 210, 0, 0.35); color: inherit; }
.op-panel-empty { padding: 20px; text-align: center; color: var(--bpmnkit-ds-ink-3); font-size: 12px; }
.op-incident-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  background: var(--bpmnkit-ds-bg);
  margin-bottom: 6px;
}
.op-incident-type { font-family: var(--bpmnkit-ds-font-mono); font-size: 11px; font-weight: 400; color: var(--bpmnkit-warn); text-transform: uppercase; }
.op-incident-msg { font-size: 12px; color: var(--bpmnkit-ds-ink); line-height: 1.4; }

/* ── Misc ────────────────────────────────────────────────────────────────── */
.op-cell-error {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bpmnkit-danger);
  font-size: 12px;
}
.op-incident-msg-cell {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
}
.op-view { height: 100%; }
.op-dashboard { height: auto; }

/* ── Chart ───────────────────────────────────────────────────────────────── */
.op-chart-section {
  margin-bottom: 8px;
}
.op-chart-heading {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: var(--bpmnkit-ds-t-mono-label);
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-ds-ink-4);
  margin-bottom: var(--bpmnkit-ds-sp-2);
}
.op-chart {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 12px 14px 10px;
}
.op-chart-svg {
  display: block;
  width: 100%;
  height: 160px;
  overflow: visible;
}
.op-chart-grid {
  stroke: var(--bpmnkit-ds-line);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.op-chart-axis {
  stroke: var(--bpmnkit-ds-line);
  stroke-width: 1;
}
/* Every datum on the site is set in mono — axis ticks and bar values included. */
.op-chart-axis-label {
  font-size: var(--bpmnkit-ds-t-mono-micro);
  fill: var(--bpmnkit-ds-ink-4);
  font-family: var(--bpmnkit-ds-font-mono);
}
/* Pulsing loading dots (shown when < 2 data points) */
.op-chart-dot-pulse {
  fill: var(--bpmnkit-ds-line);
  animation: op-chart-pulse 1.2s ease-in-out infinite;
}
@keyframes op-chart-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.3); }
}

/* ── Filter table / toolbar ─────────────────────────────────────────────── */
.op-filter-table { display: flex; flex-direction: column; }
.op-filter-table .bpmnkit-table-wrap { overflow: auto; }
.op-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.op-search {
  flex: 1;
  max-width: 260px;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-search::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-search:focus { border-color: var(--bpmnkit-ds-accent); }
.op-search-count {
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
  white-space: nowrap;
}
.op-th-sort {
  cursor: pointer;
  user-select: none;
  display: flex !important;
  align-items: center;
  gap: 4px;
}
.op-th-sort:hover { color: var(--bpmnkit-ds-ink); }
.op-sort-icon { font-size: 10px; color: var(--bpmnkit-ds-ink-3); flex-shrink: 0; }
.op-sort-icon--active { color: var(--bpmnkit-ds-accent); }

/* ── Pagination bar ──────────────────────────────────────────────────────── */
.op-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  flex-shrink: 0;
}
.op-pagination-btn {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 2px 8px;
  font-size: 13px;
  color: var(--bpmnkit-ds-ink);
  cursor: pointer;
  line-height: 1.4;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-pagination-btn:hover:not(:disabled) { border-color: var(--bpmnkit-ds-accent); color: var(--bpmnkit-ds-accent); }
.op-pagination-btn:disabled { opacity: 0.35; cursor: default; }
.op-page-size {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 2px 4px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-pagination-info { margin: 0 4px; white-space: nowrap; }

/* ── Definitions / Decisions views ──────────────────────────────────────── */
.op-def-view { display: flex; flex-direction: column; }
.op-mono-cell { font-family: var(--bpmnkit-ds-font-mono); font-size: 11px; color: var(--bpmnkit-ds-ink-3); }

/* ── Definition detail ───────────────────────────────────────────────────── */
.op-def-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}
.op-def-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 40px;
  flex-shrink: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  background: var(--bpmnkit-ds-surface);
  flex-wrap: nowrap;
  overflow: hidden;
}
.op-def-meta-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--bpmnkit-ds-ink);
}
.op-def-meta-version {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  background: var(--bpmnkit-ds-bg);
  padding: 2px 8px;
}
.op-version-select {
  background: var(--bpmnkit-ds-bg);
  color: var(--bpmnkit-ds-ink);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-version-select:focus { border-color: var(--bpmnkit-ds-accent); }
.op-def-canvas {
  flex: 1;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  overflow: hidden;
  min-height: 0;
}

/* ── Usage metrics section ───────────────────────────────────────────────── */
.op-usage-section { margin-bottom: 16px; }
.op-usage-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1px;
  background: var(--bpmnkit-ds-line);
  border: 1px solid var(--bpmnkit-ds-line);
}
.op-usage-card {
  background: var(--bpmnkit-ds-surface);
  padding: var(--bpmnkit-ds-sp-3) var(--bpmnkit-ds-sp-4);
  min-width: 140px;
  flex: 1;
}
.op-usage-card-value {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 20px;
  font-weight: 400;
  color: var(--bpmnkit-ds-ink);
  margin-bottom: 2px;
}
.op-usage-card-label {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Task detail ─────────────────────────────────────────────────────────── */
.op-task-detail-body {
  display: flex;
  flex: 1;
  gap: 16px;
  overflow: hidden;
  min-height: 0;
}
.op-task-info-panel {
  width: 280px;
  flex-shrink: 0;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  overflow-y: auto;
  padding: 14px;
}
.op-task-info-heading {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmnkit-ds-ink-3);
  margin-bottom: 10px;
}
.op-task-meta-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 8px;
}
.op-task-meta-label {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 10px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-ds-ink-3);
}
.op-task-meta-value {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  word-break: break-all;
}
.op-task-form-wrap {
  flex: 1;
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  overflow: hidden;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 14px;
}
.op-task-form-container {
  flex: 1;
  overflow: hidden;
  min-height: 0;
}

/* ── Incident detail — action buttons ────────────────────────────────────── */
.op-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  font-size: 12px;
  font-family: var(--bpmnkit-ds-font-sans);
  color: var(--bpmnkit-ds-ink);
  cursor: pointer;
  transition: background 0.15s;
}
.op-action-btn:hover { background: var(--bpmnkit-ds-line); }
.op-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.op-action-btn--primary {
  background: var(--bpmnkit-ds-accent);
  border-color: var(--bpmnkit-ds-accent);
  color: #fff;
}
.op-action-btn--primary:hover { opacity: 0.88; background: var(--bpmnkit-ds-accent); }
.op-action-btn--danger {
  border-color: color-mix(in srgb, var(--bpmnkit-danger, #e05252) 60%, transparent);
  color: var(--bpmnkit-danger, #e05252);
}
.op-action-btn--danger:hover { background: color-mix(in srgb, var(--bpmnkit-danger, #e05252) 10%, transparent); }
.op-action-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--bpmnkit-ds-line);
}
.op-action-feedback {
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 10px;
}
.op-action-feedback--ok { background: color-mix(in srgb, var(--op-c-green) 12%, transparent); color: var(--op-c-green); }
.op-action-feedback--err { background: color-mix(in srgb, var(--op-c-amber) 12%, transparent); color: var(--op-c-amber); }

/* ── Process chain breadcrumb ────────────────────────────────────────────── */
.op-process-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.op-process-chain-sep { color: var(--bpmnkit-ds-line); }
.op-process-chain-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--bpmnkit-ds-accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.op-process-chain-link:hover { opacity: 0.75; }
.op-process-chain-link:disabled { color: var(--bpmnkit-ds-ink-3); text-decoration: none; cursor: default; }

/* ── Job details section ──────────────────────────────────────────────────── */
.op-job-section {
  margin-top: 16px;
  border-top: 1px solid var(--bpmnkit-ds-line);
  padding-top: 12px;
}
.op-job-section-title {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-ds-ink-3);
  margin-bottom: 8px;
}
.op-job-headers {
  font-size: 12px;
  font-family: var(--bpmnkit-ds-font-mono);
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  color: var(--bpmnkit-ds-ink);
}

/* ── Read-only config panel wrapper ─────────────────────────────────────── */
.op-props-pane { padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; }
/* Disable all form inputs inside the read-only properties panel */
.op-props-pane input,
.op-props-pane textarea,
.op-props-pane select {
  pointer-events: none;
  opacity: 0.75;
}
/* Keep action-style buttons (links, collapse) but disable edit triggers */
.op-props-pane button.bpmnkit-cfg-field-edit-btn,
.op-props-pane button.bpmnkit-cfg-overlay-trigger {
  display: none;
}
.op-props-pane .bpmnkit-cfg-empty {
  padding: 20px;
  text-align: center;
  color: var(--bpmnkit-ds-ink-3);
  font-size: 12px;
}
/* Placeholder shown before element is selected */
.op-props-placeholder {
  padding: 20px;
  text-align: center;
  color: var(--bpmnkit-ds-ink-3);
  font-size: 12px;
  line-height: 1.5;
}

/* ── AI Assist panel ─────────────────────────────────────────────────────── */
.op-ai-assist-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}
.op-ai-assist-intro {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  line-height: 1.5;
  margin: 0;
}
.op-ai-response {
  flex: 1;
  font-size: 12px;
  font-family: var(--bpmnkit-ds-font-sans);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 10px 12px;
  overflow-y: auto;
  min-height: 200px;
  margin: 0;
}

/* ── Form modal (Start Instance, Correlate Message, etc.) ────────────────── */
.op-modal--form {
  height: auto;
  max-height: 80%;
}
.op-modal-form-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow-y: auto;
}
.op-form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.op-form-label {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-ds-ink-3);
}
.op-form-input {
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 6px 10px;
  font-size: 13px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-form-input:focus { border-color: var(--bpmnkit-ds-accent); }
.op-form-input::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-form-textarea {
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 6px 10px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-mono);
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}
.op-form-textarea:focus { border-color: var(--bpmnkit-ds-accent); }
.op-form-textarea::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-form-hint { font-size: 11px; color: var(--bpmnkit-ds-ink-3); line-height: 1.4; }
.op-form-error { font-size: 12px; color: var(--bpmnkit-danger, #e05252); padding: 4px 0; }
.op-modal-form-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--bpmnkit-ds-line);
  flex-shrink: 0;
}
.op-modal-form-footer .op-action-feedback { margin-top: 0; flex: 1; }

/* ── Messages & Signals view ─────────────────────────────────────────────── */
.op-msg-view { display: flex; flex-direction: column; gap: 20px; }
/* One box, subdivided — the same rule as the dashboard's metrics. */
.op-msg-actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1px;
  background: var(--bpmnkit-ds-line);
  border: 1px solid var(--bpmnkit-ds-line);
}
.op-msg-action-card {
  background: var(--bpmnkit-ds-surface);
  border: none;
  padding: var(--bpmnkit-ds-sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--bpmnkit-ds-sp-2);
  cursor: pointer;
  text-align: left;
  font-family: var(--bpmnkit-ds-font-sans);
  transition: background 0.15s;
  width: 100%;
}
.op-msg-action-card:hover {
  background: var(--bpmnkit-ds-bg);
}
.op-msg-action-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bpmnkit-ds-ink);
}
.op-msg-action-card-desc {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  line-height: 1.4;
}
.op-msg-section-title {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmnkit-ds-ink-3);
  margin-bottom: 8px;
}
.op-kv-body {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}
.op-kv-row { display: flex; gap: 12px; font-size: 12px; align-items: baseline; }
.op-kv-key { color: var(--bpmnkit-ds-ink-3); min-width: 120px; flex-shrink: 0; font-weight: 500; }
.op-kv-value { color: var(--bpmnkit-ds-ink); font-family: var(--bpmnkit-ds-font-mono); word-break: break-all; }

/* ── Search view ─────────────────────────────────────────────────────────── */
.op-search-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: auto;
  overflow-y: auto;
}
.op-search-tab-bar {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--bpmnkit-ds-line);
  padding-bottom: 0;
  margin-bottom: -8px;
}
.op-search-tab {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-sans);
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.op-search-tab:hover { color: var(--bpmnkit-ds-ink); }
.op-search-tab--active {
  color: var(--bpmnkit-ds-ink);
  border-bottom-color: var(--bpmnkit-ds-accent);
}
.op-search-pane {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.op-search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.op-search-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--bpmnkit-ds-ink);
}
.op-search-template-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  flex-wrap: wrap;
}
.op-search-template-label {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  white-space: nowrap;
}
.op-search-template-select {
  background: var(--bpmnkit-ds-bg);
  color: var(--bpmnkit-ds-ink);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
  max-width: 220px;
}
.op-search-template-select:focus { border-color: var(--bpmnkit-ds-accent); }
.op-search-builder {
  background: var(--bpmnkit-ds-surface);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.op-search-conditions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.op-search-empty-hint {
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  font-style: italic;
  padding: 4px 0;
}
.op-search-cond-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.op-search-field-select {
  background: var(--bpmnkit-ds-bg);
  color: var(--bpmnkit-ds-ink);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
  min-width: 200px;
}
.op-search-field-select:focus { border-color: var(--bpmnkit-ds-accent); }
.op-search-value-input {
  flex: 1;
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-search-value-input:focus { border-color: var(--bpmnkit-ds-accent); }
.op-search-value-input::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-search-value-select {
  flex: 1;
  background: var(--bpmnkit-ds-bg);
  color: var(--bpmnkit-ds-ink);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-search-value-select:focus { border-color: var(--bpmnkit-ds-accent); }
.op-search-cond-remove {
  background: none;
  border: none;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  line-height: 1;
  flex-shrink: 0;
}
.op-search-cond-remove:hover { color: var(--bpmnkit-danger, #e05252); background: var(--bpmnkit-ds-bg); }
.op-search-add-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--bpmnkit-ds-line);
  padding: 5px 14px;
  font-size: 12px;
  color: var(--bpmnkit-ds-ink-3);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-sans);
  transition: border-color 0.15s, color 0.15s;
}
.op-search-add-btn:hover { border-color: var(--bpmnkit-ds-accent); color: var(--bpmnkit-ds-accent); }
.op-search-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--bpmnkit-ds-line);
}
.op-search-status {
  font-size: 12px;
  color: var(--bpmnkit-danger, #e05252);
  flex: 1;
}
.op-search-results {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.op-search-results-heading {
  font-size: 13px;
  font-weight: 600;
  color: var(--bpmnkit-ds-ink);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--bpmnkit-ds-line);
}
.op-search-var-value {
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
}
.op-search-tab--ai { color: var(--bpmnkit-ds-accent); }
.op-search-tab--ai:hover { color: var(--bpmnkit-ds-accent); }
.op-search-tab--ai.op-search-tab--active { color: var(--bpmnkit-ds-accent); border-bottom-color: var(--bpmnkit-ds-accent); }
.op-ai-search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.op-ai-search-input {
  flex: 1;
  background: var(--bpmnkit-ds-bg);
  border: 1px solid var(--bpmnkit-ds-line);
  padding: 7px 12px;
  font-size: 13px;
  color: var(--bpmnkit-ds-ink);
  outline: none;
  font-family: var(--bpmnkit-ds-font-sans);
}
.op-ai-search-input:focus { border-color: var(--bpmnkit-ds-accent); }
.op-ai-search-input::placeholder { color: var(--bpmnkit-ds-ink-3); }
.op-ai-search-hint {
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
}
.op-ai-search-filter {
  font-size: 11px;
  color: var(--bpmnkit-ds-ink-3);
  font-family: var(--bpmnkit-ds-font-mono);
  padding: 2px 0 6px;
}
.op-ai-var-process {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.op-ai-var-process > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-ai-var-subprocess-badge {
  flex-shrink: 0;
  font-family: var(--bpmnkit-ds-font-mono);
  font-size: 10px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  background: var(--op-accent-subtle);
  color: var(--bpmnkit-ds-accent);
}
`

export function injectOperateStyles(): void {
	injectStyle(OPERATE_STYLE_ID, OPERATE_CSS)
}
