import type { BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import type { BackEdge } from "./graph.js"
import { LABEL_CHAR_WIDTH, LABEL_HEIGHT, LABEL_MIN_WIDTH, LABEL_VERTICAL_OFFSET } from "./types.js"
import type { Bounds, LayoutEdge, LayoutNode, Waypoint } from "./types.js"

/** Port side for gateway edge connection. */
export type PortSide = "right" | "top" | "bottom"

const GATEWAY_TYPES: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
])

/** Tolerance for treating two CY values as "same level" in port decisions. */
const PORT_SAME_Y_TOLERANCE = 25

/**
 * Determine which side of the target a forward edge should connect to.
 * Non-gateway targets always receive edges from the left side.
 * Split gateways (starting): incoming always from the left.
 * Join gateways (closing): incoming based on relative position (top/bottom/left).
 *
 * Uses gridRow (integer row index) when available for exact comparison;
 * falls back to pixel-Y with PORT_SAME_Y_TOLERANCE for nodes without gridRow.
 */
export function resolveTargetPort(
	source: LayoutNode,
	target: LayoutNode,
	joinGateways: ReadonlySet<string>,
): "left" | "top" | "bottom" {
	if (!GATEWAY_TYPES.has(target.type)) {
		return "left"
	}
	// Split/starting gateways always receive from left
	if (!joinGateways.has(target.id)) {
		return "left"
	}
	// Join/closing gateways: connect based on relative position
	if (source.gridRow !== undefined && target.gridRow !== undefined) {
		if (source.gridRow === target.gridRow) return "left"
		return source.gridRow < target.gridRow ? "top" : "bottom"
	}
	// Fallback: pixel-Y comparison with tolerance
	const srcCy = source.bounds.y + source.bounds.height / 2
	const tgtCy = target.bounds.y + target.bounds.height / 2
	if (Math.abs(srcCy - tgtCy) <= PORT_SAME_Y_TOLERANCE) {
		return "left"
	}
	return srcCy < tgtCy ? "top" : "bottom"
}

/**
 * Assign source ports for outgoing edges of a gateway.
 * Uses absolute direction: target above → top, below → bottom, same level → right.
 * Single output always exits from the right port.
 */
export function assignGatewayPorts(
	outgoingFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
): Map<string, PortSide> {
	const portMap = new Map<string, PortSide>()
	const count = outgoingFlows.length

	if (count === 0) return portMap
	if (count === 1) {
		const first = outgoingFlows[0]
		if (first) portMap.set(first.id, "right")
		return portMap
	}

	const firstFlow = outgoingFlows[0]
	if (!firstFlow) return portMap
	const gateway = nodeMap.get(firstFlow.sourceRef)
	if (!gateway) return portMap
	const gatewayCY = gateway.bounds.y + gateway.bounds.height / 2
	const gatewayGridRow = gateway.gridRow

	for (const flow of outgoingFlows) {
		const target = nodeMap.get(flow.targetRef)
		if (!target) continue

		let side: PortSide
		if (gatewayGridRow !== undefined && target.gridRow !== undefined) {
			// Exact integer row comparison — no tolerance needed
			if (target.gridRow < gatewayGridRow) side = "top"
			else if (target.gridRow > gatewayGridRow) side = "bottom"
			else side = "right"
		} else {
			// Fallback: pixel-Y comparison with tolerance
			const targetCY = target.bounds.y + target.bounds.height / 2
			const dy = targetCY - gatewayCY
			if (dy < -PORT_SAME_Y_TOLERANCE) side = "top"
			else if (dy > PORT_SAME_Y_TOLERANCE) side = "bottom"
			else side = "right"
		}
		portMap.set(flow.id, side)
	}

	return portMap
}

/**
 * Route edges with orthogonal (horizontal + vertical) segments.
 * Forward edges go left-to-right; back-edges route above or below.
 * Gateway sources use port-based routing (top/right/bottom).
 */
