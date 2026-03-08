/**
 * @bpmn-sdk/canvas-plugin-config-panel-bpmn — BPMN element schemas for the
 * config panel plugin.
 *
 * Registers config panel schemas for all standard BPMN element types. For
 * service tasks the panel is template-aware: when `zeebe:modelerTemplate` is
 * set on an element the matching template's property form is shown instead of
 * the generic connector selector.
 *
 * ## Usage
 * ```typescript
 * import { createConfigPanelPlugin } from "@bpmn-sdk/canvas-plugin-config-panel";
 * import { createConfigPanelBpmnPlugin } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
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

import type { CanvasPlugin } from "@bpmn-sdk/canvas";
import type {
	BpmnConditionalEventDefinition,
	BpmnDefinitions,
	BpmnEventDefinition,
	BpmnFlowElement,
	BpmnTimerEventDefinition,
} from "@bpmn-sdk/core";
import { zeebeExtensionsToXmlElements } from "@bpmn-sdk/core";
import { ELEMENT_TYPE_LABELS } from "@bpmn-sdk/editor";
import type { CreateShapeType } from "@bpmn-sdk/editor";
import type {
	ConfigPanelPlugin,
	FieldValue,
	PanelAdapter,
	PanelSchema,
} from "../config-panel/index.js";
import { buildRegistrationFromTemplate } from "./template-engine.js";
import type { ElementTemplate } from "./template-types.js";
import { CAMUNDA_CONNECTOR_TEMPLATES } from "./templates/generated.js";
export { CAMUNDA_CONNECTOR_TEMPLATES } from "./templates/generated.js";
export { templateToServiceTaskOptions } from "./template-to-service-task.js";
import {
	buildPropertiesWithExampleOutput,
	findFlowElement,
	findSequenceFlow,
	getExampleOutputJson,
	getIoInput,
	getTaskHeader,
	parseCalledElement,
	parseZeebeError,
	parseZeebeEscalation,
	parseZeebeExtensions,
	parseZeebeMessage,
	parseZeebeScript,
	parseZeebeSignal,
	updateFlowElement,
	updateSequenceFlow,
	xmlLocalName,
} from "./util.js";

/** Validates that a field value is valid JSON, or returns an error message. */
function validateJson(value: FieldValue): string | null {
	if (typeof value !== "string" || value.trim() === "") return null;
	try {
		JSON.parse(value);
		return null;
	} catch (e) {
		return e instanceof SyntaxError ? e.message : "Invalid JSON";
	}
}

// ── Built-in template registry ────────────────────────────────────────────────

/**
 * All built-in Camunda connector templates, keyed by template id.
 * Pre-built so that reference-equality comparisons in the renderer work.
 */
const TEMPLATE_REGISTRY = new Map<string, ReturnType<typeof buildRegistrationFromTemplate>>();

/** Templates applicable to service tasks. */
const SERVICE_TASK_TEMPLATES = CAMUNDA_CONNECTOR_TEMPLATES.filter(
	(t) => t.appliesTo.includes("bpmn:ServiceTask") || t.appliesTo.includes("bpmn:Task"),
);

/** Extract the fixed task definition type from a template's Hidden binding. */
function extractTaskType(t: ElementTemplate): string | undefined {
	for (const p of t.properties) {
		if (typeof p.value !== "string") continue;
		if (
			(p.binding.type === "zeebe:taskDefinition" &&
				"property" in p.binding &&
				p.binding.property === "type") ||
			p.binding.type === "zeebe:taskDefinition:type"
		) {
			return p.value;
		}
	}
	return undefined;
}

// Register all Camunda connector templates
for (const tpl of CAMUNDA_CONNECTOR_TEMPLATES) {
	TEMPLATE_REGISTRY.set(tpl.id, buildRegistrationFromTemplate(tpl));
}

/**
 * Task definition type → template id mapping (first-wins; used for
 * backward-compat detection in `read` when `zeebe:modelerTemplate` is absent).
 */
