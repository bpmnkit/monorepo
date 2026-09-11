import { injectChromeStyles } from "@bpmnkit/editor"

const STYLE_ID = "ai-bridge-styles"

export function injectAiBridgeStyles(): void {
	injectChromeStyles()
	const existing = document.getElementById(STYLE_ID)
	const style = existing instanceof HTMLStyleElement ? existing : document.createElement("style")
	if (!existing) {
		style.id = STYLE_ID
		document.head.appendChild(style)
	}
	style.textContent = `
.ai-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 360px; z-index: 150;
  display: flex; flex-direction: column;
  background: var(--bpmnkit-chrome-ground);
  border-left: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink);
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}
.ai-panel.ai-panel-open { transform: translateX(0); }
.ai-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  flex-shrink: 0;
}
.ai-panel-title { font-weight: 600; font-size: 14px; color: var(--bpmnkit-chrome-ink); }
.ai-panel-header-actions { display: flex; gap: 4px; align-items: center; }
.ai-panel-status {
  padding: 6px 14px;
  font-size: 11.5px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  flex-shrink: 0;
}
.ai-panel-status-ok { color: var(--bpmnkit-success, #16a34a); }
.ai-panel-status-err { color: var(--bpmnkit-danger, #dc2626); }
.ai-panel-status-err code {
  display: block; margin-top: 4px;
  background: var(--bpmnkit-chrome-line-soft);
  padding: 4px 8px; font-size: 11px; color: var(--bpmnkit-chrome-ink);
  user-select: all;
}
/* ── Messages ── */
.ai-messages {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.ai-msg { padding: 8px 12px;
  line-height: 1.5; word-break: break-word;
}
.ai-msg-user {
  background: var(--bpmnkit-chrome-accent-subtle);
  border: 1px solid var(--bpmnkit-chrome-accent);
  align-self: flex-end; max-width: 85%;
  white-space: pre-wrap;
}
.ai-msg-ai {
  background: var(--bpmnkit-chrome-line-soft);
  border: 1px solid var(--bpmnkit-chrome-line-soft);
  align-self: flex-start; max-width: 95%;
}
.ai-msg-cursor::after {
  content: "▊"; animation: ai-blink 0.8s step-end infinite;
}
@keyframes ai-blink { 50% { opacity: 0; } }
/* ── Markdown elements ── */
.ai-md-h { font-size: 13.5px; font-weight: 600; margin: 6px 0 2px; }
.ai-md-h:first-child { margin-top: 0; }
.ai-md-p { margin: 0; }
.ai-md-p + .ai-md-p { margin-top: 5px; }
.ai-md-list { margin: 4px 0; padding-left: 18px; display: flex; flex-direction: column; gap: 2px; }
.ai-md-code {
  background: var(--bpmnkit-chrome-ground-2);
  padding: 1px 5px; font-family: var(--bpmnkit-chrome-mono); font-size: 11.5px;
}
/* ── Diagram preview ── */
.ai-msg-preview {
  position: relative; height: 200px; margin: 8px 0; overflow: hidden;
  border: 1px solid var(--bpmnkit-chrome-line);
}
.ai-msg-preview .bpmnkit-canvas { width: 100%; height: 100%; }
/* ── Message action row (copy + apply) ── */
.ai-msg-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.ai-msg-copy {
  padding: 3px 10px;
  background: none; border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-4); font-size: 11px; cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}
.ai-msg-copy:hover { color: var(--bpmnkit-chrome-ink-2); border-color: var(--bpmnkit-chrome-ink-4); }
.ai-msg-apply {
  padding: 3px 12px;
  background: var(--bpmnkit-success, #16a34a); border: 1px solid var(--bpmnkit-success, #16a34a); color: var(--bpmnkit-chrome-accent-fg);
  font-size: 11px; cursor: pointer; font-weight: 500; font-family: inherit;
}
.ai-msg-apply:hover { background: var(--bpmnkit-success, #16a34a); }
.ai-msg-approve {
  padding: 3px 12px;
  background: var(--bpmnkit-warn, #d97706); border: 1px solid var(--bpmnkit-warn, #d97706); color: var(--bpmnkit-chrome-accent-fg);
  font-size: 11px; cursor: pointer; font-weight: 500; font-family: inherit;
}
.ai-msg-approve:hover { background: var(--bpmnkit-warn, #d97706); }
.ai-msg-approve:disabled { opacity: 0.4; cursor: default; }
.ai-msg-code {
  background: var(--bpmnkit-chrome-ground-2);
  padding: 8px; margin: 6px 0;
  font-family: var(--bpmnkit-chrome-mono); font-size: 11.5px;
  color: var(--bpmnkit-chrome-ink-2);
  overflow-x: auto; white-space: pre;
}
/* ── Welcome / empty state ── */
.ai-welcome {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 16px; gap: 10px; text-align: center;
}
.ai-welcome-title {
  font-size: 15px; font-weight: 600; color: var(--bpmnkit-chrome-ink);
}
.ai-welcome-sub {
  font-size: 12px; color: var(--bpmnkit-chrome-ink-4); margin-bottom: 6px;
}
.ai-welcome-examples { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ai-welcome-example {
  padding: 8px 12px; text-align: left;
  background: var(--bpmnkit-chrome-line-soft); border: 1px solid var(--bpmnkit-chrome-line-soft);
  color: var(--bpmnkit-chrome-ink-2); font-size: 12px; cursor: pointer;
  font-family: inherit; transition: background 0.15s, color 0.15s;
}
.ai-welcome-example:hover { background: var(--bpmnkit-chrome-line-soft); color: var(--bpmnkit-chrome-ink); }
/* ── Quick actions ── */
.ai-quick-actions {
  padding: 6px 10px;
  display: flex; gap: 6px; flex-wrap: wrap;
  border-top: 1px solid var(--bpmnkit-chrome-hover);
  flex-shrink: 0;
}
.ai-quick-btn {
  padding: 4px 10px;
  background: var(--bpmnkit-chrome-line-soft); border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-2); font-size: 12px; cursor: pointer;
  font-family: inherit; white-space: nowrap;
  max-width: 180px; overflow: hidden; text-overflow: ellipsis;
  transition: background 0.15s, color 0.15s;
}
.ai-quick-btn:hover:not(:disabled) { background: var(--bpmnkit-chrome-line); color: var(--bpmnkit-chrome-ink); }
.ai-quick-btn:disabled { opacity: 0.3; cursor: default; }
/* ── Context badge strip ── */
.ai-context-refs {
  padding: 6px 10px 4px;
  display: flex; gap: 6px; flex-wrap: wrap;
  border-top: 1px solid var(--bpmnkit-chrome-hover);
  flex-shrink: 0;
}
.ai-context-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 4px 2px 8px;
  background: var(--bpmnkit-chrome-accent-subtle); border: 1px solid var(--bpmnkit-chrome-accent-subtle); font-size: 11.5px;
  color: var(--bpmnkit-chrome-accent); max-width: 240px;
  cursor: pointer; user-select: none;
}
.ai-context-badge__label {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-style: italic; cursor: pointer;
}
.ai-context-badge--pinned .ai-context-badge__label { font-style: normal; }
.ai-context-badge__remove {
  background: none; border: none; padding: 0 2px;
  color: var(--bpmnkit-chrome-ink-4); cursor: pointer;
  font-size: 15px; line-height: 1; flex-shrink: 0;
}
.ai-context-badge__remove:hover { color: var(--bpmnkit-chrome-ink); }
.ai-msg-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 5px; }
.ai-msg-context-chip {
  display: inline-block;
  font-size: 11px; padding: 1px 6px;
  background: var(--bpmnkit-chrome-accent-subtle); border: 1px solid var(--bpmnkit-chrome-accent-subtle); color: var(--bpmnkit-chrome-accent);
}
/* ── Input area ── */
.ai-input-area {
  padding: 10px 10px 6px; border-top: 1px solid var(--bpmnkit-chrome-line-soft);
  display: flex; gap: 8px; align-items: flex-end;
  flex-shrink: 0;
}
.ai-textarea {
  flex: 1; min-height: 36px; max-height: 200px;
  background: var(--bpmnkit-chrome-line-soft);
  border: 1px solid var(--bpmnkit-chrome-line); color: var(--bpmnkit-chrome-ink);
  font-size: 13px; font-family: inherit;
  padding: 7px 10px; resize: none; overflow-y: auto;
  outline: none; line-height: 1.45;
}
.ai-textarea:focus { border-color: var(--bpmnkit-chrome-accent); }
.ai-textarea::placeholder { color: var(--bpmnkit-chrome-ink-4); }
.ai-send-btn {
  padding: 7px 14px;
  background: var(--bpmnkit-chrome-accent); border: 1px solid var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg); font-size: 13px; font-weight: 500;
  cursor: pointer; flex-shrink: 0; height: 36px;
}
.ai-send-btn:hover:not(:disabled) { background: var(--bpmnkit-chrome-accent); }
.ai-send-btn:disabled { opacity: 0.4; cursor: default; }
.ai-stop-btn {
  padding: 7px 14px;
  background: var(--bpmnkit-danger, #dc2626); border: 1px solid var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-ds-ink-on-dark, #f4f5f7); font-size: 13px; font-weight: 500;
  cursor: pointer; flex-shrink: 0; height: 36px;
}
.ai-stop-btn:hover { background: var(--bpmnkit-danger, #dc2626); }
.ai-input-hint {
  padding: 0 10px 8px;
  font-size: 10.5px; color: var(--bpmnkit-chrome-ink-4);
  flex-shrink: 0;
}
/* ── Header buttons ── */
.ai-hdr-btn {
  padding: 3px 8px;
  background: var(--bpmnkit-chrome-hover); border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-2); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; gap: 3px;
}
.ai-hdr-btn:hover { background: var(--bpmnkit-chrome-line); color: var(--bpmnkit-chrome-ink); }
.ai-hdr-btn svg { width: 13px; height: 13px; }
.ai-backend-select {
  padding: 3px 6px;
  background: var(--bpmnkit-chrome-hover); border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-2); font-size: 12px; cursor: pointer;
  font-family: inherit; outline: none;
}
.ai-backend-select:hover { background: var(--bpmnkit-chrome-line); }
/* ── Docked mode ── */
.ai-panel--docked {
  position: static !important;
  transform: none !important;
  width: auto !important;
  right: auto; top: auto; bottom: auto;
  flex: 1; min-height: 0; border-left: none;
}
.ai-panel--docked, .ai-panel--docked.ai-panel-open { display: flex; }
.ai-panel--docked .ai-hdr-btn[title="Close"] { display: none; }

.ai-companion-offer {
  margin-top: 10px; padding: 10px 12px;
  border: 1px solid var(--bpmnkit-chrome-line); background: var(--bpmnkit-chrome-accent-subtle);
}
.ai-companion-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-4); margin-bottom: 8px;
}
.ai-companion-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; margin-bottom: 5px;
}
.ai-companion-row:last-child { margin-bottom: 0; }
.ai-companion-row span {
  font-size: 12px; color: var(--bpmnkit-chrome-ink-2); overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
}
.ai-companion-create {
  flex-shrink: 0; padding: 3px 10px; font-size: 11px; cursor: pointer;
  border: 1px solid var(--bpmnkit-chrome-accent); background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent); transition: background 0.15s;
}
.ai-companion-create:hover:not(:disabled) { background: var(--bpmnkit-chrome-accent-subtle); }
.ai-companion-create:disabled { opacity: 0.6; cursor: default; }
/* ── Improve diff ── */
.ai-improve-diff {
  margin-top: 10px;
  border: 1px solid var(--bpmnkit-chrome-line);
  overflow: hidden;
  font-size: 12px;
}
.ai-improve-autofix {
  padding: 5px 10px;
  background: var(--bpmnkit-success, #16a34a);
  color: var(--bpmnkit-success, #16a34a);
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
}
.ai-improve-ops {
  margin: 0; padding: 4px 0;
  list-style: none;
}
.ai-improve-op {
  padding: 4px 10px 4px 26px;
  position: relative;
  color: var(--bpmnkit-chrome-ink-2);
  line-height: 1.4;
}
.ai-improve-op::before {
  content: "•";
  position: absolute; left: 10px;
  color: var(--bpmnkit-chrome-ink-4);
}
.ai-improve-op--insert::before { content: "+"; color: var(--bpmnkit-success, #16a34a); }
.ai-improve-op--delete::before { content: "−"; color: var(--bpmnkit-danger, #dc2626); }
.ai-improve-op--delete_flow::before { content: "−"; color: var(--bpmnkit-danger, #dc2626); }
.ai-improve-op--rename::before,
.ai-improve-op--update::before,
.ai-improve-op--redirect_flow::before,
.ai-improve-op--add_flow::before { content: "~"; color: var(--bpmnkit-warn, #d97706); }
`
	document.head.appendChild(style)
}
