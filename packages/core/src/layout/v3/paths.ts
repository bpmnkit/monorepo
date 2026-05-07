/**
 * v3 layout — Step 7: enumerate all forward paths through the process.
 *
 * DFS from every start node (zero in-degree in the forward graph) to every
 * end node (zero out-degree in the forward graph), excluding back-edges.
 * Paths that pass a node touched by a back-edge are flagged with hasLoop.
 * Stops after MAX_PATHS paths to avoid exponential blowup.
 */
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"

const MAX_PATHS = 50

export interface ProcessPath {
	/** Ordered node IDs from start to end. */
	nodeIds: string[]
	/** Sequence-flow IDs along the path. */
	edgeIds: string[]
	/** True when at least one node on this path has an adjacent back-edge. */
	hasLoop: boolean
}

export function findAllPaths(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): ProcessPath[] {
	// Forward adjacency (excluding back-edges)
	const outAdj = new Map<string, Array<{ targetId: string; edgeId: string }>>()
	const inDegree = new Map<string, number>()
	for (const n of flowNodes) {
		outAdj.set(n.id, [])
		inDegree.set(n.id, 0)
	}
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) continue
		outAdj.get(f.sourceRef)?.push({ targetId: f.targetRef, edgeId: f.id })
		inDegree.set(f.targetRef, (inDegree.get(f.targetRef) ?? 0) + 1)
	}

	// Nodes touched by any back-edge (source or target)
	const loopNodeIds = new Set<string>()
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) {
			loopNodeIds.add(f.sourceRef)
			loopNodeIds.add(f.targetRef)
		}
	}

	const startIds = flowNodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id)

	const paths: ProcessPath[] = []

	function dfs(nodeId: string, nodePath: string[], edgePath: string[], visited: Set<string>): void {
		if (paths.length >= MAX_PATHS) return
		const successors = outAdj.get(nodeId) ?? []
		if (successors.length === 0) {
			paths.push({
				nodeIds: [...nodePath],
				edgeIds: [...edgePath],
				hasLoop: nodePath.some((id) => loopNodeIds.has(id)),
			})
			return
		}
		for (const { targetId, edgeId } of successors) {
			if (visited.has(targetId)) continue
			visited.add(targetId)
			nodePath.push(targetId)
			edgePath.push(edgeId)
			dfs(targetId, nodePath, edgePath, visited)
			nodePath.pop()
			edgePath.pop()
			visited.delete(targetId)
		}
	}

	for (const startId of startIds) {
		dfs(startId, [startId], [], new Set([startId]))
	}

	return paths
}
