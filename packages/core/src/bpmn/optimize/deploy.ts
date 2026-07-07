import type { BpmnProcess } from "../bpmn-model.js"
import type { OptimizationFinding } from "./types.js"
import { readZeebeIoMapping, readZeebeTaskHeaders, readZeebeTaskType } from "./utils.js"

/**
 * Given a bundled connector template id and the set of value keys bound on
 * the element (io-mapping targets, task-header keys, zeebe:property names),
 * returns the required keys that are missing. Inject `applyConnectorTemplate`-
 * backed logic from `@bpmnkit/connectors` here; core stays dependency-free.
 */
export type ConnectorRequirementsResolver = (templateId: string, boundKeys: string[]) => string[]

function findExt(
	el: { extensionElements: Array<{ name: string; attributes: Record<string, string> }> },
	name: string,
) {
	return el.extensionElements.find((e) => e.name === name)
}

/**
 * Zeebe/Reebe deploy-parity checks — mirrors what Camunda 8 rejects at
 * deployment time (`apps/reebe/crates/reebe-bpmn/src/validator.rs`), so a
 * process that passes this profile deploys without a validation error.
 */
export function analyzeDeploy(
	p: BpmnProcess,
	resolveConnectorRequirements?: ConnectorRequirementsResolver,
): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id

	if (p.isExecutable !== true) {
		findings.push({
			id: "deploy/process-not-executable",
			category: "deploy",
			severity: "error",
			message: `Process "${processId}" is not marked executable.`,
			suggestion: 'Set isExecutable="true" — Camunda 8 refuses to deploy a non-executable process.',
			processId,
			elementIds: [],
		})
	}

	for (const el of p.flowElements) {
		if (el.type === "serviceTask" || el.type === "sendTask") {
			const type = readZeebeTaskType(el.extensionElements)
			if (!type) {
				findings.push({
					id: "deploy/service-task-no-type",
					category: "deploy",
					severity: "error",
					message: `"${el.name ?? el.id}" (${el.type}) has no zeebe:taskDefinition type.`,
					suggestion:
						"Set a job type — Camunda 8 refuses to deploy a task with no task definition.",
					processId,
					elementIds: [el.id],
				})
			}
		}

		if (el.type === "businessRuleTask") {
			const hasType = readZeebeTaskType(el.extensionElements) !== null
			const hasDecision = findExt(el, "zeebe:calledDecision") !== undefined
			if (!hasType && !hasDecision) {
				findings.push({
					id: "deploy/service-task-no-type",
					category: "deploy",
					severity: "error",
					message: `"${el.name ?? el.id}" (businessRuleTask) has neither a zeebe:taskDefinition type nor a zeebe:calledDecision.`,
					suggestion: "Set a decisionId or a job type.",
					processId,
					elementIds: [el.id],
				})
			}
		}

		if (el.type === "callActivity") {
			const called = findExt(el, "zeebe:calledElement")
			if (!called?.attributes.processId) {
				findings.push({
					id: "deploy/call-activity-no-process",
					category: "deploy",
					severity: "error",
					message: `Call activity "${el.name ?? el.id}" has no zeebe:calledElement processId.`,
					suggestion: "Set the process id to call.",
					processId,
					elementIds: [el.id],
				})
			}
		}

		if (el.type === "startEvent") {
			const messageDef = el.eventDefinitions.find((d) => d.type === "message")
			if (messageDef && !messageDef.messageRef) {
				findings.push({
					id: "deploy/message-start-no-name",
					category: "deploy",
					severity: "error",
					message: `Message start event "${el.name ?? el.id}" has no message name.`,
					suggestion:
						"Set a message name — Camunda 8 refuses to deploy an unnamed message reference.",
					processId,
					elementIds: [el.id],
				})
			}
		}

		if (
			el.type === "intermediateCatchEvent" ||
			el.type === "boundaryEvent" ||
			el.type === "receiveTask"
		) {
			const messageDef =
				el.type === "receiveTask"
					? undefined
					: el.eventDefinitions.find((d) => d.type === "message")
			const isMessageCatch =
				el.type === "receiveTask" ? el.messageRef !== undefined : messageDef !== undefined
			if (isMessageCatch) {
				const subscription = findExt(el, "zeebe:subscription")
				if (!subscription?.attributes.correlationKey) {
					findings.push({
						id: "deploy/message-catch-no-correlation",
						category: "deploy",
						severity: "error",
						message: `Message catch "${el.name ?? el.id}" (${el.type}) has no zeebe:subscription correlationKey.`,
						suggestion: "Set a correlation key — required for every message catch in Camunda 8.",
						processId,
						elementIds: [el.id],
					})
				}
			}
		}

		if (resolveConnectorRequirements) {
			const templateId = el.unknownAttributes["zeebe:modelerTemplate"]
			if (templateId) {
				const boundKeys = new Set<string>()
				const io = readZeebeIoMapping(el.extensionElements)
				if (io) {
					for (const i of io.inputs) boundKeys.add(i.target)
					for (const o of io.outputs) boundKeys.add(o.target)
				}
				const headers = readZeebeTaskHeaders(el.extensionElements)
				if (headers) for (const h of headers.headers) boundKeys.add(h.key)
				const propsExt = findExt(el, "zeebe:properties")
				if (propsExt) {
					for (const child of (
						propsExt as { children?: Array<{ attributes: Record<string, string> }> }
					).children ?? []) {
						if (child.attributes.name) boundKeys.add(child.attributes.name)
					}
				}

				const missing = resolveConnectorRequirements(templateId, [...boundKeys])
				for (const key of missing) {
					findings.push({
						id: "connector/missing-required",
						category: "connector",
						severity: "error",
						message: `"${el.name ?? el.id}" is missing required connector value "${key}" for template "${templateId}".`,
						suggestion: `Set a value for "${key}".`,
						processId,
						elementIds: [el.id],
					})
				}
			}
		}
	}

	return findings
}