export function routeEdges(
	sequenceFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
	backEdges: BackEdge[],
	dummyChains?: ReadonlyMap<string, readonly string[]>,
): LayoutEdge[] {
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId))

	// Group forward flows by source for gateway port assignment
	const forwardFlowsBySource = new Map<string, BpmnSequenceFlow[]>()
	const forwardIncomingCount = new Map<string, number>()
	for (const flow of sequenceFlows) {
		if (backEdgeIds.has(flow.id)) continue
		let bucket = forwardFlowsBySource.get(flow.sourceRef)
		if (!bucket) {
			bucket = []
			forwardFlowsBySource.set(flow.sourceRef, bucket)
		}
		bucket.push(flow)
		forwardIncomingCount.set(flow.targetRef, (forwardIncomingCount.get(flow.targetRef) ?? 0) + 1)
	}

	// Identify join gateways (gateways with multiple incoming forward edges)
	const joinGateways = new Set<string>()
	for (const [targetId, count] of forwardIncomingCount) {
		if (count >= 2) {
			const node = nodeMap.get(targetId)
			if (node && GATEWAY_TYPES.has(node.type)) {
				joinGateways.add(targetId)
			}
		}
	}

	// Assign ports for gateway sources
	const portAssignments = new Map<string, PortSide>()
	for (const [sourceId, flows] of forwardFlowsBySource) {
		const source = nodeMap.get(sourceId)
		if (!source || !GATEWAY_TYPES.has(source.type)) continue
		const ports = assignGatewayPorts(flows, nodeMap)
		for (const [flowId, port] of ports) {
			portAssignments.set(flowId, port)
		}
	}

	const edges: LayoutEdge[] = []

	for (const flow of sequenceFlows) {
		const source = nodeMap.get(flow.sourceRef)
		const target = nodeMap.get(flow.targetRef)
		if (!source || !target) continue

		const isBackEdge = backEdgeIds.has(flow.id)
		let waypoints: Waypoint[]

		if (isBackEdge) {
			waypoints = routeBackEdge(source, target, nodeMap)
		} else {
			const dummies = dummyChains?.get(flow.id)
			if (dummies && dummies.length > 0) {
				waypoints = routeViaChain(source, target, dummies, nodeMap)
			} else {
				const port = portAssignments.get(flow.id)
				waypoints = port
					? routeFromPort(source, target, port, joinGateways)
					: routeForwardEdge(source, target, joinGateways)
			}
		}

		edges.push({
			id: flow.id,
			sourceRef: flow.sourceRef,
			targetRef: flow.targetRef,
			waypoints,
			label: flow.name,
			labelBounds: undefined,
		})
	}

	// Resolve edges that cross through intermediate shapes
	resolveEdgeCrossings(edges, nodeMap)

	// Collision-aware label placement
	placeEdgeLabels(edges, nodeMap)

	return edges
}

/**
 * Route a multi-span edge through its dummy-node chain.
 * Each dummy node carries a pre-computed center position (0×0 bounds) placed by
 * the barycenter crossing-minimizer. We emit L-shaped segments between consecutive
 * points (source → d0 → d1 → … → target) and collapse collinear points at the end.
 */
function routeViaChain(
	source: LayoutNode,
	target: LayoutNode,
	dummyIds: readonly string[],
	nodeMap: Map<string, LayoutNode>,
): Waypoint[] {
	const waypoints: Waypoint[] = []

	const srcRight = source.bounds.x + source.bounds.width
	const srcCy = source.bounds.y + source.bounds.height / 2
	waypoints.push({ x: srcRight, y: srcCy })

	let prevY = srcCy
	for (const dummyId of dummyIds) {
		const dummy = nodeMap.get(dummyId)
		if (!dummy) continue
		// 0×0 dummy: bounds.x/y is the center position of the routing waypoint
		const dx = dummy.bounds.x
		const dy = dummy.bounds.y
		if (Math.abs(prevY - dy) > 0.5) {
			waypoints.push({ x: dx, y: prevY }) // horizontal to dummy column
		}
		waypoints.push({ x: dx, y: dy }) // vertical to dummy row
		prevY = dy
	}

	const tgtLeft = target.bounds.x
	const tgtCy = target.bounds.y + target.bounds.height / 2
	if (Math.abs(prevY - tgtCy) > 0.5) {
		waypoints.push({ x: tgtLeft, y: prevY }) // horizontal to target column
	}
	waypoints.push({ x: tgtLeft, y: tgtCy }) // entry into target

	return collapseCollinear(waypoints)
}

