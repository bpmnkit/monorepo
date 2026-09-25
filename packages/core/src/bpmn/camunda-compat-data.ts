/**
 * Which BPMN constructs and Zeebe properties each Camunda 8 version supports —
 * the data behind `analyzeCamundaCompat`.
 *
 * Taken from `bpmnlint-plugin-camunda-compat` 2.61.0 (MIT, © Camunda Services
 * GmbH), the rule set Camunda Modeler lints with through `@camunda/linting`
 * 3.57.0:
 *
 * - `index.js` — which rule each `camunda-cloud-X-Y` config enables;
 * - `rules/camunda-cloud/element-type/config.js` — element and event
 *   definition support per version;
 * - `rules/camunda-cloud/implementation/config.js` — which task implementation
 *   each element takes, from which version;
 * - `rules/camunda-cloud/timer/config.js` — timer properties per event type;
 * - `rules/camunda-cloud/connector-properties/config.js` — inbound connector
 *   properties per version;
 * - the version constants inside the individual rules.
 *
 * The FEEL built-in table is from `@camunda/feel-builtins` 1.4.1, which the
 * plugin's `feel-compatibility` rule reads.
 *
 * When the plugin moves, update the tables here and `CAMUNDA_COMPAT_PLUGIN_VERSION`
 * together; nothing else in BPMN Kit hard-codes a Camunda version for these checks.
 *
 * @packageDocumentation
 */

/** The `bpmnlint-plugin-camunda-compat` release these tables were taken from. */
export const CAMUNDA_COMPAT_PLUGIN_VERSION = "2.61.0"

/**
 * The Camunda 8 (and Camunda Cloud 1.x) versions the plugin ships a
 * `camunda-cloud-X-Y` config for, oldest first.
 */
export const CAMUNDA_COMPAT_VERSIONS = [
	"1.0",
	"1.1",
	"1.2",
	"1.3",
	"8.0",
	"8.1",
	"8.2",
	"8.3",
	"8.4",
	"8.5",
	"8.6",
	"8.7",
	"8.8",
	"8.9",
	"8.10",
] as const

/** A version in `CAMUNDA_COMPAT_VERSIONS`. */
export type CamundaCompatVersion = (typeof CAMUNDA_COMPAT_VERSIONS)[number]

/** `_` stands for "no event definition". */
type EventSupport = Readonly<Record<string, CamundaCompatVersion>>

/**
 * First version supporting each element, keyed by BPMN type. Events map their
 * event definition (or `_` for none) to a version instead. A flow element whose
 * type is absent — `bpmn:ComplexGateway`, `bpmn:Transaction` — is supported by
 * no version.
 */
export const ELEMENT_SUPPORT: Readonly<Record<string, CamundaCompatVersion | EventSupport>> = {
	"bpmn:BoundaryEvent": {
		"bpmn:CompensateEventDefinition": "8.5",
		"bpmn:ConditionalEventDefinition": "8.9",
		"bpmn:ErrorEventDefinition": "1.0",
		"bpmn:EscalationEventDefinition": "8.2",
		"bpmn:MessageEventDefinition": "1.0",
		"bpmn:TimerEventDefinition": "1.0",
		"bpmn:SignalEventDefinition": "8.3",
	},
	"bpmn:BusinessRuleTask": "1.1",
	"bpmn:CallActivity": "1.0",
	"bpmn:DataObject": "8.0",
	"bpmn:DataObjectReference": "8.0",
	"bpmn:DataStoreReference": "8.0",
	"bpmn:EndEvent": {
		_: "1.0",
		"bpmn:CompensateEventDefinition": "8.5",
		"bpmn:ErrorEventDefinition": "1.0",
		"bpmn:EscalationEventDefinition": "8.2",
		"bpmn:MessageEventDefinition": "1.2",
		"bpmn:SignalEventDefinition": "8.3",
		"bpmn:TerminateEventDefinition": "8.1",
	},
	"bpmn:EventBasedGateway": "1.0",
	"bpmn:ExclusiveGateway": "1.0",
	"bpmn:InclusiveGateway": "8.1",
	"bpmn:IntermediateCatchEvent": {
		"bpmn:ConditionalEventDefinition": "8.9",
		"bpmn:MessageEventDefinition": "1.0",
		"bpmn:LinkEventDefinition": "8.2",
		"bpmn:TimerEventDefinition": "1.0",
		"bpmn:SignalEventDefinition": "8.3",
	},
	"bpmn:IntermediateThrowEvent": {
		_: "1.1",
		"bpmn:CompensateEventDefinition": "8.5",
		"bpmn:EscalationEventDefinition": "8.2",
		"bpmn:LinkEventDefinition": "8.2",
		"bpmn:MessageEventDefinition": "1.2",
		"bpmn:SignalEventDefinition": "8.3",
	},
	"bpmn:ManualTask": "1.1",
	"bpmn:ParallelGateway": "1.0",
	"bpmn:ReceiveTask": "1.0",
	"bpmn:ScriptTask": "1.1",
	"bpmn:SendTask": "1.1",
	"bpmn:ServiceTask": "1.0",
	"bpmn:StartEvent": {
		_: "1.0",
		"bpmn:ConditionalEventDefinition": "8.9",
		"bpmn:ErrorEventDefinition": "1.0",
		"bpmn:EscalationEventDefinition": "8.2",
		"bpmn:MessageEventDefinition": "1.0",
		"bpmn:SignalEventDefinition": "8.2",
		"bpmn:TimerEventDefinition": "1.0",
	},
	"bpmn:SubProcess": "1.0",
	"bpmn:Task": "8.2",
	"bpmn:UserTask": "1.0",
	"bpmn:AdHocSubProcess": "8.7",
}

