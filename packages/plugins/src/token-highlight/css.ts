const STYLE_ID = "bpmnkit-token-highlight-v1"

const CSS = `
@keyframes bpmnkit-token-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px var(--bpmnkit-warn, #d97706)); }
  50%       { filter: drop-shadow(0 0 10px var(--bpmnkit-warn, #d97706)); }
}
@keyframes bpmnkit-token-flow {
  to { stroke-dashoffset: -12; }
}

/* ── Active shapes (token is here) ─────────────────────────────────────── */
.bpmnkit-token-active {
  animation: bpmnkit-token-pulse 1.4s ease-in-out infinite;
}
.bpmnkit-token-active .bpmnkit-shape-body,
.bpmnkit-token-active .bpmnkit-callactivity-body,
.bpmnkit-token-active .bpmnkit-eventsubprocess-body,
.bpmnkit-token-active .bpmnkit-event-body,
.bpmnkit-token-active .bpmnkit-end-body,
.bpmnkit-token-active .bpmnkit-gw-body {
  stroke: #f59e0b !important;
  stroke-width: 2.5 !important;
  fill: var(--bpmnkit-warn, #d97706) !important;
}

/* ── Visited shapes (token has passed through) ──────────────────────────── */
.bpmnkit-token-visited .bpmnkit-shape-body,
.bpmnkit-token-visited .bpmnkit-callactivity-body,
.bpmnkit-token-visited .bpmnkit-eventsubprocess-body,
.bpmnkit-token-visited .bpmnkit-event-body,
.bpmnkit-token-visited .bpmnkit-end-body,
.bpmnkit-token-visited .bpmnkit-gw-body {
  stroke: #10b981 !important;
  stroke-width: 2 !important;
  fill: rgba(16, 185, 129, 0.08) !important;
}

/* ── Active edges (token is moving along this flow) ─────────────────────── */
.bpmnkit-token-edge-active .bpmnkit-edge-path {
  stroke: #f59e0b !important;
  stroke-width: 2.5 !important;
  stroke-dasharray: 8 4;
  animation: bpmnkit-token-flow 0.5s linear infinite;
}
.bpmnkit-token-edge-active .bpmnkit-arrow-fill {
  fill: #f59e0b !important;
}

/* ── Visited edges ───────────────────────────────────────────────────────── */
.bpmnkit-token-edge-visited .bpmnkit-edge-path {
  stroke: #10b981 !important;
  stroke-width: 2 !important;
}
.bpmnkit-token-edge-visited .bpmnkit-arrow-fill {
  fill: #10b981 !important;
}

/* ── Error shapes (gateway with no matching condition) ───────────────────── */
@keyframes bpmnkit-token-error-pulse {
  0%, 100% { filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.95)); }
  50%       { filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.3)); }
}
.bpmnkit-token-error {
  animation: bpmnkit-token-error-pulse 0.9s ease-in-out 3;
}
.bpmnkit-token-error .bpmnkit-shape-body,
.bpmnkit-token-error .bpmnkit-event-body,
.bpmnkit-token-error .bpmnkit-end-body,
.bpmnkit-token-error .bpmnkit-gw-body {
  stroke: #ef4444 !important;
  stroke-width: 2.5 !important;
  fill: rgba(239, 68, 68, 0.12) !important;
}
`

export function injectTokenHighlightStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
