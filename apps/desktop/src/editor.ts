import { Bpmn, Dmn } from "@bpmn-sdk/core";
import { BpmnEditor, createSideDock, initEditorHud } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";
import { createAiBridgePlugin } from "@bpmn-sdk/plugins/ai-bridge";
import { createCommandPalettePlugin } from "@bpmn-sdk/plugins/command-palette";
import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/plugins/command-palette-editor";
import { createConfigPanelPlugin } from "@bpmn-sdk/plugins/config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/plugins/config-panel-bpmn";
import { createMainMenuPlugin } from "@bpmn-sdk/plugins/main-menu";
import { createOptimizePlugin } from "@bpmn-sdk/plugins/optimize";
import {
	InMemoryFileResolver,
	createStorageTabsBridge,
} from "@bpmn-sdk/plugins/storage-tabs-bridge";
import { createWatermarkPlugin } from "@bpmn-sdk/plugins/watermark";
import { createZoomControlsPlugin } from "@bpmn-sdk/plugins/zoom-controls";
import { makeExamples } from "./examples.js";

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
});

// ── Storage + Tabs bridge ─────────────────────────────────────────────────────

const bridge = createStorageTabsBridge({
	mainMenu: mainMenuPlugin,
	resolver,
	getExamples: (api) => makeExamples(api, resolver),
	initialTitle: "BPMN SDK",
	palette,
	enableFileImport: true,
	sideDock: dock,
	onWelcomeShow: () => setHudVisible(false),
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
		aiBridgePlugin,
	],
});
editorRef = editor;

// Keep dock diagram info up-to-date on diagram changes
type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void;
const editorOn = (editor as unknown as { on: AnyOn }).on.bind(editor);

editorOn("diagram:change", () => {
	dock.setDiagramInfo(editorRef?.getDefinitions()?.processes[0]?.name ?? null, currentFileName);
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
	aiButton: aiBridgePlugin.button,
});
