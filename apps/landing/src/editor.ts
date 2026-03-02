import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
import { createCommandPaletteEditorPlugin } from "@bpmn-sdk/canvas-plugin-command-palette-editor";
import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
import { createMainMenuPlugin } from "@bpmn-sdk/canvas-plugin-main-menu";
import { createStoragePlugin } from "@bpmn-sdk/canvas-plugin-storage";
import { InMemoryFileResolver, createTabsPlugin } from "@bpmn-sdk/canvas-plugin-tabs";
import { createWatermarkPlugin } from "@bpmn-sdk/canvas-plugin-watermark";
import { createZoomControlsPlugin } from "@bpmn-sdk/canvas-plugin-zoom-controls";
import { Bpmn, Dmn, Form } from "@bpmn-sdk/core";
import { BpmnEditor, initEditorHud } from "@bpmn-sdk/editor";
import type { Tool } from "@bpmn-sdk/editor";
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

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task1" name="Process Order">
      <bpmn:incoming>flow1</bpmn:incoming>
      <bpmn:outgoing>flow2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="end" name="End">
      <bpmn:incoming>flow2</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task1"/>
    <bpmn:sequenceFlow id="flow2" sourceRef="task1" targetRef="end"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="152" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task1_di" bpmnElement="task1">
        <dc:Bounds x="260" y="180" width="100" height="80"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="end_di" bpmnElement="end">
        <dc:Bounds x="432" y="202" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="188" y="220"/>
        <di:waypoint x="260" y="220"/>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="flow2_di" bpmnElement="flow2">
        <di:waypoint x="360" y="220"/>
        <di:waypoint x="432" y="220"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeEmptyBpmnXml(processId: string, processName: string): string {
	const startId = `StartEvent_${processId}`;
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_${processId}" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="${processId}" name="${processName}" isExecutable="true">
    <bpmn:startEvent id="${startId}"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_${processId}">
    <bpmndi:BPMNPlane id="BPMNPlane_${processId}" bpmnElement="${processId}">
      <bpmndi:BPMNShape id="${startId}_di" bpmnElement="${startId}">
        <dc:Bounds x="152" y="82" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;
}

