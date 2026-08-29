/**
 * @bpmnkit/canvas-plugin-command-palette — Ctrl+K / ⌘K command palette for
 * `@bpmnkit/canvas` and `@bpmnkit/editor`.
 *
 * ## Usage
 * ```typescript
 * import { createCommandPalettePlugin } from "@bpmnkit/canvas-plugin-command-palette";
 *
 * const palette = createCommandPalettePlugin({
 *   onZenModeChange: (active) => {
 *     document.querySelectorAll(".hud").forEach(
 *       (el) => { (el as HTMLElement).style.display = active ? "none" : ""; }
 *     );
 *   },
 *   onAskAI: (query) => aiBridgePlugin.ask(query),
 * });
 *
 * const editor = new BpmnEditor({ container, xml, plugins: [palette] });
 * ```
 *
 * @packageDocumentation
 */

import { computeDiagramBounds } from "@bpmnkit/canvas"
import type { CanvasApi, CanvasPlugin, Theme } from "@bpmnkit/canvas"
import { Bpmn } from "@bpmnkit/core"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { injectCommandPaletteStyles } from "./css.js"

export {
	COMMAND_PALETTE_CSS,
	COMMAND_PALETTE_STYLE_ID,
	injectCommandPaletteStyles,
} from "./css.js"

// ── Public types ──────────────────────────────────────────────────────────────

export interface Command {
	id: string
	title: string
	/** Short hint shown on the right side of the item. */
	description?: string
	action: () => void
}

export interface CommandPaletteOptions {
	/**
	 * Called when zen mode is toggled.
	 * Use this to hide/show external toolbars that live outside the canvas
	 * container (e.g. HUD elements in the landing page).
	 */
	onZenModeChange?: (active: boolean) => void
	/** Filename for exported BPMN XML downloads. Defaults to `"diagram.bpmn"`. */
	exportFilename?: string
	/**
	 * Called when the user submits a free-text AI query from the palette.
	 * If not provided, the "Ask AI" item is hidden.
	 */
	onAskAI?: (query: string) => void
	/**
	 * URL of the proxy / AI server used to check whether the AI feature is
	 * available. Defaults to `http://localhost:3033`.
	 */
	aiServerUrl?: string
	/**
	 * Base URL for documentation links.
	 * Defaults to `https://bpmnkit.com/docs`.
	 */
	docsBaseUrl?: string
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
	addCommands(cmds: Command[]): () => void
	/**
	 * Pushes a new view onto the palette's navigation stack.
	 * Pressing Escape pops back to the previous view (or closes if at root).
	 * Calling this while the palette is closed is a no-op.
	 *
	 * When `onConfirm` is provided the view acts as a free-text input step:
	 * the item list is empty and pressing Enter calls `onConfirm(inputValue)`
	 * then closes the palette.
	 */
	pushView(
		cmds: Command[],
		opts?: { placeholder?: string; onConfirm?: (value: string) => void },
	): void
}

// ── Matching ──────────────────────────────────────────────────────────────────

/**
 * Returns true when every whitespace-separated word in `query` appears
 * somewhere in `text` (case-insensitive). This lets "add gateway" match
 * "Add Exclusive Gateway" even though it is not a contiguous substring.
 */
function wordsMatch(text: string, query: string): boolean {
	const target = text.toLowerCase()
	return query
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean)
		.every((w) => target.includes(w))
}

// ── Docs registry ─────────────────────────────────────────────────────────────

const DOCS_BASE_DEFAULT = "https://bpmnkit.com/docs"

interface DocEntry {
	title: string
	path: string
	keywords: string[]
}

