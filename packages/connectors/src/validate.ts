/**
 * Structural validation for Camunda element templates.
 *
 * The published JSON schema
 * (https://github.com/camunda/element-templates-json-schema) is the reference,
 * but a JSON-schema engine is a dependency this package does not otherwise
 * need, and a generic validator's messages ("must match exactly one schema in
 * oneOf") are worse than useless to someone who mistyped a binding. So the
 * rules the schema actually enforces are checked directly here, against the
 * same shapes `template-types.ts` declares and `apply.ts` consumes: a template
 * that passes is one this toolkit can render and apply, which is the question
 * the caller is really asking.
 */

import { APPLIED_BINDING_TYPES } from "./apply.js"
import type { ElementTemplate } from "./template-types.js"

/** One reason a template was rejected. */
export interface TemplateProblem {
	/** Where in the document, e.g. `properties[3].binding.type`. */
	path: string
	message: string
}

export interface TemplateValidation {
	valid: boolean
	/** Reasons the template is not usable. A template with any of these is invalid. */
	problems: TemplateProblem[]
	/**
	 * Things that are valid but will not do what the author expects here — today,
	 * a binding the schema defines that `applyElementTemplate` does not write.
	 * Warnings never make a template invalid.
	 */
	warnings: TemplateProblem[]
}

/** Property `type` values the schema allows. Absent means String. */
const PROPERTY_TYPES = new Set(["String", "Text", "Hidden", "Dropdown", "Boolean", "Number"])

/** FEEL modes the schema allows. */
const FEEL_MODES = new Set(["optional", "required", "static"])

/**
 * Binding types, mapped to the extra field each one requires. An empty list
 * means the binding needs nothing beyond its `type`.
 */
const BINDING_FIELDS: Record<string, readonly string[]> = {
	property: ["name"],
	"zeebe:taskDefinition:type": [],
	"zeebe:taskDefinition": ["property"],
	"zeebe:input": ["name"],
	"zeebe:output": ["source"],
	"zeebe:taskHeader": ["key"],
	"zeebe:property": ["name"],
	"zeebe:adHoc": ["property"],
	"bpmn:Message#property": ["name"],
	"bpmn:Message#zeebe:subscription#property": ["name"],
	"zeebe:linkedResource": ["property", "linkName"],
}

const TASK_DEFINITION_PROPERTIES = new Set(["type", "retries"])
const AD_HOC_PROPERTIES = new Set(["outputCollection", "outputElement", "activeElementsCollection"])

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim() !== ""
}

function checkBinding(
	binding: unknown,
	path: string,
	problems: TemplateProblem[],
	warnings: TemplateProblem[],
): void {
	if (!isRecord(binding)) {
		problems.push({ path, message: "binding must be an object" })
		return
	}
	const type = binding.type
	if (!isNonEmptyString(type)) {
		problems.push({ path: `${path}.type`, message: "binding.type is required" })
		return
	}
	if (!APPLIED_BINDING_TYPES.has(type) && BINDING_FIELDS[type] !== undefined) {
		warnings.push({
			path: `${path}.type`,
			message: `binding type "${type}" is valid but is not applied by this toolkit yet — the template will load, and this property will not be written`,
		})
	}

	const required = BINDING_FIELDS[type]
	if (required === undefined) {
		problems.push({
			path: `${path}.type`,
			message: `unknown binding type "${type}" — expected one of ${Object.keys(BINDING_FIELDS).join(", ")}`,
		})
		return
	}
	for (const field of required) {
		if (!isNonEmptyString(binding[field])) {
			problems.push({
				path: `${path}.${field}`,
				message: `binding of type "${type}" requires a non-empty "${field}"`,
			})
		}
	}
	if (type === "zeebe:taskDefinition" && isNonEmptyString(binding.property)) {
		if (!TASK_DEFINITION_PROPERTIES.has(binding.property)) {
			problems.push({
				path: `${path}.property`,
				message: `expected one of ${[...TASK_DEFINITION_PROPERTIES].join(", ")}`,
			})
		}
	}
	if (type === "zeebe:adHoc" && isNonEmptyString(binding.property)) {
		if (!AD_HOC_PROPERTIES.has(binding.property)) {
			problems.push({
				path: `${path}.property`,
				message: `expected one of ${[...AD_HOC_PROPERTIES].join(", ")}`,
			})
		}
	}
}

