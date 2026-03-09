const DOCK_STYLE_ID = "bpmn-side-dock-styles-v1"
const STORAGE_KEY_WIDTH = "bpmn-side-dock-width"
const STORAGE_KEY_COLLAPSED = "bpmn-side-dock-collapsed"
const MIN_WIDTH = 280
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 360

const DOCK_CSS = `
/* ── Side Dock ──────────────────────────────────────────────────────────── */
.bpmn-side-dock__tab:disabled { opacity: 0.3; cursor: default; }
.bpmn-side-dock {
  position: fixed; right: 0; top: 36px; bottom: 0;
  z-index: 9999; display: flex; flex-direction: column;
  background: rgba(18, 18, 26, 0.98);
  border-left: 1px solid rgba(255,255,255,0.1);
  box-shadow: -8px 0 40px rgba(0,0,0,0.6);
  font-family: system-ui, -apple-system, sans-serif;
  transition: width 0.22s ease;
}
/* Pill handle — sticks out from the left edge; always visible + clickable */
.bpmn-side-dock__collapse-handle {
  position: absolute; left: -20px; top: 50%; transform: translateY(-50%);
  width: 20px; height: 52px;
  background: rgba(18, 18, 26, 0.98);
  border: 1px solid rgba(255,255,255,0.1); border-right: none;
  border-radius: 8px 0 0 8px;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; z-index: 1;
  color: rgba(255,255,255,0.45); font-size: 14px; line-height: 1;
  transition: color 0.1s, background 0.1s;
  user-select: none;
}
.bpmn-side-dock__collapse-handle:hover { color: #fff; background: rgba(40,40,60,0.99); }
.bpmn-side-dock__resize-handle {
  position: absolute; left: 0; top: 0; bottom: 0;
  width: 5px; cursor: ew-resize; z-index: 2;
}
.bpmn-side-dock__resize-handle:hover { background: rgba(76,142,247,0.35); }
.bpmn-side-dock__tab-strip {
  display: flex; align-items: center; height: 38px; flex-shrink: 0;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.bpmn-side-dock__tab {
  padding: 0 16px; height: 100%; background: none; border: none;
  border-bottom: 2px solid transparent; color: rgba(255,255,255,0.4);
  cursor: pointer; font-size: 12px; font-weight: 500; white-space: nowrap;
  transition: color 0.1s, border-color 0.1s;
  font-family: system-ui, -apple-system, sans-serif;
}
.bpmn-side-dock__tab:hover { color: rgba(255,255,255,0.75); }
.bpmn-side-dock__tab.active { color: #4c8ef7; border-bottom-color: #4c8ef7; }
.bpmn-side-dock__pane {
  flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 0;
}
.bpmn-side-dock__pane--hidden { display: none; }
/* Empty state — info widget + hint, shown when no element is selected */
.bpmn-side-dock__empty {
  flex: 1; display: flex; flex-direction: column;
  overflow-y: auto; padding: 14px 16px;
  gap: 0;
}
.bpmn-side-dock__info-row {
  display: flex; flex-direction: column;
  padding: 10px 0;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  gap: 3px;
}
.bpmn-side-dock__info-label {
  font-size: 10px; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; color: rgba(255,255,255,0.3);
}
.bpmn-side-dock__info-value {
  font-size: 13px; color: rgba(255,255,255,0.75); word-break: break-word;
}
.bpmn-side-dock__empty-hint {
  font-size: 12px; color: rgba(255,255,255,0.25);
  text-align: center; padding: 20px 0;
}
/* Collapsed state — only the pill handle remains visible */
.bpmn-side-dock--collapsed .bpmn-side-dock__tab-strip,
.bpmn-side-dock--collapsed .bpmn-side-dock__pane { display: none; }
/* Push watermark left of the dock using a CSS variable updated by JS */
.bpmn-watermark { right: calc(var(--bpmn-dock-width, 0px) + 8px) !important; }
/* Light theme */
[data-bpmn-hud-theme="light"] .bpmn-side-dock {
  background: rgba(248,248,252,0.99); border-left-color: rgba(0,0,0,0.08);
  box-shadow: -8px 0 40px rgba(0,0,0,0.12);
}
[data-bpmn-hud-theme="light"] .bpmn-side-dock__collapse-handle {
  background: rgba(248,248,252,0.99); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.4);
}
[data-bpmn-hud-theme="light"] .bpmn-side-dock__collapse-handle:hover {
  background: rgba(235,235,242,0.99); color: rgba(0,0,0,0.9);
}
[data-bpmn-hud-theme="light"] .bpmn-side-dock__tab-strip { border-bottom-color: rgba(0,0,0,0.07); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__tab { color: rgba(0,0,0,0.4); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__tab:hover { color: rgba(0,0,0,0.7); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__tab.active { color: #1a56db; border-bottom-color: #1a56db; }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__resize-handle:hover { background: rgba(26,86,219,0.2); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__info-label { color: rgba(0,0,0,0.3); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__info-value { color: rgba(0,0,0,0.75); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__info-row { border-bottom-color: rgba(0,0,0,0.06); }
[data-bpmn-hud-theme="light"] .bpmn-side-dock__empty-hint { color: rgba(0,0,0,0.25); }
`

