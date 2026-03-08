import type { XmlElement } from "../types/xml-element.js";
import { serializeXml } from "../xml/xml-parser.js";
import type {
	BpmnAdHocSubProcess,
	BpmnAssociation,
	BpmnBoundaryEvent,
	BpmnCollaboration,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnDiagram,
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
// Namespace prefix resolution
// ---------------------------------------------------------------------------

function nsPrefix(namespaces: Record<string, string>, uri: string): string | undefined {
	for (const [prefix, u] of Object.entries(namespaces)) {
		if (u === uri) return prefix;
	}
	return undefined;
}

function bpmnPrefix(ns: Record<string, string>): string {
	return nsPrefix(ns, "http://www.omg.org/spec/BPMN/20100524/MODEL") ?? "bpmn";
}

function bpmndiPrefix(ns: Record<string, string>): string {
	return nsPrefix(ns, "http://www.omg.org/spec/BPMN/20100524/DI") ?? "bpmndi";
}

function dcPrefix(ns: Record<string, string>): string {
	return nsPrefix(ns, "http://www.omg.org/spec/DD/20100524/DC") ?? "dc";
}

function diPrefix(ns: Record<string, string>): string {
	return nsPrefix(ns, "http://www.omg.org/spec/DD/20100524/DI") ?? "di";
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function el(
	name: string,
	attributes: Record<string, string>,
	children: XmlElement[],
	text?: string,
): XmlElement {
	return { name, attributes, children, text };
}

// ---------------------------------------------------------------------------
// Event definitions
// ---------------------------------------------------------------------------

function serializeEventDefinitions(defs: BpmnEventDefinition[], bp: string): XmlElement[] {
	return defs.map((d): XmlElement => {
		switch (d.type) {
			case "timer": {
				const children: XmlElement[] = [];
				if (d.timeDuration !== undefined) {
					children.push(
						el(`${bp}:timeDuration`, d.timeDurationAttributes ?? {}, [], d.timeDuration),
					);
				}
				if (d.timeDate !== undefined) {
					children.push(el(`${bp}:timeDate`, d.timeDateAttributes ?? {}, [], d.timeDate));
				}
				if (d.timeCycle !== undefined) {
					children.push(el(`${bp}:timeCycle`, d.timeCycleAttributes ?? {}, [], d.timeCycle));
				}
				return el(`${bp}:timerEventDefinition`, d.id ? { id: d.id } : {}, children);
			}
			case "error": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.errorRef) attrs.errorRef = d.errorRef;
				return el(`${bp}:errorEventDefinition`, attrs, []);
			}
			case "escalation": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.escalationRef) attrs.escalationRef = d.escalationRef;
				return el(`${bp}:escalationEventDefinition`, attrs, []);
			}
			case "message": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.messageRef) attrs.messageRef = d.messageRef;
				return el(`${bp}:messageEventDefinition`, attrs, []);
			}
			case "signal": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.signalRef) attrs.signalRef = d.signalRef;
				return el(`${bp}:signalEventDefinition`, attrs, []);
			}
			case "conditional": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				const condChildren: XmlElement[] = [];
				if (d.condition !== undefined) {
					condChildren.push(el(`${bp}:condition`, {}, [], d.condition));
				}
				return el(`${bp}:conditionalEventDefinition`, attrs, condChildren);
			}
			case "link": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.name) attrs.name = d.name;
				return el(`${bp}:linkEventDefinition`, attrs, []);
			}
			case "cancel": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				return el(`${bp}:cancelEventDefinition`, attrs, []);
			}
			case "terminate": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				return el(`${bp}:terminateEventDefinition`, attrs, []);
			}
			case "compensate": {
				const attrs: Record<string, string> = {};
				if (d.id) attrs.id = d.id;
				if (d.activityRef) attrs.activityRef = d.activityRef;
				return el(`${bp}:compensateEventDefinition`, attrs, []);
			}
			default: {
				const _exhaustive: never = d;
				throw new Error(
					`Unknown event definition type: ${(_exhaustive as BpmnEventDefinition).type}`,
				);
			}
		}
	});
}

