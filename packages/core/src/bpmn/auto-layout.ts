import { layoutProcess } from "../layout/layout-engine.js"
import { resolveEdgeCrossings } from "../layout/routing.js"
import type { LayoutEdge, LayoutNode, LayoutResult } from "../layout/types.js"
import type {
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnLane,
	BpmnProcess,
} from "./bpmn-model.js"

const POOL_HEADER = 30
const LANE_HEADER = 30
const PADDING = 20
const POOL_GAP = 30
const ANN_H = 50
const ANN_GAP = 60
const ANN_PADDING = 20

type LocalBounds = { x: number; y: number; width: number; height: number }

function contentBbox(
	nodes: LayoutNode[],
	extra?: Iterable<LocalBounds>,
): { minX: number; minY: number; maxX: number; maxY: number } {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const n of nodes) {
		minX = Math.min(minX, n.bounds.x)
		minY = Math.min(minY, n.bounds.y)
		maxX = Math.max(maxX, n.bounds.x + n.bounds.width)
		maxY = Math.max(maxY, n.bounds.y + n.bounds.height)
		if (n.labelBounds) {
			minX = Math.min(minX, n.labelBounds.x)
			minY = Math.min(minY, n.labelBounds.y)
			maxX = Math.max(maxX, n.labelBounds.x + n.labelBounds.width)
			maxY = Math.max(maxY, n.labelBounds.y + n.labelBounds.height)
		}
	}
	if (extra) {
		for (const b of extra) {
			minX = Math.min(minX, b.x)
			minY = Math.min(minY, b.y)
			maxX = Math.max(maxX, b.x + b.width)
			maxY = Math.max(maxY, b.y + b.height)
		}
	}
	return { minX, minY, maxX, maxY }
}

/** Pre-compute annotation positions in layout space (before dx/dy shift). */
function computeAnnotationLocalBounds(
	process: BpmnProcess,
	layoutNodes: LayoutNode[],
): Map<string, LocalBounds> {
	const nodeById = new Map(layoutNodes.map((n) => [n.id, n]))
	const placements = new Map<string, LocalBounds>()

	// Occupied regions for overlap checks (node bounds + label bounds)
	const occupied: LocalBounds[] = []
	for (const n of layoutNodes) {
		occupied.push({ ...n.bounds })
		if (n.labelBounds) occupied.push({ ...n.labelBounds })
	}

	// Static obstacles for crossing detection (nodes + labels only, not annotations)
	const obstacles: LocalBounds[] = [...occupied]

	for (const ta of process.textAnnotations) {
		const assoc = process.associations.find((a) => a.sourceRef === ta.id || a.targetRef === ta.id)
		const connId = assoc
			? assoc.sourceRef === ta.id
				? assoc.targetRef
				: assoc.sourceRef
			: undefined
		const connNode = connId ? nodeById.get(connId) : undefined

		const annW = Math.min(200, Math.max(100, (ta.text?.length ?? 10) * 5))

		if (!connNode) {
			const candidate: LocalBounds = { x: 0, y: 0, width: annW, height: ANN_H }
			occupied.push({ ...candidate })
			placements.set(ta.id, candidate)
			continue
		}

		const localX = connNode.bounds.x + connNode.bounds.width / 2 - annW / 2
		const anchorX = connNode.bounds.x + connNode.bounds.width / 2
		const pushStep = ANN_H + ANN_PADDING * 2 + 10

		// Try below: start below connected element, push down for overlaps
		const belowY = connNode.bounds.y + connNode.bounds.height + ANN_GAP
		const below: LocalBounds = { x: localX, y: belowY, width: annW, height: ANN_H }
		for (let i = 0; i < 30 && hasOverlapPadded(below, occupied, ANN_PADDING); i++)
			below.y += pushStep

		// Try above: gap scales with text length so longer annotations have more breathing room
		const aboveGap = ANN_GAP + Math.round(annW * 0.2)
		const aboveY = connNode.bounds.y - aboveGap - ANN_H
		const above: LocalBounds = { x: localX, y: aboveY, width: annW, height: ANN_H }
		for (let i = 0; i < 30 && hasOverlapPadded(above, occupied, ANN_PADDING); i++)
			above.y -= pushStep

		// Count how many obstacles the association line would cross for each candidate
		const belowCrossings = countLineCrossings(anchorX, connNode.bounds, below, obstacles)
		const aboveCrossings = countLineCrossings(anchorX, connNode.bounds, above, obstacles)

		const candidate = belowCrossings <= aboveCrossings ? below : above

		occupied.push({ ...candidate })
		obstacles.push({ ...candidate })
		placements.set(ta.id, candidate)
	}

	return placements
}

