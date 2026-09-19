import { injectChromeStyles } from "@bpmnkit/editor"

/**
 * Variable-flow overlay styles.
 *
 * The three marks are a data encoding on the diagram, not chrome, so they are
 * exempt from the one-accent rule the way Operate's chart series are. "Both"
 * used to reach for the product palette's secondary brand colour, which the
 * design system does not have; it is now mixed from the two states it means —
 * the accent a read is marked with and the green a write is marked with — so
 * it follows the theme instead of pinning a fourth hue.
 */
const VF_BOTH =
	"color-mix(in srgb, var(--bpmnkit-chrome-accent) 55%, var(--bpmnkit-success, #16a34a))"

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
  outline: 2px solid ${VF_BOTH};
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
.bpmnkit-vf-legend-dot-both   { background: ${VF_BOTH}; }
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
