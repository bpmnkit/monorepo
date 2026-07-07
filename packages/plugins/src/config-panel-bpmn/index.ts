/**
 * @bpmnkit/canvas-plugin-config-panel-bpmn — BPMN element schemas for the
 * config panel plugin.
 *
 * Registers config panel schemas for all standard BPMN element types. For
 * service tasks the panel is template-aware: when `zeebe:modelerTemplate` is
 * set on an element the matching template's property form is shown instead of
 * the generic connector selector.
 *
 * ## Usage
 * ```typescript
 * import { createConfigPanelPlugin } from "@bpmnkit/canvas-plugin-config-panel";
 * import { createConfigPanelBpmnPlugin } from "@bpmnkit/canvas-plugin-config-panel-bpmn";
 *
 * let editorRef: BpmnEditor | null = null;
 * const configPanel = createConfigPanelPlugin({
 *   getDefinitions: () => editorRef?.getDefinitions() ?? null,
 *   applyChange: (fn) => { editorRef?.applyChange(fn); },
 * });
 * const configPanelBpmn = createConfigPanelBpmnPlugin(configPanel);
 * const editor = new BpmnEditor({ container, xml, plugins: [configPanel, configPanelBpmn] });
 * editorRef = editor;
 * ```
 *
 * @packageDocumentation
 */

import type { CanvasPlugin } from "@bpmnkit/canvas"
import { CAMUNDA_CONNECTOR_TEMPLATES } from "@bpmnkit/connectors"
import type { ElementTemplate } from "@bpmnkit/connectors"
import type {
	BpmnConditionalEventDefinition,
	BpmnDefinitions,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnMultiInstanceLoopCharacteristics,
	BpmnTimerEventDefinition,
} from "@bpmnkit/core"
import {
	buildValidationDmn,
	findValidationStructure,
	insertValidationStructure,
	removeValidationStructure,
	validationDecisionId,
	zeebeExtensionsToXmlElements,
} from "@bpmnkit/core"
import type { InputVariableDef, ValidationVariableType } from "@bpmnkit/core"
import { ELEMENT_TYPE_LABELS } from "@bpmnkit/editor"
import type { CreateShapeType } from "@bpmnkit/editor"
import type {
	ConfigPanelPlugin,
	FieldValue,
	PanelAdapter,
	PanelSchema,
} from "../config-panel/index.js"
export { CAMUNDA_CONNECTOR_TEMPLATES } from "@bpmnkit/connectors"
import { buildRegistrationFromTemplate } from "./template-engine.js"
export { templateToServiceTaskOptions } from "./template-to-service-task.js"
import {
	buildPropertiesWithExampleOutput,
	buildZeebeLoopCharacteristics,
	findFlowElement,
	findSequenceFlow,
	getExampleOutputJson,
	getIoInput,
	getTaskHeader,
	parseCalledElement,
	parseZeebeError,
	parseZeebeEscalation,
	parseZeebeExtensions,
	parseZeebeLoopCharacteristics,
	parseZeebeMessage,
	parseZeebeScript,
	parseZeebeSignal,
	updateFlowElement,
	updateSequenceFlow,
	xmlLocalName,
} from "./util.js"

/** Validates that a field value is valid JSON, or returns an error message. */
function validateJson(value: FieldValue): string | null {
	if (typeof value !== "string" || value.trim() === "") return null
	try {
		JSON.parse(value)
		return null
	} catch (e) {
		return e instanceof SyntaxError ? e.message : "Invalid JSON"
	}
}

// ── Built-in template registry ────────────────────────────────────────────────

/**
 * All built-in Camunda connector templates, keyed by template id.
 * Pre-built so that reference-equality comparisons in the renderer work.
 */
const TEMPLATE_REGISTRY = new Map<string, ReturnType<typeof buildRegistrationFromTemplate>>()

/** Templates applicable to service tasks. */
const SERVICE_TASK_TEMPLATES = CAMUNDA_CONNECTOR_TEMPLATES.filter(
	(t) => t.appliesTo.includes("bpmn:ServiceTask") || t.appliesTo.includes("bpmn:Task"),
)

/** Extract the fixed task definition type from a template's Hidden binding. */
function extractTaskType(t: ElementTemplate): string | undefined {
	for (const p of t.properties) {
		if (typeof p.value !== "string") continue
		if (
			(p.binding.type === "zeebe:taskDefinition" &&
				"property" in p.binding &&
				p.binding.property === "type") ||
			p.binding.type === "zeebe:taskDefinition:type"
		) {
			return p.value
		}
	}
	return undefined
}

// Register all Camunda connector templates
for (const tpl of CAMUNDA_CONNECTOR_TEMPLATES) {
	TEMPLATE_REGISTRY.set(tpl.id, buildRegistrationFromTemplate(tpl))
}

/**
 * Task definition type → template id mapping (first-wins; used for
 * backward-compat detection in `read` when `zeebe:modelerTemplate` is absent).
 */
const TASK_TYPE_TO_TEMPLATE_ID = new Map<string, string>()
for (const tpl of SERVICE_TASK_TEMPLATES) {
	const taskType = extractTaskType(tpl)
	if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
		TASK_TYPE_TO_TEMPLATE_ID.set(taskType, tpl.id)
	}
}

// ── General schema (all flow element types) ───────────────────────────────────

const GENERAL_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Element name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Element name" },
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation for this element…",
				},
			],
		},
	],
}

const GENERAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => ({
			...el,
			name: typeof values.name === "string" ? values.name : el.name,
			documentation:
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation,
		}))
	},
}

// ── Service task schema (generic — shown when no template is applied) ─────────

const CUSTOM_TASK_TYPE = ""

const IS_CUSTOM = (values: Record<string, FieldValue>) => values.connector === CUSTOM_TASK_TYPE

/**
 * Connector selector options keyed by template id (not task type) so each of
 * the 116+ connectors gets its own entry, even when multiple share a task type.
 */
const CONNECTOR_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	...SERVICE_TASK_TEMPLATES.flatMap((t) =>
		extractTaskType(t) ? [{ value: t.id, label: t.name }] : [],
	).sort((a, b) => a.label.localeCompare(b.label)),
]

