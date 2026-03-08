import type { BpmnSequenceFlow } from "../bpmn/bpmn-model.js";
import type { BackEdge } from "./graph.js";
import { LABEL_CHAR_WIDTH, LABEL_HEIGHT, LABEL_MIN_WIDTH, LABEL_VERTICAL_OFFSET } from "./types.js";
import type { Bounds, LayoutEdge, LayoutNode, Waypoint } from "./types.js";

/** Port side for gateway edge connection. */
export type PortSide = "right" | "top" | "bottom";

const GATEWAY_TYPES: ReadonlySet<string> = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
]);

/**
 * Determine which side of the target a forward edge should connect to.
 * Non-gateway targets always receive edges from the left side.
 * Split gateways (starting): incoming always from the left.
 * Join gateways (closing): incoming based on relative position (top/bottom/left).
 */
export function resolveTargetPort(
	source: LayoutNode,
	target: LayoutNode,
	joinGateways: ReadonlySet<string>,
): "left" | "top" | "bottom" {
	if (!GATEWAY_TYPES.has(target.type)) {
		return "left";
	}
	// Split/starting gateways always receive from left
	if (!joinGateways.has(target.id)) {
		return "left";
	}
	// Join/closing gateways: connect based on relative position
	const srcCy = source.bounds.y + source.bounds.height / 2;
	const tgtCy = target.bounds.y + target.bounds.height / 2;
	if (Math.abs(srcCy - tgtCy) <= 1) {
		return "left";
	}
	return srcCy < tgtCy ? "top" : "bottom";
}

/**
 * Assign source ports for outgoing edges of a gateway.
 * - Single output: right port.
 * - Odd count: middle (by target y) → right, upper half → top, lower half → bottom.
 * - Even count: upper half → top, lower half → bottom, no right port.
 */
export function assignGatewayPorts(
	outgoingFlows: BpmnSequenceFlow[],
	nodeMap: Map<string, LayoutNode>,
): Map<string, PortSide> {
	const portMap = new Map<string, PortSide>();
	const count = outgoingFlows.length;

	if (count === 0) return portMap;
	if (count === 1) {
		const first = outgoingFlows[0];
		if (first) portMap.set(first.id, "right");
		return portMap;
	}

	// Sort flows by target's center-y (ascending = topmost first)
	const sorted = [...outgoingFlows].sort((a, b) => {
		const targetA = nodeMap.get(a.targetRef);
		const targetB = nodeMap.get(b.targetRef);
		const yA = targetA ? targetA.bounds.y + targetA.bounds.height / 2 : 0;
		const yB = targetB ? targetB.bounds.y + targetB.bounds.height / 2 : 0;
		return yA - yB;
	});

	if (count % 2 === 1) {
		const midIndex = Math.floor(count / 2);
		for (let i = 0; i < sorted.length; i++) {
			const flow = sorted[i];
			if (!flow) continue;
			if (i < midIndex) {
				portMap.set(flow.id, "top");
			} else if (i === midIndex) {
				portMap.set(flow.id, "right");
			} else {
				portMap.set(flow.id, "bottom");
			}
		}
	} else {
		const midIndex = count / 2;
		for (let i = 0; i < sorted.length; i++) {
			const flow = sorted[i];
			if (!flow) continue;
			portMap.set(flow.id, i < midIndex ? "top" : "bottom");
		}
	}

	return portMap;
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
): LayoutEdge[] {
	const backEdgeIds = new Set(backEdges.map((be) => be.flowId));

	// Group forward flows by source for gateway port assignment
	const forwardFlowsBySource = new Map<string, BpmnSequenceFlow[]>();
	const forwardIncomingCount = new Map<string, number>();
	for (const flow of sequenceFlows) {
		if (backEdgeIds.has(flow.id)) continue;
		let bucket = forwardFlowsBySource.get(flow.sourceRef);
		if (!bucket) {
			bucket = [];
			forwardFlowsBySource.set(flow.sourceRef, bucket);
		}
		bucket.push(flow);
		forwardIncomingCount.set(flow.targetRef, (forwardIncomingCount.get(flow.targetRef) ?? 0) + 1);
	}

	// Identify join gateways (gateways with multiple incoming forward edges)
	const joinGateways = new Set<string>();
	for (const [targetId, count] of forwardIncomingCount) {
		if (count >= 2) {
			const node = nodeMap.get(targetId);
			if (node && GATEWAY_TYPES.has(node.type)) {
				joinGateways.add(targetId);
			}
		}
	}

	// Assign ports for gateway sources
	const portAssignments = new Map<string, PortSide>();
	for (const [sourceId, flows] of forwardFlowsBySource) {
		const source = nodeMap.get(sourceId);
		if (!source || !GATEWAY_TYPES.has(source.type)) continue;
		const ports = assignGatewayPorts(flows, nodeMap);
		for (const [flowId, port] of ports) {
			portAssignments.set(flowId, port);
		}
	}

	const edges: LayoutEdge[] = [];

	for (const flow of sequenceFlows) {
		const source = nodeMap.get(flow.sourceRef);
		const target = nodeMap.get(flow.targetRef);
		if (!source || !target) continue;

		const isBackEdge = backEdgeIds.has(flow.id);
		let waypoints: Waypoint[];

		if (isBackEdge) {
			waypoints = routeBackEdge(source, target, nodeMap);
		} else {
			const port = portAssignments.get(flow.id);
			waypoints = port
				? routeFromPort(source, target, port, joinGateways)
				: routeForwardEdge(source, target, joinGateways);
		}

		edges.push({
			id: flow.id,
			sourceRef: flow.sourceRef,
			targetRef: flow.targetRef,
			waypoints,
			label: flow.name,
			labelBounds: undefined,
		});
	}

	// Collision-aware label placement
	placeEdgeLabels(edges, nodeMap);

	return edges;
}