function checkProperty(
	property: unknown,
	path: string,
	problems: TemplateProblem[],
	warnings: TemplateProblem[],
): void {
	if (!isRecord(property)) {
		problems.push({ path, message: "property must be an object" })
		return
	}

	const type = property.type
	if (type !== undefined && (typeof type !== "string" || !PROPERTY_TYPES.has(type))) {
		problems.push({
			path: `${path}.type`,
			message: `unknown property type ${JSON.stringify(type)} — expected one of ${[...PROPERTY_TYPES].join(", ")}`,
		})
	}

	if (property.feel !== undefined) {
		if (typeof property.feel !== "string" || !FEEL_MODES.has(property.feel)) {
			problems.push({
				path: `${path}.feel`,
				message: `expected one of ${[...FEEL_MODES].join(", ")}`,
			})
		}
	}

	if (type === "Dropdown") {
		const choices = property.choices
		if (!Array.isArray(choices) || choices.length === 0) {
			problems.push({ path: `${path}.choices`, message: "a Dropdown property needs choices" })
		} else {
			choices.forEach((choice, index) => {
				if (!isRecord(choice) || !isNonEmptyString(choice.value)) {
					problems.push({
						path: `${path}.choices[${index}]`,
						message: "each choice needs a name and a value",
					})
				}
			})
		}
	}

	if (property.binding === undefined) {
		problems.push({ path: `${path}.binding`, message: "binding is required" })
		return
	}
	checkBinding(property.binding, `${path}.binding`, problems, warnings)
}

/**
 * Checks one value against the element-template shape.
 *
 * @param value - Parsed JSON, from a file or anywhere else.
 * @returns Every problem found, not just the first — a template with three
 *   mistakes should take one round trip to fix, not three.
 */
export function validateElementTemplate(value: unknown): TemplateValidation {
	const problems: TemplateProblem[] = []
	const warnings: TemplateProblem[] = []

	if (!isRecord(value)) {
		return {
			valid: false,
			problems: [{ path: "", message: "template must be a JSON object" }],
			warnings,
		}
	}

	if (!isNonEmptyString(value.id)) {
		problems.push({ path: "id", message: "id is required and must be a non-empty string" })
	}
	if (!isNonEmptyString(value.name)) {
		problems.push({ path: "name", message: "name is required and must be a non-empty string" })
	}

	if (value.version !== undefined && !Number.isInteger(value.version)) {
		problems.push({ path: "version", message: "version must be an integer" })
	}

	const appliesTo = value.appliesTo
	if (!Array.isArray(appliesTo) || appliesTo.length === 0) {
		problems.push({ path: "appliesTo", message: "appliesTo is required and must be non-empty" })
	} else {
		appliesTo.forEach((entry, index) => {
			if (!isNonEmptyString(entry)) {
				problems.push({ path: `appliesTo[${index}]`, message: "must be a BPMN type name" })
			} else if (!entry.startsWith("bpmn:")) {
				problems.push({
					path: `appliesTo[${index}]`,
					message: `expected a "bpmn:" type, got "${entry}"`,
				})
			}
		})
	}

	if (value.elementType !== undefined) {
		if (!isRecord(value.elementType) || !isNonEmptyString(value.elementType.value)) {
			problems.push({ path: "elementType.value", message: "elementType needs a value" })
		}
	}

	if (value.groups !== undefined) {
		if (!Array.isArray(value.groups)) {
			problems.push({ path: "groups", message: "groups must be an array" })
		} else {
			value.groups.forEach((group, index) => {
				if (!isRecord(group) || !isNonEmptyString(group.id)) {
					problems.push({ path: `groups[${index}].id`, message: "each group needs an id" })
				}
			})
		}
	}

	if (value.icon !== undefined) {
		if (!isRecord(value.icon) || !isNonEmptyString(value.icon.contents)) {
			problems.push({ path: "icon.contents", message: "icon needs contents" })
		}
	}

	const properties = value.properties
	if (!Array.isArray(properties)) {
		problems.push({ path: "properties", message: "properties is required and must be an array" })
	} else {
		properties.forEach((property, index) => {
			checkProperty(property, `properties[${index}]`, problems, warnings)
		})
	}

	return { valid: problems.length === 0, problems, warnings }
}

/** One template read out of a document, with the problems that rejected it. */
export interface TemplateDocumentResult {
	/** Templates that passed. */
	templates: ElementTemplate[]
	/** Problems, each naming the template index within the document. */
	problems: Array<TemplateProblem & { index: number; id?: string }>
	/** Warnings from the templates that passed, named the same way. */
	warnings: Array<TemplateProblem & { index: number; id?: string }>
}

/**
 * Reads a parsed template document, which Camunda allows to be either one
 * template or an array of them.
 *
 * A template that fails validation is reported and left out — never silently
 * dropped, and never allowed to take the rest of the file down with it.
 *
 * @param value - The parsed JSON of one `.json` file.
 */
export function readTemplateDocument(value: unknown): TemplateDocumentResult {
	const entries = Array.isArray(value) ? value : [value]
	const templates: ElementTemplate[] = []
	const problems: TemplateDocumentResult["problems"] = []
	const warnings: TemplateDocumentResult["warnings"] = []

	entries.forEach((entry, index) => {
		const result = validateElementTemplate(entry)
		const id = isRecord(entry) && typeof entry.id === "string" ? entry.id : undefined
		const locate = <T extends TemplateProblem>(problem: T) =>
			id === undefined ? { ...problem, index } : { ...problem, index, id }

		if (result.valid) {
			templates.push(entry as ElementTemplate)
			warnings.push(...result.warnings.map(locate))
			return
		}
		problems.push(...result.problems.map(locate))
	})

	return { templates, problems, warnings }
}
