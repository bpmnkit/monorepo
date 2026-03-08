import type { ViewportState } from "@bpmn-sdk/canvas";
import { readDiColor } from "@bpmn-sdk/core";
import { injectHudStyles } from "./css.js";
import type { BpmnEditor } from "./editor.js";
import {
	CONTEXTUAL_ADD_TYPES,
	ELEMENT_GROUPS,
	ELEMENT_TYPE_LABELS,
	EXTERNAL_LABEL_TYPES,
	getElementGroup,
	getValidLabelPositions,
} from "./element-groups.js";
import { IC } from "./icons.js";
import { showHudInputModal } from "./modal.js";
import type { CreateShapeType, LabelPosition, Tool } from "./types.js";

interface GroupDef {
	id: string;
	title: string;
	groupIcon: string;
	defaultType: CreateShapeType;
	items: Array<{ type: CreateShapeType; icon: string; title: string }>;
}

const GROUP_ICONS: Record<string, string> = {
	startEvents: IC.startEvent,
	endEvents: IC.endEvent,
	intermediateEvents: IC.messageCatchEvent,
	activities: IC.task,
	gateways: IC.exclusiveGateway,
	annotations: IC.textAnnotation,
};

const COLOR_PALETTE: ReadonlyArray<{ fill: string; stroke: string }> = [
	{ fill: "#bbdefb", stroke: "#0d4372" },
	{ fill: "#c8e6c9", stroke: "#1b5e20" },
	{ fill: "#fff9c4", stroke: "#f57f17" },
	{ fill: "#ffccbc", stroke: "#bf360c" },
	{ fill: "#e1bee7", stroke: "#4a148c" },
	{ fill: "#dcedc8", stroke: "#33691e" },
];

const GROUPS: GroupDef[] = ELEMENT_GROUPS.map((g) => ({
	...g,
	groupIcon: GROUP_ICONS[g.id] ?? "",
	items: g.types.map((type) => ({
		type,
		icon: (IC as Record<CreateShapeType, string>)[type],
		title: ELEMENT_TYPE_LABELS[type],
	})),
}));

const CTX_OPTIONS = CONTEXTUAL_ADD_TYPES.map((type) => ({
	type,
	icon: (IC as Record<CreateShapeType, string>)[type],
	title: `Add ${ELEMENT_TYPE_LABELS[type]}`,
}));

const POSITION_LABELS: Record<LabelPosition, string> = {
	bottom: "Below (centered)",
	top: "Above (centered)",
	left: "Left",
	right: "Right",
	"bottom-left": "Bottom left",
	"bottom-right": "Bottom right",
	"top-left": "Top left",
	"top-right": "Top right",
};

export interface HudOptions {
	/**
	 * Called when the user clicks the navigate link above a call activity that
	 * already has a process linked. Receives the `processId` from `zeebe:calledElement`.
	 */
	openProcess?: (processId: string) => void;
	/** Returns available BPMN processes for the "Link process ▾" dropdown on call activities. */
	getAvailableProcesses?: () => Array<{ id: string; name?: string }>;
	/** Called when the user requests a new process from the cfg toolbar. */
	createProcess?: (name: string, onCreated: (id: string) => void) => void;
	/** Called when the user clicks the navigate link above a business rule task. */
	openDecision?: (decisionId: string) => void;
	/** Returns available DMN decisions for the "Link decision ▾" dropdown on business rule tasks. */
	getAvailableDecisions?: () => Array<{ id: string; name?: string }>;
	/** Called when the user clicks the navigate link above a user task. */
	openForm?: (formId: string) => void;
	/** Returns available forms for the "Link form ▾" dropdown on user tasks. */
	getAvailableForms?: () => Array<{ id: string; name?: string }>;
	/**
	 * Optional raw mode toggle button (from `tabsPlugin.api.rawModeButton`).
	 * When provided, it is styled as a HUD button and placed in the bottom-left panel.
	 */
	rawModeButton?: HTMLButtonElement | null;
	/**
	 * Optional optimize button (from `createOptimizePlugin(...).button`).
	 * When provided, it is styled as a HUD button and placed in the action bar.
	 */
	optimizeButton?: HTMLButtonElement | null;
	/**
	 * Optional AI assistant button (from `createAiBridgePlugin(...).button`).
	 * When provided, it is styled as a HUD button and placed in the action bar.
	 */
	aiButton?: HTMLButtonElement | null;
	/**
	 * Optional play mode button (from `createProcessRunnerPlugin(...).playButton`).
	 * When provided, it is styled as a HUD button and placed in the action bar.
	 */
	playButton?: HTMLButtonElement | null;
	/**
	 * Optional ASCII view button (from `createAsciiViewPlugin(...).button`).
	 * When provided, it is styled as a HUD button and placed in the bottom-left panel.
	 */
	asciiButton?: HTMLButtonElement | null;
	/**
	 * Called when the user clicks "Start from scratch" on the new-diagram overlay.
	 * The caller should load an empty diagram into the editor.
	 */
	onStartFromScratch?: () => void;
	/**
	 * Called when the user clicks "Generate example" on the new-diagram overlay.
	 * The caller should load a sample diagram into the editor.
	 */
	onGenerateExample?: () => void;
	/**
	 * Called when the user clicks "Ask AI" in the contextual element toolbar or
	 * the new-diagram overlay.
	 */
	onAskAi?: () => void;
}

