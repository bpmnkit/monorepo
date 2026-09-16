/**
 * Rendering an embedded BPMN diagram as text an agent can read.
 *
 * Camunda's best-practice pages carry their argument in the diagram: a page about naming
 * gateways shows the gateway, its question and the labels on its outgoing flows. Camunda's
 * own Markdown export drops those embeds, so the prose is left referring to elements that
 * are not in the text at all.
 *
 * `@bpmnkit/ascii` already draws BPMN as box art, but it truncates element labels to the
 * box width (`Reject payment of in…`) and omits condition expressions — exactly the two
 * things these pages are about — and costs ~420 tokens for a seven-element diagram. So this
 * walks the parsed model instead and writes the flow as a sentence, which keeps every name
 * whole at roughly a sixth of the size.
 */

import { Bpmn } from "@bpmnkit/core"
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "@bpmnkit/core"

/** Element types whose kind is worth naming in the text; everything else reads as its name. */
const KIND: Record<string, string> = {
	startEvent: "start",
	endEvent: "end",
	intermediateCatchEvent: "intermediate catch event",
	intermediateThrowEvent: "intermediate throw event",
	boundaryEvent: "boundary event",
	exclusiveGateway: "exclusive gateway",
	parallelGateway: "parallel gateway",
	inclusiveGateway: "inclusive gateway",
	eventBasedGateway: "event-based gateway",
	complexGateway: "complex gateway",
	subProcess: "subprocess",
	callActivity: "call activity",
	serviceTask: "service task",
	userTask: "user task",
	scriptTask: "script task",
	businessRuleTask: "business rule task",
	sendTask: "send task",
	receiveTask: "receive task",
	manualTask: "manual task",
}

/**
 * Convert BPMN XML to a compact flow description.
 *
 * Returns an empty string for a diagram with no flow nodes, so a caller can drop the embed
 * rather than emit an empty heading.
 */
export function bpmnToText(xml: string): string {
	const definitions = Bpmn.parse(withSyntheticIds(xml))
	const blocks: string[] = []

	for (const process of definitions.processes) {
		const lines = describeProcess(process)
		if (lines.length === 0) continue
		const title = process.name ? `Diagram (BPMN): ${process.name}` : "Diagram (BPMN):"
		blocks.push([title, ...lines].join("\n"))
	}

	return blocks.join("\n\n")
}

/** Elements `Bpmn.parse` demands an `id` on, though the BPMN 2.0 schema marks it optional. */
const ID_OPTIONAL = /<((?:[\w.-]+:)?(?:definitions|BPMNDiagram|BPMNPlane))(\s[^>]*?)?(\/?)>/g

/**
 * Supply the ids `Bpmn.parse` insists on.
 *
 * It rejects `<definitions>`, `<bpmndi:BPMNDiagram>` and `<bpmndi:BPMNPlane>` without an `id`,
 * but `tDefinitions` and the DI types all mark that attribute optional, and 10 of the 141
 * diagrams in camunda-docs omit it. Without this, a tenth of the diagrams would go
 * undescribed — the exact failure this module exists to prevent.
 *
 * This is a workaround for the parser's strictness, not a property of these documents. If
 * `@bpmnkit/core` is relaxed to match the schema, delete this and its call site.
 */
function withSyntheticIds(xml: string): string {
	let counter = 0
	return xml.replace(ID_OPTIONAL, (tag, name, attributes, close) => {
		const declared: string = attributes ?? ""
		if (/\sid\s*=/.test(declared)) return tag
		counter += 1
		return `<${name}${declared} id="docspack_${counter}"${close}>`
	})
}

