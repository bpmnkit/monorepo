import { Dmn } from "@bpmn-sdk/core";
import type {
	DmnAggregation,
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnInput,
	DmnInputEntry,
	DmnOutput,
	DmnOutputEntry,
	DmnRule,
	DmnTypeRef,
	HitPolicy,
} from "@bpmn-sdk/core";
import { injectDmnEditorStyles } from "./css.js";
import { DrdCanvas } from "./drd-canvas.js";

export interface DmnEditorOptions {
	container: HTMLElement;
	theme?: "dark" | "light";
}

type HpOption = {
	label: string;
	abbr: string;
	hitPolicy: HitPolicy;
	aggregation?: DmnAggregation;
};

const HP_OPTIONS: HpOption[] = [
	{ label: "U - Unique", abbr: "U", hitPolicy: "UNIQUE" },
	{ label: "F - First", abbr: "F", hitPolicy: "FIRST" },
	{ label: "A - Any", abbr: "A", hitPolicy: "ANY" },
	{ label: "P - Priority", abbr: "P", hitPolicy: "PRIORITY" },
	{ label: "C - Collect", abbr: "C", hitPolicy: "COLLECT" },
	{ label: "C+ - Sum", abbr: "C+", hitPolicy: "COLLECT", aggregation: "SUM" },
	{ label: "C< - Min", abbr: "C<", hitPolicy: "COLLECT", aggregation: "MIN" },
	{ label: "C> - Max", abbr: "C>", hitPolicy: "COLLECT", aggregation: "MAX" },
	{ label: "C# - Count", abbr: "C#", hitPolicy: "COLLECT", aggregation: "COUNT" },
	{ label: "R - Rule Order", abbr: "R", hitPolicy: "RULE ORDER" },
	{ label: "O - Output Order", abbr: "O", hitPolicy: "OUTPUT ORDER" },
];

const TYPEREFS: Array<{ value: DmnTypeRef | ""; label: string }> = [
	{ value: "", label: "(none)" },
	{ value: "string", label: "string" },
	{ value: "number", label: "number" },
	{ value: "boolean", label: "boolean" },
	{ value: "date", label: "date" },
];

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

function hpAbbr(hitPolicy: HitPolicy | undefined, aggregation: DmnAggregation | undefined): string {
	if (!hitPolicy || hitPolicy === "UNIQUE") return "U";
	if (hitPolicy === "FIRST") return "F";
	if (hitPolicy === "ANY") return "A";
	if (hitPolicy === "PRIORITY") return "P";
	if (hitPolicy === "RULE ORDER") return "R";
	if (hitPolicy === "OUTPUT ORDER") return "O";
	if (hitPolicy === "COLLECT") {
		if (aggregation === "SUM") return "C+";
		if (aggregation === "MIN") return "C<";
		if (aggregation === "MAX") return "C>";
		if (aggregation === "COUNT") return "C#";
		return "C";
	}
	return "U";
}

function hpOptionValue(opt: { hitPolicy: HitPolicy; aggregation?: DmnAggregation }): string {
	return opt.aggregation ? `${opt.hitPolicy}|${opt.aggregation}` : opt.hitPolicy;
}

/** Native DMN editor with DRD canvas and editable decision tables. Zero external dependencies. */
export class DmnEditor {
	private _defs: DmnDefinitions | null = null;
	private readonly _root: HTMLDivElement;
	private readonly _body: HTMLDivElement;
	private readonly _handlers: Array<() => void> = [];
	private _destroyed = false;
	private _ctxMenu: HTMLElement | null = null;

	// View state: "drd" = DRD canvas, "table" = specific decision table
	private _view: "drd" | "table" = "drd";
	private _activeDecisionId: string | null = null;
	private _drdCanvas: DrdCanvas | null = null;

