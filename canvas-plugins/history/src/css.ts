const STYLE_ID = "bpmn-history-styles";

export function injectHistoryStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
/* ── History pane ────────────────────────────────────────────────────────── */
.bpmn-hist-pane {
  display: flex; flex-direction: column; height: 100%; overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}
.bpmn-hist-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px 9px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bpmn-hist-header-title {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
}
.bpmn-hist-refresh {
  width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
  background: transparent; border: none; border-radius: 4px;
  color: rgba(255,255,255,0.35); cursor: pointer; font-size: 14px; line-height: 1;
  transition: color 0.1s, background 0.1s;
}
.bpmn-hist-refresh:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.07); }
.bpmn-hist-list {
  flex: 1; overflow-y: auto; padding: 4px 0 8px;
}
.bpmn-hist-list::-webkit-scrollbar { width: 4px; }
.bpmn-hist-list::-webkit-scrollbar-track { background: transparent; }
.bpmn-hist-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 2px; }
.bpmn-hist-group-label {
  padding: 10px 14px 3px;
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: rgba(255,255,255,0.28);
}
.bpmn-hist-item {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 14px; gap: 10px;
  transition: background 0.1s;
}
.bpmn-hist-item:hover { background: rgba(255,255,255,0.04); }
.bpmn-hist-item-time {
  font-size: 12.5px; color: rgba(255,255,255,0.65);
  font-variant-numeric: tabular-nums; flex: 1;
}
.bpmn-hist-restore {
  flex-shrink: 0; font-size: 11px; padding: 3px 9px;
  background: rgba(76,142,247,0.14); border: 1px solid rgba(76,142,247,0.3);
  border-radius: 4px; color: rgba(140,185,255,0.85);
  cursor: pointer; font-family: inherit;
  transition: background 0.1s, border-color 0.1s, color 0.1s;
}
.bpmn-hist-restore:hover {
  background: rgba(76,142,247,0.26); border-color: rgba(76,142,247,0.52);
  color: rgba(180,210,255,0.95);
}
.bpmn-hist-empty {
  padding: 32px 20px; text-align: center;
  color: rgba(255,255,255,0.28); font-size: 12px; line-height: 1.65;
}
/* ── Confirm dialog ──────────────────────────────────────────────────────── */
.bpmn-hist-confirm-overlay {
  position: fixed; inset: 0; z-index: 10100;
  background: rgba(0,0,0,0.55);
  display: flex; align-items: center; justify-content: center;
}
.bpmn-hist-confirm-panel {
  background: rgba(22,22,32,0.98); border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px; padding: 20px 22px; width: 300px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.7);
  font-family: system-ui, -apple-system, sans-serif;
}
.bpmn-hist-confirm-title {
  font-size: 13.5px; font-weight: 600; color: rgba(255,255,255,0.9); margin-bottom: 7px;
}
.bpmn-hist-confirm-body {
  font-size: 12px; color: rgba(255,255,255,0.5); line-height: 1.55; margin-bottom: 18px;
}
.bpmn-hist-confirm-actions { display: flex; justify-content: flex-end; gap: 7px; }
.bpmn-hist-confirm-cancel {
  padding: 5px 13px; background: transparent;
  border: 1px solid rgba(255,255,255,0.14); border-radius: 6px;
  color: rgba(255,255,255,0.55); font-size: 12px; cursor: pointer; font-family: inherit;
  transition: background 0.1s, color 0.1s;
}
.bpmn-hist-confirm-cancel:hover { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.85); }
.bpmn-hist-confirm-ok {
  padding: 5px 13px; background: rgba(76,142,247,0.9);
  border: 1px solid rgba(76,142,247,1); border-radius: 6px;
  color: #fff; font-size: 12px; font-weight: 500; cursor: pointer; font-family: inherit;
  transition: background 0.1s;
}
.bpmn-hist-confirm-ok:hover { background: #4c8ef7; }
/* ── Light theme ─────────────────────────────────────────────────────────── */
[data-bpmn-hud-theme="light"] .bpmn-hist-header { border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .bpmn-hist-header-title { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-hist-refresh { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .bpmn-hist-refresh:hover { color: rgba(0,0,0,0.75); background: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-hist-group-label { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-hist-item:hover { background: rgba(0,0,0,0.035); }
[data-bpmn-hud-theme="light"] .bpmn-hist-item-time { color: rgba(0,0,0,0.65); }
[data-bpmn-hud-theme="light"] .bpmn-hist-restore {
  background: rgba(26,86,219,0.08); border-color: rgba(26,86,219,0.25); color: rgba(26,86,219,0.9);
}
[data-bpmn-hud-theme="light"] .bpmn-hist-restore:hover {
  background: rgba(26,86,219,0.16); border-color: rgba(26,86,219,0.45); color: rgba(26,86,219,1);
}
[data-bpmn-hud-theme="light"] .bpmn-hist-empty { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-panel {
  background: rgba(252,252,255,0.99); border-color: rgba(0,0,0,0.1);
  box-shadow: 0 20px 60px rgba(0,0,0,0.18);
}
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-title { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-body { color: rgba(0,0,0,0.5); }
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-cancel {
  border-color: rgba(0,0,0,0.14); color: rgba(0,0,0,0.55);
}
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-cancel:hover {
  background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.8);
}
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-ok { background: #1a56db; border-color: #1a56db; }
[data-bpmn-hud-theme="light"] .bpmn-hist-confirm-ok:hover { background: #1648c2; }
`;
	document.head.appendChild(style);
}
