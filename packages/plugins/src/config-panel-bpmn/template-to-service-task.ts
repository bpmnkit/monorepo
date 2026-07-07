/**
 * Convert an element template + user-provided values into ServiceTaskOptions
 * for use with the core `Bpmn` builder.
 */
import type { ElementTemplate } from "@bpmnkit/connectors"
import { applyElementTemplate } from "@bpmnkit/connectors"
import type { ServiceTaskOptions } from "@bpmnkit/core"

/**
 * Converts a Camunda element template into `ServiceTaskOptions` for the core
 * `Bpmn` builder, applying `values` for user-configurable properties and
 * fixed template defaults for Hidden properties.
 *
 * Delegates to `@bpmnkit/connectors`' `applyElementTemplate()`, which resolves
 * every binding kind (`zeebe:input`/`output`/`taskHeader`/`taskDefinition`/`property`),
 * not just `zeebe:input` as this function did historically.
 *
 * @example
 * ```typescript
 * import { Bpmn } from "@bpmnkit/core";
 * import { CAMUNDA_CONNECTOR_TEMPLATES, templateToServiceTaskOptions } from "@bpmnkit/canvas-plugin-config-panel-bpmn";
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
	const result = applyElementTemplate(template, values)
	return (
		result.serviceTask ?? {
			name: values.name ?? template.name,
			taskType: "",
		}
	)
}
