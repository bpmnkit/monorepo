import { generateId } from "../types/id-generator.js"
import type { XmlElement } from "../types/xml-element.js"
import { applyAutoLayout } from "./auto-layout.js"
import type {
	BpmnAssociation,
	BpmnConditionExpression,
	BpmnDefinitions,
	BpmnElementType,
	BpmnError,
	BpmnEscalation,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMessage,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnProcess,
	BpmnReceiveTask,
	BpmnSendTask,
	BpmnSequenceFlow,
	BpmnSignal,
	BpmnTextAnnotation,
} from "./bpmn-model.js"
import type { RestConnectorConfig } from "./rest-connector.js"
import {
	restConnectorRetries,
	restConnectorTaskType,
	restConnectorToIoMappingInputs,
	restConnectorToTaskHeaders,
} from "./rest-connector.js"
import { type ZeebeExtensions, zeebeExtensionsToXmlElements } from "./zeebe-extensions.js"

// Keep in sync with packages/core/package.json version
const EXPORTER_VERSION = "0.0.23"

// ---------------------------------------------------------------------------
// Option types
// ---------------------------------------------------------------------------

/** Options shared by all element methods. */
export interface ElementOptions {
	name?: string
	isForCompensation?: boolean
}

/** Options for send/receive task elements. */
export interface MessageTaskOptions extends ElementOptions {
	/** Message name — generates or reuses a root <bpmn:message> and sets messageRef. */
	messageName?: string
}

/** Options for creating a start event. */
export interface StartEventOptions extends ElementOptions {
	/** Timer duration (ISO 8601) — creates a timer start event. */
	timerDuration?: string
	/** Timer date (ISO 8601) — creates a timer start event. */
	timerDate?: string
	/** Timer cycle (ISO 8601) — creates a timer start event. */
	timerCycle?: string
	/** Message name — creates a message start event. */
	messageName?: string
	/** Zeebe properties (e.g. webhook connector config). */
	zeebeProperties?: Array<{ name: string; value: string }>
	/** Zeebe modeler template ID. */
	modelerTemplate?: string
	/** Zeebe modeler template version. */
	modelerTemplateVersion?: string
	/** Zeebe modeler template icon (data URI). */
	modelerTemplateIcon?: string
	/**
	 * Non-interrupting flag — only meaningful for start events inside event sub-processes.
	 * Pass `false` to emit `isInterrupting="false"`. Omit for the default interrupting behavior.
	 */
	isInterrupting?: boolean
}

/** Options for creating a service task. */
export interface ServiceTaskOptions {
	/** Display name (required for BPMN canvas visibility). */
	name: string
	/** Zeebe job type for this task. */
	taskType: string
	/** Number of retries (defaults to "3"). */
	retries?: string
	/** Input/output variable mappings. */
	ioMapping?: {
		inputs?: Array<{ source: string; target: string }>
		outputs?: Array<{ source: string; target: string }>
	}
	/** Task header key-value pairs. */
	taskHeaders?: Record<string, string>
	/** Zeebe modeler template ID. */
	modelerTemplate?: string
	/** Zeebe modeler template version. */
	modelerTemplateVersion?: string
	/** Zeebe modeler template icon (data URI). */
	modelerTemplateIcon?: string
	/** Mark this task as a compensation handler. */
	isForCompensation?: boolean
}

/** Options for creating a script task. */
export interface ScriptTaskOptions {
	/** Display name. */
	name?: string
	/** FEEL expression for the script. */
	expression: string
	/** Variable name to store the result. */
	resultVariable: string
	/** Mark this task as a compensation handler. */
	isForCompensation?: boolean
}

/** Options for creating a user task. */
export interface UserTaskOptions {
	/** Display name. */
	name?: string
	/** Form key or form reference. */
	formId?: string
	/** Emit <zeebe:userTask /> to mark as a Camunda 8 native user task. */
	zeebeUserTask?: boolean
	/** Mark this task as a compensation handler. */
	isForCompensation?: boolean
}

/** Options for creating a call activity. */
export interface CallActivityOptions {
	/** Display name. */
	name?: string
	/** Process ID to call. */
	processId: string
	/** Whether to propagate all child variables. */
	propagateAllChildVariables?: boolean
	/** Mark this activity as a compensation handler. */
	isForCompensation?: boolean
}

/** Options for creating a business rule task. */
export interface BusinessRuleTaskOptions {
	/** Display name. */
	name?: string
	/** Zeebe job type. */
	taskType?: string
	/** DMN decision ID to evaluate. */
	decisionId?: string
	/** Variable to store the result. */
	resultVariable?: string
	/** Mark this task as a compensation handler. */
	isForCompensation?: boolean
}

/** Options for gateway elements. */
export interface GatewayOptions extends ElementOptions {
	/** ID of the default sequence flow (set manually; prefer branch().defaultFlow()). */
	defaultFlow?: string
}

/** Options for an intermediate catch event. */
export interface IntermediateCatchEventOptions extends ElementOptions {
	/** Timer duration (ISO 8601) — creates a timer catch event. */
	timerDuration?: string
	/** Timer date (ISO 8601) — creates a timer catch event that fires at a specific date/time. */
	timerDate?: string
	/** Timer cycle (ISO 8601) — creates a recurring timer catch event. */
	timerCycle?: string
	/** Message name — creates a message catch event (aspirational). */
	messageName?: string
	/** Signal name — creates a signal catch event (aspirational). */
	signalName?: string
}

/** Options for an intermediate throw event. */
export interface IntermediateThrowEventOptions extends ElementOptions {
	/** Message name — creates a message throw event (aspirational). */
	messageName?: string
	/** Signal name — creates a signal throw event (aspirational). */
	signalName?: string
	/** Escalation code — creates an escalation throw event (aspirational). */
	escalationCode?: string
	/** Emit a compensateEventDefinition. */
	compensation?: boolean
	/** Activity to compensate (activityRef attribute on compensateEventDefinition). */
	activityRef?: string
}

/** Options for an end event. */
export interface EndEventOptions extends ElementOptions {
	/** Error code — creates an error end event. */
	errorCode?: string
	/** Error code — creates an error end event. Alias for errorCode. */
	errorRef?: string
	/** Message name — creates a message end event. */
	messageName?: string
	/** Signal name — creates a signal end event. */
	signalName?: string
	/** Escalation code — creates an escalation end event. */
	escalationCode?: string
}

/** Options for a boundary event. */
export interface BoundaryEventOptions extends ElementOptions {
	/** ID of the activity this boundary event is attached to. */
	attachedTo: string
	/** Whether the host activity is cancelled when the event triggers (default true). */
	cancelActivity?: boolean
	/** Error code — creates an error boundary event. */
	errorCode?: string
	/** Error code — creates an error boundary event. Alias for errorCode. */
	errorRef?: string
	/** Timer duration — creates a timer boundary event (aspirational). */
	timerDuration?: string
	/** Timer date (ISO 8601) — creates a timer boundary event that fires at a specific date/time. */
	timerDate?: string
	/** Timer cycle (ISO 8601) — creates a recurring timer boundary event. */
	timerCycle?: string
	/** Message name — creates a message boundary event (aspirational). */
	messageName?: string
	/** Signal name — creates a signal boundary event (aspirational). */
	signalName?: string
	/** Creates a compensation boundary event. */
	compensation?: boolean
}

/** Multi-instance loop configuration. */
export interface MultiInstanceOptions {
	isSequential?: boolean
	collection?: string
	elementVariable?: string
	completionCondition?: string
}

/** Options for sub-process elements. */
export interface SubProcessOptions extends ElementOptions {
	multiInstance?: MultiInstanceOptions
}

