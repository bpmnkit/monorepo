import { Form } from "@bpmn-sdk/core";
import type {
	FormComponent,
	FormDefinition,
	FormGroupComponent,
	FormValueOption,
} from "@bpmn-sdk/core";
import { injectFormEditorStyles } from "./css.js";

export interface FormEditorOptions {
	container: HTMLElement;
	theme?: "dark" | "light";
}

type DragSource = { kind: "palette"; fieldType: string } | { kind: "canvas"; compId: string };

type DropTarget = { index: number; parentId: string | null };

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

const FIELD_TYPES = new Set([
	"textfield",
	"textarea",
	"number",
	"select",
	"radio",
	"checkbox",
	"checklist",
	"taglist",
	"filepicker",
	"datetime",
	"expression",
	"table",
]);

const OPTION_TYPES = new Set(["select", "radio", "checklist", "taglist"]);
const CONTAINER_TYPES = new Set(["group", "dynamiclist"]);

const TYPE_LABELS: Record<string, string> = {
	textfield: "Text Field",
	textarea: "Text Area",
	number: "Number",
	select: "Select",
	radio: "Radio",
	checkbox: "Checkbox",
	checklist: "Checklist",
	taglist: "Tag List",
	filepicker: "File Picker",
	datetime: "Date / Time",
	expression: "Expression",
	table: "Table",
	text: "Text",
	html: "HTML",
	image: "Image",
	button: "Button",
	separator: "Separator",
	spacer: "Spacer",
	iframe: "iFrame",
	group: "Group",
	dynamiclist: "Dynamic List",
};

const PALETTE_ICONS: Record<string, string> = {
	textfield: "Aa",
	textarea: "¶",
	number: "123",
	datetime: "⏱",
	filepicker: "↑",
	expression: "ƒ",
	checkbox: "✓",
	radio: "◎",
	select: "▾",
	checklist: "☑",
	taglist: "⊞",
	text: "T",
	html: "<>",
	image: "⊡",
	table: "⊟",
	separator: "—",
	spacer: "░",
	group: "⬚",
	dynamiclist: "≋",
	iframe: "◫",
	button: "▶",
};

const PALETTE_GROUPS: Array<{ label: string; group: string; types: string[] }> = [
	{
		label: "Input",
		group: "input",
		types: ["textfield", "textarea", "number", "datetime", "filepicker", "expression"],
	},
	{
		label: "Selection",
		group: "selection",
		types: ["checkbox", "radio", "select", "checklist", "taglist"],
	},
	{
		label: "Presentation",
		group: "presentation",
		types: ["text", "html", "image", "table", "separator", "spacer"],
	},
	{
		label: "Containers",
		group: "container",
		types: ["group", "dynamiclist", "iframe"],
	},
	{ label: "Action", group: "action", types: ["button"] },
];

/** Group name for a given type. */
function typeGroup(type: string): string {
	for (const g of PALETTE_GROUPS) {
		if (g.types.includes(type)) return g.group;
	}
	return "input";
}

/** Icon color CSS class. */
function groupIconClass(group: string): string {
	return `fe-palette-item-${group}`;
}

function makeDefaultComponent(type: string): FormComponent {
	const id = uid();
	if (type === "textfield" || type === "textarea" || type === "number") {
		return { id, type, label: "Label", key: `field_${id}` } as FormComponent;
	}
	if (type === "select" || type === "radio") {
		return { id, type, label: "Label", key: `field_${id}`, values: [] } as FormComponent;
	}
	if (type === "checkbox") {
		return { id, type, label: "Label", key: `field_${id}` } as FormComponent;
	}
	if (type === "checklist" || type === "taglist") {
		return { id, type, label: "Label", key: `field_${id}`, values: [] } as FormComponent;
	}
	if (type === "filepicker") {
		return { id, type, label: "File", key: `field_${id}` } as FormComponent;
	}
	if (type === "datetime") {
		return { id, type, key: `field_${id}` } as FormComponent;
	}
	if (type === "button") {
		return { id, type, label: "Submit", action: "submit" } as FormComponent;
	}
	if (type === "text") {
		return { id, type, text: "Text content" } as FormComponent;
	}
	if (type === "html") {
		return { id, type, content: "<p>HTML content</p>" } as FormComponent;
	}
	if (type === "image") {
		return { id, type, source: "" } as FormComponent;
	}
	if (type === "separator" || type === "spacer") {
		return { id, type } as FormComponent;
	}
	if (type === "iframe") {
		return { id, type, url: "", height: 200 } as FormComponent;
	}
	if (type === "expression") {
		return { id, type, key: `expr_${id}`, expression: "" } as FormComponent;
	}
	if (type === "table") {
		return { id, type, label: "Table" } as FormComponent;
	}
	if (type === "group") {
		return { id, type, label: "Group", components: [] } as FormComponent;
	}
	if (type === "dynamiclist") {
		return { id, type, label: "List", components: [], path: `list_${id}` } as FormComponent;
	}
	return { id, type } as FormComponent;
}

