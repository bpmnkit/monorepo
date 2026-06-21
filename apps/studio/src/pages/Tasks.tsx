import { Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useUserTasks } from "../api/queries.js"
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

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm min-w-[480px]">
						<thead>
							<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
								<th className="px-4 py-3 font-medium">Name</th>
								<th className="px-4 py-3 font-medium">Assignee</th>
								<th className="px-4 py-3 font-medium">Candidate Groups</th>
								<th className="px-4 py-3 font-medium">Due Date</th>
								<th className="px-4 py-3 font-medium">Priority</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								(["s0", "s1", "s2", "s3", "s4"] as const).map((sk) => (
									<tr key={sk} className="border-b border-border/50">
										{(["a", "b", "c", "d", "e"] as const).map((col) => (
											<td key={col} className="px-4 py-3">
												<div className="h-4 animate-pulse rounded bg-surface-2" />
											</td>
										))}
									</tr>
								))}
							{filtered?.map((task) => {
								const overdue = isOverdue(task.dueDate)
								return (
									<tr
										key={task.userTaskKey}
										className="border-b border-border/50 hover:bg-surface-2 transition-colors duration-100"
									>
										<td className="px-4 py-3">
											<Link
												href={`/tasks/${task.userTaskKey}`}
												className="font-medium text-fg hover:text-accent"
											>
												{task.name || `Task ${task.userTaskKey}`}
											</Link>
										</td>
										<td className="px-4 py-3 text-muted text-sm">
											{task.assignee ?? <span className="text-xs italic">Unassigned</span>}
										</td>
										<td className="px-4 py-3">
											<div className="flex flex-wrap gap-1">
												{task.candidateGroups?.map((g) => (
													<Badge key={g} variant="default" className="text-xs">
														{g}
													</Badge>
												))}
											</div>
										</td>
										<td className={`px-4 py-3 text-xs ${overdue ? "text-danger" : "text-muted"}`}>
											{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
											{overdue && <span className="ml-1">(overdue)</span>}
										</td>
										<td className="px-4 py-3">
											<Badge
												variant={
													(task.priority ?? 0) >= 60
														? "danger"
														: (task.priority ?? 0) >= 40
															? "warn"
															: "muted"
												}
											>
												{priorityLabel(task.priority)}
											</Badge>
										</td>
									</tr>
								)
							})}
							{!isLoading && filtered?.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
										No tasks found.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	)
}