function makeEmptyDmnXml(): string {
	const id = Math.random().toString(36).slice(2, 9);
	return `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_${id}" name="New Decision" namespace="http://bpmn.io/schema/dmn">
  <decision id="Decision_${id}" name="Decision 1">
    <decisionTable id="decisionTable_${id}" hitPolicy="UNIQUE">
      <output id="output_${id}" label="Result" name="result" typeRef="string"/>
    </decisionTable>
  </decision>
</definitions>`;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

const editorContainer = document.getElementById("editor-container");
if (!editorContainer) throw new Error("missing #editor-container");

// File resolver — shared between the tabs plugin and the config panel callbacks
const resolver = new InMemoryFileResolver();

// Maps tab ID → storage file ID for tabs opened from the storage plugin.
const tabIdToStorageFileId = new Map<string, string>();
// Reverse map: storage file ID → tab ID.
const storageFileIdToTabId = new Map<string, string>();
// Display name cache for storage files (kept in sync with renaming).
const storageFileToName = new Map<string, string>();
// File type cache ("bpmn" | "dmn" | "form") for the file switcher description.
const storageFileToType = new Map<string, string>();

// Ctrl+Tab MRU: tab IDs ordered by most-recently-activated (index 0 = most recent).
let tabMruOrder: string[] = [];
// Deregister function for the current set of file-search palette commands.
let removeFileCommands: (() => void) | undefined;
// Last known project ID — used to detect project changes in onChange.
let lastProjectId: string | null = null;

let editorRef: BpmnEditor | null = null;

// Tabs plugin — onTabActivate loads the BPMN into the editor when a BPMN tab is clicked
// and shows/hides BPMN-specific HUD toolbars for non-BPMN views.
const BPMN_ONLY_HUD = ["hud-top-center", "hud-bottom-left", "hud-bottom-center"];

function setHudVisible(visible: boolean): void {
	for (const el of document.querySelectorAll<HTMLElement>(".hud")) {
		el.style.display = visible ? "" : "none";
	}
	const menuPanel = document.querySelector<HTMLElement>(".bpmn-main-menu-panel");
	if (menuPanel) menuPanel.style.display = visible ? "" : "none";
}

const tabsPlugin = createTabsPlugin({
	resolver,
	// examples getter is called during install(), after tabsPlugin is assigned.
	get examples() {
		return makeExamples(tabsPlugin.api, resolver);
	},
	getRecentProjects() {
		return storagePlugin.api.getRecentProjects().map(({ project, workspace }) => ({
			label: project.name,
			description: workspace.name,
			onOpen: () => {
				void storagePlugin.api.openProject(project.id).then(() => {
					mainMenuPlugin.api.setTitle(`${workspace.name} / ${project.name}`);
				});
			},
		}));
	},
	onNewDiagram() {
		tabsPlugin.api.openTab({ type: "bpmn", xml: SAMPLE_XML, name: "New Diagram" });
	},
	onImportFiles() {
		fileInput.click();
	},
	onWelcomeShow() {
		setHudVisible(false);
	},
	onTabActivate(id, config) {
		const isBpmn = config.type === "bpmn";

		// Restore all HUDs and the main menu when any tab is active
		setHudVisible(true);

		// The tabs plugin keeps config.xml up to date on every diagram:change,
		// so we always load the current content when switching tabs.
		if (config.type === "bpmn" && config.xml) {
			editorRef?.load(config.xml);
		}

		// Update storage current-file pointer — ensures auto-save targets the right file
		storagePlugin.api.setCurrentFileId(tabIdToStorageFileId.get(id) ?? null);

		// Update MRU order (project mode only)
		if (storagePlugin.api.getCurrentProjectId()) {
			tabMruOrder = [id, ...tabMruOrder.filter((tid) => tid !== id)];
			const fileId = tabIdToStorageFileId.get(id);
			const projectId = storagePlugin.api.getCurrentProjectId();
			if (fileId && projectId) {
				void storagePlugin.api.pushMruFile(projectId, fileId);
			}
		}

		// Hide BPMN-only toolbars on non-BPMN views
		for (const hudId of BPMN_ONLY_HUD) {
			const el = document.getElementById(hudId);
			if (el) el.style.display = isBpmn ? "" : "none";
		}

		// Deselect all — closes the config panel and contextual toolbars
		if (!isBpmn) {
			editorRef?.setSelection([]);
		}
	},
	onDownloadTab(config) {
		let content: string;
		let filename: string;
		if (config.type === "bpmn") {
			content = config.xml;
			filename = config.name ?? "diagram.bpmn";
		} else if (config.type === "dmn") {
			content = Dmn.export(config.defs);
			filename = config.name ?? "decision.dmn";
		} else if (config.type === "form") {
			content = Form.export(config.form);
			filename = config.name ?? "form.form";
		} else {
			return; // feel tabs have no file content to download
		}
		const blob = new Blob([content], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	},
	onTabChange(tabId, _config) {
		// Auto-save DMN/Form content when edited
		const fileId = tabIdToStorageFileId.get(tabId);
		if (!fileId) return;
		// getAllTabContent() pulls the latest content from the editor via the parsed defs/form
		const snapshots = tabsPlugin.api.getAllTabContent();
		const snapshot = snapshots.find((s) => s.tabId === tabId);
		if (snapshot) {
			storagePlugin.api.scheduleSave(fileId, snapshot.content);
		}
	},
});

// ── File import logic ──────────────────────────────────────────────────────────

async function importFiles(files: FileList | File[]): Promise<void> {
	for (const file of Array.from(files)) {
		const name = file.name;
		const ext = name.slice(name.lastIndexOf(".")).toLowerCase();

		try {
			const text = await file.text();

			if (ext === ".bpmn" || ext === ".xml") {
				Bpmn.parse(text); // validate — throws on malformed XML
				tabsPlugin.api.openTab({ type: "bpmn", xml: text, name });
			} else if (ext === ".dmn") {
				const defs = Dmn.parse(text);
				resolver.registerDmn(defs);
				tabsPlugin.api.openTab({ type: "dmn", defs, name: defs.name ?? name });
			} else if (ext === ".form" || ext === ".json") {
				const form = Form.parse(text);
				resolver.registerForm(form);
				tabsPlugin.api.openTab({ type: "form", form, name: form.id ?? name });
			}
		} catch (err) {
			console.error(`[bpmn-sdk] Failed to import ${name}:`, err);
		}
	}
}

// ── Hidden file input for the "Import" menu action ────────────────────────────

const fileInput = document.createElement("input");
fileInput.type = "file";
fileInput.multiple = true;
fileInput.accept = ".bpmn,.xml,.dmn,.form,.json";
fileInput.style.display = "none";
document.body.appendChild(fileInput);
fileInput.addEventListener("change", () => {
	if (fileInput.files) {
		void importFiles(fileInput.files);
		fileInput.value = "";
	}
});

// ── Drag-and-drop ──────────────────────────────────────────────────────────────

editorContainer.addEventListener("dragover", (e) => {
	e.preventDefault();
});

editorContainer.addEventListener("drop", (e) => {
	e.preventDefault();
	const files = e.dataTransfer?.files;
	if (files && files.length > 0) {
		void importFiles(files);
	}
});

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
						const processId = `Process_${Math.random().toString(36).slice(2, 9)}`;
						tabsPlugin.api.openTab({
							type: "bpmn",
							xml: makeEmptyBpmnXml(processId, "New Process"),
							name: "New Diagram",
						});
					},
				},
				{
					label: "New DMN table",
					onClick: () => {
						const defs = Dmn.parse(makeEmptyDmnXml());
						resolver.registerDmn(defs);
						tabsPlugin.api.openTab({ type: "dmn", defs, name: "New Decision" });
					},
				},
				{
					label: "New Form",
					onClick: () => {
						const id = `Form_${Math.random().toString(36).slice(2, 9)}`;
						tabsPlugin.api.openTab({
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
			onClick: () => fileInput.click(),
		},
		{
			label: "FEEL Playground",
			onClick: () => tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
		},
	],
});