/** The three ways Zeebe implements a task, as `zeebe:` extension element names. */
export type ImplementationKind = "calledDecision" | "script" | "taskDefinition"

/** First version each element accepts each implementation kind in. */
export const IMPLEMENTATION_SUPPORT: Readonly<
	Record<ImplementationKind, Readonly<Record<string, CamundaCompatVersion | EventSupport>>>
> = {
	calledDecision: {
		"bpmn:BusinessRuleTask": "1.3",
	},
	taskDefinition: {
		"bpmn:AdHocSubProcess": "8.8",
		"bpmn:BusinessRuleTask": "1.1",
		"bpmn:IntermediateThrowEvent": { "bpmn:MessageEventDefinition": "1.2" },
		"bpmn:EndEvent": { "bpmn:MessageEventDefinition": "1.2" },
		"bpmn:ScriptTask": "1.1",
		"bpmn:SendTask": "1.1",
		"bpmn:ServiceTask": "1.0",
	},
	script: {
		"bpmn:ScriptTask": "8.2",
	},
}

/** The timer properties of `bpmn:TimerEventDefinition`. */
export type TimerProperty = "timeCycle" | "timeDate" | "timeDuration"

/**
 * First version each timer property is allowed in, per event type. `null`
 * means never; the functions receive whether the event interrupts and whether
 * it starts an event sub-process.
 */
export const TIMER_SUPPORT: Readonly<
	Record<
		string,
		Readonly<
			Record<
				TimerProperty,
				(interrupting: boolean, inEventSubProcess: boolean) => CamundaCompatVersion | null
			>
		>
	>
> = {
	"bpmn:StartEvent": {
		timeCycle: (interrupting, inEventSubProcess) =>
			!interrupting || !inEventSubProcess ? "1.0" : null,
		timeDate: () => "1.0",
		timeDuration: (_, inEventSubProcess) => (inEventSubProcess ? "1.0" : null),
	},
	"bpmn:BoundaryEvent": {
		timeCycle: (interrupting) => (!interrupting ? "1.0" : null),
		timeDate: () => "8.3",
		timeDuration: () => "1.0",
	},
	"bpmn:IntermediateCatchEvent": {
		timeCycle: () => null,
		timeDate: () => "8.3",
		timeDuration: () => "1.0",
	},
}

/** First version a timer cycle may be a cron expression rather than ISO 8601. */
export const CRON_TIMER_SINCE: CamundaCompatVersion = "8.1"

/**
 * First version each property-level feature is supported in — the version
 * constants of the plugin's `no-*` rules, gathered in one place.
 */
