export const FORM_EDITOR_CSS = `
.form-editor {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  overflow: hidden;
  background: var(--fe-bg, #ffffff);
  color: var(--fe-fg, #1c1c1c);
  --fe-bg: #ffffff;
  --fe-fg: #1c1c1c;
  --fe-border: #e5e7eb;
  --fe-panel-bg: #f9fafb;
  --fe-row-hover: #f3f4f6;
  --fe-badge-bg: #e5e7eb;
  --fe-badge-fg: #374151;
  --fe-btn-bg: #e5e7eb;
  --fe-btn-fg: #374151;
  --fe-btn-hover: #d1d5db;
  --fe-input-bg: #ffffff;
  --fe-input-border: #d1d5db;
  --fe-label: #6b7280;
  --fe-accent: #3d5afe;
  --fe-danger: #dc2626;
  --fe-section-fg: #9ca3af;
  --fe-card-selected-bg: #eff3ff;
  --fe-card-selected-border: #3d5afe;
  --fe-card-hover-border: #93c5fd;
  --fe-drop-active-bg: #dbeafe;
  --fe-drop-active-border: #3b82f6;
  --fe-container-border: #c4b5fd;
  --fe-preview-input-bg: #f9fafb;
  --fe-preview-input-border: #d1d5db;
  --fe-preview-label: #6b7280;
}

.form-editor.dark {
  --fe-bg: #1e1e2e;
  --fe-fg: #cdd6f4;
  --fe-border: #313244;
  --fe-panel-bg: #181825;
  --fe-row-hover: #2a2a3e;
  --fe-badge-bg: #313244;
  --fe-badge-fg: #bac2de;
  --fe-btn-bg: #313244;
  --fe-btn-fg: #bac2de;
  --fe-btn-hover: #45475a;
  --fe-input-bg: #1e1e2e;
  --fe-input-border: #45475a;
  --fe-label: #bac2de;
  --fe-accent: #89b4fa;
  --fe-danger: #f38ba8;
  --fe-section-fg: #6c7086;
  --fe-card-selected-bg: #1e1e3a;
  --fe-card-selected-border: #89b4fa;
  --fe-card-hover-border: #585b70;
  --fe-drop-active-bg: #1e2040;
  --fe-drop-active-border: #89b4fa;
  --fe-container-border: #7c6fd4;
  --fe-preview-input-bg: #1e1e2e;
  --fe-preview-input-border: #45475a;
  --fe-preview-label: #7f849c;
}

/* ── Palette ────────────────────────────────────────────────────── */

.fe-palette {
  width: 260px;
  flex-shrink: 0;
  border-right: 1px solid var(--fe-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--fe-panel-bg);
}

.fe-palette-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--fe-border);
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fe-section-fg);
}

.fe-palette-search {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: none;
  border-bottom: 1px solid var(--fe-border);
  background: var(--fe-input-bg);
  color: var(--fe-fg);
  font-family: inherit;
  font-size: 12px;
  outline: none;
  flex-shrink: 0;
}

.fe-palette-search::placeholder {
  color: var(--fe-section-fg);
}

.fe-palette-entries {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.fe-palette-group {
  margin-bottom: 8px;
}

.fe-palette-group-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--fe-section-fg);
  padding: 4px 10px 4px;
}

.fe-palette-group-items {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 8px;
}

.fe-palette-item {
  width: 72px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: grab;
  background: var(--fe-bg);
  padding: 6px 4px;
  box-sizing: border-box;
  transition: border-color 0.1s, background 0.1s;
  user-select: none;
}

.fe-palette-item:hover {
  border-color: var(--fe-border);
  background: var(--fe-row-hover);
}

.fe-palette-item:active {
  cursor: grabbing;
}

.fe-palette-icon {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  flex-shrink: 0;
}

.fe-palette-item-label {
  font-size: 10px;
  text-align: center;
  color: var(--fe-fg);
  line-height: 1.2;
  max-height: 2.4em;
  overflow: hidden;
  word-break: break-word;
}

/* Palette group icon colors */
.fe-palette-item-input .fe-palette-icon {
  background: #dbeafe;
  color: #1d4ed8;
}
.fe-palette-item-selection .fe-palette-icon {
  background: #dcfce7;
  color: #15803d;
}
.fe-palette-item-presentation .fe-palette-icon {
  background: #fef3c7;
  color: #92400e;
}
.fe-palette-item-container .fe-palette-icon {
  background: #ede9fe;
  color: #6d28d9;
}
.fe-palette-item-action .fe-palette-icon {
  background: #fee2e2;
  color: #b91c1c;
}

/* Dark mode palette icon colors */
.form-editor.dark .fe-palette-item-input .fe-palette-icon {
  background: #1e3a5f;
  color: #93c5fd;
}
.form-editor.dark .fe-palette-item-selection .fe-palette-icon {
  background: #14532d;
  color: #86efac;
}
.form-editor.dark .fe-palette-item-presentation .fe-palette-icon {
  background: #451a03;
  color: #fcd34d;
}
.form-editor.dark .fe-palette-item-container .fe-palette-icon {
  background: #2e1065;
  color: #c4b5fd;
}
.form-editor.dark .fe-palette-item-action .fe-palette-icon {
  background: #450a0a;
  color: #fca5a5;
}

/* ── Canvas ─────────────────────────────────────────────────────── */

.fe-canvas {
  flex: 1;
  overflow-y: auto;
  position: relative;
  background: var(--fe-bg);
}

.fe-canvas-inner {
  padding: 20px;
  min-height: 100%;
  box-sizing: border-box;
}

/* Empty state */
.fe-canvas-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: 40px;
  box-sizing: border-box;
  color: var(--fe-section-fg);
  text-align: center;
}

.fe-canvas-empty-active {
  background: var(--fe-drop-active-bg);
}

.fe-canvas-empty-icon {
  font-size: 48px;
  margin-bottom: 12px;
  opacity: 0.4;
}

.fe-canvas-empty-heading {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--fe-fg);
  opacity: 0.6;
}

.fe-canvas-empty-hint {
  font-size: 13px;
  opacity: 0.7;
  max-width: 280px;
}

/* Drop zones */
.fe-drop-zone {
  height: 8px;
  border-radius: 4px;
  transition: height 0.1s, background 0.1s;
  position: relative;
}

.fe-canvas.fe-dragging .fe-drop-zone {
  height: 24px;
}

.fe-drop-zone.fe-drop-zone-active {
  height: 36px !important;
  background: var(--fe-drop-active-bg);
  border: 2px dashed var(--fe-drop-active-border);
  border-radius: 4px;
}

/* Cards */
.fe-canvas-card {
  position: relative;
  display: flex;
  align-items: stretch;
  border: 2px solid transparent;
  border-radius: 6px;
  background: var(--fe-bg);
  cursor: pointer;
  transition: border-color 0.1s;
}

.fe-canvas-card:hover {
  border-color: var(--fe-card-hover-border);
}

.fe-canvas-card.selected {
  border-color: var(--fe-card-selected-border);
  background: var(--fe-card-selected-bg);
}

.fe-canvas-card.fe-card-dragging {
  opacity: 0.3;
}

.fe-card-drag-handle {
  width: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  color: var(--fe-section-fg);
  font-size: 14px;
  opacity: 0.4;
  flex-shrink: 0;
  border-radius: 4px 0 0 4px;
}

.fe-canvas-card:hover .fe-card-drag-handle {
  opacity: 1;
}

.fe-card-drag-handle:active {
  cursor: grabbing;
}

.fe-card-content {
  flex: 1;
  padding: 10px 10px 10px 4px;
  min-width: 0;
}

.fe-card-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--fe-danger);
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.1s;
  padding: 0;
}

.fe-canvas-card:hover .fe-card-delete,
.fe-canvas-card.selected .fe-card-delete {
  opacity: 1;
}

.fe-card-delete:hover {
  background: var(--fe-danger);
  color: #fff;
}

/* Container canvas (children) */
.fe-container-canvas {
  margin-top: 8px;
  padding-left: 10px;
  border-left: 3px dashed var(--fe-container-border);
}

.fe-container-empty {
  padding: 12px;
  border: 2px dashed var(--fe-border);
  border-radius: 4px;
  color: var(--fe-section-fg);
  font-size: 12px;
  text-align: center;
  transition: background 0.1s, border-color 0.1s;
}

.fe-container-empty.fe-drop-zone-active {
  background: var(--fe-drop-active-bg);
  border-color: var(--fe-drop-active-border);
  color: var(--fe-accent);
}

/* Component preview */
.fe-preview {
  pointer-events: none;
  user-select: none;
}

.fe-preview-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fe-preview-label);
  margin-bottom: 4px;
}

.fe-preview-input {
  height: 28px;
  border: 1px solid var(--fe-preview-input-border);
  border-radius: 3px;
  background: var(--fe-preview-input-bg);
}

.fe-preview-textarea {
  height: 56px;
  border: 1px solid var(--fe-preview-input-border);
  border-radius: 3px;
  background: var(--fe-preview-input-bg);
}

.fe-preview-select {
  height: 28px;
  border: 1px solid var(--fe-preview-input-border);
  border-radius: 3px;
  background: var(--fe-preview-input-bg);
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 12px;
  color: var(--fe-section-fg);
  justify-content: space-between;
}

.fe-preview-checkbox-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.fe-preview-checkbox {
  width: 14px;
  height: 14px;
  border: 1px solid var(--fe-preview-input-border);
  border-radius: 2px;
  background: var(--fe-preview-input-bg);
  flex-shrink: 0;
}

.fe-preview-radio {
  width: 14px;
  height: 14px;
  border: 1px solid var(--fe-preview-input-border);
  border-radius: 50%;
  background: var(--fe-preview-input-bg);
  flex-shrink: 0;
}

.fe-preview-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
  font-size: 12px;
}

.fe-preview-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding: 0 16px;
  background: var(--fe-accent);
  color: #fff;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
}

.fe-preview-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  background: var(--fe-badge-bg);
  color: var(--fe-badge-fg);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.fe-preview-text {
  font-size: 12px;
  color: var(--fe-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 400px;
}

.fe-preview-separator {
  border: none;
  border-top: 1px solid var(--fe-border);
  margin: 4px 0;
}

.fe-preview-spacer {
  height: 24px;
}

.fe-preview-image {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--fe-section-fg);
  padding: 8px;
  border: 1px dashed var(--fe-border);
  border-radius: 3px;
}

.fe-preview-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--fe-fg);
}

/* ── Properties panel ───────────────────────────────────────────── */

.fe-props {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid var(--fe-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--fe-panel-bg);
}

.fe-props-header {
  padding: 12px 14px;
  border-bottom: 1px solid var(--fe-border);
  flex-shrink: 0;
}

.fe-props-header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.fe-props-header-icon {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}

.fe-props-header-type {
  font-size: 13px;
  font-weight: 600;
  color: var(--fe-fg);
}

.fe-props-header-hint {
  font-size: 11px;
  color: var(--fe-section-fg);
}

.fe-props-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.fe-prop-row {
  margin-bottom: 14px;
}

.fe-prop-label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--fe-label);
  margin-bottom: 5px;
}

.fe-prop-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 6px 8px;
  border: 1px solid var(--fe-input-border);
  border-radius: 4px;
  background: var(--fe-input-bg);
  color: var(--fe-fg);
  font-family: inherit;
  font-size: 13px;
  outline: none;
}

.fe-prop-input:focus {
  border-color: var(--fe-accent);
}

.fe-prop-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
}

.fe-prop-checkbox input[type="checkbox"] {
  width: 14px;
  height: 14px;
  cursor: pointer;
  accent-color: var(--fe-accent);
}

/* Options list (select/radio/checklist/taglist) */
.fe-options-list {
  margin-bottom: 6px;
}

.fe-option-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.fe-option-row .fe-prop-input {
  flex: 1;
}

.fe-options-add-row {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

/* Shared buttons */
.fe-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: var(--fe-btn-bg);
  color: var(--fe-btn-fg);
  border: none;
  border-radius: 3px;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
}

.fe-btn:hover {
  background: var(--fe-btn-hover);
}

.fe-btn-danger {
  color: var(--fe-danger);
}

.fe-btn-icon {
  width: 22px;
  height: 22px;
  padding: 3px;
  border-radius: 3px;
}
`.trim();

const STYLE_ID = "bpmn-sdk-form-editor-css";

export function injectFormEditorStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = FORM_EDITOR_CSS;
	document.head.appendChild(style);
}
