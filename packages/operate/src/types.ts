import type {
	DecisionDefinitionResult,
	IncidentResult,
	JobSearchResult,
	MessageSubscriptionResult,
	ProcessDefinitionResult,
	ProcessInstanceResult,
	UserTaskResult,
	VariableResult,
} from "@bpmn-sdk/api"
import type { Theme } from "@bpmn-sdk/ui"

export type { Theme }

export interface OperateOptions {
	container: HTMLElement
	/** Proxy server base URL. Default: http://localhost:3033 */
	proxyUrl?: string
	/** Active profile name. Sent as x-profile header. */
	profile?: string
	theme?: Theme
	/** Polling interval in ms. Default: 30000. Set to 0 to disable auto-refresh. */
	pollInterval?: number
	/** Use mock/demo data instead of connecting to proxy. */
	mock?: boolean
}

export interface OperateApi {
	readonly el: HTMLElement
	setProfile(name: string | null): void
	setTheme(theme: Theme): void
	navigate(path: string): void
	destroy(): void
}

// ── Stream event ──────────────────────────────────────────────────────────────

export interface StreamEvent<T> {
	type: "data" | "error" | "keepalive"
	topic?: string
	payload?: T
	message?: string
}

// ── Profile ───────────────────────────────────────────────────────────────────

export interface ProfileInfo {
	name: string
	active: boolean
	apiType: string
	baseUrl: string | null
	authType: string
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardData {
	activeInstances: number
	openIncidents: number
	activeJobs: number
	pendingTasks: number
	definitions: number
	/** Usage metrics — aggregate totals (may be absent if endpoint unavailable) */
	usageTotalProcessInstances?: number
	usageDecisionInstances?: number
	usageAssignees?: number
}

// ── Re-export API result types for consumer convenience ───────────────────────

export type {
	DecisionDefinitionResult,
	IncidentResult,
	JobSearchResult,
	MessageSubscriptionResult,
	ProcessDefinitionResult,
	ProcessInstanceResult,
	UserTaskResult,
	VariableResult,
}