/** Route a forward edge with orthogonal segments, preferring L-shaped over Z-shaped. */
function routeForwardEdge(
	source: LayoutNode,
	target: LayoutNode,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	const targetPort = resolveTargetPort(source, target, joinGateways)

	if (targetPort === "top" || targetPort === "bottom") {
		const sourceRight = source.bounds.x + source.bounds.width
		const sourceCenterY = source.bounds.y + source.bounds.height / 2
		const tgtX = target.bounds.x + target.bounds.width / 2
		const tgtY = targetPort === "top" ? target.bounds.y : target.bounds.y + target.bounds.height

		return [
			{ x: sourceRight, y: sourceCenterY },
			{ x: tgtX, y: sourceCenterY },
			{ x: tgtX, y: tgtY },
		]
	}

	const sourceRight = source.bounds.x + source.bounds.width
	const sourceCenterY = source.bounds.y + source.bounds.height / 2
	const targetLeft = target.bounds.x
	const targetCenterY = target.bounds.y + target.bounds.height / 2

	// Same vertical position: straight horizontal line
	if (Math.abs(sourceCenterY - targetCenterY) < 1) {
		return [
			{ x: sourceRight, y: sourceCenterY },
			{ x: targetLeft, y: targetCenterY },
		]
	}

	// Different vertical positions: prefer L-shaped routing
	// L-shape option 1: horizontal to target's X, then vertical down/up
	// L-shape option 2: vertical to target's Y, then horizontal to target
	// For left-to-right flow, option 1 (horizontal first, then vertical into target) is cleaner
	return [
		{ x: sourceRight, y: sourceCenterY },
		{ x: targetLeft, y: sourceCenterY },
		{ x: targetLeft, y: targetCenterY },
	]
}

/** Route a forward edge from a specific port side on the source node. */
function routeFromPort(
	source: LayoutNode,
	target: LayoutNode,
	port: PortSide,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	if (port === "right") {
		return routeForwardEdge(source, target, joinGateways)
	}
	// top/bottom ports are assigned because the target is genuinely above/below —
	// always honour the assigned side rather than falling back to right-exit.
	return routeFromPortDirect(source, target, port, joinGateways)
}