/** Build a lightweight non-interactive preview for a component. */
function buildPreview(comp: FormComponent): HTMLElement {
	const el = document.createElement("div");
	el.className = "fe-preview";

	const labelText =
		("label" in comp && typeof comp.label === "string" && comp.label) ||
		TYPE_LABELS[comp.type] ||
		comp.type;

	switch (comp.type) {
		case "textfield":
		case "number":
		case "filepicker":
		case "datetime":
		case "expression": {
			const lbl = document.createElement("div");
			lbl.className = "fe-preview-label";
			lbl.textContent = labelText;
			el.appendChild(lbl);
			const inp = document.createElement("div");
			inp.className = "fe-preview-input";
			el.appendChild(inp);
			break;
		}
		case "textarea": {
			const lbl = document.createElement("div");
			lbl.className = "fe-preview-label";
			lbl.textContent = labelText;
			el.appendChild(lbl);
			const inp = document.createElement("div");
			inp.className = "fe-preview-textarea";
			el.appendChild(inp);
			break;
		}
		case "checkbox": {
			const row = document.createElement("div");
			row.className = "fe-preview-checkbox-row";
			const box = document.createElement("div");
			box.className = "fe-preview-checkbox";
			const span = document.createElement("span");
			span.textContent = labelText;
			row.appendChild(box);
			row.appendChild(span);
			el.appendChild(row);
			break;
		}
		case "radio":
		case "checklist": {
			const lbl = document.createElement("div");
			lbl.className = "fe-preview-label";
			lbl.textContent = labelText;
			el.appendChild(lbl);
			const opts = (comp as { values?: FormValueOption[] }).values?.slice(0, 3) ?? [];
			if (opts.length === 0) {
				const r = document.createElement("div");
				r.className = "fe-preview-option-row";
				const dot = document.createElement("div");
				dot.className = comp.type === "radio" ? "fe-preview-radio" : "fe-preview-checkbox";
				const span = document.createElement("span");
				span.textContent = "Option";
				r.appendChild(dot);
				r.appendChild(span);
				el.appendChild(r);
			} else {
				for (const opt of opts) {
					const r = document.createElement("div");
					r.className = "fe-preview-option-row";
					const dot = document.createElement("div");
					dot.className = comp.type === "radio" ? "fe-preview-radio" : "fe-preview-checkbox";
					const span = document.createElement("span");
					span.textContent = opt.label;
					r.appendChild(dot);
					r.appendChild(span);
					el.appendChild(r);
				}
			}
			break;
		}
		case "select":
		case "taglist": {
			const lbl = document.createElement("div");
			lbl.className = "fe-preview-label";
			lbl.textContent = labelText;
			el.appendChild(lbl);
			const sel = document.createElement("div");
			sel.className = "fe-preview-select";
			const placeholder = document.createElement("span");
			placeholder.textContent = "Select…";
			const arrow = document.createElement("span");
			arrow.textContent = "▾";
			sel.appendChild(placeholder);
			sel.appendChild(arrow);
			el.appendChild(sel);
			break;
		}
		case "button": {
			const btn = document.createElement("div");
			btn.className = "fe-preview-button";
			btn.textContent = labelText;
			el.appendChild(btn);
			break;
		}
		case "text": {
			const p = document.createElement("div");
			p.className = "fe-preview-text";
			const txt = (comp as { text?: string }).text ?? "";
			p.textContent = txt.slice(0, 80);
			el.appendChild(p);
			break;
		}
		case "html":
		case "table":
		case "iframe": {
			const badge = document.createElement("span");
			badge.className = "fe-preview-badge";
			badge.textContent = TYPE_LABELS[comp.type] ?? comp.type;
			el.appendChild(badge);
			break;
		}
		case "image": {
			const img = document.createElement("div");
			img.className = "fe-preview-image";
			img.textContent = "⊡  Image";
			el.appendChild(img);
			break;
		}
		case "separator": {
			const hr = document.createElement("hr");
			hr.className = "fe-preview-separator";
			el.appendChild(hr);
			break;
		}
		case "spacer": {
			const sp = document.createElement("div");
			sp.className = "fe-preview-spacer";
			el.appendChild(sp);
			break;
		}
		case "group":
		case "dynamiclist": {
			const lbl = document.createElement("div");
			lbl.className = "fe-preview-group-label";
			lbl.textContent = labelText;
			el.appendChild(lbl);
			break;
		}
		default: {
			const badge = document.createElement("span");
			badge.className = "fe-preview-badge";
			badge.textContent = comp.type;
			el.appendChild(badge);
		}
	}

	return el;
}

