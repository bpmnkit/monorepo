import { badge } from "../components/badge.js"
import { createFilterTable } from "../components/filter-table.js"
import { MOCK_VARIABLES } from "../mock-data.js"
import { InstancesStore } from "../stores/instances.js"
import type { ProcessInstanceResult, VariableResult } from "../types.js"

// ── Shared template helpers ──────────────────────────────────────────────────

const INST_TEMPLATE_KEY = "bpmnkit-operate:search-templates"
const VAR_TEMPLATE_KEY = "bpmnkit-operate:var-search-templates"

interface Condition {
	id: string
	field: string
	value: string
}

interface SearchTemplate {
	id: string
	name: string
	conditions: Condition[]
}

let condIdCounter = 0
function newCondId(): string {
	return `c${++condIdCounter}`
}

function loadTemplates(key: string): SearchTemplate[] {
	try {
		const raw = localStorage.getItem(key)
		if (!raw) return []
		return JSON.parse(raw) as SearchTemplate[]
	} catch {
		return []
	}
}

function saveTemplates(key: string, templates: SearchTemplate[]): void {
	localStorage.setItem(key, JSON.stringify(templates))
}

function relTime(iso: string | null | undefined): string {
	if (!iso) return "—"
	const d = new Date(iso)
	const diff = Date.now() - d.getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ${m % 60}m ago`
	return d.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	})
}

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
}

// ── Instance search ──────────────────────────────────────────────────────────

type InstFieldId =
	| "state"
	| "processDefinitionKey"
	| "processDefinitionId"
	| "processDefinitionName"
	| "processInstanceKey"
	| "businessId"
	| "hasIncident"
	| "startDateFrom"
	| "startDateTo"
	| "endDateFrom"
	| "endDateTo"
	| "parentProcessInstanceKey"

interface InstFieldDef {
	id: InstFieldId
	label: string
	type: "text" | "state-select" | "bool-select" | "date"
	serverSide?: boolean
}

const INST_FIELDS: InstFieldDef[] = [
	{ id: "state", label: "State", type: "state-select", serverSide: true },
	{ id: "processDefinitionKey", label: "Process Definition Key", type: "text", serverSide: true },
	{ id: "processDefinitionId", label: "Process Definition ID", type: "text" },
	{ id: "processDefinitionName", label: "Process Definition Name", type: "text" },
	{ id: "processInstanceKey", label: "Instance Key", type: "text" },
	{ id: "businessId", label: "Business ID", type: "text" },
	{ id: "hasIncident", label: "Has Incident", type: "bool-select" },
	{ id: "startDateFrom", label: "Started After", type: "date" },
	{ id: "startDateTo", label: "Started Before", type: "date" },
	{ id: "endDateFrom", label: "Ended After", type: "date" },
	{ id: "endDateTo", label: "Ended Before", type: "date" },
	{ id: "parentProcessInstanceKey", label: "Parent Instance Key", type: "text" },
]

// ── Variable search ──────────────────────────────────────────────────────────

type VarFieldId =
	| "name"
	| "value"
	| "processInstanceKey"
	| "scopeKey"
	| "variableKey"
	| "tenantId"
	| "isTruncated"

interface VarFieldDef {
	id: VarFieldId
	label: string
	type: "text" | "bool-select"
	hint?: string
}

const VAR_FIELDS: VarFieldDef[] = [
	{ id: "name", label: "Name", type: "text" },
	{
		id: "value",
		label: "Value",
		type: "text",
		hint: 'JSON format: "hello", 42, true',
	},
	{ id: "processInstanceKey", label: "Process Instance Key", type: "text" },
	{ id: "scopeKey", label: "Scope Key", type: "text" },
	{ id: "variableKey", label: "Variable Key", type: "text" },
	{ id: "tenantId", label: "Tenant ID", type: "text" },
	{ id: "isTruncated", label: "Is Truncated", type: "bool-select" },
]

// Variable search result type (extends VariableResult with search-specific fields)
type VarSearchResult = VariableResult & {
	value: string
	isTruncated: boolean
	/** Injected by AI search enrichment from the owning process instance. */
	instanceStartDate?: string | null
	instanceProcessName?: string | null
	instanceProcessId?: string | null
	instanceState?: string | null
	instanceIsSubprocess?: boolean
}

// ── Generic builder helpers ──────────────────────────────────────────────────

interface FieldDef {
	id: string
	label: string
	type: "text" | "state-select" | "bool-select" | "date"
	hint?: string
}

function createValueInput(fieldDef: FieldDef, value: string): HTMLElement {
	if (fieldDef.type === "state-select") {
		const sel = document.createElement("select")
		sel.className = "op-search-value-select"
		for (const opt of ["ACTIVE", "COMPLETED", "TERMINATED"]) {
			const o = document.createElement("option")
			o.value = opt
			o.textContent = opt
			if (value === opt) o.selected = true
			sel.appendChild(o)
		}
		if (!value) sel.value = "ACTIVE"
		return sel
	}
	if (fieldDef.type === "bool-select") {
		const sel = document.createElement("select")
		sel.className = "op-search-value-select"
		for (const [v, l] of [
			["true", "Yes"],
			["false", "No"],
		] as [string, string][]) {
			const o = document.createElement("option")
			o.value = v
			o.textContent = l
			if (value === v) o.selected = true
			sel.appendChild(o)
		}
		if (!value) sel.value = "true"
		return sel
	}
	const inp = document.createElement("input")
	inp.type = fieldDef.type === "date" ? "date" : "text"
	inp.className = "op-search-value-input"
	if (fieldDef.hint) inp.placeholder = fieldDef.hint
	else if (fieldDef.type !== "date") inp.placeholder = "value…"
	inp.value = value
	return inp
}

function attachValueListener(input: HTMLElement, cond: Condition): void {
	const update = (): void => {
		cond.value = (input as HTMLInputElement | HTMLSelectElement).value
	}
	input.addEventListener("input", update)
	input.addEventListener("change", update)
}

function buildConditionsEl(
	conditionsEl: HTMLElement,
	conditions: Condition[],
	fields: FieldDef[],
	onChange: () => void,
): void {
	conditionsEl.innerHTML = ""
	if (conditions.length === 0) {
		const hint = document.createElement("div")
		hint.className = "op-search-empty-hint"
		hint.textContent = "No conditions — will return all results (up to limit)."
		conditionsEl.appendChild(hint)
		return
	}
	for (const cond of conditions) {
		const row = document.createElement("div")
		row.className = "op-search-cond-row"

		const fieldSel = document.createElement("select")
		fieldSel.className = "op-search-field-select"
		for (const f of fields) {
			const o = document.createElement("option")
			o.value = f.id
			o.textContent = f.label
			if (cond.field === f.id) o.selected = true
			fieldSel.appendChild(o)
		}

		const fieldDef = fields.find((f) => f.id === cond.field)
		if (!fieldDef) continue
		let valueEl = createValueInput(fieldDef, cond.value)
		attachValueListener(valueEl, cond)

		fieldSel.addEventListener("change", () => {
			const newDef = fields.find((f) => f.id === fieldSel.value)
			if (!newDef) return
			cond.field = newDef.id
			cond.value = ""
			const newInput = createValueInput(newDef, "")
			attachValueListener(newInput, cond)
			row.replaceChild(newInput, valueEl)
			valueEl = newInput
		})

		const removeBtn = document.createElement("button")
		removeBtn.className = "op-search-cond-remove"
		removeBtn.textContent = "✕"
		removeBtn.title = "Remove condition"
		removeBtn.addEventListener("click", () => {
			const idx = conditions.indexOf(cond)
			if (idx !== -1) conditions.splice(idx, 1)
			onChange()
		})

		row.appendChild(fieldSel)
		row.appendChild(valueEl)
		row.appendChild(removeBtn)
		conditionsEl.appendChild(row)
	}
}

// ── Template section builder ─────────────────────────────────────────────────

function buildTemplateRow(
	storageKey: string,
	templates: SearchTemplate[],
	onLoad: (conditions: Condition[]) => void,
	onUpdate: (updated: SearchTemplate[]) => void,
	getConditions: () => Condition[],
	mountEl: HTMLElement,
): {
	el: HTMLElement
	refresh(): void
} {
	const row = document.createElement("div")
	row.className = "op-search-template-row"

	const label = document.createElement("span")
	label.className = "op-search-template-label"
	label.textContent = "Template:"
	row.appendChild(label)

	const select = document.createElement("select")
	select.className = "op-search-template-select"
	row.appendChild(select)

	const deleteBtn = document.createElement("button")
	deleteBtn.className = "op-action-btn op-action-btn--danger"
	deleteBtn.textContent = "Delete"
	row.appendChild(deleteBtn)

	const saveBtn = document.createElement("button")
	saveBtn.className = "op-action-btn"
	saveBtn.textContent = "Save as Template…"
	row.appendChild(saveBtn)

	function refresh(): void {
		select.innerHTML = ""
		const none = document.createElement("option")
		none.value = ""
		none.textContent = templates.length === 0 ? "No saved templates" : "Select template…"
		select.appendChild(none)
		for (const t of templates) {
			const o = document.createElement("option")
			o.value = t.id
			o.textContent = t.name
			select.appendChild(o)
		}
		deleteBtn.disabled = templates.length === 0
	}

	select.addEventListener("change", () => {
		const tmpl = templates.find((t) => t.id === select.value)
		if (!tmpl) return
		onLoad(tmpl.conditions.map((c) => ({ ...c, id: newCondId() })))
	})

	deleteBtn.addEventListener("click", () => {
		const id = select.value
		if (!id) return
		const updated = templates.filter((t) => t.id !== id)
		saveTemplates(storageKey, updated)
		onUpdate(updated)
		refresh()
	})

	saveBtn.addEventListener("click", () => {
		showSaveDialog(storageKey, templates, getConditions, mountEl, (updated, newId) => {
			onUpdate(updated)
			refresh()
			select.value = newId
		})
	})

	refresh()
	return { el: row, refresh }
}

function showSaveDialog(
	storageKey: string,
	templates: SearchTemplate[],
	getConditions: () => Condition[],
	mountEl: HTMLElement,
	onSaved: (updated: SearchTemplate[], newId: string) => void,
): void {
	const overlay = document.createElement("div")
	overlay.className = "op-modal-overlay"

	const dialog = document.createElement("div")
	dialog.className = "op-modal op-modal--form"

	const header = document.createElement("div")
	header.className = "op-modal-header"
	const titleSpan = document.createElement("span")
	titleSpan.className = "op-modal-title"
	titleSpan.textContent = "Save Search Template"
	header.appendChild(titleSpan)
	const closeBtn = document.createElement("button")
	closeBtn.className = "op-modal-close"
	closeBtn.textContent = "✕"
	closeBtn.addEventListener("click", () => overlay.remove())
	header.appendChild(closeBtn)

	const body = document.createElement("div")
	body.className = "op-modal-form-body"

	const group = document.createElement("div")
	group.className = "op-form-group"
	const lbl = document.createElement("label")
	lbl.className = "op-form-label"
	lbl.textContent = "Template Name"
	const nameInput = document.createElement("input")
	nameInput.type = "text"
	nameInput.className = "op-form-input"
	nameInput.placeholder = "e.g. Active instances with incidents"
	group.appendChild(lbl)
	group.appendChild(nameInput)
	body.appendChild(group)

	const footer = document.createElement("div")
	footer.className = "op-modal-form-footer"

	const errorEl = document.createElement("div")
	errorEl.className = "op-form-error"
	errorEl.style.display = "none"
	footer.appendChild(errorEl)

	const cancelBtn = document.createElement("button")
	cancelBtn.className = "op-action-btn"
	cancelBtn.textContent = "Cancel"
	cancelBtn.style.marginLeft = "auto"
	cancelBtn.addEventListener("click", () => overlay.remove())
	footer.appendChild(cancelBtn)

	const saveBtn = document.createElement("button")
	saveBtn.className = "op-action-btn op-action-btn--primary"
	saveBtn.textContent = "Save"
	footer.appendChild(saveBtn)

	saveBtn.addEventListener("click", () => {
		const name = nameInput.value.trim()
		if (!name) {
			errorEl.textContent = "Please enter a template name."
			errorEl.style.display = ""
			return
		}
		const newTmpl: SearchTemplate = {
			id: `tmpl-${Date.now()}`,
			name,
			conditions: getConditions().map((c) => ({ ...c })),
		}
		const updated = [...templates, newTmpl]
		saveTemplates(storageKey, updated)
		onSaved(updated, newTmpl.id)
		overlay.remove()
	})

	dialog.appendChild(header)
	dialog.appendChild(body)
	dialog.appendChild(footer)
	overlay.appendChild(dialog)
	overlay.addEventListener("click", (e) => {
		if (e.target === overlay) overlay.remove()
	})
	mountEl.appendChild(overlay)
	setTimeout(() => nameInput.focus(), 0)
}

// ── Main export ──────────────────────────────────────────────────────────────

export function createSearchView(
	cfg: Config,
	onNavigate: (path: string) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-search-view"

	// ── Tab bar ──────────────────────────────────────────────────────────────
	const tabBar = document.createElement("div")
	tabBar.className = "op-search-tab-bar"

	const instTabBtn = document.createElement("button")
	instTabBtn.className = "op-search-tab op-search-tab--active"
	instTabBtn.textContent = "Instances"
	tabBar.appendChild(instTabBtn)

	const varTabBtn = document.createElement("button")
	varTabBtn.className = "op-search-tab"
	varTabBtn.textContent = "Variables"
	tabBar.appendChild(varTabBtn)

	const aiTabBtn = document.createElement("button")
	aiTabBtn.className = "op-search-tab op-search-tab--ai"
	aiTabBtn.textContent = "AI Search"
	aiTabBtn.style.display = "none" // revealed after proxy status check
	tabBar.appendChild(aiTabBtn)

	el.appendChild(tabBar)

	// ── Panes ─────────────────────────────────────────────────────────────────
	const instPane = document.createElement("div")
	instPane.className = "op-search-pane"
	el.appendChild(instPane)

	const varPane = document.createElement("div")
	varPane.className = "op-search-pane"
	varPane.style.display = "none"
	el.appendChild(varPane)

	const aiPane = document.createElement("div")
	aiPane.className = "op-search-pane"
	aiPane.style.display = "none"
	el.appendChild(aiPane)

	// ── Tab switching ─────────────────────────────────────────────────────────
	const allTabBtns = [instTabBtn, varTabBtn, aiTabBtn]
	const allPanes = [instPane, varPane, aiPane]

	function switchToTab(activeBtn: HTMLButtonElement): void {
		allTabBtns.forEach((btn, i) => {
			btn.classList.toggle("op-search-tab--active", btn === activeBtn)
			const pane = allPanes[i]
			if (pane) pane.style.display = btn === activeBtn ? "" : "none"
		})
	}

	instTabBtn.addEventListener("click", () => switchToTab(instTabBtn))
	varTabBtn.addEventListener("click", () => switchToTab(varTabBtn))
	aiTabBtn.addEventListener("click", () => switchToTab(aiTabBtn))

	// ════════════════════════════════════════════════════════════════════════
	// INSTANCE SEARCH
	// ════════════════════════════════════════════════════════════════════════

	let instConditions: Condition[] = []
	let instTemplates: SearchTemplate[] = loadTemplates(INST_TEMPLATE_KEY)
	let instStore: InstancesStore | null = null

	const instTemplateHeader = document.createElement("div")
	instTemplateHeader.className = "op-search-header"
	instPane.appendChild(instTemplateHeader)

	const instBuilderSection = document.createElement("div")
	instBuilderSection.className = "op-search-builder"
	instPane.appendChild(instBuilderSection)

	const instConditionsEl = document.createElement("div")
	instConditionsEl.className = "op-search-conditions"
	instBuilderSection.appendChild(instConditionsEl)

	const instAddBtn = document.createElement("button")
	instAddBtn.className = "op-search-add-btn"
	instAddBtn.textContent = "+ Add Condition"
	instBuilderSection.appendChild(instAddBtn)

	const instActionRow = document.createElement("div")
	instActionRow.className = "op-search-actions"

	const instRunBtn = document.createElement("button")
	instRunBtn.className = "op-action-btn op-action-btn--primary"
	instRunBtn.textContent = "▶ Run Search"
	instActionRow.appendChild(instRunBtn)

	const instClearBtn = document.createElement("button")
	instClearBtn.className = "op-action-btn"
	instClearBtn.textContent = "Clear"
	instActionRow.appendChild(instClearBtn)

	const instStatusEl = document.createElement("span")
	instStatusEl.className = "op-search-status"
	instActionRow.appendChild(instStatusEl)

	instBuilderSection.appendChild(instActionRow)

	const instResultsSection = document.createElement("div")
	instResultsSection.className = "op-search-results"
	instResultsSection.style.display = "none"
	instPane.appendChild(instResultsSection)

	const instResultsHeading = document.createElement("div")
	instResultsHeading.className = "op-search-results-heading"
	instResultsSection.appendChild(instResultsHeading)

	const { el: instTableEl, setRows: setInstRows } = createFilterTable<ProcessInstanceResult>({
		columns: [
			{
				label: "Key",
				width: "140px",
				render: (row) => row.processInstanceKey,
				sortValue: (row) => row.processInstanceKey,
			},
			{
				label: "Process",
				render: (row) => row.processDefinitionName ?? row.processDefinitionId ?? "—",
				sortValue: (row) => row.processDefinitionName ?? row.processDefinitionId ?? "",
			},
			{
				label: "Business ID",
				width: "130px",
				render: (row) => row.businessId || "—",
				sortValue: (row) => row.businessId ?? "",
			},
			{
				label: "State",
				width: "110px",
				render: (row) => {
					const wrap = document.createElement("div")
					wrap.className = "bpmnkit-badge-wrap"
					wrap.appendChild(badge(row.state))
					if (row.hasIncident) {
						const inc = document.createElement("span")
						inc.className = "bpmnkit-badge bpmnkit-badge--incident-dot"
						inc.title = "Has incident"
						inc.textContent = "⚠"
						wrap.appendChild(inc)
					}
					return wrap
				},
				sortValue: (row) => row.state,
			},
			{
				label: "Started",
				width: "120px",
				render: (row) => relTime(row.startDate),
				sortValue: (row) => row.startDate ?? "",
			},
			{
				label: "Ended",
				width: "120px",
				render: (row) => relTime(row.endDate),
				sortValue: (row) => row.endDate ?? "",
			},
		],
		searchFn: (row) =>
			[
				row.processInstanceKey,
				row.processDefinitionId,
				row.processDefinitionName,
				row.businessId,
				row.state,
			]
				.filter(Boolean)
				.join(" "),
		onRowClick: (row) => onNavigate(`/instances/${row.processInstanceKey}`),
		emptyText: "No instances found matching your query",
	})
	instResultsSection.appendChild(instTableEl)

	function renderInstConditions(): void {
		buildConditionsEl(instConditionsEl, instConditions, INST_FIELDS, renderInstConditions)
	}

	const { el: instTmplRowEl } = buildTemplateRow(
		INST_TEMPLATE_KEY,
		instTemplates,
		(conds) => {
			instConditions = conds
			renderInstConditions()
		},
		(updated) => {
			instTemplates = updated
		},
		() => instConditions,
		el,
	)
	instTemplateHeader.appendChild(instTmplRowEl)

	instAddBtn.addEventListener("click", () => {
		instConditions.push({ id: newCondId(), field: "state", value: "ACTIVE" })
		renderInstConditions()
	})

	instClearBtn.addEventListener("click", () => {
		instConditions = []
		renderInstConditions()
		instResultsSection.style.display = "none"
		instStatusEl.textContent = ""
	})

	function applyInstClientFilters(items: ProcessInstanceResult[]): ProcessInstanceResult[] {
		let result = items
		for (const cond of instConditions) {
			const v = cond.value.trim()
			if (!v) continue
			const vl = v.toLowerCase()
			switch (cond.field as InstFieldId) {
				case "state":
					result = result.filter((i) => i.state === v.toUpperCase())
					break
				case "processDefinitionKey":
					result = result.filter((i) => i.processDefinitionKey === v)
					break
				case "processDefinitionId":
					result = result.filter((i) => i.processDefinitionId?.toLowerCase().includes(vl))
					break
				case "processDefinitionName":
					result = result.filter((i) => i.processDefinitionName?.toLowerCase().includes(vl))
					break
				case "processInstanceKey":
					result = result.filter((i) => i.processInstanceKey === v)
					break
				case "businessId":
					result = result.filter((i) => i.businessId?.toLowerCase().includes(vl))
					break
				case "hasIncident":
					result = result.filter((i) => String(i.hasIncident) === v)
					break
				case "startDateFrom":
					result = result.filter((i) => !!i.startDate && i.startDate >= v)
					break
				case "startDateTo":
					result = result.filter((i) => !!i.startDate && i.startDate <= `${v}T23:59:59`)
					break
				case "endDateFrom":
					result = result.filter((i) => !!i.endDate && i.endDate >= v)
					break
				case "endDateTo":
					result = result.filter((i) => !!i.endDate && i.endDate <= `${v}T23:59:59`)
					break
				case "parentProcessInstanceKey":
					result = result.filter((i) => i.parentProcessInstanceKey === v)
					break
				default:
					break
			}
		}
		return result
	}

	instRunBtn.addEventListener("click", () => {
		instRunBtn.disabled = true
		instRunBtn.textContent = "Searching…"
		instStatusEl.textContent = ""
		instResultsSection.style.display = "none"

		instStore?.destroy()
		instStore = new InstancesStore()

		const stateCond = instConditions.find((c) => c.field === "state" && c.value.trim())
		const defKeyCond = instConditions.find(
			(c) => c.field === "processDefinitionKey" && c.value.trim(),
		)

		const unsub = instStore.subscribe(() => {
			if (instStore?.state.loading) return
			instStore?.disconnect()
			unsub()

			instRunBtn.disabled = false
			instRunBtn.textContent = "▶ Run Search"

			if (instStore?.state.error) {
				instStatusEl.textContent = `Error: ${instStore.state.error}`
				return
			}

			const rawItems = instStore?.state.data?.items ?? []
			const filtered = applyInstClientFilters(rawItems)
			const suffix =
				rawItems.length !== filtered.length
					? ` (from ${rawItems.length} server results, filtered client-side)`
					: ""
			instResultsHeading.textContent = `${filtered.length} result${filtered.length !== 1 ? "s" : ""}${suffix}`
			setInstRows(filtered)
			instResultsSection.style.display = ""
		})

		instStore.connect(cfg.proxyUrl, cfg.profile, 0, cfg.mock, {
			state: stateCond?.value.trim() || undefined,
			processDefinitionKey: defKeyCond?.value.trim() || undefined,
		})
	})

	renderInstConditions()

	// ════════════════════════════════════════════════════════════════════════
	// VARIABLE SEARCH
	// ════════════════════════════════════════════════════════════════════════

	let varConditions: Condition[] = []
	let varTemplates: SearchTemplate[] = loadTemplates(VAR_TEMPLATE_KEY)
	let varSearchAbort: (() => void) | null = null

	const varTemplateHeader = document.createElement("div")
	varTemplateHeader.className = "op-search-header"
	varPane.appendChild(varTemplateHeader)

	const varBuilderSection = document.createElement("div")
	varBuilderSection.className = "op-search-builder"
	varPane.appendChild(varBuilderSection)

	const varConditionsEl = document.createElement("div")
	varConditionsEl.className = "op-search-conditions"
	varBuilderSection.appendChild(varConditionsEl)

	const varAddBtn = document.createElement("button")
	varAddBtn.className = "op-search-add-btn"
	varAddBtn.textContent = "+ Add Condition"
	varBuilderSection.appendChild(varAddBtn)

	const varActionRow = document.createElement("div")
	varActionRow.className = "op-search-actions"

	const varRunBtn = document.createElement("button")
	varRunBtn.className = "op-action-btn op-action-btn--primary"
	varRunBtn.textContent = "▶ Run Search"
	varActionRow.appendChild(varRunBtn)

	const varClearBtn = document.createElement("button")
	varClearBtn.className = "op-action-btn"
	varClearBtn.textContent = "Clear"
	varActionRow.appendChild(varClearBtn)

	const varStatusEl = document.createElement("span")
	varStatusEl.className = "op-search-status"
	varActionRow.appendChild(varStatusEl)

	varBuilderSection.appendChild(varActionRow)

	const varResultsSection = document.createElement("div")
	varResultsSection.className = "op-search-results"
	varResultsSection.style.display = "none"
	varPane.appendChild(varResultsSection)

	const varResultsHeading = document.createElement("div")
	varResultsHeading.className = "op-search-results-heading"
	varResultsSection.appendChild(varResultsHeading)

	const { el: varTableEl, setRows: setVarRows } = createFilterTable<VarSearchResult>({
		columns: [
			{
				label: "Name",
				width: "160px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-mono-cell"
					span.style.color = "var(--bpmnkit-fg)"
					span.textContent = row.name
					return span
				},
				sortValue: (row) => row.name,
			},
			{
				label: "Value",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-search-var-value"
					span.textContent = row.value
					if (row.isTruncated) span.title = "Value is truncated"
					return span
				},
				sortValue: (row) => row.value,
			},
			{
				label: "Truncated",
				width: "80px",
				render: (row) => (row.isTruncated ? "yes" : "no"),
				sortValue: (row) => (row.isTruncated ? "1" : "0"),
			},
			{
				label: "Instance Key",
				width: "140px",
				render: (row) => {
					const btn = document.createElement("button")
					btn.className = "op-back-btn"
					btn.textContent = row.processInstanceKey
					btn.addEventListener("click", (e) => {
						e.stopPropagation()
						onNavigate(`/instances/${row.processInstanceKey}`)
					})
					return btn
				},
				sortValue: (row) => row.processInstanceKey,
			},
			{
				label: "Scope Key",
				width: "130px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-mono-cell"
					span.textContent = row.scopeKey
					return span
				},
				sortValue: (row) => row.scopeKey,
			},
		],
		searchFn: (row) => [row.name, row.value, row.processInstanceKey, row.scopeKey].join(" "),
		emptyText: "No variables found matching your query",
	})
	varResultsSection.appendChild(varTableEl)

	function renderVarConditions(): void {
		buildConditionsEl(varConditionsEl, varConditions, VAR_FIELDS, renderVarConditions)
	}

	const { el: varTmplRowEl } = buildTemplateRow(
		VAR_TEMPLATE_KEY,
		varTemplates,
		(conds) => {
			varConditions = conds
			renderVarConditions()
		},
		(updated) => {
			varTemplates = updated
		},
		() => varConditions,
		el,
	)
	varTemplateHeader.appendChild(varTmplRowEl)

	varAddBtn.addEventListener("click", () => {
		varConditions.push({ id: newCondId(), field: "name", value: "" })
		renderVarConditions()
	})

	varClearBtn.addEventListener("click", () => {
		varConditions = []
		renderVarConditions()
		varResultsSection.style.display = "none"
		varStatusEl.textContent = ""
	})

	function runVarSearch(): void {
		varRunBtn.disabled = true
		varRunBtn.textContent = "Searching…"
		varStatusEl.textContent = ""
		varResultsSection.style.display = "none"

		varSearchAbort?.()
		varSearchAbort = null

		if (cfg.mock) {
			const items = applyVarMockFilters(MOCK_VARIABLES as VarSearchResult[])
			varResultsHeading.textContent = `${items.length} result${items.length !== 1 ? "s" : ""}`
			setVarRows(items)
			varResultsSection.style.display = ""
			varRunBtn.disabled = false
			varRunBtn.textContent = "▶ Run Search"
			return
		}

		const filter: Record<string, unknown> = {}
		for (const cond of varConditions) {
			const v = cond.value.trim()
			if (!v) continue
			switch (cond.field as VarFieldId) {
				case "name":
					filter.name = v
					break
				case "value":
					filter.value = coerceVarValue(v)
					break
				case "processInstanceKey":
					filter.processInstanceKey = v
					break
				case "scopeKey":
					filter.scopeKey = v
					break
				case "variableKey":
					filter.variableKey = v
					break
				case "tenantId":
					filter.tenantId = v
					break
				case "isTruncated":
					filter.isTruncated = v === "true"
					break
				default:
					break
			}
		}

		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile

		let aborted = false
		varSearchAbort = () => {
			aborted = true
		}

		fetch(`${cfg.proxyUrl}/api/variables/search`, {
			method: "POST",
			headers,
			body: JSON.stringify({ filter, page: { limit: 100 } }),
		})
			.then((r) =>
				r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(`${r.status}: ${t}`))),
			)
			.then((result: { items?: VarSearchResult[] }) => {
				if (aborted) return
				const items = result.items ?? []
				varResultsHeading.textContent = `${items.length} result${items.length !== 1 ? "s" : ""}`
				setVarRows(items)
				varResultsSection.style.display = ""
			})
			.catch((err: unknown) => {
				if (aborted) return
				varStatusEl.textContent = `Error: ${String(err)}`
			})
			.finally(() => {
				if (aborted) return
				varRunBtn.disabled = false
				varRunBtn.textContent = "▶ Run Search"
			})
	}

	function applyVarMockFilters(items: VarSearchResult[]): VarSearchResult[] {
		let result = items
		for (const cond of varConditions) {
			const v = cond.value.trim()
			if (!v) continue
			const vl = v.toLowerCase()
			switch (cond.field as VarFieldId) {
				case "name":
					result = result.filter((i) => i.name.toLowerCase().includes(vl))
					break
				case "value":
					result = result.filter((i) => i.value.toLowerCase().includes(vl))
					break
				case "processInstanceKey":
					result = result.filter((i) => i.processInstanceKey === v)
					break
				case "scopeKey":
					result = result.filter((i) => i.scopeKey === v)
					break
				case "variableKey":
					result = result.filter((i) => i.variableKey === v)
					break
				case "tenantId":
					result = result.filter((i) => i.tenantId?.toLowerCase().includes(vl))
					break
				case "isTruncated":
					result = result.filter((i) => String(Boolean((i as VarSearchResult).isTruncated)) === v)
					break
				default:
					break
			}
		}
		return result
	}

	varRunBtn.addEventListener("click", runVarSearch)

	renderVarConditions()

	// ════════════════════════════════════════════════════════════════════════
	// AI SEARCH
	// ════════════════════════════════════════════════════════════════════════

	const aiBuilderSection = document.createElement("div")
	aiBuilderSection.className = "op-search-builder"
	aiPane.appendChild(aiBuilderSection)

	const aiInputRow = document.createElement("div")
	aiInputRow.className = "op-ai-search-row"
	aiBuilderSection.appendChild(aiInputRow)

	const aiInput = document.createElement("input")
	aiInput.type = "text"
	aiInput.className = "op-ai-search-input"
	aiInput.placeholder =
		'e.g. "active instances with incidents", "variable amount greater than 1000"'
	aiInputRow.appendChild(aiInput)

	const aiRunBtn = document.createElement("button")
	aiRunBtn.className = "op-action-btn op-action-btn--primary"
	aiRunBtn.textContent = "▶ Search"
	aiInputRow.appendChild(aiRunBtn)

	const aiHint = document.createElement("div")
	aiHint.className = "op-ai-search-hint"
	aiHint.textContent = "Ask in plain language — AI will translate your query to a Camunda search."
	aiBuilderSection.appendChild(aiHint)

	const aiStatusEl = document.createElement("div")
	aiStatusEl.className = "op-search-status"
	aiBuilderSection.appendChild(aiStatusEl)

	const aiResultsSection = document.createElement("div")
	aiResultsSection.className = "op-search-results"
	aiResultsSection.style.display = "none"
	aiPane.appendChild(aiResultsSection)

	const aiResultsHeading = document.createElement("div")
	aiResultsHeading.className = "op-search-results-heading"
	aiResultsSection.appendChild(aiResultsHeading)

	const aiFilterEl = document.createElement("div")
	aiFilterEl.className = "op-ai-search-filter"
	aiResultsSection.appendChild(aiFilterEl)

	// Results are either instances or variables depending on what the AI decides
	const { el: aiInstTableEl, setRows: setAiInstRows } = createFilterTable<ProcessInstanceResult>({
		columns: [
			{
				label: "Key",
				width: "140px",
				render: (row) => row.processInstanceKey,
				sortValue: (row) => row.processInstanceKey,
			},
			{
				label: "Process",
				render: (row) => row.processDefinitionName ?? row.processDefinitionId ?? "—",
				sortValue: (row) => row.processDefinitionName ?? row.processDefinitionId ?? "",
			},
			{
				label: "State",
				width: "110px",
				render: (row) => {
					const wrap = document.createElement("div")
					wrap.className = "bpmnkit-badge-wrap"
					wrap.appendChild(badge(row.state))
					return wrap
				},
				sortValue: (row) => row.state,
			},
			{
				label: "Started",
				width: "120px",
				render: (row) => relTime(row.startDate),
				sortValue: (row) => row.startDate ?? "",
			},
		],
		searchFn: (row) =>
			[row.processInstanceKey, row.processDefinitionId, row.processDefinitionName, row.state]
				.filter(Boolean)
				.join(" "),
		onRowClick: (row) => onNavigate(`/instances/${row.processInstanceKey}`),
		emptyText: "No instances found",
	})
	aiResultsSection.appendChild(aiInstTableEl)

	const { el: aiVarTableEl, setRows: setAiVarRows } = createFilterTable<VarSearchResult>({
		columns: [
			{
				label: "Process",
				render: (row) => {
					const wrap = document.createElement("span")
					wrap.className = "op-ai-var-process"
					const name = row.instanceProcessName ?? row.instanceProcessId ?? "—"
					const nameEl = document.createElement("span")
					nameEl.textContent = name
					wrap.appendChild(nameEl)
					if (row.instanceIsSubprocess) {
						const sub = document.createElement("span")
						sub.className = "op-ai-var-subprocess-badge"
						sub.textContent = "sub"
						wrap.appendChild(sub)
					}
					return wrap
				},
				sortValue: (row) => row.instanceProcessName ?? row.instanceProcessId ?? "",
			},
			{
				label: "State",
				width: "110px",
				render: (row) => {
					if (!row.instanceState) return "—"
					const wrap = document.createElement("div")
					wrap.className = "bpmnkit-badge-wrap"
					wrap.appendChild(badge(row.instanceState as "ACTIVE" | "COMPLETED" | "TERMINATED"))
					return wrap
				},
				sortValue: (row) => row.instanceState ?? "",
			},
			{
				label: "Name",
				width: "160px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-mono-cell"
					span.textContent = row.name
					return span
				},
				sortValue: (row) => row.name,
			},
			{
				label: "Value",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-search-var-value"
					span.textContent = row.value
					return span
				},
				sortValue: (row) => row.value,
			},
			{
				label: "Instance Key",
				width: "140px",
				render: (row) => {
					const btn = document.createElement("button")
					btn.className = "op-back-btn"
					btn.textContent = row.processInstanceKey
					btn.addEventListener("click", (e) => {
						e.stopPropagation()
						onNavigate(`/instances/${row.processInstanceKey}`)
					})
					return btn
				},
				sortValue: (row) => row.processInstanceKey,
			},
			{
				label: "Started",
				width: "120px",
				render: (row) => relTime(row.instanceStartDate),
				sortValue: (row) => row.instanceStartDate ?? "",
			},
		],
		searchFn: (row) =>
			[row.name, row.value, row.processInstanceKey, row.instanceProcessName, row.instanceProcessId]
				.filter(Boolean)
				.join(" "),
		emptyText: "No variables found",
	})
	aiResultsSection.appendChild(aiVarTableEl)
	aiVarTableEl.style.display = "none"

	let aiAbort = false

	function runAiSearch(): void {
		const query = aiInput.value.trim()
		if (!query) return

		aiRunBtn.disabled = true
		aiRunBtn.textContent = "Searching…"
		aiStatusEl.textContent = ""
		aiResultsSection.style.display = "none"
		aiAbort = false

		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile

		fetch(`${cfg.proxyUrl}/operate/ai-search`, {
			method: "POST",
			headers,
			body: JSON.stringify({ query }),
		})
			.then((r) =>
				r.ok ? r.json() : r.text().then((t) => Promise.reject(new Error(`${r.status}: ${t}`))),
			)
			.then(
				(result: {
					endpoint: "instances" | "variables"
					filter: Record<string, unknown>
					items: unknown[]
					total: number
				}) => {
					if (aiAbort) return
					const count = result.items.length
					aiResultsHeading.textContent = `${count} result${count !== 1 ? "s" : ""} (${result.total} total)`
					aiFilterEl.textContent = `Interpreted as: ${JSON.stringify(result.filter)}`

					if (result.endpoint === "variables") {
						aiInstTableEl.style.display = "none"
						aiVarTableEl.style.display = ""
						setAiVarRows(result.items as VarSearchResult[])
					} else {
						aiVarTableEl.style.display = "none"
						aiInstTableEl.style.display = ""
						setAiInstRows(result.items as ProcessInstanceResult[])
					}
					aiResultsSection.style.display = ""
				},
			)
			.catch((err: unknown) => {
				if (aiAbort) return
				aiStatusEl.textContent = `Error: ${String(err)}`
			})
			.finally(() => {
				if (aiAbort) return
				aiRunBtn.disabled = false
				aiRunBtn.textContent = "▶ Search"
			})
	}

	aiRunBtn.addEventListener("click", runAiSearch)
	aiInput.addEventListener("keydown", (e) => {
		if (e.key === "Enter") runAiSearch()
	})

	// ── Check proxy for AI availability (async, non-blocking) ─────────────────
	if (!cfg.mock) {
		fetch(`${cfg.proxyUrl}/status`)
			.then((r) =>
				r.ok ? (r.json() as Promise<{ ready: boolean; backend: string | null }>) : null,
			)
			.then((status) => {
				if (status?.ready && status.backend !== null) {
					aiTabBtn.style.display = ""
				}
			})
			.catch(() => {
				/* proxy not running — AI tab stays hidden */
			})
	}

	return {
		el,
		destroy(): void {
			instStore?.destroy()
			varSearchAbort?.()
			aiAbort = true
		},
	}
}

/** Coerce a user-entered variable value to its JSON-serialized form.
 *  If the input is already valid JSON, use it as-is.
 *  Otherwise wrap it in double quotes (treat as string literal). */
function coerceVarValue(v: string): string {
	try {
		JSON.parse(v)
		return v
	} catch {
		return JSON.stringify(v)
	}
}