export const FEATURE_SINCE = {
	/** `zeebe:modelerTemplate`, an applied element template (`no-template`). */
	modelerTemplate: "8.0",
	/** `zeebe:properties` on any element (`no-zeebe-properties`). */
	zeebeProperties: "8.1",
	/** `candidateUsers` on `zeebe:assignmentDefinition` (`no-candidate-users`). */
	candidateUsers: "8.2",
	/** `propagateAllParentVariables="false"` (`no-propagate-all-parent-variables`). */
	propagateAllParentVariablesFalse: "8.2",
	/** `zeebe:taskSchedule` (`no-task-schedule`). */
	taskSchedule: "8.2",
	/** A catch event without an `errorRef` (`error-reference`). */
	errorCatchWithoutRef: "8.2",
	/** An error code expression on a throw event (`no-expression`). */
	errorCodeExpression: "8.2",
	/** A form on a start event (`start-event-form`). */
	startEventForm: "8.3",
	/** A signal start event inside a sub-process (`no-signal-event-sub-process`). */
	signalEventSubProcess: "8.3",
	/** A collapsed sub-process (`collapsed-subprocess`). */
	collapsedSubProcess: "8.4",
	/** `formId` on a job-worker user task, in Desktop Modeler (`user-task-form`). */
	userTaskFormId: "8.4",
	/** `zeebe:userTask`, the Camunda user task (`no-zeebe-user-task`). */
	zeebeUserTask: "8.5",
	/** `bindingType` other than `latest` (`no-binding-type`). */
	bindingType: "8.6",
	/** `zeebe:executionListeners` (`no-execution-listeners`). */
	executionListeners: "8.6",
	/** `zeebe:priorityDefinition` (`no-priority-definition`). */
	priorityDefinition: "8.6",
	/** `zeebe:versionTag` on a process (`no-version-tag`). */
	versionTag: "8.6",
	/** Completion condition and output collection on ad-hoc sub-processes (`ad-hoc-sub-process`). */
	adHocCompletion: "8.8",
	/** `zeebe:taskListeners` (`no-task-listeners`). */
	taskListeners: "8.8",
	/** A `zeebe:input` without `source` (`io-mapping`). */
	inputWithoutSource: "8.8",
	/** `businessId` on `zeebe:calledElement` (`no-business-id`). */
	businessId: "8.10",
	/** Headers on execution listeners (`no-execution-listener-headers`). */
	executionListenerHeaders: "8.10",
	/** `beforeAll` execution listeners (`no-before-all-execution-listener`). */
	beforeAllExecutionListener: "8.10",
	/** `cancel` execution listeners (`no-cancel-execution-listener`). */
	cancelExecutionListener: "8.10",
	/** `zeebe:jobPriorityDefinition` (`no-job-priority-definition`). */
	jobPriorityDefinition: "8.10",
	/** A FEEL expression as the version tag of a called decision (`version-tag`). */
	decisionVersionTagExpression: "8.10",
	/** `camunda.secrets.NAME`, superseding `{{secrets.NAME}}` (`secrets`). */
	camundaSecrets: "8.10",
	/** `zeebe:agentDefinition` marks an agentic ad-hoc sub-process (the agent rules). */
	agentDefinition: "8.10",
} as const satisfies Record<string, CamundaCompatVersion>

/**
 * First version each Camunda FEEL built-in function is available in, for
 * `feel-compatibility`. Functions every version has are absent.
 *
 * Taken from the `engines.camunda` ranges of `@camunda/feel-builtins` 1.4.1
 * (MIT, © Camunda Services GmbH) — `camundaBuiltins` and
 * `camundaReservedNameBuiltins` — the table the plugin 2.61.0 checks against.
 * Every range there is `>=X.Y`.
 */
export const FEEL_BUILTIN_SINCE: Readonly<Record<string, CamundaCompatVersion>> = {
	"context merge": "8.2",
	"last day of month": "8.2",
	"random number": "8.2",
	assert: "8.3",
	"duplicate values": "8.3",
	"get or else": "8.3",
	"is empty": "8.6",
	"to base64": "8.6",
	trim: "8.6",
	uuid: "8.6",
	partition: "8.7",
	fromAi: "8.8",
	"is blank": "8.8",
	"from base64": "8.9",
	"from json": "8.9",
	"to json": "8.9",
}

/**
 * Inbound connector properties (`zeebe:property` names) that need a newer
 * Camunda version, and the `inbound.type` values of the connectors that take
 * them — `rules/camunda-cloud/connector-properties/config.js` of the plugin.
 */
export const INBOUND_CONNECTOR_PROPERTY_SINCE: Readonly<
	Record<string, { since: CamundaCompatVersion; connectors: readonly string[] }>
