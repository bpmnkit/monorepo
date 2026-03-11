import type { XmlElement } from "../types/xml-element.js"

// ---------------------------------------------------------------------------
// Element type union (used by layout for sizing)
// ---------------------------------------------------------------------------

/**
 * Discriminant string literal union for every BPMN flow node type.
 * Every {@link BpmnFlowElement} carries a `type` field of this union, enabling
 * exhaustive `switch` statements and type-narrowing with the type guard helpers
 * exported from `@bpmn-sdk/core`.
 */
export type BpmnElementType =
	| "startEvent"
	| "endEvent"
	| "intermediateThrowEvent"
	| "intermediateCatchEvent"
	| "boundaryEvent"
	| "task"
	| "serviceTask"
	| "scriptTask"
	| "userTask"
	| "sendTask"
	| "receiveTask"
	| "businessRuleTask"
	| "manualTask"
	| "callActivity"
	| "exclusiveGateway"
	| "parallelGateway"
	| "inclusiveGateway"
	| "eventBasedGateway"
	| "complexGateway"
	| "subProcess"
	| "adHocSubProcess"
	| "eventSubProcess"
	| "transaction"

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** Axis-aligned bounding box used by BPMN diagram interchange (BPMNDi). */
export interface BpmnBounds {
	x: number
	y: number
	width: number
	height: number
}

