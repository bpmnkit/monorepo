import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { gridLayoutFlowNodes } from "./grid/grid-engine.js"
import type { LayoutResult } from "./types.js"

/**
 * Layout a full process (grid engine). Boundary events, expanded
 * subprocesses and edge labels are handled inside the engine.
 * Never throws on residual label overlap — call assertNoOverlap yourself
 * in tests that validate known-good fixtures.
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	return layoutFlowNodes(process.flowElements, process.sequenceFlows)
}

/** Layout a set of flow nodes and sequence flows (used by ascii, proxy, compact). */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	return gridLayoutFlowNodes(flowNodes, sequenceFlows)
}
