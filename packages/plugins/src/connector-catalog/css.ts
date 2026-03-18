export const CONNECTOR_CATALOG_STYLE_ID = "bpmnkit-connector-catalog-v1"

export const CONNECTOR_CATALOG_CSS = `
/* ── Toast notifications ─────────────────────────────────────────────────── */
.bpmnkit-cc-toast {
  position: fixed;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 16px;
  border-radius: 8px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 500;
  z-index: 99999;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  animation: bpmnkit-cc-fadein 0.15s ease;
  max-width: 420px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}
@keyframes bpmnkit-cc-fadein {
  from { opacity: 0; transform: translateX(-50%) translateY(6px); }
  to   { opacity: 1; transform: translateX(-50%) translateY(0); }
}
.bpmnkit-cc-toast--loading {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  color: var(--bpmnkit-fg-muted, #8888a8);
}
.bpmnkit-cc-toast--success {
  background: rgba(22, 163, 74, 0.12);
  border: 1px solid rgba(22, 163, 74, 0.35);
  color: var(--bpmnkit-success, #22c55e);
}
.bpmnkit-cc-toast--error {
  background: rgba(220, 38, 38, 0.12);
  border: 1px solid rgba(220, 38, 38, 0.35);
  color: var(--bpmnkit-danger, #f87171);
}
/* Light theme */
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--loading {
  background: var(--bpmnkit-surface-2, #eeeef8);
  border-color: var(--bpmnkit-border, #d0d0e8);
  color: var(--bpmnkit-fg-muted, #6666a0);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--success {
  background: rgba(22, 163, 74, 0.07);
  border-color: rgba(22, 163, 74, 0.3);
  color: var(--bpmnkit-success, #16a34a);
}
[data-bpmnkit-hud-theme="light"] .bpmnkit-cc-toast--error {
  background: rgba(220, 38, 38, 0.07);
  border-color: rgba(220, 38, 38, 0.3);
  color: var(--bpmnkit-danger, #dc2626);
}
`

export function injectConnectorCatalogStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(CONNECTOR_CATALOG_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = CONNECTOR_CATALOG_STYLE_ID
	style.textContent = CONNECTOR_CATALOG_CSS
	document.head.appendChild(style)
}
