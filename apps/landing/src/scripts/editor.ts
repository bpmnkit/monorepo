import type { CanvasApi, CanvasPlugin } from "@bpmnkit/canvas"
import { Bpmn, Dmn, Form } from "@bpmnkit/core"
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmnkit/editor"
import type { Tool } from "@bpmnkit/editor"
import { Engine } from "@bpmnkit/engine"
import { createAiBridgePlugin } from "@bpmnkit/plugins/ai-bridge"
import { createAsciiViewPlugin } from "@bpmnkit/plugins/ascii-view"
import { createCommandPalettePlugin } from "@bpmnkit/plugins/command-palette"
import { createCommandPaletteEditorPlugin } from "@bpmnkit/plugins/command-palette-editor"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { createElementDocsPlugin } from "@bpmnkit/plugins/element-docs"
import { createHistoryPanel, saveCheckpoint } from "@bpmnkit/plugins/history"
import { createMainMenuPlugin } from "@bpmnkit/plugins/main-menu"
import { createOptimizePlugin } from "@bpmnkit/plugins/optimize"
import { createProcessRunnerPlugin } from "@bpmnkit/plugins/process-runner"
import { InMemoryFileResolver, createStorageTabsBridge } from "@bpmnkit/plugins/storage-tabs-bridge"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { createWatermarkPlugin } from "@bpmnkit/plugins/watermark"
import { createZoomControlsPlugin } from "@bpmnkit/plugins/zoom-controls"
import { makeExamples } from "./examples.js"
import { savePng, saveSvg } from "./export.js"

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="oklch(9% 0.025 270)"/>
  <polygon points="50,10 90,50 50,90 10,50" fill="oklch(55% 0.22 280)"/>
  <line x1="50" y1="27" x2="50" y2="73" stroke="oklch(9% 0.025 270)" stroke-width="7.5" stroke-linecap="round"/>
  <line x1="27" y1="50" x2="73" y2="50" stroke="oklch(9% 0.025 270)" stroke-width="7.5" stroke-linecap="round"/>
