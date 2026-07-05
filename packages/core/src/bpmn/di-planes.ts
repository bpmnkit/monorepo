import type { BpmnDefinitions, BpmnDiPlane } from "./bpmn-model.js"

/**
 * Returns the DI plane whose `bpmnElement` matches `elementId`, if any.
 *
 * The primary plane's `bpmnElement` is a process or collaboration id; a
 * collapsed sub-process that carries its own layout has a separate
 * `BPMNDiagram` whose plane `bpmnElement` is the sub-process id. This resolves
 * either.
 */
export function planeForElement(defs: BpmnDefinitions, elementId: string): BpmnDiPlane | undefined {
	for (const diagram of defs.diagrams) {
		if (diagram.plane.bpmnElement === elementId) return diagram.plane
	}
	return undefined
}

/** Lists every DI plane's `bpmnElement` id, in document order. */
export function listPlaneElementIds(defs: BpmnDefinitions): string[] {
	return defs.diagrams.map((d) => d.plane.bpmnElement)
}
