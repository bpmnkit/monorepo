import type { XmlElement } from "../types/xml-element.js";
import { parseXml } from "../xml/xml-parser.js";
import type {
	DmnAggregation,
	DmnAssociation,
	DmnAuthorityRequirement,
	DmnBusinessKnowledgeModel,
	DmnDecision,
	DmnDecisionTable,
	DmnDefinitions,
	DmnDiagram,
	DmnDiagramEdge,
	DmnDiagramShape,
	DmnInformationRequirement,
	DmnInput,
	DmnInputData,
	DmnInputEntry,
	DmnKnowledgeRequirement,
	DmnKnowledgeSource,
	DmnOutput,
	DmnOutputEntry,
	DmnRule,
	DmnTextAnnotation,
	DmnTypeRef,
	DmnWaypoint,
	HitPolicy,
} from "./dmn-model.js";

const DMN_NS = "https://www.omg.org/spec/DMN/20191111/MODEL/";

/** Strip namespace prefix from a tag name. */
function localName(name: string): string {
	const idx = name.indexOf(":");
	return idx >= 0 ? name.slice(idx + 1) : name;
}

/** Find child elements by local name. */
function findChildren(element: XmlElement, tagLocalName: string): XmlElement[] {
	return element.children.filter((c) => localName(c.name) === tagLocalName);
}

/** Find first child element by local name. */
function findChild(element: XmlElement, tagLocalName: string): XmlElement | undefined {
	return element.children.find((c) => localName(c.name) === tagLocalName);
}

/** Get attribute value, trying with and without namespace prefixes. */
function attr(element: XmlElement, name: string): string | undefined {
	// Try direct name first
	if (element.attributes[name] !== undefined) return element.attributes[name];
	// Try all prefixed variants
	for (const [key, value] of Object.entries(element.attributes)) {
		if (localName(key) === name) return value;
	}
	return undefined;
}

function requiredAttr(element: XmlElement, name: string): string {
	const value = attr(element, name);
	if (value === undefined) {
		throw new Error(`Missing required attribute "${name}" on element <${element.name}>`);
	}
	return value;
}

/** Strip the leading '#' from a DMN href reference. */
function deref(href: string | undefined): string | undefined {
	if (!href) return undefined;
	return href.startsWith("#") ? href.slice(1) : href;
}

function parseTypeRef(value: string | undefined): DmnTypeRef | undefined {
	if (!value) return undefined;
	return value as DmnTypeRef;
}

function parseHitPolicy(value: string | undefined): HitPolicy | undefined {
	if (!value) return undefined;
	return value as HitPolicy;
}

function parseInputExpression(el: XmlElement): DmnInput["inputExpression"] {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		typeRef: parseTypeRef(attr(el, "typeRef")),
		text: textEl?.text,
	};
}

function parseInput(el: XmlElement): DmnInput {
	const exprEl = findChild(el, "inputExpression");
	if (!exprEl) {
		throw new Error(`Missing <inputExpression> in input "${attr(el, "id")}"`);
	}
	return {
		id: requiredAttr(el, "id"),
		label: attr(el, "label"),
		inputExpression: parseInputExpression(exprEl),
	};
}

function parseOutput(el: XmlElement): DmnOutput {
	return {
		id: requiredAttr(el, "id"),
		label: attr(el, "label"),
		name: attr(el, "name"),
		typeRef: parseTypeRef(attr(el, "typeRef")),
	};
}

function parseInputEntry(el: XmlElement): DmnInputEntry {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		text: textEl?.text ?? "",
	};
}

function parseOutputEntry(el: XmlElement): DmnOutputEntry {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		text: textEl?.text ?? "",
	};
}

function parseRule(el: XmlElement): DmnRule {
	const descEl = findChild(el, "description");
	return {
		id: requiredAttr(el, "id"),
		description: descEl?.text,
		inputEntries: findChildren(el, "inputEntry").map(parseInputEntry),
		outputEntries: findChildren(el, "outputEntry").map(parseOutputEntry),
	};
}