// ---------------------------------------------------------------------------
// Extension elements
// ---------------------------------------------------------------------------

function serializeExtensionElements(extensions: XmlElement[], bp: string): XmlElement[] {
	if (extensions.length === 0) return [];
	return [el(`${bp}:extensionElements`, {}, extensions)];
}

// ---------------------------------------------------------------------------
// Multi-instance loop
// ---------------------------------------------------------------------------

function serializeLoopCharacteristics(
	lc: BpmnMultiInstanceLoopCharacteristics | undefined,
	bp: string,
): XmlElement[] {
	if (!lc) return [];
	return [
		el(`${bp}:multiInstanceLoopCharacteristics`, {}, [
			...serializeExtensionElements(lc.extensionElements, bp),
		]),
	];
}

// ---------------------------------------------------------------------------
// Flow elements
// ---------------------------------------------------------------------------

function flowRefs(refs: string[], tag: string, bp: string): XmlElement[] {
	return refs.map((r) => el(`${bp}:${tag}`, {}, [], r));
}

function serializeFlowElement(fe: BpmnFlowElement, ns: Record<string, string>): XmlElement {
	const bp = bpmnPrefix(ns);
	const attrs: Record<string, string> = { id: fe.id, ...fe.unknownAttributes };
	if (fe.name !== undefined) attrs.name = fe.name;

	const children: XmlElement[] = [];

	// Documentation
	if (fe.documentation !== undefined) {
		children.push(el(`${bp}:documentation`, {}, [], fe.documentation));
	}

	// Extension elements
	children.push(...serializeExtensionElements(fe.extensionElements, bp));

	// Incoming / outgoing
	children.push(...flowRefs(fe.incoming, "incoming", bp));
	children.push(...flowRefs(fe.outgoing, "outgoing", bp));

	switch (fe.type) {
		case "startEvent":
		case "endEvent":
		case "intermediateCatchEvent":
		case "intermediateThrowEvent":
			children.push(...serializeEventDefinitions(fe.eventDefinitions, bp));
			break;

		case "boundaryEvent":
			attrs.attachedToRef = fe.attachedToRef;
			if (fe.cancelActivity !== undefined) attrs.cancelActivity = String(fe.cancelActivity);
			children.push(...serializeEventDefinitions(fe.eventDefinitions, bp));
			break;

		case "task":
		case "serviceTask":
		case "scriptTask":
		case "userTask":
		case "sendTask":
		case "receiveTask":
		case "businessRuleTask":
		case "manualTask":
		case "callActivity":
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp));
			break;

		case "adHocSubProcess":
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp));
			children.push(...serializeProcessContents(fe, ns));
			break;

		case "subProcess":
			if (fe.triggeredByEvent !== undefined) attrs.triggeredByEvent = String(fe.triggeredByEvent);
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp));
			children.push(...serializeProcessContents(fe, ns));
			break;

		case "eventSubProcess":
			children.push(...serializeProcessContents(fe, ns));
			break;

		case "transaction":
			children.push(...serializeLoopCharacteristics(fe.loopCharacteristics, bp));
			children.push(...serializeProcessContents(fe, ns));
			break;

		case "exclusiveGateway":
			if (fe.default !== undefined) attrs.default = fe.default;
			break;

		case "inclusiveGateway":
			if (fe.default !== undefined) attrs.default = fe.default;
			break;

		case "complexGateway":
			if (fe.default !== undefined) attrs.default = fe.default;
			break;

		case "parallelGateway":
		case "eventBasedGateway":
			break;
	}

	return el(`${bp}:${fe.type}`, attrs, children);
}

// ---------------------------------------------------------------------------
// Sequence flows
// ---------------------------------------------------------------------------

