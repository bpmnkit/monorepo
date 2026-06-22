import { BpmnCanvas } from "@bpmnkit/canvas"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { DataList } from "@cascivo/react"
import { useEffect, useRef, useState } from "preact/hooks"
import type { JSX } from "preact/jsx-runtime"
import { Link, useParams } from "wouter"
import { getProxyUrl } from "../api/client.js"
import {
	useDefinitionXml,
	useIncident,
	useInstanceVariables,
	useRetryIncident,
} from "../api/queries.js"
import { ErrorState } from "../components/ErrorState.js"
import { Button } from "../components/ui/button.js"
import { useModeStore } from "../stores/mode.js"
import { useThemeStore } from "../stores/theme.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

type SidebarTab = "error" | "variables" | "ai"

interface VariableItem {
	name: string
	value: unknown
}

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Variable detail modal ──────────────────────────────────────────────────────

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
				{/* Header */}
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

				{/* Search */}
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

				{/* Value */}
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

// ── Main component ─────────────────────────────────────────────────────────────

export function IncidentDetail() {
	const { key } = useParams<{ key: string }>()
	const { data: incident, isLoading, isError } = useIncident(key)
	const { data: xml } = useDefinitionXml(incident?.processDefinitionKey ?? "")
	const { data: variablesResult } = useInstanceVariables(incident?.processInstanceKey ?? "")
	const retryMutation = useRetryIncident()
	const canvasContainerRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<BpmnCanvas | null>(null)
	const tokenPluginRef = useRef<ReturnType<typeof createTokenHighlightPlugin> | null>(null)
	const { theme } = useThemeStore()
	const { mode } = useModeStore()
	const { setBreadcrumbs } = useUiStore()
	const [tab, setTab] = useState<SidebarTab>("error")
	const [varSearch, setVarSearch] = useState("")
	const [modalVar, setModalVar] = useState<VariableItem | null>(null)
	const [aiAnalysis, setAiAnalysis] = useState("")
	const [aiLoading, setAiLoading] = useState(false)

	// Resizable sidebar
	const [sidebarW, setSidebarW] = useState(320)
	const isDragging = useRef(false)
	const dragStartX = useRef(0)
	const dragStartW = useRef(0)

	useEffect(() => {
		function onMove(e: MouseEvent) {
			if (!isDragging.current) return
			const delta = dragStartX.current - e.clientX
			setSidebarW(Math.max(240, Math.min(600, dragStartW.current + delta)))
		}
		function onUp() {
			isDragging.current = false
			document.body.style.cursor = ""
			document.body.style.userSelect = ""
		}
		window.addEventListener("mousemove", onMove)
		window.addEventListener("mouseup", onUp)
		return () => {
			window.removeEventListener("mousemove", onMove)
			window.removeEventListener("mouseup", onUp)
		}
	}, [])

	function onDragHandleDown(e: MouseEvent) {
		isDragging.current = true
		dragStartX.current = e.clientX
		dragStartW.current = sidebarW
		document.body.style.cursor = "col-resize"
		document.body.style.userSelect = "none"
		e.preventDefault()
	}

	useEffect(() => {
		const name = incident?.processDefinitionId ?? key
		setBreadcrumbs([{ label: "Incidents", href: "/incidents" }, { label: name }])
	}, [key, incident?.processDefinitionId, setBreadcrumbs])

	useEffect(() => {
		const container = canvasContainerRef.current
		if (!container) return
		const tokenPlugin = createTokenHighlightPlugin()
		tokenPluginRef.current = tokenPlugin
		const canvas = new BpmnCanvas({
			container,
			theme: useThemeStore.getState().theme,
			grid: false,
			fit: "contain",
			plugins: [tokenPlugin],
		})
		canvasRef.current = canvas
		return () => {
			canvas.destroy()
			canvasRef.current = null
			tokenPluginRef.current = null
		}
	}, [])

	useEffect(() => {
		canvasRef.current?.setTheme(theme)
	}, [theme])

	useEffect(() => {
		if (xml && canvasRef.current) {
			canvasRef.current.load(xml)
			if (incident?.elementId && tokenPluginRef.current) {
				tokenPluginRef.current.api.setError(incident.elementId)
			}
		}
	}, [xml, incident?.elementId])

	async function handleRetry() {
		try {
			await retryMutation.mutateAsync(key)
			toast.success("Incident resolved — job will retry")
		} catch {
			toast.error("Failed to retry incident")
		}
	}

	async function analyzeIncident() {
		if (aiLoading) return
		setAiAnalysis("")
		setAiLoading(true)
		try {
			const response = await fetch(`${getProxyUrl()}/operate/incident-assist`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ incidentKey: key }),
			})
			if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

			const reader = response.body.getReader()
			const decoder = new TextDecoder()
			let accumulated = ""
			while (true) {
				const { done, value } = await reader.read()
				if (done) break
				const chunk = decoder.decode(value, { stream: true })
				for (const line of chunk.split("\n")) {
					if (!line.startsWith("data: ")) continue
					try {
						const parsed = JSON.parse(line.slice(6)) as
							| { type: "token"; text: string }
							| { type: "done" }
							| { type: "error"; message: string }
						if (parsed.type === "done") break
						if (parsed.type === "error") throw new Error(parsed.message)
						if (parsed.type === "token") {
							accumulated += parsed.text
							setAiAnalysis(accumulated)
						}
					} catch (e) {
						if (e instanceof SyntaxError) continue
						throw e
					}
				}
			}
		} catch (err) {
			setAiAnalysis(`Error: ${err instanceof Error ? err.message : String(err)}`)
		} finally {
			setAiLoading(false)
		}
	}

	if (isError) {
		return (
			<ErrorState
				title="Incident not found"
				description="This incident may have been resolved or the incident key is invalid. Check the incidents list for active incidents."
			/>
		)
	}

	const variables = variablesResult?.items ?? []
	const filteredVars = varSearch
		? variables.filter(
				(v) =>
					v.name.toLowerCase().includes(varSearch.toLowerCase()) ||
					String(v.value).toLowerCase().includes(varSearch.toLowerCase()),
			)
		: variables

	return (
		<div className="flex flex-col h-full">
			{modalVar && <VariableModal variable={modalVar} onClose={() => setModalVar(null)} />}

			<div className="flex flex-1 overflow-hidden">
				{/* Canvas */}
				<div ref={canvasContainerRef} className="flex-1 overflow-hidden bg-surface-2" />

				{/* Drag handle */}
				<div
					className="w-1 shrink-0 cursor-col-resize hover:bg-accent/40 transition-colors duration-150 bg-border"
					onMouseDown={onDragHandleDown}
					tabIndex={-1}
					role="separator"
					aria-orientation="vertical"
					aria-label="Resize sidebar"
				/>

				{/* Sidebar */}
				<div
					className="shrink-0 border-l border-border bg-surface flex flex-col overflow-hidden"
					style={{ width: sidebarW }}
				>
					{/* Tab bar */}
					<div className="flex border-b border-border shrink-0">
						<button
							type="button"
							onClick={() => setTab("error")}
							className={`flex-1 py-2 text-xs font-medium transition-colors ${
								tab === "error" ? "text-fg border-b-2 border-accent" : "text-muted hover:text-fg"
							}`}
						>
							Error
						</button>
						<button
							type="button"
							onClick={() => setTab("variables")}
							className={`flex-1 py-2 text-xs font-medium transition-colors ${
								tab === "variables"
									? "text-fg border-b-2 border-accent"
									: "text-muted hover:text-fg"
							}`}
						>
							Variables
							{variables.length > 0 && (
								<span className="ml-1.5 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">
									{variables.length}
								</span>
							)}
						</button>
						<button
							type="button"
							onClick={() => setTab("ai")}
							className={`flex-1 py-2 text-xs font-medium transition-colors ${
								tab === "ai" ? "text-fg border-b-2 border-accent" : "text-muted hover:text-fg"
							}`}
						>
							AI
						</button>
					</div>

					{/* Error tab */}
					{tab === "error" && (
						<div className="flex-1 overflow-y-auto p-4 space-y-4">
							<Button
								variant="outline"
								size="sm"
								onClick={() => void handleRetry()}
								disabled={retryMutation.isPending}
							>
								Retry
							</Button>
							{isLoading ? (
								<div className="space-y-2">
									{(["s0", "s1", "s2", "s3"] as const).map((sk) => (
										<div key={sk} className="h-4 animate-pulse rounded bg-surface-2" />
									))}
								</div>
							) : incident ? (
								<DataList
									orientation="vertical"
									items={[
										{
											id: "errorType",
											label: "Error Type",
											value: (
												<span className="font-mono text-danger text-sm">{incident.errorType}</span>
											),
										},
										{
											id: "message",
											label: "Message",
											value: (
												<span className="break-words text-fg text-sm">{incident.errorMessage}</span>
											),
										},
										...(mode === "developer"
											? [
													{
														id: "element",
														label: "Element",
														value: (
															<span className="font-mono text-muted text-sm">
																{incident.elementId}
															</span>
														),
													},
												]
											: []),
										{
											id: "links",
											label: "Links",
											value: (
												<div className="space-y-1">
													<Link
														href={`/instances/${incident.processInstanceKey}`}
														className="block text-accent text-sm hover:underline"
													>
														View instance →
													</Link>
													{incident.processDefinitionKey && (
														<Link
															href={`/definitions/${incident.processDefinitionKey}`}
															className="block text-accent text-sm hover:underline"
														>
															View definition →
														</Link>
													)}
												</div>
											),
										},
										...(incident.creationTime
											? [
													{
														id: "created",
														label: "Created",
														value: (
															<span className="text-muted text-sm">
																{new Date(incident.creationTime).toLocaleString()}
															</span>
														),
													},
												]
											: []),
									]}
								/>
							) : null}
						</div>
					)}

					{/* Variables tab */}
					{tab === "variables" && (
						<div className="flex-1 flex flex-col overflow-hidden">
							<div className="p-3 border-b border-border/60 shrink-0">
								<input
									type="text"
									value={varSearch}
									onInput={(e) => setVarSearch((e.target as HTMLInputElement).value)}
									placeholder="Filter by name or value…"
									className="w-full rounded border border-border bg-surface-2 px-2.5 py-1 text-xs text-fg placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
								/>
							</div>
							<div className="flex-1 overflow-y-auto">
								{filteredVars.length === 0 ? (
									<p className="p-4 text-xs text-muted text-center">
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
												className="w-full text-left px-3 py-2 border-b border-border/30 hover:bg-surface-2 transition-colors cursor-pointer group"
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
					)}

					{/* AI tab */}
					{tab === "ai" && (
						<div className="flex-1 flex flex-col overflow-hidden p-4 gap-3">
							<button
								type="button"
								onClick={() => void analyzeIncident()}
								disabled={aiLoading}
								className="w-full rounded border border-border bg-surface-2 px-3 py-2 text-xs text-fg hover:bg-accent/10 transition-colors disabled:opacity-50"
							>
								{aiLoading ? "Analyzing…" : aiAnalysis ? "Re-analyze" : "Analyze with AI"}
							</button>
							{aiAnalysis && (
								<pre className="flex-1 overflow-y-auto text-xs text-fg font-sans leading-relaxed whitespace-pre-wrap break-words">
									{aiAnalysis}
								</pre>
							)}
							{!aiAnalysis && !aiLoading && (
								<p className="text-xs text-muted text-center mt-4">
									AI will analyze the root cause, impact, and remediation steps.
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