/** Native drag-and-drop form component editor — three-panel layout. */
export class FormEditor {
	private _form: FormDefinition | null = null;
	private _selectedId: string | null = null;
	private _dragSource: DragSource | null = null;
	private readonly _root: HTMLDivElement;
	private readonly _canvas: HTMLDivElement;
	private readonly _props: HTMLDivElement;
	private readonly _handlers: Array<() => void> = [];
	private _destroyed = false;

	constructor(options: FormEditorOptions) {
		injectFormEditorStyles();

		this._root = document.createElement("div");
		this._root.className = `form-editor ${options.theme ?? "light"}`;

		const palette = this._buildPalette();
		this._root.appendChild(palette);

		this._canvas = document.createElement("div");
		this._canvas.className = "fe-canvas";
		this._root.appendChild(this._canvas);

		this._props = document.createElement("div");
		this._props.className = "fe-props";
		this._root.appendChild(this._props);

		options.container.appendChild(this._root);

		this._renderCanvas();
		this._renderProps();
	}

	async loadSchema(schema: Record<string, unknown>): Promise<void> {
		this._form = Form.parse(JSON.stringify(schema));
		this._selectedId = null;
		this._renderCanvas();
		this._renderProps();
	}

	getSchema(): Record<string, unknown> {
		if (!this._form) return {};
		return JSON.parse(Form.export(this._form)) as Record<string, unknown>;
	}

	onChange(handler: () => void): () => void {
		this._handlers.push(handler);
		return () => {
			const idx = this._handlers.indexOf(handler);
			if (idx !== -1) this._handlers.splice(idx, 1);
		};
	}

	setTheme(theme: "dark" | "light"): void {
		this._root.className = `form-editor ${theme}`;
	}

	destroy(): void {
		this._destroyed = true;
		this._handlers.length = 0;
		this._root.remove();
	}

	private _emit(): void {
		if (this._destroyed) return;
		for (const h of this._handlers) h();
	}

	// ── Palette ──────────────────────────────────────────────────────────────────

