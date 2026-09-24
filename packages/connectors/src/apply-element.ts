/**
 * Applying an element template to an element of a parsed model.
 *
 * `applyElementTemplate` answers with builder options, which is enough for an
 * outbound task built from scratch. An inbound connector is not: its message
 * name and correlation key live on a root `bpmn:message` the event references,
 * and an RPA task's scripts on `zeebe:linkedResources` — places no builder
 * option reaches. This writes all of it onto an element that already exists.
 */

import type {
	BpmnDefinitions,
	BpmnElementType,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMessage,
	BpmnMessageEventDefinition,
	XmlElement,
	ZeebeExtensions,
} from "@bpmnkit/core"
import {
	bpmnElementName,
	isZeebePlacementAllowed,
	retypeElement,
	sha256Hex,
	zeebeExtensionsToXmlElements,
} from "@bpmnkit/core"
import { type Accumulator, type ApplyProblem, resolveBindings } from "./apply.js"
import type { ElementTemplate, TemplateBinding } from "./template-types.js"

/** The one `elementType.eventDefinition` this toolkit writes. */
export const APPLIED_EVENT_DEFINITION = "bpmn:MessageEventDefinition"

/** The result of {@link applyTemplateToElement}. */
export interface ApplyToElementResult {
	/**
	 * The model with the template applied — a copy; the input is never mutated.
	 * When the element is missing or the template does not apply to it, this is
	 * the input, unchanged, and `problems` says why.
	 */
	definitions: BpmnDefinitions
	/** Same meaning as `ApplyResult.problems`, plus anything that stopped a write. */
	problems: ApplyProblem[]
}

/** Every flow element type, so a template's `elementType` is checked rather than cast. */
const ELEMENT_TYPES: Record<BpmnElementType, true> = {
	startEvent: true,
	endEvent: true,
	intermediateThrowEvent: true,
	intermediateCatchEvent: true,
	boundaryEvent: true,
	task: true,
	serviceTask: true,
	scriptTask: true,
	userTask: true,
	sendTask: true,
	receiveTask: true,
	businessRuleTask: true,
	manualTask: true,
	callActivity: true,
	exclusiveGateway: true,
	parallelGateway: true,
	inclusiveGateway: true,
	eventBasedGateway: true,
	complexGateway: true,
	subProcess: true,
	adHocSubProcess: true,
	eventSubProcess: true,
	transaction: true,
	dataObject: true,
	dataObjectReference: true,
	dataStoreReference: true,
}

/** `"bpmn:ServiceTask"` → `"serviceTask"`, or undefined for a type the model has no element for. */
function toElementType(name: string): BpmnElementType | undefined {
	const local = name.startsWith("bpmn:") ? name.slice(5) : name
	const type = `${local.charAt(0).toLowerCase()}${local.slice(1)}`
	return Object.hasOwn(ELEMENT_TYPES, type) ? (type as BpmnElementType) : undefined
}

function isEvent(type: BpmnElementType): boolean {
	return type.endsWith("Event")
}

/** `appliesTo` matches by type, and `bpmn:Task` covers every task, as it does in the Modeler. */
function appliesTo(template: ElementTemplate, type: BpmnElementType): boolean {
	const own = bpmnElementName({ type }).toLowerCase()
	const isTask = type === "task" || type.endsWith("Task")
	return template.appliesTo.some(
		(entry) => entry.toLowerCase() === own || (entry === "bpmn:Task" && isTask),
	)
}

interface Location {
	siblings: BpmnFlowElement[]
	index: number
}

function locateIn(elements: BpmnFlowElement[], id: string): Location | undefined {
	for (let index = 0; index < elements.length; index++) {
		const element = elements[index] as BpmnFlowElement
		if (element.id === id) return { siblings: elements, index }
		if ("flowElements" in element) {
			const nested = locateIn(element.flowElements, id)
			if (nested) return nested
		}
	}
	return undefined
}

function locate(definitions: BpmnDefinitions, id: string): Location | undefined {
	for (const process of definitions.processes) {
		const found = locateIn(process.flowElements, id)
		if (found) return found
	}
	return undefined
}

function isMessageDefinition(
	definition: BpmnEventDefinition,
): definition is BpmnMessageEventDefinition {
	return definition.type === "message"
}

