import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas"
import { injectProcessRunnerStyles } from "./css.js"

// ── Structural types — no hard deps on engine packages ─────────────────────

/** Minimal interface satisfied by `ProcessInstance` from `@bpmn-sdk/engine`. */
interface InstanceLike {
	get state(): string
	onChange(callback: (event: Record<string, unknown>) => void): () => void
	cancel(): void
	beforeComplete?: (elementId: string) => Promise<void>
}

/** Minimal interface satisfied by `Engine` from `@bpmn-sdk/engine`. */
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
}

// ── IndexedDB persistence for input variables ───────────────────────────────

function openRunnerDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open("bpmn-process-runner-v1", 1)
		req.onupgradeneeded = () => {
			req.result.createObjectStore("data")
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

// ── Internal state ──────────────────────────────────────────────────────────

const AUTO_PLAY_DELAY_MS = 600

type RunMode = "idle" | "running-auto" | "running-step"

// ── Plugin factory ──────────────────────────────────────────────────────────

const PLAY_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5l10 5.5-10 5.5V2.5z"/></svg>'

export function createProcessRunnerPlugin(
	options: ProcessRunnerOptions,
): CanvasPlugin & { toolbar: HTMLDivElement; playButton: HTMLButtonElement } {
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

	/** Input variables configured by the user (persisted in IndexedDB). */
	const inputVars: Array<{ name: string; value: string }> = []

	const toolbarEl = document.createElement("div")
	toolbarEl.className = "bpmn-runner-toolbar"

	/** Entry button placed in the HUD action bar (styled by initEditorHud). */
	const playButtonEl = document.createElement("button")
	playButtonEl.title = "Play mode"
	playButtonEl.innerHTML = PLAY_ICON

	const unsubs: Array<() => void> = []

	// ── Play panel DOM ──────────────────────────────────────────────────────

	const playPanelEl = document.createElement("div")
	playPanelEl.className = "bpmn-runner-play-panel"

	const playTabBarEl = document.createElement("div")
	playTabBarEl.className = "bpmn-runner-play-tabs"

	function makeTabBtn(label: string, active: boolean): HTMLButtonElement {
		const b = document.createElement("button")
		b.className = active
			? "bpmn-runner-play-tab bpmn-runner-play-tab--active"
			: "bpmn-runner-play-tab"
		b.textContent = label
		return b
	}

	const varTabBtn = makeTabBtn("Variables", true)
	const feelTabBtn = makeTabBtn("FEEL", false)
	const errorsTabBtn = makeTabBtn("Errors", false)
	const inputTabBtn = makeTabBtn("Input", false)

	playTabBarEl.appendChild(varTabBtn)
	playTabBarEl.appendChild(feelTabBtn)
	playTabBarEl.appendChild(errorsTabBtn)
	playTabBarEl.appendChild(inputTabBtn)

	function makePaneEl(hidden: boolean): HTMLDivElement {
		const d = document.createElement("div")
		d.className = hidden
			? "bpmn-runner-play-pane bpmn-runner-play-pane--hidden"
			: "bpmn-runner-play-pane"
		return d
	}

	const varsPaneEl = makePaneEl(false)
	const feelPaneEl = makePaneEl(true)
	const errorsPaneEl = makePaneEl(true)
	const ivarsPaneEl = makePaneEl(true)

	playPanelEl.appendChild(playTabBarEl)
	playPanelEl.appendChild(varsPaneEl)
	playPanelEl.appendChild(feelPaneEl)
	playPanelEl.appendChild(errorsPaneEl)
	playPanelEl.appendChild(ivarsPaneEl)

	function switchPlayTab(tab: "variables" | "feel" | "errors" | "input"): void {
		varTabBtn.classList.toggle("bpmn-runner-play-tab--active", tab === "variables")
		feelTabBtn.classList.toggle("bpmn-runner-play-tab--active", tab === "feel")
		errorsTabBtn.classList.toggle("bpmn-runner-play-tab--active", tab === "errors")
		inputTabBtn.classList.toggle("bpmn-runner-play-tab--active", tab === "input")
		varsPaneEl.classList.toggle("bpmn-runner-play-pane--hidden", tab !== "variables")
		feelPaneEl.classList.toggle("bpmn-runner-play-pane--hidden", tab !== "feel")
		errorsPaneEl.classList.toggle("bpmn-runner-play-pane--hidden", tab !== "errors")
		ivarsPaneEl.classList.toggle("bpmn-runner-play-pane--hidden", tab !== "input")
	}

	varTabBtn.addEventListener("click", () => switchPlayTab("variables"))
	feelTabBtn.addEventListener("click", () => switchPlayTab("feel"))
	errorsTabBtn.addEventListener("click", () => switchPlayTab("errors"))
	inputTabBtn.addEventListener("click", () => switchPlayTab("input"))

	// ── Render functions ────────────────────────────────────────────────────

	function emptyEl(text: string): HTMLDivElement {
		const d = document.createElement("div")
		d.className = "bpmn-runner-play-empty"
		d.textContent = text
		return d
	}

	function clearEl(el: HTMLElement): void {
		while (el.firstChild !== null) el.removeChild(el.firstChild)
	}

	function renderVariables(): void {
		clearEl(varsPaneEl)
		if (variables.size === 0) {
			varsPaneEl.appendChild(emptyEl("No variables yet."))
			return
		}
		for (const [name, value] of variables) {
			const row = document.createElement("div")
			row.className = "bpmn-runner-play-var-row"
			const nameEl = document.createElement("span")
			nameEl.className = "bpmn-runner-play-var-name"
			nameEl.textContent = name
			const valueEl = document.createElement("span")
			valueEl.className = "bpmn-runner-play-var-value"
			valueEl.textContent = JSON.stringify(value)
			row.appendChild(nameEl)
			row.appendChild(valueEl)
			varsPaneEl.appendChild(row)
		}
	}

	function renderFeelEvals(): void {
		clearEl(feelPaneEl)
		if (feelEvals.length === 0) {
			feelPaneEl.appendChild(emptyEl("No FEEL expressions evaluated yet."))
			return
		}
		const groups = new Map<
			string,
			Array<{ property: string; expression: string; result: unknown }>
		>()
		for (const ev of feelEvals) {
			let arr = groups.get(ev.elementId)
			if (arr === undefined) {
				arr = []
				groups.set(ev.elementId, arr)
			}
			arr.push({ property: ev.property, expression: ev.expression, result: ev.result })
		}
		for (const [elementId, evals] of groups) {
			const groupEl = document.createElement("div")
			groupEl.className = "bpmn-runner-play-feel-group"

			const headerEl = document.createElement("div")
			headerEl.className = "bpmn-runner-play-feel-header"
			headerEl.textContent = elementId
			groupEl.appendChild(headerEl)

			for (const ev of evals) {
				const rowEl = document.createElement("div")
				rowEl.className = "bpmn-runner-play-feel-row"

				const propEl = document.createElement("div")
				propEl.className = "bpmn-runner-play-feel-prop"
				propEl.textContent = ev.property

				const exprEl = document.createElement("code")
				exprEl.className = "bpmn-runner-play-feel-expr"
				exprEl.textContent = ev.expression

				const resultRowEl = document.createElement("div")
				resultRowEl.className = "bpmn-runner-play-feel-result-row"

				const arrowEl = document.createElement("span")
				arrowEl.className = "bpmn-runner-play-feel-arrow"
				arrowEl.textContent = "\u2192"

				const resultEl = document.createElement("span")
				resultEl.className = "bpmn-runner-play-feel-result"
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

	function renderErrors(): void {
		clearEl(errorsPaneEl)
		if (errors.length === 0) {
			errorsPaneEl.appendChild(emptyEl("No errors."))
			return
		}
		for (const err of errors) {
			const rowEl = document.createElement("div")
			rowEl.className = "bpmn-runner-play-error-row"
			if (err.elementId !== undefined) {
				const idEl = document.createElement("div")
				idEl.className = "bpmn-runner-play-error-id"
				idEl.textContent = err.elementId
				rowEl.appendChild(idEl)
			}
			const msgEl = document.createElement("div")
			msgEl.className = "bpmn-runner-play-error-msg"
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
		for (let i = 0; i < inputVars.length; i++) {
			const entry = inputVars[i]
			if (entry === undefined) continue

			const row = document.createElement("div")
			row.className = "bpmn-runner-play-ivar-row"

			const nameInput = document.createElement("input")
			nameInput.className = "bpmn-runner-play-ivar-name"
			nameInput.placeholder = "name"
			nameInput.value = entry.name
			nameInput.addEventListener("input", () => {
				const v = inputVars[i]
				if (v !== undefined) {
					v.name = nameInput.value
					void saveInputVars(currentProjectId, inputVars)
				}
			})

			const eqEl = document.createElement("span")
			eqEl.className = "bpmn-runner-play-ivar-eq"
			eqEl.textContent = "="

			const valueInput = document.createElement("input")
			valueInput.className = "bpmn-runner-play-ivar-value"
			valueInput.placeholder = "value (JSON or string)"
			valueInput.value = entry.value
			valueInput.addEventListener("input", () => {
				const v = inputVars[i]
				if (v !== undefined) {
					v.value = valueInput.value
					void saveInputVars(currentProjectId, inputVars)
				}
			})

			const delBtn = document.createElement("button")
			delBtn.className = "bpmn-runner-play-ivar-del"
			delBtn.textContent = "\u00D7"
			delBtn.addEventListener("click", () => {
				inputVars.splice(i, 1)
				renderInputVars()
				void saveInputVars(currentProjectId, inputVars)
			})

			row.appendChild(nameInput)
			row.appendChild(eqEl)
			row.appendChild(valueInput)
			row.appendChild(delBtn)
			ivarsPaneEl.appendChild(row)
		}

		const addBtn = document.createElement("button")
		addBtn.className = "bpmn-runner-play-ivar-add"
		addBtn.textContent = "+ Add variable"
		addBtn.addEventListener("click", () => {
			inputVars.push({ name: "", value: "" })
			renderInputVars()
			void saveInputVars(currentProjectId, inputVars)
			// Focus the name field of the new row
			const rows = ivarsPaneEl.querySelectorAll<HTMLInputElement>(".bpmn-runner-play-ivar-name")
			rows[rows.length - 1]?.focus()
		})
		ivarsPaneEl.appendChild(addBtn)
	}

	// ── Helpers ────────────────────────────────────────────────────────────

	function getPrimaryProcessId(): string | undefined {
		return currentProcessId
	}

	function clearRunState(): void {
		feelEvals.length = 0
		variables.clear()
		errors.length = 0
		renderVariables()
		renderFeelEvals()
		renderErrors()
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

	function startInstance(vars?: Record<string, unknown>, stepMode = false): void {
		if (currentInstance !== null) cleanup()

		const processId = getPrimaryProcessId()
		if (processId === undefined) return

		mode = stepMode ? "running-step" : "running-auto"
		updateToolbar()

		const beforeComplete = stepMode
			? (_elementId: string): Promise<void> =>
					new Promise<void>((resolve) => {
						stepQueue.push(resolve)
						updateToolbar()
					})
			: (_elementId: string): Promise<void> =>
					new Promise<void>((resolve) => {
						setTimeout(resolve, AUTO_PLAY_DELAY_MS)
					})

		const instance = engine.start(processId, vars, { beforeComplete })
		currentInstance = instance

		if (options.tokenHighlight !== undefined) {
			stopTrackHighlight = options.tokenHighlight.api.trackInstance(instance)
		}

		instance.onChange((evt) => {
			const type = evt.type
			if (type === "process:completed" || type === "process:failed") {
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
		b.className = extraClass !== undefined ? `bpmn-runner-btn ${extraClass}` : "bpmn-runner-btn"
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

		// Run button
		const runBtn = btn("\u25B6 Run")
		runBtn.disabled = isRunning
		runBtn.addEventListener("click", () => {
			if (mode === "idle") startInstance(buildInputVars())
		})
		toolbarEl.appendChild(runBtn)

		// One Step button — enabled in idle (start step run) or when paused (advance)
		const oneStepBtn = btn("\u21A6 One Step", "bpmn-runner-btn--step")
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
		const cancelBtn = btn("\u25A0 Cancel", "bpmn-runner-btn--stop")
		cancelBtn.disabled = !isRunning
		cancelBtn.addEventListener("click", () => {
			if (mode !== "idle") cleanup()
		})
		toolbarEl.appendChild(cancelBtn)

		// Exit button
		const exitBtn = btn("Exit", "bpmn-runner-btn--exit")
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

		install(api: CanvasApi) {
			canvasApi = api
			injectProcessRunnerStyles()
			updateToolbar()
			renderVariables()
			renderFeelEvals()
			renderErrors()
			renderInputVars()

			if (options.playContainer !== undefined) {
				options.playContainer.appendChild(playPanelEl)
			}

			// Load persisted input variables for the initial project
			currentProjectId = options.getProjectId?.() ?? null
			void loadInputVars(currentProjectId).then((loaded) => {
				inputVars.length = 0
				for (const v of loaded) inputVars.push(v)
				renderInputVars()
			})

			type AnyOn = (event: string, handler: (arg: unknown) => void) => () => void
			const onAny = api.on as unknown as AnyOn

			unsubs.push(
				api.on("diagram:load", (defs) => {
					currentProcessId = defs.processes[0]?.id
					engine.deploy({ bpmn: defs })
					if (currentInstance !== null) cleanup()
					// Reload input vars if the project changed
					const pid = options.getProjectId?.() ?? null
					if (pid !== currentProjectId) {
						currentProjectId = pid
						void loadInputVars(pid).then((loaded) => {
							inputVars.length = 0
							for (const v of loaded) inputVars.push(v)
							renderInputVars()
						})
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
