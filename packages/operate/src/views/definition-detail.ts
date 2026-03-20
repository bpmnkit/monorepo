import type { CanvasPlugin } from "@bpmnkit/canvas"
import { BpmnCanvas } from "@bpmnkit/canvas"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { createConfigPanelPlugin } from "@bpmnkit/plugins/config-panel"
import { createConfigPanelBpmnPlugin } from "@bpmnkit/plugins/config-panel-bpmn"
import { MOCK_BPMN_XML } from "../mock-data.js"
import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
	theme: "light" | "dark" | "neon"
	navigate?: (path: string) => void
	onOpenInEditor?: (xml: string, name: string) => void
}

function parseVariables(raw: string): Record<string, unknown> | null {
	const trimmed = raw.trim()
	if (!trimmed) return null
	try {
		const parsed: unknown = JSON.parse(trimmed)
		if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
			return parsed as Record<string, unknown>
		}
		return null
	} catch {
		return null
	}
}

export function createDefinitionDetailView(
	definitionKey: string,
	store: DefinitionsStore,
	cfg: Config,
	onBack: () => void,
): {
	el: HTMLElement
	setTheme(t: "light" | "dark" | "neon"): void
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-def-detail"

	// Breadcrumb
	const breadcrumb = document.createElement("div")
	breadcrumb.className = "op-breadcrumb"
	const backBtn = document.createElement("button")
	backBtn.className = "op-back-btn"
	backBtn.textContent = "← Processes"
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

	// Metadata row
	const meta = document.createElement("div")
	meta.className = "op-def-meta"
	el.appendChild(meta)

	// Canvas + sidebar layout
	const layout = document.createElement("div")
	layout.className = "op-detail-layout"
	el.appendChild(layout)

	const canvasWrap = document.createElement("div")
	canvasWrap.className = "op-detail-canvas"
	layout.appendChild(canvasWrap)

	const sidebar = document.createElement("div")
	sidebar.className = "op-detail-sidebar"
	sidebar.dataset.bpmnkitHudTheme = cfg.theme
	layout.appendChild(sidebar)

	const tabBar = document.createElement("div")
	tabBar.className = "op-detail-tabs"
	const propsTabBtn = document.createElement("button")
	propsTabBtn.className = "op-detail-tab op-detail-tab--active"
	propsTabBtn.textContent = "Properties"
	tabBar.appendChild(propsTabBtn)
	sidebar.appendChild(tabBar)

	const propsPane = document.createElement("div")
	propsPane.className = "op-detail-panel op-props-pane"
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

	let canvas: BpmnCanvas | null = null

	function getDef(): ProcessDefinitionResult | null {
		return store.state.data?.items.find((d) => d.processDefinitionKey === definitionKey) ?? null
	}

	function getVersions(): ProcessDefinitionResult[] {
		const def = getDef()
		if (!def) return []
		const id = def.processDefinitionId
		return (store.state.data?.items ?? [])
			.filter((d) => d.processDefinitionId === id)
			.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
	}

	function renderMeta(def: ProcessDefinitionResult | null): void {
		meta.innerHTML = ""
		if (!def) return
		const name = document.createElement("span")
		name.className = "op-def-meta-name"
		name.textContent = def.name ?? def.processDefinitionId ?? "—"
		meta.appendChild(name)

		const versions = getVersions()
		if (versions.length > 1 && cfg.navigate) {
			const select = document.createElement("select")
			select.className = "op-version-select"
			for (const v of versions) {
				const opt = document.createElement("option")
				opt.value = v.processDefinitionKey ?? ""
				opt.textContent = `v${v.version ?? "?"}${v.versionTag ? ` (${v.versionTag})` : ""}`
				opt.selected = v.processDefinitionKey === definitionKey
				select.appendChild(opt)
			}
			select.addEventListener("change", () => {
				cfg.navigate?.(`/definitions/${select.value}`)
			})
			meta.appendChild(select)
		} else {
			const ver = document.createElement("span")
			ver.className = "op-def-meta-version"
			ver.textContent = `v${def.version ?? "?"}${def.versionTag ? ` · ${def.versionTag}` : ""}`
			meta.appendChild(ver)
		}

		if (def.tenantId) {
			const tenant = document.createElement("span")
			tenant.className = "op-def-meta-version"
			tenant.textContent = `tenant: ${def.tenantId}`
			meta.appendChild(tenant)
		}
		const key = document.createElement("span")
		key.className = "op-instance-key"
		key.textContent = def.processDefinitionKey ?? ""
		meta.appendChild(key)

		const startBtn = document.createElement("button")
		startBtn.className = "op-action-btn op-action-btn--primary"
		startBtn.textContent = "▶ Start Instance"
		startBtn.style.marginLeft = "auto"
		startBtn.addEventListener("click", () => showStartModal(def))
		meta.appendChild(startBtn)
	}

	function showStartModal(def: ProcessDefinitionResult): void {
		const overlay = document.createElement("div")
		overlay.className = "op-modal-overlay"

		const dialog = document.createElement("div")
		dialog.className = "op-modal op-modal--form"

		const header = document.createElement("div")
		header.className = "op-modal-header"
		const titleEl = document.createElement("span")
		titleEl.className = "op-modal-title"
		titleEl.textContent = `Start — ${def.name ?? def.processDefinitionId ?? definitionKey}`
		header.appendChild(titleEl)
		const closeBtn = document.createElement("button")
		closeBtn.className = "op-modal-close"
		closeBtn.textContent = "✕"
		closeBtn.addEventListener("click", () => overlay.remove())
		header.appendChild(closeBtn)

		const body = document.createElement("div")
		body.className = "op-modal-form-body"

		const bizGroup = document.createElement("div")
		bizGroup.className = "op-form-group"
		const bizLabel = document.createElement("label")
		bizLabel.className = "op-form-label"
		bizLabel.textContent = "Business ID"
		const bizInput = document.createElement("input")
		bizInput.type = "text"
		bizInput.className = "op-form-input"
		bizInput.placeholder = "Optional unique identifier (e.g. ORD-10050)"
		bizGroup.appendChild(bizLabel)
		bizGroup.appendChild(bizInput)
		body.appendChild(bizGroup)

		const varsGroup = document.createElement("div")
		varsGroup.className = "op-form-group"
		const varsLabel = document.createElement("label")
		varsLabel.className = "op-form-label"
		varsLabel.textContent = "Variables"
		const varsInput = document.createElement("textarea")
		varsInput.className = "op-form-textarea"
		varsInput.placeholder = '{"orderId": "ORD-10050", "amount": 49.99}'
		varsInput.rows = 5
		const varsHint = document.createElement("span")
		varsHint.className = "op-form-hint"
		varsHint.textContent = "Optional JSON object of initial process variables."
		varsGroup.appendChild(varsLabel)
		varsGroup.appendChild(varsInput)
		varsGroup.appendChild(varsHint)
		body.appendChild(varsGroup)

		const footer = document.createElement("div")
		footer.className = "op-modal-form-footer"

		const errorEl = document.createElement("div")
		errorEl.className = "op-form-error"
		errorEl.style.display = "none"
		footer.appendChild(errorEl)

		const feedbackEl = document.createElement("div")
		feedbackEl.className = "op-action-feedback"
		feedbackEl.style.display = "none"
		footer.appendChild(feedbackEl)

		const cancelBtn = document.createElement("button")
		cancelBtn.className = "op-action-btn"
		cancelBtn.textContent = "Cancel"
		cancelBtn.style.marginLeft = "auto"
		cancelBtn.addEventListener("click", () => overlay.remove())
		footer.appendChild(cancelBtn)

		const submitBtn = document.createElement("button")
		submitBtn.className = "op-action-btn op-action-btn--primary"
		submitBtn.textContent = "▶ Start"
		footer.appendChild(submitBtn)

		submitBtn.addEventListener("click", () => {
			errorEl.style.display = "none"
			const bizId = bizInput.value.trim()
			const varsRaw = varsInput.value.trim()
			let vars: Record<string, unknown> | null = null
			if (varsRaw) {
				vars = parseVariables(varsRaw)
				if (!vars) {
					errorEl.textContent = "Variables must be a valid JSON object."
					errorEl.style.display = ""
					return
				}
			}

			if (cfg.mock) {
				feedbackEl.textContent = "Mock mode — instance not created on server."
				feedbackEl.className = "op-action-feedback op-action-feedback--ok"
				feedbackEl.style.display = ""
				submitBtn.style.display = "none"
				cancelBtn.textContent = "Close"
				return
			}

			submitBtn.disabled = true
			cancelBtn.disabled = true
			submitBtn.textContent = "Starting…"

			const body2: Record<string, unknown> = { processDefinitionKey: definitionKey }
			if (bizId) body2.businessId = bizId
			if (vars) body2.variables = vars

			const headers: Record<string, string> = { "Content-Type": "application/json" }
			if (cfg.profile) headers["x-profile"] = cfg.profile

			fetch(`${cfg.proxyUrl}/api/process-instances`, {
				method: "POST",
				headers,
				body: JSON.stringify(body2),
			})
				.then((r) =>
					r.ok
						? r.json()
						: r.text().then((msg) => {
								throw new Error(`${r.status}: ${msg}`)
							}),
				)
				.then((result: { processInstanceKey: string }) => {
					const instKey = result.processInstanceKey
					feedbackEl.innerHTML = ""
					feedbackEl.textContent = `Instance created: ${instKey}`
					if (cfg.navigate) {
						const link = document.createElement("button")
						link.className = "op-back-btn"
						link.textContent = " → View Instance"
						link.style.marginLeft = "8px"
						const key = instKey
						link.addEventListener("click", () => {
							overlay.remove()
							cfg.navigate?.(`/instances/${key}`)
						})
						feedbackEl.appendChild(link)
					}
					feedbackEl.className = "op-action-feedback op-action-feedback--ok"
					feedbackEl.style.display = ""
					submitBtn.style.display = "none"
					cancelBtn.disabled = false
					cancelBtn.textContent = "Close"
				})
				.catch((err: unknown) => {
					errorEl.textContent = String(err)
					errorEl.style.display = ""
					submitBtn.disabled = false
					cancelBtn.disabled = false
					submitBtn.textContent = "▶ Start"
				})
		})

		dialog.appendChild(header)
		dialog.appendChild(body)
		dialog.appendChild(footer)
		overlay.appendChild(dialog)
		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) overlay.remove()
		})
		el.appendChild(overlay)
		setTimeout(() => bizInput.focus(), 0)
	}

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
			plugins: [bridgePlugin, configPanel, configPanelBpmn],
		})
	}

	if (cfg.mock) {
		const def = getDef()
		renderMeta(def)
		const mockName = def?.name ?? def?.processDefinitionId ?? "Process"
		loadCanvas(MOCK_BPMN_XML, mockName)
	} else {
		const def = getDef()
		renderMeta(def)
		const defName = def?.name ?? def?.processDefinitionId ?? "Process"
		fetch(`${cfg.proxyUrl}/api/process-definitions/${definitionKey}/xml`, {
			headers: {
				accept: "text/xml",
				...(cfg.profile ? { "x-profile": cfg.profile } : {}),
			},
		})
			.then((r) => r.text())
			.then((xml) => loadCanvas(xml, defName))
			.catch(() => {
				canvasWrap.innerHTML = `<div style="padding:24px;color:var(--bpmnkit-fg-muted)">Failed to load diagram</div>`
			})
	}

	const defUnsub = store.subscribe(() => {
		renderMeta(getDef())
	})

	return {
		el,
		setTheme(t: "light" | "dark" | "neon"): void {
			canvas?.setTheme(t)
			sidebar.dataset.bpmnkitHudTheme = t
		},
		destroy(): void {
			canvas?.destroy()
			defUnsub()
		},
	}
}