/** Route a forward edge with orthogonal segments, preferring L-shaped over Z-shaped. */
function routeForwardEdge(
	source: LayoutNode,
	target: LayoutNode,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	const targetPort = resolveTargetPort(source, target, joinGateways);

	if (targetPort === "top" || targetPort === "bottom") {
		const sourceRight = source.bounds.x + source.bounds.width;
		const sourceCenterY = source.bounds.y + source.bounds.height / 2;
		const tgtX = target.bounds.x + target.bounds.width / 2;
		const tgtY = targetPort === "top" ? target.bounds.y : target.bounds.y + target.bounds.height;

		return [
			{ x: sourceRight, y: sourceCenterY },
			{ x: tgtX, y: sourceCenterY },
			{ x: tgtX, y: tgtY },
		];
	}

	const sourceRight = source.bounds.x + source.bounds.width;
	const sourceCenterY = source.bounds.y + source.bounds.height / 2;
	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	// Same vertical position: straight horizontal line
	if (Math.abs(sourceCenterY - targetCenterY) < 1) {
		return [
			{ x: sourceRight, y: sourceCenterY },
			{ x: targetLeft, y: targetCenterY },
		];
	}

	// Different vertical positions: prefer L-shaped routing
	// L-shape option 1: horizontal to target's X, then vertical down/up
	// L-shape option 2: vertical to target's Y, then horizontal to target
	// For left-to-right flow, option 1 (horizontal first, then vertical into target) is cleaner
	return [
		{ x: sourceRight, y: sourceCenterY },
		{ x: targetLeft, y: sourceCenterY },
		{ x: targetLeft, y: targetCenterY },
	];
}

/** Count the number of direction changes (bends) in a waypoint sequence. */
function countBends(waypoints: Waypoint[]): number {
	let bends = 0;
	for (let i = 1; i < waypoints.length - 1; i++) {
		const prev = waypoints[i - 1];
		const curr = waypoints[i];
		const next = waypoints[i + 1];
		if (!prev || !curr || !next) continue;
		const dx1 = curr.x - prev.x;
		const dy1 = curr.y - prev.y;
		const dx2 = next.x - curr.x;
		const dy2 = next.y - curr.y;
		// Direction changes when we go from horizontal to vertical or vice versa
		if (
			(Math.abs(dx1) > 0.1 && Math.abs(dy2) > 0.1) ||
			(Math.abs(dy1) > 0.1 && Math.abs(dx2) > 0.1)
		) {
			bends++;
		}
	}
	return bends;
}

