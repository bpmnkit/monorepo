import { injectChromeStyles } from "@bpmnkit/editor"

export const DEPLOY_STYLE_ID = "bpmnkit-deploy-plugin-styles-v1"

/* Flat, square, hairline-ruled. Grounds come from the shared chrome tokens, so
   this sheet is one set of rules rather than a dark one plus a neon copy.
   Deployment outcome — ok / warn / error — is semantic state and keeps its own
   scale; it is not brand colour and the one-accent rule does not reach it. */
export const DEPLOY_CSS = `
.dp-root {
  display: flex; flex-direction: column; height: 100%; overflow-y: auto;
  padding: 0 16px 16px; gap: 20px;
  font-family: var(--bpmnkit-chrome-font);
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px); color: var(--bpmnkit-chrome-ink-2);
  box-sizing: border-box;
}
.dp-section {
  display: flex; flex-direction: column; gap: 8px;
}
.dp-section-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase;
  color: var(--bpmnkit-chrome-ink-4);
  padding-top: 16px; margin-bottom: 2px;
}
.dp-row {
  display: flex; align-items: center; gap: 8px;
}
.dp-select {
  flex: 1; background: var(--bpmnkit-chrome-ground); border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink); padding: 7px 9px;
  font-family: var(--bpmnkit-chrome-mono); font-size: 12.5px; outline: none;
  appearance: none; -webkit-appearance: none;
}
.dp-select:focus { border-color: var(--bpmnkit-chrome-accent); }
.dp-btn {
  width: 100%; padding: 9px 14px; border: none;
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px; cursor: pointer;
}
.dp-btn:disabled { opacity: 0.35; cursor: default; }
.dp-btn-primary {
  background: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent-fg);
}
.dp-btn-primary:hover:not(:disabled) { background: var(--bpmnkit-ds-accent-hover, #8f412e); color: var(--bpmnkit-chrome-accent-fg); }
.dp-btn-secondary {
  background: transparent; color: var(--bpmnkit-chrome-ink-2);
  border: 1px solid var(--bpmnkit-chrome-line);
}
.dp-btn-secondary:hover:not(:disabled) { background: var(--bpmnkit-chrome-hover); color: var(--bpmnkit-chrome-ink); }
.dp-status {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 10px; border: 1px solid var(--bpmnkit-chrome-line);
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px;
}
.dp-status-ok   { border-color: var(--bpmnkit-success, #16a34a); color: var(--bpmnkit-success, #16a34a); }
.dp-status-warn { border-color: var(--bpmnkit-warn, #d97706);   color: var(--bpmnkit-warn, #d97706); }
.dp-status-err  { border-color: var(--bpmnkit-danger, #dc2626); color: var(--bpmnkit-danger, #dc2626); }
.dp-status-info { color: var(--bpmnkit-chrome-ink-4); }
/* A dot is a mark, not chrome, so it keeps its shape. */
.dp-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.dp-dot-ok   { background: var(--bpmnkit-success, #16a34a); }
.dp-dot-warn { background: var(--bpmnkit-warn, #d97706); }
.dp-dot-err  { background: var(--bpmnkit-danger, #dc2626); }
.dp-dot-info { background: var(--bpmnkit-chrome-ink-4); }
.dp-finding-list {
  display: flex; flex-direction: column;
  border: 1px solid var(--bpmnkit-chrome-line);
}
.dp-finding {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px); color: var(--bpmnkit-chrome-ink-2);
}
.dp-finding:last-child { border-bottom: none; }
.dp-finding-badge {
  flex-shrink: 0;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.12em; text-transform: uppercase; margin-top: 2px;
  color: var(--bpmnkit-danger, #dc2626);
}
.dp-result-box {
  padding: 10px 12px;
  border: 1px solid var(--bpmnkit-success, #16a34a);
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px); color: var(--bpmnkit-chrome-ink-2); line-height: 1.5;
}
.dp-result-key {
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px;
  color: var(--bpmnkit-chrome-accent); word-break: break-all;
}
.dp-textarea {
  width: 100%; min-height: 72px; resize: vertical;
  background: var(--bpmnkit-chrome-ground); border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink); padding: 7px 9px;
  font-size: 12.5px; font-family: var(--bpmnkit-chrome-mono); outline: none;
  box-sizing: border-box;
}
.dp-textarea:focus { border-color: var(--bpmnkit-chrome-accent); }
.dp-link {
  color: var(--bpmnkit-chrome-accent); text-decoration: none;
  font-size: var(--bpmnkit-ds-t-body-sm, 14.5px);
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
}
.dp-link:hover { border-bottom-color: var(--bpmnkit-chrome-accent); }
.dp-divider {
  border: none; border-top: 1px solid var(--bpmnkit-chrome-line); margin: 0;
}
.dp-offline {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 12px; padding: 24px 16px; text-align: center;
}
.dp-offline-icon { font-size: 24px; color: var(--bpmnkit-chrome-ink-4); font-variant-emoji: text; }
.dp-offline-title {
  font-size: 15px; font-weight: 700; letter-spacing: -0.02em;
  color: var(--bpmnkit-chrome-ink);
}
.dp-offline-hint {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4); line-height: 1.55;
}
.dp-offline-code {
  font-family: var(--bpmnkit-chrome-mono); font-size: 12px;
  background: var(--bpmnkit-chrome-ground-2); border: 1px solid var(--bpmnkit-chrome-line);
  padding: 6px 9px; color: var(--bpmnkit-chrome-ink-2);
  white-space: pre;
}
`

export function injectDeployStyles(): void {
	if (typeof document === "undefined") return
	injectChromeStyles()
	if (document.getElementById(DEPLOY_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = DEPLOY_STYLE_ID
	style.textContent = DEPLOY_CSS
	document.head.appendChild(style)
}
