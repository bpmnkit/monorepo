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
  --bpmnkit-bg: oklch(11% 0.025 270);
  --bpmnkit-surface: oklch(15% 0.025 270);
  --bpmnkit-surface-2: oklch(19% 0.03 270);
  --bpmnkit-border: oklch(65% 0.24 280 / 0.18);
  --bpmnkit-fg: oklch(88% 0.02 270);
  --bpmnkit-fg-muted: oklch(60% 0.04 270);
  --bpmnkit-accent: oklch(65% 0.22 280);
  --bpmnkit-accent-bright: oklch(76% 0.16 280);
  --bpmnkit-accent-subtle: oklch(65% 0.22 280 / 0.15);
  --bpmnkit-accent-fg: oklch(95% 0.01 270);
  --bpmnkit-teal: oklch(72% 0.18 185);
  --bpmnkit-success: oklch(72% 0.18 145);
  --bpmnkit-warn: oklch(75% 0.17 75);
  --bpmnkit-danger: oklch(65% 0.22 25);
  --bpmnkit-panel-bg: oklch(13% 0.03 270 / 0.96);
  --bpmnkit-panel-border: oklch(65% 0.24 280 / 0.18);
  --bpmnkit-nav-bg: oklch(8% 0.025 270);
  --bpmnkit-nav-fg: oklch(55% 0.06 270);
}

/* ── BPMN Kit design system ──────────────────────────────────────────────────
 * The bpmnkit.com landing-page system, used by Drop and the Editor chrome:
 * flat (no shadows, gradients or glows), square, hairline-ruled, one accent.
 * Independent of the product palette above — an app opts in by reading the
 * --bpmnkit-ds-* tokens, so nothing that reads --bpmnkit-accent changes.
 * The two type families are self-hosted by the consuming app.
 * ─────────────────────────────────────────────────────────────────────────── */

:root {
  /* Ground */
  --bpmnkit-ds-bg: #f4f5f7;
  --bpmnkit-ds-bg-alt: #eef0f3;
  --bpmnkit-ds-surface: #ffffff;
  --bpmnkit-ds-canvas: #fbfbfc;
  --bpmnkit-ds-dark: #14161a;
  --bpmnkit-ds-dark-code: #0f1114;

  /* Ink */
  --bpmnkit-ds-ink: #14161a;
  --bpmnkit-ds-ink-2: #4b5158;
  --bpmnkit-ds-ink-3: #5c6470;
  --bpmnkit-ds-ink-4: #8b929c;
  --bpmnkit-ds-ink-muted: #9aa1aa;
  --bpmnkit-ds-ink-on-dark: #f4f5f7;
  --bpmnkit-ds-ink-on-dark-2: #c8ccd2;
  /* BPMN strokes and labels — owned by the diagram renderer, not the chrome */
  --bpmnkit-ds-diagram-ink: #22242a;

  /* Accent — the only chromatic color in the system */
  --bpmnkit-ds-accent: #a8503a;
  --bpmnkit-ds-accent-hover: #8f412e;
  --bpmnkit-ds-accent-on-dark: #c9755c;
  --bpmnkit-ds-accent-tint: #fdf3ef;

  /* Lines — the system's only depth cue */
  --bpmnkit-ds-line: #d8dbe0;
  --bpmnkit-ds-line-soft: #e4e6ea;
  --bpmnkit-ds-line-strong: #14161a;
  --bpmnkit-ds-line-dark: #2c3038;

  /* Code panel syntax */
  --bpmnkit-ds-code-text: #e7e9ec;
  --bpmnkit-ds-code-comment: #6b7280;
  --bpmnkit-ds-code-string: #8fbf9f;
  --bpmnkit-ds-code-prompt: #c9755c;

  /* Type — two roles only: sans for prose, mono for every label and datum */
  --bpmnkit-ds-font-sans: 'Space Grotesk', 'Helvetica Neue', Helvetica, sans-serif;
  --bpmnkit-ds-font-mono: 'Space Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, monospace;

  /* Type scale — sans */
  --bpmnkit-ds-t-display: 60px;
  --bpmnkit-ds-t-h2: 30px;
  --bpmnkit-ds-t-lead: 18px;
  --bpmnkit-ds-t-body: 15.5px;
  --bpmnkit-ds-t-body-sm: 14.5px;
  --bpmnkit-ds-t-ui: 14px;

  /* Type scale — mono, uppercase except code and filenames */
  --bpmnkit-ds-t-mono-eyebrow: 12px;
  --bpmnkit-ds-t-mono-label: 11.5px;
  --bpmnkit-ds-t-mono-micro: 10.5px;
  --bpmnkit-ds-t-code: 13px;

  /* Spacing */
  --bpmnkit-ds-sp-1: 6px;
  --bpmnkit-ds-sp-2: 10px;
  --bpmnkit-ds-sp-3: 14px;
  --bpmnkit-ds-sp-4: 20px;
  --bpmnkit-ds-sp-5: 26px;
  --bpmnkit-ds-sp-6: 34px;
  --bpmnkit-ds-sp-7: 48px;
  --bpmnkit-ds-sp-8: 64px;

  /* Layout */
  --bpmnkit-ds-page-max: 1200px;
  --bpmnkit-ds-page-gutter: 28px;
  --bpmnkit-ds-panel-width: 340px;
  --bpmnkit-ds-topbar-height: 46px;
}

