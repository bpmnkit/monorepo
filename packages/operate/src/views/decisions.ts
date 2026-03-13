import { createFilterTable } from "../components/filter-table.js"
import type { DecisionsStore } from "../stores/decisions.js"
import type { DecisionDefinitionResult } from "../types.js"

interface DecRow {
	latest: DecisionDefinitionResult
	versionCount: number
}

export function createDecisionsView(
	store: DecisionsStore,
	onSelect: (def: DecisionDefinitionResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-def-view"

	const { el: tableEl, setRows } = createFilterTable<DecRow>({
		columns: [
			{
				label: "Name",
				render: (row) => row.latest.name ?? row.latest.decisionDefinitionId,
				sortValue: (row) => row.latest.name ?? row.latest.decisionDefinitionId,
			},
			{
				label: "ID",
				width: "200px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-mono-cell"
					span.textContent = row.latest.decisionDefinitionId
					return span
				},
				sortValue: (row) => row.latest.decisionDefinitionId,
			},
			{
				label: "DRG",
				width: "180px",
				render: (row) => row.latest.decisionRequirementsName ?? "—",
				sortValue: (row) => row.latest.decisionRequirementsName ?? "",
			},
			{
				label: "Versions",
				width: "80px",
				render: (row) => String(row.versionCount),
				sortValue: (row) => row.versionCount,
			},
			{
				label: "Latest",
				width: "80px",
				render: (row) => `v${row.latest.version ?? "?"}`,
				sortValue: (row) => row.latest.version ?? 0,
			},
		],
		searchFn: (row) =>
			[
				row.latest.name,
				row.latest.decisionDefinitionId,
				row.latest.decisionRequirementsName,
				row.latest.decisionDefinitionKey,
			]
				.filter(Boolean)
				.join(" "),
		onRowClick: (row) => onSelect(row.latest),
		emptyText: "No decision definitions deployed",
	})
	el.appendChild(tableEl)

	function buildRows(items: DecisionDefinitionResult[]): DecRow[] {
		const map = new Map<string, DecRow>()
		for (const item of items) {
			const id = item.decisionDefinitionId
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
