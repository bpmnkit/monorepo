import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { MOCK_INCIDENTS, MOCK_INSTANCES, MOCK_JOBS, MOCK_TASKS } from "../src/mock-data.js"
import { DashboardStore } from "../src/stores/dashboard.js"
import { DecisionsStore } from "../src/stores/decisions.js"
import { DefinitionsStore } from "../src/stores/definitions.js"
import { IncidentsStore } from "../src/stores/incidents.js"
import { InstancesStore } from "../src/stores/instances.js"
import { JobsStore } from "../src/stores/jobs.js"
import { TasksStore } from "../src/stores/tasks.js"

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	})
}

async function flush(): Promise<void> {
	for (let i = 0; i < 5; i++) await Promise.resolve()
	await new Promise((r) => setImmediate(r))
}

function requestedUrl(fetchMock: ReturnType<typeof vi.fn>, call = 0): URL {
	return new URL(String(fetchMock.mock.calls[call]?.[0]))
}

describe("stores — live mode", () => {
	let fetchMock: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
		fetchMock = vi.fn(async () => jsonResponse({ items: [], total: 0 }))
		vi.stubGlobal("fetch", fetchMock)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.unstubAllGlobals()
	})

	it.each([
		["dashboard", () => new DashboardStore()],
		["definitions", () => new DefinitionsStore()],
		["decisions", () => new DecisionsStore()],
		["instances", () => new InstancesStore()],
		["incidents", () => new IncidentsStore()],
		["jobs", () => new JobsStore()],
		["tasks", () => new TasksStore()],
	])("%s store polls its topic with profile and interval", async (topic, make) => {
		const store = make()
		store.connect("http://proxy:3033", "dev", 15_000, false)
		await flush()
		const url = requestedUrl(fetchMock)
		expect(url.origin + url.pathname).toBe("http://proxy:3033/operate/stream")
		expect(url.searchParams.get("topic")).toBe(topic)
		expect(url.searchParams.get("profile")).toBe("dev")
		expect(url.searchParams.get("interval")).toBe("15000")
		store.destroy()
	})

	it("omits the profile parameter when none is set, so the proxy uses its active profile", async () => {
		const store = new JobsStore()
		store.connect("http://proxy", null, 30_000, false)
		await flush()
		expect(requestedUrl(fetchMock).searchParams.has("profile")).toBe(false)
		store.destroy()
	})

	it("sends instance filters and page to the proxy", async () => {
		const store = new InstancesStore()
		store.connect("http://proxy", null, 30_000, false, {
			state: "ACTIVE",
			processDefinitionKey: "2251799813685249",
			page: 2,
		})
		await flush()
		const params = requestedUrl(fetchMock).searchParams
		expect(params.get("state")).toBe("ACTIVE")
		expect(params.get("processDefinitionKey")).toBe("2251799813685249")
		expect(params.get("page")).toBe("2")
		store.destroy()
	})

	it("scopes incidents to one process instance", async () => {
		const store = new IncidentsStore()
		store.connect("http://proxy", null, 30_000, false, "2251799813690001")
		await flush()
		expect(requestedUrl(fetchMock).searchParams.get("processInstanceKey")).toBe("2251799813690001")
		store.destroy()
	})

	it("moves through loading → data and notifies subscribers", async () => {
		const payload = { items: MOCK_JOBS, total: MOCK_JOBS.length }
		fetchMock.mockImplementation(async () => jsonResponse(payload))
		const store = new JobsStore()
		const seen: boolean[] = []
		store.subscribe(() => seen.push(store.state.loading))
		store.connect("http://proxy", null, 30_000, false)
		expect(store.state.loading).toBe(true)
		await flush()
		expect(store.state).toEqual({ data: payload, loading: false, error: null })
		expect(seen).toEqual([true, false])
		store.destroy()
	})

	it("keeps the last data when a poll fails and surfaces the error", async () => {
		fetchMock.mockImplementationOnce(async () => jsonResponse({ items: [], total: 0 }))
		fetchMock.mockImplementationOnce(async () => jsonResponse({ error: "Auth failed" }, 502))
		const store = new TasksStore()
		store.connect("http://proxy", null, 5_000, false)
		await flush()
		vi.advanceTimersByTime(5_000)
		await flush()
		expect(store.state.error).toBe("HTTP 502: Auth failed")
		expect(store.state.data).toEqual({ items: [], total: 0 })
		store.destroy()
	})

	// Regression: a successful poll after a failed one left the old error set.
	it("clears the error once a poll succeeds again", async () => {
		fetchMock.mockImplementationOnce(async () => {
			throw new TypeError("offline")
		})
		fetchMock.mockImplementation(async () => jsonResponse({ items: [], total: 0 }))
		const store = new IncidentsStore()
		store.connect("http://proxy", null, 5_000, false)
		await flush()
		expect(store.state.error).toBe("Connection error. Retrying…")
		vi.advanceTimersByTime(5_000)
		await flush()
		expect(store.state.error).toBeNull()
		store.destroy()
	})

	it("reconnecting replaces the previous poll", async () => {
		const store = new InstancesStore()
		store.connect("http://proxy", "a", 5_000, false)
		store.connect("http://proxy", "b", 5_000, false)
		await flush()
		fetchMock.mockClear()
		vi.advanceTimersByTime(5_000)
		await flush()
		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(requestedUrl(fetchMock).searchParams.get("profile")).toBe("b")
		store.destroy()
	})

	it("disconnect stops polling but keeps data and listeners; destroy drops listeners", async () => {
		const store = new DefinitionsStore()
		const listener = vi.fn()
		store.subscribe(listener)
		store.connect("http://proxy", null, 5_000, false)
		await flush()
		store.disconnect()
		fetchMock.mockClear()
		vi.advanceTimersByTime(30_000)
		await flush()
		expect(fetchMock).not.toHaveBeenCalled()
		expect(store.state.data).toEqual({ items: [], total: 0 })

		listener.mockClear()
		store.connect("http://proxy", null, 5_000, false)
		expect(listener).toHaveBeenCalled()
		store.destroy()
		listener.mockClear()
		store.connect("http://proxy", null, 5_000, false)
		expect(listener).not.toHaveBeenCalled()
		store.destroy()
	})

	it("subscribe returns an unsubscribe function", () => {
		const store = new DecisionsStore()
		const listener = vi.fn()
		const unsub = store.subscribe(listener)
		unsub()
		store.connect("http://proxy", null, 5_000, true)
		expect(listener).not.toHaveBeenCalled()
		store.destroy()
	})
})