	constructor(options: DmnEditorOptions) {
		injectDmnEditorStyles();

		this._root = document.createElement("div");
		this._root.className = `dmn-editor ${options.theme ?? "light"}`;
		this._body = document.createElement("div");
		this._body.className = "dmn-editor-body";
		this._root.appendChild(this._body);
		options.container.appendChild(this._root);
	}

	async loadXML(xml: string): Promise<void> {
		this._defs = Dmn.parse(xml);
		this._view = "drd";
		this._activeDecisionId = null;
		this._render();
	}

	async getXML(): Promise<string> {
		if (!this._defs) return "";
		return Dmn.export(this._defs);
	}

	onChange(handler: () => void): () => void {
		this._handlers.push(handler);
		return () => {
			const idx = this._handlers.indexOf(handler);
			if (idx !== -1) this._handlers.splice(idx, 1);
		};
	}

	setTheme(theme: "dark" | "light"): void {
		this._root.className = `dmn-editor ${theme}`;
	}

	destroy(): void {
		this._destroyed = true;
		this._handlers.length = 0;
		this._closeCtxMenu();
		this._drdCanvas?.destroy();
		this._drdCanvas = null;
		this._root.remove();
	}

	private _emit(): void {
		if (this._destroyed) return;
		for (const h of this._handlers) h();
	}

	// ── Routing ────────────────────────────────────────────────────────────────

	private _render(): void {
		this._body.innerHTML = "";
		this._drdCanvas?.destroy();
		this._drdCanvas = null;

		if (!this._defs) return;

		if (this._view === "drd") {
			this._renderDrd();
		} else {
			this._renderTableView();
		}
	}

	private _renderDrd(): void {
		if (!this._defs) return;
		const defs = this._defs;

		this._drdCanvas = new DrdCanvas({
			container: this._body,
			defs,
			onChange: () => this._emit(),
			onDecisionOpen: (id) => {
				this._activeDecisionId = id;
				this._view = "table";
				this._render();
			},
		});
	}

	private _renderTableView(): void {
		if (!this._defs || !this._activeDecisionId) return;
		const decision = this._defs.decisions.find((d) => d.id === this._activeDecisionId);
		if (!decision) return;

		// Back bar
		const backBar = document.createElement("div");
		backBar.className = "dme-back-bar";

		const backBtn = document.createElement("button");
		backBtn.type = "button";
		backBtn.className = "dme-btn dme-back-btn";
		backBtn.textContent = "← DRD";
		backBtn.title = "Back to diagram";
		backBtn.addEventListener("click", () => {
			this._view = "drd";
			this._activeDecisionId = null;
			this._render();
		});
		backBar.appendChild(backBtn);

		const title = document.createElement("span");
		title.className = "dme-back-title";
		title.textContent = decision.name ?? decision.id;
		backBar.appendChild(title);

		this._body.appendChild(backBar);

		// Table content
		const tableWrap = document.createElement("div");
		tableWrap.className = "dme-table-wrap";
		this._body.appendChild(tableWrap);
		tableWrap.appendChild(this._renderDecision(decision));
	}

	// ── Context menu ────────────────────────────────────────────────────────────

	private _closeCtxMenu(): void {
		if (this._ctxMenu) {
			this._ctxMenu.remove();
			this._ctxMenu = null;
		}
	}

	private _openCtxMenu(
		e: MouseEvent,
		items: Array<{ label: string; action: () => void } | "sep">,
	): void {
		e.preventDefault();
		this._closeCtxMenu();

		const menu = document.createElement("div");
		menu.className = "dme-ctx-menu";
		menu.style.left = `${e.clientX}px`;
		menu.style.top = `${e.clientY}px`;

		for (const item of items) {
			if (item === "sep") {
				const sep = document.createElement("hr");
				sep.className = "dme-ctx-sep";
				menu.appendChild(sep);
			} else {
				const btn = document.createElement("div");
				btn.className = "dme-ctx-item";
				btn.textContent = item.label;
				btn.addEventListener("click", () => {
					item.action();
					this._closeCtxMenu();
				});
				menu.appendChild(btn);
			}
		}

		this._ctxMenu = menu;
		document.body.appendChild(menu);

		setTimeout(() => {
			const closeHandler = (ev: MouseEvent) => {
				if (!menu.contains(ev.target as Node)) {
					this._closeCtxMenu();
					document.removeEventListener("click", closeHandler);
				}
			};
			document.addEventListener("click", closeHandler);
		}, 0);
	}

