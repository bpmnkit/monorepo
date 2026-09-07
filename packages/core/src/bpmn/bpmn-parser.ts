import { ParseError } from "../errors.js"
import type { XmlElement } from "../types/xml-element.js"
import { Visit, type XmlSink, scanXml } from "../xml/xml-parser.js"
import type {
	BpmnAssociation,
	BpmnBoundaryEvent,
	BpmnBounds,
	BpmnCategory,
	BpmnCategoryValue,
	BpmnCollaboration,
	BpmnConditionExpression,
	BpmnDataAssociation,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiLabel,
	BpmnDiPlane,
	BpmnDiShape,
	BpmnDiagram,
	BpmnElementType,
	BpmnError,
	BpmnEscalation,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnGroup,
	BpmnLane,
	BpmnLaneSet,
	BpmnMessage,
	BpmnMessageFlow,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnParticipant,
	BpmnProcess,
	BpmnProperty,
	BpmnSequenceFlow,
	BpmnSignal,
	BpmnTextAnnotation,
	BpmnWaypoint,
} from "./bpmn-model.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Attrs = Record<string, string>

function localName(name: string): string {
	const idx = name.indexOf(":")
	return idx >= 0 ? name.slice(idx + 1) : name
}

/** True when `qname` is `local` or `<prefix>:<local>` — without slicing a new string. */
function hasLocalName(qname: string, local: string): boolean {
	const idx = qname.indexOf(":")
	if (idx < 0) return qname === local
	return qname.length - idx - 1 === local.length && qname.endsWith(local)
}

function attr(attributes: Attrs, name: string): string | undefined {
	const direct = attributes[name]
	if (direct !== undefined) return direct
	// Fall back to a namespace-qualified spelling of the same attribute.
	for (const key in attributes) {
		if (key.length > name.length && hasLocalName(key, name)) return attributes[key]
	}
	return undefined
}

function requiredAttr(attributes: Attrs, name: string, elementName: string): string {
	const value = attr(attributes, name)
	if (value === undefined) {
		throw new ParseError(`Missing required attribute "${name}" on <${elementName}>`)
	}
	return value
}

/** Known attribute names on flow nodes — everything else goes to unknownAttributes. */
const KNOWN_ATTRS = new Set([
	"id",
	"name",
	"default",
	"attachedToRef",
	"cancelActivity",
	"isForCompensation",
	"sourceRef",
	"targetRef",
	"associationDirection",
	"isExecutable",
	"isMarkerVisible",
	"isExpanded",
	"isHorizontal",
	"bpmnElement",
	"errorRef",
	"escalationRef",
	"errorCode",
	"escalationCode",
	"targetNamespace",
	"exporter",
	"exporterVersion",
	"processRef",
	"dataObjectRef",
	"dataStoreRef",
	"isCollection",
	"categoryValueRef",
])

/** Extract unknown (namespace-qualified) attributes from an element. */
function unknownAttrs(attributes: Attrs): Record<string, string> {
	const result: Record<string, string> = {}
	for (const key in attributes) {
		if (KNOWN_ATTRS.has(key)) continue
		if (key.startsWith("xmlns:") || key === "xmlns") continue
		if (key.includes(":") && KNOWN_ATTRS.has(localName(key))) continue
		result[key] = attributes[key] as string
	}
	return result
}

/** Known child local names for flow nodes — anything else is an extension. */
const KNOWN_FLOW_CHILDREN = new Set([
	"incoming",
	"outgoing",
	"documentation",
	"extensionElements",
	"conditionExpression",
	"timerEventDefinition",
	"errorEventDefinition",
	"escalationEventDefinition",
	"messageEventDefinition",
	"signalEventDefinition",
	"conditionalEventDefinition",
	"linkEventDefinition",
	"cancelEventDefinition",
	"terminateEventDefinition",
	"compensateEventDefinition",
	"multiInstanceLoopCharacteristics",
	// Sub-process children are handled separately
])

const KNOWN_PROCESS_CHILDREN = new Set([
	"startEvent",
	"endEvent",
	"intermediateCatchEvent",
	"intermediateThrowEvent",
	"boundaryEvent",
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
	"eventSubProcess",
	"transaction",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
	"sequenceFlow",
	"textAnnotation",
	"association",
	"laneSet",
	"extensionElements",
])

// ---------------------------------------------------------------------------
// Streaming model builder
//
// The document is scanned once. Each known element gets a small frame that
// keeps only what the model needs and builds the model object at the end tag,
// in the same field order the former tree walk produced. Unknown children are
// skipped by the scanner without any allocation; only the content of
// <extensionElements> is still materialised as XmlElement trees, because the
// model keeps it verbatim.
// ---------------------------------------------------------------------------

/** One element's handler while the scanner is inside it. */
abstract class Frame {
	/** Whether this frame reads character data; the scanner skips it otherwise. */
	readonly wantsText: boolean = false
	/** A child start tag: the frame for it, or null to skip its whole subtree. */
	child(_local: string, _name: string, _attrs: Attrs): Frame | null {
		return null
	}
	/** Character data directly inside this element. */
	text(_text: string): void {}
	/** The element's end tag. */
	abstract finish(): void
}

// Which text-bearing child a TextFrame reports back to its owner.
const SLOT_INCOMING = 0
const SLOT_OUTGOING = 1
const SLOT_DOCUMENTATION = 2
const SLOT_FLOW_NODE_REF = 3
const SLOT_TEXT = 4
const SLOT_CONDITION_EXPRESSION = 5
const SLOT_COMPLETION_CONDITION = 6
const SLOT_TIME_DURATION = 7
const SLOT_TIME_DATE = 8
const SLOT_TIME_CYCLE = 9
const SLOT_CONDITION = 10
const SLOT_LOOP_CARDINALITY = 13

interface TextOwner {
	setText(slot: number, text: string | undefined, attrs: Attrs): void
}

/** Collects the direct character data of a leaf element; its children are skipped. */
class TextFrame extends Frame {
	override readonly wantsText = true
	private value: string | undefined

	constructor(
		private readonly owner: TextOwner,
		private readonly slot: number,
		private readonly attrs: Attrs,
	) {
		super()
	}