/* CJK fallback, keyed off the lang attribute on the page or any container.
   Neither brand face has CJK glyphs, and Japanese and Chinese draw the same Han
   characters differently — so each script names its own faces before the
   generic family picks one. */
:lang(ja) {
  --bpmnkit-ds-font-sans: 'Space Grotesk', 'Helvetica Neue', Helvetica, 'Hiragino Sans', 'Yu Gothic UI', Meiryo, 'Noto Sans JP', sans-serif;
  --bpmnkit-ds-font-mono: 'Space Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'Hiragino Sans', 'Yu Gothic UI', 'Noto Sans JP', monospace;
}
:lang(zh) {
  --bpmnkit-ds-font-sans: 'Space Grotesk', 'Helvetica Neue', Helvetica, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', sans-serif;
  --bpmnkit-ds-font-mono: 'Space Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans SC', monospace;
}
`

/**
 * CSS for the shared components: badge, card, table, theme-switcher.
 *
 * These render inside `@bpmnkit/operate`, which reads the bpmnkit.com design
 * system, so they are drawn to its rules: square, hairline-ruled, no shadow or
 * blur, one accent, and mono for every label, count and id. Values resolve from
 * the `--bpmnkit-ds-*` tokens above, with a literal fallback so a package still
 * works standalone.
 *
 * A consumer themes them by redeclaring those tokens on its own root — which is
 * what Operate's dark and neon themes do — rather than by adding a second set.
 *
 * Status colour is the exception, as semantic colour is throughout this repo:
 * the `--bpmnkit-state-*` pairs below carry it, and are the only chromatic
 * values here besides the accent.
 */
export const UI_COMPONENTS_CSS = `
/* ── Status colour — semantic, and exempt from the one-accent rule ───────── */
:root {
  --bpmnkit-state-ok: #2f6f5b;
  --bpmnkit-state-info: #3c5a9a;
  --bpmnkit-state-warn: #96640f;
  --bpmnkit-state-bad: #a33a34;
  --bpmnkit-state-idle: #5c6470;
}
[data-theme="dark"],
[data-theme="neon"] {
  --bpmnkit-state-ok: #4fbd8b;
  --bpmnkit-state-info: #7ea2e0;
  --bpmnkit-state-warn: #e0a44e;
  --bpmnkit-state-bad: #e07b76;
  --bpmnkit-state-idle: #8b929c;
}

/* ── Badge ───────────────────────────────────────────────────────────────── */
/* A hairline chip, not a filled pill: the state is carried by the word and its
   colour, and the box is drawn the way every other box in the system is. */
