import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import { createAiBridgePlugin } from "@bpmn-sdk/canvas-plugin-ai-bridge";
import { createAsciiViewPlugin } from "@bpmn-sdk/canvas-plugin-ascii-view";
import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
import { createHistoryPanel, saveCheckpoint } from "@bpmn-sdk/canvas-plugin-history";
import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
import { createOptimizePlugin } from "@bpmn-sdk/canvas-plugin-optimize";
import { createProcessRunnerPlugin } from "@bpmn-sdk/canvas-plugin-process-runner";
import {
	InMemoryFileResolver,
	createStorageTabsBridge,
} from "@bpmn-sdk/canvas-plugin-storage-tabs-bridge";
import { createTokenHighlightPlugin } from "@bpmn-sdk/canvas-plugin-token-highlight";
import { createWatermarkPlugin } from "@bpmn-sdk/canvas-plugin-watermark";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
import { Bpmn, Dmn } from "@bpmn-sdk/core";
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";
import { Engine } from "@bpmn-sdk/engine";
import { makeExamples } from "./examples.js";
import { savePng, saveSvg } from "./export.js";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="4" fill="#0062ff"/>
  <circle cx="5" cy="12" r="2.5" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="7.5" y1="12" x2="9" y2="12" stroke="white" stroke-width="1.5"/>
  <rect x="9" y="9.5" width="6" height="5" rx="1" fill="none" stroke="white" stroke-width="1.5"/>
  <line x1="15" y1="12" x2="16.5" y2="12" stroke="white" stroke-width="1.5"/>
  <circle cx="19" cy="12" r="2.5" fill="none" stroke="white" stroke-width="2.5"/>