const GENERIC_SERVICE_TASK_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
				{
					key: "connector",
					label: "Connector",
					type: "select",
					searchable: true,
					options: CONNECTOR_OPTIONS,
					hint: "Select a Camunda connector or use a custom job worker type.",
				},
				{
					key: "taskType",
					label: "Task type",
					type: "text",
					placeholder: "e.g. my-worker-type",
					hint: "Zeebe job type string consumed by your worker.",
					condition: IS_CUSTOM,
					required: true,
				},
				{ key: "retries", label: "Retries", type: "text", placeholder: "3" },
				{
					key: "exampleOutputJson",
					label: "Example output (JSON)",
					type: "textarea",
					placeholder: '{"myVariable": "value"}',
					hint: "Mock output written to process variables in play mode when no job worker is registered.",
					validate: validateJson,
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const SERVICE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const ext = parseZeebeExtensions(el.extensionElements)
		const definitionType = ext.taskDefinition?.type ?? ""
		// Detect template via explicit attribute OR by known task type (backward-compat)
		const hasTemplate =
			Boolean(el.unknownAttributes?.["zeebe:modelerTemplate"]) ||
			TASK_TYPE_TO_TEMPLATE_ID.has(definitionType)
		// Connector selector value = the task definition type when template is active
		const connector = hasTemplate ? definitionType : CUSTOM_TASK_TYPE

		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			connector,
			taskType: connector === CUSTOM_TASK_TYPE ? definitionType : "",
			retries: ext.taskDefinition?.retries ?? "",
			exampleOutputJson: getExampleOutputJson(ext),
		}
	},

	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const connectorVal = strVal(values.connector)
		const isCustom = connectorVal === CUSTOM_TASK_TYPE
		// connector is either a template id (new) or a task type (backward-compat read)
		const newTemplateId = isCustom
			? undefined
			: TEMPLATE_REGISTRY.has(connectorVal)
				? connectorVal
				: TASK_TYPE_TO_TEMPLATE_ID.get(connectorVal)

		if (newTemplateId) {
			// Switching to (or already on) a template: stamp the attribute then delegate
			// all field writing to the template adapter so it handles template-specific fields.
			const withAttr = updateFlowElement(defs, id, (el) => ({
				...el,
				name: typeof values.name === "string" ? values.name || undefined : el.name,
				unknownAttributes: {
					...el.unknownAttributes,
					"zeebe:modelerTemplate": newTemplateId,
				},
			}))
			const templateReg = TEMPLATE_REGISTRY.get(newTemplateId)
			if (templateReg) return templateReg.adapter.write(withAttr, id, values)
			return withAttr
		}

		// Custom task or clearing a template
		return updateFlowElement(defs, id, (el) => {
			const name = typeof values.name === "string" ? values.name : el.name
			const documentation =
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation
			const taskType = strVal(values.taskType)
			const retries = strVal(values.retries)
			const exampleOutputJson = strVal(values.exampleOutputJson)

			const currentExt = parseZeebeExtensions(el.extensionElements)
			const newProperties = buildPropertiesWithExampleOutput(currentExt, exampleOutputJson)

			const ZEEBE_EXTS = new Set(["taskDefinition", "ioMapping", "taskHeaders", "properties"])
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_EXTS.has(xmlLocalName(x.name)))

			const newZeebeExts = zeebeExtensionsToXmlElements({
				taskDefinition: taskType ? { type: taskType, retries: retries || undefined } : undefined,
				properties: newProperties,
			})

			// Remove modelerTemplate attribute when switching to custom
			const {
				"zeebe:modelerTemplate": _t,
				"zeebe:modelerTemplateVersion": _v,
				...rest
			} = el.unknownAttributes

			return {
				...el,
				name,
				documentation,
				extensionElements: [...otherExts, ...newZeebeExts],
				unknownAttributes: rest,
			}
		})
	},

	/**
	 * When `zeebe:modelerTemplate` is set on the element, switch to the
	 * matching template registration instead of the generic form.
	 */
	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return null
		const templateId = el.unknownAttributes?.["zeebe:modelerTemplate"]
		if (!templateId) return null
		return TEMPLATE_REGISTRY.get(templateId) ?? null
	},
}

// ── Ad-hoc subprocess schema (template-aware, shown for adHocSubProcess) ──────

/** Templates applicable to ad-hoc subprocesses (AI agent pattern). */
const ADHOC_SUBPROCESS_TEMPLATES = CAMUNDA_CONNECTOR_TEMPLATES.filter(
	(t) => t.appliesTo.includes("bpmn:SubProcess") || t.appliesTo.includes("bpmn:AdHocSubProcess"),
)

/** Connector selector for ad-hoc subprocess templates. */
const ADHOC_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	...ADHOC_SUBPROCESS_TEMPLATES.map((t) => ({ value: t.id, label: t.name })).sort((a, b) =>
		a.label.localeCompare(b.label),
	),
]

const GENERIC_ADHOC_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Subprocess name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Subprocess name" },
				{
					key: "connector",
					label: "Template",
					type: "select",
					searchable: true,
					options: ADHOC_OPTIONS,
					hint: "Attach a Camunda AI agent template or use a plain ad-hoc subprocess.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const ADHOC_SUBPROCESS_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			connector: el.unknownAttributes?.["zeebe:modelerTemplate"] ?? CUSTOM_TASK_TYPE,
		}
	},

	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const connectorVal = strVal(values.connector)
		const newTemplateId =
			connectorVal && connectorVal !== CUSTOM_TASK_TYPE && TEMPLATE_REGISTRY.has(connectorVal)
				? connectorVal
				: undefined

		if (newTemplateId) {
			const withAttr = updateFlowElement(defs, id, (el) => ({
				...el,
				name: typeof values.name === "string" ? values.name || undefined : el.name,
				unknownAttributes: { ...el.unknownAttributes, "zeebe:modelerTemplate": newTemplateId },
			}))
			const templateReg = TEMPLATE_REGISTRY.get(newTemplateId)
			if (templateReg) return templateReg.adapter.write(withAttr, id, values)
			return withAttr
		}

		// Custom or clearing a template
		return updateFlowElement(defs, id, (el) => {
			const {
				"zeebe:modelerTemplate": _t,
				"zeebe:modelerTemplateVersion": _v,
				"zeebe:modelerTemplateIcon": _i,
				...rest
			} = el.unknownAttributes
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				unknownAttributes: rest,
			}
		})
	},

	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return null
		const templateId = el.unknownAttributes?.["zeebe:modelerTemplate"]
		if (!templateId) return null
		return TEMPLATE_REGISTRY.get(templateId) ?? null
	},
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function strVal(v: FieldValue): string {
	return typeof v === "string" ? v : ""
}

// ── All element types that get the general schema ─────────────────────────────

const GENERAL_TYPES: CreateShapeType[] = [
	"sendTask",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
	"transaction",
	"manualTask",
	"task",
]

// ── Sub-process schema (general + multi-instance) ─────────────────────────────

const SUB_PROCESS_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Sub-process name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Sub-process name" },
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation for this element…",
				},
			],
		},
		{
			id: "multi-instance",
			label: "Multi-instance",
			fields: [
				// Guided setup button — visible only when no loop is configured
				{
					key: "_setupForEach",
					label: "Process each item in a list",
					type: "action",
					hint: "Configure this sub-process to run once for each item in a collection.",
					condition: (v) => v.multiInstanceMode === "none",
					onClick: (_values, setValue) => {
						setValue("multiInstanceMode", "parallel")
						setValue("elementVariable", "item")
					},
				},
				{
					key: "multiInstanceMode",
					label: "Loop type",
					type: "select",
					options: [
						{ value: "none", label: "None" },
						{ value: "parallel", label: "Parallel (for each, all at once)" },
						{ value: "sequential", label: "Sequential (for each, one at a time)" },
					],
					condition: (v) => v.multiInstanceMode !== "none",
				},
				{
					key: "collection",
					label: "Collection",
					type: "feel-expression",
					placeholder: "= emails",
					hint: "FEEL expression that returns the array to iterate over.",
					condition: (v) => v.multiInstanceMode !== "none",
				},
				{
					key: "elementVariable",
					label: "Element variable",
					type: "text",
					placeholder: "item",
					hint: "Variable name for the current iteration item. Available inside the sub-process as a process variable.",
					condition: (v) => v.multiInstanceMode !== "none",
				},
			],
		},
	],
}

