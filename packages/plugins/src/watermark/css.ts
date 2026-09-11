/** ID used to prevent duplicate style injection. */
export const WATERMARK_STYLE_ID = "bpmnkit-watermark-styles-v1"

/** CSS for the watermark plugin, injected once into `<head>`. */
export const WATERMARK_CSS = `
.bpmnkit-watermark {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  pointer-events: auto;
  z-index: 10;
}
.bpmnkit-watermark-link {
  font-size: 11px;
  color: var(--bpmnkit-overlay-text, var(--bpmnkit-ds-ink-4, #8b929c));
  text-decoration: none;
  font-family: system-ui, sans-serif;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.bpmnkit-watermark-link:hover {
  opacity: 1;
  text-decoration: underline;
}
.bpmnkit-watermark-logo {
  display: flex;
  align-items: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.bpmnkit-watermark-logo > svg {
  width: 100%;
  height: 100%;
  display: block;
}
`

/**
 * Injects the watermark stylesheet into `<head>` if not already present.
 * Safe to call multiple times — only one `<style>` tag is ever inserted.
 */
export function injectWatermarkStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(WATERMARK_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = WATERMARK_STYLE_ID
	style.textContent = WATERMARK_CSS
	document.head.appendChild(style)
}
