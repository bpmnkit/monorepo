import { type Column, DataTable, Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useCancelInstance, useInstances } from "../api/queries.js"
import type { ProcessInstance } from "../api/types.js"
import { ErrorState } from "../components/ErrorState.js"
import { StatusPill } from "../components/StatusPill.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

type StateFilter = "all" | "ACTIVE" | "COMPLETED" | "TERMINATED"

const columns: Column<ProcessInstance>[] = [
	{
		key: "state",
		header: "State",
		render: (inst) => (
			<Link href={`/instances/${inst.processInstanceKey}`}>
				<StatusPill state={inst.state} />
			</Link>
		),
	},
	{
		key: "processId",
		header: "Process ID",
		render: (inst) => (
			<Link
				href={`/instances/${inst.processInstanceKey}`}
				className="font-mono text-muted text-xs hover:text-fg"
			>
				{inst.processDefinitionId}
			</Link>
		),
	},
	{
		key: "key",
		header: "Key",
		render: (inst) => (
			<Link
				href={`/instances/${inst.processInstanceKey}`}
				className="font-mono text-muted text-xs hover:text-accent"
			>
				{inst.processInstanceKey}
			</Link>
		),
	},
	{
		key: "started",
		header: "Started",
		render: (inst) => (
			<span className="text-muted text-xs">
				{inst.startDate ? new Date(inst.startDate).toLocaleString() : "—"}
			</span>
		),
	},
	{
		key: "ended",
		header: "Ended",
		render: (inst) => (
			<span className="text-muted text-xs">
				{inst.endDate ? new Date(inst.endDate).toLocaleString() : "—"}
			</span>
		),
	},
]

export function Instances() {
	const [search, setSearch] = useState("")
	const [stateFilter, setStateFilter] = useState<StateFilter>("all")
	const [selected, setSelected] = useState<Set<string>>(new Set())
	const cancelMutation = useCancelInstance()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Instances" }])
	}, [setBreadcrumbs])

	const filter = stateFilter !== "all" ? { state: stateFilter } : undefined
	const { data, isLoading, isError } = useInstances(filter)

	const filtered = data?.items.filter(
		(i) =>
			!search ||
			i.processDefinitionId?.toLowerCase().includes(search.toLowerCase()) ||
			i.processInstanceKey.includes(search),
	)

	async function handleBulkCancel(ids: string[]) {
		for (const key of ids) {
			try {
				await cancelMutation.mutateAsync(key)
			} catch {
				toast.error(`Failed to cancel instance ${key}`)
			}
		}
		setSelected(new Set())
		toast.success(`Cancelled ${ids.length} instance(s)`)
	}

	if (isError) {
		return (
			<ErrorState
				title="Could not load instances"
				description="Unable to reach the Camunda API. Make sure the proxy is running and connected to your cluster."
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
							{filtered?.length ?? 0} instance{(filtered?.length ?? 0) !== 1 ? "s" : ""}
						</p>
					)}
				</div>
			</div>

			{/* Filters */}
			<div className="flex items-center gap-3 mb-4">
				<Search
					placeholder="Search by process ID or key..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search instances"
				/>
				<div className="flex rounded border border-border bg-surface-2 text-xs overflow-hidden">
					{(["all", "ACTIVE", "COMPLETED", "TERMINATED"] as StateFilter[]).map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStateFilter(s)}
							className={`px-3 py-1.5 capitalize transition-colors ${
								stateFilter === s ? "bg-surface text-fg" : "text-muted hover:text-fg"
							}`}
							aria-pressed={stateFilter === s}
						>
							{s === "all" ? "All" : s}
						</button>
					))}
				</div>
			</div>

			<DataTable
				columns={columns}
				rows={filtered ?? []}
				getRowId={(inst) => inst.processInstanceKey}
				loading={isLoading}
				emptyState="No instances found."
				selection={{
					mode: "multi",
					selected: Array.from(selected),
					onChange: (ids) => setSelected(new Set(ids)),
				}}
				batchActions={[{ label: "Cancel selected", onClick: (ids) => void handleBulkCancel(ids) }]}
			/>
		</div>
	)
}
