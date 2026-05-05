import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import { assertNoOverlap } from "./overlap.js"
import { layoutSubProcesses } from "./subprocess.js"
import type { LayoutNode, LayoutResult } from "./types.js"
import { layoutV2 } from "./v2/engine.js"

/**
 * Auto-layout a BPMN process using the v2 layout engine.
 * Sub-processes with child elements are expanded and their children laid out recursively.
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	// Build nodeIndex for subprocess expansion
	const nodeIndex = new Map<string, BpmnFlowElement>()
	for (const n of process.flowElements) nodeIndex.set(n.id, n)

	const result = layoutV2(
		process.flowElements,
		process.sequenceFlows,
		process.textAnnotations ?? [],
		process.associations ?? [],
	)

	// Expand sub-processes: lay out their children and grow the container to fit
	const childResults = layoutSubProcesses(result.nodes, nodeIndex)
	if (childResults.length > 0) {
		// After subprocess expansion, push later nodes right to avoid overlap
		resolveSubProcessOverlaps(result.nodes)

		// Add child nodes and edges to the result
		for (const cr of childResults) {
			for (const cn of cr.result.nodes) result.nodes.push(cn)
			for (const ce of cr.result.edges) result.edges.push(ce)
		}
	}

	assertNoOverlap(result)
	return result
}

/**
 * Layout a set of flow nodes and sequence flows.
 * Used both for top-level processes and recursively for sub-processes.
 * Annotations not supported — callers that need annotation layout use layoutProcess().
 */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	return layoutV2(flowNodes, sequenceFlows)
}

/**
 * After subprocess expansion, cascade-shift subsequent layers rightward so
 * expanded containers don't overlap with their right-hand neighbours.
 */
function resolveSubProcessOverlaps(nodes: LayoutNode[]): void {
	const expanded = nodes.filter((n) => n.isExpanded)
	if (expanded.length === 0) return

	const MIN_GAP = 50
	const byLayer = new Map<number, LayoutNode[]>()
	for (const n of nodes) {
		const arr = byLayer.get(n.layer) ?? []
		arr.push(n)
		byLayer.set(n.layer, arr)
	}

	const layers = [...byLayer.keys()].sort((a, b) => a - b)
	for (let i = 1; i < layers.length; i++) {
		const prevKey = layers[i - 1]
		const curKey = layers[i]
		if (prevKey === undefined || curKey === undefined) continue
		const prevNodes = byLayer.get(prevKey)
		const curNodes = byLayer.get(curKey)
		if (!prevNodes || !curNodes) continue

		let prevRight = 0
		for (const n of prevNodes) {
			prevRight = Math.max(prevRight, n.bounds.x + n.bounds.width)
			if (n.labelBounds) prevRight = Math.max(prevRight, n.labelBounds.x + n.labelBounds.width)
		}

		let curLeft = Number.POSITIVE_INFINITY
		for (const n of curNodes) curLeft = Math.min(curLeft, n.bounds.x)

		const gap = curLeft - prevRight
		if (gap < MIN_GAP) {
			const dx = MIN_GAP - gap
			// Only the container node's X is shifted here — child nodes are not present yet.
			// Expanded subprocess children are appended to result.nodes after this function
			// returns (already in absolute coordinates), so no child-sync is needed.
			for (const n of curNodes) {
				n.bounds.x += dx
				if (n.labelBounds) n.labelBounds.x += dx
			}
		}
	}
}