</svg>`;

const IMPORT_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v8M5 5l3-3 3 3"/><path d="M2 13h12"/></svg>';

const EXPORT_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 10V2M5 7l3 3 3-3"/><path d="M2 13h12"/></svg>';

// Captures the CanvasApi once installed so export callbacks can use it.
let _exportApi: CanvasApi | null = null;
const exportCapturePlugin: CanvasPlugin = {
	name: "export-capture",
	install(api) {
		_exportApi = api;
	},
};

// ── Setup ──────────────────────────────────────────────────────────────────────

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

const resolver = new InMemoryFileResolver();

let editorRef: BpmnEditor | null = null;
let currentFileName: string | null = null;

const BPMN_ONLY_HUD = ["hud-top-center", "hud-bottom-left", "hud-bottom-center"];

function setHudVisible(visible: boolean): void {
	for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
		el.style.display = visible ? "" : "none";
	}
	const menuPanel = document.querySelector<HTMLElement>(".bpmn-main-menu-panel");
	if (menuPanel) menuPanel.style.display = visible ? "" : "none";
}

// ── Side dock ─────────────────────────────────────────────────────────────────

const dock = createSideDock();
document.body.appendChild(dock.el);

// ── Main menu ─────────────────────────────────────────────────────────────────

const mainMenuPlugin = createMainMenuPlugin({
	title: "BPMN SDK",
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
						});
					},
				},
				{
					label: "New DMN table",
					onClick: () => {
						const defs = Dmn.makeEmpty();
						resolver.registerDmn(defs);
						bridge.tabsPlugin.api.openTab({ type: "dmn", defs, name: "New Decision" });
					},
				},
				{
					label: "New Form",
					onClick: () => {
						const id = `Form_${Math.random().toString(36).slice(2, 9)}`;
						bridge.tabsPlugin.api.openTab({
							type: "form",
							form: { id, type: "default", components: [] },
							name: "New Form",
						});
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
				const name = currentFileName?.replace(/\.bpmn$/, "") ?? "diagram";
				return [
					{
						label: "Save as SVG",
						onClick: () => {
							if (_exportApi) saveSvg(_exportApi, name);
						},
					},
					{
						label: "Save as PNG",
						onClick: () => {
							if (_exportApi) savePng(_exportApi, name);
						},
					},
				];
			},
		},
		{
			label: "FEEL Playground",
			onClick: () => bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
		},
	],
});

// ── Plugins ───────────────────────────────────────────────────────────────────

const palette = createCommandPalettePlugin({
	onZenModeChange(active) {
		for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
			el.style.display = active ? "none" : "";
		}
		editorRef?.setReadOnly(active);
	},
});

const paletteEditor = createCommandPaletteEditorPlugin(palette, (tool) => {
	editorRef?.setTool(tool as Tool);
});

const configPanel = createConfigPanelPlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	applyChange: (fn) => {
		editorRef?.applyChange(fn);
	},
	container: dock.propertiesPane,
	onPanelShow: () => {
		if (dock.collapsed) dock.expand();
		dock.showPanel();
	},
	onPanelHide: () => {
		dock.hidePanel();
	},
	openInPlayground: (expression) => {
		bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression });
	},
});

// ── Process runner ────────────────────────────────────────────────────────────

const tokenHighlightPlugin = createTokenHighlightPlugin();
const processRunnerPlugin = createProcessRunnerPlugin({
	engine: new Engine(),
	tokenHighlight: tokenHighlightPlugin,
	playContainer: dock.playPane,
	onShowPlayTab() {
		dock.setPlayTabVisible(true);
		if (dock.collapsed) dock.expand();
		dock.switchTab("play");
	},
	onHidePlayTab() {
		dock.setPlayTabVisible(false);
	},
	onEnterPlayMode() {
		const el = document.getElementById("hud-bottom-center");
		if (el) el.style.display = "none";
		processRunnerPlugin.toolbar.style.display = "";
		dock.propertiesPane.classList.add("bpmn-props-readonly");
		bridge.tabsPlugin.api.setPlayMode(true);
	},
	onExitPlayMode() {
		const el = document.getElementById("hud-bottom-center");
		if (el) el.style.display = currentFileName !== null ? "" : "none";
		processRunnerPlugin.toolbar.style.display = "none";
		dock.propertiesPane.classList.remove("bpmn-props-readonly");
		bridge.tabsPlugin.api.setPlayMode(false);
	},
	getProjectId: () => bridge.storagePlugin.api.getCurrentContext()?.projectId ?? null,
});

// Position runner toolbar at bottom center, hidden until play mode activates
processRunnerPlugin.toolbar.classList.add("bpmn-runner-toolbar--hud-bottom");
processRunnerPlugin.toolbar.style.display = "none";
document.body.appendChild(processRunnerPlugin.toolbar);

// ── Storage + Tabs bridge ─────────────────────────────────────────────────────

const bridge = createStorageTabsBridge({
	mainMenu: mainMenuPlugin,
	resolver,
	getExamples: (api) => makeExamples(api, resolver),
	initialTitle: "BPMN SDK",
	palette,
	enableFileImport: true,
	sideDock: dock,
	onWelcomeShow: () => {
		setHudVisible(false);
		dock.setHistoryTabEnabled(false);
	},
	onTabActivate(id, config) {
		const isBpmn = config.type === "bpmn";
		setHudVisible(true);
		if (isBpmn && config.xml) {
			editorRef?.load(config.xml);
		}
		for (const hudId of BPMN_ONLY_HUD) {
			const el = document.getElementById(hudId);
			if (el) el.style.display = isBpmn ? "" : "none";
		}
		if (!isBpmn) {
			editorRef?.setSelection([]);
		}
		currentFileName = isBpmn ? (config.name ?? null) : null;
		dock.setDiagramInfo(
			isBpmn ? (editorRef?.getDefinitions()?.processes[0]?.name ?? null) : null,
			currentFileName,
		);
		// Defer: the bridge sets the storage file ID synchronously after openTab() returns,
		// which is after this callback fires. A microtask runs after all sync code settles.
		void Promise.resolve().then(() => {
			const hasStorageCtx = isBpmn && bridge.storagePlugin.api.getCurrentContext() !== null;
			dock.setHistoryTabEnabled(hasStorageCtx);
		});
	},
});

const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
	openFeelPlayground: (expression) => {
		bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression });
	},
});

const optimizePlugin = createOptimizePlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	reload: (xml) => {
		editorRef?.load(xml);
	},
	openTab: (xml, name) => bridge.tabsPlugin.api.openTab({ type: "bpmn", xml, name }),
});

const asciiViewPlugin = createAsciiViewPlugin({
	getXml: () => {
		const defs = editorRef?.getDefinitions();
		return defs ? Bpmn.export(defs) : null;
	},
});

const aiBridgePlugin = createAiBridgePlugin({
	getDefinitions: () => editorRef?.getDefinitions() ?? null,
	loadXml: (xml) => {
		editorRef?.load(xml);
	},
	getCurrentContext: () => bridge.storagePlugin.api.getCurrentContext(),
	container: dock.aiPane,
	onOpen: () => {
		if (dock.collapsed) dock.expand();
		dock.switchTab("ai");
	},
});

// Wire AI tab click to initialize+open the panel (it's lazily created on first use)
dock.setAiTabClickHandler(() => {
	if (dock.collapsed) dock.expand();
	aiBridgePlugin.openPanel();
});

// History pane
const historyPanel = createHistoryPanel({
	getCurrentContext: () => bridge.storagePlugin.api.getCurrentContext(),
	loadXml: (xml) => {
		editorRef?.load(xml);
	},
});
dock.historyPane.appendChild(historyPanel.el);
dock.setHistoryTabClickHandler(() => {
	void historyPanel.refresh();
});

palette.addCommands([
	{
		id: "feel-playground",
		title: "FEEL Playground",
		action: () => bridge.tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
	},
]);

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
			links: [{ label: "Github", url: "https://github.com/bpmn-sdk/monorepo" }],
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
	],
});
editorRef = editor;

// Keep dock diagram info up-to-date on diagram changes; save checkpoints on auto-save cadence
type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void;
const editorOn = (editor as unknown as { on: AnyOn }).on.bind(editor);

let _checkpointTimer: ReturnType<typeof setTimeout> | null = null;
editorOn("diagram:change", () => {
	dock.setDiagramInfo(editorRef?.getDefinitions()?.processes[0]?.name ?? null, currentFileName);

	// Save a checkpoint ~600 ms after the last change (auto-save runs at 500 ms).
	// Only for files that are persisted in storage (context must be available).
	if (_checkpointTimer !== null) clearTimeout(_checkpointTimer);
	_checkpointTimer = setTimeout(() => {
		_checkpointTimer = null;
		const ctx = bridge.storagePlugin.api.getCurrentContext();
		if (!ctx) return;
		const defs = editorRef?.getDefinitions();
		if (!defs) return;
		void saveCheckpoint(ctx.projectId, ctx.fileId, Bpmn.export(defs));
	}, 600);
});

initEditorHud(editor, {
	openProcess: (processId) => bridge.tabsPlugin.api.navigateToProcess(processId),
	getAvailableProcesses: () => bridge.tabsPlugin.api.getAvailableProcesses(),
	createProcess: (name, onCreated) => {
		const processId = `Process_${Math.random().toString(36).slice(2, 9)}`;
		onCreated(processId);
		bridge.tabsPlugin.api.openTab({ type: "bpmn", xml: Bpmn.makeEmpty(processId, name), name });
	},
	openDecision: (decisionId) => bridge.tabsPlugin.api.openDecision(decisionId),
	getAvailableDecisions: () => bridge.tabsPlugin.api.getAvailableDecisions(),
	openForm: (formId) => bridge.tabsPlugin.api.openForm(formId),
	getAvailableForms: () => bridge.tabsPlugin.api.getAvailableForms(),
	rawModeButton: bridge.tabsPlugin.api.rawModeButton,
	optimizeButton: optimizePlugin.button,
	playButton: processRunnerPlugin.playButton,
	asciiButton: asciiViewPlugin.button,
});