const SUB_PROCESS_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const lc = "loopCharacteristics" in el ? el.loopCharacteristics : undefined
		const loop = parseZeebeLoopCharacteristics(lc?.extensionElements ?? [])
		let multiInstanceMode = "none"
		if (lc) {
			multiInstanceMode = lc.isSequential ? "sequential" : "parallel"
		}
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			multiInstanceMode,
			collection: loop?.inputCollection ?? "",
			elementVariable: loop?.inputElement ?? "",
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const mode = typeof values.multiInstanceMode === "string" ? values.multiInstanceMode : "none"
			const collection = typeof values.collection === "string" ? values.collection : ""
			const elementVariable =
				typeof values.elementVariable === "string" ? values.elementVariable : ""

			let loopCharacteristics: BpmnMultiInstanceLoopCharacteristics | undefined
			if (mode !== "none") {
				const extEls = collection
					? [
							buildZeebeLoopCharacteristics({
								inputCollection: collection,
								inputElement: elementVariable,
							}),
						]
					: []
				loopCharacteristics = {
					isSequential: mode === "sequential" ? true : undefined,
					extensionElements: extEls,
				}
			}

			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				loopCharacteristics,
			}
		})
	},
}

// ── User task schema (formId) ─────────────────────────────────────────────────

function makeUserTaskSchema(): PanelSchema {
	return {
		compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
					{
						key: "formId",
						label: "Form ID",
						type: "text",
						placeholder: "e.g. Form_0h3l094",
						hint: "ID of the Camunda Form linked to this user task.",
					},
					{
						key: "exampleOutputJson",
						label: "Example output (JSON)",
						type: "textarea",
						placeholder: '{"myVariable": "value"}',
						hint: "Mock output written to process variables in play mode when no job worker is registered.",
						validate: validateJson,
					},
					{
						key: "documentation",
						label: "Documentation",
						type: "textarea",
						placeholder: "Add notes or documentation…",
					},
				],
			},
		],
	}
}

const USER_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const ext = parseZeebeExtensions(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			formId: ext.formDefinition?.formId ?? "",
			exampleOutputJson: getExampleOutputJson(ext),
		}
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const formId = strVal(values.formId)
			const exampleOutputJson = strVal(values.exampleOutputJson)
			const currentExt = parseZeebeExtensions(el.extensionElements)
			const newProperties = buildPropertiesWithExampleOutput(currentExt, exampleOutputJson)
			const ZEEBE_FORM_NAMES = new Set(["userTask", "formDefinition", "properties"])
			const otherExts = el.extensionElements.filter(
				(x) => !ZEEBE_FORM_NAMES.has(xmlLocalName(x.name)),
			)
			const formExts = zeebeExtensionsToXmlElements({
				formDefinition: formId ? { formId } : undefined,
				properties: newProperties,
			})
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: [...otherExts, ...formExts],
			}
		})
	},
}

// ── Business rule task schema (decisionId + resultVariable) ──────────────────

function makeBusinessRuleTaskSchema(onOpenDmn?: (decisionId: string) => void): PanelSchema {
	return {
		compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
					{
						key: "decisionId",
						label: "Decision ID",
						type: "text",
						placeholder: "e.g. Decision_1m0rvzp",
						hint: "ID of the DMN decision to evaluate.",
					},
					{
						key: "_openDmn",
						label: "Open DMN",
						type: "action",
						hint: "Open the referenced DMN decision in the editor.",
						condition: (values) =>
							typeof values.decisionId === "string" && values.decisionId !== "",
						onClick: (values) => {
							const decId = values.decisionId as string | undefined
							if (decId) onOpenDmn?.(decId)
						},
					},
					{
						key: "resultVariable",
						label: "Result variable",
						type: "text",
						placeholder: "result",
						hint: "Process variable that receives the decision output.",
					},
					{
						key: "documentation",
						label: "Documentation",
						type: "textarea",
						placeholder: "Add notes or documentation…",
					},
				],
			},
		],
	}
}

const BUSINESS_RULE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const ext = parseZeebeExtensions(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			decisionId: ext.calledDecision?.decisionId ?? "",
			resultVariable: ext.calledDecision?.resultVariable ?? "",
		}
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const decisionId = strVal(values.decisionId)
			const resultVariable = strVal(values.resultVariable) || "result"
			const ZEEBE_DECISION_NAMES = new Set(["calledDecision"])
			const otherExts = el.extensionElements.filter(
				(x) => !ZEEBE_DECISION_NAMES.has(xmlLocalName(x.name)),
			)
			const decisionExts = decisionId
				? zeebeExtensionsToXmlElements({ calledDecision: { decisionId, resultVariable } })
				: []
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: [...otherExts, ...decisionExts],
			}
		})
	},
}

// ── Script task schema ────────────────────────────────────────────────────────

function makeScriptTaskSchema(onOpenFeelPlayground?: (expression: string) => void): PanelSchema {
	return {
		compact: [{ key: "name", label: "Name", type: "text", placeholder: "Task name" }],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Task name" },
					{
						key: "expression",
						label: "FEEL expression",
						type: "feel-expression",
						feelFixed: true,
						placeholder: "= someVariable",
						hint: "FEEL expression evaluated by the script engine.",
						...(onOpenFeelPlayground
							? {
									openInPlayground: (v) => {
										const expr = v.expression
										if (typeof expr === "string") onOpenFeelPlayground(expr.replace(/^=\s*/, ""))
									},
								}
							: {}),
					},
					{
						key: "resultVariable",
						label: "Result variable",
						type: "text",
						placeholder: "result",
						hint: "Process variable that receives the script output.",
					},
					{
						key: "documentation",
						label: "Documentation",
						type: "textarea",
						placeholder: "Add notes or documentation…",
					},
				],
			},
		],
	}
}

const SCRIPT_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const script = parseZeebeScript(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			expression: script.expression,
			resultVariable: script.resultVariable,
		}
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const expression = strVal(values.expression)
			const resultVariable = strVal(values.resultVariable)
			const ZEEBE_SCRIPT = new Set(["script"])
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_SCRIPT.has(xmlLocalName(x.name)))
			const scriptAttrs: Record<string, string> = { expression }
			if (resultVariable) scriptAttrs.resultVariable = resultVariable
			const scriptExt = expression
				? { name: "zeebe:script", attributes: scriptAttrs, children: [] }
				: null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: scriptExt ? [...otherExts, scriptExt] : otherExts,
			}
		})
	},
}

// ── Call activity schema ──────────────────────────────────────────────────────

function makeCallActivitySchema(): PanelSchema {
	return {
		compact: [{ key: "name", label: "Name", type: "text", placeholder: "Activity name" }],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Activity name" },
					{
						key: "processId",
						label: "Called process ID",
						type: "text",
						placeholder: "e.g. pdp-get-project-data",
						hint: "ID of the process definition to call.",
					},
					{
						key: "propagateAllChildVariables",
						label: "Propagate all child variables",
						type: "toggle",
					},
					{
						key: "documentation",
						label: "Documentation",
						type: "textarea",
						placeholder: "Add notes or documentation…",
					},
				],
			},
		],
	}
}

