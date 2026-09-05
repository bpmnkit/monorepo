import type { BpmnProcess } from "../bpmn-model.js"
import type { OptimizationFinding } from "./types.js"
import { buildFlowIndex, readZeebeIoMapping, readZeebeTaskType } from "./utils.js"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** hostId → event-definition types of the boundary events attached to it. */
function indexBoundaryTypes(p: BpmnProcess): Map<string, Set<string>> {
	const index = new Map<string, Set<string>>()
	for (const el of p.flowElements) {
		if (el.type !== "boundaryEvent") continue
		let types = index.get(el.attachedToRef)
		if (!types) {
			types = new Set()
			index.set(el.attachedToRef, types)
		}
		for (const def of el.eventDefinitions) types.add(def.type)
	}
	return index
}

/** Returns true if the element has a boundary event of the given type attached. */
function hasBoundaryOf(
	elementId: string,
	eventType: "error" | "timer",
	boundaryTypes: Map<string, Set<string>>,
): boolean {
	return boundaryTypes.get(elementId)?.has(eventType) ?? false
}

/** Returns true if the condition expression text appears to contain only literals (no variable names). */
function isLiteralOnlyCondition(text: string): boolean {
	// Strip leading "=" (FEEL unary test prefix)
	const expr = text.replace(/^\s*=\s*/, "").trim()

	// Patterns that are clearly literals: numbers, quoted strings, true/false/null
	const literalPattern = /^(?:"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)$/i
	if (literalPattern.test(expr)) return true

	// List of literals: [1, 2, 3] or ["a", "b"]
	const listPattern = /^\[(?:\s*(?:"[^"]*"|-?\d+(?:\.\d+)?|true|false|null)\s*,?\s*)*\]$/i
	if (listPattern.test(expr)) return true

	return false
}

// ---------------------------------------------------------------------------
// Pattern rules
// ---------------------------------------------------------------------------

export function analyzePatterns(p: BpmnProcess): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id
	const { byId, bySource, byTarget } = buildFlowIndex(p)
	const boundaryTypes = indexBoundaryTypes(p)

	// ── Rule 1: HTTP/REST service task without error boundary ───────────────
	for (const el of p.flowElements) {
		if (el.type !== "serviceTask") continue
		const jobType = readZeebeTaskType(el.extensionElements) ?? ""
		const isHttp =
			jobType.toLowerCase().includes("http") ||
			jobType.toLowerCase().includes("rest") ||
			jobType === "io.camunda.connector.HttpJson:1"
		if (!isHttp) continue
		if (!hasBoundaryOf(el.id, "error", boundaryTypes)) {
			findings.push({
				id: "pattern/http-no-error-boundary",
				category: "pattern",
				severity: "error",
				message: `Service task "${el.name ?? el.id}" calls an HTTP connector but has no error boundary event.`,
				suggestion:
					"Add an error boundary event to handle network failures (timeouts, non-2xx responses).",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 2: Exclusive gateway without default flow ──────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "exclusiveGateway") continue
		const outflows = bySource.get(el.id) ?? []
		if (outflows.length <= 1) continue // covered by single-outgoing rule
		if (el.default === undefined) {
			findings.push({
				id: "pattern/gateway-no-default-flow",
				category: "pattern",
				severity: "error",
				message: `Exclusive gateway "${el.name ?? el.id}" has no default sequence flow.`,
				suggestion:
					"Add a default flow to ensure the process does not get stuck when no condition matches.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 3: Sub-process without error boundary ──────────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "subProcess" && el.type !== "adHocSubProcess" && el.type !== "transaction")
			continue
		if (!hasBoundaryOf(el.id, "error", boundaryTypes)) {
			findings.push({
				id: "pattern/subprocess-no-error-boundary",
				category: "pattern",
				severity: "error",
				message: `Sub-process "${el.name ?? el.id}" has no error boundary event.`,
				suggestion:
					"Add an error boundary event to catch unhandled errors thrown inside the sub-process.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 4: Call activity with no error propagation ─────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "callActivity") continue
		if (!hasBoundaryOf(el.id, "error", boundaryTypes)) {
			findings.push({
				id: "pattern/call-activity-no-error-boundary",
				category: "pattern",
				severity: "error",
				message: `Call activity "${el.name ?? el.id}" has no error boundary event.`,
				suggestion:
					"Add an error boundary event to handle errors propagated from the called process.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 5: Parallel branches writing the same variable ─────────────────
	for (const el of p.flowElements) {
		if (el.type !== "parallelGateway") continue
		const outflows = bySource.get(el.id) ?? []
		if (outflows.length < 2) continue

		// Collect output variable targets per branch (BFS one level deep)
		const branchTargets: string[][] = []
		for (const flow of outflows) {
			const targets: string[] = []
			const branchEl = byId.get(flow.targetRef)
			if (branchEl !== undefined) {
				const io = readZeebeIoMapping(branchEl.extensionElements)
				if (io !== null) {
					for (const out of io.outputs) {
						if (out.target.trim() !== "") targets.push(out.target.trim())
					}
				}
			}
			branchTargets.push(targets)
		}

		// Find variables written by more than one branch
		const seen = new Map<string, number>() // varName -> branch count
		for (const targets of branchTargets) {
			const unique = new Set(targets)
			for (const t of unique) {
				seen.set(t, (seen.get(t) ?? 0) + 1)
			}
		}
		const conflicts = [...seen.entries()].filter(([, count]) => count > 1).map(([v]) => v)
		if (conflicts.length > 0) {
			findings.push({
				id: "pattern/parallel-variable-conflict",
				category: "pattern",
				severity: "error",
				message: `Parallel branches from gateway "${el.name ?? el.id}" both write to: ${conflicts.join(", ")}.`,
				suggestion:
					"Last writer wins — result is non-deterministic. Use distinct variable names per branch.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 6: User task without timer boundary ────────────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "userTask") continue
		if (!hasBoundaryOf(el.id, "timer", boundaryTypes)) {
			findings.push({
				id: "pattern/user-task-no-timer",
				category: "pattern",
				severity: "warning",
				message: `User task "${el.name ?? el.id}" has no timer boundary event.`,
				suggestion:
					"Add a timer boundary to enforce an SLA and prevent tasks from waiting indefinitely.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 7: Service task output mapping with no result variable ──────────
	for (const el of p.flowElements) {
		if (el.type !== "serviceTask") continue
		const jobType = readZeebeTaskType(el.extensionElements)
		if (jobType === null) continue // not a worker task
		const io = readZeebeIoMapping(el.extensionElements)
		const hasOutputs = io !== null && io.outputs.length > 0
		if (!hasOutputs) {
			findings.push({
				id: "pattern/service-task-no-output",
				category: "pattern",
				severity: "warning",
				message: `Service task "${el.name ?? el.id}" has no output variable mapping.`,
				suggestion: "Map the job result to process variables so downstream tasks can consume it.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 8: Error boundary leading directly to end event (catch-and-swallow) ─
	for (const el of p.flowElements) {
		if (el.type !== "boundaryEvent") continue
		const hasError = el.eventDefinitions.some((d) => d.type === "error")
		if (!hasError) continue
		const outflows = bySource.get(el.id) ?? []
		for (const flow of outflows) {
			const target = byId.get(flow.targetRef)
			if (target !== undefined && target.type === "endEvent") {
				findings.push({
					id: "pattern/catch-and-swallow",
					category: "pattern",
					severity: "warning",
					message: `Error boundary on "${el.attachedToRef}" leads directly to an end event — error is silently consumed.`,
					suggestion:
						"Add error logging, compensation, or re-throw the error rather than swallowing it silently.",
					processId,
					elementIds: [el.id],
				})
				break
			}
		}
	}

	// ── Rule 9: Exclusive gateway with only one outgoing flow ───────────────
	for (const el of p.flowElements) {
		if (el.type !== "exclusiveGateway") continue
		const outflows = bySource.get(el.id) ?? []
		if (outflows.length === 1) {
			findings.push({
				id: "pattern/gateway-single-outgoing",
				category: "pattern",
				severity: "warning",
				message: `Exclusive gateway "${el.name ?? el.id}" has only one outgoing flow and is a pass-through.`,
				suggestion: "Remove this gateway and connect its source directly to its target.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 10: Undocumented process start variables ───────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "startEvent") continue
		if (el.eventDefinitions.length > 0) continue // message/timer start — skip
		const inflows = byTarget.get(el.id) ?? []
		if (inflows.length > 0) continue // not a true start
		const hasDoc = el.documentation !== undefined && el.documentation.trim() !== ""
		if (!hasDoc) {
			findings.push({
				id: "pattern/start-no-documentation",
				category: "pattern",
				severity: "warning",
				message: `Start event "${el.name ?? el.id}" has no documentation describing expected input variables.`,
				suggestion:
					"Add documentation listing the process input variables so callers know the expected contract.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 11: Timer boundary with duration 0 ──────────────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "boundaryEvent") continue
		for (const def of el.eventDefinitions) {
			if (def.type !== "timer") continue
			const dur = def.timeDuration?.trim() ?? ""
			const isZero =
				dur === "PT0S" ||
				dur === "P0D" ||
				dur === "PT0M" ||
				dur === "PT0H" ||
				dur === "0" ||
				dur === "P0"
			if (isZero) {
				findings.push({
					id: "pattern/timer-duration-zero",
					category: "pattern",
					severity: "error",
					message: `Timer boundary on "${el.attachedToRef}" has a duration of zero — it will fire immediately.`,
					suggestion: "Set a meaningful duration (e.g. PT1H for 1 hour) to avoid instant firing.",
					processId,
					elementIds: [el.id],
				})
			}
		}
	}

	// ── Rule 12: Boundary event with no outgoing flow ────────────────────────
	for (const el of p.flowElements) {
		if (el.type !== "boundaryEvent") continue
		const outflows = bySource.get(el.id) ?? []
		if (outflows.length === 0) {
			findings.push({
				id: "pattern/boundary-no-outgoing",
				category: "pattern",
				severity: "error",
				message: `Boundary event on "${el.attachedToRef}" has no outgoing sequence flow.`,
				suggestion: "Connect the boundary event to a handler task or end event.",
				processId,
				elementIds: [el.id],
			})
		}
	}

	// ── Rule 13: Empty text annotation ──────────────────────────────────────
	for (const ann of p.textAnnotations) {
		const text = ann.text?.trim() ?? ""
		if (text === "") {
			findings.push({
				id: "pattern/empty-annotation",
				category: "pattern",
				severity: "info",
				message: `Text annotation "${ann.id}" is empty.`,
				suggestion: "Fill in the annotation or remove it to keep the diagram clean.",
				processId,
				elementIds: [ann.id],
			})
		}
	}

	// ── Rule 14: Duplicate job type across multiple service tasks ────────────
	const jobTypeCounts = new Map<string, string[]>() // jobType -> [elementId]
	for (const el of p.flowElements) {
		if (el.type !== "serviceTask") continue
		const jobType = readZeebeTaskType(el.extensionElements)
		if (jobType === null || jobType.trim() === "") continue
		const ids = jobTypeCounts.get(jobType) ?? []
		ids.push(el.id)
		jobTypeCounts.set(jobType, ids)
	}
	for (const [jobType, ids] of jobTypeCounts) {
		if (ids.length < 2) continue
		findings.push({
			id: "pattern/duplicate-job-type",
			category: "pattern",
			severity: "info",
			message: `Job type "${jobType}" is used by ${ids.length} service tasks.`,
			suggestion:
				"Verify this is intentional — the same worker will handle all these tasks. Consider distinct job types if behaviors differ.",
			processId,
			elementIds: ids,
		})
	}

	// ── Rule 15: FEEL condition using only literal values ────────────────────
	const checkedFlows = new Set<string>()
	for (const flow of p.sequenceFlows) {
		if (checkedFlows.has(flow.id)) continue
		checkedFlows.add(flow.id)
		const cond = flow.conditionExpression?.text?.trim()
		if (cond === undefined || cond === "") continue
		if (isLiteralOnlyCondition(cond)) {
			const sourceEl = byId.get(flow.sourceRef)
			findings.push({
				id: "pattern/literal-condition",
				category: "pattern",
				severity: "info",
				message: `Sequence flow "${flow.name ?? flow.id}" has a condition that only references literal values: \`${cond}\``,
				suggestion:
					"A literal condition never changes at runtime. Replace with a variable reference or remove the condition.",
				processId,
				elementIds: [flow.id, ...(sourceEl !== undefined ? [sourceEl.id] : [])],
			})
		}
	}

	return findings
}
