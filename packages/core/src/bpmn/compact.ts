import { layoutProcess } from "../layout/index.js"
import type { XmlElement } from "../types/xml-element.js"
import type {
	BpmnAssociation,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnDiagram,
	BpmnElementType,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "./bpmn-model.js"

// ── Types ───────────────────────────────────────────────────────────────────

/** A single BPMN flow node in compact form. */
export interface CompactElement {
	id: string
	type: BpmnElementType
	name?: string
	/** Zeebe job type (serviceTask: zeebe:taskDefinition.type) */
	jobType?: string
	/**
	 * Zeebe task headers (key→value).
	 * For the Camunda HTTP connector use jobType "io.camunda:http-json:1" and set:
	 *   url, method, and optionally headers/body/connectionTimeoutInSeconds.
	 */
	taskHeaders?: Record<string, string>
	/** Called process ID (callActivity: zeebe:calledElement.processId) */
	calledProcess?: string
	/** Linked form ID (userTask: zeebe:formDefinition.formId) */
	formId?: string
	/** Linked decision ID (businessRuleTask: zeebe:calledDecision.decisionId) */
	decisionId?: string
	/**
	 * Primary output variable.
	 * - For businessRuleTask: stored in zeebe:calledDecision.resultVariable.
	 * - For serviceTask with jobType: stored as a zeebe:ioMapping output (source "= response").
	 */
	resultVariable?: string
	/** Event definition type (timer, error, message, signal, …) */
	eventType?: string
	/** Boundary event: host element ID */
	attachedTo?: string
	/** Boundary event: false = non-interrupting */
	interrupting?: boolean
}

/** A sequence flow in compact form. */
export interface CompactFlow {
	id: string
	from: string
	to: string
	name?: string
	/** FEEL condition expression */
	condition?: string
}

/** A single process in compact form. */
export interface CompactProcess {
	id: string
	name?: string
	elements: CompactElement[]
	flows: CompactFlow[]
}

/**
 * Token-efficient representation of a {@link BpmnDefinitions} document.
 * Produced by {@link compactify}; restored to full form by {@link expand}.
 */
export interface CompactDiagram {
	id: string
	processes: CompactProcess[]
}

// ── Compactify ───────────────────────────────────────────────────────────────

function findAttr(ext: XmlElement[], name: string, attr: string): string | undefined {
	return ext.find((e) => e.name === name)?.attributes[attr]
}

function compactifyElement(el: BpmnFlowElement): CompactElement {
	const ext = el.extensionElements
	const result: CompactElement = { id: el.id, type: el.type }
	if (el.name) result.name = el.name

	const jobType = findAttr(ext, "zeebe:taskDefinition", "type")
	if (jobType) result.jobType = jobType

	// Extract task headers (key→value map from zeebe:taskHeaders children)
	const taskHeadersEl = ext.find((e) => e.name === "zeebe:taskHeaders")
	if (taskHeadersEl && taskHeadersEl.children.length > 0) {
		const headers: Record<string, string> = {}
		for (const child of taskHeadersEl.children) {
			const key = child.attributes.key
			const value = child.attributes.value
			if (key !== undefined && value !== undefined) headers[key] = value
		}
		if (Object.keys(headers).length > 0) result.taskHeaders = headers
	}

	const calledProcess = findAttr(ext, "zeebe:calledElement", "processId")
	if (calledProcess) result.calledProcess = calledProcess

	const formId = findAttr(ext, "zeebe:formDefinition", "formId")
	if (formId) result.formId = formId

	const decisionId = findAttr(ext, "zeebe:calledDecision", "decisionId")
	if (decisionId) {
		result.decisionId = decisionId
		const rv = findAttr(ext, "zeebe:calledDecision", "resultVariable")
		if (rv) result.resultVariable = rv
	} else {
		// For service tasks: extract the primary output variable from ioMapping
		const ioMappingEl = ext.find((e) => e.name === "zeebe:ioMapping")
		if (ioMappingEl) {
			const outputs = ioMappingEl.children.filter((c) => c.name === "zeebe:output")
			if (outputs.length === 1) {
				const target = outputs[0]?.attributes.target
				if (target) result.resultVariable = target
			}
		}
	}

	if ("eventDefinitions" in el && el.eventDefinitions.length > 0) {
		result.eventType = el.eventDefinitions[0]?.type
	}

	if (el.type === "boundaryEvent") {
		result.attachedTo = el.attachedToRef
		if (el.cancelActivity === false) result.interrupting = false
	}

	return result
}

/**
 * Converts a {@link BpmnDefinitions} model into a token-efficient
 * {@link CompactDiagram} representation suitable for AI contexts (LLM prompts,
 * MCP tool calls, etc.). The compact format is typically 5–15× smaller than
 * raw BPMN XML.
 *
 * Use {@link expand} to restore a compact diagram back to a full model with
 * auto-generated layout.
 *
 * @example
 * ```typescript
 * import { Bpmn, compactify, expand } from "@bpmn-sdk/core"
 *
 * const defs    = Bpmn.parse(xml)
 * const compact = compactify(defs)   // send to AI
 * const restored = expand(compact)   // get back BpmnDefinitions
 * const xml2    = Bpmn.export(restored)
 * ```
 */
export function compactify(defs: BpmnDefinitions): CompactDiagram {
	return {
		id: defs.id,
		processes: defs.processes.map((process) => ({
			id: process.id,
			name: process.name,
			elements: process.flowElements.map(compactifyElement),
			flows: process.sequenceFlows.map((sf) => {
				const f: CompactFlow = { id: sf.id, from: sf.sourceRef, to: sf.targetRef }
				if (sf.name) f.name = sf.name
				if (sf.conditionExpression) f.condition = sf.conditionExpression.text
				return f
			}),
		})),
	}
}

// ── Expand ───────────────────────────────────────────────────────────────────

function makeEventDef(eventType: string): BpmnEventDefinition | undefined {
	switch (eventType) {
		case "timer":
			return { type: "timer" }
		case "error":
			return { type: "error" }
		case "message":
			return { type: "message" }
		case "signal":
			return { type: "signal" }
		case "escalation":
			return { type: "escalation" }
		case "cancel":
			return { type: "cancel" }
		case "terminate":
			return { type: "terminate" }
		case "conditional":
			return { type: "conditional" }
		case "link":
			return { type: "link" }
		case "compensate":
			return { type: "compensate" }
		default:
			return undefined
	}
}

function makeExtensions(el: CompactElement): XmlElement[] {
	const ext: XmlElement[] = []
	if (el.jobType) {
		ext.push({ name: "zeebe:taskDefinition", attributes: { type: el.jobType }, children: [] })
	}
	if (el.taskHeaders && Object.keys(el.taskHeaders).length > 0) {
		ext.push({
			name: "zeebe:taskHeaders",
			attributes: {},
			children: Object.entries(el.taskHeaders).map(([key, value]) => ({
				name: "zeebe:header",
				attributes: { key, value },
				children: [],
			})),
		})
	}
	if (el.calledProcess) {
		ext.push({
			name: "zeebe:calledElement",
			attributes: { processId: el.calledProcess },
			children: [],
		})
	}
	if (el.formId) {
		ext.push({ name: "zeebe:formDefinition", attributes: { formId: el.formId }, children: [] })
	}
	if (el.decisionId) {
		ext.push({
			name: "zeebe:calledDecision",
			attributes: {
				decisionId: el.decisionId,
				resultVariable: el.resultVariable ?? "result",
			},
			children: [],
		})
	} else if (el.resultVariable && el.jobType) {
		// Service task with a result variable: map the connector response to the variable
		ext.push({
			name: "zeebe:ioMapping",
			attributes: {},
			children: [
				{
					name: "zeebe:output",
					attributes: { source: "= response", target: el.resultVariable },
					children: [],
				},
			],
		})
	}
	return ext
}

function buildFlowElement(
	el: CompactElement,
	incoming: string[],
	outgoing: string[],
): BpmnFlowElement {
	const base = {
		id: el.id,
		name: el.name,
		incoming,
		outgoing,
		extensionElements: makeExtensions(el),
		unknownAttributes: {} as Record<string, string>,
	}
	const eventDef = el.eventType ? makeEventDef(el.eventType) : undefined
	const eventDefs: BpmnEventDefinition[] = eventDef ? [eventDef] : []
	const subContent = {
		flowElements: [] as BpmnFlowElement[],
		sequenceFlows: [] as BpmnSequenceFlow[],
		textAnnotations: [] as BpmnTextAnnotation[],
		associations: [] as BpmnAssociation[],
	}

	switch (el.type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: eventDefs }
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: eventDefs }
		case "intermediateCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: eventDefs }
		case "intermediateThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: eventDefs }
		case "boundaryEvent":
			return {
				...base,
				type: "boundaryEvent",
				attachedToRef: el.attachedTo ?? "",
				cancelActivity: el.interrupting !== false,
				eventDefinitions: eventDefs,
			}
		case "serviceTask":
			return { ...base, type: "serviceTask" }
		case "scriptTask":
			return { ...base, type: "scriptTask" }
		case "userTask":
			return { ...base, type: "userTask" }
		case "businessRuleTask":
			return { ...base, type: "businessRuleTask" }
		case "callActivity":
			return { ...base, type: "callActivity" }
		case "sendTask":
			return { ...base, type: "sendTask" }
		case "receiveTask":
			return { ...base, type: "receiveTask" }
		case "manualTask":
			return { ...base, type: "manualTask" }
		case "task":
			return { ...base, type: "task" }
		case "subProcess":
			return { ...base, type: "subProcess", ...subContent }
		case "adHocSubProcess":
			return { ...base, type: "adHocSubProcess", ...subContent }
		case "eventSubProcess":
			return { ...base, type: "eventSubProcess", ...subContent }
		case "transaction":
			return { ...base, type: "transaction", ...subContent }
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" }
		case "parallelGateway":
			return { ...base, type: "parallelGateway" }
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" }
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" }
		case "complexGateway":
			return { ...base, type: "complexGateway" }
	}
}

