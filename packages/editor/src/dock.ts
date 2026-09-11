import { injectChromeStyles } from "./chrome.js"
const DOCK_STYLE_ID = "bpmnkit-side-dock-styles-v1"
const STORAGE_KEY_WIDTH = "bpmnkit-side-dock-width"
const STORAGE_KEY_COLLAPSED = "bpmnkit-side-dock-collapsed"
const MIN_WIDTH = 280
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 340

const DOCK_CSS = `
/* ── Side dock ───────────────────────────────────────────────────────────
   The properties panel, in the bpmnkit.com design system: flat, square,
   hairline-bounded, mono uppercase labels. Grounds follow the HUD theme
   variables declared in css.ts, so the two read as one piece of chrome.
   ──────────────────────────────────────────────────────────────────────── */
.bpmnkit-side-dock {
  position: fixed; right: 0; top: 36px; bottom: 0;
  z-index: 9999; display: flex; flex-direction: column;
  background: var(--bpmnkit-chrome-ground, #ffffff);
  border-left: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14));
  font-family: var(--bpmnkit-ds-font-sans, system-ui, -apple-system, sans-serif);
  transition: width 0.22s ease;
}
/* Square handle — sticks out from the left edge; always visible + clickable */
.bpmnkit-side-dock__collapse-handle {
  position: absolute; left: -20px; top: 50%; transform: translateY(-50%);
  width: 20px; height: 52px;
  background: var(--bpmnkit-chrome-ground, #ffffff);
  border: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14)); border-right: none;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 1;
  color: var(--bpmnkit-chrome-ink-4, #9aa1aa);
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 13px; line-height: 1;
  font-variant-emoji: text;
  user-select: none;
}
.bpmnkit-side-dock__collapse-handle:hover { color: var(--bpmnkit-chrome-ink, #f4f5f7); background: var(--bpmnkit-chrome-hover, rgba(255,255,255,0.07)); }
.bpmnkit-side-dock__resize-handle {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 5px; cursor: ew-resize; z-index: 2;
}
.bpmnkit-side-dock__resize-handle:hover { background: var(--bpmnkit-chrome-accent, #c9755c); }

/* ── Tabs — equal-width row, the underline sits on the row's own rule ── */
.bpmnkit-side-dock__tab-strip {
  display: flex; align-items: stretch; height: 34px; flex-shrink: 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line, rgba(255, 255, 255, 0.14));
  overflow-x: auto; scrollbar-width: none;
}
.bpmnkit-side-dock__tab-strip::-webkit-scrollbar { display: none; }
/* Equal-width while the labels fit; the strip scrolls rather than clipping them. */
.bpmnkit-side-dock__tab {
  flex: 1 0 auto;
  padding: 0 10px; height: 100%; background: none; border: none;
  border-bottom: 2px solid transparent; color: var(--bpmnkit-chrome-ink-4, #9aa1aa);
  cursor: pointer; white-space: nowrap;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px);
  letter-spacing: 0.08em; text-transform: uppercase;
}
.bpmnkit-side-dock__tab:hover { color: var(--bpmnkit-chrome-ink-2, #c8ccd2); }
.bpmnkit-side-dock__tab.active {
  color: var(--bpmnkit-chrome-ink, #f4f5f7);
  border-bottom-color: var(--bpmnkit-chrome-accent, #c9755c);
  margin-bottom: -1px;
}
.bpmnkit-side-dock__tab:disabled { opacity: 0.3; cursor: default; }
.bpmnkit-side-dock__pane {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;
}
.bpmnkit-side-dock__pane--hidden { display: none; }

/* ── Empty state — info rows + hint, shown when nothing is selected ── */
.bpmnkit-side-dock__empty {
  flex: 1; display: flex; flex-direction: column;
  overflow-y: auto; padding: 0 20px;
}
.bpmnkit-side-dock__info-row {
  display: flex; flex-direction: column;
  padding: 14px 0;
  border-bottom: 1px solid var(--bpmnkit-chrome-line-soft, rgba(255, 255, 255, 0.08));
  gap: 7px;
}
.bpmnkit-side-dock__info-label {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-micro, 10.5px); letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--bpmnkit-chrome-ink-4, #9aa1aa);
}
.bpmnkit-side-dock__info-value {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 12.5px; color: var(--bpmnkit-chrome-ink-2, #c8ccd2); word-break: break-word;
}
/* A sentence, not a label — --ink-4 does not clear 4.5:1 on a light ground. */
.bpmnkit-side-dock__empty-hint {
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: var(--bpmnkit-ds-t-mono-label, 11.5px); letter-spacing: 0.04em;
  color: var(--bpmnkit-chrome-ink-2, #c8ccd2);
  padding: 24px 0;
}
/* Collapsed state — only the handle remains visible */
.bpmnkit-side-dock--collapsed .bpmnkit-side-dock__tab-strip,
.bpmnkit-side-dock--collapsed .bpmnkit-side-dock__pane { display: none; }
/* Push watermark left of the dock using a CSS variable updated by JS */
.bpmnkit-watermark { right: calc(var(--bpmnkit-dock-width, 0px) + 8px) !important; }
`