	// ── Decision table rendering ────────────────────────────────────────────────

	private _renderDecision(decision: DmnDecision): HTMLElement {
		const section = document.createElement("div");
		section.className = "dme-decision";

		const header = document.createElement("div");
		header.className = "dme-decision-header";

		const nameInput = document.createElement("input");
		nameInput.type = "text";
		nameInput.className = "dme-name-input";
		nameInput.value = decision.name ?? "";
		nameInput.placeholder = "Decision name";
		nameInput.addEventListener("input", () => {
			decision.name = nameInput.value;
			// Update breadcrumb title if in table view
			const titleEl = this._body.querySelector(".dme-back-title");
			if (titleEl) titleEl.textContent = decision.name || decision.id;
			// Update DRD canvas label (re-render DRD after returning)
			this._emit();
		});
		header.appendChild(nameInput);
		section.appendChild(header);

		// Ensure decision table exists
		if (!decision.decisionTable) {
			decision.decisionTable = {
				id: uid(),
				inputs: [],
				outputs: [{ id: uid(), name: "result", label: "Result" }],
				rules: [],
			};
		}
		const dt = decision.decisionTable;

		const tableWrapper = document.createElement("div");
		const rerender = (): void => {
			tableWrapper.innerHTML = "";
			tableWrapper.appendChild(this._buildTable(dt, rerender));
		};
		rerender();
		section.appendChild(tableWrapper);

		const addRuleBtn = document.createElement("button");
		addRuleBtn.type = "button";
		addRuleBtn.className = "dme-btn dme-add-rule";
		addRuleBtn.textContent = "+ Add Rule";
		addRuleBtn.addEventListener("click", () => {
			const inputEntries: DmnInputEntry[] = dt.inputs.map(() => ({ id: uid(), text: "" }));
			const outputEntries: DmnOutputEntry[] = dt.outputs.map(() => ({ id: uid(), text: "" }));
			dt.rules.push({ id: uid(), inputEntries, outputEntries });
			rerender();
			this._emit();
		});
		section.appendChild(addRuleBtn);

		return section;
	}

