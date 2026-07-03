import type { BpmnDefinitions, BpmnFlowElement } from "./bpmn-model.js"

export interface DiCompleteness {
	missingShapes: string[]
	missingEdges: string[]
}

interface SubLike {
	flowElements?: BpmnFlowElement[]
	sequenceFlows?: Array<{ id: string }>
}

/**
 * Assert the diagram DI is complete: every flow node (recursively, incl.
 * subprocess children and boundary events) and text annotation has a
 * BPMNShape; every sequence flow, association and message flow has a
 * BPMNEdge. Lanes are ignored (no reliable lane DI — matches the
 * tmp/02-di-check.cjs rule this ports).
 */
export function checkDiCompleteness(defs: BpmnDefinitions): DiCompleteness {
	const shapes = new Set<string>()
	const edges = new Set<string>()
	for (const d of defs.diagrams) {
		for (const s of d.plane.shapes) shapes.add(s.bpmnElement)
		for (const e of d.plane.edges) edges.add(e.bpmnElement)
	}

	const missingShapes: string[] = []
	const missingEdges: string[] = []

	function walkElements(els: BpmnFlowElement[], flows: Array<{ id: string }>): void {
		for (const el of els) {
			if (!shapes.has(el.id)) missingShapes.push(el.id)
			const sub = el as unknown as SubLike
			if (sub.flowElements?.length) walkElements(sub.flowElements, sub.sequenceFlows ?? [])
		}
		for (const f of flows) {
			if (!edges.has(f.id)) missingEdges.push(f.id)
		}
	}

	for (const p of defs.processes) {
		walkElements(p.flowElements, p.sequenceFlows)
		for (const ta of p.textAnnotations) if (!shapes.has(ta.id)) missingShapes.push(ta.id)
		for (const a of p.associations) if (!edges.has(a.id)) missingEdges.push(a.id)
	}
	for (const c of defs.collaborations) {
		for (const part of c.participants) if (!shapes.has(part.id)) missingShapes.push(part.id)
		for (const mf of c.messageFlows) if (!edges.has(mf.id)) missingEdges.push(mf.id)
	}

	return { missingShapes, missingEdges }
}
