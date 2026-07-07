/**
 * Connector catalog panel — a visual modal with two tabs:
 *
 *   • Built-in Workers  — bpmnkit workers, always available (no proxy needed)
 *   • Community APIs    — OpenAPI-generated connectors from the catalog
 *
 * Usage:
 *   const panel = new CatalogPanel(registrar, onLoadCatalogEntry, onLoadFromUrl)
 *   panel.open()
 */
import type { CatalogEntry } from "@bpmnkit/connector-gen/browser"
import type { ElementTemplate } from "@bpmnkit/connectors"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CatalogPanelOptions {
	builtinTemplates: ElementTemplate[]
	catalogEntries: CatalogEntry[]
	onUseBuiltin(template: ElementTemplate): void
	onLoadCatalogEntry(id: string): void
	onLoadFromUrl(url: string): void
	onLoadFromFile(): void
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...children: (HTMLElement | string)[]
): HTMLElementTagNameMap[K] {
	const node = document.createElement(tag)
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
	for (const child of children) {
		if (typeof child === "string") node.append(document.createTextNode(child))
		else node.append(child)
	}
	return node
}

// ── Card rendering ────────────────────────────────────────────────────────────

function renderBuiltinCard(
	template: ElementTemplate,
	onUse: (t: ElementTemplate) => void,
): HTMLElement {
	const card = el("div", { class: "bpmnkit-cc-card" })

	// Icon
	const iconWrap = el("div", { class: "bpmnkit-cc-card__icon" })
	if (template.icon?.contents) {
		iconWrap.innerHTML = template.icon.contents
	}
	card.append(iconWrap)

	// Text
	const body = el("div", { class: "bpmnkit-cc-card__body" })
	body.append(el("div", { class: "bpmnkit-cc-card__name" }, template.name))
	if (template.description) {
		body.append(el("div", { class: "bpmnkit-cc-card__desc" }, template.description))
	}
	card.append(body)

	// Use button
	const btn = el("button", { class: "bpmnkit-cc-card__use", type: "button" }, "Use")
	btn.addEventListener("click", (e) => {
		e.stopPropagation()
		onUse(template)
	})
	card.append(btn)

	// Whole card is also clickable
	card.addEventListener("click", () => onUse(template))

	return card
}

