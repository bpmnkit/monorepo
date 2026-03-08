import { Bpmn, optimize } from "@bpmn-sdk/core";
import type { BpmnDefinitions, OptimizationFinding } from "@bpmn-sdk/core";

// ── Styles ────────────────────────────────────────────────────────────────────

const STYLE_ID = "opt-dialog-styles";

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
.opt-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(0,0,0,0.5);
  display: flex; align-items: center; justify-content: center;
}
.opt-panel {
  background: rgba(22, 22, 30, 0.97);
  border: 1px solid rgba(255,255,255,0.12);
  border-radius: 10px;
  width: 540px; max-width: 95vw; max-height: 80vh;
  display: flex; flex-direction: column;
  color: rgba(255,255,255,0.85);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 13px;
  box-shadow: 0 16px 48px rgba(0,0,0,0.6);
  overflow: hidden;
}
.opt-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  flex-shrink: 0;
}
.opt-title {
  font-size: 15px; font-weight: 600;
  color: rgba(255,255,255,0.95);
  margin: 0 0 2px;
}
.opt-subtitle {
  font-size: 12px; color: rgba(255,255,255,0.45);
  margin: 0;
}
.opt-body {
  flex: 1; overflow-y: auto; padding: 8px 0;
}
.opt-finding {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.opt-finding:last-child { border-bottom: none; }
.opt-finding-cb { margin-top: 2px; flex-shrink: 0; cursor: pointer; }
.opt-badge {
  flex-shrink: 0; font-size: 10px; font-weight: 700;
  letter-spacing: 0.04em; text-transform: uppercase;
  padding: 2px 5px; border-radius: 4px;
  margin-top: 1px;
}
.opt-badge-error  { background: rgba(220,50,50,0.25);   color: #f88; }
.opt-badge-warning{ background: rgba(220,160,30,0.25);  color: #fda; }
.opt-badge-info   { background: rgba(60,140,220,0.25);  color: #8bf; }
.opt-finding-body { flex: 1; min-width: 0; }
.opt-finding-msg  { color: rgba(255,255,255,0.85); line-height: 1.4; word-break: break-word; }
.opt-finding-sug  { color: rgba(255,255,255,0.4); font-size: 11.5px; margin-top: 2px; line-height: 1.4; }
.opt-empty {
  padding: 32px; text-align: center;
  color: rgba(255,255,255,0.4);
}
.opt-result {
  display: flex; align-items: flex-start; gap: 10px;
  padding: 8px 18px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
}
.opt-result:last-child { border-bottom: none; }
.opt-result-icon  { flex-shrink: 0; margin-top: 1px; color: #8f8; font-size: 14px; }
.opt-result-body  { flex: 1; min-width: 0; }
.opt-result-desc  { color: rgba(255,255,255,0.8); line-height: 1.4; }
.opt-result-open {
  margin-top: 6px; font-size: 12px;
  background: rgba(60,120,220,0.3); border: 1px solid rgba(60,120,220,0.5);
  color: #9cf; border-radius: 5px; padding: 3px 8px;
  cursor: pointer;
}
.opt-result-open:hover { background: rgba(60,120,220,0.45); }
.opt-footer {
  padding: 12px 18px;
  border-top: 1px solid rgba(255,255,255,0.08);
  display: flex; gap: 8px; justify-content: flex-end;
  flex-shrink: 0;
}
.opt-btn {
  font-size: 13px; padding: 6px 14px; border-radius: 6px;
  cursor: pointer; font-weight: 500;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.8);
}
.opt-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.opt-btn:disabled { opacity: 0.35; cursor: default; }
.opt-btn-primary {
  background: rgba(60,120,220,0.5);
  border-color: rgba(60,120,220,0.7);
  color: #fff;
}
.opt-btn-primary:hover:not(:disabled) { background: rgba(60,120,220,0.65); }
/* Light theme */
[data-bpmn-hud-theme="light"] .opt-panel {
  background: rgba(252,252,254,0.98);
  border-color: rgba(0,0,0,0.1);
  color: rgba(0,0,0,0.8);
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
}
[data-bpmn-hud-theme="light"] .opt-header { border-bottom-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .opt-title  { color: rgba(0,0,0,0.88); }
[data-bpmn-hud-theme="light"] .opt-subtitle { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .opt-finding { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmn-hud-theme="light"] .opt-badge-error   { background: rgba(220,50,50,0.1);   color: #c00; }
[data-bpmn-hud-theme="light"] .opt-badge-warning { background: rgba(200,130,0,0.12);  color: #a60; }
[data-bpmn-hud-theme="light"] .opt-badge-info    { background: rgba(0,80,200,0.1);    color: #05c; }
[data-bpmn-hud-theme="light"] .opt-finding-msg { color: rgba(0,0,0,0.78); }
[data-bpmn-hud-theme="light"] .opt-finding-sug { color: rgba(0,0,0,0.42); }
[data-bpmn-hud-theme="light"] .opt-empty { color: rgba(0,0,0,0.35); }
[data-bpmn-hud-theme="light"] .opt-result { border-bottom-color: rgba(0,0,0,0.05); }
[data-bpmn-hud-theme="light"] .opt-result-desc { color: rgba(0,0,0,0.75); }
[data-bpmn-hud-theme="light"] .opt-result-open {
  background: rgba(0,80,200,0.08); border-color: rgba(0,80,200,0.25); color: #05c;
}
[data-bpmn-hud-theme="light"] .opt-result-open:hover { background: rgba(0,80,200,0.14); }
[data-bpmn-hud-theme="light"] .opt-footer { border-top-color: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .opt-btn {
  border-color: rgba(0,0,0,0.12); background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.7);
}
[data-bpmn-hud-theme="light"] .opt-btn:hover:not(:disabled) { background: rgba(0,0,0,0.08); }
[data-bpmn-hud-theme="light"] .opt-btn-primary {
  background: rgba(0,80,200,0.85); border-color: rgba(0,80,200,0.9); color: #fff;
}
[data-bpmn-hud-theme="light"] .opt-btn-primary:hover:not(:disabled) { background: rgba(0,80,200,1); }
`;
	document.head.appendChild(style);
}

// ── Dialog helpers ────────────────────────────────────────────────────────────

function makeHeader(title: string, subtitle: string): HTMLElement {
	const header = document.createElement("div");
	header.className = "opt-header";
	const h = document.createElement("div");
	h.className = "opt-title";
	h.textContent = title;
	const s = document.createElement("div");
	s.className = "opt-subtitle";
	s.textContent = subtitle;
	header.append(h, s);
	return header;
}

function makeFooter(...buttons: HTMLButtonElement[]): HTMLElement {
	const footer = document.createElement("div");
	footer.className = "opt-footer";
	footer.append(...buttons);
	return footer;
}

function makeBtn(label: string, primary = false): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.className = primary ? "opt-btn opt-btn-primary" : "opt-btn";
	btn.textContent = label;
	return btn;
}

// ── Dialog ────────────────────────────────────────────────────────────────────

function showOptimizeDialog(
	defs: BpmnDefinitions,
	reload: (xml: string) => void,
	openTab: (xml: string, name: string) => void,
): void {
	injectStyles();

	const report = optimize(defs);
	const findings = report.findings;

	const overlay = document.createElement("div");
	overlay.className = "opt-overlay";
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove();
	});

	const panel = document.createElement("div");
	panel.className = "opt-panel";

	function showPhase1(): void {
		panel.innerHTML = "";

		const fixableCount = findings.filter((f) => f.applyFix !== undefined).length;
		const subtitleText =
			findings.length === 0
				? "No issues found"
				: `${findings.length} finding${findings.length !== 1 ? "s" : ""} · ${fixableCount} auto-fixable`;

		panel.append(makeHeader("Optimize Diagram", subtitleText));

		const body = document.createElement("div");
		body.className = "opt-body";

		const checkboxes = new Map<OptimizationFinding, HTMLInputElement>();

		if (findings.length === 0) {
			const empty = document.createElement("div");
			empty.className = "opt-empty";
			empty.textContent = "✓ No optimization opportunities found.";
			body.append(empty);
		} else {
			for (const finding of findings) {
				const row = document.createElement("div");
				row.className = "opt-finding";

				const cb = document.createElement("input");
				cb.type = "checkbox";
				cb.className = "opt-finding-cb";
				cb.checked = finding.applyFix !== undefined;
				cb.disabled = finding.applyFix === undefined;
				checkboxes.set(finding, cb);

				const badge = document.createElement("span");
				badge.className = `opt-badge opt-badge-${finding.severity}`;
				badge.textContent = finding.severity;

				const fbody = document.createElement("div");
				fbody.className = "opt-finding-body";

				const msg = document.createElement("div");
				msg.className = "opt-finding-msg";
				msg.textContent = finding.message;

				const sug = document.createElement("div");
				sug.className = "opt-finding-sug";
				sug.textContent = finding.suggestion;

				fbody.append(msg, sug);
				row.append(cb, badge, fbody);
				body.append(row);
			}
		}

		const btnClose = makeBtn("Close");
		btnClose.addEventListener("click", () => overlay.remove());

		const btnApply = makeBtn(`Apply ${fixableCount} Fix${fixableCount !== 1 ? "es" : ""}`, true);
		btnApply.disabled = fixableCount === 0;

		btnApply.addEventListener("click", () => {
			const selected = findings.filter((f) => {
				const cb = checkboxes.get(f);
				return f.applyFix !== undefined && cb?.checked === true;
			});
			if (selected.length === 0) return;

			const results: Array<{ description: string; generated?: BpmnDefinitions }> = [];
			for (const finding of selected) {
				if (!finding.applyFix) continue;
				results.push(finding.applyFix(defs));
			}

			reload(Bpmn.export(defs));
			showPhase2(results);
		});

		panel.append(body, makeFooter(btnClose, btnApply));
	}

	function showPhase2(results: Array<{ description: string; generated?: BpmnDefinitions }>): void {
		panel.innerHTML = "";

		const subtitle = `${results.length} fix${results.length !== 1 ? "es" : ""} applied successfully`;
		panel.append(makeHeader("Fixes Applied", subtitle));

		const body = document.createElement("div");
		body.className = "opt-body";

		for (const result of results) {
			const row = document.createElement("div");
			row.className = "opt-result";

			const icon = document.createElement("div");
			icon.className = "opt-result-icon";
			icon.textContent = "✓";

			const rbody = document.createElement("div");
			rbody.className = "opt-result-body";

			const desc = document.createElement("div");
			desc.className = "opt-result-desc";
			desc.textContent = result.description;
			rbody.append(desc);

			if (result.generated) {
				const gen = result.generated;
				const openBtn = document.createElement("button");
				openBtn.className = "opt-result-open";
				openBtn.textContent = "Open generated process in new tab";
				openBtn.addEventListener("click", () => {
					openTab(Bpmn.export(gen), "Extracted Process");
				});
				rbody.append(openBtn);
			}

			row.append(icon, rbody);
			body.append(row);
		}

		const btnDone = makeBtn("Done", true);
		btnDone.addEventListener("click", () => overlay.remove());

		panel.append(body, makeFooter(btnDone));
	}

	showPhase1();
	overlay.append(panel);
	document.body.append(overlay);
}

// ── Plugin ────────────────────────────────────────────────────────────────────

const OPTIMIZE_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 14L8 7"/><path d="M11 2l.75 2.25L14 5l-2.25.75L11 8l-.75-2.25L8 5l2.25-.75z"/></svg>`;

export interface OptimizePluginOptions {
	/** Returns the current diagram definitions, or null if no diagram is loaded. */
	getDefinitions: () => BpmnDefinitions | null;
	/** Reloads the editor with the given XML. */
	reload: (xml: string) => void;
	/** Opens a new BPMN tab with the given XML and name. */
	openTab: (xml: string, name: string) => void;
}

/**
 * Creates an optimize plugin that provides a button for triggering
 * the two-phase diagram optimization dialog.
 *
 * The returned `button` should be passed to `initEditorHud` as `optimizeButton`.
 */
export function createOptimizePlugin(options: OptimizePluginOptions): {
	name: string;
	install(): void;
	button: HTMLButtonElement;
} {
	const button = document.createElement("button");
	button.title = "Optimize";
	button.innerHTML = OPTIMIZE_ICON;

	button.addEventListener("click", () => {
		const defs = options.getDefinitions();
		if (!defs) return;
		showOptimizeDialog(defs, options.reload, options.openTab);
	});

	return {
		name: "optimize",
		install(): void {},
		button,
	};
}
