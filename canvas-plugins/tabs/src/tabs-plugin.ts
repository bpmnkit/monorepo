import type { CanvasApi, CanvasPlugin } from "@bpmn-sdk/canvas";
import { DmnEditor } from "@bpmn-sdk/canvas-plugin-dmn-editor";
import {
	buildFeelPlaygroundPanel,
	injectPlaygroundStyles,
} from "@bpmn-sdk/canvas-plugin-feel-playground";
import { FormEditor } from "@bpmn-sdk/canvas-plugin-form-editor";
import {
	Bpmn,
	type BpmnDefinitions,
	Dmn,
	type DmnDefinitions,
	Form,
	type FormDefinition,
} from "@bpmn-sdk/core";
import { injectTabsStyles } from "./css.js";
import { InMemoryFileResolver } from "./file-resolver.js";
import type { FileResolver } from "./file-resolver.js";

/** A tab configuration — one of BPMN, DMN, Form, or FEEL Playground. */
export type TabConfig =
	| { type: "bpmn"; xml: string; name?: string }
	| { type: "dmn"; defs: DmnDefinitions; name?: string }
	| { type: "form"; form: FormDefinition; name?: string }
	| { type: "feel"; name?: string; expression?: string };

/** Internal tab state. */
interface TabState {
	id: string;
	config: TabConfig;
	pane: HTMLDivElement;
	hasWarning: boolean;
	dmnEditor?: DmnEditor;
	formEditor?: FormEditor;
	offDmnChange?: () => void;
	offFormChange?: () => void;
}

/** A recent project item shown in the welcome screen dropdown. */
export interface WelcomeRecentItem {
	label: string;
	description?: string;
	onOpen: () => void;
}

/** Serialized content snapshot for save/export operations. Not available for FEEL tabs. */
export interface TabContentSnapshot {
	tabId: string;
	name: string;
	type: "bpmn" | "dmn" | "form";
	content: string;
}

/** Options for the tabs plugin. */
export interface TabsPluginOptions {
	/**
	 * File resolver used to open referenced DMN/form files by ID.
	 * Provide an `InMemoryFileResolver` (or custom implementation)
	 * to enable "Open Decision" / "Open Form" navigation.
	 */
	resolver?: FileResolver;
	/**
	 * Called whenever a tab becomes active.
	 * Use this to react to tab switches — e.g. reload the BPMN editor
	 * when a BPMN tab is activated.
	 */
	onTabActivate?: (id: string, config: TabConfig) => void;
	/**
	 * Called when the user confirms they want to download a tab's content
	 * before closing. Implement file serialization and browser download here.
	 * If not provided, the "Download & Close" button is hidden.
	 */
	onDownloadTab?: (config: TabConfig) => void;
	/**
	 * Called when the user clicks "New diagram" on the welcome screen.
	 * Open a new BPMN tab from here.
	 */
	onNewDiagram?: () => void;
	/**
	 * Called when the user clicks "Import files" on the welcome screen.
	 * Trigger your file-picker here.
	 */
	onImportFiles?: () => void;
	/**
	 * Called whenever the welcome screen becomes visible (on initial install
	 * and when the last tab is closed). Use this to hide toolbars and menus
	 * that have no meaning without an open diagram.
	 */
	onWelcomeShow?: () => void;
	/**
	 * Example items shown in the welcome screen. Each item has a label,
	 * optional description, optional badge (e.g. "BPMN", "MULTI"), and an
	 * `onOpen` callback that opens the relevant tab(s).
	 */
	examples?: WelcomeExample[];
	/**
	 * Dynamic sections shown below the examples on the welcome screen.
	 * Each section's `getItems()` is called fresh every time the welcome screen
	 * becomes visible, so the content stays up to date.
	 */
	getWelcomeSections?: () => WelcomeSection[];
	/**
	 * Called when the welcome screen becomes visible to populate the "Open recent"
	 * dropdown button. Return null or an empty array to disable the button.
	 */
	getRecentProjects?: () => WelcomeRecentItem[] | null;
	/**
	 * Called whenever a DMN or Form tab's content changes (i.e. the user made an edit).
	 * Use this to trigger auto-save for the active file. Not called for BPMN tabs
	 * (use the `diagram:change` canvas event for those).
	 */
	onTabChange?: (tabId: string, config: TabConfig) => void;
	/**
	 * When true, the plugin handles file import automatically:
	 * - Creates a hidden `<input type="file">` for the "Import files" welcome screen button
	 * - Adds drag-and-drop support to the canvas container
	 * - Parses `.bpmn`, `.xml`, `.dmn`, `.form`, and `.json` files and opens them as tabs
	 *
	 * Use `tabsPlugin.api.openFilePicker()` to trigger the file picker programmatically
	 * (e.g. from a menu item). The `resolver` option must be set to register DMN/Form files.
	 */
	enableFileImport?: boolean;
	/**
	 * Optional element to place in the center of the tabs bar.
	 * The element is wrapped in an absolutely-centered slot so it does not
	 * interfere with tab scrolling. Typical use: process runner toolbar.
	 */
	centerSlot?: HTMLElement;
}

/** A single example entry shown on the welcome screen. */
export interface WelcomeExample {
	label: string;
	description?: string;
	/** Short badge text, e.g. "BPMN", "DMN", "FORM", "MULTI". */
	badge?: string;
	onOpen: () => void;
}

/** A dynamic item inside a welcome screen section. */
export interface WelcomeSectionItem {
	label: string;
	description?: string;
	onOpen: () => void;
}

/** A dynamic section shown on the welcome screen, rebuilt on each show. */
export interface WelcomeSection {
	label: string;
	/** Called each time the welcome screen becomes visible to get fresh items. */
	getItems: () => WelcomeSectionItem[];
	/** Shown when `getItems` returns an empty array. */
	emptyText?: string;
}

