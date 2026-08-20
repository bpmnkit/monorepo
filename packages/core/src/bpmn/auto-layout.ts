import { associationWaypoints, packAnnotations } from "../layout/annotations.js"
import { layoutProcess } from "../layout/layout-engine.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult } from "../layout/types.js"
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

	// Compute proportional weight per lane: node count × row height, minimum 1 row
	const MIN_LANE_H = 80

	const weights = sortedLanes.map((lane) => {
		const count = nodes.filter((n) => elemToLane.get(n.id) === lane.id).length
		return Math.max(count, 1)
	})
	const totalWeight = weights.reduce((a, b) => a + b, 0)

	// Scale proportionally to poolHeight so all lanes fill the pool exactly
	const scaledHeights = weights.map((w) => Math.round((w / totalWeight) * poolHeight))
	// Fix last lane for rounding drift
	if (scaledHeights.length > 0) {
		scaledHeights[scaledHeights.length - 1] =
			poolHeight - scaledHeights.slice(0, -1).reduce((a, b) => a + b, 0)
	}

	let cumulativeY = 0
	return sortedLanes.map((lane, i) => {
		const laneH = scaledHeights[i] ?? MIN_LANE_H
		const shape: BpmnDiShape = {
			id: `${lane.id}_di`,
			bpmnElement: lane.id,
			isHorizontal: true,
			bounds: {
				x: Math.round(poolHeaderWidth),
				y: Math.round(poolY + cumulativeY),
				width: Math.round(laneContentWidth),
				height: Math.round(laneH),
			},
			unknownAttributes: {},
		}
		cumulativeY += laneH
		return shape
	})
}

function addAnnotationShapes(
	process: BpmnProcess,
	layoutNodes: LayoutNode[],
	annLocalBounds: Map<string, Bounds>,
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

		if (!annB || !annId || !elNode) continue

		const { pElem, pAnn } = associationWaypoints(elNode.bounds, annB)
		// Shift into diagram space and honour the original sourceRef→targetRef order.
		const shifted = {
			pElem: { x: Math.round(pElem.x + dx), y: Math.round(pElem.y + dy) },
			pAnn: { x: Math.round(pAnn.x + dx), y: Math.round(pAnn.y + dy) },
		}
		const wp1 = assoc.sourceRef === annId ? shifted.pAnn : shifted.pElem
		const wp2 = assoc.sourceRef === annId ? shifted.pElem : shifted.pAnn
		const waypoints: Array<{ x: number; y: number }> = [wp1, wp2]

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

		const result = layoutProcess(process)

		if (result.nodes.length === 0) continue

		// The engine reports lane bands when it placed nodes by lane membership;
		// they replace the proportional tiling below.
		const engineLanes = result.lanes

		// Pre-compute annotation positions in layout space so they're included in the bbox
		const annBounds = packAnnotations(process, result.nodes)

		const { minX, minY, maxX, maxY } = contentBbox(result.nodes, annBounds.values())
		const contentW = maxX - minX
		const contentH = maxY - minY

		// Engine lane bands already stack the content vertically, so the pool
		// aligns to the band space rather than to the content bounding box —
		// otherwise the shapes drift out of the lanes drawn around them.
		const laneBands = participantId && hasLanes ? engineLanes : undefined
		const bandTop = laneBands?.[0]?.bounds.y ?? 0
		const bandHeight = laneBands ? laneBands.reduce((sum, lane) => sum + lane.bounds.height, 0) : 0

		let dx: number
		let dy: number
		if (participantId) {
			const elemX = POOL_HEADER + (hasLanes ? LANE_HEADER : 0) + PADDING
			dx = elemX - minX
			dy = laneBands ? poolY - bandTop : poolY + PADDING - minY
		} else {
			dx = PADDING - minX
			dy = PADDING - minY
		}

		for (const node of result.nodes) allShapes.push(nodeToShape(node, dx, dy))
		for (const edge of result.edges) allEdges.push(edgeToShape(edge, dx, dy))
		addAnnotationShapes(process, result.nodes, annBounds, allShapes, allEdges, dx, dy)

		if (participantId) {
			const innerW = (hasLanes ? LANE_HEADER : 0) + contentW + 2 * PADDING
			// Lanes must tile the pool exactly, so the pool takes their height.
			const innerH = laneBands ? bandHeight : contentH + 2 * PADDING
			const poolW = POOL_HEADER + innerW

			allShapes.push({
				id: `${participantId}_di`,
				bpmnElement: participantId,
				isHorizontal: true,
				bounds: { x: 0, y: poolY, width: poolW, height: innerH },
				unknownAttributes: {},
			})

			if (hasLanes) {
				const laneShapes = laneBands
					? laneBands.map((lane) => ({
							id: `${lane.id}_di`,
							bpmnElement: lane.id,
							isHorizontal: true,
							bounds: {
								x: Math.round(POOL_HEADER),
								y: Math.round(lane.bounds.y + dy),
								width: Math.round(innerW),
								height: Math.round(lane.bounds.height),
							},
							unknownAttributes: {},
						}))
					: buildLaneShapes(lanes, result.nodes, dx, dy, poolY, POOL_HEADER, innerW, innerH)
				allShapes.push(...laneShapes)
			}

			poolY += innerH + POOL_GAP
		}
	}

	if (collab && collab.messageFlows.length > 0) {
		const shapeByElement = new Map(allShapes.map((s) => [s.bpmnElement, s.bounds]))
		for (const mf of collab.messageFlows) {
			const src = shapeByElement.get(mf.sourceRef)
			const tgt = shapeByElement.get(mf.targetRef)
			if (!src || !tgt) continue
			const srcBelow = src.y + src.height / 2 > tgt.y + tgt.height / 2
			const sx = Math.round(src.x + src.width / 2)
			const tx = Math.round(tgt.x + tgt.width / 2)
			const sy = srcBelow ? src.y : src.y + src.height
			const ty = srcBelow ? tgt.y + tgt.height : tgt.y
			const midY = Math.round((sy + ty) / 2)
			const waypoints =
				sx === tx
					? [
							{ x: sx, y: sy },
							{ x: tx, y: ty },
						]
					: [
							{ x: sx, y: sy },
							{ x: sx, y: midY },
							{ x: tx, y: midY },
							{ x: tx, y: ty },
						]
			allEdges.push({ id: `${mf.id}_di`, bpmnElement: mf.id, waypoints, unknownAttributes: {} })
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