function buildDiagram(processId: string, process: BpmnProcess): BpmnDiagram {
	const layout = layoutProcess(process)
	const shapes: BpmnDiShape[] = layout.nodes.map((n) => ({
		id: `${n.id}_di`,
		bpmnElement: n.id,
		isExpanded: n.isExpanded,
		bounds: n.bounds,
		label: n.labelBounds ? { bounds: n.labelBounds } : undefined,
		unknownAttributes: {},
	}))
	const edges: BpmnDiEdge[] = layout.edges.map((e) => ({
		id: `${e.id}_di`,
		bpmnElement: e.id,
		waypoints: e.waypoints,
		unknownAttributes: {},
	}))
	return {
		id: `BPMNDiagram_${processId}`,
		plane: {
			id: `BPMNPlane_${processId}`,
			bpmnElement: processId,
			shapes,
			edges,
		},
	}
}

function expandProcess(compact: CompactProcess): { process: BpmnProcess; diagram: BpmnDiagram } {
	const incoming = new Map<string, string[]>()
	const outgoing = new Map<string, string[]>()
	for (const f of compact.flows) {
		const out = outgoing.get(f.from) ?? []
		out.push(f.id)
		outgoing.set(f.from, out)
		const inc = incoming.get(f.to) ?? []
		inc.push(f.id)
		incoming.set(f.to, inc)
	}

	const flowElements: BpmnFlowElement[] = compact.elements.map((el) =>
		buildFlowElement(el, incoming.get(el.id) ?? [], outgoing.get(el.id) ?? []),
	)

	const sequenceFlows: BpmnSequenceFlow[] = compact.flows.map((f) => ({
		id: f.id,
		name: f.name,
		sourceRef: f.from,
		targetRef: f.to,
		conditionExpression: f.condition ? { text: f.condition, attributes: {} } : undefined,
		extensionElements: [],
		unknownAttributes: {},
	}))

	const process: BpmnProcess = {
		id: compact.id,
		name: compact.name,
		isExecutable: true,
		extensionElements: [],
		flowElements,
		sequenceFlows,
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}

	return { process, diagram: buildDiagram(compact.id, process) }
}

