const STYLE_ID = "bpmn-process-runner-v1"

const CSS = `
/* ── Toolbar ──────────────────────────────────────────────────────────── */
.bpmn-runner-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* HUD bottom-center placement (used when toolbar replaces #hud-bottom-center) */
.bpmn-runner-toolbar--hud-bottom {
  position: fixed;
  z-index: 100;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bpmn-panel-bg, rgba(13,13,22,0.92));
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  backdrop-filter: blur(12px);
  padding: 4px;
  gap: 4px;
}
[data-bpmn-hud-theme="light"] .bpmn-runner-toolbar--hud-bottom {
  background: rgba(255,255,255,0.96);
  border-color: rgba(0,0,0,0.1);
  box-shadow: 0 2px 16px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .bpmn-runner-btn--exit {
  background: #e5e7eb;
  color: #374151;
}
[data-bpmn-hud-theme="light"] .bpmn-runner-btn--exit:hover { background: #d1d5db; }

/* ── Split play button ────────────────────────────────────────────────── */
.bpmn-runner-split {
  display: flex;
  border-radius: 6px;
  overflow: visible;
  position: relative;
}

.bpmn-runner-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  background: #2563eb;
  color: #fff;
  white-space: nowrap;
  line-height: 1.4;
  transition: background 0.12s;
}
.bpmn-runner-btn:first-child {
  border-radius: 6px 0 0 6px;
}
.bpmn-runner-split .bpmn-runner-btn:last-child {
  border-radius: 0 6px 6px 0;
  border-left: 1px solid rgba(255,255,255,0.25);
  padding: 6px 9px;
}
.bpmn-runner-btn:only-child {
  border-radius: 6px;
}
.bpmn-runner-btn:hover:not(:disabled) {
  background: #1d4ed8;
}
.bpmn-runner-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stop */
.bpmn-runner-btn--stop {
  background: #dc2626;
  border-radius: 6px;
}
.bpmn-runner-btn--stop:hover {
  background: #b91c1c;
}

/* Step (idle: start step mode) */
.bpmn-runner-btn--step {
  background: #7c3aed;
  border-radius: 6px;
}
.bpmn-runner-btn--step:hover:not(:disabled) {
  background: #6d28d9;
}

/* Step pending (running-step, user can advance) */
.bpmn-runner-btn--step-pending {
  background: #d97706;
  border-radius: 6px;
}
.bpmn-runner-btn--step-pending:hover {
  background: #b45309;
}

/* Step waiting (running-step, process is mid-execution, not paused yet) */
.bpmn-runner-btn--step-waiting {
  background: #6b7280;
  border-radius: 6px;
}

/* Exit play mode */
.bpmn-runner-btn--exit {
  background: #374151;
  border-radius: 6px;
}
.bpmn-runner-btn--exit:hover {
  background: #4b5563;
}

/* ── Dropdown menu ────────────────────────────────────────────────────── */
.bpmn-runner-dropdown {
  position: fixed;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
  min-width: 190px;
  z-index: 20;
  overflow: hidden;
}
.bpmn-runner-dropdown[data-theme="dark"] {
  background: #1f2937;
  border-color: #374151;
  color: #f9fafb;
}

.bpmn-runner-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 9px 14px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  color: inherit;
  box-sizing: border-box;
}
.bpmn-runner-dropdown-item:hover {
  background: #f3f4f6;
}
.bpmn-runner-dropdown[data-theme="dark"] .bpmn-runner-dropdown-item:hover {
  background: #374151;
}

/* ── Payload modal ────────────────────────────────────────────────────── */
.bpmn-runner-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bpmn-runner-modal {
  background: #ffffff;
  border-radius: 10px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
  font-family: inherit;
}
.bpmn-runner-modal[data-theme="dark"] {
  background: #1f2937;
  color: #f9fafb;
}

.bpmn-runner-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}

.bpmn-runner-modal-textarea {
  width: 100%;
  box-sizing: border-box;
  height: 180px;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 13px;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  resize: vertical;
  background: #f9fafb;
  color: inherit;
}
.bpmn-runner-modal[data-theme="dark"] .bpmn-runner-modal-textarea {
  background: #111827;
  border-color: #374151;
  color: #f9fafb;
}

.bpmn-runner-modal-error {
  color: var(--bpmn-danger, #dc2626);
  font-size: 12px;
  margin-top: 6px;
  min-height: 18px;
}

.bpmn-runner-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.bpmn-runner-modal-btn {
  padding: 7px 18px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
}
.bpmn-runner-modal-btn--cancel {
  background: #f3f4f6;
  color: #374151;
}
.bpmn-runner-modal-btn--cancel:hover {
  background: #e5e7eb;
}
.bpmn-runner-modal[data-theme="dark"] .bpmn-runner-modal-btn--cancel {
  background: #374151;
  color: #f9fafb;
}
.bpmn-runner-modal-btn--run {
  background: #2563eb;
  color: #fff;
}
.bpmn-runner-modal-btn--run:hover {
  background: #1d4ed8;
}

/* ── Play panel (mounted inside dock.playPane) ────────────────────────── */
.bpmn-runner-play-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: rgba(255,255,255,0.75);
  font-size: 12px;
  font-family: system-ui, -apple-system, sans-serif;
}

.bpmn-runner-play-tabs {
  display: flex;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}

.bpmn-runner-play-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
}
.bpmn-runner-play-tab:hover { color: rgba(255,255,255,0.75); }
.bpmn-runner-play-tab--active { color: var(--bpmn-accent, #6b9df7); border-bottom-color: var(--bpmn-accent, #6b9df7); }

.bpmn-runner-play-pane {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  min-height: 0;
}
.bpmn-runner-play-pane--hidden { display: none !important; }

.bpmn-runner-play-empty {
  color: rgba(255,255,255,0.25);
  text-align: center;
  padding: 20px 0;
}

/* Variables */
.bpmn-runner-play-var-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmn-runner-play-var-name { color: rgba(255,255,255,0.55); flex-shrink: 0; }
.bpmn-runner-play-var-name::after { content: ":"; margin-left: 1px; }
.bpmn-runner-play-var-value {
  color: #a5f3fc;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
  word-break: break-all;
}

/* FEEL evaluations */
.bpmn-runner-play-feel-group { margin-bottom: 14px; }
.bpmn-runner-play-feel-header {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  padding: 3px 0;
  border-bottom: 1px solid rgba(255,255,255,0.07);
  margin-bottom: 6px;
}
.bpmn-runner-play-feel-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.bpmn-runner-play-feel-prop { color: rgba(255,255,255,0.4); font-size: 11px; }
.bpmn-runner-play-feel-expr {
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
  color: #fde68a;
  background: rgba(255,255,255,0.06);
  padding: 2px 5px;
  border-radius: 3px;
  display: block;
}
.bpmn-runner-play-feel-result-row { display: flex; align-items: center; gap: 5px; }
.bpmn-runner-play-feel-arrow { color: rgba(255,255,255,0.3); }
.bpmn-runner-play-feel-result {
  color: #a5f3fc;
  font-family: ui-monospace, "SFMono-Regular", "Menlo", monospace;
  font-size: 11px;
}

/* ── Errors tab ──────────────────────────────────────────────────────────── */
.bpmn-runner-play-error-row {
  padding: 8px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmn-runner-play-error-id {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(248,113,113,0.7);
  margin-bottom: 2px;
}
.bpmn-runner-play-error-msg {
  font-size: 12px;
  color: var(--bpmn-danger, #f87171);
}

/* ── Input variables tab ──────────────────────────────────────────────────── */
.bpmn-runner-play-ivar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.bpmn-runner-play-ivar-name,
.bpmn-runner-play-ivar-value {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 4px;
  color: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 7px;
}
.bpmn-runner-play-ivar-name { width: 90px; flex-shrink: 0; }
.bpmn-runner-play-ivar-value { flex: 1; min-width: 0; }
.bpmn-runner-play-ivar-name:focus,
.bpmn-runner-play-ivar-value:focus { outline: none; border-color: var(--bpmn-accent, #6b9df7); }
.bpmn-runner-play-ivar-eq { color: rgba(255,255,255,0.3); font-size: 12px; flex-shrink: 0; }
.bpmn-runner-play-ivar-del {
  background: none;
  border: none;
  color: rgba(255,255,255,0.3);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  flex-shrink: 0;
  line-height: 1;
}
.bpmn-runner-play-ivar-del:hover { color: var(--bpmn-danger, #f87171); }
.bpmn-runner-play-ivar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px dashed rgba(255,255,255,0.2);
  border-radius: 4px;
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 10px;
  width: 100%;
  margin-top: 8px;
  box-sizing: border-box;
}
.bpmn-runner-play-ivar-add:hover { border-color: var(--bpmn-accent, #6b9df7); color: var(--bpmn-accent, #6b9df7); }

/* ── Light theme overrides ───────────────────────────────────────────────── */
[data-bpmn-hud-theme="light"] .bpmn-runner-play-panel { color: rgba(0,0,0,0.75); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-tabs { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-tab { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-tab:hover { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-tab--active { color: var(--bpmn-accent, #1a56db); border-bottom-color: var(--bpmn-accent, #1a56db); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-empty { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-var-name { color: rgba(0,0,0,0.6); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-var-value { color: #0369a1; }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-var-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-header { color: rgba(0,0,0,0.35); border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-prop { color: rgba(0,0,0,0.45); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-expr { color: #92400e; background: rgba(0,0,0,0.04); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-arrow { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-result { color: #0369a1; }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-feel-row { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-error-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-error-id { color: rgba(220,38,38,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-error-msg { color: var(--bpmn-danger, #dc2626); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-name,
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-value {
  background: rgba(0,0,0,0.04);
  border-color: rgba(0,0,0,0.12);
  color: rgba(0,0,0,0.75);
}
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-eq { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-del { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-del:hover { color: var(--bpmn-danger, #dc2626); }
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-add {
  border-color: rgba(0,0,0,0.2);
  color: rgba(0,0,0,0.4);
}
[data-bpmn-hud-theme="light"] .bpmn-runner-play-ivar-add:hover { border-color: var(--bpmn-accent, #1a56db); color: var(--bpmn-accent, #1a56db); }
`

export function injectProcessRunnerStyles(): void {
	if (typeof document === "undefined") return
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
