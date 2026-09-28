// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
	DecisionsStore,
	DefinitionsStore,
	InstancesStore,
	createDecisionDetailView,
	createDefinitionDetailView,
	createInstanceDetailView,
	createOperate,
} from "../src/index.js"
import { MOCK_BPMN_XML, MOCK_INCIDENTS, MOCK_INSTANCES } from "../src/mock-data.js"
import { IncidentsStore } from "../src/stores/incidents.js"
import type { OperateApi, ProcessInstanceResult } from "../src/types.js"
import { createIncidentDetailView } from "../src/views/incident-detail.js"

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve()
	await new Promise((r) => setTimeout(r, 0))
}

/** Route a mocked fetch by URL path. Unknown paths answer 404. */
function routeFetch(
	routes: Record<string, (url: URL, init?: RequestInit) => Response>,
): ReturnType<typeof vi.fn> {
	return vi.fn(async (input: string | URL, init?: RequestInit) => {
		const url = new URL(String(input), "http://page.test")
		const handler = routes[url.pathname]
		return handler ? handler(url, init) : jsonResponse({ error: "not found" }, 404)
	})
}

async function go(path: string): Promise<void> {
	window.location.hash = path
	window.dispatchEvent(new HashChangeEvent("hashchange"))
	await flush()
}

const rowCount = (el: HTMLElement): number => el.querySelectorAll(".bpmnkit-table-row").length
const title = (el: HTMLElement): string => el.querySelector(".op-header-title")?.textContent ?? ""

let container: HTMLElement
let api: OperateApi | null = null

beforeEach(() => {
	window.location.hash = ""
	try {
		localStorage.clear()
	} catch {
		// storage unavailable
	}
	container = document.createElement("div")
	document.body.appendChild(container)
})

afterEach(() => {
	api?.destroy()
	api = null
	document.body.innerHTML = ""
	vi.unstubAllGlobals()
})

describe("createOperate — mock mode", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => {
				throw new Error("mock mode must not touch the network")
			}),
		)
	})

	it("mounts the shell and opens on the dashboard", () => {
		api = createOperate({ container, mock: true, pollInterval: 0 })
		expect(container.contains(api.el)).toBe(true)
		expect(api.el.getAttribute("data-theme")).toBe("light")
		expect(api.el.querySelectorAll(".op-nav-item")).toHaveLength(9)
		expect(title(api.el)).toBe("Dashboard")
		expect(api.el.querySelectorAll(".op-dash-card")).toHaveLength(5)
		expect(api.el.querySelector<HTMLSelectElement>(".op-profile-select")?.value).toBe("demo")
	})

	it("routes to each list view", async () => {
		api = createOperate({ container, mock: true, pollInterval: 0 })
		for (const [path, heading] of [
			["/definitions", "Processes"],
			["/decisions", "Decisions"],
			["/instances", "Instances"],
			["/incidents", "Incidents"],
			["/jobs", "Jobs"],
			["/tasks", "Tasks"],
			["/messages", "Messages & Signals"],
			["/search", "Search"],
		] as const) {
			await go(path)
			expect(title(api.el)).toBe(heading)
			expect(api.el.querySelector(".op-nav-item--active")?.getAttribute("data-path")).toBe(path)
		}
	})

	it("navigate() changes the route", async () => {
		api = createOperate({ container, mock: true, pollInterval: 0 })
		api.navigate("/jobs")
		window.dispatchEvent(new HashChangeEvent("hashchange"))
		await flush()
		expect(title(api.el)).toBe("Jobs")
	})

	// Regression: the /definitions/:key route disconnected the definitions
	// store, so a deep link never learned the definition's name or versions.
	it("resolves a deep-linked process definition", async () => {
		window.location.hash = "/definitions/pd-1"
		api = createOperate({ container, mock: true, pollInterval: 0 })
		await flush()
		expect(title(api.el)).toBe("Process Definition")
		expect(api.el.querySelector(".op-def-meta-name")?.textContent).toBe("Order Processing")
	})

	// Regression: a profile change only reconnected the store, so the instances
	// view kept showing "Completed" while the store served every state.
	it("rebuilds the current view when the profile changes", async () => {
		api = createOperate({ container, mock: true, pollInterval: 0 })
		await go("/instances")
		const completed = MOCK_INSTANCES.filter((i) => i.state === "COMPLETED").length
		const btn = Array.from(api.el.querySelectorAll<HTMLElement>(".op-filter-btn")).find(
			(b) => b.textContent === "Completed",
		)
		btn?.click()
		expect(rowCount(api.el)).toBe(completed)

		api.setProfile("other")
		expect(api.el.querySelector(".op-filter-btn--active")?.textContent).toBe("All")
		expect(rowCount(api.el)).toBe(MOCK_INSTANCES.length)
	})

	// Regression: setTheme() re-themed the chrome but not the open diagram.
	it("setTheme() re-themes the chrome and the open detail view", async () => {
		window.location.hash = "/definitions/pd-1"
		api = createOperate({ container, mock: true, pollInterval: 0 })
		await flush()
		api.setTheme("dark")
		expect(api.el.getAttribute("data-theme")).toBe("dark")
		expect(api.el.querySelector<HTMLElement>(".op-detail-sidebar")?.dataset.bpmnkitHudTheme).toBe(
			"dark",
		)
	})

	it("honours the theme option", () => {
		api = createOperate({ container, mock: true, pollInterval: 0, theme: "neon" })
		expect(api.el.getAttribute("data-theme")).toBe("neon")
	})

	it("destroy() removes the root and stops routing", async () => {
		const local = createOperate({ container, mock: true, pollInterval: 0 })
		local.destroy()
		expect(container.children).toHaveLength(0)
		await go("/jobs")
		expect(container.children).toHaveLength(0)
	})
})

