import { badge } from "../components/badge.js"
import { createFilterTable } from "../components/filter-table.js"
import type { TasksStore } from "../stores/tasks.js"
import type { UserTaskResult } from "../types.js"

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

export function createTasksView(
	store: TasksStore,
	onSelect?: (task: UserTaskResult) => void,
): {
	el: HTMLElement
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view"

	const { el: tableEl, setRows } = createFilterTable<UserTaskResult>({
		columns: [
			{
				label: "Name",
				render: (row) => row.name ?? "—",
				sortValue: (row) => row.name ?? "",
			},
			{
				label: "Assignee",
				width: "160px",
				render: (row) => row.assignee ?? "unassigned",
				sortValue: (row) => row.assignee ?? "",
			},
			{
				label: "Process",
				width: "180px",
				render: (row) => row.processName ?? row.processDefinitionId ?? "—",
				sortValue: (row) => row.processName ?? row.processDefinitionId ?? "",
			},
			{
				label: "State",
				width: "100px",
				render: (row) => badge(row.state ?? "UNKNOWN"),
				sortValue: (row) => row.state ?? "",
			},
			{
				label: "Due",
				width: "100px",
				render: (row) => relTime(row.dueDate),
				sortValue: (row) => row.dueDate ?? "",
			},
			{
				label: "Priority",
				width: "70px",
				render: (row) => String(row.priority ?? "—"),
				sortValue: (row) => row.priority ?? 0,
			},
		],
		searchFn: (row) =>
			[row.name, row.assignee, row.processName, row.processDefinitionId, row.state]
				.filter(Boolean)
				.join(" "),
		onRowClick: onSelect,
		emptyText: "No user tasks found",
	})
	el.appendChild(tableEl)

	function render(): void {
		setRows(store.state.data?.items ?? [], true)
	}

	const unsub = store.subscribe(render)
	render()

	return { el, destroy: unsub }
}
