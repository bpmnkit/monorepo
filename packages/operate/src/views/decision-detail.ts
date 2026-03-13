import { DmnEditor } from "@bpmn-sdk/plugins/dmn-editor"
import type { DecisionsStore } from "../stores/decisions.js"
import type { DecisionDefinitionResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
	theme: "light" | "dark"
	navigate?: (path: string) => void
}

const MOCK_DMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_1" name="DRD" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="approve-order" name="Approve Order">
    <decisionTable id="decisionTable_1">
      <input id="input_1" label="Order Amount">
        <inputExpression id="inputExpression_1" typeRef="double">
          <text>amount</text>
        </inputExpression>
      </input>
      <output id="output_1" label="Approved" name="approved" typeRef="boolean"/>
      <rule id="rule_1">
        <inputEntry id="inputEntry_1"><text>&lt; 1000</text></inputEntry>
        <outputEntry id="outputEntry_1"><text>true</text></outputEntry>
      </rule>
      <rule id="rule_2">
        <inputEntry id="inputEntry_2"><text>&gt;= 1000</text></inputEntry>
        <outputEntry id="outputEntry_2"><text>false</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`

export function createDecisionDetailView(
	definitionKey: string,
	store: DecisionsStore,
	cfg: Config,
	onBack: () => void,
): {
	el: HTMLElement
	setTheme(t: "light" | "dark"): void
	destroy(): void
} {
	const el = document.createElement("div")
	el.className = "op-view op-def-detail"

	// Breadcrumb
	const breadcrumb = document.createElement("div")
	breadcrumb.className = "op-breadcrumb"
	const backBtn = document.createElement("button")
	backBtn.className = "op-back-btn"
	backBtn.textContent = "← Decisions"
	backBtn.addEventListener("click", onBack)
	breadcrumb.appendChild(backBtn)
	el.appendChild(breadcrumb)

	// Metadata row
	const meta = document.createElement("div")
	meta.className = "op-def-meta"
	el.appendChild(meta)

	// Editor pane
	const editorWrap = document.createElement("div")
	editorWrap.className = "op-def-canvas"
	el.appendChild(editorWrap)

	let editor: DmnEditor | null = null

	function getDef(): DecisionDefinitionResult | null {
		return store.state.data?.items.find((d) => d.decisionDefinitionKey === definitionKey) ?? null
	}

	function getVersions(): DecisionDefinitionResult[] {
		const def = getDef()
		if (!def) return []
		const id = def.decisionDefinitionId
		return (store.state.data?.items ?? [])
			.filter((d) => d.decisionDefinitionId === id)
			.sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
	}

	function renderMeta(def: DecisionDefinitionResult | null): void {
		meta.innerHTML = ""
		if (!def) return
		const name = document.createElement("span")
		name.className = "op-def-meta-name"
		name.textContent = def.name ?? def.decisionDefinitionId
		meta.appendChild(name)

		const versions = getVersions()
		if (versions.length > 1 && cfg.navigate) {
			const select = document.createElement("select")
			select.className = "op-version-select"
			for (const v of versions) {
				const opt = document.createElement("option")
				opt.value = v.decisionDefinitionKey
				opt.textContent = `v${v.version ?? "?"}`
				opt.selected = v.decisionDefinitionKey === definitionKey
				select.appendChild(opt)
			}
			select.addEventListener("change", () => {
				cfg.navigate?.(`/decisions/${select.value}`)
			})
			meta.appendChild(select)
		} else {
			const ver = document.createElement("span")
			ver.className = "op-def-meta-version"
			ver.textContent = `v${def.version ?? "?"}`
			meta.appendChild(ver)
		}

		if (def.decisionRequirementsName) {
			const drg = document.createElement("span")
			drg.className = "op-def-meta-version"
			drg.textContent = `DRG: ${def.decisionRequirementsName}`
			meta.appendChild(drg)
		}
		if (def.tenantId) {
			const tenant = document.createElement("span")
			tenant.className = "op-def-meta-version"
			tenant.textContent = `tenant: ${def.tenantId}`
			meta.appendChild(tenant)
		}
		const key = document.createElement("span")
		key.className = "op-instance-key"
		key.textContent = def.decisionDefinitionKey
		meta.appendChild(key)
	}

	function loadEditor(xml: string): void {
		editor?.destroy()
		editorWrap.innerHTML = ""
		editor = new DmnEditor({ container: editorWrap, theme: cfg.theme })
		editor.loadXML(xml).catch(() => {})
	}

	let xmlStarted = false

	function startXmlFetch(def: DecisionDefinitionResult): void {
		if (xmlStarted) return
		xmlStarted = true
		renderMeta(def)

		if (cfg.mock) {
			loadEditor(MOCK_DMN_XML)
			return
		}

		const headers: Record<string, string> = {}
		if (cfg.profile) headers["x-profile"] = cfg.profile

		fetch(`${cfg.proxyUrl}/api/decision-definitions/${def.decisionDefinitionKey}/xml`, { headers })
			.then((r) => (r.ok ? r.text() : null))
			.then((xml) => {
				if (xml) loadEditor(xml)
			})
			.catch(() => {})
	}

	// Try to resolve from store immediately
	const def = getDef()
	if (def) {
		startXmlFetch(def)
	} else if (!cfg.mock) {
		// Deep-link: fetch directly
		const headers: Record<string, string> = {}
		if (cfg.profile) headers["x-profile"] = cfg.profile
		fetch(`${cfg.proxyUrl}/api/decision-definitions/${definitionKey}`, { headers })
			.then((r) => (r.ok ? r.json() : null))
			.then((inst: DecisionDefinitionResult | null) => {
				if (inst && !xmlStarted) startXmlFetch(inst)
			})
			.catch(() => {})
	}

	// Re-check when store updates (in case we navigated before store loaded)
	const unsub = store.subscribe(() => {
		if (xmlStarted) return
		const found = getDef()
		if (found) startXmlFetch(found)
	})

	return {
		el,
		setTheme(t: "light" | "dark"): void {
			editor?.setTheme(t)
		},
		destroy(): void {
			unsub()
			editor?.destroy()
		},
	}
}