/** Options for ad-hoc sub-process elements. */
export interface AdHocSubProcessOptions extends ElementOptions {
	/** FEEL expression for determining active elements. */
	activeElementsCollection?: string
	/** Output collection for tool call results (agentic AI pattern). */
	outputCollection?: string
	/** Output element FEEL expression (agentic AI pattern). */
	outputElement?: string
	/** Zeebe task definition (agentic AI agent job worker). */
	taskDefinition?: { type: string; retries?: string }
	/** IO mapping for the ad-hoc sub-process. */
	ioMapping?: {
		inputs?: Array<{ source: string; target: string }>
		outputs?: Array<{ source: string; target: string }>
	}
	/** Task header key-value pairs. */
	taskHeaders?: Record<string, string>
	/** Multi-instance loop configuration. */
	loopCharacteristics?: {
		inputCollection: string
		inputElement?: string
		outputCollection?: string
		outputElement?: string
	}
	multiInstance?: MultiInstanceOptions
	/** Zeebe modeler template ID. */
	modelerTemplate?: string
	/** Zeebe modeler template version. */
	modelerTemplateVersion?: string
	/** Zeebe modeler template icon (data URI). */
	modelerTemplateIcon?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveMessage(messageName: string, rootMessages: BpmnMessage[]): string {
	let existing = rootMessages.find((m) => m.name === messageName)
	if (!existing) {
		existing = { id: generateId("Message"), name: messageName, unknownAttributes: {} }
		rootMessages.push(existing)
	}
	return existing.id
}

function buildEventDefinitions(
	opts: {
		timerDuration?: string
		timerDate?: string
		timerCycle?: string
		errorCode?: string
		errorRef?: string
		messageName?: string
		signalName?: string
		escalationCode?: string
		compensation?: boolean
		activityRef?: string
	},
	rootErrors?: BpmnError[],
	rootMessages?: BpmnMessage[],
	rootSignals?: BpmnSignal[],
	rootEscalations?: BpmnEscalation[],
): BpmnEventDefinition[] {
	const defs: BpmnEventDefinition[] = []
	if (opts.timerDuration || opts.timerDate || opts.timerCycle) {
		defs.push({
			type: "timer",
			timeDuration: opts.timerDuration,
			timeDate: opts.timerDate,
			timeCycle: opts.timerCycle,
		})
	}
	if (opts.errorCode !== undefined || opts.errorRef !== undefined) {
		const codeOrRef = opts.errorCode ?? opts.errorRef
		let errorRef: string | undefined
		if (codeOrRef !== undefined && rootErrors) {
			let existing = rootErrors.find((e) => e.errorCode === codeOrRef || e.name === codeOrRef)
			if (!existing) {
				existing = { id: generateId("Error"), name: codeOrRef, errorCode: codeOrRef }
				rootErrors.push(existing)
			}
			errorRef = existing.id
		} else {
			errorRef = codeOrRef
		}
		defs.push({ type: "error", errorRef })
	}
	if (opts.messageName !== undefined) {
		const messageRef = rootMessages
			? resolveMessage(opts.messageName, rootMessages)
			: opts.messageName
		defs.push({ type: "message", messageRef })
	}
	if (opts.signalName !== undefined) {
		let signalRef: string | undefined = opts.signalName
		if (rootSignals) {
			let existing = rootSignals.find((s) => s.name === opts.signalName)
			if (!existing) {
				existing = { id: generateId("Signal"), name: opts.signalName }
				rootSignals.push(existing)
			}
			signalRef = existing.id
		}
		defs.push({ type: "signal", signalRef })
	}
	if (opts.escalationCode !== undefined) {
		let escalationRef: string | undefined = opts.escalationCode
		if (rootEscalations) {
			let existing = rootEscalations.find((e) => e.escalationCode === opts.escalationCode)
			if (!existing) {
				existing = {
					id: generateId("Escalation"),
					name: opts.escalationCode,
					escalationCode: opts.escalationCode,
				}
				rootEscalations.push(existing)
			}
			escalationRef = existing.id
		}
		defs.push({ type: "escalation", escalationRef })
	}
	if (opts.compensation) {
		defs.push({ type: "compensate", activityRef: opts.activityRef })
	}
	return defs
}

function makeFlowElement(
	id: string,
	type: BpmnElementType,
	options?: { name?: string; extensionElements?: XmlElement[] },
): BpmnFlowElement {
	const base = {
		id,
		name: options?.name,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: options?.extensionElements ?? [],
		unknownAttributes: {} as Record<string, string>,
	}

	switch (type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
			return { ...base, type, eventDefinitions: [] }
		case "boundaryEvent":
			return {
				...base,
				type: "boundaryEvent",
				attachedToRef: "",
				eventDefinitions: [],
			}
		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			return { ...base, type } as BpmnFlowElement
		case "exclusiveGateway":
		case "inclusiveGateway":
		case "complexGateway":
			return { ...base, type } as BpmnFlowElement
		case "parallelGateway":
		case "eventBasedGateway":
			return { ...base, type } as BpmnFlowElement
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "eventSubProcess":
			return {
				...base,
				type: "eventSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "transaction":
			return {
				...base,
				type: "transaction",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
	}
}

function buildMultiInstance(options: MultiInstanceOptions): BpmnMultiInstanceLoopCharacteristics {
	const extChildren: XmlElement[] = []
	if (options.collection) {
		const attrs: Record<string, string> = {
			inputCollection: options.collection,
		}
		if (options.elementVariable) {
			attrs.inputElement = options.elementVariable
		}
		extChildren.push({
			name: "zeebe:loopCharacteristics",
			attributes: attrs,
			children: [],
		})
	}
	return { isSequential: options.isSequential || undefined, extensionElements: extChildren }
}

function buildAdHocLoopCharacteristics(lc: {
	inputCollection: string
	inputElement?: string
	outputCollection?: string
	outputElement?: string
}): BpmnMultiInstanceLoopCharacteristics {
	const attrs: Record<string, string> = {
		inputCollection: lc.inputCollection,
	}
	if (lc.inputElement) attrs.inputElement = lc.inputElement
	if (lc.outputCollection) attrs.outputCollection = lc.outputCollection
	if (lc.outputElement) attrs.outputElement = lc.outputElement

	return {
		extensionElements: [
			{
				name: "zeebe:loopCharacteristics",
				attributes: attrs,
				children: [],
			},
		],
	}
}

function recomputeIncomingOutgoing(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
	for (const el of elements) {
		el.incoming = []
		el.outgoing = []
	}
	const elementMap = new Map(elements.map((el) => [el.id, el]))
	for (const flow of flows) {
		elementMap.get(flow.sourceRef)?.outgoing.push(flow.id)
		elementMap.get(flow.targetRef)?.incoming.push(flow.id)
	}
}

function buildServiceTaskExtensions(options: ServiceTaskOptions): XmlElement[] {
	const extensions: ZeebeExtensions = {
		taskDefinition: {
			type: options.taskType,
			retries: options.retries,
		},
	}

	if (options.ioMapping) {
		extensions.ioMapping = {
			inputs: options.ioMapping.inputs ?? [],
			outputs: options.ioMapping.outputs ?? [],
		}
	}

	if (options.taskHeaders) {
		extensions.taskHeaders = {
			headers: Object.entries(options.taskHeaders).map(([key, value]) => ({
				key,
				value,
			})),
		}
	}

	return zeebeExtensionsToXmlElements(extensions)
}

function makeConditionExpression(expression: string): BpmnConditionExpression {
	return {
		text: expression,
		attributes: { "xsi:type": "bpmn:tFormalExpression" },
	}
}

// ---------------------------------------------------------------------------
// Element factory functions — shared by all three builder classes
// ---------------------------------------------------------------------------

function makeServiceTaskEl(id: string, options: ServiceTaskOptions): BpmnFlowElement {
	const unknownAttributes: Record<string, string> = {}
	if (options.modelerTemplate) unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate
	if (options.modelerTemplateVersion)
		unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion
	if (options.modelerTemplateIcon)
		unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon
	const el = makeFlowElement(id, "serviceTask", {
		name: options.name,
		extensionElements: buildServiceTaskExtensions(options),
	})
	el.unknownAttributes = unknownAttributes
	if (options.isForCompensation) el.isForCompensation = true
	return el
}

function makeScriptTaskEl(id: string, options: ScriptTaskOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "scriptTask", {
		name: options.name,
		extensionElements: zeebeExtensionsToXmlElements({
			unknownElements: [
				{
					name: "zeebe:script",
					attributes: { expression: options.expression, resultVariable: options.resultVariable },
					children: [],
				},
			],
		}),
	})
	if (options.isForCompensation) el.isForCompensation = true
	return el
}

function makeUserTaskEl(id: string, options?: UserTaskOptions): BpmnFlowElement {
	const ext = zeebeExtensionsToXmlElements({
		...(options?.zeebeUserTask ? { userTask: true } : {}),
		...(options?.formId ? { formDefinition: { formId: options.formId } } : {}),
	})
	const el = makeFlowElement(id, "userTask", { name: options?.name, extensionElements: ext })
	if (options?.isForCompensation) el.isForCompensation = true
	return el
}

function makeBusinessRuleTaskEl(id: string, options?: BusinessRuleTaskOptions): BpmnFlowElement {
	const ext: XmlElement[] = []
	if (options?.taskType) {
		ext.push(...zeebeExtensionsToXmlElements({ taskDefinition: { type: options.taskType } }))
	}
	if (options?.decisionId) {
		ext.push(
			...zeebeExtensionsToXmlElements({
				calledDecision: {
					decisionId: options.decisionId,
					resultVariable: options.resultVariable ?? "result",
				},
			}),
		)
	}
	const el = makeFlowElement(id, "businessRuleTask", {
		name: options?.name,
		extensionElements: ext,
	})
	if (options?.isForCompensation) el.isForCompensation = true
	return el
}

function makeCallActivityEl(id: string, options: CallActivityOptions): BpmnFlowElement {
	const attrs: Record<string, string> = { processId: options.processId }
	if (options.propagateAllChildVariables !== undefined) {
		attrs.propagateAllChildVariables = String(options.propagateAllChildVariables)
	}
	const el = makeFlowElement(id, "callActivity", {
		name: options.name,
		extensionElements: zeebeExtensionsToXmlElements({
			unknownElements: [{ name: "zeebe:calledElement", attributes: attrs, children: [] }],
		}),
	})
	if (options.isForCompensation) el.isForCompensation = true
	return el
}

function makeExclusiveGatewayEl(id: string, options?: GatewayOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "exclusiveGateway", options)
	if (options?.defaultFlow && el.type === "exclusiveGateway") {
		;(el as { default?: string }).default = options.defaultFlow
	}
	return el
}

function makeInclusiveGatewayEl(id: string, options?: GatewayOptions): BpmnFlowElement {
	const el = makeFlowElement(id, "inclusiveGateway", options)
	if (options?.defaultFlow && el.type === "inclusiveGateway") {
		;(el as { default?: string }).default = options.defaultFlow
	}
	return el
}

// ---------------------------------------------------------------------------
// Shared graph helpers — used by ProcessBuilder and SubProcessContentBuilder
// ---------------------------------------------------------------------------

function insertJoinGateways(elements: BpmnFlowElement[], flows: BpmnSequenceFlow[]): void {
	const GATEWAY_TYPES = new Set([
		"exclusiveGateway",
		"parallelGateway",
		"inclusiveGateway",
		"eventBasedGateway",
	])

	const elementTypes = new Map<string, string>()
	for (const el of elements) elementTypes.set(el.id, el.type)

	const outCount = new Map<string, number>()
	for (const flow of flows) {
		outCount.set(flow.sourceRef, (outCount.get(flow.sourceRef) ?? 0) + 1)
	}
	const splitGateways = new Set<string>()
	for (const [id, count] of outCount) {
		const type = elementTypes.get(id)
		if (type && GATEWAY_TYPES.has(type) && count >= 2) splitGateways.add(id)
	}
	if (splitGateways.size === 0) return

	const incoming = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of flows) {
		const arr = incoming.get(flow.targetRef)
		if (arr) arr.push(flow)
		else incoming.set(flow.targetRef, [flow])
	}

