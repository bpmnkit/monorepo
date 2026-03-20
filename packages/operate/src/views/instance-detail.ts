import type { CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { createTokenHighlightPlugin } from "@bpmnkit/plugins/token-highlight"
import { badge } from "../components/badge.js"
import {
	MOCK_ACTIVE_ELEMENTS,
	MOCK_BPMN_XML,
	MOCK_VARIABLES,
	MOCK_VISITED_ELEMENTS,
} from "../mock-data.js"
import { IncidentsStore } from "../stores/incidents.js"
import type { InstancesStore } from "../stores/instances.js"
import type { ProcessInstanceResult, VariableResult } from "../types.js"

type VarItem = VariableResult & { value?: string }
type VarType = "string" | "number" | "boolean" | "json" | "null"

interface Config {
	proxyUrl: string
	profile: string | null
	interval: number
	mock: boolean
	theme: "light" | "dark" | "neon"
	navigate?: (path: string) => void
	onOpenInEditor?: (xml: string, name: string) => void
}

function relTime(iso: string | null | undefined): string {
	if (!iso) return "—"
	const diff = Date.now() - new Date(iso).getTime()
	const m = Math.floor(diff / 60_000)
	if (m < 1) return "just now"
	if (m < 60) return `${m}m ago`
	const h = Math.floor(m / 60)
	if (h < 24) return `${h}h ago`
	return `${Math.floor(h / 24)}d ago`
}

function detectType(value: string | undefined): VarType {
	if (!value || value === "null") return "null"
	if (value === "true" || value === "false") return "boolean"
	if (value.trim() !== "" && !Number.isNaN(Number(value))) return "number"
	const trimmed = value.trim()
	if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
		try {
			JSON.parse(value)
			return "json"
		} catch {
			// not valid json
		}
	}
	return "string"
}

function buildJsonDom(container: HTMLElement, value: unknown, indent: number): void {
	const pad = "  ".repeat(indent)
	if (value === null) {
		const s = document.createElement("span")
		s.className = "op-json-null"
		s.textContent = "null"
		container.appendChild(s)
	} else if (typeof value === "boolean") {
		const s = document.createElement("span")
		s.className = "op-json-bool"
		s.textContent = String(value)
		container.appendChild(s)
	} else if (typeof value === "number") {
		const s = document.createElement("span")
		s.className = "op-json-number"
		s.textContent = String(value)
		container.appendChild(s)
	} else if (typeof value === "string") {
		const s = document.createElement("span")
		s.className = "op-json-string"
		s.textContent = JSON.stringify(value)
		container.appendChild(s)
	} else if (Array.isArray(value)) {
		container.appendChild(document.createTextNode("[\n"))
		for (let i = 0; i < value.length; i++) {
			container.appendChild(document.createTextNode(`${pad}  `))
			buildJsonDom(container, value[i], indent + 1)
			container.appendChild(document.createTextNode(i < value.length - 1 ? ",\n" : "\n"))
		}
		container.appendChild(document.createTextNode(`${pad}]`))
	} else if (typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
		container.appendChild(document.createTextNode("{\n"))
		for (let i = 0; i < entries.length; i++) {
			const entry = entries[i]
			if (!entry) continue
			const [k, v] = entry
			container.appendChild(document.createTextNode(`${pad}  `))
			const keySpan = document.createElement("span")
			keySpan.className = "op-json-key"
			keySpan.textContent = JSON.stringify(k)
			container.appendChild(keySpan)
			container.appendChild(document.createTextNode(": "))
			buildJsonDom(container, v, indent + 1)
			container.appendChild(document.createTextNode(i < entries.length - 1 ? ",\n" : "\n"))
		}
		container.appendChild(document.createTextNode(`${pad}}`))
	}
}