function serializeSequenceFlow(sf: BpmnSequenceFlow, bp: string): XmlElement {
	const attrs: Record<string, string> = {
		id: sf.id,
		sourceRef: sf.sourceRef,
		targetRef: sf.targetRef,
		...sf.unknownAttributes,
	};
	if (sf.name !== undefined) attrs.name = sf.name;

	const children: XmlElement[] = [];
	children.push(...serializeExtensionElements(sf.extensionElements, bp));

	if (sf.conditionExpression) {
		children.push(
			el(
				`${bp}:conditionExpression`,
				sf.conditionExpression.attributes,
				[],
				sf.conditionExpression.text,
			),
		);
	}

	return el(`${bp}:sequenceFlow`, attrs, children);
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

function serializeTextAnnotation(ta: BpmnTextAnnotation, bp: string): XmlElement {
	const children: XmlElement[] = [];
	if (ta.text !== undefined) {
		children.push(el(`${bp}:text`, {}, [], ta.text));
	}
	return el(`${bp}:textAnnotation`, { id: ta.id, ...ta.unknownAttributes }, children);
}

function serializeAssociation(a: BpmnAssociation, bp: string): XmlElement {
	const attrs: Record<string, string> = {
		id: a.id,
		sourceRef: a.sourceRef,
		targetRef: a.targetRef,
		...a.unknownAttributes,
	};
	if (a.associationDirection !== undefined) attrs.associationDirection = a.associationDirection;
	return el(`${bp}:association`, attrs, []);
}

// ---------------------------------------------------------------------------
// Process contents
// ---------------------------------------------------------------------------

function serializeProcessContents(
	p: {
		flowElements: BpmnFlowElement[];
		sequenceFlows: BpmnSequenceFlow[];
		textAnnotations: BpmnTextAnnotation[];
		associations: BpmnAssociation[];
	},
	ns: Record<string, string>,
): XmlElement[] {
	const bp = bpmnPrefix(ns);
	const children: XmlElement[] = [];

	for (const fe of p.flowElements) {
		children.push(serializeFlowElement(fe, ns));
	}
	for (const sf of p.sequenceFlows) {
		children.push(serializeSequenceFlow(sf, bp));
	}
	for (const ta of p.textAnnotations) {
		children.push(serializeTextAnnotation(ta, bp));
	}
	for (const a of p.associations) {
		children.push(serializeAssociation(a, bp));
	}

	return children;
}

// ---------------------------------------------------------------------------
// Lanes
// ---------------------------------------------------------------------------

function serializeLane(lane: BpmnLane, bp: string): XmlElement {
	const attrs: Record<string, string> = { id: lane.id, ...lane.unknownAttributes };
	if (lane.name !== undefined) attrs.name = lane.name;
	const children: XmlElement[] = lane.flowNodeRefs.map((ref) =>
		el(`${bp}:flowNodeRef`, {}, [], ref),
	);
	if (lane.childLaneSet) {
		children.push(serializeLaneSet(lane.childLaneSet, bp));
	}
	return el(`${bp}:lane`, attrs, children);
}

function serializeLaneSet(laneSet: BpmnLaneSet, bp: string): XmlElement {
	const attrs: Record<string, string> = {};
	if (laneSet.id) attrs.id = laneSet.id;
	return el(
		`${bp}:laneSet`,
		attrs,
		laneSet.lanes.map((l) => serializeLane(l, bp)),
	);
}

// ---------------------------------------------------------------------------
// Process
// ---------------------------------------------------------------------------

function serializeProcess(process: BpmnProcess, ns: Record<string, string>): XmlElement {
	const bp = bpmnPrefix(ns);
	const attrs: Record<string, string> = { id: process.id, ...process.unknownAttributes };
	if (process.name !== undefined) attrs.name = process.name;
	if (process.isExecutable) attrs.isExecutable = "true";

	const children: XmlElement[] = [];
	children.push(...serializeExtensionElements(process.extensionElements, bp));
	if (process.laneSet) {
		children.push(serializeLaneSet(process.laneSet, bp));
	}
	children.push(...serializeProcessContents(process, ns));

	return el(`${bp}:process`, attrs, children);
}

// ---------------------------------------------------------------------------
// Collaboration
// ---------------------------------------------------------------------------

function serializeParticipant(p: BpmnParticipant, bp: string): XmlElement {
	const attrs: Record<string, string> = { id: p.id, ...p.unknownAttributes };
	if (p.name !== undefined) attrs.name = p.name;
	if (p.processRef !== undefined) attrs.processRef = p.processRef;
	return el(`${bp}:participant`, attrs, []);
}

function serializeMessageFlow(mf: BpmnMessageFlow, bp: string): XmlElement {
	const attrs: Record<string, string> = {
		id: mf.id,
		sourceRef: mf.sourceRef,
		targetRef: mf.targetRef,
		...mf.unknownAttributes,
	};
	if (mf.name !== undefined) attrs.name = mf.name;
	return el(`${bp}:messageFlow`, attrs, []);
}

function serializeCollaboration(c: BpmnCollaboration, ns: Record<string, string>): XmlElement {
	const bp = bpmnPrefix(ns);
	const children: XmlElement[] = [];

	for (const p of c.participants) {
		children.push(serializeParticipant(p, bp));
	}
	for (const mf of c.messageFlows) {
		children.push(serializeMessageFlow(mf, bp));
	}
	for (const ta of c.textAnnotations) {
		children.push(serializeTextAnnotation(ta, bp));
	}
	for (const a of c.associations) {
		children.push(serializeAssociation(a, bp));
	}

	return el(`${bp}:collaboration`, { id: c.id, ...c.unknownAttributes }, children);
}

// ---------------------------------------------------------------------------
// Root elements
// ---------------------------------------------------------------------------

function serializeError(e: BpmnError, bp: string): XmlElement {
	const attrs: Record<string, string> = { id: e.id };
	if (e.name !== undefined) attrs.name = e.name;
	if (e.errorCode !== undefined) attrs.errorCode = e.errorCode;
	return el(`${bp}:error`, attrs, []);
}

function serializeEscalation(e: BpmnEscalation, bp: string): XmlElement {
	const attrs: Record<string, string> = { id: e.id };
	if (e.name !== undefined) attrs.name = e.name;
	if (e.escalationCode !== undefined) attrs.escalationCode = e.escalationCode;
	return el(`${bp}:escalation`, attrs, []);
}

function serializeMessage(m: BpmnMessage, bp: string): XmlElement {
	const attrs: Record<string, string> = { id: m.id, ...m.unknownAttributes };
	if (m.name !== undefined) attrs.name = m.name;
	return el(`${bp}:message`, attrs, []);
}

// ---------------------------------------------------------------------------
// Diagram interchange
// ---------------------------------------------------------------------------

function serializeDiShape(shape: BpmnDiShape, bdi: string, dc: string): XmlElement {
	const attrs: Record<string, string> = {
		id: shape.id,
		bpmnElement: shape.bpmnElement,
		...shape.unknownAttributes,
	};
	if (shape.isMarkerVisible !== undefined) attrs.isMarkerVisible = String(shape.isMarkerVisible);
	if (shape.isExpanded !== undefined) attrs.isExpanded = String(shape.isExpanded);

	const children: XmlElement[] = [
		el(
			`${dc}:Bounds`,
			{
				x: String(shape.bounds.x),
				y: String(shape.bounds.y),
				width: String(shape.bounds.width),
				height: String(shape.bounds.height),
			},
			[],
		),
	];

	if (shape.label) {
		const labelChildren: XmlElement[] = [];
		if (shape.label.bounds) {
			labelChildren.push(
				el(
					`${dc}:Bounds`,
					{
						x: String(shape.label.bounds.x),
						y: String(shape.label.bounds.y),
						width: String(shape.label.bounds.width),
						height: String(shape.label.bounds.height),
					},
					[],
				),
			);
		}
		children.push(el(`${bdi}:BPMNLabel`, {}, labelChildren));
	}

	return el(`${bdi}:BPMNShape`, attrs, children);
}

function serializeDiEdge(edge: BpmnDiEdge, bdi: string, dc: string, dip: string): XmlElement {
	const attrs: Record<string, string> = {
		id: edge.id,
		bpmnElement: edge.bpmnElement,
		...edge.unknownAttributes,
	};

	const children: XmlElement[] = edge.waypoints.map((w) =>
		el(`${dip}:waypoint`, { x: String(w.x), y: String(w.y) }, []),
	);

	if (edge.label) {
		const labelChildren: XmlElement[] = [];
		if (edge.label.bounds) {
			labelChildren.push(
				el(
					`${dc}:Bounds`,
					{
						x: String(edge.label.bounds.x),
						y: String(edge.label.bounds.y),
						width: String(edge.label.bounds.width),
						height: String(edge.label.bounds.height),
					},
					[],
				),
			);
		}
		children.push(el(`${bdi}:BPMNLabel`, {}, labelChildren));
	}

	return el(`${bdi}:BPMNEdge`, attrs, children);
}

function serializeDiagram(diagram: BpmnDiagram, ns: Record<string, string>): XmlElement {
	const bdi = bpmndiPrefix(ns);
	const dc = dcPrefix(ns);
	const dip = diPrefix(ns);

	const planeChildren: XmlElement[] = [];
	for (const s of diagram.plane.shapes) {
		planeChildren.push(serializeDiShape(s, bdi, dc));
	}
	for (const e of diagram.plane.edges) {
		planeChildren.push(serializeDiEdge(e, bdi, dc, dip));
	}

	const plane = el(
		`${bdi}:BPMNPlane`,
		{
			id: diagram.plane.id,
			bpmnElement: diagram.plane.bpmnElement,
		},
		planeChildren,
	);

	return el(`${bdi}:BPMNDiagram`, { id: diagram.id }, [plane]);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Serialize a BpmnDefinitions model to a BPMN XML string. */
export function serializeBpmn(definitions: BpmnDefinitions): string {
	const ns = definitions.namespaces;
	const bp = bpmnPrefix(ns);

	const attrs: Record<string, string> = {};

	// Namespace declarations
	for (const [prefix, uri] of Object.entries(ns)) {
		if (prefix === "") {
			attrs.xmlns = uri;
		} else {
			attrs[`xmlns:${prefix}`] = uri;
		}
	}

	attrs.id = definitions.id;
	attrs.targetNamespace = definitions.targetNamespace;
	if (definitions.exporter !== undefined) attrs.exporter = definitions.exporter;
	if (definitions.exporterVersion !== undefined)
		attrs.exporterVersion = definitions.exporterVersion;

	// Unknown attributes (modeler:*, camunda:*, etc.)
	for (const [key, value] of Object.entries(definitions.unknownAttributes)) {
		attrs[key] = value;
	}

	const children: XmlElement[] = [];

	// Root elements: errors, escalations, messages first
	for (const e of definitions.escalations) {
		children.push(serializeEscalation(e, bp));
	}
	for (const e of definitions.errors) {
		children.push(serializeError(e, bp));
	}
	for (const m of definitions.messages) {
		children.push(serializeMessage(m, bp));
	}

	// Collaborations
	for (const c of definitions.collaborations) {
		children.push(serializeCollaboration(c, ns));
	}

	// Processes
	for (const p of definitions.processes) {
		children.push(serializeProcess(p, ns));
	}

	// Diagrams
	for (const d of definitions.diagrams) {
		children.push(serializeDiagram(d, ns));
	}

	const root = el(`${bp}:definitions`, attrs, children);
	return serializeXml(root);
}
