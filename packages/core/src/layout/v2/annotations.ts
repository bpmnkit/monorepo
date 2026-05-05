import type { BpmnAssociation, BpmnTextAnnotation } from "../../bpmn/bpmn-model.js"
import { routeEdgeAstar } from "../astar.js"
import type { Bounds } from "../types.js"
import type { V2Graph } from "./graph.js"
import { ANN_HEIGHT, TRACK_Y } from "./types.js"

export interface AnnotationResult {
	annotationId: string
	x: number
	y: number
	width: number
	height: number
	waypoints: Array<{ x: number; y: number }>
}

/**
 * Position text annotations and route their association lines.
 *
 * Placement rules:
 *   - Find target node via associations (annotation can be either sourceRef or targetRef).
 *   - Width: min(200, max(80, text.length * 5)) px.
 *   - X: centered over the target node (target.x + target.width/2 - annW/2).
 *   - Y: Track 0 (TRACK_Y[0]) if target.track <= 2 (trunk/above), else Track 5 (TRACK_Y[5] - ANN_HEIGHT) below.
 *   - Association line: routed orthogonally from annotation edge to target node edge via routeEdgeAstar,
 *     excluding the target node from obstacles (not the annotation itself, since it's not in graph.nodes).
 *
 * Unconnected annotations (no matching association): placed at (0, TRACK_Y[0]) with empty waypoints.
 */
export function layoutAnnotations(
	textAnnotations: BpmnTextAnnotation[],
	associations: BpmnAssociation[],
	graph: V2Graph,
): AnnotationResult[] {
	if (textAnnotations.length === 0) return []

	// Build obstacle bounds from all real flow nodes
	const obstacleMap = new Map<string, Bounds>()
	for (const [id, n] of graph.nodes) {
		if (!n.isDummy && n.width > 0) {
			obstacleMap.set(id, { x: n.x, y: n.y, width: n.width, height: n.height })
		}
	}

	// Build annotation lookup set
	const annotationIds = new Set(textAnnotations.map((t) => t.id))

	// Index associations: annotationId → connected node ID
	const connectedNode = new Map<string, string>()
	for (const a of associations) {
		if (annotationIds.has(a.sourceRef)) {
			connectedNode.set(a.sourceRef, a.targetRef)
		} else if (annotationIds.has(a.targetRef)) {
			connectedNode.set(a.targetRef, a.sourceRef)
		}
	}

	const results: AnnotationResult[] = []

	for (const ta of textAnnotations) {
		const annW = Math.min(200, Math.max(80, (ta.text?.length ?? 10) * 5))
		const connId = connectedNode.get(ta.id)
		const connNode = connId ? graph.nodes.get(connId) : undefined

		if (!connNode) {
			results.push({
				annotationId: ta.id,
				x: 0,
				y: TRACK_Y[0],
				width: annW,
				height: ANN_HEIGHT,
				waypoints: [],
			})
			continue
		}

		const annX = Math.round(connNode.x + connNode.width / 2 - annW / 2)
		const useTop = connNode.track <= 2
		const annY = useTop ? TRACK_Y[0] : TRACK_Y[5] - ANN_HEIGHT

		// Connection point on annotation: bottom center (if top) or top center (if bottom)
		const annConnX = Math.round(annX + annW / 2)
		const annConnY = useTop ? annY + ANN_HEIGHT : annY

		// Connection point on target node: top center (if annotation is above) or bottom center
		const nodeConnX = Math.round(connNode.x + connNode.width / 2)
		const nodeConnY = useTop ? connNode.y : connNode.y + connNode.height

		// Obstacles: all nodes except the target
		const obstacles = [...obstacleMap.entries()].filter(([id]) => id !== connId).map(([, b]) => b)

		const waypoints = routeEdgeAstar(
			{ x: annConnX, y: annConnY },
			{ x: nodeConnX, y: nodeConnY },
			obstacles,
			0,
			0,
		)

		results.push({
			annotationId: ta.id,
			x: annX,
			y: annY,
			width: annW,
			height: ANN_HEIGHT,
			waypoints,
		})
	}

	return results
}