function describeProcess(process: BpmnProcess): string[] {
	const byId = new Map<string, BpmnFlowElement>(
		process.flowElements.map((element) => [element.id, element]),
	)
	const outgoing = new Map<string, BpmnSequenceFlow[]>()
	const targets = new Set<string>()
	for (const flow of process.sequenceFlows) {
		outgoing.set(flow.sourceRef, [...(outgoing.get(flow.sourceRef) ?? []), flow])
		targets.add(flow.targetRef)
	}

	// A start event is the natural entry point; a fragment without one (the docs are full of
	// them, showing three elements out of a larger model) is entered at whatever has no
	// incoming flow, and failing that at the first element, so nothing goes undescribed.
	const starts = process.flowElements.filter((element) => element.type === "startEvent")
	const roots =
		starts.length > 0 ? starts : process.flowElements.filter((element) => !targets.has(element.id))
	const entries = roots.length > 0 ? roots : process.flowElements.slice(0, 1)

	const lines: string[] = []
	const walked = new Set<string>()
	for (const entry of entries) walk(entry, "  ", lines, { byId, outgoing, walked })

	const lanes = describeLanes(process)
	if (lanes.length > 0) lines.push(...lanes)
	for (const annotation of process.textAnnotations) {
		const text = collapse(annotation.text ?? "")
		if (text !== "") lines.push(`  note: ${text}`)
	}
	return lines
}

interface WalkContext {
	byId: Map<string, BpmnFlowElement>
	outgoing: Map<string, BpmnSequenceFlow[]>
	walked: Set<string>
}

/**
 * Write one path through the model, branching onto indented lines at every split.
 *
 * `walked` is shared across the whole process rather than per path: a join reached from two
 * branches is described once, and a loop terminates instead of unrolling forever.
 */
function walk(start: BpmnFlowElement, indent: string, lines: string[], context: WalkContext): void {
	const segment: string[] = []
	let current: BpmnFlowElement | undefined = start

	while (current) {
		if (context.walked.has(current.id)) {
			segment.push(`(back to ${label(current)})`)
			break
		}
		context.walked.add(current.id)
		segment.push(label(current))

		const flows = context.outgoing.get(current.id) ?? []
		if (flows.length === 0) break

		if (flows.length === 1) {
			const only = flows[0]
			if (!only) break
			const edge = edgeLabel(only)
			if (edge !== "") segment.push(edge)
			current = context.byId.get(only.targetRef)
			continue
		}

		lines.push(`${indent}${segment.join(" → ")}`)
		for (const flow of flows) {
			const target = context.byId.get(flow.targetRef)
			if (!target) continue
			const edge = edgeLabel(flow)
			const prefix = `${indent}  — ${edge === "" ? "" : `${edge} `}`
			const branch: string[] = []
			walk(target, `${indent}  `, branch, context)
			const [first = "", ...rest] = branch
			lines.push(`${prefix}${first.trim()}`, ...rest)
		}
		return
	}

	if (segment.length > 0) lines.push(`${indent}${segment.join(" → ")}`)
}

/** A flow's own label: its name, its condition, or both — the part a reader is told to write. */
function edgeLabel(flow: BpmnSequenceFlow): string {
	const name = collapse(flow.name ?? "")
	const condition = collapse(flow.conditionExpression?.text ?? "")
	if (name !== "" && condition !== "") return `[${name}: ${condition}]`
	if (name !== "") return `[${name}]`
	if (condition !== "") return `[${condition}]`
	return ""
}

function label(element: BpmnFlowElement): string {
	const name = collapse(element.name ?? "")
	const kind = KIND[element.type]
	if (name === "") return kind ?? element.type
	return kind === undefined ? `"${name}"` : `${kind} "${name}"`
}

function describeLanes(process: BpmnProcess): string[] {
	const lanes = process.laneSet?.lanes ?? []
	const named = lanes.filter((lane) => collapse(lane.name ?? "") !== "")
	if (named.length === 0) return []
	return [`  lanes: ${named.map((lane) => collapse(lane.name ?? "")).join(", ")}`]
}

/** Modeller labels wrap with newlines for the canvas; a chunk wants one line. */
function collapse(value: string): string {
	return value.replace(/\s+/g, " ").trim()
}
