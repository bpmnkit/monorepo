import { BpmnCanvas } from "@bpmn-sdk/canvas"
import { createTokenHighlightPlugin } from "@bpmn-sdk/plugins/token-highlight"
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

interface Config {
	proxyUrl: string
	profile: string | null
	interval: number
	mock: boolean
	theme: "light" | "dark"
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

export function createInstanceDetailView(
	instanceKey: string,
	instancesStore: InstancesStore,
	cfg: Config,
	onBack: () => void,
): {
	el: HTMLElement
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
	el.appendChild(breadcrumb)

	// Meta row
	const meta = document.createElement("div")
	meta.className = "op-instance-meta"
	el.appendChild(meta)

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
	layout.appendChild(sidebar)

	// Tabs in sidebar
	const tabs = ["Variables", "Incidents"]
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
	varPanel.className = "op-detail-panel"
	tabPanels.push(varPanel)
	sidebar.appendChild(varPanel)

	const incPanel = document.createElement("div")
	incPanel.className = "op-detail-panel"
	incPanel.style.display = "none"
	tabPanels.push(incPanel)
	sidebar.appendChild(incPanel)

	// Token-highlight plugin + canvas
	const tokenHighlight = createTokenHighlightPlugin()
	let canvas: BpmnCanvas | null = null

	function loadCanvas(xml: string): void {
		canvas?.destroy()
		canvasWrap.innerHTML = ""
		canvas = new BpmnCanvas({
			container: canvasWrap,
			xml,
			theme: cfg.theme,
			plugins: [tokenHighlight],
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
	}

	function renderVariables(vars: VariableResult[]): void {
		varPanel.innerHTML = ""
		if (vars.length === 0) {
			varPanel.innerHTML = `<div class="op-panel-empty">No variables</div>`
			return
		}
		const list = document.createElement("div")
		list.className = "op-var-list"
		for (const v of vars) {
			const row = document.createElement("div")
			row.className = "op-var-row"
			const name = document.createElement("span")
			name.className = "op-var-name"
			name.textContent = v.name
			row.appendChild(name)
			list.appendChild(row)
		}
		varPanel.appendChild(list)
	}

	// Incidents sub-store
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

	let instUnsub: () => void

	if (cfg.mock) {
		loadCanvas(MOCK_BPMN_XML)
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
			const pdKey = inst.processDefinitionKey
			fetch(`${cfg.proxyUrl}/api/process-definitions/${pdKey}/xml`, {
				headers: {
					accept: "text/xml",
					...(cfg.profile ? { "x-profile": cfg.profile } : {}),
				},
			})
				.then((r) => r.text())
				.then((xml) => {
					loadCanvas(xml)
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
				.then((result: { items: VariableResult[] }) => renderVariables(result.items))
				.catch(() => renderVariables([]))
		}

		// Try immediately if store already has data; otherwise wait for first poll.
		const existing = getInstance()
		if (existing) startXmlFetch(existing)

		instUnsub = instancesStore.subscribe(() => {
			const inst = getInstance()
			if (inst) startXmlFetch(inst)
			renderMeta(inst)
		})
	}

	renderIncidents()

	return {
		el,
		destroy(): void {
			canvas?.destroy()
			instUnsub()
			incUnsub()
			incStore.destroy()
		},
	}
}
