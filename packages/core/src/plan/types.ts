/**
 * ProcessPlan — the typed intermediate representation Claude (or any LLM)
 * authors instead of BPMN XML. `compilePlan()` turns a plan into valid,
 * laid-out, executable BPMN via the `@bpmnkit/core` builder; the model never
 * touches XML, DI, element IDs, or connector property keys directly.
 *
 * Every string field documented as FEEL follows this SDK's existing
 * convention throughout: a leading "=" makes it a FEEL expression, its
 * absence makes it a literal string. This matches how `zeebe:input`/`output`
 * `source` values already work in `@bpmnkit/core`.
 */

/** A connector reference — resolved against `@bpmnkit/connectors` (or an equivalent resolver) at compile time. */
export interface PlanConnectorRef {
	/** Bundled template id, e.g. "io.camunda.connectors.Slack.v1". */
	template: string
	/** Values keyed by the template's input keys — see `ConnectorSummary.requiredInputs`/`optionalInputs`. */
	values?: Record<string, string>
}

/** An error boundary attached to a step that can throw a BPMN error. */
export interface PlanErrorBoundary {
	/**
	 * BPMN error code this boundary catches. Required: the underlying builder
	 * only emits an `errorEventDefinition` when a code is given, so an
	 * omitted `errorCode` produces an untyped (non-functional) boundary event.
	 */
	errorCode: string
	/** Steps to run when the error is caught. */
	steps: PlanStep[]
	/** False = non-interrupting boundary event (default true). */
	interrupting?: boolean
}

/** A timer boundary attached to a step. */
export interface PlanTimerBoundary {
	duration?: string
	date?: string
	cycle?: string
	steps: PlanStep[]
	interrupting?: boolean
}

interface PlanStepBase {
	/** Stable element id. Auto-derived from `name` (slugified, deduped) if omitted. */
	id?: string
	name?: string
	/** Shown as documentation on the element; becomes the AI Agent tool description for tools inside an `aiAgent` step. */
	documentation?: string
	errorBoundary?: PlanErrorBoundary
	timerBoundary?: PlanTimerBoundary
}

export interface PlanStartStep extends PlanStepBase {
	kind: "start"
	timer?: { duration?: string; date?: string; cycle?: string }
	message?: { name: string }
	/** Inbound connector template (e.g. a webhook start event). */
	connector?: PlanConnectorRef
}

export interface PlanConnectorStep extends PlanStepBase {
	kind: "connector"
	connector: PlanConnectorRef
	retries?: string
}

export interface PlanServiceTaskStep extends PlanStepBase {
	kind: "serviceTask"
	jobType: string
	inputs?: Record<string, string>
	outputs?: Record<string, string>
	taskHeaders?: Record<string, string>
	retries?: string
}

export interface PlanUserTaskStep extends PlanStepBase {
	kind: "userTask"
	formId?: string
	assignee?: string
	candidateGroups?: string
	candidateUsers?: string
	dueDate?: string
	followUpDate?: string
	priority?: number
}

export interface PlanBusinessRuleTaskStep extends PlanStepBase {
	kind: "businessRuleTask"
	decisionId: string
	resultVariable?: string
}

export interface PlanScriptTaskStep extends PlanStepBase {
	kind: "scriptTask"
	expression: string
	resultVariable: string
}

export interface PlanSendTaskStep extends PlanStepBase {
	kind: "sendTask"
	messageName: string
}

export interface PlanReceiveTaskStep extends PlanStepBase {
	kind: "receiveTask"
	messageName: string
	correlationKey?: string
}

export interface PlanCallActivityStep extends PlanStepBase {
	kind: "callActivity"
	processId: string
	propagateAllChildVariables?: boolean
}

/** One tool available to an `aiAgent` step. */
export interface PlanAgentTool {
	id: string
	description: string
	/** A connector-backed tool. */
	connector?: PlanConnectorRef
	/** A plain job-worker tool (mutually exclusive with `connector`). */
	jobType?: string
	params?: Array<{
		name: string
		description: string
		type?: "string" | "number" | "boolean" | "integer" | "array" | "object"
		required?: boolean
		schema?: Record<string, unknown>
		/** Input-mapping target on the tool activity (default: same as `name`). */
		target?: string
	}>
	resultExpression?: string
}

export interface PlanAiAgentStep extends PlanStepBase {
	kind: "aiAgent"
	provider: string
	model: string
	/** Extra dotted zeebe:input bindings — auth, endpoint, region, etc. Keys match the bundled template's input keys. */
	providerInputs?: Record<string, string>
	systemPrompt: string
	userPrompt: string
	memoryStorageType?: string
	maxModelCalls?: number
	outputVariable?: string
	tools: PlanAgentTool[]
	completionCondition?: string
	cancelRemainingInstances?: boolean
	retries?: string
}

export interface PlanBranch {
	name?: string
	/** FEEL condition (required unless `default` is set). */
	condition?: string
	default?: boolean
	steps: PlanStep[]
}

export interface PlanGatewayStep extends PlanStepBase {
	kind: "gateway"
	gatewayType: "exclusive" | "parallel" | "inclusive" | "eventBased"
	branches: PlanBranch[]
}

export interface PlanSubProcessStep extends PlanStepBase {
	kind: "subProcess"
	steps: PlanStep[]
	multiInstance?: {
		isSequential?: boolean
		collection: string
		elementVariable?: string
		completionCondition?: string
	}
}

export interface PlanWaitStep extends PlanStepBase {
	kind: "wait"
	timer?: { duration?: string; date?: string; cycle?: string }
	message?: { name: string; correlationKey: string }
}

export interface PlanEndStep extends PlanStepBase {
	kind: "end"
	errorCode?: string
	terminate?: boolean
}

/** Escape hatch for anything the plan format can't express yet — a raw builder-options object, applied as-is. */
export interface PlanRawStep extends PlanStepBase {
	kind: "raw"
	elementType: string
	options?: Record<string, unknown>
}

export type PlanStep =
	| PlanStartStep
	| PlanConnectorStep
	| PlanServiceTaskStep
	| PlanUserTaskStep
	| PlanBusinessRuleTaskStep
	| PlanScriptTaskStep
	| PlanSendTaskStep
	| PlanReceiveTaskStep
	| PlanCallActivityStep
	| PlanAiAgentStep
	| PlanGatewayStep
	| PlanSubProcessStep
	| PlanWaitStep
	| PlanEndStep
	| PlanRawStep

export interface PlanInputVariable {
	name: string
	type: string
	required?: boolean
	description?: string
}

export interface PlanScenario {
	name: string
	inputs?: Record<string, unknown>
	/** jobType → { outputs } or { error: { code, message? } } */
	mocks?: Record<
		string,
		{ outputs?: Record<string, unknown> } | { error: { code: string; message?: string } }
	>
	expect?: {
		path?: string[]
		variables?: Record<string, unknown>
	}
}

export interface ProcessPlan {
	version: 1
	process: {
		id: string
		name?: string
		versionTag?: string
	}
	inputs?: PlanInputVariable[]
	steps: PlanStep[]
	tests?: PlanScenario[]
}
