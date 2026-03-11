import { BpmnCanvas } from "@bpmn-sdk/canvas"
import { MOCK_BPMN_XML } from "../mock-data.js"
import type { DefinitionsStore } from "../stores/definitions.js"
import type { ProcessDefinitionResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
	theme: "light" | "dark"
}

export function createDefinitionDetailView(
	definitionKey: string,
	store: DefinitionsStore,
	cfg: Config,
	onBack: () => void,
): {
	el: HTMLElement
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
	el.appendChild(breadcrumb)

	// Metadata row
	const meta = document.createElement("div")
	meta.className = "op-def-meta"
	el.appendChild(meta)

	// Canvas pane
	const canvasWrap = document.createElement("div")
	canvasWrap.className = "op-def-canvas"
	el.appendChild(canvasWrap)

	let canvas: BpmnCanvas | null = null

	function getDef(): ProcessDefinitionResult | null {
		return store.state.data?.items.find((d) => d.processDefinitionKey === definitionKey) ?? null
	}

	function renderMeta(def: ProcessDefinitionResult | null): void {
		meta.innerHTML = ""
		if (!def) return
		const name = document.createElement("span")
		name.className = "op-def-meta-name"
		name.textContent = def.name ?? def.processDefinitionId ?? "—"
		meta.appendChild(name)
		const ver = document.createElement("span")
		ver.className = "op-def-meta-version"
		ver.textContent = `v${def.version ?? "?"}${def.versionTag ? ` · ${def.versionTag}` : ""}`
		meta.appendChild(ver)
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
	}

	function loadCanvas(xml: string): void {
		canvas?.destroy()
		canvasWrap.innerHTML = ""
		canvas = new BpmnCanvas({
			container: canvasWrap,
			xml,
			theme: cfg.theme,
		})
	}

	if (cfg.mock) {
		renderMeta(getDef())
		loadCanvas(MOCK_BPMN_XML)
	} else {
		const def = getDef()
		renderMeta(def)
		fetch(`${cfg.proxyUrl}/api/process-definitions/${definitionKey}/xml`, {
			headers: {
				accept: "text/xml",
				...(cfg.profile ? { "x-profile": cfg.profile } : {}),
			},
		})
			.then((r) => r.text())
			.then((xml) => loadCanvas(xml))
			.catch(() => {
				canvasWrap.innerHTML = `<div style="padding:24px;color:var(--bpmn-fg-muted)">Failed to load diagram</div>`
			})
	}

	const defUnsub = store.subscribe(() => {
		renderMeta(getDef())
	})

	return {
		el,
		destroy(): void {
			canvas?.destroy()
			defUnsub()
		},
	}
}
