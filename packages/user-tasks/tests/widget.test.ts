import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { type UserTask, type UserTaskWidgetOptions, createUserTaskWidget } from "../src/index.js"

interface Call {
	url: string
	method: string
	headers: Record<string, string>
	body: unknown
}

/** A Camunda Form, as the Orchestration Cluster API returns it under `schema`. */
const FORM = {
	id: "approve-form",
	type: "default",
	schemaVersion: 16,
	components: [
		{ id: "f1", type: "textfield", key: "approver", label: "Approver" },
		{ id: "f2", type: "checkbox", key: "approved", label: "Approved" },
	],
}

type FormReply = unknown | Response

let calls: Call[] = []
let formReply: FormReply = { schema: FORM }
let actionStatus = 204

beforeEach(() => {
	calls = []
	formReply = { schema: FORM }
	actionStatus = 204
	vi.stubGlobal("fetch", async (url: string, init: RequestInit = {}) => {
		calls.push({
			url,
			method: init.method ?? "GET",
			headers: (init.headers ?? {}) as Record<string, string>,
			body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
		})
		if (url.endsWith("/form")) {
			return formReply instanceof Response ? formReply : Response.json(formReply)
		}
		return actionStatus < 300
			? new Response(null, { status: actionStatus })
			: new Response("task already assigned", { status: actionStatus })
	})
	vi.spyOn(window, "matchMedia").mockImplementation(
		(query: string) => ({ matches: false, media: query }) as MediaQueryList,
	)
})

afterEach(() => {
	vi.unstubAllGlobals()
	vi.restoreAllMocks()
	document.body.innerHTML = ""
	document.head.innerHTML = ""
})

const task = (over: Partial<UserTask> = {}): UserTask => ({
	userTaskKey: "2251799813690001",
	name: "Approve invoice",
	...over,
})

function mount(over: Partial<UserTaskWidgetOptions> = {}) {
	const container = document.createElement("div")
	document.body.appendChild(container)
	const handlers = { onComplete: vi.fn(), onClaim: vi.fn(), onUnclaim: vi.fn() }
	const api = createUserTaskWidget({ container, task: task(), ...handlers, ...over })
	const q = <T extends Element = HTMLElement>(sel: string) => container.querySelector<T>(sel)
	const button = (label: string) => {
		const btn = Array.from(container.querySelectorAll("button")).find((b) =>
			b.textContent?.startsWith(label),
		)
		if (!btn) throw new Error(`no ${label} button`)
		return btn
	}
	return { api, container, handlers, q, button }
}

const settle = () => new Promise((r) => setTimeout(r, 0))

describe("header", () => {
	it("shows the task name, or its key when unnamed", () => {
		expect(mount().q(".ut-name")?.textContent).toBe("Approve invoice")
		expect(mount({ task: { userTaskKey: "42" } }).q(".ut-name")?.textContent).toBe("Task 42")
	})

	it("shows assignee, due date and priority", () => {
		const due = new Date(Date.now() + 86_400_000)
		const { q } = mount({
			task: task({ assignee: "demo", dueDate: due.toISOString(), priority: 50 }),
		})
		const items = Array.from(q(".ut-meta")?.children ?? []).map((e) => e.textContent)
		expect(items).toEqual(["Assigned to demo", `Due: ${due.toLocaleDateString()}`, "Priority: 50"])
		expect(q(".ut-overdue")).toBeNull()
	})

	it("marks an overdue task", () => {
		const { q } = mount({ task: task({ dueDate: "2020-01-01T00:00:00Z" }) })
		expect(q(".ut-overdue")?.textContent).toMatch(/\(overdue\)$/)
	})

	it("shows priority 0", () => {
		expect(mount({ task: task({ priority: 0 }) }).q(".ut-meta")?.textContent).toBe("Priority: 0")
	})

	it("renders names as text, never markup", () => {
		const { q } = mount({ task: task({ name: "<img src=x>", assignee: "<b>x</b>" }) })
		expect(q(".ut-name img")).toBeNull()
		expect(q(".ut-meta b")).toBeNull()
	})
})