	for (const [targetId, inFlows] of incoming) {
		if (inFlows.length < 2) continue
		const splitToFlows = new Map<string, BpmnSequenceFlow[]>()
		for (const flow of inFlows) {
			const split = traceBackToSplit(flow.sourceRef, splitGateways, flows)
			if (split) {
				const arr = splitToFlows.get(split)
				if (arr) arr.push(flow)
				else splitToFlows.set(split, [flow])
			}
		}
		for (const [splitId, convergingFlows] of splitToFlows) {
			if (convergingFlows.length < 2) continue
			const gwType = elementTypes.get(splitId)
			if (!gwType) continue
			// eventBasedGateway is split-only; converge through an XOR join instead
			const joinType: BpmnElementType =
				gwType === "eventBasedGateway" ? "exclusiveGateway" : (gwType as BpmnElementType)
			const targetType = elementTypes.get(targetId)
			if (targetType === joinType) continue
			const joinId = `${splitId}_join`
			if (elementTypes.has(joinId)) continue
			const joinElement = makeFlowElement(joinId, joinType, {})
			elements.push(joinElement)
			elementTypes.set(joinId, joinType)
			for (const flow of convergingFlows) flow.targetRef = joinId
			flows.push({
				id: generateId("Flow"),
				sourceRef: joinId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
	}
}

function traceBackToSplit(
	nodeId: string,
	splitGateways: Set<string>,
	flows: BpmnSequenceFlow[],
): string | undefined {
	const visited = new Set<string>()
	let current = nodeId
	while (current) {
		if (visited.has(current)) return undefined
		visited.add(current)
		if (splitGateways.has(current)) return current
		const inFlows = flows.filter((f) => f.targetRef === current)
		if (inFlows.length !== 1) return undefined
		const prev = inFlows[0]
		if (!prev) return undefined
		current = prev.sourceRef
	}
	return undefined
}

// ---------------------------------------------------------------------------
// Branch builder (used inside gateway branch callbacks)
// ---------------------------------------------------------------------------

/**
 * Builder for a single named branch path from a gateway.
 *
 * Use `.condition(expr)` to set a FEEL condition on the outgoing sequence
 * flow from the gateway, or `.defaultFlow()` to mark it as the default path.
 */
export class BranchBuilder {
	/** @internal */
	readonly _elements: BpmnFlowElement[] = []
	/** @internal */
	readonly _flows: BpmnSequenceFlow[] = []
	/** @internal */
	_defaultFlowId: string | undefined
	private lastNodeId: string | undefined
	private readonly gatewayId: string
	private readonly branchName: string
	private isFirstElement = true
	private pendingCondition: string | undefined
	private pendingDefault = false
	/** @internal – true once connectTo() has been called, meaning the branch end is already wired */
	_connected = false
	/** @internal */
	readonly _textAnnotations: BpmnTextAnnotation[] = []
	/** @internal */
	readonly _associations: BpmnAssociation[] = []
	/** @internal – ID of the last gateway added in this branch (for nested branch() support). */
	private currentGatewayId: string | undefined
	/** @internal – Open ends of nested branches waiting to auto-connect to the next element. */
	private openBranchEnds: string[] = []
	private readonly _annCounters = new Map<string, number>()
	private readonly rootErrors: BpmnError[]
	private readonly rootMessages: BpmnMessage[]
	private readonly rootSignals: BpmnSignal[]
	private readonly rootEscalations: BpmnEscalation[]

	/** @internal */
	constructor(
		gatewayId: string,
		branchName: string,
		rootErrors: BpmnError[] = [],
		rootMessages: BpmnMessage[] = [],
		rootSignals: BpmnSignal[] = [],
		rootEscalations: BpmnEscalation[] = [],
	) {
		this.gatewayId = gatewayId
		this.branchName = branchName
		this.lastNodeId = gatewayId
		this.rootErrors = rootErrors
		this.rootMessages = rootMessages
		this.rootSignals = rootSignals
		this.rootEscalations = rootEscalations
	}

	/** Set a FEEL condition expression on this branch's outgoing sequence flow. */
	condition(expression: string): this {
		this.pendingCondition = expression
		return this
	}

	/** Mark this branch as the gateway's default (no-condition) flow. */
	defaultFlow(): this {
		this.pendingDefault = true
		return this
	}

	private addElement(element: BpmnFlowElement): this {
		this._elements.push(element)

		if (this.lastNodeId) {
			const flowId = generateId("Flow")
			const flow: BpmnSequenceFlow = {
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				name: this.isFirstElement ? this.branchName : undefined,
				conditionExpression:
					this.isFirstElement && this.pendingCondition
						? makeConditionExpression(this.pendingCondition)
						: undefined,
				extensionElements: [],
				unknownAttributes: {},
			}
			this._flows.push(flow)
			if (this.isFirstElement && this.pendingDefault) {
				this._defaultFlowId = flowId
			}
			this.isFirstElement = false
		}

		for (const branchEnd of this.openBranchEnds) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: branchEnd,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.openBranchEnds = []

		this.lastNodeId = element.id
		return this
	}

	/**
	 * Connect the current position to an existing or future element by ID.
	 * Supports forward references (element created later) and backward references (loops).
	 */
	connectTo(targetId: string): this {
		const flowId = generateId("Flow")
		const flow: BpmnSequenceFlow = {
			id: flowId,
			// biome-ignore lint/style/noNonNullAssertion: lastNodeId starts as gatewayId and is always defined in pre-branch context
			sourceRef: this.lastNodeId!,
			targetRef: targetId,
			name: this.isFirstElement ? this.branchName : undefined,
			conditionExpression:
				this.isFirstElement && this.pendingCondition
					? makeConditionExpression(this.pendingCondition)
					: undefined,
			extensionElements: [],
			unknownAttributes: {},
		}
		this._flows.push(flow)

		if (this.isFirstElement && this.pendingDefault) {
			this._defaultFlowId = flowId
		}

		this.isFirstElement = false
		this.lastNodeId = targetId
		this._connected = true
		return this
	}

	/** @internal – ID of the last element added (or undefined if branches are open). */
	get _lastNodeId(): string | undefined {
		return this.lastNodeId
	}

	/** @internal – Open ends of nested branches that have not yet been connected. */
	get _openBranchEnds(): string[] {
		return this.openBranchEnds
	}

	// ---- Annotations ----

	/** Attach a text annotation to the element at the current cursor position. */
	textAnnotation(text: string): this {
		// biome-ignore lint/style/noNonNullAssertion: lastNodeId starts as gatewayId and is always defined in pre-branch context
		return this.annotate(this.lastNodeId!, text)
	}

	/** Attach a text annotation to an element by explicit ID. */
	annotate(elementId: string, text: string): this {
		const n = (this._annCounters.get(elementId) ?? 0) + 1
		this._annCounters.set(elementId, n)
		const annId = `TextAnnotation_${elementId}_${n}`
		this._textAnnotations.push({ id: annId, text, unknownAttributes: {} })
		this._associations.push({
			id: `Association_${elementId}_${n}`,
			sourceRef: elementId,
			targetRef: annId,
			associationDirection: "None",
			unknownAttributes: {},
		})
		return this
	}

	// ---- Flow-node methods (mirror ProcessBuilder) ----

	serviceTask(id: string, options: ServiceTaskOptions): this {
		return this.addElement(makeServiceTaskEl(id, options))
	}

	userTask(id: string, options?: UserTaskOptions): this {
		return this.addElement(makeUserTaskEl(id, options))
	}

	scriptTask(id: string, options: ScriptTaskOptions): this {
		return this.addElement(makeScriptTaskEl(id, options))
	}

	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}

	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}

	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		return this.addElement(makeBusinessRuleTaskEl(id, options))
	}

