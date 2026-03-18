import type { BpmnDefinitions, XmlElement } from "@bpmnkit/core"
import { zeebeExtensionsToXmlElements } from "@bpmnkit/core"
/**
 * Converts a Camunda element template into the PanelSchema + PanelAdapter pair
 * used by the config-panel plugin renderer.
 */
import type { FieldSchema, FieldValue, PanelAdapter, PanelSchema } from "../config-panel/index.js"
import type {
	ElementTemplate,
	TemplateBinding,
	TemplateCondition,
	TemplateProperty,
} from "./template-types.js"
import {
	findFlowElement,
	getAdHocAttr,
	getIoInput,
	getTaskHeader,
	parseZeebeExtensions,
	updateFlowElement,
	xmlLocalName,
} from "./util.js"

// ── Condition conversion ──────────────────────────────────────────────────────

function buildConditionFn(
	cond: TemplateCondition,
): (values: Record<string, FieldValue>) => boolean {
	if ("allMatch" in cond) {
		const fns = cond.allMatch.map((c) => buildConditionFn(c as TemplateCondition))
		return (values) => fns.every((fn) => fn(values))
	}
	if ("equals" in cond) {
		return (values) => values[cond.property] === cond.equals
	}
	if ("oneOf" in cond) {
		const set = new Set(cond.oneOf)
		return (values) => set.has(values[cond.property] as string)
	}
	if ("isActive" in cond) {
		const expected = cond.isActive
		return (values) => Boolean(values[cond.property]) === expected
	}
	return () => true
}

// ── Property key derivation ───────────────────────────────────────────────────

/**
 * Derive the panel field key for a template property.
 *
 * The key is used as:
 * - The field key in PanelSchema (for rendering + condition references)
 * - The value-map key in the adapter (for read/write)
 *
 * Priority: property.id > binding-derived name
 */
