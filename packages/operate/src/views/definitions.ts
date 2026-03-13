import { createFilterTable } from "../components/filter-table.js"
import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

interface DefRow {
	latest: ProcessDefinitionResult
	versionCount: number
}

export function createDefinitionsView(
	store: DefinitionsStore,
	onSelect: (def: ProcessDefinitionResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-def-view"

	const { el: tableEl, setRows } = createFilterTable<DefRow>({
		columns: [
			{
				label: "Name",
				render: (row) => row.latest.name ?? row.latest.processDefinitionId ?? "—",
				sortValue: (row) => row.latest.name ?? row.latest.processDefinitionId ?? "",
			},
			{
				label: "ID",
				width: "200px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-mono-cell"
					span.textContent = row.latest.processDefinitionId ?? "—"
					return span
				},
				sortValue: (row) => row.latest.processDefinitionId ?? "",
			},
			{
				label: "Versions",
				width: "80px",
				render: (row) => String(row.versionCount),
				sortValue: (row) => row.versionCount,
			},
			{
				label: "Latest",
				width: "100px",
				render: (row) => {
					const v = row.latest
					return v.versionTag ?? `v${v.version ?? "?"}`
				},
				sortValue: (row) => row.latest.version ?? 0,
			},
		],
		searchFn: (row) =>
			[row.latest.name, row.latest.processDefinitionId, row.latest.processDefinitionKey]
				.filter(Boolean)
				.join(" "),
		onRowClick: (row) => onSelect(row.latest),
		emptyText: "No process definitions deployed",
	})
	el.appendChild(tableEl)

	function buildRows(items: ProcessDefinitionResult[]): DefRow[] {
		const map = new Map<string, DefRow>()
		for (const item of items) {
			const id = item.processDefinitionId ?? item.processDefinitionKey ?? ""
			const existing = map.get(id)
			if (!existing) {
				map.set(id, { latest: item, versionCount: 1 })
			} else {
				existing.versionCount++
				if ((item.version ?? 0) > (existing.latest.version ?? 0)) {
					existing.latest = item
				}
			}
		}
		return Array.from(map.values())
	}

	function render(): void {
		setRows(buildRows(store.state.data?.items ?? []))
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
