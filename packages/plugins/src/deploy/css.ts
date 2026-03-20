export const DEPLOY_STYLE_ID = "bpmnkit-deploy-plugin-styles-v1"

export const DEPLOY_CSS = `
.dp-root {
  display: flex; flex-direction: column; height: 100%; overflow-y: auto;
  padding: 14px 16px; gap: 16px;
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px; color: rgba(255,255,255,0.82);
  box-sizing: border-box;
}
.dp-section {
  display: flex; flex-direction: column; gap: 8px;
}
.dp-section-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
  margin-bottom: 2px;
}
.dp-row {
  display: flex; align-items: center; gap: 8px;
}
.dp-select {
  flex: 1; background: rgba(30,30,46,0.95); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px; color: rgba(255,255,255,0.85); padding: 5px 8px;
  font-size: 12px; font-family: inherit; outline: none;
  appearance: none; -webkit-appearance: none;
}
.dp-select:focus { border-color: rgba(107,157,247,0.6); }
.dp-btn {
  width: 100%; padding: 7px 12px; border-radius: 5px; border: none;
  font-size: 12px; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: opacity 0.15s;
}
.dp-btn:disabled { opacity: 0.35; cursor: default; }
.dp-btn-primary {
  background: var(--bpmnkit-accent, #1a56db); color: #fff;
}
.dp-btn-primary:hover:not(:disabled) { opacity: 0.88; }
.dp-btn-secondary {
  background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.75);
  border: 1px solid rgba(255,255,255,0.12);
}
.dp-btn-secondary:hover:not(:disabled) { background: rgba(255,255,255,0.11); }
.dp-status {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 10px; border-radius: 5px; font-size: 12px;
}
.dp-status-ok   { background: rgba(34,197,94,0.12);  color: #4ade80; }
.dp-status-warn { background: rgba(245,158,11,0.12); color: #fbbf24; }
.dp-status-err  { background: rgba(248,113,113,0.14); color: #f87171; }
.dp-status-info { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.5); }
.dp-dot {
  width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
}
.dp-dot-ok   { background: #4ade80; }
.dp-dot-warn { background: #fbbf24; }
.dp-dot-err  { background: #f87171; }
.dp-dot-info { background: rgba(255,255,255,0.3); }
.dp-finding-list {
  display: flex; flex-direction: column; gap: 4px;
}
.dp-finding {
  display: flex; align-items: flex-start; gap: 6px;
  padding: 5px 8px; border-radius: 4px;
  background: rgba(248,113,113,0.08); font-size: 12px; color: rgba(255,255,255,0.7);
}
.dp-finding-badge {
  flex-shrink: 0; font-size: 10px; font-weight: 700; text-transform: uppercase;
  padding: 1px 5px; border-radius: 3px; margin-top: 1px;
  background: rgba(248,113,113,0.25); color: #f87171;
}
.dp-result-box {
  padding: 8px 10px; border-radius: 5px;
  background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.2);
  font-size: 12px; color: rgba(255,255,255,0.75); line-height: 1.5;
}
.dp-result-key {
  font-family: ui-monospace, monospace; font-size: 11px;
  color: rgba(107,157,247,0.9); word-break: break-all;
}
.dp-textarea {
  width: 100%; min-height: 72px; resize: vertical;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 5px; color: rgba(255,255,255,0.82); padding: 6px 8px;
  font-size: 12px; font-family: ui-monospace, monospace; outline: none;
  box-sizing: border-box;
}
.dp-textarea:focus { border-color: rgba(107,157,247,0.6); }
.dp-link {
  color: var(--bpmnkit-accent-bright, #89b4fa); text-decoration: none; font-size: 12px;
}
.dp-link:hover { text-decoration: underline; }
.dp-divider {
  border: none; border-top: 1px solid rgba(255,255,255,0.07); margin: 0;
}
.dp-offline {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 10px; padding: 24px 16px; text-align: center;
}
.dp-offline-icon { font-size: 28px; opacity: 0.4; }
.dp-offline-title { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.6); }
.dp-offline-hint {
  font-size: 12px; color: rgba(255,255,255,0.3); line-height: 1.5;
}
.dp-offline-code {
  font-family: ui-monospace, monospace; font-size: 11px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px; padding: 4px 8px; color: rgba(255,255,255,0.5);
  white-space: pre;
}
/* Neon theme */
[data-bpmnkit-hud-theme="neon"] .dp-root { color: oklch(73% 0.16 280); }
[data-bpmnkit-hud-theme="neon"] .dp-section-title { color: oklch(50% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .dp-select {
  background: oklch(8% 0.04 280 / 0.98); border-color: oklch(65% 0.28 280 / 0.2);
  color: oklch(80% 0.14 280);
}
[data-bpmnkit-hud-theme="neon"] .dp-select:focus { border-color: oklch(65% 0.28 280 / 0.55); }
[data-bpmnkit-hud-theme="neon"] .dp-btn-secondary {
  background: oklch(65% 0.28 280 / 0.07); border-color: oklch(65% 0.28 280 / 0.2);
  color: oklch(65% 0.1 280);
}
[data-bpmnkit-hud-theme="neon"] .dp-btn-secondary:hover:not(:disabled) { background: oklch(65% 0.28 280 / 0.14); }
[data-bpmnkit-hud-theme="neon"] .dp-status-info { background: oklch(65% 0.28 280 / 0.05); color: oklch(55% 0.08 280); }
[data-bpmnkit-hud-theme="neon"] .dp-dot-info { background: oklch(50% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .dp-finding { background: oklch(55% 0.28 20 / 0.1); color: oklch(73% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .dp-result-box { border-color: oklch(55% 0.18 150 / 0.3); color: oklch(73% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .dp-result-key { color: oklch(72% 0.18 185); }
[data-bpmnkit-hud-theme="neon"] .dp-textarea {
  background: oklch(65% 0.28 280 / 0.04); border-color: oklch(65% 0.28 280 / 0.15);
  color: oklch(73% 0.16 280);
}
[data-bpmnkit-hud-theme="neon"] .dp-textarea:focus { border-color: oklch(65% 0.28 280 / 0.45); }
[data-bpmnkit-hud-theme="neon"] .dp-link { color: oklch(72% 0.18 185); }
[data-bpmnkit-hud-theme="neon"] .dp-divider { border-top-color: oklch(65% 0.28 280 / 0.1); }
[data-bpmnkit-hud-theme="neon"] .dp-offline-title { color: oklch(55% 0.1 280); }
[data-bpmnkit-hud-theme="neon"] .dp-offline-hint { color: oklch(40% 0.06 280); }
[data-bpmnkit-hud-theme="neon"] .dp-offline-code {
  background: oklch(65% 0.28 280 / 0.05); border-color: oklch(65% 0.28 280 / 0.12);
  color: oklch(55% 0.1 280);
}
`

export function injectDeployStyles(): void {
	if (document.getElementById(DEPLOY_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = DEPLOY_STYLE_ID
	style.textContent = DEPLOY_CSS
	document.head.appendChild(style)
}