function injectDockStyles(): void {
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
	switchTab(tab: "properties" | "history" | "ai" | "play" | "docs"): void
	expand(): void
	collapse(): void
	get collapsed(): boolean
	get activeTab(): "properties" | "history" | "ai" | "play" | "docs"
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
}

export function createSideDock(): SideDock {
	injectDockStyles()

	const el = document.createElement("div")
	el.className = "bpmn-side-dock"

	// Pill-shaped collapse handle on the left edge
	const collapseHandle = document.createElement("div")
	collapseHandle.className = "bpmn-side-dock__collapse-handle"
	collapseHandle.setAttribute("role", "button")
	collapseHandle.setAttribute("title", "Collapse panel")
	collapseHandle.textContent = "›"

	// Resize handle — 5px drag zone on the left edge
	const resizeHandle = document.createElement("div")
	resizeHandle.className = "bpmn-side-dock__resize-handle"

	// Tab strip
	const tabStrip = document.createElement("div")
	tabStrip.className = "bpmn-side-dock__tab-strip"

	const propertiesTab = document.createElement("button")
	propertiesTab.className = "bpmn-side-dock__tab active"
	propertiesTab.textContent = "Properties"

	const historyTab = document.createElement("button")
	historyTab.className = "bpmn-side-dock__tab"
	historyTab.textContent = "History"
	historyTab.disabled = true

	const aiTab = document.createElement("button")
	aiTab.className = "bpmn-side-dock__tab"
	aiTab.textContent = "AI"

	const playTab = document.createElement("button")
	playTab.className = "bpmn-side-dock__tab"
	playTab.textContent = "Play"
	playTab.style.display = "none"

	const docsTab = document.createElement("button")
	docsTab.className = "bpmn-side-dock__tab"
	docsTab.textContent = "Docs"

	tabStrip.appendChild(propertiesTab)
	tabStrip.appendChild(historyTab)
	tabStrip.appendChild(aiTab)
	tabStrip.appendChild(playTab)
	tabStrip.appendChild(docsTab)

	// Properties pane — contains the info empty state
	const propertiesPane = document.createElement("div")
	propertiesPane.className = "bpmn-side-dock__pane"

	const emptyEl = document.createElement("div")
	emptyEl.className = "bpmn-side-dock__empty"

	// Info rows (file name + process name)
	const fileRow = document.createElement("div")
	fileRow.className = "bpmn-side-dock__info-row"
	const fileLabel = document.createElement("span")
	fileLabel.className = "bpmn-side-dock__info-label"
	fileLabel.textContent = "File"
	const fileValue = document.createElement("span")
	fileValue.className = "bpmn-side-dock__info-value"
	fileValue.textContent = "\u2014"
	fileRow.appendChild(fileLabel)
	fileRow.appendChild(fileValue)

	const processRow = document.createElement("div")
	processRow.className = "bpmn-side-dock__info-row"
	const processLabel = document.createElement("span")
	processLabel.className = "bpmn-side-dock__info-label"
	processLabel.textContent = "Process"
	const processValue = document.createElement("span")
	processValue.className = "bpmn-side-dock__info-value"
	processValue.textContent = "\u2014"
	processRow.appendChild(processLabel)
	processRow.appendChild(processValue)

	const hint = document.createElement("div")
	hint.className = "bpmn-side-dock__empty-hint"
	hint.textContent = "Select an element to edit its properties"

	emptyEl.appendChild(fileRow)
	emptyEl.appendChild(processRow)
	emptyEl.appendChild(hint)
	propertiesPane.appendChild(emptyEl)

	// History pane
	const historyPane = document.createElement("div")
	historyPane.className = "bpmn-side-dock__pane bpmn-side-dock__pane--hidden"

	// AI pane
	const aiPane = document.createElement("div")
	aiPane.className = "bpmn-side-dock__pane bpmn-side-dock__pane--hidden"

	// Play pane
	const playPane = document.createElement("div")
	playPane.className = "bpmn-side-dock__pane bpmn-side-dock__pane--hidden"

	// Docs pane
	const docsPane = document.createElement("div")
	docsPane.className = "bpmn-side-dock__pane bpmn-side-dock__pane--hidden"

	el.appendChild(collapseHandle)
	el.appendChild(resizeHandle)
	el.appendChild(tabStrip)
	el.appendChild(propertiesPane)
	el.appendChild(historyPane)
	el.appendChild(aiPane)
	el.appendChild(playPane)
	el.appendChild(docsPane)

	// ── State ──
	let _collapsed = false
	let _width = DEFAULT_WIDTH
	let _activeTab: "properties" | "history" | "ai" | "play" | "docs" = "properties"
	let _aiTabHandler: (() => void) | null = null
	let _historyTabHandler: (() => void) | null = null
	let _playTabHandler: (() => void) | null = null
	let _docsTabHandler: (() => void) | null = null

	function setDocWidth(w: number): void {
		el.style.width = `${w}px`
		document.body.style.setProperty("--bpmn-dock-width", `${w}px`)
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

	if (_collapsed) {
		el.classList.add("bpmn-side-dock--collapsed")
		setDocWidth(0)
		collapseHandle.textContent = "‹"
		collapseHandle.setAttribute("title", "Expand panel")
	} else {
		setDocWidth(_width)
	}

	// Start hidden — the bridge shows it when the first tab is activated.
	el.style.display = "none"
	document.body.style.setProperty("--bpmn-dock-width", "0px")

	// ── Tab switching ──
	function switchTab(tab: "properties" | "history" | "ai" | "play" | "docs"): void {
		_activeTab = tab
		propertiesTab.classList.toggle("active", tab === "properties")
		historyTab.classList.toggle("active", tab === "history")
		aiTab.classList.toggle("active", tab === "ai")
		playTab.classList.toggle("active", tab === "play")
		docsTab.classList.toggle("active", tab === "docs")
		propertiesPane.classList.toggle("bpmn-side-dock__pane--hidden", tab !== "properties")
		historyPane.classList.toggle("bpmn-side-dock__pane--hidden", tab !== "history")
		aiPane.classList.toggle("bpmn-side-dock__pane--hidden", tab !== "ai")
		playPane.classList.toggle("bpmn-side-dock__pane--hidden", tab !== "play")
		docsPane.classList.toggle("bpmn-side-dock__pane--hidden", tab !== "docs")
	}

	// ── Expand / collapse ──
	function expand(): void {
		_collapsed = false
		el.classList.remove("bpmn-side-dock--collapsed")
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
		el.classList.add("bpmn-side-dock--collapsed")
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

	function setVisible(visible: boolean): void {
		if (visible) {
			el.style.display = ""
			setDocWidth(_collapsed ? 0 : _width)
		} else {
			el.style.display = "none"
			document.body.style.setProperty("--bpmn-dock-width", "0px")
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
		switchTab,
		expand,
		collapse,
		showPanel,
		hidePanel,
		setDiagramInfo,
		setVisible,
		setAiTabClickHandler,
		setHistoryTabClickHandler,
		setHistoryTabEnabled,
		setPlayTabVisible,
		setPlayTabClickHandler,
		setDocsTabClickHandler,
		get collapsed() {
			return _collapsed
		},
		get activeTab() {
			return _activeTab
		},
	}
}