/** Route a forward edge from a specific port side on the source node, choosing minimum bends. */
function routeFromPort(
	source: LayoutNode,
	target: LayoutNode,
	port: PortSide,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	if (port === "right") {
		return routeForwardEdge(source, target, joinGateways);
	}

	// Generate candidate routes: assigned port route + right-port alternative
	const portRoute = routeFromPortDirect(source, target, port, joinGateways);
	const rightRoute = routeForwardEdge(source, target, joinGateways);

	const portBends = countBends(portRoute);
	const rightBends = countBends(rightRoute);

	// Prefer the assigned port route unless right route has strictly fewer bends
	return rightBends < portBends ? rightRoute : portRoute;
}

/** Route directly from top/bottom port, preferring L-shaped path. */
function routeFromPortDirect(
	source: LayoutNode,
	target: LayoutNode,
	port: PortSide,
	joinGateways: ReadonlySet<string>,
): Waypoint[] {
	const targetPort = resolveTargetPort(source, target, joinGateways);

	const srcX = source.bounds.x + source.bounds.width / 2;
	const srcY = port === "top" ? source.bounds.y : source.bounds.y + source.bounds.height;

	if (targetPort === "top" || targetPort === "bottom") {
		const tgtX = target.bounds.x + target.bounds.width / 2;
		const tgtY = targetPort === "top" ? target.bounds.y : target.bounds.y + target.bounds.height;

		if (Math.abs(srcX - tgtX) < 1) {
			return [
				{ x: srcX, y: srcY },
				{ x: tgtX, y: tgtY },
			];
		}
		// L-shape: vertical to target Y, then horizontal to target X
		return [
			{ x: srcX, y: srcY },
			{ x: srcX, y: tgtY },
			{ x: tgtX, y: tgtY },
		];
	}

	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	// Same vertical position as target: straight horizontal
	if (Math.abs(srcY - targetCenterY) < 1) {
		return [
			{ x: srcX, y: srcY },
			{ x: targetLeft, y: targetCenterY },
		];
	}

	// L-shape: vertical to target's center-Y, then horizontal to target
	return [
		{ x: srcX, y: srcY },
		{ x: srcX, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];
}

/**
 * Route a back-edge (loop) above or below all nodes, choosing the shorter path.
 */
function routeBackEdge(
	source: LayoutNode,
	target: LayoutNode,
	nodeMap: Map<string, LayoutNode>,
): Waypoint[] {
	let minY = Number.POSITIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;
	for (const node of nodeMap.values()) {
		const top = node.bounds.y - (node.labelBounds ? node.labelBounds.height + 8 : 0);
		if (top < minY) minY = top;
		const bottom = node.bounds.y + node.bounds.height;
		if (bottom > maxY) maxY = bottom;
	}

	const sourceRight = source.bounds.x + source.bounds.width;
	const sourceCenterY = source.bounds.y + source.bounds.height / 2;
	const targetLeft = target.bounds.x;
	const targetCenterY = target.bounds.y + target.bounds.height / 2;

	// Route above
	const routeAboveY = minY - 30;
	const aboveRoute: Waypoint[] = [
		{ x: sourceRight, y: sourceCenterY },
		{ x: sourceRight + 20, y: sourceCenterY },
		{ x: sourceRight + 20, y: routeAboveY },
		{ x: targetLeft - 20, y: routeAboveY },
		{ x: targetLeft - 20, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];

	// Route below
	const routeBelowY = maxY + 30;
	const belowRoute: Waypoint[] = [
		{ x: sourceRight, y: sourceCenterY },
		{ x: sourceRight + 20, y: sourceCenterY },
		{ x: sourceRight + 20, y: routeBelowY },
		{ x: targetLeft - 20, y: routeBelowY },
		{ x: targetLeft - 20, y: targetCenterY },
		{ x: targetLeft, y: targetCenterY },
	];

	// Compare total path length and pick shorter
	const aboveLen = pathLength(aboveRoute);
	const belowLen = pathLength(belowRoute);
	return belowLen < aboveLen ? belowRoute : aboveRoute;
}

function pathLength(waypoints: Waypoint[]): number {
	let len = 0;
	for (let i = 1; i < waypoints.length; i++) {
		const a = waypoints[i - 1];
		const b = waypoints[i];
		if (!a || !b) continue;
		len += Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
	}
	return len;
}

/** Collision tolerance in pixels — small overlap allowed for rounding. */
const LABEL_COLLISION_TOLERANCE = 2;

/** Number of slide steps along a segment when searching for clear space. */
const LABEL_SLIDE_STEPS = 10;

function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return !(
		a.x + a.width + LABEL_COLLISION_TOLERANCE <= b.x ||
		b.x + b.width + LABEL_COLLISION_TOLERANCE <= a.x ||
		a.y + a.height + LABEL_COLLISION_TOLERANCE <= b.y ||
		b.y + b.height + LABEL_COLLISION_TOLERANCE <= a.y
	);
}

/**
 * Collision-aware edge label placement.
 * For each labeled edge, generates candidate positions on the longest segment
 * and picks the first one that doesn't overlap nodes or already-placed labels.
 */
function placeEdgeLabels(edges: LayoutEdge[], nodeMap: Map<string, LayoutNode>): void {
	const occupied: Bounds[] = [];

	// Collect all node bounds as obstacles
	for (const node of nodeMap.values()) {
		occupied.push(node.bounds);
		if (node.labelBounds) occupied.push(node.labelBounds);
	}

	for (const edge of edges) {
		if (!edge.label) continue;

		const labelWidth = Math.max(edge.label.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH);
		const labelHeight = LABEL_HEIGHT;

		// Find the longest segment
		const { segStart, segEnd } = findLongestSegment(edge.waypoints);

		// Generate candidate positions along the segment
		const candidates = generateLabelCandidates(segStart, segEnd, labelWidth, labelHeight);

		// Pick the first non-overlapping candidate
		let placed = false;
		for (const candidate of candidates) {
			if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
				edge.labelBounds = candidate;
				occupied.push(candidate);
				placed = true;
				break;
			}
		}

		// Fallback: slide along segment to find clear space
		if (!placed) {
			const fallback = slideLabelAlongSegment(segStart, segEnd, labelWidth, labelHeight, occupied);
			edge.labelBounds = fallback;
			occupied.push(fallback);
		}
	}
}

