import { Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useIncidents } from "../api/queries.js"
import { ErrorState } from "../components/ErrorState.js"
import { useModeStore } from "../stores/mode.js"
import { useUiStore } from "../stores/ui.js"

export function Incidents() {
	const [search, setSearch] = useState("")
	const { data, isLoading, isError } = useIncidents()
	const { setBreadcrumbs } = useUiStore()
	const { mode } = useModeStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Incidents" }])
	}, [setBreadcrumbs])

	const filtered = data?.items.filter(
		(i) =>
			!search ||
			i.errorType?.toLowerCase().includes(search.toLowerCase()) ||
			i.errorMessage?.toLowerCase().includes(search.toLowerCase()) ||
			i.processDefinitionId?.toLowerCase().includes(search.toLowerCase()),
	)

	if (isError) {
		return (
			<ErrorState
				title="Could not load incidents"
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
							{filtered?.length ?? 0} incident{(filtered?.length ?? 0) !== 1 ? "s" : ""}
						</p>
					)}
				</div>
			</div>

			<div className="mb-4">
				<Search
					placeholder="Search by error type or message..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search incidents"
				/>
			</div>

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm min-w-[560px]">
						<thead>
							<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
								<th className="px-4 py-3 font-medium">Error Type</th>
								<th className="px-4 py-3 font-medium">Message</th>
								{mode === "developer" && <th className="px-4 py-3 font-medium">Element</th>}
								<th className="px-4 py-3 font-medium">Process</th>
								<th className="px-4 py-3 font-medium">Instance</th>
								<th className="px-4 py-3 font-medium">Age</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								(["s0", "s1", "s2", "s3", "s4"] as const).map((sk) => (
									<tr key={sk} className="border-b border-border/50">
										{(mode === "developer"
											? (["a", "b", "c", "d", "e", "f"] as const)
											: (["a", "b", "c", "d", "e"] as const)
										).map((col) => (
											<td key={col} className="px-4 py-3">
												<div className="h-4 animate-pulse rounded bg-surface-2" />
											</td>
										))}
									</tr>
								))}
							{filtered?.map((inc) => (
								<tr
									key={inc.incidentKey}
									className="border-b border-border/50 hover:bg-surface-2 transition-colors duration-100"
								>
									<td className="px-4 py-3">
										<Link
											href={`/incidents/${inc.incidentKey}`}
											className="text-danger hover:underline text-xs font-mono"
										>
											{inc.errorType}
										</Link>
									</td>
									<td className="px-4 py-3 text-muted text-xs max-w-xs truncate">
										{inc.errorMessage.slice(0, 80)}
									</td>
									{mode === "developer" && (
										<td className="px-4 py-3 text-muted text-xs font-mono">{inc.elementId}</td>
									)}
									<td className="px-4 py-3 text-muted text-xs font-mono">
										{inc.processDefinitionId}
									</td>
									<td className="px-4 py-3">
										<Link
											href={`/instances/${inc.processInstanceKey}`}
											className="text-xs text-accent hover:underline font-mono"
										>
											{inc.processInstanceKey}
										</Link>
									</td>
									<td className="px-4 py-3 text-muted text-xs">
										{inc.creationTime ? new Date(inc.creationTime).toLocaleDateString() : "—"}
									</td>
								</tr>
							))}
							{!isLoading && filtered?.length === 0 && (
								<tr>
									<td
										colSpan={mode === "developer" ? 6 : 5}
										className="px-4 py-8 text-center text-sm text-muted"
									>
										No incidents found.
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
