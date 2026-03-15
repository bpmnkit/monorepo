import type { BpmnDefinitions, BpmnFlowElement, BpmnSequenceFlow, XmlElement } from "@bpmnkit/core"
import type {
	ZeebeExtensions,
	ZeebeIoMappingEntry,
	ZeebePropertyEntry,
	ZeebeTaskHeaderEntry,
} from "@bpmnkit/core"

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Strip namespace prefix: "zeebe:taskDefinition" → "taskDefinition" */
export function xmlLocalName(qname: string): string {
	const idx = qname.indexOf(":")
	return idx >= 0 ? qname.slice(idx + 1) : qname
}

// ── Element lookup / update ───────────────────────────────────────────────────

export function findFlowElement(defs: BpmnDefinitions, id: string): BpmnFlowElement | undefined {
	for (const process of defs.processes) {
		const el = process.flowElements.find((e) => e.id === id)
		if (el) return el
	}
	return undefined
}

export function updateFlowElement(
	defs: BpmnDefinitions,
	id: string,
	fn: (el: BpmnFlowElement) => BpmnFlowElement,
): BpmnDefinitions {
	const processIdx = defs.processes.findIndex((p) => p.flowElements.some((e) => e.id === id))
	if (processIdx < 0) return defs
	const process = defs.processes[processIdx]
	if (!process) return defs
	const elIdx = process.flowElements.findIndex((e) => e.id === id)
	if (elIdx < 0) return defs
	const el = process.flowElements[elIdx]
	if (!el) return defs
	const newEl = fn(el)
	const newElements = process.flowElements.map((e, i) => (i === elIdx ? newEl : e))
	const newProcess = { ...process, flowElements: newElements }
	return {
		...defs,
		processes: defs.processes.map((p, i) => (i === processIdx ? newProcess : p)),
	}
}

// ── Zeebe extension parsing ───────────────────────────────────────────────────

export function parseZeebeExtensions(extensionElements: XmlElement[]): ZeebeExtensions {
	const ext: ZeebeExtensions = {}

	for (const el of extensionElements) {
		const ln = xmlLocalName(el.name)

		if (ln === "taskDefinition") {
			ext.taskDefinition = {
				type: el.attributes.type ?? "",
				retries: el.attributes.retries,
			}
		} else if (ln === "ioMapping") {
			const inputs: ZeebeIoMappingEntry[] = []
			const outputs: ZeebeIoMappingEntry[] = []
			for (const child of el.children) {
				const cln = xmlLocalName(child.name)
				if (cln === "input") {
					inputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					})
				} else if (cln === "output") {
					outputs.push({
						source: child.attributes.source ?? "",
						target: child.attributes.target ?? "",
					})
				}
			}
			ext.ioMapping = { inputs, outputs }
		} else if (ln === "taskHeaders") {
			const headers: ZeebeTaskHeaderEntry[] = []
			for (const child of el.children) {
				if (xmlLocalName(child.name) === "header") {
					headers.push({
						key: child.attributes.key ?? "",
						value: child.attributes.value ?? "",
					})
				}
			}
			ext.taskHeaders = { headers }
		} else if (ln === "formDefinition") {
			const formId = el.attributes.formId ?? ""
			ext.formDefinition = { formId }
		} else if (ln === "calledDecision") {
			const decisionId = el.attributes.decisionId ?? ""
			const resultVariable = el.attributes.resultVariable ?? "result"
			ext.calledDecision = { decisionId, resultVariable }
		} else if (ln === "properties") {
			const properties: ZeebePropertyEntry[] = []
			for (const child of el.children) {
				if (xmlLocalName(child.name) === "property") {
					properties.push({
						name: child.attributes.name ?? "",
						value: child.attributes.value ?? "",
					})
				}
			}
			ext.properties = { properties }
		}
	}

	return ext
}

const EXAMPLE_OUTPUT_JSON_KEY = "camundaModeler:exampleOutputJson"

/** Read the example output JSON string from parsed zeebe extensions. */
export function getExampleOutputJson(ext: ZeebeExtensions): string {
	return ext.properties?.properties.find((p) => p.name === EXAMPLE_OUTPUT_JSON_KEY)?.value ?? ""
}

