import { type Theme, applyTheme, injectUiStyles, loadPersistedTheme } from "@bpmn-sdk/ui"
import { injectOperateStyles } from "./css.js"
import { createRouter } from "./router.js"
import { DashboardStore } from "./stores/dashboard.js"
import { DefinitionsStore } from "./stores/definitions.js"
import { IncidentsStore } from "./stores/incidents.js"
import { InstancesStore } from "./stores/instances.js"
import { JobsStore } from "./stores/jobs.js"
import { TasksStore } from "./stores/tasks.js"
import type { OperateApi, OperateOptions, ProfileInfo } from "./types.js"
import { createDashboardView } from "./views/dashboard.js"
import { createDefinitionDetailView } from "./views/definition-detail.js"
import { createDefinitionsView } from "./views/definitions.js"
import { createHeader } from "./views/header.js"
import { createIncidentsView } from "./views/incidents.js"
import { createInstanceDetailView } from "./views/instance-detail.js"
import { createInstancesView } from "./views/instances.js"
import { createJobsView } from "./views/jobs.js"
import { createNav } from "./views/nav.js"
import { createTasksView } from "./views/tasks.js"

const TITLE_MAP: Record<string, string> = {
	"/": "Dashboard",
	"/definitions": "Processes",
	"/instances": "Instances",
	"/incidents": "Incidents",
	"/jobs": "Jobs",
	"/tasks": "Tasks",
}

// Keep TITLE_MAP reference to avoid unused-variable lint error
void TITLE_MAP

