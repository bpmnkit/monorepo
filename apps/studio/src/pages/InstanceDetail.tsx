import { BpmnCanvas } from "@bpmnkit/canvas"
import { InstancesStore, createInstanceDetailView } from "@bpmnkit/operate"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { Play, RotateCw, XCircle } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import type { JSX } from "preact/jsx-runtime"
import { Link, useLocation, useParams } from "wouter"
import { getActiveProfile, getProxyUrl } from "../api/client.js"
import {
	useCancelInstance,
	useCreateProcessInstance,
	useDefinitionXml,
	useElementInstances,
	useIncidents,
	useInstance,
	useInstanceVariables,
} from "../api/queries.js"
import { type JobResult, getJobResults } from "../api/wasm-adapter.js"
import { Button } from "../components/ui/button.js"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

type OperateView = ReturnType<typeof createInstanceDetailView>

// ── Variable rendering helpers ────────────────────────────────────────────────

interface VariableItem {
	name: string
	value: unknown
}

function formatValue(raw: unknown): string {
	if (raw === null || raw === undefined) return "null"
	if (typeof raw === "object") return JSON.stringify(raw, null, 2)
	const str = String(raw)
	try {
		const parsed: unknown = JSON.parse(str)
		if (typeof parsed === "object" && parsed !== null) {
			return JSON.stringify(parsed, null, 2)
		}
	} catch {
		/* not JSON */
	}
	return str
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function highlightText(text: string, query: string): JSX.Element {
	if (!query.trim()) return <>{text}</>
	const parts = text.split(new RegExp(`(${escapeRegex(query)})`, "gi"))
	return (
		<>
			{parts.map((part, i) =>
				i % 2 === 1 ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: static highlight parts
					<mark key={i} className="bg-accent/30 text-fg rounded-sm not-italic">
						{part}
					</mark>
				) : (
					part
				),
			)}
		</>
	)
}

function VariableModal({
	variable,
	onClose,
}: {
	variable: VariableItem
	onClose: () => void
}) {
	const [search, setSearch] = useState("")
	const inputRef = useRef<HTMLInputElement>(null)
	const formatted = formatValue(variable.value)
	const lines = formatted.split("\n")

	const visibleLines = search.trim()
		? lines.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
		: lines

	useEffect(() => {
		inputRef.current?.focus()
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [onClose])

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: ESC is handled via window keydown listener
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
			onClick={(e) => e.target === e.currentTarget && onClose()}
		>
			<div className="flex flex-col w-full max-w-2xl max-h-[80vh] rounded-lg border border-border bg-surface shadow-2xl overflow-hidden mx-4">
				<div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
					<span className="font-mono text-sm text-fg font-medium flex-1 truncate">
						{variable.name}
					</span>
					{search.trim() && (
						<span className="text-xs text-muted shrink-0">
							{visibleLines.length} / {lines.length} lines
						</span>
					)}
					<button
						type="button"
						onClick={onClose}
						className="text-muted hover:text-fg transition-colors shrink-0 text-lg leading-none"
						aria-label="Close"
					>
						✕
					</button>
				</div>
				<div className="px-4 py-2 border-b border-border/60 shrink-0">
					<input
						ref={inputRef}
						type="text"
						value={search}
						onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
						placeholder="Search in value…"
						className="w-full rounded border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
					/>
				</div>
				<div className="flex-1 overflow-auto p-4">
					<pre className="font-mono text-xs text-fg leading-relaxed whitespace-pre-wrap break-all">
						{visibleLines.length === 0 ? (
							<span className="text-muted italic">No lines match the search.</span>
						) : search.trim() ? (
							visibleLines.map((line, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: filtered lines
								<div key={i}>{highlightText(line, search)}</div>
							))
						) : (
							highlightText(formatted, search)
						)}
					</pre>
				</div>
			</div>
		</div>
	)
}

// ── Wasm-native instance detail ───────────────────────────────────────────────

interface WasmInstanceDetailProps {
	instanceKey: string
	initialVariables?: string
	onVariablesChange?: (v: string) => void
	hideNavLink?: boolean
}

