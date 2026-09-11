import { injectChromeStyles } from "@bpmnkit/editor"

export const MAIN_MENU_STYLE_ID = "bpmnkit-main-menu-styles-v2"

/* Flat, square, hairline-ruled. The bar sits inside the tab row, so it carries
   no ground of its own — a left hairline is the whole separation, which is what
   removes the three per-theme copies this sheet used to need. */
export const MAIN_MENU_CSS = `
.bpmnkit-main-menu-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--bpmnkit-chrome-line);
  z-index: 10000;
}
.bpmnkit-canvas-host:has(.bpmnkit-main-menu-panel:not([style*="none"])) .bpmnkit-tabs {
  padding-right: 160px;
}
.bpmnkit-main-menu-title {
  padding: 0 12px;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  white-space: nowrap;
  user-select: none;
}
.bpmnkit-main-menu-sep {
  width: 1px;
  align-self: stretch;
  background: var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.bpmnkit-menu-btn {
  width: 34px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--bpmnkit-chrome-line-soft);
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  font-variant-emoji: text;
}
.bpmnkit-menu-btn:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-menu-btn svg {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.bpmnkit-menu-dropdown {
  position: fixed;
  display: none;
  flex-direction: column;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  z-index: 10001;
  min-width: 240px;
  overflow: hidden;
  font-family: var(--bpmnkit-chrome-font);
}
.bpmnkit-menu-dropdown.open { display: flex; }
.bpmnkit-menu-level {
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
}
@keyframes bpmnkit-menu-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes bpmnkit-menu-in-left {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes bpmnkit-menu-out-left {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-20px); }
}
@keyframes bpmnkit-menu-out-right {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(20px); }
}
.bpmnkit-menu-level--in-right  { animation: bpmnkit-menu-in-right  180ms ease-out forwards; }
.bpmnkit-menu-level--in-left   { animation: bpmnkit-menu-in-left   180ms ease-out forwards; }
.bpmnkit-menu-level--out-left  { animation: bpmnkit-menu-out-left  150ms ease-in  forwards; }
.bpmnkit-menu-level--out-right { animation: bpmnkit-menu-out-right 150ms ease-in  forwards; }
.bpmnkit-menu-drop-label {
  padding: 12px 12px 6px;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  font-family: inherit;
  font-size: 12.5px;
  text-align: left;
  width: 100%;
}
.bpmnkit-menu-item:last-child { border-bottom: none; }
.bpmnkit-menu-item:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-menu-item-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-menu-item-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-menu-item-label {
  flex: 1;
}
.bpmnkit-menu-item-arrow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-menu-item-icon svg,
.bpmnkit-menu-item-check svg,
.bpmnkit-menu-item-arrow svg {
  width: 100%;
  height: 100%;
}
.bpmnkit-menu-back-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  height: 34px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-menu-back-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.bpmnkit-menu-back-btn:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-menu-back-btn svg {
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.bpmnkit-menu-level-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  flex: 1;
}
.bpmnkit-menu-info-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-menu-info-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-menu-info-action {
  flex-shrink: 0;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-2);
  cursor: pointer;
  padding: 3px 9px;
  font-size: 11px;
  font-family: var(--bpmnkit-chrome-mono);
}
.bpmnkit-menu-info-action:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-menu-drop-sep {
  height: 1px;
  background: var(--bpmnkit-chrome-line);
}
`

export function injectMainMenuStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(MAIN_MENU_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MAIN_MENU_STYLE_ID
	style.textContent = MAIN_MENU_CSS
	document.head.appendChild(style)
}