const CALL_ACTIVITY_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const called = parseCalledElement(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			processId: called.processId,
			propagateAllChildVariables: called.propagateAllChildVariables,
		}
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const pid = strVal(values.processId)
			const propagate =
				values.propagateAllChildVariables === true || values.propagateAllChildVariables === "true"
			const ZEEBE_CALLED = new Set(["calledElement"])
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_CALLED.has(xmlLocalName(x.name)))
			const calledExt = pid
				? {
						name: "zeebe:calledElement",
						attributes: {
							processId: pid,
							propagateAllChildVariables: String(propagate),
						},
						children: [],
					}
				: null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: calledExt ? [...otherExts, calledExt] : otherExts,
			}
		})
	},
}

// ── Sequence flow schema ──────────────────────────────────────────────────────

function makeSequenceFlowSchema(onOpenFeelPlayground?: (expression: string) => void): PanelSchema {
	return {
		compact: [
			{
				key: "conditionExpression",
				label: "Condition",
				type: "text",
				placeholder: "= expression",
				condition: (values) => values._sourceType === "exclusiveGateway",
			},
		],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Edge label" },
					{
						key: "conditionExpression",
						label: "Condition expression (FEEL)",
						type: "feel-expression",
						feelFixed: true,
						placeholder: '= someVariable = "value"',
						hint: "FEEL expression that must evaluate to true for this path to be taken.",
						condition: (values) => values._sourceType === "exclusiveGateway",
						...(onOpenFeelPlayground
							? {
									openInPlayground: (v) => {
										const expr = v.conditionExpression
										if (typeof expr === "string") onOpenFeelPlayground(expr.replace(/^=\s*/, ""))
									},
								}
							: {}),
					},
					{
						key: "isDefault",
						label: "Default flow",
						type: "toggle",
						hint: "Mark as default path taken when no other condition evaluates to true.",
						condition: (values) => values._sourceType === "exclusiveGateway",
					},
				],
			},
		],
	}
}

const SEQUENCE_FLOW_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const sf = findSequenceFlow(defs, id)
		if (!sf) return {}
		// Check whether this flow is the default of its source gateway
		const sourceEl = findFlowElement(defs, sf.sourceRef)
		const isDefault =
			sourceEl &&
			(sourceEl.type === "exclusiveGateway" ||
				sourceEl.type === "inclusiveGateway" ||
				sourceEl.type === "complexGateway") &&
			sourceEl.default === sf.id
		return {
			name: sf.name ?? "",
			conditionExpression: sf.conditionExpression?.text ?? "",
			isDefault: isDefault ?? false,
			_sourceType: sourceEl?.type ?? "",
		}
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const sf = findSequenceFlow(defs, id)
		const sourceRef = sf?.sourceRef

		// Condition expressions are only valid on outgoing flows of exclusive gateways
		const sourceEl = sf ? findFlowElement(defs, sf.sourceRef) : undefined
		const isExclusiveGateway = sourceEl?.type === "exclusiveGateway"

		// Update the sequence flow itself
		let result = updateSequenceFlow(defs, id, (flow) => {
			const expr = isExclusiveGateway ? strVal(values.conditionExpression) : undefined
			return {
				...flow,
				name: typeof values.name === "string" ? values.name || undefined : flow.name,
				conditionExpression: expr
					? { text: expr, attributes: { "xsi:type": "bpmn:tFormalExpression" } }
					: undefined,
			}
		})

		// Update the source gateway's default attribute
		if (sourceRef) {
			const sourceEl = findFlowElement(result, sourceRef)
			if (
				sourceEl &&
				(sourceEl.type === "exclusiveGateway" ||
					sourceEl.type === "inclusiveGateway" ||
					sourceEl.type === "complexGateway")
			) {
				const makeDefault = values.isDefault === true
				result = updateFlowElement(result, sourceRef, (el) => {
					if (
						el.type === "exclusiveGateway" ||
						el.type === "inclusiveGateway" ||
						el.type === "complexGateway"
					) {
						return { ...el, default: makeDefault ? id : undefined }
					}
					return el
				})
			}
		}

		return result
	},
}

// ── Timer event schema and adapter ────────────────────────────────────────────

const TIMER_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "timerType",
					label: "Timer type",
					type: "select",
					searchable: true,
					options: [
						{ value: "timeCycle", label: "Cycle" },
						{ value: "timeDuration", label: "Duration" },
						{ value: "timeDate", label: "Date" },
					],
				},
				{
					key: "timeCycle",
					label: "Cycle",
					type: "feel-expression",
					placeholder: '= "R5/PT10S"',
					hint: "ISO 8601 repeating interval, e.g. R5/PT10S.",
					condition: (v) => v.timerType === "timeCycle",
				},
				{
					key: "timeDuration",
					label: "Duration",
					type: "feel-expression",
					placeholder: '= duration("PT5M")',
					hint: "ISO 8601 duration, e.g. PT15S or P14D.",
					condition: (v) => v.timerType === "timeDuration",
				},
				{
					key: "timeDate",
					label: "Date",
					type: "feel-expression",
					placeholder: '= date and time("2025-01-01T09:00:00")',
					hint: "ISO 8601 date-time, e.g. 2025-01-01T09:00:00Z.",
					condition: (v) => v.timerType === "timeDate",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const TIMER_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		if (
			el.type !== "startEvent" &&
			el.type !== "intermediateCatchEvent" &&
			el.type !== "boundaryEvent"
		)
			return {}
		const timerDef = el.eventDefinitions.find(
			(d): d is BpmnTimerEventDefinition => d.type === "timer",
		)
		let timerType = "timeCycle"
		if (timerDef?.timeDuration !== undefined) timerType = "timeDuration"
		else if (timerDef?.timeDate !== undefined) timerType = "timeDate"
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			timerType,
			timeCycle: timerDef?.timeCycle ?? "",
			timeDuration: timerDef?.timeDuration ?? "",
			timeDate: timerDef?.timeDate ?? "",
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			if (
				el.type !== "startEvent" &&
				el.type !== "intermediateCatchEvent" &&
				el.type !== "boundaryEvent"
			)
				return el
			const timerType = strVal(values.timerType) || "timeCycle"
			const newTimerDef: BpmnTimerEventDefinition = { type: "timer" }
			if (timerType === "timeCycle") newTimerDef.timeCycle = strVal(values.timeCycle)
			else if (timerType === "timeDuration") newTimerDef.timeDuration = strVal(values.timeDuration)
			else newTimerDef.timeDate = strVal(values.timeDate)
			const hasDef = el.eventDefinitions.some((d) => d.type === "timer")
			const updatedDefs: BpmnEventDefinition[] = hasDef
				? el.eventDefinitions.map((d) => (d.type === "timer" ? newTimerDef : d))
				: [...el.eventDefinitions, newTimerDef]
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				eventDefinitions: updatedDefs,
			} as BpmnFlowElement
		})
	},
}

// ── Message event schema and adapter ──────────────────────────────────────────

