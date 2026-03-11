import { injectStyle } from "./inject.js"

export const UI_TOKENS_STYLE_ID = "bpmn-ui-tokens-v1"
export const UI_COMPONENTS_STYLE_ID = "bpmn-ui-components-v1"

/**
 * CSS custom properties — light theme by default, dark override via
 * `[data-theme="dark"]` on any ancestor element (e.g. the app root).
 *
 * Nav variables use a fixed dark palette independent of the main theme,
 * matching the pattern used by VS Code, GitHub, and similar apps.
 */
export const UI_TOKENS_CSS = `
:root {
  --bpmn-bg: #f4f4f8;
  --bpmn-surface: #ffffff;
  --bpmn-surface-2: #f0f0f8;
  --bpmn-border: #d8d8e8;
  --bpmn-fg: #1a1a2e;
  --bpmn-fg-muted: #6666a0;
  --bpmn-font: system-ui, -apple-system, sans-serif;
  --bpmn-accent: #1a56db;
  --bpmn-accent-fg: #ffffff;
  --bpmn-success: #22c55e;
  --bpmn-warn: #f59e0b;
  --bpmn-danger: #ef4444;
  --bpmn-radius: 6px;
  --bpmn-radius-sm: 4px;
  --bpmn-radius-lg: 10px;
  /* Nav sidebar — always dark-navy regardless of theme */
  --bpmn-nav-bg: #1e2030;
  --bpmn-nav-fg: #9898b8;
  --bpmn-nav-fg-active: #ffffff;
  --bpmn-nav-width: 220px;
  --bpmn-header-height: 52px;
}

[data-theme="dark"] {
  --bpmn-bg: #0f0f1a;
  --bpmn-surface: #1a1a2e;
  --bpmn-surface-2: #222240;
  --bpmn-border: #2e2e4e;
  --bpmn-fg: #e0e0f0;
  --bpmn-fg-muted: #8888a8;
  --bpmn-accent: #4c8ef7;
  --bpmn-nav-bg: #14141f;
  --bpmn-nav-fg: #8888aa;
}
`