/** Public API for the tabs plugin, accessible via `tabsPlugin.api`. */
export interface TabsApi {
	/** Open a new tab (or activate it if already open). Returns the tab ID. */
	openTab(config: TabConfig): string;
	/** Close a tab by ID. */
	closeTab(id: string): void;
	/** Close all open tabs immediately without a confirmation dialog. Shows the welcome screen. */
	closeAllTabs(): void;
	/** Activate a tab by ID. */
	setActiveTab(id: string): void;
	/** Get the active tab ID. */
	getActiveTabId(): string | null;
	/** Get all open tab IDs. */
	getTabIds(): string[];
	/**
	 * Open the DMN decision referenced by `decisionId` using the resolver.
	 * Shows a warning in the tab if the decision is not found.
	 */
	openDecision(decisionId: string, resultVariable?: string): void;
	/**
	 * Open the form referenced by `formId` using the resolver.
	 * Shows a warning in the tab if the form is not found.
	 */
	openForm(formId: string): void;
	/**
	 * Navigate to the BPMN tab that contains the given process ID.
	 * No-op if no open tab contains that process.
	 */
	navigateToProcess(processId: string): void;
	/**
	 * Get all BPMN processes tracked across open tabs.
	 * Useful for providing a process picker in the HUD toolbar.
	 */
	getAvailableProcesses(): Array<{ id: string; name?: string }>;
	/**
	 * Get all DMN decisions from open DMN tabs.
	 * Useful for providing a decision picker in the HUD toolbar.
	 */
	getAvailableDecisions(): Array<{ id: string; name?: string }>;
	/**
	 * Get all forms from open form tabs.
	 * Useful for providing a form picker in the HUD toolbar.
	 */
	getAvailableForms(): Array<{ id: string; name?: string }>;
	/**
	 * Get serialized content for all non-FEEL open tabs.
	 * BPMN tabs return their current XML; DMN/Form tabs are serialized on demand.
	 */
	getAllTabContent(): TabContentSnapshot[];
	/**
	 * Re-render the welcome screen's dynamic content (recent projects, sections).
	 * Call this after async data loads to update the welcome screen if it is visible.
	 */
	refreshWelcomeScreen(): void;
	/**
	 * The raw mode toggle button element. Pass this to `initEditorHud` to place it
	 * in the bottom-left HUD panel instead of the tab bar.
	 */
	rawModeButton: HTMLButtonElement | null;
	/**
	 * Enable or disable project mode.
	 * In project mode, tabs cannot be closed by the user.
	 */
	setProjectMode(enabled: boolean): void;
	/**
	 * Update the display name of a tab.
	 * Used when a project file is renamed via the command palette or main menu.
	 */
	renameTab(id: string, name: string): void;
	/**
	 * Programmatically open the file picker dialog.
	 * Only available when `enableFileImport: true` was passed to `createTabsPlugin`.
	 * No-op otherwise.
	 */
	openFilePicker(): void;
	/**
	 * Enter or exit play mode. In play mode the tab groups are hidden so only
	 * the center slot (process runner controls) is visible in the tab bar.
	 */
	setPlayMode(enabled: boolean): void;
}

let _tabCounter = 0;

const RAW_MODE_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,3 1,8 5,13"/><polyline points="11,3 15,8 11,13"/></svg>';

/** The order in which type groups appear in the tab bar. */
const GROUP_TYPES: Array<TabConfig["type"]> = ["bpmn", "dmn", "form", "feel"];

/**
 * Creates a tabs plugin instance.
 *
 * When installed into a `BpmnCanvas` (or `BpmnEditor`), it adds a tab bar overlay
 * at the top of the canvas container and manages multiple BPMN/DMN/Form views.
 *
 * @example
 * ```typescript
 * const resolver = new InMemoryFileResolver();
 * resolver.registerDmn(dmnDefs);
 * resolver.registerForm(formDef);
 *
 * const tabsPlugin = createTabsPlugin({ resolver });
 * const canvas = new BpmnCanvas({ container, xml, plugins: [tabsPlugin] });
 *
 * // Navigate programmatically
 * tabsPlugin.api.openDecision("Decision_1");
 * ```
 */