const MESSAGE_EVENT_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "messageName",
					label: "Message name",
					type: "feel-expression",
					placeholder: '= "order-received"',
					hint: "Name of the message. FEEL expression.",
				},
				{
					key: "correlationKey",
					label: "Correlation key",
					type: "feel-expression",
					placeholder: "= orderId",
					hint: "Correlates the incoming message to a specific process instance.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const MESSAGE_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const msg = parseZeebeMessage(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			messageName: msg.name,
			correlationKey: msg.correlationKey,
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const messageName = strVal(values.messageName)
			const correlationKey = strVal(values.correlationKey)
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "message")
			const attrs: Record<string, string> = { name: messageName }
			if (correlationKey) attrs.correlationKey = correlationKey
			const msgExt = messageName ? { name: "zeebe:message", attributes: attrs, children: [] } : null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: msgExt ? [...otherExts, msgExt] : otherExts,
			}
		})
	},
}

// ── Signal event schema and adapter ───────────────────────────────────────────

const SIGNAL_EVENT_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "signalName",
					label: "Signal name",
					type: "feel-expression",
					placeholder: '= "mySignal"',
					hint: "Name of the signal. FEEL expression.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const SIGNAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const sig = parseZeebeSignal(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			signalName: sig.name,
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const signalName = strVal(values.signalName)
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "signal")
			const sigExt = signalName
				? { name: "zeebe:signal", attributes: { name: signalName }, children: [] }
				: null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: sigExt ? [...otherExts, sigExt] : otherExts,
			}
		})
	},
}

// ── Error event schema and adapter ────────────────────────────────────────────

const ERROR_EVENT_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "errorCode",
					label: "Error code",
					type: "feel-expression",
					placeholder: '= "error-code-value"',
					hint: "Error code for this event. FEEL expression.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const ERROR_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const err = parseZeebeError(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			errorCode: err.errorCode,
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const errorCode = strVal(values.errorCode)
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "error")
			const errExt = errorCode
				? { name: "zeebe:error", attributes: { errorCode }, children: [] }
				: null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: errExt ? [...otherExts, errExt] : otherExts,
			}
		})
	},
}

// ── Escalation event schema and adapter ───────────────────────────────────────

const ESCALATION_EVENT_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "escalationCode",
					label: "Escalation code",
					type: "feel-expression",
					placeholder: '= "escalation-code"',
					hint: "Escalation code for this event. FEEL expression.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const ESCALATION_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		const esc = parseZeebeEscalation(el.extensionElements)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			escalationCode: esc.escalationCode,
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const escalationCode = strVal(values.escalationCode)
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "escalation")
			const escExt = escalationCode
				? { name: "zeebe:escalation", attributes: { escalationCode }, children: [] }
				: null
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: escExt ? [...otherExts, escExt] : otherExts,
			}
		})
	},
}

// ── Conditional event schema and adapter ──────────────────────────────────────

const CONDITIONAL_EVENT_SCHEMA: PanelSchema = {
	compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
	groups: [
		{
			id: "general",
			label: "General",
			fields: [
				{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
				{
					key: "conditionExpression",
					label: "Condition expression",
					type: "feel-expression",
					feelFixed: true,
					placeholder: "= someVariable = true",
					hint: "FEEL expression that must evaluate to true for this event to trigger.",
				},
				{
					key: "documentation",
					label: "Documentation",
					type: "textarea",
					placeholder: "Add notes or documentation…",
				},
			],
		},
	],
}

const CONDITIONAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el) return {}
		if (
			el.type !== "startEvent" &&
			el.type !== "intermediateCatchEvent" &&
			el.type !== "boundaryEvent"
		)
			return {}
		const condDef = el.eventDefinitions.find(
			(d): d is BpmnConditionalEventDefinition => d.type === "conditional",
		)
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			conditionExpression: condDef?.condition ?? "",
		}
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			if (
				el.type !== "startEvent" &&
				el.type !== "intermediateCatchEvent" &&
				el.type !== "boundaryEvent"
			)
				return el
			const conditionExpression = strVal(values.conditionExpression)
			const newCondDef: BpmnConditionalEventDefinition = {
				type: "conditional",
				condition: conditionExpression || undefined,
			}
			const hasDef = el.eventDefinitions.some((d) => d.type === "conditional")
			const updatedDefs: BpmnEventDefinition[] = hasDef
				? el.eventDefinitions.map((d) => (d.type === "conditional" ? newCondDef : d))
				: [...el.eventDefinitions, newCondDef]
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				eventDefinitions: updatedDefs,
			} as BpmnFlowElement
		})
	},
}

// ── Event dispatcher adapters ─────────────────────────────────────────────────

/** Map an event definition type to the matching schema+adapter pair. */
function eventDefToRegistration(
	defType: string,
): { schema: PanelSchema; adapter: PanelAdapter } | null {
	switch (defType) {
		case "timer":
			return { schema: TIMER_SCHEMA, adapter: TIMER_ADAPTER }
		case "message":
			return { schema: MESSAGE_EVENT_SCHEMA, adapter: MESSAGE_ADAPTER }
		case "signal":
			return { schema: SIGNAL_EVENT_SCHEMA, adapter: SIGNAL_ADAPTER }
		case "error":
			return { schema: ERROR_EVENT_SCHEMA, adapter: ERROR_ADAPTER }
		case "escalation":
			return { schema: ESCALATION_EVENT_SCHEMA, adapter: ESCALATION_ADAPTER }
		case "conditional":
			return { schema: CONDITIONAL_EVENT_SCHEMA, adapter: CONDITIONAL_ADAPTER }
		default:
			return null
	}
}

const END_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el || el.type !== "endEvent") return null
		const defType = el.eventDefinitions[0]?.type
		if (!defType) return null
		return eventDefToRegistration(defType)
	},
}

const CATCH_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el || el.type !== "intermediateCatchEvent") return null
		const defType = el.eventDefinitions[0]?.type
		if (!defType) return null
		return eventDefToRegistration(defType)
	},
}

const THROW_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el || el.type !== "intermediateThrowEvent") return null
		const defType = el.eventDefinitions[0]?.type
		if (!defType) return null
		return eventDefToRegistration(defType)
	},
}

const BOUNDARY_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id)
		if (!el || el.type !== "boundaryEvent") return null
		const defType = el.eventDefinitions[0]?.type
		if (!defType) return null
		return eventDefToRegistration(defType)
	},
}

// ── Input validation wizard modal ─────────────────────────────────────────────

