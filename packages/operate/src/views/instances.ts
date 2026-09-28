import { badge } from "../components/badge.js"
import { createFilterTable } from "../components/filter-table.js"
import type { InstancesStore } from "../stores/instances.js"
import type { ProcessInstanceResult } from "../types.js"

function relTime(iso: string | null | undefined): string {
	if (!iso) return "—"
	const diff = Date.now() - new Date(iso).getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	return `${Math.floor(h / 24)}d ago`
}

type InstMap = Map<string, ProcessInstanceResult>

function buildInstMap(items: ProcessInstanceResult[]): InstMap {
	const m: InstMap = new Map()
	for (const inst of items) m.set(inst.processInstanceKey, inst)
	return m
}

/** Walk up the parent chain and return an ordered array of process definition names. */
function getChain(inst: ProcessInstanceResult, map: InstMap): string[] {
	const chain: string[] = []
	let cur: ProcessInstanceResult | undefined = inst
	const visited = new Set<string>()
	while (cur && !visited.has(cur.processInstanceKey)) {
		visited.add(cur.processInstanceKey)
		chain.unshift(cur.processDefinitionName ?? cur.processDefinitionId ?? "?")
		if (!cur.parentProcessInstanceKey) break
		const parent = map.get(cur.parentProcessInstanceKey)
		if (!parent) {
			// Parent exists but not loaded — prefix with ellipsis
			chain.unshift("…")
			break
		}
		cur = parent
	}
	return chain
}

/**
 * Returns the processDefinitionId of the root (top-level) process for this instance.
 * Uses rootProcessInstanceKey (8.9+) as a shortcut; falls back to walking the chain.
 */
function getRootDefId(inst: ProcessInstanceResult, map: InstMap): string {
	// 8.9+ shortcut
	if (inst.rootProcessInstanceKey && inst.rootProcessInstanceKey !== inst.processInstanceKey) {
		const root = map.get(inst.rootProcessInstanceKey)
		if (root) return root.processDefinitionId
	}
	// Walk up
	let cur: ProcessInstanceResult | undefined = inst
	const visited = new Set<string>()
	while (cur && !visited.has(cur.processInstanceKey)) {
		visited.add(cur.processInstanceKey)
		if (!cur.parentProcessInstanceKey) return cur.processDefinitionId
		const parent = map.get(cur.parentProcessInstanceKey)
		if (!parent) return cur.processDefinitionId
		cur = parent
	}
	return inst.processDefinitionId
}

/** Collect unique {id, name} pairs for all root-level process definitions. */
function getRootDefs(items: ProcessInstanceResult[]): Array<{ id: string; name: string }> {
	const seen = new Set<string>()
	const result: Array<{ id: string; name: string }> = []
	for (const inst of items) {
		if (inst.parentProcessInstanceKey) continue // skip sub-processes
		const id = inst.processDefinitionId
		if (!id || seen.has(id)) continue
		seen.add(id)
		result.push({ id, name: inst.processDefinitionName ?? id })
	}
	return result.sort((a, b) => a.name.localeCompare(b.name))
}

/** Render a breadcrumb element for the Process column. */
function renderBreadcrumb(chain: string[]): HTMLElement {
	const el = document.createElement("span")
	el.className = "op-proc-breadcrumb"
	if (chain.length === 0) {
		el.textContent = "—"
		return el
	}
	for (let i = 0; i < chain.length; i++) {
		if (i > 0) {
			const sep = document.createElement("span")
			sep.className = "op-proc-sep"
			sep.textContent = " / "
			el.appendChild(sep)
		}
		const part = document.createElement("span")
		part.className = i === chain.length - 1 ? "op-proc-leaf" : "op-proc-root"
		part.textContent = chain[i] ?? ""
		el.appendChild(part)
	}
	return el
}

