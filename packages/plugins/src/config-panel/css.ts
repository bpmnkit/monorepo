export const CONFIG_PANEL_STYLE_ID = "bpmnkit-config-panel-styles-v1"

export const CONFIG_PANEL_CSS = `
/* ── Inspector panel ─────────────────────────────────────────────────────── */
/*
 * top: 36px matches the height of the .bpmnkit-tabs bar from canvas-plugin-tabs,
 * so the inspector panel does not overlap the tab bar.
 */
.bpmnkit-cfg-full {
  position: fixed;
  right: 0;
  top: 36px;
  bottom: 0;
  width: 320px;
  background: var(--bpmnkit-panel-bg, rgba(13,13,22,0.92));
  backdrop-filter: blur(16px);
  border-left: 1px solid var(--bpmnkit-panel-border, rgba(255,255,255,0.08));
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  z-index: 9999;
  transition: width 0.2s ease;
}
.bpmnkit-cfg-full--collapsed {
  width: 40px;
}
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-full-info,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-full-close,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-docs-link,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-search-bar,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-guide-bar,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-tabs-area,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-full-body,
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-search-results {
  display: none;
}
.bpmnkit-cfg-full--collapsed .bpmnkit-cfg-full-header {
  justify-content: center;
  padding: 14px 0;
}

/* Hosted mode — renders inside a dock pane instead of as a fixed overlay */
.bpmnkit-cfg-full--hosted {
  position: static !important;
  width: auto !important;
  top: auto; right: auto; bottom: auto;
  box-shadow: none; border-left: none; backdrop-filter: none;
  flex: 1; min-height: 0;
}
/* suppress controls that the dock replaces */
.bpmnkit-cfg-full--hosted .bpmnkit-cfg-resize-handle,
.bpmnkit-cfg-full--hosted .bpmnkit-cfg-collapse-btn { display: none; }

/* Resize handle — a thin grab zone along the left edge */
.bpmnkit-cfg-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  z-index: 1;
}
.bpmnkit-cfg-resize-handle:hover {
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.bpmnkit-cfg-full-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.bpmnkit-cfg-full-info {
  flex: 1;
  min-width: 0;
}
.bpmnkit-cfg-full-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 2px;
}
.bpmnkit-cfg-full-template {
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmnkit-accent, #6b9df7);
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-full-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Docs link — ? button shown when the schema has a documentationRef */
.bpmnkit-cfg-docs-link {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.45);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  flex-shrink: 0;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
}
.bpmnkit-cfg-docs-link:hover {
  color: var(--bpmnkit-accent, #6b9df7);
  border-color: var(--bpmnkit-accent, #6b9df7);
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
}
.bpmnkit-cfg-collapse-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-collapse-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.bpmnkit-cfg-full-close {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-full-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

/* ── Search bar ──────────────────────────────────────────────────────────── */
.bpmnkit-cfg-search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.bpmnkit-cfg-search-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 5px;
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.bpmnkit-cfg-search-input::placeholder { color: rgba(255,255,255,0.28); }
.bpmnkit-cfg-search-input:focus {
  border-color: var(--bpmnkit-accent, #6b9df7);
  background: rgba(255,255,255,0.1);
}
.bpmnkit-cfg-search-clear {
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: rgba(255,255,255,0.35);
  cursor: pointer;
  padding: 0;
  /* display toggled via JS */
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  font-size: 14px;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}
.bpmnkit-cfg-search-clear:hover { color: #fff; background: rgba(255,255,255,0.08); }

/* ── Guide bar (field assistant) ─────────────────────────────────────────── */
.bpmnkit-cfg-guide-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  background: rgba(248, 113, 113, 0.09);
  border-bottom: 1px solid rgba(248, 113, 113, 0.18);
  flex-shrink: 0;
}
.bpmnkit-cfg-guide-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bpmnkit-cfg-guide-icon {
  width: 16px;
  height: 16px;
  background: var(--bpmnkit-danger, #f87171);
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
  line-height: 1;
}
.bpmnkit-cfg-guide-text {
  font-size: 11px;
  font-weight: 500;
  color: rgba(248, 113, 113, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-guide-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.12);
  color: var(--bpmnkit-danger, #f87171);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}
.bpmnkit-cfg-guide-btn:hover {
  background: rgba(248, 113, 113, 0.22);
  border-color: rgba(248, 113, 113, 0.6);
}

/* ── Search results ──────────────────────────────────────────────────────── */
.bpmnkit-cfg-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.bpmnkit-cfg-search-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin: 16px 0 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bpmnkit-cfg-search-group-label:first-child { margin-top: 10px; }
.bpmnkit-cfg-search-empty {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  text-align: center;
  padding: 28px 0;
}

/* ── Tabs area (wrapper + scroll buttons) ────────────────────────────────── */
.bpmnkit-cfg-tabs-area {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
  overflow: hidden;
}
.bpmnkit-cfg-tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  overflow-x: auto;
  scrollbar-width: none;
}
.bpmnkit-cfg-tabs::-webkit-scrollbar { display: none; }
.bpmnkit-cfg-tab-btn {
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
  margin-bottom: -1px;
  flex-shrink: 0;
}
.bpmnkit-cfg-tab-btn:hover { color: rgba(255,255,255,0.75); }
.bpmnkit-cfg-tab-btn.active { color: var(--bpmnkit-accent, #6b9df7); border-bottom-color: var(--bpmnkit-accent, #6b9df7); }
/* Red dot shown after tab label when the group has required-empty fields */
.bpmnkit-cfg-tab-btn.has-error::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bpmnkit-danger, #f87171);
  margin-left: 5px;
  vertical-align: middle;
  flex-shrink: 0;
}

/* Arrow buttons for overflowing tabs */
.bpmnkit-cfg-tabs-scroll-btn {
  flex-shrink: 0;
  width: 26px;
  background: none;
  border: none;
  border-radius: 0;
  color: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  /* display toggled via JS */
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-tabs-scroll-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.bpmnkit-cfg-tabs-scroll-btn--prev { border-right: 1px solid rgba(255,255,255,0.06); }
.bpmnkit-cfg-tabs-scroll-btn--next { border-left: 1px solid rgba(255,255,255,0.06); }

/* ── Scrollable body ─────────────────────────────────────────────────────── */
.bpmnkit-cfg-full-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

/* ── Groups & Fields ──────────────────────────────────────────────────────── */
.bpmnkit-cfg-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bpmnkit-cfg-field {
  margin-bottom: 14px;
}
.bpmnkit-cfg-field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  margin-bottom: 5px;
  cursor: default;
}
.bpmnkit-cfg-field-label[title] { cursor: help; }
.bpmnkit-cfg-field-docs {
  font-size: 10px;
  color: var(--bpmnkit-accent, #6b9df7);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.1s;
}
.bpmnkit-cfg-field-docs:hover { opacity: 1; }
.bpmnkit-cfg-required-star {
  color: var(--bpmnkit-danger, #f87171);
  font-weight: 700;
  margin-left: 2px;
}
.bpmnkit-cfg-field--invalid {
  border-left: 2px solid var(--bpmnkit-danger, #f87171);
  padding-left: 8px;
}
.bpmnkit-cfg-field--invalid .bpmnkit-cfg-input,
.bpmnkit-cfg-field--invalid .bpmnkit-cfg-select,
.bpmnkit-cfg-field--invalid .bpmnkit-cfg-textarea {
  border-color: var(--bpmnkit-danger, #f87171);
}

.bpmnkit-cfg-input,
.bpmnkit-cfg-select,
.bpmnkit-cfg-textarea {
  width: 100%;
  padding: 7px 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.bpmnkit-cfg-input:focus,
.bpmnkit-cfg-select:focus,
.bpmnkit-cfg-textarea:focus {
  border-color: var(--bpmnkit-accent, #6b9df7);
  background-color: rgba(255,255,255,0.09);
}
.bpmnkit-cfg-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.bpmnkit-cfg-textarea {
  resize: vertical;
  min-height: 68px;
  line-height: 1.5;
  font-family: var(--bpmnkit-font-mono, ui-monospace, "SF Mono", monospace);
  font-size: 11px;
}
.bpmnkit-cfg-field-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  margin-top: 4px;
  line-height: 1.4;
}

/* ── Field error message ──────────────────────────────────────────────────── */
.bpmnkit-cfg-field-error {
  font-size: 11px;
  color: var(--bpmnkit-danger, #f87171);
  margin-top: 3px;
  line-height: 1.3;
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-field-error { color: var(--bpmnkit-danger, #dc2626); }

/* ── FEEL expression field ────────────────────────────────────────────────── */
/* FEEL/string mode toggle — appears at the right end of a feel-expression label row */
.bpmnkit-cfg-feel-mode-btn {
  margin-left: auto;
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.12);
  background: none;
  color: rgba(255,255,255,0.3);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.bpmnkit-cfg-feel-mode-btn:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.55);
}
.bpmnkit-cfg-feel-mode-btn--active {
  border-color: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
  color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-cfg-feel-mode-btn--active:hover { background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15)); }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-mode-btn {
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.3);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-mode-btn:hover {
  background: rgba(0,0,0,0.05);
  color: rgba(0,0,0,0.55);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-mode-btn--active {
  border-color: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12));
  background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12));
  color: var(--bpmnkit-accent, #1a56db);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-mode-btn--active:hover { background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)); }

.bpmnkit-cfg-feel-ta {
  width: 100%;
  min-height: 68px;
  padding: 7px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--bpmnkit-font-mono, ui-monospace, "SF Mono", monospace);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.bpmnkit-cfg-feel-playground-btn {
  display: inline-flex;
  margin-top: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: none;
  color: var(--bpmnkit-accent, #6b9df7);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}
.bpmnkit-cfg-feel-playground-btn:hover { background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15)); }

/* Light theme overrides */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-playground-btn {
  border-color: rgba(0,0,0,0.12);
  color: var(--bpmnkit-accent, #1a56db);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-feel-playground-btn:hover { background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)); }

/* ── Toggle ───────────────────────────────────────────────────────────────── */
.bpmnkit-cfg-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bpmnkit-cfg-toggle-label {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
}
.bpmnkit-cfg-toggle-label[title] { cursor: help; }
.bpmnkit-cfg-toggle {
  position: relative;
  display: inline-flex;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}
.bpmnkit-cfg-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.bpmnkit-cfg-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  border-radius: 9px;
  transition: background 0.2s;
}
.bpmnkit-cfg-toggle input:checked + .bpmnkit-cfg-toggle-track { background: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-cfg-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
  pointer-events: none;
}
.bpmnkit-cfg-toggle input:checked ~ .bpmnkit-cfg-toggle-thumb { transform: translateX(16px); }

/* ── Action button ────────────────────────────────────────────────────────── */
.bpmnkit-cfg-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 12px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15);
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.bpmnkit-cfg-action-btn:hover {
  background: rgba(255,255,255,0.13);
  border-color: rgba(255,255,255,0.25);
}

/* ── Light theme overrides ────────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full {
  background: var(--bpmnkit-panel-bg, rgba(255,255,255,0.92));
  border-left-color: var(--bpmnkit-panel-border, rgba(0,0,0,0.08));
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-type { color: rgba(0,0,0,0.35); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-template { color: var(--bpmnkit-accent, #1a56db); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-name { color: rgba(0,0,0,0.9); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-docs-link { color: rgba(0,0,0,0.4); border-color: rgba(0,0,0,0.2); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-docs-link:hover { color: var(--bpmnkit-accent, #1a56db); border-color: var(--bpmnkit-accent, #1a56db); background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-collapse-btn { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-collapse-btn:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-close { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-close:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-bar { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-input::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-clear { color: rgba(0,0,0,0.35); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-clear:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-results { scrollbar-color: rgba(0,0,0,0.15) transparent; }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-group-label { color: rgba(0,0,0,0.35); border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-search-empty { color: rgba(0,0,0,0.35); }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tabs-area { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tab-btn { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tab-btn:hover { color: rgba(0,0,0,0.7); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tabs-scroll-btn { color: rgba(0,0,0,0.4); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tabs-scroll-btn:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tabs-scroll-btn--prev { border-right-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-tabs-scroll-btn--next { border-left-color: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-full-body { scrollbar-color: rgba(0,0,0,0.15) transparent; }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-group-label {
  color: rgba(0,0,0,0.35);
  border-bottom-color: rgba(0,0,0,0.06);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-field-label { color: rgba(0,0,0,0.55); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-field-hint { color: rgba(0,0,0,0.4); }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-input,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-select,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-textarea {
  background-color: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-input:focus,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-select:focus,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-textarea:focus {
  background-color: rgba(0,0,0,0.06);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='1.5'/%3E%3C/svg%3E");
}

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-toggle-label { color: rgba(0,0,0,0.7); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-toggle-track { background: rgba(0,0,0,0.12); }

[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-action-btn {
  border-color: rgba(0,0,0,0.15);
  background: rgba(0,0,0,0.04);
  color: rgba(0,0,0,0.75);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-action-btn:hover {
  background: rgba(0,0,0,0.08);
  border-color: rgba(0,0,0,0.2);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-resize-handle:hover {
  background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12));
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-guide-bar {
  background: rgba(248, 113, 113, 0.06);
  border-bottom-color: rgba(248, 113, 113, 0.15);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-guide-text { color: var(--bpmnkit-danger, #dc2626); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-guide-btn {
  color: var(--bpmnkit-danger, #dc2626);
  border-color: rgba(220, 38, 38, 0.3);
  background: rgba(220, 38, 38, 0.07);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-guide-btn:hover {
  background: rgba(220, 38, 38, 0.14);
  border-color: rgba(220, 38, 38, 0.5);
}

/* ── Neon theme overrides ─────────────────────────────────────────────────── */
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full {
  background: oklch(8% 0.03 270 / 0.96);
  border-left-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: -8px 0 40px oklch(0% 0 0 / 0.7), 0 0 0 1px oklch(65% 0.28 280 / 0.05);
  color: oklch(65% 0.1 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-header { border-bottom-color: oklch(65% 0.28 280 / 0.12); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-type { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-template { color: oklch(73% 0.16 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-name { color: oklch(88% 0.02 270); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-docs-link { color: oklch(55% 0.06 280); border-color: oklch(65% 0.28 280 / 0.25); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-docs-link:hover { color: oklch(73% 0.16 280); border-color: oklch(65% 0.28 280 / 0.5); background: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-collapse-btn { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-collapse-btn:hover { background: oklch(65% 0.28 280 / 0.1); color: oklch(88% 0.02 270); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-close { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-close:hover { background: oklch(65% 0.28 280 / 0.1); color: oklch(88% 0.02 270); }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-bar { border-bottom-color: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-input {
  background: oklch(65% 0.28 280 / 0.05);
  border-color: oklch(65% 0.28 280 / 0.15);
  color: oklch(88% 0.02 270);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-input::placeholder { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-input:focus { border-color: oklch(65% 0.28 280 / 0.45); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-clear { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-clear:hover { color: oklch(88% 0.02 270); background: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-results { scrollbar-color: oklch(65% 0.28 280 / 0.15) transparent; }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-group-label { color: oklch(50% 0.06 280); border-bottom-color: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-search-empty { color: oklch(50% 0.06 280); }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tabs-area { border-bottom-color: oklch(65% 0.28 280 / 0.12); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tab-btn { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tab-btn:hover { color: oklch(73% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tab-btn.active { color: oklch(73% 0.16 280); border-bottom-color: oklch(73% 0.16 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tabs-scroll-btn { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tabs-scroll-btn:hover { color: oklch(88% 0.02 270); background: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tabs-scroll-btn--prev { border-right-color: oklch(65% 0.28 280 / 0.12); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-tabs-scroll-btn--next { border-left-color: oklch(65% 0.28 280 / 0.12); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-full-body { scrollbar-color: oklch(65% 0.28 280 / 0.15) transparent; }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-group-label {
  color: oklch(50% 0.06 280);
  border-bottom-color: oklch(65% 0.28 280 / 0.1);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-field-label { color: oklch(55% 0.08 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-field-hint { color: oklch(50% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-field-error { color: oklch(70% 0.18 20); }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-input,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-select,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-textarea {
  background: oklch(65% 0.28 280 / 0.05);
  border-color: oklch(65% 0.28 280 / 0.15);
  color: oklch(88% 0.02 270);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-input:focus,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-select:focus,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-textarea:focus {
  border-color: oklch(65% 0.28 280 / 0.45);
  background: oklch(65% 0.28 280 / 0.08);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='%238080c0' stroke-width='1.5'/%3E%3C/svg%3E");
}

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-feel-mode-btn {
  border-color: oklch(65% 0.28 280 / 0.15);
  color: oklch(50% 0.06 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-feel-mode-btn:hover {
  background: oklch(65% 0.28 280 / 0.08);
  color: oklch(65% 0.1 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-feel-mode-btn--active {
  border-color: oklch(65% 0.28 280 / 0.3);
  background: oklch(65% 0.28 280 / 0.12);
  color: oklch(73% 0.16 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-feel-playground-btn {
  border-color: oklch(65% 0.28 280 / 0.2);
  color: oklch(73% 0.16 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-feel-playground-btn:hover { background: oklch(65% 0.28 280 / 0.1); }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-toggle-label { color: oklch(65% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-toggle-track { background: oklch(65% 0.28 280 / 0.15); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-toggle input:checked + .bpmnkit-cfg-toggle-track { background: oklch(65% 0.28 280 / 0.7); }

[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-action-btn {
  border-color: oklch(65% 0.28 280 / 0.2);
  background: oklch(65% 0.28 280 / 0.06);
  color: oklch(65% 0.1 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-action-btn:hover {
  background: oklch(65% 0.28 280 / 0.12);
  border-color: oklch(65% 0.28 280 / 0.35);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-resize-handle:hover { background: oklch(65% 0.28 280 / 0.1); }

/* ── Searchable select ────────────────────────────────────────────────────── */
.bpmnkit-cfg-ss-trigger {
  width: 100%;
  padding: 7px 10px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  text-align: left;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
}
.bpmnkit-cfg-ss-trigger:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.18); }
.bpmnkit-cfg-ss-trigger:focus,
.bpmnkit-cfg-ss-trigger[aria-expanded="true"] { border-color: var(--bpmnkit-accent, #6b9df7); background: rgba(255,255,255,0.09); }
.bpmnkit-cfg-ss-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bpmnkit-cfg-ss-arrow {
  flex-shrink: 0;
  width: 10px; height: 6px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-size: contain;
}
/* Dropdown panel — appended to document.body, positioned fixed */
.bpmnkit-cfg-ss-dropdown {
  background: #1a1a2e;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.6);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bpmnkit-cfg-ss-search {
  padding: 8px 10px;
  background: rgba(255,255,255,0.05);
  border: none;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.9);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}
.bpmnkit-cfg-ss-search::placeholder { color: rgba(255,255,255,0.3); }
.bpmnkit-cfg-ss-list {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.bpmnkit-cfg-ss-option {
  padding: 7px 10px;
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-ss-option--focused { background: rgba(255,255,255,0.08); }
.bpmnkit-cfg-ss-option--selected { color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-cfg-ss-option--selected.bpmnkit-cfg-ss-option--focused { background: rgba(107,157,247,0.1); }
.bpmnkit-cfg-ss-empty { padding: 10px; font-size: 12px; color: rgba(255,255,255,0.3); text-align: center; }
/* Neon theme — applied via data-theme="neon" on the dropdown element itself */
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] {
  background: oklch(9% 0.025 270);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 8px 32px oklch(0% 0 0 / 0.7), 0 0 0 1px oklch(65% 0.28 280 / 0.1);
}
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-search {
  background: oklch(65% 0.28 280 / 0.05);
  border-bottom-color: oklch(65% 0.28 280 / 0.12);
  color: oklch(88% 0.02 270);
}
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-search::placeholder { color: oklch(55% 0.06 280); }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-list { scrollbar-color: oklch(65% 0.28 280 / 0.15) transparent; }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-option { color: oklch(65% 0.1 280); }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-option--focused { background: oklch(65% 0.28 280 / 0.08); }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-option--selected { color: oklch(73% 0.16 280); }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-option--selected.bpmnkit-cfg-ss-option--focused { background: oklch(65% 0.28 280 / 0.12); }
.bpmnkit-cfg-ss-dropdown[data-theme="neon"] .bpmnkit-cfg-ss-empty { color: oklch(50% 0.06 280); }
/* Neon theme trigger */
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-ss-trigger { background: oklch(65% 0.28 280 / 0.06); border-color: oklch(65% 0.28 280 / 0.2); color: oklch(65% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-ss-trigger:hover { background: oklch(65% 0.28 280 / 0.1); border-color: oklch(65% 0.28 280 / 0.3); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-ss-trigger:focus,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-ss-trigger[aria-expanded="true"] { border-color: oklch(65% 0.28 280 / 0.5); background: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .bpmnkit-cfg-ss-arrow {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='%238080c0' stroke-width='1.5'/%3E%3C/svg%3E");
}
/* Light theme — applied via data-theme="light" on the dropdown element itself */
.bpmnkit-cfg-ss-dropdown[data-theme="light"] {
  background: #ffffff;
  border-color: rgba(0,0,0,0.12);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-search {
  background: rgba(0,0,0,0.03);
  border-bottom-color: rgba(0,0,0,0.08);
  color: rgba(0,0,0,0.85);
}
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-search::placeholder { color: rgba(0,0,0,0.3); }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-list { scrollbar-color: rgba(0,0,0,0.15) transparent; }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-option { color: rgba(0,0,0,0.85); }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-option--focused { background: rgba(0,0,0,0.05); }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-option--selected { color: var(--bpmnkit-accent, #1a56db); }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-option--selected.bpmnkit-cfg-ss-option--focused { background: rgba(26,86,219,0.08); }
.bpmnkit-cfg-ss-dropdown[data-theme="light"] .bpmnkit-cfg-ss-empty { color: rgba(0,0,0,0.35); }
/* Light theme trigger */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-ss-trigger { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: rgba(0,0,0,0.85); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-ss-trigger:hover { background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.2); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-ss-trigger:focus,
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-ss-trigger[aria-expanded="true"] { border-color: var(--bpmnkit-accent, #1a56db); background: rgba(0,0,0,0.06); }
[data-bpmnkit-hud-theme="light"] .bpmnkit-cfg-ss-arrow {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='1.5'/%3E%3C/svg%3E");
}
`

export function injectConfigPanelStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(CONFIG_PANEL_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = CONFIG_PANEL_STYLE_ID
	style.textContent = CONFIG_PANEL_CSS
	document.head.appendChild(style)
}