function parseDecisionTable(el: XmlElement): DmnDecisionTable {
	return {
		id: requiredAttr(el, "id"),
		hitPolicy: parseHitPolicy(attr(el, "hitPolicy")),
		aggregation: attr(el, "aggregation") as DmnAggregation | undefined,
		inputs: findChildren(el, "input").map(parseInput),
		outputs: findChildren(el, "output").map(parseOutput),
		rules: findChildren(el, "rule").map(parseRule),
	};
}

function parseInformationRequirement(el: XmlElement): DmnInformationRequirement {
	const reqDecEl = findChild(el, "requiredDecision");
	const reqInEl = findChild(el, "requiredInput");
	return {
		id: requiredAttr(el, "id"),
		requiredDecision: deref(attr(reqDecEl ?? { name: "", attributes: {}, children: [] }, "href")),
		requiredInput: deref(attr(reqInEl ?? { name: "", attributes: {}, children: [] }, "href")),
	};
}

function parseKnowledgeRequirement(el: XmlElement): DmnKnowledgeRequirement {
	const reqEl = findChild(el, "requiredKnowledge");
	return {
		id: requiredAttr(el, "id"),
		requiredKnowledge:
			deref(attr(reqEl ?? { name: "", attributes: {}, children: [] }, "href")) ?? "",
	};
}

function parseAuthorityRequirement(el: XmlElement): DmnAuthorityRequirement {
	const reqDecEl = findChild(el, "requiredDecision");
	const reqInEl = findChild(el, "requiredInput");
	const reqAuthEl = findChild(el, "requiredAuthority");
	return {
		id: requiredAttr(el, "id"),
		requiredDecision: deref(attr(reqDecEl ?? { name: "", attributes: {}, children: [] }, "href")),
		requiredInput: deref(attr(reqInEl ?? { name: "", attributes: {}, children: [] }, "href")),
		requiredAuthority: deref(attr(reqAuthEl ?? { name: "", attributes: {}, children: [] }, "href")),
	};
}

function parseDecision(el: XmlElement): DmnDecision {
	const tableEl = findChild(el, "decisionTable");
	const extensionEls = findChild(el, "extensionElements");

	const knownLocalNames = new Set([
		"decisionTable",
		"extensionElements",
		"informationRequirement",
		"knowledgeRequirement",
		"authorityRequirement",
	]);
	const unknownChildren = el.children.filter((c) => !knownLocalNames.has(localName(c.name)));

	return {
		id: requiredAttr(el, "id"),
		name: attr(el, "name"),
		decisionTable: tableEl ? parseDecisionTable(tableEl) : undefined,
		informationRequirements: findChildren(el, "informationRequirement").map(
			parseInformationRequirement,
		),
		knowledgeRequirements: findChildren(el, "knowledgeRequirement").map(parseKnowledgeRequirement),
		authorityRequirements: findChildren(el, "authorityRequirement").map(parseAuthorityRequirement),
		extensionElements: extensionEls
			? extensionEls.children
			: unknownChildren.length > 0
				? unknownChildren
				: undefined,
	};
}

function parseInputData(el: XmlElement): DmnInputData {
	return {
		id: requiredAttr(el, "id"),
		name: attr(el, "name"),
	};
}

function parseKnowledgeSource(el: XmlElement): DmnKnowledgeSource {
	return {
		id: requiredAttr(el, "id"),
		name: attr(el, "name"),
		authorityRequirements: findChildren(el, "authorityRequirement").map(parseAuthorityRequirement),
	};
}

function parseBusinessKnowledgeModel(el: XmlElement): DmnBusinessKnowledgeModel {
	return {
		id: requiredAttr(el, "id"),
		name: attr(el, "name"),
		knowledgeRequirements: findChildren(el, "knowledgeRequirement").map(parseKnowledgeRequirement),
		authorityRequirements: findChildren(el, "authorityRequirement").map(parseAuthorityRequirement),
	};
}

