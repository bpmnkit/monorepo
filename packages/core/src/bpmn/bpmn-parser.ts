import type { XmlElement } from "../types/xml-element.js";
import { parseXml } from "../xml/xml-parser.js";
import type {
	BpmnAssociation,
	BpmnBoundaryEvent,
	BpmnCollaboration,
	BpmnConditionExpression,
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
	BpmnLane,
	BpmnLaneSet,
	BpmnMessage,
	BpmnMessageFlow,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnParticipant,
	BpmnProcess,
	BpmnSequenceFlow,
	BpmnTextAnnotation,
} from "./bpmn-model.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function localName(name: string): string {
	const idx = name.indexOf(":");
	return idx >= 0 ? name.slice(idx + 1) : name;
}

function findChildren(element: XmlElement, tagLocalName: string): XmlElement[] {
	return element.children.filter((c) => localName(c.name) === tagLocalName);
}

function findChild(element: XmlElement, tagLocalName: string): XmlElement | undefined {
	return element.children.find((c) => localName(c.name) === tagLocalName);
}

function attr(element: XmlElement, name: string): string | undefined {
	if (element.attributes[name] !== undefined) return element.attributes[name];
	for (const [key, value] of Object.entries(element.attributes)) {
		if (localName(key) === name) return value;
	}
	return undefined;
}

function requiredAttr(element: XmlElement, name: string): string {
	const value = attr(element, name);
	if (value === undefined) {
		throw new Error(`Missing required attribute "${name}" on <${element.name}>`);
	}
	return value;
}

/** Collect text from child <bpmn:incoming> / <bpmn:outgoing> elements. */
function collectFlowRefs(element: XmlElement, tag: string): string[] {
	return findChildren(element, tag)
		.map((c) => c.text?.trim())
		.filter((t): t is string => !!t);
}

/** Known attribute names on flow nodes — everything else goes to unknownAttributes. */
const KNOWN_ATTRS = new Set([
	"id",
	"name",
	"default",
	"attachedToRef",
	"cancelActivity",
	"sourceRef",
	"targetRef",
	"associationDirection",
	"isExecutable",
	"isMarkerVisible",
	"isExpanded",
	"bpmnElement",
	"errorRef",
	"escalationRef",
	"errorCode",
	"escalationCode",
	"targetNamespace",
	"exporter",
	"exporterVersion",
	"processRef",
]);

/** Extract unknown (namespace-qualified) attributes from an element. */
function unknownAttrs(element: XmlElement): Record<string, string> {
	const result: Record<string, string> = {};
	for (const [key, value] of Object.entries(element.attributes)) {
		if (key.startsWith("xmlns:") || key === "xmlns") continue;
		if (KNOWN_ATTRS.has(key)) continue;
		if (KNOWN_ATTRS.has(localName(key))) continue;
		result[key] = value;
	}
	return result;
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
]);

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
]);

// ---------------------------------------------------------------------------
// Extension elements
// ---------------------------------------------------------------------------

