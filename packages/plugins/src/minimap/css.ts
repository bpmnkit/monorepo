import { injectChromeStyles } from "@bpmnkit/editor"

/** ID used to prevent duplicate style injection. */
export const MINIMAP_STYLE_ID = "bpmnkit-minimap-styles-v1"

/** CSS for the minimap plugin, injected once into `<head>`. */
export const MINIMAP_CSS = `
.bpmnkit-minimap {
  position: absolute;
  bottom: 12px;
  right: 12px;
  width: 160px;
  height: 100px;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  overflow: hidden;
  cursor: crosshair;
}
.bpmnkit-minimap > svg {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.bpmnkit-minimap-shape {
  fill: var(--bpmnkit-shape-stroke, var(--bpmnkit-ds-diagram-ink, #22242a));
  opacity: 0.45;
}
.bpmnkit-minimap-edge {
  stroke: var(--bpmnkit-shape-stroke, var(--bpmnkit-ds-diagram-ink, #22242a));
  stroke-width: 0.5;
  fill: none;
  opacity: 0.35;
}
.bpmnkit-minimap-viewport {
  fill: var(--bpmnkit-viewport-fill, var(--bpmnkit-chrome-accent-subtle));
  stroke: var(--bpmnkit-viewport-stroke, var(--bpmnkit-chrome-accent));
  stroke-width: 1;
}
`

/**
 * Injects the minimap stylesheet into `<head>` if not already present.
 * Safe to call multiple times — only one `<style>` tag is ever inserted.
 */
export function injectMinimapStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(MINIMAP_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = MINIMAP_STYLE_ID
	style.textContent = MINIMAP_CSS
	document.head.appendChild(style)
}
