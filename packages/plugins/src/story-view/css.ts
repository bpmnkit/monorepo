import { injectChromeStyles } from "@bpmnkit/editor"

export const STYLE_ID = "bpmnkit-story-view-v1"

export const CSS = `
/* ── Container ──────────────────────────────────────────────────────────────── */
.bpmnkit-sv-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink);
  font-family: var(--bpmnkit-chrome-font);
  font-size: 13px;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  flex-shrink: 0;
}
.bpmnkit-sv-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--bpmnkit-chrome-ink);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.bpmnkit-sv-back {
  font-size: 11px;
  padding: 3px 10px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
}
.bpmnkit-sv-back:hover {
  color: var(--bpmnkit-chrome-accent);
  border-color: var(--bpmnkit-chrome-accent);
}

/* ── Content ────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

/* ── Lane ────────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-lane {
  margin-bottom: 20px;
}
.bpmnkit-sv-lane-header {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--bpmnkit-chrome-ink-4);
  padding: 4px 0 8px;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
  margin-bottom: 10px;
}
.bpmnkit-sv-lane-cards {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
}

/* ── Cards ───────────────────────────────────────────────────────────────────── */
.bpmnkit-sv-card {
  background: var(--bpmnkit-chrome-ground);
  border: 1px solid var(--bpmnkit-chrome-line);
  padding: 10px 12px;
  min-width: 120px;
  max-width: 200px;
  flex-shrink: 0;
}
.bpmnkit-sv-card--start  { border-left: 3px solid var(--bpmnkit-success, #22c55e); }
.bpmnkit-sv-card--end    { border-left: 3px solid var(--bpmnkit-chrome-ink-4); }
.bpmnkit-sv-card--service { border-left: 3px solid var(--bpmnkit-chrome-accent); }
.bpmnkit-sv-card--user   { border-left: 3px solid var(--bpmnkit-chrome-accent); }
.bpmnkit-sv-card--gateway { border-left: 3px solid var(--bpmnkit-warn, #f59e0b); }
.bpmnkit-sv-card--parallel { border-left: 3px solid var(--bpmnkit-chrome-ink-4); }
.bpmnkit-sv-card--subprocess { border-left: 3px solid var(--bpmnkit-chrome-accent); }
.bpmnkit-sv-card--event  { border-left: 3px solid var(--bpmnkit-chrome-accent); }
.bpmnkit-sv-card--task   { border-left: 3px solid var(--bpmnkit-chrome-line); }

.bpmnkit-sv-card-header {
  font-family: var(--bpmnkit-chrome-mono);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--bpmnkit-chrome-ink-4);
  margin-bottom: 3px;
}
.bpmnkit-sv-card-body {
  font-size: 12px;
  font-weight: 500;
  color: var(--bpmnkit-chrome-ink);
  word-break: break-word;
  min-height: 16px;
}

/* ── Arrow connector ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-arrow {
  color: var(--bpmnkit-chrome-ink-4);
  font-size: 18px;
  align-self: center;
  flex-shrink: 0;
  padding: 0 2px;
  margin-top: 12px;
}

/* ── Comment button ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-btn {
  display: inline-block;
  margin-top: 6px;
  font-size: 10px;
  padding: 2px 7px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
}
.bpmnkit-sv-comment-btn:hover {
  border-color: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent);
}

/* ── Comment panel ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-panel {
  margin-top: 8px;
  border-top: 1px solid var(--bpmnkit-chrome-line);
  padding-top: 8px;
}
.bpmnkit-sv-comment-item {
  padding: 4px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line);
}
.bpmnkit-sv-comment-item:last-child {
  border-bottom: none;
}
.bpmnkit-sv-comment-text {
  font-size: 11px;
  color: var(--bpmnkit-chrome-ink);
  line-height: 1.45;
}
.bpmnkit-sv-comment-meta {
  font-size: 10px;
  color: var(--bpmnkit-chrome-ink-4);
  margin-top: 2px;
}
.bpmnkit-sv-comment-input {
  width: 100%;
  margin-top: 6px;
  padding: 5px 8px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink);
  font-family: var(--bpmnkit-chrome-font);
  font-size: 11px;
  resize: vertical;
  min-height: 50px;
}
.bpmnkit-sv-comment-submit {
  margin-top: 5px;
  font-size: 11px;
  padding: 3px 10px;
  border: 1px solid var(--bpmnkit-chrome-accent);
  background: var(--bpmnkit-chrome-accent-subtle);
  color: var(--bpmnkit-chrome-accent);
  cursor: pointer;
  font-weight: 600;
}
.bpmnkit-sv-comment-submit:hover {
  background: var(--bpmnkit-chrome-accent);
  color: var(--bpmnkit-chrome-accent-fg);
}

/* ── Light theme overrides ─────────────────────────────────────────────────── */
[data-bpmnkit-theme="light"] .bpmnkit-sv-container {
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink);
}
[data-bpmnkit-theme="light"] .bpmnkit-sv-card {
  background: var(--bpmnkit-chrome-ground);
}
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--start  { border-left-color: var(--bpmnkit-success, #16a34a); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--service { border-left-color: var(--bpmnkit-chrome-accent); }
[data-bpmnkit-theme="light"] .bpmnkit-sv-card--gateway { border-left-color: var(--bpmnkit-warn, #d97706); }

/* ── Share/download button ─────────────────────────────────────────────────── */
.bpmnkit-sv-share {
  font-size: 11px;
  padding: 3px 10px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: var(--bpmnkit-chrome-ground-2);
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  font-weight: 600;
  white-space: nowrap;
  margin-left: auto;
}
.bpmnkit-sv-share:hover {
  color: var(--bpmnkit-chrome-accent);
  border-color: var(--bpmnkit-chrome-accent);
}

/* ── Resolve button ─────────────────────────────────────────────────────────── */
.bpmnkit-sv-comment-resolve {
  font-size: 10px;
  padding: 2px 7px;
  border: 1px solid var(--bpmnkit-chrome-line);
  background: transparent;
  color: var(--bpmnkit-chrome-ink-4);
  cursor: pointer;
  margin-top: 3px;
}
.bpmnkit-sv-comment-resolve:hover {
  border-color: var(--bpmnkit-success, #22c55e);
  color: var(--bpmnkit-success, #22c55e);
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-text {
  text-decoration: line-through;
  opacity: 0.5;
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-meta {
  opacity: 0.5;
}
.bpmnkit-sv-comment-item--resolved .bpmnkit-sv-comment-resolve {
  border-color: var(--bpmnkit-success, #22c55e);
  color: var(--bpmnkit-success, #22c55e);
}
`

export function injectStoryViewStyles(): void {
	injectChromeStyles()
	if (document.getElementById(STYLE_ID) !== null) return
	const style = document.createElement("style")
	style.id = STYLE_ID
	style.textContent = CSS
	document.head.appendChild(style)
}