const DOC_ENTRIES: DocEntry[] = [
	{
		title: "Quick Start",
		path: "/getting-started/quick-start",
		keywords: ["start", "install", "begin", "setup", "first", "hello", "quickstart"],
	},
	{
		title: "Installation",
		path: "/getting-started/installation",
		keywords: ["install", "npm", "pnpm", "yarn", "add", "package", "require"],
	},
	{
		title: "Concepts",
		path: "/getting-started/concepts",
		keywords: ["concept", "bpmn", "process", "element", "overview", "intro", "what"],
	},
	{
		title: "Building Processes",
		path: "/guides/building-processes",
		keywords: ["build", "create", "process", "task", "flow", "sequence", "diagram", "guide"],
	},
	{
		title: "Gateways",
		path: "/guides/gateways",
		keywords: [
			"gateway",
			"exclusive",
			"parallel",
			"inclusive",
			"split",
			"merge",
			"xor",
			"condition",
			"branch",
			"fork",
		],
	},
	{
		title: "Simulation",
		path: "/guides/simulation",
		keywords: ["simulate", "run", "test", "engine", "execute", "play", "simulation"],
	},
	{
		title: "Deployment",
		path: "/guides/deployment",
		keywords: ["deploy", "camunda", "cluster", "zeebe", "publish", "production", "upload"],
	},
	{
		title: "AI Guide",
		path: "/guides/ai",
		keywords: [
			"ai",
			"artificial",
			"intelligence",
			"llm",
			"claude",
			"copilot",
			"gemini",
			"assist",
			"chat",
			"improve",
		],
	},
	{
		title: "@bpmnkit/core",
		path: "/packages/core",
		keywords: [
			"core",
			"parser",
			"builder",
			"xml",
			"export",
			"import",
			"layout",
			"compact",
			"serialize",
		],
	},
	{
		title: "@bpmnkit/editor",
		path: "/packages/editor",
		keywords: ["editor", "edit", "modeler", "interactive", "canvas", "plugin"],
	},
	{
		title: "@bpmnkit/engine",
		path: "/packages/engine",
		keywords: ["engine", "execute", "run", "simulate", "worker", "job", "token", "fire"],
	},
	{
		title: "@bpmnkit/api",
		path: "/packages/api",
		keywords: ["api", "client", "camunda", "rest", "http", "zeebe", "operate", "instance"],
	},
	{
		title: "@bpmnkit/canvas",
		path: "/packages/canvas",
		keywords: ["canvas", "viewer", "svg", "render", "view", "display", "embed"],
	},
	{
		title: "Connector Generator",
		path: "/packages/connector-gen",
		keywords: ["connector", "openapi", "swagger", "template", "generate", "rest", "http", "api"],
	},
	{
		title: "casen CLI",
		path: "/cli/casen",
		keywords: [
			"cli",
			"command",
			"terminal",
			"casen",
			"tui",
			"profile",
			"job",
			"incident",
			"process",
			"mcp",
		],
	},
	{
		title: "casen connector",
		path: "/cli/connector",
		keywords: ["connector", "cli", "generate", "api", "catalog", "swagger", "openapi"],
	},
]

// Shown when the query is empty
const FEATURED_DOC_PATHS = new Set([
	"/getting-started/quick-start/",
	"/guides/building-processes/",
	"/guides/ai/",
	"/cli/casen/",
])

// ── Internal item types ───────────────────────────────────────────────────────

interface PaletteItem {
	title: string
	description?: string
	kind: "command" | "doc" | "ai"
	/** Shown but not executable — used for the AI item when the proxy is down. */
	disabled?: boolean
	action: () => void
}

interface PaletteSection {
	label?: string
	items: PaletteItem[]
}

// ── Module-level singleton — only one palette open at a time ──────────────────

let _closeCurrent: (() => void) | null = null

// ── Icons ─────────────────────────────────────────────────────────────────────

const SEARCH_ICON =
	'<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4"/><line x1="10" y1="10" x2="14" y2="14"/></svg>'

const EXTERNAL_ICON =
	'<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7.5"/><polyline points="7.5 1 11 1 11 4.5"/><line x1="11" y1="1" x2="5.5" y2="6.5"/></svg>'

