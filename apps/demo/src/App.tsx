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

type Variant = "with-sdk" | "without-sdk"
type Mode = "checking" | "live" | "replay-only"

interface Prompts {
	withSdk: string
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

export function App() {
	const [mode, setMode] = useState<Mode>("checking")
	const [prompts, setPrompts] = useState<Prompts | null>(null)
	const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
	const [sources, setSources] = useState<Record<Variant, PanelSource | null>>({
		"with-sdk": null,
		"without-sdk": null,
	})
	const [runResults, setRunResults] = useState<Record<Variant, PanelRunResult | null>>({
		"with-sdk": null,
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
		if (selectedRecording) return selectedRecording.panels[variant].systemPrompt
		if (!prompts) return ""
		return variant === "with-sdk" ? prompts.withSdk : prompts.withoutSdk
	}

	function runLive() {
		setSelectedRecording(null)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new LiveSource(`/stream/with-sdk?scenario=${selectedScenarioId}`),
			"without-sdk": new LiveSource(`/stream/without-sdk?scenario=${selectedScenarioId}`),
		})
	}

	function replay(recording: Recording) {
		setSelectedRecording(recording)
		setRunResults({ "with-sdk": null, "without-sdk": null })
		setSources({
			"with-sdk": new ReplaySource(recording.panels["with-sdk"]),
			"without-sdk": new ReplaySource(recording.panels["without-sdk"]),
		})
	}

	const handleFinishWithSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "with-sdk": result }))
	}, [])

	const handleFinishWithoutSdk = useCallback((result: PanelRunResult) => {
		setRunResults((prev) => ({ ...prev, "without-sdk": result }))
	}, [])

	const withSdkRun = usePanelRun(sources["with-sdk"], handleFinishWithSdk)
	const withoutSdkRun = usePanelRun(sources["without-sdk"], handleFinishWithoutSdk)

	useEffect(() => {
		sources["with-sdk"]?.setSpeed?.(replaySpeed)
		sources["without-sdk"]?.setSpeed?.(replaySpeed)
	}, [replaySpeed, sources])

	const withSdkResult = runResults["with-sdk"]
	const withoutSdkResult = runResults["without-sdk"]

	const comparisonBanner =
		withSdkResult && withoutSdkResult
			? buildComparisonBanner(withSdkResult, withoutSdkResult)
			: null

	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withoutSdkResult
			? {
					scenarioId: activeScenarioId(),
					scenarioPrompt: activeScenarioPrompt(),
					panels: {
						"with-sdk": { systemPrompt: activeSystemPrompt("with-sdk"), ...withSdkResult },
						"without-sdk": {
							systemPrompt: activeSystemPrompt("without-sdk"),
							...withoutSdkResult,
						},
					},
				}
			: null

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
						withSdk={{
							elapsedMs: withSdkRun.elapsedMs,
							streaming: withSdkRun.streaming,
							text: withSdkRun.text,
							usage: withSdkRun.usage,
							finished: withSdkRun.bpmnXml !== null || withSdkRun.bpmnError !== null,
						}}
						withoutSdk={{
							elapsedMs: withoutSdkRun.elapsedMs,
							streaming: withoutSdkRun.streaming,
							text: withoutSdkRun.text,
							usage: withoutSdkRun.usage,
							finished: withoutSdkRun.bpmnXml !== null || withoutSdkRun.bpmnError !== null,
						}}
					/>
				) : (
					<>
						<div class="flex-1 overflow-hidden">
							<ComparePanel
								variant="with-sdk"
								text={withSdkRun.text}
								bpmnXml={withSdkRun.bpmnXml}
								bpmnError={withSdkRun.bpmnError}
								streaming={withSdkRun.streaming}
								elapsedMs={withSdkRun.elapsedMs}
								usage={withSdkRun.usage}
								onViewPrompt={() => setViewingPrompt("with-sdk")}
								promptAvailable={activeSystemPrompt("with-sdk") !== ""}
							/>
						</div>
						<div class="flex-1 overflow-hidden">
							<ComparePanel
								variant="without-sdk"
								text={withoutSdkRun.text}
								bpmnXml={withoutSdkRun.bpmnXml}
								bpmnError={withoutSdkRun.bpmnError}
								streaming={withoutSdkRun.streaming}
								elapsedMs={withoutSdkRun.elapsedMs}
								usage={withoutSdkRun.usage}
								onViewPrompt={() => setViewingPrompt("without-sdk")}
								promptAvailable={activeSystemPrompt("without-sdk") !== ""}
							/>
						</div>
					</>
				)}
			</main>

			{viewingPrompt && (
				<PromptModal
					open
					onClose={() => setViewingPrompt(null)}
					title={viewingPrompt === "with-sdk" ? "With SDK — Prompt" : "Without SDK — Prompt"}
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
