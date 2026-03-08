export const FORM_VIEWER_CSS = `
.form-viewer {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 14px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--fv-bg, #1e1e2e);
  color: var(--fv-fg, #cdd6f4);
}

.form-viewer-body {
  max-width: 680px;
  margin: 0 auto;
  padding: 24px;
}

.form-viewer.light {
  --fv-bg: #ffffff;
  --fv-fg: #1c1c1c;
  --fv-border: #d0d0d0;
  --fv-input-bg: #f8f9fa;
  --fv-label: #4b5563;
  --fv-placeholder: #9ca3af;
  --fv-badge-bg: #e2e8f0;
  --fv-badge-fg: #334155;
  --fv-accent: #3b82f6;
  --fv-tag-bg: #dbeafe;
  --fv-tag-fg: #1e40af;
  --fv-group-bg: #f9fafb;
  --fv-group-border: #e5e7eb;
  --fv-separator: #e5e7eb;
  --fv-btn-bg: #3b82f6;
  --fv-btn-fg: #ffffff;
}

.form-viewer.dark {
  --fv-bg: #1e1e2e;
  --fv-fg: #cdd6f4;
  --fv-border: #313244;
  --fv-input-bg: #181825;
  --fv-label: #bac2de;
  --fv-placeholder: #6c7086;
  --fv-badge-bg: #313244;
  --fv-badge-fg: #bac2de;
  --fv-accent: #89b4fa;
  --fv-tag-bg: #1e1e3a;
  --fv-tag-fg: #89b4fa;
  --fv-group-bg: #181825;
  --fv-group-border: #313244;
  --fv-separator: #313244;
  --fv-btn-bg: #89b4fa;
  --fv-btn-fg: #1e1e2e;
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
  font-size: 12px;
  font-weight: 600;
  color: var(--fv-label);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Input preview shell */
.fv-input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--fv-border);
  border-radius: 4px;
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
  border-radius: 2px;
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
  padding: 2px 8px;
  border-radius: 12px;
  background: var(--fv-tag-bg);
  color: var(--fv-tag-fg);
  font-size: 12px;
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
  border-radius: 6px;
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
  border-radius: 4px;
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
  border-radius: 4px;
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
  border-radius: 4px;
  color: var(--fv-placeholder);
  font-size: 12px;
}

/* Expression / filepicker */
.fv-expression {
  padding: 6px 10px;
  border: 1px solid var(--fv-border);
  border-radius: 4px;
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
  border-radius: 4px;
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
  border-radius: 6px;
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
`.trim();

const STYLE_ID = "bpmn-sdk-form-viewer-css";

export function injectFormViewerStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = FORM_VIEWER_CSS;
	document.head.appendChild(style);
}