> = {
	messageTtl: {
		since: "8.6",
		connectors: [
			"io.camunda:webhook:1",
			"io.camunda:connector-rabbitmq-inbound:1",
			"io.camunda:http-polling:1",
			"io.camunda:connector-kafka-inbound:1",
			"io.camunda:slack-webhook:1",
			"io.camunda:aws-sqs-inbound:1",
			"io.camunda:aws-sns-webhook:1",
		],
	},
	consumeUnmatchedEvents: {
		since: "8.6",
		connectors: [
			"io.camunda:webhook:1",
			"io.camunda:connector-rabbitmq-inbound:1",
			"io.camunda:http-polling:1",
			"io.camunda:connector-kafka-inbound:1",
			"io.camunda:slack-webhook:1",
			"io.camunda:aws-sqs-inbound:1",
			"io.camunda:aws-sns-webhook:1",
		],
	},
	deduplicationModeManualFlag: {
		since: "8.6",
		connectors: [
			"io.camunda:connector-rabbitmq-inbound:1",
			"io.camunda:http-polling:1",
			"io.camunda:connector-kafka-inbound:1",
			"io.camunda:aws-sqs-inbound:1",
		],
	},
}

/** Whether BPMN Kit runs a plugin rule, and how closely. */
export type CamundaCompatCoverage = "implemented" | "partial" | "existing" | "not-implemented"

/** One `bpmnlint-plugin-camunda-compat` rule. */
export interface CamundaCompatRule {
	/** The severity the plugin's configs give it. */
	severity: "error" | "warn"
	/** First config that enables it; absent for "every version". */
	since?: CamundaCompatVersion
	/** First config that no longer enables it; absent for "still enabled". */
	until?: CamundaCompatVersion
	/**
	 * - `implemented` — `analyzeCamundaCompat` reports it as `compat/<rule>`;
	 * - `partial` — reported, with the difference in `note`;
	 * - `existing` — another BPMN Kit finding (`equivalents`) reports the same problem;
	 * - `not-implemented` — not checked; `note` says why.
	 */
	coverage: CamundaCompatCoverage
	/** BPMN Kit findings outside `compat/*` that report the same problem. */
	equivalents?: readonly string[]
	note?: string
}

/**
 * Every rule of the plugin's `camunda-cloud-*` configs, with the versions it
 * is enabled for — `index.js` of the plugin, as data.
 */
