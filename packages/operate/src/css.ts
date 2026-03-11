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
  gap: 6px;
  margin-bottom: 14px;
}
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
  gap: 16px;
  margin-bottom: 28px;
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
.op-var-list { display: flex; flex-direction: column; gap: 4px; }
.op-var-row { padding: 6px 10px; border-radius: var(--bpmn-radius-sm); background: var(--bpmn-surface-2); }
.op-var-name { font-family: monospace; font-size: 12px; color: var(--bpmn-fg); }
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
`

export function injectOperateStyles(): void {
	injectStyle(OPERATE_STYLE_ID, OPERATE_CSS)
}
