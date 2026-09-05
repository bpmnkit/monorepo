import type { FeelNode } from "@bpmnkit/feel"
import { parseExpression } from "@bpmnkit/feel"
import type { BpmnProcess, BpmnSequenceFlow, BpmnSubProcess } from "../bpmn-model.js"
import type { OptimizationFinding } from "./types.js"
import { buildFlowIndex, readZeebeIoMapping, readZeebeTaskType } from "./utils.js"

// ---------------------------------------------------------------------------
// FEEL built-in names (excluded from variable references)
// ---------------------------------------------------------------------------

const FEEL_BUILTINS = new Set([
	"string",
	"string length",
	"substring",
	"substring before",
	"substring after",
	"upper case",
	"lower case",
	"contains",
	"starts with",
	"ends with",
	"matches",
	"replace",
	"split",
	"string join",
	"number",
	"decimal",
	"floor",
	"ceiling",
	"round half up",
	"round half down",
	"round up",
	"round down",
	"abs",
	"modulo",
	"sqrt",
	"log",
	"exp",
	"odd",
	"even",
	"random number",
	"count",
	"list contains",
	"append",
	"concatenate",
	"insert before",
	"remove",
	"reverse",
	"index of",
	"union",
	"distinct values",
	"duplicate values",
	"flatten",
	"product",
	"sum",
	"mean",
	"all",
	"any",
	"sublist",
	"min",
	"max",
	"median",
	"mode",
	"sort",
	"string join",
	"date",
	"time",
	"date and time",
	"duration",
	"years and months duration",
	"now",
	"today",
	"day of week",
	"day of year",
	"week of year",
	"month of year",
	"last day of month",
	"is",
	"is defined",
	"not",
	"true",
	"false",
	"null",
	"and",
	"or",
	"instance of",
	"get value",
	"get entries",
	"put",
	"put all",
	"context",
	"context merge",
	"context put",
	"context get entries",
	"context get value",
])

// ---------------------------------------------------------------------------
// FEEL AST identifier extractor
// ---------------------------------------------------------------------------

function collectNames(node: FeelNode, out: Set<string>): void {
	switch (node.kind) {
		case "name":
			if (!FEEL_BUILTINS.has(node.name)) out.add(node.name)
			break
		case "path":
			// a.b.c — only the root (base) is a variable reference
			collectNames(node.base, out)
			break
		case "binary":
			collectNames(node.left, out)
			collectNames(node.right, out)
			break
		case "unary-minus":
			collectNames(node.operand, out)
			break
		case "list":
			for (const item of node.items) collectNames(item, out)
			break
		case "context":
			for (const entry of node.entries) collectNames(entry.value, out)
			break
		case "range":
			collectNames(node.low, out)
			collectNames(node.high, out)
			break
		case "filter":
			collectNames(node.base, out)
			collectNames(node.condition, out)
			break
		case "call":
			for (const arg of node.args) collectNames(arg, out)
			break
		case "call-named":
			for (const arg of node.args) collectNames(arg.value, out)
			break
		case "if":
			collectNames(node.condition, out)
			collectNames(node.then, out)
			collectNames(node.else, out)
			break
		case "for":
			for (const b of node.bindings) collectNames(b.domain, out)
			collectNames(node.body, out)
			break
		case "some":
		case "every":
			for (const b of node.bindings) collectNames(b.domain, out)
			collectNames(node.satisfies, out)
			break
		case "between":
			collectNames(node.value, out)
			collectNames(node.low, out)
			collectNames(node.high, out)
			break
		case "in-test":
			collectNames(node.value, out)
			collectNames(node.test, out)
			break
		case "function-def":
			collectNames(node.body, out)
			break
		case "unary-test-list":
			for (const t of node.tests) collectNames(t, out)
			break
		case "unary-not":
			for (const t of node.tests) collectNames(t, out)
			break
		// Leaf nodes: number, string, boolean, null, temporal, any-input, instance-of
		default:
			break
	}
}

