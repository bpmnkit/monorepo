export const MAIN_MENU_STYLE_ID = "bpmnkit-main-menu-styles-v2"

export const MAIN_MENU_CSS = `
.bpmnkit-main-menu-panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 0 6px;
  background: #f0f4f8;
  border: none;
  border-left: 1px solid #d0d0d0;
  border-radius: 0;
  box-shadow: none;
  z-index: 10000;
}
[data-theme="dark"] .bpmnkit-main-menu-panel {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border-left-color: #313244;
}
[data-theme="neon"] .bpmnkit-main-menu-panel {
  background: oklch(7% 0.035 280);
  border-left-color: oklch(65% 0.28 280 / 0.2);
}
.bpmnkit-canvas-host:has(.bpmnkit-main-menu-panel:not([style*="none"])) .bpmnkit-tabs {
  padding-right: 160px;
}
.bpmnkit-main-menu-title {
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: var(--bpmnkit-text, #333333);
  white-space: nowrap;
  user-select: none;
  opacity: 0.75;
}
.bpmnkit-main-menu-sep {
  width: 1px;
  height: 16px;
  background: var(--bpmnkit-overlay-border, var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08)));
  flex-shrink: 0;
}
.bpmnkit-menu-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--bpmnkit-text, #333333);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.1s;
}
.bpmnkit-menu-btn:hover {
  background: var(--bpmnkit-overlay-border, var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08)));
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
  background: var(--bpmnkit-overlay-bg, rgba(248, 249, 250, 0.96));
  border: 1px solid var(--bpmnkit-overlay-border, var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08)));
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10001;
  min-width: 220px;
  overflow: hidden;
}
.bpmnkit-menu-dropdown.open { display: flex; }
.bpmnkit-menu-level {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
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
  padding: 3px 8px 1px;
  font-size: 10px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bpmnkit-text, #333333);
  opacity: 0.45;
}
.bpmnkit-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--bpmnkit-text, #333333);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  text-align: left;
  width: 100%;
  transition: background 0.1s;
}
.bpmnkit-menu-item:hover {
  background: var(--bpmnkit-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmnkit-menu-item-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--bpmnkit-highlight, var(--bpmnkit-accent, #1a56db));
}
.bpmnkit-menu-item-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.65;
}
.bpmnkit-menu-item-label {
  flex: 1;
}
.bpmnkit-menu-item-arrow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.45;
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
  gap: 4px;
  padding: 2px 4px;
}
.bpmnkit-menu-back-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--bpmnkit-text, #333333);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.1s;
}
.bpmnkit-menu-back-btn:hover {
  background: var(--bpmnkit-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmnkit-menu-back-btn svg {
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.bpmnkit-menu-level-title {
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: var(--bpmnkit-text, #333333);
  flex: 1;
}
.bpmnkit-menu-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  color: var(--bpmnkit-text, #333333);
  opacity: 0.75;
}
.bpmnkit-menu-info-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-menu-info-action {
  flex-shrink: 0;
  border: 1px solid var(--bpmnkit-overlay-border, var(--bpmnkit-panel-border, rgba(0, 0, 0, 0.08)));
  border-radius: 4px;
  background: transparent;
  color: var(--bpmnkit-text, #333333);
  cursor: pointer;
  padding: 2px 7px;
  font-size: 11px;
  font-family: system-ui, sans-serif;
  transition: background 0.1s;
}
.bpmnkit-menu-info-action:hover {
  background: var(--bpmnkit-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmnkit-menu-drop-sep {
  height: 1px;
  background: var(--bpmnkit-overlay-border, rgba(0,0,0,0.1));
  margin: 3px 4px;
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-dropdown {
  background: var(--bpmnkit-panel-bg, rgba(13,13,22,0.92));
  border-color: var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08));
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-item,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-back-btn,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-level-title,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-info-row,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-info-action,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-drop-label {
  color: rgba(205, 214, 244, 0.9);
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-item:hover,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-back-btn:hover,
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-info-action:hover {
  background: rgba(255, 255, 255, 0.08);
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-info-action {
  border-color: rgba(255, 255, 255, 0.15);
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-drop-sep {
  background: var(--bpmnkit-panel-border, rgba(255, 255, 255, 0.08));
}
[data-bpmnkit-hud-theme="dark"] .bpmnkit-menu-item-check {
  color: var(--bpmnkit-accent-bright, #89b4fa);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-dropdown {
  background: oklch(8% 0.03 270 / 0.96);
  border-color: oklch(65% 0.28 280 / 0.2);
  box-shadow: 0 4px 20px oklch(0% 0 0 / 0.6), 0 0 0 1px oklch(65% 0.28 280 / 0.1);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-item,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-back-btn,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-level-title,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-info-row,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-info-action,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-drop-label {
  color: oklch(73% 0.16 280);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-item:hover,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-back-btn:hover,
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-info-action:hover {
  background: oklch(65% 0.28 280 / 0.1);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-info-action {
  border-color: oklch(65% 0.28 280 / 0.2);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-drop-sep {
  background: oklch(65% 0.28 280 / 0.15);
}
[data-bpmnkit-hud-theme="neon"] .bpmnkit-menu-item-check {
  color: oklch(72% 0.18 185);
}
`

export function injectMainMenuStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(MAIN_MENU_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MAIN_MENU_STYLE_ID
	style.textContent = MAIN_MENU_CSS
	document.head.appendChild(style)
}
