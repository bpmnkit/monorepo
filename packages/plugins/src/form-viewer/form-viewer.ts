import type {
	FormButtonComponent,
	FormCheckboxComponent,
	FormChecklistComponent,
	FormComponent,
	FormDatetimeComponent,
	FormDefinition,
	FormDocumentPreviewComponent,
	FormDynamicListComponent,
	FormExpressionComponent,
	FormFilepickerComponent,
	FormGroupComponent,
	FormHtmlComponent,
	FormIframeComponent,
	FormImageComponent,
	FormNumberComponent,
	FormRadioComponent,
	FormSelectComponent,
	FormSpacerComponent,
	FormTableComponent,
	FormTaglistComponent,
	FormTextAreaComponent,
	FormTextComponent,
	FormTextFieldComponent,
} from "@bpmn-sdk/core";
import { injectFormViewerStyles } from "./css.js";

export interface FormViewerOptions {
	container: HTMLElement;
	/** "dark" (default) or "light". */
	theme?: "dark" | "light";
}

/**
 * Standalone read-only Camunda Form viewer.
 *
 * Renders a `FormDefinition` as a static HTML preview of all component types.
 * Does not depend on `@bpmn-sdk/canvas`.
 */
export class FormViewer {
	private readonly _container: HTMLElement;
	private readonly _root: HTMLDivElement;
	private _theme: "dark" | "light";
	private _form: FormDefinition | null = null;

	constructor(options: FormViewerOptions) {
		this._container = options.container;
		this._theme = options.theme ?? "dark";

		injectFormViewerStyles();

		this._root = document.createElement("div");
		this._root.className = `form-viewer ${this._theme}`;
		this._container.appendChild(this._root);
	}

	/** Load and render a FormDefinition. */
	load(form: FormDefinition): void {
		this._form = form;
		this._render();
	}

	/** Clear the view. */
	clear(): void {
		this._form = null;
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
		if (!this._form) return;
		this._root.innerHTML = "";
		const body = document.createElement("div");
		body.className = "form-viewer-body";
		renderComponents(this._form.components, body);
		this._root.appendChild(body);
	}
}

/** Group components by their layout.row, preserving order. */
function groupByRow(components: FormComponent[]): FormComponent[][] {
	const rows: FormComponent[][] = [];
	const rowMap = new Map<string, FormComponent[]>();

	for (const c of components) {
		const rowKey = c.layout?.row ?? `__solo_${c.id}`;
		let row = rowMap.get(rowKey);
		if (!row) {
			row = [];
			rowMap.set(rowKey, row);
			rows.push(row);
		}
		row.push(c);
	}
	return rows;
}

function renderComponents(components: FormComponent[], parent: HTMLElement): void {
	const rows = groupByRow(components);
	for (const row of rows) {
		const rowEl = document.createElement("div");
		rowEl.className = "fv-row";
		for (const c of row) {
			const wrapper = document.createElement("div");
			wrapper.className = "fv-field";
			if (c.layout?.columns !== null && c.layout?.columns !== undefined) {
				wrapper.style.flex = `0 0 calc(${c.layout.columns} / 12 * 100% - 6px)`;
			}
			renderComponent(c, wrapper);
			rowEl.appendChild(wrapper);
		}
		parent.appendChild(rowEl);
	}
}