	callActivity(id: string, options: CallActivityOptions): this {
		return this.addElement(makeCallActivityEl(id, options))
	}

	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "task", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}

	startEvent(id?: string, options?: StartEventOptions): this {
		const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options)
		if (el.type === "startEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		return this.addElement(el)
	}

	endEvent(id?: string, options?: EndEventOptions): this {
		const el = makeFlowElement(id ?? generateId("EndEvent"), "endEvent", options)
		if (el.type === "endEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		return this.addElement(el)
	}

	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateThrowEvent"),
			"intermediateThrowEvent",
			options,
		)
		if (el.type === "intermediateThrowEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		return this.addElement(el)
	}

	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateCatchEvent"),
			"intermediateCatchEvent",
			options,
		)
		if (el.type === "intermediateCatchEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		return this.addElement(el)
	}

	exclusiveGateway(id: string, options?: GatewayOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeExclusiveGatewayEl(id, options))
	}

	parallelGateway(id: string, options?: ElementOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeFlowElement(id, "parallelGateway", options))
	}

	inclusiveGateway(id: string, options?: GatewayOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeInclusiveGatewayEl(id, options))
	}

	eventBasedGateway(id: string, options?: ElementOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeFlowElement(id, "eventBasedGateway", options))
	}
}

// ---------------------------------------------------------------------------
// Sub-process content builder
// ---------------------------------------------------------------------------

/** Builder for the contents of a sub-process or ad-hoc sub-process. */
export class SubProcessContentBuilder {
	/** @internal */
	readonly _elements: BpmnFlowElement[] = []
	/** @internal */
	readonly _flows: BpmnSequenceFlow[] = []
	/** @internal */
	readonly _textAnnotations: BpmnTextAnnotation[] = []
	/** @internal */
	readonly _associations: BpmnAssociation[] = []
	private readonly _annCounters = new Map<string, number>()
	private lastNodeId: string | undefined
	private currentGatewayId: string | undefined
	private openBranchEnds: string[] = []
	private readonly rootMessages: BpmnMessage[]

	/** @internal */
	constructor(rootMessages: BpmnMessage[] = []) {
		this.rootMessages = rootMessages
	}