	private _buildTable(dt: DmnDecisionTable, rerender: () => void): HTMLTableElement {
		const table = document.createElement("table");
		table.className = "dme-table";

		// ── thead ──
		const thead = document.createElement("thead");
		const headerRow = document.createElement("tr");

		// Hit policy cell
		const hpTh = document.createElement("th");
		hpTh.className = "dme-th-hp";

		const hpAbbrSpan = document.createElement("span");
		hpAbbrSpan.className = "dme-hp-abbr";
		hpAbbrSpan.textContent = hpAbbr(dt.hitPolicy, dt.aggregation);

		const hpSel = document.createElement("select");
		hpSel.className = "dme-hp-select";
		const currentHpVal = hpOptionValue({
			hitPolicy: dt.hitPolicy ?? "UNIQUE",
			aggregation: dt.aggregation,
		});
		for (const opt of HP_OPTIONS) {
			const optEl = document.createElement("option");
			optEl.value = hpOptionValue(opt);
			optEl.textContent = opt.label;
			optEl.selected = hpOptionValue(opt) === currentHpVal;
			hpSel.appendChild(optEl);
		}
		hpSel.addEventListener("change", () => {
			const parts = hpSel.value.split("|");
			dt.hitPolicy = parts[0] as HitPolicy;
			dt.aggregation = parts[1] as DmnAggregation | undefined;
			hpAbbrSpan.textContent = hpAbbr(dt.hitPolicy, dt.aggregation);
			this._emit();
		});

		hpTh.appendChild(hpAbbrSpan);
		hpTh.appendChild(hpSel);
		headerRow.appendChild(hpTh);

		// Input column headers
		for (let i = 0; i < dt.inputs.length; i++) {
			const input = dt.inputs[i];
			if (!input) continue;
			const isLast = i === dt.inputs.length - 1;
			const th = document.createElement("th");
			th.className = isLast ? "dme-th-input dme-last-input" : "dme-th-input";

			const clauseDiv = document.createElement("div");
			clauseDiv.className = "dme-clause";
			clauseDiv.textContent = i === 0 ? "When" : "And";
			th.appendChild(clauseDiv);

			const labelIn = document.createElement("input");
			labelIn.type = "text";
			labelIn.className = "dme-col-label";
			labelIn.value = input.label ?? "";
			labelIn.placeholder = "Label";
			labelIn.addEventListener("input", () => {
				input.label = labelIn.value;
				this._emit();
			});
			th.appendChild(labelIn);

			const exprIn = document.createElement("input");
			exprIn.type = "text";
			exprIn.className = "dme-col-expr";
			exprIn.value = input.inputExpression.text ?? "";
			exprIn.placeholder = "Expression";
			exprIn.addEventListener("input", () => {
				input.inputExpression.text = exprIn.value;
				this._emit();
			});
			th.appendChild(exprIn);

			const footer = document.createElement("div");
			footer.className = "dme-col-footer";

			const typeRefSel = this._buildTypeRefSelect(input.inputExpression.typeRef, (val) => {
				input.inputExpression.typeRef = val;
				this._emit();
			});
			footer.appendChild(typeRefSel);

			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.className = "dme-btn dme-btn-icon";
			delBtn.title = "Remove input column";
			delBtn.textContent = "×";
			delBtn.addEventListener("click", () => {
				dt.inputs.splice(i, 1);
				for (const rule of dt.rules) rule.inputEntries.splice(i, 1);
				rerender();
				this._emit();
			});
			footer.appendChild(delBtn);
			th.appendChild(footer);

			th.addEventListener("contextmenu", (e) => {
				this._openCtxMenu(e, [
					{
						label: "Add input left",
						action: () => {
							dt.inputs.splice(i, 0, {
								id: uid(),
								label: "",
								inputExpression: { id: uid(), text: "" },
							});
							for (const r of dt.rules) r.inputEntries.splice(i, 0, { id: uid(), text: "" });
							rerender();
							this._emit();
						},
					},
					{
						label: "Add input right",
						action: () => {
							dt.inputs.splice(i + 1, 0, {
								id: uid(),
								label: "",
								inputExpression: { id: uid(), text: "" },
							});
							for (const r of dt.rules) r.inputEntries.splice(i + 1, 0, { id: uid(), text: "" });
							rerender();
							this._emit();
						},
					},
					"sep",
					{
						label: "Remove column",
						action: () => {
							dt.inputs.splice(i, 1);
							for (const r of dt.rules) r.inputEntries.splice(i, 1);
							rerender();
							this._emit();
						},
					},
				]);
			});

			headerRow.appendChild(th);
		}

		// Output column headers
		for (let i = 0; i < dt.outputs.length; i++) {
			const output = dt.outputs[i];
			if (!output) continue;
			const th = document.createElement("th");
			th.className = "dme-th-output";

			const clauseDiv = document.createElement("div");
			clauseDiv.className = "dme-clause";
			clauseDiv.textContent = i === 0 ? "Then" : "And";
			th.appendChild(clauseDiv);

			const labelIn = document.createElement("input");
			labelIn.type = "text";
			labelIn.className = "dme-col-label";
			labelIn.value = output.label ?? "";
			labelIn.placeholder = "Label";
			labelIn.addEventListener("input", () => {
				output.label = labelIn.value;
				this._emit();
			});
			th.appendChild(labelIn);

			const nameIn = document.createElement("input");
			nameIn.type = "text";
			nameIn.className = "dme-col-expr";
			nameIn.value = output.name ?? "";
			nameIn.placeholder = "Variable";
			nameIn.addEventListener("input", () => {
				output.name = nameIn.value;
				this._emit();
			});
			th.appendChild(nameIn);

			const footer = document.createElement("div");
			footer.className = "dme-col-footer";

			const typeRefSel = this._buildTypeRefSelect(output.typeRef, (val) => {
				output.typeRef = val;
				this._emit();
			});
			footer.appendChild(typeRefSel);

			const delBtn = document.createElement("button");
			delBtn.type = "button";
			delBtn.className = "dme-btn dme-btn-icon";
			delBtn.title = "Remove output column";
			delBtn.textContent = "×";
			delBtn.addEventListener("click", () => {
				dt.outputs.splice(i, 1);
				for (const rule of dt.rules) rule.outputEntries.splice(i, 1);
				rerender();
				this._emit();
			});
			footer.appendChild(delBtn);
			th.appendChild(footer);

			th.addEventListener("contextmenu", (e) => {
				this._openCtxMenu(e, [
					{
						label: "Add output left",
						action: () => {
							dt.outputs.splice(i, 0, { id: uid(), label: "", name: "" });
							for (const r of dt.rules) r.outputEntries.splice(i, 0, { id: uid(), text: "" });
							rerender();
							this._emit();
						},
					},
					{
						label: "Add output right",
						action: () => {
							dt.outputs.splice(i + 1, 0, { id: uid(), label: "", name: "" });
							for (const r of dt.rules) r.outputEntries.splice(i + 1, 0, { id: uid(), text: "" });
							rerender();
							this._emit();
						},
					},
					"sep",
					{
						label: "Remove column",
						action: () => {
							dt.outputs.splice(i, 1);
							for (const r of dt.rules) r.outputEntries.splice(i, 1);
							rerender();
							this._emit();
						},
					},
				]);
			});

			headerRow.appendChild(th);
		}

		// Annotation column header
		const annotTh = document.createElement("th");
		annotTh.className = "dme-th-annotation";
		const annotClause = document.createElement("div");
		annotClause.className = "dme-clause";
		annotClause.textContent = "Annotation";
		annotTh.appendChild(annotClause);
		headerRow.appendChild(annotTh);

		// Add column buttons
		const addTh = document.createElement("th");
		addTh.className = "dme-th-add";

		const addInBtn = document.createElement("button");
		addInBtn.type = "button";
		addInBtn.className = "dme-btn dme-btn-icon";
		addInBtn.title = "Add input column";
		addInBtn.textContent = "+I";
		addInBtn.addEventListener("click", () => {
			dt.inputs.push({ id: uid(), label: "", inputExpression: { id: uid(), text: "" } });
			for (const rule of dt.rules) rule.inputEntries.push({ id: uid(), text: "" });
			rerender();
			this._emit();
		});
		addTh.appendChild(addInBtn);

		const addOutBtn = document.createElement("button");
		addOutBtn.type = "button";
		addOutBtn.className = "dme-btn dme-btn-icon";
		addOutBtn.title = "Add output column";
		addOutBtn.textContent = "+O";
		addOutBtn.addEventListener("click", () => {
			dt.outputs.push({ id: uid(), label: "", name: "" });
			for (const rule of dt.rules) rule.outputEntries.push({ id: uid(), text: "" });
			rerender();
			this._emit();
		});
		addTh.appendChild(addOutBtn);

		headerRow.appendChild(addTh);
		thead.appendChild(headerRow);
		table.appendChild(thead);

		// ── tbody ──
		const tbody = document.createElement("tbody");
		for (let ri = 0; ri < dt.rules.length; ri++) {
			const rule = dt.rules[ri];
			if (!rule) continue;
			tbody.appendChild(this._buildRuleRow(rule, ri, dt, rerender));
		}
		table.appendChild(tbody);

		return table;
	}