// ── Storage plugin ────────────────────────────────────────────────────────────

const storagePlugin = createStoragePlugin({
	mainMenu: mainMenuPlugin,
	getOpenTabs: () => tabsPlugin.api.getAllTabContent(),
	initialTitle: "BPMN SDK",
	onLeaveProject: () => {
		tabsPlugin.api.closeAllTabs();
		tabIdToStorageFileId.clear();
		storageFileIdToTabId.clear();
		storageFileToName.clear();
		storageFileToType.clear();
		tabMruOrder = [];
	},
	onReady: () => tabsPlugin.api.refreshWelcomeScreen(),
	onOpenFile(file, content) {
		let tabId: string | null = null;
		if (file.type === "bpmn") {
			tabId = tabsPlugin.api.openTab({ type: "bpmn", xml: content, name: file.name });
		} else if (file.type === "dmn") {
			try {
				const defs = Dmn.parse(content);
				resolver.registerDmn(defs);
				tabId = tabsPlugin.api.openTab({ type: "dmn", defs, name: file.name });
			} catch {
				console.error("[storage] Failed to parse DMN:", file.name);
			}
		} else if (file.type === "form") {
			try {
				const form = Form.parse(content);
				resolver.registerForm(form);
				tabId = tabsPlugin.api.openTab({ type: "form", form, name: file.name });
			} catch {
				console.error("[storage] Failed to parse form:", file.name);
			}
		}
		if (tabId !== null) {
			tabIdToStorageFileId.set(tabId, file.id);
			storageFileIdToTabId.set(file.id, tabId);
			storageFileToName.set(file.id, file.name);
			storageFileToType.set(file.id, file.type);
			// onTabActivate fires synchronously inside openTab before the map is set,
			// so we correct currentFileId explicitly here.
			storagePlugin.api.setCurrentFileId(file.id);
		}
	},
	onRenameCurrentFile(fileId, name) {
		storageFileToName.set(fileId, name);
		const tabId = storageFileIdToTabId.get(fileId);
		if (tabId) tabsPlugin.api.renameTab(tabId, name);
		rebuildFileCommands();
	},
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
});

const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel, {
	openDecision: (decisionId) => tabsPlugin.api.openDecision(decisionId),
	openForm: (formId) => tabsPlugin.api.openForm(formId),
	openProcess: (processId) => tabsPlugin.api.navigateToProcess(processId),
	getAvailableProcesses: () => tabsPlugin.api.getAvailableProcesses(),
	createProcess: (name, onCreated) => {
		const processId = `Process_${Math.random().toString(36).slice(2, 9)}`;
		const xml = makeEmptyBpmnXml(processId, name);
		tabsPlugin.api.openTab({ type: "bpmn", xml, name });
		onCreated(processId);
	},
	openFeelPlayground: (expression) => {
		tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground", expression });
	},
});

