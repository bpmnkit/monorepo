/**
 * Connector catalog panel — a visual modal with two tabs:
 *
 *   • Built-in Workers  — bpmnkit workers, always available (no proxy needed)
 *   • Community APIs    — OpenAPI-generated connectors from the catalog
 *
 * Selecting a worker opens a detail view before anything is applied: what job
 * type it binds, what it will ask for, and which of those look like
 * credentials. Applying a template rewrites an element's extensions, and a
 * picker that does that on the first click is asking someone to choose blind.
 * The card's own button still applies straight away, for the case where the
 * reader already knows.
 *
 * Usage:
 *   const panel = new CatalogPanel(registrar, onLoadCatalogEntry, onLoadFromUrl)
 *   panel.open()
 */
import type { CatalogEntry } from "@bpmnkit/connector-gen/browser"
import type { ConnectorInputSpec, ElementTemplate } from "@bpmnkit/connectors"
import { summarizeTemplate } from "@bpmnkit/connectors"

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
	onInspect: (t: ElementTemplate) => void,
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

	// The card opens the detail view; only the button applies.
	card.addEventListener("click", () => onInspect(template))

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

// ── Detail view ───────────────────────────────────────────────────────────────

function field(spec: ConnectorInputSpec, required: boolean): HTMLElement {
	const row = el("div", { class: "bpmnkit-cc-field" })
	const name = el("div", { class: "bpmnkit-cc-field__name" }, spec.label)
	if (required) name.append(el("span", { class: "bpmnkit-cc-field__req", title: "Required" }, "*"))
	if (spec.isSecret) {
		// Worth calling out before the template is applied: a secret field is one
		// the modeller must not paste a literal into.
		name.append(el("span", { class: "bpmnkit-cc-field__secret" }, "secret"))
	}
	if (spec.isFeel) name.append(el("span", { class: "bpmnkit-cc-field__feel" }, "FEEL"))
	row.append(name)

	const meta: string[] = [spec.key]
	if (spec.default !== undefined && spec.default !== "")
		meta.push(`default ${String(spec.default)}`)
	// A conditional field is not always asked for, and saying "required" of one
	// that only appears for a particular choice would be wrong.
	if (spec.condition !== undefined) meta.push("shown for some options")
	row.append(el("div", { class: "bpmnkit-cc-field__meta" }, meta.join(" · ")))

	if (spec.description) {
		row.append(el("div", { class: "bpmnkit-cc-field__desc" }, spec.description))
	}
	return row
}

function section(
	title: string,
	specs: ConnectorInputSpec[],
	required: boolean,
): HTMLElement | null {
	if (specs.length === 0) return null
	const wrap = el("div", { class: "bpmnkit-cc-detail__section" })
	wrap.append(el("div", { class: "bpmnkit-cc-detail__section-title" }, title))
	for (const spec of specs) wrap.append(field(spec, required))
	return wrap
}

function renderDetail(
	template: ElementTemplate,
	onApply: () => void,
	onBack: () => void,
): HTMLElement {
	const summary = summarizeTemplate(template)
	const detail = el("div", { class: "bpmnkit-cc-detail" })

	const head = el("div", { class: "bpmnkit-cc-detail__head" })
	const back = el(
		"button",
		{ class: "bpmnkit-cc-detail__back", type: "button" },
		"\u2190 All workers",
	)
	back.addEventListener("click", onBack)
	head.append(back)
	detail.append(head)

	const title = el("div", { class: "bpmnkit-cc-detail__title" })
	if (template.icon?.contents) {
		const icon = el("div", { class: "bpmnkit-cc-detail__icon" })
		icon.innerHTML = template.icon.contents
		title.append(icon)
	}
	const heading = el("div")
	heading.append(el("div", { class: "bpmnkit-cc-detail__name" }, template.name))
	heading.append(
		el(
			"div",
			{ class: "bpmnkit-cc-detail__id" },
			template.version === undefined ? template.id : `${template.id} · v${template.version}`,
		),
	)
	title.append(heading)
	detail.append(title)

	if (template.description) {
		detail.append(el("div", { class: "bpmnkit-cc-detail__desc" }, template.description))
	}

	// What applying it actually does to the element.
	const binding = el("dl", { class: "bpmnkit-cc-detail__binding" })
	const pair = (term: string, value: string): void => {
		binding.append(el("dt", {}, term), el("dd", {}, value))
	}
	pair("Applies to", summary.appliesTo.join(", ") || "any element")
	if (template.elementType?.value !== undefined)
		pair("Converts element to", template.elementType.value)
	pair(
		"Implementation",
		summary.taskType !== undefined
			? `job worker · ${summary.taskType}`
			: `${summary.direction} · no job type`,
	)
	detail.append(binding)

	const required = section("Required inputs", summary.requiredInputs, true)
	if (required !== null) detail.append(required)
	const optional = section("Optional inputs", summary.optionalInputs, false)
	if (optional !== null) detail.append(optional)
	if (required === null && optional === null) {
		detail.append(el("div", { class: "bpmnkit-cc-empty" }, "This template asks for nothing."))
	}

	const actions = el("div", { class: "bpmnkit-cc-detail__actions" })
	if (template.documentationRef !== undefined) {
		const docs = el(
			"a",
			{
				class: "bpmnkit-cc-detail__docs",
				href: template.documentationRef,
				target: "_blank",
				rel: "noreferrer",
			},
			"Documentation",
		)
		actions.append(docs)
	}
	const apply = el("button", { class: "bpmnkit-cc-detail__apply", type: "button" }, "Apply")
	apply.addEventListener("click", onApply)
	actions.append(apply)
	detail.append(actions)

	return detail
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export class CatalogPanel {
	private readonly opts: CatalogPanelOptions
	private overlay: HTMLElement | null = null
	private activeTab: "builtin" | "community" = "builtin"
	private query = ""
	/** The worker being inspected, or null when the grid is showing. */
	private detail: ElementTemplate | null = null

	constructor(opts: CatalogPanelOptions) {
		this.opts = opts
	}

	open(): void {
		this.detail = null
		if (this.overlay) {
			this.overlay.style.display = "flex"
			const content = this.overlay.querySelector<HTMLElement>(".bpmnkit-cc-panel__content")
			if (content) this.renderContent(content)
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

		if (this.detail !== null) {
			container.append(
				renderDetail(
					this.detail,
					() => {
						const template = this.detail
						this.detail = null
						if (template !== null) this.opts.onUseBuiltin(template)
						this.close()
					},
					() => {
						this.detail = null
						this.renderContent(container)
					},
				),
			)
			return
		}

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
				renderBuiltinCard(
					template,
					(t) => {
						this.opts.onUseBuiltin(t)
						this.close()
					},
					(t) => {
						this.detail = t
						this.renderContent(container)
					},
				),
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