/** The id of the root message an element references, if any. */
function messageRefOf(element: BpmnFlowElement): string | undefined {
	if (element.type === "receiveTask" || element.type === "sendTask") return element.messageRef
	if ("eventDefinitions" in element) {
		return element.eventDefinitions.find(isMessageDefinition)?.messageRef
	}
	return undefined
}

function visitElements(
	definitions: BpmnDefinitions,
	visit: (element: BpmnFlowElement) => void,
): void {
	const walk = (elements: BpmnFlowElement[]) => {
		for (const element of elements) {
			visit(element)
			if ("flowElements" in element) walk(element.flowElements)
		}
	}
	for (const process of definitions.processes) walk(process.flowElements)
}

/** How many elements and message flows reference a root message. */
function messageUses(definitions: BpmnDefinitions, messageId: string): number {
	let uses = 0
	visitElements(definitions, (element) => {
		if (messageRefOf(element) === messageId) uses++
	})
	for (const collaboration of definitions.collaborations) {
		for (const flow of collaboration.messageFlows) if (flow.messageRef === messageId) uses++
	}
	return uses
}

/** A message id derived from its name, like the builder's, deduped against every id in the model. */
function messageId(definitions: BpmnDefinitions, name: string): string {
	const taken = new Set<string>()
	for (const root of [
		...definitions.messages,
		...definitions.errors,
		...definitions.signals,
		...definitions.escalations,
	]) {
		taken.add(root.id)
	}
	visitElements(definitions, (element) => taken.add(element.id))
	const base = `Message_${name.replace(/[^A-Za-z0-9_.-]/g, "_")}`
	let id = base
	for (let n = 2; taken.has(id); n++) id = `${base}_${n}`
	return id
}

/**
 * The message an element should reference: one already named `name`, else the
 * element's own message renamed when nothing else uses it, else a new one.
 * Renaming in place keeps a re-applied template from leaving orphans behind.
 */
function resolveMessage(
	definitions: BpmnDefinitions,
	name: string,
	currentId: string | undefined,
): BpmnMessage {
	const named = definitions.messages.find((message) => message.name === name)
	if (named) return named
	const current = definitions.messages.find((message) => message.id === currentId)
	if (current && messageUses(definitions, current.id) <= 1) {
		current.name = name
		return current
	}
	const created: BpmnMessage = { id: messageId(definitions, name), name, unknownAttributes: {} }
	definitions.messages.push(created)
	return created
}

/** A UUID-shaped value (version 8, custom) from a SHA-256 — stable for the same seed. */
function derivedUuid(seed: string): string {
	const hex = sha256Hex(seed)
	const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16)
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/**
 * Puts `replacement` where the first `name` extension sat, dropping any others;
 * appends it when there was none, and removes it when `replacement` is undefined.
 */
function replaceExtension(
	extensions: XmlElement[],
	name: string,
	replacement: XmlElement | undefined,
): XmlElement[] {
	const at = extensions.findIndex((extension) => extension.name === name)
	const rest = extensions.filter((extension) => extension.name !== name)
	if (!replacement) return rest
	if (at === -1) return [...rest, replacement]
	rest.splice(at, 0, replacement)
	return rest
}

function zeebeElement(extensions: ZeebeExtensions): XmlElement | undefined {
	return zeebeExtensionsToXmlElements(extensions)[0]
}

/**
 * The element-level extensions a template owns, each with what it now holds.
 *
 * Ownership follows the bindings the template *declares*, not the ones active
 * for these values — so switching a dropdown off removes what it had written,
 * and applying twice gives the same element.
 */