</svg>`

const IMPORT_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 5l3-3 3 3"/><path d="M2 13h12"/></svg>'

const EXPORT_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V2M5 7l3 3 3-3"/><path d="M2 13h12"/></svg>'

// Captures the CanvasApi once installed so export callbacks can use it.
let _exportApi: CanvasApi | null = null
const exportCapturePlugin: CanvasPlugin = {
	name: "export-capture",
	install(api) {
		_exportApi = api
	},
}

// ── Setup ──────────────────────────────────────────────────────────────────────

const editorContainer = document.getElementById("editor-container")
if (!editorContainer) throw new Error("missing #editor-container")

const resolver = new InMemoryFileResolver()

let editorRef: BpmnEditor | null = null
let currentFileName: string | null = null
let hudRef: {
	setActive(active: boolean): void
	showOnboarding(): void
	hideOnboarding(): void
	setSimulationActive(active: boolean): void
} | null = null

/** Returns true when the XML is a freshly-created empty diagram (only a start event). */
function isNewEmptyDiagram(xml: string): boolean {
	return (
		!xml.includes("sequenceFlow") &&
		!xml.includes("endEvent") &&
		!xml.includes(":task") &&
		!xml.includes(":gateway") &&
		!xml.includes("subProcess") &&
		!xml.includes("callActivity") &&
		!xml.includes("intermediateThrowEvent") &&
		!xml.includes("intermediateCatchEvent")
	)
}

const BPMN_ONLY_HUD = ["hud-top-center", "hud-bottom-left", "hud-bottom-center"]

function setHudVisible(visible: boolean): void {
	for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
		el.style.display = visible ? "" : "none"
	}
	const menuPanel = document.querySelector<HTMLElement>(".bpmnkit-main-menu-panel")
	if (menuPanel) menuPanel.style.display = visible ? "" : "none"
}

// ── Side dock ─────────────────────────────────────────────────────────────────

const dock = createSideDock()
document.body.appendChild(dock.el)

// ── Main menu ─────────────────────────────────────────────────────────────────

const mainMenuPlugin = createMainMenuPlugin({
	title: "BPMN Kit",
	menuItems: [
		{
			type: "drill",
			label: "New\u2026",
			items: [
				{
					label: "New BPMN diagram",
					onClick: () => {
						bridge.tabsPlugin.api.openTab({
							type: "bpmn",
							xml: Bpmn.makeEmpty(),
							name: "New Diagram",
						})
					},
				},
				{
					label: "New DMN table",
					onClick: () => {
						const defs = Dmn.makeEmpty()
						resolver.registerDmn(defs)
						bridge.tabsPlugin.api.openTab({ type: "dmn", defs, name: "New Decision" })
					},
				},
				{
					label: "New Form",
					onClick: () => {
						const id = `Form_${Math.random().toString(36).slice(2, 9)}`
						bridge.tabsPlugin.api.openTab({
							type: "form",
							form: { id, type: "default", components: [] },
							name: "New Form",
						})
					},
				},
			],
		},
		{
			label: "Import files\u2026",
			icon: IMPORT_ICON,
			onClick: () => bridge.tabsPlugin.api.openFilePicker(),
		},
		{
			type: "drill",
			label: "Export\u2026",
			icon: EXPORT_ICON,
			items: () => {
				const name = currentFileName?.replace(/\.bpmn$/, "") ?? "diagram"
				return [
					{
						label: "Save as SVG",
						onClick: () => {
							if (_exportApi) saveSvg(_exportApi, name)
						},
					},
					{
						label: "Save as PNG",
						onClick: () => {
							if (_exportApi) savePng(_exportApi, name)
						},
					},
					{
						label: "Export BPMN\u2026",
						onClick: () => {
							const allTabs = bridge.tabsPlugin.api.getAllTabContent()
							const tab =
								allTabs.find((t) => t.type === "bpmn" && t.name === currentFileName) ??
								allTabs.find((t) => t.type === "bpmn")
							if (!tab) return
							const blob = new Blob([tab.content], { type: "application/xml" })
							const url = URL.createObjectURL(blob)
							const a = document.createElement("a")
							a.href = url
							a.download = currentFileName ?? `${name}.bpmn`
							a.click()
							URL.revokeObjectURL(url)
						},
					},
				]
			},
		},
		{
			label: "FEEL Playground",
			onClick: () => bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
		},
	],
})

// ── Plugins ───────────────────────────────────────────────────────────────────

const palette = createCommandPalettePlugin({
	onZenModeChange(active) {
		for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
			el.style.display = active ? "none" : ""
		}
		editorRef?.setReadOnly(active)
	},
})

const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
	editorRef?.setTool(tool as Tool)
})

const configPanel = createConfigPanelPlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	applyChange: (fn) => {
		editorRef?.applyChange(fn)
	},
	container: dock.propertiesPane,
	onPanelShow: () => {
		if (dock.collapsed) dock.expand()
		dock.showPanel()
	},
	onPanelHide: () => {
		dock.hidePanel()
	},
	openInPlayground: (expression) => {
		bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression })
	},
})

// ── Process runner ────────────────────────────────────────────────────────────

const tokenHighlightPlugin = createTokenHighlightPlugin()
const processRunnerPlugin = createProcessRunnerPlugin({
	engine: new Engine(),
	tokenHighlight: tokenHighlightPlugin,
	playContainer: dock.playPane,
	onShowPlayTab() {
		dock.setPlayTabVisible(true)
		if (dock.collapsed) dock.expand()
		dock.switchTab("play")
	},
	onHidePlayTab() {
		dock.setPlayTabVisible(false)
	},
	onEnterPlayMode() {
		const el = document.getElementById("hud-bottom-center")
		if (el) el.style.display = "none"
		processRunnerPlugin.toolbar.style.display = ""
		dock.propertiesPane.classList.add("bpmnkit-props-readonly")
		bridge.tabsPlugin.api.setPlayMode(true)
		hudRef?.setSimulationActive(true)
	},
	onExitPlayMode() {
		const el = document.getElementById("hud-bottom-center")
		if (el) el.style.display = currentFileName !== null ? "" : "none"
		processRunnerPlugin.toolbar.style.display = "none"
		dock.propertiesPane.classList.remove("bpmnkit-props-readonly")
		bridge.tabsPlugin.api.setPlayMode(false)
		hudRef?.setSimulationActive(false)
	},
	getProjectId: () => bridge.storagePlugin.api.getCurrentContext()?.projectId ?? null,
})

// Position runner toolbar at bottom center, hidden until play mode activates
processRunnerPlugin.toolbar.classList.add("bpmnkit-runner-toolbar--hud-bottom")
processRunnerPlugin.toolbar.style.display = "none"
document.body.appendChild(processRunnerPlugin.toolbar)

// ── Storage + Tabs bridge ─────────────────────────────────────────────────────

const bridge = createStorageTabsBridge({
	mainMenu: mainMenuPlugin,
	resolver,
	getExamples: (api) => makeExamples(api, resolver),
	initialTitle: "BPMN Kit",
	palette,
	enableFileImport: true,
	sideDock: dock,
	onNewDiagram: () => {
		bridge.tabsPlugin.api.openTab({ type: "bpmn", xml: Bpmn.makeEmpty(), name: "New Diagram" })
	},
	onWelcomeShow: () => {
		setHudVisible(false)
		hudRef?.setActive(false)
		dock.setHistoryTabEnabled(false)
	},
	onRawModeChange: (active) => {
		// Top-center toolbar: disable all buttons while in raw mode
		const topCenter = document.getElementById("hud-top-center")
		if (topCenter) {
			for (const btn of topCenter.querySelectorAll<HTMLButtonElement>("button")) {
				btn.disabled = active
			}
		}
		// Bottom-center toolbar: hide while in raw mode
		const bottomCenter = document.getElementById("hud-bottom-center")
		if (bottomCenter)
			bottomCenter.style.display = active ? "none" : currentFileName !== null ? "" : "none"
		// Side dock: collapse and lock while in raw mode
		if (active) {
			dock.collapse()
			dock.el.style.pointerEvents = "none"
			dock.el.style.opacity = "0.4"
		} else {
			dock.expand()
			dock.el.style.pointerEvents = ""
			dock.el.style.opacity = ""
		}
	},
	onTabActivate(id, config) {
		const isBpmn = config.type === "bpmn"
		const showOnboard = isBpmn && !!config.xml && isNewEmptyDiagram(config.xml)
		setHudVisible(true)
		hudRef?.setActive(isBpmn)
		if (isBpmn && config.xml && !showOnboard) {
			editorRef?.load(config.xml)
		}
		for (const hudId of BPMN_ONLY_HUD) {
			const el = document.getElementById(hudId)
			if (el) el.style.display = isBpmn ? "" : "none"
		}
		// showOnboarding/hideOnboarding must come AFTER the BPMN_ONLY_HUD loop
		// because that loop resets display on the bottom toolbar.
		if (showOnboard) {
			hudRef?.showOnboarding()
		} else {
			hudRef?.hideOnboarding()
		}
		if (!isBpmn) {
			editorRef?.setSelection([])
		}
		currentFileName = isBpmn ? (config.name ?? null) : null
		dock.setDiagramInfo(
			isBpmn ? (editorRef?.getDefinitions()?.processes[0]?.name ?? null) : null,
			currentFileName,
		)
		// Defer: the bridge sets the storage file ID synchronously after openTab() returns,
		// which is after this callback fires. A microtask runs after all sync code settles.
		void Promise.resolve().then(() => {
			const hasStorageCtx = isBpmn && bridge.storagePlugin.api.getCurrentContext() !== null
			dock.setHistoryTabEnabled(hasStorageCtx)
		})
	},
})

const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
	openFeelPlayground: (expression) => {
		bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression })
	},
})

const optimizePlugin = createOptimizePlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	reload: (xml) => {
		editorRef?.load(xml)
	},
	openTab: (xml, name) => bridge.tabsPlugin.api.openTab({ type: "bpmn", xml, name }),
})

const asciiViewPlugin = createAsciiViewPlugin({
	getXml: () => {
		const defs = editorRef?.getDefinitions()
		return defs ? Bpmn.export(defs) : null
	},
})

const aiBridgePlugin = createAiBridgePlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	loadXml: (xml) => {
		editorRef?.load(xml)
	},
	getCurrentContext: () => bridge.storagePlugin.api.getCurrentContext(),
	container: dock.aiPane,
	onOpen: () => {
		if (dock.collapsed) dock.expand()
		dock.switchTab("ai")
	},
	createCompanionFile: async (name, type, content) => {
		const ctx = bridge.storagePlugin.api.getCurrentContext()
		if (ctx) {
			// Find workspaceId from the current file's record
			const files = await bridge.storagePlugin.api.getFiles(ctx.projectId)
			const currentFile = files.find((f) => f.id === ctx.fileId)
			if (currentFile) {
				const file = await bridge.storagePlugin.api.createFile(
					ctx.projectId,
					currentFile.workspaceId,
					name,
					type,
					content,
				)
				await bridge.storagePlugin.api.openFile(file.id)
				return
			}
		}
		// No storage context (or file lookup failed) — open as an unsaved tab
		if (type === "dmn") {
			const defs = Dmn.parse(content)
			bridge.tabsPlugin.api.openTab({ type: "dmn", defs, name })
		} else {
			const form = Form.parse(content)
			bridge.tabsPlugin.api.openTab({ type: "form", form, name })
		}
	},
})

// Wire AI tab click to initialize+open the panel (it's lazily created on first use)
dock.setAiTabClickHandler(() => {
	if (dock.collapsed) dock.expand()
	aiBridgePlugin.openPanel()
})

// Docs plugin — mounted into the Docs pane
const elementDocsPlugin = createElementDocsPlugin({ container: dock.docsPane })
dock.setDocsTabClickHandler(() => {
	if (dock.collapsed) dock.expand()
})

// History pane
const historyPanel = createHistoryPanel({
	getCurrentContext: () => bridge.storagePlugin.api.getCurrentContext(),
	loadXml: (xml) => {
		editorRef?.load(xml)
	},
})
dock.historyPane.appendChild(historyPanel.el)
dock.setHistoryTabClickHandler(() => {
	void historyPanel.refresh()
})

palette.addCommands([
	{
		id: "feel-playground",
		title: "FEEL Playground",
		action: () => bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
	},
])

// ── Editor ────────────────────────────────────────────────────────────────────

const editor = new BpmnEditor({
	container: editorContainer,
	xml: Bpmn.SAMPLE_XML,
	persistTheme: true,
	grid: true,
	fit: "center",
	plugins: [
		mainMenuPlugin,
		exportCapturePlugin,
		createZoomControlsPlugin(),
		createWatermarkPlugin({
			links: [{ label: "Github", url: "https://github.com/bpmnkit/monorepo" }],
			logo: LOGO_SVG,
		}),
		bridge.tabsPlugin,
		bridge.storagePlugin,
		bridge.bridgePlugin,
		palette,
		paletteEditor,
		configPanel,
		configPanelBpmn,
		tokenHighlightPlugin,
		processRunnerPlugin,
		aiBridgePlugin,
		elementDocsPlugin,
	],
})
editorRef = editor

// Keep dock diagram info up-to-date on diagram changes; save checkpoints on auto-save cadence
type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void
const editorOn = (editor as unknown as { on: AnyOn }).on.bind(editor)

let _checkpointTimer: ReturnType<typeof setTimeout> | null = null
editorOn("diagram:change", () => {
	dock.setDiagramInfo(editorRef?.getDefinitions()?.processes[0]?.name ?? null, currentFileName)

	// Save a checkpoint ~600 ms after the last change (auto-save runs at 500 ms).
	// Only for files that are persisted in storage (context must be available).
	if (_checkpointTimer !== null) clearTimeout(_checkpointTimer)
	_checkpointTimer = setTimeout(() => {
		_checkpointTimer = null
		const ctx = bridge.storagePlugin.api.getCurrentContext()
		if (!ctx) return
		const defs = editorRef?.getDefinitions()
		if (!defs) return
		void saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(defs))
	}, 600)
})

hudRef = initEditorHud(editor, {
	openProcess: (processId) => bridge.tabsPlugin.api.navigateToProcess(processId),
	getAvailableProcesses: () => bridge.tabsPlugin.api.getAvailableProcesses(),
	createProcess: (name, onCreated) => {
		const processId = `Process_${Math.random().toString(36).slice(2, 9)}`
		onCreated(processId)
		bridge.tabsPlugin.api.openTab({ type: "bpmn", xml: Bpmn.makeEmpty(processId, name), name })
	},
	openDecision: (decisionId) => bridge.tabsPlugin.api.openDecision(decisionId),
	getAvailableDecisions: () => bridge.tabsPlugin.api.getAvailableDecisions(),
	openForm: (formId) => bridge.tabsPlugin.api.openForm(formId),
	getAvailableForms: () => bridge.tabsPlugin.api.getAvailableForms(),
	rawModeButton: bridge.tabsPlugin.api.rawModeButton,
	optimizeButton: optimizePlugin.button,
	playButton: processRunnerPlugin.playButton,
	asciiButton: asciiViewPlugin.button,
	onStartFromScratch: () => {
		editorRef?.load(Bpmn.makeEmpty())
	},
	onGenerateExample: () => {
		editorRef?.load(Bpmn.SAMPLE_XML)
	},
	onAskAi: () => {
		if (dock.collapsed) dock.expand()
		dock.switchTab("ai")
		aiBridgePlugin.openPanel()
	},
	onGatewayEdgeCreated: () => {
		// Expand dock and switch to properties so user can set condition immediately
		if (dock.collapsed) dock.expand()
		dock.switchTab("properties")
	},
	onExitSimulation: () => {
		processRunnerPlugin.exitPlayMode()
	},
})
