export const CONFIG_PANEL_STYLE_ID = "bpmn-config-panel-styles-v1"

export const CONFIG_PANEL_CSS = `
/* ── Inspector panel ─────────────────────────────────────────────────────── */
/*
 * top: 36px matches the height of the .bpmn-tabs bar from canvas-plugin-tabs,
 * so the inspector panel does not overlap the tab bar.
 */
.bpmn-cfg-full {
  position: fixed;
  right: 0;
  top: 36px;
  bottom: 0;
  width: 320px;
  background: var(--bpmn-panel-bg, rgba(13,13,22,0.92));
  backdrop-filter: blur(16px);
  border-left: 1px solid var(--bpmn-panel-border, rgba(255,255,255,0.08));
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  color: rgba(255,255,255,0.85);
  z-index: 9999;
  transition: width 0.2s ease;
}
.bpmn-cfg-full--collapsed {
  width: 40px;
}
.bpmn-cfg-full--collapsed .bpmn-cfg-full-info,
.bpmn-cfg-full--collapsed .bpmn-cfg-full-close,
.bpmn-cfg-full--collapsed .bpmn-cfg-docs-link,
.bpmn-cfg-full--collapsed .bpmn-cfg-search-bar,
.bpmn-cfg-full--collapsed .bpmn-cfg-guide-bar,
.bpmn-cfg-full--collapsed .bpmn-cfg-tabs-area,
.bpmn-cfg-full--collapsed .bpmn-cfg-full-body,
.bpmn-cfg-full--collapsed .bpmn-cfg-search-results {
  display: none;
}
.bpmn-cfg-full--collapsed .bpmn-cfg-full-header {
  justify-content: center;
  padding: 14px 0;
}

/* Hosted mode — renders inside a dock pane instead of as a fixed overlay */
.bpmn-cfg-full--hosted {
  position: static !important;
  width: auto !important;
  top: auto; right: auto; bottom: auto;
  box-shadow: none; border-left: none; backdrop-filter: none;
  flex: 1; min-height: 0;
}
/* suppress controls that the dock replaces */
.bpmn-cfg-full--hosted .bpmn-cfg-resize-handle,
.bpmn-cfg-full--hosted .bpmn-cfg-collapse-btn { display: none; }

/* Resize handle — a thin grab zone along the left edge */
.bpmn-cfg-resize-handle {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  z-index: 1;
}
.bpmn-cfg-resize-handle:hover {
  background: var(--bpmn-accent-subtle, rgba(107,157,247,0.15));
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.bpmn-cfg-full-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.bpmn-cfg-full-info {
  flex: 1;
  min-width: 0;
}
.bpmn-cfg-full-type {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.35);
  margin-bottom: 2px;
}
.bpmn-cfg-full-template {
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmn-accent, #6b9df7);
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmn-cfg-full-name {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Docs link — ? button shown when the schema has a documentationRef */
.bpmn-cfg-docs-link {
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
.bpmn-cfg-docs-link:hover {
  color: var(--bpmn-accent, #6b9df7);
  border-color: var(--bpmn-accent, #6b9df7);
  background: var(--bpmn-accent-subtle, rgba(107,157,247,0.15));
}
.bpmn-cfg-collapse-btn {
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
.bpmn-cfg-collapse-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
.bpmn-cfg-full-close {
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
.bpmn-cfg-full-close:hover { background: rgba(255,255,255,0.08); color: #fff; }

/* ── Search bar ──────────────────────────────────────────────────────────── */
.bpmn-cfg-search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.bpmn-cfg-search-input {
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
.bpmn-cfg-search-input::placeholder { color: rgba(255,255,255,0.28); }
.bpmn-cfg-search-input:focus {
  border-color: var(--bpmn-accent, #6b9df7);
  background: rgba(255,255,255,0.1);
}
.bpmn-cfg-search-clear {
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
.bpmn-cfg-search-clear:hover { color: #fff; background: rgba(255,255,255,0.08); }

/* ── Guide bar (field assistant) ─────────────────────────────────────────── */
.bpmn-cfg-guide-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  background: rgba(248, 113, 113, 0.09);
  border-bottom: 1px solid rgba(248, 113, 113, 0.18);
  flex-shrink: 0;
}
.bpmn-cfg-guide-info {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.bpmn-cfg-guide-icon {
  width: 16px;
  height: 16px;
  background: var(--bpmn-danger, #f87171);
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
.bpmn-cfg-guide-text {
  font-size: 11px;
  font-weight: 500;
  color: rgba(248, 113, 113, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmn-cfg-guide-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid rgba(248, 113, 113, 0.4);
  background: rgba(248, 113, 113, 0.12);
  color: var(--bpmn-danger, #f87171);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}
.bpmn-cfg-guide-btn:hover {
  background: rgba(248, 113, 113, 0.22);
  border-color: rgba(248, 113, 113, 0.6);
}

/* ── Search results ──────────────────────────────────────────────────────── */
.bpmn-cfg-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}
.bpmn-cfg-search-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin: 16px 0 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bpmn-cfg-search-group-label:first-child { margin-top: 10px; }
.bpmn-cfg-search-empty {
  font-size: 12px;
  color: rgba(255,255,255,0.3);
  text-align: center;
  padding: 28px 0;
}

/* ── Tabs area (wrapper + scroll buttons) ────────────────────────────────── */
.bpmn-cfg-tabs-area {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
  overflow: hidden;
}
.bpmn-cfg-tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: flex-end;
  overflow-x: auto;
  scrollbar-width: none;
}
.bpmn-cfg-tabs::-webkit-scrollbar { display: none; }
.bpmn-cfg-tab-btn {
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
.bpmn-cfg-tab-btn:hover { color: rgba(255,255,255,0.75); }
.bpmn-cfg-tab-btn.active { color: var(--bpmn-accent, #6b9df7); border-bottom-color: var(--bpmn-accent, #6b9df7); }
/* Red dot shown after tab label when the group has required-empty fields */
.bpmn-cfg-tab-btn.has-error::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--bpmn-danger, #f87171);
  margin-left: 5px;
  vertical-align: middle;
  flex-shrink: 0;
}

/* Arrow buttons for overflowing tabs */
.bpmn-cfg-tabs-scroll-btn {
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
.bpmn-cfg-tabs-scroll-btn:hover { color: #fff; background: rgba(255,255,255,0.08); }
.bpmn-cfg-tabs-scroll-btn--prev { border-right: 1px solid rgba(255,255,255,0.06); }
.bpmn-cfg-tabs-scroll-btn--next { border-left: 1px solid rgba(255,255,255,0.06); }

/* ── Scrollable body ─────────────────────────────────────────────────────── */
.bpmn-cfg-full-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.15) transparent;
}

/* ── Groups & Fields ──────────────────────────────────────────────────────── */
.bpmn-cfg-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.bpmn-cfg-field {
  margin-bottom: 14px;
}
.bpmn-cfg-field-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 500;
  color: rgba(255,255,255,0.55);
  margin-bottom: 5px;
  cursor: default;
}
.bpmn-cfg-field-label[title] { cursor: help; }
.bpmn-cfg-field-docs {
  font-size: 10px;
  color: var(--bpmn-accent, #6b9df7);
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.1s;
}
.bpmn-cfg-field-docs:hover { opacity: 1; }
.bpmn-cfg-required-star {
  color: var(--bpmn-danger, #f87171);
  font-weight: 700;
  margin-left: 2px;
}
.bpmn-cfg-field--invalid {
  border-left: 2px solid var(--bpmn-danger, #f87171);
  padding-left: 8px;
}
.bpmn-cfg-field--invalid .bpmn-cfg-input,
.bpmn-cfg-field--invalid .bpmn-cfg-select,
.bpmn-cfg-field--invalid .bpmn-cfg-textarea {
  border-color: var(--bpmn-danger, #f87171);
}

.bpmn-cfg-input,
.bpmn-cfg-select,
.bpmn-cfg-textarea {
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
.bpmn-cfg-input:focus,
.bpmn-cfg-select:focus,
.bpmn-cfg-textarea:focus {
  border-color: var(--bpmn-accent, #6b9df7);
  background-color: rgba(255,255,255,0.09);
}
.bpmn-cfg-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(255,255,255,0.4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.bpmn-cfg-textarea {
  resize: vertical;
  min-height: 68px;
  line-height: 1.5;
  font-family: var(--bpmn-font-mono, ui-monospace, "SF Mono", monospace);
  font-size: 11px;
}
.bpmn-cfg-field-hint {
  font-size: 11px;
  color: rgba(255,255,255,0.3);
  margin-top: 4px;
  line-height: 1.4;
}

/* ── Field error message ──────────────────────────────────────────────────── */
.bpmn-cfg-field-error {
  font-size: 11px;
  color: var(--bpmn-danger, #f87171);
  margin-top: 3px;
  line-height: 1.3;
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-field-error { color: var(--bpmn-danger, #dc2626); }

/* ── FEEL expression field ────────────────────────────────────────────────── */
/* FEEL/string mode toggle — appears at the right end of a feel-expression label row */
.bpmn-cfg-feel-mode-btn {
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
.bpmn-cfg-feel-mode-btn:hover {
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.55);
}
.bpmn-cfg-feel-mode-btn--active {
  border-color: var(--bpmn-accent-subtle, rgba(107,157,247,0.15));
  background: var(--bpmn-accent-subtle, rgba(107,157,247,0.15));
  color: var(--bpmn-accent, #6b9df7);
}
.bpmn-cfg-feel-mode-btn--active:hover { background: var(--bpmn-accent-subtle, rgba(107,157,247,0.15)); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-mode-btn {
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.3);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-mode-btn:hover {
  background: rgba(0,0,0,0.05);
  color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-mode-btn--active {
  border-color: var(--bpmn-accent-subtle, rgba(26,86,219,0.12));
  background: var(--bpmn-accent-subtle, rgba(26,86,219,0.12));
  color: var(--bpmn-accent, #1a56db);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-mode-btn--active:hover { background: var(--bpmn-accent-subtle, rgba(26,86,219,0.12)); }

.bpmn-cfg-feel-ta {
  width: 100%;
  min-height: 68px;
  padding: 7px 10px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  font-size: 11px;
  font-family: var(--bpmn-font-mono, ui-monospace, "SF Mono", monospace);
  line-height: 1.5;
  resize: vertical;
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.bpmn-cfg-feel-playground-btn {
  display: inline-flex;
  margin-top: 4px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: none;
  color: var(--bpmn-accent, #6b9df7);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}
.bpmn-cfg-feel-playground-btn:hover { background: var(--bpmn-accent-subtle, rgba(107,157,247,0.15)); }

/* Light theme overrides */
[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-playground-btn {
  border-color: rgba(0,0,0,0.12);
  color: var(--bpmn-accent, #1a56db);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-feel-playground-btn:hover { background: var(--bpmn-accent-subtle, rgba(26,86,219,0.12)); }

/* ── Toggle ───────────────────────────────────────────────────────────────── */
.bpmn-cfg-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bpmn-cfg-toggle-label {
  font-size: 12px;
  color: rgba(255,255,255,0.7);
  cursor: pointer;
}
.bpmn-cfg-toggle-label[title] { cursor: help; }
.bpmn-cfg-toggle {
  position: relative;
  display: inline-flex;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
  cursor: pointer;
}
.bpmn-cfg-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}
.bpmn-cfg-toggle-track {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  border-radius: 9px;
  transition: background 0.2s;
}
.bpmn-cfg-toggle input:checked + .bpmn-cfg-toggle-track { background: var(--bpmn-accent, #6b9df7); }
.bpmn-cfg-toggle-thumb {
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
.bpmn-cfg-toggle input:checked ~ .bpmn-cfg-toggle-thumb { transform: translateX(16px); }

/* ── Action button ────────────────────────────────────────────────────────── */
.bpmn-cfg-action-btn {
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
.bpmn-cfg-action-btn:hover {
  background: rgba(255,255,255,0.13);
  border-color: rgba(255,255,255,0.25);
}

/* ── Light theme overrides ────────────────────────────────────────────────── */
[data-bpmn-hud-theme="light"] .bpmn-cfg-full {
  background: var(--bpmn-panel-bg, rgba(255,255,255,0.92));
  border-left-color: var(--bpmn-panel-border, rgba(0,0,0,0.08));
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-header { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-type { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-template { color: var(--bpmn-accent, #1a56db); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-name { color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-docs-link { color: rgba(0,0,0,0.4); border-color: rgba(0,0,0,0.2); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-docs-link:hover { color: var(--bpmn-accent, #1a56db); border-color: var(--bpmn-accent, #1a56db); background: var(--bpmn-accent-subtle, rgba(26,86,219,0.12)); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-collapse-btn { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-collapse-btn:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-close { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-close:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.9); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-search-bar { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-input {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-input::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-clear { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-clear:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-results { scrollbar-color: rgba(0,0,0,0.15) transparent; }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-group-label { color: rgba(0,0,0,0.35); border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-search-empty { color: rgba(0,0,0,0.35); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs-area { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tab-btn { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tab-btn:hover { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs-scroll-btn { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs-scroll-btn:hover { color: rgba(0,0,0,0.9); background: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs-scroll-btn--prev { border-right-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-tabs-scroll-btn--next { border-left-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-full-body { scrollbar-color: rgba(0,0,0,0.15) transparent; }

[data-bpmn-hud-theme="light"] .bpmn-cfg-group-label {
  color: rgba(0,0,0,0.35);
  border-bottom-color: rgba(0,0,0,0.06);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-field-label { color: rgba(0,0,0,0.55); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-field-hint { color: rgba(0,0,0,0.4); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-input,
[data-bpmn-hud-theme="light"] .bpmn-cfg-select,
[data-bpmn-hud-theme="light"] .bpmn-cfg-textarea {
  background-color: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.85);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-input:focus,
[data-bpmn-hud-theme="light"] .bpmn-cfg-select:focus,
[data-bpmn-hud-theme="light"] .bpmn-cfg-textarea:focus {
  background-color: rgba(0,0,0,0.06);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='rgba(0,0,0,0.45)' stroke-width='1.5'/%3E%3C/svg%3E");
}

[data-bpmn-hud-theme="light"] .bpmn-cfg-toggle-label { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-toggle-track { background: rgba(0,0,0,0.12); }

[data-bpmn-hud-theme="light"] .bpmn-cfg-action-btn {
  border-color: rgba(0,0,0,0.15);
  background: rgba(0,0,0,0.04);
  color: rgba(0,0,0,0.75);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-action-btn:hover {
  background: rgba(0,0,0,0.08);
  border-color: rgba(0,0,0,0.2);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-resize-handle:hover {
  background: var(--bpmn-accent-subtle, rgba(26,86,219,0.12));
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-guide-bar {
  background: rgba(248, 113, 113, 0.06);
  border-bottom-color: rgba(248, 113, 113, 0.15);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-guide-text { color: var(--bpmn-danger, #dc2626); }
[data-bpmn-hud-theme="light"] .bpmn-cfg-guide-btn {
  color: var(--bpmn-danger, #dc2626);
  border-color: rgba(220, 38, 38, 0.3);
  background: rgba(220, 38, 38, 0.07);
}
[data-bpmn-hud-theme="light"] .bpmn-cfg-guide-btn:hover {
  background: rgba(220, 38, 38, 0.14);
  border-color: rgba(220, 38, 38, 0.5);
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
