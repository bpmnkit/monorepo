import { type Column, DataTable, Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useDecisions } from "../api/queries.js"
import type { DecisionDefinition } from "../api/types.js"
import { ErrorState } from "../components/ErrorState.js"
import { useUiStore } from "../stores/ui.js"

const columns: Column<DecisionDefinition>[] = [
	{
		key: "name",
		header: "Name",
		render: (dec) => (
			<Link
				href={`/decisions/${dec.decisionDefinitionKey}`}
				className="font-medium text-fg hover:text-accent"
			>
				{dec.name || dec.decisionDefinitionId}
			</Link>
		),
	},
	{
		key: "decisionId",
		header: "Decision ID",
		render: (dec) => (
			<span className="font-mono text-muted text-xs">{dec.decisionDefinitionId}</span>
		),
	},
	{
		key: "version",
		header: "Version",
		render: (dec) => <span className="text-muted">v{dec.version}</span>,
	},
	{
		key: "tenant",
		header: "Tenant",
		render: (dec) => <span className="text-muted">{dec.tenantId ?? "—"}</span>,
	},
]

export function Decisions() {
	const [search, setSearch] = useState("")
	const { data, isLoading, isError } = useDecisions()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Decisions" }])
	}, [setBreadcrumbs])

	const filtered = data?.items.filter(
		(d) =>
			!search ||
			d.name?.toLowerCase().includes(search.toLowerCase()) ||
			d.decisionDefinitionId?.toLowerCase().includes(search.toLowerCase()),
	)

	if (isError) {
		return (
			<ErrorState
				title="Could not load decisions"
				description="Unable to reach the Camunda API. Make sure the proxy is running and at least one DMN decision has been deployed to your cluster."
				hint="pnpm proxy"
				settingsHint
			/>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{!isLoading && (
				<p className="text-xs text-muted mb-6">
					{filtered?.length ?? 0} decision{(filtered?.length ?? 0) !== 1 ? "s" : ""}
				</p>
			)}

			<div className="mb-4">
				<Search
					placeholder="Search by name or decision ID..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search decisions"
				/>
			</div>

			<DataTable
				columns={columns}
				rows={filtered ?? []}
				getRowId={(dec) => dec.decisionDefinitionKey}
				loading={isLoading}
				emptyState="No decisions found."
			/>
		</div>
	)
}
