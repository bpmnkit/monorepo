export const ZOOM_CONTROLS_STYLE_ID = "bpmn-zoom-controls-styles-v1";

export const ZOOM_CONTROLS_CSS = `
.bpmn-controls {
  position: absolute;
  bottom: 12px;
  left: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bpmn-control-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
  font-size: 16px;
  font-family: system-ui, sans-serif;
  background: var(--bpmn-overlay-bg, rgba(248, 249, 250, 0.92));
  border: 1px solid var(--bpmn-overlay-border, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  color: var(--bpmn-text, #333333);
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.bpmn-control-btn:hover {
  background: var(--bpmn-highlight, #0066cc);
  color: #fff;
  border-color: transparent;
}
.bpmn-control-btn:focus {
  outline: 2px solid var(--bpmn-focus, #0066cc);
  outline-offset: 1px;
}
`;

export function injectZoomControlsStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(ZOOM_CONTROLS_STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = ZOOM_CONTROLS_STYLE_ID;
	style.textContent = ZOOM_CONTROLS_CSS;
	document.head.appendChild(style);
}
