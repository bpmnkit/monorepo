import type { FormDefinition } from "@bpmnkit/core"
import { FormViewer } from "@bpmnkit/plugins/form-viewer"
import { applyTheme, injectUiStyles } from "@bpmnkit/ui"
import { claimTask, completeTask, fetchTaskForm, unclaimTask } from "./actions.js"
import type { UserTask, UserTaskWidgetApi, UserTaskWidgetOptions } from "./types.js"

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	className: string,
	text?: string,
): HTMLElementTagNameMap[K] {
	const e = document.createElement(tag)
	e.className = className
	if (text !== undefined) e.textContent = text
	return e
}

/**
 * Widget styles, on the bpmnkit.com design system.
 *
 * Square, flat and hairline-ruled, with mono for the meta line and the two
 * labels — the widget is mounted inside the studio's task page, whose chrome
 * is on the same system, so a rounded filled button here read as a different
 * product. Colour and type come from the `--bpmnkit-ds-*` set.
 */
const WIDGET_CSS = `
.ut-root {
  font-family: var(--bpmnkit-ds-font-sans, system-ui, sans-serif);
  color: var(--bpmnkit-ds-ink, #14161a);
  background: var(--bpmnkit-ds-surface, #ffffff);
}
.ut-header { padding: 16px; border-bottom: 1px solid var(--bpmnkit-ds-line, #d8dbe0); }
.ut-name { font-size: 19px; font-weight: 600; letter-spacing: -0.02em; margin-bottom: 8px; }
.ut-meta {
  display: flex;
  gap: 14px;
  font-family: var(--bpmnkit-ds-font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  color: var(--bpmnkit-ds-ink-4, #8b929c);
}
.ut-meta-item { display: flex; align-items: center; gap: 4px; }
.ut-overdue { color: var(--bpmnkit-danger, #dc2626); }
.ut-form { padding: 16px; flex: 1; overflow-y: auto; }
.ut-form-placeholder {
  padding: 32px;
  text-align: center;
  color: var(--bpmnkit-ds-ink-3, #5c6470);
  font-size: 14.5px;
}
.ut-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--bpmnkit-ds-line, #d8dbe0);
}
/* Square, and the label sits in the sans role the system gives a control. */
.ut-btn {
  padding: 7px 16px;
  font-family: var(--bpmnkit-ds-font-sans, system-ui, sans-serif);
  font-size: 14px;
  line-height: 1.5;
  cursor: pointer;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.ut-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.ut-btn-primary {
  background: var(--bpmnkit-ds-accent, #a8503a);
  border-color: var(--bpmnkit-ds-accent, #a8503a);
  color: #ffffff;
}
.ut-btn-primary:hover:not(:disabled) {
  background: var(--bpmnkit-ds-accent-hover, #8f412e);
  border-color: var(--bpmnkit-ds-accent-hover, #8f412e);
}
.ut-btn-secondary {
  background: none;
  border-color: var(--bpmnkit-ds-line, #d8dbe0);
  color: var(--bpmnkit-ds-ink-3, #5c6470);
}
.ut-btn-secondary:hover:not(:disabled) {
  border-color: var(--bpmnkit-ds-line-strong, #14161a);
  color: var(--bpmnkit-ds-ink, #14161a);
}
/* Destructive is semantic state, so it keeps its own colour — tinted and
   ruled rather than filled, the way every state readout in the system is. */
.ut-btn-danger {
  background: color-mix(in srgb, var(--bpmnkit-danger, #dc2626) 12%, transparent);
  border-color: var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
}
.ut-btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--bpmnkit-danger, #dc2626) 20%, transparent);
}
.ut-error {
  padding: 8px 12px;
  margin: 0 16px 8px;
  border: 1px solid var(--bpmnkit-ds-line, #d8dbe0);
  border-left: 2px solid var(--bpmnkit-danger, #dc2626);
  color: var(--bpmnkit-danger, #dc2626);
  font-size: 14px;
}
`

function injectWidgetStyles(): void {
	const id = "bpmnkit-user-tasks-css"
	if (document.getElementById(id)) return
	const style = document.createElement("style")
	style.id = id
	style.textContent = WIDGET_CSS
	document.head.appendChild(style)
}

