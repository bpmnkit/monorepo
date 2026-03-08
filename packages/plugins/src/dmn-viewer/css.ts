export const DMN_VIEWER_CSS = `
.dmn-viewer {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  overflow: auto;
  height: 100%;
  box-sizing: border-box;
  background: var(--dmn-bg, #1e1e2e);
  color: var(--dmn-fg, #cdd6f4);
}

.dmn-viewer-body {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.dmn-viewer.light {
  --dmn-bg: #ffffff;
  --dmn-fg: #1c1c1c;
  --dmn-border: #d0d0d0;
  --dmn-header-bg: #f0f4f8;
  --dmn-input-bg: #e8f0fe;
  --dmn-output-bg: #e8f5e9;
  --dmn-row-hover: #f5f5f5;
  --dmn-row-even: #fafafa;
  --dmn-badge-bg: #e2e8f0;
  --dmn-badge-fg: #334155;
  --feel-keyword: #7c3aed;
  --feel-string: #15803d;
  --feel-number: #b45309;
  --feel-operator: #0369a1;
  --feel-range: #be123c;
  --feel-empty: #9ca3af;
}

.dmn-viewer.dark {
  --dmn-bg: #1e1e2e;
  --dmn-fg: #cdd6f4;
  --dmn-border: #313244;
  --dmn-header-bg: #181825;
  --dmn-input-bg: #1e1e3a;
  --dmn-output-bg: #1a2e1a;
  --dmn-row-hover: #2a2a3e;
  --dmn-row-even: #252535;
  --dmn-badge-bg: #313244;
  --dmn-badge-fg: #bac2de;
  --feel-keyword: #cba6f7;
  --feel-string: #a6e3a1;
  --feel-number: #fab387;
  --feel-operator: #89dceb;
  --feel-range: #f38ba8;
  --feel-empty: #6c7086;
}

.dmn-decision-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.dmn-decision-name {
  font-size: 15px;
  font-weight: 600;
}

.dmn-hit-policy {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--dmn-badge-bg);
  color: var(--dmn-badge-fg);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.dmn-table {
  border-collapse: collapse;
  width: 100%;
  min-width: 400px;
}

.dmn-table th,
.dmn-table td {
  border: 1px solid var(--dmn-border);
  padding: 6px 10px;
  text-align: left;
  vertical-align: top;
  white-space: pre-wrap;
  word-break: break-word;
}

.dmn-table thead th {
  background: var(--dmn-header-bg);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.dmn-th-input {
  background: var(--dmn-input-bg) !important;
}

.dmn-th-output {
  background: var(--dmn-output-bg) !important;
}

.dmn-table tr:nth-child(even) td {
  background: var(--dmn-row-even);
}

.dmn-table tr:hover td {
  background: var(--dmn-row-hover);
}

.dmn-row-num {
  color: var(--dmn-badge-fg);
  font-size: 11px;
  min-width: 24px;
  text-align: center !important;
  user-select: none;
}

/* FEEL syntax highlighting */
.feel-keyword { color: var(--feel-keyword); font-weight: 600; }
.feel-string  { color: var(--feel-string); }
.feel-number  { color: var(--feel-number); }
.feel-operator { color: var(--feel-operator); }
.feel-range   { color: var(--feel-range); font-weight: 600; }
.feel-empty   { color: var(--feel-empty); font-style: italic; }

.dmn-empty {
  text-align: center;
  padding: 32px;
  color: var(--feel-empty);
}
`.trim();

const STYLE_ID = "bpmn-sdk-dmn-viewer-css";

export function injectDmnViewerStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = DMN_VIEWER_CSS;
	document.head.appendChild(style);
}
