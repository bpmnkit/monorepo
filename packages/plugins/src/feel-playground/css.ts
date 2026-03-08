export const FEEL_PLAYGROUND_STYLE_ID = "feel-playground-styles";

export const FEEL_PLAYGROUND_CSS = `
/* ── Light-theme defaults ─────────────────────────────────────────── */
.feel-playground {
  --fp-bg: #fafafa;
  --fp-header-bg: #f0f0f0;
  --fp-border: #e0e0e0;
  --fp-text: #333333;
  --fp-muted: #666666;
  --fp-input-bg: #ffffff;
  --fp-result-bg: #f5f5f5;
  --fp-error-bg: #fff2f2;
  --fp-error-text: #cc0000;
  --fp-active-btn-bg: #0062ff;
  --fp-active-btn-fg: #ffffff;
  --fp-inactive-btn-bg: #e8e8e8;
  --fp-inactive-btn-border: #d0d0d0;
  --fp-inactive-btn-fg: #444444;
  --fp-select-bg: #ffffff;
}

/* ── Dark-theme overrides ─────────────────────────────────────────── */
[data-theme="dark"] .feel-playground {
  --fp-bg: #1e1e1e;
  --fp-header-bg: #252526;
  --fp-border: #3c3c3c;
  --fp-text: #d4d4d4;
  --fp-muted: #888888;
  --fp-input-bg: #1e1e1e;
  --fp-result-bg: #252526;
  --fp-error-bg: #3c1e1e;
  --fp-error-text: #f44747;
  --fp-active-btn-bg: #0e639c;
  --fp-active-btn-fg: #ffffff;
  --fp-inactive-btn-bg: #3c3c3c;
  --fp-inactive-btn-border: #555555;
  --fp-inactive-btn-fg: #cccccc;
  --fp-select-bg: #3c3c3c;
}

.feel-playground {
  width: 100%;
  height: 100%;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-family: monospace;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
}

/* Overlay wrapper — used only by createFeelPlaygroundPlugin() */
.feel-playground-overlay {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 480px;
  max-height: 70%;
  z-index: 100;
  border-top-left-radius: 6px;
  border: 1px solid var(--fp-border, #e0e0e0);
  border-right: none;
  border-bottom: none;
  overflow: hidden;
  box-shadow: -4px -4px 20px rgba(0, 0, 0, 0.15);
}

[data-theme="dark"] .feel-playground-overlay {
  border-color: #3c3c3c;
  box-shadow: -4px -4px 20px rgba(0, 0, 0, 0.4);
}

.feel-playground__header {
  display: flex;
  align-items: center;
  padding: 6px 16px;
  background: var(--fp-header-bg);
  border-bottom: 1px solid var(--fp-border);
  gap: 8px;
  user-select: none;
  width: 100%;
  max-width: 800px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.feel-playground__title {
  font-weight: bold;
  color: var(--fp-text);
  font-size: 12px;
  flex: 1;
  font-family: system-ui, sans-serif;
}

.feel-playground__close {
  cursor: pointer;
  color: var(--fp-muted);
  background: none;
  border: none;
  font-size: 16px;
  padding: 0 4px;
  line-height: 1;
}

.feel-playground__close:hover { color: var(--fp-text); }

.feel-playground__mode {
  display: flex;
  gap: 4px;
}

.feel-playground__mode button {
  background: var(--fp-inactive-btn-bg);
  border: 1px solid var(--fp-inactive-btn-border);
  color: var(--fp-inactive-btn-fg);
  border-radius: 3px;
  padding: 2px 8px;
  font-size: 11px;
  cursor: pointer;
}

.feel-playground__mode button.active {
  background: var(--fp-active-btn-bg);
  color: var(--fp-active-btn-fg);
  border-color: var(--fp-active-btn-bg);
}

.feel-playground__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 16px;
  flex: 1;
  width: 100%;
  max-width: 800px;
  box-sizing: border-box;
}

.feel-playground__label {
  font-size: 11px;
  color: var(--fp-muted);
  margin-bottom: 2px;
  font-family: system-ui, sans-serif;
}

.feel-playground__input-wrap {
  position: relative;
  border: 1px solid var(--fp-border);
  border-radius: 3px;
  background: var(--fp-input-bg);
}

.feel-playground__input-wrap:focus-within {
  border-color: var(--fp-active-btn-bg);
}

.feel-playground__highlight {
  position: absolute;
  top: 0; left: 0;
  padding: 5px 8px;
  pointer-events: none;
  white-space: pre-wrap;
  word-break: break-word;
  color: transparent;
  z-index: 1;
  font: inherit;
  line-height: 1.5;
}

.feel-playground__textarea {
  position: relative;
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  border: none;
  color: var(--fp-text);
  padding: 5px 8px;
  font: inherit;
  line-height: 1.5;
  resize: vertical;
  min-height: 60px;
  outline: none;
  z-index: 2;
  caret-color: var(--fp-text);
}

.feel-playground__context {
  width: 100%;
  box-sizing: border-box;
  background: var(--fp-input-bg);
  border: 1px solid var(--fp-border);
  border-radius: 3px;
  color: var(--fp-text);
  padding: 5px 8px;
  font: inherit;
  resize: vertical;
  min-height: 50px;
  outline: none;
}

.feel-playground__context:focus {
  border-color: var(--fp-active-btn-bg);
}

.feel-playground__result {
  padding: 6px 8px;
  background: var(--fp-result-bg);
  border: 1px solid var(--fp-border);
  border-radius: 3px;
  min-height: 28px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: system-ui, sans-serif;
}

.feel-playground__result.null-val  { color: var(--fp-muted); font-style: italic; }

/* result type colors — light theme */
.feel-playground__result.bool-true  { color: #15803d; }
.feel-playground__result.bool-false { color: #b45309; }
.feel-playground__result.number     { color: #0369a1; }
.feel-playground__result.string     { color: #9f1239; }

/* result type colors — dark theme */
[data-theme="dark"] .feel-playground__result.bool-true  { color: #4ec9b0; }
[data-theme="dark"] .feel-playground__result.bool-false { color: #ce9178; }
[data-theme="dark"] .feel-playground__result.number     { color: #b5cea8; }
[data-theme="dark"] .feel-playground__result.string     { color: #ce9178; }

.feel-playground__errors {
  font-size: 11px;
  color: var(--fp-error-text);
  padding: 4px 6px;
  background: var(--fp-error-bg);
  border-radius: 3px;
  font-family: system-ui, sans-serif;
}

.feel-playground__examples {
  display: flex;
  align-items: center;
  gap: 6px;
}

.feel-playground__examples select {
  flex: 1;
  background: var(--fp-select-bg);
  border: 1px solid var(--fp-border);
  color: var(--fp-text);
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 12px;
  font-family: system-ui, sans-serif;
}

/* ── FEEL syntax highlighting — light theme ───────────────────────── */
.feel-keyword         { color: #0000cc; }
.feel-operator        { color: #555555; }
.feel-literal-number  { color: #09885a; }
.feel-literal-string  { color: #a31515; }
.feel-literal-temporal{ color: #0070c1; }
.feel-literal-bool    { color: #0000cc; }
.feel-literal-null    { color: #0000cc; }
.feel-builtin         { color: #795e26; }
.feel-variable        { color: #001080; }
.feel-comment         { color: #008000; font-style: italic; }
.feel-punctuation     { color: #555555; }

/* ── FEEL syntax highlighting — dark theme ────────────────────────── */
[data-theme="dark"] .feel-keyword          { color: #569cd6; }
[data-theme="dark"] .feel-operator         { color: #d4d4d4; }
[data-theme="dark"] .feel-literal-number   { color: #b5cea8; }
[data-theme="dark"] .feel-literal-string   { color: #ce9178; }
[data-theme="dark"] .feel-literal-temporal { color: #4ec9b0; }
[data-theme="dark"] .feel-literal-bool     { color: #569cd6; }
[data-theme="dark"] .feel-literal-null     { color: #569cd6; }
[data-theme="dark"] .feel-builtin          { color: #dcdcaa; }
[data-theme="dark"] .feel-variable         { color: #9cdcfe; }
[data-theme="dark"] .feel-comment          { color: #6a9955; font-style: italic; }
[data-theme="dark"] .feel-punctuation      { color: #d4d4d4; }
`;

export function injectPlaygroundStyles(): void {
	if (document.getElementById(FEEL_PLAYGROUND_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = FEEL_PLAYGROUND_STYLE_ID;
	style.textContent = FEEL_PLAYGROUND_CSS;
	document.head.appendChild(style);
}
