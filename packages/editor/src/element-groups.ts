import type { CreateShapeType, LabelPosition } from "./types.js"

export interface ElementGroup {
	id: string
	title: string
	defaultType: CreateShapeType
	types: ReadonlyArray<CreateShapeType>
}

export const ELEMENT_GROUPS: ReadonlyArray<ElementGroup> = [
	{
		id: "startEvents",
		title: "Start Events",
		defaultType: "startEvent",
		types: [
			"startEvent",
			"messageStartEvent",
			"timerStartEvent",
			"conditionalStartEvent",
			"signalStartEvent",
		],
	},
	{
		id: "endEvents",
		title: "End Events",
		defaultType: "endEvent",
		types: [
			"endEvent",
			"messageEndEvent",
			"escalationEndEvent",
			"errorEndEvent",
			"compensationEndEvent",
			"signalEndEvent",
			"terminateEndEvent",
		],
	},
	{
		id: "intermediateEvents",
		title: "Intermediate Events",
		defaultType: "messageCatchEvent",
		types: [
			"messageCatchEvent",
			"messageThrowEvent",
			"timerCatchEvent",
			"escalationThrowEvent",
			"conditionalCatchEvent",
			"linkCatchEvent",
			"linkThrowEvent",
			"compensationThrowEvent",
			"signalCatchEvent",
			"signalThrowEvent",
		],
	},
	{
		id: "activities",
		title: "Activities",
		defaultType: "serviceTask",
		types: [
			"task",
			"serviceTask",
			"userTask",
			"scriptTask",
			"sendTask",
			"receiveTask",
			"businessRuleTask",
			"manualTask",
			"callActivity",
			"subProcess",
			"adHocSubProcess",
			"transaction",
		],
	},
	{
		id: "gateways",
		title: "Gateways",
		defaultType: "exclusiveGateway",
		types: [
			"exclusiveGateway",
			"parallelGateway",
			"inclusiveGateway",
			"eventBasedGateway",
			"complexGateway",
		],
	},
	{
		id: "annotations",
		title: "Annotations",
		defaultType: "textAnnotation",
		types: ["textAnnotation"],
	},
]

const _typeToGroup = new Map<CreateShapeType, ElementGroup>()
for (const group of ELEMENT_GROUPS) {
	for (const type of group.types) {
		_typeToGroup.set(type, group)
	}
}

export function getElementGroup(type: CreateShapeType): ElementGroup | undefined {
	return _typeToGroup.get(type)
}

export const ELEMENT_TYPE_LABELS: Readonly<Record<CreateShapeType, string>> = {
	startEvent: "Start Event",
	messageStartEvent: "Message Start Event",
	timerStartEvent: "Timer Start Event",
	conditionalStartEvent: "Conditional Start Event",
	signalStartEvent: "Signal Start Event",
	endEvent: "End Event",
	messageEndEvent: "Message End Event",
	escalationEndEvent: "Escalation End Event",
	errorEndEvent: "Error End Event",
	compensationEndEvent: "Compensation End Event",
	signalEndEvent: "Signal End Event",
	terminateEndEvent: "Terminate End Event",
	intermediateThrowEvent: "Intermediate Throw Event",
	intermediateCatchEvent: "Intermediate Catch Event",
	messageCatchEvent: "Message Intermediate Catch Event",
	messageThrowEvent: "Message Intermediate Throw Event",
	timerCatchEvent: "Timer Intermediate Catch Event",
	escalationThrowEvent: "Escalation Intermediate Throw Event",
	conditionalCatchEvent: "Conditional Intermediate Catch Event",
	linkCatchEvent: "Link Intermediate Catch Event",
	linkThrowEvent: "Link Intermediate Throw Event",
	compensationThrowEvent: "Compensation Intermediate Throw Event",
	signalCatchEvent: "Signal Intermediate Catch Event",
	signalThrowEvent: "Signal Intermediate Throw Event",
	task: "Task",
	serviceTask: "Service Task",
	userTask: "User Task",
	scriptTask: "Script Task",
	sendTask: "Send Task",
	receiveTask: "Receive Task",
	businessRuleTask: "Business Rule Task",
	manualTask: "Manual Task",
	callActivity: "Call Activity",
	subProcess: "Sub-Process",
	adHocSubProcess: "Ad-hoc Sub-Process",
	transaction: "Transaction",
	exclusiveGateway: "Exclusive Gateway",
	parallelGateway: "Parallel Gateway",
	inclusiveGateway: "Inclusive Gateway",
	eventBasedGateway: "Event-based Gateway",
	complexGateway: "Complex Gateway",
	textAnnotation: "Text Annotation",
}

export const EXTERNAL_LABEL_TYPES: ReadonlySet<CreateShapeType> = new Set([
	"startEvent",
	"messageStartEvent",
	"timerStartEvent",
	"conditionalStartEvent",
	"signalStartEvent",
	"endEvent",
	"messageEndEvent",
	"escalationEndEvent",
	"errorEndEvent",
	"compensationEndEvent",
	"signalEndEvent",
	"terminateEndEvent",
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"messageCatchEvent",
	"messageThrowEvent",
	"timerCatchEvent",
	"escalationThrowEvent",
	"conditionalCatchEvent",
	"linkCatchEvent",
	"linkThrowEvent",
	"compensationThrowEvent",
	"signalCatchEvent",
	"signalThrowEvent",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

export const CONTEXTUAL_ADD_TYPES: ReadonlyArray<CreateShapeType> = [
	"serviceTask",
	"exclusiveGateway",
	"endEvent",
]

export function getValidLabelPositions(type: CreateShapeType): ReadonlyArray<LabelPosition> {
	const base: LabelPosition[] = ["bottom", "top", "left", "right"]
	if (
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway" ||
		type === "complexGateway" ||
		type === "intermediateThrowEvent" ||
		type === "intermediateCatchEvent" ||
		type === "messageCatchEvent" ||
		type === "messageThrowEvent" ||
		type === "timerCatchEvent" ||
		type === "escalationThrowEvent" ||
		type === "conditionalCatchEvent" ||
		type === "linkCatchEvent" ||
		type === "linkThrowEvent" ||
		type === "compensationThrowEvent" ||
		type === "signalCatchEvent" ||
		type === "signalThrowEvent"
	) {
		return [...base, "bottom-left", "bottom-right", "top-left", "top-right"]
	}
	return base
}