function parseExtensionElements(element: XmlElement): XmlElement[] {
	const ext = findChild(element, "extensionElements");
	return ext ? ext.children : [];
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

function parseEventDefinitions(element: XmlElement): BpmnEventDefinition[] {
	const defs: BpmnEventDefinition[] = [];

	for (const child of element.children) {
		const ln = localName(child.name);
		if (ln === "timerEventDefinition") {
			const durationEl = findChild(child, "timeDuration");
			const dateEl = findChild(child, "timeDate");
			const cycleEl = findChild(child, "timeCycle");
			defs.push({
				type: "timer",
				id: attr(child, "id"),
				timeDuration: durationEl?.text?.trim(),
				timeDurationAttributes: durationEl
					? Object.keys(durationEl.attributes).length > 0
						? { ...durationEl.attributes }
						: undefined
					: undefined,
				timeDate: dateEl?.text?.trim(),
				timeDateAttributes: dateEl
					? Object.keys(dateEl.attributes).length > 0
						? { ...dateEl.attributes }
						: undefined
					: undefined,
				timeCycle: cycleEl?.text?.trim(),
				timeCycleAttributes: cycleEl
					? Object.keys(cycleEl.attributes).length > 0
						? { ...cycleEl.attributes }
						: undefined
					: undefined,
			});
		} else if (ln === "errorEventDefinition") {
			defs.push({
				type: "error",
				id: attr(child, "id"),
				errorRef: attr(child, "errorRef"),
			});
		} else if (ln === "escalationEventDefinition") {
			defs.push({
				type: "escalation",
				id: attr(child, "id"),
				escalationRef: attr(child, "escalationRef"),
			});
		} else if (ln === "messageEventDefinition") {
			defs.push({
				type: "message",
				id: attr(child, "id"),
				messageRef: attr(child, "messageRef"),
			});
		} else if (ln === "signalEventDefinition") {
			defs.push({
				type: "signal",
				id: attr(child, "id"),
				signalRef: attr(child, "signalRef"),
			});
		} else if (ln === "conditionalEventDefinition") {
			const condEl = findChild(child, "condition");
			defs.push({
				type: "conditional",
				id: attr(child, "id"),
				condition: condEl?.text?.trim(),
			});
		} else if (ln === "linkEventDefinition") {
			defs.push({
				type: "link",
				id: attr(child, "id"),
				name: attr(child, "name"),
			});
		} else if (ln === "cancelEventDefinition") {
			defs.push({ type: "cancel", id: attr(child, "id") });
		} else if (ln === "terminateEventDefinition") {
			defs.push({ type: "terminate", id: attr(child, "id") });
		} else if (ln === "compensateEventDefinition") {
			defs.push({
				type: "compensate",
				id: attr(child, "id"),
				activityRef: attr(child, "activityRef"),
			});
		}
	}

	return defs;
}

// ---------------------------------------------------------------------------
// Multi-instance loop
// ---------------------------------------------------------------------------

function parseLoopCharacteristics(
	element: XmlElement,
): BpmnMultiInstanceLoopCharacteristics | undefined {
	const loopEl = findChild(element, "multiInstanceLoopCharacteristics");
	if (!loopEl) return undefined;
	return { extensionElements: parseExtensionElements(loopEl) };
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
]);

function parseFlowElement(element: XmlElement): BpmnFlowElement | undefined {
	const ln = localName(element.name) as BpmnElementType;
	if (!FLOW_ELEMENT_TYPES.has(ln)) return undefined;

	const base = {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		incoming: collectFlowRefs(element, "incoming"),
		outgoing: collectFlowRefs(element, "outgoing"),
		documentation: findChild(element, "documentation")?.text,
		extensionElements: parseExtensionElements(element),
		unknownAttributes: unknownAttrs(element),
	};

	switch (ln) {
		case "startEvent":
		case "endEvent":
		case "intermediateCatchEvent":
		case "intermediateThrowEvent":
			return { ...base, type: ln, eventDefinitions: parseEventDefinitions(element) };

		case "boundaryEvent":
			return {
				...base,
				type: "boundaryEvent",
				attachedToRef: requiredAttr(element, "attachedToRef"),
				cancelActivity:
					attr(element, "cancelActivity") !== undefined
						? attr(element, "cancelActivity") === "true"
						: undefined,
				eventDefinitions: parseEventDefinitions(element),
			} satisfies BpmnBoundaryEvent;

		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			return { ...base, type: ln, loopCharacteristics: parseLoopCharacteristics(element) };

		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				loopCharacteristics: parseLoopCharacteristics(element),
				...parseProcessContents(element),
			};

		case "subProcess":
			return {
				...base,
				type: "subProcess",
				triggeredByEvent:
					attr(element, "triggeredByEvent") !== undefined
						? attr(element, "triggeredByEvent") === "true"
						: undefined,
				loopCharacteristics: parseLoopCharacteristics(element),
				...parseProcessContents(element),
			};

		case "eventSubProcess":
			return {
				...base,
				type: "eventSubProcess",
				...parseProcessContents(element),
			};

		case "transaction":
			return {
				...base,
				type: "transaction",
				loopCharacteristics: parseLoopCharacteristics(element),
				...parseProcessContents(element),
			};

		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway", default: attr(element, "default") };

		case "parallelGateway":
			return { ...base, type: "parallelGateway" };

		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway", default: attr(element, "default") };

		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" };

		case "complexGateway":
			return { ...base, type: "complexGateway", default: attr(element, "default") };

		default:
			return undefined;
	}
}

// ---------------------------------------------------------------------------
// Sequence flows
// ---------------------------------------------------------------------------

function parseSequenceFlow(element: XmlElement): BpmnSequenceFlow {
	const condEl = findChild(element, "conditionExpression");
	let conditionExpression: BpmnConditionExpression | undefined;
	if (condEl) {
		conditionExpression = {
			text: condEl.text ?? "",
			attributes: { ...condEl.attributes },
		};
	}

	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		sourceRef: requiredAttr(element, "sourceRef"),
		targetRef: requiredAttr(element, "targetRef"),
		conditionExpression,
		extensionElements: parseExtensionElements(element),
		unknownAttributes: unknownAttrs(element),
	};
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