function renderComponent(c: FormComponent, parent: HTMLElement): void {
	// Cast to specific type in each case because FormUnknownComponent's index signature
	// prevents TypeScript from narrowing properties via the discriminant alone.
	const type = c.type;
	switch (type) {
		case "text":
			renderText(c as FormTextComponent, parent);
			break;
		case "textfield":
			renderTextField((c as FormTextFieldComponent).label, "Text…", parent);
			break;
		case "textarea":
			renderTextarea((c as FormTextAreaComponent).label, "Text…", parent);
			break;
		case "number":
			renderTextField((c as FormNumberComponent).label, "0", parent);
			break;
		case "datetime":
			renderDatetime(c as FormDatetimeComponent, parent);
			break;
		case "select": {
			const s = c as FormSelectComponent;
			renderSelect(s.label, s.values ?? [], parent);
			break;
		}
		case "radio": {
			const r = c as FormRadioComponent;
			renderChoices(r.label, r.values, "radio", parent);
			break;
		}
		case "checkbox":
			renderCheckbox((c as FormCheckboxComponent).label, parent);
			break;
		case "checklist": {
			const cl = c as FormChecklistComponent;
			renderChoices(cl.label, cl.values, "checklist", parent);
			break;
		}
		case "taglist": {
			const tl = c as FormTaglistComponent;
			renderTaglist(tl.label, tl.values ?? [], parent);
			break;
		}
		case "button":
			renderButton((c as FormButtonComponent).label, parent);
			break;
		case "group": {
			const g = c as FormGroupComponent;
			renderGroup(g.label, g.components, parent);
			break;
		}
		case "dynamiclist": {
			const dl = c as FormDynamicListComponent;
			renderDynamicList(dl.label, dl.components, parent);
			break;
		}
		case "table": {
			const t = c as FormTableComponent;
			renderTable(t.label, t.columns ?? [], parent);
			break;
		}
		case "image":
			renderImage((c as FormImageComponent).alt, parent);
			break;
		case "iframe": {
			const iframe = c as FormIframeComponent;
			renderIframe(iframe.label, iframe.url, parent);
			break;
		}
		case "separator":
			parent.appendChild(document.createElement("hr")).className = "fv-separator";
			break;
		case "spacer": {
			const spacer = document.createElement("div");
			spacer.className = "fv-spacer";
			spacer.style.height = `${(c as FormSpacerComponent).height ?? 20}px`;
			parent.appendChild(spacer);
			break;
		}
		case "documentPreview":
			renderDocumentPreview((c as FormDocumentPreviewComponent).label, parent);
			break;
		case "html":
			renderHtml((c as FormHtmlComponent).content, parent);
			break;
		case "expression":
			renderExpression((c as FormExpressionComponent).expression, parent);
			break;
		case "filepicker":
			renderFilepicker((c as FormFilepickerComponent).label, parent);
			break;
		default:
			renderUnknown(type, parent);
	}
}

function label(text: string): HTMLElement {
	const el = document.createElement("label");
	el.className = "fv-label";
	el.textContent = text;
	return el;
}

function renderTextField(labelText: string, placeholder: string, parent: HTMLElement): void {
	parent.appendChild(label(labelText));
	const input = document.createElement("div");
	input.className = "fv-input";
	input.textContent = placeholder;
	parent.appendChild(input);
}

function renderTextarea(labelText: string, placeholder: string, parent: HTMLElement): void {
	parent.appendChild(label(labelText));
	const input = document.createElement("div");
	input.className = "fv-input fv-textarea";
	input.textContent = placeholder;
	parent.appendChild(input);
}

function renderDatetime(
	c: { subtype?: string; dateLabel?: string; timeLabel?: string },
	parent: HTMLElement,
): void {
	parent.appendChild(label("Date / Time"));
	const wrapper = document.createElement("div");
	wrapper.className = "fv-datetime-inputs";

	if (!c.subtype || c.subtype === "date" || c.subtype === "datetime") {
		const d = document.createElement("div");
		d.className = "fv-input";
		d.textContent = c.dateLabel ?? "Date…";
		wrapper.appendChild(d);
	}
	if (c.subtype === "time" || c.subtype === "datetime") {
		const t = document.createElement("div");
		t.className = "fv-input";
		t.textContent = c.timeLabel ?? "Time…";
		wrapper.appendChild(t);
	}

	parent.appendChild(wrapper);
}

function renderSelect(
	labelText: string,
	values: Array<{ label: string; value: string }>,
	parent: HTMLElement,
): void {
	parent.appendChild(label(labelText));
	const input = document.createElement("div");
	input.className = "fv-input";
	const first = values[0];
	input.textContent = first ? first.label : "Select…";
	parent.appendChild(input);
}

function renderChoices(
	labelText: string,
	values: Array<{ label: string; value: string }>,
	type: "radio" | "checklist",
	parent: HTMLElement,
): void {
	parent.appendChild(label(labelText));
	for (const v of values) {
		const row = document.createElement("div");
		row.className = "fv-option-row";
		const dot = document.createElement("div");
		dot.className = type === "radio" ? "fv-option-dot" : "fv-option-square";
		row.appendChild(dot);
		row.appendChild(document.createTextNode(v.label));
		parent.appendChild(row);
	}
}

function renderCheckbox(labelText: string, parent: HTMLElement): void {
	const row = document.createElement("div");
	row.className = "fv-option-row";
	const box = document.createElement("div");
	box.className = "fv-option-square";
	row.appendChild(box);
	row.appendChild(document.createTextNode(labelText));
	parent.appendChild(row);
}