/** Count how many obstacles the vertical association line from connNode to annotation crosses. */
function countLineCrossings(
	lineX: number,
	connBounds: LocalBounds,
	annBounds: LocalBounds,
	obstacles: LocalBounds[],
): number {
	const annCY = annBounds.y + annBounds.height / 2
	const connCY = connBounds.y + connBounds.height / 2
	const top = Math.min(annCY, connCY)
	const bottom = Math.max(annCY, connCY)
	const tolerance = 20
	let crossings = 0
	for (const b of obstacles) {
		// Skip the connected element itself
		if (b.x === connBounds.x && b.y === connBounds.y && b.width === connBounds.width) continue
		// Obstacle must overlap with the line's X corridor
		if (b.x + b.width < lineX - tolerance || b.x > lineX + tolerance) continue
		// Obstacle must be between connNode and annotation vertically
		if (b.y + b.height <= top || b.y >= bottom) continue
		crossings++
	}
	return crossings
}

function hasOverlap(a: LocalBounds, others: LocalBounds[]): boolean {
	for (const b of others) {
		if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y)
			return true
	}
	return false
}

function hasOverlapPadded(a: LocalBounds, others: LocalBounds[], padding: number): boolean {
	for (const b of others) {
		if (
			a.x - padding < b.x + b.width &&
			a.x + a.width + padding > b.x &&
			a.y - padding < b.y + b.height &&
			a.y + a.height + padding > b.y
		)
			return true
	}
	return false
}

function nodeToShape(node: LayoutNode, dx: number, dy: number): BpmnDiShape {
	const shape: BpmnDiShape = {
		id: `${node.id}_di`,
		bpmnElement: node.id,
		bounds: {
			x: Math.round(node.bounds.x + dx),
			y: Math.round(node.bounds.y + dy),
			width: Math.round(node.bounds.width),
			height: Math.round(node.bounds.height),
		},
		unknownAttributes: {},
	}
	if (node.isExpanded !== undefined) shape.isExpanded = node.isExpanded
	if (node.labelBounds) {
		shape.label = {
			bounds: {
				x: Math.round(node.labelBounds.x + dx),
				y: Math.round(node.labelBounds.y + dy),
				width: Math.round(node.labelBounds.width),
				height: Math.round(node.labelBounds.height),
			},
		}
	}
	return shape
}

function edgeToShape(edge: LayoutEdge, dx: number, dy: number): BpmnDiEdge {
	const diEdge: BpmnDiEdge = {
		id: `${edge.id}_di`,
		bpmnElement: edge.id,
		waypoints: edge.waypoints.map((wp) => ({
			x: Math.round(wp.x + dx),
			y: Math.round(wp.y + dy),
		})),
		unknownAttributes: {},
	}
	if (edge.labelBounds) {
		diEdge.label = {
			bounds: {
				x: Math.round(edge.labelBounds.x + dx),
				y: Math.round(edge.labelBounds.y + dy),
				width: Math.round(edge.labelBounds.width),
				height: Math.round(edge.labelBounds.height),
			},
		}
	}
	return diEdge
}

