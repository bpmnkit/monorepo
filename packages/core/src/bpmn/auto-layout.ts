import { associationWaypoints, packAnnotations } from "../layout/annotations.js"
import type { MessageLink } from "../layout/collaboration/alignment.js"
import { alignPools } from "../layout/collaboration/alignment.js"
import type { PoolLink } from "../layout/collaboration/ordering.js"
import { orderPools } from "../layout/collaboration/ordering.js"
import { collapseCollinear } from "../layout/grid/grid-router.js"
import { layoutProcess } from "../layout/layout-engine.js"
import type { Bounds, LayoutEdge, LayoutNode, LayoutResult } from "../layout/types.js"
import type {
	BpmnBounds,
	BpmnCollaboration,
	BpmnDefinitions,
	BpmnDiEdge,
	BpmnDiShape,
	BpmnDiagram,
	BpmnFlowElement,
	BpmnLane,
	BpmnProcess,
	BpmnWaypoint,
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

		// An association does not have to involve a text annotation — a data
		// object may be associated with an activity. Both ends are placed, so
		// the same docking works.
		if (!annId) {
			const source = nodeById.get(assoc.sourceRef)
			const target = nodeById.get(assoc.targetRef)
			if (!source || !target) continue
			const { pElem, pAnn } = associationWaypoints(source.bounds, target.bounds)
			allEdges.push({
				id: `${assoc.id}_di`,
				bpmnElement: assoc.id,
				waypoints: [
					{ x: Math.round(pElem.x + dx), y: Math.round(pElem.y + dy) },
					{ x: Math.round(pAnn.x + dx), y: Math.round(pAnn.y + dy) },
				],
				unknownAttributes: {},
			})
			continue
		}

		const elId = annId === assoc.sourceRef ? assoc.targetRef : assoc.sourceRef
		const annB = annLocalBounds.get(annId)
		const elNode = nodeById.get(elId)

		if (!annB || !elNode) continue

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

const EMPTY_POOL_HEIGHT = 60
/** Sideways step when nudging a message flow out of a shape. */
const MESSAGE_FLOW_STEP = 10
/** Stub a message flow leaves its element by before it may jog sideways. */
const MESSAGE_FLOW_STEM = 20
/** Stagger between the stems of consecutive flows. */
const MESSAGE_FLOW_STEM_STEP = 8
/** Step and reach of that sideways jog. */
const MESSAGE_FLOW_JOG = 20
const MESSAGE_FLOW_MAX_JOG = 2400
const EMPTY_POOL_WIDTH = 300

/**
 * Sub-processes the source diagram draws collapsed. A collapsed sub-process
 * keeps its activity shape on the parent plane and carries its contents on a
 * plane of its own, so the layout must not inline them.
 *
 * Either marker counts: an explicit `isExpanded="false"` on the shape, or the
 * presence of a separate plane for that sub-process.
 */
function collapsedSubProcesses(defs: BpmnDefinitions): Set<string> {
	const containers = new Set<string>()
	const walk = (elements: BpmnFlowElement[]): void => {
		for (const el of elements) {
			const sub = el as unknown as { flowElements?: BpmnFlowElement[] }
			if (sub.flowElements) {
				containers.add(el.id)
				walk(sub.flowElements)
			}
		}
	}
	for (const process of defs.processes) walk(process.flowElements)

	const collapsed = new Set<string>()
	for (const diagram of defs.diagrams) {
		if (containers.has(diagram.plane.bpmnElement)) collapsed.add(diagram.plane.bpmnElement)
		for (const shape of diagram.plane.shapes) {
			if (shape.isExpanded === false && containers.has(shape.bpmnElement)) {
				collapsed.add(shape.bpmnElement)
			}
		}
	}
	return collapsed
}

/** One `BPMNDiagram` per collapsed sub-process, its contents laid out at the origin. */
function childPlaneDiagrams(
	planes: Array<{ elementId: string; result: LayoutResult }>,
	defs: BpmnDefinitions,
	collapsed: ReadonlySet<string>,
): BpmnDiagram[] {
	const existing = new Map(defs.diagrams.map((d) => [d.plane.bpmnElement, d]))
	const diagrams: BpmnDiagram[] = []
	const emitted = new Set(planes.map((plane) => plane.elementId))

	// A collapsed sub-process that holds nothing still owns its plane; dropping it
	// would lose the drill-down target the source diagram declared.
	for (const [elementId, diagram] of existing) {
		if (!collapsed.has(elementId) || emitted.has(elementId)) continue
		diagrams.push({
			id: diagram.id,
			plane: { id: diagram.plane.id, bpmnElement: elementId, shapes: [], edges: [] },
		})
	}

	for (const plane of planes) {
		const { minX, minY } = contentBbox(plane.result.nodes)
		if (!Number.isFinite(minX)) continue
		const dx = PADDING - minX
		const dy = PADDING - minY
		const previous = existing.get(plane.elementId)
		diagrams.push({
			id: previous?.id ?? `BPMNDiagram_${plane.elementId}`,
			plane: {
				id: previous?.plane.id ?? `BPMNPlane_${plane.elementId}`,
				bpmnElement: plane.elementId,
				shapes: plane.result.nodes.map((node) => nodeToShape(node, dx, dy)),
				edges: plane.result.edges.map((edge) => edgeToShape(edge, dx, dy)),
			},
		})
	}

	return diagrams
}

/** Vertical bands between pools — clear ground for a message flow to cross in. */
function poolBands(
	shapes: BpmnDiShape[],
	participantIds: ReadonlySet<string>,
): Array<{ top: number; bottom: number }> {
	const pools = shapes
		.filter((s) => participantIds.has(s.bpmnElement))
		.map((s) => ({ top: s.bounds.y, bottom: s.bounds.y + s.bounds.height }))
		.sort((a, b) => a.top - b.top)

	const gaps: Array<{ top: number; bottom: number }> = []
	for (let i = 0; i + 1 < pools.length; i++) {
		const above = pools[i]
		const below = pools[i + 1]
		if (above && below && below.top > above.bottom) {
			gaps.push({ top: above.bottom, bottom: below.top })
		}
	}
	return gaps
}

/** True when a vertical run at `x` between two heights would cross a shape. */
function columnBlocked(
	x: number,
	fromY: number,
	toY: number,
	obstacles: BpmnBounds[],
	own: BpmnBounds[],
): boolean {
	const top = Math.min(fromY, toY)
	const bottom = Math.max(fromY, toY)
	return obstacles.some(
		(o) => !own.includes(o) && o.x < x && x < o.x + o.width && o.y < bottom && top < o.y + o.height,
	)
}

/**
 * Shift a vertical run sideways until it misses every shape it would otherwise
 * pass through. The run has to stay on the element it docks onto, so the search
 * is bounded by that element's own width.
 */
function clearColumn(
	x: number,
	fromY: number,
	toY: number,
	obstacles: BpmnBounds[],
	own: BpmnBounds[],
	dock: BpmnBounds,
): number {
	if (!columnBlocked(x, fromY, toY, obstacles, own)) return x
	const limit = Math.floor(dock.width / 2)
	for (let step = MESSAGE_FLOW_STEP; step <= limit; step += MESSAGE_FLOW_STEP) {
		if (!columnBlocked(x + step, fromY, toY, obstacles, own)) return x + step
		if (!columnBlocked(x - step, fromY, toY, obstacles, own)) return x - step
	}
	return x
}

/**
 * One vertical leg of a message flow, from its dock to the crossing band.
 *
 * A straight drop is used when the column is clear. Otherwise the leg leaves
 * the element by a short stem and jogs sideways to a column that is clear for
 * the rest of the descent — the same move a modeller makes by hand, and the
 * only way past a shape sitting directly below the dock.
 */
function messageFlowLeg(
	dockX: number,
	fromY: number,
	toY: number,
	obstacles: BpmnBounds[],
	own: BpmnBounds[],
	dock: BpmnBounds,
	/** Staggers the stem so two flows jogging side by side do not share a line. */
	stemOffset = 0,
): { points: BpmnWaypoint[]; blocked: boolean } {
	const straight = clearColumn(dockX, fromY, toY, obstacles, own, dock)
	if (!columnBlocked(straight, fromY, toY, obstacles, own)) {
		return {
			points: [
				{ x: straight, y: fromY },
				{ x: straight, y: toY },
			],
			blocked: false,
		}
	}

	const down = toY > fromY
	const stem = MESSAGE_FLOW_STEM + stemOffset
	const stemY = down ? fromY + stem : fromY - stem
	const rowBlocked = (x: number): boolean =>
		obstacles.some(
			(o) =>
				!own.includes(o) &&
				o.x < Math.max(dockX, x) &&
				Math.min(dockX, x) < o.x + o.width &&
				o.y < stemY &&
				stemY < o.y + o.height,
		)

	for (let offset = MESSAGE_FLOW_JOG; offset <= MESSAGE_FLOW_MAX_JOG; offset += MESSAGE_FLOW_JOG) {
		for (const candidate of [dockX + offset, dockX - offset]) {
			if (rowBlocked(candidate)) continue
			if (columnBlocked(candidate, stemY, toY, obstacles, own)) continue
			return {
				points: [
					{ x: dockX, y: fromY },
					{ x: dockX, y: stemY },
					{ x: candidate, y: stemY },
					{ x: candidate, y: toY },
				],
				blocked: false,
			}
		}
	}

	return {
		points: [
			{ x: straight, y: fromY },
			{ x: straight, y: toY },
		],
		blocked: true,
	}
}

/**
 * Pick where a message flow crosses between pools and how each of its two legs
 * gets there.
 *
 * Bands are tried nearest-first: the gaps between pools are clear ground, so a
 * route that reaches one has nothing left to cross. Each leg is checked over
 * its own stretch rather than the whole run, which is what lets a flow slip
 * past shapes on the far side of the band.
 */
function messageFlowRoute(
	src: BpmnBounds,
	tgt: BpmnBounds,
	srcIsPool: boolean,
	tgtIsPool: boolean,
	gaps: Array<{ top: number; bottom: number }>,
	obstacles: BpmnBounds[],
	stemOffset: number,
	/** Containers holding an endpoint: a route out of one has to cross it. */
	containers: BpmnBounds[] = [],
): { source: BpmnWaypoint[]; target: BpmnWaypoint[]; gap: number } {
	const srcBelow = src.y + src.height / 2 > tgt.y + tgt.height / 2
	const sy = srcBelow ? src.y : src.y + src.height
	const ty = srcBelow ? tgt.y + tgt.height : tgt.y
	// The endpoints themselves, plus any expanded sub-process they sit inside:
	// leaving an element means crossing the border of whatever contains it, so
	// treating that border as an obstacle would leave the route no way out.
	const own = [src, tgt, ...containers]
	const midpoint = (sy + ty) / 2
	const low = Math.min(sy, ty)
	const high = Math.max(sy, ty)

	const build = (
		bandY: number,
	): { source: BpmnWaypoint[]; target: BpmnWaypoint[]; blocked: boolean } => {
		const source = messageFlowLeg(
			Math.round(src.x + src.width / 2),
			sy,
			bandY,
			obstacles,
			own,
			src,
			stemOffset,
		)
		const target = messageFlowLeg(
			Math.round(tgt.x + tgt.width / 2),
			ty,
			bandY,
			obstacles,
			own,
			tgt,
			stemOffset,
		)
		// A pool has no position of its own to respect: dock it under whatever it
		// is talking to, so the flow drops straight instead of fanning into the
		// pool's centre along with every other flow.
		if (tgtIsPool && !srcIsPool) {
			const x = source.points[source.points.length - 1]?.x ?? 0
			return {
				source: source.points,
				target: [
					{ x, y: ty },
					{ x, y: bandY },
				],
				blocked: source.blocked,
			}
		}
		if (srcIsPool && !tgtIsPool) {
			const x = target.points[target.points.length - 1]?.x ?? 0
			return {
				source: [
					{ x, y: sy },
					{ x, y: bandY },
				],
				target: target.points,
				blocked: target.blocked,
			}
		}
		return {
			source: source.points,
			target: target.points,
			blocked: source.blocked || target.blocked,
		}
	}

	const candidates = gaps
		.map((gap, index) => ({ index, y: (gap.top + gap.bottom) / 2 }))
		.filter((candidate) => candidate.y >= low && candidate.y <= high)
		.sort((a, b) => Math.abs(a.y - midpoint) - Math.abs(b.y - midpoint))

	for (const candidate of candidates) {
		const route = build(candidate.y)
		if (!route.blocked) return { source: route.source, target: route.target, gap: candidate.index }
	}

	const fallback = candidates[0]
	const route = build(fallback?.y ?? midpoint)
	return { source: route.source, target: route.target, gap: fallback?.index ?? -1 }
}

/**
 * Apply auto-layout to all processes in a BpmnDefinitions, replacing the
 * diagram interchange (BPMNDi) with freshly computed positions.
 *
 * - Handles plain processes (no collaboration) and collaborations with pools.
 * - When pools have lanes, lane shapes are tiled vertically around the process content.
 */
/** Every element id in a collaboration mapped to the index of the pool holding it. */
function poolOwners(defs: BpmnDefinitions, collab: BpmnCollaboration): Map<string, number> {
	const owners = new Map<string, number>()
	const processById = new Map(defs.processes.map((p) => [p.id, p]))

	for (let index = 0; index < collab.participants.length; index++) {
		const participant = collab.participants[index]
		if (!participant) continue
		owners.set(participant.id, index)
		const process = participant.processRef ? processById.get(participant.processRef) : undefined
		if (!process) continue

		const walk = (elements: BpmnFlowElement[]): void => {
			for (const element of elements) {
				owners.set(element.id, index)
				const container = element as unknown as { flowElements?: BpmnFlowElement[] }
				if (container.flowElements?.length) walk(container.flowElements)
			}
		}
		walk(process.flowElements)
	}

	return owners
}

/** Message flows collapsed into weighted pool-to-pool relationships. */
function poolLinks(collab: BpmnCollaboration, owners: Map<string, number>): PoolLink[] {
	const weights = new Map<string, PoolLink>()
	for (const flow of collab.messageFlows) {
		const from = owners.get(flow.sourceRef)
		const to = owners.get(flow.targetRef)
		if (from === undefined || to === undefined || from === to) continue
		const key = from < to ? `${from}:${to}` : `${to}:${from}`
		const existing = weights.get(key)
		if (existing) existing.weight++
		else weights.set(key, { from, to, weight: 1 })
	}
	return [...weights.values()]
}

/** Width of a laid-out process, ignoring where in space it happens to sit. */
function contentWidth(layout: LayoutResult): number {
	if (layout.nodes.length === 0) return 0
	const { minX, maxX } = contentBbox(layout.nodes)
	return maxX - minX
}

/**
 * Message flows expressed as the x centres of the two elements they connect,
 * measured inside each pool's own content so alignment can shift pools freely.
 */
function messageLinks(
	collab: BpmnCollaboration | undefined,
	pools: Array<{ participantId?: string; process?: BpmnProcess }>,
	layouts: LayoutResult[],
): MessageLink[] {
	if (!collab) return []

	const centres = new Map<string, { pool: number; x: number }>()
	for (let index = 0; index < pools.length; index++) {
		const layout = layouts[index]
		const pool = pools[index]
		if (!layout || !pool?.participantId || layout.nodes.length === 0) continue
		const { minX } = contentBbox(layout.nodes)
		const hasLanes = (pool.process?.laneSet?.lanes.length ?? 0) > 0
		const elemX = POOL_HEADER + (hasLanes ? LANE_HEADER : 0) + PADDING
		for (const node of layout.nodes) {
			centres.set(node.id, {
				pool: index,
				x: elemX + node.bounds.x + node.bounds.width / 2 - minX,
			})
		}
	}

	const links: MessageLink[] = []
	for (const flow of collab.messageFlows) {
		const from = centres.get(flow.sourceRef)
		const to = centres.get(flow.targetRef)
		if (!from || !to || from.pool === to.pool) continue
		links.push({ fromPool: from.pool, toPool: to.pool, fromX: from.x, toX: to.x })
	}
	return links
}

/**
 * Every element inside a collaboration mapped to the element that would contain
 * it on a plane: its sub-process, or the participant of its process. Following
 * the chain finds the nearest ancestor a collapsed scope leaves visible.
 */
function ancestorIndex(defs: BpmnDefinitions, collab: BpmnCollaboration): Map<string, string> {
	const parents = new Map<string, string>()
	const processById = new Map(defs.processes.map((p) => [p.id, p]))

	for (const participant of collab.participants) {
		const process = participant.processRef ? processById.get(participant.processRef) : undefined
		if (!process) continue

		const walk = (elements: BpmnFlowElement[], parent: string): void => {
			for (const element of elements) {
				parents.set(element.id, parent)
				const container = element as unknown as { flowElements?: BpmnFlowElement[] }
				if (container.flowElements?.length) walk(container.flowElements, element.id)
			}
		}
		walk(process.flowElements, participant.id)
	}

	return parents
}

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
	const childPlanes: Array<{ elementId: string; result: LayoutResult }> = []
	const collapsed = collapsedSubProcesses(defs)
	let poolY = 0

	// Walk the pools in declaration order so a black-box participant keeps its
	// place in the stack; processes no participant references follow.
	const processById = new Map(defs.processes.map((p) => [p.id, p]))
	const pools: Array<{ participantId?: string; process?: BpmnProcess }> = []
	if (collab) {
		const participantPools = collab.participants.map((participant) => ({
			participantId: participant.id,
			process: participant.processRef ? processById.get(participant.processRef) : undefined,
		}))
		// Pools that exchange messages read better next to each other, so the
		// stack follows the message flows rather than the declaration order.
		const order = orderPools(participantPools.length, poolLinks(collab, poolOwners(defs, collab)))
		for (const index of order) {
			const pool = participantPools[index]
			if (pool) pools.push(pool)
		}
		for (const process of defs.processes) {
			if (!processToParticipant.has(process.id)) pools.push({ process })
		}
	} else {
		for (const process of defs.processes) pools.push({ process })
	}

	// Lay every pool out first: alignment needs to see all of them before any
	// geometry is committed.
	const layouts = pools.map((pool) =>
		pool.process ? layoutProcess(pool.process, "semantic", collapsed) : { nodes: [], edges: [] },
	)
	const alignment = alignPools(
		pools.length,
		layouts.map((layout) => contentWidth(layout)),
		messageLinks(collab, pools, layouts),
	)

	/** Pools with nothing to draw; widened to match the others once all are placed. */
	const blackBoxPools: BpmnDiShape[] = []
	/** Root processes that are not the primary one, each on a plane of its own. */
	const rootPlanes: Array<{ elementId: string; shapes: BpmnDiShape[]; edges: BpmnDiEdge[] }> = []
	const primaryProcessId = defs.processes[0]?.id

	for (let poolIndex = 0; poolIndex < pools.length; poolIndex++) {
		const pool = pools[poolIndex]
		if (!pool) continue
		const { participantId, process } = pool
		const lanes = process?.laneSet?.lanes ?? []
		const hasLanes = lanes.length > 0

		const result: LayoutResult = layouts[poolIndex] ?? { nodes: [], edges: [] }
		const alignDx = alignment[poolIndex] ?? 0

		// A participant with no process, or one whose process has no flow nodes,
		// is a black box: it still needs a pool of its own to dock message flows
		// onto, and to stay visible at all.
		if (result.nodes.length === 0) {
			// A process can be nothing but annotations; they still belong on the plane.
			if (!participantId && process && process.textAnnotations.length > 0) {
				const annOnly = packAnnotations(process, [])
				const bbox = contentBbox([], annOnly.values())
				addAnnotationShapes(
					process,
					[],
					annOnly,
					allShapes,
					allEdges,
					PADDING - bbox.minX,
					PADDING - bbox.minY,
				)
				continue
			}
			if (participantId) {
				const shape: BpmnDiShape = {
					id: `${participantId}_di`,
					bpmnElement: participantId,
					isHorizontal: true,
					bounds: { x: 0, y: poolY, width: EMPTY_POOL_WIDTH, height: EMPTY_POOL_HEIGHT },
					unknownAttributes: {},
				}
				allShapes.push(shape)
				blackBoxPools.push(shape)
				poolY += EMPTY_POOL_HEIGHT + POOL_GAP
			}
			continue
		}
		childPlanes.push(...(result.planes ?? []))

		// The engine reports lane bands when it placed nodes by lane membership;
		// they replace the proportional tiling below.
		const engineLanes = result.lanes

		// Pre-compute annotation positions in layout space so they're included in the bbox
		const annBounds = process ? packAnnotations(process, result.nodes) : new Map<string, Bounds>()

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
			dx = elemX - minX + alignDx
			dy = laneBands ? poolY - bandTop : poolY + PADDING - minY
		} else {
			dx = PADDING - minX
			dy = PADDING - minY
		}

		// Only the primary process shares the root plane; any other root process
		// owns one, instead of being stacked on top of the first at the origin.
		if (!participantId && process && process.id !== primaryProcessId) {
			const shapes: BpmnDiShape[] = []
			const edges: BpmnDiEdge[] = []
			for (const node of result.nodes) shapes.push(nodeToShape(node, dx, dy))
			for (const edge of result.edges) edges.push(edgeToShape(edge, dx, dy))
			addAnnotationShapes(process, result.nodes, annBounds, shapes, edges, dx, dy)
			rootPlanes.push({ elementId: process.id, shapes, edges })
			continue
		}

		for (const node of result.nodes) allShapes.push(nodeToShape(node, dx, dy))
		for (const edge of result.edges) allEdges.push(edgeToShape(edge, dx, dy))
		if (process) {
			addAnnotationShapes(process, result.nodes, annBounds, allShapes, allEdges, dx, dy)
		}

		if (participantId) {
			const innerW = (hasLanes ? LANE_HEADER : 0) + contentW + 2 * PADDING + alignDx
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

	// Give the black boxes the width of the widest pool that has content, so the
	// stack reads as one diagram rather than a ragged column.
	if (blackBoxPools.length > 0) {
		const participantIds = new Set(collab?.participants.map((p) => p.id) ?? [])
		const widest = allShapes
			.filter((s) => participantIds.has(s.bpmnElement) && !blackBoxPools.includes(s))
			.reduce((max, s) => Math.max(max, s.bounds.width), EMPTY_POOL_WIDTH)
		for (const shape of blackBoxPools) shape.bounds.width = widest
	}

	if (collab && collab.messageFlows.length > 0) {
		const shapeByElement = new Map(allShapes.map((s) => [s.bpmnElement, s.bounds]))
		// An endpoint inside a collapsed sub-process has no shape on this plane;
		// the message docks on the nearest ancestor that does.
		const visibleAncestors = ancestorIndex(defs, collab)
		const resolve = (id: string): string => {
			let current: string | undefined = id
			while (current !== undefined && !shapeByElement.has(current)) {
				current = visibleAncestors.get(current)
			}
			return current ?? id
		}
		const participantIds = new Set(collab.participants.map((p) => p.id))
		const laneIds = new Set(
			defs.processes.flatMap((p) => (p.laneSet?.lanes ?? []).map((lane) => lane.id)),
		)
		// Pools and lanes are containers; message flows cross them by design. It is
		// the elements inside that a route has to miss.
		const obstacles = allShapes
			.filter((s) => !participantIds.has(s.bpmnElement) && !laneIds.has(s.bpmnElement))
			.map((s) => s.bounds)
		const poolGaps = poolBands(allShapes, participantIds)

		const runs: Array<{
			id: string
			source: BpmnWaypoint[]
			target: BpmnWaypoint[]
			gap: number
		}> = []

		/** Bounds of every expanded scope an element sits inside. */
		const containersOf = (id: string): BpmnBounds[] => {
			const out: BpmnBounds[] = []
			let parent = visibleAncestors.get(id)
			while (parent !== undefined) {
				const bounds = shapeByElement.get(parent)
				if (bounds) out.push(bounds)
				parent = visibleAncestors.get(parent)
			}
			return out
		}

		let stemOffset = 0
		for (const mf of collab.messageFlows) {
			const sourceRef = resolve(mf.sourceRef)
			const targetRef = resolve(mf.targetRef)
			const src = shapeByElement.get(sourceRef)
			const tgt = shapeByElement.get(targetRef)
			if (!src || !tgt) continue
			const run = {
				id: mf.id,
				...messageFlowRoute(
					src,
					tgt,
					participantIds.has(sourceRef),
					participantIds.has(targetRef),
					poolGaps,
					obstacles,
					stemOffset,
					[...containersOf(sourceRef), ...containersOf(targetRef)],
				),
			}
			runs.push(run)
			stemOffset = (stemOffset + MESSAGE_FLOW_STEM_STEP) % (MESSAGE_FLOW_STEM_STEP * 4)
		}

		// Flows sharing a gap get their own line inside it, so parallel runs do not
		// pile onto one row and cross every other flow's riser.
		const perGap = new Map<number, typeof runs>()
		for (const run of runs) {
			const list = perGap.get(run.gap)
			if (list) list.push(run)
			else perGap.set(run.gap, [run])
		}

		const endX = (points: BpmnWaypoint[]): number => points[points.length - 1]?.x ?? 0
		for (const [index, list] of perGap) {
			const gap = poolGaps[index]
			if (!gap) continue
			list.sort(
				(a, b) =>
					Math.min(endX(a.source), endX(a.target)) - Math.min(endX(b.source), endX(b.target)),
			)
			for (let i = 0; i < list.length; i++) {
				const run = list[i]
				if (!run) continue
				// The gap is clear ground, so moving the crossing inside it cannot
				// introduce a collision.
				const y = Math.round(gap.top + ((i + 1) * (gap.bottom - gap.top)) / (list.length + 1))
				const last = run.source[run.source.length - 1]
				const lastTarget = run.target[run.target.length - 1]
				if (last) last.y = y
				if (lastTarget) lastTarget.y = y
			}
		}

		for (const run of runs) {
			const waypoints = collapseCollinear([...run.source, ...[...run.target].reverse()])
			allEdges.push({ id: `${run.id}_di`, bpmnElement: run.id, waypoints, unknownAttributes: {} })
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
			...rootPlanes.map((plane) => {
				const previous = defs.diagrams.find((d) => d.plane.bpmnElement === plane.elementId)
				return {
					id: previous?.id ?? `BPMNDiagram_${plane.elementId}`,
					plane: {
						id: previous?.plane.id ?? `BPMNPlane_${plane.elementId}`,
						bpmnElement: plane.elementId,
						shapes: plane.shapes,
						edges: plane.edges,
					},
				}
			}),
			...childPlaneDiagrams(childPlanes, defs, collapsed),
		],
	}
}
