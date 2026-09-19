/**
 * Form viewer styles, on the bpmnkit.com design system.
 *
 * The `--fv-*` layer used to restate a palette of its own — a Catppuccin-ish
 * dark and a Tailwind-ish light, both hardcoded — beside a system font stack.
 * It now derives from the `--bpmnkit-ds-*` set `@bpmnkit/ui` owns, so a form
 * preview matches the editor chrome it is docked inside and the user-task
 * widget that embeds it.
 *
 * The viewer sets `light` / `dark` on its own root rather than reading an
 * ancestor's `data-theme`, so the dark variant redeclares the ground here.
 */
export const FORM_VIEWER_CSS = `
.form-viewer {
  font-family: var(--bpmnkit-ds-font-sans, system-ui, sans-serif);
  font-size: 14px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--fv-bg, #ffffff);
  color: var(--fv-fg, #14161a);
}

.form-viewer-body {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px;
}

.form-viewer.light {
  --fv-bg: var(--bpmnkit-ds-surface, #ffffff);
  --fv-fg: var(--bpmnkit-ds-ink, #14161a);
  --fv-border: var(--bpmnkit-ds-line, #d8dbe0);
  --fv-input-bg: var(--bpmnkit-ds-bg, #f4f5f7);
  --fv-label: var(--bpmnkit-ds-ink-4, #8b929c);
  --fv-placeholder: var(--bpmnkit-ds-ink-4, #8b929c);
  --fv-badge-bg: var(--bpmnkit-ds-bg-alt, #eef0f3);
  --fv-badge-fg: var(--bpmnkit-ds-ink-3, #5c6470);
  --fv-accent: var(--bpmnkit-ds-accent, #a8503a);
  --fv-tag-bg: var(--bpmnkit-ds-accent-tint, #fdf3ef);
  --fv-tag-fg: var(--bpmnkit-ds-accent, #a8503a);
  --fv-group-bg: var(--bpmnkit-ds-bg, #f4f5f7);
  --fv-group-border: var(--bpmnkit-ds-line-soft, #e4e6ea);
  --fv-separator: var(--bpmnkit-ds-line-soft, #e4e6ea);
  --fv-btn-bg: var(--bpmnkit-ds-accent, #a8503a);
  --fv-btn-fg: #ffffff;
}

.form-viewer.dark {
  --fv-bg: #16181d;
  --fv-fg: #f4f5f7;
  --fv-border: #2c3038;
  --fv-input-bg: #0f1114;
  --fv-label: #8b929c;
  --fv-placeholder: #8b929c;
  --fv-badge-bg: #22252b;
  --fv-badge-fg: #a6acb5;
  --fv-accent: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --fv-tag-bg: rgba(201, 117, 92, 0.14);
  --fv-tag-fg: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --fv-group-bg: #0f1114;
  --fv-group-border: #22252b;
  --fv-separator: #22252b;
  --fv-btn-bg: var(--bpmnkit-ds-accent-on-dark, #c9755c);
  --fv-btn-fg: #14161a;
}

/* Grid rows */
.fv-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 12px;
}

/* Component wrapper — grows to fill available space */
.fv-field {
  flex: 1 1 200px;
  min-width: 0;
}

/* Labels */
.fv-label {
  display: block;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 400;
  color: var(--fv-label);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* Input preview shell */
.fv-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--fv-border);
  background: var(--fv-input-bg);
  color: var(--fv-placeholder);
  font-size: 13px;
  font-style: italic;
  pointer-events: none;
}

.fv-textarea {
  min-height: 72px;
  resize: none;
}

/* Checkbox / radio row */
.fv-option-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 13px;
}

.fv-option-dot {
  width: 14px;
  height: 14px;
  border: 2px solid var(--fv-border);
  border-radius: 50%;
  flex-shrink: 0;
}

.fv-option-square {
  width: 14px;
  height: 14px;
  border: 2px solid var(--fv-border);
  flex-shrink: 0;
}

/* Tag chips */
.fv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0;
}

.fv-tag {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  background: var(--fv-tag-bg);
  color: var(--fv-tag-fg);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 10.5px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* Table preview */
.fv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.fv-table th,
.fv-table td {
  border: 1px solid var(--fv-border);
  padding: 5px 8px;
  text-align: left;
}

.fv-table th {
  background: var(--fv-input-bg);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Group container */
.fv-group {
  border: 1px solid var(--fv-group-border);
  padding: 12px;
  background: var(--fv-group-bg);
}

.fv-group-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}

/* Separator */
.fv-separator {
  border: none;
  border-top: 1px solid var(--fv-separator);
  margin: 8px 0;
}

/* Spacer */
.fv-spacer {
  display: block;
}

/* iFrame placeholder */
.fv-iframe {
  width: 100%;
  border: 1px dashed var(--fv-border);
  padding: 16px;
  text-align: center;
  color: var(--fv-placeholder);
  font-size: 12px;
  box-sizing: border-box;
}

/* Image placeholder */
.fv-image {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60px;
  border: 1px dashed var(--fv-border);
  color: var(--fv-placeholder);
  font-size: 12px;
}

/* Document preview placeholder */
.fv-document-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80px;
  border: 1px dashed var(--fv-border);
  color: var(--fv-placeholder);
  font-size: 12px;
}

/* Expression / filepicker */
.fv-expression {
  padding: 6px 10px;
  border: 1px solid var(--fv-border);
  background: var(--fv-input-bg);
  color: var(--fv-placeholder);
  font-family: "Fira Code", "Cascadia Code", monospace;
  font-size: 12px;
  font-style: italic;
}

/* Button */
.fv-btn {
  display: inline-flex;
  align-items: center;
  padding: 7px 16px;
  background: var(--fv-btn-bg);
  color: var(--fv-btn-fg);
  font-size: 13px;
  font-weight: 600;
  border: none;
  pointer-events: none;
  cursor: default;
}

/* HTML rich text */
.fv-html {
  font-size: 13px;
  line-height: 1.5;
}

/* Text/markdown */
.fv-text {
  line-height: 1.5;
}

.fv-text h1, .fv-text h2, .fv-text h3 {
  margin: 0 0 8px;
}

/* Dynamic list */
.fv-dynamic-list {
  border: 1px solid var(--fv-group-border);
  padding: 12px;
  background: var(--fv-group-bg);
}

.fv-dynamic-list-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}

/* Datetime */
.fv-datetime-inputs {
  display: flex;
  gap: 8px;
}

.fv-datetime-inputs .fv-input {
  flex: 1;
}
`.trim()

const STYLE_ID = "bpmn-sdk-form-viewer-css"

export function injectFormViewerStyles(): void {
	if (document.getElementById(STYLE_ID)) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = FORM_VIEWER_CSS
	document.head.appendChild(style)
}
