import type { CanvasPlugin } from "@bpmnkit/canvas"
import { optimize } from "@bpmnkit/core"
import type { BpmnDefinitions } from "@bpmnkit/core"
import { DEPLOY_CSS, DEPLOY_STYLE_ID, injectDeployStyles } from "./css.js"

export { DEPLOY_CSS, DEPLOY_STYLE_ID, injectDeployStyles }

// ── Public types ───────────────────────────────────────────────────────────────

export interface DeployPluginOptions {
	/** Base URL of the proxy server. Defaults to `http://localhost:3033`. */
	proxyUrl?: string
	/** Base URL of the operate app, used to build "View in Operate" links. */
	operateUrl?: string
	/** Return current BPMN definitions (for optimizer check and process ID extraction). */
	getDefinitions(): BpmnDefinitions | null
	/** Return the raw BPMN XML to deploy. */
	getXml(): string | null
	/** Return the filename for the deployed resource (e.g. "my-process.bpmn"). */
	getFileName?(): string | null
}

export interface DeployPlugin extends CanvasPlugin {
	readonly name: "deploy"
	/** Wire the plugin's UI into a container element (e.g. the SideDock deploy pane). */
	mount(container: HTMLElement): void
	/** Call when the Deploy tab becomes active — refreshes proxy status. */
	onTabActivated(): void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ProfileInfo {
	name: string
	active: boolean
}

interface TopologyBroker {
	nodeId?: number
	version?: string
}

interface TopologyResponse {
	brokers?: TopologyBroker[]
	gatewayVersion?: string
	clusterSize?: number
	partitionsCount?: number
	replicationFactor?: number
}

interface ProcessDefinitionItem {
	processDefinitionKey?: string
	bpmnProcessId?: string
	version?: number
	name?: string
}

interface DeploymentResult {
	deploymentKey?: string
	processes?: Array<{
		processDefinitionKey?: string
		bpmnProcessId?: string
		version?: number
		resourceName?: string
	}>
}

interface ProcessInstanceResult {
	processInstanceKey?: string
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	cls: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const e = document.createElement(tag)
	e.className = cls
	if (text !== undefined) e.textContent = text
	return e
}

function statusEl(kind: "ok" | "warn" | "err" | "info", text: string): HTMLDivElement {
	const wrap = el("div", `dp-status dp-status-${kind}`)
	const dot = el("span", `dp-dot dp-dot-${kind}`)
	const msg = el("span", "")
	msg.textContent = text
	wrap.appendChild(dot)
	wrap.appendChild(msg)
	return wrap
}

// ── Plugin factory ─────────────────────────────────────────────────────────────

export function createDeployPlugin(options: DeployPluginOptions): DeployPlugin {
	const proxyUrl = (options.proxyUrl ?? "http://localhost:3033").replace(/\/$/, "")
	const operateUrl = options.operateUrl?.replace(/\/$/, "") ?? null

	// Per-profile deploy results (processDefinitionKey from last deploy)
	let _lastDeployedKey: string | null = null
	let _selectedProfile: string | null = null

	// ── Proxy helpers ──────────────────────────────────────────────────────────

	async function proxyGet<T>(path: string): Promise<T> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (_selectedProfile) headers["x-profile"] = _selectedProfile
		const res = await fetch(`${proxyUrl}${path}`, { headers })
		if (!res.ok) throw new Error(`HTTP ${res.status}`)
		return res.json() as Promise<T>
	}

