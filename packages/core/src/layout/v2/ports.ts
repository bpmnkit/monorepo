import type { V2Graph } from "./graph.js"
import type { PortAssignment, PortPoint } from "./types.js"
import { isGateway } from "./types.js"

type NodeBounds = { x: number; y: number; width: number; height: number }

function eastPort(n: NodeBounds): PortPoint {
	return { x: n.x + n.width, y: Math.round(n.y + n.height / 2) }
}
function westPort(n: NodeBounds): PortPoint {
	return { x: n.x, y: Math.round(n.y + n.height / 2) }
}
function southPort(n: NodeBounds): PortPoint {
	return { x: Math.round(n.x + n.width / 2), y: n.y + n.height }
}
function northPort(n: NodeBounds): PortPoint {
	return { x: Math.round(n.x + n.width / 2), y: n.y }
}
function centerY(n: NodeBounds): number {
	return n.y + n.height / 2
}

/**
 * Assign entry/exit ports for every non-dummy edge in the graph.
 *
 * Rules (in priority order):
 *   1. Back-edge: East exit, West entry (router handles highway routing)
 *   2. Gateway-adjacent edges: use Y-center comparison to pick south/north/east port.
 *      When both endpoints are at the same Y, use east/west (e.g. bypass edges).
 *   3. Cross-track non-gateway edges: source exits south/north, target enters west.
 *   4. Same track: East exit, West entry (standard left-to-right)
 *
 * Edges with "__rev" suffix (DAG reversal only) and edges to/from dummy nodes are skipped.
 */
export function assignPorts(graph: V2Graph): Map<string, PortAssignment> {
	const result = new Map<string, PortAssignment>()

	for (const [, e] of graph.edges) {
		if (e.id.endsWith("__rev")) continue
		const src = graph.nodes.get(e.sourceId)
		const tgt = graph.nodes.get(e.targetId)
		if (!src || !tgt) continue
		if (src.isDummy || tgt.isDummy) continue

		let source: PortPoint
		let target: PortPoint

		const srcIsGateway = isGateway(src.type)
		const tgtIsGateway = isGateway(tgt.type)

		if (e.isBackEdge) {
			source = eastPort(src)
			target = westPort(tgt)
		} else if (srcIsGateway || tgtIsGateway) {
			const srcCY = centerY(src)
			const tgtCY = centerY(tgt)
			if (srcCY < tgtCY) {
				source = southPort(src)
				target = tgtIsGateway ? northPort(tgt) : westPort(tgt)
			} else if (srcCY > tgtCY) {
				source = northPort(src)
				target = tgtIsGateway ? southPort(tgt) : westPort(tgt)
			} else {
				// Same Y: direct east→west (covers same-track and bypass edges)
				source = eastPort(src)
				target = westPort(tgt)
			}
		} else if (src.track < tgt.track) {
			source = southPort(src)
			target = westPort(tgt)
		} else if (src.track > tgt.track) {
			source = northPort(src)
			target = westPort(tgt)
		} else {
			source = eastPort(src)
			target = westPort(tgt)
		}

		result.set(e.id, { edgeId: e.id, source, target })
	}

	return result
}