function buildLaneShapes(
	lanes: BpmnLane[],
	nodes: LayoutNode[],
	dx: number,
	dy: number,
	poolY: number,
	poolHeaderWidth: number,
	laneContentWidth: number,
	poolHeight: number,
): BpmnDiShape[] {
	const elemToLane = new Map<string, string>()
	for (const lane of lanes) {
		for (const ref of lane.flowNodeRefs) {
			elemToLane.set(ref, lane.id)
		}
	}

	// Compute per-lane mean Y (after shift) to sort lanes top-to-bottom
	const laneAccum = new Map<string, { sum: number; count: number }>()
	for (const lane of lanes) laneAccum.set(lane.id, { sum: 0, count: 0 })
	for (const node of nodes) {
		const laneId = elemToLane.get(node.id)
		if (!laneId) continue
		const acc = laneAccum.get(laneId)
		if (acc) {
			acc.sum += node.bounds.y + dy
			acc.count++
		}
	}

	const sortedLanes = [...lanes].sort((a, b) => {
		const accA = laneAccum.get(a.id)
		const accB = laneAccum.get(b.id)
		const mA = accA && accA.count > 0 ? accA.sum / accA.count : Number.POSITIVE_INFINITY
		const mB = accB && accB.count > 0 ? accB.sum / accB.count : Number.POSITIVE_INFINITY
		return mA - mB
	})

	const tileH = Math.round(poolHeight / sortedLanes.length)
	return sortedLanes.map((lane, i) => ({
		id: `${lane.id}_di`,
		bpmnElement: lane.id,
		isHorizontal: true,
		bounds: {
			x: Math.round(poolHeaderWidth),
			y: Math.round(poolY + i * tileH),
			width: Math.round(laneContentWidth),
			height: Math.round(i === sortedLanes.length - 1 ? poolHeight - i * tileH : tileH),
		},
		unknownAttributes: {},
	}))
}

function addAnnotationShapes(
	process: BpmnProcess,
	layoutNodes: LayoutNode[],
	annLocalBounds: Map<string, LocalBounds>,
	allShapes: BpmnDiShape[],
	allEdges: BpmnDiEdge[],
	dx: number,
	dy: number,
): void {
	if (process.textAnnotations.length === 0 && process.associations.length === 0) return

	const nodeById = new Map(layoutNodes.map((n) => [n.id, n]))

	for (const ta of process.textAnnotations) {
		const b = annLocalBounds.get(ta.id)
		if (!b) continue
		allShapes.push({
			id: `${ta.id}_di`,
			bpmnElement: ta.id,
			bounds: {
				x: Math.round(b.x + dx),
				y: Math.round(b.y + dy),
				width: b.width,
				height: b.height,
			},
			unknownAttributes: {},
		})
	}

	for (const assoc of process.associations) {
		const annId = annLocalBounds.has(assoc.sourceRef)
			? assoc.sourceRef
			: annLocalBounds.has(assoc.targetRef)
				? assoc.targetRef
				: undefined
		const elId = annId === assoc.sourceRef ? assoc.targetRef : assoc.sourceRef

		const annB = annId ? annLocalBounds.get(annId) : undefined
		const elNode = nodeById.get(elId)

		if (!annB || !elNode) continue

		const elB = elNode.bounds
		const annCx = Math.round(annB.x + annB.width / 2 + dx)
		const elCx = Math.round(elB.x + elB.width / 2 + dx)

		let waypoints: Array<{ x: number; y: number }>
		if (annB.y >= elB.y + elB.height) {
			// annotation below: element bottom-center → annotation top-center
			waypoints = [
				{ x: elCx, y: Math.round(elB.y + elB.height + dy) },
				{ x: annCx, y: Math.round(annB.y + dy) },
			]
		} else if (annB.y + annB.height <= elB.y) {
			// annotation above: element top-center → annotation bottom-center
			waypoints = [
				{ x: elCx, y: Math.round(elB.y + dy) },
				{ x: annCx, y: Math.round(annB.y + annB.height + dy) },
			]
		} else {
			// side-by-side: center-to-center
			waypoints = [
				{ x: Math.round(elB.x + elB.width / 2 + dx), y: Math.round(elB.y + elB.height / 2 + dy) },
				{ x: annCx, y: Math.round(annB.y + annB.height / 2 + dy) },
			]
		}

		allEdges.push({
			id: `${assoc.id}_di`,
			bpmnElement: assoc.id,
			waypoints,
			unknownAttributes: {},
		})
	}
}

