import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { findValidationStructure, getValidationInputNames } from "@bpmnkit/core"
import { injectProcessRunnerStyles } from "./css.js"

// ── Structural types — no hard deps on engine packages ─────────────────────

/** Minimal interface satisfied by `ProcessInstance` from `@bpmnkit/engine`. */
interface InstanceLike {
	get state(): string
	onChange(callback: (event: Record<string, unknown>) => void): () => void
	cancel(): void
	beforeComplete?: (elementId: string) => Promise<void>
}

/** Minimal interface satisfied by `Engine` from `@bpmnkit/engine`. */
interface EngineLike {
	deploy(d: { bpmn?: unknown }): void
	start(
		processId: string,
		variables?: Record<string, unknown>,
		options?: { beforeComplete?: (elementId: string) => Promise<void> },
	): InstanceLike
	getDeployedProcesses(): string[]
}

/** Minimal interface satisfied by the token-highlight plugin. */
interface TokenHighlightLike {
	api: {
		trackInstance(instance: {
			onChange(callback: (event: Record<string, unknown>) => void): () => void
		}): () => void
		clear(): void
		setError(elementId: string): void
	}
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Minimal scenario interface — avoids hard dep on @bpmnkit/engine. */
export interface ScenarioLike {
	id: string
	name: string
	processId?: string
	inputs?: Record<string, unknown>
	mocks?: Record<string, { outputs?: Record<string, unknown>; error?: string }>
	expect?: {
		path?: string[]
		variables?: Record<string, unknown>
	}
}

export interface ScenarioResultLike {
	scenarioId: string
	scenarioName: string
	passed: boolean
	visitedElements: string[]
	finalVariables: Record<string, unknown>
	feelEvals: Array<{ elementId: string; property: string; expression: string; result: unknown }>
	errors: Array<{ elementId?: string; message: string }>
	failures: Array<{ field: string; expected: unknown; actual: unknown }>
	durationMs: number
}

export interface ProcessRunnerOptions {
	/** The engine instance used to deploy and execute processes. */
	engine: EngineLike
	/**
	 * Optional token-highlight plugin. When provided, the executed process will
	 * be highlighted in real-time as the instance runs.
	 */
	tokenHighlight?: TokenHighlightLike
	/** Container element for the play panel (e.g. dock.playPane). */
	playContainer?: HTMLElement
	/** Called when play mode is entered — use to show the Play tab in the dock. */
	onShowPlayTab?: () => void
	/** Called when play mode is exited — use to hide the Play tab in the dock. */
	onHidePlayTab?: () => void
	/** Called when the user enters play mode by clicking the Play trigger button. */
	onEnterPlayMode?: () => void
	/** Called when the user exits play mode by clicking the Exit button. */
	onExitPlayMode?: () => void
	/** Returns the current project ID, used to scope input variable persistence. */
	getProjectId?: () => string | null
	/**
	 * Optional scenario runner callback. When provided, the Tests tab is active.
	 * Inject `runScenario` from `@bpmnkit/engine` here to avoid a hard dep.
	 */
	runScenario?: (scenario: ScenarioLike) => Promise<ScenarioResultLike>
	/**
	 * Container element for the tests panel (e.g. dock.testsPane).
	 * When provided, the Tests UI is mounted here instead of as a sub-tab
	 * inside the play panel.
	 */
	testsContainer?: HTMLElement
	/**
	 * Called on diagram load to check for a companion .bpmn.tests.json sidecar.
	 * Return parsed scenarios, or null if no sidecar exists.
	 */
	loadSidecarScenarios?: () => Promise<ScenarioLike[] | null>
	/**
	 * Optional AI scenario generator. When provided, a "Generate" button appears
	 * in the Tests tab. Should return draft scenarios to add to the list.
	 */
	generateScenarios?: () => Promise<ScenarioLike[]>
	/**
	 * Returns the Zeebe job type string for a given element ID.
	 * Used to map chaos injections to scenario mocks for export.
	 */
	getJobType?: (elementId: string) => string | null
	/**
	 * Returns the current BPMN definitions. When provided, the Tests editor
	 * auto-populates task mocks from the diagram.
	 */
	getDefinitions?: () => {
		processes: Array<{
			flowElements: Array<{ id: string; name?: string; type: string; decisionId?: string }>
		}>
	} | null
	/**
	 * Returns the DMN XML for a given decision ID, or null if not found.
	 * Used to display expected variable hints in the input variables pane.
	 * Typically: `(id) => models.find(m => m.type === "dmn" && m.content.includes(id))?.content ?? null`
	 */
	getValidationDmn?: (decisionId: string) => string | null
	/**
	 * When provided, called instead of the internal IndexedDB to persist scenarios.
	 * Use this to save scenarios to the file system (FS mode).
	 */
	onSaveScenarios?: (scenarios: ScenarioLike[]) => Promise<void>
	/**
	 * When provided, called instead of the internal IndexedDB to load scenarios.
	 * Use this to load scenarios from the file system (FS mode).
	 */
	onLoadScenarios?: () => Promise<ScenarioLike[]>
	/**
	 * When provided, called instead of the internal IndexedDB to persist input variables.
	 */
	onSaveInputVars?: (vars: Array<{ name: string; value: string }>) => Promise<void>
	/**
	 * When provided, called instead of the internal IndexedDB to load input variables.
	 */
	onLoadInputVars?: () => Promise<Array<{ name: string; value: string }>>
}

// ── IndexedDB persistence for input variables ───────────────────────────────

function openRunnerDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open("bpmnkit-process-runner-v1", 2)
		req.onupgradeneeded = (e) => {
			const db = req.result
			if (!db.objectStoreNames.contains("data")) {
				db.createObjectStore("data")
			}
			// Version 2: add scenarios store keyed by projectId
			if (e.oldVersion < 2 && !db.objectStoreNames.contains("scenarios")) {
				db.createObjectStore("scenarios")
			}
		}
		req.onsuccess = () => resolve(req.result)
		req.onerror = () => reject(req.error)
	})
}

function inputVarsKey(projectId: string | null): string {
	return projectId !== null ? `input-vars:${projectId}` : "input-vars"
}

async function loadInputVars(
	projectId: string | null,
): Promise<Array<{ name: string; value: string }>> {
	try {
		const db = await openRunnerDb()
		return new Promise((resolve) => {
			const req = db
				.transaction("data", "readonly")
				.objectStore("data")
				.get(inputVarsKey(projectId))
			req.onsuccess = () => {
				const raw = req.result
				resolve(Array.isArray(raw) ? (raw as Array<{ name: string; value: string }>) : [])
			}
			req.onerror = () => resolve([])
		})
	} catch {
		return []
	}
}

async function saveInputVars(
	projectId: string | null,
	vars: Array<{ name: string; value: string }>,
): Promise<void> {
	try {
		const db = await openRunnerDb()
		await new Promise<void>((resolve) => {
			const tx = db.transaction("data", "readwrite")
			tx.objectStore("data").put(vars, inputVarsKey(projectId))
			tx.oncomplete = () => resolve()
			tx.onerror = () => resolve()
		})
	} catch {
		// ignore — IndexedDB unavailable
	}
}

function scenariosKey(projectId: string | null): string {
	return projectId !== null ? `scenarios:${projectId}` : "scenarios"
}

async function loadScenarios(projectId: string | null): Promise<ScenarioLike[]> {
	try {
		const db = await openRunnerDb()
		return new Promise((resolve) => {
			const req = db
				.transaction("scenarios", "readonly")
				.objectStore("scenarios")
				.get(scenariosKey(projectId))
			req.onsuccess = () => {
				const raw = req.result
				resolve(Array.isArray(raw) ? (raw as ScenarioLike[]) : [])
			}
			req.onerror = () => resolve([])
		})
	} catch {
		return []
	}
}

async function saveScenarios(projectId: string | null, scenarios: ScenarioLike[]): Promise<void> {
	try {
		const db = await openRunnerDb()
		await new Promise<void>((resolve) => {
			const tx = db.transaction("scenarios", "readwrite")
			tx.objectStore("scenarios").put(scenarios, scenariosKey(projectId))
			tx.oncomplete = () => resolve()
			tx.onerror = () => resolve()
		})
	} catch {
		// ignore
	}
}

// ── Internal state ──────────────────────────────────────────────────────────

const AUTO_PLAY_DELAY_MS = 600
/** Default probability (0–1) that a service task is chaos-injected. */
const CHAOS_FAILURE_PROBABILITY = 0.2

