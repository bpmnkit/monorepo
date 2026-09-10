import {
	AlertCircle,
	Bot,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Code2,
	FileText,
	Loader2,
	RotateCcw,
	Terminal,
	Trash2,
} from "lucide-react"
import { useState } from "preact/hooks"
import { useEffect } from "preact/hooks"
import {
	useClearRunHistory,
	useRerunHistory,
	useRunHistory,
	useRunHistoryDetail,
} from "../api/queries.js"
import type { RunHistoryRun, RunHistoryStep } from "../api/types.js"
import { ErrorState } from "../components/ErrorState.js"
import { Button } from "../components/ui/button.js"
import { toast } from "../stores/toast.js"
import { useUiStore } from "../stores/ui.js"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(ms: number | null): string {
	if (ms === null) return "—"
	if (ms < 1000) return `${ms}ms`
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
	return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`
}

function formatTime(iso: string): string {
	const d = new Date(iso)
	return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function formatDate(iso: string): string {
	const d = new Date(iso)
	const today = new Date()
	if (d.toDateString() === today.toDateString()) return `Today ${formatTime(iso)}`
	return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${formatTime(iso)}`
}

function parseJson(s: string): unknown {
	try {
		return JSON.parse(s)
	} catch {
		return s
	}
}

function jobTypeLabel(jobType: string): string {
	const map: Record<string, string> = {
		"io.bpmnkit:llm:1": "LLM",
		"io.bpmnkit:cli:1": "CLI",
		"io.bpmnkit:fs:read:1": "FS Read",
		"io.bpmnkit:fs:write:1": "FS Write",
		"io.bpmnkit:fs:append:1": "FS Append",
		"io.bpmnkit:fs:list:1": "FS List",
		"io.bpmnkit:js:1": "JS",
	}
	return map[jobType] ?? jobType
}

function JobTypeIcon({ jobType }: { jobType: string }) {
	const cls = "shrink-0"
	if (jobType === "io.bpmnkit:llm:1") return <Bot size={14} className={cls} />
	if (jobType === "io.bpmnkit:cli:1") return <Terminal size={14} className={cls} />
	if (jobType.startsWith("io.bpmnkit:fs:")) return <FileText size={14} className={cls} />
	if (jobType === "io.bpmnkit:js:1") return <Code2 size={14} className={cls} />
	return <Clock size={14} className={cls} />
}

