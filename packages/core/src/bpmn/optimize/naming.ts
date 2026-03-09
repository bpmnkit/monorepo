import type { BpmnElementType, BpmnProcess } from "../bpmn-model.js"
import type { OptimizationFinding, ResolvedOptions } from "./types.js"
import { buildFlowIndex, isEndEvent, isStartEvent } from "./utils.js"

// ---------------------------------------------------------------------------
// Element type sets
// ---------------------------------------------------------------------------

const TASK_TYPES: ReadonlySet<BpmnElementType> = new Set([
	"serviceTask",
	"userTask",
	"businessRuleTask",
	"scriptTask",
	"sendTask",
	"receiveTask",
	"manualTask",
	"callActivity",
])

const SUBPROCESS_TYPES: ReadonlySet<BpmnElementType> = new Set([
	"subProcess",
	"adHocSubProcess",
	"transaction",
])

const DECISION_GATEWAY_TYPES: ReadonlySet<BpmnElementType> = new Set([
	"exclusiveGateway",
	"inclusiveGateway",
])

// ---------------------------------------------------------------------------
// Naming analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze BPMN naming conventions based on Camunda best practices:
 * https://docs.camunda.io/docs/components/best-practices/modeling/naming-bpmn-elements/
 */
export function analyzeNaming(p: BpmnProcess, _opts: ResolvedOptions): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id
	const { bySource, byTarget } = buildFlowIndex(p)

	for (const el of p.flowElements) {
		// ── Tasks ────────────────────────────────────────────────────────────

		if (TASK_TYPES.has(el.type)) {
			if (!el.name) {
				findings.push({
					id: "naming/unlabeled-task",
					category: "naming",
					severity: "warning",
					message: `Task "${el.id}" (${el.type}) has no name.`,
					suggestion:
						'Name tasks using "Verb Object" form, e.g. "Verify Invoice", "Send Notification", "Approve Request".',
					processId,
					elementIds: [el.id],
				})
			}
		}

		if (SUBPROCESS_TYPES.has(el.type) && !el.name) {
			findings.push({
				id: "naming/unlabeled-subprocess",
				category: "naming",
				severity: "info",
				message: `Sub-process "${el.id}" (${el.type}) has no name.`,
				suggestion:
					'Name sub-processes using "Object + nominalized verb" form, e.g. "Invoice Processing", "Order Fulfillment".',
				processId,
				elementIds: [el.id],
			})
		}

		// ── Events ───────────────────────────────────────────────────────────

		if (isStartEvent(el.type) && !el.name) {
			findings.push({
				id: "naming/unlabeled-start-event",
				category: "naming",
				severity: "info",
				message: `Start event "${el.id}" has no name.`,
				suggestion:
					'Name start events using "Object + past participle", e.g. "Order Received", "Payment Initiated".',
				processId,
				elementIds: [el.id],
			})
		}

		if (isEndEvent(el.type) && !el.name) {
			findings.push({
				id: "naming/unlabeled-end-event",
				category: "naming",
				severity: "info",
				message: `End event "${el.id}" has no name.`,
				suggestion:
					'Name end events using "Object + state", e.g. "Order Fulfilled", "Payment Failed", "Request Rejected".',
				processId,
				elementIds: [el.id],
			})
		}

		// ── Decision gateways (XOR / inclusive) ──────────────────────────────

		if (DECISION_GATEWAY_TYPES.has(el.type)) {
			const outflows = bySource.get(el.id) ?? []
			const inflows = byTarget.get(el.id) ?? []
			const isSplit = outflows.length >= 2
			const isJoin = inflows.length >= 2

			if (isSplit) {
				// Split gateway must be labeled
				if (!el.name) {
					findings.push({
						id: "naming/split-gateway-no-label",
						category: "naming",
						severity: "warning",
						message: `Gateway "${el.id}" (${el.type}, split) has no name.`,
						suggestion:
							'Label split gateways as a yes/no question, e.g. "Invoice valid?", "Order approved?".',
						processId,
						elementIds: [el.id],
					})
				} else if (!el.name.trim().endsWith("?")) {
					findings.push({
						id: "naming/gateway-not-a-question",
						category: "naming",
						severity: "info",
						message: `Gateway "${el.id}" is named "${el.name}" — split gateways should be phrased as questions.`,
						suggestion: `Rephrase as a question, e.g. "${el.name.trim()}?"`,
						processId,
						elementIds: [el.id],
					})
				}

				// Each outgoing flow must have a condition label
				for (const flow of outflows) {
					if (!flow.name) {
						findings.push({
							id: "naming/missing-flow-condition",
							category: "naming",
							severity: "warning",
							message: `Sequence flow "${flow.id}" from split gateway "${el.id}" has no condition label.`,
							suggestion:
								'Label each outgoing flow with the condition answer, e.g. "Yes", "No", "Approved", "Rejected".',
							processId,
							elementIds: [el.id, flow.id],
						})
					}
				}
			}

			// Join-only gateways should NOT be labeled
			if (isJoin && !isSplit && el.name) {
				findings.push({
					id: "naming/join-gateway-labeled",
					category: "naming",
					severity: "info",
					message: `Gateway "${el.id}" (join) is named "${el.name}" — join gateways should not have labels.`,
					suggestion: "Remove the label from join-only gateways; their semantics are implicit.",
					processId,
					elementIds: [el.id],
				})
			}
		}
	}

	return findings
}
