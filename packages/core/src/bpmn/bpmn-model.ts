import type { XmlElement } from "../types/xml-element.js";

// ---------------------------------------------------------------------------
// Element type union (used by layout for sizing)
// ---------------------------------------------------------------------------

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
	| "transaction";

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export interface BpmnBounds {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface BpmnWaypoint {
	x: number;
	y: number;
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

export interface BpmnTimerEventDefinition {
	type: "timer";
	id?: string;
	timeDuration?: string;
	timeDurationAttributes?: Record<string, string>;
	timeDate?: string;
	timeDateAttributes?: Record<string, string>;
	timeCycle?: string;
	timeCycleAttributes?: Record<string, string>;
}

export interface BpmnErrorEventDefinition {
	type: "error";
	id?: string;
	errorRef?: string;
}

export interface BpmnEscalationEventDefinition {
	type: "escalation";
	id?: string;
	escalationRef?: string;
}

export interface BpmnMessageEventDefinition {
	type: "message";
	id?: string;
	messageRef?: string;
}

export interface BpmnSignalEventDefinition {
	type: "signal";
	id?: string;
	signalRef?: string;
}

export interface BpmnConditionalEventDefinition {
	type: "conditional";
	id?: string;
	condition?: string;
}

export interface BpmnLinkEventDefinition {
	type: "link";
	id?: string;
	name?: string;
}

export interface BpmnCancelEventDefinition {
	type: "cancel";
	id?: string;
}

export interface BpmnTerminateEventDefinition {
	type: "terminate";
	id?: string;
}

export interface BpmnCompensateEventDefinition {
	type: "compensate";
	id?: string;
	activityRef?: string;
}

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
	| BpmnCompensateEventDefinition;

// ---------------------------------------------------------------------------
// Multi-instance loop
// ---------------------------------------------------------------------------

export interface BpmnMultiInstanceLoopCharacteristics {
	extensionElements: XmlElement[];
}

// ---------------------------------------------------------------------------
// Condition expression
// ---------------------------------------------------------------------------

export interface BpmnConditionExpression {
	text: string;
	attributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Flow node base
// ---------------------------------------------------------------------------

interface BpmnFlowNodeBase {
	id: string;
	name?: string;
	incoming: string[];
	outgoing: string[];
	documentation?: string;
	extensionElements: XmlElement[];
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface BpmnStartEvent extends BpmnFlowNodeBase {
	type: "startEvent";
	eventDefinitions: BpmnEventDefinition[];
}

export interface BpmnEndEvent extends BpmnFlowNodeBase {
	type: "endEvent";
	eventDefinitions: BpmnEventDefinition[];
}

export interface BpmnIntermediateCatchEvent extends BpmnFlowNodeBase {
	type: "intermediateCatchEvent";
	eventDefinitions: BpmnEventDefinition[];
}

export interface BpmnIntermediateThrowEvent extends BpmnFlowNodeBase {
	type: "intermediateThrowEvent";
	eventDefinitions: BpmnEventDefinition[];
}

export interface BpmnBoundaryEvent extends BpmnFlowNodeBase {
	type: "boundaryEvent";
	attachedToRef: string;
	cancelActivity?: boolean;
	eventDefinitions: BpmnEventDefinition[];
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

export interface BpmnServiceTask extends BpmnFlowNodeBase {
	type: "serviceTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnScriptTask extends BpmnFlowNodeBase {
	type: "scriptTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnUserTask extends BpmnFlowNodeBase {
	type: "userTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnBusinessRuleTask extends BpmnFlowNodeBase {
	type: "businessRuleTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnCallActivity extends BpmnFlowNodeBase {
	type: "callActivity";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnSendTask extends BpmnFlowNodeBase {
	type: "sendTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnReceiveTask extends BpmnFlowNodeBase {
	type: "receiveTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnAdHocSubProcess extends BpmnFlowNodeBase {
	type: "adHocSubProcess";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
}

export interface BpmnSubProcess extends BpmnFlowNodeBase {
	type: "subProcess";
	triggeredByEvent?: boolean;
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
}

export interface BpmnEventSubProcess extends BpmnFlowNodeBase {
	type: "eventSubProcess";
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
}

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

export interface BpmnExclusiveGateway extends BpmnFlowNodeBase {
	type: "exclusiveGateway";
	default?: string;
}

export interface BpmnParallelGateway extends BpmnFlowNodeBase {
	type: "parallelGateway";
}

export interface BpmnInclusiveGateway extends BpmnFlowNodeBase {
	type: "inclusiveGateway";
	default?: string;
}

export interface BpmnEventBasedGateway extends BpmnFlowNodeBase {
	type: "eventBasedGateway";
}

export interface BpmnComplexGateway extends BpmnFlowNodeBase {
	type: "complexGateway";
	default?: string;
}

// ---------------------------------------------------------------------------
// Additional activities
// ---------------------------------------------------------------------------

export interface BpmnTask extends BpmnFlowNodeBase {
	type: "task";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnManualTask extends BpmnFlowNodeBase {
	type: "manualTask";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
}

export interface BpmnTransaction extends BpmnFlowNodeBase {
	type: "transaction";
	loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics;
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
}

// ---------------------------------------------------------------------------
// Flow element union
// ---------------------------------------------------------------------------

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
	| BpmnComplexGateway;

/** Backward-compat alias used by the layout module. */
export type BpmnFlowNode = BpmnFlowElement;

// ---------------------------------------------------------------------------
// Sequence flows
// ---------------------------------------------------------------------------

export interface BpmnSequenceFlow {
	id: string;
	name?: string;
	sourceRef: string;
	targetRef: string;
	conditionExpression?: BpmnConditionExpression;
	extensionElements: XmlElement[];
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

export interface BpmnTextAnnotation {
	id: string;
	text?: string;
	unknownAttributes: Record<string, string>;
}

export interface BpmnAssociation {
	id: string;
	sourceRef: string;
	targetRef: string;
	associationDirection?: string;
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

export interface BpmnLane {
	id: string;
	name?: string;
	flowNodeRefs: string[];
	childLaneSet?: BpmnLaneSet;
	unknownAttributes: Record<string, string>;
}

export interface BpmnLaneSet {
	id?: string;
	lanes: BpmnLane[];
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

export interface BpmnProcess {
	id: string;
	name?: string;
	isExecutable?: boolean;
	extensionElements: XmlElement[];
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
	laneSet?: BpmnLaneSet;
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

export interface BpmnParticipant {
	id: string;
	name?: string;
	processRef?: string;
	unknownAttributes: Record<string, string>;
}

export interface BpmnMessageFlow {
	id: string;
	name?: string;
	sourceRef: string;
	targetRef: string;
	unknownAttributes: Record<string, string>;
}

export interface BpmnCollaboration {
	id: string;
	participants: BpmnParticipant[];
	messageFlows: BpmnMessageFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
	extensionElements: XmlElement[];
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Root elements
// ---------------------------------------------------------------------------

export interface BpmnError {
	id: string;
	name?: string;
	errorCode?: string;
}

export interface BpmnEscalation {
	id: string;
	name?: string;
	escalationCode?: string;
}

export interface BpmnMessage {
	id: string;
	name?: string;
	unknownAttributes: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

export interface BpmnDiLabel {
	bounds?: BpmnBounds;
}

export interface BpmnDiShape {
	id: string;
	bpmnElement: string;
	isMarkerVisible?: boolean;
	isExpanded?: boolean;
	bounds: BpmnBounds;
	label?: BpmnDiLabel;
	unknownAttributes: Record<string, string>;
}

export interface BpmnDiEdge {
	id: string;
	bpmnElement: string;
	waypoints: BpmnWaypoint[];
	label?: BpmnDiLabel;
	unknownAttributes: Record<string, string>;
}

export interface BpmnDiPlane {
	id: string;
	bpmnElement: string;
	shapes: BpmnDiShape[];
	edges: BpmnDiEdge[];
}

export interface BpmnDiagram {
	id: string;
	plane: BpmnDiPlane;
}

// ---------------------------------------------------------------------------
// Root: definitions
// ---------------------------------------------------------------------------

export interface BpmnDefinitions {
	id: string;
	targetNamespace: string;
	exporter?: string;
	exporterVersion?: string;
	/** Namespace prefix → URI declarations (e.g. "bpmn" → "http://...") */
	namespaces: Record<string, string>;
	/** Namespace-qualified attributes not directly modeled */
	unknownAttributes: Record<string, string>;
	errors: BpmnError[];
	escalations: BpmnEscalation[];
	messages: BpmnMessage[];
	collaborations: BpmnCollaboration[];
	processes: BpmnProcess[];
	diagrams: BpmnDiagram[];
}
