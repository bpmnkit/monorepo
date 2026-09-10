import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDiffResult } from "@bpmnkit/core"
import { createBpmnDiff } from "@bpmnkit/plugins/diff"
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls"
import { ArrowLeftRight, GitCompare } from "lucide-react"
import { useEffect, useRef, useState } from "preact/hooks"
import { useSearch } from "wouter"
import { useModelsStore } from "../stores/models.js"
import { useThemeStore } from "../stores/theme.js"

/** One badge per category, in the order the legend uses. */
const CATEGORY_STYLES: ReadonlyArray<{ key: keyof BpmnDiffResult; label: string; color: string }> =
	[
		{ key: "added", label: "added", color: "var(--bpmnkit-success, #16a34a)" },
		{ key: "removed", label: "removed", color: "var(--bpmnkit-danger, #dc2626)" },
		{ key: "changed", label: "changed", color: "var(--bpmnkit-warn, #d97706)" },
		{ key: "moved", label: "moved", color: "var(--bpmnkit-accent, #1a56db)" },
	]

export function ModelDiff() {
	const { models, loaded, loadModels, loadModel } = useModelsStore()
	const { theme } = useThemeStore()
	const search = useSearch()

	const [beforeId, setBeforeId] = useState<string | null>(null)
	const [afterId, setAfterId] = useState<string | null>(null)
	const [beforeXml, setBeforeXml] = useState<string | null>(null)
	const [afterXml, setAfterXml] = useState<string | null>(null)
	const [result, setResult] = useState<BpmnDiffResult | null>(null)
	const [error, setError] = useState<string | null>(null)

	const beforeRef = useRef<HTMLDivElement>(null)
	const afterRef = useRef<HTMLDivElement>(null)

	const bpmnModels = models.filter((m) => m.type === "bpmn")

	useEffect(() => {
		if (!loaded) void loadModels()
	}, [loaded, loadModels])

	// Seed the two sides from the query string, so a link can point straight at a
	// comparison. Falls back to the two most recently updated models.
	useEffect(() => {
		if (!loaded || bpmnModels.length === 0) return
		if (beforeId !== null || afterId !== null) return

		const params = new URLSearchParams(search)
		const recent = [...bpmnModels].sort((a, b) => b.updatedAt - a.updatedAt)
		setBeforeId(params.get("before") ?? recent[1]?.id ?? recent[0]?.id ?? null)
		setAfterId(params.get("after") ?? recent[0]?.id ?? null)
	}, [loaded, bpmnModels, search, beforeId, afterId])

	// `listModels()` need not carry file contents in FS mode, so read each side.
	useEffect(() => {
		let cancelled = false
		if (beforeId === null) return
		void loadModel(beforeId).then((m) => {
			if (!cancelled) setBeforeXml(m?.content ?? null)
		})
		return () => {
			cancelled = true
		}
	}, [beforeId, loadModel])

	useEffect(() => {
		let cancelled = false
		if (afterId === null) return
		void loadModel(afterId).then((m) => {
			if (!cancelled) setAfterXml(m?.content ?? null)
		})
		return () => {
			cancelled = true
		}
	}, [afterId, loadModel])

	// Both canvases are rebuilt together: the diff pair holds the state that ties
	// them, so one cannot outlive the other.
	useEffect(() => {
		const beforeEl = beforeRef.current
		const afterEl = afterRef.current
		if (!beforeEl || !afterEl || beforeXml === null || afterXml === null) return

		setError(null)
		const diff = createBpmnDiff({ onDiff: setResult })
		let left: BpmnCanvas | null = null
		let right: BpmnCanvas | null = null

		try {
			left = new BpmnCanvas({
				container: beforeEl,
				xml: beforeXml,
				theme,
				plugins: [diff.before, createZoomControlsPlugin()],
			})
			right = new BpmnCanvas({
				container: afterEl,
				xml: afterXml,
				theme,
				plugins: [diff.after, createZoomControlsPlugin()],
			})
		} catch (err) {
			setError(err instanceof Error ? err.message : String(err))
		}

		return () => {
			left?.destroy()
			right?.destroy()
			setResult(null)
		}
	}, [beforeXml, afterXml, theme])

	function swap(): void {
		setBeforeId(afterId)
		setAfterId(beforeId)
		setBeforeXml(afterXml)
		setAfterXml(beforeXml)
	}

	if (loaded && bpmnModels.length < 2) {
		return (
			<div className="h-full flex items-center justify-center">
				<p className="text-sm text-muted">
					Two BPMN models are needed to compare. This workspace has {bpmnModels.length}.
				</p>
			</div>
		)
	}

	return (
		<div className="h-full flex flex-col">
			<div className="flex items-center gap-3 border-b border-border px-5 py-3">
				<GitCompare size={16} className="text-muted" />
				<select
					aria-label="Earlier version"
					className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
					value={beforeId ?? ""}
					onChange={(e) => setBeforeId((e.target as HTMLSelectElement).value)}
				>
					{bpmnModels.map((m) => (
						<option key={m.id} value={m.id}>
							{m.name}
						</option>
					))}
				</select>

				<button
					type="button"
					onClick={swap}
					aria-label="Swap sides"
					title="Swap sides"
					className="rounded-md border border-border p-1 text-muted hover:text-fg"
				>
					<ArrowLeftRight size={14} />
				</button>

				<select
					aria-label="Later version"
					className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg"
					value={afterId ?? ""}
					onChange={(e) => setAfterId((e.target as HTMLSelectElement).value)}
				>
					{bpmnModels.map((m) => (
						<option key={m.id} value={m.id}>
							{m.name}
						</option>
					))}
				</select>

				<div className="ml-auto flex items-center gap-3 text-xs">
					{result === null ? null : result.total === 0 ? (
						<span className="text-muted">No differences</span>
					) : (
						CATEGORY_STYLES.filter((c) => (result[c.key] as readonly string[]).length > 0).map(
							(c) => (
								<span key={c.label} className="flex items-center gap-1.5 text-fg">
									<span
										className="inline-block h-2.5 w-2.5 rounded-sm"
										style={{ background: c.color }}
									/>
									{(result[c.key] as readonly string[]).length} {c.label}
								</span>
							),
						)
					)}
				</div>
			</div>

			{error === null ? null : (
				<div className="border-b border-border px-5 py-2 text-xs text-danger">{error}</div>
			)}

			<div className="flex-1 flex min-h-0">
				<div ref={beforeRef} className="flex-1 relative border-r border-border bg-surface-2" />
				<div ref={afterRef} className="flex-1 relative bg-surface-2" />
			</div>
		</div>
	)
}
