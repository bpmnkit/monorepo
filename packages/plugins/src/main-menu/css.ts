export const MAIN_MENU_STYLE_ID = "bpmn-main-menu-styles-v2";

export const MAIN_MENU_CSS = `
.bpmn-main-menu-panel {
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
[data-theme="dark"] .bpmn-main-menu-panel {
  background: #181825;
  border-left-color: #313244;
}
.bpmn-canvas-host:has(.bpmn-main-menu-panel:not([style*="none"])) .bpmn-tabs {
  padding-right: 160px;
}
.bpmn-main-menu-title {
  padding: 0 6px;
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: var(--bpmn-text, #333333);
  white-space: nowrap;
  user-select: none;
  opacity: 0.75;
}
.bpmn-main-menu-sep {
  width: 1px;
  height: 16px;
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  flex-shrink: 0;
}
.bpmn-menu-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.1s;
}
.bpmn-menu-btn:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.08));
}
.bpmn-menu-btn svg {
  width: 16px;
  height: 16px;
  pointer-events: none;
}
.bpmn-menu-dropdown {
  position: fixed;
  display: none;
  flex-direction: column;
  background: var(--bpmn-overlay-bg, rgba(248, 249, 250, 0.96));
  border: 1px solid var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 10001;
  min-width: 220px;
  overflow: hidden;
}
.bpmn-menu-dropdown.open { display: flex; }
.bpmn-menu-level {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 4px;
  position: relative;
  z-index: 1;
}
@keyframes bpmn-menu-in-right {
  from { opacity: 0; transform: translateX(20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes bpmn-menu-in-left {
  from { opacity: 0; transform: translateX(-20px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes bpmn-menu-out-left {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-20px); }
}
@keyframes bpmn-menu-out-right {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(20px); }
}
.bpmn-menu-level--in-right  { animation: bpmn-menu-in-right  180ms ease-out forwards; }
.bpmn-menu-level--in-left   { animation: bpmn-menu-in-left   180ms ease-out forwards; }
.bpmn-menu-level--out-left  { animation: bpmn-menu-out-left  150ms ease-in  forwards; }
.bpmn-menu-level--out-right { animation: bpmn-menu-out-right 150ms ease-in  forwards; }
.bpmn-menu-drop-label {
  padding: 3px 8px 1px;
  font-size: 10px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--bpmn-text, #333333);
  opacity: 0.45;
}
.bpmn-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: transparent;
  border: none;
  border-radius: 5px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  text-align: left;
  width: 100%;
  transition: background 0.1s;
}
.bpmn-menu-item:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmn-menu-item-check {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  color: var(--bpmn-highlight, #0066cc);
}
.bpmn-menu-item-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.65;
}
.bpmn-menu-item-label {
  flex: 1;
}
.bpmn-menu-item-arrow {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  opacity: 0.45;
}
.bpmn-menu-item-icon svg,
.bpmn-menu-item-check svg,
.bpmn-menu-item-arrow svg {
  width: 100%;
  height: 100%;
}
.bpmn-menu-back-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
}
.bpmn-menu-back-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  transition: background 0.1s;
}
.bpmn-menu-back-btn:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmn-menu-back-btn svg {
  width: 12px;
  height: 12px;
  pointer-events: none;
}
.bpmn-menu-level-title {
  font-size: 12px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  color: var(--bpmn-text, #333333);
  flex: 1;
}
.bpmn-menu-info-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  font-family: system-ui, sans-serif;
  font-size: 12px;
  color: var(--bpmn-text, #333333);
  opacity: 0.75;
}
.bpmn-menu-info-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmn-menu-info-action {
  flex-shrink: 0;
  border: 1px solid var(--bpmn-overlay-border, rgba(0, 0, 0, 0.18));
  border-radius: 4px;
  background: transparent;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  padding: 2px 7px;
  font-size: 11px;
  font-family: system-ui, sans-serif;
  transition: background 0.1s;
}
.bpmn-menu-info-action:hover {
  background: var(--bpmn-overlay-border, rgba(0, 0, 0, 0.06));
}
.bpmn-menu-drop-sep {
  height: 1px;
  background: var(--bpmn-overlay-border, rgba(0,0,0,0.1));
  margin: 3px 4px;
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-dropdown {
  background: rgba(30, 30, 46, 0.96);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-item,
[data-bpmn-hud-theme="dark"] .bpmn-menu-back-btn,
[data-bpmn-hud-theme="dark"] .bpmn-menu-level-title,
[data-bpmn-hud-theme="dark"] .bpmn-menu-info-row,
[data-bpmn-hud-theme="dark"] .bpmn-menu-info-action,
[data-bpmn-hud-theme="dark"] .bpmn-menu-drop-label {
  color: rgba(205, 214, 244, 0.9);
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-item:hover,
[data-bpmn-hud-theme="dark"] .bpmn-menu-back-btn:hover,
[data-bpmn-hud-theme="dark"] .bpmn-menu-info-action:hover {
  background: rgba(255, 255, 255, 0.08);
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-info-action {
  border-color: rgba(255, 255, 255, 0.15);
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-drop-sep {
  background: rgba(255, 255, 255, 0.1);
}
[data-bpmn-hud-theme="dark"] .bpmn-menu-item-check {
  color: #89b4fa;
}
`;

export function injectMainMenuStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(MAIN_MENU_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = MAIN_MENU_STYLE_ID;
	style.textContent = MAIN_MENU_CSS;
	document.head.appendChild(style);
}
