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

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path fill="#060609" d="m0 166.67c0 -92.0493 74.6207 -166.67 166.67 -166.67l666.66003 0c44.203613 0 86.5968 17.559824 117.853455 48.816513c31.256714 31.256691 48.81653 73.64986 48.81653 117.853485l0 666.66003c0 92.049255 -74.62073 166.66998 -166.66998 166.66998l-666.66003 0c-92.0493 0 -166.67 -74.62073 -166.67 -166.66998z" fill-rule="evenodd"/><path fill="#e954c2" d="m80.49353 127.48857l84.734375 0q42.71875 0 63.03125 20.578125q20.3125 20.578125 20.3125 61.828125l0 13.0625q0 26.96875 -9.1875 44.812485q-9.171875 17.828125 -29.8125 20.0625l-0.09375 -0.9375q44.234375 8.796875 44.234375 69.0625l0 28.0q0 40.8125 -21.96875 62.78125q-21.96875 21.96875 -63.25 21.96875l-88.0 0l0 -341.21875zm78.671875 132.99998q12.328125 0 17.921875 -5.7656097q5.59375 -5.78125 5.59375 -21.484375l0 -18.203125q0 -15.203125 -4.421875 -20.765625q-4.40625 -5.5625 -14.421875 -5.5625l-17.453125 0l0 71.781235l12.78125 0zm9.328125 146.98438q10.296875 0 14.8125 -4.984375q4.515625 -5.0 4.515625 -19.921875l0 -28.46875q0 -19.625 -5.703125 -26.0q-5.6875 -6.390625 -20.15625 -6.390625l-15.578125 0l0 85.765625l22.109375 0zm115.10724 -279.98438l82.875 0q41.4375 0 62.625 22.75q21.1875 22.734375 21.1875 65.265625l0 32.1875q0 42.531235 -21.1875 65.281235q-21.1875 22.734375 -62.625 22.734375l-16.984375 0l0 133.0l-65.890625 0l0 -341.21875zm82.875 146.99998q9.359375 0 13.640625 -4.75q4.28125 -4.765625 4.28125 -18.781235l0 -38.71875q0 -14.015625 -4.28125 -18.765625q-4.28125 -4.765625 -13.640625 -4.765625l-16.984375 0l0 85.781235l16.984375 0zm111.83243 -146.99998l86.859406 0l27.28125 239.99998l-0.9375 0l27.265625 -239.99998l86.875 0l0 341.21875l-63.09375 0l6.359375 -253.68748l0.921875 0.15625l-32.0 253.53123l-55.453125 0l-32.0 -253.53123l0.921875 -0.15625l6.359375 253.68748l-59.359406 0l0 -341.21875zm265.6392 0l77.328125 0l45.203125 201.62498l-0.921875 0.265625l-6.359375 -201.89061l60.296875 0l0 341.21875l-65.65625 0l-56.890625 -244.54686l0.9375 -0.265625l6.34375 244.81248l-60.28125 0l0 -341.21875z" fill-rule="nonzero"/><path fill="#ffffff" d="m270.9452 522.1202l65.890625 0l0 112.609375l53.4375 -112.609375l67.828125 0l-65.203125 127.90625l64.03125 213.3125l-68.875 0l-39.65625 -133.03125l-11.5625 23.390625l0 109.640625l-65.890625 0l0 -341.21875zm207.7738 0l65.890625 0l0 341.21875l-65.890625 0l0 -341.21875zm144.30109 61.21875l-53.671875 0l0 -61.21875l173.23438 0l0 61.21875l-53.671875 0l0 280.0l-65.890625 0l0 -280.0z" fill-rule="nonzero"/></svg>`

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
