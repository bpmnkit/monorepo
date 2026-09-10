export const TABS_CSS = `
.bpmnkit-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: stretch;
  background: var(--tabs-bg, var(--bpmnkit-ds-dark, #14161a));
  border-bottom: 1px solid var(--tabs-border, #2c3038);
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  z-index: 100;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  user-select: none;
}

.bpmnkit-tabs::-webkit-scrollbar {
  display: none;
}

.bpmnkit-tabs[data-theme="light"] {
  --tabs-bg: var(--bpmnkit-ds-bg, #f4f5f7);
  --tabs-border: var(--bpmnkit-ds-line, #d8dbe0);
  --tab-fg: var(--bpmnkit-ds-ink-3, #5c6470);
  --tab-active-bg: var(--bpmnkit-ds-surface, #ffffff);
  --tab-active-fg: var(--bpmnkit-ds-ink, #14161a);
  --tab-active-border: var(--bpmnkit-ds-accent, #a8503a);
  --tab-hover-bg: var(--bpmnkit-ds-surface, #ffffff);
  --tab-close-hover: var(--bpmnkit-ds-bg, #f4f5f7);
  --tab-warn-fg: var(--bpmnkit-warn, #d97706);
  --tab-type: var(--bpmnkit-ds-accent, #a8503a);
}

.bpmnkit-tabs[data-theme="dark"] {
  --tabs-bg: var(--bpmnkit-ds-dark, #14161a);
  --tabs-border: var(--bpmnkit-ds-line-dark, #2c3038);
  --tab-fg: var(--bpmnkit-ds-ink-muted, #9aa1aa);
  --tab-active-bg: var(--bpmnkit-ds-dark, #14161a);
  --tab-active-fg: var(--bpmnkit-ds-ink-on-dark, #f4f5f7);
  --tab-active-border: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --tab-hover-bg: rgba(255,255,255,0.05);
  --tab-close-hover: rgba(255,255,255,0.08);
  --tab-warn-fg: var(--bpmnkit-warn, #f59e0b);
  --tab-type: var(--bpmnkit-ds-accent-on-dark, #c9755c);
}

.bpmnkit-tabs[data-theme="neon"] {
  --tabs-bg: oklch(7% 0.035 280);
  --tabs-border: oklch(65% 0.28 280 / 0.2);
  --tab-fg: oklch(60% 0.12 280);
  --tab-active-bg: oklch(5% 0.025 270);
  --tab-active-fg: oklch(88% 0.02 270);
  --tab-active-border: oklch(72% 0.18 185);
  --tab-hover-bg: oklch(65% 0.28 280 / 0.08);
  --tab-close-hover: oklch(65% 0.28 280 / 0.12);
  --tab-warn-fg: oklch(75% 0.15 60);
  --tab-type: oklch(72% 0.18 185);
}

/* ── Play mode: hide tab groups, show only center slot ───────────────── */

.bpmnkit-tabs.bpmnkit-play-mode .bpmnkit-tab {
  display: none;
}

/* ── Center slot (e.g. process runner buttons) ───────────────────────── */

.bpmnkit-tabs-center {
  position: absolute;
  left: 50%;
  top: 0;
  height: 100%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  pointer-events: none;
  z-index: 1;
}

.bpmnkit-tabs-center > * {
  pointer-events: all;
}

.bpmnkit-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px 0 12px;
  min-width: 80px;
  max-width: 200px;
  border-right: 1px solid var(--tabs-border);
  cursor: pointer;
  color: var(--tab-fg);
  font-size: var(--bpmnkit-ds-t-ui, 14px);
  font-weight: 500;
  white-space: nowrap;
  position: relative;
  flex-shrink: 0;
  transition: background 0.1s;
}

.bpmnkit-tab:hover {
  background: var(--tab-hover-bg);
}

.bpmnkit-tab.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
  border-bottom: 2px solid var(--tab-active-border);
  margin-bottom: -1px;
}

.bpmnkit-tab-type {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--tab-type);
}

.bpmnkit-tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-tab-warn {
  color: var(--tab-warn-fg);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  flex-shrink: 0;
}

.bpmnkit-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1;
  opacity: 0.6;
  flex-shrink: 0;
  font-variant-emoji: text;
}

.bpmnkit-tab-close:hover {
  opacity: 1;
  background: var(--tab-close-hover);
}

/* Content pane — fills remaining space below tabs */
.bpmnkit-tab-content {
  position: absolute;
  top: 36px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.bpmnkit-tab-pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bpmnkit-tab-pane.hidden {
  display: none;
}

/* ── Welcome screen ──────────────────────────────────────────────────────
   The editor's start page, on the bpmnkit.com design system: flat, square,
   hairline-ruled, one accent, mono for every label and datum. Grounds stay
   per-theme; form and accent are the system's.
   ──────────────────────────────────────────────────────────────────────── */

.bpmnkit-welcome {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  background: var(--welcome-bg, var(--bpmnkit-ds-dark, #14161a));
}

.bpmnkit-welcome[data-theme="light"] {
  --welcome-bg: var(--bpmnkit-ds-canvas, #fbfbfc);
  --welcome-line: var(--bpmnkit-ds-line, #d8dbe0);
  --welcome-line-soft: var(--bpmnkit-ds-line-soft, #e4e6ea);
  --welcome-title: var(--bpmnkit-ds-ink, #14161a);
  --welcome-body: var(--bpmnkit-ds-ink-2, #4b5158);
  --welcome-sub: var(--bpmnkit-ds-ink-3, #5c6470);
  --welcome-meta: var(--bpmnkit-ds-ink-4, #8b929c);
  --welcome-accent: var(--bpmnkit-ds-accent, #a8503a);
  --welcome-accent-hover: var(--bpmnkit-ds-accent-hover, #8f412e);
  --welcome-accent-fg: #ffffff;
  --welcome-hover: var(--bpmnkit-ds-bg, #f4f5f7);
}

.bpmnkit-welcome[data-theme="dark"] {
  --welcome-bg: var(--bpmnkit-ds-dark, #14161a);
  --welcome-line: var(--bpmnkit-ds-line-dark, #2c3038);
  --welcome-line-soft: var(--bpmnkit-ds-line-dark, #2c3038);
  --welcome-title: var(--bpmnkit-ds-ink-on-dark, #f4f5f7);
  --welcome-body: var(--bpmnkit-ds-ink-on-dark-2, #c8ccd2);
  --welcome-sub: var(--bpmnkit-ds-ink-on-dark-2, #c8ccd2);
  --welcome-meta: var(--bpmnkit-ds-ink-muted, #9aa1aa);
  --welcome-accent: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --welcome-accent-hover: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --welcome-accent-fg: var(--bpmnkit-ds-dark, #14161a);
  --welcome-hover: rgba(255, 255, 255, 0.05);
}

/* Neon is a deliberate white-label theme and keeps its own hue. */
.bpmnkit-welcome[data-theme="neon"] {
  --welcome-bg: oklch(5% 0.025 270);
  --welcome-line: oklch(65% 0.28 280 / 0.28);
  --welcome-line-soft: oklch(65% 0.28 280 / 0.15);
  --welcome-title: oklch(88% 0.02 270);
  --welcome-body: oklch(73% 0.16 280);
  --welcome-sub: oklch(73% 0.16 280);
  --welcome-meta: oklch(55% 0.06 280);
  --welcome-accent: oklch(72% 0.18 185);
  --welcome-accent-hover: oklch(72% 0.18 185);
  --welcome-accent-fg: oklch(5% 0.025 270);
  --welcome-hover: oklch(65% 0.28 280 / 0.1);
}

.bpmnkit-welcome-inner {
  display: flex;
  flex-direction: column;
  width: 360px;
  max-height: calc(100% - 48px);
  padding: 32px 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.bpmnkit-welcome-inner::-webkit-scrollbar { display: none; }

/* The system's wordmark, not a logo lockup: the accent is the only colour. */
.bpmnkit-welcome-icon {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.025em;
  color: var(--welcome-title);
  margin-bottom: 22px;
}

.bpmnkit-welcome-icon b { font-weight: 700; color: var(--welcome-accent); }

.bpmnkit-welcome-title {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-eyebrow, 12px);
  font-weight: 400;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--welcome-accent);
  margin: 0 0 10px;
}

.bpmnkit-welcome-sub {
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  color: var(--welcome-body);
  margin: 0 0 24px;
  line-height: 1.55;
}

.bpmnkit-welcome-actions {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.bpmnkit-welcome-btn {
  padding: 11px 18px;
  font-size: var(--bpmnkit-ds-t-ui, 14px);
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  width: 100%;
  text-align: left;
}

.bpmnkit-welcome-btn.primary {
  background: var(--welcome-accent);
  color: var(--welcome-accent-fg);
  font-weight: 700;
}
.bpmnkit-welcome-btn.primary:hover { background: var(--welcome-accent-hover); }

/* Secondary actions stack into one bordered box divided by hairlines. */
.bpmnkit-welcome-btn.secondary {
  background: transparent;
  color: var(--welcome-body);
  border-color: var(--welcome-line);
  margin-top: -1px;
}
.bpmnkit-welcome-btn.secondary + .bpmnkit-welcome-btn.secondary { margin-top: -1px; }
.bpmnkit-welcome-btn.secondary:hover { background: var(--welcome-hover); color: var(--welcome-title); }
.bpmnkit-welcome-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bpmnkit-welcome-btn:disabled:hover { background: transparent; color: var(--welcome-body); }

.bpmnkit-welcome-recent-list {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.bpmnkit-welcome-divider {
  width: 100%;
  height: 1px;
  background: var(--welcome-line);
  margin: 26px 0 16px;
}

.bpmnkit-welcome-examples-label {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--welcome-meta);
  margin-bottom: 10px;
}

/* One bordered box subdivided by hairlines — never gapped cards. */
.bpmnkit-welcome-examples {
  display: flex;
  flex-direction: column;
  width: 100%;
  border: 1px solid var(--welcome-line);
}

.bpmnkit-welcome-example {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 12px;
  border: none;
  border-bottom: 1px solid var(--welcome-line-soft);
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.bpmnkit-welcome-example:last-child { border-bottom: none; }
.bpmnkit-welcome-example:hover { background: var(--welcome-hover); }

/* File-type marks are metadata, so they are mono in the one accent — the
   system has no second colour to spend on a taxonomy. */
.bpmnkit-welcome-example-badge {
  flex-shrink: 0;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--welcome-accent);
  min-width: 42px;
}

.bpmnkit-welcome-example-text {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
  min-width: 0;
}

.bpmnkit-welcome-example-label {
  font-size: var(--bpmnkit-ds-t-ui, 14px);
  font-weight: 500;
  color: var(--welcome-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-welcome-example-desc {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.04em;
  color: var(--welcome-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-welcome-example-arrow {
  flex-shrink: 0;
  color: var(--welcome-meta);
  display: flex;
  align-items: center;
}

.bpmnkit-welcome-example-arrow svg { width: 7px; height: 11px; }

.bpmnkit-welcome-empty {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  letter-spacing: 0.04em;
  color: var(--welcome-meta);
  padding: 12px 0;
}

/* ── Group tab chevron ───────────────────────────────────────────────────── */

.bpmnkit-tab-chevron {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.5;
}

.bpmnkit-tab-chevron svg {
  width: 8px;
  height: 5px;
}

/* ── Group tab dropdown (appended to document.body, position:fixed) ──────── */

.bpmnkit-tab-dropdown {
  position: fixed;
  display: none;
  flex-direction: column;
  min-width: 180px;
  max-width: 280px;
  z-index: 200;
  overflow: hidden;
}

.bpmnkit-tab-dropdown.open { display: flex; }

.bpmnkit-tab-dropdown[data-theme="light"] {
  background: var(--bpmnkit-surface-2, #eeeef8);
  border: 1px solid var(--bpmnkit-border, #d0d0e8);
  border-top: none;
}

.bpmnkit-tab-dropdown[data-theme="dark"] {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid #313244;
  border-top: none;
}

.bpmnkit-tab-dropdown[data-theme="neon"] {
  background: oklch(7% 0.035 280);
  border: 1px solid oklch(65% 0.28 280 / 0.2);
  border-top: none;
}

.bpmnkit-tab-drop-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px 7px 12px;
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  white-space: nowrap;
  color: var(--tab-fg);
}

.bpmnkit-tab-drop-item:hover { background: var(--tab-hover-bg); }
.bpmnkit-tab-drop-item.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
}

.bpmnkit-tab-dropdown[data-theme="light"] .bpmnkit-tab-drop-item {
  color: #4b5563;
}
.bpmnkit-tab-dropdown[data-theme="light"] .bpmnkit-tab-drop-item:hover {
  background: #e8edf2;
}
.bpmnkit-tab-dropdown[data-theme="light"] .bpmnkit-tab-drop-item.active {
  background: #ffffff;
  color: #1c1c1c;
}

.bpmnkit-tab-dropdown[data-theme="dark"] .bpmnkit-tab-drop-item {
  color: #bac2de;
}
.bpmnkit-tab-dropdown[data-theme="dark"] .bpmnkit-tab-drop-item:hover {
  background: #252535;
}
.bpmnkit-tab-dropdown[data-theme="dark"] .bpmnkit-tab-drop-item.active {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  color: #cdd6f4;
}

.bpmnkit-tab-dropdown[data-theme="neon"] .bpmnkit-tab-drop-item {
  color: oklch(60% 0.12 280);
}
.bpmnkit-tab-dropdown[data-theme="neon"] .bpmnkit-tab-drop-item:hover {
  background: oklch(65% 0.28 280 / 0.08);
}
.bpmnkit-tab-dropdown[data-theme="neon"] .bpmnkit-tab-drop-item.active {
  background: oklch(5% 0.025 270);
  color: oklch(88% 0.02 270);
}

.bpmnkit-tab-drop-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Close confirmation dialog ────────────────────────────────────────────── */

.bpmnkit-close-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.bpmnkit-close-dialog {
  background: var(--cd-bg, #ffffff);
  border: 1px solid var(--cd-border, var(--bpmnkit-ds-line, #d8dbe0));
  padding: 24px 26px;
  width: min(400px, calc(100% - 48px));
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
}

.bpmnkit-close-dialog[data-theme="light"] {
  --cd-bg: #ffffff;
  --cd-border: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  --cd-title: #111827;
  --cd-body: #4b5563;
  --cd-primary-bg: var(--bpmnkit-accent, #1a56db);
  --cd-primary-fg: #ffffff;
  --cd-secondary-bg: #f3f4f6;
  --cd-secondary-fg: #374151;
  --cd-secondary-hover: #e5e7eb;
  --cd-ghost-fg: #6b7280;
  --cd-ghost-hover: #f3f4f6;
}

.bpmnkit-close-dialog[data-theme="dark"] {
  --cd-bg: var(--bpmnkit-surface-2, #1e1e2e);
  --cd-border: rgba(255,255,255,0.1);
  --cd-title: #cdd6f4;
  --cd-body: #bac2de;
  --cd-primary-bg: var(--bpmnkit-accent-bright, #89b4fa);
  --cd-primary-fg: var(--bpmnkit-surface-2, #1e1e2e);
  --cd-secondary-bg: rgba(255,255,255,0.06);
  --cd-secondary-fg: #bac2de;
  --cd-secondary-hover: rgba(255,255,255,0.1);
  --cd-ghost-fg: #6c7086;
  --cd-ghost-hover: rgba(255,255,255,0.05);
}

.bpmnkit-close-dialog[data-theme="neon"] {
  --cd-bg: oklch(9% 0.025 270);
  --cd-border: oklch(65% 0.28 280 / 0.2);
  --cd-title: oklch(88% 0.02 270);
  --cd-body: oklch(65% 0.1 280);
  --cd-primary-bg: oklch(55% 0.22 280);
  --cd-primary-fg: oklch(95% 0.01 270);
  --cd-secondary-bg: oklch(65% 0.28 280 / 0.08);
  --cd-secondary-fg: oklch(73% 0.16 280);
  --cd-secondary-hover: oklch(65% 0.28 280 / 0.14);
  --cd-ghost-fg: oklch(50% 0.08 280);
  --cd-ghost-hover: oklch(65% 0.28 280 / 0.06);
}

.bpmnkit-close-dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cd-title);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-close-dialog-body {
  font-size: 13px;
  color: var(--cd-body);
  line-height: 1.5;
  margin-bottom: 18px;
}

.bpmnkit-close-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.bpmnkit-close-dialog-btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  border: none;
  cursor: pointer;
  line-height: 1;
  transition: background 0.1s, opacity 0.1s;
}

.bpmnkit-close-dialog-btn.ghost {
  background: transparent;
  color: var(--cd-ghost-fg);
}
.bpmnkit-close-dialog-btn.ghost:hover { background: var(--cd-ghost-hover); }

.bpmnkit-close-dialog-btn.secondary {
  background: var(--cd-secondary-bg);
  color: var(--cd-secondary-fg);
}
.bpmnkit-close-dialog-btn.secondary:hover { background: var(--cd-secondary-hover); }

.bpmnkit-close-dialog-btn.primary {
  background: var(--cd-primary-bg);
  color: var(--cd-primary-fg);
}
.bpmnkit-close-dialog-btn.primary:hover { opacity: 0.88; }

/* ── Raw source pane ─────────────────────────────────────────────────────── */

.bpmnkit-raw-pane {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: auto;
  background: var(--raw-bg, var(--bpmnkit-surface-2, #1e1e2e));
  pointer-events: auto;
}

.bpmnkit-raw-pane[data-theme="light"] { --raw-bg: #f8f9fa; }
.bpmnkit-raw-pane[data-theme="neon"] { --raw-bg: oklch(5% 0.025 270); }

.bpmnkit-raw-copy-btn {
  position: absolute;
  top: 10px;
  right: 14px;
  z-index: 1;
  padding: 4px 10px;
  font-size: 11px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  background: rgba(255,255,255,0.1);
  color: var(--raw-fg, #cdd6f4);
  border: 1px solid rgba(255,255,255,0.2);
  cursor: pointer;
}
.bpmnkit-raw-copy-btn:hover { background: rgba(255,255,255,0.18); }
.bpmnkit-raw-pane[data-theme="light"] .bpmnkit-raw-copy-btn {
  background: rgba(0,0,0,0.06);
  color: #374151;
  border-color: rgba(0,0,0,0.15);
}
.bpmnkit-raw-pane[data-theme="light"] .bpmnkit-raw-copy-btn:hover { background: rgba(0,0,0,0.12); }
.bpmnkit-raw-pane[data-theme="neon"] .bpmnkit-raw-copy-btn {
  background: oklch(65% 0.28 280 / 0.1);
  color: oklch(73% 0.16 280);
  border-color: oklch(65% 0.28 280 / 0.2);
}
.bpmnkit-raw-pane[data-theme="neon"] .bpmnkit-raw-copy-btn:hover { background: oklch(65% 0.28 280 / 0.18); }

.bpmnkit-raw-content {
  margin: 0;
  padding: 16px 20px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--raw-fg, #cdd6f4);
  white-space: pre;
  tab-size: 2;
  user-select: text;
}

.bpmnkit-raw-pane[data-theme="light"] .bpmnkit-raw-content { --raw-fg: #374151; }
.bpmnkit-raw-pane[data-theme="neon"] .bpmnkit-raw-content { --raw-fg: oklch(73% 0.16 280); }

`.trim()

const STYLE_ID = "bpmn-sdk-tabs-css"

export function injectTabsStyles(): void {
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = TABS_CSS
	document.head.appendChild(style)
}