export const CAMUNDA_COMPAT_RULES: Readonly<Record<string, CamundaCompatRule>> = {
	"ad-hoc-sub-process": { severity: "error", since: "8.7", coverage: "implemented" },
	"agent-fromai-contract": { severity: "error", since: "8.8", coverage: "implemented" },
	"agent-tool-documentation": {
		severity: "warn",
		since: "8.8",
		coverage: "existing",
		equivalents: ["agentic/tool-no-description"],
		note: "BPMN Kit's `agentic/tool-no-description` reports the same gap.",
	},
	"agent-tool-output-key": { severity: "warn", since: "8.8", coverage: "implemented" },
	"before-all-execution-listener": { severity: "error", since: "8.10", coverage: "implemented" },
	"called-element": {
		severity: "error",
		coverage: "implemented",
		equivalents: ["deploy/call-activity-no-process"],
	},
	"cancel-execution-listener": { severity: "error", since: "8.10", coverage: "implemented" },
	"collapsed-subprocess": { severity: "error", until: "8.4", coverage: "implemented" },
	"connector-properties": { severity: "warn", since: "8.0", coverage: "implemented" },
	"duplicate-execution-listener-headers": {
		severity: "error",
		since: "8.10",
		coverage: "implemented",
	},
	"duplicate-execution-listeners": { severity: "error", since: "8.6", coverage: "implemented" },
	"duplicate-task-headers": { severity: "error", coverage: "implemented" },
	"element-type": { severity: "error", coverage: "implemented" },
	"error-reference": { severity: "error", coverage: "implemented" },
	"escalation-boundary-event-attached-to-ref": {
		severity: "error",
		since: "8.2",
		coverage: "implemented",
	},
	"escalation-reference": { severity: "error", since: "8.2", coverage: "implemented" },
	"event-based-gateway-target": { severity: "error", coverage: "implemented" },
	"executable-process": {
		severity: "error",
		coverage: "existing",
		equivalents: ["deploy/process-not-executable"],
		note: "`deploy/process-not-executable` reports every non-executable process; the plugin only complains when none is executable.",
	},
	"execution-listener": { severity: "error", since: "8.6", coverage: "implemented" },
	feel: {
		severity: "error",
		coverage: "existing",
		equivalents: ["feel-syntax/parse-error"],
		note: "BPMN Kit's own FEEL parser reports syntax errors as `feel-syntax/parse-error`.",
	},
	"feel-compatibility": {
		severity: "error",
		coverage: "implemented",
		note: "Parses with `@bpmnkit/feel` rather than the plugin's lezer-feel grammar, so an expression only one of the two parsers accepts is judged differently.",
	},
	implementation: {
		severity: "error",
		coverage: "implemented",
		equivalents: ["deploy/service-task-no-type"],
	},
	"inclusive-gateway": { severity: "error", since: "8.1", until: "8.6", coverage: "implemented" },
	"io-mapping": { severity: "error", coverage: "implemented" },
	"link-event": {
		severity: "error",
		since: "8.2",
		coverage: "implemented",
		equivalents: ["flow/link-event-mismatch"],
		note: "Where bpmnlint's `link-event` runs (`flow/link-event-mismatch`), it reports the same unnamed or duplicate link event, and that finding stays.",
	},
	"loop-characteristics": { severity: "error", coverage: "implemented" },
	"message-reference": {
		severity: "error",
		coverage: "implemented",
		equivalents: ["deploy/message-start-no-name"],
	},
	"no-before-all-execution-listener": {
		severity: "error",
		since: "8.6",
		until: "8.10",
		coverage: "implemented",
	},
	"no-binding-type": { severity: "error", until: "8.6", coverage: "implemented" },
	"no-business-id": { severity: "error", until: "8.10", coverage: "implemented" },
	"no-candidate-users": { severity: "error", until: "8.2", coverage: "implemented" },
	"no-cancel-execution-listener": { severity: "error", until: "8.10", coverage: "implemented" },
	"no-execution-listener-headers": { severity: "error", until: "8.10", coverage: "implemented" },
	"no-execution-listeners": { severity: "error", until: "8.6", coverage: "implemented" },
	"no-expression": { severity: "error", coverage: "implemented" },
	"no-interrupting-event-subprocess": { severity: "error", since: "8.7", coverage: "implemented" },
	"no-job-priority-definition": { severity: "error", until: "8.10", coverage: "implemented" },
	"no-loop": { severity: "error", coverage: "implemented" },
	"no-multiple-none-start-events": { severity: "error", coverage: "implemented" },
	"no-priority-definition": { severity: "error", until: "8.6", coverage: "implemented" },
	"no-propagate-all-parent-variables": { severity: "error", until: "8.2", coverage: "implemented" },
	"no-signal-event-sub-process": {
		severity: "error",
		since: "8.2",
		until: "8.3",
		coverage: "implemented",
	},
	"no-task-listeners": { severity: "error", until: "8.8", coverage: "implemented" },
	"no-task-schedule": { severity: "error", until: "8.2", coverage: "implemented" },
	"no-template": { severity: "error", until: "8.0", coverage: "implemented" },
	"no-version-tag": { severity: "error", until: "8.6", coverage: "implemented" },
	"no-zeebe-properties": { severity: "error", until: "8.1", coverage: "implemented" },
	"no-zeebe-user-task": { severity: "error", until: "8.5", coverage: "implemented" },
	"priority-definition": { severity: "error", since: "8.6", coverage: "implemented" },
	secrets: { severity: "warn", since: "8.3", coverage: "implemented" },
	"sequence-flow-condition": {
		severity: "error",
		coverage: "implemented",
		equivalents: ["feel/empty-condition"],
	},
	"signal-reference": { severity: "error", since: "8.3", coverage: "implemented" },
	"start-event-form": { severity: "error", coverage: "implemented" },
	"start-event-form-embedded": { severity: "warn", since: "8.9", coverage: "implemented" },
	subscription: {
		severity: "error",
		coverage: "partial",
		equivalents: ["deploy/message-catch-no-correlation"],
		note: "A `zeebe:subscription` placed on the catch element instead of on its `bpmn:message` is a warning here, where the plugin reports the message as missing it — BPMN Kit's builder writes it on the element, and Reebe reads it there.",
	},
	"task-listener": { severity: "error", since: "8.8", coverage: "implemented" },
	"task-schedule": { severity: "error", since: "8.2", coverage: "implemented" },
	timer: { severity: "error", coverage: "implemented" },
	"unresolvable-secret-reference": { severity: "error", since: "8.10", coverage: "implemented" },
	"user-task-definition": { severity: "warn", coverage: "implemented" },
	"user-task-form": { severity: "error", coverage: "implemented" },
	"variable-name": { severity: "error", coverage: "implemented" },
	"version-tag": { severity: "error", since: "8.6", coverage: "implemented" },
	"wait-for-completion": { severity: "error", since: "8.5", coverage: "implemented" },
	"zeebe-user-task": { severity: "warn", since: "8.6", coverage: "implemented" },
}