	private addElement(element: BpmnFlowElement): this {
		if (this._elements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in sub-process`)
		}
		this._elements.push(element)
		if (this.lastNodeId) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		for (const branchEnd of this.openBranchEnds) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: branchEnd,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.openBranchEnds = []
		this.lastNodeId = element.id
		return this
	}

	// ---- Events ----

	startEvent(id?: string, options?: StartEventOptions): this {
		const el = makeFlowElement(id ?? generateId("StartEvent"), "startEvent", options)
		if (el.type === "startEvent" && options) {
			el.eventDefinitions = buildEventDefinitions(options)
			if (options.isInterrupting === false) el.isInterrupting = false
		}
		return this.addElement(el)
	}

	endEvent(id?: string, options?: EndEventOptions): this {
		const el = makeFlowElement(id ?? generateId("EndEvent"), "endEvent", options)
		if (el.type === "endEvent" && options) el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateThrowEvent"),
			"intermediateThrowEvent",
			options,
		)
		if (el.type === "intermediateThrowEvent" && options)
			el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const el = makeFlowElement(
			id ?? generateId("IntermediateCatchEvent"),
			"intermediateCatchEvent",
			options,
		)
		if (el.type === "intermediateCatchEvent" && options)
			el.eventDefinitions = buildEventDefinitions(options)
		return this.addElement(el)
	}

	// ---- Tasks ----

	serviceTask(id: string, options: ServiceTaskOptions): this {
		return this.addElement(makeServiceTaskEl(id, options))
	}

	scriptTask(id: string, options: ScriptTaskOptions): this {
		return this.addElement(makeScriptTaskEl(id, options))
	}

	userTask(id: string, options?: UserTaskOptions): this {
		return this.addElement(makeUserTaskEl(id, options))
	}

	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		return this.addElement(makeBusinessRuleTaskEl(id, options))
	}

	callActivity(id: string, options: CallActivityOptions): this {
		return this.addElement(makeCallActivityEl(id, options))
	}

	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}

	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		return this.addElement(el)
	}

	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "task", options)
		if (options?.isForCompensation) el.isForCompensation = true
		return this.addElement(el)
	}

	// ---- Gateways ----

	exclusiveGateway(id: string, options?: GatewayOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeExclusiveGatewayEl(id, options))
	}

	parallelGateway(id: string, options?: ElementOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeFlowElement(id, "parallelGateway", options))
	}

	inclusiveGateway(id: string, options?: GatewayOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeInclusiveGatewayEl(id, options))
	}

	eventBasedGateway(id: string, options?: ElementOptions): this {
		this.currentGatewayId = id
		return this.addElement(makeFlowElement(id, "eventBasedGateway", options))
	}

	// ---- Annotations ----

	/** Attach a text annotation to the element at the current cursor position. */
	textAnnotation(text: string): this {
		if (!this.lastNodeId) {
			throw new Error("textAnnotation() must follow a flow element")
		}
		return this.annotate(this.lastNodeId, text)
	}

	/** Attach a text annotation to an element by explicit ID. */
	annotate(elementId: string, text: string): this {
		const n = (this._annCounters.get(elementId) ?? 0) + 1
		this._annCounters.set(elementId, n)
		const annId = `TextAnnotation_${elementId}_${n}`
		this._textAnnotations.push({ id: annId, text, unknownAttributes: {} })
		this._associations.push({
			id: `Association_${elementId}_${n}`,
			sourceRef: elementId,
			targetRef: annId,
			associationDirection: "None",
			unknownAttributes: {},
		})
		return this
	}

	// ---- Branching & flow control ----

	branch(name: string, callback: (b: BranchBuilder) => void): this {
		if (!this.currentGatewayId) {
			throw new Error("branch() must be called after a gateway element")
		}
		const b = new BranchBuilder(this.currentGatewayId, name)
		callback(b)

		for (const el of b._elements) {
			if (this._elements.some((n) => n.id === el.id)) {
				throw new Error(`Duplicate element ID "${el.id}"`)
			}
			this._elements.push(el)
		}
		for (const fl of b._flows) this._flows.push(fl)
		for (const ann of b._textAnnotations) this._textAnnotations.push(ann)
		for (const assoc of b._associations) this._associations.push(assoc)

		if (b._defaultFlowId) {
			const gw = this._elements.find((n) => n.id === this.currentGatewayId)
			if (gw && (gw.type === "exclusiveGateway" || gw.type === "inclusiveGateway")) {
				gw.default = b._defaultFlowId
			}
		}

		if (!b._connected && b._elements.length > 0) {
			const lastEl = b._elements[b._elements.length - 1]
			if (lastEl && lastEl.type !== "endEvent") {
				this.openBranchEnds.push(b._lastNodeId)
			}
		}

		this.lastNodeId = undefined
		return this
	}

	connectTo(targetId: string): this {
		if (this.lastNodeId) {
			this._flows.push({
				id: generateId("Flow"),
				sourceRef: this.lastNodeId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.lastNodeId = undefined
		return this
	}

	element(elementId: string): this {
		if (!this._elements.some((n) => n.id === elementId)) {
			throw new Error(`Element "${elementId}" not found in sub-process`)
		}
		this.lastNodeId = elementId
		this.currentGatewayId = undefined
		return this
	}
}

// ---------------------------------------------------------------------------
// Process builder (top-level entry point)
// ---------------------------------------------------------------------------

/** Fluent builder for constructing BPMN processes. */
export class ProcessBuilder {
	private readonly processId: string
	private processName?: string
	private _isExecutable = true
	private _versionTag?: string
	private readonly flowElements: BpmnFlowElement[] = []
	private readonly sequenceFlows: BpmnSequenceFlow[] = []
	private readonly rootErrors: BpmnError[] = []
	private readonly rootMessages: BpmnMessage[] = []
	private readonly rootSignals: BpmnSignal[] = []
	private readonly rootEscalations: BpmnEscalation[] = []
	private readonly _textAnnotations: BpmnTextAnnotation[] = []
	private readonly _associations: BpmnAssociation[] = []
	private readonly _annCounters = new Map<string, number>()
	private lastNodeId: string | undefined
	private currentGatewayId: string | undefined
	private openBranchEnds: string[] = []
	private _autoLayout = false
	private _executionPlatformVersion = "8.9.0"
	private _serviceTaskDefaults: { retries?: string } = {}
	private _savedMainFlowId: string | undefined = undefined

	constructor(processId: string) {
		this.processId = processId
	}

	/** Enable auto-layout: `build()` will run the layout engine and populate diagram interchange data. */
	withAutoLayout(): this {
		this._autoLayout = true
		return this
	}

	/** Set the Camunda execution platform version stamped into the BPMN definitions. Defaults to `"8.9.0"`. */
	executionPlatformVersion(version: string): this {
		this._executionPlatformVersion = version
		return this
	}

	/** Set process-wide defaults applied to subsequently added elements. */
	defaults(options: { serviceTask?: { retries?: string } }): this {
		if (options.serviceTask)
			this._serviceTaskDefaults = { ...this._serviceTaskDefaults, ...options.serviceTask }
		return this
	}

	/** Set the display name for this process. */
	name(name: string): this {
		this.processName = name
		return this
	}

	/** Set whether this process is executable. */
	executable(value: boolean): this {
		this._isExecutable = value
		return this
	}

	/** Set the process version tag. */
	versionTag(tag: string): this {
		this._versionTag = tag
		return this
	}

	// ---- Events ----

	/** Add a start event. Start events never auto-connect from the previous element. */
	startEvent(id?: string, options?: StartEventOptions): this {
		const nodeId = id ?? generateId("StartEvent")
		const extElements: XmlElement[] = []
		if (options?.zeebeProperties) {
			extElements.push(
				...zeebeExtensionsToXmlElements({
					properties: { properties: options.zeebeProperties },
				}),
			)
		}
		const element = makeFlowElement(nodeId, "startEvent", {
			name: options?.name,
			extensionElements: extElements,
		})
		if (element.type === "startEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
			if (options.isInterrupting === false) element.isInterrupting = false
		}
		if (options?.modelerTemplate) {
			element.unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate
		}
		if (options?.modelerTemplateVersion) {
			element.unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion
		}
		if (options?.modelerTemplateIcon) {
			element.unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon
		}
		this.addFlowElement(element)
		return this
	}

	/**
	 * Add a disconnected start event — begins a new parallel path in the process.
	 *
	 * Unlike `startEvent()` which continues from the current position,
	 * `addStartEvent()` clears the current position first so the start event
	 * is completely disconnected.
	 */
	addStartEvent(id?: string, options?: StartEventOptions): this {
		this.lastNodeId = undefined
		this.currentGatewayId = undefined
		return this.startEvent(id, options)
	}

	/**
	 * Alias for `addStartEvent()` — begins a new disconnected parallel path.
	 *
	 * Use this for readability when modeling processes with multiple independent paths.
	 */
	disconnectedStartEvent(id?: string, options?: StartEventOptions): this {
		return this.addStartEvent(id, options)
	}

	/** Add an end event. */
	endEvent(id?: string, options?: EndEventOptions): this {
		const nodeId = id ?? generateId("EndEvent")
		const element = makeFlowElement(nodeId, "endEvent", options)
		if (element.type === "endEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		this.addFlowElement(element)
		return this
	}

	/** Add an intermediate throw event (none, message, signal, escalation). */
	intermediateThrowEvent(id?: string, options?: IntermediateThrowEventOptions): this {
		const nodeId = id ?? generateId("IntermediateThrowEvent")
		const element = makeFlowElement(nodeId, "intermediateThrowEvent", options)
		if (element.type === "intermediateThrowEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		this.addFlowElement(element)
		return this
	}

	/** Add an intermediate catch event (timer, message, signal). */
	intermediateCatchEvent(id?: string, options?: IntermediateCatchEventOptions): this {
		const nodeId = id ?? generateId("IntermediateCatchEvent")
		const element = makeFlowElement(nodeId, "intermediateCatchEvent", options)
		if (element.type === "intermediateCatchEvent" && options) {
			element.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		this.addFlowElement(element)
		return this
	}

	/**
	 * Add a boundary event attached to an existing activity.
	 *
	 * Boundary events do not auto-connect from the previous element.
	 * They start a new outgoing chain from the boundary event itself.
	 */
	boundaryEvent(id: string, options: BoundaryEventOptions): this {
		const element = makeFlowElement(id, "boundaryEvent", options)
		if (element.type === "boundaryEvent") {
			element.attachedToRef = options.attachedTo
			element.cancelActivity = options.cancelActivity
			element.eventDefinitions = buildEventDefinitions(
				options,
				this.rootErrors,
				this.rootMessages,
				this.rootSignals,
				this.rootEscalations,
			)
		}
		// Boundary events never auto-connect — temporarily clear lastNodeId
		const prevLast = this.lastNodeId
		this.lastNodeId = undefined
		this.addFlowElement(element)
		// For compensation boundary events, save the main-flow cursor AFTER addFlowElement
		// so subsequent normal elements don't accidentally clear it before it's consumed.
		if (options.compensation) {
			this._savedMainFlowId = prevLast
		}
		// Don't restore prevLast — the builder now chains from the boundary event
		void prevLast
		return this
	}

	/**
	 * Attach a boundary event to the preceding task and build its outgoing path,
	 * then restore the builder cursor to the preceding task so the main flow continues.
	 *
	 * @param id - ID for the boundary event element.
	 * @param options - Boundary event options (without `attachedTo` — inferred from cursor).
	 * @param handler - Callback that chains elements from the boundary event.
	 */
	withBoundary(
		id: string,
		options: Omit<BoundaryEventOptions, "attachedTo">,
		handler: (b: ProcessBuilder) => void,
	): this {
		const attachedTo = this.lastNodeId
		if (!attachedTo) {
			throw new Error(
				"withBoundary() must follow a task element. Current builder position has no active element.",
			)
		}

		const savedLast = this.lastNodeId
		const savedGateway = this.currentGatewayId
		const savedOpenEnds = [...this.openBranchEnds]
		this.openBranchEnds = []

		// boundaryEvent() sets lastNodeId to the boundary event id
		this.boundaryEvent(id, { ...options, attachedTo })

		// Build the error/timeout path chaining from the boundary event
		handler(this)

		// Restore cursor to the original task so the main flow continues
		this.lastNodeId = savedLast
		this.currentGatewayId = savedGateway
		this.openBranchEnds = savedOpenEnds
		this._savedMainFlowId = undefined

		return this
	}

	// ---- Tasks ----

	/** Add a service task with Zeebe task definition and optional IO mappings. */
	serviceTask(id: string, options: ServiceTaskOptions): this {
		const merged: ServiceTaskOptions = {
			...options,
			retries: options.retries ?? this._serviceTaskDefaults.retries,
		}
		this.addFlowElement(makeServiceTaskEl(id, merged))
		return this
	}

	/** Add a REST connector task — syntactic sugar over `serviceTask()`. */
	restConnector(id: string, config: RestConnectorConfig): this {
		const inputs = restConnectorToIoMappingInputs(config)
		const taskHeaderEntries = restConnectorToTaskHeaders(config)

		const extensions: ZeebeExtensions = {
			taskDefinition: {
				type: restConnectorTaskType(),
				retries: restConnectorRetries(config),
			},
			ioMapping: { inputs, outputs: [] },
		}

		if (taskHeaderEntries.length > 0) {
			extensions.taskHeaders = { headers: taskHeaderEntries }
		}

		const el = makeFlowElement(id, "serviceTask", {
			name: config.name,
			extensionElements: zeebeExtensionsToXmlElements(extensions),
		})
		// Stamp the template identifier so editors recognise this as a REST connector
		el.unknownAttributes = {
			"zeebe:modelerTemplate": "io.camunda.connectors.HttpJson.v2",
			"zeebe:modelerTemplateVersion": "12",
		}
		this.addFlowElement(el)
		return this
	}

	/** Add a script task with a FEEL expression. */
	scriptTask(id: string, options: ScriptTaskOptions): this {
		this.addFlowElement(makeScriptTaskEl(id, options))
		return this
	}

	/** Add a user task with optional form reference. */
	userTask(id: string, options?: UserTaskOptions): this {
		this.addFlowElement(makeUserTaskEl(id, options))
		return this
	}

	/** Add a send task (aspirational). */
	sendTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "sendTask", options) as BpmnSendTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		this.addFlowElement(el)
		return this
	}

	/** Add a receive task (aspirational). */
	receiveTask(id: string, options?: MessageTaskOptions): this {
		const el = makeFlowElement(id, "receiveTask", options) as BpmnReceiveTask
		if (options?.isForCompensation) el.isForCompensation = true
		if (options?.messageName) el.messageRef = resolveMessage(options.messageName, this.rootMessages)
		this.addFlowElement(el)
		return this
	}

	/** Add a business rule task. */
	businessRuleTask(id: string, options?: BusinessRuleTaskOptions): this {
		this.addFlowElement(makeBusinessRuleTaskEl(id, options))
		return this
	}

	/** Add a call activity referencing another process. */
	callActivity(id: string, options: CallActivityOptions): this {
		this.addFlowElement(makeCallActivityEl(id, options))
		return this
	}

	/** Add an abstract task with no Zeebe extensions. */
	task(id: string, options?: ElementOptions): this {
		const el = makeFlowElement(id, "task", options)
		if (options?.isForCompensation) el.isForCompensation = true
		this.addFlowElement(el)
		return this
	}

	// ---- Gateways ----

	/** Add an exclusive gateway (XOR split/join). */
	exclusiveGateway(id: string, options?: GatewayOptions): this {
		this.addFlowElement(makeExclusiveGatewayEl(id, options))
		this.currentGatewayId = id
		return this
	}

	/** Add a parallel gateway (AND split/join). */
	parallelGateway(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "parallelGateway", options))
		this.currentGatewayId = id
		return this
	}

	/** Add an inclusive gateway (OR split/join). Aspirational. */
	inclusiveGateway(id: string, options?: GatewayOptions): this {
		this.addFlowElement(makeInclusiveGatewayEl(id, options))
		this.currentGatewayId = id
		return this
	}

	/** Add an event-based gateway. Aspirational. */
	eventBasedGateway(id: string, options?: ElementOptions): this {
		this.addFlowElement(makeFlowElement(id, "eventBasedGateway", options))
		this.currentGatewayId = id
		return this
	}

	// ---- Branching & flow control ----

	/**
	 * Create a named branch from the current gateway.
	 *
	 * Each branch receives a {@link BranchBuilder} whose chain starts from
	 * the gateway. Use `.condition(expr)` or `.defaultFlow()` to configure
	 * the outgoing sequence flow, then chain flow-node methods, and finish
	 * with `.connectTo(targetId)` to merge into another element.
	 *
	 * @example
	 * ```ts
	 * .exclusiveGateway("check")
	 * .branch("yes", b => b.condition("= ok").serviceTask("do", { taskType: "x" }).connectTo("merge"))
	 * .branch("no", b => b.defaultFlow().serviceTask("fail", { taskType: "y" }).connectTo("merge"))
	 * .exclusiveGateway("merge")
	 * .endEvent("end")
	 * ```
	 */
	branch(name: string, callback: (b: BranchBuilder) => void): this {
		if (!this.currentGatewayId) {
			throw new Error("branch() must be called after a gateway element")
		}
		const b = new BranchBuilder(
			this.currentGatewayId,
			name,
			this.rootErrors,
			this.rootMessages,
			this.rootSignals,
			this.rootEscalations,
		)
		callback(b)

		for (const el of b._elements) {
			if (this.flowElements.some((n) => n.id === el.id)) {
				throw new Error(`Duplicate element ID "${el.id}"`)
			}
			this.flowElements.push(el)
		}
		for (const fl of b._flows) {
			this.sequenceFlows.push(fl)
		}
		for (const ann of b._textAnnotations) this._textAnnotations.push(ann)
		for (const assoc of b._associations) this._associations.push(assoc)

		// If the branch is the default flow, set the gateway's default
		if (b._defaultFlowId) {
			const gateway = this.flowElements.find((n) => n.id === this.currentGatewayId)
			if (gateway && (gateway.type === "exclusiveGateway" || gateway.type === "inclusiveGateway")) {
				gateway.default = b._defaultFlowId
			}
		}

		// Track the branch's open end so the next element auto-connects from it.
		// Skip branches that terminated at an end event (those are intentional dead-ends).
		if (!b._connected && b._elements.length > 0) {
			const lastEl = b._elements[b._elements.length - 1]
			if (lastEl && lastEl.type !== "endEvent") {
				this.openBranchEnds.push(b._lastNodeId)
			}
		}

		this.lastNodeId = undefined
		return this
	}

	/** Connect the current position to an existing or future element by ID. */
	connectTo(targetId: string): this {
		if (this.lastNodeId) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: targetId,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.lastNodeId = undefined
		return this
	}

	/**
	 * Position the builder at an existing element, allowing additional
	 * outgoing flows from any point in the graph.
	 *
	 * @throws If no element with the given ID exists.
	 */
	element(elementId: string): this {
		const found = this.flowElements.some((n) => n.id === elementId)
		if (!found) {
			throw new Error(`Element "${elementId}" not found in process "${this.processId}"`)
		}
		this.lastNodeId = elementId
		this.currentGatewayId = undefined
		return this
	}

	// ---- Sub-processes ----

	/** Add an ad-hoc sub-process with optional AI agent or multi-instance configuration. */
	adHocSubProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: AdHocSubProcessOptions,
	): this {
		const sub = new SubProcessContentBuilder(this.rootMessages)
		content(sub)
		insertJoinGateways(sub._elements, sub._flows)
		recomputeIncomingOutgoing(sub._elements, sub._flows)

		const zeebeExt: ZeebeExtensions = {}
		if (options?.taskDefinition) {
			zeebeExt.taskDefinition = options.taskDefinition
		}
		if (options?.ioMapping) {
			zeebeExt.ioMapping = {
				inputs: options.ioMapping.inputs ?? [],
				outputs: options.ioMapping.outputs ?? [],
			}
		}
		if (options?.taskHeaders) {
			zeebeExt.taskHeaders = {
				headers: Object.entries(options.taskHeaders).map(([key, value]) => ({ key, value })),
			}
		}
		const extensionElements = zeebeExtensionsToXmlElements(zeebeExt)

		// zeebe:adHoc element
		const adHocAttrs: Record<string, string> = {}
		if (options?.activeElementsCollection) {
			adHocAttrs.activeElementsCollection = options.activeElementsCollection
		}
		if (options?.outputCollection) {
			adHocAttrs.outputCollection = options.outputCollection
		}
		if (options?.outputElement) {
			adHocAttrs.outputElement = options.outputElement
		}
		if (Object.keys(adHocAttrs).length > 0) {
			extensionElements.push({
				name: "zeebe:adHoc",
				attributes: adHocAttrs,
				children: [],
			})
		}

		const element = makeFlowElement(id, "adHocSubProcess", {
			name: options?.name,
			extensionElements,
		})
		if (options?.modelerTemplate) {
			element.unknownAttributes["zeebe:modelerTemplate"] = options.modelerTemplate
		}
		if (options?.modelerTemplateVersion) {
			element.unknownAttributes["zeebe:modelerTemplateVersion"] = options.modelerTemplateVersion
		}
		if (options?.modelerTemplateIcon) {
			element.unknownAttributes["zeebe:modelerTemplateIcon"] = options.modelerTemplateIcon
		}
		if (element.type === "adHocSubProcess") {
			element.flowElements = sub._elements
			element.sequenceFlows = sub._flows
			element.textAnnotations = sub._textAnnotations
			element.associations = sub._associations
			if (options?.loopCharacteristics) {
				element.loopCharacteristics = buildAdHocLoopCharacteristics(options.loopCharacteristics)
			} else if (options?.multiInstance) {
				element.loopCharacteristics = buildMultiInstance(options.multiInstance)
			}
		}
		this.addFlowElement(element)
		return this
	}

	/** Add a sub-process (aspirational). */
	subProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: SubProcessOptions,
	): this {
		const sub = new SubProcessContentBuilder(this.rootMessages)
		content(sub)
		insertJoinGateways(sub._elements, sub._flows)
		recomputeIncomingOutgoing(sub._elements, sub._flows)

		const element = makeFlowElement(id, "subProcess", options)
		if (element.type === "subProcess") {
			element.flowElements = sub._elements
			element.sequenceFlows = sub._flows
			element.textAnnotations = sub._textAnnotations
			element.associations = sub._associations
			if (options?.multiInstance) {
				element.loopCharacteristics = buildMultiInstance(options.multiInstance)
			}
		}
		this.addFlowElement(element)
		return this
	}

	/** Add an event sub-process. Triggered by its start event — no incoming or outgoing sequence flows. */
	eventSubProcess(
		id: string,
		content: (b: SubProcessContentBuilder) => void,
		options?: ElementOptions,
	): this {
		const sub = new SubProcessContentBuilder(this.rootMessages)
		content(sub)
		insertJoinGateways(sub._elements, sub._flows)
		recomputeIncomingOutgoing(sub._elements, sub._flows)

		const element = makeFlowElement(id, "subProcess", options)
		if (element.type === "subProcess") {
			element.triggeredByEvent = true
			element.flowElements = sub._elements
			element.sequenceFlows = sub._flows
			element.textAnnotations = sub._textAnnotations
			element.associations = sub._associations
		}

		// Event sub-processes have no incoming/outgoing sequence flows and must not
		// advance the flow cursor — the surrounding process wires around them.
		// openBranchEnds is intentionally NOT drained here; the next normal
		// addFlowElement call will drain it and connect branch ends to that element.
		if (this.flowElements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`)
		}
		this._savedMainFlowId = undefined
		this.flowElements.push(element)
		return this
	}

	// ---- Annotations ----

	/** Attach a text annotation to the element at the current cursor position. */
	textAnnotation(text: string): this {
		if (!this.lastNodeId) {
			throw new Error("textAnnotation() must follow a flow element")
		}
		return this.annotate(this.lastNodeId, text)
	}

	/** Attach a text annotation to any flow element by explicit ID. */
	annotate(elementId: string, text: string): this {
		const n = (this._annCounters.get(elementId) ?? 0) + 1
		this._annCounters.set(elementId, n)
		const annId = `TextAnnotation_${elementId}_${n}`
		this._textAnnotations.push({ id: annId, text, unknownAttributes: {} })
		this._associations.push({
			id: `Association_${elementId}_${n}`,
			sourceRef: elementId,
			targetRef: annId,
			associationDirection: "None",
			unknownAttributes: {},
		})
		return this
	}

	// ---- Build ----

	/**
	 * Build the complete BPMN definitions model.
	 *
	 * Resolves all forward-referenced `incoming` / `outgoing` arrays and wraps
	 * the process in a {@link BpmnDefinitions} ready for XML serialization.
	 */
	build(options?: { strict?: boolean }): BpmnDefinitions {
		const beforeCount = this.flowElements.length
		insertJoinGateways(this.flowElements, this.sequenceFlows)

		if (options?.strict && this.flowElements.length > beforeCount) {
			const inserted = this.flowElements
				.slice(beforeCount)
				.map((e) => e.id)
				.join(", ")
			throw new Error(
				`auto-join gateways were inserted: ${inserted}. Use explicit .connectTo(joinId) to make gateway topology explicit, or remove { strict: true }.`,
			)
		}

		this.validate()
		recomputeIncomingOutgoing(this.flowElements, this.sequenceFlows)

		const extensionElements: XmlElement[] = []
		if (this._versionTag) {
			extensionElements.push({
				name: "zeebe:versionTag",
				attributes: { value: this._versionTag },
				children: [],
			})
		}

		const process: BpmnProcess = {
			id: this.processId,
			name: this.processName,
			isExecutable: this._isExecutable,
			extensionElements,
			flowElements: this.flowElements,
			sequenceFlows: this.sequenceFlows,
			textAnnotations: this._textAnnotations,
			associations: this._associations,
			unknownAttributes: {},
		}

		const defs: BpmnDefinitions = {
			id: "Definitions_1",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			exporter: "@bpmnkit/core",
			exporterVersion: EXPORTER_VERSION,
			namespaces: {
				bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
				bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
				dc: "http://www.omg.org/spec/DD/20100524/DC",
				di: "http://www.omg.org/spec/DD/20100524/DI",
				zeebe: "http://camunda.org/schema/zeebe/1.0",
				modeler: "http://camunda.org/schema/modeler/1.0",
				xsi: "http://www.w3.org/2001/XMLSchema-instance",
			},
			unknownAttributes: {
				"modeler:executionPlatform": "Camunda Cloud",
				"modeler:executionPlatformVersion": this._executionPlatformVersion,
			},
			errors: this.rootErrors,
			escalations: this.rootEscalations,
			messages: this.rootMessages,
			signals: this.rootSignals,
			collaborations: [],
			processes: [process],
			// Seed diagram stub so applyAutoLayout preserves process-specific IDs.
			diagrams: this._autoLayout
				? [
						{
							id: `${this.processId}_di`,
							plane: {
								id: `${this.processId}_di_plane`,
								bpmnElement: this.processId,
								shapes: [],
								edges: [],
							},
						},
					]
				: [],
		}

		return this._autoLayout ? applyAutoLayout(defs) : defs
	}

	private validate(): void {
		const elementIds = new Set(this.flowElements.map((el) => el.id))
		for (const flow of this.sequenceFlows) {
			if (!elementIds.has(flow.targetRef)) {
				throw new Error(
					`Sequence flow "${flow.id}" in process "${this.processId}" references unknown ` +
						`element "${flow.targetRef}". Check connectTo() calls — target must exist.`,
				)
			}
			if (!elementIds.has(flow.sourceRef)) {
				throw new Error(
					`Sequence flow "${flow.id}" in process "${this.processId}" references unknown ` +
						`source element "${flow.sourceRef}".`,
				)
			}
		}
	}

	private addFlowElement(element: BpmnFlowElement): void {
		if (this.flowElements.some((n) => n.id === element.id)) {
			throw new Error(`Duplicate element ID "${element.id}" in process "${this.processId}"`)
		}

		this.flowElements.push(element)

		// Compensation handlers are outside the normal token flow: link via association
		// from the preceding compensation boundary event, then restore the main-flow cursor.
		if (element.isForCompensation) {
			if (this.lastNodeId) {
				this._associations.push({
					id: generateId("Association"),
					sourceRef: this.lastNodeId,
					targetRef: element.id,
					associationDirection: "One",
					unknownAttributes: {},
				})
			}
			// Restore main-flow cursor (saved by boundaryEvent() when compensation: true)
			this.lastNodeId = this._savedMainFlowId
			this._savedMainFlowId = undefined
			// Do NOT connect open branch ends — handler is outside normal flow
			return
		}

		if (this.lastNodeId) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: this.lastNodeId,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}

		// Auto-connect any open branch ends (from branch() calls without .connectTo())
		for (const branchEnd of this.openBranchEnds) {
			const flowId = generateId("Flow")
			this.sequenceFlows.push({
				id: flowId,
				sourceRef: branchEnd,
				targetRef: element.id,
				extensionElements: [],
				unknownAttributes: {},
			})
		}
		this.openBranchEnds = []

		// Clear any saved compensation cursor — a normal element advancing the cursor
		// means the compensation boundary/handler pattern has been interrupted.
		this._savedMainFlowId = undefined
		this.lastNodeId = element.id
	}
}

