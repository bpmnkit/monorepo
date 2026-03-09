import type { BpmnDefinitions, BpmnProcess } from "../bpmn-model.js"
import type { OptimizationFinding, ResolvedOptions } from "./types.js"
import { buildFlowIndex, findProcess, readZeebeIoMapping, readZeebeTaskType } from "./utils.js"

// ---------------------------------------------------------------------------
// FEEL complexity scoring
// ---------------------------------------------------------------------------

const FEEL_KEYWORD_OPERATORS = new Set([
	"and",
	"or",
	"not",
	"if",
	"then",
	"else",
	"instance",
	"of",
	"some",
	"every",
	"satisfies",
	"function",
])

interface FeelScore {
	length: number
	nestingDepth: number
	operatorCount: number
	variableCount: number
	isComplex: boolean
}

function scoreFeelExpression(expr: string, opts: ResolvedOptions): FeelScore {
	const length = expr.length

	// Nesting depth: track max depth of parentheses/brackets
	let depth = 0
	let nestingDepth = 0
	for (const ch of expr) {
		if (ch === "(" || ch === "[") {
			depth++
			if (depth > nestingDepth) nestingDepth = depth
		} else if (ch === ")" || ch === "]") {
			depth--
		}
	}

	// Tokenize on non-word boundaries; collect keywords and identifiers
	const wordTokens = expr.split(/\W+/).filter(Boolean)
	let operatorCount = 0
	const variables = new Set<string>()
	for (const token of wordTokens) {
		if (FEEL_KEYWORD_OPERATORS.has(token)) {
			operatorCount++
		} else if (!/^\d/.test(token)) {
			variables.add(token)
		}
	}

	// Count symbol operators (order matters: longer patterns first)
	const symbolMatches = expr.match(/!=|<=|>=|[+\-*/=<>]/g) ?? []
	operatorCount += symbolMatches.length

	const variableCount = variables.size
	const isComplex =
		length > opts.feelLengthThreshold ||
		nestingDepth > opts.feelNestingThreshold ||
		operatorCount > opts.feelOperatorThreshold ||
		variableCount > opts.feelVariableThreshold

	return { length, nestingDepth, operatorCount, variableCount, isComplex }
}

// ---------------------------------------------------------------------------
// FEEL analyzer
// ---------------------------------------------------------------------------

export function analyzeFeel(p: BpmnProcess, opts: ResolvedOptions): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const { bySource } = buildFlowIndex(p)
	const processId = p.id

	// Track FEEL expressions across all sequence flows for duplicate detection
	const exprToFlowIds = new Map<string, string[]>()

	for (const flow of p.sequenceFlows) {
		// Determine if source is an exclusive/inclusive gateway
		const srcEl = p.flowElements.find((e) => e.id === flow.sourceRef)
		const srcIsDecisionGateway =
			srcEl !== undefined &&
			(srcEl.type === "exclusiveGateway" || srcEl.type === "inclusiveGateway")

		if (srcIsDecisionGateway && srcEl !== undefined) {
			const defaultFlowId =
				srcEl.type === "exclusiveGateway" || srcEl.type === "inclusiveGateway"
					? srcEl.default
					: undefined

			if (!flow.conditionExpression && flow.id !== defaultFlowId) {
				findings.push({
					id: "feel/empty-condition",
					category: "feel",
					severity: "error",
					message: `Sequence flow "${flow.id}" exits a decision gateway without a condition expression.`,
					suggestion: "Add a FEEL condition expression or mark this flow as the default.",
					processId,
					elementIds: [flow.id],
				})
			}
		}

		// Track FEEL expression for duplicate detection
		if (flow.conditionExpression) {
			const expr = flow.conditionExpression.text.trim()
			if (expr.length > 0) {
				const list = exprToFlowIds.get(expr) ?? []
				list.push(flow.id)
				exprToFlowIds.set(expr, list)
			}

			// Check complexity
			const score = scoreFeelExpression(flow.conditionExpression.text, opts)
			if (score.isComplex) {
				findings.push({
					id: "feel/complex-condition",
					category: "feel",
					severity: "warning",
					message: `Condition on flow "${flow.id}" is complex (length=${score.length}, nesting=${score.nestingDepth}, operators=${score.operatorCount}, variables=${score.variableCount}).`,
					suggestion:
						"Consider extracting complex FEEL expressions into named variables or decision tables.",
					processId,
					elementIds: [flow.id],
				})
			}
		}
	}

	// Check gateways: missing default flow
	for (const el of p.flowElements) {
		if (el.type !== "exclusiveGateway" && el.type !== "inclusiveGateway") continue

		const outflows = bySource.get(el.id) ?? []
		if (outflows.length < 2) continue

		if (!el.default) {
			const lastFlowId = outflows[outflows.length - 1]?.id ?? ""
			const gwId = el.id
			findings.push({
				id: "feel/missing-default-flow",
				category: "feel",
				severity: "warning",
				message: `Gateway "${el.id}" has ${outflows.length} outgoing flows but no default flow set.`,
				suggestion: "Set a default flow to handle unmatched conditions.",
				processId,
				elementIds: [el.id],
				applyFix: (defs: BpmnDefinitions) => {
					const proc = findProcess(defs, processId)
					if (!proc) return { description: "Process not found" }
					const gw = proc.flowElements.find((e) => e.id === gwId)
					if (!gw) return { description: "Gateway not found" }
					if (gw.type === "exclusiveGateway" || gw.type === "inclusiveGateway") {
						gw.default = lastFlowId
					}
					return { description: `Set default flow to "${lastFlowId}" on gateway "${gwId}"` }
				},
			})
		}
	}

	// Check service tasks: complex IO mapping
	// Skip connector tasks — their ioMapping inputs are structured connector parameters
	// (url, method, headers, body), not user-authored FEEL expressions.
	const REST_CONNECTOR_TYPE = "io.camunda:http-json:1"
	for (const el of p.flowElements) {
		if (el.type !== "serviceTask") continue
		if (readZeebeTaskType(el.extensionElements) === REST_CONNECTOR_TYPE) continue
		const ioMapping = readZeebeIoMapping(el.extensionElements)
		if (!ioMapping) continue
		for (const input of ioMapping.inputs) {
			const score = scoreFeelExpression(input.source, opts)
			if (score.isComplex) {
				findings.push({
					id: "feel/complex-io-mapping",
					category: "feel",
					severity: "info",
					message: `IO mapping input source on task "${el.id}" is complex.`,
					suggestion: "Consider extracting complex FEEL expressions into intermediate variables.",
					processId,
					elementIds: [el.id],
				})
				break // One finding per task
			}
		}
	}

	// Duplicate FEEL expressions
	for (const [expr, flowIds] of exprToFlowIds) {
		if (flowIds.length >= 2) {
			findings.push({
				id: "feel/duplicate-expression",
				category: "feel",
				severity: "info",
				message: `FEEL expression "${expr.slice(0, 40)}" appears on ${flowIds.length} sequence flows.`,
				suggestion:
					"Consider extracting repeated FEEL expressions into a shared variable or decision table.",
				processId,
				elementIds: flowIds,
			})
		}
	}

	return findings
}
