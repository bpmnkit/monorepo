/**
 * @bpmn-sdk/canvas-plugin-command-palette — Ctrl+K / ⌘K command palette for
 * `@bpmn-sdk/canvas` and `@bpmn-sdk/editor`.
 *
 * ## Usage
 * ```typescript
 * import { createCommandPalettePlugin } from "@bpmn-sdk/canvas-plugin-command-palette";
 *
 * const palette = createCommandPalettePlugin({
 *   onZenModeChange: (active) => {
 *     document.querySelectorAll(".hud").forEach(
 *       (el) => { (el as HTMLElement).style.display = active ? "none" : ""; }
 *     );
 *   },
 * });
 *
 * const editor = new BpmnEditor({ container, xml, plugins: [palette] });
 * ```
 *
 * @packageDocumentation
 */

import { computeDiagramBounds } from "@bpmn-sdk/canvas";
import type { CanvasApi, CanvasPlugin, Theme } from "@bpmn-sdk/canvas";
import { Bpmn } from "@bpmn-sdk/core";
import type { BpmnDefinitions } from "@bpmn-sdk/core";
import { injectCommandPaletteStyles } from "./css.js";

export {
	COMMAND_PALETTE_CSS,
	COMMAND_PALETTE_STYLE_ID,
	injectCommandPaletteStyles,
} from "./css.js";

// ── Public types ──────────────────────────────────────────────────────────────

export interface Command {
	id: string;
	title: string;
	/** Short hint shown on the right side of the item. */
	description?: string;
	action: () => void;
}

export interface CommandPaletteOptions {
	/**
	 * Called when zen mode is toggled.
	 * Use this to hide/show external toolbars that live outside the canvas
	 * container (e.g. HUD elements in the landing page).
	 */
	onZenModeChange?: (active: boolean) => void;
	/** Filename for exported BPMN XML downloads. Defaults to `"diagram.bpmn"`. */
	exportFilename?: string;
}

/**
 * The command palette plugin extends `CanvasPlugin` with an `addCommands`
 * method so other plugins (e.g. the editor extension) can register commands.
 */
export interface CommandPalettePlugin extends CanvasPlugin {
	/**
	 * Registers additional commands in the palette.
	 * Returns a function that, when called, deregisters those commands.
	 */
	addCommands(cmds: Command[]): () => void;
}

// ── Module-level singleton — only one palette open at a time ──────────────────

let _closeCurrent: (() => void) | null = null;

// ── Icons ─────────────────────────────────────────────────────────────────────

const SEARCH_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>';

// ── Theme helper ──────────────────────────────────────────────────────────────

