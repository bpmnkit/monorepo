import { injectChromeStyles } from "@bpmnkit/editor"

export const COMMAND_PALETTE_STYLE_ID = "bpmnkit-command-palette-styles-v1"

/* Flat, square, hairline-ruled. Grounds come from the shared chrome tokens, so
   this sheet is one set of rules rather than a dark one plus light and neon
   copies — the overlay carries the chrome attribute when the canvas is light. */
export const COMMAND_PALETTE_CSS = `
/* ── Overlay backdrop ─────────────────────────────────────────────────────── */
.bpmnkit-palette-overlay {
  position: fixed;
  inset: 0;
  background: var(--bpmnkit-chrome-scrim);
  z-index: 9999;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  font-family: var(--bpmnkit-chrome-font);
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.bpmnkit-palette-panel {
  width: min(560px, calc(100vw - 32px));
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* ── Search row ───────────────────────────────────────────────────────────── */
.bpmnkit-palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 16px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.bpmnkit-palette-search-icon {
  display: flex;
  align-items: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--bpmnkit-chrome-ink-4);
  pointer-events: none;
}
.bpmnkit-palette-search-icon svg { width: 16px; height: 16px; }
.bpmnkit-palette-input {
  flex: 1;
  height: 48px;
  background: transparent;
  border: none;
  outline: none;
  color: var(--bpmnkit-chrome-ink);
  font-family: inherit;
  font-size: var(--bpmnkit-ds-t-ui, 14px);
  caret-color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-palette-input::placeholder { color: var(--bpmnkit-chrome-ink-4); }

/* ── Keyboard hint ────────────────────────────────────────────────────────── */
.bpmnkit-palette-kbd {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.bpmnkit-palette-kbd kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  background: transparent;
  border: 1px solid var(--bpmnkit-chrome-line);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
  line-height: 1.4;
}

/* ── Commands list ────────────────────────────────────────────────────────── */
.bpmnkit-palette-list {
  max-height: 360px;
  overflow-y: auto;
}
.bpmnkit-palette-empty {
  padding: 20px 16px;
  text-align: center;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px);
  letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px 10px 14px;
  border-left: 2px solid transparent;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  cursor: pointer;
  color: var(--bpmnkit-chrome-ink-2);
  font-size: var(--bpmnkit-ds-t-ui, 14px);
  user-select: none;
}
.bpmnkit-palette-item:last-child { border-bottom: none; }
.bpmnkit-palette-item:hover,
.bpmnkit-palette-item.bpmnkit-palette-focused {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
/* The focused row is the one the accent marks — a rule, not a shadow. */
.bpmnkit-palette-item.bpmnkit-palette-focused {
  border-left-color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-palette-item-title { flex: 1; }
.bpmnkit-palette-item-desc {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4);
}

/* ── Section labels ───────────────────────────────────────────────────────── */
.bpmnkit-palette-section {
  padding: 12px 16px 6px;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  user-select: none;
}

/* ── Item leading icon (doc / ai) ─────────────────────────────────────────── */
.bpmnkit-palette-item-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-palette-item-icon svg { width: 14px; height: 14px; }

/* ── Doc and AI items — the accent is the only thing that marks them ─────── */
.bpmnkit-palette-item--doc .bpmnkit-palette-item-title,
.bpmnkit-palette-item--ai .bpmnkit-palette-item-title {
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-palette-item--ai .bpmnkit-palette-item-icon {
  color: var(--bpmnkit-chrome-accent);
}

/* ── Disabled items ───────────────────────────────────────────────────────── */
.bpmnkit-palette-item--disabled {
  opacity: 0.45;
  cursor: default;
}
.bpmnkit-palette-item--disabled:hover,
.bpmnkit-palette-item--disabled.bpmnkit-palette-focused {
  background: transparent;
  border-left-color: transparent;
}

/* ── Zen mode: hide internal canvas controls ──────────────────────────────── */
.bpmnkit-zen-mode .bpmnkit-zoom-controls,
.bpmnkit-zen-mode .bpmnkit-main-menu-panel {
  display: none !important;
}
`

export function injectCommandPaletteStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(COMMAND_PALETTE_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = COMMAND_PALETTE_STYLE_ID
	style.textContent = COMMAND_PALETTE_CSS
	document.head.appendChild(style)
}