const TASK_TYPE_TO_TEMPLATE_ID = new Map<string, string>();
for (const tpl of SERVICE_TASK_TEMPLATES) {
	const taskType = extractTaskType(tpl);
	if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
		TASK_TYPE_TO_TEMPLATE_ID.set(taskType, tpl.id);
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
};

const GENERAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => ({
			...el,
			name: typeof values.name === "string" ? values.name : el.name,
			documentation:
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation,
		}));
	},
};

// ── Service task schema (generic — shown when no template is applied) ─────────

const CUSTOM_TASK_TYPE = "";

const IS_CUSTOM = (values: Record<string, FieldValue>) => values.connector === CUSTOM_TASK_TYPE;

/**
 * Connector selector options keyed by template id (not task type) so each of
 * the 116+ connectors gets its own entry, even when multiple share a task type.
 */
const CONNECTOR_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	...SERVICE_TASK_TEMPLATES.flatMap((t) =>
		extractTaskType(t) ? [{ value: t.id, label: t.name }] : [],
	).sort((a, b) => a.label.localeCompare(b.label)),
];

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
};

const SERVICE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const ext = parseZeebeExtensions(el.extensionElements);
		const definitionType = ext.taskDefinition?.type ?? "";
		// Detect template via explicit attribute OR by known task type (backward-compat)
		const hasTemplate =
			Boolean(el.unknownAttributes?.["zeebe:modelerTemplate"]) ||
			TASK_TYPE_TO_TEMPLATE_ID.has(definitionType);
		// Connector selector value = the task definition type when template is active
		const connector = hasTemplate ? definitionType : CUSTOM_TASK_TYPE;

		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			connector,
			taskType: connector === CUSTOM_TASK_TYPE ? definitionType : "",
			retries: ext.taskDefinition?.retries ?? "",
			exampleOutputJson: getExampleOutputJson(ext),
		};
	},

	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const connectorVal = strVal(values.connector);
		const isCustom = connectorVal === CUSTOM_TASK_TYPE;
		// connector is either a template id (new) or a task type (backward-compat read)
		const newTemplateId = isCustom
			? undefined
			: TEMPLATE_REGISTRY.has(connectorVal)
				? connectorVal
				: TASK_TYPE_TO_TEMPLATE_ID.get(connectorVal);

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
			}));
			const templateReg = TEMPLATE_REGISTRY.get(newTemplateId);
			if (templateReg) return templateReg.adapter.write(withAttr, id, values);
			return withAttr;
		}

		// Custom task or clearing a template
		return updateFlowElement(defs, id, (el) => {
			const name = typeof values.name === "string" ? values.name : el.name;
			const documentation =
				typeof values.documentation === "string"
					? values.documentation || undefined
					: el.documentation;
			const taskType = strVal(values.taskType);
			const retries = strVal(values.retries);
			const exampleOutputJson = strVal(values.exampleOutputJson);

			const currentExt = parseZeebeExtensions(el.extensionElements);
			const newProperties = buildPropertiesWithExampleOutput(currentExt, exampleOutputJson);

			const ZEEBE_EXTS = new Set(["taskDefinition", "ioMapping", "taskHeaders", "properties"]);
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_EXTS.has(xmlLocalName(x.name)));

			const newZeebeExts = zeebeExtensionsToXmlElements({
				taskDefinition: taskType ? { type: taskType, retries: retries || undefined } : undefined,
				properties: newProperties,
			});

			// Remove modelerTemplate attribute when switching to custom
			const {
				"zeebe:modelerTemplate": _t,
				"zeebe:modelerTemplateVersion": _v,
				...rest
			} = el.unknownAttributes;

			return {
				...el,
				name,
				documentation,
				extensionElements: [...otherExts, ...newZeebeExts],
				unknownAttributes: rest,
			};
		});
	},

	/**
	 * When `zeebe:modelerTemplate` is set on the element, switch to the
	 * matching template registration instead of the generic form.
	 */
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return null;
		const templateId = el.unknownAttributes?.["zeebe:modelerTemplate"];
		if (!templateId) return null;
		return TEMPLATE_REGISTRY.get(templateId) ?? null;
	},
};

