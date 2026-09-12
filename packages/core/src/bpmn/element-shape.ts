/**
 * Building a flow element of a given type, and changing the type of one that
 * already exists.
 *
 * `createFlowElement` is the single place that knows which fields each
 * `BpmnElementType` carries. Its switch is exhaustive — the `default` branch
 * assigns to `never`, so **adding a member to `BpmnElementType` fails `tsc`
 * here** rather than falling through to a plausible-looking wrong shape.
 *
 * `retypeElement` is what lets a caller change a task's type without hand-
 * editing XML: the reason the SDK's own users reached for the file. It keeps
 * identity and wiring, and carries over anything both the old and new type can
 * hold.
 */

import type { XmlElement } from "../types/xml-element.js"
import type {
	BpmnElementType,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMultiInstanceLoopCharacteristics,
} from "./bpmn-model.js"
import { bpmnElementName, isZeebePlacementAllowed } from "./zeebe-extensions.js"

/** The fields every flow element carries, whatever its type. */
interface FlowElementBase {
	id: string
	name?: string
	incoming: string[]
	outgoing: string[]
	documentation?: string
	isForCompensation?: boolean
	extensionElements: XmlElement[]
	unknownAttributes: Record<string, string>
}

export interface CreateFlowElementOptions {
	name?: string
	documentation?: string
	extensionElements?: XmlElement[]
}

/** Container types — the ones that hold their own flow elements and flows. */
const CONTAINER_TYPES = new Set<BpmnElementType>([
	"subProcess",
	"adHocSubProcess",
	"eventSubProcess",
	"transaction",
])

/** Types that can carry `loopCharacteristics` (a multi-instance marker). */
const LOOP_CAPABLE_TYPES = new Set<BpmnElementType>([
	"task",
	"serviceTask",
	"scriptTask",
	"userTask",
	"sendTask",
	"receiveTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"subProcess",
	"adHocSubProcess",
	"transaction",
])

/** Event types — the ones that carry `eventDefinitions`. */
const EVENT_TYPES = new Set<BpmnElementType>([
	"startEvent",
	"endEvent",
	"intermediateThrowEvent",
	"intermediateCatchEvent",
	"boundaryEvent",
])

/** True when the type holds nested flow elements. */
export function isContainerType(type: BpmnElementType): boolean {
	return CONTAINER_TYPES.has(type)
}

/** True when the type can carry a multi-instance marker. */
export function isLoopCapableType(type: BpmnElementType): boolean {
	return LOOP_CAPABLE_TYPES.has(type)
}

/** True when the type carries event definitions. */
export function isEventType(type: BpmnElementType): boolean {
	return EVENT_TYPES.has(type)
}

function emptyContainer() {
	return {
		flowElements: [],
		sequenceFlows: [],
		textAnnotations: [],
		associations: [],
		groups: [],
	}
}

/**
 * Build an empty flow element of the given type.
 *
 * The switch is exhaustive over `BpmnElementType`; the `default` branch exists
 * only to make that a compile error rather than a silent wrong shape.
 */
export function createFlowElement(
	id: string,
	type: BpmnElementType,
	options?: CreateFlowElementOptions,
): BpmnFlowElement {
	const base: FlowElementBase = {
		id,
		name: options?.name,
		incoming: [],
		outgoing: [],
		documentation: options?.documentation,
		extensionElements: options?.extensionElements ?? [],
		unknownAttributes: {},
	}

	switch (type) {
		case "startEvent":
		case "endEvent":
		case "intermediateThrowEvent":
		case "intermediateCatchEvent":
			return { ...base, type, eventDefinitions: [] }
		case "boundaryEvent":
			return { ...base, type, attachedToRef: "", eventDefinitions: [] }

		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			return { ...base, type }

		case "exclusiveGateway":
		case "parallelGateway":
		case "inclusiveGateway":
		case "eventBasedGateway":
		case "complexGateway":
			return { ...base, type }

		case "subProcess":
		case "adHocSubProcess":
		case "eventSubProcess":
		case "transaction":
			return { ...base, type, ...emptyContainer() }

		case "dataObject":
		case "dataObjectReference":
		case "dataStoreReference":
			return { ...base, type }

		default: {
			const unhandled: never = type
			throw new Error(`Unhandled BPMN element type: ${String(unhandled)}`)
		}
	}
}

/**
 * Return a copy of `el` with a different `type`, keeping everything the new
 * type can still hold.
 *
 * Kept: id, name, documentation, incoming/outgoing flows, compensation flag,
 * extension elements and unmodelled attributes — so retyping never breaks the
 * graph around the element. Carried over when *both* types support them:
 * nested content (container → container), the multi-instance marker, and event
 * definitions. Anything the new type cannot hold is dropped, which is the
 * point: a `serviceTask` retyped to `manualTask` should not keep a job worker.
 *
 * Returns `el` unchanged when the type already matches.
 */
export function retypeElement(el: BpmnFlowElement, type: BpmnElementType): BpmnFlowElement {
	if (el.type === type) return el

	// Keep only the extensions the Zeebe schema allows on the new element. This
	// is what stops a serviceTask retyped to manualTask carrying a job worker
	// the engine would then refuse to deploy. Extensions the descriptor says
	// nothing about — anyone else's namespace — are kept.
	const ownerName = bpmnElementName({ type })
	const extensionElements = el.extensionElements.filter((ext) =>
		isZeebePlacementAllowed(ownerName, ext.name),
	)

	const next = createFlowElement(el.id, type, {
		name: el.name,
		documentation: el.documentation,
		extensionElements,
	})

	next.incoming = [...el.incoming]
	next.outgoing = [...el.outgoing]
	next.unknownAttributes = { ...el.unknownAttributes }
	if (el.isForCompensation !== undefined) next.isForCompensation = el.isForCompensation

	if (isContainerType(el.type) && isContainerType(type) && "flowElements" in el) {
		const target = next as unknown as {
			flowElements: unknown
			sequenceFlows: unknown
			textAnnotations: unknown
			associations: unknown
			groups: unknown
		}
		target.flowElements = el.flowElements
		target.sequenceFlows = el.sequenceFlows
		target.textAnnotations = el.textAnnotations
		target.associations = el.associations
		target.groups = el.groups
	}

	if (isLoopCapableType(el.type) && isLoopCapableType(type) && "loopCharacteristics" in el) {
		const loop = el.loopCharacteristics as BpmnMultiInstanceLoopCharacteristics | undefined
		if (loop) {
			;(
				next as { loopCharacteristics?: BpmnMultiInstanceLoopCharacteristics }
			).loopCharacteristics = loop
		}
	}

	if (isEventType(el.type) && isEventType(type) && "eventDefinitions" in el) {
		;(next as { eventDefinitions?: BpmnEventDefinition[] }).eventDefinitions = el.eventDefinitions
	}

	// A boundary event is meaningless without its host, so keep the attachment
	// when retyping between boundary events; when the source was not one, the
	// caller must set it.
	if (el.type === "boundaryEvent" && type === "boundaryEvent") {
		;(next as { attachedToRef: string }).attachedToRef = el.attachedToRef
	}

	return next
}
