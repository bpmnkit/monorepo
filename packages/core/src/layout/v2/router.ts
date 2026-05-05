import { routeEdgeAstar } from "../astar.js"
import type { Bounds } from "../types.js"
import type { V2Graph } from "./graph.js"
import type { PortAssignment } from "./types.js"
import { TRACK_Y } from "./types.js"

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
export function routeAllEdges(
	graph: V2Graph,
	ports: Map<string, PortAssignment>,
	backEdgeIds: Set<string>,
): void {
	// Build obstacle Bounds array for all real nodes
	const allObstacles: Bounds[] = []
	for (const [, n] of graph.nodes) {
		if (n.isDummy || n.width === 0) continue
		allObstacles.push({ x: n.x, y: n.y, width: n.width, height: n.height })
	}

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
			// Fixed highway route: East → up to Track 1 → back to target X → down
			edge.waypoints = [
				{ x: sx, y: sy },
				{ x: sx, y: highwayY },
				{ x: tx, y: highwayY },
				{ x: tx, y: ty },
			]
			return
		}

		// Exclude source and target from obstacles
		const obstacles = allObstacles.filter(
			(o) =>
				!(o.x === src.x && o.y === src.y && o.width === src.width && o.height === src.height) &&
				!(o.x === tgt.x && o.y === tgt.y && o.width === tgt.width && o.height === tgt.height),
		)

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
