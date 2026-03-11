import { badge } from "../components/badge.js"
import { createTable } from "../components/table.js"
import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

export function createDefinitionsView(
	store: DefinitionsStore,
	onSelect: (def: ProcessDefinitionResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	const { el: tableEl, setRows } = createTable<ProcessDefinitionResult>({
		columns: [
			{
				label: "Name",
				render: (row) => row.name ?? row.processDefinitionId ?? "—",
			},
			{
				label: "ID",
				width: "220px",
				render: (row) => row.processDefinitionId ?? "—",
			},
			{
				label: "Version",
				width: "80px",
				render: (row) => String(row.version ?? "—"),
			},
			{
				label: "Tag",
				width: "100px",
				render: (row) => row.versionTag ?? "—",
			},
			{
				label: "Tenant",
				width: "120px",
				render: (row) => {
					const b = badge(row.tenantId ?? "default")
					b.className = "bpmn-badge bpmn-badge--tenant"
					return b
				},
			},
		],
		onRowClick: onSelect,
		emptyText: "No process definitions deployed",
	})

	el.appendChild(tableEl)

	function render(): void {
		const items = store.state.data?.items ?? []
		if (store.state.loading && items.length === 0) {
			tableEl.style.opacity = "0.5"
		} else {
			tableEl.style.opacity = "1"
			setRows(items)
		}
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
