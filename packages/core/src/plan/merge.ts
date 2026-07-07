/**
 * Applies a `ProcessPlan` delta onto an already-compiled `BpmnDefinitions`
 * process — an id-based structural merge, not a byte-stable patch: elements
 * whose id already exists are replaced, new elements are appended, and
 * auto-layout re-runs over the whole diagram (so untouched elements keep
 * their meaning but not necessarily their exact DI coordinates).
 */
import { applyAutoLayout } from "../bpmn/auto-layout.js"
import type { BpmnDefinitions } from "../bpmn/bpmn-model.js"
import { Bpmn } from "../bpmn/index.js"
import { optimize } from "../bpmn/optimize/index.js"
import type { CompilePlanOptions, PlanProblem, SynthResult } from "./compile.js"
import { compilePlan } from "./compile.js"
import type { ProcessPlan } from "./types.js"

/**
 * Compiles `delta` standalone, then merges its elements/flows into
 * `existing`'s matching process by id (matching ids are replaced, new ids
 * are appended). `delta.steps[0]` must still be a `start` step — the merge
 * only uses `delta`'s flow elements and sequence flows, and drops the
 * delta's own start/end events when a same-id start/end already exists in
 * `existing`.
 */
export function mergePlan(
	existing: BpmnDefinitions,
	delta: ProcessPlan,
	opts: CompilePlanOptions = {},
): SynthResult {
	const deltaResult = compilePlan(delta, { ...opts, skipAutoFix: true })
	if (!deltaResult.defs) return deltaResult

	const targetProcess =
		existing.processes.find((p) => p.id === delta.process.id) ?? existing.processes[0]
	const deltaProcess = deltaResult.defs.processes[0]
	if (!targetProcess || !deltaProcess) {
		return { problems: [{ path: "process", message: "Could not resolve a process to merge into" }] }
	}

	const problems: PlanProblem[] = []

	for (const el of deltaProcess.flowElements) {
		const existingIndex = targetProcess.flowElements.findIndex((e) => e.id === el.id)
		if (existingIndex >= 0) targetProcess.flowElements[existingIndex] = el
		else targetProcess.flowElements.push(el)
	}

	// Sequence-flow ids aren't stable across compiles, so merging by flow id
	// would leave stale flows around any element the delta re-wires. Instead:
	// drop every existing flow touching an element the delta redefines, then
	// add the delta's flows fresh. Flows between two untouched elements are
	// left alone.
	const deltaElementIds = new Set(deltaProcess.flowElements.map((e) => e.id))
	targetProcess.sequenceFlows = targetProcess.sequenceFlows.filter(
		(f) => !deltaElementIds.has(f.sourceRef) && !deltaElementIds.has(f.targetRef),
	)
	targetProcess.sequenceFlows.push(...deltaProcess.sequenceFlows)

	// Pull in any new root error/message/signal/escalation definitions the delta introduced.
	for (const err of deltaResult.defs.errors) {
		if (!existing.errors.some((e) => e.id === err.id)) existing.errors.push(err)
	}
	for (const msg of deltaResult.defs.messages) {
		if (!existing.messages.some((m) => m.id === msg.id)) existing.messages.push(msg)
	}
	for (const sig of deltaResult.defs.signals) {
		if (!existing.signals.some((s) => s.id === sig.id)) existing.signals.push(sig)
	}
	for (const esc of deltaResult.defs.escalations) {
		if (!existing.escalations.some((e) => e.id === esc.id)) existing.escalations.push(esc)
	}

	let laidOut = applyAutoLayout(existing)

	if (!opts.skipAutoFix) {
		const report = optimize(laidOut)
		for (const finding of report.findings) finding.applyFix?.(laidOut)
		laidOut = applyAutoLayout(laidOut)
	}

	const finalReport = optimize(laidOut)
	for (const finding of finalReport.findings) {
		if (finding.severity === "error") {
			problems.push({
				path: finding.elementIds.length > 0 ? `element:${finding.elementIds.join(",")}` : "process",
				message: finding.message,
			})
		}
	}

	return { defs: laidOut, xml: Bpmn.export(laidOut), problems }
}
