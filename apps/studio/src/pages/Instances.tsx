import { Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useCancelInstance, useInstances } from "../api/queries.js"
import { ErrorState } from "../components/ErrorState.js"
import { StatusPill } from "../components/StatusPill.js"
import { Button } from "../components/ui/button.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

type StateFilter = "all" | "ACTIVE" | "COMPLETED" | "TERMINATED"

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

	function toggleSelect(key: string) {
		setSelected((prev) => {
			const next = new Set(prev)
			if (next.has(key)) next.delete(key)
			else next.add(key)
			return next
		})
	}

	async function handleBulkCancel() {
		for (const key of selected) {
			try {
				await cancelMutation.mutateAsync(key)
			} catch {
				toast.error(`Failed to cancel instance ${key}`)
			}
		}
		setSelected(new Set())
		toast.success(`Cancelled ${selected.size} instance(s)`)
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
				{selected.size > 0 && (
					<Button variant="danger" size="sm" onClick={() => void handleBulkCancel()}>
						Cancel selected ({selected.size})
					</Button>
				)}
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

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm min-w-[480px]">
						<thead>
							<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
								<th className="px-4 py-3 w-8">
									<span className="sr-only">Select</span>
								</th>
								<th className="px-4 py-3 font-medium">State</th>
								<th className="px-4 py-3 font-medium">Process ID</th>
								<th className="px-4 py-3 font-medium">Key</th>
								<th className="px-4 py-3 font-medium">Started</th>
								<th className="px-4 py-3 font-medium">Ended</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								(["s0", "s1", "s2", "s3", "s4"] as const).map((sk) => (
									<tr key={sk} className="border-b border-border/50">
										{(["a", "b", "c", "d", "e", "f"] as const).map((col) => (
											<td key={col} className="px-4 py-3">
												<div className="h-4 animate-pulse rounded bg-surface-2" />
											</td>
										))}
									</tr>
								))}
							{filtered?.map((inst) => (
								<tr
									key={inst.processInstanceKey}
									className="border-b border-border/50 hover:bg-surface-2 cursor-pointer"
								>
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={selected.has(inst.processInstanceKey)}
											onClick={(e) => e.stopPropagation()}
											onChange={() => toggleSelect(inst.processInstanceKey)}
											aria-label={`Select instance ${inst.processInstanceKey}`}
											className="cursor-pointer"
										/>
									</td>
									<td className="px-4 py-3">
										<Link href={`/instances/${inst.processInstanceKey}`}>
											<StatusPill state={inst.state} />
										</Link>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-muted">
										<Link href={`/instances/${inst.processInstanceKey}`} className="hover:text-fg">
											{inst.processDefinitionId}
										</Link>
									</td>
									<td className="px-4 py-3 font-mono text-xs text-muted">
										<Link
											href={`/instances/${inst.processInstanceKey}`}
											className="hover:text-accent"
										>
											{inst.processInstanceKey}
										</Link>
									</td>
									<td className="px-4 py-3 text-muted text-xs">
										{inst.startDate ? new Date(inst.startDate).toLocaleString() : "—"}
									</td>
									<td className="px-4 py-3 text-muted text-xs">
										{inst.endDate ? new Date(inst.endDate).toLocaleString() : "—"}
									</td>
								</tr>
							))}
							{!isLoading && filtered?.length === 0 && (
								<tr>
									<td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
										No instances found.
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
