import { FormEditor } from "@bpmnkit/plugins/form-editor"
import { badge } from "../components/badge.js"
import type { TasksStore } from "../stores/tasks.js"
import type { UserTaskResult } from "../types.js"

interface Config {
	proxyUrl: string
	profile: string | null
	mock: boolean
	theme: "light" | "dark"
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

function metaRow(label: string, value: string): HTMLElement {
	const row = document.createElement("div")
	row.className = "op-task-meta-row"
	const lbl = document.createElement("span")
	lbl.className = "op-task-meta-label"
	lbl.textContent = label
	const val = document.createElement("span")
	val.className = "op-task-meta-value"
	val.textContent = value
	row.appendChild(lbl)
	row.appendChild(val)
	return row
}

export function createTaskDetailView(
	taskKey: string,
	store: TasksStore,
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
	backBtn.textContent = "← Tasks"
	backBtn.addEventListener("click", onBack)
	breadcrumb.appendChild(backBtn)
	el.appendChild(breadcrumb)

	// Metadata row
	const meta = document.createElement("div")
	meta.className = "op-def-meta"
	el.appendChild(meta)

	// Body: split into meta panel + form panel
	const body = document.createElement("div")
	body.className = "op-task-detail-body"
	el.appendChild(body)

	// Left: task info
	const infoPanel = document.createElement("div")
	infoPanel.className = "op-task-info-panel"
	body.appendChild(infoPanel)

	// Right: form
	const formWrap = document.createElement("div")
	formWrap.className = "op-task-form-wrap"
	body.appendChild(formWrap)

	let editor: FormEditor | null = null

	function renderTaskInfo(task: UserTaskResult): void {
		meta.innerHTML = ""
		const titleEl = document.createElement("span")
		titleEl.className = "op-def-meta-name"
		titleEl.textContent = task.name ?? "—"
		meta.appendChild(titleEl)
		meta.appendChild(badge(task.state ?? "UNKNOWN"))

		infoPanel.innerHTML = ""
		const heading = document.createElement("div")
		heading.className = "op-task-info-heading"
		heading.textContent = "Task Details"
		infoPanel.appendChild(heading)

		infoPanel.appendChild(metaRow("Key", task.userTaskKey ?? "—"))
		infoPanel.appendChild(metaRow("Assignee", task.assignee ?? "unassigned"))
		infoPanel.appendChild(metaRow("Process", task.processName ?? task.processDefinitionId ?? "—"))
		infoPanel.appendChild(metaRow("Instance", task.processInstanceKey ?? "—"))
		infoPanel.appendChild(metaRow("Created", relTime(task.creationDate)))
		infoPanel.appendChild(metaRow("Due", relTime(task.dueDate)))
		infoPanel.appendChild(metaRow("Priority", String(task.priority ?? "—")))
		if (task.candidateGroups?.length) {
			infoPanel.appendChild(metaRow("Groups", task.candidateGroups.join(", ")))
		}
		if (task.candidateUsers?.length) {
			infoPanel.appendChild(metaRow("Candidates", task.candidateUsers.join(", ")))
		}
	}

	function loadForm(schema: Record<string, unknown>): void {
		editor?.destroy()
		formWrap.innerHTML = ""
		const formHeading = document.createElement("div")
		formHeading.className = "op-task-info-heading"
		formHeading.textContent = "Form"
		formWrap.appendChild(formHeading)
		const formContainer = document.createElement("div")
		formContainer.className = "op-task-form-container"
		formWrap.appendChild(formContainer)
		editor = new FormEditor({ container: formContainer, theme: cfg.theme, readonly: true })
		editor.loadSchema(schema).catch(() => {})
	}

	function showNoForm(): void {
		formWrap.innerHTML = ""
		const msg = document.createElement("div")
		msg.className = "op-panel-empty"
		msg.textContent = "No form associated with this task."
		formWrap.appendChild(msg)
	}

	function fetchForm(task: UserTaskResult): void {
		if (cfg.mock) {
			loadForm({
				type: "default",
				id: "mock-form",
				components: [
					{ id: "f1", type: "textfield", label: "Order ID", key: "orderId" },
					{ id: "f2", type: "checkbox", label: "Approve", key: "approved" },
					{ id: "f3", type: "button", label: "Submit", action: "submit" },
				],
			})
			return
		}

		if (!task.formKey && !task.externalFormReference) {
			showNoForm()
			return
		}

		const headers: Record<string, string> = {}
		if (cfg.profile) headers["x-profile"] = cfg.profile

		fetch(`${cfg.proxyUrl}/api/user-tasks/${task.userTaskKey}/form`, { headers })
			.then((r) => (r.ok ? r.json() : null))
			.then((result: { schema?: unknown } | null) => {
				let schema = result?.schema
				// The API returns schema as a JSON string, not an object
				if (typeof schema === "string") {
					try {
						schema = JSON.parse(schema) as Record<string, unknown>
					} catch {
						schema = undefined
					}
				}
				if (schema && typeof schema === "object") {
					loadForm(schema as Record<string, unknown>)
				} else {
					showNoForm()
				}
			})
			.catch(() => showNoForm())
	}

	function initTask(task: UserTaskResult): void {
		renderTaskInfo(task)
		fetchForm(task)
	}

	// Resolve from store or fetch directly
	const fromStore = store.state.data?.items.find((t) => t.userTaskKey === taskKey)
	if (fromStore) {
		initTask(fromStore)
	} else if (!cfg.mock) {
		const headers: Record<string, string> = {}
		if (cfg.profile) headers["x-profile"] = cfg.profile
		fetch(`${cfg.proxyUrl}/api/user-tasks/${taskKey}`, { headers })
			.then((r) => (r.ok ? r.json() : null))
			.then((task: UserTaskResult | null) => {
				if (task) initTask(task)
			})
			.catch(() => {})
	} else {
		// Mock + not in store: show empty state
		showNoForm()
	}

	const unsub = store.subscribe(() => {
		if (editor || formWrap.children.length > 0) return
		const found = store.state.data?.items.find((t) => t.userTaskKey === taskKey)
		if (found) initTask(found)
	})

	return {
		el,
		destroy(): void {
			unsub()
			editor?.destroy()
		},
	}
}
