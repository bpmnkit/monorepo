import { injectStyle } from "@bpmnkit/ui"

const OPERATE_STYLE_ID = "bpmnkit-operate-styles-v2"

/**
 * Operate-specific layout CSS. Design tokens (colours, radius, font, etc.)
 * come from @bpmnkit/ui — call injectUiStyles() before this.
 *
 * Component styles (badge, card, table) are also in @bpmnkit/ui.
 */
const OPERATE_CSS = `
/* ── Layout ─────────────────────────────────────────────────────────────── */
.op-root {
  font-family: var(--bpmnkit-font);
  font-size: 13px;
  color: var(--bpmnkit-fg);
  background: var(--bpmnkit-bg);
  height: 100%;
  /* Metric accent colors — dark defaults */
  --op-c-amber: #e8a54e;
  --op-c-green: #3bba7c;
  --op-c-purple: #a07cf5;
}
.op-root[data-theme="light"] {
  --op-c-amber: #c07c10;
  --op-c-green: #1a7a4a;
  --op-c-purple: #6b3fd4;
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
.op-nav {
  width: var(--bpmnkit-nav-width);
  background: var(--bpmnkit-nav-bg);
  display: flex;
  flex-direction: column;
  padding: 0;
  flex-shrink: 0;
  border-right: 1px solid rgba(255,255,255,0.06);
}
.op-nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--bpmnkit-nav-fg-active);
  letter-spacing: 0.02em;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  margin-bottom: 8px;
}
.op-nav-list {
  list-style: none;
  padding: 4px 10px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.op-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  background: none;
  border: none;
  border-radius: var(--bpmnkit-radius);
  color: var(--bpmnkit-nav-fg);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.op-nav-item:hover {
  background: rgba(255,255,255,0.06);
  color: var(--bpmnkit-nav-fg-active);
}
.op-nav-item--active {
  background: rgba(76,142,247,0.18);
  color: var(--bpmnkit-nav-fg-active);
}
.op-nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.85;
}
.op-nav-icon svg { width: 100%; height: 100%; pointer-events: none; }

/* ── Header ─────────────────────────────────────────────────────────────── */
.op-header {
  height: var(--bpmnkit-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bpmnkit-surface);
  border-bottom: 1px solid var(--bpmnkit-border);
  flex-shrink: 0;
}
.op-header-title {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
}
.op-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.op-profile-select {
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-profile-select:focus { border-color: var(--bpmnkit-accent); }

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
.op-proc-filter-label { font-size: 12px; color: var(--bpmnkit-fg-muted); white-space: nowrap; }
.op-proc-filter-select {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 3px 8px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  cursor: pointer;
  font-family: var(--bpmnkit-font);
  max-width: 200px;
}
.op-proc-filter-select:focus { outline: none; border-color: var(--bpmnkit-accent); }

/* ── Process breadcrumb ──────────────────────────────────────────────────── */
.op-proc-breadcrumb { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; }
.op-proc-root { color: var(--bpmnkit-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-proc-sep { color: var(--bpmnkit-fg-muted); opacity: 0.5; flex-shrink: 0; }
.op-proc-leaf { color: var(--bpmnkit-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-filter-btn {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  font-family: var(--bpmnkit-font);
}
.op-filter-btn:hover {
  color: var(--bpmnkit-fg);
  border-color: var(--bpmnkit-accent);
}
.op-filter-btn--active {
  background: rgba(76,142,247,0.15);
  border-color: var(--bpmnkit-accent);
  color: var(--bpmnkit-fg);
}

/* ── Card grid ───────────────────────────────────────────────────────────── */
.op-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 14px;
  margin-bottom: 24px;
}

/* ── Dashboard metric card ───────────────────────────────────────────────── */
.op-dash-card {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-lg);
  padding: 16px 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.op-dash-card:hover {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
}
.op-dash-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.op-dash-card-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bpmnkit-fg-muted);
  line-height: 1.3;
  margin-top: 2px;
}
.op-dash-card-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
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
  font-size: 30px;
  font-weight: 700;
  line-height: 1;
  color: var(--bpmnkit-fg);
  letter-spacing: -0.02em;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.op-loading {
  padding: 40px;
  text-align: center;
  color: var(--bpmnkit-fg-muted);
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
  color: var(--bpmnkit-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  font-family: var(--bpmnkit-font);
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
  font-family: monospace;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  background: var(--bpmnkit-surface-2);
  padding: 2px 8px;
  border-radius: var(--bpmnkit-radius-sm);
}
.op-instance-biz {
  font-weight: 600;
  color: var(--bpmnkit-fg);
}
.op-instance-time {
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
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
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  overflow: hidden;
  min-height: 0;
}
.op-detail-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  overflow: hidden;
}
.op-detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--bpmnkit-border);
}
.op-detail-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: var(--bpmnkit-font);
}
.op-detail-tab:hover { color: var(--bpmnkit-fg); }
.op-detail-tab--active {
  color: var(--bpmnkit-fg);
  border-bottom-color: var(--bpmnkit-accent);
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
  background: var(--bpmnkit-surface);
  border-bottom: 1px solid var(--bpmnkit-border);
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
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--bpmnkit-fg);
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--bpmnkit-font);
}
.op-var-sort-btn:hover { border-color: var(--bpmnkit-accent); color: var(--bpmnkit-accent); }
.op-var-type-btn {
  background: none;
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 2px 7px;
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  font-family: monospace;
}
.op-var-type-btn:hover { color: var(--bpmnkit-fg); border-color: var(--bpmnkit-accent); }
.op-var-type-btn--active { background: var(--bpmnkit-accent); border-color: var(--bpmnkit-accent); color: #fff; }
.op-var-controls .op-search { max-width: 100%; }
.op-var-list { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
.op-var-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--bpmnkit-radius-sm); background: var(--bpmnkit-surface-2); min-width: 0; }
.op-var-row--clickable { cursor: pointer; }
.op-var-row--clickable:hover { background: var(--bpmnkit-surface-3, var(--bpmnkit-surface-2)); outline: 1px solid var(--bpmnkit-border); }
.op-var-name { font-family: monospace; font-size: 12px; color: var(--bpmnkit-fg); flex-shrink: 0; }
.op-var-type {
  font-family: monospace;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: var(--bpmnkit-radius-sm);
  flex-shrink: 0;
  opacity: 0.75;
}
.op-var-type--string { background: color-mix(in srgb, var(--op-c-green) 15%, transparent); color: var(--op-c-green); }
.op-var-type--number { background: color-mix(in srgb, var(--op-c-amber) 15%, transparent); color: var(--op-c-amber); }
.op-var-type--boolean { background: color-mix(in srgb, var(--op-c-purple) 15%, transparent); color: var(--op-c-purple); }
.op-var-type--json { background: color-mix(in srgb, var(--bpmnkit-accent) 15%, transparent); color: var(--bpmnkit-accent); }
.op-var-type--null { background: var(--bpmnkit-surface-3, var(--bpmnkit-surface-2)); color: var(--bpmnkit-fg-muted); }
.op-var-value { font-family: monospace; font-size: 12px; color: var(--bpmnkit-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }

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
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  width: min(680px, 90%);
  max-height: 88%;
  height: 88%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}
.op-modal-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bpmnkit-border);
  flex-shrink: 0;
}
.op-modal-title { font-family: monospace; font-size: 13px; color: var(--bpmnkit-fg); flex-shrink: 0; }
.op-modal-search-input {
  flex: 1;
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: var(--bpmnkit-font);
  min-width: 0;
}
.op-modal-search-input:focus { border-color: var(--bpmnkit-accent); }
.op-modal-search-input::placeholder { color: var(--bpmnkit-fg-muted); }
.op-modal-close {
  background: none;
  border: none;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: var(--bpmnkit-radius-sm);
  flex-shrink: 0;
}
.op-modal-close:hover { color: var(--bpmnkit-fg); background: var(--bpmnkit-surface-2); }
.op-modal-body {
  font-family: monospace;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  padding: 14px 16px;
  margin: 0;
  overflow: auto;
  white-space: pre;
  line-height: 1.7;
  flex: 1;
}

/* ── JSON syntax colors ──────────────────────────────────────────────────── */
.op-json-key { color: var(--bpmnkit-accent); }
.op-json-string { color: var(--op-c-green); }
.op-json-number { color: var(--op-c-amber); }
.op-json-bool { color: var(--op-c-purple); }
.op-json-null { color: var(--bpmnkit-fg-muted); font-style: italic; }
.op-json-match { background: rgba(255, 210, 0, 0.35); border-radius: 2px; color: inherit; }
.op-panel-empty { padding: 20px; text-align: center; color: var(--bpmnkit-fg-muted); font-size: 12px; }
.op-incident-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: var(--bpmnkit-radius-sm);
  background: var(--bpmnkit-surface-2);
  margin-bottom: 6px;
}
.op-incident-type { font-size: 11px; font-weight: 600; color: var(--bpmnkit-warn); text-transform: uppercase; }
.op-incident-msg { font-size: 12px; color: var(--bpmnkit-fg); line-height: 1.4; }

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
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmnkit-fg-muted);
  margin-bottom: 10px;
}
.op-chart {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 12px 14px 10px;
}
.op-chart-svg {
  display: block;
  width: 100%;
  height: 160px;
  overflow: visible;
}
.op-chart-grid {
  stroke: var(--bpmnkit-border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.op-chart-axis {
  stroke: var(--bpmnkit-border);
  stroke-width: 1;
}
.op-chart-axis-label {
  font-size: 10px;
  fill: var(--bpmnkit-fg-muted);
  font-family: var(--bpmnkit-font);
}
/* Pulsing loading dots (shown when < 2 data points) */
.op-chart-dot-pulse {
  fill: var(--bpmnkit-border);
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
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-search::placeholder { color: var(--bpmnkit-fg-muted); }
.op-search:focus { border-color: var(--bpmnkit-accent); }
.op-search-count {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
  white-space: nowrap;
}
.op-th-sort {
  cursor: pointer;
  user-select: none;
  display: flex !important;
  align-items: center;
  gap: 4px;
}
.op-th-sort:hover { color: var(--bpmnkit-fg); }
.op-sort-icon { font-size: 10px; color: var(--bpmnkit-fg-muted); flex-shrink: 0; }
.op-sort-icon--active { color: var(--bpmnkit-accent); }

/* ── Pagination bar ──────────────────────────────────────────────────────── */
.op-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  flex-shrink: 0;
}
.op-pagination-btn {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 2px 8px;
  font-size: 13px;
  color: var(--bpmnkit-fg);
  cursor: pointer;
  line-height: 1.4;
  font-family: var(--bpmnkit-font);
}
.op-pagination-btn:hover:not(:disabled) { border-color: var(--bpmnkit-accent); color: var(--bpmnkit-accent); }
.op-pagination-btn:disabled { opacity: 0.35; cursor: default; }
.op-page-size {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 2px 4px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  cursor: pointer;
  font-family: var(--bpmnkit-font);
}
.op-pagination-info { margin: 0 4px; white-space: nowrap; }

/* ── Definitions / Decisions views ──────────────────────────────────────── */
.op-def-view { display: flex; flex-direction: column; }
.op-mono-cell { font-family: monospace; font-size: 11px; color: var(--bpmnkit-fg-muted); }

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
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.op-def-meta-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--bpmnkit-fg);
}
.op-def-meta-version {
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  background: var(--bpmnkit-surface-2);
  padding: 2px 8px;
  border-radius: var(--bpmnkit-radius-sm);
}
.op-version-select {
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 2px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-version-select:focus { border-color: var(--bpmnkit-accent); }
.op-def-canvas {
  flex: 1;
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  overflow: hidden;
  min-height: 0;
}

/* ── Usage metrics section ───────────────────────────────────────────────── */
.op-usage-section { margin-bottom: 16px; }
.op-usage-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.op-usage-card {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  padding: 10px 16px;
  min-width: 140px;
  flex: 1;
}
.op-usage-card-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--bpmnkit-fg);
  margin-bottom: 2px;
}
.op-usage-card-label {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
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
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
  overflow-y: auto;
  padding: 14px;
}
.op-task-info-heading {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmnkit-fg-muted);
  margin-bottom: 10px;
}
.op-task-meta-row {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 8px;
}
.op-task-meta-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-fg-muted);
}
.op-task-meta-value {
  font-size: 12px;
  color: var(--bpmnkit-fg);
  word-break: break-all;
}
.op-task-form-wrap {
  flex: 1;
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
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
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  font-size: 12px;
  font-family: var(--bpmnkit-font);
  color: var(--bpmnkit-fg);
  cursor: pointer;
  transition: background 0.15s;
}
.op-action-btn:hover { background: var(--bpmnkit-border); }
.op-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.op-action-btn--primary {
  background: var(--bpmnkit-accent);
  border-color: var(--bpmnkit-accent);
  color: #fff;
}
.op-action-btn--primary:hover { opacity: 0.88; background: var(--bpmnkit-accent); }
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
  border-top: 1px solid var(--bpmnkit-border);
}
.op-action-feedback {
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: var(--bpmnkit-radius-sm);
}
.op-action-feedback--ok { background: color-mix(in srgb, var(--op-c-green) 12%, transparent); color: var(--op-c-green); }
.op-action-feedback--err { background: color-mix(in srgb, var(--op-c-amber) 12%, transparent); color: var(--op-c-amber); }

/* ── Process chain breadcrumb ────────────────────────────────────────────── */
.op-process-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.op-process-chain-sep { color: var(--bpmnkit-border); }
.op-process-chain-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--bpmnkit-accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.op-process-chain-link:hover { opacity: 0.75; }
.op-process-chain-link:disabled { color: var(--bpmnkit-fg-muted); text-decoration: none; cursor: default; }

/* ── Job details section ──────────────────────────────────────────────────── */
.op-job-section {
  margin-top: 16px;
  border-top: 1px solid var(--bpmnkit-border);
  padding-top: 12px;
}
.op-job-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-fg-muted);
  margin-bottom: 8px;
}
.op-job-headers {
  font-size: 12px;
  font-family: monospace;
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  color: var(--bpmnkit-fg);
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
  color: var(--bpmnkit-fg-muted);
  font-size: 12px;
}
/* Placeholder shown before element is selected */
.op-props-placeholder {
  padding: 20px;
  text-align: center;
  color: var(--bpmnkit-fg-muted);
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
  color: var(--bpmnkit-fg-muted);
  line-height: 1.5;
  margin: 0;
}
.op-ai-response {
  flex: 1;
  font-size: 12px;
  font-family: var(--bpmnkit-font);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
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
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-fg-muted);
}
.op-form-input {
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 6px 10px;
  font-size: 13px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-form-input:focus { border-color: var(--bpmnkit-accent); }
.op-form-input::placeholder { color: var(--bpmnkit-fg-muted); }
.op-form-textarea {
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 6px 10px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: monospace;
  resize: vertical;
  min-height: 80px;
  line-height: 1.5;
}
.op-form-textarea:focus { border-color: var(--bpmnkit-accent); }
.op-form-textarea::placeholder { color: var(--bpmnkit-fg-muted); }
.op-form-hint { font-size: 11px; color: var(--bpmnkit-fg-muted); line-height: 1.4; }
.op-form-error { font-size: 12px; color: var(--bpmnkit-danger, #e05252); padding: 4px 0; }
.op-modal-form-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--bpmnkit-border);
  flex-shrink: 0;
}
.op-modal-form-footer .op-action-feedback { margin-top: 0; flex: 1; }

/* ── Messages & Signals view ─────────────────────────────────────────────── */
.op-msg-view { display: flex; flex-direction: column; gap: 20px; }
.op-msg-actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.op-msg-action-card {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-lg);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: pointer;
  text-align: left;
  font-family: var(--bpmnkit-font);
  transition: border-color 0.15s, box-shadow 0.15s;
  width: 100%;
}
.op-msg-action-card:hover {
  border-color: var(--bpmnkit-accent);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bpmnkit-accent) 30%, transparent);
}
.op-msg-action-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--bpmnkit-fg);
}
.op-msg-action-card-desc {
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  line-height: 1.4;
}
.op-msg-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmnkit-fg-muted);
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
.op-kv-key { color: var(--bpmnkit-fg-muted); min-width: 120px; flex-shrink: 0; font-weight: 500; }
.op-kv-value { color: var(--bpmnkit-fg); font-family: monospace; word-break: break-all; }

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
  border-bottom: 1px solid var(--bpmnkit-border);
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
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  font-family: var(--bpmnkit-font);
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.op-search-tab:hover { color: var(--bpmnkit-fg); }
.op-search-tab--active {
  color: var(--bpmnkit-fg);
  border-bottom-color: var(--bpmnkit-accent);
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
  color: var(--bpmnkit-fg);
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
  color: var(--bpmnkit-fg-muted);
  white-space: nowrap;
}
.op-search-template-select {
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-font);
  max-width: 220px;
}
.op-search-template-select:focus { border-color: var(--bpmnkit-accent); }
.op-search-builder {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius);
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
  color: var(--bpmnkit-fg-muted);
  font-style: italic;
  padding: 4px 0;
}
.op-search-cond-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.op-search-field-select {
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-font);
  min-width: 200px;
}
.op-search-field-select:focus { border-color: var(--bpmnkit-accent); }
.op-search-value-input {
  flex: 1;
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-search-value-input:focus { border-color: var(--bpmnkit-accent); }
.op-search-value-input::placeholder { color: var(--bpmnkit-fg-muted); }
.op-search-value-select {
  flex: 1;
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 5px 8px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-search-value-select:focus { border-color: var(--bpmnkit-accent); }
.op-search-cond-remove {
  background: none;
  border: none;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  font-size: 13px;
  padding: 4px 6px;
  border-radius: var(--bpmnkit-radius-sm);
  line-height: 1;
  flex-shrink: 0;
}
.op-search-cond-remove:hover { color: var(--bpmnkit-danger, #e05252); background: var(--bpmnkit-surface-2); }
.op-search-add-btn {
  align-self: flex-start;
  background: none;
  border: 1px dashed var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 5px 14px;
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  cursor: pointer;
  font-family: var(--bpmnkit-font);
  transition: border-color 0.15s, color 0.15s;
}
.op-search-add-btn:hover { border-color: var(--bpmnkit-accent); color: var(--bpmnkit-accent); }
.op-search-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 4px;
  border-top: 1px solid var(--bpmnkit-border);
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
  color: var(--bpmnkit-fg);
  padding-bottom: 6px;
  border-bottom: 1px solid var(--bpmnkit-border);
}
.op-search-var-value {
  font-family: var(--bpmnkit-font-mono);
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 340px;
}
.op-search-tab--ai { color: var(--bpmnkit-accent); }
.op-search-tab--ai:hover { color: var(--bpmnkit-accent-bright, #3b82f6); }
.op-search-tab--ai.op-search-tab--active { color: var(--bpmnkit-accent); border-bottom-color: var(--bpmnkit-accent); }
.op-ai-search-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.op-ai-search-input {
  flex: 1;
  background: var(--bpmnkit-surface-2);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-sm);
  padding: 7px 12px;
  font-size: 13px;
  color: var(--bpmnkit-fg);
  outline: none;
  font-family: var(--bpmnkit-font);
}
.op-ai-search-input:focus { border-color: var(--bpmnkit-accent); }
.op-ai-search-input::placeholder { color: var(--bpmnkit-fg-muted); }
.op-ai-search-hint {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
}
.op-ai-search-filter {
  font-size: 11px;
  color: var(--bpmnkit-fg-muted);
  font-family: var(--bpmnkit-font-mono);
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
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--bpmnkit-accent-subtle);
  color: var(--bpmnkit-accent);
}
`

export function injectOperateStyles(): void {
	injectStyle(OPERATE_STYLE_ID, OPERATE_CSS)
}