/** Extract variable names referenced in a FEEL expression string. */
export function extractFeelIdentifiers(expression: string): string[] {
	const trimmed = expression.trim()
	if (trimmed === "") return []
	// Strip leading "=" unary-test prefix if present
	const expr = trimmed.startsWith("=") ? trimmed.slice(1).trim() : trimmed
	const result = parseExpression(expr)
	if (result.ast === null) return []
	const names = new Set<string>()
	collectNames(result.ast, names)
	return [...names]
}

// ---------------------------------------------------------------------------
// Levenshtein distance (for typo suggestions)
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	// Flat row buffers — avoids noUncheckedIndexedAccess issues with 2D arrays
	let prev = new Int32Array(n + 1)
	let curr = new Int32Array(n + 1)
	for (let j = 0; j <= n; j++) prev[j] = j
	for (let i = 1; i <= m; i++) {
		curr[0] = i
		for (let j = 1; j <= n; j++) {
			curr[j] =
				a[i - 1] === b[j - 1]
					? (prev[j - 1] as number)
					: 1 + Math.min(prev[j] as number, curr[j - 1] as number, prev[j - 1] as number)
		}
		;[prev, curr] = [curr, prev]
	}
	return prev[n] as number
}

function findClosest(name: string, candidates: string[]): string | null {
	let best: string | null = null
	let bestDist = 3 // only suggest if distance ≤ 2
	for (const c of candidates) {
		if (c === name) continue
		const d = levenshtein(name, c)
		if (d < bestDist) {
			bestDist = d
			best = c
		}
	}
	return best
}

// ---------------------------------------------------------------------------
// Extension readers for result variables
// ---------------------------------------------------------------------------

function readResultVariable(
	ext: Array<{ name: string; attributes: Record<string, string>; children: unknown[] }>,
): string | null {
	for (const el of ext) {
		if (el.name === "zeebe:calledDecision" && el.attributes.resultVariable) {
			return el.attributes.resultVariable
		}
	}
	return null
}

// ---------------------------------------------------------------------------
// Scope propagation
// ---------------------------------------------------------------------------

/**
 * For every node in the flow graph, the variables produced by that node or by
 * any node with a path to it. A worklist fixed point over the graph handles
 * cycles and costs O((V + E) · vars), instead of one full graph walk per flow.
 */
function reachingProduces(
	flows: BpmnSequenceFlow[],
	produces: Map<string, string[]>,
): Map<string, Set<string>> {
	const successors = new Map<string, string[]>()
	const scope = new Map<string, Set<string>>()
	for (const flow of flows) {
		const out = successors.get(flow.sourceRef)
		if (out) out.push(flow.targetRef)
		else successors.set(flow.sourceRef, [flow.targetRef])
		if (!scope.has(flow.sourceRef)) {
			scope.set(flow.sourceRef, new Set(produces.get(flow.sourceRef) ?? []))
		}
		if (!scope.has(flow.targetRef)) {
			scope.set(flow.targetRef, new Set(produces.get(flow.targetRef) ?? []))
		}
	}

	const queue = [...scope.keys()]
	const queued = new Set(queue)
	for (let head = 0; head < queue.length; head++) {
		const id = queue[head] as string
		queued.delete(id)
		const own = scope.get(id)
		const next = successors.get(id)
		if (!own || own.size === 0 || !next) continue
		for (const target of next) {
			const targetScope = scope.get(target)
			if (!targetScope) continue
			let grew = false
			for (const v of own) {
				if (!targetScope.has(v)) {
					targetScope.add(v)
					grew = true
				}
			}
			if (grew && !queued.has(target)) {
				queued.add(target)
				queue.push(target)
			}
		}
	}
	return scope
}

// ---------------------------------------------------------------------------
// Main analysis
// ---------------------------------------------------------------------------