// ── Ad-hoc subprocess schema (template-aware, shown for adHocSubProcess) ──────

/** Templates applicable to ad-hoc subprocesses (AI agent pattern). */
const ADHOC_SUBPROCESS_TEMPLATES = CAMUNDA_CONNECTOR_TEMPLATES.filter(
	(t) => t.appliesTo.includes("bpmn:SubProcess") || t.appliesTo.includes("bpmn:AdHocSubProcess"),
);

/** Connector selector for ad-hoc subprocess templates. */
const ADHOC_OPTIONS: Array<{ value: string; label: string }> = [
	{ value: CUSTOM_TASK_TYPE, label: "Custom (no connector)" },
	...ADHOC_SUBPROCESS_TEMPLATES.map((t) => ({ value: t.id, label: t.name })).sort((a, b) =>
		a.label.localeCompare(b.label),
	),
];

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
};

const ADHOC_SUBPROCESS_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			connector: el.unknownAttributes?.["zeebe:modelerTemplate"] ?? CUSTOM_TASK_TYPE,
		};
	},

	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const connectorVal = strVal(values.connector);
		const newTemplateId =
			connectorVal && connectorVal !== CUSTOM_TASK_TYPE && TEMPLATE_REGISTRY.has(connectorVal)
				? connectorVal
				: undefined;

		if (newTemplateId) {
			const withAttr = updateFlowElement(defs, id, (el) => ({
				...el,
				name: typeof values.name === "string" ? values.name || undefined : el.name,
				unknownAttributes: { ...el.unknownAttributes, "zeebe:modelerTemplate": newTemplateId },
			}));
			const templateReg = TEMPLATE_REGISTRY.get(newTemplateId);
			if (templateReg) return templateReg.adapter.write(withAttr, id, values);
			return withAttr;
		}

		// Custom or clearing a template
		return updateFlowElement(defs, id, (el) => {
			const {
				"zeebe:modelerTemplate": _t,
				"zeebe:modelerTemplateVersion": _v,
				"zeebe:modelerTemplateIcon": _i,
				...rest
			} = el.unknownAttributes;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				unknownAttributes: rest,
			};
		});
	},

	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return null;
		const templateId = el.unknownAttributes?.["zeebe:modelerTemplate"];
		if (!templateId) return null;
		return TEMPLATE_REGISTRY.get(templateId) ?? null;
	},
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function strVal(v: FieldValue): string {
	return typeof v === "string" ? v : "";
}

// ── All element types that get the general schema ─────────────────────────────

const GENERAL_TYPES: CreateShapeType[] = [
	"sendTask",
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
	"subProcess",
	"transaction",
	"manualTask",
	"task",
];

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
	};
}

const USER_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const ext = parseZeebeExtensions(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			formId: ext.formDefinition?.formId ?? "",
			exampleOutputJson: getExampleOutputJson(ext),
		};
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const formId = strVal(values.formId);
			const exampleOutputJson = strVal(values.exampleOutputJson);
			const currentExt = parseZeebeExtensions(el.extensionElements);
			const newProperties = buildPropertiesWithExampleOutput(currentExt, exampleOutputJson);
			const ZEEBE_FORM_NAMES = new Set(["userTask", "formDefinition", "properties"]);
			const otherExts = el.extensionElements.filter(
				(x) => !ZEEBE_FORM_NAMES.has(xmlLocalName(x.name)),
			);
			const formExts = zeebeExtensionsToXmlElements({
				formDefinition: formId ? { formId } : undefined,
				properties: newProperties,
			});
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: [...otherExts, ...formExts],
			};
		});
	},
};

// ── Business rule task schema (decisionId + resultVariable) ──────────────────

function makeBusinessRuleTaskSchema(): PanelSchema {
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
	};
}