function ownedExtensions(
	declared: ReadonlySet<TemplateBinding["type"]>,
	accum: Accumulator,
): Array<[string, XmlElement | undefined]> {
	const owned: Array<[string, XmlElement | undefined]> = []
	if (declared.has("zeebe:taskDefinition") || declared.has("zeebe:taskDefinition:type")) {
		owned.push([
			"zeebe:taskDefinition",
			accum.taskType === undefined
				? undefined
				: zeebeElement({ taskDefinition: { type: accum.taskType, retries: accum.retries } }),
		])
	}
	if (declared.has("zeebe:input") || declared.has("zeebe:output")) {
		const { inputs, outputs } = accum
		owned.push([
			"zeebe:ioMapping",
			inputs.length + outputs.length === 0
				? undefined
				: zeebeElement({ ioMapping: { inputs, outputs } }),
		])
	}
	if (declared.has("zeebe:taskHeader")) {
		const headers = Object.entries(accum.taskHeaders).map(([key, value]) => ({ key, value }))
		owned.push([
			"zeebe:taskHeaders",
			headers.length === 0 ? undefined : zeebeElement({ taskHeaders: { headers } }),
		])
	}
	if (declared.has("zeebe:property")) {
		const properties = accum.zeebeProperties
		owned.push([
			"zeebe:properties",
			properties.length === 0 ? undefined : zeebeElement({ properties: { properties } }),
		])
	}
	if (declared.has("zeebe:adHoc")) {
		const written = Object.values(accum.adHoc).some((value) => value !== undefined)
		owned.push(["zeebe:adHoc", written ? zeebeElement({ adHoc: accum.adHoc }) : undefined])
	}
	if (declared.has("zeebe:linkedResource")) {
		const children: XmlElement[] = [...accum.linkedResources].map(([linkName, attributes]) => ({
			name: "zeebe:linkedResource",
			attributes: { linkName, ...attributes },
			children: [],
		}))
		owned.push([
			"zeebe:linkedResources",
			children.length === 0
				? undefined
				: { name: "zeebe:linkedResources", attributes: {}, children },
		])
	}
	return owned
}

/**
 * Applies an element template to one element of a parsed model — every binding
 * kind, including the inbound ones builder options cannot carry.
 *
 * - **Element type.** `elementType` converts the element (keeping its id and
 *   wiring), and `elementType.eventDefinition` makes an event a message event.
 *   A template whose `appliesTo` does not cover the element is refused.
 * - **Messages.** `bpmn:Message#property` names the root `bpmn:message` the
 *   event definition or receive task references — reusing one already carrying
 *   that name, renaming the element's own when nothing else uses it, creating
 *   one otherwise. `bpmn:Message#zeebe:subscription#property` writes that
 *   message's `zeebe:subscription`, which is where Camunda reads the
 *   correlation key; one left on the element itself is removed.
 * - **Generated values.** A property with `generatedValue` and no value — the
 *   inbound message name — keeps the name of the message the element already
 *   references, and is otherwise derived from the template and element ids,
 *   never from a clock or random source.
 * - **Extensions.** `zeebe:taskDefinition`, `ioMapping`, `taskHeaders`,
 *   `properties`, `adHoc` and `linkedResources` are replaced wholesale when the
 *   template declares a binding of that kind, in place, and left alone when it
 *   does not. `zeebe:modelerTemplate`, `…Version` and `…Icon` are stamped.
 *
 * Deterministic and idempotent: the same model, template and values give the
 * same XML, and applying twice gives the same model as applying once.
 *
 * @param definitions - The model; not mutated.
 * @param elementId - A flow element anywhere in its processes, sub-processes included.
 * @param template - Any element template, bundled or a workspace's own.
 * @param values - Keyed as in {@link applyElementTemplate}; `name` sets the element's name.
 */