function parseTextAnnotation(element: XmlElement): BpmnTextAnnotation {
	const textEl = findChild(element, "text");
	return {
		id: requiredAttr(element, "id"),
		text: textEl?.text,
		unknownAttributes: unknownAttrs(element),
	};
}

function parseAssociation(element: XmlElement): BpmnAssociation {
	return {
		id: requiredAttr(element, "id"),
		sourceRef: requiredAttr(element, "sourceRef"),
		targetRef: requiredAttr(element, "targetRef"),
		associationDirection: attr(element, "associationDirection"),
		unknownAttributes: unknownAttrs(element),
	};
}

// ---------------------------------------------------------------------------
// Process contents (shared between process and adHocSubProcess)
// ---------------------------------------------------------------------------

function parseProcessContents(element: XmlElement): {
	flowElements: BpmnFlowElement[];
	sequenceFlows: BpmnSequenceFlow[];
	textAnnotations: BpmnTextAnnotation[];
	associations: BpmnAssociation[];
} {
	const flowElements: BpmnFlowElement[] = [];
	const sequenceFlows: BpmnSequenceFlow[] = [];
	const textAnnotations: BpmnTextAnnotation[] = [];
	const associations: BpmnAssociation[] = [];

	for (const child of element.children) {
		const ln = localName(child.name);

		if (FLOW_ELEMENT_TYPES.has(ln)) {
			const fe = parseFlowElement(child);
			if (fe) flowElements.push(fe);
		} else if (ln === "sequenceFlow") {
			sequenceFlows.push(parseSequenceFlow(child));
		} else if (ln === "textAnnotation") {
			textAnnotations.push(parseTextAnnotation(child));
		} else if (ln === "association") {
			associations.push(parseAssociation(child));
		}
	}

	return { flowElements, sequenceFlows, textAnnotations, associations };
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

function parseLane(element: XmlElement): BpmnLane {
	const flowNodeRefs = findChildren(element, "flowNodeRef")
		.map((c) => c.text?.trim())
		.filter((t): t is string => !!t);
	const childLaneSetEl = findChild(element, "childLaneSet");
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		flowNodeRefs,
		childLaneSet: childLaneSetEl ? parseLaneSet(childLaneSetEl) : undefined,
		unknownAttributes: unknownAttrs(element),
	};
}

function parseLaneSet(element: XmlElement): BpmnLaneSet {
	return {
		id: attr(element, "id"),
		lanes: findChildren(element, "lane").map(parseLane),
	};
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

function parseProcess(element: XmlElement): BpmnProcess {
	const laneSetEl = findChild(element, "laneSet");
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		isExecutable: attr(element, "isExecutable") === "true" ? true : undefined,
		extensionElements: parseExtensionElements(element),
		unknownAttributes: unknownAttrs(element),
		laneSet: laneSetEl ? parseLaneSet(laneSetEl) : undefined,
		...parseProcessContents(element),
	};
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

function parseParticipant(element: XmlElement): BpmnParticipant {
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		processRef: attr(element, "processRef"),
		unknownAttributes: unknownAttrs(element),
	};
}

function parseMessageFlow(element: XmlElement): BpmnMessageFlow {
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		sourceRef: requiredAttr(element, "sourceRef"),
		targetRef: requiredAttr(element, "targetRef"),
		unknownAttributes: unknownAttrs(element),
	};
}

function parseCollaboration(element: XmlElement): BpmnCollaboration {
	return {
		id: requiredAttr(element, "id"),
		participants: findChildren(element, "participant").map(parseParticipant),
		messageFlows: findChildren(element, "messageFlow").map(parseMessageFlow),
		textAnnotations: findChildren(element, "textAnnotation").map(parseTextAnnotation),
		associations: findChildren(element, "association").map(parseAssociation),
		extensionElements: parseExtensionElements(element),
		unknownAttributes: unknownAttrs(element),
	};
}

// ---------------------------------------------------------------------------
// Root elements
// ---------------------------------------------------------------------------

function parseError(element: XmlElement): BpmnError {
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		errorCode: attr(element, "errorCode"),
	};
}

function parseEscalation(element: XmlElement): BpmnEscalation {
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		escalationCode: attr(element, "escalationCode"),
	};
}

