import { Button, Select } from "@cascivo/react"
import { useCallback, useEffect, useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"
import { ComparePanel } from "./ComparePanel.js"
import { PromptModal } from "./PromptModal.js"
import { RaceChart } from "./RaceChart.js"
import { SaveRecordingModal } from "./SaveRecordingModal.js"
import { buildComparisonBanner } from "./comparison-banner.js"
import { recordings } from "./recordings.js"
import { LiveSource, ReplaySource } from "./sources.js"
import type { PanelRunResult, PanelSource } from "./sources.js"
import { usePanelRun } from "./use-panel-run.js"
import type { PanelRunState } from "./use-panel-run.js"

type Variant = "with-sdk" | "with-sdk-compact" | "without-sdk"
type Mode = "checking" | "live" | "replay-only"

interface Prompts {
	withSdk: string
	withSdkCompact: string
	withoutSdk: string
}

interface ScenarioInfo {
	id: string
	label: string
	prompt: string
}

// Keep ids and labels in sync with apps/demo/server/scenarios.ts.
// Duplicated (rather than fetched) so the header title and the live-mode
// picker both work without depending on network state.
const SCENARIO_OPTIONS: { id: string; label: string }[] = [
	{ id: "loan-approval", label: "Loan Approval" },
	{ id: "quote-to-cash", label: "Quote-to-Cash" },
	{ id: "kyc", label: "KYC" },
]

const DEFAULT_SCENARIO_ID = "loan-approval"

function scenarioLabel(id: string): string {
	return SCENARIO_OPTIONS.find((s) => s.id === id)?.label ?? SCENARIO_OPTIONS[0].label
}

const VARIANT_LABELS: Record<Variant, string> = {
	"with-sdk-compact": "With SDK (Compact)",
	"with-sdk": "With SDK",
	"without-sdk": "Without SDK",
}

const VARIANT_COLORS: Record<Variant, string> = {
	"with-sdk-compact": "--bpmnkit-warn",
	"with-sdk": "--bpmnkit-success",
	"without-sdk": "--bpmnkit-danger",
}

// Chart bars and detailed-view rows always render in this order, top to bottom.
const VARIANT_ORDER: Variant[] = ["with-sdk-compact", "with-sdk", "without-sdk"]

export function App() {
	const [mode, setMode] = useState<Mode>("checking")
	const [prompts, setPrompts] = useState<Prompts | null>(null)
	const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
	const [sources, setSources] = useState<Record<Variant, PanelSource | null>>({
		"with-sdk": null,
		"with-sdk-compact": null,
		"without-sdk": null,
	})
	const [runResults, setRunResults] = useState<Record<Variant, PanelRunResult | null>>({
		"with-sdk": null,
		"with-sdk-compact": null,
		"without-sdk": null,
	})
	const [viewingPrompt, setViewingPrompt] = useState<Variant | null>(null)
	const [savingRecording, setSavingRecording] = useState(false)
	const [selectedScenarioId, setSelectedScenarioId] = useState(DEFAULT_SCENARIO_ID)
	const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null)
	const [view, setView] = useState<"chart" | "detailed">("chart")
	const [replaySpeed, setReplaySpeed] = useState(1)

	useEffect(() => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 1500)

		fetch("/health", { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("unhealthy")
				return Promise.all([
					fetch("/prompts").then((r) => r.json()),
					fetch("/scenarios").then((r) => r.json()),
				])
			})
			.then(([promptsData, scenariosData]: [Prompts, ScenarioInfo[]]) => {
				setPrompts(promptsData)
				setScenarios(scenariosData)
				setMode("live")
			})
			.catch(() => {
				setMode("replay-only")
			})
			.finally(() => clearTimeout(timeout))

		return () => {
			clearTimeout(timeout)
			controller.abort()
		}
	}, [])

	// Published (replay-only) builds have no picker interaction by default —
	// auto-play the most recently recorded run so a cold visitor sees the demo
	// without hunting for the dropdown first. Runs once, when mode settles.
	useEffect(() => {
		if (mode !== "replay-only" || recordings.length === 0) return
		const mostRecent = recordings.reduce((latest, r) =>
			r.recordedAt > latest.recordedAt ? r : latest,
		)
		replay(mostRecent)
	}, [mode])

	function activeScenarioId(): string {
		if (selectedRecording) return selectedRecording.scenarioId ?? DEFAULT_SCENARIO_ID
		return selectedScenarioId
	}

	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return scenarios?.find((s) => s.id === selectedScenarioId)?.prompt ?? ""
	}

	function activeSystemPrompt(variant: Variant): string {
		if (selectedRecording) return selectedRecording.panels[variant]?.systemPrompt ?? ""
		if (!prompts) return ""
		if (variant === "with-sdk") return prompts.withSdk
		if (variant === "with-sdk-compact") return prompts.withSdkCompact
		return prompts.withoutSdk
	}

	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "with-sdk-compact": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource(`/stream/with-sdk?scenario=${selectedScenarioId}`),
			"with-sdk-compact": new LiveSource(`/stream/with-sdk-compact?scenario=${selectedScenarioId}`),
			"without-sdk": new LiveSource(`/stream/without-sdk?scenario=${selectedScenarioId}`),
		})
	}

	function replay(recording: Recording) {
		setSelectedRecording(recording)
		setRunResults({ "with-sdk": null, "with-sdk-compact": null, "without-sdk": null })
		const compactPanel = recording.panels["with-sdk-compact"]
		setSources({
			"with-sdk": new ReplaySource(recording.panels["with-sdk"]),
			"with-sdk-compact": compactPanel ? new ReplaySource(compactPanel) : null,
			"without-sdk": new ReplaySource(recording.panels["without-sdk"]),
		})
	}

	const handleFinishWithSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk": result }))
	}, [])

	const handleFinishWithSdkCompact = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk-compact": result }))
	}, [])

	const handleFinishWithoutSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "without-sdk": result }))
	}, [])

	const withSdkRun = usePanelRun(sources["with-sdk"], handleFinishWithSdk)
	const withSdkCompactRun = usePanelRun(sources["with-sdk-compact"], handleFinishWithSdkCompact)
	const withoutSdkRun = usePanelRun(sources["without-sdk"], handleFinishWithoutSdk)

	useEffect(() => {
		sources["with-sdk"]?.setSpeed?.(replaySpeed)
		sources["with-sdk-compact"]?.setSpeed?.(replaySpeed)
		sources["without-sdk"]?.setSpeed?.(replaySpeed)
	}, [replaySpeed, sources])

	const withSdkResult = runResults["with-sdk"]
	const withSdkCompactResult = runResults["with-sdk-compact"]
	const withoutSdkResult = runResults["without-sdk"]

	const comparisonBanner =
		withSdkResult && withoutSdkResult
			? buildComparisonBanner(withSdkResult, withoutSdkResult)
			: null

	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withSdkCompactResult && withoutSdkResult
			? {
					scenarioId: activeScenarioId(),
					scenarioPrompt: activeScenarioPrompt(),
					panels: {
						"with-sdk": { systemPrompt: activeSystemPrompt("with-sdk"), ...withSdkResult },
						"with-sdk-compact": {
							systemPrompt: activeSystemPrompt("with-sdk-compact"),
							...withSdkCompactResult,
						},
						"without-sdk": {
							systemPrompt: activeSystemPrompt("without-sdk"),
							...withoutSdkResult,
						},
					},
				}
			: null

	const runByVariant: Record<Variant, PanelRunState> = {
		"with-sdk": withSdkRun,
		"with-sdk-compact": withSdkCompactRun,
		"without-sdk": withoutSdkRun,
	}

	return (
		<div class="flex flex-col h-full">
			<header
				class="flex items-center justify-between px-6 py-3 shrink-0"
				style="border-bottom: 1px solid var(--bpmnkit-border, #2a2a42); background: var(--bpmnkit-surface, #161626);"
			>
				<div class="flex items-center gap-3">
					<span class="font-bold text-lg" style="color: var(--bpmnkit-fg, #cdd6f4);">
						bpmnkit
					</span>
					<span class="text-sm" style="color: var(--bpmnkit-fg-muted, #8888a8);">
						/ AI comparison — {scenarioLabel(activeScenarioId())} Process
					</span>
				</div>
				<div class="flex items-center gap-2">
					{mode === "live" && (
						<Select
							options={SCENARIO_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
							value={selectedScenarioId}
							onChange={(e) => setSelectedScenarioId((e.target as HTMLSelectElement).value)}
						/>
					)}
					{mode === "live" && (
						<Button variant="primary" onClick={runLive}>
							{sources["with-sdk"] ? "Run Again" : "Run Demo"}
						</Button>
					)}
					<Button variant="ghost" onClick={() => setView(view === "chart" ? "detailed" : "chart")}>
						{view === "chart" ? "Detailed View" : "Chart View"}
					</Button>
					{selectedRecording && (
						<Select
							options={[
								{ value: "1", label: "1x" },
								{ value: "2", label: "2x" },
								{ value: "5", label: "5x" },
								{ value: "10", label: "10x" },
							]}
							value={String(replaySpeed)}
							onChange={(e) => setReplaySpeed(Number((e.target as HTMLSelectElement).value))}
						/>
					)}
					{recordings.length > 0 && (
						<Select
							placeholder="Load a recording…"
							options={recordings.map((r) => ({ value: r.name, label: r.name }))}
							value={selectedRecording?.name ?? ""}
							onChange={(e) => {
								const target = e.target as HTMLSelectElement
								const rec = recordings.find((r) => r.name === target.value)
								if (rec) replay(rec)
							}}
						/>
					)}
					{mode === "live" && recordingData && (
						<Button variant="secondary" onClick={() => setSavingRecording(true)}>
							Save Recording
						</Button>
					)}
				</div>
			</header>

			{comparisonBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{comparisonBanner}
				</div>
			)}

			<main class="flex-1 flex flex-col overflow-hidden">
				{view === "chart" ? (
					<RaceChart
						rows={VARIANT_ORDER.map((variant) => ({
							id: variant,
							label: VARIANT_LABELS[variant],
							colorVar: VARIANT_COLORS[variant],
							data: {
								elapsedMs: runByVariant[variant].elapsedMs,
								streaming: runByVariant[variant].streaming,
								text: runByVariant[variant].text,
								usage: runByVariant[variant].usage,
								finished:
									runByVariant[variant].bpmnXml !== null ||
									runByVariant[variant].bpmnError !== null,
							},
						}))}
					/>
				) : (
					<>
						{VARIANT_ORDER.map((variant) => (
							<div key={variant} class="flex-1 overflow-hidden">
								<ComparePanel
									variant={variant}
									text={runByVariant[variant].text}
									bpmnXml={runByVariant[variant].bpmnXml}
									bpmnError={runByVariant[variant].bpmnError}
									streaming={runByVariant[variant].streaming}
									elapsedMs={runByVariant[variant].elapsedMs}
									usage={runByVariant[variant].usage}
									onViewPrompt={() => setViewingPrompt(variant)}
									promptAvailable={activeSystemPrompt(variant) !== ""}
								/>
							</div>
						))}
					</>
				)}
			</main>

			{viewingPrompt && (
				<PromptModal
					open
					onClose={() => setViewingPrompt(null)}
					title={`${VARIANT_LABELS[viewingPrompt]} — Prompt`}
					scenarioPrompt={activeScenarioPrompt()}
					systemPrompt={activeSystemPrompt(viewingPrompt)}
				/>
			)}

			{savingRecording && recordingData && (
				<SaveRecordingModal
					open
					onClose={() => setSavingRecording(false)}
					defaultName={`${activeScenarioId()}-${new Date().toISOString().slice(0, 10)}`}
					recordingData={recordingData}
				/>
			)}
		</div>
	)
}
