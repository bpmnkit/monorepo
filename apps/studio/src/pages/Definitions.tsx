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
				<div className="animate-in border-border border-t fade-in slide-in-from-top-1 duration-150">
					<table className="w-full text-sm">
						<tbody>
							{versions.map((def) => (
								<tr
									key={def.processDefinitionKey}
									className="border-border/60 border-b bg-bg transition-colors hover:bg-surface"
								>
									<td className="w-12 py-2 pr-4 pl-10">
										<span className="ds-datum text-muted text-xs">v{def.version}</span>
									</td>
									<td className="px-4 py-2">
										<Link
											href={`/definitions/${def.processDefinitionKey}`}
											className="ds-datum text-accent text-xs hover:underline"
										>
											{def.processDefinitionKey}
										</Link>
									</td>
									<td className="ds-datum px-4 py-2 text-muted text-xs">{def.tenantId ?? "—"}</td>
									<td className="ds-datum px-4 py-2 text-muted text-xs">
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
			<div className="ds-empty h-full">
				<AlertTriangle size={24} className="text-danger" />
				<p className="ds-lede">Could not load definitions. Is the proxy running?</p>
			</div>
		)
	}

	return (
		<div className="ds-page animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="ds-head">
				<h1 className="ds-eyebrow">Definitions</h1>
				{!isLoading && (
					<span className="ds-datum text-muted text-xs">
						{filtered.length} process{filtered.length !== 1 ? "es" : ""}
					</span>
				)}
			</div>

			<div className="mb-3">
				<Search
					placeholder="Search by name or process ID..."
					value={search}
					onChange={setSearch}
					className="w-full max-w-80"
					label="Search definitions"
				/>
			</div>

			<div className="ds-box">
				<div className="overflow-x-auto">
					<table className="w-full min-w-[520px] text-sm">
						<thead>
							<tr className="border-border border-b bg-bg text-left">
								<th className="w-8 px-4 py-2.5" />
								<th className="px-4 py-2.5">Process</th>
								<th className="px-4 py-2.5">Versions</th>
								<th className="px-4 py-2.5">Latest deployed</th>
								<th className="sr-only px-4 py-2.5">Actions</th>
							</tr>
						</thead>
						<tbody>
							{isLoading &&
								(["s0", "s1", "s2", "s3"] as const).map((sk) => (
									<tr key={sk} className="border-border/60 border-b">
										{(["a", "b", "c", "d", "e"] as const).map((col) => (
											<td key={col} className="px-4 py-3">
												<div className="h-4 animate-pulse bg-surface-2" />
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
										className="border-border/60 border-b transition-colors hover:bg-bg"
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
												className="block text-fg transition-colors hover:text-accent"
											>
												{group.name}
											</Link>
											<span className="ds-datum text-muted text-xs">
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
												<span className="ds-datum text-muted text-xs">v{group.latest.version}</span>
											)}
										</td>

										{/* Latest deployment date */}
										<td className="ds-datum px-4 py-3 text-muted text-xs">
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