type RunMode = "idle" | "running-auto" | "running-step"

// ── Chaos helpers ───────────────────────────────────────────────────────────

/** Element types that are eligible for chaos injection (worker tasks). */
const CHAOS_ELIGIBLE_TYPES = new Set(["serviceTask", "sendTask", "businessRuleTask", "scriptTask"])

interface ChaosInjection {
	elementId: string
	type: "service-failure" | "null-response" | "random-delay"
}

function buildChaosSchedule(
	elementIds: string[],
	probability: number,
): Map<string, ChaosInjection> {
	const schedule = new Map<string, ChaosInjection>()
	const types: Array<ChaosInjection["type"]> = ["service-failure", "null-response", "random-delay"]
	for (const id of elementIds) {
		if (Math.random() < probability) {
			const injType = types[Math.floor(Math.random() * types.length)]
			if (injType !== undefined) {
				schedule.set(id, { elementId: id, type: injType })
			}
		}
	}
	return schedule
}

// ── Plugin factory ──────────────────────────────────────────────────────────

const PLAY_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5l10 5.5-10 5.5V2.5z"/></svg>'

export function createProcessRunnerPlugin(
	options: ProcessRunnerOptions,
): CanvasPlugin & { toolbar: HTMLDivElement; playButton: HTMLButtonElement; exitPlayMode(): void } {
	const { engine } = options

	let canvasApi: CanvasApi | null = null
	let currentInstance: InstanceLike | null = null
	let stopTrackHighlight: (() => void) | undefined
	let mode: RunMode = "idle"
	let playModeActive = false
	/** The process ID of the currently displayed diagram. */
	let currentProcessId: string | undefined
	/** The project ID used to scope input variable persistence. */
	let currentProjectId: string | null = null

	// Wrappers that prefer the caller-provided callbacks over internal IndexedDB.
	async function persistScenarios(scenarios: ScenarioLike[]): Promise<void> {
		if (options.onSaveScenarios) return options.onSaveScenarios(scenarios)
		return saveScenarios(currentProjectId, scenarios)
	}
	async function fetchScenarios(): Promise<ScenarioLike[]> {
		if (options.onLoadScenarios) return options.onLoadScenarios()
		return loadScenarios(currentProjectId)
	}
	async function persistInputVars(vars: Array<{ name: string; value: string }>): Promise<void> {
		if (options.onSaveInputVars) return options.onSaveInputVars(vars)
		return saveInputVars(currentProjectId, vars)
	}
	async function fetchInputVars(): Promise<Array<{ name: string; value: string }>> {
		if (options.onLoadInputVars) return options.onLoadInputVars()
		return loadInputVars(currentProjectId)
	}

	/** Pending step resolvers — each represents a paused beforeComplete call. */
	const stepQueue: Array<() => void> = []

	/** Accumulated FEEL expression evaluations for the current run. */
	const feelEvals: Array<{
		elementId: string
		property: string
		expression: string
		result: unknown
	}> = []

	/** Current variable state, updated from variable:set events. */
	const variables = new Map<string, unknown>()

	/** Errors emitted during the current run. */
	const errors: Array<{ elementId?: string; message: string }> = []

	// ── Time-travel debugger state ──────────────────────────────────────────

	const MAX_EVENT_LOG = 10_000
	/** Full ordered event log for the current run. */
	const eventLog: Array<Record<string, unknown>> = []
	/** null = live (tail of log); number = scrubbed to that index. */
	let scrubIndex: number | null = null

	/** Whether chaos mode is enabled. */
	let chaosEnabled = false

	/** Active chaos schedule for the current run. */
	let chaosSchedule = new Map<string, ChaosInjection>()
	/** Injections that triggered during the last chaos run (cleared on new run). */
	const lastChaosInjections: ChaosInjection[] = []
	/** True = last chaos run completed; false = failed/stuck; null = no chaos run yet. */
	let lastChaosRunCompleted: boolean | null = null

	/** Input variables configured by the user (persisted in IndexedDB). */
	const inputVars: Array<{ name: string; value: string }> = []

	/** Which scenario is open in the editor (null = list view). */
	let editingScenarioId: string | null = null
	/** Element ID last clicked in the canvas while editing a scenario. */
	let focusedElementId: string | null = null

	const MOCKABLE_TASK_TYPES = new Set(["serviceTask", "sendTask", "businessRuleTask", "userTask"])

	const toolbarEl = document.createElement("div")
	toolbarEl.className = "bpmnkit-runner-toolbar"

	/** Entry button placed in the HUD action bar (styled by initEditorHud). */
	const playButtonEl = document.createElement("button")
	playButtonEl.title = "Play mode"
	playButtonEl.innerHTML = PLAY_ICON

	const unsubs: Array<() => void> = []

	// ── Play panel DOM ──────────────────────────────────────────────────────

	const playPanelEl = document.createElement("div")
	playPanelEl.className = "bpmnkit-runner-play-panel"

	const playTabBarEl = document.createElement("div")
	playTabBarEl.className = "bpmnkit-runner-play-tabs"

	function makeTabBtn(label: string, active: boolean): HTMLButtonElement {
		const b = document.createElement("button")
		b.className = active
			? "bpmnkit-runner-play-tab bpmnkit-runner-play-tab--active"
			: "bpmnkit-runner-play-tab"
		b.textContent = label
		return b
	}

	const varTabBtn = makeTabBtn("Variables", true)
	const feelTabBtn = makeTabBtn("FEEL", false)
	const errorsTabBtn = makeTabBtn("Errors", false)
	const inputTabBtn = makeTabBtn("Input", false)
	// Tests sub-tab only shown when there is no dedicated testsContainer *and*
	// the host can actually run a scenario. Without a runner the tab opened onto
	// an instruction addressed to whoever wrote the host, which is not something
	// a user of that host should ever be shown.
	const testsTabBtn =
		options.testsContainer === undefined && options.runScenario !== undefined
			? makeTabBtn("Tests", false)
			: null

	playTabBarEl.appendChild(varTabBtn)
	playTabBarEl.appendChild(feelTabBtn)
	playTabBarEl.appendChild(errorsTabBtn)
	playTabBarEl.appendChild(inputTabBtn)
	if (testsTabBtn !== null) playTabBarEl.appendChild(testsTabBtn)

	function makePaneEl(hidden: boolean): HTMLDivElement {
		const d = document.createElement("div")
		d.className = hidden
			? "bpmnkit-runner-play-pane bpmnkit-runner-play-pane--hidden"
			: "bpmnkit-runner-play-pane"
		return d
	}

	const varsPaneEl = makePaneEl(false)
	const feelPaneEl = makePaneEl(true)
	const errorsPaneEl = makePaneEl(true)
	const ivarsPaneEl = makePaneEl(true)
	const testsPaneEl = makePaneEl(true)

	// ── Timeline scrubber ───────────────────────────────────────────────────

	const scrubberRowEl = document.createElement("div")
	scrubberRowEl.className = "bpmnkit-runner-scrubber-row"
	scrubberRowEl.style.display = "none"

	const scrubberEl = document.createElement("input")
	scrubberEl.type = "range"
	scrubberEl.className = "bpmnkit-runner-scrubber"
	scrubberEl.min = "0"
	scrubberEl.max = "0"
	scrubberEl.value = "0"

	const scrubberLiveBtn = document.createElement("button")
	scrubberLiveBtn.className = "bpmnkit-runner-scrubber-live"
	scrubberLiveBtn.textContent = "Live"

	const scrubberReplayBtn = document.createElement("button")
	scrubberReplayBtn.className = "bpmnkit-runner-scrubber-replay"
	scrubberReplayBtn.textContent = "Replay from here"
	scrubberReplayBtn.style.display = "none"

	const scrubberIndexEl = document.createElement("span")
	scrubberIndexEl.className = "bpmnkit-runner-scrubber-index"

	scrubberRowEl.appendChild(scrubberEl)
	scrubberRowEl.appendChild(scrubberIndexEl)
	scrubberRowEl.appendChild(scrubberLiveBtn)
	scrubberRowEl.appendChild(scrubberReplayBtn)

	playPanelEl.appendChild(scrubberRowEl)
	playPanelEl.appendChild(playTabBarEl)
	playPanelEl.appendChild(varsPaneEl)
	playPanelEl.appendChild(feelPaneEl)
	playPanelEl.appendChild(errorsPaneEl)
	playPanelEl.appendChild(ivarsPaneEl)
	// Mount tests pane into dedicated container when provided, otherwise keep as sub-tab
	if (options.testsContainer !== undefined) {
		testsPaneEl.classList.remove("bpmnkit-runner-play-pane--hidden")
		options.testsContainer.appendChild(testsPaneEl)
	} else {
		playPanelEl.appendChild(testsPaneEl)
	}

	function switchPlayTab(tab: "variables" | "feel" | "errors" | "input" | "tests"): void {
		varTabBtn.classList.toggle("bpmnkit-runner-play-tab--active", tab === "variables")
		feelTabBtn.classList.toggle("bpmnkit-runner-play-tab--active", tab === "feel")
		errorsTabBtn.classList.toggle("bpmnkit-runner-play-tab--active", tab === "errors")
		inputTabBtn.classList.toggle("bpmnkit-runner-play-tab--active", tab === "input")
		testsTabBtn?.classList.toggle("bpmnkit-runner-play-tab--active", tab === "tests")
		varsPaneEl.classList.toggle("bpmnkit-runner-play-pane--hidden", tab !== "variables")
		feelPaneEl.classList.toggle("bpmnkit-runner-play-pane--hidden", tab !== "feel")
		errorsPaneEl.classList.toggle("bpmnkit-runner-play-pane--hidden", tab !== "errors")
		ivarsPaneEl.classList.toggle("bpmnkit-runner-play-pane--hidden", tab !== "input")
		// testsPaneEl lives in the dock when testsContainer is set — don't hide/show it here
		if (options.testsContainer === undefined) {
			testsPaneEl.classList.toggle("bpmnkit-runner-play-pane--hidden", tab !== "tests")
		}
	}

	varTabBtn.addEventListener("click", () => switchPlayTab("variables"))
	feelTabBtn.addEventListener("click", () => switchPlayTab("feel"))
	errorsTabBtn.addEventListener("click", () => switchPlayTab("errors"))
	inputTabBtn.addEventListener("click", () => switchPlayTab("input"))
	testsTabBtn?.addEventListener("click", () => switchPlayTab("tests"))

	// ── Time-travel helpers ─────────────────────────────────────────────────

	interface ProjectedState {
		variables: Map<string, unknown>
		feelEvals: Array<{ elementId: string; property: string; expression: string; result: unknown }>
		errors: Array<{ elementId?: string; message: string }>
	}

	function computeStateAt(idx: number): ProjectedState {
		const vars = new Map<string, unknown>()
		const feels: ProjectedState["feelEvals"] = []
		const errs: ProjectedState["errors"] = []
		const capped = Math.min(idx, eventLog.length - 1)
		for (let i = 0; i <= capped; i++) {
			const evt = eventLog[i]
			if (evt === undefined) continue
			if (evt.type === "variable:set" && typeof evt.name === "string") {
				vars.set(evt.name, evt.value)
			} else if (
				evt.type === "feel:evaluated" &&
				typeof evt.elementId === "string" &&
				typeof evt.property === "string" &&
				typeof evt.expression === "string"
			) {
				feels.push({
					elementId: evt.elementId,
					property: evt.property,
					expression: evt.expression,
					result: evt.result,
				})
			} else if (evt.type === "element:failed") {
				if (typeof evt.elementId === "string" && typeof evt.error === "string") {
					errs.push({ elementId: evt.elementId, message: evt.error })
				}
			} else if (evt.type === "process:failed" && typeof evt.error === "string") {
				errs.push({ message: evt.error })
			}
		}
		return { variables: vars, feelEvals: feels, errors: errs }
	}

	function updateScrubber(): void {
		const len = eventLog.length
		if (len === 0) {
			scrubberRowEl.style.display = "none"
			return
		}
		scrubberRowEl.style.display = ""
		scrubberEl.max = String(len - 1)

		const isLive = scrubIndex === null
		scrubberEl.value = isLive ? String(len - 1) : String(scrubIndex)
		scrubberIndexEl.textContent = isLive
			? `${len} events (live)`
			: `Event ${(scrubIndex ?? 0) + 1} / ${len}`
		scrubberLiveBtn.style.display = isLive ? "none" : ""
		scrubberReplayBtn.style.display = isLive ? "none" : ""
	}

	function renderAtCurrentScrub(): void {
		if (scrubIndex === null) {
			renderVariables()
			renderFeelEvals()
			renderErrors()
		} else {
			const state = computeStateAt(scrubIndex)
			renderVariables(state.variables)
			renderFeelEvals(state.feelEvals)
			renderErrors(state.errors)
		}
		updateScrubber()
	}

	scrubberEl.addEventListener("input", () => {
		const idx = Number(scrubberEl.value)
		scrubIndex = idx >= eventLog.length - 1 ? null : idx
		renderAtCurrentScrub()
	})

	scrubberLiveBtn.addEventListener("click", () => {
		scrubIndex = null
		renderAtCurrentScrub()
	})

	scrubberReplayBtn.addEventListener("click", () => {
		if (scrubIndex === null) return
		// Snapshot variables at the scrub point and re-run
		const state = computeStateAt(scrubIndex)
		const initVars: Record<string, unknown> = {}
		for (const [k, v] of state.variables) initVars[k] = v
		scrubIndex = null
		startInstance(initVars)
	})

	// ── Render functions ────────────────────────────────────────────────────

	function emptyEl(text: string): HTMLDivElement {
		const d = document.createElement("div")
		d.className = "bpmnkit-runner-play-empty"
		d.textContent = text
		return d
	}

	function clearEl(el: HTMLElement): void {
		while (el.firstChild !== null) el.removeChild(el.firstChild)
	}

	function renderVariables(snapshot?: Map<string, unknown>): void {
		clearEl(varsPaneEl)
		const src = snapshot ?? variables
		if (src.size === 0) {
			varsPaneEl.appendChild(emptyEl("No variables yet."))
			return
		}
		for (const [name, value] of src) {
			const row = document.createElement("div")
			row.className = "bpmnkit-runner-play-var-row"
			const nameEl = document.createElement("span")
			nameEl.className = "bpmnkit-runner-play-var-name"
			nameEl.textContent = name
			const valueEl = document.createElement("span")
			valueEl.className = "bpmnkit-runner-play-var-value"
			valueEl.textContent = JSON.stringify(value)
			row.appendChild(nameEl)
			row.appendChild(valueEl)
			varsPaneEl.appendChild(row)
		}
	}

	function renderFeelEvals(
		snapshot?: Array<{ elementId: string; property: string; expression: string; result: unknown }>,
	): void {
		clearEl(feelPaneEl)
		const src = snapshot ?? feelEvals
		if (src.length === 0) {
			feelPaneEl.appendChild(emptyEl("No FEEL expressions evaluated yet."))
			return
		}
		const groups = new Map<
			string,
			Array<{ property: string; expression: string; result: unknown }>
		>()
		for (const ev of src) {
			let arr = groups.get(ev.elementId)
			if (arr === undefined) {
				arr = []
				groups.set(ev.elementId, arr)
			}
			arr.push({ property: ev.property, expression: ev.expression, result: ev.result })
		}
		for (const [elementId, evals] of groups) {
			const groupEl = document.createElement("div")
			groupEl.className = "bpmnkit-runner-play-feel-group"

			const headerEl = document.createElement("div")
			headerEl.className = "bpmnkit-runner-play-feel-header"
			headerEl.textContent = elementId
			groupEl.appendChild(headerEl)

			for (const ev of evals) {
				const rowEl = document.createElement("div")
				rowEl.className = "bpmnkit-runner-play-feel-row"

				const propEl = document.createElement("div")
				propEl.className = "bpmnkit-runner-play-feel-prop"
				propEl.textContent = ev.property

				const exprEl = document.createElement("code")
				exprEl.className = "bpmnkit-runner-play-feel-expr"
				exprEl.textContent = ev.expression

				const resultRowEl = document.createElement("div")
				resultRowEl.className = "bpmnkit-runner-play-feel-result-row"

				const arrowEl = document.createElement("span")
				arrowEl.className = "bpmnkit-runner-play-feel-arrow"
				arrowEl.textContent = "\u2192"

				const resultEl = document.createElement("span")
				resultEl.className = "bpmnkit-runner-play-feel-result"
				resultEl.textContent = JSON.stringify(ev.result)

				resultRowEl.appendChild(arrowEl)
				resultRowEl.appendChild(resultEl)
				rowEl.appendChild(propEl)
				rowEl.appendChild(exprEl)
				rowEl.appendChild(resultRowEl)
				groupEl.appendChild(rowEl)
			}
			feelPaneEl.appendChild(groupEl)
		}
	}

	function renderErrors(snapshot?: Array<{ elementId?: string; message: string }>): void {
		clearEl(errorsPaneEl)
		// Chaos summary banner — only in live (non-scrubbed) mode after a chaos run
		if (snapshot === undefined && chaosEnabled && lastChaosRunCompleted !== null) {
			const banner = document.createElement("div")
			banner.className = "bpmnkit-runner-chaos-summary"
			const stuck = lastChaosRunCompleted ? 0 : 1
			const errCount = errors.filter((e) => e.elementId !== undefined).length
			banner.textContent = `Chaos run: ${stuck > 0 ? "1 stuck instance" : "completed"}, ${errCount} unhandled error${errCount !== 1 ? "s" : ""} found`
			errorsPaneEl.appendChild(banner)
		}
		const src = snapshot ?? errors
		if (src.length === 0) {
			errorsPaneEl.appendChild(emptyEl("No errors."))
			return
		}
		for (const err of src) {
			const rowEl = document.createElement("div")
			rowEl.className = "bpmnkit-runner-play-error-row"
			if (err.elementId !== undefined) {
				const idEl = document.createElement("div")
				idEl.className = "bpmnkit-runner-play-error-id"
				idEl.textContent = err.elementId
				rowEl.appendChild(idEl)
			}
			const msgEl = document.createElement("div")
			msgEl.className = "bpmnkit-runner-play-error-msg"
			msgEl.textContent = err.message
			rowEl.appendChild(msgEl)
			errorsPaneEl.appendChild(rowEl)
		}
	}

	function buildInputVars(): Record<string, unknown> {
		const result: Record<string, unknown> = {}
		for (const { name, value } of inputVars) {
			const trimmed = name.trim()
			if (trimmed === "") continue
			try {
				result[trimmed] = JSON.parse(value)
			} catch {
				result[trimmed] = value
			}
		}
		return result
	}

	function renderInputVars(): void {
		clearEl(ivarsPaneEl)

		// ── Validation hints ────────────────────────────────────────────────────
		if (options.getValidationDmn && options.getDefinitions) {
			const defs = options.getDefinitions()
			const startEvent = defs?.processes[0]?.flowElements.find((e) => e.type === "startEvent")
			if (startEvent && defs) {
				// getDefinitions returns a minimal interface; cast to BpmnDefinitions-compatible shape
				const structure = findValidationStructure(
					defs as Parameters<typeof findValidationStructure>[0],
					startEvent.id,
				)
				if (structure) {
					const dmnXml = options.getValidationDmn(structure.decisionId)
					const names = dmnXml ? getValidationInputNames(dmnXml) : []
					if (names.length > 0) {
						const hintsEl = document.createElement("div")
						hintsEl.className = "bpmnkit-runner-play-ivar-hints"
						hintsEl.innerHTML = `<span class="bpmnkit-runner-play-ivar-hints-label">Expected:</span> ${names.map((n) => `<span class="bpmnkit-runner-play-ivar-hint-chip">${n}</span>`).join("")}`
						ivarsPaneEl.appendChild(hintsEl)
					}
				}
			}
		}

		for (let i = 0; i < inputVars.length; i++) {
			const entry = inputVars[i]
			if (entry === undefined) continue

			const row = document.createElement("div")
			row.className = "bpmnkit-runner-play-ivar-row"

			const nameInput = document.createElement("input")
			nameInput.className = "bpmnkit-runner-play-ivar-name"
			nameInput.placeholder = "name"
			nameInput.value = entry.name
			nameInput.addEventListener("input", () => {
				const v = inputVars[i]
				if (v !== undefined) {
					v.name = nameInput.value
					void persistInputVars(inputVars)
				}
			})

			const eqEl = document.createElement("span")
			eqEl.className = "bpmnkit-runner-play-ivar-eq"
			eqEl.textContent = "="

			const valueInput = document.createElement("input")
			valueInput.className = "bpmnkit-runner-play-ivar-value"
			valueInput.placeholder = "value (JSON or string)"
			valueInput.value = entry.value
			valueInput.addEventListener("input", () => {
				const v = inputVars[i]
				if (v !== undefined) {
					v.value = valueInput.value
					void persistInputVars(inputVars)
				}
			})

			const delBtn = document.createElement("button")
			delBtn.className = "bpmnkit-runner-play-ivar-del"
			delBtn.textContent = "\u00D7"
			delBtn.addEventListener("click", () => {
				inputVars.splice(i, 1)
				renderInputVars()
				void persistInputVars(inputVars)
			})

			row.appendChild(nameInput)
			row.appendChild(eqEl)
			row.appendChild(valueInput)
			row.appendChild(delBtn)
			ivarsPaneEl.appendChild(row)
		}

		const addBtn = document.createElement("button")
		addBtn.className = "bpmnkit-runner-play-ivar-add"
		addBtn.textContent = "+ Add variable"
		addBtn.addEventListener("click", () => {
			inputVars.push({ name: "", value: "" })
			renderInputVars()
			void persistInputVars(inputVars)
			// Focus the name field of the new row
			const rows = ivarsPaneEl.querySelectorAll<HTMLInputElement>(".bpmnkit-runner-play-ivar-name")
			rows[rows.length - 1]?.focus()
		})
		ivarsPaneEl.appendChild(addBtn)
	}

	// ── Tests helpers ─────────────────────────────────────────────────────────

	function parseVarValue(str: string): unknown {
		const t = str.trim()
		if (!t) return ""
		try {
			return JSON.parse(t)
		} catch {
			return t
		}
	}

	function formatVarValue(val: unknown): string {
		return typeof val === "string" ? val : JSON.stringify(val)
	}

	function makeSectionTitle(text: string): HTMLDivElement {
		const el = document.createElement("div")
		el.className = "bpmnkit-runner-tests-section-title"
		el.textContent = text
		return el
	}

	/** Renders a key=value editor widget. Calls onUpdate whenever entries change. */
	function makeVarList(
		vars: Record<string, unknown>,
		addLabel: string,
		onUpdate: (record: Record<string, unknown>) => void,
	): HTMLElement {
		const wrap = document.createElement("div")
		wrap.className = "bpmnkit-runner-tests-varlist"
		const entries: Array<{ key: string; val: string }> = Object.entries(vars).map(([k, v]) => ({
			key: k,
			val: formatVarValue(v),
		}))

		function save(): void {
			const r: Record<string, unknown> = {}
			for (const e of entries) {
				if (e.key.trim()) r[e.key.trim()] = parseVarValue(e.val)
			}
			onUpdate(r)
		}

		function renderList(): void {
			clearEl(wrap)
			for (let i = 0; i < entries.length; i++) {
				const entry = entries[i]
				if (entry === undefined) continue
				const row = document.createElement("div")
				row.className = "bpmnkit-runner-play-ivar-row"

				const nameInput = document.createElement("input")
				nameInput.className = "bpmnkit-runner-play-ivar-name"
				nameInput.placeholder = "name"
				nameInput.value = entry.key
				nameInput.addEventListener("input", () => {
					if (entries[i] !== undefined) {
						;(entries[i] as { key: string; val: string }).key = nameInput.value
						save()
					}
				})

				const eq = document.createElement("span")
				eq.className = "bpmnkit-runner-play-ivar-eq"
				eq.textContent = "="

				const valInput = document.createElement("input")
				valInput.className = "bpmnkit-runner-play-ivar-value"
				valInput.placeholder = "value"
				valInput.value = entry.val
				valInput.addEventListener("input", () => {
					if (entries[i] !== undefined) {
						;(entries[i] as { key: string; val: string }).val = valInput.value
						save()
					}
				})

				const del = document.createElement("button")
				del.className = "bpmnkit-runner-play-ivar-del"
				del.textContent = "\u00D7"
				del.addEventListener("click", () => {
					entries.splice(i, 1)
					renderList()
					save()
				})

				row.appendChild(nameInput)
				row.appendChild(eq)
				row.appendChild(valInput)
				row.appendChild(del)
				wrap.appendChild(row)
			}

			const addBtn = document.createElement("button")
			addBtn.className = "bpmnkit-runner-play-ivar-add"
			addBtn.textContent = addLabel
			addBtn.addEventListener("click", () => {
				entries.push({ key: "", val: "" })
				renderList()
				const inputs = wrap.querySelectorAll<HTMLInputElement>(".bpmnkit-runner-play-ivar-name")
				inputs[inputs.length - 1]?.focus()
			})
			wrap.appendChild(addBtn)
		}

		renderList()
		return wrap
	}

	// ── Tests tab ────────────────────────────────────────────────────────────

	const scenarios: ScenarioLike[] = []
	const scenarioResults = new Map<string, ScenarioResultLike>()

	function renderTests(): void {
		if (editingScenarioId !== null) {
			renderScenarioEditor()
		} else {
			renderScenarioList()
		}
	}

	function renderScenarioList(): void {
		clearEl(testsPaneEl)

		if (options.runScenario === undefined) {
			testsPaneEl.appendChild(emptyEl("Pass runScenario in options to enable the Tests tab."))
			return
		}

		// Header
		const headerEl = document.createElement("div")
		headerEl.className = "bpmnkit-runner-tests-header"

		const runAllBtn = document.createElement("button")
		runAllBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-run-all"
		runAllBtn.textContent = `\u25B6 Run all (${scenarios.length})`
		runAllBtn.disabled = scenarios.length === 0
		runAllBtn.addEventListener("click", () => {
			runAllBtn.disabled = true
			const runs = scenarios.map((s) =>
				(options.runScenario as NonNullable<typeof options.runScenario>)(s).then((r) => {
					scenarioResults.set(s.id, r)
					renderTests()
				}),
			)
			void Promise.all(runs).then(() => renderTests())
		})
		headerEl.appendChild(runAllBtn)

		const addBtn = document.createElement("button")
		addBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-add"
		addBtn.textContent = "+ New"
		addBtn.addEventListener("click", () => {
			const id = `scenario-${Date.now()}`
			scenarios.push({
				id,
				name: `Scenario ${scenarios.length + 1}`,
				inputs: {},
				mocks: {},
				expect: {},
			})
			void persistScenarios(scenarios)
			editingScenarioId = id
			focusedElementId = null
			renderTests()
		})
		headerEl.appendChild(addBtn)

		if (options.generateScenarios !== undefined) {
			const genBtn = document.createElement("button")
			genBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-gen"
			genBtn.textContent = "\u2728 Generate"
			genBtn.title = "Generate test scenarios with AI"
			genBtn.addEventListener("click", () => {
				genBtn.disabled = true
				genBtn.textContent = "Generating\u2026"
				void (options.generateScenarios as NonNullable<typeof options.generateScenarios>)()
					.then((newScenarios) => {
						scenarios.push(...newScenarios)
						void persistScenarios(scenarios)
					})
					.catch(() => undefined)
					.finally(() => renderTests())
			})
			headerEl.appendChild(genBtn)
		}

		if (lastChaosInjections.length > 0 && options.getJobType !== undefined) {
			const importChaosBtn = document.createElement("button")
			importChaosBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-chaos-import"
			importChaosBtn.textContent = `\u2193 Chaos (${lastChaosInjections.length})`
			importChaosBtn.title = "Import chaos findings as draft test scenarios"
			importChaosBtn.addEventListener("click", () => {
				const newScenarios: ScenarioLike[] = []
				for (let idx = 0; idx < lastChaosInjections.length; idx++) {
					const inj = lastChaosInjections[idx]
					if (inj === undefined) continue
					const jobType = options.getJobType?.(inj.elementId) ?? null
					if (jobType === null) continue
					newScenarios.push({
						id: `chaos-${Date.now()}-${idx}`,
						name: `Chaos: ${inj.elementId} (${inj.type})`,
						mocks: { [jobType]: { error: `[Chaos] ${inj.type}` } },
						expect: {},
					})
				}
				if (newScenarios.length > 0) {
					scenarios.push(...newScenarios)
					void persistScenarios(scenarios)
					renderTests()
				}
			})
			headerEl.appendChild(importChaosBtn)
		}

		testsPaneEl.appendChild(headerEl)

		if (scenarios.length === 0) {
			testsPaneEl.appendChild(emptyEl("No test scenarios yet. Click + New."))
			return
		}

		for (let i = 0; i < scenarios.length; i++) {
			const scenario = scenarios[i]
			if (scenario === undefined) continue
			const result = scenarioResults.get(scenario.id)

			const rowEl = document.createElement("div")
			rowEl.className = "bpmnkit-runner-tests-row"
			if (result !== undefined) {
				rowEl.classList.add(
					result.passed ? "bpmnkit-runner-tests-pass" : "bpmnkit-runner-tests-fail",
				)
			}

			const statusEl = document.createElement("span")
			statusEl.className = "bpmnkit-runner-tests-status"
			statusEl.textContent = result === undefined ? "\u25CB" : result.passed ? "\u2713" : "\u2717"

			const nameEl = document.createElement("span")
			nameEl.className = "bpmnkit-runner-tests-name-label"
			nameEl.textContent = scenario.name

			const editBtn = document.createElement("button")
			editBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-edit"
			editBtn.textContent = "\u270E"
			editBtn.title = "Edit scenario"
			editBtn.addEventListener("click", () => {
				editingScenarioId = scenario.id
				focusedElementId = null
				renderTests()
			})

			const runOneBtn = document.createElement("button")
			runOneBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-run-one"
			runOneBtn.textContent = "\u25B6"
			runOneBtn.title = "Run this scenario"
			runOneBtn.addEventListener("click", () => {
				void (options.runScenario as NonNullable<typeof options.runScenario>)(scenario).then(
					(r) => {
						scenarioResults.set(scenario.id, r)
						renderTests()
					},
				)
			})

			const delBtn = document.createElement("button")
			delBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-del"
			delBtn.textContent = "\u00D7"
			delBtn.title = "Delete"
			delBtn.addEventListener("click", () => {
				scenarios.splice(i, 1)
				scenarioResults.delete(scenario.id)
				void persistScenarios(scenarios)
				renderTests()
			})

			rowEl.appendChild(statusEl)
			rowEl.appendChild(nameEl)
			rowEl.appendChild(editBtn)
			rowEl.appendChild(runOneBtn)
			rowEl.appendChild(delBtn)
			testsPaneEl.appendChild(rowEl)

			// Failure diff
			if (result !== undefined && !result.passed) {
				const diffEl = document.createElement("div")
				diffEl.className = "bpmnkit-runner-tests-diff"
				for (const f of result.failures) {
					const failRow = document.createElement("div")
					failRow.className = "bpmnkit-runner-tests-diff-row"
					failRow.textContent = `${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`
					diffEl.appendChild(failRow)
				}
				for (const e of result.errors) {
					const errRow = document.createElement("div")
					errRow.className = "bpmnkit-runner-tests-diff-row bpmnkit-runner-tests-diff-error"
					errRow.textContent = `Error${e.elementId !== undefined ? ` (${e.elementId})` : ""}: ${e.message}`
					diffEl.appendChild(errRow)
				}
				testsPaneEl.appendChild(diffEl)
			}
		}
	}

	function renderScenarioEditor(): void {
		clearEl(testsPaneEl)

		const scenario = scenarios.find((s) => s.id === editingScenarioId)
		if (scenario === undefined) {
			editingScenarioId = null
			renderScenarioList()
			return
		}

		const result = scenarioResults.get(scenario.id)

		// ── Editor header ───────────────────────────────────────────────────────
		const headerEl = document.createElement("div")
		headerEl.className = "bpmnkit-runner-tests-editor-header"

		const backBtn = document.createElement("button")
		backBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-back"
		backBtn.textContent = "\u2190 Back"
		backBtn.addEventListener("click", () => {
			editingScenarioId = null
			focusedElementId = null
			renderTests()
		})
		headerEl.appendChild(backBtn)

		const nameInput = document.createElement("input")
		nameInput.className = "bpmnkit-runner-tests-editor-name"
		nameInput.value = scenario.name
		nameInput.placeholder = "Scenario name"
		nameInput.addEventListener("input", () => {
			scenario.name = nameInput.value
			void persistScenarios(scenarios)
		})
		headerEl.appendChild(nameInput)

		const runBtn = document.createElement("button")
		runBtn.className = "bpmnkit-runner-btn bpmnkit-runner-tests-run-one"
		runBtn.textContent = "\u25B6 Run"
		runBtn.title = "Run this scenario"
		if (options.runScenario !== undefined) {
			runBtn.addEventListener("click", () => {
				runBtn.disabled = true
				void (options.runScenario as NonNullable<typeof options.runScenario>)(scenario).then(
					(r) => {
						scenarioResults.set(scenario.id, r)
						renderTests()
					},
				)
			})
		} else {
			runBtn.disabled = true
		}
		headerEl.appendChild(runBtn)

		if (result !== undefined) {
			const badge = document.createElement("span")
			badge.className = `bpmnkit-runner-tests-editor-badge ${result.passed ? "bpmnkit-runner-tests-editor-badge--pass" : "bpmnkit-runner-tests-editor-badge--fail"}`
			badge.textContent = result.passed ? "\u2713 passed" : "\u2717 failed"
			headerEl.appendChild(badge)
		}

		testsPaneEl.appendChild(headerEl)

		// ── Start Variables ──────────────────────────────────────────────────────
		testsPaneEl.appendChild(makeSectionTitle("Start Variables"))
		testsPaneEl.appendChild(
			makeVarList(scenario.inputs ?? {}, "+ Add variable", (updated) => {
				scenario.inputs = updated
				void persistScenarios(scenarios)
			}),
		)

		// ── Task Mocks ──────────────────────────────────────────────────────────
		const defs = options.getDefinitions?.() ?? null
		// Decisions referenced by BRTs — used both for filtering mocks and for missing-DMN warnings
		const referencedDecisions =
			defs?.processes.flatMap((p) =>
				p.flowElements.flatMap((e) =>
					e.type === "businessRuleTask" && e.decisionId ? [e.decisionId] : [],
				),
			) ?? []
		const missingDmns = options.getValidationDmn
			? referencedDecisions.filter((id) => options.getValidationDmn?.(id) === null)
			: []
		const mockableTasks =
			defs?.processes.flatMap((p) =>
				p.flowElements.filter((e) => {
					if (!MOCKABLE_TASK_TYPES.has(e.type)) return false
					// BRTs with calledDecision run internally via DMN — no external job, no mock needed
					if (e.type === "businessRuleTask" && e.decisionId) return false
					return true
				}),
			) ?? []

		if (mockableTasks.length > 0) {
			testsPaneEl.appendChild(makeSectionTitle("Task Outputs"))

			const hintEl = document.createElement("div")
			hintEl.className = "bpmnkit-runner-tests-hint"
			hintEl.textContent = "Click a task in the diagram to configure its mock output."
			testsPaneEl.appendChild(hintEl)

			for (const task of mockableTasks) {
				const jobType = options.getJobType?.(task.id) ?? task.id
				const mock = scenario.mocks?.[jobType] ?? {}
				const isFocused = focusedElementId === task.id

				const taskEl = document.createElement("div")
				taskEl.className = `bpmnkit-runner-tests-task${isFocused ? " bpmnkit-runner-tests-task--focused" : ""}`
				taskEl.dataset.elementId = task.id

				const taskHeaderEl = document.createElement("div")
				taskHeaderEl.className = "bpmnkit-runner-tests-task-header"

				const taskNameEl = document.createElement("span")
				taskNameEl.className = "bpmnkit-runner-tests-task-name"
				taskNameEl.textContent = task.name ?? task.id

				const typeEl = document.createElement("span")
				typeEl.className = "bpmnkit-runner-tests-task-badge"
				typeEl.textContent = task.type.replace("Task", "")

				taskHeaderEl.appendChild(taskNameEl)
				taskHeaderEl.appendChild(typeEl)
				taskEl.appendChild(taskHeaderEl)

				// Click header to focus/unfocus
				taskHeaderEl.addEventListener("click", () => {
					focusedElementId = isFocused ? null : task.id
					renderTests()
				})

				if (isFocused) {
					const bodyEl = document.createElement("div")
					bodyEl.className = "bpmnkit-runner-tests-task-body"

					// Output variables
					bodyEl.appendChild(
						makeVarList(mock.outputs ?? {}, "+ Add output", (updated) => {
							if (scenario.mocks === undefined) scenario.mocks = {}
							scenario.mocks[jobType] = { ...mock, outputs: updated }
							void persistScenarios(scenarios)
						}),
					)

					// Error field
					const errorRow = document.createElement("div")
					errorRow.className = "bpmnkit-runner-tests-error-row"

					const errorLabel = document.createElement("label")
					errorLabel.className = "bpmnkit-runner-tests-error-label"
					errorLabel.textContent = "Fail with error:"

					const errorInput = document.createElement("input")
					errorInput.className = "bpmnkit-runner-tests-error-input"
					errorInput.placeholder = "error message (leave blank to complete)"
					errorInput.value = mock.error ?? ""
					errorInput.addEventListener("input", () => {
						if (scenario.mocks === undefined) scenario.mocks = {}
						const err = errorInput.value.trim() || undefined
						scenario.mocks[jobType] = { ...mock, error: err }
						void persistScenarios(scenarios)
					})

					errorRow.appendChild(errorLabel)
					errorRow.appendChild(errorInput)
					bodyEl.appendChild(errorRow)

					taskEl.appendChild(bodyEl)
				}

				testsPaneEl.appendChild(taskEl)
			}
		}

		// ── Missing DMN warning ──────────────────────────────────────────────────
		if (missingDmns.length > 0) {
			const warnEl = document.createElement("div")
			warnEl.className = "bpmnkit-runner-tests-missing-dmn"
			warnEl.textContent = `⚠ Decision model${missingDmns.length > 1 ? "s" : ""} not found: ${missingDmns.join(", ")}. Import the DMN in the Models view.`
			testsPaneEl.appendChild(warnEl)
		}

		// ── Expected Variables ──────────────────────────────────────────────────
		testsPaneEl.appendChild(makeSectionTitle("Expected Variables"))
		testsPaneEl.appendChild(
			makeVarList(scenario.expect?.variables ?? {}, "+ Add assertion", (updated) => {
				if (scenario.expect === undefined) scenario.expect = {}
				scenario.expect.variables = updated
				void persistScenarios(scenarios)
			}),
		)

		// ── Failure details ─────────────────────────────────────────────────────
		if (result !== undefined && (result.failures.length > 0 || result.errors.length > 0)) {
			testsPaneEl.appendChild(makeSectionTitle("Last Run Failures"))
			const diffEl = document.createElement("div")
			diffEl.className = "bpmnkit-runner-tests-diff"
			for (const f of result.failures) {
				const row = document.createElement("div")
				row.className = "bpmnkit-runner-tests-diff-row"
				row.textContent = `${f.field}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`
				diffEl.appendChild(row)
			}
			for (const e of result.errors) {
				const row = document.createElement("div")
				row.className = "bpmnkit-runner-tests-diff-row bpmnkit-runner-tests-diff-error"
				row.textContent = `Error${e.elementId !== undefined ? ` (${e.elementId})` : ""}: ${e.message}`
				diffEl.appendChild(row)
			}
			testsPaneEl.appendChild(diffEl)
		}

		// ── Last Run Trace ───────────────────────────────────────────────────────
		if (result !== undefined) {
			const traceResult = result
			testsPaneEl.appendChild(makeSectionTitle("Last Run Trace"))

			const traceTabsEl = document.createElement("div")
			traceTabsEl.className = "bpmnkit-runner-play-tabs bpmnkit-runner-tests-trace-tabs"

			const tracePaneEl = document.createElement("div")
			tracePaneEl.className = "bpmnkit-runner-tests-trace-pane"

			type TraceTab = "vars" | "feel" | "elements"
			let activeTraceTab: TraceTab = "vars"

			const tVarBtn = makeTabBtn("Variables", true)
			const tFeelBtn = makeTabBtn("FEEL", false)
			const tElemBtn = makeTabBtn("Elements", false)

			function renderTraceTab(): void {
				clearEl(tracePaneEl)
				tVarBtn.className =
					activeTraceTab === "vars"
						? "bpmnkit-runner-play-tab bpmnkit-runner-play-tab--active"
						: "bpmnkit-runner-play-tab"
				tFeelBtn.className =
					activeTraceTab === "feel"
						? "bpmnkit-runner-play-tab bpmnkit-runner-play-tab--active"
						: "bpmnkit-runner-play-tab"
				tElemBtn.className =
					activeTraceTab === "elements"
						? "bpmnkit-runner-play-tab bpmnkit-runner-play-tab--active"
						: "bpmnkit-runner-play-tab"

				if (activeTraceTab === "vars") {
					const entries = Object.entries(traceResult.finalVariables)
					if (entries.length === 0) {
						tracePaneEl.appendChild(emptyEl("No variables."))
					} else {
						for (const [name, value] of entries) {
							const row = document.createElement("div")
							row.className = "bpmnkit-runner-play-var-row"
							const nameEl = document.createElement("span")
							nameEl.className = "bpmnkit-runner-play-var-name"
							nameEl.textContent = name
							const valueEl = document.createElement("span")
							valueEl.className = "bpmnkit-runner-play-var-value"
							valueEl.textContent = JSON.stringify(value)
							row.append(nameEl, valueEl)
							tracePaneEl.appendChild(row)
						}
					}
				} else if (activeTraceTab === "feel") {
					const evals = traceResult.feelEvals
					if (evals.length === 0) {
						tracePaneEl.appendChild(emptyEl("No FEEL evaluations recorded."))
					} else {
						const groups = new Map<
							string,
							Array<{ property: string; expression: string; result: unknown }>
						>()
						for (const ev of evals) {
							let arr = groups.get(ev.elementId)
							if (arr === undefined) {
								arr = []
								groups.set(ev.elementId, arr)
							}
							arr.push({ property: ev.property, expression: ev.expression, result: ev.result })
						}
						for (const [elementId, evArr] of groups) {
							const groupEl = document.createElement("div")
							groupEl.className = "bpmnkit-runner-play-feel-group"
							const headerEl = document.createElement("div")
							headerEl.className = "bpmnkit-runner-play-feel-header"
							headerEl.textContent = elementId
							groupEl.appendChild(headerEl)
							for (const ev of evArr) {
								const rowEl = document.createElement("div")
								rowEl.className = "bpmnkit-runner-play-feel-row"
								const propEl = document.createElement("div")
								propEl.className = "bpmnkit-runner-play-feel-prop"
								propEl.textContent = ev.property
								const exprEl = document.createElement("code")
								exprEl.className = "bpmnkit-runner-play-feel-expr"
								exprEl.textContent = ev.expression
								const resultRowEl = document.createElement("div")
								resultRowEl.className = "bpmnkit-runner-play-feel-result-row"
								const arrowEl = document.createElement("span")
								arrowEl.className = "bpmnkit-runner-play-feel-arrow"
								arrowEl.textContent = "\u2192"
								const resultEl = document.createElement("span")
								resultEl.className = "bpmnkit-runner-play-feel-result"
								resultEl.textContent = JSON.stringify(ev.result)
								resultRowEl.append(arrowEl, resultEl)
								rowEl.append(propEl, exprEl, resultRowEl)
								groupEl.appendChild(rowEl)
							}
							tracePaneEl.appendChild(groupEl)
						}
					}
				} else {
					const elems = traceResult.visitedElements
					if (elems.length === 0) {
						tracePaneEl.appendChild(emptyEl("No elements visited."))
					} else {
						for (let i = 0; i < elems.length; i++) {
							const row = document.createElement("div")
							row.className = "bpmnkit-runner-tests-trace-elem-row"
							const idxEl = document.createElement("span")
							idxEl.className = "bpmnkit-runner-tests-trace-elem-idx"
							idxEl.textContent = String(i + 1)
							const idEl = document.createElement("span")
							idEl.className = "bpmnkit-runner-tests-trace-elem-id"
							idEl.textContent = elems[i] ?? ""
							row.append(idxEl, idEl)
							tracePaneEl.appendChild(row)
						}
					}
				}
			}

			tVarBtn.addEventListener("click", () => {
				activeTraceTab = "vars"
				renderTraceTab()
			})
			tFeelBtn.addEventListener("click", () => {
				activeTraceTab = "feel"
				renderTraceTab()
			})
			tElemBtn.addEventListener("click", () => {
				activeTraceTab = "elements"
				renderTraceTab()
			})

			traceTabsEl.append(tVarBtn, tFeelBtn, tElemBtn)
			renderTraceTab()
			testsPaneEl.append(traceTabsEl, tracePaneEl)
		}
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	function getPrimaryProcessId(): string | undefined {
		return currentProcessId
	}

	function clearRunState(): void {
		feelEvals.length = 0
		variables.clear()
		errors.length = 0
		eventLog.length = 0
		scrubIndex = null
		lastChaosInjections.length = 0
		lastChaosRunCompleted = null
		renderVariables()
		renderFeelEvals()
		renderErrors()
		updateScrubber()
	}

	/** Cancel running instance and reset run state. Stays in play mode. */
	function cleanup(): void {
		currentInstance?.cancel()
		currentInstance = null
		stopTrackHighlight?.()
		stopTrackHighlight = undefined
		stepQueue.length = 0
		options.tokenHighlight?.api.clear()
		clearRunState()
		mode = "idle"
		updateToolbar()
	}

	/** Exit play mode entirely (also cancels any running instance). */
	function exitPlayMode(): void {
		currentInstance?.cancel()
		currentInstance = null
		stopTrackHighlight?.()
		stopTrackHighlight = undefined
		stepQueue.length = 0
		options.tokenHighlight?.api.clear()
		clearRunState()
		mode = "idle"
		playModeActive = false
		updateToolbar()
		options.onExitPlayMode?.()
		options.onHidePlayTab?.()
	}

	function applyChaosThenResolve(
		chaos: ChaosInjection,
		resolve: () => void,
		reject: (err: Error) => void,
	): void {
		switch (chaos.type) {
			case "service-failure":
				reject(new Error(`[Chaos] Simulated service failure at "${chaos.elementId}"`))
				break
			case "null-response":
				// Completes with empty variables — downstream FEEL will get nulls
				resolve()
				break
			case "random-delay": {
				const delay = 500 + Math.random() * 2000
				setTimeout(resolve, delay)
				break
			}
		}
	}

	function startInstance(vars?: Record<string, unknown>, stepMode = false): void {
		if (currentInstance !== null) cleanup()

		const processId = getPrimaryProcessId()
		if (processId === undefined) return

		mode = stepMode ? "running-step" : "running-auto"

		// Build chaos schedule from flow elements of current process
		if (chaosEnabled) {
			// Gather element IDs from the current definitions
			const defs = (
				engine as unknown as {
					_defs?: {
						processes?: Array<{ id: string; flowElements?: Array<{ id: string; type: string }> }>
					}
				}
			)._defs
			const proc = defs?.processes?.find((p) => p.id === processId)
			const eligibleIds =
				proc?.flowElements?.filter((e) => CHAOS_ELIGIBLE_TYPES.has(e.type)).map((e) => e.id) ?? []
			chaosSchedule = buildChaosSchedule(eligibleIds, CHAOS_FAILURE_PROBABILITY)
			if (chaosSchedule.size > 0) {
				errors.push({
					message: `[Chaos] Scheduled injections for ${chaosSchedule.size} element(s): ${[...chaosSchedule.values()].map((i) => `${i.elementId}(${i.type})`).join(", ")}`,
				})
				renderErrors()
			}
		} else {
			chaosSchedule = new Map()
		}

		updateToolbar()

		const beforeComplete = stepMode
			? (elementId: string): Promise<void> =>
					new Promise<void>((resolve, reject) => {
						const chaos = chaosEnabled ? chaosSchedule.get(elementId) : undefined
						if (chaos !== undefined) {
							lastChaosInjections.push(chaos)
							applyChaosThenResolve(chaos, resolve, reject)
						} else {
							stepQueue.push(resolve)
							updateToolbar()
						}
					})
			: (elementId: string): Promise<void> =>
					new Promise<void>((resolve, reject) => {
						const chaos = chaosEnabled ? chaosSchedule.get(elementId) : undefined
						if (chaos !== undefined) {
							lastChaosInjections.push(chaos)
							applyChaosThenResolve(chaos, resolve, reject)
						} else {
							setTimeout(resolve, AUTO_PLAY_DELAY_MS)
						}
					})

		// Reset chaos tracking for new run
		lastChaosInjections.length = 0
		lastChaosRunCompleted = null

		// Reset event log for new run
		eventLog.length = 0
		scrubIndex = null
		updateScrubber()

		const instance = engine.start(processId, vars, { beforeComplete })
		currentInstance = instance

		if (options.tokenHighlight !== undefined) {
			stopTrackHighlight = options.tokenHighlight.api.trackInstance(instance)
		}

		instance.onChange((evt) => {
			// Record every event (capped at MAX_EVENT_LOG)
			if (eventLog.length < MAX_EVENT_LOG) {
				eventLog.push(evt)
			}
			// Update scrubber max — only if in live mode
			if (scrubIndex === null) updateScrubber()

			const type = evt.type
			if (type === "process:completed" || type === "process:failed") {
				if (chaosEnabled) {
					lastChaosRunCompleted = type === "process:completed"
					renderErrors()
				}
				if (type === "process:failed") {
					const error = evt.error
					if (typeof error === "string") {
						// Avoid duplicating if element:failed already logged this message
						const alreadyRecorded = errors.some((e) => e.message === error)
						if (!alreadyRecorded) {
							errors.push({ message: error })
							renderErrors()
						}
					}
				}
				stopTrackHighlight?.()
				stopTrackHighlight = undefined
				currentInstance = null
				stepQueue.length = 0
				mode = "idle"
				updateToolbar()
			} else if (type === "feel:evaluated") {
				const elementId = evt.elementId
				const property = evt.property
				const expression = evt.expression
				if (
					typeof elementId === "string" &&
					typeof property === "string" &&
					typeof expression === "string"
				) {
					feelEvals.push({ elementId, property, expression, result: evt.result })
					renderFeelEvals()
				}
			} else if (type === "variable:set") {
				const name = evt.name
				if (typeof name === "string") {
					variables.set(name, evt.value)
					renderVariables()
				}
			} else if (type === "element:failed") {
				const elementId = evt.elementId
				const error = evt.error
				if (typeof elementId === "string" && typeof error === "string") {
					errors.push({ elementId, message: error })
					renderErrors()
					options.tokenHighlight?.api.setError(elementId)
				}
			}
		})
	}

	// ── Toolbar rendering ──────────────────────────────────────────────────

	function btn(label: string, extraClass?: string): HTMLButtonElement {
		const b = document.createElement("button")
		b.className =
			extraClass !== undefined ? `bpmnkit-runner-btn ${extraClass}` : "bpmnkit-runner-btn"
		b.textContent = label
		return b
	}

	playButtonEl.addEventListener("click", () => {
		playModeActive = true
		updateToolbar()
		options.onEnterPlayMode?.()
		options.onShowPlayTab?.()
	})

	function updateToolbar(): void {
		while (toolbarEl.firstChild !== null) {
			toolbarEl.removeChild(toolbarEl.firstChild)
		}

		// Hide the HUD entry button while in play mode
		playButtonEl.style.display = playModeActive ? "none" : ""

		if (!playModeActive) return

		const isRunning = mode !== "idle"
		const hasPendingStep = mode === "running-step" && stepQueue.length > 0

		// Chaos toggle (only show when idle)
		if (!isRunning) {
			const chaosLabel = document.createElement("label")
			chaosLabel.className = "bpmnkit-runner-chaos-label"
			const chaosCheckbox = document.createElement("input")
			chaosCheckbox.type = "checkbox"
			chaosCheckbox.className = "bpmnkit-runner-chaos-checkbox"
			chaosCheckbox.checked = chaosEnabled
			chaosCheckbox.addEventListener("change", () => {
				chaosEnabled = chaosCheckbox.checked
			})
			chaosLabel.appendChild(chaosCheckbox)
			chaosLabel.appendChild(document.createTextNode(" Chaos"))
			toolbarEl.appendChild(chaosLabel)
		}

		// Run button
		const runBtn = btn("\u25B6 Run")
		runBtn.disabled = isRunning
		runBtn.addEventListener("click", () => {
			if (mode === "idle") startInstance(buildInputVars())
		})
		toolbarEl.appendChild(runBtn)

		// One Step button — enabled in idle (start step run) or when paused (advance)
		const oneStepBtn = btn("\u21A6 One Step", "bpmnkit-runner-btn--step")
		oneStepBtn.disabled = isRunning && !hasPendingStep
		oneStepBtn.addEventListener("click", () => {
			if (mode === "running-step" && stepQueue.length > 0) {
				const next = stepQueue.shift()
				if (next !== undefined) {
					next()
					updateToolbar()
				}
			} else if (mode === "idle") {
				startInstance(buildInputVars(), true)
			}
		})
		toolbarEl.appendChild(oneStepBtn)

		// Cancel button
		const cancelBtn = btn("\u25A0 Cancel", "bpmnkit-runner-btn--stop")
		cancelBtn.disabled = !isRunning
		cancelBtn.addEventListener("click", () => {
			if (mode !== "idle") cleanup()
		})
		toolbarEl.appendChild(cancelBtn)

		// Exit button
		const exitBtn = btn("Exit", "bpmnkit-runner-btn--exit")
		exitBtn.addEventListener("click", () => exitPlayMode())
		toolbarEl.appendChild(exitBtn)
	}

	// ── CanvasPlugin ───────────────────────────────────────────────────────

	return {
		name: "process-runner",

		/** The toolbar element. Place this in the tabs bar center slot; shows running controls during play mode. */
		toolbar: toolbarEl,

		/** Icon button for the HUD action bar. Pass to `initEditorHud` as `playButton`. */
		playButton: playButtonEl,

		/** Exits play mode and cancels any running instance. */
		exitPlayMode,

		install(api: CanvasApi) {
			canvasApi = api
			injectProcessRunnerStyles()
			updateToolbar()
			renderVariables()
			renderFeelEvals()
			renderErrors()
			renderInputVars()
			renderTests()

			if (options.playContainer !== undefined) {
				options.playContainer.appendChild(playPanelEl)
			}

			// Load persisted input variables and scenarios for the initial project
			currentProjectId = options.getProjectId?.() ?? null
			void fetchInputVars().then((loaded) => {
				inputVars.length = 0
				for (const v of loaded) inputVars.push(v)
				renderInputVars()
			})
			void fetchScenarios().then((loaded) => {
				scenarios.length = 0
				for (const s of loaded) scenarios.push(s)
				renderTests()
			})
			// Auto-load sidecar on initial mount
			if (options.loadSidecarScenarios !== undefined) {
				void options.loadSidecarScenarios().then((sidecar) => {
					if (sidecar !== null && sidecar.length > 0) {
						scenarios.length = 0
						for (const s of sidecar) scenarios.push(s)
						void persistScenarios(scenarios)
						renderTests()
					}
				})
			}

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = api.on as unknown as AnyOn

			unsubs.push(
				api.on("diagram:load", (defs) => {
					currentProcessId = defs.processes[0]?.id
					engine.deploy({ bpmn: defs })
					if (currentInstance !== null) cleanup()
					// Reload input vars and scenarios if the project changed
					const pid = options.getProjectId?.() ?? null
					if (pid !== currentProjectId) {
						currentProjectId = pid
						void fetchInputVars().then((loaded) => {
							inputVars.length = 0
							for (const v of loaded) inputVars.push(v)
							renderInputVars()
						})
						void fetchScenarios().then((loaded) => {
							scenarios.length = 0
							for (const s of loaded) scenarios.push(s)
							scenarioResults.clear()
							renderTests()
						})
						// Auto-load sidecar test file alongside BPMN
						if (options.loadSidecarScenarios !== undefined) {
							void options.loadSidecarScenarios().then((sidecar) => {
								if (sidecar !== null && sidecar.length > 0) {
									scenarios.length = 0
									for (const s of sidecar) scenarios.push(s)
									scenarioResults.clear()
									void persistScenarios(scenarios)
									renderTests()
								}
							})
						}
					}
					updateToolbar()
				}),
				api.on("diagram:clear", () => {
					currentProcessId = undefined
					if (currentInstance !== null) cleanup()
					updateToolbar()
				}),
				onAny("diagram:change", (defs: unknown) => {
					const typed = defs as { processes?: Array<{ id: string }> }
					currentProcessId = typed.processes?.[0]?.id
					engine.deploy({ bpmn: defs })
					if (currentInstance !== null) cleanup()
				}),
				onAny("element:click", (evt: unknown) => {
					if (editingScenarioId === null) return
					const typed = evt as { element?: { id?: string; type?: string } }
					const elementId = typed.element?.id
					if (elementId === undefined) return
					const elementType = typed.element?.type ?? ""
					if (!MOCKABLE_TASK_TYPES.has(elementType)) return
					focusedElementId = focusedElementId === elementId ? null : elementId
					renderTests()
				}),
			)
		},

		uninstall() {
			for (const off of unsubs) off()
			cleanup()
			toolbarEl.remove()
			playPanelEl.remove()
			canvasApi = null
		},
	}
}
