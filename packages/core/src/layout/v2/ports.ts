import type { V2Graph } from "./graph.js"
import type { PortAssignment, PortPoint } from "./types.js"

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

/**
 * Assign entry/exit ports for every non-dummy edge in the graph.
 *
 * Rules (in priority order):
 *   1. Back-edge: East exit, West entry (router handles highway routing)
 *   2. Source track < Target track (source is higher up = lower Y index): South exit, North entry
 *   3. Source track > Target track (source is lower = higher Y index): North exit, South entry
 *   4. Same track or no track difference: East exit, West entry (standard)
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

		if (e.isBackEdge) {
			source = eastPort(src)
			target = westPort(tgt)
		} else if (src.track < tgt.track) {
			source = southPort(src)
			target = northPort(tgt)
		} else if (src.track > tgt.track) {
			source = northPort(src)
			target = southPort(tgt)
		} else {
			source = eastPort(src)
			target = westPort(tgt)
		}

		result.set(e.id, { edgeId: e.id, source, target })
	}

	return result
}
