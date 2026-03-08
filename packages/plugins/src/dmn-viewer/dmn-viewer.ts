import type { DmnDecision, DmnDefinitions } from "@bpmn-sdk/core";
import { injectDmnViewerStyles } from "./css.js";
import { highlightFeel } from "./feel.js";

export interface DmnViewerOptions {
	container: HTMLElement;
	/** "dark" (default) or "light". */
	theme?: "dark" | "light";
}

/**
 * Standalone DMN decision table viewer.
 *
 * Renders a `DmnDefinitions` object as an HTML decision table with
 * FEEL syntax highlighting. Does not depend on `@bpmn-sdk/canvas`.
 */
export class DmnViewer {
	private readonly _container: HTMLElement;
	private readonly _root: HTMLDivElement;
	private _theme: "dark" | "light";
	private _defs: DmnDefinitions | null = null;

	constructor(options: DmnViewerOptions) {
		this._container = options.container;
		this._theme = options.theme ?? "dark";

		injectDmnViewerStyles();

		this._root = document.createElement("div");
		this._root.className = `dmn-viewer ${this._theme}`;
		this._container.appendChild(this._root);
	}

	/** Load and render a DMN definitions object. */
	load(defs: DmnDefinitions): void {
		this._defs = defs;
		this._render();
	}

	/** Clear the view. */
	clear(): void {
		this._defs = null;
		this._root.innerHTML = "";
	}

	/** Set the theme. */
	setTheme(theme: "dark" | "light"): void {
		this._root.classList.remove(this._theme);
		this._theme = theme;
		this._root.classList.add(theme);
	}

	/** Remove the viewer from the DOM. */
	destroy(): void {
		this._root.remove();
	}

	private _render(): void {
		if (!this._defs) return;
		this._root.innerHTML = "";

		const body = document.createElement("div");
		body.className = "dmn-viewer-body";

		if (this._defs.decisions.length === 0) {
			const empty = document.createElement("div");
			empty.className = "dmn-empty";
			empty.textContent = "No decisions found.";
			body.appendChild(empty);
		} else {
			for (const decision of this._defs.decisions) {
				body.appendChild(this._renderDecision(decision));
			}
		}

		this._root.appendChild(body);
	}

	private _renderDecision(decision: DmnDecision): HTMLElement {
		const section = document.createElement("div");
		section.style.marginBottom = "24px";

		// Header: name + hit policy badge
		const header = document.createElement("div");
		header.className = "dmn-decision-header";

		const nameEl = document.createElement("span");
		nameEl.className = "dmn-decision-name";
		nameEl.textContent = decision.name ?? decision.id;
		header.appendChild(nameEl);

		if (decision.decisionTable) {
			const hp = decision.decisionTable.hitPolicy ?? "UNIQUE";
			const badge = document.createElement("span");
			badge.className = "dmn-hit-policy";
			badge.textContent = hp;
			header.appendChild(badge);
		}

		section.appendChild(header);

		if (!decision.decisionTable) {
			const empty = document.createElement("div");
			empty.className = "dmn-empty";
			empty.textContent = "No decision table.";
			section.appendChild(empty);
			return section;
		}

		const dt = decision.decisionTable;
		const table = document.createElement("table");
		table.className = "dmn-table";

		// Build thead
		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");

		// Row number column
		const thNum = document.createElement("th");
		thNum.textContent = "#";
		thNum.style.width = "32px";
		headerRow.appendChild(thNum);

		// Input columns
		for (const input of dt.inputs) {
			const th = document.createElement("th");
			th.className = "dmn-th-input";
			th.innerHTML = `${escHtml(input.label ?? input.inputExpression.text ?? "")} <span style="opacity:0.55;font-weight:400">(${escHtml(input.inputExpression.typeRef ?? "string")})</span>`;
			headerRow.appendChild(th);
		}

		// Output columns
		for (const output of dt.outputs) {
			const th = document.createElement("th");
			th.className = "dmn-th-output";
			th.innerHTML = `${escHtml(output.label ?? output.name ?? "")} <span style="opacity:0.55;font-weight:400">(${escHtml(output.typeRef ?? "string")})</span>`;
			headerRow.appendChild(th);
		}

		thead.appendChild(headerRow);
		table.appendChild(thead);

		// Build tbody
		const tbody = document.createElement("tbody");

		if (dt.rules.length === 0) {
			const tr = document.createElement("tr");
			const td = document.createElement("td");
			td.colSpan = 1 + dt.inputs.length + dt.outputs.length;
			td.className = "dmn-empty";
			td.textContent = "No rules defined.";
			tr.appendChild(td);
			tbody.appendChild(tr);
		} else {
			for (let rIdx = 0; rIdx < dt.rules.length; rIdx++) {
				const rule = dt.rules[rIdx];
				if (!rule) continue;
				const tr = document.createElement("tr");

				// Row number
				const tdNum = document.createElement("td");
				tdNum.className = "dmn-row-num";
				tdNum.textContent = String(rIdx + 1);
				tr.appendChild(tdNum);

				// Input entries
				for (let iIdx = 0; iIdx < dt.inputs.length; iIdx++) {
					const entry = rule.inputEntries[iIdx];
					const td = document.createElement("td");
					td.innerHTML = highlightFeel(entry?.text ?? "");
					tr.appendChild(td);
				}

				// Output entries
				for (let oIdx = 0; oIdx < dt.outputs.length; oIdx++) {
					const entry = rule.outputEntries[oIdx];
					const td = document.createElement("td");
					td.innerHTML = highlightFeel(entry?.text ?? "");
					tr.appendChild(td);
				}

				tbody.appendChild(tr);
			}
		}

		table.appendChild(tbody);
		section.appendChild(table);
		return section;
	}
}

function escHtml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
