/** ID used to prevent duplicate style injection. */
export const MODEL_NAVIGATION_STYLE_ID = "bpmnkit-model-navigation-styles-v1"

/**
 * CSS for the model-navigation plugin, injected once into `<head>`.
 *
 * Deliberately quiet: an element that links somewhere gets an underline-ish
 * accent, not a second border competing with lint and diff markers on the same
 * shape.
 */
export const MODEL_NAVIGATION_CSS = `
.bpmnkit-modelnav-available {
  cursor: pointer;
}
.bpmnkit-modelnav-available .bpmnkit-shape-body,
.bpmnkit-modelnav-available .bpmnkit-callactivity-body {
  stroke-dasharray: none;
}
.bpmnkit-modelnav-available .bpmnkit-label {
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: var(--bpmnkit-ds-accent, #a8503a);
  text-underline-offset: 2px;
}
`

/** Injects {@link MODEL_NAVIGATION_CSS} into `<head>` once per document. */
export function injectModelNavigationStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(MODEL_NAVIGATION_STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = MODEL_NAVIGATION_STYLE_ID
	style.textContent = MODEL_NAVIGATION_CSS
	document.head.appendChild(style)
}
