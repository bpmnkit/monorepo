import type { BpmnFlowElement, BpmnSequenceFlow } from "../bpmn/bpmn-model.js";

/** Adjacency list representation of a directed graph. */
export interface DirectedGraph {
	/** Node IDs. */
	nodes: string[];
	/** Adjacency: nodeId → list of successor nodeIds. */
	successors: Map<string, string[]>;
	/** Reverse adjacency: nodeId → list of predecessor nodeIds. */
	predecessors: Map<string, string[]>;
}

/** Back-edge detected during DFS. */
export interface BackEdge {
	flowId: string;
	sourceRef: string;
	targetRef: string;
}

/** Build a directed graph from BPMN flow nodes and sequence flows. */
export function buildGraph(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): DirectedGraph {
	const nodes = flowNodes.map((n) => n.id);
	const successors = new Map<string, string[]>();
	const predecessors = new Map<string, string[]>();

	for (const id of nodes) {
		successors.set(id, []);
		predecessors.set(id, []);
	}

	for (const flow of sequenceFlows) {
		const succs = successors.get(flow.sourceRef);
		if (succs) succs.push(flow.targetRef);

		const preds = predecessors.get(flow.targetRef);
		if (preds) preds.push(flow.sourceRef);
	}

	return { nodes, successors, predecessors };
}

/**
 * Detect back-edges via DFS.
 * A back-edge is an edge where the target is an ancestor of the source in the DFS tree.
 */
export function detectBackEdges(
	graph: DirectedGraph,
	sequenceFlows: BpmnSequenceFlow[],
): BackEdge[] {
	const WHITE = 0;
	const GRAY = 1;
	const BLACK = 2;

	const color = new Map<string, number>();
	for (const id of graph.nodes) {
		color.set(id, WHITE);
	}

	const backEdges: BackEdge[] = [];
	const flowIndex = new Map<string, BpmnSequenceFlow>();
	for (const flow of sequenceFlows) {
		flowIndex.set(`${flow.sourceRef}->${flow.targetRef}`, flow);
	}

	function dfs(nodeId: string): void {
		color.set(nodeId, GRAY);
		const succs = graph.successors.get(nodeId) ?? [];
		for (const succ of succs) {
			const c = color.get(succ);
			if (c === GRAY) {
				const flow = flowIndex.get(`${nodeId}->${succ}`);
				if (flow) {
					backEdges.push({
						flowId: flow.id,
						sourceRef: nodeId,
						targetRef: succ,
					});
				}
			} else if (c === WHITE) {
				dfs(succ);
			}
		}
		color.set(nodeId, BLACK);
	}

	for (const id of graph.nodes) {
		if (color.get(id) === WHITE) {
			dfs(id);
		}
	}

	return backEdges;
}

/** Reverse back-edges in the graph to make it a DAG. Returns the modified graph. */
export function reverseBackEdges(graph: DirectedGraph, backEdges: BackEdge[]): DirectedGraph {
	const successors = new Map<string, string[]>();
	const predecessors = new Map<string, string[]>();

	for (const id of graph.nodes) {
		successors.set(id, [...(graph.successors.get(id) ?? [])]);
		predecessors.set(id, [...(graph.predecessors.get(id) ?? [])]);
	}

	for (const be of backEdges) {
		// Remove forward direction
		const succs = successors.get(be.sourceRef);
		if (succs) {
			const idx = succs.indexOf(be.targetRef);
			if (idx >= 0) succs.splice(idx, 1);
		}
		const preds = predecessors.get(be.targetRef);
		if (preds) {
			const idx = preds.indexOf(be.sourceRef);
			if (idx >= 0) preds.splice(idx, 1);
		}

		// Add reversed direction
		const revSuccs = successors.get(be.targetRef);
		if (revSuccs) revSuccs.push(be.sourceRef);
		const revPreds = predecessors.get(be.sourceRef);
		if (revPreds) revPreds.push(be.targetRef);
	}

	return { nodes: [...graph.nodes], successors, predecessors };
}

/** Topological sort of a DAG. Throws if cycles remain. */
export function topologicalSort(graph: DirectedGraph): string[] {
	const inDegree = new Map<string, number>();
	for (const id of graph.nodes) {
		inDegree.set(id, (graph.predecessors.get(id) ?? []).length);
	}

	const queue: string[] = [];
	for (const [id, deg] of inDegree) {
		if (deg === 0) queue.push(id);
	}

	const sorted: string[] = [];
	while (queue.length > 0) {
		const node = queue.shift();
		if (!node) break;
		sorted.push(node);
		for (const succ of graph.successors.get(node) ?? []) {
			const newDeg = (inDegree.get(succ) ?? 1) - 1;
			inDegree.set(succ, newDeg);
			if (newDeg === 0) queue.push(succ);
		}
	}

	if (sorted.length !== graph.nodes.length) {
		throw new Error(
			`Layout error: graph contains cycles after back-edge reversal (sorted ${sorted.length} of ${graph.nodes.length} nodes)`,
		);
	}

	return sorted;
}
