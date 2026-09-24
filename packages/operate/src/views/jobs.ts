import { badge } from "../components/badge.js"
import { createFilterTable } from "../components/filter-table.js"
import type { JobsStore } from "../stores/jobs.js"
import type { JobSearchResult } from "../types.js"

export function createJobsView(store: JobsStore): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	const { el: tableEl, setRows } = createFilterTable<JobSearchResult>({
		columns: [
			{
				label: "Key",
				width: "120px",
				render: (row) => row.jobKey,
				sortValue: (row) => row.jobKey,
			},
			{
				label: "Type",
				render: (row) => row.type,
				sortValue: (row) => row.type,
			},
			{
				label: "Worker",
				width: "160px",
				render: (row) => row.worker || "—",
				sortValue: (row) => row.worker ?? "",
			},
			{
				label: "Retries",
				width: "70px",
				render: (row) => String(row.retries),
				sortValue: (row) => row.retries,
			},
			{
				label: "State",
				width: "120px",
				render: (row) => badge(row.state),
				sortValue: (row) => row.state,
			},
			{
				label: "Error",
				width: "200px",
				render: (row) => {
					const span = document.createElement("span")
					span.className = "op-cell-error"
					span.title = row.errorMessage ?? ""
					span.textContent = row.errorMessage ?? "—"
					return span
				},
			},
		],
		searchFn: (row) =>
			[row.jobKey, row.type, row.worker, row.state, row.errorMessage].filter(Boolean).join(" "),
		emptyText: "No jobs found",
	})
	el.appendChild(tableEl)

	function render(): void {
		setRows(store.state.data?.items ?? [], true)
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