/** CSS for shared components: badge, card, table, theme-switcher. */
export const UI_COMPONENTS_CSS = `
/* ── Badge ───────────────────────────────────────────────────────────────── */
.bpmn-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: var(--bpmn-radius-sm, 4px);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--bpmn-surface-2);
  color: var(--bpmn-fg-muted);
  text-transform: uppercase;
  white-space: nowrap;
  font-family: var(--bpmn-font, system-ui, sans-serif);
}
.bpmn-badge--active       { background: rgba(34,197,94,0.15);   color: #22c55e; }
.bpmn-badge--completed    { background: rgba(99,102,241,0.15);  color: #a5b4fc; }
.bpmn-badge--terminated   { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmn-badge--failed       { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmn-badge--error_thrown { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmn-badge--created      { background: rgba(76,142,247,0.15);  color: #93c5fd; }
.bpmn-badge--resolved     { background: rgba(34,197,94,0.15);   color: #86efac; }
.bpmn-badge--pending      { background: rgba(245,158,11,0.18);  color: #fbbf24; }
.bpmn-badge--migrated     { background: rgba(139,92,246,0.15);  color: #c4b5fd; }
.bpmn-badge--timed_out    { background: rgba(245,158,11,0.18);  color: #fbbf24; }
.bpmn-badge--retries_updated { background: rgba(76,142,247,0.15); color: #93c5fd; }
.bpmn-badge--tenant       { background: rgba(255,255,255,0.06); color: var(--bpmn-fg-muted); font-weight: 400; }
.bpmn-badge--incident-dot { background: rgba(245,158,11,0.18); color: var(--bpmn-warn); margin-left: 6px; padding: 2px 5px; }
.bpmn-badge-wrap { display: flex; align-items: center; }

/* ── Stats card ──────────────────────────────────────────────────────────── */
.bpmn-card {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-lg, 10px);
  padding: 20px 18px;
  transition: border-color 0.15s;
}
.bpmn-card--clickable { cursor: pointer; }
.bpmn-card--clickable:hover { border-color: var(--bpmn-accent); }
.bpmn-card--warn .bpmn-card-value { color: var(--bpmn-warn); }
.bpmn-card-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--bpmn-accent);
  margin-bottom: 6px;
}
.bpmn-card-label {
  font-size: 12px;
  color: var(--bpmn-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Data table ──────────────────────────────────────────────────────────── */
.bpmn-table-wrap {
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius, 6px);
  overflow: hidden;
}
.bpmn-table-header {
  display: flex;
  background: var(--bpmn-surface-2);
  border-bottom: 1px solid var(--bpmn-border);
}
.bpmn-table-th {
  padding: 9px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmn-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmn-table-th[style*="width"] { flex: none; }
.bpmn-table-body {
  overflow-y: auto;
  max-height: calc(100vh - 240px);
}
.bpmn-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--bpmn-border);
  transition: background 0.1s;
}
.bpmn-table-row:last-child { border-bottom: none; }
.bpmn-table-row--clickable { cursor: pointer; }
.bpmn-table-row--clickable:hover { background: var(--bpmn-surface-2); }
.bpmn-table-td {
  padding: 10px 14px;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmn-table-td[style*="width"] { flex: none; }
.bpmn-table-empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--bpmn-fg-muted);
  font-size: 13px;
}

/* ── Theme switcher button ───────────────────────────────────────────────── */
.bpmn-theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--bpmn-radius, 6px);
  color: var(--bpmn-fg-muted, #6666a0);
  cursor: pointer;
  padding: 0; flex-shrink: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.bpmn-theme-btn:hover {
  background: var(--bpmn-surface-2);
  color: var(--bpmn-fg);
  border-color: var(--bpmn-border);
}
.bpmn-theme-btn svg { width: 15px; height: 15px; pointer-events: none; }

/* ── Theme dropdown ──────────────────────────────────────────────────────── */
.bpmn-theme-dropdown {
  position: fixed;
  display: flex; flex-direction: column;
  gap: 1px; padding: 4px;
  background: var(--bpmn-surface);
  border: 1px solid var(--bpmn-border);
  border-radius: var(--bpmn-radius-lg, 10px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
  z-index: 10000; min-width: 140px;
}
.bpmn-theme-dropdown[data-theme="dark"] {
  background: rgba(20, 20, 28, 0.96);
  border-color: rgba(255,255,255,0.1);
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
  backdrop-filter: blur(12px);
}
.bpmn-theme-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border: none; background: transparent;
  color: var(--bpmn-fg, #1a1a2e);
  cursor: pointer;
  border-radius: calc(var(--bpmn-radius, 6px) - 2px);
  font-size: 12px; text-align: left; width: 100%;
  font-family: var(--bpmn-font, system-ui, sans-serif);
  transition: background 0.1s;
}
.bpmn-theme-item:hover { background: var(--bpmn-surface-2); }
.bpmn-theme-dropdown[data-theme="dark"] .bpmn-theme-item { color: rgba(255,255,255,0.75); }
.bpmn-theme-dropdown[data-theme="dark"] .bpmn-theme-item:hover { background: rgba(255,255,255,0.08); }
.bpmn-theme-item-check {
  width: 12px; height: 12px; flex-shrink: 0;
  color: var(--bpmn-accent, #1a56db);
  display: flex; align-items: center;
}
.bpmn-theme-dropdown[data-theme="dark"] .bpmn-theme-item-check { color: #4c8ef7; }
.bpmn-theme-item-icon {
  width: 14px; height: 14px; flex-shrink: 0; opacity: 0.7;
  display: flex; align-items: center;
}
.bpmn-theme-item-check svg,
.bpmn-theme-item-icon svg { width: 100%; height: 100%; }
`

export function injectUiTokens(): void {
	injectStyle(UI_TOKENS_STYLE_ID, UI_TOKENS_CSS)
}

export function injectUiComponents(): void {
	injectStyle(UI_COMPONENTS_STYLE_ID, UI_COMPONENTS_CSS)
}

/** Injects all shared UI styles (tokens + components). */
export function injectUiStyles(): void {
	injectUiTokens()
	injectUiComponents()
}
