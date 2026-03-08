import type { XmlElement } from "../types/xml-element.js";

/** DMN hit policy for decision tables. */
export type HitPolicy =
	| "UNIQUE"
	| "FIRST"
	| "ANY"
	| "COLLECT"
	| "RULE ORDER"
	| "OUTPUT ORDER"
	| "PRIORITY";

/** DMN collect aggregation for COLLECT hit policy. */
export type DmnAggregation = "SUM" | "MIN" | "MAX" | "COUNT";

/** DMN type reference for inputs/outputs. */
export type DmnTypeRef = "string" | "boolean" | "number" | "date";

/** A single input column in a decision table. */
export interface DmnInput {
	id: string;
	label?: string;
	inputExpression: {
		id: string;
		typeRef?: DmnTypeRef;
		text?: string;
	};
}

/** A single output column in a decision table. */
export interface DmnOutput {
	id: string;
	label?: string;
	name?: string;
	typeRef?: DmnTypeRef;
}

/** An input entry (unary test) within a rule. */
export interface DmnInputEntry {
	id: string;
	text: string;
}

/** An output entry (literal expression) within a rule. */
export interface DmnOutputEntry {
	id: string;
	text: string;
}

/** A single rule (row) in a decision table. */
export interface DmnRule {
	id: string;
	description?: string;
	inputEntries: DmnInputEntry[];
	outputEntries: DmnOutputEntry[];
}

/** A decision table within a decision element. */
export interface DmnDecisionTable {
	id: string;
	hitPolicy?: HitPolicy;
	aggregation?: DmnAggregation;
	inputs: DmnInput[];
	outputs: DmnOutput[];
	rules: DmnRule[];
}

// ── Requirements ─────────────────────────────────────────────────────────────

/** Information requirement — connects a decision or input data to a decision. */
export interface DmnInformationRequirement {
	id: string;
	/** Ref to required decision id (mutually exclusive with requiredInput). */
	requiredDecision?: string;
	/** Ref to required input data id (mutually exclusive with requiredDecision). */
	requiredInput?: string;
}

/** Knowledge requirement — connects a BKM to a decision or BKM. */
export interface DmnKnowledgeRequirement {
	id: string;
	/** Ref to the required BKM id. */
	requiredKnowledge: string;
}

/** Authority requirement — connects a knowledge source or decision to a DRG element. */
export interface DmnAuthorityRequirement {
	id: string;
	requiredDecision?: string;
	requiredInput?: string;
	/** Ref to knowledge source id. */
	requiredAuthority?: string;
}

// ── DRG Elements ──────────────────────────────────────────────────────────────

/** A top-level decision element. */
export interface DmnDecision {
	id: string;
	name?: string;
	/** Decision table (optional — a decision may contain a literal expression instead). */
	decisionTable?: DmnDecisionTable;
	informationRequirements: DmnInformationRequirement[];
	knowledgeRequirements: DmnKnowledgeRequirement[];
	authorityRequirements: DmnAuthorityRequirement[];
	extensionElements?: XmlElement[];
}

/** Input data element — an external data source feeding into decisions. */
export interface DmnInputData {
	id: string;
	name?: string;
}

/** Knowledge source element — an authority for decisions or BKMs. */
export interface DmnKnowledgeSource {
	id: string;
	name?: string;
	authorityRequirements: DmnAuthorityRequirement[];
}

/** Business knowledge model element — a reusable function or decision table. */
export interface DmnBusinessKnowledgeModel {
	id: string;
	name?: string;
	knowledgeRequirements: DmnKnowledgeRequirement[];
	authorityRequirements: DmnAuthorityRequirement[];
}

/** Text annotation element — a free-form textual comment. */
export interface DmnTextAnnotation {
	id: string;
	text?: string;
}

/** Association between any two DRG elements (often with text annotations). */
export interface DmnAssociation {
	id: string;
	sourceRef: string;
	targetRef: string;
}

// ── Diagram ───────────────────────────────────────────────────────────────────

/** A waypoint in a diagram edge path. */
export interface DmnWaypoint {
	x: number;
	y: number;
}

/** DMN diagram shape for visual representation. */
export interface DmnDiagramShape {
	dmnElementRef: string;
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
}

/** DMN diagram edge for visual representation. */
export interface DmnDiagramEdge {
	dmnElementRef: string;
	waypoints: DmnWaypoint[];
}

/** DMN diagram information. */
export interface DmnDiagram {
	shapes: DmnDiagramShape[];
	edges: DmnDiagramEdge[];
}

/** Root DMN definitions element. */
export interface DmnDefinitions {
	id: string;
	name: string;
	namespace: string;
	exporter?: string;
	exporterVersion?: string;
	/** Namespace declarations from the XML document (prefix → URI). */
	namespaces: Record<string, string>;
	/** Modeler extension attributes (e.g. executionPlatform). */
	modelerAttributes: Record<string, string>;
	decisions: DmnDecision[];
	inputData: DmnInputData[];
	knowledgeSources: DmnKnowledgeSource[];
	businessKnowledgeModels: DmnBusinessKnowledgeModel[];
	textAnnotations: DmnTextAnnotation[];
	associations: DmnAssociation[];
	diagram?: DmnDiagram;
	extensionElements?: XmlElement[];
}