function parseMessage(element: XmlElement): BpmnMessage {
	return {
		id: requiredAttr(element, "id"),
		name: attr(element, "name"),
		unknownAttributes: unknownAttrs(element),
	};
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

function parseBounds(element: XmlElement): {
	x: number;
	y: number;
	width: number;
	height: number;
} {
	return {
		x: Number(attr(element, "x") ?? "0"),
		y: Number(attr(element, "y") ?? "0"),
		width: Number(attr(element, "width") ?? "0"),
		height: Number(attr(element, "height") ?? "0"),
	};
}

function parseLabel(element: XmlElement): BpmnDiLabel | undefined {
	const labelEl = findChild(element, "BPMNLabel");
	if (!labelEl) return undefined;

	const boundsEl = findChild(labelEl, "Bounds");
	return { bounds: boundsEl ? parseBounds(boundsEl) : undefined };
}

function parseDiShape(element: XmlElement): BpmnDiShape {
	const boundsEl = findChild(element, "Bounds");
	if (!boundsEl) throw new Error(`Missing <dc:Bounds> in shape "${attr(element, "id")}"`);

	return {
		id: requiredAttr(element, "id"),
		bpmnElement: requiredAttr(element, "bpmnElement"),
		isMarkerVisible:
			attr(element, "isMarkerVisible") !== undefined
				? attr(element, "isMarkerVisible") === "true"
				: undefined,
		isExpanded:
			attr(element, "isExpanded") !== undefined
				? attr(element, "isExpanded") === "true"
				: undefined,
		bounds: parseBounds(boundsEl),
		label: parseLabel(element),
		unknownAttributes: unknownAttrs(element),
	};
}

function parseDiEdge(element: XmlElement): BpmnDiEdge {
	const waypoints = findChildren(element, "waypoint").map((w) => ({
		x: Number(attr(w, "x") ?? "0"),
		y: Number(attr(w, "y") ?? "0"),
	}));

	return {
		id: requiredAttr(element, "id"),
		bpmnElement: requiredAttr(element, "bpmnElement"),
		waypoints,
		label: parseLabel(element),
		unknownAttributes: unknownAttrs(element),
	};
}

function parseDiagram(element: XmlElement): BpmnDiagram {
	const planeEl = findChild(element, "BPMNPlane");
	if (!planeEl) throw new Error("Missing <bpmndi:BPMNPlane> in diagram");

	const shapes: BpmnDiShape[] = [];
	const edges: BpmnDiEdge[] = [];

	for (const child of planeEl.children) {
		const ln = localName(child.name);
		if (ln === "BPMNShape") shapes.push(parseDiShape(child));
		else if (ln === "BPMNEdge") edges.push(parseDiEdge(child));
	}

	return {
		id: requiredAttr(element, "id"),
		plane: {
			id: requiredAttr(planeEl, "id"),
			bpmnElement: requiredAttr(planeEl, "bpmnElement"),
			shapes,
			edges,
		},
	};
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Parse a BPMN XML string into a typed BpmnDefinitions model. */
export function parseBpmn(xml: string): BpmnDefinitions {
	const root = parseXml(xml);

	if (localName(root.name) !== "definitions") {
		throw new Error(`Expected <definitions> root element, got <${root.name}>`);
	}

	const namespaces: Record<string, string> = {};
	const unknownAttributes: Record<string, string> = {};

	for (const [key, value] of Object.entries(root.attributes)) {
		if (key.startsWith("xmlns:")) {
			namespaces[key.slice(6)] = value;
		} else if (key === "xmlns") {
			namespaces[""] = value;
		} else if (KNOWN_ATTRS.has(key)) {
		} else {
			unknownAttributes[key] = value;
		}
	}

	const errors: BpmnError[] = [];
	const escalations: BpmnEscalation[] = [];
	const messages: BpmnMessage[] = [];
	const collaborations: BpmnCollaboration[] = [];
	const processes: BpmnProcess[] = [];
	const diagrams: BpmnDiagram[] = [];

	for (const child of root.children) {
		const ln = localName(child.name);
		if (ln === "error") errors.push(parseError(child));
		else if (ln === "escalation") escalations.push(parseEscalation(child));
		else if (ln === "message") messages.push(parseMessage(child));
		else if (ln === "collaboration") collaborations.push(parseCollaboration(child));
		else if (ln === "process") processes.push(parseProcess(child));
		else if (ln === "BPMNDiagram") diagrams.push(parseDiagram(child));
	}

	return {
		id: requiredAttr(root, "id"),
		targetNamespace: requiredAttr(root, "targetNamespace"),
		exporter: attr(root, "exporter"),
		exporterVersion: attr(root, "exporterVersion"),
		namespaces,
		unknownAttributes,
		errors,
		escalations,
		messages,
		collaborations,
		processes,
		diagrams,
	};
}
