/**
 * @bpmn-sdk/canvas-plugin-storage-tabs-bridge
 *
 * Wires the storage plugin and tabs plugin together, handling:
 * - Tab ↔ storage file mapping
 * - Auto-save for DMN/Form tabs
 * - MRU (most-recently-used) file tracking per project
 * - File-search commands in the command palette
 * - Ctrl+E file switcher
 *
 * @packageDocumentation
 */

import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import type { CommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
import type { MainMenuApi } from "@bpmn-sdk/canvas-plugin-main-menu";
import { showInputDialog } from "@bpmn-sdk/canvas-plugin-storage";
import { createStoragePlugin } from "@bpmn-sdk/canvas-plugin-storage";
import type { StorageApi } from "@bpmn-sdk/canvas-plugin-storage";
import { InMemoryFileResolver, createTabsPlugin } from "@bpmn-sdk/canvas-plugin-tabs";
import type {
	TabConfig,
	TabsApi,
	WelcomeExample,
	WelcomeSection,
} from "@bpmn-sdk/canvas-plugin-tabs";
import { Bpmn, Dmn, Form } from "@bpmn-sdk/core";

export type { TabConfig, TabsApi, WelcomeExample, WelcomeSection };
export { InMemoryFileResolver };
export type { StorageApi };

// ── Options ───────────────────────────────────────────────────────────────────

export interface StorageTabsBridgeOptions {
	/** Main menu plugin — required for storage project navigation. */
	mainMenu: CanvasPlugin & { api: MainMenuApi };
	/**
	 * File resolver for DMN/Form reference navigation.
	 * Use `InMemoryFileResolver` to enable cross-file "Open Decision" / "Open Form".
	 * The bridge automatically calls `registerDmn`/`registerForm` when files are opened.
	 */
	resolver?: InMemoryFileResolver;
	/**
	 * Factory called each time the welcome screen renders to get example items.
	 * Receives the `TabsApi` so examples can open tabs.
	 */
	getExamples?: (api: TabsApi) => WelcomeExample[];
	/** Dynamic sections shown below examples on the welcome screen. */
	getWelcomeSections?: () => WelcomeSection[];
	/** Called when the welcome screen becomes visible. Use to hide editor HUD. */
	onWelcomeShow?: () => void;
	/**
	 * Called when "New diagram" is clicked on the welcome screen.
	 * Defaults to opening a new BPMN tab with the sample diagram.
	 */
	onNewDiagram?: () => void;
	/**
	 * Called after a tab is activated, after the bridge has updated storage tracking.
	 * Use this to load BPMN into the editor, update HUD visibility, etc.
	 */
	onTabActivate?: (id: string, config: TabConfig) => void;
	/** Called when a project is left, after the bridge has cleared its maps. */
	onLeaveProject?: () => void;
	/** Called when storage data is ready (IndexedDB caches loaded). */
	onReady?: () => void;
	/** Optional command palette — enables file-search commands when provided. */
	palette?: CommandPalettePlugin;
	/** Title shown in the main menu when no project is open. Defaults to "". */
	initialTitle?: string;
	/**
	 * Called when a tab's download button is clicked.
	 * Defaults to serializing the content and triggering a browser download.
	 */
	onDownloadTab?: (config: TabConfig) => void;
	/** When true, enables built-in file import (file picker + drag-and-drop). */
	enableFileImport?: boolean;
	/**
	 * Side dock to manage automatically. When provided, the dock is hidden on the
	 * welcome screen and shown whenever a tab is activated — no manual wiring needed.
	 */
	sideDock?: { setVisible(visible: boolean): void };
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface StorageTabsBridgeResult {
	tabsPlugin: CanvasPlugin & { api: TabsApi };
	storagePlugin: CanvasPlugin & { api: StorageApi };
	/** Install this plugin to activate storage↔tab sync, palette commands, and Ctrl+E. */
	bridgePlugin: CanvasPlugin;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const FILE_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 2h6l4 4v9H4z"/><polyline points="10,2 10,6 14,6"/></svg>';

// ── Factory ───────────────────────────────────────────────────────────────────

export function createStorageTabsBridge(
	options: StorageTabsBridgeOptions,
): StorageTabsBridgeResult {
	// ── Bridge state ────────────────────────────────────────────────────────────

	/** Maps tab ID → storage file ID for project-mode tabs. */
	const tabIdToStorageFileId = new Map<string, string>();
	/** Reverse: storage file ID → tab ID. */
	const storageFileIdToTabId = new Map<string, string>();
	/** Display name cache — kept in sync with file renames. */
	const storageFileToName = new Map<string, string>();
	/** Type cache ("bpmn" | "dmn" | "form") — used in the file switcher. */
	const storageFileToType = new Map<string, string>();

	/** MRU tab order for Ctrl+E cycling. */
	let tabMruOrder: string[] = [];
	/** Deregister function for current file-search palette commands. */
	let removeFileCommands: (() => void) | undefined;
	/** Last known project ID — used to detect project changes. */
	let lastProjectId: string | null = null;

	/**
	 * Late-bound reference to storagePlugin. Set immediately after createStoragePlugin
	 * returns. Safe to use in all callbacks because they are called at runtime.
	 */
	let storageRef: (CanvasPlugin & { api: StorageApi }) | null = null;

	// ── Default download handler ────────────────────────────────────────────────

	function defaultDownloadTab(config: TabConfig): void {
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
			return;
		}
		const blob = new Blob([content], { type: "application/octet-stream" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// ── tabsPlugin ──────────────────────────────────────────────────────────────

	const tabsPlugin = createTabsPlugin({
		resolver: options.resolver,
		get examples() {
			return options.getExamples ? options.getExamples(tabsPlugin.api) : undefined;
		},
		getWelcomeSections: options.getWelcomeSections,
		getRecentProjects() {
			return (
				storageRef?.api.getRecentProjects().map(({ project, workspace }) => ({
					label: project.name,
					description: workspace.name,
					onOpen: () => {
						void storageRef?.api.openProject(project.id).then(() => {
							options.mainMenu.api.setTitle(`${workspace.name} / ${project.name}`);
						});
					},
				})) ?? null
			);
		},
		onNewDiagram() {
			if (options.onNewDiagram) {
				options.onNewDiagram();
			} else {
				tabsPlugin.api.openTab({ type: "bpmn", xml: Bpmn.SAMPLE_XML, name: "New Diagram" });
			}
		},
		onWelcomeShow: () => {
			options.sideDock?.setVisible(false);
			options.onWelcomeShow?.();
		},
		enableFileImport: options.enableFileImport,
		onTabActivate(id, config) {
			// Update storage current-file pointer
			storageRef?.api.setCurrentFileId(tabIdToStorageFileId.get(id) ?? null);
			// MRU tracking (project mode only)
			const projectId = storageRef?.api.getCurrentProjectId();
			if (projectId) {
				tabMruOrder = [id, ...tabMruOrder.filter((tid) => tid !== id)];
				const fileId = tabIdToStorageFileId.get(id);
				if (fileId) {
					void storageRef?.api.pushMruFile(projectId, fileId);
				}
			}
			options.sideDock?.setVisible(true);
			options.onTabActivate?.(id, config);
		},
		onTabChange(tabId) {
			const fileId = tabIdToStorageFileId.get(tabId);
			if (!fileId) return;
			const snapshots = tabsPlugin.api.getAllTabContent();
			const snapshot = snapshots.find((s) => s.tabId === tabId);
			if (snapshot) {
				storageRef?.api.scheduleSave(fileId, snapshot.content);
			}
		},
		onDownloadTab: options.onDownloadTab ?? defaultDownloadTab,
	});

	// ── storagePlugin ───────────────────────────────────────────────────────────

	const storagePlugin = createStoragePlugin({
		mainMenu: options.mainMenu,
		getOpenTabs: () => tabsPlugin.api.getAllTabContent(),
		initialTitle: options.initialTitle,
		onLeaveProject() {
			tabsPlugin.api.closeAllTabs();
			tabIdToStorageFileId.clear();
			storageFileIdToTabId.clear();
			storageFileToName.clear();
			storageFileToType.clear();
			tabMruOrder = [];
			options.onLeaveProject?.();
		},
		onReady() {
			tabsPlugin.api.refreshWelcomeScreen();
			options.onReady?.();
		},
		onOpenFile(file, content) {
			let tabId: string | null = null;
			if (file.type === "bpmn") {
				tabId = tabsPlugin.api.openTab({ type: "bpmn", xml: content, name: file.name });
			} else if (file.type === "dmn") {
				try {
					const defs = Dmn.parse(content);
					options.resolver?.registerDmn(defs);
					tabId = tabsPlugin.api.openTab({ type: "dmn", defs, name: file.name });
				} catch {
					console.error("[storage] Failed to parse DMN:", file.name);
				}
			} else if (file.type === "form") {
				try {
					const form = Form.parse(content);
					options.resolver?.registerForm(form);
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
				// so correct currentFileId explicitly here.
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

	// Resolve the late-bound reference
	storageRef = storagePlugin;

	// ── File commands ───────────────────────────────────────────────────────────

	function rebuildFileCommands(): void {
		removeFileCommands?.();
		removeFileCommands = undefined;
		if (!options.palette) return;
		const projectId = storagePlugin.api.getCurrentProjectId();
		if (!projectId) return;

		const cmds: Array<{ id: string; title: string; description?: string; action: () => void }> = [];

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

		const currentFileId = storagePlugin.api.getCurrentFileId();
		if (currentFileId && storageFileIdToTabId.has(currentFileId)) {
			const fid = currentFileId;
			const currentName = storageFileToName.get(fid) ?? "";
			cmds.push({
				id: "rename-current-file",
				title: "Rename current file\u2026",
				action: async () => {
					const newName = await showInputDialog({
						title: "Rename file",
						defaultValue: currentName,
					});
					if (!newName || newName === currentName) return;
					storageFileToName.set(fid, newName);
					const tabId = storageFileIdToTabId.get(fid);
					if (tabId) tabsPlugin.api.renameTab(tabId, newName);
					void storagePlugin.api.renameFile(fid, newName);
				},
			});
		}

		removeFileCommands = options.palette.addCommands(cmds);
	}

	// ── File switcher (Ctrl+E / Cmd+E) ─────────────────────────────────────────

	let fileSwitcherEl: HTMLDivElement | null = null;
	let fileSwitcherKeyHandler: ((e: KeyboardEvent) => void) | null = null;
	let fileSwitcherCtrlRelease: ((e: KeyboardEvent) => void) | null = null;
	let fileSwitcherCycle: (() => void) | null = null;
	let bridgeContainer: HTMLElement | null = null;

	function closeFileSwitcher(): void {
		fileSwitcherEl?.remove();
		fileSwitcherEl = null;
		if (fileSwitcherKeyHandler) {
			document.removeEventListener("keydown", fileSwitcherKeyHandler);
			fileSwitcherKeyHandler = null;
		}
		if (fileSwitcherCtrlRelease) {
			document.removeEventListener("keyup", fileSwitcherCtrlRelease);
			fileSwitcherCtrlRelease = null;
		}
		fileSwitcherCycle = null;
	}

	function openFileSwitcher(): void {
		if (!storagePlugin.api.getCurrentProjectId()) return;

		const isLight = bridgeContainer?.dataset.theme !== "dark";
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
			if (fileSwitcherCtrlRelease) {
				document.removeEventListener("keyup", fileSwitcherCtrlRelease);
				fileSwitcherCtrlRelease = null;
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
		fileSwitcherCtrlRelease = (e: KeyboardEvent) => {
			if (e.key === "Control" || e.key === "Meta") {
				const entries = getEntries(input.value);
				const entry = entries[focusIdx];
				if (entry) tabsPlugin.api.setActiveTab(entry.tabId);
				closeFileSwitcher();
			}
		};
		document.addEventListener("keyup", fileSwitcherCtrlRelease);

		// Exposed to the global Ctrl+E handler for cycling
		fileSwitcherCycle = () => {
			if (isSearchMode) return;
			const entries = getEntries("");
			if (entries.length > 0) {
				focusIdx = (focusIdx + 1) % entries.length;
				updateFocus();
			}
		};

		fileSwitcherKeyHandler = (e: KeyboardEvent) => {
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
		document.addEventListener("keydown", fileSwitcherKeyHandler);
	}

	const onCtrlE = (e: KeyboardEvent): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === "e" && !e.shiftKey && !e.altKey) {
			e.preventDefault();
			if (fileSwitcherEl && fileSwitcherCycle) {
				fileSwitcherCycle();
			} else {
				openFileSwitcher();
			}
		}
	};

	// ── bridgePlugin ────────────────────────────────────────────────────────────

	let offStorageChange: (() => void) | undefined;

	const bridgePlugin: CanvasPlugin = {
		name: "storage-tabs-bridge",

		install(canvasApi: CanvasApi) {
			bridgeContainer = canvasApi.container;

			offStorageChange = storagePlugin.api.onChange(() => {
				const projectId = storagePlugin.api.getCurrentProjectId();
				const projectChanged = projectId !== lastProjectId;
				lastProjectId = projectId;

				tabsPlugin.api.setProjectMode(!!projectId);

				if (projectChanged && projectId) {
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

			document.addEventListener("keydown", onCtrlE);
		},

		uninstall() {
			offStorageChange?.();
			closeFileSwitcher();
			document.removeEventListener("keydown", onCtrlE);
			bridgeContainer = null;
		},
	};

	return { tabsPlugin, storagePlugin, bridgePlugin };
}
