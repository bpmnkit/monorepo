import { injectStyle } from "./inject.js"

export const UI_TOKENS_STYLE_ID = "bpmnkit-ui-tokens-v1"
export const UI_COMPONENTS_STYLE_ID = "bpmnkit-ui-components-v1"

/**
 * CSS custom properties — light theme by default, dark override via
 * `[data-theme="dark"]` on any ancestor element (e.g. the app root).
 *
 * Nav variables use a fixed dark palette independent of the main theme,
 * matching the pattern used by VS Code, GitHub, and similar apps.
 */
export const UI_TOKENS_CSS = `
:root {
  --bpmnkit-bg: #f4f4f8;
  --bpmnkit-surface: #ffffff;
  --bpmnkit-surface-2: #eeeef8;
  --bpmnkit-border: #d0d0e8;
  --bpmnkit-fg: #1a1a2e;
  --bpmnkit-fg-muted: #6666a0;
  --bpmnkit-font: system-ui, -apple-system, sans-serif;
  --bpmnkit-font-mono: ui-monospace, 'Cascadia Code', 'JetBrains Mono', monospace;
  --bpmnkit-accent: #1a56db;
  --bpmnkit-accent-bright: #3b82f6;
  --bpmnkit-accent-subtle: rgba(26, 86, 219, 0.12);
  --bpmnkit-accent-fg: #ffffff;
  --bpmnkit-teal: #0d9488;
  --bpmnkit-success: #16a34a;
  --bpmnkit-warn: #d97706;
  --bpmnkit-danger: #dc2626;
  --bpmnkit-panel-bg: rgba(255, 255, 255, 0.92);
  --bpmnkit-panel-border: rgba(0, 0, 0, 0.08);
  --bpmnkit-radius: 6px;
  --bpmnkit-radius-sm: 4px;
  --bpmnkit-radius-lg: 10px;
  /* Nav sidebar — always dark-navy regardless of theme */
  --bpmnkit-nav-bg: #1a1a2e;
  --bpmnkit-nav-fg: #9090b4;
  --bpmnkit-nav-fg-active: #ffffff;
  --bpmnkit-nav-width: 220px;
  --bpmnkit-header-height: 52px;
}

[data-theme="dark"] {
  --bpmnkit-bg: #0d0d16;
  --bpmnkit-surface: #161626;
  --bpmnkit-surface-2: #1e1e2e;
  --bpmnkit-border: #2a2a42;
  --bpmnkit-fg: #cdd6f4;
  --bpmnkit-fg-muted: #8888a8;
  --bpmnkit-accent: #6b9df7;
  --bpmnkit-accent-bright: #89b4fa;
  --bpmnkit-accent-subtle: rgba(107, 157, 247, 0.15);
  --bpmnkit-teal: #2dd4bf;
  --bpmnkit-success: #22c55e;
  --bpmnkit-warn: #f59e0b;
  --bpmnkit-danger: #f87171;
  --bpmnkit-panel-bg: rgba(13, 13, 22, 0.92);
  --bpmnkit-panel-border: rgba(255, 255, 255, 0.08);
  --bpmnkit-nav-bg: #0a0a14;
  --bpmnkit-nav-fg: #8888a8;
}

[data-theme="neon"] {
  --bpmnkit-bg: oklch(5% 0.025 270);
  --bpmnkit-surface: oklch(9% 0.025 270);
  --bpmnkit-surface-2: oklch(12% 0.03 270);
  --bpmnkit-border: oklch(65% 0.28 280 / 0.2);
  --bpmnkit-fg: oklch(88% 0.02 270);
  --bpmnkit-fg-muted: oklch(55% 0.04 270);
  --bpmnkit-accent: oklch(55% 0.22 280);
  --bpmnkit-accent-bright: oklch(73% 0.16 280);
  --bpmnkit-accent-subtle: oklch(55% 0.22 280 / 0.15);
  --bpmnkit-accent-fg: oklch(95% 0.01 270);
  --bpmnkit-teal: oklch(72% 0.18 185);
  --bpmnkit-success: oklch(72% 0.18 145);
  --bpmnkit-warn: oklch(75% 0.17 75);
  --bpmnkit-danger: oklch(65% 0.22 25);
  --bpmnkit-panel-bg: oklch(8% 0.03 270 / 0.96);
  --bpmnkit-panel-border: oklch(65% 0.28 280 / 0.2);
  --bpmnkit-nav-bg: oklch(5% 0.025 270);
  --bpmnkit-nav-fg: oklch(50% 0.06 270);
}
`