/** Route directly from top/bottom port, preferring L-shaped path. */
function routeFromPortDirect(
	source: LayoutNode,
	target: LayoutNode,
	port: PortSide,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	const targetPort = resolveTargetPort(source, target, joinGateways)

	const srcX = source.bounds.x + source.bounds.width / 2
	const srcY = port === "top" ? source.bounds.y : source.bounds.y + source.bounds.height

	if (targetPort === "top" || targetPort === "bottom") {
		const tgtX = target.bounds.x + target.bounds.width / 2
		const tgtY = targetPort === "top" ? target.bounds.y : target.bounds.y + target.bounds.height

		if (Math.abs(srcX - tgtX) < 1) {
			return [
				{ x: srcX, y: srcY },
				{ x: tgtX, y: tgtY },
			]
		}
		// L-shape: vertical to target Y, then horizontal to target X
		return [
			{ x: srcX, y: srcY },
			{ x: srcX, y: tgtY },
			{ x: tgtX, y: tgtY },
		]
	}

	const targetLeft = target.bounds.x
	const targetCenterY = target.bounds.y + target.bounds.height / 2

	// Same vertical position as target: straight horizontal
	if (Math.abs(srcY - targetCenterY) < 1) {
		return [
			{ x: srcX, y: srcY },
			{ x: targetLeft, y: targetCenterY },
		]
	}

	// L-shape: vertical to target's center-Y, then horizontal to target
	return [
		{ x: srcX, y: srcY },
		{ x: srcX, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	]
}

/**
 * Route a back-edge (loop) above or below all nodes, choosing the shorter path.
 * Gateway targets are entered from the right (since back-edges come from the right).
 */
function routeBackEdge(
	source: LayoutNode,
	target: LayoutNode,
	nodeMap: Map<string, LayoutNode>,
): Waypoint[] {
	let minY = Number.POSITIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const node of nodeMap.values()) {
		const top = node.bounds.y - (node.labelBounds ? node.labelBounds.height + 8 : 0)
		if (top < minY) minY = top
		const bottom = node.bounds.y + node.bounds.height
		if (bottom > maxY) maxY = bottom
	}

	const sourceRight = source.bounds.x + source.bounds.width
	const sourceCenterY = source.bounds.y + source.bounds.height / 2
	const targetCenterY = target.bounds.y + target.bounds.height / 2

	// Gateways: enter from right side; non-gateways: enter from left side
	const enterRight = GATEWAY_TYPES.has(target.type)
	const entryX = enterRight ? target.bounds.x + target.bounds.width : target.bounds.x
	const stemX = enterRight ? entryX + 20 : entryX - 20

	// Route above
	const routeAboveY = minY - 30
	const aboveRoute: Waypoint[] = [
		{ x: sourceRight, y: sourceCenterY },
		{ x: sourceRight + 20, y: sourceCenterY },
		{ x: sourceRight + 20, y: routeAboveY },
		{ x: stemX, y: routeAboveY },
		{ x: stemX, y: targetCenterY },
		{ x: entryX, y: targetCenterY },
	]

	// Route below
	const routeBelowY = maxY + 30
	const belowRoute: Waypoint[] = [
		{ x: sourceRight, y: sourceCenterY },
		{ x: sourceRight + 20, y: sourceCenterY },
		{ x: sourceRight + 20, y: routeBelowY },
		{ x: stemX, y: routeBelowY },
		{ x: stemX, y: targetCenterY },
		{ x: entryX, y: targetCenterY },
	]

	// Compare total path length and pick shorter
	const aboveLen = pathLength(aboveRoute)
	const belowLen = pathLength(belowRoute)
	return belowLen < aboveLen ? belowRoute : aboveRoute
}

function pathLength(waypoints: Waypoint[]): number {
	let len = 0
	for (let i = 1; i < waypoints.length; i++) {
		const a = waypoints[i - 1]
		const b = waypoints[i]
		if (!a || !b) continue
		len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
	}
	return len
}

interface Rect {
	x: number
	y: number
	right: number
	bottom: number
}

/**
 * Post-process routed edges to avoid crossing through intermediate shapes.
 * For each segment that passes through a shape, adds detour waypoints around it.
 */
export function resolveEdgeCrossings(edges: LayoutEdge[], nodeMap: Map<string, LayoutNode>): void {
	const margin = 20
	const allShapes: Array<Rect & { id: string }> = []
	for (const [id, node] of nodeMap) {
		allShapes.push({
			id,
			x: node.bounds.x,
			y: node.bounds.y,
			right: node.bounds.x + node.bounds.width,
			bottom: node.bounds.y + node.bounds.height,
		})
	}

	for (const edge of edges) {
		const obstacles = allShapes.filter((s) => s.id !== edge.sourceRef && s.id !== edge.targetRef)

		// Pass 1: Detour around obstacles crossing segments
		for (let pass = 0; pass < 5; pass++) {
			const fixed = fixOneCrossing(edge.waypoints, obstacles, margin)
			if (!fixed) break
			edge.waypoints = collapseCollinear(fixed)
		}

		// Pass 2: Fix corner waypoints that ended up inside obstacles
		edge.waypoints = fixCornersInsideObstacles(edge.waypoints, obstacles, margin)
		edge.waypoints = collapseCollinear(edge.waypoints)
	}
}

