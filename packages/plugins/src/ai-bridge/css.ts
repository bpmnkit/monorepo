const STYLE_ID = "ai-bridge-styles";

export function injectAiBridgeStyles(): void {
	const existing = document.getElementById(STYLE_ID);
	const style = existing instanceof HTMLStyleElement ? existing : document.createElement("style");
	if (!existing) {
		style.id = STYLE_ID;
		document.head.appendChild(style);
	}
	style.textContent = `
.ai-panel {
  position: fixed; top: 0; right: 0; bottom: 0;
  width: 360px; z-index: 150;
  display: flex; flex-direction: column;
  background: rgba(20, 20, 28, 0.97);
  border-left: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.85);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  transform: translateX(100%);
  transition: transform 0.2s ease;
  box-shadow: -8px 0 32px rgba(0,0,0,0.4);
}
.ai-panel.ai-panel-open { transform: translateX(0); }
.ai-panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.ai-panel-title { font-weight: 600; font-size: 14px; color: rgba(255,255,255,0.92); }
.ai-panel-header-actions { display: flex; gap: 4px; align-items: center; }
.ai-panel-status {
  padding: 6px 14px;
  font-size: 11.5px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  flex-shrink: 0;
}
.ai-panel-status-ok { color: rgba(120,220,120,0.8); }
.ai-panel-status-err { color: rgba(220,100,80,0.9); }
.ai-panel-status-err code {
  display: block; margin-top: 4px;
  background: rgba(255,255,255,0.05); border-radius: 4px;
  padding: 4px 8px; font-size: 11px; color: rgba(255,255,255,0.9);
  user-select: all;
}
/* ── Messages ── */
.ai-messages {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.ai-msg {
  border-radius: 8px; padding: 8px 12px;
  line-height: 1.5; word-break: break-word;
}
.ai-msg-user {
  background: rgba(60,120,220,0.25);
  border: 1px solid rgba(60,120,220,0.35);
  align-self: flex-end; max-width: 85%;
  white-space: pre-wrap;
}
.ai-msg-ai {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.08);
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
  background: rgba(0,0,0,0.28); border-radius: 3px;
  padding: 1px 5px; font-family: monospace; font-size: 11.5px;
}
/* ── Message action row (copy + apply) ── */
.ai-msg-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.ai-msg-copy {
  padding: 3px 10px; border-radius: 5px;
  background: none; border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.35); font-size: 11px; cursor: pointer;
  font-family: inherit;
  transition: color 0.15s, border-color 0.15s;
}
.ai-msg-copy:hover { color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.2); }
.ai-msg-apply {
  padding: 3px 12px;
  background: rgba(60,180,100,0.25); border: 1px solid rgba(60,180,100,0.4);
  border-radius: 5px; color: rgba(120,230,140,0.9);
  font-size: 11px; cursor: pointer; font-weight: 500; font-family: inherit;
}
.ai-msg-apply:hover { background: rgba(60,180,100,0.38); }
.ai-msg-code {
  background: rgba(0,0,0,0.3); border-radius: 5px;
  padding: 8px; margin: 6px 0;
  font-family: monospace; font-size: 11.5px;
  color: rgba(255,255,255,0.65);
  overflow-x: auto; white-space: pre;
}
/* ── Welcome / empty state ── */
.ai-welcome {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  padding: 16px; gap: 10px; text-align: center;
}
.ai-welcome-title {
  font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.85);
}
.ai-welcome-sub {
  font-size: 12px; color: rgba(255,255,255,0.38); margin-bottom: 6px;
}
.ai-welcome-examples { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.ai-welcome-example {
  padding: 8px 12px; border-radius: 8px; text-align: left;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09);
  color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
  font-family: inherit; transition: background 0.15s, color 0.15s;
}
.ai-welcome-example:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.88); }
/* ── Quick actions ── */
.ai-quick-actions {
  padding: 6px 10px;
  display: flex; gap: 6px; flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ai-quick-btn {
  padding: 4px 10px; border-radius: 14px;
  background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
  color: rgba(255,255,255,0.65); font-size: 12px; cursor: pointer;
  font-family: inherit; white-space: nowrap;
  max-width: 180px; overflow: hidden; text-overflow: ellipsis;
  transition: background 0.15s, color 0.15s;
}
.ai-quick-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }
.ai-quick-btn:disabled { opacity: 0.3; cursor: default; }
/* ── Context badge strip ── */
.ai-context-refs {
  padding: 6px 10px 4px;
  display: flex; gap: 6px; flex-wrap: wrap;
  border-top: 1px solid rgba(255,255,255,0.06);
  flex-shrink: 0;
}
.ai-context-badge {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 2px 4px 2px 8px;
  background: rgba(60,120,220,0.15); border: 1px solid rgba(60,120,220,0.3);
  border-radius: 4px; font-size: 11.5px;
  color: rgba(160,190,255,0.9); max-width: 240px;
  cursor: pointer; user-select: none;
}
.ai-context-badge__label {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-style: italic; cursor: pointer;
}
.ai-context-badge--pinned .ai-context-badge__label { font-style: normal; }
.ai-context-badge__remove {
  background: none; border: none; padding: 0 2px;
  color: rgba(160,190,255,0.55); cursor: pointer;
  font-size: 15px; line-height: 1; flex-shrink: 0;
}
.ai-context-badge__remove:hover { color: rgba(255,255,255,0.9); }
.ai-msg-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 5px; }
.ai-msg-context-chip {
  display: inline-block;
  font-size: 11px; padding: 1px 6px;
  background: rgba(60,120,220,0.2); border: 1px solid rgba(60,120,220,0.3);
  border-radius: 3px; color: rgba(160,190,255,0.85);
}
/* ── Input area ── */
.ai-input-area {
  padding: 10px 10px 6px; border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; gap: 8px; align-items: flex-end;
  flex-shrink: 0;
}
.ai-textarea {
  flex: 1; min-height: 36px; max-height: 200px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: rgba(255,255,255,0.85);
  font-size: 13px; font-family: inherit;
  padding: 7px 10px; resize: none; overflow-y: auto;
  outline: none; line-height: 1.45;
}
.ai-textarea:focus { border-color: rgba(60,120,220,0.5); }
.ai-textarea::placeholder { color: rgba(255,255,255,0.3); }
.ai-send-btn {
  padding: 7px 14px; border-radius: 6px;
  background: rgba(60,120,220,0.5); border: 1px solid rgba(60,120,220,0.7);
  color: #fff; font-size: 13px; font-weight: 500;
  cursor: pointer; flex-shrink: 0; height: 36px;
}
.ai-send-btn:hover:not(:disabled) { background: rgba(60,120,220,0.65); }
.ai-send-btn:disabled { opacity: 0.4; cursor: default; }
.ai-stop-btn {
  padding: 7px 14px; border-radius: 6px;
  background: rgba(200,60,60,0.45); border: 1px solid rgba(200,60,60,0.65);
  color: #fff; font-size: 13px; font-weight: 500;
  cursor: pointer; flex-shrink: 0; height: 36px;
}
.ai-stop-btn:hover { background: rgba(200,60,60,0.65); }
.ai-input-hint {
  padding: 0 10px 8px;
  font-size: 10.5px; color: rgba(255,255,255,0.2);
  flex-shrink: 0;
}
/* ── Header buttons ── */
.ai-hdr-btn {
  padding: 3px 8px; border-radius: 5px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
  display: flex; align-items: center; gap: 3px;
}
.ai-hdr-btn:hover { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }
.ai-hdr-btn svg { width: 13px; height: 13px; }
.ai-backend-select {
  padding: 3px 6px; border-radius: 5px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
  font-family: inherit; outline: none;
}
.ai-backend-select:hover { background: rgba(255,255,255,0.1); }
/* ── Docked mode ── */
.ai-panel--docked {
  position: static !important;
  transform: none !important;
  width: auto !important;
  right: auto; top: auto; bottom: auto;
  flex: 1; min-height: 0;
  box-shadow: none; border-left: none;
}
.ai-panel--docked, .ai-panel--docked.ai-panel-open { display: flex; }
.ai-panel--docked .ai-hdr-btn[title="Close"] { display: none; }

/* ── Light theme ── */
[data-bpmn-hud-theme="light"] .ai-panel {
  background: rgba(252,252,254,0.98);
  border-left-color: rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.8);
  box-shadow: -4px 0 20px rgba(0,0,0,0.12);
}
[data-bpmn-hud-theme="light"] .ai-panel-header { border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .ai-panel-title { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .ai-panel-status { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .ai-msg-user {
  background: rgba(0,80,200,0.1); border-color: rgba(0,80,200,0.2);
}
[data-bpmn-hud-theme="light"] .ai-msg-ai {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.08);
}
[data-bpmn-hud-theme="light"] .ai-md-code { background: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .ai-msg-copy {
  border-color: rgba(0,0,0,0.12); color: rgba(0,0,0,0.35);
}
[data-bpmn-hud-theme="light"] .ai-msg-copy:hover { color: rgba(0,0,0,0.7); border-color: rgba(0,0,0,0.2); }
[data-bpmn-hud-theme="light"] .ai-msg-apply {
  background: rgba(0,150,60,0.1); border-color: rgba(0,150,60,0.25); color: #0a7030;
}
[data-bpmn-hud-theme="light"] .ai-msg-code { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .ai-welcome-title { color: rgba(0,0,0,0.85); }
[data-bpmn-hud-theme="light"] .ai-welcome-sub { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .ai-welcome-example {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.09); color: rgba(0,0,0,0.6);
}
[data-bpmn-hud-theme="light"] .ai-welcome-example:hover { background: rgba(0,0,0,0.06); color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .ai-quick-actions { border-top-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .ai-quick-btn {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-quick-btn:hover:not(:disabled) { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.8); }
[data-bpmn-hud-theme="light"] .ai-context-refs { border-top-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .ai-context-badge {
  background: rgba(0,80,200,0.08); border-color: rgba(0,80,200,0.2); color: rgba(0,60,180,0.85);
}
[data-bpmn-hud-theme="light"] .ai-context-badge__remove { color: rgba(0,60,180,0.45); }
[data-bpmn-hud-theme="light"] .ai-context-badge__remove:hover { color: rgba(0,0,0,0.8); }
[data-bpmn-hud-theme="light"] .ai-msg-context-chip {
  background: rgba(0,80,200,0.08); border-color: rgba(0,80,200,0.2); color: rgba(0,60,180,0.85);
}
[data-bpmn-hud-theme="light"] .ai-input-area { border-top-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .ai-textarea {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.12); color: rgba(0,0,0,0.8);
}
[data-bpmn-hud-theme="light"] .ai-textarea:focus { border-color: rgba(0,80,200,0.4); }
[data-bpmn-hud-theme="light"] .ai-textarea::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .ai-send-btn { background: rgba(0,80,200,0.85); border-color: rgba(0,80,200,0.9); }
[data-bpmn-hud-theme="light"] .ai-stop-btn { background: rgba(180,40,40,0.75); border-color: rgba(180,40,40,0.9); }
[data-bpmn-hud-theme="light"] .ai-input-hint { color: rgba(0,0,0,0.25); }
[data-bpmn-hud-theme="light"] .ai-hdr-btn {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-hdr-btn:hover { color: rgba(0,0,0,0.85); }
[data-bpmn-hud-theme="light"] .ai-backend-select {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-hist-panel { background: rgba(252,252,254,0.98); border-color: rgba(0,0,0,0.1); }
[data-bpmn-hud-theme="light"] .ai-hist-header { color: rgba(0,0,0,0.88); border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .ai-hist-time { color: rgba(0,0,0,0.45); }
[data-bpmn-hud-theme="light"] .ai-hist-item { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmn-hud-theme="light"] .ai-hist-item:hover { background: rgba(0,0,0,0.03); }
[data-bpmn-hud-theme="light"] .ai-hist-empty { color: rgba(0,0,0,0.35); }
`;
	document.head.appendChild(style);
}