/**
 * Return new properties list with the example output JSON set (or removed if empty).
 * Other existing zeebe:property entries are preserved.
 */
export function buildPropertiesWithExampleOutput(
	ext: ZeebeExtensions,
	json: string,
): ZeebeExtensions["properties"] {
	const others = ext.properties?.properties.filter((p) => p.name !== EXAMPLE_OUTPUT_JSON_KEY) ?? []
	const entries = json ? [...others, { name: EXAMPLE_OUTPUT_JSON_KEY, value: json }] : others
	return entries.length > 0 ? { properties: entries } : undefined
}

/** Get the value of a zeebe:ioMapping input by target name. */
export function getIoInput(ext: ZeebeExtensions, target: string): string | undefined {
	return ext.ioMapping?.inputs.find((i) => i.target === target)?.source
}

/** Get the value of a zeebe:taskHeader by key. */
export function getTaskHeader(ext: ZeebeExtensions, key: string): string | undefined {
	return ext.taskHeaders?.headers.find((h) => h.key === key)?.value
}

// ── Sequence flow lookup / update ─────────────────────────────────────────────

export function findSequenceFlow(defs: BpmnDefinitions, id: string): BpmnSequenceFlow | undefined {
	for (const process of defs.processes) {
		const sf = process.sequenceFlows.find((f) => f.id === id)
		if (sf) return sf
	}
	return undefined
}

export function updateSequenceFlow(
	defs: BpmnDefinitions,
	id: string,
	fn: (sf: BpmnSequenceFlow) => BpmnSequenceFlow,
): BpmnDefinitions {
	const processIdx = defs.processes.findIndex((p) => p.sequenceFlows.some((f) => f.id === id))
	if (processIdx < 0) return defs
	const process = defs.processes[processIdx]
	if (!process) return defs
	const sfIdx = process.sequenceFlows.findIndex((f) => f.id === id)
	if (sfIdx < 0) return defs
	const sf = process.sequenceFlows[sfIdx]
	if (!sf) return defs
	const newSf = fn(sf)
	const newFlows = process.sequenceFlows.map((f, i) => (i === sfIdx ? newSf : f))
	const newProcess = { ...process, sequenceFlows: newFlows }
	return {
		...defs,
		processes: defs.processes.map((p, i) => (i === processIdx ? newProcess : p)),
	}
}

// ── Zeebe extension helpers ───────────────────────────────────────────────────

export interface CalledElementInfo {
	processId: string
	propagateAllChildVariables: boolean
}

export function parseCalledElement(extensionElements: XmlElement[]): CalledElementInfo {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "calledElement")
	return {
		processId: el?.attributes.processId ?? "",
		propagateAllChildVariables: el?.attributes.propagateAllChildVariables === "true",
	}
}

export interface ZeebeScriptInfo {
	expression: string
	resultVariable: string
}

export function parseZeebeScript(extensionElements: XmlElement[]): ZeebeScriptInfo {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "script")
	return {
		expression: el?.attributes.expression ?? "",
		resultVariable: el?.attributes.resultVariable ?? "",
	}
}

/** Get an attribute from the zeebe:adHoc extension element. */
export function getAdHocAttr(
	extensionElements: XmlElement[],
	property: "outputCollection" | "outputElement" | "activeElementsCollection",
): string | undefined {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "adHoc")
	return el?.attributes[property]
}

// ── Zeebe event extension helpers ─────────────────────────────────────────────

export function parseZeebeMessage(extensionElements: XmlElement[]): {
	name: string
	correlationKey: string
} {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "message")
	return {
		name: el?.attributes.name ?? "",
		correlationKey: el?.attributes.correlationKey ?? "",
	}
}

export function parseZeebeSignal(extensionElements: XmlElement[]): { name: string } {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "signal")
	return { name: el?.attributes.name ?? "" }
}

export function parseZeebeError(extensionElements: XmlElement[]): { errorCode: string } {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "error")
	return { errorCode: el?.attributes.errorCode ?? "" }
}

export function parseZeebeEscalation(extensionElements: XmlElement[]): { escalationCode: string } {
	const el = extensionElements.find((x) => xmlLocalName(x.name) === "escalation")
	return { escalationCode: el?.attributes.escalationCode ?? "" }
}