describe("createOperate — live mode", () => {
	it("loads profiles and polls with the active profile", async () => {
		const fetchMock = routeFetch({
			"/profiles": () =>
				jsonResponse([
					{
						name: "c8run",
						active: true,
						apiType: "c8",
						baseUrl: "http://localhost:8080/v2",
						authType: "none",
					},
					{
						name: "saas",
						active: false,
						apiType: "c8",
						baseUrl: "https://x/v2",
						authType: "oauth2",
					},
				]),
			"/operate/stream": () => jsonResponse({ items: [], total: 0 }),
		})
		vi.stubGlobal("fetch", fetchMock)
		window.location.hash = "/jobs"
		api = createOperate({ container, proxyUrl: "http://proxy:3033", pollInterval: 0 })
		await flush()
		const select = api.el.querySelector<HTMLSelectElement>(".op-profile-select")
		expect(Array.from(select?.options ?? []).map((o) => o.value)).toEqual(["c8run", "saas"])
		expect(select?.value).toBe("c8run")

		const streamCall = fetchMock.mock.calls
			.map((c) => new URL(String(c[0])))
			.find((u) => u.pathname === "/operate/stream")
		expect(streamCall?.origin).toBe("http://proxy:3033")
		expect(streamCall?.searchParams.get("topic")).toBe("jobs")

		if (!select) throw new Error("no profile select")
		select.value = "saas"
		select.dispatchEvent(new Event("change"))
		await flush()
		const last = new URL(String(fetchMock.mock.calls.at(-1)?.[0]))
		expect(last.searchParams.get("profile")).toBe("saas")
	})

	// Regression: poll failures were never shown; the user saw an empty table.
	it("shows poll errors in an alert and hides it once data arrives", async () => {
		let fail = true
		vi.stubGlobal(
			"fetch",
			routeFetch({
				"/profiles": () => jsonResponse([]),
				"/operate/stream": () =>
					fail
						? jsonResponse({ error: "No active profile" }, 401)
						: jsonResponse({ items: [], total: 0 }),
			}),
		)
		window.location.hash = "/incidents"
		api = createOperate({ container, proxyUrl: "http://proxy", pollInterval: 0 })
		await flush()
		const alert = api.el.querySelector<HTMLElement>('[role="alert"]')
		expect(alert?.hidden).toBe(false)
		expect(alert?.textContent).toBe("HTTP 401: No active profile")

		fail = false
		api.setProfile("fixed")
		await flush()
		expect(alert?.hidden).toBe(true)
	})
})

// ── Detail views (exported for BPMN Kit Studio) ───────────────────────────────

class FedInstancesStore extends InstancesStore {
	feed(items: ProcessInstanceResult[]): void {
		this.set({ data: { items, total: items.length }, loading: false, error: null })
	}
}