export function initEditorHud(
	editor: BpmnEditor,
	options: HudOptions = {},
): { setActive(active: boolean): void; showOnboarding(): void; hideOnboarding(): void } {
	injectHudStyles();

	// ── Create and inject HUD DOM ──────────────────────────────────────────────

	function hudBtn(id: string, title: string): HTMLButtonElement {
		const b = document.createElement("button");
		b.id = id;
		b.className = "hud-btn";
		b.title = title;
		return b;
	}

	function hudSep(): HTMLDivElement {
		const d = document.createElement("div");
		d.className = "hud-sep";
		return d;
	}

	// Action bar — top center
	const btnUndo = hudBtn("btn-undo", "Undo (Ctrl+Z)");
	const btnRedo = hudBtn("btn-redo", "Redo (Ctrl+Y)");
	const btnDelete = hudBtn("btn-delete", "Delete");
	const btnDuplicate = hudBtn("btn-duplicate", "Duplicate (Ctrl+D)");
	const btnTopMore = hudBtn("btn-top-more", "More actions");

	const hudTopCenter = document.createElement("div");
	hudTopCenter.id = "hud-top-center";
	hudTopCenter.className = "hud panel";
	hudTopCenter.append(btnUndo, btnRedo, hudSep(), btnDelete, btnDuplicate, hudSep(), btnTopMore);

	if (options.optimizeButton) {
		options.optimizeButton.className = "hud-btn";
		hudTopCenter.append(hudSep(), options.optimizeButton);
	}

	if (options.aiButton) {
		options.aiButton.className = "hud-btn";
		hudTopCenter.append(hudSep(), options.aiButton);
	}

	if (options.playButton) {
		options.playButton.className = "hud-btn";
		hudTopCenter.append(hudSep(), options.playButton);
	}

	// Mobile collapse toggle — top center (hidden on desktop via CSS)
	const btnTcToggle = hudBtn("btn-tc-toggle", "Actions");
	btnTcToggle.innerHTML = IC.undo;
	hudTopCenter.insertBefore(btnTcToggle, hudTopCenter.firstChild);

	// Zoom widget — bottom left
	const btnZoomCurrent = document.createElement("button");
	btnZoomCurrent.id = "btn-zoom-current";
	btnZoomCurrent.textContent = "100%";

	const btnZoomOut = hudBtn("btn-zoom-out", "Zoom out (−)");

	const btnZoomPct = document.createElement("button");
	btnZoomPct.id = "btn-zoom-pct";
	btnZoomPct.textContent = "100% ▾";

	const btnZoomIn = hudBtn("btn-zoom-in", "Zoom in (+)");

	const zoomExpanded = document.createElement("div");
	zoomExpanded.id = "zoom-expanded";
	zoomExpanded.append(btnZoomOut, btnZoomPct, btnZoomIn);

	const hudBottomLeft = document.createElement("div");
	hudBottomLeft.id = "hud-bottom-left";
	hudBottomLeft.className = "hud panel";
	hudBottomLeft.append(btnZoomCurrent, zoomExpanded);

	if (options.rawModeButton) {
		const btn = options.rawModeButton;
		btn.className = "hud-btn";
		const sep = hudSep();
		hudBottomLeft.append(sep, btn);
	}

	if (options.asciiButton) {
		const btn = options.asciiButton;
		btn.className = "hud-btn";
		hudBottomLeft.append(hudSep(), btn);
	}

	// Tool selector — bottom center
	const btnSelect = hudBtn("btn-select", "Select (V)");
	btnSelect.classList.add("active");
	const btnPan = hudBtn("btn-pan", "Hand (H)");
	const btnSpace = hudBtn("btn-space", "Space tool");

	const toolGroupsEl = document.createElement("div");
	toolGroupsEl.id = "tool-groups";

	const hudBottomCenter = document.createElement("div");
	hudBottomCenter.id = "hud-bottom-center";
	hudBottomCenter.className = "hud panel";
	hudBottomCenter.append(btnSelect, btnPan, btnSpace, hudSep(), toolGroupsEl);

	// Mobile collapse toggle — bottom center (hidden on desktop via CSS)
	const btnBcToggle = hudBtn("btn-bc-toggle", "Tools");
	btnBcToggle.innerHTML = IC.select;
	hudBottomCenter.insertBefore(btnBcToggle, hudBottomCenter.firstChild);

	// Contextual toolbars (positioned dynamically)
	const cfgToolbar = document.createElement("div");
	cfgToolbar.id = "cfg-toolbar";
	cfgToolbar.className = "hud panel";

	const ctxToolbar = document.createElement("div");
	ctxToolbar.id = "ctx-toolbar";
	ctxToolbar.className = "hud panel";

	// Dropdown menus
	const zoomMenuEl = document.createElement("div");
	zoomMenuEl.id = "zoom-menu";
	zoomMenuEl.className = "dropdown";

	const moreMenuEl = document.createElement("div");
	moreMenuEl.id = "more-menu";
	moreMenuEl.className = "dropdown";

	const labelPosMenuEl = document.createElement("div");
	labelPosMenuEl.id = "label-pos-menu";
	labelPosMenuEl.className = "dropdown";

	const refMenuEl = document.createElement("div");
	refMenuEl.id = "ref-menu";
	refMenuEl.className = "dropdown";

	document.body.append(
		hudTopCenter,
		hudBottomLeft,
		hudBottomCenter,
		cfgToolbar,
		ctxToolbar,
		zoomMenuEl,
		moreMenuEl,
		labelPosMenuEl,
		refMenuEl,
	);

	// ── Theme ──────────────────────────────────────────────────────────────────

	const syncHudTheme = (): void => {
		document.body.dataset.bpmnHudTheme = editor.getTheme();
	};
	syncHudTheme();
	const themeObs = new MutationObserver(syncHudTheme);
	themeObs.observe(editor.container, { attributes: true, attributeFilter: ["data-theme"] });

	// ── Closure state ──────────────────────────────────────────────────────────

	let currentScale = 1;
	let selectedIds: string[] = [];
	let ctxSourceId: string | null = null;
	let openGroupPicker: HTMLElement | null = null;
	let openDropdown: HTMLElement | null = null;
	let zoomOpen = false;

	function collapseOnMobile(panel: HTMLElement): void {
		if (window.innerWidth <= 600) panel.classList.remove("expanded");
	}

	btnBcToggle.addEventListener("click", () => {
		if (hudBottomCenter.classList.contains("expanded")) {
			hudBottomCenter.classList.remove("expanded");
		} else {
			hudBottomCenter.classList.add("expanded");
			hudTopCenter.classList.remove("expanded");
		}
	});

	btnTcToggle.addEventListener("click", () => {
		if (hudTopCenter.classList.contains("expanded")) {
			hudTopCenter.classList.remove("expanded");
		} else {
			hudTopCenter.classList.add("expanded");
			hudBottomCenter.classList.remove("expanded");
		}
	});

	const groupActiveType: Record<string, CreateShapeType> = {
		startEvents: "startEvent",
		endEvents: "endEvent",
		intermediateEvents: "messageCatchEvent",
		activities: "serviceTask",
		gateways: "exclusiveGateway",
		annotations: "textAnnotation",
	};

	const groupBtns: Record<string, HTMLButtonElement> = {};

	// ── Static button icons ────────────────────────────────────────────────────

	btnSelect.innerHTML = IC.select;
	btnPan.innerHTML = IC.hand;
	btnSpace.innerHTML = IC.space;
	btnUndo.innerHTML = IC.undo;
	btnRedo.innerHTML = IC.redo;
	btnDelete.innerHTML = IC.trash;
	btnDuplicate.innerHTML = IC.duplicate;
	btnTopMore.innerHTML = IC.dots;
	btnZoomOut.innerHTML = IC.zoomOut;
	btnZoomIn.innerHTML = IC.zoomIn;

	// ── Group picker ───────────────────────────────────────────────────────────

	function closeGroupPicker(): void {
		openGroupPicker?.remove();
		openGroupPicker = null;
	}

	function updateGroupButton(groupId: string): void {
		const btn = groupBtns[groupId];
		const group = GROUPS.find((g) => g.id === groupId);
		if (!btn || !group) return;
		const item = group.items.find((i) => i.type === groupActiveType[groupId]);
		btn.innerHTML = item ? item.icon : group.groupIcon;
	}

	function showGroupPicker(anchor: HTMLButtonElement, group: GroupDef): void {
		closeGroupPicker();
		closeAllDropdowns();

		const picker = document.createElement("div");
		picker.className = "group-picker";

		const label = document.createElement("span");
		label.className = "group-picker-label";
		label.textContent = group.title;
		picker.appendChild(label);

		for (const item of group.items) {
			const btn = document.createElement("button");
			btn.className = item.type === groupActiveType[group.id] ? "hud-btn active" : "hud-btn";
			btn.innerHTML = item.icon;
			btn.title = item.title;
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				groupActiveType[group.id] = item.type;
				updateGroupButton(group.id);
				editor.setTool(`create:${item.type}`);
				closeGroupPicker();
				collapseOnMobile(hudBottomCenter);
			});
			picker.appendChild(btn);
		}

		document.body.appendChild(picker);
		openGroupPicker = picker;

		const rect = anchor.getBoundingClientRect();
		const pickerW = group.items.length * 36 + 80;
		const left = Math.max(
			4,
			Math.min(rect.left + rect.width / 2 - pickerW / 2, window.innerWidth - pickerW - 4),
		);
		picker.style.bottom = `${window.innerHeight - rect.top + 6}px`;
		picker.style.left = `${left}px`;

		const onOutside = (e: PointerEvent) => {
			if (!picker.contains(e.target as Node) && e.target !== anchor) {
				closeGroupPicker();
				document.removeEventListener("pointerdown", onOutside);
			}
		};
		setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
	}

	// ── Type-change picker (used by cfgToolbar) ────────────────────────────────

	function showTypePicker(
		anchor: HTMLButtonElement,
		group: GroupDef,
		sourceId: string,
		sourceType: string,
	): void {
		closeGroupPicker();
		closeAllDropdowns();

		const picker = document.createElement("div");
		picker.className = "group-picker";

		const label = document.createElement("span");
		label.className = "group-picker-label";
		label.textContent = group.title;
		picker.appendChild(label);

		for (const item of group.items) {
			const btn = document.createElement("button");
			btn.className = item.type === sourceType ? "hud-btn active" : "hud-btn";
			btn.innerHTML = item.icon;
			btn.title = item.title;
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				if (item.type !== sourceType) editor.changeElementType(sourceId, item.type);
				closeGroupPicker();
			});
			picker.appendChild(btn);
		}

		document.body.appendChild(picker);
		openGroupPicker = picker;

		const rect = anchor.getBoundingClientRect();
		const pickerW = group.items.length * 36 + 80;
		const left = Math.max(
			4,
			Math.min(rect.left + rect.width / 2 - pickerW / 2, window.innerWidth - pickerW - 4),
		);
		picker.style.bottom = `${window.innerHeight - rect.top + 6}px`;
		picker.style.left = `${left}px`;

		const onOutside = (e: PointerEvent) => {
			if (!picker.contains(e.target as Node) && e.target !== anchor) {
				closeGroupPicker();
				document.removeEventListener("pointerdown", onOutside);
			}
		};
		setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
	}

	// ── Color picker (used by ctxToolbar) ──────────────────────────────────────

	function showColorPicker(
		anchor: HTMLButtonElement,
		sourceId: string,
		currentFill: string | undefined,
	): void {
		closeGroupPicker();
		closeAllDropdowns();

		const picker = document.createElement("div");
		picker.className = "group-picker";

		// "Default" (no-color) swatch
		const clearSwatch = document.createElement("button");
		const isDefault = !currentFill;
		clearSwatch.className = isDefault
			? "bpmn-color-swatch bpmn-color-swatch--default active"
			: "bpmn-color-swatch bpmn-color-swatch--default";
		clearSwatch.title = "Default color";
		clearSwatch.addEventListener("click", (e) => {
			e.stopPropagation();
			editor.updateColor(sourceId, {});
			closeGroupPicker();
		});
		picker.appendChild(clearSwatch);

		for (const { fill, stroke } of COLOR_PALETTE) {
			const isActive = currentFill === fill;
			const swatch = document.createElement("button");
			swatch.className = isActive ? "bpmn-color-swatch active" : "bpmn-color-swatch";
			swatch.style.background = fill;
			swatch.style.outlineColor = stroke;
			swatch.title = "Apply color";
			swatch.addEventListener("click", (e) => {
				e.stopPropagation();
				editor.updateColor(sourceId, { fill, stroke });
				closeGroupPicker();
			});
			picker.appendChild(swatch);
		}

		document.body.appendChild(picker);
		openGroupPicker = picker;

		const rect = anchor.getBoundingClientRect();
		const pickerW = (COLOR_PALETTE.length + 1) * 30 + 20;
		const left = Math.max(
			4,
			Math.min(rect.left + rect.width / 2 - pickerW / 2, window.innerWidth - pickerW - 4),
		);
		picker.style.top = `${rect.bottom + 6}px`;
		picker.style.bottom = "auto";
		picker.style.left = `${left}px`;

		const onOutside = (e: PointerEvent) => {
			if (!picker.contains(e.target as Node) && e.target !== anchor) {
				closeGroupPicker();
				document.removeEventListener("pointerdown", onOutside);
			}
		};
		setTimeout(() => document.addEventListener("pointerdown", onOutside), 0);
	}

	// ── Build group buttons ────────────────────────────────────────────────────

	for (const group of GROUPS) {
		const btn = document.createElement("button");
		btn.className = "hud-btn";
		btn.dataset.group = group.id;
		btn.innerHTML = group.groupIcon;
		btn.title = `${group.title} (hold for options)`;

		let longPressTimer: ReturnType<typeof setTimeout> | null = null;
		let isLongPress = false;

		btn.addEventListener("pointerdown", (e) => {
			if (e.button !== 0) return;
			isLongPress = false;
			longPressTimer = setTimeout(() => {
				isLongPress = true;
				showGroupPicker(btn, group);
			}, 500);
		});

		btn.addEventListener("pointerup", () => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
			if (!isLongPress) {
				const activeType = groupActiveType[group.id];
				if (activeType) {
					editor.setTool(`create:${activeType}`);
					collapseOnMobile(hudBottomCenter);
				}
			}
		});

		btn.addEventListener("pointercancel", () => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		});

		btn.addEventListener("contextmenu", (e) => e.preventDefault());

		toolGroupsEl.appendChild(btn);
		groupBtns[group.id] = btn;

		updateGroupButton(group.id);
	}

	// ── Tool active state ──────────────────────────────────────────────────────

	function updateToolActiveState(tool: Tool): void {
		btnSelect.classList.toggle("active", tool === "select");
		btnPan.classList.toggle("active", tool === "pan");
		btnSpace.classList.toggle("active", tool === "space");

		for (const group of GROUPS) {
			const btn = groupBtns[group.id];
			if (!btn) continue;
			const isGroupActive = group.items.some((item) => tool === `create:${item.type}`);
			btn.classList.toggle("active", isGroupActive);

			if (isGroupActive) {
				const activeItem = group.items.find((item) => tool === `create:${item.type}`);
				if (activeItem) {
					groupActiveType[group.id] = activeItem.type;
					updateGroupButton(group.id);
				}
			}
		}

		// Update bottom-center toggle icon to reflect the active tool
		if (tool === "select") btnBcToggle.innerHTML = IC.select;
		else if (tool === "pan") btnBcToggle.innerHTML = IC.hand;
		else if (tool === "space") btnBcToggle.innerHTML = IC.space;
		else {
			for (const group of GROUPS) {
				if (group.items.some((item) => tool === `create:${item.type}`)) {
					const btn = groupBtns[group.id];
					if (btn) btnBcToggle.innerHTML = btn.innerHTML;
					break;
				}
			}
		}
	}

	btnSelect.addEventListener("click", () => {
		editor.setTool("select");
		collapseOnMobile(hudBottomCenter);
	});
	btnPan.addEventListener("click", () => {
		editor.setTool("pan");
		collapseOnMobile(hudBottomCenter);
	});
	btnSpace.addEventListener("click", () => {
		editor.setTool("space");
		collapseOnMobile(hudBottomCenter);
	});

	// ── Dropdown management ────────────────────────────────────────────────────

	function showDropdown(
		menu: HTMLElement,
		anchor: HTMLElement,
		align: "right" | "above" = "right",
	): void {
		closeAllDropdowns();
		const rect = anchor.getBoundingClientRect();
		if (align === "right") {
			menu.style.top = `${rect.bottom + 6}px`;
			menu.style.right = `${window.innerWidth - rect.right}px`;
			menu.style.left = "auto";
			menu.style.bottom = "auto";
		} else {
			menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
			menu.style.left = `${rect.left}px`;
			menu.style.top = "auto";
			menu.style.right = "auto";
		}
		menu.classList.add("open");
		openDropdown = menu;
	}

	function closeAllDropdowns(): void {
		openDropdown?.classList.remove("open");
		openDropdown = null;
		closeGroupPicker();
	}

	document.addEventListener("pointerdown", (e) => {
		if (openDropdown && !openDropdown.contains(e.target as Node)) {
			closeAllDropdowns();
		}
		if (window.innerWidth <= 600) {
			if (
				hudBottomCenter.classList.contains("expanded") &&
				!hudBottomCenter.contains(e.target as Node)
			) {
				hudBottomCenter.classList.remove("expanded");
			}
			if (hudTopCenter.classList.contains("expanded") && !hudTopCenter.contains(e.target as Node)) {
				hudTopCenter.classList.remove("expanded");
			}
		}
	});

	// ── Zoom widget ────────────────────────────────────────────────────────────

	function updateZoomDisplay(): void {
		const pct = `${Math.round(currentScale * 100)}%`;
		btnZoomCurrent.textContent = pct;
		btnZoomPct.textContent = `${pct} ▾`;
	}

	function toggleZoomWidget(): void {
		zoomOpen = !zoomOpen;
		if (zoomOpen) {
			btnZoomCurrent.style.display = "none";
			zoomExpanded.classList.add("open");
		} else {
			zoomExpanded.classList.remove("open");
			btnZoomCurrent.style.display = "";
		}
	}

	function buildZoomMenu(): void {
		zoomMenuEl.innerHTML = "";
		const items: Array<[string, () => void]> = [
			[
				"Zoom to 100%",
				() => {
					editor.setZoom(1);
					closeAllDropdowns();
				},
			],
			[
				"Zoom to fit",
				() => {
					editor.fitView();
					closeAllDropdowns();
				},
			],
		];
		for (const [label, action] of items) {
			const btn = document.createElement("button");
			btn.className = "drop-item";
			btn.textContent = label;
			btn.addEventListener("click", action);
			zoomMenuEl.appendChild(btn);
		}
	}

	btnZoomCurrent.addEventListener("click", toggleZoomWidget);
	btnZoomOut.addEventListener("click", () => editor.zoomOut());
	btnZoomIn.addEventListener("click", () => editor.zoomIn());

	btnZoomPct.addEventListener("pointerdown", (e) => {
		e.stopPropagation();
	});
	btnZoomPct.addEventListener("click", () => {
		if (openDropdown === zoomMenuEl) {
			closeAllDropdowns();
		} else {
			buildZoomMenu();
			showDropdown(zoomMenuEl, btnZoomPct, "above");
		}
	});

	// ── More actions menu ──────────────────────────────────────────────────────

	function buildMoreMenu(): void {
		moreMenuEl.innerHTML = "";
		const items: Array<[string, string, () => void]> = [
			[
				"Select all",
				IC.select,
				() => {
					editor.selectAll();
					closeAllDropdowns();
				},
			],
		];
		for (const [label, icon, action] of items) {
			const btn = document.createElement("button");
			btn.className = "drop-item";
			btn.innerHTML = `<span class="di-check"></span><span class="di-icon">${icon}</span><span>${label}</span>`;
			btn.addEventListener("click", action);
			moreMenuEl.appendChild(btn);
		}
	}

	btnTopMore.addEventListener("pointerdown", (e) => {
		e.stopPropagation();
	});
	btnTopMore.addEventListener("click", () => {
		if (openDropdown === moreMenuEl) {
			closeAllDropdowns();
		} else {
			buildMoreMenu();
			showDropdown(moreMenuEl, btnTopMore, "right");
		}
	});

	// ── Action bar ─────────────────────────────────────────────────────────────

	function updateActionBar(): void {
		btnUndo.disabled = !editor.canUndo();
		btnRedo.disabled = !editor.canRedo();
		btnDelete.disabled = selectedIds.length === 0;
		btnDuplicate.disabled = selectedIds.length === 0;
	}

	updateActionBar();

	btnUndo.addEventListener("click", () => {
		editor.undo();
		collapseOnMobile(hudTopCenter);
	});
	btnRedo.addEventListener("click", () => {
		editor.redo();
		collapseOnMobile(hudTopCenter);
	});
	btnDelete.addEventListener("click", () => {
		editor.deleteSelected();
		collapseOnMobile(hudTopCenter);
	});
	btnDuplicate.addEventListener("click", () => {
		editor.duplicate();
		collapseOnMobile(hudTopCenter);
	});

	// ── Label position menu ────────────────────────────────────────────────────

	function buildLabelPosMenu(sourceId: string, sourceType: string): void {
		labelPosMenuEl.innerHTML = "";
		for (const pos of getValidLabelPositions(sourceType as CreateShapeType)) {
			const btn = document.createElement("button");
			btn.className = "drop-item";
			btn.textContent = POSITION_LABELS[pos];
			btn.addEventListener("click", () => {
				editor.setLabelPosition(sourceId, pos);
				closeAllDropdowns();
			});
			labelPosMenuEl.appendChild(btn);
		}
	}

	// ── Contextual quick-add toolbar ───────────────────────────────────────────

	function buildCtxToolbar(sourceId: string, sourceType: string): void {
		ctxToolbar.innerHTML = "";
		const isAnnotation = sourceType === "textAnnotation";
		const canAddElements = !isAnnotation && sourceType !== "endEvent";

		if (canAddElements) {
			const arrowBtn = document.createElement("button");
			arrowBtn.className = "hud-btn";
			arrowBtn.innerHTML = IC.arrow;
			arrowBtn.title = "Connect to element (click target)";
			arrowBtn.addEventListener("click", () => {
				editor.startConnectionFrom(sourceId);
				hideCtxToolbar();
			});
			ctxToolbar.appendChild(arrowBtn);

			const sep = document.createElement("div");
			sep.className = "hud-sep";
			ctxToolbar.appendChild(sep);

			for (const opt of CTX_OPTIONS) {
				if (
					(sourceType === "exclusiveGateway" ||
						sourceType === "parallelGateway" ||
						sourceType === "inclusiveGateway" ||
						sourceType === "eventBasedGateway") &&
					opt.type === "exclusiveGateway"
				)
					continue;

				const btn = document.createElement("button");
				btn.className = "hud-btn";
				btn.innerHTML = opt.icon;
				btn.title = opt.title;
				btn.addEventListener("click", () => {
					editor.addConnectedElement(sourceId, opt.type);
					closeAllDropdowns();
				});
				ctxToolbar.appendChild(btn);
			}
		}

		// Color swatches and annotation button for non-annotation flow elements
		if (!isAnnotation) {
			if (ctxToolbar.children.length > 0) {
				const sep = document.createElement("div");
				sep.className = "hud-sep";
				ctxToolbar.appendChild(sep);
			}

			// Get current shape color
			const defs = editor.getDefinitions();
			const diShape = defs?.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === sourceId);
			const currentColor = diShape ? readDiColor(diShape.unknownAttributes) : {};
			const currentFill = currentColor.fill;

			const singleSwatch = document.createElement("button");
			singleSwatch.className = currentFill
				? "bpmn-color-swatch active"
				: "bpmn-color-swatch bpmn-color-swatch--default";
			if (currentFill) {
				singleSwatch.style.background = currentFill;
				const palette = COLOR_PALETTE.find((p) => p.fill === currentFill);
				if (palette) singleSwatch.style.outlineColor = palette.stroke;
			}
			singleSwatch.title = "Color (click for options)";
			singleSwatch.addEventListener("click", () =>
				showColorPicker(singleSwatch, sourceId, currentFill),
			);
			ctxToolbar.appendChild(singleSwatch);

			// Add annotation button
			const annotBtn = document.createElement("button");
			annotBtn.className = "hud-btn";
			annotBtn.innerHTML = IC.textAnnotation;
			annotBtn.title = "Add text annotation";
			annotBtn.addEventListener("click", () => {
				editor.createAnnotationFor(sourceId);
				hideCtxToolbar();
			});
			ctxToolbar.appendChild(annotBtn);

			if (options.onAskAi) {
				const aiSep = document.createElement("div");
				aiSep.className = "hud-sep";
				ctxToolbar.appendChild(aiSep);

				const aiBtn = document.createElement("button");
				aiBtn.className = "hud-btn ctx-ask-ai-btn";
				aiBtn.innerHTML = IC.sparkle;
				aiBtn.title = "Ask AI to continue from this element";
				aiBtn.addEventListener("click", () => options.onAskAi?.());
				ctxToolbar.appendChild(aiBtn);
			}
		}
	}

	// ── Configure toolbar ──────────────────────────────────────────────────────

	function buildCfgToolbar(sourceId: string, sourceType: string): void {
		cfgToolbar.innerHTML = "";

		const eGroup = getElementGroup(sourceType as CreateShapeType);
		const group = eGroup ? GROUPS.find((g) => g.id === eGroup.id) : undefined;

		if (group && group.items.length > 1) {
			const currentItem = group.items.find((i) => i.type === sourceType);
			const typeBtn = document.createElement("button");
			typeBtn.className = "hud-btn active";
			typeBtn.innerHTML = currentItem?.icon ?? group.groupIcon;
			typeBtn.title = `${currentItem?.title ?? group.title} (click to change)`;
			typeBtn.addEventListener("click", () => showTypePicker(typeBtn, group, sourceId, sourceType));
			cfgToolbar.appendChild(typeBtn);
		}

		if (EXTERNAL_LABEL_TYPES.has(sourceType as CreateShapeType)) {
			if (cfgToolbar.children.length > 0) {
				const sep = document.createElement("div");
				sep.className = "hud-sep";
				cfgToolbar.appendChild(sep);
			}
			const labelBtn = document.createElement("button");
			labelBtn.className = "hud-btn";
			labelBtn.innerHTML = IC.labelPos;
			labelBtn.title = "Label position";
			labelBtn.addEventListener("pointerdown", (e) => {
				e.stopPropagation();
			});
			labelBtn.addEventListener("click", () => {
				if (openDropdown === labelPosMenuEl) {
					closeAllDropdowns();
				} else {
					buildLabelPosMenu(sourceId, sourceType);
					showDropdown(labelPosMenuEl, labelBtn, "above");
				}
			});
			cfgToolbar.appendChild(labelBtn);
		}

		if (sourceType === "callActivity") {
			const processId = getCallActivityProcessId(sourceId);
			if (processId) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const allProcs = options.getAvailableProcesses?.() ?? [];
				const name = allProcs.find((p) => p.id === processId)?.name ?? processId;
				const navBtn = document.createElement("button");
				navBtn.className = "ref-link-btn";
				navBtn.textContent = `${name} \u2197`;
				navBtn.title = `Open process: ${processId}`;
				navBtn.addEventListener("click", () => options.openProcess?.(processId));
				cfgToolbar.appendChild(navBtn);
				const unlinkBtn = document.createElement("button");
				unlinkBtn.className = "hud-btn";
				unlinkBtn.title = "Unlink process";
				unlinkBtn.textContent = "\u00d7";
				unlinkBtn.addEventListener("click", () => clearCallActivityProcess(sourceId));
				cfgToolbar.appendChild(unlinkBtn);
			} else if (options.getAvailableProcesses) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const linkBtn = document.createElement("button");
				linkBtn.className = "ref-link-btn";
				linkBtn.textContent = "Link process \u25be";
				linkBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
				linkBtn.addEventListener("click", () => {
					if (openDropdown === refMenuEl) {
						closeAllDropdowns();
						return;
					}
					refMenuEl.innerHTML = "";
					const currentIds = new Set((editor.getDefinitions()?.processes ?? []).map((p) => p.id));
					const procs = (options.getAvailableProcesses?.() ?? []).filter(
						(p) => !currentIds.has(p.id),
					);
					for (const proc of procs) {
						const btn = document.createElement("button");
						btn.className = "drop-item";
						btn.textContent = proc.name ?? proc.id;
						btn.title = proc.id;
						btn.addEventListener("click", () => {
							setCallActivityProcess(sourceId, proc.id);
							closeAllDropdowns();
						});
						refMenuEl.appendChild(btn);
					}
					if (options.createProcess) {
						if (procs.length > 0) {
							const sep = document.createElement("div");
							sep.className = "drop-sep";
							refMenuEl.appendChild(sep);
						}
						const newBtn = document.createElement("button");
						newBtn.className = "drop-item";
						newBtn.textContent = "New process\u2026";
						newBtn.addEventListener("click", () => {
							closeAllDropdowns();
							showHudInputModal("New process name", "New Process", (newName) => {
								options.createProcess?.(newName, (pid) => setCallActivityProcess(sourceId, pid));
							});
						});
						refMenuEl.appendChild(newBtn);
					}
					if (procs.length === 0 && !options.createProcess) {
						const empty = document.createElement("div");
						empty.className = "drop-label";
						empty.textContent = "No processes open";
						refMenuEl.appendChild(empty);
					}
					showDropdown(refMenuEl, linkBtn, "above");
				});
				cfgToolbar.appendChild(linkBtn);
			}
		}

		if (sourceType === "userTask") {
			const formId = getUserTaskFormId(sourceId);
			if (formId) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const forms = options.getAvailableForms?.() ?? [];
				const name = forms.find((f) => f.id === formId)?.name ?? formId;
				const navBtn = document.createElement("button");
				navBtn.className = "ref-link-btn";
				navBtn.textContent = `${name} \u2197`;
				navBtn.title = `Open form: ${formId}`;
				navBtn.addEventListener("click", () => options.openForm?.(formId));
				cfgToolbar.appendChild(navBtn);
				const unlinkBtn = document.createElement("button");
				unlinkBtn.className = "hud-btn";
				unlinkBtn.title = "Unlink form";
				unlinkBtn.textContent = "\u00d7";
				unlinkBtn.addEventListener("click", () => clearUserTaskForm(sourceId));
				cfgToolbar.appendChild(unlinkBtn);
			} else if (options.getAvailableForms) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const linkBtn = document.createElement("button");
				linkBtn.className = "ref-link-btn";
				linkBtn.textContent = "Link form \u25be";
				linkBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
				linkBtn.addEventListener("click", () => {
					if (openDropdown === refMenuEl) {
						closeAllDropdowns();
						return;
					}
					refMenuEl.innerHTML = "";
					const forms = options.getAvailableForms?.() ?? [];
					for (const form of forms) {
						const btn = document.createElement("button");
						btn.className = "drop-item";
						btn.textContent = form.name ?? form.id;
						btn.title = form.id;
						btn.addEventListener("click", () => {
							setUserTaskForm(sourceId, form.id);
							closeAllDropdowns();
						});
						refMenuEl.appendChild(btn);
					}
					if (forms.length === 0) {
						const empty = document.createElement("div");
						empty.className = "drop-label";
						empty.textContent = "No forms open";
						refMenuEl.appendChild(empty);
					}
					showDropdown(refMenuEl, linkBtn, "above");
				});
				cfgToolbar.appendChild(linkBtn);
			}
		}

		if (sourceType === "businessRuleTask") {
			const decisionId = getBizRuleDecisionId(sourceId);
			if (decisionId) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const decisions = options.getAvailableDecisions?.() ?? [];
				const name = decisions.find((d) => d.id === decisionId)?.name ?? decisionId;
				const navBtn = document.createElement("button");
				navBtn.className = "ref-link-btn";
				navBtn.textContent = `${name} \u2197`;
				navBtn.title = `Open decision: ${decisionId}`;
				navBtn.addEventListener("click", () => options.openDecision?.(decisionId));
				cfgToolbar.appendChild(navBtn);
				const unlinkBtn = document.createElement("button");
				unlinkBtn.className = "hud-btn";
				unlinkBtn.title = "Unlink decision";
				unlinkBtn.textContent = "\u00d7";
				unlinkBtn.addEventListener("click", () => clearBizRuleDecision(sourceId));
				cfgToolbar.appendChild(unlinkBtn);
			} else if (options.getAvailableDecisions) {
				if (cfgToolbar.children.length > 0) cfgToolbar.append(hudSep());
				const linkBtn = document.createElement("button");
				linkBtn.className = "ref-link-btn";
				linkBtn.textContent = "Link decision \u25be";
				linkBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
				linkBtn.addEventListener("click", () => {
					if (openDropdown === refMenuEl) {
						closeAllDropdowns();
						return;
					}
					refMenuEl.innerHTML = "";
					const decisions = options.getAvailableDecisions?.() ?? [];
					for (const dec of decisions) {
						const btn = document.createElement("button");
						btn.className = "drop-item";
						btn.textContent = dec.name ?? dec.id;
						btn.title = dec.id;
						btn.addEventListener("click", () => {
							setBizRuleDecision(sourceId, dec.id);
							closeAllDropdowns();
						});
						refMenuEl.appendChild(btn);
					}
					if (decisions.length === 0) {
						const empty = document.createElement("div");
						empty.className = "drop-label";
						empty.textContent = "No decisions open";
						refMenuEl.appendChild(empty);
					}
					showDropdown(refMenuEl, linkBtn, "above");
				});
				cfgToolbar.appendChild(linkBtn);
			}
		}
	}

	function getCallActivityProcessId(id: string): string | null {
		const defs = editor.getDefinitions();
		if (!defs) return null;
		for (const process of defs.processes) {
			const el = process.flowElements.find((e) => e.id === id);
			if (!el) continue;
			for (const ext of el.extensionElements) {
				const ln = ext.name.includes(":") ? ext.name.slice(ext.name.indexOf(":") + 1) : ext.name;
				if (ln === "calledElement") return ext.attributes.processId ?? null;
			}
		}
		return null;
	}

	function getUserTaskFormId(id: string): string | null {
		const defs = editor.getDefinitions();
		if (!defs) return null;
		for (const process of defs.processes) {
			const el = process.flowElements.find((e) => e.id === id);
			if (!el) continue;
			for (const ext of el.extensionElements) {
				const ln = ext.name.includes(":") ? ext.name.slice(ext.name.indexOf(":") + 1) : ext.name;
				if (ln === "formDefinition") return ext.attributes.formId ?? null;
			}
		}
		return null;
	}

	function getBizRuleDecisionId(id: string): string | null {
		const defs = editor.getDefinitions();
		if (!defs) return null;
		for (const process of defs.processes) {
			const el = process.flowElements.find((e) => e.id === id);
			if (!el) continue;
			for (const ext of el.extensionElements) {
				const ln = ext.name.includes(":") ? ext.name.slice(ext.name.indexOf(":") + 1) : ext.name;
				if (ln === "calledDecision") return ext.attributes.decisionId ?? null;
			}
		}
		return null;
	}

	function setCallActivityProcess(elementId: string, processId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					const otherExts = el.extensionElements.filter((x) => {
						const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
						return ln !== "calledElement";
					});
					return {
						...el,
						extensionElements: [
							...otherExts,
							{
								name: "zeebe:calledElement",
								attributes: { processId, propagateAllChildVariables: "false" },
								children: [],
							},
						],
					};
				}),
			})),
		}));
	}

	function setUserTaskForm(elementId: string, formId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					const otherExts = el.extensionElements.filter((x) => {
						const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
						return ln !== "formDefinition" && ln !== "userTask";
					});
					return {
						...el,
						extensionElements: [
							...otherExts,
							{
								name: "zeebe:formDefinition",
								attributes: { formId },
								children: [],
							},
						],
					};
				}),
			})),
		}));
	}

	function setBizRuleDecision(elementId: string, decisionId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					const otherExts = el.extensionElements.filter((x) => {
						const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
						return ln !== "calledDecision";
					});
					return {
						...el,
						extensionElements: [
							...otherExts,
							{
								name: "zeebe:calledDecision",
								attributes: { decisionId, resultVariable: "result" },
								children: [],
							},
						],
					};
				}),
			})),
		}));
	}

	function clearCallActivityProcess(elementId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					return {
						...el,
						extensionElements: el.extensionElements.filter((x) => {
							const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
							return ln !== "calledElement";
						}),
					};
				}),
			})),
		}));
	}

	function clearUserTaskForm(elementId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					return {
						...el,
						extensionElements: el.extensionElements.filter((x) => {
							const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
							return ln !== "formDefinition" && ln !== "userTask";
						}),
					};
				}),
			})),
		}));
	}

	function clearBizRuleDecision(elementId: string): void {
		editor.applyChange((defs) => ({
			...defs,
			processes: defs.processes.map((proc) => ({
				...proc,
				flowElements: proc.flowElements.map((el) => {
					if (el.id !== elementId) return el;
					return {
						...el,
						extensionElements: el.extensionElements.filter((x) => {
							const ln = x.name.includes(":") ? x.name.slice(x.name.indexOf(":") + 1) : x.name;
							return ln !== "calledDecision";
						}),
					};
				}),
			})),
		}));
	}

	function positionCfgToolbar(): void {
		if (!ctxSourceId) {
			cfgToolbar.style.display = "none";
			return;
		}
		const bounds = editor.getShapeBounds(ctxSourceId);
		if (!bounds) {
			cfgToolbar.style.display = "none";
			return;
		}
		const cx = bounds.x + bounds.width / 2;
		cfgToolbar.style.left = `${cx}px`;
		cfgToolbar.style.top = `${bounds.y - 10}px`;
		cfgToolbar.style.display = cfgToolbar.children.length > 0 ? "flex" : "none";
	}

	function positionCtxToolbar(): void {
		if (!ctxSourceId) {
			ctxToolbar.style.display = "none";
			return;
		}
		const bounds = editor.getShapeBounds(ctxSourceId);
		if (!bounds) {
			ctxToolbar.style.display = "none";
			return;
		}
		const cx = bounds.x + bounds.width / 2;
		const top = bounds.y + bounds.height + 10;
		ctxToolbar.style.left = `${cx}px`;
		ctxToolbar.style.top = `${top}px`;
		ctxToolbar.style.display = ctxToolbar.children.length > 0 ? "flex" : "none";
	}

	function showCtxToolbar(id: string, elemType: string): void {
		ctxSourceId = id;
		buildCtxToolbar(id, elemType);
		buildCfgToolbar(id, elemType);
		positionCtxToolbar();
		positionCfgToolbar();
	}

	function hideCtxToolbar(): void {
		ctxSourceId = null;
		ctxToolbar.style.display = "none";
		cfgToolbar.style.display = "none";
	}

	// ── New-diagram onboarding overlay ─────────────────────────────────────────

	function makeOnboardBtn(
		iconHtml: string,
		title: string,
		desc: string,
		extraClass?: string,
		onClick?: () => void,
	): HTMLButtonElement {
		const btn = document.createElement("button");
		btn.className = `bpmn-onboard-btn${extraClass ? ` ${extraClass}` : ""}`;

		const iconEl = document.createElement("div");
		iconEl.className = "bpmn-onboard-btn-icon";
		iconEl.innerHTML = iconHtml;

		const labelEl = document.createElement("div");
		labelEl.className = "bpmn-onboard-btn-label";

		const titleEl = document.createElement("p");
		titleEl.className = "bpmn-onboard-btn-title";
		titleEl.textContent = title;

		const descEl = document.createElement("p");
		descEl.className = "bpmn-onboard-btn-desc";
		descEl.textContent = desc;

		labelEl.append(titleEl, descEl);
		btn.append(iconEl, labelEl);
		if (onClick) btn.addEventListener("click", onClick);
		return btn;
	}

	const onboardEl = document.createElement("div");
	onboardEl.id = "bpmn-empty-state";
	onboardEl.style.display = "none";

	const onboardInner = document.createElement("div");
	onboardInner.className = "bpmn-onboard-inner";

	const onboardHeader = document.createElement("div");
	onboardHeader.className = "bpmn-onboard-header";
	onboardHeader.innerHTML = `<p class="bpmn-onboard-title">How do you want to start?</p><p class="bpmn-onboard-sub">Choose an option to begin designing your process</p>`;

	const onboardActions = document.createElement("div");
	onboardActions.className = "bpmn-onboard-actions";

	const scratchBtn = makeOnboardBtn(
		IC.startEvent,
		"Start from scratch",
		"Open an empty canvas with just a start event",
		undefined,
		() => {
			hideOnboarding();
			options.onStartFromScratch?.();
		},
	);

	const DIAGRAM_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="2.5" cy="8" r="1.5"/><rect x="5.5" y="5.5" width="5" height="5" rx="1"/><circle cx="13.5" cy="8" r="1.5"/><line x1="4" y1="8" x2="5.5" y2="8"/><line x1="10.5" y1="8" x2="12" y2="8"/></svg>`;

	const exampleBtn = makeOnboardBtn(
		DIAGRAM_ICON,
		"Generate example diagram",
		"Load a simple start → task → end flow to explore",
		undefined,
		() => {
			hideOnboarding();
			options.onGenerateExample?.();
		},
	);

	const aiBtn = makeOnboardBtn(
		IC.sparkle,
		"Ask AI",
		"Describe your process and let AI build the diagram",
		"bpmn-onboard-btn--ai",
		() => {
			hideOnboarding();
			options.onStartFromScratch?.();
			options.onAskAi?.();
		},
	);

	onboardActions.append(scratchBtn, exampleBtn, aiBtn);

	const onboardLinks = document.createElement("div");
	onboardLinks.className = "bpmn-onboard-links";
	onboardLinks.innerHTML = `<a href="https://bpmn.io" target="_blank" rel="noopener noreferrer">bpmn.io</a><a href="https://camunda.com/bpmn/reference/" target="_blank" rel="noopener noreferrer">BPMN Reference</a><a href="https://www.omg.org/bpmn/" target="_blank" rel="noopener noreferrer">OMG Spec</a><a href="https://docs.camunda.io/docs/components/modeler/bpmn/bpmn-coverage/" target="_blank" rel="noopener noreferrer">BPMN Elements</a>`;

	onboardInner.append(onboardHeader, onboardActions, onboardLinks);
	onboardEl.appendChild(onboardInner);
	document.body.appendChild(onboardEl);

	let _diagramActive = false;
	let _onboardingShown = false;

	function showOnboarding(): void {
		_onboardingShown = true;
		onboardEl.style.display = "flex";
		hudBottomCenter.style.display = "none";
		for (const btn of Array.from(hudTopCenter.querySelectorAll<HTMLButtonElement>("button"))) {
			btn.disabled = true;
		}
	}

	function hideOnboarding(): void {
		_onboardingShown = false;
		onboardEl.style.display = "none";
		hudBottomCenter.style.display = "";
		for (const btn of Array.from(hudTopCenter.querySelectorAll<HTMLButtonElement>("button"))) {
			btn.disabled = false;
		}
	}

	function autoHideOnboarding(): void {
		if (!_onboardingShown) return;
		const defs = editor.getDefinitions();
		if (!defs) return;
		const proc = defs.processes[0];
		if (!proc) return;
		const isEmpty = proc.flowElements.length <= 1 && proc.sequenceFlows.length === 0;
		if (!isEmpty) hideOnboarding();
	}

	function setActive(active: boolean): void {
		_diagramActive = active;
		if (!active) hideOnboarding();
	}

	// ── Editor event subscriptions ─────────────────────────────────────────────

	editor.on("editor:select", (ids: string[]) => {
		selectedIds = ids;
		updateActionBar();

		if (ids.length === 1) {
			const id = ids[0];
			if (!id) {
				hideCtxToolbar();
				return;
			}
			const elemType = editor.getElementType(id);
			if (elemType) {
				showCtxToolbar(id, elemType);
			} else {
				hideCtxToolbar();
			}
		} else {
			hideCtxToolbar();
		}
	});

	editor.on("viewport:change", (state: ViewportState) => {
		currentScale = state.scale;
		updateZoomDisplay();
		positionCtxToolbar();
		positionCfgToolbar();
	});

	editor.on("diagram:change", () => {
		updateActionBar();
		autoHideOnboarding();
		if (ctxSourceId) {
			const elemType = editor.getElementType(ctxSourceId);
			if (elemType) {
				buildCtxToolbar(ctxSourceId, elemType);
				buildCfgToolbar(ctxSourceId, elemType);
				positionCtxToolbar();
				positionCfgToolbar();
			} else {
				hideCtxToolbar();
			}
		}
	});

	editor.on("editor:tool", (tool: Tool) => {
		updateToolActiveState(tool);
	});

	// ── Keyboard shortcut: Ctrl+D to duplicate ─────────────────────────────────

	document.addEventListener("keydown", (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === "d") {
			e.preventDefault();
			editor.duplicate();
		}
	});

	// ── Close zoom widget on outside click ─────────────────────────────────────

	document.addEventListener("pointerdown", (e) => {
		if (zoomOpen && !hudBottomLeft.contains(e.target as Node)) {
			toggleZoomWidget();
		}
	});

	return { setActive, showOnboarding, hideOnboarding };
}