function renderTaglist(
	labelText: string,
	values: Array<{ label: string; value: string }>,
	parent: HTMLElement,
): void {
	parent.appendChild(label(labelText));
	const tags = document.createElement("div");
	tags.className = "fv-tags";
	for (const v of values.slice(0, 3)) {
		const tag = document.createElement("span");
		tag.className = "fv-tag";
		tag.textContent = v.label;
		tags.appendChild(tag);
	}
	parent.appendChild(tags);
}

function renderButton(labelText: string, parent: HTMLElement): void {
	const btn = document.createElement("div");
	btn.className = "fv-btn";
	btn.textContent = labelText;
	parent.appendChild(btn);
}

function renderGroup(labelText: string, components: FormComponent[], parent: HTMLElement): void {
	const group = document.createElement("div");
	group.className = "fv-group";
	const groupLabel = document.createElement("div");
	groupLabel.className = "fv-group-label";
	groupLabel.textContent = labelText;
	group.appendChild(groupLabel);
	renderComponents(components, group);
	parent.appendChild(group);
}

function renderDynamicList(
	labelText: string | undefined,
	components: FormComponent[],
	parent: HTMLElement,
): void {
	const dl = document.createElement("div");
	dl.className = "fv-dynamic-list";
	if (labelText) {
		const dlLabel = document.createElement("div");
		dlLabel.className = "fv-dynamic-list-label";
		dlLabel.textContent = labelText;
		dl.appendChild(dlLabel);
	}
	renderComponents(components, dl);
	parent.appendChild(dl);
}

function renderTable(
	labelText: string | undefined,
	columns: Array<{ label: string; key: string }>,
	parent: HTMLElement,
): void {
	if (labelText) parent.appendChild(label(labelText));
	const table = document.createElement("table");
	table.className = "fv-table";
	const thead = document.createElement("thead");
	const tr = document.createElement("tr");
	for (const col of columns) {
		const th = document.createElement("th");
		th.textContent = col.label;
		tr.appendChild(th);
	}
	thead.appendChild(tr);
	table.appendChild(thead);
	// One empty data row as placeholder
	const tbody = document.createElement("tbody");
	const dataRow = document.createElement("tr");
	for (const _ of columns) {
		const td = document.createElement("td");
		td.innerHTML = "&nbsp;";
		dataRow.appendChild(td);
	}
	tbody.appendChild(dataRow);
	table.appendChild(tbody);
	parent.appendChild(table);
}

function renderImage(alt: string | undefined, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-image";
	el.textContent = alt ? `[Image: ${alt}]` : "[Image]";
	parent.appendChild(el);
}

function renderIframe(
	labelText: string | undefined,
	url: string | undefined,
	parent: HTMLElement,
): void {
	const el = document.createElement("div");
	el.className = "fv-iframe";
	el.textContent = labelText ? `[iFrame: ${labelText}]` : url ? `[iFrame: ${url}]` : "[iFrame]";
	parent.appendChild(el);
}

function renderDocumentPreview(labelText: string | undefined, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-document-preview";
	el.textContent = labelText ? `[Document: ${labelText}]` : "[Document Preview]";
	parent.appendChild(el);
}

function renderHtml(content: string | undefined, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-html";
	// Safe: we trust the form definition content (designer-authored, not user input)
	el.innerHTML = content ?? "";
	parent.appendChild(el);
}

function renderExpression(expression: string | undefined, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-expression";
	el.textContent = expression ? `= ${expression}` : "= …";
	parent.appendChild(el);
}

function renderFilepicker(labelText: string | undefined, parent: HTMLElement): void {
	if (labelText) parent.appendChild(label(labelText));
	const input = document.createElement("div");
	input.className = "fv-input";
	input.textContent = "Choose file…";
	parent.appendChild(input);
}

function renderText(c: { text?: string }, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-text";
	// Convert minimal markdown: # headings, **bold**, *italic*
	el.innerHTML = minimalMarkdown(c.text ?? "");
	parent.appendChild(el);
}

function renderUnknown(type: string, parent: HTMLElement): void {
	const el = document.createElement("div");
	el.className = "fv-input";
	el.textContent = `[${type}]`;
	parent.appendChild(el);
}

/** Very minimal markdown: headers, bold, italic. */
function minimalMarkdown(md: string): string {
	return md
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/^### (.+)$/gm, "<h3>$1</h3>")
		.replace(/^## (.+)$/gm, "<h2>$1</h2>")
		.replace(/^# (.+)$/gm, "<h1>$1</h1>")
		.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
		.replace(/\*(.+?)\*/g, "<em>$1</em>")
		.replace(/\n/g, "<br>");
}
