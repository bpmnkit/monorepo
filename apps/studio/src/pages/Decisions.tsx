import { Search } from "@cascivo/react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useDecisions } from "../api/queries.js"
import { ErrorState } from "../components/ErrorState.js"
import { useUiStore } from "../stores/ui.js"

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

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<table className="w-full text-sm">
					<thead>
						<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
							<th className="px-4 py-3 font-medium">Name</th>
							<th className="px-4 py-3 font-medium">Decision ID</th>
							<th className="px-4 py-3 font-medium">Version</th>
							<th className="px-4 py-3 font-medium">Tenant</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							(["s0", "s1", "s2", "s3", "s4"] as const).map((sk) => (
								<tr key={sk} className="border-b border-border/50">
									{(["a", "b", "c", "d"] as const).map((col) => (
										<td key={col} className="px-4 py-3">
											<div className="h-4 animate-pulse rounded bg-surface-2" />
										</td>
									))}
								</tr>
							))}
						{filtered?.map((dec) => (
							<tr
								key={dec.decisionDefinitionKey}
								className="border-b border-border/50 hover:bg-surface-2"
							>
								<td className="px-4 py-3">
									<Link
										href={`/decisions/${dec.decisionDefinitionKey}`}
										className="font-medium text-fg hover:text-accent"
									>
										{dec.name || dec.decisionDefinitionId}
									</Link>
								</td>
								<td className="px-4 py-3 font-mono text-xs text-muted">
									{dec.decisionDefinitionId}
								</td>
								<td className="px-4 py-3 text-muted">v{dec.version}</td>
								<td className="px-4 py-3 text-muted">{dec.tenantId ?? "—"}</td>
							</tr>
						))}
						{!isLoading && filtered?.length === 0 && (
							<tr>
								<td colSpan={4} className="px-4 py-8 text-center text-sm text-muted">
									No decisions found.
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
