import type { RenderedEdge, RenderedShape } from "@bpmn-sdk/canvas";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import type { FieldSchema, FieldValue, GroupSchema, PanelAdapter, PanelSchema } from "./types.js";

const SVG_NS = "http://www.w3.org/2000/svg";

// Attribute set on the field wrapper div when the field has a condition, used
// by _refreshConditionals to toggle visibility without a full re-render.
const FIELD_WRAPPER_ATTR = "data-field-wrapper";
const STORAGE_KEY_WIDTH = "bpmn-cfg-panel-width";

/**
 * Returns true when a FEEL expression value (starting with "=") has obvious
 * structural errors: empty body, trailing binary operator, or unbalanced
 * string/bracket delimiters.
 */
function hasFEELSyntaxError(val: string): boolean {
	const body = val.startsWith("=") ? val.slice(1).trim() : val.trim();
	if (body === "") return true;

	// Trailing characters that indicate an incomplete binary expression
	if (/[+\-*/^,([{]$/.test(body)) return true;

	// Scan for unbalanced strings and structural delimiters
	let depth = 0;
	let inString = false;
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		if (inString) {
			if (ch === '"') inString = false;
		} else {
			if (ch === '"') inString = true;
			else if (ch === "(" || ch === "[" || ch === "{") depth++;
			else if (ch === ")" || ch === "]" || ch === "}") {
				depth--;
				if (depth < 0) return true;
			}
		}
	}
	return inString || depth !== 0;
}

interface Registration {
	schema: PanelSchema;
	adapter: PanelAdapter;
}

export class ConfigPanelRenderer {
	private readonly _schemas: Map<string, Registration>;
	private readonly _getDefinitions: () => BpmnDefinitions | null;
	private readonly _applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void;
	private readonly _getSvgViewport: (() => SVGGElement | null) | null;
	private readonly _getShapes: (() => RenderedShape[]) | null;
	private readonly _container: HTMLElement | null;
	private readonly _onPanelShow: (() => void) | null;
	private readonly _onPanelHide: (() => void) | null;

	private _panelEl: HTMLElement | null = null;
	/** SVG group appended to the canvas viewport; holds all validation badges. */
	private _badgeContainerEl: SVGGElement | null = null;
	private _collapsed = false;
	/** User-set panel width; persisted to localStorage. */
	private _panelWidth = 320;
	/** Sub-element refs for layout toggling; reset on panel teardown. */
	private _tabsAreaEl: HTMLElement | null = null;
	private _tabsScrollEl: HTMLElement | null = null;
	private _tabsPrevBtn: HTMLButtonElement | null = null;
	private _tabsNextBtn: HTMLButtonElement | null = null;
	private _bodyEl: HTMLElement | null = null;
	private _searchResultsEl: HTMLElement | null = null;
	private _searchClearBtn: HTMLButtonElement | null = null;

	private _searchQuery = "";
	/** Guide bar sub-element refs; reset on panel teardown. */
	private _guideBarEl: HTMLElement | null = null;
	private _guideTextEl: HTMLElement | null = null;
	private _guideBtnEl: HTMLButtonElement | null = null;
	/** Key of the field the guide is currently pointing at. */
	private _guideCurrentKey: string | null = null;
	private _guideStarted = false;
	private _selectedId: string | null = null;
	private _selectedType: string | null = null;
	private _elementName = "";
	private _activeTabId: string | null = null;
	private _values: Record<string, FieldValue> = {};
	/** The effective registration after optional `resolve?` override. */
	private _effectiveReg: Registration | null = null;

	constructor(
		schemas: Map<string, Registration>,
		getDefinitions: () => BpmnDefinitions | null,
		applyChange: (fn: (d: BpmnDefinitions) => BpmnDefinitions) => void,
		getSvgViewport?: () => SVGGElement | null,
		getShapes?: () => RenderedShape[],
		opts?: { container?: HTMLElement; onPanelShow?: () => void; onPanelHide?: () => void },
	) {
		this._schemas = schemas;
		this._getDefinitions = getDefinitions;
		this._applyChange = applyChange;
		this._getSvgViewport = getSvgViewport ?? null;
		this._getShapes = getShapes ?? null;
		this._container = opts?.container ?? null;
		this._onPanelShow = opts?.onPanelShow ?? null;
		this._onPanelHide = opts?.onPanelHide ?? null;

		// Restore persisted panel width (only used in standalone mode)
		if (!this._container) {
			try {
				const saved = Number(localStorage.getItem(STORAGE_KEY_WIDTH));
				if (Number.isFinite(saved) && saved >= 240 && saved <= 600) {
					this._panelWidth = saved;
				}
			} catch {
				// localStorage unavailable (e.g. sandboxed iframe) — use default
			}
		}
	}

	onSelect(ids: string[], shapes: RenderedShape[], edges: RenderedEdge[] = []): void {
		if (ids.length !== 1) {
			this._close();
			return;
		}
		const id = ids[0];
		if (!id) {
			this._close();
			return;
		}
		const shape = shapes.find((s) => s.id === id);
		const elementType = shape?.flowElement?.type;

		if (elementType) {
			// Shape selection
			const reg = this._schemas.get(elementType);
			if (!reg) {
				this._close();
				return;
			}

			this._selectedId = id;
			this._selectedType = elementType;
			this._elementName = shape?.flowElement?.name ?? "";

			// Resolve optional template override
			const defs = this._getDefinitions();
			const resolved = defs ? (reg.adapter.resolve?.(defs, id) ?? null) : null;
			this._effectiveReg = resolved ?? reg;

			this._refreshValues(this._effectiveReg);
			this._showPanel(this._effectiveReg);
		} else {
			// Edge selection — check if it's a sequence flow
			const isEdge = edges.some((e) => e.id === id);
			if (!isEdge) {
				this._close();
				return;
			}
			const defs = this._getDefinitions();
			const isSequenceFlow = defs?.processes.some((p) => p.sequenceFlows.some((f) => f.id === id));
			if (!isSequenceFlow) {
				this._close();
				return;
			}
			const reg = this._schemas.get("sequenceFlow");
			if (!reg) {
				this._close();
				return;
			}

			this._selectedId = id;
			this._selectedType = "sequenceFlow";
			const sf = defs?.processes.flatMap((p) => p.sequenceFlows).find((f) => f.id === id);
			this._elementName = sf?.name ?? "";
			this._effectiveReg = reg;

			this._refreshValues(reg);
			this._showPanel(reg);
		}
	}

	onDiagramChange(defs: BpmnDefinitions): void {
		// Update validation badges for all canvas shapes regardless of selection
		this._updateBadges(defs);

		if (!this._selectedId || !this._selectedType) return;
		const reg = this._schemas.get(this._selectedType);
		if (!reg) return;

		// Re-resolve in case a template was applied or removed
		const resolved = reg.adapter.resolve?.(defs, this._selectedId) ?? null;
		const newEffective = resolved ?? reg;

		this._values = newEffective.adapter.read(defs, this._selectedId);

		// If the effective registration changed (e.g. template applied), re-render
		if (newEffective !== this._effectiveReg) {
			this._effectiveReg = newEffective;
			this._showPanel(newEffective);
			return;
		}

		this._refreshInputs();
		this._refreshConditionals(newEffective.schema);
		this._refreshValidation(newEffective.schema);
	}

	destroy(): void {
		this._badgeContainerEl?.remove();
		this._badgeContainerEl = null;
		this._close();
	}

	private _refreshValues(reg: Registration): void {
		const defs = this._getDefinitions();
		if (!defs || !this._selectedId) return;
		this._values = reg.adapter.read(defs, this._selectedId);
	}

	private _applyField(key: string, value: FieldValue): void {
		const id = this._selectedId;
		const type = this._selectedType;
		if (!id || !type) return;
		const reg = this._schemas.get(type);
		if (!reg) return;
		// Use the template-resolved adapter (if any) so template attributes are preserved on write
		const effective = this._effectiveReg ?? reg;
		this._values[key] = value;
		// Refresh visibility and validation immediately without waiting for diagram:change
		this._refreshConditionals(effective.schema);
		this._refreshValidation(effective.schema);
		const snapshot = { ...this._values };
		this._applyChange((defs) => effective.adapter.write(defs, id, snapshot));
	}

	private _close(): void {
		this._hidePanel();
		this._selectedId = null;
		this._selectedType = null;
		this._elementName = "";
		this._activeTabId = null;
		this._values = {};
		this._effectiveReg = null;
		this._searchQuery = "";
		this._guideCurrentKey = null;
		this._guideStarted = false;
	}

	private _hidePanel(): void {
		this._panelEl?.remove();
		this._panelEl = null;
		this._tabsAreaEl = null;
		this._tabsScrollEl = null;
		this._tabsPrevBtn = null;
		this._tabsNextBtn = null;
		this._bodyEl = null;
		this._searchResultsEl = null;
		this._searchClearBtn = null;
		this._guideBarEl = null;
		this._guideTextEl = null;
		this._guideBtnEl = null;
		this._onPanelHide?.();
	}

	/** Update all input values in-place without re-rendering (preserves focus). */
	private _refreshInputs(): void {
		const container = this._panelEl;
		if (!container) return;
		for (const [key, value] of Object.entries(this._values)) {
			const els = container.querySelectorAll<
				HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
			>(`[data-field-key="${key}"]`);
			for (const el of els) {
				if (document.activeElement === el) continue;
				if (el instanceof HTMLInputElement && el.type === "checkbox") {
					el.checked = value === true || value === "true";
				} else {
					el.value = typeof value === "string" ? value : "";
				}
			}
		}
	}

	/**
	 * Refresh both field-level and group-level conditional visibility.
	 * Called synchronously after any value change so the UI updates immediately.
	 */
	private _refreshConditionals(schema: PanelSchema): void {
		const container = this._panelEl;
		if (!container) return;

		// Field-level conditions
		const allFields = schema.groups.flatMap((g) => g.fields);
		for (const field of allFields) {
			if (!field.condition) continue;
			const wrapper = container.querySelector<HTMLElement>(
				`[${FIELD_WRAPPER_ATTR}="${field.key}"]`,
			);
			if (wrapper) wrapper.style.display = field.condition(this._values) ? "" : "none";
		}

		this._refreshGroupVisibility(schema.groups);
	}

	/**
	 * Returns true when a field value is considered empty for validation purposes.
	 * For `feel-expression` fields, a value of just "=" (no expression body) is
	 * treated the same as empty.
	 */
	private _isEffectivelyEmpty(field: FieldSchema, val: FieldValue): boolean {
		if (val === "" || val === undefined) return true;
		if (field.type === "feel-expression" && typeof val === "string") {
			return val.trim() === "=";
		}
		return false;
	}

	/**
	 * Returns true when a field value has any error:
	 * - required field with an effectively-empty value, OR
	 * - value is a FEEL expression (starts with "=") with structural syntax errors.
	 */
	private _fieldHasError(field: FieldSchema, val: FieldValue): boolean {
		if (field.required && this._isEffectivelyEmpty(field, val)) return true;
		if (typeof val === "string" && val.startsWith("=") && hasFEELSyntaxError(val)) return true;
		return false;
	}

	/**
	 * Returns true when a group has at least one required, currently-visible field
	 * that is effectively empty.
	 */
	private _groupHasErrors(group: GroupSchema): boolean {
		return group.fields.some(
			(f) =>
				f.type !== "action" &&
				(!f.condition || f.condition(this._values)) &&
				this._fieldHasError(f, this._values[f.key]),
		);
	}

	/** Update invalid state for all fields, tab error dots, and guide bar. */
	private _refreshValidation(schema: PanelSchema): void {
		const container = this._panelEl;
		if (!container) return;
		for (const group of schema.groups) {
			for (const field of group.fields) {
				if (field.type === "action") continue;
				const wrapper = container.querySelector<HTMLElement>(
					`[${FIELD_WRAPPER_ATTR}="${field.key}"]`,
				);
				if (!wrapper) continue;
				wrapper.classList.toggle(
					"bpmn-cfg-field--invalid",
					this._fieldHasError(field, this._values[field.key]),
				);
			}
			// Update tab error dot
			const tabBtn = container.querySelector<HTMLElement>(`[data-tab-id="${group.id}"]`);
			if (tabBtn) tabBtn.classList.toggle("has-error", this._groupHasErrors(group));
		}
		this._refreshGuide();
	}

	/** Show/hide tabs and groups based on their conditions. */
	private _refreshGroupVisibility(groups: GroupSchema[]): void {
		const panel = this._panelEl;
		if (!panel) return;

		let activeIsVisible = false;
		for (const group of groups) {
			const isVisible = !group.condition || group.condition(this._values);
			const tabBtn = panel.querySelector<HTMLElement>(`[data-tab-id="${group.id}"]`);
			if (tabBtn) tabBtn.style.display = isVisible ? "" : "none";
			if (group.id === this._activeTabId && isVisible) activeIsVisible = true;
		}

		// If the active tab just became hidden, switch to the first visible one
		if (!activeIsVisible) {
			for (const group of groups) {
				if (!group.condition || group.condition(this._values)) {
					this._activateTab(panel, group.id);
					break;
				}
			}
		}

		this._syncTabsAreaVisibility(groups);
		requestAnimationFrame(() => this._updateTabScrollBtns());
	}

	private _activateTab(panel: HTMLElement, groupId: string): void {
		this._activeTabId = groupId;
		for (const btn of panel.querySelectorAll<HTMLElement>(".bpmn-cfg-tab-btn")) {
			btn.classList.remove("active");
		}
		for (const grp of panel.querySelectorAll<HTMLElement>(".bpmn-cfg-group")) {
			grp.style.display = "none";
		}
		const tabBtn = panel.querySelector<HTMLElement>(`[data-tab-id="${groupId}"]`);
		const groupEl = panel.querySelector<HTMLElement>(`[data-group-id="${groupId}"]`);
		tabBtn?.classList.add("active");
		if (groupEl) groupEl.style.display = "";
		requestAnimationFrame(() => this._updateTabScrollBtns());
	}

	/** Show/hide tab scroll arrow buttons based on current scroll position and overflow. */
	private _updateTabScrollBtns(): void {
		const tabs = this._tabsScrollEl;
		const prev = this._tabsPrevBtn;
		const next = this._tabsNextBtn;
		if (!tabs || !prev || !next) return;

		const hasOverflow = tabs.scrollWidth > tabs.clientWidth + 1;
		const atStart = tabs.scrollLeft <= 0;
		const atEnd = tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 1;

		prev.style.display = hasOverflow && !atStart ? "flex" : "none";
		next.style.display = hasOverflow && !atEnd ? "flex" : "none";
	}

	/**
	 * Hide the tabs area when there are 0 or 1 visible groups — a single tab
	 * provides no navigation value and adds visual noise.
	 */
	private _syncTabsAreaVisibility(groups: GroupSchema[]): void {
		const tabsArea = this._tabsAreaEl;
		if (!tabsArea) return;
		const visibleCount = groups.filter(
			(g) => g.fields.length > 0 && (!g.condition || g.condition(this._values)),
		).length;
		tabsArea.style.display = visibleCount <= 1 ? "none" : "";
	}

	// ── Validation badges ─────────────────────────────────────────────────────

	/**
	 * Renders (or removes) a small red "!" badge on each canvas shape that has
	 * at least one required config field with a missing or empty value.
	 * Badges live in a `<g>` appended to the SVG viewport group so they
	 * automatically follow pan and zoom.
	 */
	private _updateBadges(defs: BpmnDefinitions): void {
		if (!this._getSvgViewport || !this._getShapes) return;

		const viewport = this._getSvgViewport();
		if (!viewport) return;

		// Create badge layer on first use
		if (!this._badgeContainerEl) {
			const g = document.createElementNS(SVG_NS, "g");
			g.setAttribute("class", "bpmn-cfg-badge-layer");
			viewport.appendChild(g);
			this._badgeContainerEl = g;
		}

		// Clear previous badges
		const container = this._badgeContainerEl;
		while (container.lastChild) {
			container.removeChild(container.lastChild);
		}

		for (const shape of this._getShapes()) {
			const type = shape.flowElement?.type;
			if (!type) continue;

			const baseReg = this._schemas.get(type);
			if (!baseReg) continue;

			// Resolve template if stamped on the element
			const reg = baseReg.adapter.resolve?.(defs, shape.id) ?? baseReg;

			// Collect labels for all visible fields with errors (missing or invalid FEEL)
			const values = reg.adapter.read(defs, shape.id);
			const missingLabels: string[] = [];
			for (const g of reg.schema.groups) {
				for (const f of g.fields) {
					if (f.type === "action") continue;
					if (f.condition && !f.condition(values)) continue;
					if (this._fieldHasError(f, values[f.key])) missingLabels.push(f.label);
				}
			}
			if (missingLabels.length === 0) continue;

			// Badge positioned at the top-right corner of the shape
			const { x, y, width } = shape.shape.bounds;

			const badge = document.createElementNS(SVG_NS, "g");
			badge.setAttribute("class", "bpmn-cfg-badge");
			badge.setAttribute("transform", `translate(${x + width}, ${y})`);

			// Tooltip: lists the specific missing fields on hover
			const title = document.createElementNS(SVG_NS, "title");
			title.textContent = `Required: ${missingLabels.join(", ")}`;
			badge.appendChild(title);

			const circle = document.createElementNS(SVG_NS, "circle");
			circle.setAttribute("r", "7");
			circle.setAttribute("fill", "#f87171");
			circle.setAttribute("stroke", "#fff");
			circle.setAttribute("stroke-width", "1.5");

			const text = document.createElementNS(SVG_NS, "text");
			text.setAttribute("text-anchor", "middle");
			text.setAttribute("dominant-baseline", "central");
			text.setAttribute("fill", "#fff");
			text.setAttribute("font-size", "9");
			text.setAttribute("font-weight", "bold");
			text.setAttribute("font-family", "system-ui, sans-serif");
			text.setAttribute("pointer-events", "none");
			text.textContent = "!";

			badge.appendChild(circle);
			badge.appendChild(text);
			container.appendChild(badge);
		}
	}

	// ── Setup assistant / field guide ───────────────────────────────────────

	/** Returns all visible fields that have any error (missing required or invalid FEEL). */
	private _getMissingFields(): Array<{ group: GroupSchema; field: FieldSchema }> {
		const result: Array<{ group: GroupSchema; field: FieldSchema }> = [];
		const schema = this._effectiveReg?.schema;
		if (!schema) return result;
		for (const group of schema.groups) {
			for (const field of group.fields) {
				if (field.type === "action") continue;
				if (field.condition && !field.condition(this._values)) continue;
				if (this._fieldHasError(field, this._values[field.key])) {
					result.push({ group, field });
				}
			}
		}
		return result;
	}

	/** Switches to the group's tab, scrolls the field into view, and focuses its input. */
	private _navigateToField(group: GroupSchema, field: FieldSchema): void {
		const panel = this._panelEl;
		if (!panel) return;
		// Exit search mode so the field is visible
		if (this._searchQuery.trim().length > 0) {
			const searchInput = panel.querySelector<HTMLInputElement>(".bpmn-cfg-search-input");
			if (searchInput) {
				searchInput.value = "";
				this._setSearch("");
			}
		}
		this._activateTab(panel, group.id);
		this._guideCurrentKey = field.key;
		requestAnimationFrame(() => {
			const wrapper = panel.querySelector<HTMLElement>(`[${FIELD_WRAPPER_ATTR}="${field.key}"]`);
			if (!wrapper) return;
			wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
			const input = wrapper.querySelector<HTMLElement>("input, select, textarea");
			input?.focus();
		});
	}

	/** Refreshes guide bar text and visibility; hides when no required fields are missing. */
	private _refreshGuide(): void {
		const bar = this._guideBarEl;
		const textEl = this._guideTextEl;
		const btn = this._guideBtnEl;
		if (!bar || !textEl || !btn) return;
		const missing = this._getMissingFields();
		if (missing.length === 0) {
			bar.style.display = "none";
			this._guideCurrentKey = null;
			this._guideStarted = false;
			return;
		}
		bar.style.display = "";
		textEl.textContent =
			missing.length === 1 ? "1 field to fix" : `${missing.length} fields to fix`;
		btn.textContent = this._guideStarted ? "Next \u203a" : "Start \u203a";
	}

	// ── Search ────────────────────────────────────────────────────────────────

	private _setSearch(query: string): void {
		this._searchQuery = query;
		const searchResults = this._searchResultsEl;
		const tabsArea = this._tabsAreaEl;
		const body = this._bodyEl;
		const clearBtn = this._searchClearBtn;
		if (!searchResults || !body) return;

		const isSearching = query.trim().length > 0;

		// Toggle clear button visibility
		if (clearBtn) clearBtn.style.display = isSearching ? "flex" : "none";

		if (!isSearching) {
			searchResults.style.display = "none";
			searchResults.innerHTML = "";
			if (tabsArea) {
				const schema = this._effectiveReg?.schema;
				if (schema) this._syncTabsAreaVisibility(schema.groups);
			}
			body.style.display = "";
			return;
		}

		body.style.display = "none";
		if (tabsArea) tabsArea.style.display = "none";
		searchResults.style.display = "";
		this._buildSearchResults(query);
	}

	private _buildSearchResults(query: string): void {
		const searchResults = this._searchResultsEl;
		const schema = this._effectiveReg?.schema;
		if (!searchResults || !schema) return;

		searchResults.innerHTML = "";
		const q = query.trim().toLowerCase();
		let totalMatches = 0;

		for (const group of schema.groups) {
			const matchingFields = group.fields.filter((f) => f.label.toLowerCase().includes(q));
			if (matchingFields.length === 0) continue;

			totalMatches += matchingFields.length;

			const groupHeader = document.createElement("div");
			groupHeader.className = "bpmn-cfg-search-group-label";
			groupHeader.textContent = group.label;
			searchResults.appendChild(groupHeader);

			for (const field of matchingFields) {
				searchResults.appendChild(this._renderField(field));
			}
		}

		if (totalMatches === 0) {
			const empty = document.createElement("div");
			empty.className = "bpmn-cfg-search-empty";
			empty.textContent = "No matching properties";
			searchResults.appendChild(empty);
		}
	}

	// ── Inspector panel ───────────────────────────────────────────────────────

	private _showPanel(reg: Registration): void {
		this._hidePanel();
		// Reset search when re-rendering (e.g., template changed)
		this._searchQuery = "";

		const panel = document.createElement("div");
		panel.className = "bpmn-cfg-full";
		if (this._container) {
			panel.classList.add("bpmn-cfg-full--hosted");
		} else if (this._collapsed) {
			panel.classList.add("bpmn-cfg-full--collapsed");
		} else {
			panel.style.width = `${this._panelWidth}px`;
		}

		// Resize handle — only in standalone mode; dock provides its own resize
		if (!this._container) {
			const resizeHandle = document.createElement("div");
			resizeHandle.className = "bpmn-cfg-resize-handle";
			resizeHandle.addEventListener("mousedown", (e) => {
				if (this._collapsed) return;
				e.preventDefault();
				const startX = e.clientX;
				const startWidth = this._panelWidth;
				const onMove = (ev: MouseEvent) => {
					const dx = startX - ev.clientX;
					this._panelWidth = Math.max(240, Math.min(600, startWidth + dx));
					panel.style.width = `${this._panelWidth}px`;
					try {
						localStorage.setItem(STORAGE_KEY_WIDTH, String(this._panelWidth));
					} catch {
						// ignore
					}
				};
				const onUp = () => {
					document.removeEventListener("mousemove", onMove);
					document.removeEventListener("mouseup", onUp);
				};
				document.addEventListener("mousemove", onMove);
				document.addEventListener("mouseup", onUp);
			});
			panel.appendChild(resizeHandle);
		}

		// Header
		const header = document.createElement("div");
		header.className = "bpmn-cfg-full-header";

		const info = document.createElement("div");
		info.className = "bpmn-cfg-full-info";

		const typeLabel = document.createElement("div");
		typeLabel.className = "bpmn-cfg-full-type";
		typeLabel.textContent = this._selectedType ?? "";

		info.appendChild(typeLabel);

		if (reg.schema.templateName) {
			const templateLabel = document.createElement("div");
			templateLabel.className = "bpmn-cfg-full-template";
			templateLabel.textContent = reg.schema.templateName;
			info.appendChild(templateLabel);
		}

		const nameLabel = document.createElement("div");
		nameLabel.className = "bpmn-cfg-full-name";
		nameLabel.textContent = this._elementName || "(unnamed)";

		info.appendChild(nameLabel);
		header.appendChild(info);

		// Docs link — shown when the schema provides a documentation URL
		if (reg.schema.docsUrl) {
			const docsLink = document.createElement("a");
			docsLink.className = "bpmn-cfg-docs-link";
			docsLink.href = reg.schema.docsUrl;
			docsLink.target = "_blank";
			docsLink.rel = "noopener noreferrer";
			docsLink.setAttribute("title", "Documentation");
			docsLink.textContent = "?";
			header.appendChild(docsLink);
		}

		// Collapse button — only in standalone mode; dock provides its own collapse
		if (!this._container) {
			const collapseBtn = document.createElement("button");
			collapseBtn.className = "bpmn-cfg-collapse-btn";
			collapseBtn.setAttribute("title", this._collapsed ? "Expand" : "Collapse");
			collapseBtn.textContent = this._collapsed ? "›" : "‹";
			collapseBtn.addEventListener("click", () => {
				this._collapsed = !this._collapsed;
				panel.classList.toggle("bpmn-cfg-full--collapsed", this._collapsed);
				if (this._collapsed) {
					panel.style.width = "";
				} else {
					panel.style.width = `${this._panelWidth}px`;
				}
				collapseBtn.textContent = this._collapsed ? "›" : "‹";
				collapseBtn.setAttribute("title", this._collapsed ? "Expand" : "Collapse");
			});
			header.appendChild(collapseBtn);
		}

		const closeBtn = document.createElement("button");
		closeBtn.className = "bpmn-cfg-full-close";
		closeBtn.setAttribute("title", "Close");
		closeBtn.textContent = "×";
		closeBtn.addEventListener("click", () => this._close());

		header.appendChild(closeBtn);

		// Search bar
		const searchBar = document.createElement("div");
		searchBar.className = "bpmn-cfg-search-bar";

		const searchInput = document.createElement("input");
		searchInput.type = "text";
		searchInput.className = "bpmn-cfg-search-input";
		searchInput.placeholder = "Search properties…";
		searchInput.value = this._searchQuery;
		searchInput.setAttribute("spellcheck", "false");
		searchInput.setAttribute("autocomplete", "off");

		const clearBtn = document.createElement("button");
		clearBtn.className = "bpmn-cfg-search-clear";
		clearBtn.setAttribute("title", "Clear search");
		clearBtn.textContent = "×";
		clearBtn.style.display = this._searchQuery.trim().length > 0 ? "flex" : "none";

		searchInput.addEventListener("input", () => this._setSearch(searchInput.value));
		searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				searchInput.value = "";
				this._setSearch("");
				searchInput.blur();
			}
		});
		clearBtn.addEventListener("click", () => {
			searchInput.value = "";
			this._setSearch("");
			searchInput.focus();
		});

		searchBar.appendChild(searchInput);
		searchBar.appendChild(clearBtn);

		this._searchClearBtn = clearBtn;

		// Guide bar — omnipresent (between search and tabs), hidden when no errors
		const guideBar = document.createElement("div");
		guideBar.className = "bpmn-cfg-guide-bar";

		const guideInfo = document.createElement("div");
		guideInfo.className = "bpmn-cfg-guide-info";

		const guideIcon = document.createElement("span");
		guideIcon.className = "bpmn-cfg-guide-icon";
		guideIcon.textContent = "!";
		guideIcon.setAttribute("aria-hidden", "true");

		const guideText = document.createElement("span");
		guideText.className = "bpmn-cfg-guide-text";

		guideInfo.appendChild(guideIcon);
		guideInfo.appendChild(guideText);

		const guideBtn = document.createElement("button");
		guideBtn.className = "bpmn-cfg-guide-btn";
		guideBtn.textContent = "Start ›";
		guideBtn.addEventListener("click", () => {
			const missing = this._getMissingFields();
			if (missing.length === 0) return;
			let nextIdx = 0;
			if (this._guideStarted && this._guideCurrentKey !== null) {
				const curIdx = missing.findIndex((m) => m.field.key === this._guideCurrentKey);
				nextIdx = curIdx === -1 ? 0 : (curIdx + 1) % missing.length;
			}
			this._guideStarted = true;
			const target = missing[nextIdx];
			if (target) this._navigateToField(target.group, target.field);
			this._refreshGuide();
		});

		guideBar.appendChild(guideInfo);
		guideBar.appendChild(guideBtn);

		this._guideBarEl = guideBar;
		this._guideTextEl = guideText;
		this._guideBtnEl = guideBtn;

		// Tabs area: [prev arrow] [scrollable tabs] [next arrow]
		const tabsArea = document.createElement("div");
		tabsArea.className = "bpmn-cfg-tabs-area";

		const prevBtn = document.createElement("button");
		prevBtn.className = "bpmn-cfg-tabs-scroll-btn bpmn-cfg-tabs-scroll-btn--prev";
		prevBtn.setAttribute("aria-label", "Scroll tabs left");
		prevBtn.textContent = "‹";
		prevBtn.style.display = "none";

		const tabs = document.createElement("div");
		tabs.className = "bpmn-cfg-tabs";

		const nextBtn = document.createElement("button");
		nextBtn.className = "bpmn-cfg-tabs-scroll-btn bpmn-cfg-tabs-scroll-btn--next";
		nextBtn.setAttribute("aria-label", "Scroll tabs right");
		nextBtn.textContent = "›";
		nextBtn.style.display = "none";

		prevBtn.addEventListener("click", () => {
			tabs.scrollBy({ left: -100, behavior: "smooth" });
		});
		nextBtn.addEventListener("click", () => {
			tabs.scrollBy({ left: 100, behavior: "smooth" });
		});
		tabs.addEventListener("scroll", () => this._updateTabScrollBtns());

		tabsArea.appendChild(prevBtn);
		tabsArea.appendChild(tabs);
		tabsArea.appendChild(nextBtn);

		this._tabsAreaEl = tabsArea;
		this._tabsScrollEl = tabs;
		this._tabsPrevBtn = prevBtn;
		this._tabsNextBtn = nextBtn;

		// Scrollable body
		const body = document.createElement("div");
		body.className = "bpmn-cfg-full-body";
		this._bodyEl = body;

		// Search results pane (initially hidden)
		const searchResults = document.createElement("div");
		searchResults.className = "bpmn-cfg-search-results";
		searchResults.style.display = "none";
		this._searchResultsEl = searchResults;

		// Ensure the active tab is valid for the current values
		const hasActive = reg.schema.groups.some(
			(g) =>
				g.id === this._activeTabId &&
				g.fields.length > 0 &&
				(!g.condition || g.condition(this._values)),
		);
		if (!hasActive) {
			this._activeTabId =
				reg.schema.groups.find(
					(g) => g.fields.length > 0 && (!g.condition || g.condition(this._values)),
				)?.id ?? null;
		}

		for (const group of reg.schema.groups) {
			if (group.fields.length === 0) continue;

			const isVisible = !group.condition || group.condition(this._values);
			const isActive = group.id === this._activeTabId;

			// Tab button
			const tabBtn = document.createElement("button");
			tabBtn.className = "bpmn-cfg-tab-btn";
			tabBtn.textContent = group.label;
			tabBtn.setAttribute("data-tab-id", group.id);
			if (!isVisible) tabBtn.style.display = "none";
			if (isActive) tabBtn.classList.add("active");
			if (this._groupHasErrors(group)) tabBtn.classList.add("has-error");
			tabs.appendChild(tabBtn);

			// Group content (visible only when this tab is active)
			const groupEl = document.createElement("div");
			groupEl.className = "bpmn-cfg-group";
			groupEl.setAttribute("data-group-id", group.id);
			if (!isActive) groupEl.style.display = "none";

			for (const field of group.fields) {
				groupEl.appendChild(this._renderField(field));
			}
			body.appendChild(groupEl);

			tabBtn.addEventListener("click", () => {
				this._activateTab(panel, group.id);
			});
		}

		panel.appendChild(header);
		panel.appendChild(searchBar);
		panel.appendChild(guideBar);
		panel.appendChild(tabsArea);
		panel.appendChild(body);
		panel.appendChild(searchResults);
		(this._container ?? document.body).appendChild(panel);
		this._panelEl = panel;
		this._onPanelShow?.();

		// Defer layout-dependent checks until the panel is in the DOM
		requestAnimationFrame(() => {
			this._syncTabsAreaVisibility(reg.schema.groups);
			this._updateTabScrollBtns();
			this._refreshGuide();
			// Restore active search if panel was re-rendered while search was active
			if (this._searchQuery.trim().length > 0) {
				this._setSearch(this._searchQuery);
			}
		});
	}

	// ── Field rendering ───────────────────────────────────────────────────────

	private _renderField(field: FieldSchema): HTMLElement {
		const wrapper = document.createElement("div");
		wrapper.className = "bpmn-cfg-field";

		// Always stamp the key so _refreshConditionals and _refreshValidation can find the wrapper
		wrapper.setAttribute(FIELD_WRAPPER_ATTR, field.key);
		if (field.condition && !field.condition(this._values)) wrapper.style.display = "none";

		const value = this._values[field.key];

		// Initial error state (required-empty OR invalid FEEL expression)
		if (this._fieldHasError(field, value)) {
			wrapper.classList.add("bpmn-cfg-field--invalid");
		}

		if (field.type === "action") {
			wrapper.appendChild(this._renderActionButton(field));
		} else if (field.type === "toggle") {
			wrapper.appendChild(this._renderToggle(field, value));
		} else {
			const labelRow = document.createElement("div");
			labelRow.className = "bpmn-cfg-field-label";
			labelRow.textContent = field.label;
			if (field.tooltip) labelRow.title = field.tooltip;

			if (field.required) {
				const star = document.createElement("span");
				star.className = "bpmn-cfg-required-star";
				star.textContent = "*";
				star.setAttribute("aria-hidden", "true");
				labelRow.appendChild(star);
			}

			if (field.docsUrl) {
				const link = document.createElement("a");
				link.className = "bpmn-cfg-field-docs";
				link.textContent = "docs";
				link.href = field.docsUrl;
				link.target = "_blank";
				link.rel = "noopener noreferrer";
				labelRow.appendChild(link);
			}
			wrapper.appendChild(labelRow);

			if (field.type === "select") {
				wrapper.appendChild(this._renderSelect(field, value));
			} else if (field.type === "textarea") {
				wrapper.appendChild(this._renderTextarea(field, value));
			} else if (field.type === "feel-expression") {
				wrapper.appendChild(this._renderFeelExpression(field, value));
			} else {
				wrapper.appendChild(this._renderTextInput(field, value));
			}
		}

		if (field.hint) {
			const hint = document.createElement("div");
			hint.className = "bpmn-cfg-field-hint";
			// hint may contain safe HTML from template descriptions (e.g. <a> links)
			hint.innerHTML = field.hint;
			wrapper.appendChild(hint);
		}

		return wrapper;
	}

	private _renderFeelExpression(field: FieldSchema, value: FieldValue): HTMLElement {
		const text = typeof value === "string" ? value : "";

		const wrap = document.createElement("div");
		wrap.className = "bpmn-cfg-feel-wrap";

		const ta = document.createElement("textarea");
		ta.className = "bpmn-cfg-feel-ta bpmn-cfg-textarea";
		ta.placeholder = field.placeholder ?? "";
		ta.value = text;
		ta.setAttribute("data-field-key", field.key);
		ta.setAttribute("spellcheck", "false");
		ta.addEventListener("change", () => this._applyField(field.key, ta.value));
		wrap.appendChild(ta);

		if (field.openInPlayground) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "bpmn-cfg-feel-playground-btn";
			btn.textContent = "Open in FEEL Playground ↗";
			btn.addEventListener("click", () => field.openInPlayground?.(this._values));
			wrap.appendChild(btn);
		}

		return wrap;
	}

	private _renderTextInput(field: FieldSchema, value: FieldValue): HTMLInputElement {
		const input = document.createElement("input");
		input.type = field.secret === true ? "password" : "text";
		input.className = "bpmn-cfg-input";
		input.placeholder = field.placeholder ?? "";
		input.value = typeof value === "string" ? value : "";
		input.setAttribute("data-field-key", field.key);
		input.addEventListener("change", () => this._applyField(field.key, input.value));
		return input;
	}

	private _renderTextarea(field: FieldSchema, value: FieldValue): HTMLTextAreaElement {
		const ta = document.createElement("textarea");
		ta.className = "bpmn-cfg-textarea";
		ta.placeholder = field.placeholder ?? "";
		ta.value = typeof value === "string" ? value : "";
		ta.setAttribute("data-field-key", field.key);
		ta.addEventListener("change", () => this._applyField(field.key, ta.value));
		return ta;
	}

	private _renderSelect(field: FieldSchema, value: FieldValue): HTMLSelectElement {
		const sel = document.createElement("select");
		sel.className = "bpmn-cfg-select";
		sel.setAttribute("data-field-key", field.key);
		for (const opt of field.options ?? []) {
			const option = document.createElement("option");
			option.value = opt.value;
			option.textContent = opt.label;
			sel.appendChild(option);
		}
		sel.value = typeof value === "string" ? value : (field.options?.[0]?.value ?? "");
		sel.addEventListener("change", () => this._applyField(field.key, sel.value));
		return sel;
	}

	private _renderToggle(field: FieldSchema, value: FieldValue): HTMLElement {
		const row = document.createElement("div");
		row.className = "bpmn-cfg-toggle-row";

		const lbl = document.createElement("label");
		lbl.className = "bpmn-cfg-toggle";

		const input = document.createElement("input");
		input.type = "checkbox";
		input.checked = value === true || value === "true";
		input.setAttribute("data-field-key", field.key);

		const track = document.createElement("span");
		track.className = "bpmn-cfg-toggle-track";

		const thumb = document.createElement("span");
		thumb.className = "bpmn-cfg-toggle-thumb";

		lbl.appendChild(input);
		lbl.appendChild(track);
		lbl.appendChild(thumb);

		const labelText = document.createElement("span");
		labelText.className = "bpmn-cfg-toggle-label";
		labelText.textContent = field.label;
		if (field.tooltip) labelText.title = field.tooltip;

		input.addEventListener("change", () => this._applyField(field.key, input.checked));

		row.appendChild(lbl);
		row.appendChild(labelText);
		return row;
	}

	private _renderActionButton(field: FieldSchema): HTMLElement {
		const btn = document.createElement("button");
		btn.type = "button";
		btn.className = "bpmn-cfg-action-btn";
		btn.textContent = field.label;
		if (field.tooltip) btn.title = field.tooltip;
		btn.addEventListener("click", () =>
			field.onClick?.(this._values, (k, v) => this._applyField(k, v)),
		);
		return btn;
	}
}