export function createOperate(options: OperateOptions): OperateApi {
	// Inject shared tokens first, then operate-specific layout CSS
	injectUiStyles()
	injectOperateStyles()

	const {
		container,
		proxyUrl = "http://localhost:3033",
		pollInterval = 30_000,
		mock = false,
	} = options

	let profile: string | null = options.profile ?? null

	// Resolve initial theme: persisted preference > option > auto
	const initialTheme: Theme = loadPersistedTheme() ?? options.theme ?? "auto"

	// ── Root element ──────────────────────────────────────────────────────────

	const el = document.createElement("div")
	el.className = "op-root"
	applyTheme(el, initialTheme)
	container.appendChild(el)

	// ── Stores ────────────────────────────────────────────────────────────────

	const dashStore = new DashboardStore()
	const defStore = new DefinitionsStore()
	const instStore = new InstancesStore()
	const incStore = new IncidentsStore()
	const jobStore = new JobsStore()
	const taskStore = new TasksStore()

	// Disconnect every store to free all HTTP connection slots.
	function disconnectAll(): void {
		dashStore.disconnect()
		defStore.disconnect()
		instStore.disconnect()
		incStore.disconnect()
		jobStore.disconnect()
		taskStore.disconnect()
	}

	// Called when profile changes — reconnects only the currently active stores.
	let reconnectCurrent: (() => void) | null = null

	function connectAll(): void {
		reconnectCurrent?.()
	}

	// ── Profiles ──────────────────────────────────────────────────────────────

	let profiles: ProfileInfo[] = []

	if (!mock) {
		fetchProfiles()
	} else {
		profiles = [{ name: "demo", active: true, apiType: "saas", baseUrl: null, authType: "none" }]
	}

	function fetchProfiles(): void {
		fetch(`${proxyUrl}/profiles`)
			.then((r) => r.json())
			.then((data: ProfileInfo[]) => {
				profiles = data
				const active = data.find((p) => p.active)
				if (!profile && active) profile = active.name
				header.setProfiles(profiles, profile)
			})
			.catch(() => {
				// proxy not running — silently ignore
			})
	}

	// ── Layout ────────────────────────────────────────────────────────────────

	const layout = document.createElement("div")
	layout.className = "op-layout"
	el.appendChild(layout)

	const router = createRouter()

	const nav = createNav((path) => router.navigate(path))
	layout.appendChild(nav.el)

	const main = document.createElement("div")
	main.className = "op-main"
	layout.appendChild(main)

	const header = createHeader(
		(name) => {
			profile = name
			connectAll()
		},
		(theme, resolved) => {
			el.setAttribute("data-theme", resolved)
			// Keep instance-detail canvas in sync
			currentTheme = theme
		},
		initialTheme,
	)
	header.setProfiles(profiles, profile)
	main.appendChild(header.el)

	const content = document.createElement("div")
	content.className = "op-content"
	main.appendChild(content)

	// ── Router ────────────────────────────────────────────────────────────────

	let destroyView: (() => void) | null = null
	let currentTheme: Theme = initialTheme

	function showView(viewEl: HTMLElement, destroy: () => void): void {
		destroyView?.()
		destroyView = destroy
		content.innerHTML = ""
		content.appendChild(viewEl)
	}

	router.on("/", () => {
		reconnectCurrent = () => {
			disconnectAll()
			dashStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Dashboard")
		nav.setActive("/")
		const { el: vEl, destroy } = createDashboardView(dashStore, (path) => router.navigate(path))
		showView(vEl, destroy)
	})

	router.on("/definitions", () => {
		reconnectCurrent = () => {
			disconnectAll()
			defStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Processes")
		nav.setActive("/definitions")
		const { el: vEl, destroy } = createDefinitionsView(defStore, (def) => {
			router.navigate(`/definitions/${def.processDefinitionKey ?? ""}`)
		})
		showView(vEl, destroy)
	})

	router.on("/definitions/:key", (params) => {
		// Disconnect all stores: no polling while the XML fetch is in-flight.
		disconnectAll()
		reconnectCurrent = () => {
			disconnectAll()
		}
		header.setTitle("Process Definition")
		nav.setActive("/definitions")
		const { el: vEl, destroy } = createDefinitionDetailView(
			params.key ?? "",
			defStore,
			{
				proxyUrl,
				profile,
				mock,
				theme: el.getAttribute("data-theme") === "light" ? "light" : "dark",
			},
			() => router.navigate("/definitions"),
		)
		showView(vEl, destroy)
	})

	router.on("/instances", () => {
		reconnectCurrent = () => {
			disconnectAll()
			instStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Instances")
		nav.setActive("/instances")
		const { el: vEl, destroy } = createInstancesView(
			instStore,
			(inst) => router.navigate(`/instances/${inst.processInstanceKey}`),
			(state) => {
				instStore.connect(proxyUrl, profile, pollInterval, mock, { state: state || undefined })
			},
		)
		showView(vEl, destroy)
	})

	router.on("/instances/:key", (params) => {
		// Keep only instStore connected (needed to look up processDefinitionKey for the XML fetch).
		reconnectCurrent = () => {
			disconnectAll()
			instStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		const instanceKey = params.key ?? ""
		header.setTitle(`Instance ${instanceKey}`)
		nav.setActive("/instances")
		const { el: vEl, destroy } = createInstanceDetailView(
			instanceKey,
			instStore,
			{
				proxyUrl,
				profile,
				interval: pollInterval,
				mock,
				theme: el.getAttribute("data-theme") === "light" ? "light" : "dark",
			},
			() => router.navigate("/instances"),
		)
		showView(vEl, destroy)
	})

	router.on("/incidents", () => {
		reconnectCurrent = () => {
			disconnectAll()
			incStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Incidents")
		nav.setActive("/incidents")
		const { el: vEl, destroy } = createIncidentsView(incStore)
		showView(vEl, destroy)
	})

	router.on("/jobs", () => {
		reconnectCurrent = () => {
			disconnectAll()
			jobStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Jobs")
		nav.setActive("/jobs")
		const { el: vEl, destroy } = createJobsView(jobStore)
		showView(vEl, destroy)
	})

	router.on("/tasks", () => {
		reconnectCurrent = () => {
			disconnectAll()
			taskStore.connect(proxyUrl, profile, pollInterval, mock)
		}
		reconnectCurrent()
		header.setTitle("Tasks")
		nav.setActive("/tasks")
		const { el: vEl, destroy } = createTasksView(taskStore)
		showView(vEl, destroy)
	})

	const stopRouter = router.start()

	// ── Public API ────────────────────────────────────────────────────────────

	return {
		el,

		setProfile(name: string | null): void {
			profile = name
			connectAll()
			header.setProfiles(profiles, profile)
		},

		setTheme(t: Theme): void {
			currentTheme = t
			applyTheme(el, t)
			header.setTheme(t)
		},

		navigate(path: string): void {
			router.navigate(path)
		},

		destroy(): void {
			stopRouter()
			destroyView?.()
			dashStore.destroy()
			defStore.destroy()
			instStore.destroy()
			incStore.destroy()
			jobStore.destroy()
			taskStore.destroy()
			el.remove()
		},
	}
}
