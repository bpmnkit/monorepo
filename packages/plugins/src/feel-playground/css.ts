import { injectChromeStyles } from "@bpmnkit/editor"

export const FEEL_PLAYGROUND_STYLE_ID = "feel-playground-styles"

export const FEEL_PLAYGROUND_CSS = `
/* ── Chrome ───────────────────────────────────────────────────────────
   The panel's own variables now resolve from the shared chrome tokens, so
   the light and dark copies below collapsed into this one block. The
   .feel-* syntax classes further down keep their own palette: syntax
   highlighting is exempt from the one-accent rule. */
.feel-playground {
  --fp-bg: var(--bpmnkit-chrome-ground);
  --fp-header-bg: var(--bpmnkit-chrome-ground-2);
  --fp-border: var(--bpmnkit-chrome-line);
  --fp-text: var(--bpmnkit-chrome-ink);
  --fp-muted: var(--bpmnkit-chrome-ink-4);
  --fp-input-bg: var(--bpmnkit-chrome-ground);
  --fp-result-bg: var(--bpmnkit-chrome-ground-2);
  --fp-error-bg: transparent;
  --fp-error-text: var(--bpmnkit-danger, #dc2626);
  --fp-active-btn-bg: var(--bpmnkit-chrome-accent);
  --fp-active-btn-fg: var(--bpmnkit-chrome-accent-fg);
  --fp-inactive-btn-bg: transparent;
  --fp-inactive-btn-border: var(--bpmnkit-chrome-line);
  --fp-inactive-btn-fg: var(--bpmnkit-chrome-ink-2);
  --fp-select-bg: var(--bpmnkit-chrome-ground);
}

.feel-playground {
  width: 100%;
  height: 100%;
  background: var(--fp-bg);
  color: var(--fp-text);
  font-family: var(--bpmnkit-chrome-mono);
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
  font-family: var(--bpmnkit-chrome-font);
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
  font-family: var(--bpmnkit-chrome-font);
}

.feel-playground__input-wrap {
  position: relative;
  border: 1px solid var(--fp-border);
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
  min-height: 28px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--bpmnkit-chrome-font);
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
  font-family: var(--bpmnkit-chrome-font);
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
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
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
`

export function injectPlaygroundStyles(): void {
	injectChromeStyles()
	if (document.getElementById(FEEL_PLAYGROUND_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = FEEL_PLAYGROUND_STYLE_ID
	style.textContent = FEEL_PLAYGROUND_CSS
	document.head.appendChild(style)
}
