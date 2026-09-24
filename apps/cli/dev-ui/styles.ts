/**
 * The page chrome around the editor. The editor, the runner and the plugins
 * inject their own styles; this only lays out the sidebar, header and panels.
 * Flat and hairline-ruled like the editor chrome, on the `@bpmnkit/ui` tokens.
 */
export const DEV_UI_CSS = `
html, body { height: 100%; margin: 0; }
body {
	background: var(--bpmnkit-bg, #f4f4f8);
	color: var(--bpmnkit-fg, #1a1a2e);
	font-family: var(--bpmnkit-font, system-ui, -apple-system, sans-serif);
	font-size: 13px;
}
#app { display: flex; height: 100%; min-height: 0; }
[hidden] { display: none !important; }

.dev-sidebar {
	display: flex; flex-direction: column; flex: 0 0 280px; min-width: 0;
	border-right: 1px solid var(--bpmnkit-border, #d0d0e8);
	background: var(--bpmnkit-surface, #ffffff);
}
.dev-project {
	display: flex; flex-direction: column; gap: 2px; padding: 12px 14px;
	border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8);
}
.dev-eyebrow, .dev-kind, .dev-heading, .dev-save-state, .dev-file-title {
	font-family: var(--bpmnkit-font-mono, ui-monospace, monospace);
}
.dev-eyebrow, .dev-heading {
	font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
	color: var(--bpmnkit-fg-muted, #6666a0);
}
.dev-heading { margin: 0 0 8px; font-weight: 400; }

.dev-files { list-style: none; margin: 0; padding: 0; overflow: auto; flex: 1 1 auto; min-height: 80px; }
.dev-file {
	display: flex; align-items: center; gap: 8px; width: 100%; padding: 7px 14px;
	border: 0; border-left: 2px solid transparent; border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8); border-radius: 0;
	background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer;
}
.dev-file:hover { background: var(--bpmnkit-accent-subtle, rgba(26,86,219,0.12)); }
.dev-file[aria-current="true"] { border-left-color: var(--bpmnkit-accent, #1a56db); background: var(--bpmnkit-surface-2, #eeeef8); }
.dev-file-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dev-kind { font-size: 11px; color: var(--bpmnkit-fg-muted, #6666a0); }
.dev-dot { flex: 0 0 8px; height: 8px; background: var(--bpmnkit-fg-muted, #6666a0); }
.dev-dot[data-state="ok"] { background: var(--bpmnkit-success, #16a34a); }
.dev-dot[data-state="bad"] { background: var(--bpmnkit-danger, #dc2626); }
.dev-empty, .dev-muted { padding: 10px 14px; margin: 0; color: var(--bpmnkit-fg-muted, #6666a0); }
.dev-muted { padding: 8px 0 0; font-size: 12px; }

.dev-checks {
	flex: 0 1 45%; overflow: auto; padding: 12px 14px;
	border-top: 1px solid var(--bpmnkit-border, #d0d0e8);
}
.dev-results { list-style: none; margin: 0; padding: 0; }
.dev-result { padding: 3px 0 3px 8px; border-left: 2px solid transparent; white-space: pre-wrap; word-break: break-word; }
.dev-result[data-tone="ok"] { border-left-color: var(--bpmnkit-success, #16a34a); }
.dev-result[data-tone="warn"] { border-left-color: var(--bpmnkit-warn, #d97706); }
.dev-result[data-tone="bad"] { border-left-color: var(--bpmnkit-danger, #dc2626); }

.dev-main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; min-height: 0; }
.dev-header {
	display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 0 12px;
	border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8);
	background: var(--bpmnkit-surface, #ffffff);
}
.dev-file-title { font-weight: 600; }
.dev-save-state { font-size: 12px; color: var(--bpmnkit-fg-muted, #6666a0); }
.dev-save-state[data-tone="bad"] { color: var(--bpmnkit-danger, #dc2626); }
.dev-sim-bar { display: flex; align-items: center; gap: 6px; margin-left: auto; }
.dev-banner {
	display: flex; align-items: center; gap: 10px; padding: 8px 12px;
	border-bottom: 1px solid var(--bpmnkit-warn, #d97706);
	background: var(--bpmnkit-surface-2, #eeeef8);
}
.dev-button {
	padding: 4px 10px; border: 1px solid var(--bpmnkit-border, #d0d0e8); border-radius: 0;
	background: var(--bpmnkit-surface, #ffffff); color: inherit; font: inherit; cursor: pointer;
}
.dev-button:hover { border-color: var(--bpmnkit-accent, #1a56db); }
.dev-stage { position: relative; flex: 1 1 auto; min-height: 0; overflow: hidden; }
.dev-play {
	flex: 0 0 auto; max-height: 45%; overflow: auto;
	border-top: 1px solid var(--bpmnkit-border, #d0d0e8);
	background: var(--bpmnkit-surface, #ffffff);
}

@media (max-width: 720px) {
	#app { flex-direction: column; }
	.dev-sidebar { flex: 0 0 auto; max-height: 40%; border-right: 0; border-bottom: 1px solid var(--bpmnkit-border, #d0d0e8); }
}
`