/**
 * Find the first segment that crosses an obstacle and return a new waypoint
 * array with a detour around it. Returns undefined if no crossing found.
 */
function fixOneCrossing(
	waypoints: Waypoint[],
	obstacles: ReadonlyArray<Rect>,
	margin: number,
): Waypoint[] | undefined {
	for (let i = 0; i < waypoints.length - 1; i++) {
		const p1 = waypoints[i] as Waypoint
		const p2 = waypoints[i + 1] as Waypoint
		const crossing = findCrossing(p1, p2, obstacles)
		if (!crossing) continue

		const detour = buildDetour(p1, p2, crossing, margin, obstacles)
		if (!detour) continue

		const result = [...waypoints.slice(0, i + 1), ...detour, ...waypoints.slice(i + 1)]
		return result
	}
	return undefined
}

/** Find the first obstacle that a segment crosses through (not just touches). */
function findCrossing(
	p1: Waypoint,
	p2: Waypoint,
	obstacles: ReadonlyArray<Rect>,
): Rect | undefined {
	const minX = Math.min(p1.x, p2.x)
	const maxX = Math.max(p1.x, p2.x)
	const minY = Math.min(p1.y, p2.y)
	const maxY = Math.max(p1.y, p2.y)
	const shrink = 3

	for (const obs of obstacles) {
		if (
			maxX > obs.x + shrink &&
			minX < obs.right - shrink &&
			maxY > obs.y + shrink &&
			minY < obs.bottom - shrink
		) {
			return obs
		}
	}
	return undefined
}

/**
 * Build detour waypoints to route around an obstacle.
 * For vertical segments: detour horizontally (left or right).
 * For horizontal segments: detour vertically (above or below).
 */
function buildDetour(
	p1: Waypoint,
	p2: Waypoint,
	obs: Rect,
	margin: number,
	allObs: ReadonlyArray<Rect>,
): Waypoint[] | undefined {
	const isVertical = Math.abs(p1.x - p2.x) < 1
	const isHorizontal = Math.abs(p1.y - p2.y) < 1

	if (isVertical) {
		const x = p1.x
		const goingDown = p2.y > p1.y
		const beforeY = goingDown ? obs.y - margin : obs.bottom + margin
		const afterY = goingDown ? obs.bottom + margin : obs.y - margin

		// Try both sides; pick the one with fewer new crossings
		const leftX = obs.x - margin
		const rightX = obs.right + margin
		const leftCross = countNewCrossings(
			[
				{ x, y: beforeY },
				{ x: leftX, y: beforeY },
				{ x: leftX, y: afterY },
				{ x, y: afterY },
			],
			allObs,
		)
		const rightCross = countNewCrossings(
			[
				{ x, y: beforeY },
				{ x: rightX, y: beforeY },
				{ x: rightX, y: afterY },
				{ x, y: afterY },
			],
			allObs,
		)
		const detourX = leftCross <= rightCross ? leftX : rightX

		return [
			{ x, y: beforeY },
			{ x: detourX, y: beforeY },
			{ x: detourX, y: afterY },
			{ x, y: afterY },
		]
	}

	if (isHorizontal) {
		const y = p1.y
		const goingRight = p2.x > p1.x
		const beforeX = goingRight ? obs.x - margin : obs.right + margin
		const afterX = goingRight ? obs.right + margin : obs.x - margin

		const aboveY = obs.y - margin
		const belowY = obs.bottom + margin
		const aboveCross = countNewCrossings(
			[
				{ x: beforeX, y },
				{ x: beforeX, y: aboveY },
				{ x: afterX, y: aboveY },
				{ x: afterX, y },
			],
			allObs,
		)
		const belowCross = countNewCrossings(
			[
				{ x: beforeX, y },
				{ x: beforeX, y: belowY },
				{ x: afterX, y: belowY },
				{ x: afterX, y },
			],
			allObs,
		)
		const detourY = aboveCross <= belowCross ? aboveY : belowY

		return [
			{ x: beforeX, y },
			{ x: beforeX, y: detourY },
			{ x: afterX, y: detourY },
			{ x: afterX, y },
		]
	}

	// Diagonal segment — skip (shouldn't happen in orthogonal routing)
	return undefined
}

