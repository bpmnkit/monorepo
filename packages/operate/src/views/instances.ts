import { badge } from "../components/badge.js"
import { createTable } from "../components/table.js"
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

	// Filter bar
	const filterBar = document.createElement("div")
	filterBar.className = "op-filter-bar"

	const filters = [
		{ label: "All", value: "" },
		{ label: "Active", value: "ACTIVE" },
		{ label: "Completed", value: "COMPLETED" },
		{ label: "Terminated", value: "TERMINATED" },
	]
	let activeFilter = ""

	for (const f of filters) {
		const btn = document.createElement("button")
		btn.className = `op-filter-btn${f.value === activeFilter ? " op-filter-btn--active" : ""}`
		btn.textContent = f.label
		btn.addEventListener("click", () => {
			activeFilter = f.value
			for (const b of Array.from(filterBar.querySelectorAll(".op-filter-btn"))) {
				b.classList.remove("op-filter-btn--active")
			}
			btn.classList.add("op-filter-btn--active")
			onFilterChange?.(f.value)
		})
		filterBar.appendChild(btn)
	}
	el.appendChild(filterBar)

	const { el: tableEl, setRows } = createTable<ProcessInstanceResult>({
		columns: [
			{
				label: "Key",
				width: "140px",
				render: (row) => row.processInstanceKey,
			},
			{
				label: "Process",
				render: (row) => row.processDefinitionName ?? row.processDefinitionId,
			},
			{
				label: "Business ID",
				width: "140px",
				render: (row) => row.businessId || "—",
			},
			{
				label: "State",
				width: "120px",
				render: (row) => {
					const wrap = document.createElement("div")
					wrap.className = "bpmn-badge-wrap"
					wrap.appendChild(badge(row.state))
					if (row.hasIncident) {
						const inc = document.createElement("span")
						inc.className = "bpmn-badge bpmn-badge--incident-dot"
						inc.title = "Has incident"
						inc.textContent = "⚠"
						wrap.appendChild(inc)
					}
					return wrap
				},
			},
			{
				label: "Started",
				width: "100px",
				render: (row) => relTime(row.startDate),
			},
			{
				label: "Ended",
				width: "100px",
				render: (row) => relTime(row.endDate),
			},
		],
		onRowClick: onSelect,
		emptyText: "No process instances found",
	})
	el.appendChild(tableEl)

	function render(): void {
		const items = store.state.data?.items ?? []
		setRows(items)
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