const BUSINESS_RULE_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const ext = parseZeebeExtensions(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			decisionId: ext.calledDecision?.decisionId ?? "",
			resultVariable: ext.calledDecision?.resultVariable ?? "",
		};
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const decisionId = strVal(values.decisionId);
			const resultVariable = strVal(values.resultVariable) || "result";
			const ZEEBE_DECISION_NAMES = new Set(["calledDecision"]);
			const otherExts = el.extensionElements.filter(
				(x) => !ZEEBE_DECISION_NAMES.has(xmlLocalName(x.name)),
			);
			const decisionExts = decisionId
				? zeebeExtensionsToXmlElements({ calledDecision: { decisionId, resultVariable } })
				: [];
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: [...otherExts, ...decisionExts],
			};
		});
	},
};

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
										const expr = v.expression;
										if (typeof expr === "string") onOpenFeelPlayground(expr.replace(/^=\s*/, ""));
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
	};
}

const SCRIPT_TASK_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const script = parseZeebeScript(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			expression: script.expression,
			resultVariable: script.resultVariable,
		};
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const expression = strVal(values.expression);
			const resultVariable = strVal(values.resultVariable);
			const ZEEBE_SCRIPT = new Set(["script"]);
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_SCRIPT.has(xmlLocalName(x.name)));
			const scriptAttrs: Record<string, string> = { expression };
			if (resultVariable) scriptAttrs.resultVariable = resultVariable;
			const scriptExt = expression
				? { name: "zeebe:script", attributes: scriptAttrs, children: [] }
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: scriptExt ? [...otherExts, scriptExt] : otherExts,
			};
		});
	},
};

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
	};
}

const CALL_ACTIVITY_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const called = parseCalledElement(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			processId: called.processId,
			propagateAllChildVariables: called.propagateAllChildVariables,
		};
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		return updateFlowElement(defs, id, (el) => {
			const pid = strVal(values.processId);
			const propagate =
				values.propagateAllChildVariables === true || values.propagateAllChildVariables === "true";
			const ZEEBE_CALLED = new Set(["calledElement"]);
			const otherExts = el.extensionElements.filter((x) => !ZEEBE_CALLED.has(xmlLocalName(x.name)));
			const calledExt = pid
				? {
						name: "zeebe:calledElement",
						attributes: {
							processId: pid,
							propagateAllChildVariables: String(propagate),
						},
						children: [],
					}
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: calledExt ? [...otherExts, calledExt] : otherExts,
			};
		});
	},
};

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
										const expr = v.conditionExpression;
										if (typeof expr === "string") onOpenFeelPlayground(expr.replace(/^=\s*/, ""));
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
	};
}

const SEQUENCE_FLOW_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const sf = findSequenceFlow(defs, id);
		if (!sf) return {};
		// Check whether this flow is the default of its source gateway
		const sourceEl = findFlowElement(defs, sf.sourceRef);
		const isDefault =
			sourceEl &&
			(sourceEl.type === "exclusiveGateway" ||
				sourceEl.type === "inclusiveGateway" ||
				sourceEl.type === "complexGateway") &&
			sourceEl.default === sf.id;
		return {
			name: sf.name ?? "",
			conditionExpression: sf.conditionExpression?.text ?? "",
			isDefault: isDefault ?? false,
			_sourceType: sourceEl?.type ?? "",
		};
	},
	write(defs: BpmnDefinitions, id: string, values: Record<string, FieldValue>): BpmnDefinitions {
		const sf = findSequenceFlow(defs, id);
		const sourceRef = sf?.sourceRef;

		// Condition expressions are only valid on outgoing flows of exclusive gateways
		const sourceEl = sf ? findFlowElement(defs, sf.sourceRef) : undefined;
		const isExclusiveGateway = sourceEl?.type === "exclusiveGateway";

		// Update the sequence flow itself
		let result = updateSequenceFlow(defs, id, (flow) => {
			const expr = isExclusiveGateway ? strVal(values.conditionExpression) : undefined;
			return {
				...flow,
				name: typeof values.name === "string" ? values.name || undefined : flow.name,
				conditionExpression: expr
					? { text: expr, attributes: { "xsi:type": "bpmn:tFormalExpression" } }
					: undefined,
			};
		});

		// Update the source gateway's default attribute
		if (sourceRef) {
			const sourceEl = findFlowElement(result, sourceRef);
			if (
				sourceEl &&
				(sourceEl.type === "exclusiveGateway" ||
					sourceEl.type === "inclusiveGateway" ||
					sourceEl.type === "complexGateway")
			) {
				const makeDefault = values.isDefault === true;
				result = updateFlowElement(result, sourceRef, (el) => {
					if (
						el.type === "exclusiveGateway" ||
						el.type === "inclusiveGateway" ||
						el.type === "complexGateway"
					) {
						return { ...el, default: makeDefault ? id : undefined };
					}
					return el;
				});
			}
		}

		return result;
	},
};

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
};