	async function proxyPost<T>(path: string, body: unknown): Promise<T> {
		const headers: Record<string, string> = {
			"content-type": "application/json",
			accept: "application/json",
		}
		if (_selectedProfile) headers["x-profile"] = _selectedProfile
		const res = await fetch(`${proxyUrl}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(body),
		})
		if (!res.ok) {
			const text = await res.text()
			throw new Error(`HTTP ${res.status}: ${text}`)
		}
		return res.json() as Promise<T>
	}

	async function proxyPostMultipart<T>(path: string, form: FormData): Promise<T> {
		const headers: Record<string, string> = { accept: "application/json" }
		if (_selectedProfile) headers["x-profile"] = _selectedProfile
		const res = await fetch(`${proxyUrl}${path}`, {
			method: "POST",
			headers,
			body: form,
		})
		if (!res.ok) {
			const text = await res.text()
			throw new Error(`HTTP ${res.status}: ${text}`)
		}
		return res.json() as Promise<T>
	}

	// ── Panel render ───────────────────────────────────────────────────────────

	let _root: HTMLElement | null = null

	async function render(): Promise<void> {
		if (!_root) return
		_root.innerHTML = ""
		const container = _root
		try {
			await fetch(`${proxyUrl}/status`, { signal: AbortSignal.timeout(2000) })
			renderPanel(container)
		} catch {
			renderOffline(container)
		}
	}

	function renderOffline(container: HTMLElement): void {
		const wrap = el("div", "dp-offline")
		const icon = el("div", "dp-offline-icon")
		icon.textContent = "⚙"
		const title = el("div", "dp-offline-title", "Proxy server not running")
		const hint = el(
			"div",
			"dp-offline-hint",
			"Start the proxy server to deploy processes and manage instances:",
		)
		const code = el("pre", "dp-offline-code", "casen proxy start")
		wrap.appendChild(icon)
		wrap.appendChild(title)
		wrap.appendChild(hint)
		wrap.appendChild(code)
		container.appendChild(wrap)
	}

	function renderPanel(container: HTMLElement): void {
		const root = el("div", "dp-root")
		container.appendChild(root)

		// ── Profile section ────────────────────────────────────────────────────

		const profileSection = el("div", "dp-section")
		const profileTitle = el("div", "dp-section-title", "Profile")
		const profileRow = el("div", "dp-row")
		const profileSelect = el("select", "dp-select")
		const refreshBtn = el("button", "dp-btn dp-btn-secondary")
		refreshBtn.textContent = "↻"
		refreshBtn.title = "Refresh"
		refreshBtn.style.width = "32px"
		refreshBtn.style.flexShrink = "0"
		profileRow.appendChild(profileSelect)
		profileRow.appendChild(refreshBtn)
		profileSection.appendChild(profileTitle)
		profileSection.appendChild(profileRow)
		root.appendChild(profileSection)

		// ── Cluster health section ─────────────────────────────────────────────

		const clusterSection = el("div", "dp-section")
		const clusterTitle = el("div", "dp-section-title", "Cluster")
		const clusterStatus = el("div", "")
		clusterStatus.appendChild(statusEl("info", "Select a profile to check cluster health"))
		clusterSection.appendChild(clusterTitle)
		clusterSection.appendChild(clusterStatus)
		root.appendChild(clusterSection)

		root.appendChild(el("hr", "dp-divider"))

		// ── Optimizer section ──────────────────────────────────────────────────

		const optSection = el("div", "dp-section")
		const optTitle = el("div", "dp-section-title", "Process Validation")
		const optStatus = el("div", "")
		optStatus.appendChild(statusEl("info", "Loading…"))
		optSection.appendChild(optTitle)
		optSection.appendChild(optStatus)
		root.appendChild(optSection)

		// ── Deploy section ─────────────────────────────────────────────────────

		const deploySection = el("div", "dp-section")
		const deployBtn = el("button", "dp-btn dp-btn-primary", "Deploy Process")
		deployBtn.disabled = true
		const deployStatus = el("div", "")
		deploySection.appendChild(deployBtn)
		deploySection.appendChild(deployStatus)
		root.appendChild(deploySection)

		// ── Start instance section (shown after deploy or if already deployed) ──

		const startSection = el("div", "dp-section")
		startSection.style.display = "none"

		root.appendChild(el("hr", "dp-divider"))

		const startTitle = el("div", "dp-section-title", "Start Process Instance")
		const varLabel = el("div", "dp-section-title")
		varLabel.style.textTransform = "none"
		varLabel.style.fontSize = "11px"
		varLabel.style.color = "rgba(255,255,255,0.4)"
		varLabel.textContent = "Variables (JSON, optional)"
		const varInput = el("textarea", "dp-textarea")
		varInput.placeholder = '{\n  "key": "value"\n}'
		const startBtn = el("button", "dp-btn dp-btn-secondary", "Start Instance")
		const startStatus = el("div", "")
		startSection.appendChild(startTitle)
		startSection.appendChild(varLabel)
		startSection.appendChild(varInput)
		startSection.appendChild(startBtn)
		startSection.appendChild(startStatus)
		root.appendChild(startSection)

		// ── State ──────────────────────────────────────────────────────────────

		let _topologyOk = false
		let _optimizerOk = false
		let _deployedKey: string | null = _lastDeployedKey

		function updateDeployBtn(): void {
			deployBtn.disabled = !_topologyOk || !_optimizerOk
		}

		// ── Profile loading ────────────────────────────────────────────────────

		async function loadProfiles(): Promise<void> {
			try {
				const profiles = await proxyGet<ProfileInfo[]>("/profiles")
				profileSelect.innerHTML = ""
				for (const p of profiles) {
					const opt = document.createElement("option")
					opt.value = p.name
					opt.textContent = `${p.name}${p.active ? " ✓" : ""}`
					if (p.active && _selectedProfile === null) {
						_selectedProfile = p.name
						opt.selected = true
					} else if (p.name === _selectedProfile) {
						opt.selected = true
					}
					profileSelect.appendChild(opt)
				}
				if (profiles.length > 0 && _selectedProfile === null) {
					const first = profiles[0]
					if (first) {
						_selectedProfile = first.name
						profileSelect.value = first.name
					}
				}
				await checkTopology()
			} catch {
				profileSelect.innerHTML = '<option value="">No profiles found</option>'
			}
		}

		profileSelect.addEventListener("change", () => {
			_selectedProfile = profileSelect.value || null
			void checkTopology()
		})

		refreshBtn.addEventListener("click", () => {
			void loadProfiles()
		})

		// ── Topology check ─────────────────────────────────────────────────────

		async function checkTopology(): Promise<void> {
			clusterStatus.innerHTML = ""
			clusterStatus.appendChild(statusEl("info", "Checking…"))
			try {
				const topo = await proxyGet<TopologyResponse>("/api/topology")
				_topologyOk = true
				const brokers = topo.brokers?.length ?? 0
				const version = topo.gatewayVersion ?? "unknown"
				clusterStatus.innerHTML = ""
				clusterStatus.appendChild(
					statusEl(
						"ok",
						`Connected — ${brokers} broker${brokers === 1 ? "" : "s"}, gateway ${version}`,
					),
				)
			} catch (err) {
				_topologyOk = false
				clusterStatus.innerHTML = ""
				clusterStatus.appendChild(statusEl("err", `Cluster unreachable: ${String(err)}`))
			}
			updateDeployBtn()
			await checkExistingDeployment()
		}

		// ── Optimizer check ────────────────────────────────────────────────────

		function runOptimizerCheck(): void {
			const defs = options.getDefinitions()
			if (!defs) {
				optStatus.innerHTML = ""
				optStatus.appendChild(statusEl("info", "No process loaded"))
				_optimizerOk = false
				updateDeployBtn()
				return
			}
			const report = optimize(defs)
			const errors = report.findings.filter((f) => f.severity === "error")
			const warnings = report.findings.filter((f) => f.severity === "warning")
			optStatus.innerHTML = ""
			if (errors.length > 0) {
				_optimizerOk = false
				optStatus.appendChild(
					statusEl(
						"err",
						`${errors.length} error${errors.length === 1 ? "" : "s"} — fix before deploying`,
					),
				)
				const list = el("div", "dp-finding-list")
				for (const f of errors) {
					const item = el("div", "dp-finding")
					const badge = el("span", "dp-finding-badge", "error")
					const msg = el("span", "")
					msg.textContent = f.message
					item.appendChild(badge)
					item.appendChild(msg)
					list.appendChild(item)
				}
				optStatus.appendChild(list)
			} else if (warnings.length > 0) {
				_optimizerOk = true
				optStatus.appendChild(
					statusEl(
						"warn",
						`${warnings.length} warning${warnings.length === 1 ? "" : "s"} — deploy allowed`,
					),
				)
			} else {
				_optimizerOk = true
				optStatus.appendChild(statusEl("ok", "No issues found"))
			}
			updateDeployBtn()
		}

		// ── Check if already deployed ──────────────────────────────────────────

		async function checkExistingDeployment(): Promise<void> {
			const defs = options.getDefinitions()
			const processId = defs?.processes?.[0]?.id
			if (!processId || !_topologyOk) return
			try {
				const result = await proxyPost<{ items?: ProcessDefinitionItem[] }>(
					"/api/process-definitions/search",
					{ filter: { bpmnProcessId: processId }, page: { from: 0, limit: 1 } },
				)
				const item = result.items?.[0]
				if (item?.processDefinitionKey) {
					_deployedKey = item.processDefinitionKey
					_lastDeployedKey = _deployedKey
					showStartSection()
				}
			} catch {
				// not yet deployed — no action needed
			}
		}

		function showStartSection(): void {
			startSection.style.display = ""
		}

		// ── Deploy ─────────────────────────────────────────────────────────────

		deployBtn.addEventListener("click", () => {
			void doDeploy()
		})

		async function doDeploy(): Promise<void> {
			const xml = options.getXml()
			if (!xml) {
				deployStatus.innerHTML = ""
				deployStatus.appendChild(statusEl("err", "No process XML available"))
				return
			}
			const fileName = options.getFileName?.() ?? "process.bpmn"
			deployBtn.disabled = true
			deployBtn.textContent = "Deploying…"
			deployStatus.innerHTML = ""

			try {
				const form = new FormData()
				const blob = new Blob([xml], { type: "application/xml" })
				form.append("resources", blob, fileName)

				const result = await proxyPostMultipart<DeploymentResult>("/api/deployments", form)
				const process = result.processes?.[0]
				_deployedKey = process?.processDefinitionKey ?? null
				_lastDeployedKey = _deployedKey

				deployStatus.innerHTML = ""
				const box = el("div", "dp-result-box")
				const keyLine = document.createElement("div")
				keyLine.textContent = "Deployment key: "
				const keySpan = el("span", "dp-result-key", result.deploymentKey ?? "—")
				keyLine.appendChild(keySpan)
				const defLine = document.createElement("div")
				defLine.textContent = `Process: ${process?.bpmnProcessId ?? "—"} v${process?.version ?? "?"}`
				box.appendChild(keyLine)
				box.appendChild(defLine)
				deployStatus.appendChild(box)

				showStartSection()
			} catch (err) {
				deployStatus.innerHTML = ""
				deployStatus.appendChild(statusEl("err", `Deploy failed: ${String(err)}`))
			} finally {
				deployBtn.disabled = false
				deployBtn.textContent = "Deploy Process"
				updateDeployBtn()
			}
		}

		// ── Start instance ─────────────────────────────────────────────────────

		startBtn.addEventListener("click", () => {
			void doStartInstance()
		})

		async function doStartInstance(): Promise<void> {
			if (!_deployedKey) {
				startStatus.innerHTML = ""
				startStatus.appendChild(statusEl("err", "No deployed process key available"))
				return
			}
			let variables: Record<string, unknown> = {}
			const raw = varInput.value.trim()
			if (raw) {
				try {
					variables = JSON.parse(raw) as Record<string, unknown>
				} catch {
					startStatus.innerHTML = ""
					startStatus.appendChild(statusEl("err", "Variables must be valid JSON"))
					return
				}
			}

			startBtn.disabled = true
			startBtn.textContent = "Starting…"
			startStatus.innerHTML = ""

			try {
				const result = await proxyPost<ProcessInstanceResult>("/api/process-instances", {
					processDefinitionKey: _deployedKey,
					variables,
				})
				const instanceKey = result.processInstanceKey
				startStatus.innerHTML = ""
				const box = el("div", "dp-result-box")
				const keyLine = document.createElement("div")
				keyLine.textContent = "Instance key: "
				const keySpan = el("span", "dp-result-key", instanceKey ?? "—")
				keyLine.appendChild(keySpan)
				box.appendChild(keyLine)
				if (operateUrl && instanceKey) {
					const linkLine = document.createElement("div")
					linkLine.style.marginTop = "6px"
					const link = el("a", "dp-link", "View in Operate →")
					link.setAttribute("href", `${operateUrl}#/instances/${instanceKey}`)
					link.setAttribute("target", "_blank")
					link.setAttribute("rel", "noopener noreferrer")
					linkLine.appendChild(link)
					box.appendChild(linkLine)
				}
				startStatus.appendChild(box)
			} catch (err) {
				startStatus.innerHTML = ""
				startStatus.appendChild(statusEl("err", `Start failed: ${String(err)}`))
			} finally {
				startBtn.disabled = false
				startBtn.textContent = "Start Instance"
			}
		}

		// ── Initial load ───────────────────────────────────────────────────────

		runOptimizerCheck()
		void loadProfiles()
	}

	// ── CanvasPlugin interface ─────────────────────────────────────────────────

	return {
		name: "deploy",

		install(): void {
			injectDeployStyles()
		},

		mount(container: HTMLElement): void {
			_root = container
			void render()
		},

		onTabActivated(): void {
			// Re-render to get fresh proxy status and optimizer state
			void render()
		},
	}
}
