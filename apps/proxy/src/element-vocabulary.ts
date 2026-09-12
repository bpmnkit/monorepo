/**
 * The element-type vocabulary every tool schema and prompt renders from.
 *
 * Each surface used to write its own list by hand, which is how the MCP tool
 * schema came to advertise 18 types while the compact path accepted 23 — five
 * constructs (`receiveTask`, `task`, `complexGateway`, `transaction`,
 * `eventSubProcess`) that worked but no caller could discover.
 *
 * `ELEMENT_TYPE_GROUPS` in @bpmnkit/core is a total `Record` over
 * `BpmnElementType`, so a new element type reaches these descriptions without
 * anyone remembering to add it.
 */
import { type ElementTypeGroup, elementTypesInGroup } from "@bpmnkit/core"

const GROUP_LABELS: Record<ElementTypeGroup, string> = {
	event: "Events",
	task: "Tasks",
	gateway: "Gateways",
	container: "Containers",
	data: "Data",
}

/** Prose listing every element type by group, for a tool schema description. */
export function elementTypeDescription(): string {
	const groups = (Object.keys(GROUP_LABELS) as ElementTypeGroup[])
		.map((group) => `${GROUP_LABELS[group]}: ${elementTypesInGroup(group).join(" | ")}.`)
		.join(" ")
	return `BPMN element type. ${groups}`
}