describe("form", () => {
	it("fetches the task's form through the proxy with the profile header", async () => {
		mount({ proxyUrl: "http://proxy:9", profile: "prod" })
		await settle()
		expect(calls[0]).toMatchObject({
			url: "http://proxy:9/api/user-tasks/2251799813690001/form",
			method: "GET",
			headers: { accept: "application/json", "x-profile": "prod" },
		})
	})

	it("defaults to the local proxy and sends no profile header", async () => {
		mount()
		await settle()
		expect(calls[0]?.url).toBe("http://localhost:3033/api/user-tasks/2251799813690001/form")
		expect(calls[0]?.headers).toEqual({ accept: "application/json" })
	})

	it("renders a Camunda form returned as a schema object", async () => {
		const { q } = mount()
		await settle()
		const labels = Array.from(q(".form-viewer")?.querySelectorAll(".fv-label") ?? []).map(
			(l) => l.textContent,
		)
		expect(labels).toContain("Approver")
		expect(q(".ut-form-placeholder")).toBeNull()
	})

	it("renders a schema sent as a JSON string", async () => {
		formReply = { schema: JSON.stringify(FORM) }
		const { q } = mount()
		await settle()
		expect(q(".form-viewer")?.textContent).toContain("Approver")
	})

	it("renders a bare form definition", async () => {
		formReply = FORM
		const { q } = mount()
		await settle()
		expect(q(".form-viewer")?.textContent).toContain("Approver")
	})

	it("shows a placeholder for a schema that is not a form", async () => {
		for (const reply of [{ schema: "{ not json" }, { schema: { id: "x" } }, {}, null]) {
			formReply = reply
			const { q } = mount()
			await settle()
			expect(q(".form-viewer"), JSON.stringify(reply)).toBeNull()
			expect(q(".ut-form-placeholder")?.textContent).toBe("No form associated with this task.")
			document.body.innerHTML = ""
		}
	})

	it("shows a placeholder when the task has no form", async () => {
		formReply = new Response("", { status: 404 })
		const { q } = mount()
		await settle()
		expect(q(".ut-form-placeholder")?.textContent).toBe(
			"No form schema found or form is embedded in the process.",
		)
	})

	it("draws the form in the widget's theme", async () => {
		const light = mount({ theme: "light" })
		const dark = mount({ theme: "dark" })
		await settle()
		expect(light.q(".form-viewer")?.classList.contains("light")).toBe(true)
		expect(dark.q(".form-viewer")?.classList.contains("dark")).toBe(true)
	})

	// Regression: the form was drawn dark for every theme but "light", so with
	// theme "auto" on a light OS the widget was light and its form dark.
	it("resolves theme auto for the form the way it does for the widget", async () => {
		const { q } = mount({ theme: "auto" })
		await settle()
		expect(q(".ut-root")?.getAttribute("data-theme")).toBe("light")
		expect(q(".form-viewer")?.classList.contains("light")).toBe(true)
	})
})