palette.addCommands([
	{
		id: "feel-playground",
		title: "FEEL Playground",
		action: () => tabsPlugin.api.openTab({ type: "feel", name: "FEEL Playground" }),
	},
]);

// ── Project mode: file-search commands + Ctrl+Tab MRU ─────────────────────────

/** Rebuilds file-search commands in the palette for the current project. */
function rebuildFileCommands(): void {
	removeFileCommands?.();
	removeFileCommands = undefined;
	const projectId = storagePlugin.api.getCurrentProjectId();
	if (!projectId) return;

	const cmds: Array<{ id: string; title: string; description?: string; action: () => void }> = [];

	// One "switch to file" command per open project file
	for (const [tabId, fileId] of tabIdToStorageFileId) {
		const name = storageFileToName.get(fileId) ?? fileId;
		const tid = tabId;
		cmds.push({
			id: `open-file-${fileId}`,
			title: name,
			description: "Switch to file",
			action: () => tabsPlugin.api.setActiveTab(tid),
		});
	}

	// "Rename current file" command
	const currentFileId = storagePlugin.api.getCurrentFileId();
	if (currentFileId && storageFileIdToTabId.has(currentFileId)) {
		const fid = currentFileId;
		const currentName = storageFileToName.get(fid) ?? "";
		cmds.push({
			id: "rename-current-file",
			title: "Rename current file\u2026",
			action: () => {
				const newName = prompt("Rename file:", currentName)?.trim();
				if (!newName || newName === currentName) return;
				storageFileToName.set(fid, newName);
				const tabId = storageFileIdToTabId.get(fid);
				if (tabId) tabsPlugin.api.renameTab(tabId, newName);
				void storagePlugin.api.renameFile(fid, newName);
				// onChange will call rebuildFileCommands after the rename completes
			},
		});
	}

	removeFileCommands = palette.addCommands(cmds);
}

// React to storage changes: toggle project mode and rebuild file commands
storagePlugin.api.onChange(() => {
	const projectId = storagePlugin.api.getCurrentProjectId();
	const projectChanged = projectId !== lastProjectId;
	lastProjectId = projectId;

	tabsPlugin.api.setProjectMode(!!projectId);

	if (projectChanged && projectId) {
		// Load stored MRU and apply it as the initial Ctrl+Tab order
		void storagePlugin.api.getMru(projectId).then((fileIds) => {
			const allTabIds = tabsPlugin.api.getTabIds();
			const ordered: string[] = [];
			for (const fileId of fileIds) {
				const tabId = storageFileIdToTabId.get(fileId);
				if (tabId && allTabIds.includes(tabId)) ordered.push(tabId);
			}
			for (const tabId of allTabIds) {
				if (!ordered.includes(tabId)) ordered.push(tabId);
			}
			tabMruOrder = ordered;
		});
	} else if (!projectId) {
		tabMruOrder = [];
	}

	rebuildFileCommands();
});

// ── File switcher (Ctrl+E / Cmd+E) ────────────────────────────────────────────

const FILE_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h6l4 4v9H4z"/><polyline points="10,2 10,6 14,6"/></svg>';

let fileSwitcherEl: HTMLDivElement | null = null;
let _fileSwitcherKeyHandler: ((e: KeyboardEvent) => void) | null = null;
let _fileSwitcherCtrlRelease: ((e: KeyboardEvent) => void) | null = null;
let _fileSwitcherCycle: (() => void) | null = null;

function closeFileSwitcher(): void {
	fileSwitcherEl?.remove();
	fileSwitcherEl = null;
	if (_fileSwitcherKeyHandler) {
		document.removeEventListener("keydown", _fileSwitcherKeyHandler);
		_fileSwitcherKeyHandler = null;
	}
	if (_fileSwitcherCtrlRelease) {
		document.removeEventListener("keyup", _fileSwitcherCtrlRelease);
		_fileSwitcherCtrlRelease = null;
	}
	_fileSwitcherCycle = null;
}