export function applyTemplateToElement(
	definitions: BpmnDefinitions,
	elementId: string,
	template: ElementTemplate,
	values: Record<string, string> = {},
): ApplyToElementResult {
	const refuse = (message: string): ApplyToElementResult => ({
		definitions,
		problems: [{ message }],
	})

	const original = locate(definitions, elementId)
	if (!original) return refuse(`No flow element "${elementId}" in this model`)
	const originalElement = original.siblings[original.index] as BpmnFlowElement

	const targetType =
		template.elementType === undefined ? undefined : toElementType(template.elementType.value)
	if (template.elementType !== undefined && targetType === undefined) {
		return refuse(
			`Template "${template.id}" converts to "${template.elementType.value}", which is not a flow element type`,
		)
	}
	if (originalElement.type !== targetType && !appliesTo(template, originalElement.type)) {
		return refuse(
			`Template "${template.id}" applies to ${template.appliesTo.join(", ")}, not ${bpmnElementName(originalElement)} "${elementId}"`,
		)
	}

	const next = structuredClone(definitions)
	const location = locate(next, elementId) as Location
	const currentMessageId = messageRefOf(originalElement)
	const currentMessage = next.messages.find((message) => message.id === currentMessageId)

	const { accum, problems } = resolveBindings(template, values, (key, prop) =>
		prop.binding.type === "bpmn:Message#property" &&
		prop.binding.name === "name" &&
		currentMessage?.name !== undefined
			? currentMessage.name
			: derivedUuid(`${template.id}\n${elementId}\n${key}`),
	)

	let element = location.siblings[location.index] as BpmnFlowElement
	if (targetType !== undefined) element = retypeElement(element, targetType)
	if (values.name !== undefined) element.name = values.name

	// Rebuilt rather than patched so a previous template's version or icon cannot survive.
	const stamps: Record<string, string> = { "zeebe:modelerTemplate": template.id }
	if (template.version !== undefined) {
		stamps["zeebe:modelerTemplateVersion"] = String(template.version)
	}
	if (template.icon !== undefined) stamps["zeebe:modelerTemplateIcon"] = template.icon.contents
	element.unknownAttributes = {
		...Object.fromEntries(
			Object.entries(element.unknownAttributes).filter(
				([attribute]) => !attribute.startsWith("zeebe:modelerTemplate"),
			),
		),
		...stamps,
	}

	const declared = new Set(template.properties.map((prop) => prop.binding.type))
	const owner = bpmnElementName(element)
	for (const [name, extension] of ownedExtensions(declared, accum)) {
		if (extension && !isZeebePlacementAllowed(owner, name)) {
			problems.push({ message: `<${name}> is not allowed on <${owner}>; it was not written` })
			element.extensionElements = replaceExtension(element.extensionElements, name, undefined)
			continue
		}
		element.extensionElements = replaceExtension(element.extensionElements, name, extension)
	}

	const usesMessage =
		declared.has("bpmn:Message#property") ||
		declared.has("bpmn:Message#zeebe:subscription#property")
	const eventDefinition = template.elementType?.eventDefinition

	let messageDefinition: BpmnMessageEventDefinition | undefined
	if ("eventDefinitions" in element) {
		if (eventDefinition !== undefined && eventDefinition !== APPLIED_EVENT_DEFINITION) {
			problems.push({
				message: `Event definition "${eventDefinition}" is not applied by this toolkit; the event's definitions were left as they were`,
			})
		} else if (eventDefinition !== undefined || usesMessage) {
			messageDefinition = element.eventDefinitions.find(isMessageDefinition) ?? {
				type: "message",
			}
			element.eventDefinitions = [messageDefinition]
		} else if (template.elementType !== undefined && isEvent(element.type)) {
			element.eventDefinitions = []
		}
	}

	if (usesMessage) {
		const name = accum.message.name ?? currentMessage?.name
		if (name === undefined) {
			problems.push({
				message: `Template "${template.id}" binds message properties but resolved no message name; the message was not written`,
			})
		} else if (
			messageDefinition === undefined &&
			element.type !== "receiveTask" &&
			element.type !== "sendTask"
		) {
			problems.push({
				message: `${owner} "${elementId}" cannot reference a message; the message bindings were not written`,
			})
		} else {
			const message = resolveMessage(next, name, currentMessageId)
			for (const [attribute, value] of Object.entries(accum.message)) {
				if (attribute === "name") continue
				message.unknownAttributes[attribute] = value
			}
			if (declared.has("bpmn:Message#zeebe:subscription#property")) {
				const subscription = Object.keys(accum.subscription).length
					? {
							name: "zeebe:subscription",
							attributes: { ...accum.subscription },
							children: [],
						}
					: undefined
				const extensions = replaceExtension(
					message.extensionElements ?? [],
					"zeebe:subscription",
					subscription,
				)
				message.extensionElements = extensions.length > 0 ? extensions : undefined
			}
			if (messageDefinition) messageDefinition.messageRef = message.id
			else if (element.type === "receiveTask" || element.type === "sendTask") {
				element.messageRef = message.id
			}
			element.extensionElements = replaceExtension(
				element.extensionElements,
				"zeebe:subscription",
				undefined,
			)
		}
	}

	location.siblings[location.index] = element
	return { definitions: next, problems }
}