	private _buildPalette(): HTMLDivElement {
		const palette = document.createElement("div");
		palette.className = "fe-palette";

		const header = document.createElement("div");
		header.className = "fe-palette-header";
		header.textContent = "Components";
		palette.appendChild(header);

		const search = document.createElement("input");
		search.type = "search";
		search.className = "fe-palette-search";
		search.placeholder = "Search…";
		palette.appendChild(search);

		const entries = document.createElement("div");
		entries.className = "fe-palette-entries";
		palette.appendChild(entries);

		const groupEls: Array<{
			groupEl: HTMLDivElement;
			items: Array<{ itemEl: HTMLButtonElement; type: string; label: string }>;
		}> = [];

		for (const g of PALETTE_GROUPS) {
			const groupEl = document.createElement("div");
			groupEl.className = "fe-palette-group";

			const groupLabel = document.createElement("div");
			groupLabel.className = "fe-palette-group-label";
			groupLabel.textContent = g.label;
			groupEl.appendChild(groupLabel);

			const groupItems = document.createElement("div");
			groupItems.className = "fe-palette-group-items";
			groupEl.appendChild(groupItems);

			const items: Array<{ itemEl: HTMLButtonElement; type: string; label: string }> = [];

			for (const type of g.types) {
				const label = TYPE_LABELS[type] ?? type;
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = `fe-palette-item ${groupIconClass(g.group)}`;
				btn.draggable = true;
				btn.title = label;

				const icon = document.createElement("div");
				icon.className = "fe-palette-icon";
				icon.textContent = PALETTE_ICONS[type] ?? type.slice(0, 2);
				btn.appendChild(icon);

				const lbl = document.createElement("div");
				lbl.className = "fe-palette-item-label";
				lbl.textContent = label;
				btn.appendChild(lbl);

				btn.addEventListener("click", () => {
					this._addComponent(type, { index: this._getList(null).length, parentId: null });
				});

				btn.addEventListener("dragstart", (e) => {
					this._dragSource = { kind: "palette", fieldType: type };
					if (e.dataTransfer) {
						e.dataTransfer.effectAllowed = "copy";
						e.dataTransfer.setData("text/plain", type);
					}
					this._canvas.classList.add("fe-dragging");
				});

				btn.addEventListener("dragend", () => {
					this._endDrag();
				});

				groupItems.appendChild(btn);
				items.push({ itemEl: btn, type, label: label.toLowerCase() });
			}

			entries.appendChild(groupEl);
			groupEls.push({ groupEl, items });
		}

		search.addEventListener("input", () => {
			const q = search.value.toLowerCase().trim();
			for (const { groupEl, items } of groupEls) {
				let anyVisible = false;
				for (const { itemEl, type, label } of items) {
					const visible = !q || type.includes(q) || label.includes(q);
					itemEl.style.display = visible ? "" : "none";
					if (visible) anyVisible = true;
				}
				groupEl.style.display = anyVisible ? "" : "none";
			}
		});

		return palette;
	}

	// ── Canvas ───────────────────────────────────────────────────────────────────

	private _renderCanvas(): void {
		this._canvas.innerHTML = "";

		if (!this._form || this._form.components.length === 0) {
			this._canvas.appendChild(this._buildEmptyState());
			return;
		}

		const inner = document.createElement("div");
		inner.className = "fe-canvas-inner";
		this._appendDropZone(inner, 0, null);
		for (let i = 0; i < this._form.components.length; i++) {
			const comp = this._form.components[i];
			if (!comp) continue;
			this._appendCard(inner, comp);
			this._appendDropZone(inner, i + 1, null);
		}
		this._canvas.appendChild(inner);
	}

	private _buildEmptyState(): HTMLDivElement {
		const empty = document.createElement("div");
		empty.className = "fe-canvas-empty";

		const icon = document.createElement("div");
		icon.className = "fe-canvas-empty-icon";
		icon.textContent = "⊡";
		empty.appendChild(icon);

		const heading = document.createElement("div");
		heading.className = "fe-canvas-empty-heading";
		heading.textContent = "Build your form";
		empty.appendChild(heading);

		const hint = document.createElement("div");
		hint.className = "fe-canvas-empty-hint";
		hint.textContent = "Drag and drop components here to start designing.";
		empty.appendChild(hint);

		empty.addEventListener("dragover", (e) => {
			if (!this._dragSource) return;
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
			empty.classList.add("fe-canvas-empty-active");
		});

		empty.addEventListener("dragleave", (e) => {
			if (!empty.contains(e.relatedTarget as Node | null)) {
				empty.classList.remove("fe-canvas-empty-active");
			}
		});

		empty.addEventListener("drop", (e) => {
			e.preventDefault();
			this._handleDrop({ index: 0, parentId: null });
			this._endDrag();
		});

		return empty;
	}