function renderCommunityRow(entry: CatalogEntry, onLoad: (id: string) => void): HTMLElement {
	const row = el("div", { class: "bpmnkit-cc-row" })

	const body = el("div", { class: "bpmnkit-cc-row__body" })
	body.append(el("div", { class: "bpmnkit-cc-row__name" }, entry.name))
	if (entry.description) {
		body.append(el("div", { class: "bpmnkit-cc-row__desc" }, entry.description))
	}
	row.append(body)

	const btn = el("button", { class: "bpmnkit-cc-row__import", type: "button" }, "Import")
	btn.addEventListener("click", (e) => {
		e.stopPropagation()
		onLoad(entry.id)
	})
	row.append(btn)

	row.addEventListener("click", () => onLoad(entry.id))

	return row
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export class CatalogPanel {
	private readonly opts: CatalogPanelOptions
	private overlay: HTMLElement | null = null
	private activeTab: "builtin" | "community" = "builtin"
	private query = ""

	constructor(opts: CatalogPanelOptions) {
		this.opts = opts
	}

	open(): void {
		if (this.overlay) {
			this.overlay.style.display = "flex"
			return
		}
		this.overlay = this.build()
		document.body.append(this.overlay)
		// Focus search on next tick
		setTimeout(() => {
			const input = this.overlay?.querySelector<HTMLInputElement>(".bpmnkit-cc-panel__search-input")
			input?.focus()
		}, 0)
	}

	close(): void {
		if (this.overlay) {
			this.overlay.style.display = "none"
		}
	}

	private build(): HTMLElement {
		const overlay = el("div", {
			class: "bpmnkit-cc-panel-overlay",
			role: "dialog",
			"aria-modal": "true",
			"aria-label": "Connector catalog",
		})

		// Close on backdrop click
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) this.close()
		})

		// Close on Escape
		overlay.addEventListener("keydown", (e) => {
			if (e.key === "Escape") this.close()
		})

		const panel = el("div", { class: "bpmnkit-cc-panel" })
		overlay.append(panel)

		// Header
		const header = el("div", { class: "bpmnkit-cc-panel__header" })
		header.append(el("h2", { class: "bpmnkit-cc-panel__title" }, "Connectors"))
		const closeBtn = el(
			"button",
			{
				class: "bpmnkit-cc-panel__close",
				type: "button",
				"aria-label": "Close",
			},
			"✕",
		)
		closeBtn.addEventListener("click", () => this.close())
		header.append(closeBtn)
		panel.append(header)

		// Search
		const searchWrap = el("div", { class: "bpmnkit-cc-panel__search" })
		const searchInput = el("input", {
			class: "bpmnkit-cc-panel__search-input",
			type: "text",
			placeholder: "Search connectors…",
			autocomplete: "off",
		})
		searchInput.addEventListener("input", () => {
			this.query = searchInput.value.toLowerCase().trim()
			this.renderContent(content)
		})
		searchWrap.append(searchInput)
		panel.append(searchWrap)

		// Tabs
		const tabs = el("div", { class: "bpmnkit-cc-panel__tabs", role: "tablist" })
		const builtinTab = el(
			"button",
			{
				class: "bpmnkit-cc-tab bpmnkit-cc-tab--active",
				role: "tab",
				type: "button",
			},
			"Built-in Workers",
		)
		const communityTab = el(
			"button",
			{
				class: "bpmnkit-cc-tab",
				role: "tab",
				type: "button",
			},
			"Community APIs",
		)

		builtinTab.addEventListener("click", () => {
			this.activeTab = "builtin"
			builtinTab.classList.add("bpmnkit-cc-tab--active")
			communityTab.classList.remove("bpmnkit-cc-tab--active")
			this.renderContent(content)
		})
		communityTab.addEventListener("click", () => {
			this.activeTab = "community"
			communityTab.classList.add("bpmnkit-cc-tab--active")
			builtinTab.classList.remove("bpmnkit-cc-tab--active")
			this.renderContent(content)
		})

		tabs.append(builtinTab, communityTab)
		panel.append(tabs)

		// Content area
		const content = el("div", { class: "bpmnkit-cc-panel__content" })
		this.renderContent(content)
		panel.append(content)

		// Community footer actions
		const footer = el("div", { class: "bpmnkit-cc-panel__footer" })
		const urlBtn = el(
			"button",
			{ class: "bpmnkit-cc-footer-btn", type: "button" },
			"Import from URL…",
		)
		urlBtn.addEventListener("click", () => {
			this.close()
			const url = window.prompt("Enter an OpenAPI 3.x spec URL:")
			if (url?.trim()) this.opts.onLoadFromUrl(url.trim())
		})
		const fileBtn = el(
			"button",
			{ class: "bpmnkit-cc-footer-btn", type: "button" },
			"Import from file…",
		)
		fileBtn.addEventListener("click", () => {
			this.close()
			this.opts.onLoadFromFile()
		})
		footer.append(urlBtn, fileBtn)
		panel.append(footer)

		return overlay
	}

	private renderContent(container: HTMLElement): void {
		container.innerHTML = ""

		if (this.activeTab === "builtin") {
			this.renderBuiltins(container)
		} else {
			this.renderCommunity(container)
		}
	}

	private renderBuiltins(container: HTMLElement): void {
		const q = this.query
		const filtered = q
			? this.opts.builtinTemplates.filter(
					(t) =>
						t.name.toLowerCase().includes(q) || (t.description ?? "").toLowerCase().includes(q),
				)
			: this.opts.builtinTemplates

		if (filtered.length === 0) {
			container.append(el("div", { class: "bpmnkit-cc-empty" }, `No workers match "${this.query}"`))
			return
		}

		const grid = el("div", { class: "bpmnkit-cc-grid" })
		for (const template of filtered) {
			grid.append(
				renderBuiltinCard(template, (t) => {
					this.opts.onUseBuiltin(t)
					this.close()
				}),
			)
		}
		container.append(grid)
	}

	private renderCommunity(container: HTMLElement): void {
		const q = this.query
		const filtered = q
			? this.opts.catalogEntries.filter(
					(e) =>
						e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
				)
			: this.opts.catalogEntries

		if (filtered.length === 0) {
			container.append(el("div", { class: "bpmnkit-cc-empty" }, `No APIs match "${this.query}"`))
			return
		}

		const list = el("div", { class: "bpmnkit-cc-list" })
		for (const entry of filtered) {
			list.append(
				renderCommunityRow(entry, (id) => {
					this.opts.onLoadCatalogEntry(id)
					this.close()
				}),
			)
		}
		container.append(list)
	}
}