	override text(text: string): void {
		this.value = this.value === undefined ? text : this.value + text
	}

	finish(): void {
		this.owner.setText(this.slot, this.value, this.attrs)
	}
}

/** Materialises the children of an <extensionElements> as XmlElement trees. */
class TreeFrame extends Frame {
	override readonly wantsText = true
	private readonly stack: XmlElement[] = []

	/**
	 * @param target - Where top-level children are appended.
	 * @param owner - Element receiving character data directly inside it, when
	 *   the frame stands for an element rather than a bare child list.
	 */
	constructor(
		private readonly target: XmlElement[],
		private readonly owner?: XmlElement,
	) {
		super()
	}

	override child(_local: string, name: string, attrs: Attrs): Frame {
		const el: XmlElement = { name, attributes: attrs, children: [] }
		const parent = this.stack[this.stack.length - 1]
		if (parent) parent.children.push(el)
		else this.target.push(el)
		this.stack.push(el)
		return this
	}

	override text(text: string): void {
		const el = this.stack[this.stack.length - 1] ?? this.owner
		if (el) el.text = el.text === undefined ? text : el.text + text
	}

	finish(): void {
		dropLayoutWhitespace(this.stack.pop() ?? this.owner)
	}
}

/**
 * Clears an element's text when it is only the indentation between its child
 * elements. Without this, re-serialising a nested extension or captured subtree
 * re-emits that indentation as content and it grows on every round trip.
 */
function dropLayoutWhitespace(element: XmlElement | undefined): void {
	if (element === undefined) return
	if (element.children.length > 0 && element.text !== undefined && element.text.trim() === "") {
		element.text = undefined
	}
}

/** The `documentation` and `extensionElements` every `tBaseElement` may carry. */
interface BaseFields {
	documentation?: string
	extensionElements?: XmlElement[]
}

/**
 * Shared handling of the two children every BPMN base element may have.
 *
 * Subclasses call {@link baseChild} first and fall through to their own cases,
 * and read {@link baseFields} when building their model object. Frames that
 * also collect text children override {@link baseText}.
 */
abstract class BaseElementFrame extends Frame implements TextOwner {
	private documentation: string | undefined
	private documentationSeen = false
	private extensions: XmlElement[] | null = null

	/** A base child's frame, or `undefined` when `local` is not one. */
	protected baseChild(local: string, attrs: Attrs): Frame | null | undefined {
		switch (local) {
			case "documentation":
				if (this.documentationSeen) return null
				this.documentationSeen = true
				return new TextFrame(this, SLOT_DOCUMENTATION, attrs)
			case "extensionElements":
				if (this.extensions !== null) return null
				this.extensions = []
				return new TreeFrame(this.extensions)
			default:
				return undefined
		}
	}

	/** Only defined keys, so model objects keep the shape they had before. */
	protected baseFields(): BaseFields {
		const fields: BaseFields = {}
		if (this.documentation !== undefined) fields.documentation = this.documentation
		if (this.extensions !== null && this.extensions.length > 0) {
			fields.extensionElements = this.extensions
		}
		return fields
	}

	setText(slot: number, text: string | undefined, attrs: Attrs): void {
		if (slot === SLOT_DOCUMENTATION) {
			this.documentation = text
			return
		}
		this.baseText(slot, text, attrs)
	}

	/** Text children other than `documentation`. */
	protected baseText(_slot: number, _text: string | undefined, _attrs: Attrs): void {}
}

/**
 * Captures an unrecognised child subtree verbatim so a round trip does not
 * discard it.
 *
 * Only ever called from a frame's `default:` branch — the path that means "this
 * element is not part of the model". Children a frame recognises but chooses
 * not to store (a second `documentation`, a loop on a type that cannot loop)
 * keep returning `null`, so nothing is captured twice.
 */
function captureUnknown(target: XmlElement[], name: string, attrs: Attrs): Frame {
	const element: XmlElement = { name, attributes: attrs, children: [] }
	target.push(element)
	return new TreeFrame(element.children, element)
}

/**
 * A frame for an element whose only children are `documentation` and
 * `extensionElements`; everything else it needs comes from its attributes.
 */