	private _appendDropZone(parent: HTMLElement, index: number, parentId: string | null): void {
		const zone = document.createElement("div");
		zone.className = "fe-drop-zone";

		zone.addEventListener("dragover", (e) => {
			if (!this._dragSource) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = this._dragSource.kind === "palette" ? "copy" : "move";
			}
			zone.classList.add("fe-drop-zone-active");
		});

		zone.addEventListener("dragleave", (e) => {
			if (!zone.contains(e.relatedTarget as Node | null)) {
				zone.classList.remove("fe-drop-zone-active");
			}
		});

		zone.addEventListener("drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			zone.classList.remove("fe-drop-zone-active");
			this._handleDrop({ index, parentId });
			this._endDrag();
		});

		parent.appendChild(zone);
	}

	private _appendCard(parent: HTMLElement, comp: FormComponent): void {
		const card = document.createElement("div");
		card.className = `fe-canvas-card${comp.id === this._selectedId ? " selected" : ""}`;
		card.draggable = true;
		card.dataset.compId = comp.id;

		const handle = document.createElement("div");
		handle.className = "fe-card-drag-handle";
		handle.textContent = "⠿";
		card.appendChild(handle);

		const content = document.createElement("div");
		content.className = "fe-card-content";
		content.appendChild(buildPreview(comp));

		// Container children
		if (CONTAINER_TYPES.has(comp.type)) {
			const gc = comp as FormGroupComponent;
			const children = gc.components ?? [];
			const containerCanvas = document.createElement("div");
			containerCanvas.className = "fe-container-canvas";

			if (children.length === 0) {
				containerCanvas.appendChild(this._buildContainerEmpty(comp.id));
			} else {
				this._appendDropZone(containerCanvas, 0, comp.id);
				for (let i = 0; i < children.length; i++) {
					const child = children[i];
					if (!child) continue;
					this._appendCard(containerCanvas, child);
					this._appendDropZone(containerCanvas, i + 1, comp.id);
				}
			}

			content.appendChild(containerCanvas);
		}

		card.appendChild(content);

		const delBtn = document.createElement("button");
		delBtn.type = "button";
		delBtn.className = "fe-card-delete";
		delBtn.textContent = "✕";
		delBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this._deleteComp(comp.id);
		});
		card.appendChild(delBtn);

		// Select on click
		card.addEventListener("click", (e) => {
			e.stopPropagation();
			this._selectedId = comp.id;
			this._renderCanvas();
			this._renderProps();
		});

		// Drag from canvas
		card.addEventListener("dragstart", (e) => {
			e.stopPropagation();
			this._dragSource = { kind: "canvas", compId: comp.id };
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData("text/plain", comp.id);
			}
			this._canvas.classList.add("fe-dragging");
			requestAnimationFrame(() => {
				card.classList.add("fe-card-dragging");
			});
		});

		card.addEventListener("dragend", () => {
			card.classList.remove("fe-card-dragging");
			this._endDrag();
		});

		parent.appendChild(card);
	}

	private _buildContainerEmpty(parentId: string): HTMLDivElement {
		const empty = document.createElement("div");
		empty.className = "fe-container-empty";
		empty.textContent = "Drag and drop components here.";

		empty.addEventListener("dragover", (e) => {
			if (!this._dragSource) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.dataTransfer) {
				e.dataTransfer.dropEffect = this._dragSource.kind === "palette" ? "copy" : "move";
			}
			empty.classList.add("fe-drop-zone-active");
		});

		empty.addEventListener("dragleave", (e) => {
			if (!empty.contains(e.relatedTarget as Node | null)) {
				empty.classList.remove("fe-drop-zone-active");
			}
		});

		empty.addEventListener("drop", (e) => {
			e.preventDefault();
			e.stopPropagation();
			empty.classList.remove("fe-drop-zone-active");
			this._handleDrop({ index: 0, parentId });
			this._endDrag();
		});

		return empty;
	}

	// ── Drag & drop logic ────────────────────────────────────────────────────────

	private _handleDrop(target: DropTarget): void {
		const src = this._dragSource;
		if (!src) return;

		if (src.kind === "palette") {
			this._addComponent(src.fieldType, target);
		} else {
			this._moveComponent(src.compId, target);
		}
	}

	private _addComponent(type: string, target: DropTarget): void {
		if (!this._form) return;
		const comp = makeDefaultComponent(type);
		const list = this._getList(target.parentId);
		list.splice(target.index, 0, comp);
		this._selectedId = comp.id;
		this._renderCanvas();
		this._renderProps();
		this._emit();
	}

	private _moveComponent(compId: string, target: DropTarget): void {
		const found = this._findComp(compId);
		if (!found) return;

		// Prevent dropping a container into itself
		if (target.parentId !== null) {
			const targetParent = this._findComp(target.parentId);
			if (targetParent && this._isAncestorOf(compId, target.parentId)) return;
		}

		const targetList = this._getList(target.parentId);
		found.list.splice(found.idx, 1);

		let insertIdx = target.index;
		if (found.list === targetList && found.idx < insertIdx) {
			insertIdx--;
		}

		targetList.splice(Math.max(0, insertIdx), 0, found.comp);
		this._renderCanvas();
		this._emit();
	}

	private _isAncestorOf(ancestorId: string, descendantId: string): boolean {
		const found = this._findComp(ancestorId);
		if (!found || !CONTAINER_TYPES.has(found.comp.type)) return false;
		const gc = found.comp as FormGroupComponent;
		for (const child of gc.components ?? []) {
			if (child.id === descendantId) return true;
			if (this._isAncestorOf(child.id, descendantId)) return true;
		}
		return false;
	}

	private _endDrag(): void {
		this._dragSource = null;
		this._canvas.classList.remove("fe-dragging");
		for (const el of Array.from(this._canvas.querySelectorAll(".fe-drop-zone-active"))) {
			el.classList.remove("fe-drop-zone-active");
		}
		for (const el of Array.from(this._canvas.querySelectorAll(".fe-canvas-empty-active"))) {
			el.classList.remove("fe-canvas-empty-active");
		}
	}

	private _deleteComp(id: string): void {
		const found = this._findComp(id);
		if (!found) return;
		found.list.splice(found.idx, 1);
		if (this._selectedId === id) {
			this._selectedId = null;
			this._renderProps();
		}
		this._renderCanvas();
		this._emit();
	}

	// ── Helpers ──────────────────────────────────────────────────────────────────

	private _getList(parentId: string | null): FormComponent[] {
		if (!this._form) return [];
		if (parentId === null) return this._form.components;
		const found = this._findComp(parentId);
		if (!found || !CONTAINER_TYPES.has(found.comp.type)) return [];
		const gc = found.comp as FormGroupComponent;
		if (!gc.components) gc.components = [];
		return gc.components;
	}

	private _findComp(
		id: string,
	): { comp: FormComponent; list: FormComponent[]; idx: number } | null {
		if (!this._form) return null;
		return this._searchList(this._form.components, id);
	}

	private _searchList(
		list: FormComponent[],
		id: string,
	): { comp: FormComponent; list: FormComponent[]; idx: number } | null {
		for (let i = 0; i < list.length; i++) {
			const comp = list[i];
			if (!comp) continue;
			if (comp.id === id) return { comp, list, idx: i };
			if (CONTAINER_TYPES.has(comp.type)) {
				const gc = comp as FormGroupComponent;
				const found = this._searchList(gc.components ?? [], id);
				if (found) return found;
			}
		}
		return null;
	}

	// ── Properties panel ─────────────────────────────────────────────────────────

	private _renderProps(): void {
		this._props.innerHTML = "";

		const header = document.createElement("div");
		header.className = "fe-props-header";

		const titleRow = document.createElement("div");
		titleRow.className = "fe-props-header-title";

		const iconEl = document.createElement("div");
		iconEl.className = "fe-props-header-icon";

		const typeEl = document.createElement("div");
		typeEl.className = "fe-props-header-type";

		titleRow.appendChild(iconEl);
		titleRow.appendChild(typeEl);
		header.appendChild(titleRow);

		const hintEl = document.createElement("div");
		hintEl.className = "fe-props-header-hint";
		header.appendChild(hintEl);

		this._props.appendChild(header);

		if (!this._selectedId) {
			iconEl.textContent = "⊞";
			iconEl.style.background = "#e5e7eb";
			iconEl.style.color = "#374151";
			typeEl.textContent = "Form";
			hintEl.textContent = "Select a form field to edit its properties.";
			return;
		}

		const found = this._findComp(this._selectedId);
		if (!found) return;

		const { comp } = found;
		const group = typeGroup(comp.type);
		iconEl.textContent = PALETTE_ICONS[comp.type] ?? comp.type.slice(0, 2);
		// Apply icon color via inline style matching palette colors
		const groupColors: Record<string, { bg: string; fg: string }> = {
			input: { bg: "#dbeafe", fg: "#1d4ed8" },
			selection: { bg: "#dcfce7", fg: "#15803d" },
			presentation: { bg: "#fef3c7", fg: "#92400e" },
			container: { bg: "#ede9fe", fg: "#6d28d9" },
			action: { bg: "#fee2e2", fg: "#b91c1c" },
		};
		const colors = groupColors[group] ?? groupColors.input;
		if (colors) {
			iconEl.style.background = colors.bg;
			iconEl.style.color = colors.fg;
		}
		typeEl.textContent = TYPE_LABELS[comp.type] ?? comp.type;
		hintEl.textContent =
			("label" in comp && typeof comp.label === "string" && comp.label) ||
			("key" in comp && typeof (comp as { key?: string }).key === "string"
				? ((comp as { key?: string }).key ?? "")
				: "") ||
			"";

		const body = document.createElement("div");
		body.className = "fe-props-body";
		this._buildPropsFor(comp, body);
		this._props.appendChild(body);
	}

	private _buildPropsFor(comp: FormComponent, body: HTMLElement): void {
		// Label
		if ("label" in comp) {
			body.appendChild(
				this._propRow("Label", () => {
					return this._textInput(String(comp.label ?? ""), (v) => {
						(comp as { label: string }).label = v;
						this._renderCanvas(); // update preview, preserve props focus
						this._emit();
					});
				}),
			);
		}

		// Key (field types)
		if (FIELD_TYPES.has(comp.type) && "key" in comp) {
			body.appendChild(
				this._propRow("Key", () => {
					return this._textInput(String((comp as { key?: string }).key ?? ""), (v) => {
						(comp as { key: string }).key = v;
						this._emit();
					});
				}),
			);
		}

		// Required
		if (FIELD_TYPES.has(comp.type)) {
			const validate = (comp as { validate?: { required?: boolean } }).validate ?? {};
			body.appendChild(
				this._propRow("Required", () => {
					return this._checkboxInput(validate.required ?? false, (v) => {
						(comp as { validate: { required: boolean } }).validate = {
							...validate,
							required: v,
						};
						this._emit();
					});
				}),
			);
		}

		// Text content
		if (comp.type === "text") {
			body.appendChild(
				this._propRow("Text (Markdown)", () => {
					return this._textareaInput((comp as { text: string }).text, (v) => {
						(comp as { text: string }).text = v;
						this._renderCanvas();
						this._emit();
					});
				}),
			);
		}

		// HTML
		if (comp.type === "html") {
			body.appendChild(
				this._propRow("HTML Content", () => {
					return this._textareaInput((comp as { content?: string }).content ?? "", (v) => {
						(comp as { content: string }).content = v;
						this._emit();
					});
				}),
			);
		}

		// Image source
		if (comp.type === "image") {
			body.appendChild(
				this._propRow("Source URL", () => {
					return this._textInput((comp as { source?: string }).source ?? "", (v) => {
						(comp as { source: string }).source = v;
						this._emit();
					});
				}),
			);
		}

		// iFrame URL
		if (comp.type === "iframe") {
			body.appendChild(
				this._propRow("URL", () => {
					return this._textInput((comp as { url?: string }).url ?? "", (v) => {
						(comp as { url: string }).url = v;
						this._emit();
					});
				}),
			);
		}

		// Expression
		if (comp.type === "expression") {
			body.appendChild(
				this._propRow("Expression", () => {
					return this._textInput((comp as { expression?: string }).expression ?? "", (v) => {
						(comp as { expression: string }).expression = v;
						this._emit();
					});
				}),
			);
		}

		// Options
		if (OPTION_TYPES.has(comp.type)) {
			const withValues = comp as { values?: FormValueOption[] };
			if (!withValues.values) withValues.values = [];
			body.appendChild(this._optionsEditor(withValues.values));
		}
	}

	// ── Property input helpers ────────────────────────────────────────────────────

	private _propRow(label: string, buildInput: () => HTMLElement): HTMLElement {
		const row = document.createElement("div");
		row.className = "fe-prop-row";
		const lbl = document.createElement("label");
		lbl.className = "fe-prop-label";
		lbl.textContent = label;
		row.appendChild(lbl);
		row.appendChild(buildInput());
		return row;
	}

	private _textInput(value: string, onChange: (v: string) => void): HTMLInputElement {
		const input = document.createElement("input");
		input.type = "text";
		input.className = "fe-prop-input";
		input.value = value;
		input.addEventListener("input", () => onChange(input.value));
		return input;
	}

	private _textareaInput(value: string, onChange: (v: string) => void): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "fe-prop-input";
		ta.value = value;
		ta.rows = 4;
		ta.style.resize = "vertical";
		ta.addEventListener("input", () => onChange(ta.value));
		return ta;
	}

	private _checkboxInput(checked: boolean, onChange: (v: boolean) => void): HTMLElement {
		const label = document.createElement("label");
		label.className = "fe-prop-checkbox";
		const cb = document.createElement("input");
		cb.type = "checkbox";
		cb.checked = checked;
		cb.addEventListener("change", () => onChange(cb.checked));
		label.appendChild(cb);
		label.appendChild(document.createTextNode("Required"));
		return label;
	}

	private _optionsEditor(values: FormValueOption[]): HTMLElement {
		const section = document.createElement("div");

		const titleRow = document.createElement("div");
		titleRow.style.display = "flex";
		titleRow.style.alignItems = "center";
		titleRow.style.marginBottom = "6px";

		const lbl = document.createElement("span");
		lbl.className = "fe-prop-label";
		lbl.style.flex = "1";
		lbl.style.marginBottom = "0";
		lbl.textContent = "Options";
		titleRow.appendChild(lbl);

		const addOptBtn = document.createElement("button");
		addOptBtn.type = "button";
		addOptBtn.className = "fe-btn";
		addOptBtn.textContent = "+ Add";
		addOptBtn.addEventListener("click", () => {
			values.push({ label: "Option", value: `option_${uid()}` });
			rebuildList();
			this._emit();
		});
		titleRow.appendChild(addOptBtn);
		section.appendChild(titleRow);

		const list = document.createElement("div");
		list.className = "fe-options-list";
		section.appendChild(list);

		const rebuildList = (): void => {
			list.innerHTML = "";
			for (let i = 0; i < values.length; i++) {
				const opt = values[i];
				if (!opt) continue;
				const row = document.createElement("div");
				row.className = "fe-option-row";

				const labelIn = document.createElement("input");
				labelIn.type = "text";
				labelIn.className = "fe-prop-input";
				labelIn.placeholder = "Label";
				labelIn.value = opt.label;
				labelIn.addEventListener("input", () => {
					opt.label = labelIn.value;
					this._emit();
				});
				row.appendChild(labelIn);

				const valueIn = document.createElement("input");
				valueIn.type = "text";
				valueIn.className = "fe-prop-input";
				valueIn.placeholder = "Value";
				valueIn.value = opt.value;
				valueIn.addEventListener("input", () => {
					opt.value = valueIn.value;
					this._emit();
				});
				row.appendChild(valueIn);

				const delBtn = document.createElement("button");
				delBtn.type = "button";
				delBtn.className = "fe-btn fe-btn-icon fe-btn-danger";
				delBtn.textContent = "×";
				delBtn.addEventListener("click", () => {
					values.splice(i, 1);
					rebuildList();
					this._emit();
				});
				row.appendChild(delBtn);

				list.appendChild(row);
			}
		};

		rebuildList();
		return section;
	}
}
