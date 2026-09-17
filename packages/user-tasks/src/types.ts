import type { Theme } from "@bpmnkit/ui"

export interface UserTask {
	userTaskKey: string
	name?: string
	assignee?: string
	candidateGroups?: string[]
	dueDate?: string
	priority?: number
	processInstanceKey?: string
	processDefinitionKey?: string
	formKey?: string
}

export interface UserTaskWidgetOptions {
	/** The container element to render the widget into. */
	container: HTMLElement
	/** The user task to display. */
	task: UserTask
	/** Base URL of the proxy server. */
	proxyUrl?: string
	/** Active profile name for x-profile header. */
	profile?: string | null
	/** Visual theme. Defaults to "light", the design system's own. */
	theme?: Theme
	/** Called when the user completes the task. */
	onComplete(variables: Record<string, unknown>): void
	/** Called when the user claims the task. */
	onClaim(): void
	/** Called when the user unclaims the task. */
	onUnclaim(): void
	/** Called when the user rejects/returns the task. */
	onReject?(reason: string): void
}

export interface UserTaskWidgetApi {
	/** Update the displayed task. */
	setTask(task: UserTask): void
	/** Remove the widget from the DOM and clean up. */
	destroy(): void
}
