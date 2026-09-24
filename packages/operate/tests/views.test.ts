// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	MOCK_DEFINITIONS,
	MOCK_INCIDENTS,
	MOCK_INSTANCES,
	MOCK_JOBS,
	MOCK_TASKS,
} from "../src/mock-data.js"
import { DashboardStore } from "../src/stores/dashboard.js"
import { DecisionsStore } from "../src/stores/decisions.js"
import { DefinitionsStore } from "../src/stores/definitions.js"
import { IncidentsStore } from "../src/stores/incidents.js"
import { InstancesStore } from "../src/stores/instances.js"
import { JobsStore } from "../src/stores/jobs.js"
import { TasksStore } from "../src/stores/tasks.js"
import type { ProcessInstanceResult } from "../src/types.js"
import { createDashboardView } from "../src/views/dashboard.js"
import { createDecisionsView } from "../src/views/decisions.js"
import { createDefinitionsView } from "../src/views/definitions.js"
import { createHeader } from "../src/views/header.js"
import { createIncidentsView } from "../src/views/incidents.js"
import { createInstancesView } from "../src/views/instances.js"
import { createJobsView } from "../src/views/jobs.js"
import { createNav } from "../src/views/nav.js"
import { createTasksView } from "../src/views/tasks.js"

/** Text of column `col` for every rendered row. */
function column(el: HTMLElement, col: number): string[] {
	return Array.from(el.querySelectorAll(".bpmnkit-table-row")).map(
		(r) => r.querySelectorAll(".bpmnkit-table-td")[col]?.textContent ?? "",
	)
}

function clickButton(el: HTMLElement, selector: string, text: string): void {
	const btn = Array.from(el.querySelectorAll<HTMLElement>(selector)).find(
		(b) => b.textContent === text,
	)
	if (!btn) throw new Error(`no ${selector} "${text}"`)
	btn.click()
}

/** A store fed by hand, standing in for a poll response. */
class FedInstancesStore extends InstancesStore {
	feed(items: ProcessInstanceResult[]): void {
		this.set({ data: { items, total: items.length }, loading: false, error: null })
	}
}

afterEach(() => {
	document.body.innerHTML = ""
})

describe("dashboard view", () => {
	it("renders a card per metric and navigates on click", () => {
		const store = new DashboardStore()
		store.connect("", null, 0, true)
		const onNavigate = vi.fn()
		const view = createDashboardView(store, onNavigate)
		document.body.appendChild(view.el)

		const cards = Array.from(view.el.querySelectorAll<HTMLElement>(".op-dash-card"))
		expect(cards.map((c) => c.querySelector(".op-dash-card-label")?.textContent)).toEqual([
			"Active Instances",
			"Open Incidents",
			"Active Jobs",
			"Pending Tasks",
			"Deployed Processes",
		])
		expect(cards[1]?.querySelector(".op-dash-card-value")?.textContent).toBe(
			String(store.state.data?.openIncidents),
		)
		cards[1]?.click()
		expect(onNavigate).toHaveBeenCalledWith("/incidents")
		view.destroy()
	})

	it("shows placeholders before data and usage cards only when usage arrives", () => {
		const store = new DashboardStore()
		const view = createDashboardView(store, vi.fn())
		expect(view.el.querySelector(".op-dash-card-value")?.textContent).toBe("—")
		const usage = view.el.querySelector<HTMLElement>(".op-usage-section")
		expect(usage?.style.display).toBe("none")
		view.destroy()
	})
})

describe("definitions view", () => {
	it("groups versions of one process into a row showing the latest", () => {
		const store = new DefinitionsStore()
		store.connect("", null, 0, true)
		const onSelect = vi.fn()
		const view = createDefinitionsView(store, onSelect)
		const ids = new Set(MOCK_DEFINITIONS.map((d) => d.processDefinitionId))
		expect(column(view.el, 0)).toHaveLength(ids.size)

		const orderRow = column(view.el, 0).indexOf("Order Processing")
		expect(column(view.el, 2)[orderRow]).toBe("3")
		expect(column(view.el, 3)[orderRow]).toBe("v3.1")
		view.el.querySelectorAll<HTMLElement>(".bpmnkit-table-row")[orderRow]?.click()
		expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ processDefinitionKey: "pd-1" }))
		view.destroy()
	})
})

describe("decisions view", () => {
	it("lists one row per decision id", () => {
		const store = new DecisionsStore()
		store.connect("", null, 0, true)
		const view = createDecisionsView(store, vi.fn())
		const ids = new Set(store.state.data?.items.map((d) => d.decisionDefinitionId))
		expect(column(view.el, 0)).toHaveLength(ids.size)
		view.destroy()
	})
})