export function createUserTaskWidget(options: UserTaskWidgetOptions): UserTaskWidgetApi {
	injectUiStyles()
	injectWidgetStyles()

	const {
		container,
		proxyUrl = "http://localhost:3033",
		profile = null,
		theme = "light",
		onComplete,
		onClaim,
		onUnclaim,
		onReject,
	} = options

	// Create root element
	const root = el("div", "ut-root")
	applyTheme(root, theme)
	root.style.display = "flex"
	root.style.flexDirection = "column"
	root.style.height = "100%"
	container.appendChild(root)

	// State
	let currentTask: UserTask = options.task
	let formViewer: FormViewer | null = null
	let formVariables: Record<string, unknown> = {}

	// Error area
	const errorEl = el("div", "ut-error")
	errorEl.style.display = "none"

	// Header
	const header = el("div", "ut-header")
	const nameEl = el("div", "ut-name")
	const metaEl = el("div", "ut-meta")
	header.appendChild(nameEl)
	header.appendChild(metaEl)
	root.appendChild(header)
	root.appendChild(errorEl)

	// Form area
	const formArea = el("div", "ut-form")
	const formContainer = el("div", "")
	formArea.appendChild(formContainer)
	root.appendChild(formArea)

	// Actions
	const actionsEl = el("div", "ut-actions")
	const claimBtn = el("button", "ut-btn ut-btn-secondary", "Claim")
	claimBtn.type = "button"
	const unclaimBtn = el("button", "ut-btn ut-btn-secondary", "Unclaim")
	unclaimBtn.type = "button"
	const completeBtn = el("button", "ut-btn ut-btn-primary", "Complete")
	completeBtn.type = "button"
	const rejectBtn = el("button", "ut-btn ut-btn-danger", "Reject")
	rejectBtn.type = "button"

	if (!onReject) rejectBtn.style.display = "none"

	actionsEl.appendChild(claimBtn)
	actionsEl.appendChild(unclaimBtn)
	actionsEl.appendChild(completeBtn)
	if (onReject) actionsEl.appendChild(rejectBtn)
	root.appendChild(actionsEl)

	function showError(msg: string): void {
		errorEl.textContent = msg
		errorEl.style.display = "block"
	}

	function clearError(): void {
		errorEl.style.display = "none"
	}

	function renderTask(task: UserTask): void {
		nameEl.textContent = task.name ?? `Task ${task.userTaskKey}`

		metaEl.innerHTML = ""

		if (task.assignee) {
			const assigneeItem = el("span", "ut-meta-item")
			assigneeItem.textContent = `Assigned to ${task.assignee}`
			metaEl.appendChild(assigneeItem)
		}

		if (task.dueDate) {
			const due = new Date(task.dueDate)
			const overdue = due < new Date()
			const dueItem = el("span", overdue ? "ut-meta-item ut-overdue" : "ut-meta-item")
			dueItem.textContent = `Due: ${due.toLocaleDateString()}${overdue ? " (overdue)" : ""}`
			metaEl.appendChild(dueItem)
		}

		if (task.priority !== undefined) {
			const priorityItem = el("span", "ut-meta-item")
			priorityItem.textContent = `Priority: ${task.priority}`
			metaEl.appendChild(priorityItem)
		}

		// Update button states
		claimBtn.disabled = !!task.assignee
		unclaimBtn.disabled = !task.assignee

		// Load form
		void loadForm(task)
	}

	async function loadForm(task: UserTask): Promise<void> {
		// Clean up existing viewer
		if (formViewer) {
			formViewer.destroy()
			formViewer = null
		}
		formContainer.innerHTML = ""

		try {
			const formData = await fetchTaskForm(proxyUrl, profile, task.userTaskKey)
			// Camunda v2 returns { schema: Record<string,unknown>, ... }
			// Some versions send schema as a JSON string instead of an object
			let formDef: unknown = formData
			if (formData && typeof formData === "object" && "schema" in formData) {
				const raw = (formData as Record<string, unknown>).schema
				if (raw && typeof raw === "object") {
					formDef = raw
				} else if (typeof raw === "string") {
					try {
						formDef = JSON.parse(raw)
					} catch {
						formDef = null
					}
				}
			}
			if (formDef && typeof formDef === "object" && "components" in formDef) {
				const fvTheme: "light" | "dark" = theme === "light" ? "light" : "dark"
				formViewer = new FormViewer({ container: formContainer, theme: fvTheme })
				formViewer.load(formDef as FormDefinition)
			} else {
				const placeholder = el("div", "ut-form-placeholder", "No form associated with this task.")
				formContainer.appendChild(placeholder)
			}
		} catch {
			const placeholder = el(
				"div",
				"ut-form-placeholder",
				"No form schema found or form is embedded in the process.",
			)
			formContainer.appendChild(placeholder)
		}
	}

	// Event handlers
	claimBtn.addEventListener("click", () => {
		claimBtn.disabled = true
		claimBtn.textContent = "Claiming..."
		claimTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey }, "studio-user")
			.then(() => {
				clearError()
				onClaim()
			})
			.catch((err: unknown) => {
				showError(`Claim failed: ${err instanceof Error ? err.message : String(err)}`)
			})
			.finally(() => {
				claimBtn.textContent = "Claim"
			})
	})

	unclaimBtn.addEventListener("click", () => {
		unclaimBtn.disabled = true
		unclaimBtn.textContent = "Unclaiming..."
		unclaimTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey })
			.then(() => {
				clearError()
				onUnclaim()
			})
			.catch((err: unknown) => {
				showError(`Unclaim failed: ${err instanceof Error ? err.message : String(err)}`)
			})
			.finally(() => {
				unclaimBtn.textContent = "Unclaim"
			})
	})

	completeBtn.addEventListener("click", () => {
		completeBtn.disabled = true
		completeBtn.textContent = "Completing..."
		completeTask({ proxyUrl, profile, taskKey: currentTask.userTaskKey }, formVariables)
			.then(() => {
				clearError()
				onComplete(formVariables)
			})
			.catch((err: unknown) => {
				showError(`Complete failed: ${err instanceof Error ? err.message : String(err)}`)
				completeBtn.disabled = false
			})
			.finally(() => {
				completeBtn.textContent = "Complete"
			})
	})

	rejectBtn.addEventListener("click", () => {
		const reason = window.prompt("Reason for rejection (optional):", "") ?? ""
		if (onReject) onReject(reason)
	})

	// Initial render
	renderTask(currentTask)

	return {
		setTask(task: UserTask) {
			currentTask = task
			formVariables = {}
			renderTask(task)
		},

		destroy() {
			formViewer?.destroy()
			formViewer = null
			root.remove()
		},
	}
}