function injectDockStyles(): void {
	injectChromeStyles()
	if (document.getElementById(DOCK_STYLE_ID)) return
	const style = document.createElement("style")
	style.id = DOCK_STYLE_ID
	style.textContent = DOCK_CSS
	document.head.appendChild(style)
}

export interface SideDock {
	el: HTMLDivElement
	propertiesPane: HTMLDivElement
	historyPane: HTMLDivElement
	aiPane: HTMLDivElement
	playPane: HTMLDivElement
	docsPane: HTMLDivElement
	deployPane: HTMLDivElement
	testsPane: HTMLDivElement
	switchTab(tab: "properties" | "history" | "ai" | "play" | "docs" | "deploy" | "tests"): void
	expand(): void
	collapse(): void
	get collapsed(): boolean
	get activeTab(): "properties" | "history" | "ai" | "play" | "docs" | "deploy" | "tests"
	/** Update the info shown in the Properties empty state. */
	setDiagramInfo(processName: string | null, fileName: string | null): void
	/** Hide the empty state when a config panel is displayed. */
	showPanel(): void
	/** Restore the empty state when the config panel is dismissed. */
	hidePanel(): void
	/** Show or hide the entire dock (e.g. hide on welcome screen, show on tab open). */
	setVisible(visible: boolean): void
	/** Register a callback invoked when the AI tab is clicked (after switching to it). */
	setAiTabClickHandler(fn: () => void): void
	/** Show or hide the AI tab. */
	setAiTabVisible(visible: boolean): void
	/** Register a callback invoked when the History tab is clicked (after switching to it). */
	setHistoryTabClickHandler(fn: () => void): void
	/** Enable or disable the History tab (disable when no storage context is available). */
	setHistoryTabEnabled(enabled: boolean): void
	/** Show or hide the Play tab (shown when process runner enters play mode). */
	setPlayTabVisible(visible: boolean): void
	/** Register a callback invoked when the Play tab is clicked. */
	setPlayTabClickHandler(fn: () => void): void
	/** Register a callback invoked when the Docs tab is clicked. */
	setDocsTabClickHandler(fn: () => void): void
	/** Register a callback invoked when the Deploy tab is clicked. */
	setDeployTabClickHandler(fn: () => void): void
	/** Show or hide the Tests tab. */
	setTestsTabVisible(visible: boolean): void
	/** Register a callback invoked when the Tests tab is clicked. */
	setTestsTabClickHandler(fn: () => void): void
}

