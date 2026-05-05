import { routeEdgeAstar } from "../astar.js"
import type { Bounds } from "../types.js"
import type { V2Graph } from "./graph.js"
import type { PortAssignment } from "./types.js"
import { CELL_SIZE, TRACK_Y, isGateway } from "./types.js"

type MacroBlock = { bounds: Bounds; interiorIds: Set<string> }

/**
 * Compute aggregate bounding boxes for split-join gateway pairs.
 * Used as extra obstacles for edges that pass entirely outside a gateway block.
 */
function computeMacroBlocks(graph: V2Graph): MacroBlock[] {
	const blocks: MacroBlock[] = []

	for (const [splitId, splitNode] of graph.nodes) {
		if (!isGateway(splitNode.type) || splitNode.isDummy) continue
		if (graph.getSuccessors(splitId).length <= 1) continue

		// BFS to find all nodes reachable from split
		const reachable = new Set<string>()
		const bfsQ = [...graph.getSuccessors(splitId)]
		while (bfsQ.length > 0) {
			const cur = bfsQ.shift()
			if (cur === undefined || reachable.has(cur)) continue
			reachable.add(cur)
			bfsQ.push(...graph.getSuccessors(cur))
		}

		// Find the matching join gateway: all its predecessors come from within the reachable set
		let joinId: string | undefined
		for (const candidateId of reachable) {
			const candidate = graph.nodes.get(candidateId)
			if (!candidate || !isGateway(candidate.type) || candidate.isDummy) continue
			if (graph.getPredecessors(candidateId).length <= 1) continue
			const preds = graph.getPredecessors(candidateId)
			if (preds.every((p) => reachable.has(p) || p === splitId)) {
				joinId = candidateId
				break
			}
		}
		if (!joinId) continue

		const joinNode = graph.nodes.get(joinId)
		if (!joinNode) continue

		// Downstream from join (to exclude from interior)
		const fromJoin = new Set<string>()
		const joinQ = [...graph.getSuccessors(joinId)]
		while (joinQ.length > 0) {
			const cur = joinQ.shift()
			if (cur === undefined || fromJoin.has(cur)) continue
			fromJoin.add(cur)
			joinQ.push(...graph.getSuccessors(cur))
		}

		// Interior = reachable from split, not the join itself, not downstream
		const interiorIds = new Set<string>([splitId, joinId])
		let minX = Math.min(splitNode.x, joinNode.x)
		let minY = Math.min(splitNode.y, joinNode.y)
		let maxX = Math.max(splitNode.x + splitNode.width, joinNode.x + joinNode.width)
		let maxY = Math.max(splitNode.y + splitNode.height, joinNode.y + joinNode.height)

		for (const id of reachable) {
			if (id === joinId || fromJoin.has(id)) continue
			interiorIds.add(id)
			const n = graph.nodes.get(id)
			if (!n || n.isDummy) continue
			minX = Math.min(minX, n.x)
			minY = Math.min(minY, n.y)
			maxX = Math.max(maxX, n.x + n.width)
			maxY = Math.max(maxY, n.y + n.height)
		}

		blocks.push({
			bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
			interiorIds,
		})
	}

	return blocks
}

/**
 * Route all edges in the graph using the grid-visibility A* router (astar.ts).
 *
 * Back-edges are routed through the Track 1 highway: East → up to TRACK_Y[1] →
 * travel horizontally back → down to target. This produces 4 waypoints without
 * calling A* (highway is always clear).
 *
 * Normal edges call routeEdgeAstar with all nodes except source and target as
 * obstacles. An occupiedCells set steers later edges away from crowded corridors.
 *
 * Results are written back into edge.waypoints in-place.
 */
export function routeAllEdges(graph: V2Graph, ports: Map<string, PortAssignment>): void {
	// Build obstacle map keyed by node ID
	const obstacleMap = new Map<string, Bounds>()
	for (const [id, n] of graph.nodes) {
		if (n.isDummy || n.width === 0) continue
		obstacleMap.set(id, { x: n.x, y: n.y, width: n.width, height: n.height })
	}

	// Rule 4: Compute macro blocks for split-join gateway pairs
	const macroBlocks = computeMacroBlocks(graph)

	const occupiedCells = new Set<number>()

	function routeEdge(edgeId: string): void {
		const edge = graph.edges.get(edgeId)
		const assignment = ports.get(edgeId)
		if (!edge || !assignment) return

		const src = graph.nodes.get(edge.sourceId)
		const tgt = graph.nodes.get(edge.targetId)
		if (!src || !tgt) return

		if (edge.isBackEdge) {
			const highwayY = TRACK_Y[1]
			const sx = assignment.source.x
			const sy = assignment.source.y
			const tx = assignment.target.x
			const ty = assignment.target.y

			if (sy <= highwayY) {
				// Source is already at or above highway — route directly without a degenerate segment
				edge.waypoints = [
					{ x: sx, y: sy },
					{ x: Math.min(sx, tx) - CELL_SIZE, y: sy },
					{ x: Math.min(sx, tx) - CELL_SIZE, y: ty },
					{ x: tx, y: ty },
				]
			} else {
				// Fixed highway route: East → up to Track 1 → back to target X → down
				edge.waypoints = [
					{ x: sx, y: sy },
					{ x: sx, y: highwayY },
					{ x: tx, y: highwayY },
					{ x: tx, y: ty },
				]
			}
			return
		}

		// Exclude source and target from obstacles by ID
		const obstacles = [...obstacleMap.entries()]
			.filter(([id]) => id !== edge.sourceId && id !== edge.targetId)
			.map(([, bounds]) => bounds)

		// Rule 4: Add macro block bounds as extra obstacles for edges outside the block
		for (const block of macroBlocks) {
			if (!block.interiorIds.has(edge.sourceId) && !block.interiorIds.has(edge.targetId)) {
				obstacles.push(block.bounds)
			}
		}

		edge.waypoints = routeEdgeAstar(
			assignment.source,
			assignment.target,
			obstacles,
			0,
			0,
			occupiedCells,
		)
	}

	// Route back-edges first (they use the highway, no A* needed)
	for (const [id, e] of graph.edges) {
		if (e.isBackEdge && ports.has(id)) routeEdge(id)
	}
	// Route normal edges
	for (const [id, e] of graph.edges) {
		if (!e.isBackEdge && !e.id.endsWith("__rev") && ports.has(id)) routeEdge(id)
	}
}
