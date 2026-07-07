import type { ElementTemplate, TemplateCondition, TemplateProperty } from "./template-types.js"
import { CAMUNDA_CONNECTOR_TEMPLATES } from "./templates/generated.js"

/** Where in the process a connector template attaches. */
export type ConnectorDirection =
	| "outbound"
	| "inbound-start"
	| "inbound-intermediate"
	| "inbound-boundary"
	/** The AI Agent Sub-process connector — an ad-hoc sub-process, not a single task. */
	| "agentic"

/** One user-configurable (non-Hidden) property on a connector template. */
export interface ConnectorInputSpec {
	/** Lookup key — matches the keys `applyConnectorTemplate()` expects in its `values` argument. */
	key: string
	label: string
	description?: string
	/** True for fields whose label/key suggest a credential (API key, token, password, secret). */
	isSecret: boolean
	/** True if the field's value is interpreted as FEEL (a leading "=" makes it an expression). */
	isFeel: boolean
	default?: string | number | boolean
	choices?: Array<{ name: string; value: string }>
	/** This field only applies (and is only required) when this condition holds against other values. */
	condition?: TemplateCondition
}

/** A connector template reduced to what a skill or LLM needs to select and configure it. */
export interface ConnectorSummary {
	id: string
	name: string
	description?: string
	/** Zeebe job type this template sets, e.g. "io.camunda:slack:1". Absent for some inbound templates. */
	taskType?: string
	appliesTo: string[]
	direction: ConnectorDirection
	keywords: string[]
	requiredInputs: ConnectorInputSpec[]
	optionalInputs: ConnectorInputSpec[]
}

const SECRET_PATTERN = /token|secret|password|api.?key|apikey|credential|access.?key/i

function isSecretField(prop: TemplateProperty, key: string): boolean {
	return SECRET_PATTERN.test(`${prop.label ?? ""} ${key}`)
}

/** Same key-derivation logic used at apply time — kept in sync with `apply.ts`. */
export function propertyKey(prop: TemplateProperty): string {
	if (prop.id) return prop.id
	const b = prop.binding
	if (b.type === "zeebe:input") return b.name
	if (b.type === "zeebe:output") return b.source
	if (b.type === "zeebe:taskHeader") return b.key
	if (b.type === "zeebe:taskDefinition") return `taskDef.${b.property}`
	if (b.type === "zeebe:taskDefinition:type") return "taskDef.type"
	if (b.type === "property") return b.name
	if (b.type === "zeebe:property") return b.name
	if (b.type === "zeebe:adHoc") return `adHoc.${b.property}`
	return ""
}

function toInputSpec(prop: TemplateProperty): ConnectorInputSpec {
	const key = propertyKey(prop)
	return {
		key,
		label: prop.label ?? key,
		description: prop.description,
		isSecret: isSecretField(prop, key),
		isFeel: prop.feel === "required" || prop.feel === "optional",
		default: prop.value,
		choices: prop.choices,
		condition: prop.condition,
	}
}

function taskDefinitionType(template: ElementTemplate): string | undefined {
	for (const prop of template.properties) {
		if (prop.binding.type === "zeebe:taskDefinition" && prop.binding.property === "type") {
			return typeof prop.value === "string" ? prop.value : undefined
		}
		if (prop.binding.type === "zeebe:taskDefinition:type") {
			return typeof prop.value === "string" ? prop.value : undefined
		}
	}
	return undefined
}

function directionOf(template: ElementTemplate): ConnectorDirection {
	const elementType = template.elementType?.value ?? template.appliesTo[0]
	switch (elementType) {
		case "bpmn:AdHocSubProcess":
			return "agentic"
		case "bpmn:StartEvent":
			return "inbound-start"
		case "bpmn:IntermediateCatchEvent":
		case "bpmn:IntermediateThrowEvent":
		case "bpmn:ReceiveTask":
			return "inbound-intermediate"
		case "bpmn:BoundaryEvent":
			return "inbound-boundary"
		default:
			return "outbound"
	}
}

function keywordsOf(template: ElementTemplate): string[] {
	const words = new Set<string>()
	for (const raw of `${template.name} ${template.description ?? ""}`
		.toLowerCase()
		.split(/[^a-z0-9]+/)) {
		if (raw.length > 2) words.add(raw)
	}
	return [...words]
}

function summarize(template: ElementTemplate): ConnectorSummary {
	const visible = template.properties.filter((p) => p.type !== "Hidden")
	return {
		id: template.id,
		name: template.name,
		description: template.description,
		taskType: taskDefinitionType(template),
		appliesTo: template.appliesTo,
		direction: directionOf(template),
		keywords: keywordsOf(template),
		requiredInputs: visible.filter((p) => p.constraints?.notEmpty === true).map(toInputSpec),
		optionalInputs: visible.filter((p) => p.constraints?.notEmpty !== true).map(toInputSpec),
	}
}

let cachedSummaries: ConnectorSummary[] | undefined

/** All bundled Camunda 8 out-of-the-box connector templates, reduced to a compact summary. */
export function listConnectors(): ConnectorSummary[] {
	if (!cachedSummaries) {
		cachedSummaries = CAMUNDA_CONNECTOR_TEMPLATES.map(summarize)
	}
	return cachedSummaries
}

/** The full element template for a given template id, if bundled. */
export function getTemplate(id: string): ElementTemplate | undefined {
	return CAMUNDA_CONNECTOR_TEMPLATES.find((t) => t.id === id)
}

/** Tie-break preference when two templates score equally — outbound "do this" connectors are the common case. */
const DIRECTION_RANK: Record<ConnectorDirection, number> = {
	outbound: 0,
	agentic: 1,
	"inbound-start": 2,
	"inbound-intermediate": 3,
	"inbound-boundary": 4,
}

/**
 * Keyword-scored search over the bundled connector catalog — mirrors
 * `@bpmnkit/patterns`' `findPattern()` matching style. Matches against the
 * template name are weighted highest, then keyword-list matches, then a
 * general substring match; ties prefer outbound connectors.
 */
export function searchConnectors(query: string): ConnectorSummary[] {
	const terms = query
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter((t) => t.length > 1)
	if (terms.length === 0) return []

	const scored = listConnectors()
		.map((summary) => {
			const nameWords = new Set(summary.name.toLowerCase().split(/[^a-z0-9]+/))
			const haystack =
				`${summary.name} ${summary.description ?? ""} ${summary.keywords.join(" ")} ${summary.taskType ?? ""}`.toLowerCase()
			let score = 0
			for (const term of terms) {
				if (nameWords.has(term)) score += 4
				else if (summary.keywords.includes(term)) score += 3
				else if (haystack.includes(term)) score += 1
			}
			return { summary, score }
		})
		.filter((s) => s.score > 0)
		.sort(
			(a, b) =>
				b.score - a.score ||
				DIRECTION_RANK[a.summary.direction] - DIRECTION_RANK[b.summary.direction],
		)

	return scored.map((s) => s.summary)
}
