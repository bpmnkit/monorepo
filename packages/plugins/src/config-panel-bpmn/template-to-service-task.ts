/**
 * Convert an element template + user-provided values into ServiceTaskOptions
 * for use with the core `Bpmn` builder.
 */
import type { ServiceTaskOptions } from "@bpmn-sdk/core";
import type { TemplateBinding, TemplateProperty } from "./template-types.js";
import type { ElementTemplate } from "./template-types.js";

/** Derive the lookup key for a template property (same logic as the template engine). */
function propertyKey(prop: TemplateProperty): string {
	if (prop.id) return prop.id;
	const b = prop.binding;
	if (b.type === "zeebe:input") return b.name;
	if (b.type === "zeebe:output") return b.source;
	if (b.type === "zeebe:taskHeader") return b.key;
	if (b.type === "zeebe:taskDefinition") return `taskDef.${b.property}`;
	if (b.type === "zeebe:taskDefinition:type") return "taskDef.type";
	if (b.type === "property") return b.name;
	if (b.type === "zeebe:property") return b.name;
	return "";
}

function applyBinding(
	binding: TemplateBinding,
	value: string,
	inputs: Array<{ source: string; target: string }>,
	taskHeaders: Record<string, string>,
	out: { taskType: string; retries: string | undefined },
): void {
	if (binding.type === "zeebe:input") {
		inputs.push({ source: value, target: binding.name });
	} else if (binding.type === "zeebe:taskHeader") {
		taskHeaders[binding.key] = value;
	} else if (binding.type === "zeebe:taskDefinition" && binding.property === "type") {
		out.taskType = value;
	} else if (binding.type === "zeebe:taskDefinition" && binding.property === "retries") {
		out.retries = value;
	} else if (binding.type === "zeebe:taskDefinition:type") {
		out.taskType = value;
	}
}

/**
 * Convert a Camunda element template into `ServiceTaskOptions` for the core
 * `Bpmn` builder, applying `values` for user-configurable properties and
 * fixed template defaults for Hidden properties.
 *
 * @example
 * ```typescript
 * import { Bpmn } from "@bpmn-sdk/core";
 * import { CAMUNDA_CONNECTOR_TEMPLATES, templateToServiceTaskOptions } from "@bpmn-sdk/canvas-plugin-config-panel-bpmn";
 *
 * const kafka = CAMUNDA_CONNECTOR_TEMPLATES.find(t => t.id === "io.camunda.connectors.KAFKA.v1")!;
 * const defs = Bpmn.createProcess("proc")
 *   .startEvent("start")
 *   .serviceTask("publish", templateToServiceTaskOptions(kafka, {
 *     "topic.bootstrapServers": "localhost:9092",
 *     "topic.topicName": "orders",
 *     "message.value": "= order",
 *   }))
 *   .endEvent("end")
 *   .build();
 * ```
 */
export function templateToServiceTaskOptions(
	template: ElementTemplate,
	values: Record<string, string> = {},
): ServiceTaskOptions {
	const inputs: Array<{ source: string; target: string }> = [];
	const taskHeaders: Record<string, string> = {};
	const out: { taskType: string; retries: string | undefined } = {
		taskType: "",
		retries: undefined,
	};

	for (const prop of template.properties) {
		if (prop.type === "Hidden") {
			if (typeof prop.value === "string" && prop.value) {
				applyBinding(prop.binding, prop.value, inputs, taskHeaders, out);
			}
			continue;
		}
		const key = propertyKey(prop);
		const val = values[key] ?? (typeof prop.value === "string" ? prop.value : undefined);
		if (!val) continue;
		applyBinding(prop.binding, val, inputs, taskHeaders, out);
	}

	return {
		name: values.name ?? template.name,
		taskType: out.taskType,
		retries: out.retries,
		modelerTemplate: template.id,
		modelerTemplateVersion: template.version !== undefined ? String(template.version) : undefined,
		modelerTemplateIcon: template.icon?.contents,
		ioMapping: inputs.length > 0 ? { inputs } : undefined,
		taskHeaders: Object.keys(taskHeaders).length > 0 ? taskHeaders : undefined,
	};
}