describe("createInstanceDetailView", () => {
	const instance = {
		...(MOCK_INSTANCES[0] as ProcessInstanceResult),
		processInstanceKey: "2251799813690001",
		processDefinitionKey: "2251799813685249",
	}

	function liveFetch(xmlStatus: number): ReturnType<typeof vi.fn> {
		return routeFetch({
			"/api/process-instances/2251799813690001": () => jsonResponse(instance),
			"/api/process-definitions/2251799813685249/xml": () =>
				xmlStatus === 200
					? new Response(MOCK_BPMN_XML, { status: 200 })
					: jsonResponse({ error: "Auth failed" }, xmlStatus),
			"/api/element-instances/search": () => jsonResponse({ items: [] }),
			"/api/variables/search": () =>
				jsonResponse({
					items: [
						{
							name: "amount",
							value: "42",
							variableKey: "1",
							processInstanceKey: instance.processInstanceKey,
						},
						{
							name: "amount",
							value: "43",
							variableKey: "2",
							processInstanceKey: instance.processInstanceKey,
						},
					],
				}),
			"/operate/stream": () => jsonResponse({ items: [], total: 0 }),
		})
	}

	function mount(store: InstancesStore, onOpenInEditor?: (xml: string, name: string) => void) {
		const view = createInstanceDetailView(
			instance.processInstanceKey,
			store,
			{
				proxyUrl: "http://proxy",
				profile: "dev",
				interval: 0,
				mock: false,
				theme: "light",
				onOpenInEditor,
			},
			vi.fn(),
		)
		document.body.appendChild(view.el)
		return view
	}

	// Regression: an instance missing from the list store (deep link, or older
	// than the first page) had its header wiped on every poll.
	it("keeps a deep-linked instance's header across polls", async () => {
		vi.stubGlobal("fetch", liveFetch(200))
		const store = new FedInstancesStore()
		const view = mount(store)
		await flush()
		expect(view.el.querySelector(".op-instance-key")?.textContent).toBe(instance.processInstanceKey)
		store.feed([MOCK_INSTANCES[1] as ProcessInstanceResult])
		expect(view.el.querySelector(".op-instance-key")?.textContent).toBe(instance.processInstanceKey)
		view.destroy()
	})

	it("loads the diagram and keeps the newest value of a duplicated variable", async () => {
		vi.stubGlobal("fetch", liveFetch(200))
		const onOpen = vi.fn()
		const view = mount(new FedInstancesStore(), onOpen)
		await flush()
		await flush()
		const values = Array.from(view.el.querySelectorAll(".op-var-value")).map((v) => v.textContent)
		expect(values).toEqual(["43"])
		const openBtn = Array.from(view.el.querySelectorAll<HTMLElement>(".op-action-btn")).find((b) =>
			b.textContent?.startsWith("Open in Editor"),
		)
		expect(openBtn?.style.display).toBe("")
		openBtn?.click()
		expect(onOpen).toHaveBeenCalledWith(MOCK_BPMN_XML, instance.processDefinitionName)
		view.destroy()
	})

	// Regression: a failed XML request's error body was handed to the canvas.
	it("does not load an error response as a diagram", async () => {
		vi.stubGlobal("fetch", liveFetch(502))
		const view = mount(new FedInstancesStore(), vi.fn())
		await flush()
		await flush()
		const openBtn = Array.from(view.el.querySelectorAll<HTMLElement>(".op-action-btn")).find((b) =>
			b.textContent?.startsWith("Open in Editor"),
		)
		expect(openBtn?.style.display).toBe("none")
		view.destroy()
	})

	it("sends the profile header on proxy API calls", async () => {
		const fetchMock = liveFetch(200)
		vi.stubGlobal("fetch", fetchMock)
		const view = mount(new FedInstancesStore())
		await flush()
		const apiCall = fetchMock.mock.calls.find((c) =>
			String(c[0]).includes("/api/process-instances/"),
		)
		expect((apiCall?.[1] as RequestInit | undefined)?.headers).toMatchObject({ "x-profile": "dev" })
		view.destroy()
	})
})

describe("createDefinitionDetailView", () => {
	// Regression: as above, for the definition diagram.
	it("shows a failure message when the XML request fails", async () => {
		vi.stubGlobal(
			"fetch",
			routeFetch({
				"/api/process-definitions/pd-1/xml": () => jsonResponse({ error: "boom" }, 500),
			}),
		)
		const store = new DefinitionsStore()
		// Fixture data in the store, live requests for the diagram
		store.connect("", null, 0, true)
		const view = createDefinitionDetailView(
			"pd-1",
			store,
			{
				proxyUrl: "http://proxy",
				profile: null,
				mock: false,
				theme: "light",
				onOpenInEditor: vi.fn(),
			},
			vi.fn(),
		)
		await flush()
		expect(view.el.textContent).toContain("Failed to load diagram")
		// The error body must not be offered to "Open in Editor" as BPMN
		const openBtn = Array.from(view.el.querySelectorAll<HTMLElement>(".op-action-btn")).find((b) =>
			b.textContent?.startsWith("Open in Editor"),
		)
		expect(openBtn?.style.display).toBe("none")
		view.destroy()
	})

	it("renders the definition from the store in mock mode", () => {
		const store = new DefinitionsStore()
		store.connect("", null, 0, true)
		const view = createDefinitionDetailView(
			"pd-1",
			store,
			{ proxyUrl: "", profile: null, mock: true, theme: "light" },
			vi.fn(),
		)
		expect(view.el.querySelector(".op-def-meta-name")?.textContent).toBe("Order Processing")
		view.setTheme("dark")
		view.destroy()
	})
})

