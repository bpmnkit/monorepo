import { type Column, DataTable, Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useIncidents } from "../api/queries.js"
import type { Incident } from "../api/types.js"
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

	const columns: Column<Incident>[] = [
		{
			key: "errorType",
			header: "Error Type",
			render: (inc) => (
				<Link
					href={`/incidents/${inc.incidentKey}`}
					className="font-mono text-danger text-xs hover:underline"
				>
					{inc.errorType}
				</Link>
			),
		},
		{
			key: "errorMessage",
			header: "Message",
			render: (inc) => (
				<span className="block max-w-xs truncate text-muted text-xs">
					{inc.errorMessage.slice(0, 80)}
				</span>
			),
		},
		...(mode === "developer"
			? [
					{
						key: "elementId",
						header: "Element",
						render: (inc: Incident) => (
							<span className="font-mono text-muted text-xs">{inc.elementId}</span>
						),
					},
				]
			: []),
		{
			key: "process",
			header: "Process",
			render: (inc) => (
				<span className="font-mono text-muted text-xs">{inc.processDefinitionId}</span>
			),
		},
		{
			key: "instance",
			header: "Instance",
			render: (inc) => (
				<Link
					href={`/instances/${inc.processInstanceKey}`}
					className="font-mono text-accent text-xs hover:underline"
				>
					{inc.processInstanceKey}
				</Link>
			),
		},
		{
			key: "age",
			header: "Age",
			render: (inc) => (
				<span className="text-muted text-xs">
					{inc.creationTime ? new Date(inc.creationTime).toLocaleDateString() : "—"}
				</span>
			),
		},
	]

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

			<DataTable
				columns={columns}
				rows={filtered ?? []}
				getRowId={(inc) => inc.incidentKey}
				loading={isLoading}
				emptyState="No incidents found."
			/>
		</div>
	)
}
