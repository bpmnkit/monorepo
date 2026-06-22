import { type Column, DataTable, Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useUserTasks } from "../api/queries.js"
import type { UserTask } from "../api/types.js"
import { ErrorState } from "../components/ErrorState.js"
import { Badge } from "../components/ui/badge.js"
import { useUiStore } from "../stores/ui.js"

function isOverdue(dueDate?: string): boolean {
	if (!dueDate) return false
	return new Date(dueDate) < new Date()
}

function priorityLabel(priority?: number): string {
	if (!priority) return "Normal"
	if (priority >= 80) return "Critical"
	if (priority >= 60) return "High"
	if (priority >= 40) return "Medium"
	return "Low"
}

const columns: Column<UserTask>[] = [
	{
		key: "name",
		header: "Name",
		render: (task) => (
			<Link href={`/tasks/${task.userTaskKey}`} className="font-medium text-fg hover:text-accent">
				{task.name || `Task ${task.userTaskKey}`}
			</Link>
		),
	},
	{
		key: "assignee",
		header: "Assignee",
		render: (task) =>
			task.assignee ? (
				<span className="text-muted text-sm">{task.assignee}</span>
			) : (
				<span className="text-muted text-xs italic">Unassigned</span>
			),
	},
	{
		key: "candidateGroups",
		header: "Candidate Groups",
		render: (task) => (
			<div className="flex flex-wrap gap-1">
				{task.candidateGroups?.map((g) => (
					<Badge key={g} variant="default" className="text-xs">
						{g}
					</Badge>
				))}
			</div>
		),
	},
	{
		key: "dueDate",
		header: "Due Date",
		render: (task) => {
			const overdue = isOverdue(task.dueDate)
			return (
				<span className={`text-xs ${overdue ? "text-danger" : "text-muted"}`}>
					{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
					{overdue && <span className="ml-1">(overdue)</span>}
				</span>
			)
		},
	},
	{
		key: "priority",
		header: "Priority",
		render: (task) => (
			<Badge
				variant={
					(task.priority ?? 0) >= 60 ? "danger" : (task.priority ?? 0) >= 40 ? "warn" : "muted"
				}
			>
				{priorityLabel(task.priority)}
			</Badge>
		),
	},
]

export function Tasks() {
	const [search, setSearch] = useState("")
	const { data, isLoading, isError } = useUserTasks()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Tasks" }])
	}, [setBreadcrumbs])

	const filtered = data?.items.filter(
		(t) =>
			!search ||
			t.name?.toLowerCase().includes(search.toLowerCase()) ||
			t.assignee?.toLowerCase().includes(search.toLowerCase()),
	)

	if (isError) {
		return (
			<ErrorState
				title="Could not load tasks"
				description="Unable to reach the Camunda API. Make sure the proxy is running and your cluster supports the User Tasks API (Camunda 8.5+)."
				hint="pnpm proxy"
				settingsHint
			/>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex items-center justify-between mb-6">
				<div>
					{!isLoading && (
						<p className="text-xs text-muted">
							{filtered?.length ?? 0} task{(filtered?.length ?? 0) !== 1 ? "s" : ""}
						</p>
					)}
				</div>
			</div>

			<div className="mb-4">
				<Search
					placeholder="Search by name or assignee..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search tasks"
				/>
			</div>

			<DataTable
				columns={columns}
				rows={filtered ?? []}
				getRowId={(task) => task.userTaskKey}
				loading={isLoading}
				emptyState="No tasks found."
			/>
		</div>
	)
}