function resolveTheme(theme: Theme): "dark" | "light" {
	if (theme === "dark") return "dark";
	if (theme === "light") return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createCommandPalettePlugin(
	options: CommandPaletteOptions = {},
): CommandPalettePlugin {
	let _api: CanvasApi | null = null;
	let _overlayEl: HTMLDivElement | null = null;
	let _inputEl: HTMLInputElement | null = null;
	let _listEl: HTMLDivElement | null = null;
	let _isOpen = false;
	let _isZenMode = false;
	let _focusedIndex = 0;
	let _lastDefs: BpmnDefinitions | null = null;
	const _extraCommands: Command[] = [];
	const _unsubs: Array<() => void> = [];

	// ── Built-in commands (lazy — need _api set) ─────────────────────────────

	function builtinCommands(): Command[] {
		if (!_api) return [];
		const api = _api;
		return [
			{
				id: "toggle-theme",
				title: "Toggle Theme",
				description: "Cycle: dark → light → auto",
				action() {
					const cur = api.getTheme();
					const next: Theme = cur === "dark" ? "light" : cur === "light" ? "auto" : "dark";
					api.setTheme(next);
					closePalette();
				},
			},
			{
				id: "zoom-100",
				title: "Zoom to 100%",
				action() {
					const vp = api.getViewport();
					const rect = api.svg.getBoundingClientRect();
					const cx = (rect.width / 2 - vp.tx) / vp.scale;
					const cy = (rect.height / 2 - vp.ty) / vp.scale;
					api.setViewport({ tx: rect.width / 2 - cx, ty: rect.height / 2 - cy, scale: 1 });
					closePalette();
				},
			},
			{
				id: "zoom-fit",
				title: "Zoom to Fit",
				action() {
					if (!_lastDefs) {
						closePalette();
						return;
					}
					const bounds = computeDiagramBounds(_lastDefs);
					if (!bounds) {
						closePalette();
						return;
					}
					const rect = api.svg.getBoundingClientRect();
					const dW = bounds.maxX - bounds.minX;
					const dH = bounds.maxY - bounds.minY;
					if (dW === 0 || dH === 0) {
						closePalette();
						return;
					}
					const padding = 40;
					const scale = Math.min((rect.width - padding * 2) / dW, (rect.height - padding * 2) / dH);
					const tx = (rect.width - dW * scale) / 2 - bounds.minX * scale;
					const ty = (rect.height - dH * scale) / 2 - bounds.minY * scale;
					api.setViewport({ tx, ty, scale });
					closePalette();
				},
			},
			{
				id: "export-bpmn",
				title: "Export as BPMN XML",
				description: `Download as ${options.exportFilename ?? "diagram.bpmn"}`,
				action() {
					if (!_lastDefs) {
						closePalette();
						return;
					}
					const xml = Bpmn.export(_lastDefs);
					const blob = new Blob([xml], { type: "text/xml" });
					const url = URL.createObjectURL(blob);
					const a = document.createElement("a");
					a.href = url;
					a.download = options.exportFilename ?? "diagram.bpmn";
					a.click();
					URL.revokeObjectURL(url);
					closePalette();
				},
			},
			{
				id: "zen-mode",
				title: _isZenMode ? "Exit Zen Mode" : "Zen Mode",
				description: _isZenMode ? "Restore grid and toolbars" : "Hide grid and toolbars",
				action() {
					toggleZenMode();
					closePalette();
				},
			},
		];
	}

	// ── Zen mode ─────────────────────────────────────────────────────────────

	function toggleZenMode(): void {
		if (!_api) return;
		_isZenMode = !_isZenMode;
		_api.container.classList.toggle("bpmn-zen-mode", _isZenMode);
		const gridRects = _api.svg.querySelectorAll<SVGRectElement>('rect[fill^="url(#bpmn-grid"]');
		for (const rect of gridRects) {
			rect.style.visibility = _isZenMode ? "hidden" : "";
		}
		options.onZenModeChange?.(_isZenMode);
	}

	// ── Palette open / close ──────────────────────────────────────────────────

	function openPalette(): void {
		if (!_api) return;
		_closeCurrent?.();
		_closeCurrent = closePalette;
		_isOpen = true;
		_focusedIndex = 0;

		const isDark = resolveTheme(_api.getTheme()) === "dark";

		const overlay = document.createElement("div");
		overlay.className = isDark
			? "bpmn-palette-overlay"
			: "bpmn-palette-overlay bpmn-palette--light";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");
		overlay.setAttribute("aria-label", "Command palette");

		const panel = document.createElement("div");
		panel.className = "bpmn-palette-panel";

		// Search row
		const searchRow = document.createElement("div");
		searchRow.className = "bpmn-palette-search";

		const iconEl = document.createElement("span");
		iconEl.className = "bpmn-palette-search-icon";
		iconEl.innerHTML = SEARCH_ICON;
		searchRow.appendChild(iconEl);

		const input = document.createElement("input");
		input.type = "text";
		input.className = "bpmn-palette-input";
		input.placeholder = "Search commands\u2026";
		input.setAttribute("autocomplete", "off");
		input.setAttribute("spellcheck", "false");
		searchRow.appendChild(input);

		const kbdHint = document.createElement("span");
		kbdHint.className = "bpmn-palette-kbd";
		const kbdKey = document.createElement("kbd");
		kbdKey.textContent = "Esc";
		kbdHint.appendChild(kbdKey);
		searchRow.appendChild(kbdHint);

		panel.appendChild(searchRow);

		// List
		const list = document.createElement("div");
		list.className = "bpmn-palette-list";
		list.setAttribute("role", "listbox");
		panel.appendChild(list);

		overlay.appendChild(panel);
		document.body.appendChild(overlay);

		_overlayEl = overlay;
		_inputEl = input;
		_listEl = list;

		renderList("");
		input.focus();

		input.addEventListener("input", () => {
			_focusedIndex = 0;
			renderList(input.value);
		});

		overlay.addEventListener("keydown", onPaletteKeyDown);
		overlay.addEventListener("pointerdown", (e) => {
			if (e.target === overlay) closePalette();
		});
	}

	function closePalette(): void {
		if (!_isOpen) return;
		_isOpen = false;
		if (_closeCurrent === closePalette) _closeCurrent = null;
		_overlayEl?.remove();
		_overlayEl = null;
		_inputEl = null;
		_listEl = null;
	}

	// ── List rendering ────────────────────────────────────────────────────────

	function filteredCommands(query: string): Command[] {
		const all = [...builtinCommands(), ..._extraCommands];
		if (!query) return all;
		const q = query.toLowerCase();
		return all.filter(
			(c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q),
		);
	}

	function renderList(query: string): void {
		if (!_listEl) return;
		_listEl.innerHTML = "";
		const cmds = filteredCommands(query);

		if (cmds.length === 0) {
			const empty = document.createElement("div");
			empty.className = "bpmn-palette-empty";
			empty.textContent = "No commands found";
			_listEl.appendChild(empty);
			return;
		}

		if (_focusedIndex >= cmds.length) _focusedIndex = 0;

		cmds.forEach((cmd, i) => {
			if (!_listEl) return;
			const item = document.createElement("div");
			item.className =
				i === _focusedIndex ? "bpmn-palette-item bpmn-palette-focused" : "bpmn-palette-item";
			item.setAttribute("role", "option");
			item.setAttribute("aria-selected", String(i === _focusedIndex));

			const titleEl = document.createElement("span");
			titleEl.className = "bpmn-palette-item-title";
			titleEl.textContent = cmd.title;
			item.appendChild(titleEl);

			if (cmd.description) {
				const descEl = document.createElement("span");
				descEl.className = "bpmn-palette-item-desc";
				descEl.textContent = cmd.description;
				item.appendChild(descEl);
			}

			item.addEventListener("pointerenter", () => {
				_focusedIndex = i;
				updateFocus();
			});
			item.addEventListener("pointerdown", (e) => {
				e.preventDefault();
				cmd.action();
			});

			_listEl.appendChild(item);
		});
	}

	function updateFocus(): void {
		if (!_listEl) return;
		const items = _listEl.querySelectorAll<HTMLDivElement>(".bpmn-palette-item");
		items.forEach((item, i) => {
			const focused = i === _focusedIndex;
			item.classList.toggle("bpmn-palette-focused", focused);
			item.setAttribute("aria-selected", String(focused));
		});
	}

	function scrollFocusedIntoView(): void {
		if (!_listEl) return;
		const items = _listEl.querySelectorAll<HTMLDivElement>(".bpmn-palette-item");
		const item = items[_focusedIndex];
		item?.scrollIntoView({ block: "nearest" });
	}

	// ── Keyboard handling ─────────────────────────────────────────────────────

	function onPaletteKeyDown(e: KeyboardEvent): void {
		if (!_listEl || !_inputEl) return;
		const cmds = filteredCommands(_inputEl.value);
		const count = cmds.length;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			if (count > 0) {
				_focusedIndex = (_focusedIndex + 1) % count;
				updateFocus();
				scrollFocusedIntoView();
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			if (count > 0) {
				_focusedIndex = (_focusedIndex - 1 + count) % count;
				updateFocus();
				scrollFocusedIntoView();
			}
		} else if (e.key === "Enter") {
			e.preventDefault();
			const cmd = cmds[_focusedIndex];
			if (cmd) cmd.action();
		} else if (e.key === "Escape") {
			e.preventDefault();
			closePalette();
		}
	}

	const onDocKeyDown = (e: KeyboardEvent): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === "k") {
			if (!_api) return;
			e.preventDefault();
			if (_isOpen) closePalette();
			else openPalette();
		}
	};

	// ── Plugin ────────────────────────────────────────────────────────────────

	return {
		name: "command-palette",

		install(api) {
			injectCommandPaletteStyles();
			_api = api;
			_unsubs.push(
				api.on("diagram:load", (defs) => {
					_lastDefs = defs;
				}),
			);
			document.addEventListener("keydown", onDocKeyDown);
		},

		uninstall() {
			document.removeEventListener("keydown", onDocKeyDown);
			if (_isOpen) closePalette();
			if (_isZenMode && _api) {
				_api.container.classList.remove("bpmn-zen-mode");
				const gridRects = _api.svg.querySelectorAll<SVGRectElement>('rect[fill^="url(#bpmn-grid"]');
				for (const rect of gridRects) {
					rect.style.visibility = "";
				}
				options.onZenModeChange?.(false);
				_isZenMode = false;
			}
			for (const off of _unsubs) off();
			_unsubs.length = 0;
			_extraCommands.length = 0;
			_api = null;
		},

		addCommands(cmds: Command[]): () => void {
			_extraCommands.push(...cmds);
			return () => {
				for (const cmd of cmds) {
					const idx = _extraCommands.findIndex((c) => c.id === cmd.id);
					if (idx !== -1) _extraCommands.splice(idx, 1);
				}
			};
		},
	};
}