class BaseOnlyFrame<T> extends BaseElementFrame {
	constructor(
		private readonly attrs: Attrs,
		private readonly build: (attrs: Attrs, base: BaseFields) => T,
		private readonly target: T[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		return this.baseChild(local, attrs) ?? null
	}

	finish(): void {
		this.target.push(this.build(this.attrs, this.baseFields()))
	}
}

// ---------------------------------------------------------------------------
// Attribute-only elements
// ---------------------------------------------------------------------------

function parseAssociation(name: string, attrs: Attrs, base: BaseFields = {}): BpmnAssociation {
	return {
		id: requiredAttr(attrs, "id", name),
		sourceRef: requiredAttr(attrs, "sourceRef", name),
		targetRef: requiredAttr(attrs, "targetRef", name),
		associationDirection: attr(attrs, "associationDirection"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseGroup(name: string, attrs: Attrs, base: BaseFields = {}): BpmnGroup {
	return {
		id: requiredAttr(attrs, "id", name),
		categoryValueRef: attr(attrs, "categoryValueRef"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseParticipant(name: string, attrs: Attrs, base: BaseFields = {}): BpmnParticipant {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		processRef: attr(attrs, "processRef"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseMessageFlow(name: string, attrs: Attrs, base: BaseFields = {}): BpmnMessageFlow {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		sourceRef: requiredAttr(attrs, "sourceRef", name),
		targetRef: requiredAttr(attrs, "targetRef", name),
		messageRef: attr(attrs, "messageRef"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseError(name: string, attrs: Attrs, base: BaseFields = {}): BpmnError {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		errorCode: attr(attrs, "errorCode"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseEscalation(name: string, attrs: Attrs, base: BaseFields = {}): BpmnEscalation {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		escalationCode: attr(attrs, "escalationCode"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseMessage(name: string, attrs: Attrs, base: BaseFields = {}): BpmnMessage {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseSignal(name: string, attrs: Attrs, base: BaseFields = {}): BpmnSignal {
	return {
		id: requiredAttr(attrs, "id", name),
		name: attr(attrs, "name"),
		...base,
		unknownAttributes: unknownAttrs(attrs),
	}
}

function parseBounds(attrs: Attrs): BpmnBounds {
	return {
		x: Number(attr(attrs, "x") ?? "0"),
		y: Number(attr(attrs, "y") ?? "0"),
		width: Number(attr(attrs, "width") ?? "0"),
		height: Number(attr(attrs, "height") ?? "0"),
	}
}

// ---------------------------------------------------------------------------
// Process contents (shared by processes and container activities)
// ---------------------------------------------------------------------------

interface ProcessContents {
	flowElements: BpmnFlowElement[]
	sequenceFlows: BpmnSequenceFlow[]
	textAnnotations: BpmnTextAnnotation[]
	associations: BpmnAssociation[]
	groups: BpmnGroup[]
}

function newContents(): ProcessContents {
	return { flowElements: [], sequenceFlows: [], textAnnotations: [], associations: [], groups: [] }
}

/**
 * A frame for a child of a flow-element container.
 *
 * Returns `null` when the child is recognised but needs no frame, and
 * `undefined` when it is not part of the model — the caller keeps the latter
 * verbatim, so the two cases must stay distinct.
 */
function contentsChild(
	contents: ProcessContents,
	local: string,
	name: string,
	attrs: Attrs,
): Frame | null | undefined {
	if (FLOW_ELEMENT_TYPES.has(local)) {
		return new FlowNodeFrame(local as BpmnElementType, name, attrs, contents)
	}
	switch (local) {
		case "sequenceFlow":
			return new SequenceFlowFrame(name, attrs, contents)
		case "textAnnotation":
			return new TextAnnotationFrame(name, attrs, contents.textAnnotations)
		case "association":
			return new BaseOnlyFrame(
				attrs,
				(a, base) => parseAssociation(name, a, base),
				contents.associations,
			)
		case "group":
			return new BaseOnlyFrame(attrs, (a, base) => parseGroup(name, a, base), contents.groups)
		default:
			return undefined
	}
}

// ---------------------------------------------------------------------------
// Flow elements
// ---------------------------------------------------------------------------

const FLOW_ELEMENT_TYPES = new Set<string>([
	"startEvent",
	"endEvent",
	"intermediateCatchEvent",
	"intermediateThrowEvent",
	"boundaryEvent",
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
	"eventSubProcess",
	"transaction",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
	"dataObject",
	"dataObjectReference",
	"dataStoreReference",
])

const EVENT_TYPES = new Set<string>([
	"startEvent",
	"endEvent",
	"intermediateCatchEvent",
	"intermediateThrowEvent",
	"boundaryEvent",
])

/** Types whose <multiInstanceLoopCharacteristics> child is read. */
const LOOP_TYPES = new Set<string>([
	"task",
	"serviceTask",
	"scriptTask",
	"userTask",
	"businessRuleTask",
	"manualTask",
	"callActivity",
	"sendTask",
	"receiveTask",
	"adHocSubProcess",
	"subProcess",
	"transaction",
])

const CONTAINER_TYPES = new Set<string>([
	"adHocSubProcess",
	"subProcess",
	"eventSubProcess",
	"transaction",
])

const EVENT_DEFINITION_TYPES = new Set<string>([
	"timerEventDefinition",
	"errorEventDefinition",
	"escalationEventDefinition",
	"messageEventDefinition",
	"signalEventDefinition",
	"conditionalEventDefinition",
	"linkEventDefinition",
	"cancelEventDefinition",
	"terminateEventDefinition",
	"compensateEventDefinition",
])

class FlowNodeFrame extends Frame implements TextOwner {
	private readonly id: string
	private readonly incoming: string[] = []
	private readonly outgoing: string[] = []
	private documentation: string | undefined
	private documentationSeen = false
	private extensionElements: XmlElement[] | null = null
	private readonly eventDefinitions: BpmnEventDefinition[] | null
	private loopCharacteristics: BpmnMultiInstanceLoopCharacteristics | undefined
	private loopSeen = false
	private completionCondition: BpmnConditionExpression | undefined
	private completionSeen = false
	private readonly unknownChildren: XmlElement[] = []
	private readonly properties: BpmnProperty[] = []
	private readonly dataInputAssociations: BpmnDataAssociation[] = []
	private readonly dataOutputAssociations: BpmnDataAssociation[] = []
	private readonly contents: ProcessContents | null

	constructor(
		private readonly type: BpmnElementType,
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: ProcessContents,
	) {
		super()
		this.id = requiredAttr(attrs, "id", name)
		this.eventDefinitions = EVENT_TYPES.has(type) ? [] : null
		this.contents = CONTAINER_TYPES.has(type) ? newContents() : null
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "incoming":
				return new TextFrame(this, SLOT_INCOMING, attrs)
			case "outgoing":
				return new TextFrame(this, SLOT_OUTGOING, attrs)
			case "documentation":
				if (this.documentationSeen) return null
				this.documentationSeen = true
				return new TextFrame(this, SLOT_DOCUMENTATION, attrs)
			case "extensionElements":
				if (this.extensionElements !== null) return null
				this.extensionElements = []
				return new TreeFrame(this.extensionElements)
			case "multiInstanceLoopCharacteristics":
				if (!LOOP_TYPES.has(this.type) || this.loopSeen) return null
				this.loopSeen = true
				return new LoopFrame(attrs, this)
			case "completionCondition":
				if (this.type !== "adHocSubProcess" || this.completionSeen) return null
				this.completionSeen = true
				return new TextFrame(this, SLOT_COMPLETION_CONDITION, attrs)
			case "property":
				this.properties.push({
					id: attr(attrs, "id"),
					name: attr(attrs, "name"),
					itemSubjectRef: attr(attrs, "itemSubjectRef"),
					unknownAttributes: unknownAttrs(attrs),
				})
				return null
			case "dataInputAssociation":
				return new DataAssociationFrame(attrs, this.dataInputAssociations)
			case "dataOutputAssociation":
				return new DataAssociationFrame(attrs, this.dataOutputAssociations)
			default:
				break
		}
		if (this.eventDefinitions !== null && EVENT_DEFINITION_TYPES.has(local)) {
			return eventDefinitionFrame(local, attrs, this.eventDefinitions)
		}
		if (this.contents !== null) {
			const child = contentsChild(this.contents, local, name, attrs)
			if (child !== undefined) return child
		}
		return captureUnknown(this.unknownChildren, name, attrs)
	}

	setText(slot: number, text: string | undefined, attrs: Attrs): void {
		switch (slot) {
			case SLOT_INCOMING: {
				const ref = text?.trim()
				if (ref) this.incoming.push(ref)
				break
			}
			case SLOT_OUTGOING: {
				const ref = text?.trim()
				if (ref) this.outgoing.push(ref)
				break
			}
			case SLOT_DOCUMENTATION:
				this.documentation = text
				break
			case SLOT_COMPLETION_CONDITION:
				this.completionCondition = { text: text ?? "", attributes: { ...attrs } }
				break
			default:
				break
		}
	}

	setLoopCharacteristics(loop: BpmnMultiInstanceLoopCharacteristics): void {
		this.loopCharacteristics = loop
	}

	finish(): void {
		const attrs = this.attrs
		const base = {
			id: this.id,
			...(this.properties.length > 0 ? { properties: this.properties } : {}),
			...(this.dataInputAssociations.length > 0
				? { dataInputAssociations: this.dataInputAssociations }
				: {}),
			...(this.dataOutputAssociations.length > 0
				? { dataOutputAssociations: this.dataOutputAssociations }
				: {}),
			...(this.unknownChildren.length > 0 ? { unknownChildren: this.unknownChildren } : {}),
			name: attr(attrs, "name"),
			incoming: this.incoming,
			outgoing: this.outgoing,
			documentation: this.documentation,
			extensionElements: this.extensionElements ?? [],
			unknownAttributes: unknownAttrs(attrs),
		}
		const eventDefinitions = this.eventDefinitions ?? []
		const contents = this.contents ?? newContents()
		const type = this.type
		let el: BpmnFlowElement

		switch (type) {
			case "startEvent": {
				const isInterruptingAttr = attr(attrs, "isInterrupting")
				el = {
					...base,
					type: "startEvent",
					eventDefinitions,
					...(isInterruptingAttr === "false" ? { isInterrupting: false } : {}),
				}
				break
			}

			case "endEvent":
			case "intermediateCatchEvent":
			case "intermediateThrowEvent":
				el = { ...base, type, eventDefinitions }
				break

			case "boundaryEvent":
				el = {
					...base,
					type: "boundaryEvent",
					attachedToRef: requiredAttr(attrs, "attachedToRef", this.name),
					cancelActivity:
						attr(attrs, "cancelActivity") !== undefined
							? attr(attrs, "cancelActivity") === "true"
							: undefined,
					eventDefinitions,
				} satisfies BpmnBoundaryEvent
				break

			case "task":
			case "serviceTask":
			case "scriptTask":
			case "userTask":
			case "businessRuleTask":
			case "manualTask":
			case "callActivity":
				el = {
					...base,
					type,
					loopCharacteristics: this.loopCharacteristics,
					isForCompensation: attr(attrs, "isForCompensation") === "true" ? true : undefined,
				}
				break

			case "sendTask":
			case "receiveTask":
				el = {
					...base,
					type,
					messageRef: attr(attrs, "messageRef"),
					loopCharacteristics: this.loopCharacteristics,
					isForCompensation: attr(attrs, "isForCompensation") === "true" ? true : undefined,
				}
				break

			case "adHocSubProcess":
				el = {
					...base,
					type: "adHocSubProcess",
					loopCharacteristics: this.loopCharacteristics,
					completionCondition: this.completionCondition,
					cancelRemainingInstances:
						attr(attrs, "cancelRemainingInstances") !== undefined
							? attr(attrs, "cancelRemainingInstances") === "true"
							: undefined,
					...contents,
				}
				break

			case "subProcess":
				el = {
					...base,
					type: "subProcess",
					triggeredByEvent:
						attr(attrs, "triggeredByEvent") !== undefined
							? attr(attrs, "triggeredByEvent") === "true"
							: undefined,
					loopCharacteristics: this.loopCharacteristics,
					...contents,
				}
				break

			case "eventSubProcess":
				el = { ...base, type: "eventSubProcess", ...contents }
				break

			case "transaction":
				el = {
					...base,
					type: "transaction",
					loopCharacteristics: this.loopCharacteristics,
					...contents,
				}
				break

			case "exclusiveGateway":
				el = { ...base, type: "exclusiveGateway", default: attr(attrs, "default") }
				break

			case "parallelGateway":
				el = { ...base, type: "parallelGateway" }
				break

			case "inclusiveGateway":
				el = { ...base, type: "inclusiveGateway", default: attr(attrs, "default") }
				break

			case "eventBasedGateway":
				el = { ...base, type: "eventBasedGateway" }
				break

			case "complexGateway":
				el = { ...base, type: "complexGateway", default: attr(attrs, "default") }
				break

			case "dataObject":
				el = {
					...base,
					type: "dataObject",
					...(attr(attrs, "isCollection") === "true" ? { isCollection: true } : {}),
				}
				break

			case "dataObjectReference":
				el = {
					...base,
					type: "dataObjectReference",
					dataObjectRef: attr(attrs, "dataObjectRef"),
					...(attr(attrs, "isCollection") === "true" ? { isCollection: true } : {}),
				}
				break

			case "dataStoreReference":
				el = {
					...base,
					type: "dataStoreReference",
					dataStoreRef: attr(attrs, "dataStoreRef"),
				}
				break

			default:
				return
		}
		this.target.flowElements.push(el)
	}
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

function eventDefinitionFrame(
	local: string,
	attrs: Attrs,
	target: BpmnEventDefinition[],
): Frame | null {
	switch (local) {
		case "timerEventDefinition":
			return new TimerDefinitionFrame(attrs, target)
		case "conditionalEventDefinition":
			return new ConditionalDefinitionFrame(attrs, target)
		case "errorEventDefinition":
			target.push({ type: "error", id: attr(attrs, "id"), errorRef: attr(attrs, "errorRef") })
			return null
		case "escalationEventDefinition":
			target.push({
				type: "escalation",
				id: attr(attrs, "id"),
				escalationRef: attr(attrs, "escalationRef"),
			})
			return null
		case "messageEventDefinition":
			target.push({ type: "message", id: attr(attrs, "id"), messageRef: attr(attrs, "messageRef") })
			return null
		case "signalEventDefinition":
			target.push({ type: "signal", id: attr(attrs, "id"), signalRef: attr(attrs, "signalRef") })
			return null
		case "linkEventDefinition":
			target.push({ type: "link", id: attr(attrs, "id"), name: attr(attrs, "name") })
			return null
		case "cancelEventDefinition":
			target.push({ type: "cancel", id: attr(attrs, "id") })
			return null
		case "terminateEventDefinition":
			target.push({ type: "terminate", id: attr(attrs, "id") })
			return null
		case "compensateEventDefinition":
			target.push({
				type: "compensate",
				id: attr(attrs, "id"),
				activityRef: attr(attrs, "activityRef"),
			})
			return null
		default:
			return null
	}
}

interface TimerPart {
	text: string | undefined
	attrs: Attrs
}

class TimerDefinitionFrame extends Frame implements TextOwner {
	private duration: TimerPart | undefined
	private date: TimerPart | undefined
	private cycle: TimerPart | undefined

	constructor(
		private readonly attrs: Attrs,
		private readonly target: BpmnEventDefinition[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "timeDuration":
				if (this.duration) return null
				this.duration = { text: undefined, attrs }
				return new TextFrame(this, SLOT_TIME_DURATION, attrs)
			case "timeDate":
				if (this.date) return null
				this.date = { text: undefined, attrs }
				return new TextFrame(this, SLOT_TIME_DATE, attrs)
			case "timeCycle":
				if (this.cycle) return null
				this.cycle = { text: undefined, attrs }
				return new TextFrame(this, SLOT_TIME_CYCLE, attrs)
			default:
				return null
		}
	}

	setText(slot: number, text: string | undefined): void {
		if (slot === SLOT_TIME_DURATION && this.duration) this.duration.text = text
		else if (slot === SLOT_TIME_DATE && this.date) this.date.text = text
		else if (slot === SLOT_TIME_CYCLE && this.cycle) this.cycle.text = text
	}

	finish(): void {
		this.target.push({
			type: "timer",
			id: attr(this.attrs, "id"),
			timeDuration: this.duration?.text?.trim(),
			timeDurationAttributes: partAttributes(this.duration),
			timeDate: this.date?.text?.trim(),
			timeDateAttributes: partAttributes(this.date),
			timeCycle: this.cycle?.text?.trim(),
			timeCycleAttributes: partAttributes(this.cycle),
		})
	}
}

function partAttributes(part: TimerPart | undefined): Attrs | undefined {
	if (!part) return undefined
	return Object.keys(part.attrs).length > 0 ? { ...part.attrs } : undefined
}

class ConditionalDefinitionFrame extends Frame implements TextOwner {
	private conditionSeen = false
	private condition: string | undefined

	constructor(
		private readonly attrs: Attrs,
		private readonly target: BpmnEventDefinition[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		if (local !== "condition" || this.conditionSeen) return null
		this.conditionSeen = true
		return new TextFrame(this, SLOT_CONDITION, attrs)
	}

	setText(_slot: number, text: string | undefined): void {
		this.condition = text
	}

	finish(): void {
		this.target.push({
			type: "conditional",
			id: attr(this.attrs, "id"),
			condition: this.condition?.trim(),
		})
	}
}

// ---------------------------------------------------------------------------
// Multi-instance loop
// ---------------------------------------------------------------------------

class LoopFrame extends Frame implements TextOwner {
	private extensionElements: XmlElement[] | null = null
	private loopCardinality: BpmnConditionExpression | undefined
	private cardinalitySeen = false
	private completionCondition: BpmnConditionExpression | undefined
	private completionSeen = false

	constructor(
		private readonly attrs: Attrs,
		private readonly owner: FlowNodeFrame,
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "extensionElements":
				if (this.extensionElements !== null) return null
				this.extensionElements = []
				return new TreeFrame(this.extensionElements)
			case "loopCardinality":
				if (this.cardinalitySeen) return null
				this.cardinalitySeen = true
				return new TextFrame(this, SLOT_LOOP_CARDINALITY, attrs)
			case "completionCondition":
				if (this.completionSeen) return null
				this.completionSeen = true
				return new TextFrame(this, SLOT_COMPLETION_CONDITION, attrs)
			default:
				return null
		}
	}

	setText(slot: number, text: string | undefined, attrs: Attrs): void {
		const expression = { text: text ?? "", attributes: { ...attrs } }
		if (slot === SLOT_LOOP_CARDINALITY) this.loopCardinality = expression
		else if (slot === SLOT_COMPLETION_CONDITION) this.completionCondition = expression
	}

	finish(): void {
		this.owner.setLoopCharacteristics({
			isSequential: this.attrs.isSequential === "true" ? true : undefined,
			loopCardinality: this.loopCardinality,
			completionCondition: this.completionCondition,
			extensionElements: this.extensionElements ?? [],
		})
	}
}

// ---------------------------------------------------------------------------
// Sequence flows and annotations
// ---------------------------------------------------------------------------

class SequenceFlowFrame extends Frame implements TextOwner {
	private readonly id: string
	private readonly sourceRef: string
	private readonly targetRef: string
	private conditionExpression: BpmnConditionExpression | undefined
	private conditionSeen = false
	private extensionElements: XmlElement[] | null = null

	constructor(
		name: string,
		private readonly attrs: Attrs,
		private readonly target: ProcessContents,
	) {
		super()
		this.id = requiredAttr(attrs, "id", name)
		this.sourceRef = requiredAttr(attrs, "sourceRef", name)
		this.targetRef = requiredAttr(attrs, "targetRef", name)
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "conditionExpression":
				if (this.conditionSeen) return null
				this.conditionSeen = true
				return new TextFrame(this, SLOT_CONDITION_EXPRESSION, attrs)
			case "extensionElements":
				if (this.extensionElements !== null) return null
				this.extensionElements = []
				return new TreeFrame(this.extensionElements)
			default:
				return null
		}
	}

	setText(_slot: number, text: string | undefined, attrs: Attrs): void {
		this.conditionExpression = { text: text ?? "", attributes: { ...attrs } }
	}

	finish(): void {
		this.target.sequenceFlows.push({
			id: this.id,
			name: attr(this.attrs, "name"),
			sourceRef: this.sourceRef,
			targetRef: this.targetRef,
			conditionExpression: this.conditionExpression,
			extensionElements: this.extensionElements ?? [],
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

class TextAnnotationFrame extends BaseElementFrame {
	private textSeen = false
	private value: string | undefined

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnTextAnnotation[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		const base = this.baseChild(local, attrs)
		if (base !== undefined) return base
		if (local !== "text" || this.textSeen) return null
		this.textSeen = true
		return new TextFrame(this, SLOT_TEXT, attrs)
	}

	protected override baseText(_slot: number, text: string | undefined): void {
		this.value = text
	}

	finish(): void {
		this.target.push({
			id: requiredAttr(this.attrs, "id", this.name),
			text: this.value,
			...this.baseFields(),
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** A root `bpmn:category`; its values supply the labels groups point at. */
class CategoryFrame extends BaseElementFrame {
	private readonly categoryValues: BpmnCategoryValue[] = []

	constructor(
		private readonly attrs: Attrs,
		private readonly target: BpmnCategory[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		const base = this.baseChild(local, attrs)
		if (base !== undefined) return base
		if (local === "categoryValue") {
			const id = attr(attrs, "id")
			if (id !== undefined) {
				this.categoryValues.push({
					id,
					value: attr(attrs, "value"),
					unknownAttributes: unknownAttrs(attrs),
				})
			}
		}
		return null
	}

	finish(): void {
		this.target.push({
			id: attr(this.attrs, "id"),
			name: attr(this.attrs, "name"),
			categoryValues: this.categoryValues,
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

// ---------------------------------------------------------------------------
// Data associations
// ---------------------------------------------------------------------------

const SLOT_SOURCE_REF = 11
const SLOT_TARGET_REF = 12

/** A `dataInputAssociation` or `dataOutputAssociation` and its ref children. */
class DataAssociationFrame extends BaseElementFrame {
	private readonly sourceRefs: string[] = []
	private targetRef: string | undefined

	constructor(
		private readonly attrs: Attrs,
		private readonly target: BpmnDataAssociation[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		const base = this.baseChild(local, attrs)
		if (base !== undefined) return base
		if (local === "sourceRef") return new TextFrame(this, SLOT_SOURCE_REF, attrs)
		if (local === "targetRef") return new TextFrame(this, SLOT_TARGET_REF, attrs)
		return null
	}

	protected override baseText(slot: number, text: string | undefined): void {
		const ref = text?.trim()
		if (!ref) return
		if (slot === SLOT_SOURCE_REF) this.sourceRefs.push(ref)
		else if (slot === SLOT_TARGET_REF) this.targetRef = ref
	}

	finish(): void {
		this.target.push({
			id: attr(this.attrs, "id"),
			sourceRefs: this.sourceRefs,
			targetRef: this.targetRef,
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

interface LaneSetOwner {
	setLaneSet(laneSet: BpmnLaneSet): void
}

class LaneSetFrame extends Frame {
	private readonly lanes: BpmnLane[] = []

	constructor(
		private readonly attrs: Attrs,
		private readonly owner: LaneSetOwner,
	) {
		super()
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		return local === "lane" ? new LaneFrame(name, attrs, this.lanes) : null
	}

	finish(): void {
		this.owner.setLaneSet({
			id: attr(this.attrs, "id"),
			name: attr(this.attrs, "name"),
			lanes: this.lanes,
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

class LaneFrame extends BaseElementFrame implements LaneSetOwner {
	private readonly flowNodeRefs: string[] = []
	private childLaneSet: BpmnLaneSet | undefined
	private childLaneSetSeen = false

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnLane[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		const base = this.baseChild(local, attrs)
		if (base !== undefined) return base
		switch (local) {
			case "flowNodeRef":
				return new TextFrame(this, SLOT_FLOW_NODE_REF, attrs)
			case "childLaneSet":
				if (this.childLaneSetSeen) return null
				this.childLaneSetSeen = true
				return new LaneSetFrame(attrs, this)
			default:
				return null
		}
	}

	protected override baseText(_slot: number, text: string | undefined): void {
		const ref = text?.trim()
		if (ref) this.flowNodeRefs.push(ref)
	}

	setLaneSet(laneSet: BpmnLaneSet): void {
		this.childLaneSet = laneSet
	}

	finish(): void {
		this.target.push({
			id: requiredAttr(this.attrs, "id", this.name),
			name: attr(this.attrs, "name"),
			flowNodeRefs: this.flowNodeRefs,
			childLaneSet: this.childLaneSet,
			...this.baseFields(),
			unknownAttributes: unknownAttrs(this.attrs),
		})
	}
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

class ProcessFrame extends Frame implements LaneSetOwner, TextOwner {
	private readonly id: string
	private readonly unknownChildren: XmlElement[] = []
	private documentation: string | undefined
	private documentationSeen = false
	private extensionElements: XmlElement[] | null = null
	private laneSet: BpmnLaneSet | undefined
	private laneSetSeen = false
	private readonly contents = newContents()

	constructor(
		name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnProcess[],
	) {
		super()
		this.id = requiredAttr(attrs, "id", name)
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "documentation":
				if (this.documentationSeen) return null
				this.documentationSeen = true
				return new TextFrame(this, SLOT_DOCUMENTATION, attrs)
			case "extensionElements":
				if (this.extensionElements !== null) return null
				this.extensionElements = []
				return new TreeFrame(this.extensionElements)
			case "laneSet":
				if (this.laneSetSeen) return null
				this.laneSetSeen = true
				return new LaneSetFrame(attrs, this)
			default: {
				const child = contentsChild(this.contents, local, name, attrs)
				return child === undefined ? captureUnknown(this.unknownChildren, name, attrs) : child
			}
		}
	}

	setText(slot: number, text: string | undefined): void {
		if (slot === SLOT_DOCUMENTATION) this.documentation = text
	}

	setLaneSet(laneSet: BpmnLaneSet): void {
		this.laneSet = laneSet
	}

	finish(): void {
		const attrs = this.attrs
		this.target.push({
			id: this.id,
			name: attr(attrs, "name"),
			isExecutable: attr(attrs, "isExecutable") === "true" ? true : undefined,
			...(this.documentation !== undefined ? { documentation: this.documentation } : {}),
			extensionElements: this.extensionElements ?? [],
			unknownAttributes: unknownAttrs(attrs),
			laneSet: this.laneSet,
			...(this.unknownChildren.length > 0 ? { unknownChildren: this.unknownChildren } : {}),
			...this.contents,
		})
	}
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

class CollaborationFrame extends Frame {
	private readonly id: string
	private readonly participants: BpmnParticipant[] = []
	private readonly messageFlows: BpmnMessageFlow[] = []
	private readonly textAnnotations: BpmnTextAnnotation[] = []
	private readonly associations: BpmnAssociation[] = []
	private readonly groups: BpmnGroup[] = []
	private readonly unknownChildren: XmlElement[] = []
	private extensionElements: XmlElement[] | null = null

	constructor(
		name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnCollaboration[],
	) {
		super()
		this.id = requiredAttr(attrs, "id", name)
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "participant":
				return new BaseOnlyFrame(
					attrs,
					(a, base) => parseParticipant(name, a, base),
					this.participants,
				)
			case "messageFlow":
				return new BaseOnlyFrame(
					attrs,
					(a, base) => parseMessageFlow(name, a, base),
					this.messageFlows,
				)
			case "textAnnotation":
				return new TextAnnotationFrame(name, attrs, this.textAnnotations)
			case "association":
				return new BaseOnlyFrame(
					attrs,
					(a, base) => parseAssociation(name, a, base),
					this.associations,
				)
			case "group":
				return new BaseOnlyFrame(attrs, (a, base) => parseGroup(name, a, base), this.groups)
			case "extensionElements":
				if (this.extensionElements !== null) return null
				this.extensionElements = []
				return new TreeFrame(this.extensionElements)
			default:
				return captureUnknown(this.unknownChildren, name, attrs)
		}
	}

	finish(): void {
		this.target.push({
			id: this.id,
			participants: this.participants,
			messageFlows: this.messageFlows,
			textAnnotations: this.textAnnotations,
			associations: this.associations,
			groups: this.groups,
			extensionElements: this.extensionElements ?? [],
			unknownAttributes: unknownAttrs(this.attrs),
			...(this.unknownChildren.length > 0 ? { unknownChildren: this.unknownChildren } : {}),
		})
	}
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

interface LabelOwner {
	setLabel(label: BpmnDiLabel): void
}

class LabelFrame extends Frame {
	private bounds: BpmnBounds | undefined
	private boundsSeen = false

	constructor(private readonly owner: LabelOwner) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		if (local === "Bounds" && !this.boundsSeen) {
			this.boundsSeen = true
			this.bounds = parseBounds(attrs)
		}
		return null
	}

	finish(): void {
		this.owner.setLabel({ bounds: this.bounds })
	}
}

class ShapeFrame extends Frame implements LabelOwner {
	private bounds: BpmnBounds | undefined
	private label: BpmnDiLabel | undefined
	private labelSeen = false

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnDiShape[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "Bounds":
				if (this.bounds === undefined) this.bounds = parseBounds(attrs)
				return null
			case "BPMNLabel":
				if (this.labelSeen) return null
				this.labelSeen = true
				return new LabelFrame(this)
			default:
				return null
		}
	}

	setLabel(label: BpmnDiLabel): void {
		this.label = label
	}

	finish(): void {
		const attrs = this.attrs
		if (!this.bounds) throw new Error(`Missing <dc:Bounds> in shape "${attr(attrs, "id")}"`)
		this.target.push({
			id: requiredAttr(attrs, "id", this.name),
			bpmnElement: requiredAttr(attrs, "bpmnElement", this.name),
			isMarkerVisible:
				attr(attrs, "isMarkerVisible") !== undefined
					? attr(attrs, "isMarkerVisible") === "true"
					: undefined,
			isExpanded:
				attr(attrs, "isExpanded") !== undefined ? attr(attrs, "isExpanded") === "true" : undefined,
			isHorizontal:
				attr(attrs, "isHorizontal") !== undefined
					? attr(attrs, "isHorizontal") === "true"
					: undefined,
			bounds: this.bounds,
			label: this.label,
			unknownAttributes: unknownAttrs(attrs),
		})
	}
}

class EdgeFrame extends Frame implements LabelOwner {
	private readonly waypoints: BpmnWaypoint[] = []
	private label: BpmnDiLabel | undefined
	private labelSeen = false

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnDiEdge[],
	) {
		super()
	}

	override child(local: string, _name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "waypoint":
				this.waypoints.push({
					x: Number(attr(attrs, "x") ?? "0"),
					y: Number(attr(attrs, "y") ?? "0"),
				})
				return null
			case "BPMNLabel":
				if (this.labelSeen) return null
				this.labelSeen = true
				return new LabelFrame(this)
			default:
				return null
		}
	}

	setLabel(label: BpmnDiLabel): void {
		this.label = label
	}

	finish(): void {
		const attrs = this.attrs
		this.target.push({
			id: requiredAttr(attrs, "id", this.name),
			bpmnElement: requiredAttr(attrs, "bpmnElement", this.name),
			waypoints: this.waypoints,
			label: this.label,
			unknownAttributes: unknownAttrs(attrs),
		})
	}
}

class PlaneFrame extends Frame {
	readonly shapes: BpmnDiShape[] = []
	readonly edges: BpmnDiEdge[] = []

	constructor(
		readonly name: string,
		readonly attrs: Attrs,
		private readonly owner: DiagramFrame,
	) {
		super()
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		if (local === "BPMNShape") return new ShapeFrame(name, attrs, this.shapes)
		if (local === "BPMNEdge") return new EdgeFrame(name, attrs, this.edges)
		return null
	}

	finish(): void {
		this.owner.setPlane(this)
	}
}

class DiagramFrame extends Frame {
	private plane: PlaneFrame | undefined
	private planeSeen = false

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly target: BpmnDiagram[],
	) {
		super()
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		if (local !== "BPMNPlane" || this.planeSeen) return null
		this.planeSeen = true
		return new PlaneFrame(name, attrs, this)
	}

	setPlane(plane: PlaneFrame): void {
		this.plane = plane
	}

	finish(): void {
		const plane = this.plane
		if (!plane) throw new Error("Missing <bpmndi:BPMNPlane> in diagram")
		this.target.push({
			id: requiredAttr(this.attrs, "id", this.name),
			plane: {
				id: requiredAttr(plane.attrs, "id", plane.name),
				bpmnElement: requiredAttr(plane.attrs, "bpmnElement", plane.name),
				shapes: plane.shapes,
				edges: plane.edges,
			},
		})
	}
}

// ---------------------------------------------------------------------------
// Definitions (document root)
// ---------------------------------------------------------------------------

class DefinitionsFrame extends Frame implements TextOwner {
	private readonly categories: BpmnCategory[] = []
	private documentation: string | undefined
	private documentationSeen = false
	private readonly errors: BpmnError[] = []
	private readonly escalations: BpmnEscalation[] = []
	private readonly messages: BpmnMessage[] = []
	private readonly signals: BpmnSignal[] = []
	private readonly collaborations: BpmnCollaboration[] = []
	private readonly processes: BpmnProcess[] = []
	private readonly diagrams: BpmnDiagram[] = []
	private readonly unknownChildren: XmlElement[] = []

	constructor(
		private readonly name: string,
		private readonly attrs: Attrs,
		private readonly sink: BpmnSink,
	) {
		super()
	}

	override child(local: string, name: string, attrs: Attrs): Frame | null {
		switch (local) {
			case "documentation":
				if (this.documentationSeen) return null
				this.documentationSeen = true
				return new TextFrame(this, SLOT_DOCUMENTATION, attrs)
			case "error":
				return new BaseOnlyFrame(attrs, (a, base) => parseError(name, a, base), this.errors)
			case "escalation":
				return new BaseOnlyFrame(
					attrs,
					(a, base) => parseEscalation(name, a, base),
					this.escalations,
				)
			case "message":
				return new BaseOnlyFrame(attrs, (a, base) => parseMessage(name, a, base), this.messages)
			case "signal":
				return new BaseOnlyFrame(attrs, (a, base) => parseSignal(name, a, base), this.signals)
			case "category":
				return new CategoryFrame(attrs, this.categories)
			case "collaboration":
				return new CollaborationFrame(name, attrs, this.collaborations)
			case "process":
				return new ProcessFrame(name, attrs, this.processes)
			case "BPMNDiagram":
				return new DiagramFrame(name, attrs, this.diagrams)
			default:
				return captureUnknown(this.unknownChildren, name, attrs)
		}
	}

	setText(slot: number, text: string | undefined): void {
		if (slot === SLOT_DOCUMENTATION) this.documentation = text
	}

	finish(): void {
		const attrs = this.attrs
		const namespaces: Record<string, string> = {}
		const unknownAttributes: Record<string, string> = {}

		for (const key in attrs) {
			const value = attrs[key] as string
			if (key.startsWith("xmlns:")) {
				namespaces[key.slice(6)] = value
			} else if (key === "xmlns") {
				namespaces[""] = value
			} else if (KNOWN_ATTRS.has(key)) {
			} else {
				unknownAttributes[key] = value
			}
		}

		this.sink.result = {
			id: requiredAttr(attrs, "id", this.name),
			targetNamespace: requiredAttr(attrs, "targetNamespace", this.name),
			exporter: attr(attrs, "exporter"),
			exporterVersion: attr(attrs, "exporterVersion"),
			namespaces,
			unknownAttributes,
			...(this.documentation !== undefined ? { documentation: this.documentation } : {}),
			...(this.categories.length > 0 ? { categories: this.categories } : {}),
			errors: this.errors,
			escalations: this.escalations,
			messages: this.messages,
			signals: this.signals,
			collaborations: this.collaborations,
			processes: this.processes,
			diagrams: this.diagrams,
			...(this.unknownChildren.length > 0 ? { unknownChildren: this.unknownChildren } : {}),
		}
	}
}

/** Routes scanner events to the frame stack. */
class BpmnSink implements XmlSink {
	result: BpmnDefinitions | undefined
	/** Set when the root element is not <definitions>; reported once scanning is done. */
	rootName: string | undefined
	private readonly stack: Frame[] = []

	start(name: string, local: string, attrs: Attrs): Visit {
		const top = this.stack[this.stack.length - 1]
		let next: Frame | null
		if (top === undefined) {
			if (local !== "definitions") {
				this.rootName = name
				return Visit.Skip
			}
			next = new DefinitionsFrame(name, attrs, this)
		} else {
			next = top.child(local, name, attrs)
		}
		if (next === null) return Visit.Skip
		this.stack.push(next)
		return next.wantsText ? Visit.All : Visit.ElementsOnly
	}

	text(text: string): void {
		;(this.stack[this.stack.length - 1] as Frame).text(text)
	}

	end(): void {
		;(this.stack.pop() as Frame).finish()
	}
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parse a BPMN XML string into a typed BpmnDefinitions model. */
export function parseBpmn(xml: string): BpmnDefinitions {
	const sink = new BpmnSink()
	if (!scanXml(xml, sink)) throw new Error("Failed to parse XML: no root element found")
	if (sink.rootName !== undefined) {
		throw new Error(`Expected <definitions> root element, got <${sink.rootName}>`)
	}
	return sink.result as BpmnDefinitions
}