const AI_ICON =
	'<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a.5.5 0 0 1 .46.31l1.46 3.46 3.46 1.46a.5.5 0 0 1 0 .94l-3.46 1.46L8.46 11.1a.5.5 0 0 1-.92 0L6.08 7.63 2.62 6.17a.5.5 0 0 1 0-.94l3.46-1.46L7.54.31A.5.5 0 0 1 8 0zm0 2.08L6.96 4.54a.5.5 0 0 1-.28.28L4.22 5.7l2.46 1.04a.5.5 0 0 1 .28.28L8 9.48l1.04-2.46a.5.5 0 0 1 .28-.28L11.78 5.7 9.32 4.82a.5.5 0 0 1-.28-.28L8 2.08zm5 8.42a.5.5 0 0 1 .46.31l.6 1.43 1.43.6a.5.5 0 0 1 0 .92l-1.43.6-.6 1.43a.5.5 0 0 1-.92 0l-.6-1.43-1.43-.6a.5.5 0 0 1 0-.92l1.43-.6.6-1.43A.5.5 0 0 1 13 10.5zm0 1.79-.27.63a.5.5 0 0 1-.28.28l-.63.27.63.27a.5.5 0 0 1 .28.28l.27.63.27-.63a.5.5 0 0 1 .28-.28l.63-.27-.63-.27a.5.5 0 0 1-.28-.28L13 12.29z"/></svg>'

// ── Theme helper ──────────────────────────────────────────────────────────────