/** Count how many obstacles a set of consecutive segments would cross. */
function countNewCrossings(points: Waypoint[], obstacles: ReadonlyArray<Rect>): number {
	let count = 0
	for (let i = 0; i < points.length - 1; i++) {
		const a = points[i] as Waypoint
		const b = points[i + 1] as Waypoint
		if (findCrossing(a, b, obstacles)) count++
	}
	return count
}

/** Remove collinear intermediate waypoints (same X or same Y in a row). */
function collapseCollinear(waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length <= 2) return waypoints
	const result: Waypoint[] = [waypoints[0] as Waypoint]
	for (let i = 1; i < waypoints.length - 1; i++) {
		const prev = result[result.length - 1] as Waypoint
		const curr = waypoints[i] as Waypoint
		const next = waypoints[i + 1] as Waypoint
		const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5
		const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5
		if (sameX || sameY) continue
		result.push(curr)
	}
	result.push(waypoints[waypoints.length - 1] as Waypoint)
	return result
}

function isInsideRect(p: Waypoint, r: Rect): boolean {
	return p.x > r.x && p.x < r.right && p.y > r.y && p.y < r.bottom
}

/**
 * Fix corner waypoints that ended up inside obstacles after detours.
 * Moves the corner below/above the obstacle while maintaining orthogonal routing.
 */
function fixCornersInsideObstacles(
	waypoints: Waypoint[],
	obstacles: ReadonlyArray<Rect>,
	margin: number,
): Waypoint[] {
	const result = [...waypoints]

	// Process backwards to maintain indices after splicing
	for (let i = result.length - 2; i >= 1; i--) {
		const wp = result[i] as Waypoint
		const obs = obstacles.find((o) => isInsideRect(wp, o))
		if (!obs) continue

		const prev = result[i - 1] as Waypoint
		const next = result[i + 1] as Waypoint

		const isHorizToVert = Math.abs(prev.y - wp.y) < 1 && Math.abs(wp.x - next.x) < 1
		const isVertToHoriz = Math.abs(prev.x - wp.x) < 1 && Math.abs(wp.y - next.y) < 1

		if (isHorizToVert) {
			const newY = next.y > wp.y ? obs.bottom + margin : obs.y - margin
			result.splice(i, 1, { x: prev.x, y: newY }, { x: wp.x, y: newY })
		} else if (isVertToHoriz) {
			const newX = next.x > wp.x ? obs.right + margin : obs.x - margin
			result.splice(i, 1, { x: newX, y: prev.y }, { x: newX, y: wp.y })
		}
	}

	return result
}

/** Collision tolerance in pixels — small overlap allowed for rounding. */
const LABEL_COLLISION_TOLERANCE = 2

/** Number of slide steps along a segment when searching for clear space. */
const LABEL_SLIDE_STEPS = 10

function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return !(
		a.x + a.width + LABEL_COLLISION_TOLERANCE <= b.x ||
		b.x + b.width + LABEL_COLLISION_TOLERANCE <= a.x ||
		a.y + a.height + LABEL_COLLISION_TOLERANCE <= b.y ||
		b.y + b.height + LABEL_COLLISION_TOLERANCE <= a.y
	)
}

/**
 * Collision-aware edge label placement.
 * For each labeled edge, generates candidate positions on the longest segment
 * and picks the first one that doesn't overlap nodes or already-placed labels.
 */
/** @internal Exported for use by band-engine.ts. */
export function placeEdgeLabelsExport(edges: LayoutEdge[], nodeMap: Map<string, LayoutNode>): void {
	placeEdgeLabels(edges, nodeMap)
}