function openFileSwitcher(): void {
	if (!storagePlugin.api.getCurrentProjectId()) return;

	const isLight = editorContainer?.dataset.theme !== "dark";
	let focusIdx = 0;
	let isSearchMode = false;

	const overlay = document.createElement("div");
	overlay.className = `bpmn-palette-overlay${isLight ? " bpmn-palette--light" : ""}`;
	overlay.setAttribute("role", "dialog");
	overlay.setAttribute("aria-modal", "true");
	overlay.setAttribute("aria-label", "Switch to file");

	const panel = document.createElement("div");
	panel.className = "bpmn-palette-panel";

	const searchRow = document.createElement("div");
	searchRow.className = "bpmn-palette-search";

	const iconEl = document.createElement("span");
	iconEl.className = "bpmn-palette-search-icon";
	iconEl.innerHTML = FILE_ICON;
	searchRow.appendChild(iconEl);

	const input = document.createElement("input");
	input.type = "text";
	input.className = "bpmn-palette-input";
	input.placeholder = "Switch to file\u2026";
	input.setAttribute("autocomplete", "off");
	input.setAttribute("spellcheck", "false");
	searchRow.appendChild(input);

	const kbdHint = document.createElement("span");
	kbdHint.className = "bpmn-palette-kbd";
	kbdHint.innerHTML = "<kbd>E</kbd> cycle &nbsp;<kbd>Tab</kbd> search &nbsp;<kbd>Esc</kbd> close";
	searchRow.appendChild(kbdHint);

	const list = document.createElement("div");
	list.className = "bpmn-palette-list";
	list.setAttribute("role", "listbox");

	panel.appendChild(searchRow);
	panel.appendChild(list);
	overlay.appendChild(panel);
	document.body.appendChild(overlay);
	fileSwitcherEl = overlay;

	function getEntries(
		query: string,
	): Array<{ tabId: string; name: string; type: string; isCurrent: boolean }> {
		const currentFileId = storagePlugin.api.getCurrentFileId();
		const allTabIds = tabsPlugin.api.getTabIds();
		const mru = tabMruOrder.filter((id) => allTabIds.includes(id));
		for (const id of allTabIds) {
			if (!mru.includes(id)) mru.push(id);
		}
		const q = query.toLowerCase();
		return mru
			.map((tabId) => {
				const fileId = tabIdToStorageFileId.get(tabId) ?? "";
				return {
					tabId,
					name: storageFileToName.get(fileId) ?? fileId,
					type: storageFileToType.get(fileId) ?? "",
					isCurrent: fileId === currentFileId,
				};
			})
			.filter((e) => !q || e.name.toLowerCase().includes(q));
	}

	function renderList(query: string): void {
		list.innerHTML = "";
		const entries = getEntries(query);
		if (entries.length === 0) {
			const empty = document.createElement("div");
			empty.className = "bpmn-palette-empty";
			empty.textContent = "No files found";
			list.appendChild(empty);
			return;
		}
		if (focusIdx >= entries.length) focusIdx = 0;
		entries.forEach((entry, i) => {
			const item = document.createElement("div");
			item.className = `bpmn-palette-item${i === focusIdx ? " bpmn-palette-focused" : ""}`;
			item.setAttribute("role", "option");
			item.setAttribute("aria-selected", String(i === focusIdx));

			const nameEl = document.createElement("span");
			nameEl.className = "bpmn-palette-item-title";
			nameEl.textContent = entry.name;
			if (entry.isCurrent) nameEl.style.fontWeight = "600";
			item.appendChild(nameEl);

			const descEl = document.createElement("span");
			descEl.className = "bpmn-palette-item-desc";
			descEl.textContent = entry.isCurrent
				? `${entry.type.toUpperCase()} · current`
				: entry.type.toUpperCase();
			item.appendChild(descEl);

			item.addEventListener("pointerenter", () => {
				focusIdx = i;
				updateFocus();
			});
			item.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				tabsPlugin.api.setActiveTab(entry.tabId);
				closeFileSwitcher();
			});
			list.appendChild(item);
		});
	}

	function updateFocus(): void {
		const items = list.querySelectorAll<HTMLDivElement>(".bpmn-palette-item");
		items.forEach((item, i) => {
			item.classList.toggle("bpmn-palette-focused", i === focusIdx);
			item.setAttribute("aria-selected", String(i === focusIdx));
		});
		list.querySelector<HTMLDivElement>(".bpmn-palette-focused")?.scrollIntoView({
			block: "nearest",
		});
	}

	function enterSearchMode(): void {
		if (isSearchMode) return;
		isSearchMode = true;
		// Detach Ctrl-release commit — switcher now stays open until Enter/Esc/click
		if (_fileSwitcherCtrlRelease) {
			document.removeEventListener("keyup", _fileSwitcherCtrlRelease);
			_fileSwitcherCtrlRelease = null;
		}
		input.focus();
	}

	// Pre-focus the second entry (most recently previous file); no input focus in cycle mode
	const initial = getEntries("");
	focusIdx = initial.length > 1 ? 1 : 0;
	renderList("");

	input.addEventListener("input", () => {
		focusIdx = 0;
		renderList(input.value);
	});

	overlay.addEventListener("pointerdown", (e) => {
		if (e.target === overlay) closeFileSwitcher();
	});

	// Ctrl/Meta release → commit the highlighted file (cycle mode only)
	_fileSwitcherCtrlRelease = (e: KeyboardEvent) => {
		if (e.key === "Control" || e.key === "Meta") {
			const entries = getEntries(input.value);
			const entry = entries[focusIdx];
			if (entry) tabsPlugin.api.setActiveTab(entry.tabId);
			closeFileSwitcher();
		}
	};
	document.addEventListener("keyup", _fileSwitcherCtrlRelease);

	// Exposed to the global Ctrl+E handler for cycling
	_fileSwitcherCycle = () => {
		if (isSearchMode) return;
		const entries = getEntries("");
		if (entries.length > 0) {
			focusIdx = (focusIdx + 1) % entries.length;
			updateFocus();
		}
	};

	_fileSwitcherKeyHandler = (e: KeyboardEvent) => {
		const entries = getEntries(input.value);
		const count = entries.length;
		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (count > 0) {
				focusIdx = (focusIdx + 1) % count;
				updateFocus();
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (count > 0) {
				focusIdx = (focusIdx - 1 + count) % count;
				updateFocus();
			}
		} else if (e.key === "Tab") {
			e.preventDefault();
			enterSearchMode();
		} else if (e.key === "ArrowRight" && document.activeElement !== input) {
			e.preventDefault();
			enterSearchMode();
		} else if (e.key === "Enter") {
			e.preventDefault();
			const entry = entries[focusIdx];
			if (entry) {
				tabsPlugin.api.setActiveTab(entry.tabId);
				closeFileSwitcher();
			}
		} else if (e.key === "Escape") {
			e.preventDefault();
			closeFileSwitcher();
		}
	};
	document.addEventListener("keydown", _fileSwitcherKeyHandler);
}