// ---------------------------------------------------------------------------
// Diagram builder — multi-process support
// ---------------------------------------------------------------------------

/**
 * Builder for a complete BPMN definitions document containing one or more processes.
 * Use `Bpmn.createDiagram(id?)` to obtain an instance.
 */
export class DiagramBuilder {
	private readonly _id: string
	private readonly _processes: BpmnProcess[] = []
	private readonly _errors: BpmnError[] = []
	private readonly _messages: BpmnMessage[] = []
	private _executionPlatformVersion = "8.9.0"

	constructor(id: string) {
		this._id = id
	}

	/** Set the Camunda execution platform version stamped into the BPMN definitions. Defaults to `"8.9.0"`. */
	executionPlatformVersion(version: string): this {
		this._executionPlatformVersion = version
		return this
	}

	process(id: string, callback: (b: ProcessBuilder) => void): this {
		const builder = new ProcessBuilder(id)
		callback(builder)
		const defs = builder.build()
		this._processes.push(...defs.processes)
		this._errors.push(...defs.errors)
		this._messages.push(...defs.messages)
		return this
	}

	build(): BpmnDefinitions {
		return {
			id: this._id,
			targetNamespace: "http://bpmn.io/schema/bpmn",
			exporter: "@bpmnkit/core",
			exporterVersion: EXPORTER_VERSION,
			namespaces: {
				bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
				bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
				dc: "http://www.omg.org/spec/DD/20100524/DC",
				di: "http://www.omg.org/spec/DD/20100524/DI",
				zeebe: "http://camunda.org/schema/zeebe/1.0",
				modeler: "http://camunda.org/schema/modeler/1.0",
				xsi: "http://www.w3.org/2001/XMLSchema-instance",
			},
			unknownAttributes: {
				"modeler:executionPlatform": "Camunda Cloud",
				"modeler:executionPlatformVersion": this._executionPlatformVersion,
			},
			errors: this._errors,
			escalations: [],
			messages: this._messages,
			signals: [],
			collaborations: [],
			processes: this._processes,
			diagrams: [],
		}
	}
}