function highlightTextNodes(container: HTMLElement, query: string): void {
	if (!query) return
	const lower = query.toLowerCase()
	const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
	const hits: Array<{ parent: Node; node: Text }> = []
	let node = walker.nextNode()
	while (node) {
		const t = node as Text
		if ((t.textContent ?? "").toLowerCase().includes(lower) && t.parentNode) {
			hits.push({ parent: t.parentNode, node: t })
		}
		node = walker.nextNode()
	}
	for (const { parent, node: t } of hits) {
		const text = t.textContent ?? ""
		const lowerText = text.toLowerCase()
		const fragment = document.createDocumentFragment()
		let last = 0
		let idx = lowerText.indexOf(lower, 0)
		while (idx !== -1) {
			if (idx > last) fragment.appendChild(document.createTextNode(text.slice(last, idx)))
			const mark = document.createElement("mark")
			mark.className = "op-json-match"
			mark.textContent = text.slice(idx, idx + query.length)
			fragment.appendChild(mark)
			last = idx + query.length
			idx = lowerText.indexOf(lower, last)
		}
		if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)))
		parent.replaceChild(fragment, t)
	}
}

export function createInstanceDetailView(
	instanceKey: string,
	instancesStore: InstancesStore,
	cfg: Config,
	onBack: () => void,
): {
	el: HTMLElement
	setTheme(t: "light" | "dark" | "neon"): void
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-instance-detail"

	// Breadcrumb
	const breadcrumb = document.createElement("div")
	breadcrumb.className = "op-breadcrumb"
	const backBtn = document.createElement("button")
	backBtn.className = "op-back-btn"
	backBtn.textContent = "← Instances"
	backBtn.addEventListener("click", onBack)
	breadcrumb.appendChild(backBtn)

	let _openInEditorXml: string | null = null
	let _openInEditorName = ""
	const openInEditorBtn = document.createElement("button")
	openInEditorBtn.className = "op-action-btn"
	openInEditorBtn.textContent = "Open in Editor ↗"
	openInEditorBtn.style.marginLeft = "auto"
	openInEditorBtn.style.display = "none"
	openInEditorBtn.addEventListener("click", () => {
		if (_openInEditorXml) cfg.onOpenInEditor?.(_openInEditorXml, _openInEditorName)
	})
	if (cfg.onOpenInEditor) breadcrumb.appendChild(openInEditorBtn)

	el.appendChild(breadcrumb)

	// Process hierarchy chain (shown for sub-process instances)
	const processChainEl = document.createElement("div")
	processChainEl.className = "op-process-chain"
	el.appendChild(processChainEl)

	// Meta row
	const meta = document.createElement("div")
	meta.className = "op-instance-meta"
	el.appendChild(meta)

	const cancelFeedback = document.createElement("div")
	cancelFeedback.className = "op-action-feedback"
	cancelFeedback.style.display = "none"
	el.appendChild(cancelFeedback)

	// Canvas + sidebar layout
	const layout = document.createElement("div")
	layout.className = "op-detail-layout"
	el.appendChild(layout)

	// Canvas pane
	const canvasWrap = document.createElement("div")
	canvasWrap.className = "op-detail-canvas"
	layout.appendChild(canvasWrap)

	// Sidebar pane
	const sidebar = document.createElement("div")
	sidebar.className = "op-detail-sidebar"
	sidebar.dataset.bpmnkitHudTheme = cfg.theme
	layout.appendChild(sidebar)

	// Tabs in sidebar
	const tabs = ["Variables", "Incidents", "Properties"]
	const tabBar = document.createElement("div")
	tabBar.className = "op-detail-tabs"
	const tabPanels: HTMLElement[] = []
	let activeTab = 0

	for (let i = 0; i < tabs.length; i++) {
		const btn = document.createElement("button")
		btn.className = `op-detail-tab${i === 0 ? " op-detail-tab--active" : ""}`
		btn.textContent = tabs[i] ?? ""
		const idx = i
		btn.addEventListener("click", () => {
			activeTab = idx
			for (let j = 0; j < tabs.length; j++) {
				const tabEl = tabBar.children[j]
				const panelEl = tabPanels[j]
				if (tabEl) {
					if (j === activeTab) tabEl.classList.add("op-detail-tab--active")
					else tabEl.classList.remove("op-detail-tab--active")
				}
				if (panelEl) {
					panelEl.style.display = j === activeTab ? "" : "none"
				}
			}
		})
		tabBar.appendChild(btn)
	}
	sidebar.appendChild(tabBar)

	const varPanel = document.createElement("div")
	varPanel.className = "op-detail-panel op-var-panel"
	tabPanels.push(varPanel)
	sidebar.appendChild(varPanel)

	const incPanel = document.createElement("div")
	incPanel.className = "op-detail-panel"
	incPanel.style.display = "none"
	tabPanels.push(incPanel)
	sidebar.appendChild(incPanel)

	const propsPane = document.createElement("div")
	propsPane.className = "op-detail-panel op-props-pane"
	propsPane.style.display = "none"
	tabPanels.push(propsPane)
	sidebar.appendChild(propsPane)

	const propsPlaceholder = document.createElement("div")
	propsPlaceholder.className = "op-props-placeholder"
	propsPlaceholder.textContent = "Click an element to view its properties"
	propsPane.appendChild(propsPlaceholder)

	// Config panel (read-only: applyChange is a no-op)
	let latestDefs: BpmnDefinitions | null = null
	const configPanel = createConfigPanelPlugin({
		getDefinitions: () => latestDefs,
		applyChange: () => {},
		container: propsPane,
		readonly: true,
		onPanelShow: () => {
			propsPlaceholder.style.display = "none"
		},
		onPanelHide: () => {
			propsPlaceholder.style.display = ""
		},
	})
	const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel)
	const bridgePlugin: CanvasPlugin = {
		name: "op-select-bridge",
		install(api) {
			type AnyEmit = (event: string, ...args: unknown[]) => void
			const emit = api.emit.bind(api) as unknown as AnyEmit
			api.on("element:click", (id) => emit("editor:select", [id]))
			api.on("diagram:load", (defs) => {
				latestDefs = defs
			})
		},
	}

	// Token-highlight plugin + canvas
	const tokenHighlight = createTokenHighlightPlugin()
	let canvas: BpmnCanvas | null = null

	function loadCanvas(xml: string, name: string): void {
		_openInEditorXml = xml
		_openInEditorName = name
		openInEditorBtn.style.display = ""
		canvas?.destroy()
		canvasWrap.innerHTML = ""
		canvas = new BpmnCanvas({
			container: canvasWrap,
			xml,
			theme: cfg.theme,
			plugins: [tokenHighlight, bridgePlugin, configPanel, configPanelBpmn],
		})
	}

	function applyTokens(activeIds: string[], visitedIds: string[]): void {
		tokenHighlight.api.setActive(activeIds)
		tokenHighlight.api.addVisited(visitedIds)
	}

	// Instance lookup
	function getInstance(): ProcessInstanceResult | null {
		return (
			instancesStore.state.data?.items.find((i) => i.processInstanceKey === instanceKey) ?? null
		)
	}

	function renderMeta(inst: ProcessInstanceResult | null): void {
		meta.innerHTML = ""
		cancelFeedback.style.display = "none"
		if (!inst) return
		const key = document.createElement("span")
		key.className = "op-instance-key"
		key.textContent = inst.processInstanceKey
		meta.appendChild(key)
		meta.appendChild(badge(inst.state))
		if (inst.businessId) {
			const biz = document.createElement("span")
			biz.className = "op-instance-biz"
			biz.textContent = inst.businessId
			meta.appendChild(biz)
		}
		const started = document.createElement("span")
		started.className = "op-instance-time"
		started.textContent = `Started ${relTime(inst.startDate)}`
		meta.appendChild(started)

		if (inst.state === "ACTIVE") {
			const cancelBtn = document.createElement("button")
			cancelBtn.className = "op-action-btn op-action-btn--danger"
			cancelBtn.textContent = "✕ Cancel"
			cancelBtn.style.marginLeft = "auto"
			cancelBtn.addEventListener("click", () => {
				if (cancelBtn.dataset.confirm !== "true") {
					cancelBtn.dataset.confirm = "true"
					cancelBtn.textContent = "Confirm Cancel?"
					cancelBtn.style.fontWeight = "700"
					setTimeout(() => {
						if (cancelBtn.dataset.confirm === "true") {
							cancelBtn.dataset.confirm = ""
							cancelBtn.textContent = "✕ Cancel"
							cancelBtn.style.fontWeight = ""
						}
					}, 4000)
					return
				}
				cancelBtn.disabled = true
				cancelBtn.textContent = "Cancelling…"
				if (cfg.mock) {
					cancelFeedback.textContent = "Mock mode — cancel not sent to server."
					cancelFeedback.className = "op-action-feedback op-action-feedback--ok"
					cancelFeedback.style.display = ""
					return
				}
				const headers: Record<string, string> = { "Content-Type": "application/json" }
				if (cfg.profile) headers["x-profile"] = cfg.profile
				fetch(`${cfg.proxyUrl}/api/process-instances/${instanceKey}/cancellation`, {
					method: "POST",
					headers,
					body: JSON.stringify({}),
				})
					.then((r) => {
						if (r.ok || r.status === 204) {
							cancelFeedback.textContent = "Instance cancelled."
							cancelFeedback.className = "op-action-feedback op-action-feedback--ok"
						} else {
							cancelFeedback.textContent = `Error: ${r.status}`
							cancelFeedback.className = "op-action-feedback op-action-feedback--err"
							cancelBtn.disabled = false
							cancelBtn.textContent = "✕ Cancel"
						}
						cancelFeedback.style.display = ""
					})
					.catch((err: unknown) => {
						cancelFeedback.textContent = String(err)
						cancelFeedback.className = "op-action-feedback op-action-feedback--err"
						cancelFeedback.style.display = ""
						cancelBtn.disabled = false
						cancelBtn.textContent = "✕ Cancel"
					})
			})
			meta.appendChild(cancelBtn)
		}
	}

	// ── Process chain ────────────────────────────────────────────────────────

	function renderProcessChain(segments: Array<{ name: string; instanceKey: string }>): void {
		processChainEl.innerHTML = ""
		for (let i = 0; i < segments.length; i++) {
			const seg = segments[i]
			if (!seg) continue
			if (i > 0) {
				const sep = document.createElement("span")
				sep.className = "op-process-chain-sep"
				sep.textContent = " / "
				processChainEl.appendChild(sep)
			}
			const btn = document.createElement("button")
			btn.className = "op-process-chain-link"
			btn.textContent = seg.name
			if (cfg.navigate) {
				const key = seg.instanceKey
				btn.addEventListener("click", () => cfg.navigate?.(`/instances/${key}`))
			} else {
				btn.disabled = true
			}
			processChainEl.appendChild(btn)
		}
	}

	async function fetchProcessChain(startKey: string): Promise<void> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile
		const chain: Array<{ name: string; instanceKey: string }> = []
		let key: string | null = startKey
		const seen = new Set<string>()
		while (key && !seen.has(key)) {
			seen.add(key)
			try {
				const r = await fetch(`${cfg.proxyUrl}/api/process-instances/${key}`, { headers })
				if (!r.ok) break
				const inst = (await r.json()) as ProcessInstanceResult
				chain.unshift({
					name: inst.processDefinitionName ?? inst.processDefinitionId,
					instanceKey: inst.processInstanceKey,
				})
				key = inst.parentProcessInstanceKey || null
			} catch {
				break
			}
		}
		if (chain.length > 1) renderProcessChain(chain)
	}

	// ── Variables panel ──────────────────────────────────────────────────────

	let allVars: VarItem[] = []
	let varSortDir: "asc" | "desc" = "asc"
	let varTypeFilter: VarType | "all" = "all"
	let varSearch = ""
	let varPanelBuilt = false
	let varListEl: HTMLElement | null = null
	let varSortBtn: HTMLButtonElement | null = null
	const varTypeBtns = new Map<VarType | "all", HTMLButtonElement>()

	function showVarModal(name: string, value: string): void {
		const overlay = document.createElement("div")
		overlay.className = "op-modal-overlay"

		const dialog = document.createElement("div")
		dialog.className = "op-modal"

		const header = document.createElement("div")
		header.className = "op-modal-header"

		const title = document.createElement("span")
		title.className = "op-modal-title"
		title.textContent = name
		header.appendChild(title)

		const modalSearch = document.createElement("input")
		modalSearch.type = "search"
		modalSearch.className = "op-modal-search-input"
		modalSearch.placeholder = "Search…"
		header.appendChild(modalSearch)

		const closeBtn = document.createElement("button")
		closeBtn.className = "op-modal-close"
		closeBtn.textContent = "✕"
		closeBtn.addEventListener("click", () => overlay.remove())
		header.appendChild(closeBtn)

		const pre = document.createElement("pre")
		pre.className = "op-modal-body"

		let parsed: unknown = null
		let isJson = false
		try {
			parsed = JSON.parse(value)
			if (typeof parsed === "object" && parsed !== null) isJson = true
		} catch {
			// plain text
		}

		function renderModalContent(query: string): void {
			pre.textContent = ""
			if (isJson) {
				buildJsonDom(pre, parsed, 0)
			} else {
				pre.textContent = value
			}
			if (query) highlightTextNodes(pre, query)
		}

		modalSearch.addEventListener("input", () => renderModalContent(modalSearch.value))
		renderModalContent("")

		dialog.appendChild(header)
		dialog.appendChild(pre)
		overlay.appendChild(dialog)
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) overlay.remove()
		})
		el.appendChild(overlay)
		setTimeout(() => modalSearch.focus(), 0)
	}

	function renderVarRows(): void {
		if (!varListEl) return
		varListEl.innerHTML = ""

		let vars = [...allVars]
		vars.sort((a, b) => {
			const cmp = a.name.localeCompare(b.name)
			return varSortDir === "asc" ? cmp : -cmp
		})
		if (varTypeFilter !== "all") {
			vars = vars.filter((v) => detectType(v.value) === varTypeFilter)
		}
		if (varSearch) {
			const q = varSearch.toLowerCase()
			vars = vars.filter(
				(v) => v.name.toLowerCase().includes(q) || (v.value ?? "").toLowerCase().includes(q),
			)
		}

		if (vars.length === 0) {
			const empty = document.createElement("div")
			empty.className = "op-panel-empty"
			empty.textContent = "No matches"
			varListEl.appendChild(empty)
			return
		}

		for (const v of vars) {
			const row = document.createElement("div")
			row.className = "op-var-row"

			const name = document.createElement("span")
			name.className = "op-var-name"
			name.textContent = v.name
			row.appendChild(name)

			const type = detectType(v.value)
			const typeBadge = document.createElement("span")
			typeBadge.className = `op-var-type op-var-type--${type}`
			typeBadge.textContent =
				type === "json" ? "{}" : type === "string" ? '""' : type === "null" ? "∅" : type
			row.appendChild(typeBadge)

			const val = document.createElement("span")
			val.className = "op-var-value"
			val.textContent = v.value ?? "—"
			row.appendChild(val)

			if (v.value) {
				row.classList.add("op-var-row--clickable")
				row.title = "Click to expand"
				row.addEventListener("click", () => showVarModal(v.name, v.value ?? ""))
			}

			varListEl.appendChild(row)
		}
	}

	function buildVarHeader(): void {
		const controls = document.createElement("div")
		controls.className = "op-var-controls"

		// Sort + type filter row
		const row = document.createElement("div")
		row.className = "op-var-controls-row"

		const sortBtn = document.createElement("button")
		sortBtn.className = "op-var-sort-btn"
		sortBtn.textContent = "↑ Name"
		sortBtn.addEventListener("click", () => {
			varSortDir = varSortDir === "asc" ? "desc" : "asc"
			sortBtn.textContent = varSortDir === "asc" ? "↑ Name" : "↓ Name"
			renderVarRows()
		})
		varSortBtn = sortBtn
		row.appendChild(sortBtn)

		const sep = document.createElement("span")
		sep.className = "op-var-controls-sep"
		row.appendChild(sep)

		const typeOpts: Array<{ label: string; value: VarType | "all" }> = [
			{ label: "All", value: "all" },
			{ label: "str", value: "string" },
			{ label: "num", value: "number" },
			{ label: "bool", value: "boolean" },
			{ label: "{}", value: "json" },
			{ label: "null", value: "null" },
		]
		for (const opt of typeOpts) {
			const btn = document.createElement("button")
			btn.className = `op-var-type-btn${varTypeFilter === opt.value ? " op-var-type-btn--active" : ""}`
			btn.textContent = opt.label
			btn.addEventListener("click", () => {
				varTypeFilter = opt.value
				for (const [, b] of varTypeBtns) b.classList.remove("op-var-type-btn--active")
				btn.classList.add("op-var-type-btn--active")
				renderVarRows()
			})
			varTypeBtns.set(opt.value, btn)
			row.appendChild(btn)
		}
		controls.appendChild(row)

		const searchInput = document.createElement("input")
		searchInput.type = "search"
		searchInput.className = "op-search"
		searchInput.placeholder = "Search variables…"
		searchInput.value = varSearch
		searchInput.addEventListener("input", () => {
			varSearch = searchInput.value
			renderVarRows()
		})
		controls.appendChild(searchInput)

		varPanel.appendChild(controls)

		const list = document.createElement("div")
		list.className = "op-var-list"
		varListEl = list
		varPanel.appendChild(list)
	}

	function deduplicateVars(vars: VarItem[]): VarItem[] {
		const map = new Map<string, VarItem>()
		for (const v of vars) {
			const existing = map.get(v.name)
			if (!existing || BigInt(v.variableKey) > BigInt(existing.variableKey)) {
				map.set(v.name, v)
			}
		}
		return Array.from(map.values())
	}

	function renderVariables(vars: VarItem[]): void {
		allVars = deduplicateVars(vars)
		if (!varPanelBuilt) {
			varPanel.innerHTML = ""
			if (vars.length === 0) {
				varPanel.innerHTML = `<div class="op-panel-empty">No variables</div>`
				return
			}
			buildVarHeader()
			varPanelBuilt = true
		} else if (varSortBtn) {
			// Update sort button text in case direction was preserved
			varSortBtn.textContent = varSortDir === "asc" ? "↑ Name" : "↓ Name"
		}
		renderVarRows()
	}

	// ── Incidents sub-store ──────────────────────────────────────────────────

	const incStore = new IncidentsStore()
	incStore.connect(cfg.proxyUrl, cfg.profile, cfg.interval, cfg.mock, instanceKey)

	function renderIncidents(): void {
		incPanel.innerHTML = ""
		const items = incStore.state.data?.items ?? []
		if (items.length === 0) {
			incPanel.innerHTML = `<div class="op-panel-empty">No incidents</div>`
			return
		}
		for (const inc of items) {
			const row = document.createElement("div")
			row.className = "op-incident-row"
			const type = document.createElement("span")
			type.className = "op-incident-type"
			type.textContent = inc.errorType ?? "UNKNOWN"
			row.appendChild(type)
			const msg = document.createElement("span")
			msg.className = "op-incident-msg"
			msg.textContent = inc.errorMessage ?? "—"
			row.appendChild(msg)
			row.appendChild(badge(inc.state ?? "UNKNOWN"))
			incPanel.appendChild(row)
		}
	}

	const incUnsub = incStore.subscribe(renderIncidents)

	// ── Instance data loading ────────────────────────────────────────────────

	let instUnsub: () => void

	if (cfg.mock) {
		loadCanvas(MOCK_BPMN_XML, "Order Processing")
		applyTokens(MOCK_ACTIVE_ELEMENTS, MOCK_VISITED_ELEMENTS)
		renderVariables(MOCK_VARIABLES.filter((v) => v.processInstanceKey === instanceKey))
		setTimeout(() => applyTokens(MOCK_ACTIVE_ELEMENTS, MOCK_VISITED_ELEMENTS), 100)
		const mockInst = {
			processInstanceKey: instanceKey,
			processDefinitionKey: "pd-1",
			processDefinitionId: "order-process",
			processDefinitionName: "Order Processing",
			state: "ACTIVE",
			hasIncident: false,
			businessId: "ORD-10042",
			startDate: new Date(Date.now() - 2 * 3_600_000).toISOString(),
			endDate: null,
		} as ProcessInstanceResult
		renderMeta(mockInst)
		instUnsub = instancesStore.subscribe(() => renderMeta(getInstance()))
	} else {
		let xmlStarted = false

		function startXmlFetch(inst: ProcessInstanceResult): void {
			if (xmlStarted) return
			xmlStarted = true
			renderMeta(inst)
			fetchProcessChain(inst.processInstanceKey).catch(() => {})
			const pdKey = inst.processDefinitionKey
			const instName = inst.processDefinitionName ?? inst.processDefinitionId ?? "Process"
			fetch(`${cfg.proxyUrl}/api/process-definitions/${pdKey}/xml`, {
				headers: {
					accept: "text/xml",
					...(cfg.profile ? { "x-profile": cfg.profile } : {}),
				},
			})
				.then((r) => r.text())
				.then((xml) => {
					loadCanvas(xml, instName)
					return fetch(`${cfg.proxyUrl}/api/element-instances/search`, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							...(cfg.profile ? { "x-profile": cfg.profile } : {}),
						},
						body: JSON.stringify({ filter: { processInstanceKey: instanceKey } }),
					})
				})
				.then((r) => r.json())
				.then((result: { items: Array<{ elementId: string; state: string }> }) => {
					const activeIds = result.items.filter((e) => e.state === "ACTIVE").map((e) => e.elementId)
					const visitedIds = result.items
						.filter((e) => e.state !== "ACTIVE")
						.map((e) => e.elementId)
					applyTokens(activeIds, visitedIds)
				})
				.catch(() => {
					// canvas still shows without tokens
				})

			fetch(`${cfg.proxyUrl}/api/variables/search`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					...(cfg.profile ? { "x-profile": cfg.profile } : {}),
				},
				body: JSON.stringify({ filter: { processInstanceKey: instanceKey } }),
			})
				.then((r) => r.json())
				.then((result: { items: VarItem[] }) => renderVariables(result.items))
				.catch(() => renderVariables([]))
		}

		// Try immediately if store already has data
		const existing = getInstance()
		if (existing) {
			startXmlFetch(existing)
		} else {
			// Deep-link: instance not in store yet — fetch it directly
			fetch(`${cfg.proxyUrl}/api/process-instances/${instanceKey}`, {
				headers: { ...(cfg.profile ? { "x-profile": cfg.profile } : {}) },
			})
				.then((r) => (r.ok ? r.json() : null))
				.then((inst: ProcessInstanceResult | null) => {
					if (inst && !xmlStarted) startXmlFetch(inst)
				})
				.catch(() => {})
		}

		instUnsub = instancesStore.subscribe(() => {
			const inst = getInstance()
			if (inst) startXmlFetch(inst)
			renderMeta(inst)
		})
	}

	renderIncidents()

	return {
		el,
		setTheme(t: "light" | "dark" | "neon"): void {
			canvas?.setTheme(t)
			sidebar.dataset.bpmnkitHudTheme = t
		},
		destroy(): void {
			canvas?.destroy()
			instUnsub()
			incUnsub()
			incStore.destroy()
		},
	}
}