// Ctrl+E / Cmd+E — open switcher or cycle to next file while Ctrl is held
document.addEventListener("keydown", (e) => {
	if ((e.ctrlKey || e.metaKey) && e.key === "e" && !e.shiftKey && !e.altKey) {
		e.preventDefault();
		if (fileSwitcherEl && _fileSwitcherCycle) {
			_fileSwitcherCycle();
		} else {
			openFileSwitcher();
		}
	}
});

// ── Editor ────────────────────────────────────────────────────────────────────

const _savedTheme = localStorage.getItem("bpmn-theme");
const _initialTheme = _savedTheme === "dark" || _savedTheme === "light" ? _savedTheme : "light";

const editor = new BpmnEditor({
	container: editorContainer,
	xml: SAMPLE_XML,
	theme: _initialTheme,
	grid: true,
	fit: "center",
	plugins: [
		mainMenuPlugin,
		createZoomControlsPlugin(),
		createWatermarkPlugin({
			links: [{ label: "Github", url: "https://github.com/bpmn-sdk/monorepo" }],
			logo: LOGO_SVG,
		}),
		tabsPlugin,
		storagePlugin,
		palette,
		paletteEditor,
		configPanel,
		configPanelBpmn,
	],
});
editorRef = editor;

// Persist theme selection to localStorage
new MutationObserver(() => {
	localStorage.setItem("bpmn-theme", editor.container.getAttribute("data-theme") ?? "light");
}).observe(editor.container, { attributes: true, attributeFilter: ["data-theme"] });

initEditorHud(editor, {
	openProcess: (processId) => tabsPlugin.api.navigateToProcess(processId),
	rawModeButton: tabsPlugin.api.rawModeButton,
});
