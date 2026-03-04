const STYLE_ID = "bpmn-token-highlight-v1";

const CSS = `
@keyframes bpmn-token-pulse {
  0%, 100% { filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.9)); }
  50%       { filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.25)); }
}
@keyframes bpmn-token-flow {
  to { stroke-dashoffset: -12; }
}

/* ── Active shapes (token is here) ─────────────────────────────────────── */
.bpmn-token-active {
  animation: bpmn-token-pulse 1.4s ease-in-out infinite;
}
.bpmn-token-active .bpmn-shape-body,
.bpmn-token-active .bpmn-event-body,
.bpmn-token-active .bpmn-end-body,
.bpmn-token-active .bpmn-gw-body {
  stroke: #f59e0b !important;
  stroke-width: 2.5 !important;
  fill: rgba(245, 158, 11, 0.12) !important;
}

/* ── Visited shapes (token has passed through) ──────────────────────────── */
.bpmn-token-visited .bpmn-shape-body,
.bpmn-token-visited .bpmn-event-body,
.bpmn-token-visited .bpmn-end-body,
.bpmn-token-visited .bpmn-gw-body {
  stroke: #10b981 !important;
  stroke-width: 2 !important;
  fill: rgba(16, 185, 129, 0.08) !important;
}

/* ── Active edges (token is moving along this flow) ─────────────────────── */
.bpmn-token-edge-active .bpmn-edge-path {
  stroke: #f59e0b !important;
  stroke-width: 2.5 !important;
  stroke-dasharray: 8 4;
  animation: bpmn-token-flow 0.5s linear infinite;
}
.bpmn-token-edge-active .bpmn-arrow-fill {
  fill: #f59e0b !important;
}

/* ── Visited edges ───────────────────────────────────────────────────────── */
.bpmn-token-edge-visited .bpmn-edge-path {
  stroke: #10b981 !important;
  stroke-width: 2 !important;
}
.bpmn-token-edge-visited .bpmn-arrow-fill {
  fill: #10b981 !important;
}

/* ── Error shapes (gateway with no matching condition) ───────────────────── */
@keyframes bpmn-token-error-pulse {
  0%, 100% { filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.95)); }
  50%       { filter: drop-shadow(0 0 12px rgba(239, 68, 68, 0.3)); }
}
.bpmn-token-error {
  animation: bpmn-token-error-pulse 0.9s ease-in-out 3;
}
.bpmn-token-error .bpmn-shape-body,
.bpmn-token-error .bpmn-event-body,
.bpmn-token-error .bpmn-end-body,
.bpmn-token-error .bpmn-gw-body {
  stroke: #ef4444 !important;
  stroke-width: 2.5 !important;
  fill: rgba(239, 68, 68, 0.12) !important;
}
`;

export function injectTokenHighlightStyles(): void {
	if (typeof document === "undefined") return;
	if (document.getElementById(STYLE_ID) !== null) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = CSS;
	document.head.appendChild(style);
}