const TIMER_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		if (
			el.type !== "startEvent" &&
			el.type !== "intermediateCatchEvent" &&
			el.type !== "boundaryEvent"
		)
			return {};
		const timerDef = el.eventDefinitions.find(
			(d): d is BpmnTimerEventDefinition => d.type === "timer",
		);
		let timerType = "timeCycle";
		if (timerDef?.timeDuration !== undefined) timerType = "timeDuration";
		else if (timerDef?.timeDate !== undefined) timerType = "timeDate";
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			timerType,
			timeCycle: timerDef?.timeCycle ?? "",
			timeDuration: timerDef?.timeDuration ?? "",
			timeDate: timerDef?.timeDate ?? "",
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			if (
				el.type !== "startEvent" &&
				el.type !== "intermediateCatchEvent" &&
				el.type !== "boundaryEvent"
			)
				return el;
			const timerType = strVal(values.timerType) || "timeCycle";
			const newTimerDef: BpmnTimerEventDefinition = { type: "timer" };
			if (timerType === "timeCycle") newTimerDef.timeCycle = strVal(values.timeCycle);
			else if (timerType === "timeDuration") newTimerDef.timeDuration = strVal(values.timeDuration);
			else newTimerDef.timeDate = strVal(values.timeDate);
			const hasDef = el.eventDefinitions.some((d) => d.type === "timer");
			const updatedDefs: BpmnEventDefinition[] = hasDef
				? el.eventDefinitions.map((d) => (d.type === "timer" ? newTimerDef : d))
				: [...el.eventDefinitions, newTimerDef];
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				eventDefinitions: updatedDefs,
			} as BpmnFlowElement;
		});
	},
};

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
};

const MESSAGE_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const msg = parseZeebeMessage(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			messageName: msg.name,
			correlationKey: msg.correlationKey,
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const messageName = strVal(values.messageName);
			const correlationKey = strVal(values.correlationKey);
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "message");
			const attrs: Record<string, string> = { name: messageName };
			if (correlationKey) attrs.correlationKey = correlationKey;
			const msgExt = messageName
				? { name: "zeebe:message", attributes: attrs, children: [] }
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: msgExt ? [...otherExts, msgExt] : otherExts,
			};
		});
	},
};

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
};

const SIGNAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const sig = parseZeebeSignal(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			signalName: sig.name,
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const signalName = strVal(values.signalName);
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "signal");
			const sigExt = signalName
				? { name: "zeebe:signal", attributes: { name: signalName }, children: [] }
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: sigExt ? [...otherExts, sigExt] : otherExts,
			};
		});
	},
};

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
};

const ERROR_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const err = parseZeebeError(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			errorCode: err.errorCode,
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const errorCode = strVal(values.errorCode);
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "error");
			const errExt = errorCode
				? { name: "zeebe:error", attributes: { errorCode }, children: [] }
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: errExt ? [...otherExts, errExt] : otherExts,
			};
		});
	},
};

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
};

const ESCALATION_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		const esc = parseZeebeEscalation(el.extensionElements);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			escalationCode: esc.escalationCode,
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			const escalationCode = strVal(values.escalationCode);
			const otherExts = el.extensionElements.filter((x) => xmlLocalName(x.name) !== "escalation");
			const escExt = escalationCode
				? { name: "zeebe:escalation", attributes: { escalationCode }, children: [] }
				: null;
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				extensionElements: escExt ? [...otherExts, escExt] : otherExts,
			};
		});
	},
};

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
};

