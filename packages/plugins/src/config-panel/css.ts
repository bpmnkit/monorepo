import { injectChromeStyles } from "@bpmnkit/editor"

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
  background: var(--bpmnkit-chrome-ground);
  border-left: 1px solid var(--bpmnkit-chrome-line);
  display: flex;
  flex-direction: column;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
  color: var(--bpmnkit-chrome-ink);
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
  top: auto; right: auto; bottom: auto; border-left: none;
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
  background: var(--bpmnkit-chrome-accent-subtle);
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.bpmnkit-cfg-full-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  flex-shrink: 0;
}
.bpmnkit-cfg-full-info {
  flex: 1;
  min-width: 0;
}
.bpmnkit-cfg-full-type {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4);
  margin-bottom: 2px;
}
.bpmnkit-cfg-full-template {
  font-size: 11px;
  font-weight: 600;
  color: var(--bpmnkit-chrome-accent);
  margin-bottom: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-full-name {
  display: block;
  width: 100%;
  font-size: 14px;
  font-weight: 600;
  color: var(--bpmnkit-chrome-accent-fg);
  background: transparent;
  border: none;
  border-bottom: 1px solid transparent;
  outline: none;
  padding: 0;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: inherit;
  cursor: text;
}
.bpmnkit-cfg-full-name:not([readonly]):hover {
  border-bottom-color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-cfg-full-name:not([readonly]):focus {
  border-bottom-color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-cfg-full-name::placeholder {
  color: var(--bpmnkit-chrome-ink-4);
  font-weight: 400;
}
/* Docs link — ? button shown when the schema has a documentationRef */
.bpmnkit-cfg-docs-link {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--bpmnkit-chrome-ink-4);
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 11px;
  font-weight: 700;
  text-decoration: none;
  flex-shrink: 0;
  transition: border-color 0.1s, color 0.1s, background 0.1s;
}
.bpmnkit-cfg-docs-link:hover {
  color: var(--bpmnkit-chrome-accent);
  border-color: var(--bpmnkit-chrome-accent);
  background: var(--bpmnkit-chrome-accent-subtle);
}
.bpmnkit-cfg-collapse-btn {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-collapse-btn:hover { background: var(--bpmnkit-chrome-line-soft); color: var(--bpmnkit-chrome-accent-fg); }
.bpmnkit-cfg-full-close {
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  line-height: 1;
  flex-shrink: 0;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-full-close:hover { background: var(--bpmnkit-chrome-line-soft); color: var(--bpmnkit-chrome-accent-fg); }

/* ── Search bar ──────────────────────────────────────────────────────────── */
.bpmnkit-cfg-search-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  flex-shrink: 0;
}
.bpmnkit-cfg-search-input {
  flex: 1;
  height: 28px;
  padding: 0 8px;
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.bpmnkit-cfg-search-input::placeholder { color: var(--bpmnkit-chrome-ink-4); }
.bpmnkit-cfg-search-input:focus {
  border-color: var(--bpmnkit-chrome-accent);
  background: var(--bpmnkit-chrome-line);
}
.bpmnkit-cfg-search-clear {
  width: 22px;
  height: 22px;
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  padding: 0;
  /* display toggled via JS */
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  transition: color 0.1s, background 0.1s;
}
.bpmnkit-cfg-search-clear:hover { color: var(--bpmnkit-chrome-accent-fg); background: var(--bpmnkit-chrome-line-soft); }

/* ── Guide bar (field assistant) ─────────────────────────────────────────── */
.bpmnkit-cfg-guide-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 14px;
  background: var(--bpmnkit-danger, #dc2626);
  border-bottom: 1px solid var(--bpmnkit-danger, #dc2626);
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 800;
  color: var(--bpmnkit-chrome-accent-fg);
  flex-shrink: 0;
  line-height: 1;
}
.bpmnkit-cfg-guide-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--bpmnkit-danger, #dc2626);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-guide-btn {
  flex-shrink: 0;
  padding: 3px 10px;
  border: 1px solid var(--bpmnkit-danger, #dc2626);
  background: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #f87171);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.1s, border-color 0.1s;
  white-space: nowrap;
}
.bpmnkit-cfg-guide-btn:hover {
  background: var(--bpmnkit-danger, #dc2626);
  border-color: var(--bpmnkit-danger, #dc2626);
}

/* ── Search results ──────────────────────────────────────────────────────── */
.bpmnkit-cfg-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 4px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: var(--bpmnkit-chrome-line) transparent;
}
.bpmnkit-cfg-search-group-label {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4);
  margin: 16px 0 10px;
  padding-bottom: 5px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
}
.bpmnkit-cfg-search-group-label:first-child { margin-top: 10px; }
.bpmnkit-cfg-search-empty {
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-4);
  text-align: center;
  padding: 28px 0;
}

/* ── Tabs area (wrapper + scroll buttons) ────────────────────────────────── */
.bpmnkit-cfg-tabs-area {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
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
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
  margin-bottom: -1px;
  flex-shrink: 0;
}
.bpmnkit-cfg-tab-btn:hover { color: var(--bpmnkit-chrome-ink-2); }
.bpmnkit-cfg-tab-btn.active { color: var(--bpmnkit-chrome-accent); border-bottom-color: var(--bpmnkit-chrome-accent); }
/* Red dot shown after tab label when the group has required-empty fields */
.bpmnkit-cfg-tab-btn.has-error::after {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
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
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  /* display toggled via JS */
  align-items: center;
  justify-content: center;
  transition: background 0.1s, color 0.1s;
}
.bpmnkit-cfg-tabs-scroll-btn:hover { color: var(--bpmnkit-chrome-accent-fg); background: var(--bpmnkit-chrome-line-soft); }
.bpmnkit-cfg-tabs-scroll-btn--prev { border-right: 1px solid var(--bpmnkit-chrome-hover); }
.bpmnkit-cfg-tabs-scroll-btn--next { border-left: 1px solid var(--bpmnkit-chrome-hover); }

/* ── Scrollable body ─────────────────────────────────────────────────────── */
.bpmnkit-cfg-full-body {
  flex: 1;
  overflow-y: auto;
  padding: 22px 22px 32px;
  scrollbar-width: thin;
  scrollbar-color: var(--bpmnkit-chrome-line) transparent;
}

/* ── Groups & Fields ──────────────────────────────────────────────────────── */
.bpmnkit-cfg-group-label {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4);
  margin-bottom: 14px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
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
  color: var(--bpmnkit-chrome-ink-2);
  margin-bottom: 5px;
  cursor: default;
}
.bpmnkit-cfg-field-label[title] { cursor: help; }
.bpmnkit-cfg-field-docs {
  font-size: 10px;
  color: var(--bpmnkit-chrome-accent);
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
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
}
.bpmnkit-cfg-input:focus,
.bpmnkit-cfg-select:focus,
.bpmnkit-cfg-textarea:focus {
  border-color: var(--bpmnkit-chrome-accent);
  background-color: var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-cfg-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='var(--bpmnkit-chrome-ink-4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  padding-right: 28px;
}
.bpmnkit-cfg-textarea {
  resize: vertical;
  min-height: 68px;
  line-height: 1.5;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
}
.bpmnkit-cfg-field-hint {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
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

/* ── FEEL expression field ────────────────────────────────────────────────── */
/* FEEL/string mode toggle — appears at the right end of a feel-expression label row */
.bpmnkit-cfg-feel-mode-btn {
  font-family: var(--bpmnkit-chrome-mono);
  margin-left: auto;
  flex-shrink: 0;
  padding: 1px 6px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: none;
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: background 0.1s, color 0.1s, border-color 0.1s;
}
.bpmnkit-cfg-feel-mode-btn:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-cfg-feel-mode-btn--active {
  border-color: var(--bpmnkit-chrome-accent-subtle);
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-cfg-feel-mode-btn--active:hover { background: var(--bpmnkit-chrome-accent-subtle); }

.bpmnkit-cfg-feel-ta {
  width: 100%;
  min-height: 68px;
  padding: 7px 10px;
  border: 1px solid var(--bpmnkit-chrome-line);
  font-size: 11px;
  font-family: var(--bpmnkit-chrome-mono);
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
  border: 1px solid var(--bpmnkit-chrome-line);
  background: none;
  color: var(--bpmnkit-chrome-accent);
  font-size: 11px;
  cursor: pointer;
  transition: background 0.1s;
}
.bpmnkit-cfg-feel-playground-btn:hover { background: var(--bpmnkit-chrome-accent-subtle); }

/* ── Toggle ───────────────────────────────────────────────────────────────── */
.bpmnkit-cfg-toggle-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bpmnkit-cfg-toggle-label {
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-2);
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
  background: var(--bpmnkit-chrome-line);
  transition: background 0.2s;
}
.bpmnkit-cfg-toggle input:checked + .bpmnkit-cfg-toggle-track { background: var(--bpmnkit-chrome-accent); }
.bpmnkit-cfg-toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: var(--bpmnkit-chrome-accent-fg);
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
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}
.bpmnkit-cfg-action-btn:hover {
  background: var(--bpmnkit-chrome-line);
  border-color: var(--bpmnkit-chrome-ink-4);
}

/* ── Searchable select ────────────────────────────────────────────────────── */
.bpmnkit-cfg-ss-trigger {
  width: 100%;
  padding: 7px 10px;
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
  text-align: left;
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s, background 0.15s;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 6px;
}
.bpmnkit-cfg-ss-trigger:hover { background: var(--bpmnkit-chrome-line-soft); border-color: var(--bpmnkit-chrome-ink-4); }
.bpmnkit-cfg-ss-trigger:focus,
.bpmnkit-cfg-ss-trigger[aria-expanded="true"] { border-color: var(--bpmnkit-chrome-accent); background: var(--bpmnkit-chrome-line-soft); }
.bpmnkit-cfg-ss-trigger-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bpmnkit-cfg-ss-arrow {
  flex-shrink: 0;
  width: 10px; height: 6px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6' fill='none' stroke='var(--bpmnkit-chrome-ink-4)' stroke-width='1.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-size: contain;
}
/* Dropdown panel — appended to document.body, positioned fixed */
.bpmnkit-cfg-ss-dropdown {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.bpmnkit-cfg-ss-search {
  padding: 8px 10px;
  background: var(--bpmnkit-chrome-line-soft);
  border: none;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  color: var(--bpmnkit-chrome-ink);
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
  outline: none;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}
.bpmnkit-cfg-ss-search::placeholder { color: var(--bpmnkit-chrome-ink-4); }
.bpmnkit-cfg-ss-list {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--bpmnkit-chrome-line) transparent;
}
.bpmnkit-cfg-ss-option {
  padding: 7px 10px;
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-cfg-ss-option--focused { background: var(--bpmnkit-chrome-line-soft); }
.bpmnkit-cfg-ss-option--selected { color: var(--bpmnkit-chrome-accent); }
.bpmnkit-cfg-ss-option--selected.bpmnkit-cfg-ss-option--focused { background: var(--bpmnkit-chrome-accent-subtle); }
.bpmnkit-cfg-ss-empty { padding: 10px; font-size: 12px; color: var(--bpmnkit-chrome-ink-4); text-align: center; }
`

export function injectConfigPanelStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(CONFIG_PANEL_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = CONFIG_PANEL_STYLE_ID
	style.textContent = CONFIG_PANEL_CSS
	document.head.appendChild(style)
}
