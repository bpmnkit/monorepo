/**
 * Every BPMN element type, grouped.
 *
 * Tool schemas, CLI help and prompts all want to say "here are the element
 * types you can use", and each one used to say it as a hand-written string.
 * Those strings drift: the MCP tool schema advertised 18 types while the
 * compact path accepted 23, so five constructs — `receiveTask`, `task`,
 * `complexGateway`, `transaction`, `eventSubProcess` — worked but no caller
 * could discover them.
 *
 * This is the one list. Like `BUILDER_COVERAGE`, it is a total `Record` keyed
 * by `BpmnElementType`, so **adding a member to that union fails `tsc` here
 * until the new type is placed in a group** — and every generated description
 * picks it up automatically.
 */
import type { BpmnElementType } from "./bpmn-model.js"

/** The coarse families a modeller picks from. */
export type ElementTypeGroup = "event" | "task" | "gateway" | "container" | "data"

/** Group labels, in the order a description should list them. */
export const ELEMENT_GROUP_ORDER: readonly ElementTypeGroup[] = [
	"event",
	"task",
	"gateway",
	"container",
	"data",
] as const

/**
 * Every `BpmnElementType`, mapped to its group.
 *
 * Adding a type to the union without placing it here is a compile error.
 */
export const ELEMENT_TYPE_GROUPS: Record<BpmnElementType, ElementTypeGroup> = {
	startEvent: "event",
	endEvent: "event",
	intermediateThrowEvent: "event",
	intermediateCatchEvent: "event",
	boundaryEvent: "event",

	task: "task",
	serviceTask: "task",
	scriptTask: "task",
	userTask: "task",
	sendTask: "task",
	receiveTask: "task",
	businessRuleTask: "task",
	manualTask: "task",
	callActivity: "task",

	exclusiveGateway: "gateway",
	parallelGateway: "gateway",
	inclusiveGateway: "gateway",
	eventBasedGateway: "gateway",
	complexGateway: "gateway",

	subProcess: "container",
	adHocSubProcess: "container",
	eventSubProcess: "container",
	transaction: "container",

	dataObject: "data",
	dataObjectReference: "data",
	dataStoreReference: "data",
}

/** Every element type in the given group, in declaration order. */
export function elementTypesInGroup(group: ElementTypeGroup): BpmnElementType[] {
	return (Object.keys(ELEMENT_TYPE_GROUPS) as BpmnElementType[]).filter(
		(type) => ELEMENT_TYPE_GROUPS[type] === group,
	)
}

/** Every element type the SDK models, in declaration order. */
export function allElementTypes(): BpmnElementType[] {
	return Object.keys(ELEMENT_TYPE_GROUPS) as BpmnElementType[]
}