function StatePill({ state }: { state: string }) {
	const cls =
		state === "completed"
			? "bg-success/15 text-success"
			: state === "failed"
				? "bg-danger/15 text-danger"
				: "bg-warn/15 text-warn"
	return (
		<span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ${cls}`}>
			{state === "completed" ? (
				<CheckCircle2 size={10} />
			) : state === "failed" ? (
				<AlertCircle size={10} />
			) : (
				<Loader2 size={10} className="animate-spin" />
			)}
			{state}
		</span>
	)
}

// ── JSON display ──────────────────────────────────────────────────────────────

function JsonBlock({ data }: { data: unknown }) {
	const text = typeof data === "string" ? data : JSON.stringify(data, null, 2)

	if (!text || text === "{}" || text === "null")
		return <span className="text-muted text-xs">—</span>

	return (
		<pre className="text-xs font-mono bg-surface-2 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
			{text}
		</pre>
	)
}

// ── Step detail ───────────────────────────────────────────────────────────────

function StepCard({ step }: { step: RunHistoryStep }) {
	const [open, setOpen] = useState(step.state === "failed")
	const inputs = parseJson(step.inputs)
	const outputs = parseJson(step.outputs)
	const isLlm = step.jobType === "io.bpmnkit:llm:1"
	const isCli = step.jobType === "io.bpmnkit:cli:1"

	return (
		<div
			className={`rounded-lg border ${step.state === "failed" ? "border-danger/40 bg-danger/5" : "border-border bg-surface"}`}
		>
			{/* Header */}
			<button
				type="button"
				className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 rounded-lg"
				onClick={() => setOpen((v) => !v)}
				aria-expanded={open}
			>
				<JobTypeIcon jobType={step.jobType} />
				<span className="text-xs font-medium text-muted uppercase tracking-wide">
					{jobTypeLabel(step.jobType)}
				</span>
				<span className="flex-1 font-mono text-xs text-muted truncate">{step.elementId}</span>
				<StatePill state={step.state} />
				<span className="text-xs text-muted ml-1">{formatDuration(step.durationMs)}</span>
				{open ? (
					<ChevronDown size={14} className="text-muted" />
				) : (
					<ChevronRight size={14} className="text-muted" />
				)}
			</button>

			{/* Expanded body */}
			{open && (
				<div className="px-4 pb-4 space-y-3 border-t border-border">
					{/* Error */}
					{step.errorMessage && (
						<div className="mt-3 flex items-start gap-2 text-danger text-sm">
							<AlertCircle size={14} className="mt-0.5 shrink-0" />
							<span className="font-mono text-xs break-all">{step.errorMessage}</span>
						</div>
					)}

					{/* Timing */}
					<div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
						<div>
							<div className="font-medium text-fg/60 mb-0.5">Started</div>
							{formatTime(step.startedAt)}
						</div>
						{step.endedAt && (
							<div>
								<div className="font-medium text-fg/60 mb-0.5">Ended</div>
								{formatTime(step.endedAt)}
							</div>
						)}
						<div>
							<div className="font-medium text-fg/60 mb-0.5">Duration</div>
							{formatDuration(step.durationMs)}
						</div>
					</div>

					{/* LLM: show prompt + response prominently */}
					{isLlm && typeof inputs === "object" && inputs !== null && (
						<div className="space-y-2">
							{(inputs as Record<string, unknown>).prompt && (
								<div>
									<div className="text-xs font-medium text-muted mb-1">Prompt</div>
									<pre className="text-xs bg-surface-2 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
										{String((inputs as Record<string, unknown>).prompt)}
									</pre>
								</div>
							)}
							{(inputs as Record<string, unknown>).system && (
								<div>
									<div className="text-xs font-medium text-muted mb-1">System prompt</div>
									<pre className="text-xs bg-surface-2 rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
										{String((inputs as Record<string, unknown>).system)}
									</pre>
								</div>
							)}
							{typeof outputs === "object" && outputs !== null && (
								<div>
									<div className="text-xs font-medium text-accent mb-1">Response</div>
									<pre className="text-xs bg-accent/5 border border-accent/20 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
										{String(Object.values(outputs as Record<string, unknown>)[0] ?? "")}
									</pre>
								</div>
							)}
						</div>
					)}

					{/* CLI: show command + stdout/stderr */}
					{isCli && typeof inputs === "object" && inputs !== null && (
						<div className="space-y-2">
							<div>
								<div className="text-xs font-medium text-muted mb-1">Command</div>
								<pre className="text-xs font-mono bg-surface-2 rounded p-2 overflow-x-auto">
									{String((inputs as Record<string, unknown>).command ?? "")}
								</pre>
							</div>
							{typeof outputs === "object" && outputs !== null && (
								<div>
									<div className="text-xs font-medium text-muted mb-1">Output</div>
									{(outputs as Record<string, unknown>).stdout && (
										<pre className="text-xs font-mono bg-surface-2 rounded p-2 overflow-x-auto max-h-32 text-success/80 whitespace-pre-wrap">
											{String((outputs as Record<string, unknown>).stdout)}
										</pre>
									)}
									{(outputs as Record<string, unknown>).stderr && (
										<pre className="text-xs font-mono bg-danger/5 border border-danger/20 rounded p-2 overflow-x-auto max-h-32 text-danger/80 whitespace-pre-wrap">
											{String((outputs as Record<string, unknown>).stderr)}
										</pre>
									)}
								</div>
							)}
						</div>
					)}

					{/* Generic: inputs + outputs */}
					{!isLlm && !isCli && (
						<div className="grid grid-cols-2 gap-3">
							<div>
								<div className="text-xs font-medium text-muted mb-1">Inputs</div>
								<JsonBlock data={inputs} />
							</div>
							<div>
								<div className="text-xs font-medium text-muted mb-1">Outputs</div>
								<JsonBlock data={outputs} />
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

// ── Run detail panel ──────────────────────────────────────────────────────────

function RunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
	const { data, isLoading } = useRunHistoryDetail(runId)

	return (
		<div className="flex flex-col h-full overflow-hidden">
			<div className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
				<button
					type="button"
					onClick={onClose}
					className="text-muted hover:text-fg text-xs"
					aria-label="Close detail"
				>
					← Back
				</button>
				{data && (
					<>
						<span className="font-mono text-xs text-muted truncate flex-1">
							{data.processInstanceKey}
						</span>
						<StatePill state={data.state} />
					</>
				)}
			</div>

			<div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{isLoading && (
					<div className="flex items-center gap-2 text-muted text-sm">
						<Loader2 size={14} className="animate-spin" />
						Loading…
					</div>
				)}
				{data && (
					<>
						{/* Run metadata */}
						<div className="grid grid-cols-3 gap-3 text-xs text-muted bg-surface-2 rounded-lg p-3">
							<div>
								<div className="font-medium text-fg/60 mb-0.5">Started</div>
								{formatDate(data.startedAt)}
							</div>
							{data.endedAt && (
								<div>
									<div className="font-medium text-fg/60 mb-0.5">Ended</div>
									{formatDate(data.endedAt)}
								</div>
							)}
							<div>
								<div className="font-medium text-fg/60 mb-0.5">Steps</div>
								{data.steps?.length ?? 0}
								{(data.failedSteps ?? 0) > 0 && (
									<span className="ml-1 text-danger">({data.failedSteps} failed)</span>
								)}
							</div>
						</div>

						{/* Steps timeline */}
						{data.steps && data.steps.length > 0 ? (
							<div className="space-y-2">
								{data.steps.map((step) => (
									<StepCard key={step.id} step={step} />
								))}
							</div>
						) : (
							<p className="text-muted text-sm">No steps recorded yet.</p>
						)}
					</>
				)}
			</div>
		</div>
	)
}

// ── Re-run dialog ─────────────────────────────────────────────────────────────

function RerunDialog({
	run,
	onClose,
}: {
	run: RunHistoryRun
	onClose: () => void
}) {
	const [vars, setVars] = useState(() =>
		JSON.stringify(JSON.parse(run.variablesSnapshot ?? "{}"), null, 2),
	)
	const [parseError, setParseError] = useState<string | null>(null)
	const rerunMutation = useRerunHistory()

	async function handleConfirm() {
		let overrides: Record<string, unknown> = {}
		try {
			overrides = JSON.parse(vars) as Record<string, unknown>
			setParseError(null)
		} catch {
			setParseError("Invalid JSON")
			return
		}
		try {
			const result = await rerunMutation.mutateAsync({ id: run.id, variableOverrides: overrides })
			toast.success(`Re-run started: ${result.processInstanceKey}`)
			onClose()
		} catch {
			toast.error("Failed to start re-run")
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
			<div className="bg-surface rounded-xl border border-border shadow-lg w-full max-w-lg p-6 space-y-4">
				<h2 className="text-sm font-semibold">Re-run process</h2>
				<p className="text-xs text-muted">
					Edit variables below then confirm to start a new process instance.
				</p>
				<textarea
					className="w-full font-mono text-xs bg-surface-2 border border-border rounded-lg p-3 resize-y h-48 focus:outline-none focus:ring-1 focus:ring-accent"
					value={vars}
					onInput={(e) => setVars((e.target as HTMLTextAreaElement).value)}
					spellcheck={false}
				/>
				{parseError && <p className="text-xs text-danger">{parseError}</p>}
				<div className="flex justify-end gap-2">
					<Button variant="ghost" size="sm" onClick={onClose}>
						Cancel
					</Button>
					<Button size="sm" onClick={() => void handleConfirm()} disabled={rerunMutation.isPending}>
						{rerunMutation.isPending ? <Loader2 size={13} className="animate-spin mr-1" /> : null}
						Re-run
					</Button>
				</div>
			</div>
		</div>
	)
}

// ── Run list ──────────────────────────────────────────────────────────────────

function RunRow({
	run,
	active,
	onClick,
}: {
	run: RunHistoryRun
	active: boolean
	onClick: () => void
}) {
	const [showRerun, setShowRerun] = useState(false)

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				className={`flex w-full items-center gap-3 px-4 py-3 text-left border-b border-border/50 hover:bg-surface-2 transition-colors ${
					active ? "bg-accent/10" : ""
				}`}
			>
				<StatePill state={run.state} />
				<div className="flex-1 min-w-0">
					<div className="font-mono text-xs text-muted truncate">{run.processInstanceKey}</div>
					<div className="text-xs text-muted/60 mt-0.5">{formatDate(run.startedAt)}</div>
				</div>
				<div className="text-xs text-muted text-right shrink-0">
					<div>{run.stepCount ?? 0} steps</div>
					{(run.failedSteps ?? 0) > 0 && (
						<div className="text-danger">{run.failedSteps} failed</div>
					)}
				</div>
				{run.state === "failed" && (
					<button
						type="button"
						aria-label="Re-run"
						className="shrink-0 p-1 rounded hover:bg-accent/10 text-muted hover:text-accent transition-colors"
						onClick={(e) => {
							e.stopPropagation()
							setShowRerun(true)
						}}
					>
						<RotateCcw size={13} />
					</button>
				)}
				<ChevronRight size={14} className="text-muted shrink-0" />
			</button>
			{showRerun && <RerunDialog run={run} onClose={() => setShowRerun(false)} />}
		</>
	)
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function RunHistory() {
	const [selectedId, setSelectedId] = useState<string | null>(null)
	const { data, isLoading, isError } = useRunHistory()
	const clearMutation = useClearRunHistory()
	const { setBreadcrumbs } = useUiStore()

	useEffect(() => {
		setBreadcrumbs([{ label: "Run History" }])
	}, [setBreadcrumbs])

	async function handleClear() {
		if (!confirm("Clear all run history? This cannot be undone.")) return
		try {
			await clearMutation.mutateAsync()
			setSelectedId(null)
			toast.success("Run history cleared")
		} catch {
			toast.error("Failed to clear run history")
		}
	}

	if (isError) {
		return (
			<ErrorState
				title="Could not load run history"
				description="Unable to reach the proxy. Make sure the proxy is running."
				hint="pnpm proxy"
				settingsHint
			/>
		)
	}

	const runs = data?.items ?? []

	return (
		<div className="flex h-full overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* List panel */}
			<div
				className={`flex flex-col shrink-0 border-r border-border ${selectedId ? "w-80" : "flex-1"}`}
			>
				{/* Header */}
				<div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
					<div>
						<h1 className="text-sm font-semibold">Run History</h1>
						{!isLoading && (
							<p className="text-xs text-muted mt-0.5">
								{runs.length} run{runs.length !== 1 ? "s" : ""}
							</p>
						)}
					</div>
					{runs.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={() => void handleClear()}
							disabled={clearMutation.isPending}
							aria-label="Clear run history"
						>
							<Trash2 size={13} />
							{!selectedId && <span className="ml-1">Clear</span>}
						</Button>
					)}
				</div>

				{/* Runs */}
				<div className="flex-1 overflow-y-auto">
					{isLoading && (
						<div className="flex items-center gap-2 px-4 py-6 text-muted text-sm">
							<Loader2 size={14} className="animate-spin" />
							Loading…
						</div>
					)}
					{!isLoading && runs.length === 0 && (
						<div className="px-4 py-8 text-center text-muted text-sm">
							<Clock size={24} className="mx-auto mb-2 opacity-40" />
							<p>No runs yet.</p>
							<p className="text-xs mt-1">
								Deploy a process and run it — worker job executions will appear here.
							</p>
						</div>
					)}
					{runs.map((run) => (
						<RunRow
							key={run.id}
							run={run}
							active={run.id === selectedId}
							onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}
						/>
					))}
				</div>
			</div>

			{/* Detail panel */}
			{selectedId && (
				<div className="flex-1 overflow-hidden">
					<RunDetail runId={selectedId} onClose={() => setSelectedId(null)} />
				</div>
			)}
		</div>
	)
}