export function createSideDock(): SideDock {
	injectDockStyles()

	const el = document.createElement("div")
	el.className = "bpmnkit-side-dock"

	// Pill-shaped collapse handle on the left edge
	const collapseHandle = document.createElement("div")
	collapseHandle.className = "bpmnkit-side-dock__collapse-handle"
	collapseHandle.setAttribute("role", "button")
	collapseHandle.setAttribute("title", "Collapse panel")
	collapseHandle.textContent = "›"

	// Resize handle — 5px drag zone on the left edge
	const resizeHandle = document.createElement("div")
	resizeHandle.className = "bpmnkit-side-dock__resize-handle"

	// Tab strip
	const tabStrip = document.createElement("div")
	tabStrip.className = "bpmnkit-side-dock__tab-strip"

	const propertiesTab = document.createElement("button")
	propertiesTab.className = "bpmnkit-side-dock__tab active"
	propertiesTab.textContent = "Properties"

	const historyTab = document.createElement("button")
	historyTab.className = "bpmnkit-side-dock__tab"
	historyTab.textContent = "History"
	historyTab.disabled = true

	const aiTab = document.createElement("button")
	aiTab.className = "bpmnkit-side-dock__tab"
	aiTab.textContent = "AI"

	const playTab = document.createElement("button")
	playTab.className = "bpmnkit-side-dock__tab"
	playTab.textContent = "Play"
	playTab.style.display = "none"

	const docsTab = document.createElement("button")
	docsTab.className = "bpmnkit-side-dock__tab"
	docsTab.textContent = "Docs"

	const deployTab = document.createElement("button")
	deployTab.className = "bpmnkit-side-dock__tab"
	deployTab.textContent = "Deploy"

	const testsTab = document.createElement("button")
	testsTab.className = "bpmnkit-side-dock__tab"
	testsTab.textContent = "Tests"
	testsTab.style.display = "none"

	tabStrip.appendChild(propertiesTab)
	tabStrip.appendChild(historyTab)
	tabStrip.appendChild(aiTab)
	tabStrip.appendChild(playTab)
	tabStrip.appendChild(docsTab)
	tabStrip.appendChild(deployTab)
	tabStrip.appendChild(testsTab)

	// Properties pane — contains the info empty state
	const propertiesPane = document.createElement("div")
	propertiesPane.className = "bpmnkit-side-dock__pane"

	const emptyEl = document.createElement("div")
	emptyEl.className = "bpmnkit-side-dock__empty"

	// Info rows (file name + process name)
	const fileRow = document.createElement("div")
	fileRow.className = "bpmnkit-side-dock__info-row"
	const fileLabel = document.createElement("span")
	fileLabel.className = "bpmnkit-side-dock__info-label"
	fileLabel.textContent = "File"
	const fileValue = document.createElement("span")
	fileValue.className = "bpmnkit-side-dock__info-value"
	fileValue.textContent = "\u2014"
	fileRow.appendChild(fileLabel)
	fileRow.appendChild(fileValue)

	const processRow = document.createElement("div")
	processRow.className = "bpmnkit-side-dock__info-row"
	const processLabel = document.createElement("span")
	processLabel.className = "bpmnkit-side-dock__info-label"
	processLabel.textContent = "Process"
	const processValue = document.createElement("span")
	processValue.className = "bpmnkit-side-dock__info-value"
	processValue.textContent = "\u2014"
	processRow.appendChild(processLabel)
	processRow.appendChild(processValue)

	const hint = document.createElement("div")
	hint.className = "bpmnkit-side-dock__empty-hint"
	hint.textContent = "Select an element to edit its properties"

	emptyEl.appendChild(fileRow)
	emptyEl.appendChild(processRow)
	emptyEl.appendChild(hint)
	propertiesPane.appendChild(emptyEl)

	// History pane
	const historyPane = document.createElement("div")
	historyPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	// AI pane
	const aiPane = document.createElement("div")
	aiPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	// Play pane
	const playPane = document.createElement("div")
	playPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	// Docs pane
	const docsPane = document.createElement("div")
	docsPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	// Deploy pane
	const deployPane = document.createElement("div")
	deployPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	// Tests pane
	const testsPane = document.createElement("div")
	testsPane.className = "bpmnkit-side-dock__pane bpmnkit-side-dock__pane--hidden"

	el.appendChild(collapseHandle)
	el.appendChild(resizeHandle)
	el.appendChild(tabStrip)
	el.appendChild(propertiesPane)
	el.appendChild(historyPane)
	el.appendChild(aiPane)
	el.appendChild(playPane)
	el.appendChild(docsPane)
	el.appendChild(deployPane)
	el.appendChild(testsPane)

	// ── State ──
	let _collapsed = false
	let _width = DEFAULT_WIDTH
	let _activeTab: "properties" | "history" | "ai" | "play" | "docs" | "deploy" | "tests" =
		"properties"
	let _aiTabHandler: (() => void) | null = null
	let _historyTabHandler: (() => void) | null = null
	let _playTabHandler: (() => void) | null = null
	let _docsTabHandler: (() => void) | null = null
	let _deployTabHandler: (() => void) | null = null
	let _testsTabHandler: (() => void) | null = null

	function setDocWidth(w: number): void {
		el.style.width = `${w}px`
		document.body.style.setProperty("--bpmnkit-dock-width", `${w}px`)
	}

	// Restore from localStorage
	try {
		const savedWidth = Number(localStorage.getItem(STORAGE_KEY_WIDTH))
		if (Number.isFinite(savedWidth) && savedWidth >= MIN_WIDTH && savedWidth <= MAX_WIDTH) {
			_width = savedWidth
		}
		_collapsed = localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true"
	} catch {
		// localStorage unavailable — use defaults
	}

	// Force collapse on narrow viewports (mobile)
	if (window.innerWidth <= 600) {
		_collapsed = true
	}

	if (_collapsed) {
		el.classList.add("bpmnkit-side-dock--collapsed")
		setDocWidth(0)
		collapseHandle.textContent = "‹"
		collapseHandle.setAttribute("title", "Expand panel")
	} else {
		setDocWidth(_width)
	}

	// Start hidden — the bridge shows it when the first tab is activated.
	el.style.display = "none"
	document.body.style.setProperty("--bpmnkit-dock-width", "0px")

	// ── Tab switching ──
	function switchTab(
		tab: "properties" | "history" | "ai" | "play" | "docs" | "deploy" | "tests",
	): void {
		_activeTab = tab
		propertiesTab.classList.toggle("active", tab === "properties")
		historyTab.classList.toggle("active", tab === "history")
		aiTab.classList.toggle("active", tab === "ai")
		playTab.classList.toggle("active", tab === "play")
		docsTab.classList.toggle("active", tab === "docs")
		deployTab.classList.toggle("active", tab === "deploy")
		testsTab.classList.toggle("active", tab === "tests")
		propertiesPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "properties")
		historyPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "history")
		aiPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "ai")
		playPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "play")
		docsPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "docs")
		deployPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "deploy")
		testsPane.classList.toggle("bpmnkit-side-dock__pane--hidden", tab !== "tests")
	}

	// ── Expand / collapse ──
	function expand(): void {
		_collapsed = false
		el.classList.remove("bpmnkit-side-dock--collapsed")
		setDocWidth(_width)
		collapseHandle.textContent = "›"
		collapseHandle.setAttribute("title", "Collapse panel")
		try {
			localStorage.setItem(STORAGE_KEY_COLLAPSED, "false")
		} catch {
			// ignore
		}
	}

	function collapse(): void {
		_collapsed = true
		el.classList.add("bpmnkit-side-dock--collapsed")
		setDocWidth(0)
		collapseHandle.textContent = "‹"
		collapseHandle.setAttribute("title", "Expand panel")
		try {
			localStorage.setItem(STORAGE_KEY_COLLAPSED, "true")
		} catch {
			// ignore
		}
	}

	// ── Empty state / panel visibility ──
	function showPanel(): void {
		emptyEl.style.display = "none"
	}

	function hidePanel(): void {
		emptyEl.style.display = ""
	}

	function setDiagramInfo(processName: string | null, fileName: string | null): void {
		fileValue.textContent = fileName ?? "\u2014"
		processValue.textContent = processName ?? "\u2014"
	}

	function setAiTabClickHandler(fn: () => void): void {
		_aiTabHandler = fn
	}

	function setHistoryTabClickHandler(fn: () => void): void {
		_historyTabHandler = fn
	}

	function setHistoryTabEnabled(enabled: boolean): void {
		historyTab.disabled = !enabled
		// If history tab is active and gets disabled, fall back to properties
		if (!enabled && historyTab.classList.contains("active")) {
			switchTab("properties")
		}
	}

	function setAiTabVisible(visible: boolean): void {
		aiTab.style.display = visible ? "" : "none"
		// If AI tab is hidden while active, fall back to properties
		if (!visible && aiTab.classList.contains("active")) {
			switchTab("properties")
		}
	}

	function setPlayTabVisible(visible: boolean): void {
		playTab.style.display = visible ? "" : "none"
		// If play tab is hidden while active, fall back to properties
		if (!visible && playTab.classList.contains("active")) {
			switchTab("properties")
		}
	}

	function setPlayTabClickHandler(fn: () => void): void {
		_playTabHandler = fn
	}

	function setDocsTabClickHandler(fn: () => void): void {
		_docsTabHandler = fn
	}

	function setDeployTabClickHandler(fn: () => void): void {
		_deployTabHandler = fn
	}

	function setTestsTabVisible(visible: boolean): void {
		testsTab.style.display = visible ? "" : "none"
		if (!visible && testsTab.classList.contains("active")) {
			switchTab("properties")
		}
	}

	function setTestsTabClickHandler(fn: () => void): void {
		_testsTabHandler = fn
	}

	function setVisible(visible: boolean): void {
		if (visible) {
			el.style.display = ""
			setDocWidth(_collapsed ? 0 : _width)
		} else {
			el.style.display = "none"
			document.body.style.setProperty("--bpmnkit-dock-width", "0px")
		}
	}

	// ── Event wiring ──
	propertiesTab.addEventListener("click", () => switchTab("properties"))
	historyTab.addEventListener("click", () => {
		switchTab("history")
		_historyTabHandler?.()
	})
	aiTab.addEventListener("click", () => {
		switchTab("ai")
		_aiTabHandler?.()
	})
	playTab.addEventListener("click", () => {
		switchTab("play")
		_playTabHandler?.()
	})
	docsTab.addEventListener("click", () => {
		switchTab("docs")
		_docsTabHandler?.()
	})
	deployTab.addEventListener("click", () => {
		switchTab("deploy")
		_deployTabHandler?.()
	})
	testsTab.addEventListener("click", () => {
		switchTab("tests")
		_testsTabHandler?.()
	})
	collapseHandle.addEventListener("click", () => {
		if (_collapsed) expand()
		else collapse()
	})

	resizeHandle.addEventListener("mousedown", (e) => {
		if (_collapsed) return
		e.preventDefault()
		// Disable CSS transition during drag for instant feedback
		el.style.transition = "none"
		const startX = e.clientX
		const startWidth = _width
		const onMove = (ev: MouseEvent) => {
			const dx = startX - ev.clientX
			_width = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + dx))
			setDocWidth(_width)
			try {
				localStorage.setItem(STORAGE_KEY_WIDTH, String(_width))
			} catch {
				// ignore
			}
		}
		const onUp = () => {
			// Re-enable CSS transition after drag
			el.style.transition = ""
			document.removeEventListener("mousemove", onMove)
			document.removeEventListener("mouseup", onUp)
		}
		document.addEventListener("mousemove", onMove)
		document.addEventListener("mouseup", onUp)
	})

	return {
		el,
		propertiesPane,
		historyPane,
		aiPane,
		playPane,
		docsPane,
		deployPane,
		testsPane,
		switchTab,
		expand,
		collapse,
		showPanel,
		hidePanel,
		setDiagramInfo,
		setVisible,
		setAiTabClickHandler,
		setAiTabVisible,
		setHistoryTabClickHandler,
		setHistoryTabEnabled,
		setPlayTabVisible,
		setPlayTabClickHandler,
		setDocsTabClickHandler,
		setDeployTabClickHandler,
		setTestsTabVisible,
		setTestsTabClickHandler,
		get collapsed() {
			return _collapsed
		},
		get activeTab() {
			return _activeTab
		},
	}
}
