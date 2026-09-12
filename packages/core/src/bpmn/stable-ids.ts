/**
 * Stable, content-derived ids for the parts of a model the caller does not name:
 * sequence flows, and the root messages, errors, signals and escalations that
 * event options declare.
 *
 * The fluent builder used to mint these with `generateId()`, so rebuilding an
 * unchanged model produced different BPMN every time — noisy diffs, and a
 * review that cannot tell a renamed edge from a new one. These ids come from
 * the model instead: for a flow, the endpoints it connects plus a discriminator
 * when one pair carries several flows; for a root definition, the name or code
 * it is looked up by.
 *
 * Flow ids are assigned in a pass over a finished scope rather than at creation
 * time, because a flow's endpoints are not final when it is created —
 * `insertAfter()` re-points a flow's source, and `insertJoinGateways()`
 * re-points its target.
 */
import { slugify, uniqueId } from "../plan/slug.js"
import type { BpmnFlowElement, BpmnSequenceFlow } from "./bpmn-model.js"

/** Longest id this produces; anything longer is truncated and hashed. */
const MAX_ID_LENGTH = 200

/**
 * FNV-1a, base36. Not a checksum anyone verifies — just a short, stable
 * discriminator for two flows the model distinguishes only by a long string.
 */
function shortHash(text: string): string {
	let hash = 0x811c9dc5
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i)
		hash = Math.imul(hash, 0x01000193) >>> 0
	}
	return hash.toString(36)
}

/** Keeps an id an XML NCName: letters, digits, `_` and `-`, never leading with a digit. */
function ncName(text: string): string {
	const cleaned = text.replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^[^A-Za-z_]+/, "")
	return cleaned.length > 0 ? cleaned : "x"
}

/** Truncates over-long ids, keeping them distinct by appending a hash of what was dropped. */
function capLength(id: string): string {
	if (id.length <= MAX_ID_LENGTH) return id
	const suffix = `_${shortHash(id)}`
	return id.slice(0, MAX_ID_LENGTH - suffix.length) + suffix
}

/** The id a flow gets when it is the only one between its two endpoints. */
function baseId(flow: BpmnSequenceFlow): string {
	return capLength(`Flow_${ncName(flow.sourceRef)}_${ncName(flow.targetRef)}`)
}

/**
 * What tells two flows between the same endpoints apart, in order of how
 * readable it is: the branch name, then the condition, then nothing — leaving
 * `uniqueId` to number genuinely identical edges.
 */
function discriminator(flow: BpmnSequenceFlow): string | undefined {
	if (flow.name !== undefined && flow.name.trim().length > 0) return ncName(slugify(flow.name))
	const condition = flow.conditionExpression?.text
	if (condition !== undefined && condition.trim().length > 0) return `c${shortHash(condition)}`
	return undefined
}

/**
 * Replaces generated sequence-flow ids in one scope (a process or a
 * sub-process) with ids derived from the flows themselves, and rewrites the
 * `default` attributes that name them.
 *
 * Run it after the topology is final — after join inference and any pending
 * splice — and before `incoming`/`outgoing` are recomputed.
 *
 * @param elements - The scope's flow elements. Their ids are reserved, and
 *   gateway `default` references are rewritten.
 * @param flows - The scope's sequence flows, mutated in place.
 * @param preserve - Ids to leave alone, for flows the builder did not create:
 *   continuing a parsed document must not renumber what it was handed.
 */
export function assignStableFlowIds(
	elements: BpmnFlowElement[],
	flows: BpmnSequenceFlow[],
	preserve?: ReadonlySet<string>,
): void {
	const renamable = preserve === undefined ? flows : flows.filter((flow) => !preserve.has(flow.id))
	if (renamable.length === 0) return

	// Reserved up front so a derived id can never land on an element id or on a
	// flow id this pass is not allowed to touch.
	const taken = new Set<string>(elements.map((element) => element.id))
	if (preserve !== undefined) {
		for (const flow of flows) if (preserve.has(flow.id)) taken.add(flow.id)
	}

	// Flows sharing a base id all get a discriminator, so which one was built
	// first — and so the order branches were declared in — does not decide who
	// keeps the short id.
	const byBase = new Map<string, BpmnSequenceFlow[]>()
	for (const flow of renamable) {
		const base = baseId(flow)
		const group = byBase.get(base)
		if (group) group.push(flow)
		else byBase.set(base, [flow])
	}

	const renamed = new Map<string, string>()
	for (const [base, group] of byBase) {
		for (const flow of group) {
			const qualifier = group.length > 1 ? discriminator(flow) : undefined
			const id = uniqueId(qualifier === undefined ? base : capLength(`${base}_${qualifier}`), taken)
			if (id !== flow.id) renamed.set(flow.id, id)
			flow.id = id
		}
	}

	if (renamed.size === 0) return
	for (const element of elements) {
		if (!("default" in element) || element.default === undefined) continue
		const replacement = renamed.get(element.default)
		if (replacement !== undefined) element.default = replacement
	}
}

/**
 * Derives a root definition's id from what callers look it up by — a message or
 * signal name, an error or escalation code — so the same declaration keeps the
 * same id across rebuilds.
 *
 * @param prefix - Element kind, e.g. `"Message"`.
 * @param source - The name or code the definition is resolved by.
 * @param existing - Definitions of the same kind already declared, whose ids
 *   the result is deduped against.
 */
export function rootDefinitionId(
	prefix: string,
	source: string,
	existing: ReadonlyArray<{ id: string }>,
): string {
	const taken = new Set(existing.map((definition) => definition.id))
	return uniqueId(capLength(`${prefix}_${ncName(slugify(source))}`), taken)
}
