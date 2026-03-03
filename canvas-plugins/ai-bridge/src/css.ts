const STYLE_ID = "ai-bridge-styles";

export function injectAiBridgeStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
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
.ai-panel-header-actions { display: flex; gap: 4px; }
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
.ai-messages {
  flex: 1; overflow-y: auto; padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
}
.ai-msg {
  border-radius: 8px; padding: 8px 12px;
  line-height: 1.5; word-break: break-word;
  white-space: pre-wrap;
}
.ai-msg-user {
  background: rgba(60,120,220,0.25);
  border: 1px solid rgba(60,120,220,0.35);
  align-self: flex-end; max-width: 85%;
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
.ai-msg-apply {
  margin-top: 8px; padding: 5px 12px;
  background: rgba(60,180,100,0.25); border: 1px solid rgba(60,180,100,0.4);
  border-radius: 6px; color: rgba(120,230,140,0.9);
  font-size: 12px; cursor: pointer; font-weight: 500;
}
.ai-msg-apply:hover { background: rgba(60,180,100,0.38); }
.ai-msg-code {
  background: rgba(0,0,0,0.3); border-radius: 5px;
  padding: 8px; margin: 6px 0;
  font-family: monospace; font-size: 11.5px;
  color: rgba(255,255,255,0.65);
  overflow-x: auto; white-space: pre;
}
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
  transition: background 0.15s, color 0.15s;
}
.ai-quick-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); color: rgba(255,255,255,0.9); }
.ai-quick-btn:disabled { opacity: 0.35; cursor: default; }
.ai-input-area {
  padding: 10px; border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; gap: 8px; align-items: flex-end;
  flex-shrink: 0;
}
.ai-textarea {
  flex: 1; min-height: 36px; max-height: 120px;
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 6px; color: rgba(255,255,255,0.85);
  font-size: 13px; font-family: inherit;
  padding: 7px 10px; resize: vertical;
  outline: none;
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
.ai-hdr-btn {
  padding: 3px 8px; border-radius: 5px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
}
.ai-hdr-btn:hover { background: rgba(255,255,255,0.1); }
.ai-backend-select {
  padding: 3px 6px; border-radius: 5px;
  background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.6); font-size: 12px; cursor: pointer;
  font-family: inherit; outline: none;
}
.ai-backend-select:hover { background: rgba(255,255,255,0.1); }
/* Docked mode — renders inside a dock pane instead of as a fixed overlay */
.ai-panel--docked {
  position: static !important;
  transform: none !important;
  width: auto !important;
  right: auto; top: auto; bottom: auto;
  flex: 1; min-height: 0;
  box-shadow: none; border-left: none;
}
/* always visible — tab strip controls which pane shows */
.ai-panel--docked, .ai-panel--docked.ai-panel-open { display: flex; }
/* hide the standalone close button; dock tab strip fills that role */
.ai-panel--docked .ai-hdr-btn[title="Close"] { display: none; }

/* Light theme */
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
[data-bpmn-hud-theme="light"] .ai-msg-apply {
  background: rgba(0,150,60,0.1); border-color: rgba(0,150,60,0.25); color: #0a7030;
}
[data-bpmn-hud-theme="light"] .ai-msg-code { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .ai-textarea {
  background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.12); color: rgba(0,0,0,0.8);
}
[data-bpmn-hud-theme="light"] .ai-textarea:focus { border-color: rgba(0,80,200,0.4); }
[data-bpmn-hud-theme="light"] .ai-textarea::placeholder { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .ai-send-btn { background: rgba(0,80,200,0.85); border-color: rgba(0,80,200,0.9); }
[data-bpmn-hud-theme="light"] .ai-hdr-btn {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-backend-select {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-quick-actions { border-top-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .ai-quick-btn {
  background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.1); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .ai-quick-btn:hover:not(:disabled) { background: rgba(0,0,0,0.08); color: rgba(0,0,0,0.8); }
[data-bpmn-hud-theme="light"] .ai-input-area { border-top-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .ai-hist-panel { background: rgba(252,252,254,0.98); border-color: rgba(0,0,0,0.1); }
[data-bpmn-hud-theme="light"] .ai-hist-header { color: rgba(0,0,0,0.88); border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .ai-hist-time { color: rgba(0,0,0,0.45); }
[data-bpmn-hud-theme="light"] .ai-hist-item { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmn-hud-theme="light"] .ai-hist-item:hover { background: rgba(0,0,0,0.03); }
[data-bpmn-hud-theme="light"] .ai-hist-empty { color: rgba(0,0,0,0.35); }
`;
	document.head.appendChild(style);
}
