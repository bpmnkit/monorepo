import type { XmlElement } from "../types/xml-element.js"
import type {
	BpmnDefinitions,
	BpmnElementType,
	BpmnFlowElement,
	BpmnProcess,
	BpmnSequenceFlow,
} from "./bpmn-model.js"
import type {
	ZeebeCalledDecision,
	ZeebeExtensions,
	ZeebeFormDefinition,
	ZeebeIoMapping,
	ZeebeIoMappingEntry,
	ZeebeProperties,
	ZeebeTaskDefinition,
	ZeebeTaskHeaders,
} from "./zeebe-extensions.js"

// ── Process / element lookup ──────────────────────────────────────────────────

/**
 * Finds the first process in a definitions document with the given id.
 * Returns `undefined` if no process matches.
 *
 * @example
 * ```typescript
 * import { Bpmn, findProcess } from "@bpmnkit/core"
 *
 * const defs = Bpmn.parse(xml)
 * const proc = findProcess(defs, "order-process")
 * if (proc) console.log(proc.flowElements.length)
 * ```
 */
export function findProcess(defs: BpmnDefinitions, id: string): BpmnProcess | undefined {
	return defs.processes.find((p) => p.id === id)
}

/**
 * Finds a flow element (task, event, gateway, sub-process) by id across all
 * processes in the definitions document.
 *
 * Searches nested sub-process contents recursively.
 * Returns `undefined` if no element with that id exists.
 *
 * @example
 * ```typescript
 * import { Bpmn, findElement, isBpmnServiceTask } from "@bpmnkit/core"
 *
 * const defs = Bpmn.parse(xml)
 * const el = findElement(defs, "task1")
 * if (el && isBpmnServiceTask(el)) {
 *   console.log("service task:", el.name)
 * }
 * ```
 */
export function findElement(defs: BpmnDefinitions, id: string): BpmnFlowElement | undefined {
	for (const proc of defs.processes) {
		const found = findElementInProcess(proc, id)
		if (found) return found
	}
	return undefined
}

/**
 * Finds a flow element by id within a single process (including nested
 * sub-process contents, searched recursively).
 */
export function findElementInProcess(proc: BpmnProcess, id: string): BpmnFlowElement | undefined {
	return searchFlowElements(proc.flowElements, id)
}

function searchFlowElements(elements: BpmnFlowElement[], id: string): BpmnFlowElement | undefined {
	for (const el of elements) {
		if (el.id === id) return el
		// Recurse into containers
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			const nested = searchFlowElements(el.flowElements, id)
			if (nested) return nested
		}
	}
	return undefined
}

/**
 * Finds a sequence flow by id within a process (searches nested containers).
 * Returns `undefined` if not found.
 */
export function findSequenceFlow(proc: BpmnProcess, id: string): BpmnSequenceFlow | undefined {
	return searchSequenceFlows(proc, id)
}

function searchSequenceFlows(
	proc: { sequenceFlows: BpmnSequenceFlow[]; flowElements: BpmnFlowElement[] },
	id: string,
): BpmnSequenceFlow | undefined {
	const direct = proc.sequenceFlows.find((sf) => sf.id === id)
	if (direct) return direct
	for (const el of proc.flowElements) {
		if (
			el.type === "subProcess" ||
			el.type === "adHocSubProcess" ||
			el.type === "eventSubProcess" ||
			el.type === "transaction"
		) {
			const nested = searchSequenceFlows(el, id)
			if (nested) return nested
		}
	}
	return undefined
}

/**
 * Returns the `BpmnElementType` string for the element with the given id, or
 * `"sequenceFlow"` if it is a sequence flow, or `undefined` if not found.
 *
 * @example
 * ```typescript
 * const type = getElementType(defs, "task1")
 * // "serviceTask" | "userTask" | "sequenceFlow" | undefined
 * ```
 */
export function getElementType(
	defs: BpmnDefinitions,
	id: string,
): BpmnElementType | "sequenceFlow" | undefined {
	for (const proc of defs.processes) {
		const el = findElementInProcess(proc, id)
		if (el) return el.type
		if (findSequenceFlow(proc, id)) return "sequenceFlow"
	}
	return undefined
}

