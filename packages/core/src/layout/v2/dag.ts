// packages/core/src/layout/v2/dag.ts
import { V2Graph } from "./graph.js"
import type { V2Edge } from "./types.js"

export interface BackEdgeInfo {
	edgeId: string
	sourceId: string
	targetId: string
}

/**
 * DFS-based cycle detection.
 * An edge (u→v) is a back-edge when v is already in the current DFS call stack.
 */
export function detectBackEdges(graph: V2Graph): BackEdgeInfo[] {
	const result: BackEdgeInfo[] = []
	const visited = new Set<string>()
	const inStack = new Set<string>()
	const reportedEdges = new Set<string>() // prevent duplicates from multigraph

	function dfs(id: string): void {
		visited.add(id)
		inStack.add(id)

		for (const succId of graph.getSuccessors(id)) {
			if (!visited.has(succId)) {
				dfs(succId)
			} else if (inStack.has(succId)) {
				// Find the edge(s) connecting id → succId
				for (const [, e] of graph.edges) {
					if (e.sourceId === id && e.targetId === succId && !reportedEdges.has(e.id)) {
						reportedEdges.add(e.id)
						result.push({ edgeId: e.id, sourceId: id, targetId: succId })
					}
				}
			}
		}

		inStack.delete(id)
	}

	for (const id of graph.nodes.keys()) {
		if (!visited.has(id)) dfs(id)
	}
	return result
}

/**
 * Return a new graph where back-edges are reversed (for DAG layer assignment),
 * and mark original back-edges with isBackEdge=true.
 * The reversed edges use a "__rev" suffix ID and are only used for layer traversal.
 */
export function makeDAG(graph: V2Graph, backEdges: BackEdgeInfo[]): V2Graph {
	const backEdgeIds = new Set(backEdges.map((b) => b.edgeId))

	// Mark original edges as back-edges in-place (shared objects between graph and dag)
	for (const [id, e] of graph.edges) {
		if (backEdgeIds.has(id)) {
			;(e as V2Edge).isBackEdge = true
		}
	}

	const dag = new V2Graph()
	for (const n of graph.nodes.values()) dag.addNode(n)

	for (const [, e] of graph.edges) {
		if (backEdgeIds.has(e.id)) {
			// Add reversed edge for DAG traversal only
			dag.addEdge({
				id: `${e.id}__rev`,
				sourceId: e.targetId,
				targetId: e.sourceId,
				isBackEdge: false,
				waypoints: [],
			})
		} else {
			dag.addEdge(e)
		}
	}

	return dag
}