export function analyzeVariableFlow(p: BpmnProcess): OptimizationFinding[] {
	const findings: OptimizationFinding[] = []
	const processId = p.id

	// Maps: variable name → list of element IDs that produce / consume it
	const producedBy = new Map<string, string[]>()
	const consumedBy = new Map<string, string[]>()

	// Per-element role tracking
	const elementProduces = new Map<string, string[]>()
	const elementConsumes = new Map<string, string[]>()

	function addProducer(varName: string, elementId: string): void {
		if (varName.trim() === "") return
		const existing = producedBy.get(varName) ?? []
		if (!existing.includes(elementId)) existing.push(elementId)
		producedBy.set(varName, existing)

		const elList = elementProduces.get(elementId) ?? []
		if (!elList.includes(varName)) elList.push(varName)
		elementProduces.set(elementId, elList)
	}

	function addConsumer(varName: string, elementId: string): void {
		if (varName.trim() === "") return
		const existing = consumedBy.get(varName) ?? []
		if (!existing.includes(elementId)) existing.push(elementId)
		consumedBy.set(varName, existing)

		const elList = elementConsumes.get(elementId) ?? []
		if (!elList.includes(varName)) elList.push(varName)
		elementConsumes.set(elementId, elList)
	}

	// ── Scan flow elements ───────────────────────────────────────────────────

	for (const el of p.flowElements) {
		const io = readZeebeIoMapping(el.extensionElements)

		if (io !== null) {
			// IO mapping inputs: the *target* variable is what gets written into this task's local scope
			// IO mapping outputs: the *target* variable is what gets written back into the process scope
			for (const inp of io.inputs) {
				if (inp.target.trim() !== "") addProducer(inp.target.trim(), el.id)
				// The source expression may consume variables from the process scope
				for (const name of extractFeelIdentifiers(inp.source)) {
					addConsumer(name, el.id)
				}
			}
			for (const out of io.outputs) {
				if (out.target.trim() !== "") addProducer(out.target.trim(), el.id)
				// The source expression may consume local variables
				for (const name of extractFeelIdentifiers(out.source)) {
					addConsumer(name, el.id)
				}
			}
		}

		// Result variable (business rule tasks via zeebe:calledDecision)
		const resultVar = readResultVariable(
			el.extensionElements as Array<{
				name: string
				attributes: Record<string, string>
				children: unknown[]
			}>,
		)
		if (resultVar !== null) {
			addProducer(resultVar, el.id)
		}
	}

	// ── Scan sequence flow conditions ────────────────────────────────────────

	for (const flow of p.sequenceFlows) {
		const cond = flow.conditionExpression?.text?.trim()
		if (cond === undefined || cond === "") continue
		for (const name of extractFeelIdentifiers(cond)) {
			// Conditions on flows consume variables from the process scope
			// Associate with the source element (gateway)
			addConsumer(name, flow.sourceRef)
		}
	}

	// ── Compute findings ─────────────────────────────────────────────────────

	const allProducedNames = [...producedBy.keys()]

	// Finding: variable consumed but never produced anywhere
	const checkedConsumed = new Set<string>()
	for (const [varName, elementIds] of consumedBy) {
		if (checkedConsumed.has(varName)) continue
		checkedConsumed.add(varName)
		if (producedBy.has(varName)) continue

		const closest = findClosest(varName, allProducedNames)
		const suggestion =
			closest !== null
				? `"${varName}" is never set. Did you mean "${closest}"?`
				: `"${varName}" is never set on any path through this process.`

		findings.push({
			id: `data-flow/undefined-variable:${varName}`,
			category: "data-flow",
			severity: "warning",
			message: `Variable "${varName}" is referenced but never set in this process.`,
			suggestion,
			processId,
			elementIds,
			consumes: [varName],
		})
	}

	// Finding: variable produced but never consumed anywhere
	const checkedProduced = new Set<string>()
	for (const [varName, elementIds] of producedBy) {
		if (checkedProduced.has(varName)) continue
		checkedProduced.add(varName)
		if (consumedBy.has(varName)) continue

		findings.push({
			id: `data-flow/dead-output:${varName}`,
			category: "data-flow",
			severity: "info",
			message: `Variable "${varName}" is set but never read by any downstream element.`,
			suggestion: `Remove the output mapping for "${varName}" or add a task that consumes it.`,
			processId,
			elementIds,
			produces: [varName],
		})
	}

	// ── Attach per-element role findings (for the overlay plugin) ────────────

	const roleElements = new Set([...elementProduces.keys(), ...elementConsumes.keys()])
	for (const elementId of roleElements) {
		const produces = elementProduces.get(elementId) ?? []
		const consumes = elementConsumes.get(elementId) ?? []
		if (produces.length === 0 && consumes.length === 0) continue

		findings.push({
			id: `data-flow/role:${elementId}`,
			category: "data-flow",
			severity: "info",
			message: `Element "${elementId}" ${produces.length > 0 ? `produces: ${produces.join(", ")}` : ""}${produces.length > 0 && consumes.length > 0 ? "; " : ""}${consumes.length > 0 ? `consumes: ${consumes.join(", ")}` : ""}.`,
			suggestion: "",
			processId,
			elementIds: [elementId],
			produces: produces.length > 0 ? produces : undefined,
			consumes: consumes.length > 0 ? consumes : undefined,
		})
	}

	// ── Per-edge scope findings (variables available at each sequence flow) ──

	const scopeAt = reachingProduces(p.sequenceFlows, elementProduces)
	for (const flow of p.sequenceFlows) {
		const inScope = scopeAt.get(flow.sourceRef)
		if (inScope === undefined || inScope.size === 0) continue

		const scopeVars = [...inScope].sort()
		findings.push({
			id: `data-flow/edge-scope:${flow.id}`,
			category: "data-flow",
			severity: "info",
			message: `Variables in scope at flow "${flow.id}": ${scopeVars.join(", ")}.`,
			suggestion: "",
			processId,
			elementIds: [flow.id],
			produces: scopeVars,
		})
	}

	// ── Multi-instance sub-process inner scopes ──────────────────────────────────
	// For each multi-instance sub-process, emit edge-scope findings for inner
	// sequence flows seeded with the iteration variable (inputElement).

	for (const el of p.flowElements) {
		if (el.type !== "subProcess") continue
		const sp = el as BpmnSubProcess
		if (!sp.loopCharacteristics) continue

		// Extract inputElement from zeebe:loopCharacteristics extension element
		const loopExt = sp.loopCharacteristics.extensionElements.find(
			(e) => e.name === "zeebe:loopCharacteristics",
		)
		const inputElement = loopExt?.attributes.inputElement?.trim()
		if (!inputElement) continue

		// Collect variables produced by inner elements (from IO mapping outputs)
		const innerProduces = new Map<string, string[]>()
		for (const inner of sp.flowElements) {
			const io = readZeebeIoMapping(inner.extensionElements)
			if (io) {
				for (const out of io.outputs) {
					if (out.target.trim() === "") continue
					const list = innerProduces.get(inner.id) ?? []
					if (!list.includes(out.target.trim())) list.push(out.target.trim())
					innerProduces.set(inner.id, list)
				}
			}
		}

		// Emit edge-scope findings for inner sequence flows
		const innerScopeAt = reachingProduces(sp.sequenceFlows, innerProduces)
		for (const flow of sp.sequenceFlows) {
			// Scope always includes the iteration variable, plus anything inner elements produce
			const inScope = new Set<string>([inputElement])
			for (const v of innerScopeAt.get(flow.sourceRef) ?? []) inScope.add(v)

			const scopeVars = [...inScope].sort()
			findings.push({
				id: `data-flow/edge-scope:${flow.id}`,
				category: "data-flow",
				severity: "info",
				message: `Variables in scope at flow "${flow.id}": ${scopeVars.join(", ")}.`,
				suggestion: "",
				processId,
				elementIds: [flow.id],
				produces: scopeVars,
			})
		}
	}

	return findings
}