/** CSS for shared components: badge, card, table, theme-switcher. */
export const UI_COMPONENTS_CSS = `
/* ── Badge ───────────────────────────────────────────────────────────────── */
.bpmnkit-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: var(--bpmnkit-radius-sm, 4px);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg-muted);
  text-transform: uppercase;
  white-space: nowrap;
  font-family: var(--bpmnkit-font, system-ui, sans-serif);
}
.bpmnkit-badge--active       { background: rgba(34,197,94,0.15);   color: #22c55e; }
.bpmnkit-badge--completed    { background: rgba(99,102,241,0.15);  color: #a5b4fc; }
.bpmnkit-badge--terminated   { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmnkit-badge--failed       { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmnkit-badge--error_thrown { background: rgba(239,68,68,0.15);   color: #f87171; }
.bpmnkit-badge--created      { background: rgba(76,142,247,0.15);  color: #93c5fd; }
.bpmnkit-badge--resolved     { background: rgba(34,197,94,0.15);   color: #86efac; }
.bpmnkit-badge--pending      { background: rgba(245,158,11,0.18);  color: #fbbf24; }
.bpmnkit-badge--migrated     { background: rgba(139,92,246,0.15);  color: #c4b5fd; }
.bpmnkit-badge--timed_out    { background: rgba(245,158,11,0.18);  color: #fbbf24; }
.bpmnkit-badge--retries_updated { background: rgba(76,142,247,0.15); color: #93c5fd; }
.bpmnkit-badge--tenant       { background: rgba(255,255,255,0.06); color: var(--bpmnkit-fg-muted); font-weight: 400; }
.bpmnkit-badge--incident-dot { background: rgba(245,158,11,0.18); color: var(--bpmnkit-warn); margin-left: 6px; padding: 2px 5px; }
.bpmnkit-badge-wrap { display: flex; align-items: center; }

/* ── Stats card ──────────────────────────────────────────────────────────── */
.bpmnkit-card {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius-lg, 10px);
  padding: 20px 18px;
  transition: border-color 0.15s;
}
.bpmnkit-card--clickable { cursor: pointer; }
.bpmnkit-card--clickable:hover { border-color: var(--bpmnkit-accent); }
.bpmnkit-card--warn .bpmnkit-card-value { color: var(--bpmnkit-warn); }
.bpmnkit-card-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1;
  color: var(--bpmnkit-accent);
  margin-bottom: 6px;
}
.bpmnkit-card-label {
  font-size: 12px;
  color: var(--bpmnkit-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Data table ──────────────────────────────────────────────────────────── */
.bpmnkit-table-wrap {
  background: var(--bpmnkit-surface);
  border: 1px solid var(--bpmnkit-border);
  border-radius: var(--bpmnkit-radius, 6px);
  overflow: hidden;
}
.bpmnkit-table-header {
  display: flex;
  background: var(--bpmnkit-surface-2);
  border-bottom: 1px solid var(--bpmnkit-border);
}
.bpmnkit-table-th {
  padding: 9px 14px;
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmnkit-fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-table-th[style*="width"] { flex: none; }
.bpmnkit-table-body {
  overflow-y: auto;
}
.bpmnkit-table-row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--bpmnkit-border);
  transition: background 0.1s;
}
.bpmnkit-table-row:last-child { border-bottom: none; }
.bpmnkit-table-row--clickable { cursor: pointer; }
.bpmnkit-table-row--clickable:hover { background: var(--bpmnkit-surface-2); }
.bpmnkit-table-td {
  padding: 7px 14px;
  font-size: 13px;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-table-td[style*="width"] { flex: none; }
.bpmnkit-table-empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--bpmnkit-fg-muted);
  font-size: 13px;
}

/* ── Theme switcher button ───────────────────────────────────────────────── */
.bpmnkit-theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 32px; height: 32px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--bpmnkit-radius, 6px);
  color: var(--bpmnkit-fg-muted, #6666a0);
  cursor: pointer;
  padding: 0; flex-shrink: 0;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.bpmnkit-theme-btn:hover {
  background: var(--bpmnkit-surface-2);
  color: var(--bpmnkit-fg);
  border-color: var(--bpmnkit-border);
}
.bpmnkit-theme-btn svg { width: 15px; height: 15px; pointer-events: none; }

/* ── Theme dropdown ──────────────────────────────────────────────────────── */
.bpmnkit-theme-dropdown {
  position: fixed;
  display: flex; flex-direction: column;
  gap: 1px; padding: 4px;
  background: var(--bpmnkit-panel-bg, rgba(255, 255, 255, 0.92));
  border: 1px solid var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08));
  border-radius: var(--bpmnkit-radius-lg, 10px);
  box-shadow: 0 6px 24px rgba(0,0,0,0.15);
  z-index: 10000; min-width: 140px;
  backdrop-filter: blur(12px);
}
.bpmnkit-theme-dropdown[data-theme="dark"] {
  box-shadow: 0 6px 24px rgba(0,0,0,0.5);
}
.bpmnkit-theme-dropdown[data-theme="neon"] {
  box-shadow: 0 6px 24px oklch(0% 0 0 / 0.6), 0 0 0 1px oklch(65% 0.28 280 / 0.1);
}
.bpmnkit-theme-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border: none; background: transparent;
  color: var(--bpmnkit-fg, #1a1a2e);
  cursor: pointer;
  border-radius: calc(var(--bpmnkit-radius, 6px) - 2px);
  font-size: 12px; text-align: left; width: 100%;
  font-family: var(--bpmnkit-font, system-ui, sans-serif);
  transition: background 0.1s;
}
.bpmnkit-theme-item:hover { background: var(--bpmnkit-surface-2); }
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item { color: rgba(255,255,255,0.75); }
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item:hover { background: rgba(255,255,255,0.08); }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item { color: oklch(73% 0.16 280); }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item:hover { background: oklch(65% 0.28 280 / 0.1); }
.bpmnkit-theme-item-check {
  width: 12px; height: 12px; flex-shrink: 0;
  color: var(--bpmnkit-accent, #1a56db);
  display: flex; align-items: center;
}
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item-check { color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item-check { color: oklch(72% 0.18 185); }
.bpmnkit-theme-item-icon {
  width: 14px; height: 14px; flex-shrink: 0; opacity: 0.7;
  display: flex; align-items: center;
}
.bpmnkit-theme-item-check svg,
.bpmnkit-theme-item-icon svg { width: 100%; height: 100%; }
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