const VALIDATION_MODAL_CSS = `
.bpmnkit-val-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; z-index: 99999;
}
.bpmnkit-val-dialog {
  background: var(--bpmnkit-surface, #161626);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 10px; padding: 20px; width: 680px; max-width: 95vw; max-height: 85vh;
  display: flex; flex-direction: column; gap: 14px;
  font-family: var(--bpmnkit-font, system-ui, sans-serif);
  font-size: 13px; color: var(--bpmnkit-fg, #cdd6f4);
  box-shadow: 0 24px 64px rgba(0,0,0,0.7);
}
.bpmnkit-val-dialog h2 {
  font-size: 14px; font-weight: 600; margin: 0;
  color: var(--bpmnkit-fg, #cdd6f4);
}
.bpmnkit-val-dialog p.hint {
  font-size: 12px; color: var(--bpmnkit-fg-muted, #8888a8); margin: 0;
}
.bpmnkit-val-table { overflow-y: auto; flex: 1; }
.bpmnkit-val-table table {
  width: 100%; border-collapse: collapse; font-size: 12px;
}
.bpmnkit-val-table th {
  text-align: left; padding: 6px 8px; font-weight: 500;
  color: var(--bpmnkit-fg-muted, #8888a8); font-size: 11px; text-transform: uppercase;
  border-bottom: 1px solid var(--bpmnkit-border, #2a2a42);
}
.bpmnkit-val-table td { padding: 4px 4px; vertical-align: middle; }
.bpmnkit-val-table input[type=text], .bpmnkit-val-table input[type=number], .bpmnkit-val-table select {
  background: var(--bpmnkit-surface-2, #1e1e2e);
  border: 1px solid var(--bpmnkit-border, #2a2a42);
  border-radius: 4px; padding: 4px 7px; font-size: 12px;
  color: var(--bpmnkit-fg, #cdd6f4); width: 100%; box-sizing: border-box;
}
.bpmnkit-val-table input[type=text]:focus, .bpmnkit-val-table input[type=number]:focus,
.bpmnkit-val-table select:focus {
  outline: none; border-color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-val-table input:disabled, .bpmnkit-val-table select:disabled {
  opacity: 0.35; cursor: not-allowed;
}
.bpmnkit-val-chk { display: flex; align-items: center; justify-content: center; }
.bpmnkit-val-chk input[type=checkbox] { width: 14px; height: 14px; cursor: pointer; }
.bpmnkit-val-del {
  background: none; border: none; cursor: pointer; padding: 2px 6px; border-radius: 4px;
  color: var(--bpmnkit-fg-muted, #8888a8); font-size: 14px; line-height: 1;
}
.bpmnkit-val-del:hover { color: var(--bpmnkit-danger, #f87171); background: var(--bpmnkit-surface-2, #1e1e2e); }
.bpmnkit-val-add {
  background: none; border: 1px dashed var(--bpmnkit-border, #2a2a42); border-radius: 6px;
  padding: 6px 12px; font-size: 12px; cursor: pointer; width: 100%;
  color: var(--bpmnkit-fg-muted, #8888a8); margin-top: 4px;
}
.bpmnkit-val-add:hover { border-color: var(--bpmnkit-accent, #6b9df7); color: var(--bpmnkit-accent, #6b9df7); }
.bpmnkit-val-actions { display: flex; justify-content: flex-end; gap: 8px; }
.bpmnkit-val-btn {
  padding: 6px 16px; border-radius: 6px; font-size: 12px; font-weight: 500;
  cursor: pointer; border: 1px solid var(--bpmnkit-border, #2a2a42);
  background: var(--bpmnkit-surface-2, #1e1e2e); color: var(--bpmnkit-fg, #cdd6f4);
}
.bpmnkit-val-btn:hover { background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15)); }
.bpmnkit-val-btn--primary {
  background: var(--bpmnkit-accent, #6b9df7); color: #fff; border-color: var(--bpmnkit-accent, #6b9df7);
}
.bpmnkit-val-btn--primary:hover { filter: brightness(1.1); }
.bpmnkit-val-summary {
  background: var(--bpmnkit-surface-2, #1e1e2e); border-radius: 6px; padding: 8px 10px;
  font-size: 12px; display: flex; flex-direction: column; gap: 3px;
}
.bpmnkit-val-summary-row { display: flex; gap: 6px; align-items: baseline; }
.bpmnkit-val-summary-name { color: var(--bpmnkit-accent-bright, #89b4fa); font-weight: 500; }
.bpmnkit-val-summary-meta { color: var(--bpmnkit-fg-muted, #8888a8); }
.bpmnkit-val-summary-badge {
  font-size: 10px; padding: 1px 5px; border-radius: 3px; font-weight: 500;
  background: var(--bpmnkit-accent-subtle, rgba(107,157,247,0.15));
  color: var(--bpmnkit-accent-bright, #89b4fa);
}
.bpmnkit-val-summary-badge--req {
  background: rgba(249,115,22,0.15); color: #fb923c;
}
`

function injectValidationModalCss(): void {
	const id = "bpmnkit-validation-modal-css"
	if (document.getElementById(id)) return
	const style = document.createElement("style")
	style.id = id
	style.textContent = VALIDATION_MODAL_CSS
	document.head.appendChild(style)
}

interface WizardRow {
	name: string
	type: ValidationVariableType
	required: boolean
	min: string
	max: string
	minLength: string
	maxLength: string
	pattern: string
}

/**
 * Opens the input validation wizard modal.
 * Resolves with the variable definitions on confirm, or null on cancel.
 */
