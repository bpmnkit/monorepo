import { Button, Select } from "@cascivo/react"
import { useCallback, useEffect, useState } from "preact/hooks"
import type { Recording } from "../shared/recording-types.js"
import { ComparePanel } from "./ComparePanel.js"
import { PromptModal } from "./PromptModal.js"
import { SaveRecordingModal } from "./SaveRecordingModal.js"
import { buildDurationBanner } from "./duration-banner.js"
import { recordings } from "./recordings.js"
import { LiveSource, ReplaySource } from "./sources.js"
import type { PanelRunResult, PanelSource } from "./sources.js"

type Variant = "with-sdk" | "without-sdk"
type Mode = "checking" | "live" | "replay-only"

interface Prompts {
	scenario: string
	withSdk: string
	withoutSdk: string
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

	useEffect(() => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), 1500)

		fetch("/health", { signal: controller.signal })
			.then((res) => {
				if (!res.ok) throw new Error("unhealthy")
				return fetch("/prompts").then((r) => r.json())
			})
			.then((data: Prompts) => {
				setPrompts(data)
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

	function activeScenarioPrompt(): string {
		if (selectedRecording) return selectedRecording.scenarioPrompt
		return prompts?.scenario ?? ""
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
			"with-sdk": new LiveSource("/stream/with-sdk"),
			"without-sdk": new LiveSource("/stream/without-sdk"),
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

	const withSdkResult = runResults["with-sdk"]
	const withoutSdkResult = runResults["without-sdk"]

	const durationBanner =
		withSdkResult && withoutSdkResult ? buildDurationBanner(withSdkResult, withoutSdkResult) : null

	const recordingData: Omit<Recording, "name" | "recordedAt"> | null =
		withSdkResult && withoutSdkResult
			? {
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
						/ AI comparison — Loan Approval Process
					</span>
				</div>
				<div class="flex items-center gap-2">
					{mode === "live" && (
						<Button variant="primary" onClick={runLive}>
							{sources["with-sdk"] ? "Run Again" : "Run Demo"}
						</Button>
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

			{durationBanner && (
				<div
					class="px-6 py-2 text-sm text-center"
					style="background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);"
				>
					{durationBanner}
				</div>
			)}

			<main class="flex-1 flex flex-col overflow-hidden">
				<div class="flex-1 overflow-hidden">
					<ComparePanel
						variant="with-sdk"
						source={sources["with-sdk"]}
						onFinish={handleFinishWithSdk}
						onViewPrompt={() => setViewingPrompt("with-sdk")}
						promptAvailable={activeSystemPrompt("with-sdk") !== ""}
					/>
				</div>
				<div class="flex-1 overflow-hidden">
					<ComparePanel
						variant="without-sdk"
						source={sources["without-sdk"]}
						onFinish={handleFinishWithoutSdk}
						onViewPrompt={() => setViewingPrompt("without-sdk")}
						promptAvailable={activeSystemPrompt("without-sdk") !== ""}
					/>
				</div>
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
					defaultName={`loan-approval-${new Date().toISOString().slice(0, 10)}`}
					recordingData={recordingData}
				/>
			)}
		</div>
	)
}
