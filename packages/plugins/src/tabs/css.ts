export const TABS_CSS = `
.bpmn-tabs {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: stretch;
  background: var(--tabs-bg, var(--bpmn-surface-2, #1e1e2e));
  border-bottom: 1px solid var(--tabs-border, #313244);
  z-index: 100;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  user-select: none;
}

.bpmn-tabs::-webkit-scrollbar {
  display: none;
}

.bpmn-tabs[data-theme="light"] {
  --tabs-bg: var(--bpmn-surface-2, #eeeef8);
  --tabs-border: var(--bpmn-border, #d0d0e8);
  --tab-fg: #4b5563;
  --tab-active-bg: var(--bpmn-surface, #ffffff);
  --tab-active-fg: #1c1c1c;
  --tab-active-border: var(--bpmn-accent-bright, #3b82f6);
  --tab-hover-bg: #e8edf2;
  --tab-close-hover: var(--bpmn-panel-border, rgba(0,0,0,0.08));
  --tab-warn-fg: var(--bpmn-warn, #d97706);
  --tab-type-bpmn: var(--bpmn-accent-bright, #3b82f6);
  --tab-type-dmn: #8b5cf6;
  --tab-type-feel: var(--bpmn-warn, #d97706);
  --tab-type-form: var(--bpmn-success, #16a34a);
}

.bpmn-tabs[data-theme="dark"] {
  --tabs-bg: var(--bpmn-surface-2, #1e1e2e);
  --tabs-border: #313244;
  --tab-fg: #bac2de;
  --tab-active-bg: var(--bpmn-surface, #161626);
  --tab-active-fg: #cdd6f4;
  --tab-active-border: var(--bpmn-accent-bright, #89b4fa);
  --tab-hover-bg: #252535;
  --tab-close-hover: rgba(255,255,255,0.08);
  --tab-warn-fg: #fab387;
  --tab-type-bpmn: var(--bpmn-accent-bright, #89b4fa);
  --tab-type-dmn: #cba6f7;
  --tab-type-feel: #fab387;
  --tab-type-form: #a6e3a1;
}

/* ── Play mode: hide tab groups, show only center slot ───────────────── */

.bpmn-tabs.bpmn-play-mode .bpmn-tab {
  display: none;
}

/* ── Center slot (e.g. process runner buttons) ───────────────────────── */

.bpmn-tabs-center {
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

.bpmn-tabs-center > * {
  pointer-events: all;
}

.bpmn-tab {
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

.bpmn-tab:hover {
  background: var(--tab-hover-bg);
}

.bpmn-tab.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
  border-bottom: 2px solid var(--tab-active-border);
}

.bpmn-tab-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}

.bpmn-tab-type.bpmn  { color: var(--tab-type-bpmn); }
.bpmn-tab-type.dmn   { color: var(--tab-type-dmn); }
.bpmn-tab-type.feel  { color: var(--tab-type-feel); }
.bpmn-tab-type.form  { color: var(--tab-type-form); }

.bpmn-tab-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmn-tab-warn {
  color: var(--tab-warn-fg);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.bpmn-tab-close {
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

.bpmn-tab-close:hover {
  opacity: 1;
  background: var(--tab-close-hover);
}

/* Content pane — fills remaining space below tabs */
.bpmn-tab-content {
  position: absolute;
  top: 36px;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
}

.bpmn-tab-pane {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.bpmn-tab-pane.hidden {
  display: none;
}

/* ── Welcome screen ──────────────────────────────────────────────────────── */

.bpmn-welcome {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--welcome-bg, var(--bpmn-surface-2, #1e1e2e));
}

.bpmn-welcome[data-theme="light"] {
  --welcome-bg: #f8f9fa;
  --welcome-icon: var(--bpmn-accent-bright, #3b82f6);
  --welcome-title: #111827;
  --welcome-sub: #6b7280;
  --welcome-btn-primary-bg: var(--bpmn-accent, #1a56db);
  --welcome-btn-primary-fg: #ffffff;
  --welcome-btn-secondary-bg: var(--bpmn-surface, #ffffff);
  --welcome-btn-secondary-fg: #374151;
  --welcome-btn-secondary-border: var(--bpmn-border, #d0d0e8);
}

.bpmn-welcome[data-theme="dark"] {
  --welcome-bg: var(--bpmn-surface-2, #1e1e2e);
  --welcome-icon: var(--bpmn-accent-bright, #89b4fa);
  --welcome-title: #cdd6f4;
  --welcome-sub: #6c7086;
  --welcome-btn-primary-bg: var(--bpmn-accent-bright, #89b4fa);
  --welcome-btn-primary-fg: var(--bpmn-surface-2, #1e1e2e);
  --welcome-btn-secondary-bg: rgba(255,255,255,0.06);
  --welcome-btn-secondary-fg: #bac2de;
  --welcome-btn-secondary-border: rgba(255,255,255,0.12);
}

.bpmn-welcome-inner {
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

.bpmn-welcome-inner::-webkit-scrollbar { display: none; }

.bpmn-welcome-icon {
  color: var(--welcome-icon);
  margin-bottom: 20px;
  opacity: 0.9;
}

.bpmn-welcome-icon svg {
  width: 48px;
  height: 48px;
}

.bpmn-welcome-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--welcome-title);
  margin: 0 0 8px;
  letter-spacing: -0.01em;
}

.bpmn-welcome-sub {
  font-size: 13px;
  color: var(--welcome-sub);
  margin: 0 0 24px;
  line-height: 1.5;
}

.bpmn-welcome-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.bpmn-welcome-btn {
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

.bpmn-welcome-btn.primary {
  background: var(--welcome-btn-primary-bg);
  color: var(--welcome-btn-primary-fg);
}
.bpmn-welcome-btn.primary:hover { opacity: 0.88; }

.bpmn-welcome-btn.secondary {
  background: var(--welcome-btn-secondary-bg);
  color: var(--welcome-btn-secondary-fg);
  border-color: var(--welcome-btn-secondary-border);
}
.bpmn-welcome-btn.secondary:hover { opacity: 0.8; }
.bpmn-welcome-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.bpmn-welcome-btn:disabled:hover { opacity: 0.4; }

.bpmn-welcome-recent-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}

.bpmn-welcome-divider {
  width: 100%;
  height: 1px;
  background: var(--welcome-btn-secondary-border);
  margin: 20px 0 16px;
}

.bpmn-welcome-examples-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--welcome-sub);
  margin-bottom: 8px;
  align-self: flex-start;
}

.bpmn-welcome-examples {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.bpmn-welcome-example {
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

.bpmn-welcome-example:hover {
  border-color: var(--welcome-icon);
  background: var(--welcome-example-hover, rgba(59,130,246,0.06));
}

.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example:hover {
  --welcome-example-hover: rgba(137,180,250,0.08);
}

.bpmn-welcome-example-badge {
  flex-shrink: 0;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.05em;
  padding: 2px 5px;
  border-radius: 3px;
  text-transform: uppercase;
}

.bpmn-welcome-example-badge.bpmn  { background: rgba(59,130,246,0.15);  color: var(--bpmn-accent-bright, #3b82f6); }
.bpmn-welcome-example-badge.dmn   { background: rgba(139,92,246,0.15);  color: #8b5cf6; }
.bpmn-welcome-example-badge.feel  { background: rgba(217,119,6,0.15);   color: var(--bpmn-warn, #d97706); }
.bpmn-welcome-example-badge.form  { background: rgba(16,185,129,0.15);  color: var(--bpmn-success, #22c55e); }
.bpmn-welcome-example-badge.multi { background: rgba(249,115,22,0.15);  color: #f97316; }

.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example-badge.bpmn  { color: var(--bpmn-accent-bright, #89b4fa); }
.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example-badge.dmn   { color: #cba6f7; }
.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example-badge.feel  { color: #fab387; }
.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example-badge.form  { color: #a6e3a1; }
.bpmn-welcome[data-theme="dark"] .bpmn-welcome-example-badge.multi { color: #fab387; }

.bpmn-welcome-example-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.bpmn-welcome-example-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--welcome-title);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmn-welcome-example-desc {
  font-size: 11px;
  color: var(--welcome-sub);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmn-welcome-example-arrow {
  flex-shrink: 0;
  color: var(--welcome-sub);
  opacity: 0.5;
  display: flex;
  align-items: center;
}

.bpmn-welcome-example-arrow svg { width: 7px; height: 11px; }

/* ── Group tab chevron ───────────────────────────────────────────────────── */

.bpmn-tab-chevron {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  opacity: 0.5;
}

.bpmn-tab-chevron svg {
  width: 8px;
  height: 5px;
}

/* ── Group tab dropdown (appended to document.body, position:fixed) ──────── */

.bpmn-tab-dropdown {
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

.bpmn-tab-dropdown.open { display: flex; }

.bpmn-tab-dropdown[data-theme="light"] {
  background: var(--bpmn-surface-2, #eeeef8);
  border: 1px solid var(--bpmn-border, #d0d0e8);
  border-top: none;
}

.bpmn-tab-dropdown[data-theme="dark"] {
  background: var(--bpmn-surface-2, #1e1e2e);
  border: 1px solid #313244;
  border-top: none;
}

.bpmn-tab-drop-item {
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

.bpmn-tab-drop-item:hover { background: var(--tab-hover-bg); }
.bpmn-tab-drop-item.active {
  background: var(--tab-active-bg);
  color: var(--tab-active-fg);
}

.bpmn-tab-dropdown[data-theme="light"] .bpmn-tab-drop-item {
  color: #4b5563;
}
.bpmn-tab-dropdown[data-theme="light"] .bpmn-tab-drop-item:hover {
  background: #e8edf2;
}
.bpmn-tab-dropdown[data-theme="light"] .bpmn-tab-drop-item.active {
  background: #ffffff;
  color: #1c1c1c;
}

.bpmn-tab-dropdown[data-theme="dark"] .bpmn-tab-drop-item {
  color: #bac2de;
}
.bpmn-tab-dropdown[data-theme="dark"] .bpmn-tab-drop-item:hover {
  background: #252535;
}
.bpmn-tab-dropdown[data-theme="dark"] .bpmn-tab-drop-item.active {
  background: var(--bpmn-surface-2, #1e1e2e);
  color: #cdd6f4;
}

.bpmn-tab-drop-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Close confirmation dialog ────────────────────────────────────────────── */

.bpmn-close-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 300;
}

.bpmn-close-dialog {
  background: var(--cd-bg, #ffffff);
  border: 1px solid var(--cd-border, var(--bpmn-panel-border, rgba(0,0,0,0.08)));
  border-radius: 10px;
  padding: 20px 24px;
  width: min(400px, calc(100% - 48px));
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  font-family: system-ui, -apple-system, sans-serif;
}

.bpmn-close-dialog[data-theme="light"] {
  --cd-bg: #ffffff;
  --cd-border: var(--bpmn-panel-border, rgba(0,0,0,0.08));
  --cd-title: #111827;
  --cd-body: #4b5563;
  --cd-primary-bg: var(--bpmn-accent, #1a56db);
  --cd-primary-fg: #ffffff;
  --cd-secondary-bg: #f3f4f6;
  --cd-secondary-fg: #374151;
  --cd-secondary-hover: #e5e7eb;
  --cd-ghost-fg: #6b7280;
  --cd-ghost-hover: #f3f4f6;
}

.bpmn-close-dialog[data-theme="dark"] {
  --cd-bg: var(--bpmn-surface-2, #1e1e2e);
  --cd-border: rgba(255,255,255,0.1);
  --cd-title: #cdd6f4;
  --cd-body: #bac2de;
  --cd-primary-bg: var(--bpmn-accent-bright, #89b4fa);
  --cd-primary-fg: var(--bpmn-surface-2, #1e1e2e);
  --cd-secondary-bg: rgba(255,255,255,0.06);
  --cd-secondary-fg: #bac2de;
  --cd-secondary-hover: rgba(255,255,255,0.1);
  --cd-ghost-fg: #6c7086;
  --cd-ghost-hover: rgba(255,255,255,0.05);
}

.bpmn-close-dialog-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--cd-title);
  margin-bottom: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bpmn-close-dialog-body {
  font-size: 13px;
  color: var(--cd-body);
  line-height: 1.5;
  margin-bottom: 18px;
}

.bpmn-close-dialog-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.bpmn-close-dialog-btn {
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

.bpmn-close-dialog-btn.ghost {
  background: transparent;
  color: var(--cd-ghost-fg);
}
.bpmn-close-dialog-btn.ghost:hover { background: var(--cd-ghost-hover); }

.bpmn-close-dialog-btn.secondary {
  background: var(--cd-secondary-bg);
  color: var(--cd-secondary-fg);
}
.bpmn-close-dialog-btn.secondary:hover { background: var(--cd-secondary-hover); }

.bpmn-close-dialog-btn.primary {
  background: var(--cd-primary-bg);
  color: var(--cd-primary-fg);
}
.bpmn-close-dialog-btn.primary:hover { opacity: 0.88; }

/* ── Raw source pane ─────────────────────────────────────────────────────── */

.bpmn-raw-pane {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: auto;
  background: var(--raw-bg, var(--bpmn-surface-2, #1e1e2e));
  pointer-events: auto;
}

.bpmn-raw-pane[data-theme="light"] { --raw-bg: #f8f9fa; }

.bpmn-raw-copy-btn {
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
.bpmn-raw-copy-btn:hover { background: rgba(255,255,255,0.18); }
.bpmn-raw-pane[data-theme="light"] .bpmn-raw-copy-btn {
  background: rgba(0,0,0,0.06);
  color: #374151;
  border-color: rgba(0,0,0,0.15);
}
.bpmn-raw-pane[data-theme="light"] .bpmn-raw-copy-btn:hover { background: rgba(0,0,0,0.12); }

.bpmn-raw-content {
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

.bpmn-raw-pane[data-theme="light"] .bpmn-raw-content { --raw-fg: #374151; }

`.trim()

const STYLE_ID = "bpmn-sdk-tabs-css"

export function injectTabsStyles(): void {
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = TABS_CSS
	document.head.appendChild(style)
}
