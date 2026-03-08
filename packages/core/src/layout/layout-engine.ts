import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../bpmn/bpmn-model.js";
import {
	alignBaselinePath,
	alignBranchBaselines,
	alignSplitJoinPairs,
	assignCoordinates,
	distributeSplitBranches,
	ensureEarlyReturnOffBaseline,
	resolveLayerOverlaps,
} from "./coordinates.js";
import { minimizeCrossings } from "./crossing.js";
import { buildGraph, detectBackEdges, reverseBackEdges } from "./graph.js";
import { assignLayers, groupByLayer } from "./layers.js";
import { assertNoOverlap } from "./overlap.js";
import { routeEdges } from "./routing.js";
import { layoutSubProcesses } from "./subprocess.js";
import type { LayoutNode, LayoutResult } from "./types.js";
/**
 * Auto-layout a BPMN process using the Sugiyama/layered algorithm.
 *
 * Phases:
 * 1. Cycle removal — DFS back-edge detection and reversal
 * 2. Layer assignment — Longest-path layering
 * 3. Crossing minimization — Barycenter heuristic
 * 4. Coordinate assignment — Fixed element sizes with spacing
 * 5. Sub-process layout — Recursive nested passes
 * 6. Edge routing — Orthogonal waypoints
 * 7. Overlap assertion — Post-condition validation
 */
export function layoutProcess(process: BpmnProcess): LayoutResult {
	const result = layoutFlowNodes(process.flowElements, process.sequenceFlows);
	assertNoOverlap(result);
	return result;
}

/**
 * Layout a set of flow nodes and sequence flows.
 * Used both for top-level processes and recursively for sub-processes.
 */
export function layoutFlowNodes(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): LayoutResult {
	if (flowNodes.length === 0) {
		return { nodes: [], edges: [] };
	}

	// Build node index
	const nodeIndex = new Map<string, BpmnFlowElement>();
	for (const node of flowNodes) {
		nodeIndex.set(node.id, node);
	}

	// Phase 1: Build graph and detect/remove cycles
	const graph = buildGraph(flowNodes, sequenceFlows);
	const backEdges = detectBackEdges(graph, sequenceFlows);
	const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph;

	// Phase 2: Layer assignment
	const layers = assignLayers(dag);

	// Phase 3: Group by layer and minimize crossings
	const layerGroups = groupByLayer(layers);
	const orderedLayers = minimizeCrossings(layerGroups, dag);

	// Phase 4: Coordinate assignment
	const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

	// Phase 4b: Align linear sequences to a common y-baseline
	alignBranchBaselines(layoutNodes, dag);

	// Phase 4c: Align split/join gateway pairs to same y-coordinate
	alignSplitJoinPairs(layoutNodes, dag);

	// Phase 4d: Align all baseline-path nodes to the same center-Y
	alignBaselinePath(layoutNodes, dag);

	// Phase 4e: Ensure early-return branches are never on the baseline
	ensureEarlyReturnOffBaseline(layoutNodes, dag);

	// Phase 4f: Distribute split gateway branches symmetrically
	distributeSplitBranches(layoutNodes, dag);

	// Phase 4g: Resolve any layer overlaps from redistribution
	resolveLayerOverlaps(layoutNodes);

	// Phase 5: Sub-process layout — expand containers and lay out children
	const childResults = layoutSubProcesses(layoutNodes, nodeIndex);

	// After subprocess expansion, push nodes that now overlap with expanded containers
	resolveSubProcessOverlaps(layoutNodes);

	// Phase 6: Edge routing (uses original back-edges for routing, not reversed)
	const nodeMap = new Map<string, LayoutNode>();
	for (const node of layoutNodes) {
		nodeMap.set(node.id, node);
	}

	const edges = routeEdges(sequenceFlows, nodeMap, backEdges);

	// Flatten child results into the main layout
	const allNodes = [...layoutNodes];
	const allEdges = [...edges];
	for (const child of childResults) {
		for (const cn of child.result.nodes) {
			allNodes.push(cn);
		}
		for (const ce of child.result.edges) {
			allEdges.push(ce);
		}
	}

	return { nodes: allNodes, edges: allEdges };
}

/**
 * After subprocess expansion, cascade-shift all subsequent layers
 * so that inter-layer spacing is preserved.
 */
function resolveSubProcessOverlaps(nodes: LayoutNode[]): void {
	const expanded = nodes.filter((n) => n.isExpanded);
	if (expanded.length === 0) return;

	// Group nodes by layer
	const byLayer = new Map<number, LayoutNode[]>();
	for (const n of nodes) {
		const arr = byLayer.get(n.layer);
		if (arr) arr.push(n);
		else byLayer.set(n.layer, [n]);
	}

	const layers = [...byLayer.keys()].sort((a, b) => a - b);
	const MIN_GAP = 50;

	// Cascade: ensure each layer starts after previous layer's rightmost edge
	for (let i = 1; i < layers.length; i++) {
		const prevKey = layers[i - 1];
		const curKey = layers[i];
		if (prevKey === undefined || curKey === undefined) continue;
		const prevNodes = byLayer.get(prevKey);
		const curNodes = byLayer.get(curKey);
		if (!prevNodes || !curNodes) continue;

		// Find rightmost edge in previous layer (including labels)
		let prevRight = 0;
		for (const n of prevNodes) {
			prevRight = Math.max(prevRight, n.bounds.x + n.bounds.width);
			if (n.labelBounds) {
				prevRight = Math.max(prevRight, n.labelBounds.x + n.labelBounds.width);
			}
		}

		// Find leftmost edge in current layer
		let curLeft = Number.POSITIVE_INFINITY;
		for (const n of curNodes) {
			curLeft = Math.min(curLeft, n.bounds.x);
		}

		const gap = curLeft - prevRight;
		if (gap < MIN_GAP) {
			const dx = MIN_GAP - gap;
			for (const n of curNodes) {
				n.bounds.x += dx;
				if (n.labelBounds) {
					n.labelBounds.x += dx;
				}
			}
		}
	}
}