const CONDITIONAL_ADAPTER: PanelAdapter = {
	read(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el) return {};
		if (
			el.type !== "startEvent" &&
			el.type !== "intermediateCatchEvent" &&
			el.type !== "boundaryEvent"
		)
			return {};
		const condDef = el.eventDefinitions.find(
			(d): d is BpmnConditionalEventDefinition => d.type === "conditional",
		);
		return {
			name: el.name ?? "",
			documentation: el.documentation ?? "",
			conditionExpression: condDef?.condition ?? "",
		};
	},
	write(defs, id, values) {
		return updateFlowElement(defs, id, (el) => {
			if (
				el.type !== "startEvent" &&
				el.type !== "intermediateCatchEvent" &&
				el.type !== "boundaryEvent"
			)
				return el;
			const conditionExpression = strVal(values.conditionExpression);
			const newCondDef: BpmnConditionalEventDefinition = {
				type: "conditional",
				condition: conditionExpression || undefined,
			};
			const hasDef = el.eventDefinitions.some((d) => d.type === "conditional");
			const updatedDefs: BpmnEventDefinition[] = hasDef
				? el.eventDefinitions.map((d) => (d.type === "conditional" ? newCondDef : d))
				: [...el.eventDefinitions, newCondDef];
			return {
				...el,
				name: typeof values.name === "string" ? values.name : el.name,
				documentation:
					typeof values.documentation === "string"
						? values.documentation || undefined
						: el.documentation,
				eventDefinitions: updatedDefs,
			} as BpmnFlowElement;
		});
	},
};

// ── Event dispatcher adapters ─────────────────────────────────────────────────

/** Map an event definition type to the matching schema+adapter pair. */
function eventDefToRegistration(
	defType: string,
): { schema: PanelSchema; adapter: PanelAdapter } | null {
	switch (defType) {
		case "timer":
			return { schema: TIMER_SCHEMA, adapter: TIMER_ADAPTER };
		case "message":
			return { schema: MESSAGE_EVENT_SCHEMA, adapter: MESSAGE_ADAPTER };
		case "signal":
			return { schema: SIGNAL_EVENT_SCHEMA, adapter: SIGNAL_ADAPTER };
		case "error":
			return { schema: ERROR_EVENT_SCHEMA, adapter: ERROR_ADAPTER };
		case "escalation":
			return { schema: ESCALATION_EVENT_SCHEMA, adapter: ESCALATION_ADAPTER };
		case "conditional":
			return { schema: CONDITIONAL_EVENT_SCHEMA, adapter: CONDITIONAL_ADAPTER };
		default:
			return null;
	}
}

const START_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el || el.type !== "startEvent") return null;
		const defType = el.eventDefinitions[0]?.type;
		if (!defType) return null;
		return eventDefToRegistration(defType);
	},
};

const END_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el || el.type !== "endEvent") return null;
		const defType = el.eventDefinitions[0]?.type;
		if (!defType) return null;
		return eventDefToRegistration(defType);
	},
};

const CATCH_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el || el.type !== "intermediateCatchEvent") return null;
		const defType = el.eventDefinitions[0]?.type;
		if (!defType) return null;
		return eventDefToRegistration(defType);
	},
};

const THROW_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el || el.type !== "intermediateThrowEvent") return null;
		const defType = el.eventDefinitions[0]?.type;
		if (!defType) return null;
		return eventDefToRegistration(defType);
	},
};

const BOUNDARY_EVENT_ADAPTER: PanelAdapter = {
	read: GENERAL_ADAPTER.read,
	write: GENERAL_ADAPTER.write,
	resolve(defs, id) {
		const el = findFlowElement(defs, id);
		if (!el || el.type !== "boundaryEvent") return null;
		const defType = el.eventDefinitions[0]?.type;
		if (!defType) return null;
		return eventDefToRegistration(defType);
	},
};

