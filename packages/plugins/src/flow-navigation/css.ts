/** ID used to prevent duplicate style injection. */
export const FLOW_NAVIGATION_STYLE_ID = "bpmnkit-flow-navigation-styles-v1"

/** CSS for the flow-navigation plugin, injected once into `<head>`. */
export const FLOW_NAVIGATION_CSS = `
.bpmnkit-flownav-cursor .bpmnkit-shape-body,
.bpmnkit-flownav-cursor .bpmnkit-callactivity-body,
.bpmnkit-flownav-cursor .bpmnkit-eventsubprocess-body,
.bpmnkit-flownav-cursor .bpmnkit-event-body,
.bpmnkit-flownav-cursor .bpmnkit-end-body,
.bpmnkit-flownav-cursor .bpmnkit-gw-body,
.bpmnkit-flownav-cursor .bpmnkit-data-body,
.bpmnkit-flownav-cursor .bpmnkit-datastore-body {
  stroke: var(--bpmnkit-accent-bright, #3b82f6) !important;
  stroke-width: 3 !important;
}

/* The flow being chosen at a fan-out — animated so it reads as a selection
   in progress rather than a decoration. */
@keyframes bpmnkit-flownav-march {
  to { stroke-dashoffset: -12; }
}
.bpmnkit-flownav-candidate .bpmnkit-edge-path {
  stroke: var(--bpmnkit-accent-bright, #3b82f6) !important;
  stroke-width: 3 !important;
  stroke-dasharray: 8 4;
  animation: bpmnkit-flownav-march 0.5s linear infinite;
}
.bpmnkit-flownav-candidate .bpmnkit-arrow-fill {
  fill: var(--bpmnkit-accent-bright, #3b82f6) !important;
}
`

/** Injects {@link FLOW_NAVIGATION_CSS} into `<head>` once per document. */
export function injectFlowNavigationStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(FLOW_NAVIGATION_STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = FLOW_NAVIGATION_STYLE_ID
	style.textContent = FLOW_NAVIGATION_CSS
	document.head.appendChild(style)
}
