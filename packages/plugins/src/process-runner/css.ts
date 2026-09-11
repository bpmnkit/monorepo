import { injectChromeStyles } from "@bpmnkit/editor"

const STYLE_ID = "bpmnkit-process-runner-v1"

const CSS = `
/* ── Toolbar ──────────────────────────────────────────────────────────── */
.bpmnkit-runner-toolbar {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* HUD bottom-center placement (used when toolbar replaces #hud-bottom-center) */
.bpmnkit-runner-toolbar--hud-bottom {
  position: fixed;
  z-index: 100;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-hover);
  padding: 4px;
  gap: 4px;
}

/* ── Split play button ────────────────────────────────────────────────── */
.bpmnkit-runner-split {
  display: flex;
  overflow: visible;
  position: relative;
}

.bpmnkit-runner-chaos-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  user-select: none;
  padding: 0 4px;
}
.bpmnkit-runner-chaos-label:has(.bpmnkit-runner-chaos-checkbox:checked) {
  color: var(--bpmnkit-warn, #f59e0b);
}

.bpmnkit-runner-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
  background: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
  white-space: nowrap;
  line-height: 1.4;
  transition: background 0.12s;
}
.bpmnkit-runner-btn:first-child {
}
.bpmnkit-runner-split .bpmnkit-runner-btn:last-child {
  border-left: 1px solid var(--bpmnkit-chrome-ink-4);
  padding: 6px 9px;
}
.bpmnkit-runner-btn:only-child {
}
.bpmnkit-runner-btn:hover:not(:disabled) {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
}
.bpmnkit-runner-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stop */
.bpmnkit-runner-btn--stop {
  background: var(--bpmnkit-danger, #dc2626);
}
.bpmnkit-runner-btn--stop:hover {
  background: var(--bpmnkit-danger, #dc2626);
}

/* Step (idle: start step mode) */
.bpmnkit-runner-btn--step {
  background: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-runner-btn--step:hover:not(:disabled) {
  background: var(--bpmnkit-chrome-ink);
}

/* Step pending (running-step, user can advance) */
.bpmnkit-runner-btn--step-pending {
  background: var(--bpmnkit-warn, #d97706);
}
.bpmnkit-runner-btn--step-pending:hover {
  background: var(--bpmnkit-warn, #d97706);
}

/* Step waiting (running-step, process is mid-execution, not paused yet) */
.bpmnkit-runner-btn--step-waiting {
  background: var(--bpmnkit-chrome-ink-4);
}

/* Exit play mode */
.bpmnkit-runner-btn--exit {
  background: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-runner-btn--exit:hover {
  background: var(--bpmnkit-chrome-ink);
}

/* ── Dropdown menu ────────────────────────────────────────────────────── */
.bpmnkit-runner-dropdown {
  position: fixed;
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  min-width: 190px;
  z-index: 20;
  overflow: hidden;
}

.bpmnkit-runner-dropdown-item {
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
.bpmnkit-runner-dropdown-item:hover {
  background: var(--bpmnkit-chrome-ground-2);
}

/* ── Payload modal ────────────────────────────────────────────────────── */
.bpmnkit-runner-modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--bpmnkit-chrome-scrim);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bpmnkit-runner-modal {
  background: var(--bpmnkit-chrome-ground);
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  font-family: inherit;
}

.bpmnkit-runner-modal-title {
  font-size: 15px;
  font-weight: 600;
  margin: 0 0 14px;
}

.bpmnkit-runner-modal-textarea {
  width: 100%;
  box-sizing: border-box;
  height: 180px;
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 13px;
  padding: 10px 12px;
  border: 1px solid var(--bpmnkit-chrome-line);
  resize: vertical;
  background: var(--bpmnkit-chrome-ground-2);
  color: inherit;
}

.bpmnkit-runner-modal-error {
  color: var(--bpmnkit-danger, #dc2626);
  font-size: 12px;
  margin-top: 6px;
  min-height: 18px;
}

.bpmnkit-runner-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
}

.bpmnkit-runner-modal-btn {
  padding: 7px 18px;
  border: none;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
  font-weight: 500;
}
.bpmnkit-runner-modal-btn--cancel {
  background: transparent;
  border: 1px solid var(--bpmnkit-chrome-line);
  color: var(--bpmnkit-chrome-ink-2);
}
.bpmnkit-runner-modal-btn--cancel:hover {
  background: var(--bpmnkit-chrome-hover);
  color: var(--bpmnkit-chrome-ink);
}
.bpmnkit-runner-modal-btn--run {
  background: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
}
.bpmnkit-runner-modal-btn--run:hover {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
}

/* ── Play panel (mounted inside dock.playPane) ────────────────────────── */
.bpmnkit-runner-play-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  color: var(--bpmnkit-chrome-ink-2);
  font-size: 12px;
  font-family: var(--bpmnkit-chrome-font);
}

.bpmnkit-runner-play-tabs {
  display: flex;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
  flex-shrink: 0;
}

.bpmnkit-runner-play-tab {
  padding: 8px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  font-family: inherit;
  white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
}
.bpmnkit-runner-play-tab:hover { color: var(--bpmnkit-chrome-ink-2); }
.bpmnkit-runner-play-tab--active { color: var(--bpmnkit-chrome-accent); border-bottom-color: var(--bpmnkit-chrome-accent); }

.bpmnkit-runner-play-pane {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
  min-height: 0;
}
.bpmnkit-runner-play-pane--hidden { display: none !important; }

/* ── Timeline scrubber ───────────────────────────────────────────────────── */
.bpmnkit-runner-scrubber-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  font-size: 11px;
}
.bpmnkit-runner-scrubber {
  flex: 1;
  height: 4px;
  accent-color: var(--bpmnkit-chrome-accent);
  cursor: pointer;
}
.bpmnkit-runner-scrubber-index {
  color: var(--bpmnkit-chrome-ink-4);
  white-space: nowrap;
  min-width: 100px;
  text-align: right;
}
.bpmnkit-runner-scrubber-live,
.bpmnkit-runner-scrubber-replay {
  background: none;
  border: 1px solid var(--bpmnkit-chrome-ink-4);
  color: var(--bpmnkit-chrome-ink-2);
  font-size: 10px;
  padding: 2px 6px;
  cursor: pointer;
  white-space: nowrap;
}
.bpmnkit-runner-scrubber-live:hover,
.bpmnkit-runner-scrubber-replay:hover { border-color: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent); }

.bpmnkit-runner-play-empty {
  color: var(--bpmnkit-chrome-ink-4);
  text-align: center;
  padding: 20px 0;
}

/* Variables */
.bpmnkit-runner-play-var-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-play-var-name { color: var(--bpmnkit-chrome-ink-2); flex-shrink: 0; }
.bpmnkit-runner-play-var-name::after { content: ":"; margin-left: 1px; }
.bpmnkit-runner-play-var-value {
  color: var(--bpmnkit-chrome-accent);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
  word-break: break-all;
}

/* FEEL evaluations */
.bpmnkit-runner-play-feel-group { margin-bottom: 14px; }
.bpmnkit-runner-play-feel-header {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4);
  padding: 3px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  margin-bottom: 6px;
}
.bpmnkit-runner-play-feel-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 6px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-play-feel-prop { color: var(--bpmnkit-chrome-ink-4); font-size: 11px; }
.bpmnkit-runner-play-feel-expr {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink);
  background: var(--bpmnkit-chrome-hover);
  padding: 2px 5px;
  display: block;
}
.bpmnkit-runner-play-feel-result-row { display: flex; align-items: center; gap: 5px; }
.bpmnkit-runner-play-feel-arrow { color: var(--bpmnkit-chrome-ink-4); }
.bpmnkit-runner-play-feel-result {
  color: var(--bpmnkit-chrome-accent);
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 11px;
}

/* ── Errors tab ──────────────────────────────────────────────────────────── */
.bpmnkit-runner-play-error-row {
  padding: 8px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-play-error-id {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-danger, #dc2626);
  margin-bottom: 2px;
}
.bpmnkit-runner-play-error-msg {
  font-size: 12px;
  color: var(--bpmnkit-danger, #f87171);
}

/* ── Input variables tab ──────────────────────────────────────────────────── */
.bpmnkit-runner-play-ivar-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-play-ivar-name,
.bpmnkit-runner-play-ivar-value {
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 7px;
}
.bpmnkit-runner-play-ivar-name { width: 90px; flex-shrink: 0; }
.bpmnkit-runner-play-ivar-value { flex: 1; min-width: 0; }
.bpmnkit-runner-play-ivar-name:focus,
.bpmnkit-runner-play-ivar-value:focus { outline: none; border-color: var(--bpmnkit-chrome-accent); }
.bpmnkit-runner-play-ivar-eq { color: var(--bpmnkit-chrome-ink-4); font-size: 12px; flex-shrink: 0; }
.bpmnkit-runner-play-ivar-del {
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 14px;
  padding: 0 4px;
  flex-shrink: 0;
  line-height: 1;
}
.bpmnkit-runner-play-ivar-del:hover { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-play-ivar-add {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px dashed var(--bpmnkit-chrome-ink-4);
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-size: 12px;
  font-family: inherit;
  padding: 6px 10px;
  width: 100%;
  margin-top: 8px;
  box-sizing: border-box;
}
.bpmnkit-runner-play-ivar-add:hover { border-color: var(--bpmnkit-chrome-accent); color: var(--bpmnkit-chrome-accent); }

/* ── Input variable hints (from validation DMN) ──────────────────────────── */
.bpmnkit-runner-play-ivar-hints {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: var(--bpmnkit-chrome-accent-subtle);
  border-bottom: 1px solid var(--bpmnkit-chrome-accent-subtle);
  font-size: 11px;
}
.bpmnkit-runner-play-ivar-hints-label {
  color: var(--bpmnkit-chrome-ink-4);
  flex-shrink: 0;
}
.bpmnkit-runner-play-ivar-hint-chip {
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
  padding: 1px 5px;
  font-family: var(--bpmnkit-chrome-mono);
}

/* ── Tests tab ───────────────────────────────────────────────────────────── */
.bpmnkit-runner-tests-header {
  display: flex;
  gap: 6px;
  align-items: center;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  margin-bottom: 8px;
}
.bpmnkit-runner-tests-run-all, .bpmnkit-runner-tests-add { font-size: 11px; padding: 3px 8px; }
.bpmnkit-runner-tests-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-tests-pass .bpmnkit-runner-tests-status { color: var(--bpmnkit-success, #22c55e); }
.bpmnkit-runner-tests-fail .bpmnkit-runner-tests-status { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-tests-status { font-size: 14px; width: 16px; text-align: center; }
.bpmnkit-runner-tests-name {
  flex: 1;
  background: none;
  border: none;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  color: inherit;
  font-size: 12px;
  padding: 2px 4px;
}
.bpmnkit-runner-tests-name:focus { outline: none; border-color: var(--bpmnkit-chrome-accent); }
.bpmnkit-runner-tests-run-one, .bpmnkit-runner-tests-del {
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 12px;
}
.bpmnkit-runner-tests-run-one:hover { color: var(--bpmnkit-chrome-accent); }
.bpmnkit-runner-tests-del:hover { color: var(--bpmnkit-danger, #f87171); }
.bpmnkit-runner-tests-diff {
  padding: 4px 0 4px 22px;
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
}
.bpmnkit-runner-tests-diff-row { padding: 1px 0; }
.bpmnkit-runner-tests-diff-error { color: var(--bpmnkit-danger, #f87171); }

/* ── Tests tab extra buttons ─────────────────────────────────────────────── */
.bpmnkit-runner-tests-gen, .bpmnkit-runner-tests-chaos-import { font-size: 11px; padding: 3px 8px; }
.bpmnkit-runner-tests-chaos-import {
  color: var(--bpmnkit-warn, #f59e0b);
  border-color: var(--bpmnkit-warn, #f59e0b);
}
.bpmnkit-runner-tests-chaos-import:hover {
  background: var(--bpmnkit-warn, #d97706);
}

/* ── Scenario editor ─────────────────────────────────────────────────────── */
.bpmnkit-runner-tests-editor-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.bpmnkit-runner-tests-back {
  font-size: 11px;
  padding: 3px 8px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-editor-name {
  flex: 1;
  min-width: 80px;
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: inherit;
  font-size: 12px;
  font-family: inherit;
  padding: 4px 7px;
}
.bpmnkit-runner-tests-editor-name:focus { outline: none; border-color: var(--bpmnkit-chrome-accent); }
.bpmnkit-runner-tests-editor-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-editor-badge--pass { color: var(--bpmnkit-success, #22c55e); }
.bpmnkit-runner-tests-editor-badge--fail { color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-danger, #dc2626); }

.bpmnkit-runner-tests-section-title {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--bpmnkit-chrome-ink-4);
  padding: 10px 0 4px;
  border-bottom: 1px solid var(--bpmnkit-chrome-hover);
  margin-bottom: 6px;
}
.bpmnkit-runner-tests-varlist { margin-bottom: 4px; }

.bpmnkit-runner-tests-hint {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
  margin-bottom: 6px;
  font-style: italic;
}

.bpmnkit-runner-tests-task {
  border: 1px solid var(--bpmnkit-chrome-line-soft);
  margin-bottom: 6px;
  overflow: hidden;
}
.bpmnkit-runner-tests-task--focused {
  border-color: var(--bpmnkit-chrome-accent);
}
.bpmnkit-runner-tests-task-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  cursor: pointer;
  user-select: none;
  background: var(--bpmnkit-chrome-line-soft);
}
.bpmnkit-runner-tests-task-header:hover { background: var(--bpmnkit-chrome-hover); }
.bpmnkit-runner-tests-task--focused .bpmnkit-runner-tests-task-header {
  background: var(--bpmnkit-chrome-accent-subtle);
}
.bpmnkit-runner-tests-task-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.bpmnkit-runner-tests-task-badge {
  font-size: 10px;
  color: var(--bpmnkit-chrome-ink-4);
  background: var(--bpmnkit-chrome-hover);
  padding: 1px 5px;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-task-body {
  padding: 8px 10px;
  border-top: 1px solid var(--bpmnkit-chrome-hover);
}
.bpmnkit-runner-tests-error-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.bpmnkit-runner-tests-error-label {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink-4);
  flex-shrink: 0;
}
.bpmnkit-runner-tests-error-input {
  flex: 1;
  background: var(--bpmnkit-chrome-hover);
  border: 1px solid var(--bpmnkit-chrome-line);
  color: inherit;
  font-size: 11px;
  font-family: inherit;
  padding: 3px 6px;
}
.bpmnkit-runner-tests-error-input:focus { outline: none; border-color: var(--bpmnkit-danger, #f87171); }

.bpmnkit-runner-tests-name-label {
  flex: 1;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-runner-tests-edit {
  background: none;
  border: none;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  padding: 2px 4px;
  font-size: 13px;
}
.bpmnkit-runner-tests-edit:hover { color: var(--bpmnkit-chrome-accent); }

/* ── Last Run Trace ──────────────────────────────────────────────────────── */
.bpmnkit-runner-tests-trace-tabs {
  margin-top: 4px;
}
.bpmnkit-runner-tests-trace-pane {
  padding: 8px 0;
  max-height: 220px;
  overflow-y: auto;
}
.bpmnkit-runner-tests-trace-elem-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 2px 0;
}
.bpmnkit-runner-tests-trace-elem-idx {
  font-size: 10px;
  color: var(--bpmnkit-chrome-ink-4);
  min-width: 18px;
  text-align: right;
  flex-shrink: 0;
}
.bpmnkit-runner-tests-trace-elem-id {
  font-size: 11px;
  font-family: var(--bpmnkit-chrome-mono);
  color: var(--bpmnkit-chrome-ink-2);
}

/* ── Missing DMN warning ──────────────────────────────────────────────────── */
.bpmnkit-runner-tests-missing-dmn {
  font-size: 11px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--bpmnkit-warn, #d97706);
  border: 1px solid var(--bpmnkit-warn, #f59e0b);
  color: var(--bpmnkit-warn, #f59e0b);
}

/* ── Chaos run summary banner ─────────────────────────────────────────────── */
.bpmnkit-runner-chaos-summary {
  font-size: 11px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--bpmnkit-warn, #d97706);
  border: 1px solid var(--bpmnkit-warn, #f59e0b);
  color: var(--bpmnkit-warn, #f59e0b);
}
`

export function injectProcessRunnerStyles(): void {
	injectChromeStyles()
	if (typeof document === "undefined") return
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
