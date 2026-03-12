import { injectStyle } from "@bpmn-sdk/ui"

const OPERATE_STYLE_ID = "bpmn-operate-styles-v2"

/**
 * Operate-specific layout CSS. Design tokens (colours, radius, font, etc.)
 * come from @bpmn-sdk/ui — call injectUiStyles() before this.
 *
 * Component styles (badge, card, table) are also in @bpmn-sdk/ui.
 */
const OPERATE_CSS = `
/* ── Layout ─────────────────────────────────────────────────────────────── */
.op-root {
  font-family: var(--bpmn-font);
  font-size: 13px;
  color: var(--bpmn-fg);
  background: var(--bpmn-bg);
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
  width: var(--bpmn-nav-width);
  background: var(--bpmn-nav-bg);
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
  color: var(--bpmn-nav-fg-active);
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
  border-radius: var(--bpmn-radius);
  color: var(--bpmn-nav-fg);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}
.op-nav-item:hover {
  background: rgba(255,255,255,0.06);
  color: var(--bpmn-nav-fg-active);
}
.op-nav-item--active {
  background: rgba(76,142,247,0.18);
  color: var(--bpmn-nav-fg-active);
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
  height: var(--bpmn-header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background: var(--bpmn-surface);
  border-bottom: 1px solid var(--bpmn-border);
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
  background: var(--bpmn-surface-2);
  color: var(--bpmn-fg);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
  outline: none;
  font-family: var(--bpmn-font);
}
.op-profile-select:focus { border-color: var(--bpmn-accent); }

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
.op-proc-filter-label { font-size: 12px; color: var(--bpmn-fg-muted); white-space: nowrap; }
.op-proc-filter-select {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 3px 8px;
  font-size: 12px;
  color: var(--bpmn-fg);
  cursor: pointer;
  font-family: var(--bpmn-font);
  max-width: 200px;
}
.op-proc-filter-select:focus { outline: none; border-color: var(--bpmn-accent); }

/* ── Process breadcrumb ──────────────────────────────────────────────────── */
.op-proc-breadcrumb { display: inline-flex; align-items: center; min-width: 0; max-width: 100%; }
.op-proc-root { color: var(--bpmn-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-proc-sep { color: var(--bpmn-fg-muted); opacity: 0.5; flex-shrink: 0; }
.op-proc-leaf { color: var(--bpmn-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-filter-btn {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: 20px;
  padding: 4px 14px;
  font-size: 12px;
  color: var(--bpmn-fg-muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  font-family: var(--bpmn-font);
}
.op-filter-btn:hover {
  color: var(--bpmn-fg);
  border-color: var(--bpmn-accent);
}
.op-filter-btn--active {
  background: rgba(76,142,247,0.15);
  border-color: var(--bpmn-accent);
  color: var(--bpmn-fg);
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
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-lg);
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
  color: var(--bpmn-fg-muted);
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
  color: var(--bpmn-fg);
  letter-spacing: -0.02em;
}

/* ── Loading ─────────────────────────────────────────────────────────────── */
.op-loading {
  padding: 40px;
  text-align: center;
  color: var(--bpmn-fg-muted);
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
  color: var(--bpmn-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
  font-family: var(--bpmn-font);
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
  color: var(--bpmn-fg-muted);
  background: var(--bpmn-surface-2);
  padding: 2px 8px;
  border-radius: var(--bpmn-radius-sm);
}
.op-instance-biz {
  font-weight: 600;
  color: var(--bpmn-fg);
}
.op-instance-time {
  font-size: 12px;
  color: var(--bpmn-fg-muted);
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
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  overflow: hidden;
  min-height: 0;
}
.op-detail-sidebar {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  overflow: hidden;
}
.op-detail-tabs {
  display: flex;
  border-bottom: 1px solid var(--bpmn-border);
}
.op-detail-tab {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: 10px 16px;
  font-size: 12px;
  font-weight: 600;
  color: var(--bpmn-fg-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  font-family: var(--bpmn-font);
}
.op-detail-tab:hover { color: var(--bpmn-fg); }
.op-detail-tab--active {
  color: var(--bpmn-fg);
  border-bottom-color: var(--bpmn-accent);
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
  background: var(--bpmn-surface);
  border-bottom: 1px solid var(--bpmn-border);
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
  background: var(--bpmn-surface-2);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  padding: 2px 8px;
  font-size: 11px;
  color: var(--bpmn-fg);
  cursor: pointer;
  white-space: nowrap;
  font-family: var(--bpmn-font);
}
.op-var-sort-btn:hover { border-color: var(--bpmn-accent); color: var(--bpmn-accent); }
.op-var-type-btn {
  background: none;
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  padding: 2px 7px;
  font-size: 11px;
  color: var(--bpmn-fg-muted);
  cursor: pointer;
  font-family: monospace;
}
.op-var-type-btn:hover { color: var(--bpmn-fg); border-color: var(--bpmn-accent); }
.op-var-type-btn--active { background: var(--bpmn-accent); border-color: var(--bpmn-accent); color: #fff; }
.op-var-controls .op-search { max-width: 100%; }
.op-var-list { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; }
.op-var-row { display: flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: var(--bpmn-radius-sm); background: var(--bpmn-surface-2); min-width: 0; }
.op-var-row--clickable { cursor: pointer; }
.op-var-row--clickable:hover { background: var(--bpmn-surface-3, var(--bpmn-surface-2)); outline: 1px solid var(--bpmn-border); }
.op-var-name { font-family: monospace; font-size: 12px; color: var(--bpmn-fg); flex-shrink: 0; }
.op-var-type {
  font-family: monospace;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: var(--bpmn-radius-sm);
  flex-shrink: 0;
  opacity: 0.75;
}
.op-var-type--string { background: color-mix(in srgb, var(--op-c-green) 15%, transparent); color: var(--op-c-green); }
.op-var-type--number { background: color-mix(in srgb, var(--op-c-amber) 15%, transparent); color: var(--op-c-amber); }
.op-var-type--boolean { background: color-mix(in srgb, var(--op-c-purple) 15%, transparent); color: var(--op-c-purple); }
.op-var-type--json { background: color-mix(in srgb, var(--bpmn-accent) 15%, transparent); color: var(--bpmn-accent); }
.op-var-type--null { background: var(--bpmn-surface-3, var(--bpmn-surface-2)); color: var(--bpmn-fg-muted); }
.op-var-value { font-family: monospace; font-size: 12px; color: var(--bpmn-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1; }

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
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
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
  border-bottom: 1px solid var(--bpmn-border);
  flex-shrink: 0;
}
.op-modal-title { font-family: monospace; font-size: 13px; color: var(--bpmn-fg); flex-shrink: 0; }
.op-modal-search-input {
  flex: 1;
  background: var(--bpmn-surface-2);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  padding: 4px 8px;
  font-size: 12px;
  color: var(--bpmn-fg);
  outline: none;
  font-family: var(--bpmn-font);
  min-width: 0;
}
.op-modal-search-input:focus { border-color: var(--bpmn-accent); }
.op-modal-search-input::placeholder { color: var(--bpmn-fg-muted); }
.op-modal-close {
  background: none;
  border: none;
  color: var(--bpmn-fg-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
  border-radius: var(--bpmn-radius-sm);
  flex-shrink: 0;
}
.op-modal-close:hover { color: var(--bpmn-fg); background: var(--bpmn-surface-2); }
.op-modal-body {
  font-family: monospace;
  font-size: 12px;
  color: var(--bpmn-fg);
  padding: 14px 16px;
  margin: 0;
  overflow: auto;
  white-space: pre;
  line-height: 1.7;
  flex: 1;
}

/* ── JSON syntax colors ──────────────────────────────────────────────────── */
.op-json-key { color: var(--bpmn-accent); }
.op-json-string { color: var(--op-c-green); }
.op-json-number { color: var(--op-c-amber); }
.op-json-bool { color: var(--op-c-purple); }
.op-json-null { color: var(--bpmn-fg-muted); font-style: italic; }
.op-json-match { background: rgba(255, 210, 0, 0.35); border-radius: 2px; color: inherit; }
.op-panel-empty { padding: 20px; text-align: center; color: var(--bpmn-fg-muted); font-size: 12px; }
.op-incident-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: var(--bpmn-radius-sm);
  background: var(--bpmn-surface-2);
  margin-bottom: 6px;
}
.op-incident-type { font-size: 11px; font-weight: 600; color: var(--bpmn-warn); text-transform: uppercase; }
.op-incident-msg { font-size: 12px; color: var(--bpmn-fg); line-height: 1.4; }

/* ── Misc ────────────────────────────────────────────────────────────────── */
.op-cell-error {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--bpmn-danger);
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
  color: var(--bpmn-fg-muted);
  margin-bottom: 10px;
}
.op-chart {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 12px 14px 10px;
}
.op-chart-svg {
  display: block;
  width: 100%;
  height: 160px;
  overflow: visible;
}
.op-chart-grid {
  stroke: var(--bpmn-border);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}
.op-chart-axis {
  stroke: var(--bpmn-border);
  stroke-width: 1;
}
.op-chart-axis-label {
  font-size: 10px;
  fill: var(--bpmn-fg-muted);
  font-family: var(--bpmn-font);
}
/* Pulsing loading dots (shown when < 2 data points) */
.op-chart-dot-pulse {
  fill: var(--bpmn-border);
  animation: op-chart-pulse 1.2s ease-in-out infinite;
}
@keyframes op-chart-pulse {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50%       { opacity: 1;   transform: scale(1.3); }
}

/* ── Filter table / toolbar ─────────────────────────────────────────────── */
.op-filter-table { display: flex; flex-direction: column; height: 100%; }
.op-filter-table .bpmn-table-wrap { flex: 1; overflow: auto; }
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
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 5px 10px;
  font-size: 12px;
  color: var(--bpmn-fg);
  outline: none;
  font-family: var(--bpmn-font);
}
.op-search::placeholder { color: var(--bpmn-fg-muted); }
.op-search:focus { border-color: var(--bpmn-accent); }
.op-search-count {
  font-size: 11px;
  color: var(--bpmn-fg-muted);
  white-space: nowrap;
}
.op-th-sort {
  cursor: pointer;
  user-select: none;
  display: flex !important;
  align-items: center;
  gap: 4px;
}
.op-th-sort:hover { color: var(--bpmn-fg); }
.op-sort-icon { font-size: 10px; color: var(--bpmn-fg-muted); flex-shrink: 0; }
.op-sort-icon--active { color: var(--bpmn-accent); }

/* ── Pagination bar ──────────────────────────────────────────────────────── */
.op-pagination {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0 4px;
  font-size: 12px;
  color: var(--bpmn-fg-muted);
  flex-shrink: 0;
}
.op-pagination-btn {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 2px 8px;
  font-size: 13px;
  color: var(--bpmn-fg);
  cursor: pointer;
  line-height: 1.4;
  font-family: var(--bpmn-font);
}
.op-pagination-btn:hover:not(:disabled) { border-color: var(--bpmn-accent); color: var(--bpmn-accent); }
.op-pagination-btn:disabled { opacity: 0.35; cursor: default; }
.op-page-size {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 2px 4px;
  font-size: 12px;
  color: var(--bpmn-fg);
  cursor: pointer;
  font-family: var(--bpmn-font);
}
.op-pagination-info { margin: 0 4px; white-space: nowrap; }

/* ── Grouped definitions ─────────────────────────────────────────────────── */
.op-def-view { display: flex; flex-direction: column; }
.op-def-view .op-def-groups { flex: 1; overflow: auto; }
.op-def-groups { display: flex; flex-direction: column; }
.op-def-header { margin-bottom: 4px; }
.op-def-group { margin-bottom: 2px; }
.op-def-group-row {
  display: grid;
  grid-template-columns: 16px 1fr 160px 80px 100px;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  border-radius: var(--bpmn-radius);
  gap: 8px;
  font-weight: 600;
  font-size: 13px;
}
.op-def-group-row:hover { background: var(--bpmn-surface-2); }
.op-def-chevron {
  font-size: 14px;
  color: var(--bpmn-fg-muted);
  display: inline-block;
  transition: transform 0.15s;
  text-align: center;
}
.op-def-chevron--open { transform: rotate(90deg); }
.op-def-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.op-def-group-id {
  font-size: 11px;
  color: var(--bpmn-fg-muted);
  font-weight: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.op-def-count {
  font-size: 11px;
  color: var(--bpmn-fg-muted);
  font-weight: normal;
}
.op-def-versions {
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-bottom: 6px;
}
.op-def-version-row {
  display: flex;
  align-items: center;
  padding: 5px 12px;
  cursor: pointer;
  border-radius: var(--bpmn-radius);
  gap: 10px;
  font-size: 12px;
}
.op-def-version-row:hover { background: rgba(76,142,247,0.08); }
.op-def-version-num {
  font-weight: 600;
  color: var(--bpmn-accent);
  min-width: 40px;
}
.op-def-version-tag { color: var(--bpmn-fg-muted); font-size: 11px; }
.op-def-version-key {
  font-family: monospace;
  font-size: 11px;
  color: var(--bpmn-fg-muted);
  margin-left: auto;
}

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
  color: var(--bpmn-fg);
}
.op-def-meta-version {
  font-size: 12px;
  color: var(--bpmn-fg-muted);
  background: var(--bpmn-surface-2);
  padding: 2px 8px;
  border-radius: var(--bpmn-radius-sm);
}
.op-def-canvas {
  flex: 1;
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  overflow: hidden;
  min-height: 0;
}

/* ── Decisions view ──────────────────────────────────────────────────────── */
.op-dec-def-header {
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmn-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 6px 12px 2px 32px;
}

/* ── Usage metrics section ───────────────────────────────────────────────── */
.op-usage-section { margin-bottom: 16px; }
.op-usage-grid {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.op-usage-card {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  padding: 10px 16px;
  min-width: 140px;
  flex: 1;
}
.op-usage-card-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--bpmn-fg);
  margin-bottom: 2px;
}
.op-usage-card-label {
  font-size: 11px;
  color: var(--bpmn-fg-muted);
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
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
  overflow-y: auto;
  padding: 14px;
}
.op-task-info-heading {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--bpmn-fg-muted);
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
  color: var(--bpmn-fg-muted);
}
.op-task-meta-value {
  font-size: 12px;
  color: var(--bpmn-fg);
  word-break: break-all;
}
.op-task-form-wrap {
  flex: 1;
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius);
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
  background: var(--bpmn-surface-2);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  font-size: 12px;
  font-family: var(--bpmn-font);
  color: var(--bpmn-fg);
  cursor: pointer;
  transition: background 0.15s;
}
.op-action-btn:hover { background: var(--bpmn-border); }
.op-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.op-action-btn--primary {
  background: var(--bpmn-accent);
  border-color: var(--bpmn-accent);
  color: #fff;
}
.op-action-btn--primary:hover { opacity: 0.88; background: var(--bpmn-accent); }
.op-action-btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--bpmn-border);
}
.op-action-feedback {
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: var(--bpmn-radius-sm);
}
.op-action-feedback--ok { background: color-mix(in srgb, var(--op-c-green) 12%, transparent); color: var(--op-c-green); }
.op-action-feedback--err { background: color-mix(in srgb, var(--op-c-amber) 12%, transparent); color: var(--op-c-amber); }

/* ── Process chain breadcrumb ────────────────────────────────────────────── */
.op-process-chain {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bpmn-fg-muted);
  margin-bottom: 8px;
  flex-wrap: wrap;
}
.op-process-chain-sep { color: var(--bpmn-border); }
.op-process-chain-link {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  font-size: 12px;
  color: var(--bpmn-accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.op-process-chain-link:hover { opacity: 0.75; }
.op-process-chain-link:disabled { color: var(--bpmn-fg-muted); text-decoration: none; cursor: default; }

/* ── Job details section ──────────────────────────────────────────────────── */
.op-job-section {
  margin-top: 16px;
  border-top: 1px solid var(--bpmn-border);
  padding-top: 12px;
}
.op-job-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmn-fg-muted);
  margin-bottom: 8px;
}
.op-job-headers {
  font-size: 12px;
  font-family: monospace;
  background: var(--bpmn-surface-2);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  padding: 8px 10px;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
  color: var(--bpmn-fg);
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
  color: var(--bpmn-fg-muted);
  line-height: 1.5;
  margin: 0;
}
.op-ai-response {
  flex: 1;
  font-size: 12px;
  font-family: var(--bpmn-font);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--bpmn-surface-2);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-sm);
  padding: 10px 12px;
  overflow-y: auto;
  min-height: 200px;
  margin: 0;
}
`

export function injectOperateStyles(): void {
	injectStyle(OPERATE_STYLE_ID, OPERATE_CSS)
}