/**
 * Apply auto-layout to all processes in a BpmnDefinitions, replacing the
 * diagram interchange (BPMNDi) with freshly computed positions.
 *
 * - Handles plain processes (no collaboration) and collaborations with pools.
 * - When pools have lanes, lane shapes are tiled vertically around the process content.
 */
export function applyAutoLayout(defs: BpmnDefinitions): BpmnDefinitions {
	if (defs.processes.length === 0) return defs

	const collab = defs.collaborations[0]

	// Build processId → participantId map
	const processToParticipant = new Map<string, string>()
	if (collab) {
		for (const p of collab.participants) {
			if (p.processRef) processToParticipant.set(p.processRef, p.id)
		}
	}

	const allShapes: BpmnDiShape[] = []
	const allEdges: BpmnDiEdge[] = []
	let poolY = 0

	for (const process of defs.processes) {
		const participantId = processToParticipant.get(process.id)
		const lanes = process.laneSet?.lanes ?? []
		const hasLanes = lanes.length > 0

		// layoutProcess now handles boundary event repositioning internally.
		const result = layoutProcess(process)

		// Re-resolve edge crossings after boundary events moved shapes
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]))
		resolveEdgeCrossings(result.edges, nodeMap)

		if (result.nodes.length === 0) continue

		// Pre-compute annotation positions in layout space so they're included in the bbox
		const annBounds = computeAnnotationLocalBounds(process, result.nodes)

		const { minX, minY, maxX, maxY } = contentBbox(result.nodes, annBounds.values())
		const contentW = maxX - minX
		const contentH = maxY - minY

		let dx: number
		let dy: number
		if (participantId) {
			const elemX = POOL_HEADER + (hasLanes ? LANE_HEADER : 0) + PADDING
			const elemY = poolY + PADDING
			dx = elemX - minX
			dy = elemY - minY
		} else {
			dx = PADDING - minX
			dy = PADDING - minY
		}

		for (const node of result.nodes) allShapes.push(nodeToShape(node, dx, dy))
		for (const edge of result.edges) allEdges.push(edgeToShape(edge, dx, dy))
		addAnnotationShapes(process, result.nodes, annBounds, allShapes, allEdges, dx, dy)

		if (participantId) {
			const innerW = (hasLanes ? LANE_HEADER : 0) + contentW + 2 * PADDING
			const innerH = contentH + 2 * PADDING
			const poolW = POOL_HEADER + innerW

			allShapes.push({
				id: `${participantId}_di`,
				bpmnElement: participantId,
				isHorizontal: true,
				bounds: { x: 0, y: poolY, width: poolW, height: innerH },
				unknownAttributes: {},
			})

			if (hasLanes) {
				const laneShapes = buildLaneShapes(
					lanes,
					result.nodes,
					dx,
					dy,
					poolY,
					POOL_HEADER,
					innerW,
					innerH,
				)
				allShapes.push(...laneShapes)
			}

			poolY += innerH + POOL_GAP
		}
	}

	const planeBpmnElement = collab?.id ?? defs.processes[0]?.id ?? "plane"
	const existingDiagram = defs.diagrams[0]

	return {
		...defs,
		diagrams: [
			{
				id: existingDiagram?.id ?? "BPMNDiagram_1",
				plane: {
					id: existingDiagram?.plane.id ?? "BPMNPlane_1",
					bpmnElement: planeBpmnElement,
					shapes: allShapes,
					edges: allEdges,
				},
			},
		],
	}
}