export function createTabsPlugin(options: TabsPluginOptions = {}): CanvasPlugin & { api: TabsApi } {
	const resolver = options.resolver ?? null;
	const tabs: TabState[] = [];
	let activeId: string | null = null;
	let canvasApi: CanvasApi | null = null;
	let tabBar: HTMLDivElement | null = null;
	let contentArea: HTMLDivElement | null = null;
	let welcomeEl: HTMLDivElement | null = null;
	let dynamicSectionsEl: HTMLDivElement | null = null;
	let dropdownEl: HTMLDivElement | null = null;
	let recentBtnEl: HTMLButtonElement | null = null;
	let recentListEl: HTMLDivElement | null = null;
	let theme: "dark" | "light" = "dark";
	let offDiagramChange: (() => void) | undefined;
	let isRawMode = false;
	let rawPaneEl: HTMLDivElement | null = null;
	let rawPreEl: HTMLPreElement | null = null;
	let rawModeBtn: HTMLButtonElement | null = null;

	let isProjectMode = false;
	let centerSlotEl: HTMLDivElement | null = null;
	let fileInputEl: HTMLInputElement | null = null;
	let dndDragoverHandler: ((e: DragEvent) => void) | null = null;
	let dndDropHandler: ((e: DragEvent) => void) | null = null;

	async function importFiles(files: FileList | File[]): Promise<void> {
		for (const file of Array.from(files)) {
			const name = file.name;
			const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
			try {
				const text = await file.text();
				if (ext === ".bpmn" || ext === ".xml") {
					Bpmn.parse(text); // validate — throws on malformed XML
					api.openTab({ type: "bpmn", xml: text, name });
				} else if (ext === ".dmn") {
					const defs = Dmn.parse(text);
					if (resolver instanceof InMemoryFileResolver) resolver.registerDmn(defs);
					api.openTab({ type: "dmn", defs, name: defs.name ?? name });
				} else if (ext === ".form" || ext === ".json") {
					const form = Form.parse(text);
					if (resolver instanceof InMemoryFileResolver) resolver.registerForm(form);
					api.openTab({ type: "form", form, name: form.id ?? name });
				}
			} catch (err) {
				console.error(`[bpmn-sdk] Failed to import ${name}:`, err);
			}
		}
	}

	/** Tracks which tab ID each BPMN process ID belongs to. */
	const bpmnProcessToTabId = new Map<string, string>();
	/** Display name for each tracked BPMN process ID. */
	const bpmnProcessNames = new Map<string, string>();

	/** Tracks the last-activated tab ID per type group. */
	const groupActiveId = new Map<TabConfig["type"], string>();
	/** Which type group's dropdown is currently open, if any. */
	let openDropdownType: TabConfig["type"] | null = null;
	let outsideClickHandler: ((e: PointerEvent) => void) | null = null;

	// Cast helper for editor events that extend CanvasEvents at runtime
	type AnyOn = (event: string, handler: (...args: unknown[]) => void) => () => void;

	// --- Close-confirmation dialog ---

	/** Returns true when a tab has in-memory content worth offering to save. */
	function hasContent(config: TabConfig): boolean {
		// A BPMN tab with xml:"" represents the main canvas — skip dialog for it.
		if (config.type === "bpmn") return config.xml.length > 0;
		if (config.type === "feel") return false;
		return true; // dmn and form always carry parsed content
	}

	/**
	 * Shows an in-canvas confirmation dialog asking the user whether to download
	 * the tab's content before closing.
	 */
	function showCloseDialog(
		container: HTMLElement,
		tabName: string,
		onDownload: (() => void) | null,
		onClose: () => void,
	): void {
		const overlay = document.createElement("div");
		overlay.className = "bpmn-close-overlay";

		const dialog = document.createElement("div");
		dialog.className = "bpmn-close-dialog";
		dialog.dataset.theme = theme;

		const titleEl = document.createElement("div");
		titleEl.className = "bpmn-close-dialog-title";
		titleEl.textContent = `Close "${tabName}"?`;

		const bodyEl = document.createElement("div");
		bodyEl.className = "bpmn-close-dialog-body";
		bodyEl.textContent =
			"This file only exists in memory and will be lost. Download a copy before closing?";

		const actionsEl = document.createElement("div");
		actionsEl.className = "bpmn-close-dialog-actions";

		function dismiss(): void {
			overlay.remove();
			document.removeEventListener("keydown", handleKey);
		}

		const cancelBtn = document.createElement("button");
		cancelBtn.type = "button";
		cancelBtn.className = "bpmn-close-dialog-btn ghost";
		cancelBtn.textContent = "Cancel";
		cancelBtn.addEventListener("click", dismiss);

		const discardBtn = document.createElement("button");
		discardBtn.type = "button";
		discardBtn.className = "bpmn-close-dialog-btn secondary";
		discardBtn.textContent = "Close without saving";
		discardBtn.addEventListener("click", () => {
			dismiss();
			onClose();
		});

		actionsEl.appendChild(cancelBtn);
		actionsEl.appendChild(discardBtn);

		if (onDownload) {
			const downloadBtn = document.createElement("button");
			downloadBtn.type = "button";
			downloadBtn.className = "bpmn-close-dialog-btn primary";
			downloadBtn.textContent = "Download & Close";
			downloadBtn.addEventListener("click", () => {
				dismiss();
				onDownload();
				onClose();
			});
			actionsEl.appendChild(downloadBtn);
			// Delay focus so the button is in the DOM and focusable
			requestAnimationFrame(() => downloadBtn.focus());
		}

		dialog.appendChild(titleEl);
		dialog.appendChild(bodyEl);
		dialog.appendChild(actionsEl);
		overlay.appendChild(dialog);
		container.appendChild(overlay);

		function handleKey(e: KeyboardEvent): void {
			if (e.key === "Escape") dismiss();
		}
		document.addEventListener("keydown", handleKey);
	}

	// --- Welcome screen ---

	function createWelcomeEl(): HTMLDivElement {
		const el = document.createElement("div");
		el.className = "bpmn-welcome";
		el.dataset.theme = theme;
		el.style.display = "none";

		const inner = document.createElement("div");
		inner.className = "bpmn-welcome-inner";

		const iconEl = document.createElement("div");
		iconEl.className = "bpmn-welcome-icon";
		iconEl.innerHTML =
			'<svg viewBox="0 0 64 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
			'<circle cx="8" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="2"/>' +
			'<rect x="22" y="8" width="20" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>' +
			'<circle cx="56" cy="16" r="7" fill="none" stroke="currentColor" stroke-width="3"/>' +
			'<line x1="15" y1="16" x2="22" y2="16" stroke="currentColor" stroke-width="2"/>' +
			'<line x1="42" y1="16" x2="49" y2="16" stroke="currentColor" stroke-width="2"/>' +
			"</svg>";
		inner.appendChild(iconEl);

		const title = document.createElement("h2");
		title.className = "bpmn-welcome-title";
		title.textContent = "BPMN Editor";
		inner.appendChild(title);

		const sub = document.createElement("p");
		sub.className = "bpmn-welcome-sub";
		sub.textContent = "Open a diagram or start fresh to get going.";
		inner.appendChild(sub);

		const actions = document.createElement("div");
		actions.className = "bpmn-welcome-actions";

		const newBtn = document.createElement("button");
		newBtn.type = "button";
		newBtn.className = "bpmn-welcome-btn primary";
		newBtn.textContent = "New diagram";
		newBtn.addEventListener("click", () => options.onNewDiagram?.());

		const importBtn = document.createElement("button");
		importBtn.type = "button";
		importBtn.className = "bpmn-welcome-btn secondary";
		importBtn.textContent = "Import files\u2026";
		importBtn.addEventListener("click", () => {
			if (options.onImportFiles) {
				options.onImportFiles();
			} else if (options.enableFileImport) {
				api.openFilePicker();
			}
		});

		actions.appendChild(newBtn);
		actions.appendChild(importBtn);

		// Recent projects dropdown button — populated each time the welcome screen is shown
		if (options.getRecentProjects) {
			const recentBtn = document.createElement("button");
			recentBtn.type = "button";
			recentBtn.className = "bpmn-welcome-btn secondary";
			recentBtn.disabled = true;
			recentBtnEl = recentBtn;

			const recentList = document.createElement("div");
			recentList.className = "bpmn-welcome-recent-list";
			recentList.style.display = "none";
			recentListEl = recentList;

			recentBtn.addEventListener("click", () => {
				if (!recentListEl) return;
				recentListEl.style.display = recentListEl.style.display === "none" ? "" : "none";
			});

			actions.appendChild(recentBtn);
			actions.appendChild(recentList);
		}

		inner.appendChild(actions);

		if (options.examples && options.examples.length > 0) {
			const divider = document.createElement("div");
			divider.className = "bpmn-welcome-divider";
			inner.appendChild(divider);

			const examplesLabel = document.createElement("div");
			examplesLabel.className = "bpmn-welcome-examples-label";
			examplesLabel.textContent = "Examples";
			inner.appendChild(examplesLabel);

			const list = document.createElement("div");
			list.className = "bpmn-welcome-examples";
			for (const example of options.examples) {
				const item = document.createElement("button");
				item.type = "button";
				item.className = "bpmn-welcome-example";
				item.addEventListener("click", () => example.onOpen());

				if (example.badge) {
					const badge = document.createElement("span");
					badge.className = `bpmn-welcome-example-badge ${example.badge.toLowerCase()}`;
					badge.textContent = example.badge;
					item.appendChild(badge);
				}

				const text = document.createElement("span");
				text.className = "bpmn-welcome-example-text";

				const labelEl = document.createElement("span");
				labelEl.className = "bpmn-welcome-example-label";
				labelEl.textContent = example.label;
				text.appendChild(labelEl);

				if (example.description) {
					const descEl = document.createElement("span");
					descEl.className = "bpmn-welcome-example-desc";
					descEl.textContent = example.description;
					text.appendChild(descEl);
				}

				item.appendChild(text);

				const arrow = document.createElement("span");
				arrow.className = "bpmn-welcome-example-arrow";
				arrow.innerHTML =
					'<svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 7,6 1,11"/></svg>';
				item.appendChild(arrow);

				list.appendChild(item);
			}
			inner.appendChild(list);
		}

		// Placeholder for dynamic sections (e.g. projects) — populated on each show
		if (options.getWelcomeSections) {
			const sectionsContainer = document.createElement("div");
			sectionsContainer.className = "bpmn-welcome-dynamic-sections";
			inner.appendChild(sectionsContainer);
			dynamicSectionsEl = sectionsContainer;
		}

		el.appendChild(inner);
		return el;
	}

	function renderDynamicSections(): void {
		const container = dynamicSectionsEl;
		if (!container || !options.getWelcomeSections) return;
		container.textContent = "";
		const sections = options.getWelcomeSections();
		for (const section of sections) {
			const items = section.getItems();

			const divider = document.createElement("div");
			divider.className = "bpmn-welcome-divider";
			container.appendChild(divider);

			const sectionLabel = document.createElement("div");
			sectionLabel.className = "bpmn-welcome-examples-label";
			sectionLabel.textContent = section.label;
			container.appendChild(sectionLabel);

			if (items.length === 0 && section.emptyText) {
				const empty = document.createElement("div");
				empty.className = "bpmn-welcome-empty";
				empty.textContent = section.emptyText;
				container.appendChild(empty);
				continue;
			}

			const list = document.createElement("div");
			list.className = "bpmn-welcome-examples";
			for (const item of items) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "bpmn-welcome-example";
				btn.addEventListener("click", () => item.onOpen());

				const text = document.createElement("span");
				text.className = "bpmn-welcome-example-text";

				const labelEl = document.createElement("span");
				labelEl.className = "bpmn-welcome-example-label";
				labelEl.textContent = item.label;
				text.appendChild(labelEl);

				if (item.description) {
					const descEl = document.createElement("span");
					descEl.className = "bpmn-welcome-example-desc";
					descEl.textContent = item.description;
					text.appendChild(descEl);
				}

				btn.appendChild(text);

				const arrow = document.createElement("span");
				arrow.className = "bpmn-welcome-example-arrow";
				arrow.innerHTML =
					'<svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 7,6 1,11"/></svg>';
				btn.appendChild(arrow);

				list.appendChild(btn);
			}
			container.appendChild(list);
		}
	}

	function renderRecentProjects(): void {
		if (!recentBtnEl || !recentListEl || !options.getRecentProjects) return;
		const items = options.getRecentProjects();
		if (!items || items.length === 0) {
			recentBtnEl.disabled = true;
			recentBtnEl.textContent = "Open recent\u2026";
			recentListEl.style.display = "none";
			return;
		}
		recentBtnEl.disabled = false;
		recentBtnEl.innerHTML =
			'Open recent\u2026 <svg style="width:8px;height:5px;vertical-align:middle;margin-left:2px" viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>';
		// Collapse the list on re-render
		recentListEl.style.display = "none";
		recentListEl.textContent = "";
		for (const item of items) {
			const btn = document.createElement("button");
			btn.type = "button";
			btn.className = "bpmn-welcome-example";
			btn.addEventListener("click", () => {
				if (recentListEl) recentListEl.style.display = "none";
				item.onOpen();
			});

			const text = document.createElement("span");
			text.className = "bpmn-welcome-example-text";

			const labelEl = document.createElement("span");
			labelEl.className = "bpmn-welcome-example-label";
			labelEl.textContent = item.label;
			text.appendChild(labelEl);

			if (item.description) {
				const descEl = document.createElement("span");
				descEl.className = "bpmn-welcome-example-desc";
				descEl.textContent = item.description;
				text.appendChild(descEl);
			}

			btn.appendChild(text);

			const arrow = document.createElement("span");
			arrow.className = "bpmn-welcome-example-arrow";
			arrow.innerHTML =
				'<svg viewBox="0 0 8 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1,1 7,6 1,11"/></svg>';
			btn.appendChild(arrow);

			recentListEl.appendChild(btn);
		}
	}

	function showWelcomeScreen(): void {
		if (welcomeEl) welcomeEl.style.display = "";
		renderDynamicSections();
		renderRecentProjects();
		// Defer so the callback runs after all synchronous plugin/HUD initialization
		// completes. On initial install the HUD elements don't exist yet; rAF fires
		// after the current JS task, by which time initEditorHud() has run.
		requestAnimationFrame(() => options.onWelcomeShow?.());
	}

	function hideWelcomeScreen(): void {
		if (welcomeEl) welcomeEl.style.display = "none";
	}

	// --- Group dropdown ---

	function closeDropdownEl(): void {
		if (dropdownEl) dropdownEl.classList.remove("open");
		openDropdownType = null;
	}

	function openDropdown(type: TabConfig["type"], group: TabState[], anchorEl: HTMLElement): void {
		if (!dropdownEl) return;
		dropdownEl.innerHTML = "";
		dropdownEl.dataset.theme = theme;

		for (const tab of group) {
			const item = document.createElement("div");
			item.className = "bpmn-tab-drop-item";
			if (tab.id === groupActiveId.get(type)) item.classList.add("active");

			const nameSpan = document.createElement("span");
			nameSpan.className = "bpmn-tab-drop-name";
			nameSpan.textContent = tab.config.name ?? tab.id;
			item.appendChild(nameSpan);

			if (!isProjectMode) {
				const closeBtn = document.createElement("span");
				closeBtn.className = "bpmn-tab-close";
				closeBtn.textContent = "×";
				closeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					closeDropdownEl();
					requestClose(tab);
				});
				item.appendChild(closeBtn);
			}

			item.addEventListener("click", () => {
				groupActiveId.set(type, tab.id);
				api.setActiveTab(tab.id);
				closeDropdownEl();
			});

			dropdownEl.appendChild(item);
		}

		const rect = anchorEl.getBoundingClientRect();
		dropdownEl.style.top = `${rect.bottom}px`;
		dropdownEl.style.left = `${rect.left}px`;
		dropdownEl.classList.add("open");
		openDropdownType = type;
	}

	function toggleDropdown(type: TabConfig["type"], group: TabState[], anchorEl: HTMLElement): void {
		if (openDropdownType === type) {
			closeDropdownEl();
		} else {
			openDropdown(type, group, anchorEl);
		}
	}

	// --- Tab bar rendering ---

	function requestClose(tab: TabState): void {
		if (isProjectMode) return;
		if (hasContent(tab.config) && canvasApi) {
			const tabName = tab.config.name ?? `${tab.config.type} tab`;
			const onDownload = options.onDownloadTab ? () => options.onDownloadTab?.(tab.config) : null;
			showCloseDialog(canvasApi.container, tabName, onDownload, () => api.closeTab(tab.id));
		} else {
			api.closeTab(tab.id);
		}
	}

	/**
	 * Rebuilds the tab bar from scratch.
	 * At most three group tabs are rendered (one per type: BPMN, DMN, Form).
	 */
	function renderTabBar(): void {
		if (!tabBar) return;
		tabBar.innerHTML = "";

		for (const type of GROUP_TYPES) {
			const group = tabs.filter((t) => t.config.type === type);
			if (group.length === 0) continue;

			// Ensure groupActiveId[type] points to a valid tab in this group
			if (!group.some((t) => t.id === groupActiveId.get(type))) {
				const first = group[0];
				if (first) groupActiveId.set(type, first.id);
			}

			const isGroupActive = group.some((t) => t.id === activeId);
			createGroupTabEl(type, group, isGroupActive);
		}

		// Center slot must be re-appended after innerHTML clear
		if (centerSlotEl) tabBar.appendChild(centerSlotEl);

		updateRawModeBtn();
	}

	function createGroupTabEl(
		type: TabConfig["type"],
		group: TabState[],
		isGroupActive: boolean,
	): void {
		const el = document.createElement("div");
		el.className = `bpmn-tab${isGroupActive ? " active" : ""}`;

		// Type badge
		const typeBadge = document.createElement("span");
		typeBadge.className = `bpmn-tab-type ${type}`;
		typeBadge.textContent = type.toUpperCase();
		el.appendChild(typeBadge);

		// Active file name within this group
		const activeTabId = groupActiveId.get(type);
		const activeTab = group.find((t) => t.id === activeTabId) ?? group[0];
		const nameEl = document.createElement("span");
		nameEl.className = "bpmn-tab-name";
		nameEl.textContent = activeTab?.config.name ?? type;
		el.appendChild(nameEl);

		// Warn indicator — shown if the group's active tab has a warning
		if (activeTab?.hasWarning) {
			const warnEl = document.createElement("span");
			warnEl.className = "bpmn-tab-warn";
			warnEl.textContent = "⚠";
			warnEl.title = "Referenced file not found in registry";
			el.appendChild(warnEl);
		}

		if (group.length > 1) {
			// Chevron — opens the group dropdown listing all files of this type
			const chevron = document.createElement("span");
			chevron.className = "bpmn-tab-chevron";
			chevron.innerHTML =
				'<svg viewBox="0 0 10 6" fill="currentColor"><path d="M0 0l5 6 5-6z"/></svg>';
			el.appendChild(chevron);
		} else if (!isProjectMode) {
			// Close button — only when the group has a single file and not in project mode
			const tab = group[0];
			if (tab) {
				const closeBtn = document.createElement("span");
				closeBtn.className = "bpmn-tab-close";
				closeBtn.textContent = "×";
				closeBtn.addEventListener("click", (e) => {
					e.stopPropagation();
					requestClose(tab);
				});
				el.appendChild(closeBtn);
			}
		}

		el.addEventListener("click", () => {
			// Toggle dropdown first (while el is still in the DOM for correct positioning)
			if (group.length > 1) {
				toggleDropdown(type, group, el);
			}
			// Activate the group's last-selected file
			const id = groupActiveId.get(type);
			if (id) api.setActiveTab(id);
		});

		tabBar?.appendChild(el);
	}

	// --- Tab content mounting ---

	function mountTabContent(tab: TabState): void {
		const pane = document.createElement("div");
		pane.className = "bpmn-tab-pane hidden";
		contentArea?.appendChild(pane);
		tab.pane = pane;

		if (tab.config.type === "dmn") {
			const editor = new DmnEditor({ container: pane, theme });
			tab.dmnEditor = editor;
			const xml = Dmn.export(tab.config.defs);
			void editor.loadXML(xml);
			tab.offDmnChange = editor.onChange(() => {
				void (async () => {
					const newXml = await editor.getXML();
					if (tab.config.type === "dmn") {
						try {
							tab.config = { type: "dmn", defs: Dmn.parse(newXml), name: tab.config.name };
						} catch {
							// keep old defs if parse fails
						}
						options.onTabChange?.(tab.id, tab.config);
					}
				})();
			});
		} else if (tab.config.type === "form") {
			const editor = new FormEditor({ container: pane, theme });
			tab.formEditor = editor;
			const schema = JSON.parse(Form.export(tab.config.form)) as Record<string, unknown>;
			void editor.loadSchema(schema);
			tab.offFormChange = editor.onChange(() => {
				if (tab.config.type === "form") {
					const newSchema = editor.getSchema();
					try {
						tab.config = {
							type: "form",
							form: Form.parse(JSON.stringify(newSchema)),
							name: tab.config.name,
						};
					} catch {
						// keep old form if parse fails
					}
					options.onTabChange?.(tab.id, tab.config);
				}
			});
		} else if (tab.config.type === "feel") {
			injectPlaygroundStyles();
			pane.appendChild(buildFeelPlaygroundPanel(undefined, tab.config.expression));
		}
		// BPMN pane is intentionally empty and transparent — the main canvas SVG
		// shows through. pointer-events are set to none in setActiveTab.
	}

	function applyThemeToTab(tab: TabState): void {
		tab.dmnEditor?.setTheme(theme);
		tab.formEditor?.setTheme(theme);
	}

	function showWarning(tab: TabState, show: boolean): void {
		tab.hasWarning = show;
		renderTabBar();
	}

	// --- BPMN process tracking ---

	function trackBpmnProcesses(tabId: string, xml: string): void {
		try {
			for (const proc of Bpmn.parse(xml).processes) {
				bpmnProcessToTabId.set(proc.id, tabId);
				bpmnProcessNames.set(proc.id, proc.name ?? proc.id);
			}
		} catch {
			// Malformed XML — tab still opens, process map unchanged
		}
	}

	function untrackBpmnProcesses(tabId: string): void {
		for (const [procId, tid] of [...bpmnProcessToTabId]) {
			if (tid === tabId) {
				bpmnProcessToTabId.delete(procId);
				bpmnProcessNames.delete(procId);
			}
		}
	}

	// --- Raw mode ---

	function getTabSource(tab: TabState): string {
		if (tab.config.type === "bpmn") return tab.config.xml;
		if (tab.config.type === "dmn") return Dmn.export(tab.config.defs);
		if (tab.config.type === "form") return Form.export(tab.config.form);
		return "";
	}

	function updateRawModeBtn(): void {
		if (!rawModeBtn) return;
		const activeTab = activeId !== null ? tabs.find((t) => t.id === activeId) : undefined;
		rawModeBtn.disabled = activeTab === undefined || activeTab.config.type === "feel";
		rawModeBtn.classList.toggle("active", isRawMode);
	}

	function updateRawPane(): void {
		if (!rawPaneEl || !rawPreEl) return;
		const activeTab = activeId !== null ? tabs.find((t) => t.id === activeId) : undefined;
		if (!isRawMode || !activeTab || activeTab.config.type === "feel") {
			rawPaneEl.style.display = "none";
			return;
		}
		rawPreEl.textContent = getTabSource(activeTab);
		rawPaneEl.style.display = "";
	}

	// --- Public API ---

	const api: TabsApi = {
		openTab(config: TabConfig): string {
			const id = `tab_${++_tabCounter}`;
			const tab: TabState = {
				id,
				config,
				pane: null as unknown as HTMLDivElement,
				hasWarning: false,
			};
			tabs.push(tab);
			groupActiveId.set(config.type, id);
			hideWelcomeScreen();

			if (contentArea) mountTabContent(tab);

			// Track BPMN processes for navigation and the config panel picker
			if (config.type === "bpmn") {
				trackBpmnProcesses(id, config.xml);
			}

			renderTabBar();
			api.setActiveTab(id);
			return id;
		},

		closeTab(id: string): void {
			const idx = tabs.findIndex((t) => t.id === id);
			if (idx === -1) return;
			const [tab] = tabs.splice(idx, 1);
			if (!tab) return;

			tab.offDmnChange?.();
			tab.offFormChange?.();
			tab.dmnEditor?.destroy();
			tab.formEditor?.destroy();
			tab.pane.remove();

			if (tab.config.type === "bpmn") {
				untrackBpmnProcesses(id);
			}

			if (activeId === id) {
				const next = tabs[idx] ?? tabs[idx - 1];
				activeId = null;
				if (next) {
					api.setActiveTab(next.id);
				} else {
					// All tabs closed — restore pointer-events and show welcome screen
					if (contentArea) contentArea.style.pointerEvents = "";
					showWelcomeScreen();
				}
			}

			renderTabBar();
		},

		closeAllTabs(): void {
			bpmnProcessToTabId.clear();
			bpmnProcessNames.clear();
			isRawMode = false;
			for (const tab of [...tabs]) {
				tab.offDmnChange?.();
				tab.offFormChange?.();
				tab.dmnEditor?.destroy();
				tab.formEditor?.destroy();
				tab.pane.remove();
			}
			tabs.length = 0;
			activeId = null;
			groupActiveId.clear();
			if (contentArea) contentArea.style.pointerEvents = "";
			if (rawPaneEl) rawPaneEl.style.display = "none";
			renderTabBar();
			showWelcomeScreen();
		},

		setActiveTab(id: string): void {
			const tab = tabs.find((t) => t.id === id);
			if (!tab) return;

			// Deactivate current
			if (activeId) {
				const prev = tabs.find((t) => t.id === activeId);
				if (prev) prev.pane.classList.add("hidden");
			}

			// Activate new
			activeId = id;
			tab.pane.classList.remove("hidden");
			groupActiveId.set(tab.config.type, id);

			// BPMN panes are transparent; disable pointer-events so the canvas is interactive.
			// In raw mode the raw pane overlays everything so pointer-events must stay on.
			if (contentArea) {
				contentArea.style.pointerEvents = tab.config.type === "bpmn" && !isRawMode ? "none" : "";
			}

			renderTabBar();
			options.onTabActivate?.(id, tab.config);
			updateRawPane();
		},

		getActiveTabId(): string | null {
			return activeId;
		},

		getTabIds(): string[] {
			return tabs.map((t) => t.id);
		},

		navigateToProcess(processId: string): void {
			const tabId = bpmnProcessToTabId.get(processId);
			if (tabId && tabs.some((t) => t.id === tabId)) {
				api.setActiveTab(tabId);
			}
		},

		getAvailableProcesses(): Array<{ id: string; name?: string }> {
			return [...bpmnProcessToTabId.keys()].map((id) => ({
				id,
				name: bpmnProcessNames.get(id),
			}));
		},

		getAvailableDecisions(): Array<{ id: string; name?: string }> {
			const result: Array<{ id: string; name?: string }> = [];
			for (const tab of tabs) {
				if (tab.config.type !== "dmn") continue;
				for (const decision of tab.config.defs.decisions) {
					result.push({ id: decision.id, name: decision.name ?? undefined });
				}
			}
			return result;
		},

		getAvailableForms(): Array<{ id: string; name?: string }> {
			const result: Array<{ id: string; name?: string }> = [];
			for (const tab of tabs) {
				if (tab.config.type !== "form") continue;
				const formId = tab.config.form.id;
				if (formId) result.push({ id: formId, name: tab.config.name });
			}
			return result;
		},

		getAllTabContent(): TabContentSnapshot[] {
			const result: TabContentSnapshot[] = [];
			for (const tab of tabs) {
				if (tab.config.type === "bpmn") {
					result.push({
						tabId: tab.id,
						name: tab.config.name ?? "Diagram",
						type: "bpmn",
						content: tab.config.xml,
					});
				} else if (tab.config.type === "dmn") {
					result.push({
						tabId: tab.id,
						name: tab.config.name ?? "Decision",
						type: "dmn",
						content: Dmn.export(tab.config.defs),
					});
				} else if (tab.config.type === "form") {
					result.push({
						tabId: tab.id,
						name: tab.config.name ?? "Form",
						type: "form",
						content: Form.export(tab.config.form),
					});
				}
				// FEEL tabs have no file content — skipped
			}
			return result;
		},

		refreshWelcomeScreen(): void {
			renderRecentProjects();
			renderDynamicSections();
		},

		setProjectMode(enabled: boolean): void {
			isProjectMode = enabled;
			renderTabBar();
		},

		renameTab(id: string, name: string): void {
			const tab = tabs.find((t) => t.id === id);
			if (!tab) return;
			tab.config = { ...tab.config, name };
			renderTabBar();
		},

		get rawModeButton(): HTMLButtonElement | null {
			return rawModeBtn;
		},

		openFilePicker(): void {
			fileInputEl?.click();
		},

		setPlayMode(enabled: boolean): void {
			if (tabBar === null) return;
			if (enabled) {
				tabBar.classList.add("bpmn-play-mode");
			} else {
				tabBar.classList.remove("bpmn-play-mode");
			}
		},

		openDecision(decisionId: string): void {
			// Check if already open
			const existing = tabs.find(
				(t) => t.config.type === "dmn" && t.config.defs.decisions.some((d) => d.id === decisionId),
			);
			if (existing) {
				api.setActiveTab(existing.id);
				return;
			}

			const defs = resolver?.resolveDmn(decisionId) ?? null;
			if (!defs) {
				// Open a tab with a warning
				const id = api.openTab({
					type: "dmn",
					defs: {
						id: decisionId,
						name: decisionId,
						namespace: "",
						namespaces: {},
						modelerAttributes: {},
						decisions: [],
						inputData: [],
						knowledgeSources: [],
						businessKnowledgeModels: [],
						textAnnotations: [],
						associations: [],
					},
					name: decisionId,
				});
				const tab = tabs.find((t) => t.id === id);
				if (tab) showWarning(tab, true);
				return;
			}

			const decision = defs.decisions.find((d) => d.id === decisionId);
			api.openTab({ type: "dmn", defs, name: decision?.name ?? decisionId });
		},

		openForm(formId: string): void {
			// Check if already open
			const existing = tabs.find((t) => t.config.type === "form" && t.config.form.id === formId);
			if (existing) {
				api.setActiveTab(existing.id);
				return;
			}

			const form = resolver?.resolveForm(formId) ?? null;
			if (!form) {
				const id = api.openTab({
					type: "form",
					form: { id: formId, type: "default", components: [] },
					name: formId,
				});
				const tab = tabs.find((t) => t.id === id);
				if (tab) showWarning(tab, true);
				return;
			}

			api.openTab({ type: "form", form, name: form.id });
		},
	};

	// --- CanvasPlugin ---

	return {
		name: "tabs",
		api,

		install(cApi: CanvasApi): void {
			canvasApi = cApi;
			injectTabsStyles();

			// Detect theme from canvas (canvas sets data-theme="dark" for dark, removes it for light)
			const container = cApi.container;
			theme = container.dataset.theme === "dark" ? "dark" : "light";

			// Expand container to be position:relative for absolute children
			if (getComputedStyle(container).position === "static") {
				container.style.position = "relative";
			}

			// Create tab bar
			tabBar = document.createElement("div");
			tabBar.className = "bpmn-tabs";
			tabBar.dataset.theme = theme;
			container.appendChild(tabBar);

			if (options.centerSlot) {
				centerSlotEl = document.createElement("div");
				centerSlotEl.className = "bpmn-tabs-center";
				centerSlotEl.appendChild(options.centerSlot);
				tabBar.appendChild(centerSlotEl);
			}

			// Create content area (below tab bar)
			contentArea = document.createElement("div");
			contentArea.className = "bpmn-tab-content";
			container.appendChild(contentArea);

			// Create welcome screen (shown until the first tab opens)
			welcomeEl = createWelcomeEl();
			contentArea.appendChild(welcomeEl);
			showWelcomeScreen();

			// Create raw source pane (overlaid on top of content when raw mode is on)
			rawPaneEl = document.createElement("div");
			rawPaneEl.className = "bpmn-raw-pane";
			rawPaneEl.dataset.theme = theme;
			rawPaneEl.style.display = "none";
			rawPreEl = document.createElement("pre");
			rawPreEl.className = "bpmn-raw-content";
			rawPaneEl.appendChild(rawPreEl);
			contentArea.appendChild(rawPaneEl);

			// Raw mode toggle button — exposed via api.rawModeButton; caller places it in the HUD
			rawModeBtn = document.createElement("button");
			rawModeBtn.type = "button";
			rawModeBtn.title = "Toggle raw source";
			rawModeBtn.disabled = true;
			rawModeBtn.innerHTML = RAW_MODE_ICON;
			rawModeBtn.addEventListener("click", () => {
				isRawMode = !isRawMode;
				const activeTab = activeId !== null ? tabs.find((t) => t.id === activeId) : undefined;
				if (contentArea && activeTab?.config.type === "bpmn") {
					contentArea.style.pointerEvents = isRawMode ? "" : "none";
				}
				updateRawPane();
				updateRawModeBtn();
			});

			// Create body-level dropdown for groups with multiple files
			dropdownEl = document.createElement("div");
			dropdownEl.className = "bpmn-tab-dropdown";
			dropdownEl.dataset.theme = theme;
			document.body.appendChild(dropdownEl);

			// Close dropdown when clicking outside the tab bar or dropdown
			outsideClickHandler = (e: PointerEvent) => {
				if (
					dropdownEl &&
					!dropdownEl.contains(e.target as Node) &&
					!tabBar?.contains(e.target as Node)
				) {
					closeDropdownEl();
				}
			};
			document.addEventListener("pointerdown", outsideClickHandler);

			// File import — hidden input + drag-and-drop
			if (options.enableFileImport) {
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
				fileInputEl = fileInput;

				dndDragoverHandler = (e: DragEvent) => {
					e.preventDefault();
				};
				dndDropHandler = (e: DragEvent) => {
					e.preventDefault();
					const files = e.dataTransfer?.files;
					if (files && files.length > 0) void importFiles(files);
				};
				container.addEventListener("dragover", dndDragoverHandler);
				container.addEventListener("drop", dndDropHandler);
			}

			// Subscribe to diagram:change to keep BPMN tab XML and process maps up to date
			const anyOn = cApi.on.bind(cApi) as unknown as AnyOn;
			offDiagramChange = anyOn("diagram:change", (rawDefs) => {
				if (!activeId) return;
				const activeTab = tabs.find((t) => t.id === activeId);
				if (!activeTab || activeTab.config.type !== "bpmn") return;
				const defs = rawDefs as BpmnDefinitions;
				const xml = Bpmn.export(defs);
				// Update stored XML so onTabActivate always receives the latest content
				activeTab.config = { ...activeTab.config, xml };
				// Refresh process map for this tab
				untrackBpmnProcesses(activeId);
				trackBpmnProcesses(activeId, xml);
				// Keep raw pane in sync
				if (isRawMode) updateRawPane();
			});

			// Listen for theme changes (canvas toggles data-theme="dark"; absence means light)
			const observer = new MutationObserver(() => {
				const t = container.dataset.theme;
				theme = t === "dark" ? "dark" : "light";
				if (tabBar) tabBar.dataset.theme = theme;
				if (welcomeEl) welcomeEl.dataset.theme = theme;
				if (dropdownEl) dropdownEl.dataset.theme = theme;
				if (rawPaneEl) rawPaneEl.dataset.theme = theme;
				for (const tab of tabs) applyThemeToTab(tab);
			});
			observer.observe(container, { attributes: true, attributeFilter: ["data-theme"] });
		},

		uninstall(): void {
			offDiagramChange?.();
			offDiagramChange = undefined;
			if (outsideClickHandler) {
				document.removeEventListener("pointerdown", outsideClickHandler);
				outsideClickHandler = null;
			}
			if (fileInputEl) {
				fileInputEl.remove();
				fileInputEl = null;
			}
			if (canvasApi && dndDragoverHandler) {
				canvasApi.container.removeEventListener("dragover", dndDragoverHandler);
				dndDragoverHandler = null;
			}
			if (canvasApi && dndDropHandler) {
				canvasApi.container.removeEventListener("drop", dndDropHandler);
				dndDropHandler = null;
			}
			dropdownEl?.remove();
			dropdownEl = null;
			welcomeEl?.remove();
			welcomeEl = null;
			dynamicSectionsEl = null;
			recentBtnEl = null;
			recentListEl = null;
			isRawMode = false;
			rawPaneEl = null;
			rawPreEl = null;
			rawModeBtn = null;
			bpmnProcessToTabId.clear();
			bpmnProcessNames.clear();
			for (const tab of tabs) {
				tab.offDmnChange?.();
				tab.offFormChange?.();
				tab.dmnEditor?.destroy();
				tab.formEditor?.destroy();
			}
			tabs.length = 0;
			activeId = null;
			groupActiveId.clear();
			openDropdownType = null;
			tabBar?.remove();
			contentArea?.remove();
			tabBar = null;
			contentArea = null;
			centerSlotEl = null;
			canvasApi = null;
		},
	};
}