/** A single point along a sequence flow edge route (BPMNDi waypoint). */
export interface BpmnWaypoint {
	x: number
	y: number
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

/** Event definition for timer-based events. Use `timeDuration`, `timeDate`, or `timeCycle`. */
export interface BpmnTimerEventDefinition {
	type: "timer"
	id?: string
	timeDuration?: string
	timeDurationAttributes?: Record<string, string>
	timeDate?: string
	timeDateAttributes?: Record<string, string>
	timeCycle?: string
	timeCycleAttributes?: Record<string, string>
}

/** Event definition for error boundary / end events. */
export interface BpmnErrorEventDefinition {
	type: "error"
	id?: string
	errorRef?: string
}

/** Event definition for escalation events. */
export interface BpmnEscalationEventDefinition {
	type: "escalation"
	id?: string
	escalationRef?: string
}

/** Event definition for message events (receive / send). */
export interface BpmnMessageEventDefinition {
	type: "message"
	id?: string
	messageRef?: string
}

/** Event definition for signal catch / throw events. */
export interface BpmnSignalEventDefinition {
	type: "signal"
	id?: string
	signalRef?: string
}

/** Event definition for conditional catch events. */
export interface BpmnConditionalEventDefinition {
	type: "conditional"
	id?: string
	condition?: string
}

/** Event definition for link catch / throw events. */
export interface BpmnLinkEventDefinition {
	type: "link"
	id?: string
	name?: string
}

/** Event definition for cancel boundary events (transaction scope). */
export interface BpmnCancelEventDefinition {
	type: "cancel"
	id?: string
}

/** Event definition for terminate end events. */
export interface BpmnTerminateEventDefinition {
	type: "terminate"
	id?: string
}

/** Event definition for compensation boundary / throw events. */
export interface BpmnCompensateEventDefinition {
	type: "compensate"
	id?: string
	activityRef?: string
}

/**
 * Discriminated union of all BPMN event definition types.
 * Narrowed via the `type` field (e.g. `"timer"`, `"error"`, `"message"`).
 */
export type BpmnEventDefinition =
	| BpmnTimerEventDefinition
	| BpmnErrorEventDefinition
	| BpmnEscalationEventDefinition
	| BpmnMessageEventDefinition
	| BpmnSignalEventDefinition
	| BpmnConditionalEventDefinition
	| BpmnLinkEventDefinition
	| BpmnCancelEventDefinition
	| BpmnTerminateEventDefinition
	| BpmnCompensateEventDefinition

// ---------------------------------------------------------------------------
// Multi-instance loop
// ---------------------------------------------------------------------------

/** Multi-instance loop configuration attached to a task or sub-process. */
export interface BpmnMultiInstanceLoopCharacteristics {
	extensionElements: XmlElement[]
}

// ---------------------------------------------------------------------------
// Condition expression
// ---------------------------------------------------------------------------

/** A FEEL condition expression on a sequence flow outgoing from a gateway. */
export interface BpmnConditionExpression {
	text: string
	attributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Flow node base
// ---------------------------------------------------------------------------

interface BpmnFlowNodeBase {
	id: string
	name?: string
	incoming: string[]
	outgoing: string[]
	documentation?: string
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface BpmnStartEvent extends BpmnFlowNodeBase {
	type: "startEvent"
	eventDefinitions: BpmnEventDefinition[]
}

export interface BpmnEndEvent extends BpmnFlowNodeBase {
	type: "endEvent"
	eventDefinitions: BpmnEventDefinition[]
}

export interface BpmnIntermediateCatchEvent extends BpmnFlowNodeBase {
	type: "intermediateCatchEvent"
	eventDefinitions: BpmnEventDefinition[]
}

export interface BpmnIntermediateThrowEvent extends BpmnFlowNodeBase {
	type: "intermediateThrowEvent"
	eventDefinitions: BpmnEventDefinition[]
}

export interface BpmnBoundaryEvent extends BpmnFlowNodeBase {
	type: "boundaryEvent"
	attachedToRef: string
	cancelActivity?: boolean
	eventDefinitions: BpmnEventDefinition[]
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export interface BpmnServiceTask extends BpmnFlowNodeBase {
	type: "serviceTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnScriptTask extends BpmnFlowNodeBase {
	type: "scriptTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnUserTask extends BpmnFlowNodeBase {
	type: "userTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnBusinessRuleTask extends BpmnFlowNodeBase {
	type: "businessRuleTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnCallActivity extends BpmnFlowNodeBase {
	type: "callActivity"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnSendTask extends BpmnFlowNodeBase {
	type: "sendTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnReceiveTask extends BpmnFlowNodeBase {
	type: "receiveTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnAdHocSubProcess extends BpmnFlowNodeBase {
	type: "adHocSubProcess"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
}

export interface BpmnSubProcess extends BpmnFlowNodeBase {
	type: "subProcess"
	triggeredByEvent?: boolean
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
}

export interface BpmnEventSubProcess extends BpmnFlowNodeBase {
	type: "eventSubProcess"
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

export interface BpmnExclusiveGateway extends BpmnFlowNodeBase {
	type: "exclusiveGateway"
	default?: string
}

export interface BpmnParallelGateway extends BpmnFlowNodeBase {
	type: "parallelGateway"
}

export interface BpmnInclusiveGateway extends BpmnFlowNodeBase {
	type: "inclusiveGateway"
	default?: string
}

export interface BpmnEventBasedGateway extends BpmnFlowNodeBase {
	type: "eventBasedGateway"
}

export interface BpmnComplexGateway extends BpmnFlowNodeBase {
	type: "complexGateway"
	default?: string
}

// ---------------------------------------------------------------------------
// Additional activities
// ---------------------------------------------------------------------------

export interface BpmnTask extends BpmnFlowNodeBase {
	type: "task"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnManualTask extends BpmnFlowNodeBase {
	type: "manualTask"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
}

export interface BpmnTransaction extends BpmnFlowNodeBase {
	type: "transaction"
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
}

// ---------------------------------------------------------------------------
// Flow element union
// ---------------------------------------------------------------------------

/**
 * Discriminated union of every BPMN flow node that can appear inside a
 * {@link BpmnProcess}. Narrow with the `type` field or with the type guard
 * helpers exported from `@bpmn-sdk/core` (e.g. `isBpmnServiceTask`).
 *
 * @example
 * ```typescript
 * import { isBpmnServiceTask, isBpmnGateway } from "@bpmn-sdk/core"
 *
 * for (const el of process.flowElements) {
 *   if (isBpmnServiceTask(el)) console.log("job type:", el.extensionElements)
 *   if (isBpmnGateway(el))    console.log("gateway:", el.type)
 * }
 * ```
 */
export type BpmnFlowElement =
	| BpmnStartEvent
	| BpmnEndEvent
	| BpmnIntermediateCatchEvent
	| BpmnIntermediateThrowEvent
	| BpmnBoundaryEvent
	| BpmnTask
	| BpmnServiceTask
	| BpmnScriptTask
	| BpmnUserTask
	| BpmnSendTask
	| BpmnReceiveTask
	| BpmnBusinessRuleTask
	| BpmnManualTask
	| BpmnCallActivity
	| BpmnSubProcess
	| BpmnAdHocSubProcess
	| BpmnEventSubProcess
	| BpmnTransaction
	| BpmnExclusiveGateway
	| BpmnParallelGateway
	| BpmnInclusiveGateway
	| BpmnEventBasedGateway
	| BpmnComplexGateway

/** Backward-compat alias used by the layout module. */
export type BpmnFlowNode = BpmnFlowElement

// ---------------------------------------------------------------------------
// Sequence flows
// ---------------------------------------------------------------------------

/**
 * A directed connection between two flow nodes.
 * Condition expressions on outgoing gateway flows are stored in
 * `conditionExpression`.
 */
export interface BpmnSequenceFlow {
	id: string
	name?: string
	sourceRef: string
	targetRef: string
	conditionExpression?: BpmnConditionExpression
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

/** A free-text annotation element attached to the diagram via an association. */
export interface BpmnTextAnnotation {
	id: string
	text?: string
	unknownAttributes: Record<string, string>
}

/** A directed or undirected link between a flow element and a text annotation. */
export interface BpmnAssociation {
	id: string
	sourceRef: string
	targetRef: string
	associationDirection?: string
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

/** A swim lane within a pool (organises flow nodes visually). */
export interface BpmnLane {
	id: string
	name?: string
	flowNodeRefs: string[]
	childLaneSet?: BpmnLaneSet
	unknownAttributes: Record<string, string>
}

/** Container for lanes within a pool or sub-process. */
export interface BpmnLaneSet {
	id?: string
	lanes: BpmnLane[]
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

/**
 * A BPMN process definition containing flow elements and sequence flows.
 *
 * - `flowElements` — all non-edge flow nodes (tasks, events, gateways,
 *   sub-processes). Use the type-guard helpers to narrow.
 * - `sequenceFlows` — directed connections between flow nodes.
 * - `textAnnotations` / `associations` — documentation annotations.
 */
export interface BpmnProcess {
	id: string
	name?: string
	isExecutable?: boolean
	extensionElements: XmlElement[]
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
	laneSet?: BpmnLaneSet
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

/** A participant (pool) in a BPMN collaboration diagram. */
export interface BpmnParticipant {
	id: string
	name?: string
	processRef?: string
	unknownAttributes: Record<string, string>
}

/** A message flow between participants in a collaboration. */
export interface BpmnMessageFlow {
	id: string
	name?: string
	sourceRef: string
	targetRef: string
	unknownAttributes: Record<string, string>
}

/** A BPMN collaboration element grouping multiple participants and their message flows. */
export interface BpmnCollaboration {
	id: string
	participants: BpmnParticipant[]
	messageFlows: BpmnMessageFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Root elements
// ---------------------------------------------------------------------------

/** A root-level BPMN error definition referenced by error boundary events. */
export interface BpmnError {
	id: string
	name?: string
	errorCode?: string
}

/** A root-level BPMN escalation definition referenced by escalation events. */
export interface BpmnEscalation {
	id: string
	name?: string
	escalationCode?: string
}

/** A root-level BPMN message definition referenced by message events. */
export interface BpmnMessage {
	id: string
	name?: string
	unknownAttributes: Record<string, string>
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

/** Optional label positioning information for a BPMNDi shape or edge. */
export interface BpmnDiLabel {
	bounds?: BpmnBounds
}

/** BPMNDi layout shape — binds a flow element to its visual bounds on the canvas. */
export interface BpmnDiShape {
	id: string
	bpmnElement: string
	isMarkerVisible?: boolean
	isExpanded?: boolean
	isHorizontal?: boolean
	bounds: BpmnBounds
	label?: BpmnDiLabel
	unknownAttributes: Record<string, string>
}

/** BPMNDi layout edge — binds a sequence flow to its routed waypoints on the canvas. */
export interface BpmnDiEdge {
	id: string
	bpmnElement: string
	waypoints: BpmnWaypoint[]
	label?: BpmnDiLabel
	unknownAttributes: Record<string, string>
}

/** The drawing plane for a BPMNDiagram — holds all shapes and edges. */
export interface BpmnDiPlane {
	id: string
	bpmnElement: string
	shapes: BpmnDiShape[]
	edges: BpmnDiEdge[]
}

/** A BPMNDiagram element grouping the visual layout for one process. */
export interface BpmnDiagram {
	id: string
	plane: BpmnDiPlane
}

// ---------------------------------------------------------------------------
// Root: definitions
// ---------------------------------------------------------------------------

/**
 * The root object of a parsed BPMN document — equivalent to `<bpmn:definitions>`.
 *
 * Obtain one via {@link Bpmn.parse} or {@link Bpmn.createProcess} + `.build()`.
 * Serialise back to XML with {@link Bpmn.export}.
 *
 * @example
 * ```typescript
 * import { Bpmn } from "@bpmn-sdk/core"
 *
 * const defs: BpmnDefinitions = Bpmn.parse(xml)
 * console.log(defs.processes[0].id)
 * ```
 */
export interface BpmnDefinitions {
	id: string
	targetNamespace: string
	exporter?: string
	exporterVersion?: string
	/** Namespace prefix → URI declarations (e.g. "bpmn" → "http://...") */
	namespaces: Record<string, string>
	/** Namespace-qualified attributes not directly modeled */
	unknownAttributes: Record<string, string>
	errors: BpmnError[]
	escalations: BpmnEscalation[]
	messages: BpmnMessage[]
	collaborations: BpmnCollaboration[]
	processes: BpmnProcess[]
	diagrams: BpmnDiagram[]
}
