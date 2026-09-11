import { injectChromeStyles } from "@bpmnkit/editor"

const CSS = `
.bpmnkit-vf-producer [data-bpmnkit-shape-bg],
.bpmnkit-vf-producer rect.djs-outline {
  outline: 2px solid var(--bpmnkit-success, #16a34a);
  outline-offset: 2px;
}
.bpmnkit-vf-consumer [data-bpmnkit-shape-bg],
.bpmnkit-vf-consumer rect.djs-outline {
  outline: 2px solid var(--bpmnkit-chrome-accent);
  outline-offset: 2px;
}
.bpmnkit-vf-both [data-bpmnkit-shape-bg],
.bpmnkit-vf-both rect.djs-outline {
  outline: 2px solid var(--bpmnkit-teal, #0d9488);
  outline-offset: 2px;
}

/* Tooltip */
.bpmnkit-vf-tooltip {
  position: fixed;
  z-index: 10000;
  pointer-events: none;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 8px 10px;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink);
  max-width: 280px;
  white-space: nowrap;
}
.bpmnkit-vf-tooltip-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.bpmnkit-vf-tooltip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0;
}
.bpmnkit-vf-tooltip-role {
  display: inline-block;
  width: 8px;
  height: 8px;
  flex-shrink: 0;
}
.bpmnkit-vf-tooltip-role-writes {
  background: var(--bpmnkit-success, #16a34a);
}
.bpmnkit-vf-tooltip-role-reads {
  background: var(--bpmnkit-chrome-accent);
}

/* Legend panel */
.bpmnkit-vf-legend {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  padding: 6px 8px;
  font-family: var(--bpmnkit-chrome-font);
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-4);
  background: var(--bpmnkit-chrome-ground);
  border-top: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-vf-legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}
.bpmnkit-vf-legend-dot {
  width: 10px;
  height: 10px;
}
.bpmnkit-vf-legend-dot-writes { background: var(--bpmnkit-success, #16a34a); }
.bpmnkit-vf-legend-dot-reads  { background: var(--bpmnkit-chrome-accent); }
.bpmnkit-vf-legend-dot-both   { background: var(--bpmnkit-teal, #0d9488); }
`

let injected = false
export function injectVariableFlowStyles(): void {
	injectChromeStyles()
	if (injected) return
	injected = true
	const style = document.createElement("style")
	style.textContent = CSS
	document.head.appendChild(style)
}