/**
 * Collects every flow element across all processes in the definitions document
 * (top-level only, not recursing into sub-processes).
 *
 * @example
 * ```typescript
 * const allElements = getAllElements(defs)
 * const tasks = allElements.filter(isBpmnTask)
 * ```
 */
export function getAllElements(defs: BpmnDefinitions): BpmnFlowElement[] {
	return defs.processes.flatMap((p) => p.flowElements)
}

// ── Zeebe extension extraction ────────────────────────────────────────────────

function localName(qualifiedName: string): string {
	const idx = qualifiedName.indexOf(":")
	return idx >= 0 ? qualifiedName.slice(idx + 1) : qualifiedName
}

function findChildren(elements: XmlElement[], tag: string): XmlElement[] {
	return elements.filter((c) => localName(c.name) === tag)
}

function findChild(elements: XmlElement[], tag: string): XmlElement | undefined {
	return elements.find((c) => localName(c.name) === tag)
}

/**
 * Extracts Zeebe extension data from the raw `extensionElements` array of a
 * flow element. This is the inverse of {@link zeebeExtensionsToXmlElements}.
 *
 * All fields are optional — only those present in the XML are returned.
 *
 * @example
 * ```typescript
 * import { Bpmn, findElement, getZeebeExtensions, isBpmnServiceTask } from "@bpmnkit/core"
 *
 * const defs = Bpmn.parse(xml)
 * const el = findElement(defs, "task1")
 * if (el && isBpmnServiceTask(el)) {
 *   const ext = getZeebeExtensions(el.extensionElements)
 *   console.log(ext.taskDefinition?.type)
 * }
 * ```
 */
export function getZeebeExtensions(extensionElements: XmlElement[]): ZeebeExtensions {
	const ext: ZeebeExtensions = {}

	const taskDef = findChild(extensionElements, "taskDefinition")
	if (taskDef) {
		const taskDefVal: ZeebeTaskDefinition = { type: taskDef.attributes.type ?? "" }
		if (taskDef.attributes.retries !== undefined) {
			taskDefVal.retries = taskDef.attributes.retries
		}
		ext.taskDefinition = taskDefVal
	}

	const ioMappingEl = findChild(extensionElements, "ioMapping")
	if (ioMappingEl) {
		const inputs: ZeebeIoMappingEntry[] = findChildren(ioMappingEl.children, "input").map((c) => ({
			source: c.attributes.source ?? "",
			target: c.attributes.target ?? "",
		}))
		const outputs: ZeebeIoMappingEntry[] = findChildren(ioMappingEl.children, "output").map(
			(c) => ({ source: c.attributes.source ?? "", target: c.attributes.target ?? "" }),
		)
		const ioMapping: ZeebeIoMapping = { inputs, outputs }
		ext.ioMapping = ioMapping
	}

	const headersEl = findChild(extensionElements, "taskHeaders")
	if (headersEl) {
		const taskHeaders: ZeebeTaskHeaders = {
			headers: findChildren(headersEl.children, "header").map((c) => ({
				key: c.attributes.key ?? "",
				value: c.attributes.value ?? "",
			})),
		}
		ext.taskHeaders = taskHeaders
	}

	const propsEl = findChild(extensionElements, "properties")
	if (propsEl) {
		const properties: ZeebeProperties = {
			properties: findChildren(propsEl.children, "property").map((c) => ({
				name: c.attributes.name ?? "",
				value: c.attributes.value ?? "",
			})),
		}
		ext.properties = properties
	}

	const formDefEl = findChild(extensionElements, "formDefinition")
	if (formDefEl) {
		const formDefinition: ZeebeFormDefinition = { formId: formDefEl.attributes.formId ?? "" }
		ext.formDefinition = formDefinition
	}

	const calledDecEl = findChild(extensionElements, "calledDecision")
	if (calledDecEl) {
		const calledDecision: ZeebeCalledDecision = {
			decisionId: calledDecEl.attributes.decisionId ?? "",
			resultVariable: calledDecEl.attributes.resultVariable ?? "",
		}
		ext.calledDecision = calledDecision
	}

	return ext
}