describe("createDecisionDetailView", () => {
	it("renders the decision and offers its versions", () => {
		const store = new DecisionsStore()
		store.connect("", null, 0, true)
		const first = store.state.data?.items[0]
		if (!first) throw new Error("no mock decision")
		const navigate = vi.fn()
		const view = createDecisionDetailView(
			first.decisionDefinitionKey,
			store,
			{ proxyUrl: "", profile: null, mock: true, theme: "light", navigate },
			vi.fn(),
		)
		expect(view.el.querySelector(".op-def-meta-name")?.textContent).toBe(
			first.name ?? first.decisionDefinitionId,
		)
		view.destroy()
	})
})

describe("createIncidentDetailView", () => {
	function mount(): { el: HTMLElement; destroy(): void } {
		const store = new IncidentsStore()
		store.connect("", null, 0, true) // fixture incidents, live actions
		const view = createIncidentDetailView(
			"inc-1",
			store,
			{ proxyUrl: "http://proxy", profile: "dev", mock: false, theme: "light" },
			vi.fn(),
		)
		document.body.appendChild(view.el)
		return view
	}

	// Regression: "Retry Job" sent PATCH /jobs/{key}/retries with { retries },
	// which the Orchestration Cluster API does not have.
	it("retries a job through PATCH /jobs/{jobKey} with a changeset", async () => {
		const fetchMock = routeFetch({
			"/api/process-definitions/pd-1/xml": () => new Response(MOCK_BPMN_XML),
			"/api/jobs/job-3": (_url, init) =>
				init?.method === "PATCH" ? new Response(null, { status: 204 }) : jsonResponse({}),
		})
		vi.stubGlobal("fetch", fetchMock)
		const view = mount()
		await flush()
		const retry = Array.from(view.el.querySelectorAll<HTMLElement>(".op-action-btn")).find(
			(b) => b.textContent === "↻ Retry Job",
		)
		expect(MOCK_INCIDENTS[0]?.errorType).toBe("JOB_NO_RETRIES")
		retry?.click()
		await flush()
		const patch = fetchMock.mock.calls.find(
			(c) => (c[1] as RequestInit | undefined)?.method === "PATCH",
		)
		expect(String(patch?.[0])).toBe("http://proxy/api/jobs/job-3")
		expect(JSON.parse(String((patch?.[1] as RequestInit).body))).toEqual({
			changeset: { retries: 3 },
		})
		expect(view.el.textContent).toContain("Job retries updated.")
		view.destroy()
	})

	it("resolves an incident through POST /incidents/{key}/resolution", async () => {
		const fetchMock = routeFetch({
			"/api/process-definitions/pd-1/xml": () => new Response(MOCK_BPMN_XML),
			"/api/incidents/inc-1/resolution": () => new Response(null, { status: 204 }),
		})
		vi.stubGlobal("fetch", fetchMock)
		const view = mount()
		await flush()
		Array.from(view.el.querySelectorAll<HTMLElement>(".op-action-btn"))
			.find((b) => b.textContent === "✓ Resolve Incident")
			?.click()
		await flush()
		expect(view.el.textContent).toContain("Incident resolved.")
		view.destroy()
	})

	// Regression: a failed direct lookup rendered the error body as an incident.
	it("falls back to the key when a deep-linked incident cannot be loaded", async () => {
		vi.stubGlobal(
			"fetch",
			routeFetch({ "/api/incidents/404404": () => jsonResponse({ error: "nope" }, 404) }),
		)
		const view = createIncidentDetailView(
			"404404",
			new IncidentsStore(),
			{ proxyUrl: "http://proxy", profile: null, mock: false, theme: "light" },
			vi.fn(),
		)
		await flush()
		expect(view.el.querySelector(".op-instance-meta")?.textContent).toBe("Incident 404404")
		view.destroy()
	})
})
