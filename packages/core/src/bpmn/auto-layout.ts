import { findSegmentGroups } from "../layout/v3/groups.js"
import type { AnnotationLayout } from "../layout/v3/layout-annotations.js"
import { layoutWithAnnotations } from "../layout/v3/layout-annotations.js"
import { layoutWithColumns } from "../layout/v3/layout-columns.js"
import { assembleFullLayout } from "../layout/v3/layout-full.js"
import { type NodeLayout, layoutGroup } from "../layout/v3/layout-group.js"
import { layoutWithPaths } from "../layout/v3/layout-paths.js"
import { layoutProcess as layoutProcessV3 } from "../layout/v3/layout-process.js"
import { layoutWithTracks } from "../layout/v3/layout-tracks.js"
import { findProcessFlow } from "../layout/v3/process-flow.js"
import { computeTopoDepths, detectBackEdges, findAtomicSegments } from "../layout/v3/segments.js"
import type {
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnLane,
	BpmnProcess,
} from "./bpmn-model.js"

const PADDING = 20
const POOL_HEADER = 30
const LANE_HEADER = 30
const POOL_GAP = 30

// ── v3 pipeline ───────────────────────────────────────────────────────────────

function buildFwdAdj(
	sequenceFlows: BpmnProcess["sequenceFlows"],
	backEdgeIds: Set<string>,
): { outAdj: Map<string, string[]>; inAdj: Map<string, string[]> } {
	const outAdj = new Map<string, string[]>()
	const inAdj = new Map<string, string[]>()
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) continue
		outAdj.set(f.sourceRef, [...(outAdj.get(f.sourceRef) ?? []), f.targetRef])
		inAdj.set(f.targetRef, [...(inAdj.get(f.targetRef) ?? []), f.sourceRef])
	}
	return { outAdj, inAdj }
}

function runV3Pipeline(process: BpmnProcess): AnnotationLayout {
	const { flowElements, sequenceFlows, textAnnotations, associations } = process

	const backEdgeIds = detectBackEdges(flowElements, sequenceFlows)
	const { outAdj, inAdj } = buildFwdAdj(sequenceFlows, backEdgeIds)
	const topoDepths = computeTopoDepths(flowElements, outAdj, inAdj)
	const segments = findAtomicSegments(flowElements, sequenceFlows, backEdgeIds)
	const groups = findSegmentGroups(segments, flowElements, sequenceFlows, backEdgeIds)

	const groupLayoutMap = new Map(
		groups.map((g) => [g.id, layoutGroup(g, segments, flowElements, sequenceFlows)]),
	)

	const processFlow = findProcessFlow(segments, groups, topoDepths)
	const processLayout = layoutProcessV3(processFlow, groupLayoutMap, segments)
	const fullLayout = assembleFullLayout(
		processLayout,
		groupLayoutMap,
		segments,
		flowElements,
		groups,
		sequenceFlows,
		backEdgeIds,
	)
	const trackLayout = layoutWithTracks(
		fullLayout,
		groups,
		segments,
		flowElements,
		sequenceFlows,
		backEdgeIds,
	)
	const columnLayout = layoutWithColumns(trackLayout, flowElements, sequenceFlows, backEdgeIds)
	const pathLayout = layoutWithPaths(
		columnLayout,
		trackLayout,
		flowElements,
		sequenceFlows,
		backEdgeIds,
	)
	return layoutWithAnnotations(pathLayout, textAnnotations, associations)
}

// ── BPMNDi conversion ─────────────────────────────────────────────────────────

function v3NodeToShape(n: NodeLayout, dx: number, dy: number): BpmnDiShape {
	return {
		id: `${n.id}_di`,
		bpmnElement: n.id,
		bounds: {
			x: Math.round(n.x + dx),
			y: Math.round(n.y + dy),
			width: Math.round(n.width),
			height: Math.round(n.height),
		},
		unknownAttributes: {},
	}
}

function contentBbox(layout: AnnotationLayout): {
	minX: number
	minY: number
	maxX: number
	maxY: number
} {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const n of layout.nodes) {
		minX = Math.min(minX, n.x)
		minY = Math.min(minY, n.y)
		maxX = Math.max(maxX, n.x + n.width)
		maxY = Math.max(maxY, n.y + n.height)
	}
	for (const a of layout.annotationNodes) {
		minX = Math.min(minX, a.x)
		minY = Math.min(minY, a.y)
		maxX = Math.max(maxX, a.x + a.width)
		maxY = Math.max(maxY, a.y + a.height)
	}
	return { minX, minY, maxX, maxY }
}

function buildLaneShapes(
	lanes: BpmnLane[],
	nodes: NodeLayout[],
	dx: number,
	dy: number,
	poolY: number,
	poolHeaderWidth: number,
	laneContentWidth: number,
	poolHeight: number,
): BpmnDiShape[] {
	const elemToLane = new Map<string, string>()
	for (const lane of lanes) {
		for (const ref of lane.flowNodeRefs) elemToLane.set(ref, lane.id)
	}

	const laneAccum = new Map<string, { sum: number; count: number }>()
	for (const lane of lanes) laneAccum.set(lane.id, { sum: 0, count: 0 })
	for (const node of nodes) {
		const laneId = elemToLane.get(node.id)
		if (!laneId) continue
		const acc = laneAccum.get(laneId)
		if (acc) {
			acc.sum += node.y + dy
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

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Apply auto-layout to all processes in a BpmnDefinitions, replacing the
 * diagram interchange (BPMNDi) with freshly computed positions.
 *
 * Uses the v3 layout engine.
 */
export function applyAutoLayout(defs: BpmnDefinitions): BpmnDefinitions {
	if (defs.processes.length === 0) return defs

	const collab = defs.collaborations[0]

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

		const layout = runV3Pipeline(process)
		if (layout.nodes.length === 0) continue

		const { minX, minY, maxX, maxY } = contentBbox(layout)
		const contentW = maxX - minX
		const contentH = maxY - minY

		let dx: number
		let dy: number
		if (participantId) {
			dx = POOL_HEADER + (hasLanes ? LANE_HEADER : 0) + PADDING - minX
			dy = poolY + PADDING - minY
		} else {
			dx = PADDING - minX
			dy = PADDING - minY
		}

		// Flow nodes
		for (const n of layout.nodes) {
			allShapes.push(v3NodeToShape(n, dx, dy))
		}

		// Sequence flow edges
		for (const edge of layout.edges) {
			allEdges.push({
				id: `${edge.edgeId}_di`,
				bpmnElement: edge.edgeId,
				waypoints: edge.points.map((p) => ({
					x: Math.round(p.x + dx),
					y: Math.round(p.y + dy),
				})),
				unknownAttributes: {},
			})
		}

		// Annotation shapes
		for (const an of layout.annotationNodes) {
			allShapes.push({
				id: `${an.id}_di`,
				bpmnElement: an.id,
				bounds: {
					x: Math.round(an.x + dx),
					y: Math.round(an.y + dy),
					width: Math.round(an.width),
					height: Math.round(an.height),
				},
				unknownAttributes: {},
			})
		}

		// Association edges
		for (const ae of layout.annotationEdges) {
			allEdges.push({
				id: `${ae.associationId}_di`,
				bpmnElement: ae.associationId,
				waypoints: ae.points.map((p) => ({
					x: Math.round(p.x + dx),
					y: Math.round(p.y + dy),
				})),
				unknownAttributes: {},
			})
		}

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
				allShapes.push(
					...buildLaneShapes(lanes, layout.nodes, dx, dy, poolY, POOL_HEADER, innerW, innerH),
				)
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