.bpmnkit-badge {
  display: inline-block;
  padding: 1px 6px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.06em;
  color: var(--bpmnkit-state-idle);
  border: 1px solid color-mix(in srgb, var(--bpmnkit-state-idle) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-idle) 8%, transparent);
  text-transform: uppercase;
  white-space: nowrap;
}
.bpmnkit-badge--active,
.bpmnkit-badge--resolved {
  color: var(--bpmnkit-state-ok);
  border-color: color-mix(in srgb, var(--bpmnkit-state-ok) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-ok) 8%, transparent);
}
.bpmnkit-badge--completed,
.bpmnkit-badge--created,
.bpmnkit-badge--migrated,
.bpmnkit-badge--retries_updated {
  color: var(--bpmnkit-state-info);
  border-color: color-mix(in srgb, var(--bpmnkit-state-info) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-info) 8%, transparent);
}
.bpmnkit-badge--pending,
.bpmnkit-badge--timed_out {
  color: var(--bpmnkit-state-warn);
  border-color: color-mix(in srgb, var(--bpmnkit-state-warn) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-warn) 8%, transparent);
}
.bpmnkit-badge--terminated,
.bpmnkit-badge--failed,
.bpmnkit-badge--error_thrown {
  color: var(--bpmnkit-state-bad);
  border-color: color-mix(in srgb, var(--bpmnkit-state-bad) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-bad) 8%, transparent);
}
.bpmnkit-badge--tenant {
  color: var(--bpmnkit-ds-ink-4, #8b929c);
  border-color: var(--bpmnkit-ds-line, #d8dbe0);
  background: transparent;
}
.bpmnkit-badge--incident-dot {
  color: var(--bpmnkit-state-warn);
  border-color: color-mix(in srgb, var(--bpmnkit-state-warn) 35%, transparent);
  background: color-mix(in srgb, var(--bpmnkit-state-warn) 8%, transparent);
  margin-left: 6px;
}
.bpmnkit-badge-wrap { display: flex; align-items: center; }

/* ── Stats card ──────────────────────────────────────────────────────────── */
/* Borderless on purpose: cards sit in a grid that draws its own hairlines, so a
   border here would double every rule. */
.bpmnkit-card {
  background: var(--bpmnkit-ds-surface, #ffffff);
  padding: var(--bpmnkit-ds-sp-4, 20px);
  transition: background 0.15s;
}
.bpmnkit-card--clickable { cursor: pointer; }
.bpmnkit-card--clickable:hover { background: var(--bpmnkit-ds-bg, #f4f5f7); }
.bpmnkit-card--warn .bpmnkit-card-value { color: var(--bpmnkit-state-warn); }
.bpmnkit-card-value {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: 30px;
  line-height: 1;
  color: var(--bpmnkit-ds-ink, #14161a);
  margin-bottom: var(--bpmnkit-ds-sp-2, 10px);
  letter-spacing: -0.02em;
}
.bpmnkit-card-label {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  color: var(--bpmnkit-ds-ink-4, #8b929c);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* ── Data table ──────────────────────────────────────────────────────────── */
.bpmnkit-table-wrap {
  background: var(--bpmnkit-ds-surface, #ffffff);
  border: 1px solid var(--bpmnkit-ds-line, #d8dbe0);
  overflow: hidden;
}
.bpmnkit-table-header {
  display: flex;
  background: var(--bpmnkit-ds-bg, #f4f5f7);
  border-bottom: 1px solid var(--bpmnkit-ds-line, #d8dbe0);
}
.bpmnkit-table-th {
  padding: 8px 14px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  color: var(--bpmnkit-ds-ink-4, #8b929c);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  border-bottom: 1px solid var(--bpmnkit-ds-line-soft, #e4e6ea);
  transition: background 0.1s;
}
.bpmnkit-table-row:last-child { border-bottom: none; }
.bpmnkit-table-row--clickable { cursor: pointer; }
.bpmnkit-table-row--clickable:hover { background: var(--bpmnkit-ds-bg, #f4f5f7); }
.bpmnkit-table-td {
  padding: 8px 14px;
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  color: var(--bpmnkit-ds-ink-2, #4b5158);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-table-td[style*="width"] { flex: none; }
.bpmnkit-table-empty {
  padding: 28px 20px;
  text-align: center;
  color: var(--bpmnkit-ds-ink-4, #8b929c);
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
}

/* ── Theme switcher button ───────────────────────────────────────────────── */
.bpmnkit-theme-btn {
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px;
  background: transparent;
  border: 1px solid transparent;
  color: var(--bpmnkit-ds-ink-4, #8b929c);
  cursor: pointer;
  padding: 0; flex-shrink: 0;
  transition: color 0.1s, border-color 0.1s;
}
.bpmnkit-theme-btn:hover {
  color: var(--bpmnkit-ds-ink, #14161a);
  border-color: var(--bpmnkit-ds-line, #d8dbe0);
}
.bpmnkit-theme-btn svg { width: 15px; height: 15px; pointer-events: none; }

/* ── Theme dropdown ──────────────────────────────────────────────────────── */
/* Fixed-position, so it escapes the consumer's root and cannot inherit a theme
   redeclared there — the two dark variants below are set on the element itself
   by the switcher. Depth is a hairline, as everywhere else: no shadow, no blur. */
.bpmnkit-theme-dropdown {
  position: fixed;
  display: flex; flex-direction: column;
  padding: 0;
  background: var(--bpmnkit-ds-surface, #ffffff);
  border: 1px solid var(--bpmnkit-ds-line-strong, #14161a);
  z-index: 10000; min-width: 148px;
}
.bpmnkit-theme-dropdown[data-theme="dark"] {
  background: #16181d;
  border-color: #3a3f48;
}
.bpmnkit-theme-dropdown[data-theme="neon"] {
  background: oklch(11% 0.03 270);
  border-color: oklch(65% 0.28 280 / 0.45);
}
.bpmnkit-theme-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px;
  border: none; background: transparent;
  color: var(--bpmnkit-ds-ink, #14161a);
  cursor: pointer;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: left; width: 100%;
  transition: background 0.1s;
}
.bpmnkit-theme-item + .bpmnkit-theme-item { border-top: 1px solid var(--bpmnkit-ds-line-soft, #e4e6ea); }
.bpmnkit-theme-item:hover { background: var(--bpmnkit-ds-bg, #f4f5f7); }
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item { color: #f4f5f7; }
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item + .bpmnkit-theme-item { border-top-color: #2c3038; }
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item:hover { background: #0f1114; }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item { color: oklch(76% 0.06 275); }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item + .bpmnkit-theme-item { border-top-color: oklch(65% 0.28 280 / 0.14); }
.bpmnkit-theme-dropdown[data-theme="neon"] .bpmnkit-theme-item:hover { background: oklch(65% 0.28 280 / 0.1); }
.bpmnkit-theme-item-check {
  width: 12px; height: 12px; flex-shrink: 0;
  color: var(--bpmnkit-ds-accent, #a8503a);
  display: flex; align-items: center;
}
.bpmnkit-theme-dropdown[data-theme="dark"] .bpmnkit-theme-item-check { color: #c9755c; }
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