/**
 * Restores a {@link CompactDiagram} (produced by {@link compactify} or an AI
 * model) back to a full {@link BpmnDefinitions} with auto-generated layout.
 *
 * @example
 * ```typescript
 * const compact = await askAI(prompt)   // AI returns CompactDiagram JSON
 * const defs    = expand(compact)
 * const xml     = Bpmn.export(defs)
 * editor.loadXml(xml)
 * ```
 */
export function expand(compact: CompactDiagram): BpmnDefinitions {
	const processes: BpmnProcess[] = []
	const diagrams: BpmnDiagram[] = []
	for (const cp of compact.processes) {
		const { process, diagram } = expandProcess(cp)
		processes.push(process)
		diagrams.push(diagram)
	}
	return {
		id: compact.id,
		targetNamespace: "http://bpmn.io/schema/bpmn",
		namespaces: {
			bpmn: "http://www.omg.org/spec/BPMN/20100524/MODEL",
			bpmndi: "http://www.omg.org/spec/BPMN/20100524/DI",
			dc: "http://www.omg.org/spec/DD/20100524/DC",
			di: "http://www.omg.org/spec/DD/20100524/DI",
			zeebe: "http://camunda.org/schema/zeebe/1.0",
		},
		unknownAttributes: {},
		errors: [],
		escalations: [],
		messages: [],
		collaborations: [],
		processes,
		diagrams,
	}
}