function placeEdgeLabels(edges: LayoutEdge[], nodeMap: Map<string, LayoutNode>): void {
	const occupied: Bounds[] = []

	// Collect all node bounds as obstacles
	for (const node of nodeMap.values()) {
		occupied.push(node.bounds)
		if (node.labelBounds) occupied.push(node.labelBounds)
	}

	for (const edge of edges) {
		if (!edge.label) continue

		const labelWidth = Math.max(edge.label.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH)
		const labelHeight = LABEL_HEIGHT

		// Find the longest segment
		const { segStart, segEnd } = findLongestSegment(edge.waypoints)

		// Generate candidate positions along the segment
		const candidates = generateLabelCandidates(segStart, segEnd, labelWidth, labelHeight)

		// Pick the first non-overlapping candidate
		let placed = false
		for (const candidate of candidates) {
			if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
				edge.labelBounds = candidate
				occupied.push(candidate)
				placed = true
				break
			}
		}

		// Fallback: slide along segment to find clear space
		if (!placed) {
			const fallback = slideLabelAlongSegment(segStart, segEnd, labelWidth, labelHeight, occupied)
			if (fallback) {
				edge.labelBounds = fallback
				occupied.push(fallback)
			}
			// If no clear position exists, leave labelBounds undefined (text preserved in edge.label)
		}
	}
}

function findLongestSegment(waypoints: Waypoint[]): { segStart: Waypoint; segEnd: Waypoint } {
	let bestLen = 0
	let bestStart: Waypoint = waypoints[0] ?? { x: 0, y: 0 }
	let bestEnd: Waypoint = waypoints[1] ?? waypoints[0] ?? { x: 0, y: 0 }

	for (let i = 1; i < waypoints.length; i++) {
		const a = waypoints[i - 1]
		const b = waypoints[i]
		if (!a || !b) continue
		const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
		if (len > bestLen) {
			bestLen = len
			bestStart = a
			bestEnd = b
		}
	}

	return { segStart: bestStart, segEnd: bestEnd }
}

function generateLabelCandidates(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
): Bounds[] {
	const candidates: Bounds[] = []
	// Positions along segment: 0.5, 0.25, 0.75, 0.33, 0.67
	const fractions = [0.5, 0.25, 0.75, 0.33, 0.67]
	// Perpendicular offsets: above, below
	const offsets = [-LABEL_VERTICAL_OFFSET - labelHeight, LABEL_VERTICAL_OFFSET]

	for (const f of fractions) {
		const px = segStart.x + (segEnd.x - segStart.x) * f
		const py = segStart.y + (segEnd.y - segStart.y) * f

		for (const offset of offsets) {
			// Determine perpendicular direction
			const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1
			let lx: number
			let ly: number

			if (isHorizontal) {
				lx = px - labelWidth / 2
				ly = py + offset
			} else {
				lx = px + offset
				ly = py - labelHeight / 2
			}

			candidates.push({ x: lx, y: ly, width: labelWidth, height: labelHeight })
		}
	}

	return candidates
}

function slideLabelAlongSegment(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
	occupied: Bounds[],
): Bounds | undefined {
	const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1

	for (let step = 0; step <= LABEL_SLIDE_STEPS; step++) {
		const t = step / LABEL_SLIDE_STEPS
		const px = segStart.x + (segEnd.x - segStart.x) * t
		const py = segStart.y + (segEnd.y - segStart.y) * t

		const candidate: Bounds = isHorizontal
			? {
					x: px - labelWidth / 2,
					y: py - labelHeight - LABEL_VERTICAL_OFFSET,
					width: labelWidth,
					height: labelHeight,
				}
			: {
					x: px - labelWidth - LABEL_VERTICAL_OFFSET,
					y: py - labelHeight / 2,
					width: labelWidth,
					height: labelHeight,
				}

		if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
			return candidate
		}
	}

	// No clear position found — skip label placement rather than forcing an overlap
	return undefined
}
