import type { BpmnDefinitions } from "./bpmn-model.js"
import type { CompactDiagram } from "./compact.js"

/**
 * Runtime shape checks for the two document types the editing APIs take.
 *
 * Both are ordinary typed parameters, so a caller reaching for the neighbouring
 * API — `Bpmn.parse()` takes raw XML, `compactify()` takes a parsed model — used
 * to get an internal `TypeError` naming a private field, or, with an empty
 * operation list, their own input handed straight back as if the edit had run.
 * That second case is the dangerous one: it reads as a pipeline that ran and
 * preserved everything.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** A compact process is walked through `elements` and `flows`. */
function isCompactProcess(value: unknown): boolean {
	return isRecord(value) && Array.isArray(value.elements) && Array.isArray(value.flows)
}

/** A full process is walked through `flowElements` and `sequenceFlows`. */
function isFullProcess(value: unknown): boolean {
	return isRecord(value) && Array.isArray(value.flowElements) && Array.isArray(value.sequenceFlows)
}

/** Names a non-object argument the way an error message wants to read. */
function describe(value: unknown): string {
	if (value === null) return "null"
	if (value === undefined) return "undefined"
	if (Array.isArray(value)) return "an array"
	return `a ${typeof value}`
}

/** Every process in a non-empty list has the other document's shape. */
function allProcessesAre(processes: unknown[], shape: (value: unknown) => boolean): boolean {
	return processes.length > 0 && processes.every(shape)
}

function compactProblem(value: unknown): string | undefined {
	if (!isRecord(value)) {
		const hint =
			typeof value === "string" ? " Pass compactify(Bpmn.parse(xml)) if you have raw XML." : ""
		return `received ${describe(value)}.${hint}`
	}
	if (!Array.isArray(value.processes)) return "received an object with no processes array."
	if (allProcessesAre(value.processes, isFullProcess))
		return "received a BpmnDefinitions. Pass compactify(defs)."
	const bad = value.processes.findIndex((process) => !isCompactProcess(process))
	if (bad >= 0) return `received one whose processes[${bad}] has no elements and flows arrays.`
	return undefined
}

function definitionsProblem(value: unknown): string | undefined {
	if (!isRecord(value)) {
		const hint = typeof value === "string" ? " Pass Bpmn.parse(xml) if you have raw XML." : ""
		return `received ${describe(value)}.${hint}`
	}
	if (!Array.isArray(value.processes)) return "received an object with no processes array."
	if (allProcessesAre(value.processes, isCompactProcess))
		return "received a CompactDiagram. Pass the parsed model, not the compact projection."
	const bad = value.processes.findIndex((process) => !isFullProcess(process))
	if (bad >= 0)
		return `received one whose processes[${bad}] has no flowElements and sequenceFlows arrays.`
	return undefined
}

/**
 * Rejects anything that is not a {@link CompactDiagram} before it reaches code
 * that assumes one.
 *
 * @param value - The argument as given.
 * @param fn - The public function the argument was passed to, for the message.
 * @throws {TypeError} When `value` cannot be walked as a compact diagram.
 */
export function assertCompactDiagram(value: unknown, fn: string): asserts value is CompactDiagram {
	const problem = compactProblem(value)
	if (problem) throw new TypeError(`${fn} expects a CompactDiagram, ${problem}`)
}

/**
 * Rejects anything that is not a {@link BpmnDefinitions} before it reaches code
 * that assumes one.
 *
 * @param value - The argument as given.
 * @param fn - The public function the argument was passed to, for the message.
 * @throws {TypeError} When `value` cannot be walked as a parsed model.
 */
export function assertBpmnDefinitions(
	value: unknown,
	fn: string,
): asserts value is BpmnDefinitions {
	const problem = definitionsProblem(value)
	if (problem) throw new TypeError(`${fn} expects a BpmnDefinitions, ${problem}`)
}
