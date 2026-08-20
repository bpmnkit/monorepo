import type { BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { Bounds, LayoutEdge, Waypoint } from "../types.js"
import type { BandLayout } from "./bands.js"
import type { SemanticGraph } from "./graph.js"
import { BOUNDARY_SIZE, H_GAP } from "./place.js"

/** Clearance kept between a routed segment and the shapes it passes. */
const ROUTING_MARGIN = 20
/** Stub length before a boundary-event route turns. */
const BOUNDARY_STEM = 20
/** Shapes may be grazed by this much before a route counts as blocked. */
const HIT_TOLERANCE = 2
/** Vertical spacing between two detours sharing the same stretch of diagram. */
const CORRIDOR_SPACING = 20
/** How many lanes deep a corridor may stack before routes are allowed to share. */
const CORRIDOR_LANES = 4

interface RouteContext {
	graph: SemanticGraph
	bounds: Map<string, Bounds>
	/** Mid-x of the clear gutter in front of each rank. */
	gutterX: Map<number, number>
	/** Corridors already taken by detours, so parallel runs stack instead of merging. */
	reserved: Array<{ left: number; right: number; y: number }>
}

function centre(b: Bounds): Waypoint {
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

/**
 * Route every sequence flow orthogonally.
 *
 * Each edge proposes candidate polylines from most to least desirable and takes
 * the first one that clears every unrelated shape: a straight run along the
 * spine, a turn out of the source's top or bottom for a branch, and a turn in
 * the empty gutter in front of the target's column as the general fallback.
 */
export function routeFlows(
	graph: SemanticGraph,
	flows: BpmnSequenceFlow[],
	bounds: Map<string, Bounds>,
	bandLayout: BandLayout,
	gutterX: Map<number, number>,
): LayoutEdge[] {
	const ctx: RouteContext = { graph, bounds, gutterX, reserved: [] }
	const routed = new Map<string, Waypoint[]>()
	const pending: Array<{
		flow: BpmnSequenceFlow
		source: Bounds
		target: Bounds
		sourceRank: number | undefined
		targetRank: number | undefined
		below: boolean
		span: number
	}> = []

	for (const flow of flows) {
		const source = bounds.get(flow.sourceRef)
		const target = bounds.get(flow.targetRef)
		if (!source || !target) continue

		const fromBoundary = graph.byId.get(flow.sourceRef)?.type === "boundaryEvent"
		const sourceRank = graph.ranks.get(
			fromBoundary ? hostOf(graph, flow.sourceRef) : flow.sourceRef,
		)
		const targetRank = graph.ranks.get(flow.targetRef)
		const isBackEdge = graph.backEdges.has(flow.id)

		const direct = isBackEdge
			? []
			: fromBoundary
				? fromBoundaryCandidates(ctx, source, target, targetRank)
				: forwardCandidates(ctx, source, target, sourceRank, targetRank)

		const clear = pick(direct, ctx, flow.sourceRef, flow.targetRef)
		if (clear) {
			routed.set(flow.id, clear)
			continue
		}
		pending.push({
			flow,
			source,
			target,
			sourceRank,
			targetRank,
			below: isBackEdge,
			span: Math.abs(target.x - source.x),
		})
	}

	// Widest detours claim the outermost corridors, so long routes nest around
	// short ones instead of crossing them.
	pending.sort((a, b) => b.span - a.span)
	for (const item of pending) {
		routed.set(
			item.flow.id,
			detour(
				ctx,
				item.source,
				item.target,
				item.sourceRank,
				item.targetRank,
				item.below,
				item.flow.sourceRef,
				item.flow.targetRef,
			),
		)
	}

	// Emit in declaration order, whichever pass produced the route.
	const edges: LayoutEdge[] = []
	for (const flow of flows) {
		const waypoints = routed.get(flow.id)
		if (!waypoints) continue
		const edge: LayoutEdge = {
			id: flow.id,
			sourceRef: flow.sourceRef,
			targetRef: flow.targetRef,
			waypoints: collapse(waypoints),
		}
		if (flow.name) edge.label = flow.name
		edges.push(edge)
	}

	return edges
}

function hostOf(graph: SemanticGraph, eventId: string): string {
	for (const [hostId, events] of graph.attachers) {
		if (events.some((e) => e.id === eventId)) return hostId
	}
	return eventId
}

/** First candidate that crosses no shape other than its own endpoints. */
function pick(
	candidates: Waypoint[][],
	ctx: RouteContext,
	sourceId: string,
	targetId: string,
): Waypoint[] | null {
	const obstacles: Bounds[] = []
	for (const [id, b] of ctx.bounds) {
		if (id === sourceId || id === targetId) continue
		// An expanded container legitimately holds its children's routes.
		obstacles.push(b)
	}
	for (const candidate of candidates) {
		if (!blocked(candidate, obstacles)) return candidate
	}
	return null
}

function blocked(waypoints: Waypoint[], obstacles: Bounds[]): boolean {
	for (let i = 0; i + 1 < waypoints.length; i++) {
		const a = waypoints[i]
		const b = waypoints[i + 1]
		if (!a || !b) continue
		const minX = Math.min(a.x, b.x) + HIT_TOLERANCE
		const maxX = Math.max(a.x, b.x) - HIT_TOLERANCE
		const minY = Math.min(a.y, b.y) + HIT_TOLERANCE
		const maxY = Math.max(a.y, b.y) - HIT_TOLERANCE
		for (const o of obstacles) {
			if (maxX <= o.x || o.x + o.width <= minX) continue
			if (maxY <= o.y || o.y + o.height <= minY) continue
			return true
		}
	}
	return false
}

/**
 * Candidates for a normal forward flow, best first: a straight spine segment,
 * a branch leaving through the source's top or bottom, then the gutter turn.
 */
function forwardCandidates(
	ctx: RouteContext,
	source: Bounds,
	target: Bounds,
	sourceRank: number | undefined,
	targetRank: number | undefined,
): Waypoint[][] {
	const from = centre(source)
	const to = centre(target)
	const rightOf = target.x >= source.x + source.width

	if (Math.abs(from.y - to.y) < 1 && rightOf) {
		return [
			[
				{ x: source.x + source.width, y: from.y },
				{ x: target.x, y: to.y },
			],
		]
	}

	// Same column, different band: drop straight between the two.
	if (sourceRank !== undefined && sourceRank === targetRank) {
		const down = to.y > from.y
		return [
			[
				{ x: from.x, y: down ? source.y + source.height : source.y },
				{ x: to.x, y: down ? target.y : target.y + target.height },
			],
		]
	}

	if (!rightOf) return []

	const down = to.y > from.y
	const gutter = ctx.gutterX.get(targetRank ?? 0) ?? target.x - H_GAP / 2

	return [
		// Branch: leave through the side facing the target band, then run in.
		[
			{ x: from.x, y: down ? source.y + source.height : source.y },
			{ x: from.x, y: to.y },
			{ x: target.x, y: to.y },
		],
		// Gutter turn: out of the right edge, across, then into the left edge.
		[
			{ x: source.x + source.width, y: from.y },
			{ x: gutter, y: from.y },
			{ x: gutter, y: to.y },
			{ x: target.x, y: to.y },
		],
	]
}

/** A boundary event leaves through its outward side, never into its host. */
function fromBoundaryCandidates(
	ctx: RouteContext,
	source: Bounds,
	target: Bounds,
	targetRank: number | undefined,
): Waypoint[][] {
	const from = centre(source)
	const to = centre(target)
	const down = to.y >= from.y
	const exitY = down ? source.y + source.height : source.y
	const stem = down ? exitY + BOUNDARY_STEM : exitY - BOUNDARY_STEM

	if (Math.abs(from.x - to.x) < 1) {
		return [
			[
				{ x: from.x, y: exitY },
				{ x: to.x, y: down ? target.y : target.y + target.height },
			],
		]
	}

	if (target.x >= from.x) {
		const gutter = ctx.gutterX.get(targetRank ?? 0) ?? target.x - H_GAP / 2
		return [
			[
				{ x: from.x, y: exitY },
				{ x: from.x, y: to.y },
				{ x: target.x, y: to.y },
			],
			[
				{ x: from.x, y: exitY },
				{ x: from.x, y: stem },
				{ x: gutter, y: stem },
				{ x: gutter, y: to.y },
				{ x: target.x, y: to.y },
			],
		]
	}

	return [
		[
			{ x: from.x, y: exitY },
			{ x: from.x, y: stem },
			{ x: target.x + target.width, y: stem },
			{ x: target.x + target.width, y: to.y },
		],
	]
}

/**
 * The universal fallback: leave through the gutter behind the source, cross in
 * the nearest horizontal corridor that clears every shape between the two
 * columns, and come back through the gutter in front of the target. Used for
 * feedback edges and for any forward edge whose direct routes are blocked.
 */
function detour(
	ctx: RouteContext,
	source: Bounds,
	target: Bounds,
	sourceRank: number | undefined,
	targetRank: number | undefined,
	/** Loops read as loops only when they run underneath the flow they repeat. */
	below = false,
	sourceId = "",
	targetId = "",
): Waypoint[] {
	const from = centre(source)
	const to = centre(target)
	const dropX =
		sourceRank !== undefined
			? (ctx.gutterX.get(sourceRank + 1) ?? source.x + source.width + H_GAP / 2)
			: source.x + source.width + H_GAP / 2
	const riseX = ctx.gutterX.get(targetRank ?? 0) ?? target.x - H_GAP / 2
	const left = Math.min(dropX, riseX, from.x, to.x)
	const right = Math.max(dropX, riseX, from.x, to.x)
	const floor = below ? Math.max(source.y + source.height, target.y + target.height) : undefined
	const base = corridor(ctx, left, right, (from.y + to.y) / 2, floor)
	const goesDown = base > (from.y + to.y) / 2
	const corridorY = reserve(ctx, left, right, base, goesDown ? 1 : -1)

	const exitY = goesDown ? source.y + source.height : source.y
	const entryY = goesDown ? target.y + target.height : target.y

	// Leaving through the source's own top or bottom keeps the route out of the
	// horizontal corridor its neighbours flow along; the gutter variant is the
	// fallback for when that vertical is occupied.
	const straightOut: Waypoint[] = [
		{ x: from.x, y: exitY },
		{ x: from.x, y: corridorY },
		{ x: to.x, y: corridorY },
		{ x: to.x, y: entryY },
	]
	const viaGutter: Waypoint[] = [
		{ x: source.x + source.width, y: from.y },
		{ x: dropX, y: from.y },
		{ x: dropX, y: corridorY },
		{ x: riseX, y: corridorY },
		{ x: riseX, y: to.y },
		{ x: target.x, y: to.y },
	]

	return pick([straightOut, viaGutter], ctx, sourceId, targetId) ?? straightOut
}

/**
 * Keep parallel detours apart: step away from the flow until this stretch of
 * corridor is free, so two long routes stack instead of merging into one line.
 */
function reserve(
	ctx: RouteContext,
	left: number,
	right: number,
	base: number,
	direction: 1 | -1,
): number {
	let y = base
	for (let lane = 0; lane < CORRIDOR_LANES; lane++) {
		const taken = ctx.reserved.some(
			(r) => r.left < right && left < r.right && Math.abs(r.y - y) < CORRIDOR_SPACING,
		)
		const hitsShape = [...ctx.bounds.values()].some(
			(b) =>
				b.x + b.width > left &&
				b.x < right &&
				b.y - HIT_TOLERANCE < y &&
				y < b.y + b.height + HIT_TOLERANCE,
		)
		if (!taken && !hitsShape) break
		y += direction * CORRIDOR_SPACING
	}
	ctx.reserved.push({ left, right, y })
	return y
}

/**
 * A horizontal line between `left` and `right` that misses every shape, chosen
 * as close to `preferredY` as possible so detours stay local instead of
 * sweeping around the whole diagram.
 */
function corridor(
	ctx: RouteContext,
	left: number,
	right: number,
	preferredY: number,
	floor?: number,
): number {
	const spans: Array<[number, number]> = []
	for (const b of ctx.bounds.values()) {
		if (b.x + b.width > left && b.x < right) {
			spans.push([b.y - ROUTING_MARGIN, b.y + b.height + ROUTING_MARGIN])
		}
	}
	if (spans.length === 0) return preferredY
	spans.sort((a, b) => a[0] - b[0])

	// Merge the blocked bands, then take the gap centre nearest the preference.
	const merged: Array<[number, number]> = []
	for (const span of spans) {
		const last = merged[merged.length - 1]
		if (last && span[0] <= last[1]) last[1] = Math.max(last[1], span[1])
		else merged.push([span[0], span[1]])
	}

	const options: number[] = []
	const first = merged[0]
	const last = merged[merged.length - 1]
	if (first) options.push(first[0] - ROUTING_MARGIN)
	if (last) options.push(last[1] + ROUTING_MARGIN)
	for (let i = 0; i + 1 < merged.length; i++) {
		const a = merged[i]
		const b = merged[i + 1]
		if (a && b) options.push((a[1] + b[0]) / 2)
	}

	const allowed = floor === undefined ? options : options.filter((y) => y > floor)
	const usable = allowed.length > 0 ? allowed : options
	let best = usable[0] ?? preferredY
	for (const option of usable) {
		if (Math.abs(option - preferredY) < Math.abs(best - preferredY)) best = option
	}
	return best
}

/** Drop duplicate points and mid-points that sit on a straight run. */
function collapse(waypoints: Waypoint[]): Waypoint[] {
	const out: Waypoint[] = []
	for (const wp of waypoints) {
		const last = out[out.length - 1]
		if (last && last.x === wp.x && last.y === wp.y) continue
		out.push(wp)
	}
	for (let i = out.length - 2; i > 0; i--) {
		const prev = out[i - 1]
		const cur = out[i]
		const next = out[i + 1]
		if (!prev || !cur || !next) continue
		const collinear =
			(prev.x === cur.x && cur.x === next.x) || (prev.y === cur.y && cur.y === next.y)
		if (collinear) out.splice(i, 1)
	}
	return out
}