describe("actions", () => {
	it("enables Claim for an unassigned task and Unclaim for an assigned one", () => {
		const free = mount()
		expect(free.button("Claim").disabled).toBe(false)
		expect(free.button("Unclaim").disabled).toBe(true)
		const taken = mount({ task: task({ assignee: "demo" }) })
		expect(taken.button("Claim").disabled).toBe(true)
		expect(taken.button("Unclaim").disabled).toBe(false)
	})

	it("claims the task", async () => {
		const { button, handlers } = mount({ profile: "prod" })
		button("Claim").click()
		expect(button("Claiming").disabled).toBe(true)
		await settle()
		expect(calls.at(-1)).toEqual({
			url: "http://localhost:3033/api/user-tasks/2251799813690001/assignment",
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json",
				"x-profile": "prod",
			},
			body: { assignee: "studio-user" },
		})
		expect(handlers.onClaim).toHaveBeenCalledOnce()
		expect(button("Claim").textContent).toBe("Claim")
	})

	it("unclaims the task", async () => {
		const { button, handlers } = mount({ task: task({ assignee: "demo" }) })
		button("Unclaim").click()
		await settle()
		expect(calls.at(-1)).toMatchObject({
			url: "http://localhost:3033/api/user-tasks/2251799813690001/assignment",
			method: "DELETE",
		})
		expect(handlers.onUnclaim).toHaveBeenCalledOnce()
	})

	it("completes the task", async () => {
		const { button, handlers } = mount()
		button("Complete").click()
		await settle()
		expect(calls.at(-1)).toMatchObject({
			url: "http://localhost:3033/api/user-tasks/2251799813690001/completion",
			method: "POST",
			body: { variables: {} },
		})
		expect(handlers.onComplete).toHaveBeenCalledWith({})
	})

	it("shows the server's error and re-enables Complete", async () => {
		actionStatus = 409
		const { button, handlers, q } = mount()
		button("Complete").click()
		await settle()
		expect(q(".ut-error")?.textContent).toBe("Complete failed: HTTP 409: task already assigned")
		expect(q(".ut-error")?.style.display).toBe("block")
		expect(handlers.onComplete).not.toHaveBeenCalled()
		expect(button("Complete").disabled).toBe(false)
	})

	// Regression: a failed claim or unclaim left its button disabled for good,
	// so the user could not retry.
	it("re-enables Claim and Unclaim after a failure", async () => {
		actionStatus = 500
		const free = mount()
		free.button("Claim").click()
		await settle()
		expect(free.q(".ut-error")?.textContent).toBe("Claim failed: HTTP 500: task already assigned")
		expect(free.button("Claim").disabled).toBe(false)
		expect(free.handlers.onClaim).not.toHaveBeenCalled()

		const taken = mount({ task: task({ assignee: "demo" }) })
		taken.button("Unclaim").click()
		await settle()
		expect(taken.q(".ut-error")?.textContent).toMatch(/^Unclaim failed: HTTP 500/)
		expect(taken.button("Unclaim").disabled).toBe(false)
	})

	it("clears an error after a later success", async () => {
		actionStatus = 500
		const { button, q } = mount()
		button("Claim").click()
		await settle()
		actionStatus = 204
		button("Claim").click()
		await settle()
		expect(q(".ut-error")?.style.display).toBe("none")
	})

	it("hides Reject without an onReject handler", () => {
		const { container } = mount()
		expect(Array.from(container.querySelectorAll("button")).map((b) => b.textContent)).toEqual([
			"Claim",
			"Unclaim",
			"Complete",
		])
	})

	it("asks for a reason and passes it to onReject", () => {
		const onReject = vi.fn()
		const prompt = vi.spyOn(window, "prompt").mockReturnValue("wrong amount")
		const { button } = mount({ onReject })
		button("Reject").click()
		expect(prompt).toHaveBeenCalledOnce()
		expect(onReject).toHaveBeenCalledWith("wrong amount")
		prompt.mockReturnValue(null)
		button("Reject").click()
		expect(onReject).toHaveBeenLastCalledWith("")
	})
})

describe("lifecycle", () => {
	it("setTask re-renders the header, buttons and form", async () => {
		const { api, q, button } = mount()
		await settle()
		api.setTask({ userTaskKey: "7", name: "Next", assignee: "demo" })
		await settle()
		expect(q(".ut-name")?.textContent).toBe("Next")
		expect(button("Claim").disabled).toBe(true)
		expect(calls.at(-1)?.url).toBe("http://localhost:3033/api/user-tasks/7/form")
		expect(q(".ut-form")?.querySelectorAll(".form-viewer")).toHaveLength(1)
	})

	it("acts on the current task after setTask", async () => {
		const { api, button } = mount()
		api.setTask({ userTaskKey: "7" })
		button("Complete").click()
		await settle()
		expect(calls.at(-1)?.url).toBe("http://localhost:3033/api/user-tasks/7/completion")
	})

	it("destroy removes the widget", async () => {
		const { api, container } = mount()
		await settle()
		api.destroy()
		expect(container.innerHTML).toBe("")
	})

	it("injects the shared and widget styles once", () => {
		mount()
		mount()
		const ids = Array.from(document.head.querySelectorAll("style")).map((s) => s.id)
		expect(ids.filter((id) => id === "bpmnkit-user-tasks-css")).toHaveLength(1)
		expect(ids).toContain("bpmnkit-ui-tokens-v1")
	})

	it("applies the theme to its root, light by default", () => {
		expect(mount().q(".ut-root")?.getAttribute("data-theme")).toBe("light")
		expect(mount({ theme: "neon" }).q(".ut-root")?.getAttribute("data-theme")).toBe("neon")
	})
})
