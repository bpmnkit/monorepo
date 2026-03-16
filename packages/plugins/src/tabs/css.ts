export const TABS_CSS = `
.bpmnkit-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: stretch;
  background: var(--tabs-bg, var(--bpmnkit-surface-2, #1e1e2e));
  border-bottom: 1px solid var(--tabs-border, #313244);
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
  --tabs-bg: var(--bpmnkit-surface-2, #eeeef8);
  --tabs-border: var(--bpmnkit-border, #d0d0e8);
  --tab-fg: #4b5563;
  --tab-active-bg: var(--bpmnkit-surface, #ffffff);
  --tab-active-fg: #1c1c1c;
  --tab-active-border: var(--bpmnkit-accent-bright, #3b82f6);
  --tab-hover-bg: #e8edf2;
  --tab-close-hover: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  --tab-warn-fg: var(--bpmnkit-warn, #d97706);
  --tab-type-bpmn: var(--bpmnkit-accent-bright, #3b82f6);
  --tab-type-dmn: #8b5cf6;
  --tab-type-feel: var(--bpmnkit-warn, #d97706);
  --tab-type-form: var(--bpmnkit-success, #16a34a);
}

.bpmnkit-tabs[data-theme="dark"] {
  --tabs-bg: var(--bpmnkit-surface-2, #1e1e2e);
  --tabs-border: #313244;
  --tab-fg: #bac2de;
  --tab-active-bg: var(--bpmnkit-surface, #161626);
  --tab-active-fg: #cdd6f4;
  --tab-active-border: var(--bpmnkit-accent-bright, #89b4fa);
  --tab-hover-bg: #252535;
  --tab-close-hover: rgba(255,255,255,0.08);
  --tab-warn-fg: #fab387;
  --tab-type-bpmn: var(--bpmnkit-accent-bright, #89b4fa);
  --tab-type-dmn: #cba6f7;
  --tab-type-feel: #fab387;
  --tab-type-form: #a6e3a1;
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
  --tab-type-bpmn: oklch(73% 0.16 280);
  --tab-type-dmn: oklch(70% 0.18 300);
  --tab-type-feel: oklch(75% 0.15 60);
  --tab-type-form: oklch(72% 0.18 185);
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
  font-size: 12px;
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
}

.bpmnkit-tab-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.bpmnkit-tab-type.bpmn  { color: var(--tab-type-bpmn); }
.bpmnkit-tab-type.dmn   { color: var(--tab-type-dmn); }
.bpmnkit-tab-type.feel  { color: var(--tab-type-feel); }
.bpmnkit-tab-type.form  { color: var(--tab-type-form); }

.bpmnkit-tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-tab-warn {
  color: var(--tab-warn-fg);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.bpmnkit-tab-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 12px;
  line-height: 1;
  opacity: 0.5;
  flex-shrink: 0;
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

/* ── Welcome screen ──────────────────────────────────────────────────────── */

.bpmnkit-welcome {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--welcome-bg, var(--bpmnkit-surface-2, #1e1e2e));
}

.bpmnkit-welcome[data-theme="light"] {
  --welcome-bg: #f8f9fa;
  --welcome-icon: var(--bpmnkit-accent-bright, #3b82f6);
  --welcome-title: #111827;
  --welcome-sub: #6b7280;
  --welcome-btn-primary-bg: var(--bpmnkit-accent, #1a56db);
  --welcome-btn-primary-fg: #ffffff;
  --welcome-btn-secondary-bg: var(--bpmnkit-surface, #ffffff);
  --welcome-btn-secondary-fg: #374151;
  --welcome-btn-secondary-border: var(--bpmnkit-border, #d0d0e8);
}

.bpmnkit-welcome[data-theme="dark"] {
  --welcome-bg: var(--bpmnkit-surface-2, #1e1e2e);
  --welcome-icon: var(--bpmnkit-accent-bright, #89b4fa);
  --welcome-title: #cdd6f4;
  --welcome-sub: #6c7086;
  --welcome-btn-primary-bg: var(--bpmnkit-accent-bright, #89b4fa);
  --welcome-btn-primary-fg: var(--bpmnkit-surface-2, #1e1e2e);
  --welcome-btn-secondary-bg: rgba(255,255,255,0.06);
  --welcome-btn-secondary-fg: #bac2de;
  --welcome-btn-secondary-border: rgba(255,255,255,0.12);
}

.bpmnkit-welcome[data-theme="neon"] {
  --welcome-bg: oklch(5% 0.025 270);
  --welcome-icon: oklch(72% 0.18 185);
  --welcome-title: oklch(88% 0.02 270);
  --welcome-sub: oklch(55% 0.06 280);
  --welcome-btn-primary-bg: oklch(55% 0.22 280);
  --welcome-btn-primary-fg: oklch(95% 0.01 270);
  --welcome-btn-secondary-bg: oklch(65% 0.28 280 / 0.08);
  --welcome-btn-secondary-fg: oklch(73% 0.16 280);
  --welcome-btn-secondary-border: oklch(65% 0.28 280 / 0.25);
}

.bpmnkit-welcome-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 320px;
  max-height: calc(100% - 48px);
  padding: 32px 0;
  overflow-y: auto;
  scrollbar-width: none;
}

.bpmnkit-welcome-inner::-webkit-scrollbar { display: none; }

.bpmnkit-welcome-icon {
  color: var(--welcome-icon);
  margin-bottom: 20px;
  opacity: 0.9;
}

.bpmnkit-welcome-icon svg {
  width: 48px;
  height: 48px;
}

.bpmnkit-welcome-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--welcome-title);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.bpmnkit-welcome-sub {
  font-size: 13px;
  color: var(--welcome-sub);
  margin: 0 0 24px;
  line-height: 1.5;
}

.bpmnkit-welcome-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.bpmnkit-welcome-btn {
  padding: 9px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  border: 1px solid transparent;
  transition: opacity 0.1s;
  width: 100%;
}

.bpmnkit-welcome-btn.primary {
  background: var(--welcome-btn-primary-bg);
  color: var(--welcome-btn-primary-fg);
}
.bpmnkit-welcome-btn.primary:hover { opacity: 0.88; }

.bpmnkit-welcome-btn.secondary {
  background: var(--welcome-btn-secondary-bg);
  color: var(--welcome-btn-secondary-fg);
  border-color: var(--welcome-btn-secondary-border);
}
.bpmnkit-welcome-btn.secondary:hover { opacity: 0.8; }
.bpmnkit-welcome-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bpmnkit-welcome-btn:disabled:hover { opacity: 0.4; }

.bpmnkit-welcome-recent-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.bpmnkit-welcome-divider {
  width: 100%;
  height: 1px;
  background: var(--welcome-btn-secondary-border);
  margin: 20px 0 16px;
}

.bpmnkit-welcome-examples-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--welcome-sub);
  margin-bottom: 8px;
  align-self: flex-start;
}

.bpmnkit-welcome-examples {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.bpmnkit-welcome-example {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 7px;
  border: 1px solid var(--welcome-btn-secondary-border);
  background: var(--welcome-btn-secondary-bg);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  transition: background 0.1s, border-color 0.1s;
}

.bpmnkit-welcome-example:hover {
  border-color: var(--welcome-icon);
  background: var(--welcome-example-hover, rgba(59,130,246,0.06));
}

.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example:hover {
  --welcome-example-hover: rgba(137,180,250,0.08);
}

.bpmnkit-welcome-example-badge {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}

.bpmnkit-welcome-example-badge.bpmn  { background: rgba(59,130,246,0.15);  color: var(--bpmnkit-accent-bright, #3b82f6); }
.bpmnkit-welcome-example-badge.dmn   { background: rgba(139,92,246,0.15);  color: #8b5cf6; }
.bpmnkit-welcome-example-badge.feel  { background: rgba(217,119,6,0.15);   color: var(--bpmnkit-warn, #d97706); }
.bpmnkit-welcome-example-badge.form  { background: rgba(16,185,129,0.15);  color: var(--bpmnkit-success, #22c55e); }
.bpmnkit-welcome-example-badge.multi { background: rgba(249,115,22,0.15);  color: #f97316; }

.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example-badge.bpmn  { color: var(--bpmnkit-accent-bright, #89b4fa); }
.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example-badge.dmn   { color: #cba6f7; }
.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example-badge.feel  { color: #fab387; }
.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example-badge.form  { color: #a6e3a1; }
.bpmnkit-welcome[data-theme="dark"] .bpmnkit-welcome-example-badge.multi { color: #fab387; }

.bpmnkit-welcome-example-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.bpmnkit-welcome-example-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--welcome-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-welcome-example-desc {
  font-size: 11px;
  color: var(--welcome-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmnkit-welcome-example-arrow {
  flex-shrink: 0;
  color: var(--welcome-sub);
  opacity: 0.5;
  display: flex;
  align-items: center;
}

.bpmnkit-welcome-example-arrow svg { width: 7px; height: 11px; }

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
  border-radius: 0 0 6px 6px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.22);
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
  border: 1px solid var(--cd-border, var(--bpmnkit-panel-border, rgba(0,0,0,0.08)));
  border-radius: 10px;
  padding: 20px 24px;
  width: min(400px, calc(100% - 48px));
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  font-family: system-ui, -apple-system, sans-serif;
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
  padding: 7px 14px;
  border-radius: 6px;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: rgba(255,255,255,0.1);
  color: var(--raw-fg, #cdd6f4);
  border: 1px solid rgba(255,255,255,0.2);
  border-radius: 4px;
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