function parseTextAnnotation(el: XmlElement): DmnTextAnnotation {
	const textEl = findChild(el, "text");
	return {
		id: requiredAttr(el, "id"),
		text: textEl?.text,
	};
}

function parseAssociation(el: XmlElement): DmnAssociation {
	return {
		id: requiredAttr(el, "id"),
		sourceRef: deref(attr(el, "sourceRef")) ?? "",
		targetRef: deref(attr(el, "targetRef")) ?? "",
	};
}

function parseDiagram(dmndiEl: XmlElement): DmnDiagram {
	const diagramEl = findChild(dmndiEl, "DMNDiagram");
	const shapes: DmnDiagramShape[] = [];
	const edges: DmnDiagramEdge[] = [];

	if (diagramEl) {
		for (const shapeEl of findChildren(diagramEl, "DMNShape")) {
			const boundsEl = findChild(shapeEl, "Bounds");
			if (boundsEl) {
				shapes.push({
					dmnElementRef: requiredAttr(shapeEl, "dmnElementRef"),
					bounds: {
						x: Number(attr(boundsEl, "x") ?? "0"),
						y: Number(attr(boundsEl, "y") ?? "0"),
						width: Number(attr(boundsEl, "width") ?? "0"),
						height: Number(attr(boundsEl, "height") ?? "0"),
					},
				});
			}
		}

		for (const edgeEl of findChildren(diagramEl, "DMNEdge")) {
			const waypoints: DmnWaypoint[] = findChildren(edgeEl, "waypoint").map((wp) => ({
				x: Number(attr(wp, "x") ?? "0"),
				y: Number(attr(wp, "y") ?? "0"),
			}));
			edges.push({
				dmnElementRef: requiredAttr(edgeEl, "dmnElementRef"),
				waypoints,
			});
		}
	}

	return { shapes, edges };
}

/** Parse a DMN XML string into a typed DmnDefinitions model. */
export function parseDmn(xml: string): DmnDefinitions {
	const root = parseXml(xml);

	if (localName(root.name) !== "definitions") {
		throw new Error(`Expected <definitions> root element, got <${root.name}>`);
	}

	// Extract namespace declarations
	const namespaces: Record<string, string> = {};
	const modelerAttributes: Record<string, string> = {};

	for (const [key, value] of Object.entries(root.attributes)) {
		if (key.startsWith("xmlns:")) {
			namespaces[key.slice(6)] = value;
		} else if (key === "xmlns") {
			namespaces[""] = value;
		} else if (key.startsWith("modeler:")) {
			modelerAttributes[key.slice(8)] = value;
		}
	}

	const decisions = findChildren(root, "decision").map(parseDecision);
	const inputData = findChildren(root, "inputData").map(parseInputData);
	const knowledgeSources = findChildren(root, "knowledgeSource").map(parseKnowledgeSource);
	const businessKnowledgeModels = findChildren(root, "businessKnowledgeModel").map(
		parseBusinessKnowledgeModel,
	);
	const textAnnotations = findChildren(root, "textAnnotation").map(parseTextAnnotation);
	const associations = findChildren(root, "association").map(parseAssociation);

	const dmndiEl = findChild(root, "DMNDI");
	const diagram = dmndiEl ? parseDiagram(dmndiEl) : undefined;

	return {
		id: requiredAttr(root, "id"),
		name: requiredAttr(root, "name"),
		namespace: attr(root, "namespace") ?? DMN_NS,
		exporter: attr(root, "exporter"),
		exporterVersion: attr(root, "exporterVersion"),
		namespaces,
		modelerAttributes,
		decisions,
		inputData,
		knowledgeSources,
		businessKnowledgeModels,
		textAnnotations,
		associations,
		diagram,
	};
}