function openValidationWizard(): Promise<InputVariableDef[] | null> {
	injectValidationModalCss()
	return new Promise((resolve) => {
		const rows: WizardRow[] = [
			{
				name: "",
				type: "string",
				required: true,
				min: "",
				max: "",
				minLength: "",
				maxLength: "",
				pattern: "",
			},
		]

		const overlay = document.createElement("div")
		overlay.className = "bpmnkit-val-overlay"

		const dialog = document.createElement("div")
		dialog.className = "bpmnkit-val-dialog"
		overlay.appendChild(dialog)

		const title = document.createElement("h2")
		title.textContent = "Add Input Validation"
		dialog.appendChild(title)

		const hint = document.createElement("p")
		hint.className = "hint"
		hint.textContent =
			"Define the variables this process expects. A validation DMN table and wiring will be inserted after the start event."
		dialog.appendChild(hint)

		const tableWrap = document.createElement("div")
		tableWrap.className = "bpmnkit-val-table"
		dialog.appendChild(tableWrap)

		function renderTable(): void {
			tableWrap.innerHTML = ""
			const table = document.createElement("table")
			const thead = document.createElement("thead")
			thead.innerHTML = `<tr>
				<th style="width:22%">Name</th>
				<th style="width:14%">Type</th>
				<th style="width:8%;text-align:center">Req.</th>
				<th style="width:10%">Min</th>
				<th style="width:10%">Max</th>
				<th style="width:10%">MinLen</th>
				<th style="width:10%">MaxLen</th>
				<th style="width:10%">Pattern</th>
				<th style="width:6%"></th>
			</tr>`
			table.appendChild(thead)

			const tbody = document.createElement("tbody")
			for (let i = 0; i < rows.length; i++) {
				const row = rows[i]
				if (!row) continue
				const tr = document.createElement("tr")

				const isNum = row.type === "number"
				const isStr = row.type === "string"

				tr.innerHTML = `
					<td><input type="text" class="v-name" value="${escHtml(row.name)}" placeholder="variableName"/></td>
					<td><select class="v-type">
						<option value="string"${row.type === "string" ? " selected" : ""}>string</option>
						<option value="number"${row.type === "number" ? " selected" : ""}>number</option>
						<option value="boolean"${row.type === "boolean" ? " selected" : ""}>boolean</option>
						<option value="context"${row.type === "context" ? " selected" : ""}>context</option>
						<option value="list"${row.type === "list" ? " selected" : ""}>list</option>
						<option value="any"${row.type === "any" ? " selected" : ""}>any</option>
					</select></td>
					<td class="bpmnkit-val-chk"><input type="checkbox" class="v-req"${row.required ? " checked" : ""}/></td>
					<td><input type="number" class="v-min" value="${escHtml(row.min)}" placeholder="—"${!isNum ? " disabled" : ""}/></td>
					<td><input type="number" class="v-max" value="${escHtml(row.max)}" placeholder="—"${!isNum ? " disabled" : ""}/></td>
					<td><input type="number" class="v-minlen" value="${escHtml(row.minLength)}" placeholder="—"${!isStr ? " disabled" : ""}/></td>
					<td><input type="number" class="v-maxlen" value="${escHtml(row.maxLength)}" placeholder="—"${!isStr ? " disabled" : ""}/></td>
					<td><input type="text" class="v-pattern" value="${escHtml(row.pattern)}" placeholder="regex"${!isStr ? " disabled" : ""}/></td>
					<td><button class="bpmnkit-val-del v-del" title="Remove">✕</button></td>
				`

				const readRow = (idx: number) => {
					const r = rows[idx]
					if (!r) return
					r.name = (tr.querySelector<HTMLInputElement>(".v-name")?.value ?? "").trim()
					r.type = (tr.querySelector<HTMLSelectElement>(".v-type")?.value ??
						"string") as ValidationVariableType
					r.required = tr.querySelector<HTMLInputElement>(".v-req")?.checked ?? false
					r.min = tr.querySelector<HTMLInputElement>(".v-min")?.value ?? ""
					r.max = tr.querySelector<HTMLInputElement>(".v-max")?.value ?? ""
					r.minLength = tr.querySelector<HTMLInputElement>(".v-minlen")?.value ?? ""
					r.maxLength = tr.querySelector<HTMLInputElement>(".v-maxlen")?.value ?? ""
					r.pattern = tr.querySelector<HTMLInputElement>(".v-pattern")?.value ?? ""
				}

				tr.querySelector<HTMLSelectElement>(".v-type")?.addEventListener("change", () => {
					readRow(i)
					renderTable()
				})
				tr.querySelector<HTMLInputElement>(".v-name")?.addEventListener("input", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-req")?.addEventListener("change", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-min")?.addEventListener("input", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-max")?.addEventListener("input", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-minlen")?.addEventListener("input", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-maxlen")?.addEventListener("input", () => readRow(i))
				tr.querySelector<HTMLInputElement>(".v-pattern")?.addEventListener("input", () =>
					readRow(i),
				)
				tr.querySelector<HTMLButtonElement>(".v-del")?.addEventListener("click", () => {
					readRow(i)
					rows.splice(i, 1)
					renderTable()
				})

				tbody.appendChild(tr)
			}
			table.appendChild(tbody)
			tableWrap.appendChild(table)

			const addBtn = document.createElement("button")
			addBtn.className = "bpmnkit-val-add"
			addBtn.textContent = "+ Add variable"
			addBtn.addEventListener("click", () => {
				rows.push({
					name: "",
					type: "string",
					required: true,
					min: "",
					max: "",
					minLength: "",
					maxLength: "",
					pattern: "",
				})
				renderTable()
				const inputs = tableWrap.querySelectorAll<HTMLInputElement>(".v-name")
				inputs[inputs.length - 1]?.focus()
			})
			tableWrap.appendChild(addBtn)
		}

		renderTable()

		const actions = document.createElement("div")
		actions.className = "bpmnkit-val-actions"

		const cancelBtn = document.createElement("button")
		cancelBtn.className = "bpmnkit-val-btn"
		cancelBtn.textContent = "Cancel"
		cancelBtn.addEventListener("click", () => {
			overlay.remove()
			resolve(null)
		})

		const generateBtn = document.createElement("button")
		generateBtn.className = "bpmnkit-val-btn bpmnkit-val-btn--primary"
		generateBtn.textContent = "Generate Validation"
		generateBtn.addEventListener("click", () => {
			const defs = rows
				.filter((r) => r.name)
				.map(
					(r): InputVariableDef => ({
						name: r.name,
						type: r.type,
						required: r.required,
						...(r.type === "number" && r.min !== "" ? { min: Number(r.min) } : {}),
						...(r.type === "number" && r.max !== "" ? { max: Number(r.max) } : {}),
						...(r.type === "string" && r.minLength !== ""
							? { minLength: Number(r.minLength) }
							: {}),
						...(r.type === "string" && r.maxLength !== ""
							? { maxLength: Number(r.maxLength) }
							: {}),
						...(r.type === "string" && r.pattern ? { pattern: r.pattern } : {}),
					}),
				)
			overlay.remove()
			resolve(defs.length > 0 ? defs : null)
		})

		actions.appendChild(cancelBtn)
		actions.appendChild(generateBtn)
		dialog.appendChild(actions)

		overlay.addEventListener("click", (e) => {
			if (e.target === overlay) {
				overlay.remove()
				resolve(null)
			}
		})

		document.body.appendChild(overlay)
	})
}

function escHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
}

// ── Start event input validation group ───────────────────────────────────────

interface ValidationGroupCallbacks {
	applyChange?: (fn: (defs: BpmnDefinitions) => BpmnDefinitions) => void
	onCreateValidationDmn?: (dmnXml: string, fileName: string, decisionId: string) => void
	onEditValidationDmn?: (decisionId: string) => void
}

function makeStartEventSchema(callbacks: ValidationGroupCallbacks): PanelSchema {
	return {
		compact: [{ key: "name", label: "Name", type: "text", placeholder: "Event name" }],
		groups: [
			{
				id: "general",
				label: "General",
				fields: [
					{ key: "name", label: "Name", type: "text", placeholder: "Event name" },
					{
						key: "documentation",
						label: "Documentation",
						type: "textarea",
						placeholder: "Add notes or documentation for this element…",
					},
				],
			},
			{
				id: "input-validation",
				label: "Input Validation",
				fields: [
					// Shown when no validation is configured
					{
						key: "_addValidation",
						label: "Add Input Validation",
						type: "action",
						hint: "Generate a DMN validation table and error path after this start event.",
						condition: (values) => values._hasValidation !== true,
						onClick: (_values, setValue) => {
							void openValidationWizard().then(async (vars) => {
								if (!vars || vars.length === 0) return
								const startEventId = _values._elementId as string | undefined
								if (!startEventId) return
								const decId = validationDecisionId(startEventId)
								const dmnXml = buildValidationDmn(startEventId, vars)
								const fileName = `${startEventId}_validation.dmn`
								callbacks.onCreateValidationDmn?.(dmnXml, fileName, decId)
								callbacks.applyChange?.((defs) =>
									insertValidationStructure(defs, startEventId, decId),
								)
								setValue("_hasValidation", true)
								setValue("_decisionId", decId)
							})
						},
					},
					// Shown when validation is already configured
					{
						key: "_decisionId",
						label: "Decision ID",
						type: "text",
						condition: (values) => values._hasValidation === true,
					},
					{
						key: "_editValidation",
						label: "Edit Validation DMN",
						type: "action",
						hint: "Open the validation decision table in the DMN editor.",
						condition: (values) => values._hasValidation === true,
						onClick: (values) => {
							const decId = values._decisionId as string | undefined
							if (decId) callbacks.onEditValidationDmn?.(decId)
						},
					},
					{
						key: "_removeValidation",
						label: "Remove Validation",
						type: "action",
						hint: "Delete the validation Business Rule Task, gateway, and error end event.",
						condition: (values) => values._hasValidation === true,
						onClick: (values, setValue) => {
							const startEventId = values._elementId as string | undefined
							if (!startEventId) return
							callbacks.applyChange?.((defs) => removeValidationStructure(defs, startEventId))
							setValue("_hasValidation", false)
							setValue("_decisionId", "")
						},
					},
				],
			},
		],
	}
}