describe("stores — mock mode", () => {
	beforeEach(() => {
		vi.stubGlobal(
			"fetch",
			vi.fn(() => {
				throw new Error("mock mode must not touch the network")
			}),
		)
	})
	afterEach(() => vi.unstubAllGlobals())

	it("serves fixture data synchronously", () => {
		const jobs = new JobsStore()
		jobs.connect("http://proxy", null, 0, true)
		expect(jobs.state.data?.total).toBe(MOCK_JOBS.length)
		const tasks = new TasksStore()
		tasks.connect("http://proxy", null, 0, true)
		expect(tasks.state.data?.items).toBe(MOCK_TASKS)
		const dash = new DashboardStore()
		dash.connect("http://proxy", null, 0, true)
		expect(dash.state.data?.activeInstances).toBeTypeOf("number")
		const defs = new DefinitionsStore()
		defs.connect("http://proxy", null, 0, true)
		expect(defs.state.data?.items.length).toBeGreaterThan(0)
		const decs = new DecisionsStore()
		decs.connect("http://proxy", null, 0, true)
		expect(decs.state.data?.items.length).toBeGreaterThan(0)
	})

	it("filters instances by state and definition key", () => {
		const store = new InstancesStore()
		store.connect("http://proxy", null, 0, true, { state: "COMPLETED" })
		const completed = store.state.data?.items ?? []
		expect(completed.length).toBeGreaterThan(0)
		expect(completed.every((i) => i.state === "COMPLETED")).toBe(true)
		expect(store.state.data?.total).toBe(completed.length)

		store.connect("http://proxy", null, 0, true, { processDefinitionKey: "pd-1" })
		const byDef = store.state.data?.items ?? []
		expect(byDef.length).toBe(
			MOCK_INSTANCES.filter((i) => i.processDefinitionKey === "pd-1").length,
		)
	})

	it("filters incidents by process instance", () => {
		const store = new IncidentsStore()
		store.connect("http://proxy", null, 0, true, "pi-2")
		const items = store.state.data?.items ?? []
		expect(items.length).toBe(MOCK_INCIDENTS.filter((i) => i.processInstanceKey === "pi-2").length)
		expect(items.every((i) => i.processInstanceKey === "pi-2")).toBe(true)
	})
})