function findLongestSegment(waypoints: Waypoint[]): { segStart: Waypoint; segEnd: Waypoint } {
	let bestLen = 0;
	let bestStart: Waypoint = waypoints[0] ?? { x: 0, y: 0 };
	let bestEnd: Waypoint = waypoints[1] ?? waypoints[0] ?? { x: 0, y: 0 };

	for (let i = 1; i < waypoints.length; i++) {
		const a = waypoints[i - 1];
		const b = waypoints[i];
		if (!a || !b) continue;
		const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y);
		if (len > bestLen) {
			bestLen = len;
			bestStart = a;
			bestEnd = b;
		}
	}

	return { segStart: bestStart, segEnd: bestEnd };
}

function generateLabelCandidates(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
): Bounds[] {
	const candidates: Bounds[] = [];
	// Positions along segment: 0.5, 0.25, 0.75, 0.33, 0.67
	const fractions = [0.5, 0.25, 0.75, 0.33, 0.67];
	// Perpendicular offsets: above, below
	const offsets = [-LABEL_VERTICAL_OFFSET - labelHeight, LABEL_VERTICAL_OFFSET];

	for (const f of fractions) {
		const px = segStart.x + (segEnd.x - segStart.x) * f;
		const py = segStart.y + (segEnd.y - segStart.y) * f;

		for (const offset of offsets) {
			// Determine perpendicular direction
			const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1;
			let lx: number;
			let ly: number;

			if (isHorizontal) {
				lx = px - labelWidth / 2;
				ly = py + offset;
			} else {
				lx = px + offset;
				ly = py - labelHeight / 2;
			}

			candidates.push({ x: lx, y: ly, width: labelWidth, height: labelHeight });
		}
	}

	return candidates;
}

function slideLabelAlongSegment(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
	occupied: Bounds[],
): Bounds {
	const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1;

	for (let step = 0; step <= LABEL_SLIDE_STEPS; step++) {
		const t = step / LABEL_SLIDE_STEPS;
		const px = segStart.x + (segEnd.x - segStart.x) * t;
		const py = segStart.y + (segEnd.y - segStart.y) * t;

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
				};

		if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
			return candidate;
		}
	}

	// Absolute fallback: original midpoint placement
	const mx = (segStart.x + segEnd.x) / 2;
	const my = (segStart.y + segEnd.y) / 2;
	return {
		x: mx - labelWidth / 2,
		y: my - labelHeight - LABEL_VERTICAL_OFFSET,
		width: labelWidth,
		height: labelHeight,
	};
}