// ── Options for the plugin factory ────────────────────────────────────────────

export interface ConfigPanelBpmnOptions {
	/**
	 * Called when the user clicks "Open in FEEL Playground ↗" in a FEEL expression field.
	 * Typically implemented by calling `tabsPlugin.api.openTab({ type: "feel", ... })`.
	 */
	openFeelPlayground?: (expression: string) => void;
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
	registerTemplate(template: ElementTemplate): void;
} {
	const userTaskSchema = makeUserTaskSchema();
	const businessRuleTaskSchema = makeBusinessRuleTaskSchema();
	const callActivitySchema = makeCallActivitySchema();
	const scriptTaskSchema = makeScriptTaskSchema(options.openFeelPlayground);
	const sequenceFlowSchema = makeSequenceFlowSchema(options.openFeelPlayground);

	return {
		name: "config-panel-bpmn",

		install() {
			// Register general schema for common element types
			for (const type of GENERAL_TYPES) {
				configPanel.registerSchema(type, GENERAL_SCHEMA, GENERAL_ADAPTER);
			}
			// Events: dispatcher adapters resolve to event-definition-specific schemas
			configPanel.registerSchema("startEvent", GENERAL_SCHEMA, START_EVENT_ADAPTER);
			configPanel.registerSchema("endEvent", GENERAL_SCHEMA, END_EVENT_ADAPTER);
			configPanel.registerSchema("intermediateCatchEvent", GENERAL_SCHEMA, CATCH_EVENT_ADAPTER);
			configPanel.registerSchema("intermediateThrowEvent", GENERAL_SCHEMA, THROW_EVENT_ADAPTER);
			configPanel.registerSchema("boundaryEvent", GENERAL_SCHEMA, BOUNDARY_EVENT_ADAPTER);
			// Receive task: message name + correlation key
			configPanel.registerSchema("receiveTask", MESSAGE_EVENT_SCHEMA, MESSAGE_ADAPTER);
			// User task: formId + optional Open Form button
			configPanel.registerSchema("userTask", userTaskSchema, USER_TASK_ADAPTER);
			// Business rule task: decisionId + resultVariable + optional Open Decision button
			configPanel.registerSchema(
				"businessRuleTask",
				businessRuleTaskSchema,
				BUSINESS_RULE_TASK_ADAPTER,
			);
			// Service task: template-aware adapter
			configPanel.registerSchema("serviceTask", GENERIC_SERVICE_TASK_SCHEMA, SERVICE_TASK_ADAPTER);
			// Ad-hoc subprocess: template-aware adapter (AI Agent pattern)
			configPanel.registerSchema("adHocSubProcess", GENERIC_ADHOC_SCHEMA, ADHOC_SUBPROCESS_ADAPTER);
			// Script task: FEEL expression + result variable
			configPanel.registerSchema("scriptTask", scriptTaskSchema, SCRIPT_TASK_ADAPTER);
			// Call activity: called process ID + navigate button
			configPanel.registerSchema("callActivity", callActivitySchema, CALL_ACTIVITY_ADAPTER);
			// Sequence flow: condition expression (for gateway edges)
			configPanel.registerSchema("sequenceFlow", sequenceFlowSchema, SEQUENCE_FLOW_ADAPTER);
		},

		registerTemplate(template: ElementTemplate): void {
			TEMPLATE_REGISTRY.set(template.id, buildRegistrationFromTemplate(template));
			const taskType = extractTaskType(template);
			if (taskType && !TASK_TYPE_TO_TEMPLATE_ID.has(taskType)) {
				TASK_TYPE_TO_TEMPLATE_ID.set(taskType, template.id);
			}
			if (!CONNECTOR_OPTIONS.some((o) => o.value === template.id)) {
				CONNECTOR_OPTIONS.push({ value: template.id, label: template.name });
			}
		},
	};
}

// Re-export types for external use
export { ELEMENT_TYPE_LABELS };
export type { ElementTemplate };