function makeStartEventAdapter(callbacks: ValidationGroupCallbacks): PanelAdapter {
	return {
		read(defs, id) {
			const el = findFlowElement(defs, id)
			const structure = findValidationStructure(defs, id)
			return {
				name: el?.name ?? "",
				documentation: (el as { documentation?: string })?.documentation ?? "",
				_elementId: id,
				_hasValidation: structure !== null,
				_decisionId: structure?.decisionId ?? "",
			}
		},
		write(defs, id, values) {
			return updateFlowElement(defs, id, (el) => ({
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: (el as { documentation?: string }).documentation,
			}))
		},
		resolve(defs, id) {
			const el = findFlowElement(defs, id)
			if (!el || el.type !== "startEvent") return null
			const defType = el.eventDefinitions[0]?.type
			if (!defType) return null
			return eventDefToRegistration(defType)
		},
	}
}

// ── Options for the plugin factory ────────────────────────────────────────────

export interface ConfigPanelBpmnOptions {
	/**
	 * Called when the user clicks "Open in FEEL Playground ↗" in a FEEL expression field.
	 * Typically implemented by calling `tabsPlugin.api.openTab({ type: "feel", ... })`.
	 */
	openFeelPlayground?: (expression: string) => void
	/**
	 * Called when a new validation DMN should be created.
	 * Receives the DMN XML content, a suggested file name, and the decision ID.
	 * Typically implemented by saving a new DMN model in the studio's model storage.
	 */
	onCreateValidationDmn?: (dmnXml: string, fileName: string, decisionId: string) => void
	/**
	 * Called when the user clicks "Edit Validation DMN".
	 * Receives the decision ID so the host can navigate to the DMN model.
	 */
	onEditValidationDmn?: (decisionId: string) => void
	/**
	 * Applies a change to the current BPMN definitions.
	 * Required for input validation insert/remove to work.
	 * Typically: `(fn) => editorRef.current?.applyChange(fn)`.
	 */
	applyChange?: (fn: (defs: BpmnDefinitions) => BpmnDefinitions) => void
}

// ── Factory ───────────────────────────────────────────────────────────────────

/**
 * Creates the BPMN config panel extension plugin.
 *
 * Registers property schemas for all standard BPMN element types. Service tasks
 * are template-aware: when `zeebe:modelerTemplate` is set the matching
 * connector template form is rendered; otherwise a generic connector selector
 * is shown. Custom templates can be registered via `registerTemplate`.
 *
 * @param configPanel - The base config panel plugin returned by
 *   `createConfigPanelPlugin`.
 * @param options - Optional callbacks for FEEL playground navigation.
 */
export function createConfigPanelBpmnPlugin(
	configPanel: ConfigPanelPlugin,
	options: ConfigPanelBpmnOptions = {},
): CanvasPlugin & {
	/** Register an additional element template to make it available in the UI. */
	registerTemplate(template: ElementTemplate): void
} {
	const userTaskSchema = makeUserTaskSchema()
	const businessRuleTaskSchema = makeBusinessRuleTaskSchema(options.onEditValidationDmn)
	const callActivitySchema = makeCallActivitySchema()
	const scriptTaskSchema = makeScriptTaskSchema(options.openFeelPlayground)
	const sequenceFlowSchema = makeSequenceFlowSchema(options.openFeelPlayground)

	const validationCallbacks: ValidationGroupCallbacks = {
		applyChange: options.applyChange,
		onCreateValidationDmn: options.onCreateValidationDmn,
		onEditValidationDmn: options.onEditValidationDmn,
	}
	const startEventSchema = makeStartEventSchema(validationCallbacks)
	const startEventAdapter = makeStartEventAdapter(validationCallbacks)

	return {
		name: "config-panel-bpmn",

		install() {
			// Register general schema for common element types
			for (const type of GENERAL_TYPES) {
				configPanel.registerSchema(type, GENERAL_SCHEMA, GENERAL_ADAPTER)
			}
			// Events: dispatcher adapters resolve to event-definition-specific schemas
			configPanel.registerSchema("startEvent", startEventSchema, startEventAdapter)
			configPanel.registerSchema("endEvent", GENERAL_SCHEMA, END_EVENT_ADAPTER)
			configPanel.registerSchema("intermediateCatchEvent", GENERAL_SCHEMA, CATCH_EVENT_ADAPTER)
			configPanel.registerSchema("intermediateThrowEvent", GENERAL_SCHEMA, THROW_EVENT_ADAPTER)
			configPanel.registerSchema("boundaryEvent", GENERAL_SCHEMA, BOUNDARY_EVENT_ADAPTER)
			// Receive task: message name + correlation key
			configPanel.registerSchema("receiveTask", MESSAGE_EVENT_SCHEMA, MESSAGE_ADAPTER)
			// User task: formId + optional Open Form button
			configPanel.registerSchema("userTask", userTaskSchema, USER_TASK_ADAPTER)
			// Business rule task: decisionId + resultVariable + optional Open Decision button
			configPanel.registerSchema(
				"businessRuleTask",
				businessRuleTaskSchema,
				BUSINESS_RULE_TASK_ADAPTER,
			)
			// Service task: template-aware adapter
			configPanel.registerSchema("serviceTask", GENERIC_SERVICE_TASK_SCHEMA, SERVICE_TASK_ADAPTER)
			// Sub-process: general fields + multi-instance configuration
			configPanel.registerSchema("subProcess", SUB_PROCESS_SCHEMA, SUB_PROCESS_ADAPTER)
			// Ad-hoc subprocess: template-aware adapter (AI Agent pattern)
			configPanel.registerSchema("adHocSubProcess", GENERIC_ADHOC_SCHEMA, ADHOC_SUBPROCESS_ADAPTER)
			// Script task: FEEL expression + result variable
			configPanel.registerSchema("scriptTask", scriptTaskSchema, SCRIPT_TASK_ADAPTER)
			// Call activity: called process ID + navigate button
			configPanel.registerSchema("callActivity", callActivitySchema, CALL_ACTIVITY_ADAPTER)
			// Sequence flow: condition expression (for gateway edges)
			configPanel.registerSchema("sequenceFlow", sequenceFlowSchema, SEQUENCE_FLOW_ADAPTER)
		},

		registerTemplate(template: ElementTemplate): void {
			TEMPLATE_REGISTRY.set(template.id, buildRegistrationFromTemplate(template))
			const taskType = extractTaskType(template)
			if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
				TASK_TYPE_TO_TEMPLATE_ID.set(taskType, template.id)
			}
			if (!CONNECTOR_OPTIONS.some((o) => o.value === template.id)) {
				CONNECTOR_OPTIONS.push({ value: template.id, label: template.name })
			}
		},
	}
}

// Re-export types for external use
export { ELEMENT_TYPE_LABELS }
export type { ElementTemplate }