function resolveTheme(theme: Theme): "dark" | "light" {
	if (theme === "light") return "light"
	if (theme === "dark" || theme === "neon") return "dark"
	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createCommandPalettePlugin(
	options: CommandPaletteOptions = {},
): CommandPalettePlugin {
	let _api: CanvasApi | null = null
	let _overlayEl: HTMLDivElement | null = null
	let _inputEl: HTMLInputElement | null = null
	let _listEl: HTMLDivElement | null = null
	let _isOpen = false
	let _isZenMode = false
	let _focusedIndex = 0
	let _lastDefs: BpmnDefinitions | null = null
	let _focusableItems: PaletteItem[] = []
	// null = unknown/checking, true = running, false = not running
	let _proxyReady: boolean | null = null
	// incremented on each palette open to discard stale fetch results
	let _proxyCheckId = 0

	interface PushedView {
		cmds: Command[]
		placeholder: string
		onConfirm?: (value: string) => void
	}
	// navigation stack — each pushView() adds one level, Escape pops
	const _viewStack: PushedView[] = []
	const _extraCommands: Command[] = []
	const _unsubs: Array<() => void> = []

	// ── Built-in commands (lazy — need _api set) ─────────────────────────────

	function builtinCommands(): Command[] {
		if (!_api) return []
		const api = _api
		return [
			{
				id: "toggle-theme",
				title: "Toggle Theme",
				description: "Cycle: dark → light → auto",
				action() {
					const cur = api.getTheme()
					const next: Theme = cur === "dark" ? "light" : cur === "light" ? "auto" : "dark"
					api.setTheme(next)
					closePalette()
				},
			},
			{
				id: "zoom-100",
				title: "Zoom to 100%",
				action() {
					const vp = api.getViewport()
					const rect = api.svg.getBoundingClientRect()
					const cx = (rect.width / 2 - vp.tx) / vp.scale
					const cy = (rect.height / 2 - vp.ty) / vp.scale
					api.setViewport({ tx: rect.width / 2 - cx, ty: rect.height / 2 - cy, scale: 1 })
					closePalette()
				},
			},
			{
				id: "zoom-fit",
				title: "Zoom to Fit",
				action() {
					if (!_lastDefs) {
						closePalette()
						return
					}
					const bounds = computeDiagramBounds(_lastDefs)
					if (!bounds) {
						closePalette()
						return
					}
					const rect = api.svg.getBoundingClientRect()
					const dW = bounds.maxX - bounds.minX
					const dH = bounds.maxY - bounds.minY
					if (dW === 0 || dH === 0) {
						closePalette()
						return
					}
					const padding = 40
					const scale = Math.min((rect.width - padding * 2) / dW, (rect.height - padding * 2) / dH)
					const tx = (rect.width - dW * scale) / 2 - bounds.minX * scale
					const ty = (rect.height - dH * scale) / 2 - bounds.minY * scale
					api.setViewport({ tx, ty, scale })
					closePalette()
				},
			},
			{
				id: "export-bpmn",
				title: "Export as BPMN XML",
				description: `Download as ${options.exportFilename ?? "diagram.bpmn"}`,
				action() {
					if (!_lastDefs) {
						closePalette()
						return
					}
					const xml = Bpmn.export(_lastDefs)
					const blob = new Blob([xml], { type: "text/xml" })
					const url = URL.createObjectURL(blob)
					const a = document.createElement("a")
					a.href = url
					a.download = options.exportFilename ?? "diagram.bpmn"
					a.click()
					URL.revokeObjectURL(url)
					closePalette()
				},
			},
			{
				id: "zen-mode",
				title: _isZenMode ? "Exit Zen Mode" : "Zen Mode",
				description: _isZenMode ? "Restore grid and toolbars" : "Hide grid and toolbars",
				action() {
					toggleZenMode()
					closePalette()
				},
			},
		]
	}

	// ── Zen mode ─────────────────────────────────────────────────────────────

	function toggleZenMode(): void {
		if (!_api) return
		_isZenMode = !_isZenMode
		_api.container.classList.toggle("bpmnkit-zen-mode", _isZenMode)
		const gridRects = _api.svg.querySelectorAll<SVGRectElement>('rect[fill^="url(#bpmnkit-grid"]')
		for (const rect of gridRects) {
			rect.style.visibility = _isZenMode ? "hidden" : ""
		}
		options.onZenModeChange?.(_isZenMode)
	}

	// ── Proxy check ───────────────────────────────────────────────────────────

	function startProxyCheck(): void {
		if (!options.onAskAI) return
		_proxyReady = null
		const checkId = ++_proxyCheckId
		const serverUrl = options.aiServerUrl ?? "http://localhost:3033"
		fetch(`${serverUrl}/status`, { signal: AbortSignal.timeout(3000) })
			.then((res) => res.json())
			.then((data: unknown) => {
				if (checkId !== _proxyCheckId) return
				_proxyReady = Boolean((data as Record<string, unknown>)?.ready)
				if (_isOpen && _inputEl) renderList(_inputEl.value)
			})
			.catch(() => {
				if (checkId !== _proxyCheckId) return
				_proxyReady = false
				if (_isOpen && _inputEl) renderList(_inputEl.value)
			})
	}

	// ── Section builders ──────────────────────────────────────────────────────

	function buildCommandItems(query: string): PaletteItem[] {
		const all = [...builtinCommands(), ..._extraCommands]
		const cmds = query
			? all.filter(
					(c) =>
						wordsMatch(c.title, query) ||
						(c.description != null && wordsMatch(c.description, query)),
				)
			: all
		return cmds.map((c) => ({
			kind: "command" as const,
			title: c.title,
			description: c.description,
			action: c.action,
		}))
	}

	function buildDocItems(query: string): PaletteItem[] {
		const baseUrl = options.docsBaseUrl ?? DOCS_BASE_DEFAULT
		const entries = query.trim()
			? DOC_ENTRIES.filter((e) => {
					const q = query.toLowerCase()
					return e.title.toLowerCase().includes(q) || e.keywords.some((k) => k.includes(q))
				}).slice(0, 4)
			: DOC_ENTRIES.filter((e) => FEATURED_DOC_PATHS.has(e.path))
		return entries.map((e) => ({
			kind: "doc" as const,
			title: e.title,
			description: "docs ↗",
			action() {
				window.open(baseUrl + e.path, "_blank", "noopener")
				closePalette()
			},
		}))
	}

	function buildAiItem(query: string): PaletteItem {
		const ready = _proxyReady
		const description =
			ready === null
				? "Checking server…"
				: ready
					? "Send to AI assistant  ↵"
					: "npx @bpmnkit/proxy  —  then reopen"
		return {
			kind: "ai" as const,
			title: `Ask AI: "${query.trim()}"`,
			description,
			disabled: ready !== true,
			action() {
				if (ready !== true) return
				options.onAskAI?.(query.trim())
				closePalette()
			},
		}
	}

	function buildSections(query: string): PaletteSection[] {
		// Pushed view: show only the pushed commands, no docs/AI
		const activeView = _viewStack[_viewStack.length - 1]
		if (activeView) {
			const items = activeView.cmds
				.filter(
					(c) =>
						!query ||
						wordsMatch(c.title, query) ||
						(c.description != null && wordsMatch(c.description, query)),
				)
				.map((c) => ({
					kind: "command" as const,
					title: c.title,
					description: c.description,
					action: c.action,
				}))
			return items.length > 0 ? [{ items }] : []
		}

		const sections: PaletteSection[] = []

		const cmdItems = buildCommandItems(query)
		if (cmdItems.length > 0) sections.push({ items: cmdItems })

		const docItems = buildDocItems(query)
		if (docItems.length > 0) sections.push({ label: "Documentation", items: docItems })

		if (options.onAskAI && query.trim().length > 0) {
			sections.push({ label: "AI", items: [buildAiItem(query)] })
		}

		// Show "Commands" label only when there are other sections too
		const first = sections[0]
		if (sections.length > 1 && first && !first.label && first.items.length > 0) {
			first.label = "Commands"
		}

		return sections
	}

	// ── Palette open / close ──────────────────────────────────────────────────

	function openPalette(): void {
		if (!_api) return
		_closeCurrent?.()
		_closeCurrent = closePalette
		_isOpen = true
		_focusedIndex = 0

		startProxyCheck()

		const isDark = resolveTheme(_api.getTheme()) === "dark"

		const overlay = document.createElement("div")
		overlay.className = isDark
			? "bpmnkit-palette-overlay"
			: "bpmnkit-palette-overlay bpmnkit-palette--light"
		overlay.setAttribute("role", "dialog")
		overlay.setAttribute("aria-modal", "true")
		overlay.setAttribute("aria-label", "Command palette")

		const panel = document.createElement("div")
		panel.className = "bpmnkit-palette-panel"

		// Search row
		const searchRow = document.createElement("div")
		searchRow.className = "bpmnkit-palette-search"

		const iconEl = document.createElement("span")
		iconEl.className = "bpmnkit-palette-search-icon"
		iconEl.innerHTML = SEARCH_ICON
		searchRow.appendChild(iconEl)

		const input = document.createElement("input")
		input.type = "text"
		input.className = "bpmnkit-palette-input"
		input.placeholder = "Search commands or docs\u2026"
		input.setAttribute("autocomplete", "off")
		input.setAttribute("spellcheck", "false")
		searchRow.appendChild(input)

		const kbdHint = document.createElement("span")
		kbdHint.className = "bpmnkit-palette-kbd"
		const kbdKey = document.createElement("kbd")
		kbdKey.textContent = "Esc"
		kbdHint.appendChild(kbdKey)
		searchRow.appendChild(kbdHint)

		panel.appendChild(searchRow)

		// List
		const list = document.createElement("div")
		list.className = "bpmnkit-palette-list"
		list.setAttribute("role", "listbox")
		panel.appendChild(list)

		overlay.appendChild(panel)
		document.body.appendChild(overlay)

		_overlayEl = overlay
		_inputEl = input
		_listEl = list

		renderList("")
		input.focus()

		input.addEventListener("input", () => {
			_focusedIndex = 0
			renderList(input.value)
		})

		overlay.addEventListener("keydown", onPaletteKeyDown)
		overlay.addEventListener("pointerdown", (e) => {
			if (e.target === overlay) closePalette()
		})
	}

	function closePalette(): void {
		if (!_isOpen) return
		_isOpen = false
		_proxyCheckId++ // invalidate any pending fetch
		_proxyReady = null
		_viewStack.length = 0
		if (_closeCurrent === closePalette) _closeCurrent = null
		_overlayEl?.remove()
		_overlayEl = null
		_inputEl = null
		_listEl = null
		_focusableItems = []
	}

	function popView(): void {
		_viewStack.pop()
		const prev = _viewStack[_viewStack.length - 1]
		if (_inputEl) {
			_inputEl.value = ""
			_inputEl.placeholder = prev?.placeholder ?? "Search commands or docs\u2026"
		}
		_focusedIndex = 0
		renderList("")
	}

	// ── List rendering ────────────────────────────────────────────────────────

	function renderList(query: string): void {
		if (!_listEl) return
		_listEl.innerHTML = ""
		_focusableItems = []

		const sections = buildSections(query)
		const totalItems = sections.reduce((n, s) => n + s.items.length, 0)

		if (totalItems === 0) {
			const empty = document.createElement("div")
			empty.className = "bpmnkit-palette-empty"
			const activeView = _viewStack[_viewStack.length - 1]
			empty.textContent = activeView?.onConfirm
				? "Press \u21b5 to confirm, Esc to go back"
				: "No commands found"
			_listEl.appendChild(empty)
			return
		}

		if (_focusedIndex >= totalItems) _focusedIndex = 0

		for (const section of sections) {
			if (section.label) {
				const labelEl = document.createElement("div")
				labelEl.className = "bpmnkit-palette-section"
				labelEl.textContent = section.label
				_listEl.appendChild(labelEl)
			}

			for (const item of section.items) {
				const focusableIdx = _focusableItems.length
				_focusableItems.push(item)

				const el = document.createElement("div")
				el.className = buildItemClass(item, focusableIdx)
				el.setAttribute("role", "option")
				el.setAttribute("aria-selected", String(focusableIdx === _focusedIndex))
				el.setAttribute("aria-disabled", String(item.disabled ?? false))

				// Leading icon
				if (item.kind === "doc" || item.kind === "ai") {
					const iconSpan = document.createElement("span")
					iconSpan.className = "bpmnkit-palette-item-icon"
					iconSpan.innerHTML = item.kind === "doc" ? EXTERNAL_ICON : AI_ICON
					el.appendChild(iconSpan)
				}

				const titleEl = document.createElement("span")
				titleEl.className = "bpmnkit-palette-item-title"
				titleEl.textContent = item.title
				el.appendChild(titleEl)

				if (item.description) {
					const descEl = document.createElement("span")
					descEl.className = "bpmnkit-palette-item-desc"
					descEl.textContent = item.description
					el.appendChild(descEl)
				}

				el.addEventListener("pointerenter", () => {
					_focusedIndex = focusableIdx
					updateFocus()
				})
				el.addEventListener("pointerdown", (e) => {
					e.preventDefault()
					if (!item.disabled) item.action()
				})

				_listEl.appendChild(el)
			}
		}
	}

	function buildItemClass(item: PaletteItem, idx: number): string {
		const classes = ["bpmnkit-palette-item"]
		if (item.kind !== "command") classes.push(`bpmnkit-palette-item--${item.kind}`)
		if (item.disabled) classes.push("bpmnkit-palette-item--disabled")
		if (idx === _focusedIndex) classes.push("bpmnkit-palette-focused")
		return classes.join(" ")
	}

	function updateFocus(): void {
		if (!_listEl) return
		const items = _listEl.querySelectorAll<HTMLDivElement>(".bpmnkit-palette-item")
		let focusableIdx = 0
		for (const el of items) {
			const focused = focusableIdx === _focusedIndex
			el.classList.toggle("bpmnkit-palette-focused", focused)
			el.setAttribute("aria-selected", String(focused))
			focusableIdx++
		}
	}

	function scrollFocusedIntoView(): void {
		if (!_listEl) return
		const items = _listEl.querySelectorAll<HTMLDivElement>(".bpmnkit-palette-item")
		const item = items[_focusedIndex]
		item?.scrollIntoView({ block: "nearest" })
	}

	// ── Keyboard handling ─────────────────────────────────────────────────────

	function onPaletteKeyDown(e: KeyboardEvent): void {
		if (!_listEl || !_inputEl) return
		const count = _focusableItems.length

		if (e.key === "ArrowDown") {
			e.preventDefault()
			if (count > 0) {
				_focusedIndex = (_focusedIndex + 1) % count
				updateFocus()
				scrollFocusedIntoView()
			}
		} else if (e.key === "ArrowUp") {
			e.preventDefault()
			if (count > 0) {
				_focusedIndex = (_focusedIndex - 1 + count) % count
				updateFocus()
				scrollFocusedIntoView()
			}
		} else if (e.key === "Enter") {
			e.preventDefault()
			const activeView = _viewStack[_viewStack.length - 1]
			if (activeView?.onConfirm) {
				activeView.onConfirm(_inputEl.value)
				closePalette()
				return
			}
			const item = _focusableItems[_focusedIndex]
			if (item && !item.disabled) item.action()
		} else if (e.key === "Escape") {
			e.preventDefault()
			if (_viewStack.length > 0) popView()
			else closePalette()
		}
	}

	const onDocKeyDown = (e: KeyboardEvent): void => {
		if ((e.ctrlKey || e.metaKey) && e.key === "k") {
			if (!_api) return
			e.preventDefault()
			if (_isOpen) closePalette()
			else openPalette()
		}
	}

	// ── Plugin ────────────────────────────────────────────────────────────────

	return {
		name: "command-palette",

		install(api) {
			injectCommandPaletteStyles()
			_api = api
			_unsubs.push(
				api.on("diagram:load", (defs) => {
					_lastDefs = defs
				}),
			)
			document.addEventListener("keydown", onDocKeyDown)
		},

		uninstall() {
			document.removeEventListener("keydown", onDocKeyDown)
			if (_isOpen) closePalette()
			if (_isZenMode && _api) {
				_api.container.classList.remove("bpmnkit-zen-mode")
				const gridRects = _api.svg.querySelectorAll<SVGRectElement>(
					'rect[fill^="url(#bpmnkit-grid"]',
				)
				for (const rect of gridRects) {
					rect.style.visibility = ""
				}
				options.onZenModeChange?.(false)
				_isZenMode = false
			}
			for (const off of _unsubs) off()
			_unsubs.length = 0
			_extraCommands.length = 0
			_api = null
		},

		addCommands(cmds: Command[]): () => void {
			_extraCommands.push(...cmds)
			return () => {
				for (const cmd of cmds) {
					const idx = _extraCommands.findIndex((c) => c.id === cmd.id)
					if (idx !== -1) _extraCommands.splice(idx, 1)
				}
			}
		},

		pushView(
			cmds: Command[],
			opts: { placeholder?: string; onConfirm?: (value: string) => void } = {},
		): void {
			if (!_isOpen) return
			const view: PushedView = {
				cmds,
				placeholder: opts.placeholder ?? "Select\u2026",
				onConfirm: opts.onConfirm,
			}
			_viewStack.push(view)
			if (_inputEl) {
				_inputEl.value = ""
				_inputEl.placeholder = view.placeholder
			}
			_focusedIndex = 0
			renderList("")
		},
	}
}
