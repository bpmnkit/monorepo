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

const GATEWAY_TYPES = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

function isGateway(type: string): boolean {
	return GATEWAY_TYPES.has(type)
}

/**
 * Assign entry/exit ports for every non-dummy edge in the graph.
 *
 * Rules (in priority order):
 *   1. Back-edge: East exit, West entry (router handles highway routing)
 *   2. Cross-track edges where the target is NOT a gateway:
 *      Source exits south/north, target enters from the west.
 *      Non-gateway tasks/events always receive from the left for BPMN convention.
 *   3. Cross-track edges where the target IS a gateway:
 *      Source exits south/north, target enters from north/south.
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

		if (e.isBackEdge) {
			source = eastPort(src)
			target = westPort(tgt)
		} else if (src.track < tgt.track) {
			// Source is higher (lower Y-band), target is lower.
			source = southPort(src)
			// Non-gateway targets always receive from west (BPMN convention).
			target = isGateway(tgt.type) ? northPort(tgt) : westPort(tgt)
		} else if (src.track > tgt.track) {
			// Source is lower, target is higher.
			source = northPort(src)
			target = isGateway(tgt.type) ? southPort(tgt) : westPort(tgt)
		} else {
			source = eastPort(src)
			target = westPort(tgt)
		}

		result.set(e.id, { edgeId: e.id, source, target })
	}

	return result
}