export function WasmInstanceDetail({
	instanceKey,
	initialVariables,
	onVariablesChange,
	hideNavLink,
}: WasmInstanceDetailProps) {
	const { data: instance, isLoading } = useInstance(instanceKey)
	const { data: variablesData } = useInstanceVariables(instanceKey)
	const { data: incidentsData } = useIncidents({ processInstanceKey: instanceKey })
	const { data: elementInstancesData } = useElementInstances(instanceKey)
	const { data: xmlData } = useDefinitionXml(instance?.processDefinitionKey ?? "")
	const { theme } = useThemeStore()
	const cancel = useCancelInstance()
	const createInstance = useCreateProcessInstance()
	const canvasContainerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)
	const [startVars, setStartVars] = useState(initialVariables ?? "{}")
	const [startError, setStartError] = useState<string | null>(null)
	const [startedKey, setStartedKey] = useState<string | null>(null)
	const [varSearch, setVarSearch] = useState("")
	const [modalVar, setModalVar] = useState<VariableItem | null>(null)

	function handleVarsChange(v: string) {
		setStartVars(v)
		onVariablesChange?.(v)
	}

	useEffect(() => {
		const container = canvasContainerRef.current
		if (!container || !xmlData) return
		canvasRef.current?.destroy()

		const tokenHighlight = createTokenHighlightPlugin()
		const canvas = new BpmnCanvas({
			container,
			theme,
			grid: false,
			fit: "center",
			plugins: [tokenHighlight],
		})
		canvas.load(xmlData)

		const items = elementInstancesData?.items ?? []
		const activeIds = items.filter((e) => e.state === "ACTIVE").map((e) => e.elementId)
		const visitedIds = items.filter((e) => e.state !== "ACTIVE").map((e) => e.elementId)
		if (activeIds.length > 0) tokenHighlight.api.setActive(activeIds)
		if (visitedIds.length > 0) tokenHighlight.api.addVisited(visitedIds)

		canvasRef.current = canvas
		return () => {
			canvas.destroy()
			canvasRef.current = null
		}
	}, [xmlData, theme, elementInstancesData])

	async function handleCancel() {
		try {
			await cancel.mutateAsync(instanceKey)
			toast.success("Instance cancelled")
		} catch (err) {
			toast.error(err instanceof Error ? err.message : String(err))
		}
	}

	async function handleStart() {
		setStartError(null)
		setStartedKey(null)
		let vars: Record<string, unknown> = {}
		try {
			const trimmed = startVars.trim()
			if (trimmed && trimmed !== "{}") vars = JSON.parse(trimmed)
		} catch {
			setStartError("Variables must be valid JSON")
			return
		}
		try {
			const result = await createInstance.mutateAsync({
				processDefinitionKey: instance?.processDefinitionKey,
				variables: vars,
			})
			setStartedKey(result.processInstanceKey)
		} catch (err) {
			setStartError(err instanceof Error ? err.message : String(err))
		}
	}

	const variables = variablesData?.items ?? []
	const incidents = incidentsData?.items ?? []
	const jobExecutions = getJobResults(Number(instanceKey))

	const stateColor =
		instance?.state === "ACTIVE"
			? "text-success"
			: instance?.state === "COMPLETED"
				? "text-muted"
				: "text-danger"

	if (isLoading) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-sm text-muted">Loading…</p>
			</div>
		)
	}

	if (!instance) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-sm text-muted">Instance not found.</p>
			</div>
		)
	}

	const filteredVars = varSearch
		? variables.filter(
				(v) =>
					v.name.toLowerCase().includes(varSearch.toLowerCase()) ||
					String(v.value).toLowerCase().includes(varSearch.toLowerCase()),
			)
		: variables

	return (
		<div className="h-full flex flex-col md:flex-row">
			{modalVar && <VariableModal variable={modalVar} onClose={() => setModalVar(null)} />}
			{/* BPMN canvas — hidden on mobile (too small to be useful), visible on desktop */}
			<div className="hidden md:flex flex-1 relative border-r border-border bg-surface-2">
				<div ref={canvasContainerRef} className="absolute inset-0" />
				{!xmlData && (
					<div className="absolute inset-0 flex items-center justify-center">
						<p className="text-sm text-muted">No diagram available.</p>
					</div>
				)}
			</div>

			{/* Info panel — full width on mobile, fixed 320px on desktop */}
			<div className="w-full md:w-80 flex flex-col overflow-y-auto p-5 gap-5">
				{/* Header */}
				<div className="flex items-start justify-between gap-3">
					<div>
						<h2 className="text-sm font-semibold text-fg font-mono">
							{instance.processInstanceKey}
						</h2>
						<p className="text-xs text-muted mt-0.5">{instance.processDefinitionId}</p>
						<p className="text-xs mt-0.5">
							<span className={`font-medium ${stateColor}`}>{instance.state}</span>
						</p>
						{instance.startDate && (
							<p className="text-xs text-muted mt-0.5">
								{new Date(instance.startDate).toLocaleString()}
							</p>
						)}
					</div>
					{instance.state === "ACTIVE" && (
						<Button
							size="sm"
							variant="outline"
							onClick={() => void handleCancel()}
							disabled={cancel.isPending}
							className="text-danger border-danger hover:bg-danger/10 shrink-0"
						>
							{cancel.isPending ? (
								<>
									<RotateCw size={13} className="animate-spin" />
									Cancelling…
								</>
							) : (
								<>
									<XCircle size={13} />
									Cancel
								</>
							)}
						</Button>
					)}
				</div>

				{/* Wasm simulation banner */}
				<div className="rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-muted">
					<span className="font-semibold text-accent">Simulation mode</span> — Service tasks are
					auto-completed; REST connectors execute real HTTP requests.
				</div>

				{/* Start new instance */}
				<div className="border border-border rounded-lg p-3 flex flex-col gap-3">
					<p className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
						<Play size={11} />
						Start new instance
					</p>
					<div className="flex flex-col gap-1">
						<label className="text-xs text-muted" htmlFor="instance-vars">
							Variables (JSON)
						</label>
						<textarea
							id="instance-vars"
							value={startVars}
							onInput={(e) => handleVarsChange((e.target as HTMLTextAreaElement).value)}
							rows={2}
							className="w-full rounded-md border border-border bg-surface px-3 py-2 text-xs font-mono text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent resize-none"
							placeholder="{}"
						/>
					</div>
					{startError && <p className="text-xs text-danger">{startError}</p>}
					{startedKey && (
						<p className="text-xs text-success">
							Started —{" "}
							<Link href={`/instances/${startedKey}`} className="underline hover:text-accent">
								view #{startedKey}
							</Link>
						</p>
					)}
					<Button
						size="sm"
						onClick={() => void handleStart()}
						disabled={createInstance.isPending}
						className="self-start"
					>
						{createInstance.isPending ? (
							<>
								<RotateCw size={13} className="animate-spin" />
								Starting…
							</>
						) : (
							<>
								<Play size={13} />
								Start
							</>
						)}
					</Button>
				</div>

				{/* Job executions */}
				{jobExecutions.length > 0 && (
					<div className="flex flex-col gap-2">
						<p className="text-xs font-semibold text-muted uppercase tracking-wider">
							Job executions
						</p>
						<div className="border border-border rounded-lg overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-surface-2 border-b border-border">
										<th className="px-3 py-2 text-left font-medium text-muted">Element</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Result</th>
									</tr>
								</thead>
								<tbody>
									{jobExecutions.map((r: JobResult) => (
										<tr key={r.jobKey} className="border-b border-border last:border-0">
											<td className="px-3 py-2 font-mono text-fg">{r.elementId}</td>
											<td className="px-3 py-2">
												{r.kind === "simulated" && <span className="text-muted">Simulated</span>}
												{r.kind === "rest-ok" && (
													<span className="text-success">REST {r.status}</span>
												)}
												{r.kind === "rest-error" && (
													<span className="text-danger">
														{r.status ? `REST ${r.status}` : "REST error"}
													</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* Incidents */}
				{incidents.length > 0 && (
					<div className="flex flex-col gap-2">
						<p className="text-xs font-semibold text-muted uppercase tracking-wider">Incidents</p>
						<div className="border border-danger/40 rounded-lg overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-surface-2 border-b border-border">
										<th className="px-3 py-2 text-left font-medium text-muted">Type</th>
										<th className="px-3 py-2 text-left font-medium text-muted">Element</th>
									</tr>
								</thead>
								<tbody>
									{incidents.map((inc) => (
										<tr key={inc.incidentKey} className="border-b border-border last:border-0">
											<td className="px-3 py-2 text-danger">{inc.errorType}</td>
											<td className="px-3 py-2 font-mono text-muted">{inc.elementId}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{/* Variables */}
				<div className="flex flex-col gap-2">
					<p className="text-xs font-semibold text-muted uppercase tracking-wider flex items-center gap-1.5">
						Variables
						{variables.length > 0 && (
							<span className="bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
								{variables.length}
							</span>
						)}
					</p>
					<div className="border border-border rounded-lg overflow-hidden">
						<div className="p-2 border-b border-border/60">
							<input
								type="text"
								value={varSearch}
								onInput={(e) => setVarSearch((e.target as HTMLInputElement).value)}
								placeholder="Filter by name or value…"
								className="w-full rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
							/>
						</div>
						{filteredVars.length === 0 ? (
							<p className="px-3 py-4 text-xs text-muted text-center">
								{variables.length === 0
									? "No variables found for this instance."
									: "No variables match the filter."}
							</p>
						) : (
							filteredVars.map((v) => {
								const preview = formatValue(v.value).replace(/\s+/g, " ").trim()
								return (
									<button
										key={v.name}
										type="button"
										onClick={() => setModalVar(v)}
										className="w-full text-left px-3 py-2 border-b border-border/30 last:border-0 hover:bg-surface-2 transition-colors cursor-pointer group"
									>
										<div className="font-mono text-xs text-fg truncate">{v.name}</div>
										<div className="font-mono text-xs text-muted truncate mt-0.5 group-hover:text-fg/70 transition-colors">
											{preview || <span className="italic">null</span>}
										</div>
									</button>
								)
							})
						)}
					</div>
				</div>

				{!hideNavLink && (
					<Link href="/instances" className="text-xs text-accent hover:underline self-start">
						← All instances
					</Link>
				)}
			</div>
		</div>
	)
}

// ── Main component ────────────────────────────────────────────────────────────

export function InstanceDetail() {
	const { key } = useParams<{ key: string }>()
	const containerRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<OperateView | null>(null)
	const storeRef = useRef<InstancesStore | null>(null)
	const { theme } = useThemeStore()
	const [, setLocation] = useLocation()
	const { setBreadcrumbs } = useUiStore()
	const { data: instance } = useInstance(key)
	const isWasm = getActiveProfile() === "reebe-wasm"

	useEffect(() => {
		const name = instance?.processDefinitionId ?? key
		setBreadcrumbs([{ label: "Instances", href: "/instances" }, { label: name }])
	}, [key, instance?.processDefinitionId, setBreadcrumbs])

	// biome-ignore lint/correctness/useExhaustiveDependencies: view is created once per key; refs are stable
	useEffect(() => {
		if (isWasm) return
		const container = containerRef.current
		if (!container) return

		const proxyUrl = getProxyUrl()
		const profile = getActiveProfile()

		const store = new InstancesStore()
		storeRef.current = store
		store.connect(proxyUrl, profile, 5000, false)

		const view = createInstanceDetailView(
			key,
			store,
			{
				proxyUrl,
				profile,
				interval: 5000,
				mock: false,
				theme: useThemeStore.getState().theme,
				navigate: (path: string) => setLocation(path),
				onOpenInEditor: (_xml: string, name: string) => {
					const models = useModelsStore.getState().models
					const existing = models.find((m) => m.name === name)
					if (existing) setLocation(`/models/${existing.id}`)
				},
			},
			() => setLocation("/instances"),
		)

		container.appendChild(view.el)
		viewRef.current = view

		return () => {
			view.destroy()
			store.destroy()
			viewRef.current = null
			storeRef.current = null
		}
	}, [key, isWasm])

	useEffect(() => {
		viewRef.current?.setTheme(theme)
	}, [theme])

	if (isWasm) {
		return <WasmInstanceDetail instanceKey={key} />
	}

	return <div ref={containerRef} className="h-full" />
}
