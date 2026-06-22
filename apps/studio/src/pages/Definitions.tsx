import { Search } from "@cascivo/react"
import { AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Layers } from "lucide-react"
import { useEffect, useState } from "preact/hooks"
import { Link } from "wouter"
import { useDefinitions } from "../api/queries.js"
import type { ProcessDefinition } from "../api/types.js"
import { useModelsStore } from "../stores/models.js"
import { useUiStore } from "../stores/ui.js"

interface ProcessGroup {
	processDefinitionId: string
	name: string
	versions: ProcessDefinition[]
	latest: ProcessDefinition
}

function groupDefinitions(items: ProcessDefinition[]): ProcessGroup[] {
	const map = new Map<string, ProcessDefinition[]>()
	for (const def of items) {
		const id = def.processDefinitionId
		const existing = map.get(id)
		if (existing) existing.push(def)
		else map.set(id, [def])
	}
	const groups: ProcessGroup[] = []
	for (const [processDefinitionId, versions] of map.entries()) {
		const sorted = [...versions].sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
		const latest = sorted[0]
		if (!latest) continue
		groups.push({
			processDefinitionId,
			name: latest.name || processDefinitionId,
			versions: sorted,
			latest,
		})
	}
	return groups
}

function VersionsTable({ versions }: { versions: ProcessDefinition[] }) {
	return (
		<tr>
			<td colSpan={5} className="p-0">
				<div className="border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-150">
					<table className="w-full text-sm">
						<tbody>
							{versions.map((def) => (
								<tr
									key={def.processDefinitionKey}
									className="border-b border-border/30 bg-surface-2/50 hover:bg-surface-2 transition-colors"
								>
									<td className="pl-10 pr-4 py-2 w-12">
										<span className="text-xs font-mono text-muted">v{def.version}</span>
									</td>
									<td className="px-4 py-2">
										<Link
											href={`/definitions/${def.processDefinitionKey}`}
											className="text-xs text-accent hover:underline"
										>
											{def.processDefinitionKey}
										</Link>
									</td>
									<td className="px-4 py-2 text-xs text-muted">{def.tenantId ?? "—"}</td>
									<td className="px-4 py-2 text-xs text-muted">
										{def.deploymentTime ? new Date(def.deploymentTime).toLocaleDateString() : "—"}
									</td>
									<td className="px-4 py-2" />
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</td>
		</tr>
	)
}

export function Definitions() {
	const [search, setSearch] = useState("")
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const { data, isLoading, isError } = useDefinitions()
	const { models } = useModelsStore()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Definitions" }])
	}, [setBreadcrumbs])

	const groups = data ? groupDefinitions(data.items) : []

	const filtered = groups.filter(
		(g) =>
			!search ||
			g.name.toLowerCase().includes(search.toLowerCase()) ||
			g.processDefinitionId.toLowerCase().includes(search.toLowerCase()),
	)

	function toggleExpand(id: string) {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	function findLocalModel(processDefinitionId: string) {
		return models.find((m) => m.processDefinitionId === processDefinitionId)
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
				<AlertTriangle size={32} className="text-danger" />
				<p className="text-sm text-muted">Could not load definitions. Is the proxy running?</p>
			</div>
		)
	}

	return (
		<div className="p-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{!isLoading && (
				<p className="text-xs text-muted mb-6">
					{filtered.length} process{filtered.length !== 1 ? "es" : ""}
				</p>
			)}

			<div className="mb-4">
				<Search
					placeholder="Search by name or process ID..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search definitions"
				/>
			</div>

			<div className="rounded-lg border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-sm min-w-[520px]">
						<thead>
							<tr className="border-b border-border bg-surface-2 text-left text-xs text-muted">
								<th className="px-4 py-3 font-medium w-8" />
								<th className="px-4 py-3 font-medium">Process</th>
								<th className="px-4 py-3 font-medium">Versions</th>
								<th className="px-4 py-3 font-medium">Latest deployed</th>
								<th className="px-4 py-3 font-medium sr-only">Actions</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								(["s0", "s1", "s2", "s3"] as const).map((sk) => (
									<tr key={sk} className="border-b border-border/50">
										{(["a", "b", "c", "d", "e"] as const).map((col) => (
											<td key={col} className="px-4 py-3">
												<div className="h-4 animate-pulse rounded bg-surface-2" />
											</td>
										))}
									</tr>
								))}
							{filtered.map((group) => {
								const expanded = expandedIds.has(group.processDefinitionId)
								const localModel = findLocalModel(group.processDefinitionId)
								const hasMultiple = group.versions.length > 1

								return [
									<tr
										key={group.processDefinitionId}
										className="border-b border-border/50 hover:bg-surface-2 transition-colors"
									>
										{/* Expand toggle */}
										<td className="px-4 py-3">
											{hasMultiple && (
												<button
													type="button"
													onClick={() => toggleExpand(group.processDefinitionId)}
													className="text-muted hover:text-fg transition-colors"
													aria-label={expanded ? "Collapse versions" : "Expand versions"}
												>
													{expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
												</button>
											)}
										</td>

										{/* Name + process ID */}
										<td className="px-4 py-3">
											<Link
												href={`/definitions/${group.latest.processDefinitionKey}`}
												className="font-medium text-fg hover:text-accent block transition-colors"
											>
												{group.name}
											</Link>
											<span className="text-xs font-mono text-muted">
												{group.processDefinitionId}
											</span>
										</td>

										{/* Version count — click to expand */}
										<td className="px-4 py-3">
											{hasMultiple ? (
												<button
													type="button"
													onClick={() => toggleExpand(group.processDefinitionId)}
													className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
												>
													<Layers size={12} />
													{group.versions.length} versions
												</button>
											) : (
												<span className="text-xs text-muted">v{group.latest.version}</span>
											)}
										</td>

										{/* Latest deployment date */}
										<td className="px-4 py-3 text-xs text-muted">
											{group.latest.deploymentTime
												? new Date(group.latest.deploymentTime).toLocaleDateString()
												: "—"}
										</td>

										{/* Actions */}
										<td className="px-4 py-3">
											{localModel && (
												<Link
													href={`/models/${localModel.id}`}
													className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
												>
													<ExternalLink size={11} />
													Open local
												</Link>
											)}
										</td>
									</tr>,
									expanded && (
										<VersionsTable
											key={`${group.processDefinitionId}-versions`}
											versions={group.versions}
										/>
									),
								]
							})}
							{!isLoading && filtered.length === 0 && (
								<tr>
									<td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
										No definitions found.
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