	private _buildTypeRefSelect(
		current: DmnTypeRef | undefined,
		onChange: (val: DmnTypeRef | undefined) => void,
	): HTMLSelectElement {
		const sel = document.createElement("select");
		sel.className = "dme-typeref";
		for (const tr of TYPEREFS) {
			const opt = document.createElement("option");
			opt.value = tr.value;
			opt.textContent = tr.label;
			opt.selected = (current ?? "") === tr.value;
			sel.appendChild(opt);
		}
		sel.addEventListener("change", () => {
			onChange((sel.value || undefined) as DmnTypeRef | undefined);
		});
		return sel;
	}

	private _buildRuleRow(
		rule: DmnRule,
		ruleIdx: number,
		dt: DmnDecisionTable,
		rerender: () => void,
	): HTMLTableRowElement {
		const tr = document.createElement("tr");

		const numTd = document.createElement("td");
		numTd.className = "dme-row-num";
		numTd.textContent = String(ruleIdx + 1);
		numTd.addEventListener("contextmenu", (e) => {
			this._openCtxMenu(e, [
				{
					label: "Add rule above",
					action: () => {
						const inputEntries: DmnInputEntry[] = dt.inputs.map(() => ({ id: uid(), text: "" }));
						const outputEntries: DmnOutputEntry[] = dt.outputs.map(() => ({ id: uid(), text: "" }));
						dt.rules.splice(ruleIdx, 0, { id: uid(), inputEntries, outputEntries });
						rerender();
						this._emit();
					},
				},
				{
					label: "Add rule below",
					action: () => {
						const inputEntries: DmnInputEntry[] = dt.inputs.map(() => ({ id: uid(), text: "" }));
						const outputEntries: DmnOutputEntry[] = dt.outputs.map(() => ({ id: uid(), text: "" }));
						dt.rules.splice(ruleIdx + 1, 0, { id: uid(), inputEntries, outputEntries });
						rerender();
						this._emit();
					},
				},
				"sep",
				{
					label: "Remove rule",
					action: () => {
						dt.rules.splice(ruleIdx, 1);
						rerender();
						this._emit();
					},
				},
			]);
		});
		tr.appendChild(numTd);

		for (let i = 0; i < dt.inputs.length; i++) {
			const entry = rule.inputEntries[i];
			if (!entry) continue;
			const td = document.createElement("td");
			if (i === dt.inputs.length - 1) td.className = "dme-last-input";
			td.appendChild(this._buildEntryInput(entry));
			tr.appendChild(td);
		}

		for (let i = 0; i < dt.outputs.length; i++) {
			const entry = rule.outputEntries[i];
			if (!entry) continue;
			const td = document.createElement("td");
			td.appendChild(this._buildEntryInput(entry));
			tr.appendChild(td);
		}

		const annotTd = document.createElement("td");
		annotTd.className = "dme-cell-annotation";
		const annotTa = document.createElement("textarea");
		annotTa.className = "dme-entry";
		annotTa.value = rule.description ?? "";
		annotTa.rows = 1;
		annotTa.spellcheck = false;
		annotTa.addEventListener("input", () => {
			rule.description = annotTa.value || undefined;
			annotTa.style.height = "auto";
			annotTa.style.height = `${annotTa.scrollHeight}px`;
			this._emit();
		});
		annotTd.appendChild(annotTa);
		tr.appendChild(annotTd);

		return tr;
	}

	private _buildEntryInput(entry: DmnInputEntry | DmnOutputEntry): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "dme-entry";
		ta.value = entry.text;
		ta.rows = 1;
		ta.spellcheck = false;
		ta.addEventListener("input", () => {
			entry.text = ta.value;
			ta.style.height = "auto";
			ta.style.height = `${ta.scrollHeight}px`;
			this._emit();
		});
		return ta;
	}
}
