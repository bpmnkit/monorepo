import type {
	DecisionDefinitionResult,
	IncidentResult,
	JobSearchResult,
	MessageSubscriptionResult,
	ProcessDefinitionResult,
	ProcessInstanceResult,
	UserTaskResult,
	VariableResult,
} from "@bpmnkit/api"
import type { Theme } from "@bpmnkit/ui"

export type { Theme }

export interface OperateOptions {
	/** Element Operate mounts into. It fills the element, so give it a height. */
	container: HTMLElement
	/**
	 * Base URL of the `@bpmnkit/proxy` server (`casen proxy start`). A relative
	 * URL such as "/bpmnkit-proxy" works when a same-origin reverse proxy
	 * forwards to it. Default: http://localhost:3033
	 */
	proxyUrl?: string
	/**
	 * Proxy profile to use. Sent as `?profile=` on the monitoring poll and as the
	 * `x-profile` header on API calls. Default: the proxy's active profile.
	 */
	profile?: string
	/**
	 * Initial theme. A theme the user picked in the header earlier (persisted in
	 * localStorage) takes precedence. Default: "light".
	 */
	theme?: Theme
	/**
	 * How often the browser re-polls the proxy, in ms. Default: 30000, minimum
	 * 5000. Set to 0 to load once and never auto-refresh.
	 */
	pollInterval?: number
	/** Use built-in fixture data instead of connecting to the proxy. */
	mock?: boolean
	/**
	 * Called when the user clicks "Open in Editor" on a diagram view.
	 * Receives the raw BPMN XML and a suggested file name.
	 */
	onOpenInEditor?: (xml: string, name: string) => void
}

export interface OperateApi {
	/** Operate's root element, appended to `container`. */
	readonly el: HTMLElement
	/** Switch profile (null = the proxy's active one) and reload the current view. */
	setProfile(name: string | null): void
	/** Switch theme, including any open diagram. */
	setTheme(theme: Theme): void
	/** Go to a hash route, e.g. "/instances/2251799813690001". */
	navigate(path: string): void
	/** Stop polling, detach listeners and remove `el`. */
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