function getPropertyKey(prop: TemplateProperty): string {
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

// ── Property → FieldSchema ────────────────────────────────────────────────────

function propToFieldSchema(prop: TemplateProperty): FieldSchema {
	const key = getPropertyKey(prop)
	const condition = prop.condition ? buildConditionFn(prop.condition) : undefined

	const base: FieldSchema = {
		key,
		label: prop.label ?? key,
		type: "text",
		placeholder: prop.placeholder,
		hint: prop.description,
		tooltip: prop.tooltip,
		condition,
		...(prop.constraints?.notEmpty === true ? { required: true } : {}),
	}

	// FEEL mode: "optional" → toggle, "required" → fixed (always FEEL, no toggle)
	const feelOptional = prop.feel === "optional"
	const feelRequired = prop.feel === "required"
	const hasFeel = feelOptional || feelRequired

	switch (prop.type) {
		case "Text":
			if (hasFeel) {
				return { ...base, type: "feel-expression", ...(feelRequired ? { feelFixed: true } : {}) }
			}
			return { ...base, type: "textarea" }

		case "Dropdown":
			return {
				...base,
				type: "select",
				searchable: true,
				options: (prop.choices ?? []).map((c) => ({ value: c.value, label: c.name })),
			}

		case "Boolean":
			return { ...base, type: "toggle" }

		case "Number":
			return {
				...base,
				type: "text",
				placeholder: prop.placeholder ?? String(prop.value ?? ""),
			}

		default:
			// String
			if (hasFeel) {
				return { ...base, type: "feel-expression", ...(feelRequired ? { feelFixed: true } : {}) }
			}
			return base
	}
}

// ── Adapter read/write helpers ────────────────────────────────────────────────

function readPropertyValue(
	ext: ReturnType<typeof parseZeebeExtensions>,
	el: { name?: string; extensionElements: XmlElement[] },
	prop: TemplateProperty,
): string | undefined {
	const b = prop.binding
	if (b.type === "zeebe:input") return getIoInput(ext, b.name)
	if (b.type === "zeebe:taskHeader") return getTaskHeader(ext, b.key)
	if (b.type === "zeebe:taskDefinition" && b.property === "type") return ext.taskDefinition?.type
	if (b.type === "zeebe:taskDefinition" && b.property === "retries")
		return ext.taskDefinition?.retries
	if (b.type === "zeebe:taskDefinition:type") return ext.taskDefinition?.type
	if (b.type === "property" && b.name === "name") return el.name
	if (b.type === "zeebe:adHoc") return getAdHocAttr(el.extensionElements, b.property)
	return undefined
}

function applyBinding(
	binding: TemplateBinding,
	value: string,
	inputs: Array<{ source: string; target: string }>,
	headers: Array<{ key: string; value: string }>,
	taskDef: { type?: string; retries?: string },
	adHocProps: {
		outputCollection?: string
		outputElement?: string
		activeElementsCollection?: string
	},
): void {
	if (binding.type === "zeebe:input") {
		inputs.push({ source: value, target: binding.name })
	} else if (binding.type === "zeebe:taskHeader") {
		headers.push({ key: binding.key, value })
	} else if (binding.type === "zeebe:taskDefinition" && binding.property === "type") {
		taskDef.type = value
	} else if (binding.type === "zeebe:taskDefinition" && binding.property === "retries") {
		taskDef.retries = value
	} else if (binding.type === "zeebe:taskDefinition:type") {
		taskDef.type = value
	} else if (binding.type === "zeebe:adHoc") {
		if (binding.property === "outputCollection") adHocProps.outputCollection = value
		else if (binding.property === "outputElement") adHocProps.outputElement = value
		else if (binding.property === "activeElementsCollection")
			adHocProps.activeElementsCollection = value
	}
}

// ── Public: build schema + adapter from template ──────────────────────────────

export interface TemplateRegistration {
	schema: PanelSchema
	adapter: PanelAdapter
}

/**
 * Builds a PanelSchema + PanelAdapter pair from an element template descriptor.
 * The result is cached by the caller (per template id) so reference-equality
 * comparisons in the renderer work correctly.
 */
export function buildRegistrationFromTemplate(template: ElementTemplate): TemplateRegistration {
	// Collect visible (non-hidden) properties and their keys
	const visibleProps = template.properties.filter((p) => p.type !== "Hidden")
	const propsByKey = new Map<string, TemplateProperty>()
	for (const prop of visibleProps) {
		const key = getPropertyKey(prop)
		if (key) propsByKey.set(key, prop)
	}

	// Collect hidden properties (written at save time with their fixed default values)
	const hiddenProps = template.properties.filter((p) => p.type === "Hidden")

	// Group visible properties by their group id
	const byGroup = new Map<string, TemplateProperty[]>()
	const ungrouped: TemplateProperty[] = []
	for (const prop of visibleProps) {
		if (prop.group) {
			const arr = byGroup.get(prop.group)
			if (arr) arr.push(prop)
			else byGroup.set(prop.group, [prop])
		} else {
			ungrouped.push(prop)
		}
	}

	// Build schema groups
	// "General" group always comes first: name + any ungrouped properties
	const nameField: FieldSchema = {
		key: "name",
		label: "Name",
		type: "text",
		placeholder: "Task name",
	}

	/**
	 * Action button that strips the zeebe:modelerTemplate stamp so the renderer
	 * falls back to the generic connector selector on the next diagram:change.
	 * The sentinel value "__change_connector" is intercepted by write() below.
	 */
	const changeConnectorField: FieldSchema = {
		key: "__change_connector",
		label: "Change connector",
		type: "action",
		hint: "Switch to a different connector or custom task type.",
		onClick: (_values, setValue) => {
			setValue("__change_connector", "remove")
		},
	}

	const generalFields: FieldSchema[] = [
		nameField,
		changeConnectorField,
		...ungrouped.map((p) => propToFieldSchema(p)),
	]

	const schemaGroups = [{ id: "general", label: "General", fields: generalFields }]

	for (const tg of template.groups ?? []) {
		const props = byGroup.get(tg.id)
		if (!props || props.length === 0) continue
		schemaGroups.push({
			id: tg.id,
			label: tg.label,
			fields: props.map((p) => propToFieldSchema(p)),
		})
	}

	const schema: PanelSchema = {
		compact: [nameField],
		groups: schemaGroups,
		...(template.documentationRef ? { docsUrl: template.documentationRef } : {}),
		templateName: template.name,
	}

	// Build adapter
	const adapter: PanelAdapter = {
		read(defs: BpmnDefinitions, id: string): Record<string, FieldValue> {
			const el = findFlowElement(defs, id)
			if (!el) return {}

			const ext = parseZeebeExtensions(el.extensionElements)
			const values: Record<string, FieldValue> = { name: el.name ?? "" }

			for (const [key, prop] of propsByKey) {
				const raw = readPropertyValue(ext, el, prop)
				// Fall back to template default when not yet written to XML
				values[key] = raw ?? String(prop.value ?? "")
			}
			return values
		},

		write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
			// "Change connector" button — strip the template stamp so the renderer
			// falls back to the generic connector selector on the next render.
			if (values.__change_connector === "remove") {
				return updateFlowElement(defs, id, (el) => {
					const {
						"zeebe:modelerTemplate": _tm,
						"zeebe:modelerTemplateVersion": _tmv,
						"zeebe:modelerTemplateIcon": _tmi,
						...rest
					} = el.unknownAttributes
					return { ...el, unknownAttributes: rest }
				})
			}

			return updateFlowElement(defs, id, (el) => {
				const name = typeof values.name === "string" ? values.name || undefined : el.name

				const inputs: Array<{ source: string; target: string }> = []
				const headers: Array<{ key: string; value: string }> = []
				const taskDef: { type?: string; retries?: string } = {}
				const adHocProps: {
					outputCollection?: string
					outputElement?: string
					activeElementsCollection?: string
				} = {}

				// 1. Apply hidden properties first (fixed default values)
				for (const prop of hiddenProps) {
					const val = String(prop.value ?? "")
					if (val) applyBinding(prop.binding, val, inputs, headers, taskDef, adHocProps)
				}

				// 2. Apply user-entered values for visible properties
				for (const [key, prop] of propsByKey) {
					const raw = values[key]
					const val = typeof raw === "boolean" ? String(raw) : typeof raw === "string" ? raw : ""
					const isBlank = val === "" || val === undefined

					// Skip optional blank values — don't write to XML
					if (isBlank && prop.optional) continue
					// Skip truly blank fields with no default
					if (isBlank && prop.value === undefined) continue

					const effectiveVal = val !== "" ? val : String(prop.value ?? "")
					if (!effectiveVal) continue

					applyBinding(prop.binding, effectiveVal, inputs, headers, taskDef, adHocProps)
				}

				// Preserve non-Zeebe extension elements
				const ZEEBE_LOCAL = new Set(["taskDefinition", "ioMapping", "taskHeaders", "adHoc"])
				const otherExts = el.extensionElements.filter((x) => !ZEEBE_LOCAL.has(xmlLocalName(x.name)))

				const newZeebeExts = zeebeExtensionsToXmlElements({
					taskDefinition: taskDef.type
						? { type: taskDef.type, retries: taskDef.retries || undefined }
						: undefined,
					ioMapping: inputs.length > 0 ? { inputs, outputs: [] } : undefined,
					taskHeaders: headers.length > 0 ? { headers } : undefined,
					adHoc:
						(adHocProps.outputCollection ??
						adHocProps.outputElement ??
						adHocProps.activeElementsCollection)
							? adHocProps
							: undefined,
				})

				return {
					...el,
					name,
					extensionElements: [...otherExts, ...newZeebeExts],
					// Stamp the modelerTemplate attribute so the editor recognizes it
					unknownAttributes: {
						...el.unknownAttributes,
						"zeebe:modelerTemplate": template.id,
						...(template.version !== undefined
							? { "zeebe:modelerTemplateVersion": String(template.version) }
							: {}),
						...(template.icon?.contents
							? { "zeebe:modelerTemplateIcon": template.icon.contents }
							: {}),
					},
				}
			})
		},
	}

	return { schema, adapter }
}