export function createInstancesView(
	store: InstancesStore,
	onSelect: (inst: ProcessInstanceResult) => void,
	onFilterChange?: (state: string) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	// ── State filter bar ────────────────────────────────────────────────────
	const filterBar = document.createElement("div")
	filterBar.className = "op-filter-bar"
	const stateFilters = [
		{ label: "All", value: "" },
		{ label: "Active", value: "ACTIVE" },
		{ label: "Completed", value: "COMPLETED" },
		{ label: "Terminated", value: "TERMINATED" },
	]
	let activeStateFilter = ""
	for (const f of stateFilters) {
		const btn = document.createElement("button")
		btn.className = `op-filter-btn${f.value === activeStateFilter ? " op-filter-btn--active" : ""}`
		btn.textContent = f.label
		btn.addEventListener("click", () => {
			activeStateFilter = f.value
			for (const b of Array.from(filterBar.querySelectorAll(".op-filter-btn"))) {
				b.classList.remove("op-filter-btn--active")
			}
			btn.classList.add("op-filter-btn--active")
			onFilterChange?.(f.value)
		})
		filterBar.appendChild(btn)
	}

	// ── Main process filter ─────────────────────────────────────────────────
	const procFilterWrap = document.createElement("div")
	procFilterWrap.className = "op-proc-filter-wrap"

	const procFilterLabel = document.createElement("span")
	procFilterLabel.className = "op-proc-filter-label"
	procFilterLabel.textContent = "Process:"
	procFilterWrap.appendChild(procFilterLabel)

	const procSelect = document.createElement("select")
	procSelect.className = "op-proc-filter-select"

	// "All" option is always first
	const allOpt = document.createElement("option")
	allOpt.value = ""
	allOpt.textContent = "All"
	procSelect.appendChild(allOpt)
	procFilterWrap.appendChild(procSelect)

	filterBar.appendChild(procFilterWrap)
	el.appendChild(filterBar)

	let mainProcessFilter = ""
	procSelect.addEventListener("change", () => {
		mainProcessFilter = procSelect.value
		render(false)
	})

	// ── Table ───────────────────────────────────────────────────────────────
	let instMap: InstMap = new Map()

	const { el: tableEl, setRows } = createFilterTable<ProcessInstanceResult>({
		columns: [
			{
				label: "Key",
				width: "140px",
				render: (row) => row.processInstanceKey,
				sortValue: (row) => row.processInstanceKey,
			},
			{
				label: "Process",
				render: (row) => renderBreadcrumb(getChain(row, instMap)),
				sortValue: (row) => {
					const chain = getChain(row, instMap)
					return chain.join(" / ")
				},
			},
			{
				label: "Business ID",
				width: "140px",
				render: (row) => row.businessId || "—",
				sortValue: (row) => row.businessId ?? "",
			},
			{
				label: "State",
				width: "120px",
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
				width: "100px",
				render: (row) => relTime(row.startDate),
				sortValue: (row) => row.startDate ?? "",
			},
			{
				label: "Ended",
				width: "100px",
				render: (row) => relTime(row.endDate),
				sortValue: (row) => row.endDate ?? "",
			},
		],
		searchFn: (row) => {
			const chain = getChain(row, instMap)
			return [row.processInstanceKey, ...chain, row.businessId, row.state].filter(Boolean).join(" ")
		},
		onRowClick: onSelect,
		emptyText: "No process instances found",
	})
	el.appendChild(tableEl)

	function updateProcFilter(items: ProcessInstanceResult[]): void {
		const defs = getRootDefs(items)
		// Rebuild options after the "All" entry, preserving current selection
		while (procSelect.options.length > 1) procSelect.remove(1)
		for (const def of defs) {
			const opt = document.createElement("option")
			opt.value = def.id
			opt.textContent = def.name
			procSelect.appendChild(opt)
		}
		// Restore selection if still valid
		procSelect.value = mainProcessFilter
		if (!procSelect.value) {
			mainProcessFilter = ""
			procSelect.value = ""
		}
	}

	function render(keepPage = true): void {
		const items = store.state.data?.items ?? []
		instMap = buildInstMap(items)
		updateProcFilter(items)

		let rows = items
		if (mainProcessFilter) {
			rows = rows.filter((inst) => getRootDefId(inst, instMap) === mainProcessFilter)
		}
		setRows(rows, keepPage)
	}

	const unsub = store.subscribe(() => render())
	render()

	return { el, destroy: unsub }
}
