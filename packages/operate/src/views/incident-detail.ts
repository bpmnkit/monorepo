import { BpmnCanvas } from "@bpmn-sdk/canvas"
import { createTokenHighlightPlugin } from "@bpmn-sdk/plugins/token-highlight"
import { badge } from "../components/badge.js"
import { MOCK_BPMN_XML, MOCK_INCIDENTS } from "../mock-data.js"
import type { IncidentsStore } from "../stores/incidents.js"
import type { IncidentResult, ProcessInstanceResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
	theme: "light" | "dark"
	navigate?: (path: string) => void
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

function metaRow(label: string, value: string, amber = false): HTMLElement {
	const row = document.createElement("div")
	row.className = "op-task-meta-row"
	const l = document.createElement("span")
	l.className = "op-task-meta-label"
	l.textContent = label
	const v = document.createElement("span")
	v.className = "op-task-meta-value"
	v.textContent = value
	if (amber) v.style.color = "var(--op-c-amber)"
	row.appendChild(l)
	row.appendChild(v)
	return row
}

type JobDetail = {
	errorCode?: string | null
	errorMessage?: string | null
	retries?: number
	type?: string
	customHeaders?: Record<string, string>
}

export function createIncidentDetailView(
	incidentKey: string,
	store: IncidentsStore,
	cfg: Config,
	onBack: () => void,
): { el: HTMLElement; destroy(): void } {
	const el = document.createElement("div")
	el.className = "op-view op-instance-detail"

	// Breadcrumb
	const breadcrumb = document.createElement("div")
	breadcrumb.className = "op-breadcrumb"
	const backBtn = document.createElement("button")
	backBtn.className = "op-back-btn"
	backBtn.textContent = "← Incidents"
	backBtn.addEventListener("click", onBack)
	breadcrumb.appendChild(backBtn)
	el.appendChild(breadcrumb)

	// Process chain (shows Root / Parent / Current)
	const processChainEl = document.createElement("div")
	processChainEl.className = "op-process-chain"
	el.appendChild(processChainEl)

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

	// Tabs
	const tabNames = ["Details", "AI Assist"]
	const tabBar = document.createElement("div")
	tabBar.className = "op-detail-tabs"
	const tabPanels: HTMLElement[] = []
	let activeTab = 0

	for (let i = 0; i < tabNames.length; i++) {
		const btn = document.createElement("button")
		btn.className = `op-detail-tab${i === 0 ? " op-detail-tab--active" : ""}`
		btn.textContent = tabNames[i] ?? ""
		const idx = i
		btn.addEventListener("click", () => {
			activeTab = idx
			for (let j = 0; j < tabNames.length; j++) {
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

	const detailsPanel = document.createElement("div")
	detailsPanel.className = "op-detail-panel"
	tabPanels.push(detailsPanel)
	sidebar.appendChild(detailsPanel)

	const aiPanel = document.createElement("div")
	aiPanel.className = "op-detail-panel"
	aiPanel.style.display = "none"
	tabPanels.push(aiPanel)
	sidebar.appendChild(aiPanel)

	// AI Assist panel content
	const aiAssistDiv = document.createElement("div")
	aiAssistDiv.className = "op-ai-assist-panel"
	const aiIntro = document.createElement("p")
	aiIntro.className = "op-ai-assist-intro"
	aiIntro.textContent =
		"Analyze this incident with AI to understand the root cause and get concrete remediation steps."
	aiAssistDiv.appendChild(aiIntro)

	const analyzeBtn = document.createElement("button")
	analyzeBtn.className = "op-action-btn op-action-btn--primary"
	analyzeBtn.textContent = "Analyze with AI"
	aiAssistDiv.appendChild(analyzeBtn)

	const aiResponseEl = document.createElement("pre")
	aiResponseEl.className = "op-ai-response"
	aiResponseEl.style.display = "none"
	aiAssistDiv.appendChild(aiResponseEl)

	aiPanel.appendChild(aiAssistDiv)

	analyzeBtn.addEventListener("click", () => {
		analyzeBtn.disabled = true
		analyzeBtn.textContent = "Analyzing…"
		aiResponseEl.textContent = ""
		aiResponseEl.style.display = "none"

		const headers: Record<string, string> = { "Content-Type": "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile

		fetch(`${cfg.proxyUrl}/operate/incident-assist`, {
			method: "POST",
			headers,
			body: JSON.stringify({ incidentKey }),
		})
			.then((response) => {
				if (!response.body) throw new Error("No response body")
				const reader = response.body.getReader()
				const decoder = new TextDecoder()
				let buffer = ""

				function pump(): Promise<void> {
					return reader.read().then(({ done, value }) => {
						if (done) {
							analyzeBtn.disabled = false
							analyzeBtn.textContent = "Analyze with AI"
							return
						}
						buffer += decoder.decode(value, { stream: true })
						const lines = buffer.split("\n")
						buffer = lines.pop() ?? ""
						for (const line of lines) {
							if (!line.startsWith("data: ")) continue
							try {
								const event = JSON.parse(line.slice(6)) as {
									type: string
									text?: string
									message?: string
								}
								if (event.type === "token" && event.text) {
									if (aiResponseEl.style.display === "none") {
										aiResponseEl.style.display = ""
									}
									aiResponseEl.textContent += event.text
								} else if (event.type === "done") {
									analyzeBtn.disabled = false
									analyzeBtn.textContent = "Analyze with AI"
								} else if (event.type === "error") {
									analyzeBtn.disabled = false
									analyzeBtn.textContent = "Analyze with AI"
								}
							} catch {
								/* ignore malformed lines */
							}
						}
						return pump()
					})
				}
				return pump()
			})
			.catch(() => {
				analyzeBtn.disabled = false
				analyzeBtn.textContent = "Analyze with AI"
			})
	})

	// Canvas
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

	// Render meta bar
	function renderMeta(inc: IncidentResult): void {
		meta.innerHTML = ""
		const type = document.createElement("span")
		type.className = "op-incident-type"
		type.textContent = inc.errorType ?? "UNKNOWN"
		meta.appendChild(type)
		meta.appendChild(badge(inc.state ?? "UNKNOWN"))
		const key = document.createElement("span")
		key.className = "op-instance-key"
		key.textContent = inc.incidentKey ?? incidentKey
		meta.appendChild(key)
		const created = document.createElement("span")
		created.className = "op-instance-time"
		created.textContent = `Created ${relTime(inc.creationTime)}`
		meta.appendChild(created)
	}

	// Render process chain: fetches the instance hierarchy up to the root
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

	async function fetchProcessChain(inc: IncidentResult): Promise<void> {
		if (!inc.processInstanceKey) return
		const headers: Record<string, string> = { accept: "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile

		// Walk up from current instance to root, collecting the chain
		const chain: Array<{ name: string; instanceKey: string }> = []
		let key: string | null = inc.processInstanceKey
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
				// Walk to parent (empty string = no parent)
				key = inst.parentProcessInstanceKey || null
			} catch {
				break
			}
		}

		if (chain.length > 0) renderProcessChain(chain)
	}

	// Render job details section (connector config, error code)
	function renderJobDetails(job: JobDetail): void {
		const section = document.createElement("div")
		section.className = "op-job-section"

		const title = document.createElement("div")
		title.className = "op-job-section-title"
		title.textContent = "Job Details"
		section.appendChild(title)

		if (job.type) section.appendChild(metaRow("Type", job.type))
		if (job.errorCode) section.appendChild(metaRow("Error Code", job.errorCode, true))
		if (job.retries !== undefined) section.appendChild(metaRow("Retries Left", String(job.retries)))

		const headers = job.customHeaders
		if (headers && Object.keys(headers).length > 0) {
			const hTitle = document.createElement("div")
			hTitle.className = "op-job-section-title"
			hTitle.style.marginTop = "12px"
			hTitle.textContent = "Task Headers"
			section.appendChild(hTitle)

			const hPre = document.createElement("pre")
			hPre.className = "op-job-headers"
			hPre.textContent = Object.entries(headers)
				.map(([k, v]) => `${k}: ${v}`)
				.join("\n")
			section.appendChild(hPre)
		}

		detailsPanel.appendChild(section)
	}

	async function fetchJobDetails(jobKey: string): Promise<void> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (cfg.profile) headers["x-profile"] = cfg.profile
		try {
			const r = await fetch(`${cfg.proxyUrl}/api/jobs/${jobKey}`, { headers })
			if (!r.ok) return
			const job = (await r.json()) as JobDetail
			renderJobDetails(job)
		} catch {
			/* ignore */
		}
	}

	// Render details panel
	function renderDetails(inc: IncidentResult): void {
		detailsPanel.innerHTML = ""

		const isActive = inc.state === "ACTIVE"
		detailsPanel.appendChild(metaRow("Error Type", inc.errorType ?? "UNKNOWN", isActive))

		const msgRow = document.createElement("div")
		msgRow.className = "op-task-meta-row"
		const msgLabel = document.createElement("span")
		msgLabel.className = "op-task-meta-label"
		msgLabel.textContent = "Error Message"
		const msgVal = document.createElement("span")
		msgVal.className = "op-task-meta-value"
		msgVal.style.whiteSpace = "pre-wrap"
		msgVal.style.wordBreak = "break-word"
		msgVal.textContent = inc.errorMessage ?? "—"
		msgRow.appendChild(msgLabel)
		msgRow.appendChild(msgVal)
		detailsPanel.appendChild(msgRow)

		detailsPanel.appendChild(metaRow("Element ID", inc.elementId ?? "—"))
		detailsPanel.appendChild(metaRow("Process", inc.processDefinitionId ?? "—"))
		detailsPanel.appendChild(metaRow("Process Instance Key", inc.processInstanceKey ?? "—"))
		detailsPanel.appendChild(metaRow("Element Instance Key", inc.elementInstanceKey ?? "—"))
		detailsPanel.appendChild(metaRow("Job Key", inc.jobKey ?? "—"))
		detailsPanel.appendChild(metaRow("Root Process Instance", inc.rootProcessInstanceKey ?? "—"))
		detailsPanel.appendChild(metaRow("Tenant", inc.tenantId ?? "—"))
		detailsPanel.appendChild(metaRow("Created", relTime(inc.creationTime)))

		// Action buttons
		const hasRetry = inc.errorType === "JOB_NO_RETRIES" && isActive
		const hasResolve = isActive

		if (hasRetry || hasResolve) {
			const btnsDiv = document.createElement("div")
			btnsDiv.className = "op-action-btns"

			const feedbackEl = document.createElement("div")
			feedbackEl.className = "op-action-feedback"
			feedbackEl.style.display = "none"

			function showFeedback(msg: string, ok: boolean): void {
				feedbackEl.textContent = msg
				feedbackEl.className = `op-action-feedback op-action-feedback--${ok ? "ok" : "err"}`
				feedbackEl.style.display = ""
			}

			if (hasRetry) {
				const retryBtn = document.createElement("button")
				retryBtn.className = "op-action-btn op-action-btn--primary"
				retryBtn.textContent = "↻ Retry Job"
				retryBtn.addEventListener("click", () => {
					retryBtn.disabled = true
					const jobKey = inc.jobKey ?? ""
					const h: Record<string, string> = { "Content-Type": "application/json" }
					if (cfg.profile) h["x-profile"] = cfg.profile
					fetch(`${cfg.proxyUrl}/api/jobs/${jobKey}/retries`, {
						method: "PATCH",
						headers: h,
						body: JSON.stringify({ retries: 3 }),
					})
						.then((r) => {
							if (r.ok) showFeedback("Job retries updated.", true)
							else showFeedback(`Error: ${r.status}`, false)
						})
						.catch((err: unknown) => {
							showFeedback(String(err), false)
						})
				})
				btnsDiv.appendChild(retryBtn)
			}

			if (hasResolve) {
				const resolveBtn = document.createElement("button")
				resolveBtn.className = "op-action-btn"
				resolveBtn.textContent = "✓ Resolve Incident"
				resolveBtn.addEventListener("click", () => {
					resolveBtn.disabled = true
					const iKey = inc.incidentKey ?? ""
					const h: Record<string, string> = { "Content-Type": "application/json" }
					if (cfg.profile) h["x-profile"] = cfg.profile
					fetch(`${cfg.proxyUrl}/api/incidents/${iKey}/resolution`, {
						method: "POST",
						headers: h,
						body: JSON.stringify({}),
					})
						.then((r) => {
							if (r.ok) showFeedback("Incident resolved.", true)
							else showFeedback(`Error: ${r.status}`, false)
						})
						.catch((err: unknown) => {
							showFeedback(String(err), false)
						})
				})
				btnsDiv.appendChild(resolveBtn)
			}

			detailsPanel.appendChild(btnsDiv)
			detailsPanel.appendChild(feedbackEl)
		}

		// Fetch and append job details asynchronously (connector config, error code)
		if (!cfg.mock && inc.jobKey) {
			fetchJobDetails(inc.jobKey).catch(() => {})
		}
	}

	// Incident lookup
	function getIncident(): IncidentResult | null {
		return store.state.data?.items.find((i) => i.incidentKey === incidentKey) ?? null
	}

	let storeUnsub: () => void

	if (cfg.mock) {
		const mockInc = MOCK_INCIDENTS.find((i) => i.incidentKey === incidentKey) ?? null
		loadCanvas(MOCK_BPMN_XML)
		if (mockInc) {
			renderMeta(mockInc)
			renderDetails(mockInc)
			if (mockInc.elementId) {
				setTimeout(() => tokenHighlight.api.setActive([mockInc.elementId ?? ""]), 100)
			}
		} else {
			meta.textContent = `Incident ${incidentKey}`
		}
		storeUnsub = store.subscribe(() => {
			const inc = getIncident()
			if (inc) {
				renderMeta(inc)
				renderDetails(inc)
			}
		})
	} else {
		let xmlStarted = false

		function startFetch(inc: IncidentResult): void {
			if (xmlStarted) return
			xmlStarted = true
			renderMeta(inc)
			renderDetails(inc)
			fetchProcessChain(inc).catch(() => {})

			const pdKey = inc.processDefinitionKey
			if (pdKey) {
				fetch(`${cfg.proxyUrl}/api/process-definitions/${pdKey}/xml`, {
					headers: {
						accept: "text/xml",
						...(cfg.profile ? { "x-profile": cfg.profile } : {}),
					},
				})
					.then((r) => r.text())
					.then((xml) => {
						loadCanvas(xml)
						if (inc.elementId) {
							tokenHighlight.api.setActive([inc.elementId])
						}
					})
					.catch(() => {
						// canvas not available
					})
			}
		}

		// Try to get incident from store immediately; fall back to direct fetch
		const existing = getIncident()
		if (existing) {
			startFetch(existing)
		} else {
			const headers: Record<string, string> = { accept: "application/json" }
			if (cfg.profile) headers["x-profile"] = cfg.profile
			fetch(`${cfg.proxyUrl}/api/incidents/${incidentKey}`, { headers })
				.then((r) => r.json())
				.then((inc: IncidentResult) => startFetch(inc))
				.catch(() => {
					meta.textContent = `Incident ${incidentKey}`
				})
		}

		storeUnsub = store.subscribe(() => {
			const inc = getIncident()
			if (inc) startFetch(inc)
		})
	}

	return {
		el,
		destroy(): void {
			canvas?.destroy()
			storeUnsub()
		},
	}
}