describe("instances view", () => {
	it("renders instances and reports state filter clicks", () => {
		const store = new InstancesStore()
		store.connect("", null, 0, true)
		const onFilter = vi.fn()
		const onSelect = vi.fn()
		const view = createInstancesView(store, onSelect, onFilter)
		expect(column(view.el, 0)).toHaveLength(MOCK_INSTANCES.length)

		clickButton(view.el, ".op-filter-btn", "Completed")
		expect(onFilter).toHaveBeenCalledWith("COMPLETED")
		expect(view.el.querySelector(".op-filter-btn--active")?.textContent).toBe("Completed")

		view.el.querySelector<HTMLElement>(".bpmnkit-table-row")?.click()
		expect(onSelect).toHaveBeenCalledWith(MOCK_INSTANCES[0])
		view.destroy()
	})

	it("shows the parent chain and filters by root process", () => {
		const base = MOCK_INSTANCES[0] as ProcessInstanceResult
		const parent = { ...base, processInstanceKey: "1", processDefinitionId: "order" }
		const child = {
			...base,
			processInstanceKey: "2",
			processDefinitionId: "payment",
			processDefinitionName: "Payment",
			parentProcessInstanceKey: "1",
			rootProcessInstanceKey: "1",
		}
		const orphan = {
			...base,
			processInstanceKey: "3",
			processDefinitionId: "shipping",
			processDefinitionName: "Shipping",
			parentProcessInstanceKey: "999",
		}
		const other = {
			...base,
			processInstanceKey: "4",
			processDefinitionId: "billing",
			processDefinitionName: "Billing",
		}
		const store = new FedInstancesStore()
		store.feed([
			{ ...parent, processDefinitionName: "Order" },
			child,
			orphan,
			other,
		] as ProcessInstanceResult[])
		const view = createInstancesView(store, vi.fn())
		expect(column(view.el, 1)).toEqual(["Order", "Order / Payment", "… / Shipping", "Billing"])

		const select = view.el.querySelector<HTMLSelectElement>(".op-proc-filter-select")
		if (!select) throw new Error("no process filter")
		// Sub-processes are not offered as roots
		expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
			"All",
			"Billing",
			"Order",
		])
		select.value = "order"
		select.dispatchEvent(new Event("change"))
		expect(column(view.el, 0)).toEqual(["1", "2"])
		view.destroy()
	})

	// Regression: each poll reset the table to page 1.
	it("keeps the page across polls", () => {
		const base = MOCK_INSTANCES[0] as ProcessInstanceResult
		const many = Array.from({ length: 25 }, (_, i) => ({
			...base,
			processInstanceKey: String(i + 1),
		}))
		const store = new FedInstancesStore()
		store.feed(many)
		const view = createInstancesView(store, vi.fn())
		view.el.querySelectorAll<HTMLButtonElement>(".op-pagination-btn")[1]?.click()
		store.feed(many)
		expect(view.el.querySelector(".op-pagination-info")?.textContent).toBe("11–20 of 25")
		view.destroy()
	})
})

describe("incidents view", () => {
	it("filters by incident state on the client", () => {
		const store = new IncidentsStore()
		store.connect("", null, 0, true)
		const view = createIncidentsView(store)
		expect(column(view.el, 0)).toHaveLength(MOCK_INCIDENTS.length)
		clickButton(view.el, ".op-filter-btn", "Resolved")
		const resolved = MOCK_INCIDENTS.filter((i) => i.state === "RESOLVED")
		expect(column(view.el, 4)).toEqual(resolved.map(() => "RESOLVED"))
		view.destroy()
	})
})

describe("jobs and tasks views", () => {
	it("renders one row per job with retries and state", () => {
		const store = new JobsStore()
		store.connect("", null, 0, true)
		const view = createJobsView(store)
		expect(column(view.el, 1)).toEqual(MOCK_JOBS.map((j) => j.type))
		expect(column(view.el, 3)).toEqual(MOCK_JOBS.map((j) => String(j.retries)))
		view.destroy()
	})

	it("renders tasks, marking unassigned ones", () => {
		const store = new TasksStore()
		store.connect("", null, 0, true)
		const onSelect = vi.fn()
		const view = createTasksView(store, onSelect)
		expect(column(view.el, 1)).toEqual(MOCK_TASKS.map((t) => t.assignee ?? "unassigned"))
		view.el.querySelector<HTMLElement>(".bpmnkit-table-row")?.click()
		expect(onSelect).toHaveBeenCalledWith(MOCK_TASKS[0])
		view.destroy()
	})

	it("stops re-rendering after destroy", () => {
		const store = new JobsStore()
		const view = createJobsView(store)
		view.destroy()
		store.connect("", null, 0, true)
		expect(column(view.el, 0)).toHaveLength(0)
	})
})

describe("nav and header", () => {
	it("highlights the section of a detail path and navigates", () => {
		const onNavigate = vi.fn()
		const nav = createNav(onNavigate)
		nav.setActive("/instances/123")
		expect(nav.el.querySelector(".op-nav-item--active")?.getAttribute("data-path")).toBe(
			"/instances",
		)
		nav.el.querySelector<HTMLElement>('[data-path="/jobs"]')?.click()
		expect(onNavigate).toHaveBeenCalledWith("/jobs")
	})

	it("lists profiles, selects the active one and reports changes", () => {
		const onProfile = vi.fn()
		const header = createHeader(onProfile, vi.fn(), "light")
		const select = header.el.querySelector<HTMLSelectElement>(".op-profile-select")
		if (!select) throw new Error("no profile select")
		header.setProfiles([], null)
		expect(select.options[0]?.textContent).toBe("No profiles")

		header.setProfiles(
			[
				{
					name: "dev",
					active: true,
					apiType: "c8",
					baseUrl: "http://localhost:8080/v2",
					authType: "none",
				},
				{ name: "saas", active: false, apiType: "c8", baseUrl: "https://x/v2", authType: "oauth2" },
			],
			null,
		)
		expect(select.value).toBe("dev")
		select.value = "saas"
		select.dispatchEvent(new Event("change"))
		expect(onProfile).toHaveBeenCalledWith("saas")

		header.setTitle("Jobs")
		expect(header.el.querySelector(".op-header-title")?.textContent).toBe("Jobs")
	})
})
