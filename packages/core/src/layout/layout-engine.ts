import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { gridLayoutFlowNodes } from "./grid/grid-engine.js"
import { semanticLayoutProcess } from "./semantic/index.js"
import type { LayoutResult } from "./types.js"

/**
 * Which layout algorithm to run.
 *
 * `semantic` places nodes by rank and narrative band and honours lane
 * membership. `grid` is the older cell-grid walk, kept for collaborations,
 * where pool and message-flow geometry is still decided by the caller.
 */
export type LayoutEngine = "semantic" | "grid"

/**
 * Layout a full process. Boundary events, expanded subprocesses and edge
 * labels are handled inside the engine.
 * Never throws on residual label overlap — call assertNoOverlap yourself
 * in tests that validate known-good fixtures.
 */
export function layoutProcess(
	process: BpmnProcess,
	engine: LayoutEngine = "semantic",
): LayoutResult {
	if (engine === "grid") return gridLayoutFlowNodes(process.flowElements, process.sequenceFlows)
	return semanticLayoutProcess(process)
}

/** Layout a set of flow nodes and sequence flows (used by ascii, proxy, compact). */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	return gridLayoutFlowNodes(flowNodes, sequenceFlows)
}
