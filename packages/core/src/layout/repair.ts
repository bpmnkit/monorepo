import { type Port, type Side, routeOrthogonal, sidePorts } from "./orthogonal.js"
import type { Bounds, Waypoint } from "./types.js"

/** What a connection is, which decides the sides it may leave and enter by. */
export type ConnectionKind = "sequence" | "message" | "association"

export interface PlaneShape {
	id: string
	bounds: Bounds
	/** Pools, lanes and groups: drawn around other shapes, so never in the way. */
	container: boolean
}

export interface PlaneEdge {
	kind: ConnectionKind
	sourceRef: string
	targetRef: string
	waypoints: Waypoint[]
}

/** Shapes a route may legitimately pass through or along, beyond its two ends. */
export type RelatedShapes = (elementId: string) => Iterable<string>

/**
 * Negative: a route running along a shape's outline reads as passing through
 * it, so the box is grown by a pixel rather than shrunk.
 */
const TOLERANCE = -1
/** A route's own endpoints are shrunk instead: docking on the outline is the point. */
const OWN_END_TOLERANCE = 2

/**
 * Re-route every connection on a plane that runs through a shape it has nothing
 * to do with. The layout's own routers place the common cases cheaply; this pass
 * is the guarantee behind them, so it only spends a search on the edges that
 * actually need one — annotations packed onto a route, a message flow with no
 * clear column, an association cutting across an activity.
 *
 * Mutates `waypoints` in place.
 */
export function repairRoutes(
	shapes: PlaneShape[],
	edges: PlaneEdge[],
	related: RelatedShapes,
	/** Where a boundary event sits relative to its host, when it is one. */
	boundarySide: (elementId: string) => Side | undefined,
): void {
	const byId = new Map(shapes.map((s) => [s.id, s]))
	const obstacles = shapes.filter((s) => !s.container)

	for (const edge of edges) {
		const exempt = new Set<string>([edge.sourceRef, edge.targetRef])
		for (const id of related(edge.sourceRef)) exempt.add(id)
		for (const id of related(edge.targetRef)) exempt.add(id)
		const blocking = obstacles.filter((s) => !exempt.has(s.id))
		const source = byId.get(edge.sourceRef)
		const target = byId.get(edge.targetRef)
		if (!source || !target) continue
		if (!routeHits(edge.waypoints, blocking) && !throughOwnEnd(edge.waypoints, source, target)) {
			continue
		}

		const others = new SegmentIndex(edges.filter((e) => e !== edge))
		// A boundary event overlaps its host's outline, so a port of one can sit
		// inside the other; a route docking there would cross its own endpoint.
		const clearOf = (other: PlaneShape) => (port: Port) => !inside(port.point, other.bounds)
		const route = routeOrthogonal({
			from: ports(edge.kind, source, target, true, boundarySide(edge.sourceRef)).filter(
				clearOf(target),
			),
			to: ports(edge.kind, target, source, false, boundarySide(edge.targetRef)).filter(
				clearOf(source),
			),
			obstacles: blocking.map((s) => s.bounds),
			crossings: (a, b) => others.crossings(a, b),
		})
		if (route) edge.waypoints = route
	}
}

function ports(
	kind: ConnectionKind,
	own: PlaneShape,
	other: PlaneShape,
	leaving: boolean,
	boundary: Side | undefined,
): Port[] {
	if (boundary) {
		return sidePorts(own.bounds, {
			top: boundary === "top" ? 0 : Number.POSITIVE_INFINITY,
			bottom: boundary === "bottom" ? 0 : Number.POSITIVE_INFINITY,
			left: Number.POSITIVE_INFINITY,
			right: Number.POSITIVE_INFINITY,
		})
	}
	if (own.container) {
		// A pool docks under whatever it talks to rather than at its own centre.
		const ob = other.bounds
		const x = Math.min(
			Math.max(ob.x + ob.width / 2, own.bounds.x + 40),
			own.bounds.x + own.bounds.width - 10,
		)
		return [
			{ point: { x, y: own.bounds.y }, side: "top" },
			{ point: { x, y: own.bounds.y + own.bounds.height }, side: "bottom" },
		]
	}
	if (kind === "message") return sidePorts(own.bounds, { left: 60, right: 60 })
	if (kind === "association") return sidePorts(own.bounds)
	return leaving
		? sidePorts(own.bounds, { right: 0, top: 20, bottom: 20, left: 80 })
		: sidePorts(own.bounds, { left: 0, top: 20, bottom: 20, right: 80 })
}

/**
 * A route may touch its own endpoints only at their outline: one that docks on
 * the far side of its target, say, cuts straight across the shape to get there.
 */
function throughOwnEnd(waypoints: Waypoint[], source: PlaneShape, target: PlaneShape): boolean {
	for (let i = 0; i + 1 < waypoints.length; i++) {
		const a = waypoints[i]
		const b = waypoints[i + 1]
		if (!a || !b) continue
		for (const end of [source, target]) {
			if (!end.container && segmentHits(a, b, end.bounds, OWN_END_TOLERANCE)) return true
		}
	}
	return false
}

function inside(p: Waypoint, b: Bounds): boolean {
	return p.x > b.x && p.x < b.x + b.width && p.y > b.y && p.y < b.y + b.height
}

/** True when any segment passes through the interior of one of `shapes`. */
function routeHits(waypoints: Waypoint[], shapes: PlaneShape[]): boolean {
	for (let i = 0; i + 1 < waypoints.length; i++) {
		const a = waypoints[i]
		const b = waypoints[i + 1]
		if (!a || !b) continue
		for (const s of shapes) if (segmentHits(a, b, s.bounds)) return true
	}
	return false
}

/** Liang–Barsky clip against the box shrunk by `tolerance`; handles diagonals too. */
function segmentHits(a: Waypoint, b: Waypoint, box: Bounds, tolerance = TOLERANCE): boolean {
	const x1 = box.x + tolerance
	const y1 = box.y + tolerance
	const x2 = box.x + box.width - tolerance
	const y2 = box.y + box.height - tolerance
	if (x2 <= x1 || y2 <= y1) return false
	const dx = b.x - a.x
	const dy = b.y - a.y
	const p = [-dx, dx, -dy, dy]
	const q = [a.x - x1, x2 - a.x, a.y - y1, y2 - a.y]
	let t0 = 0
	let t1 = 1
	for (let i = 0; i < 4; i++) {
		const pi = p[i] ?? 0
		const qi = q[i] ?? 0
		if (pi === 0) {
			if (qi <= 0) return false
			continue
		}
		const t = qi / pi
		if (pi < 0) {
			if (t > t1) return false
			if (t > t0) t0 = t
		} else {
			if (t < t0) return false
			if (t < t1) t1 = t
		}
	}
	return t1 - t0 > 1e-9
}

/** Width of one bucket of the segment index. */
const CELL = 128

/**
 * Every segment of a set of routes, flattened and bucketed by x so the search's
 * many crossing queries each touch only the segments nearby.
 */
class SegmentIndex {
	private readonly coords: number[] = []
	private readonly cells = new Map<number, number[]>()

	constructor(edges: PlaneEdge[]) {
		for (const edge of edges) {
			const wps = edge.waypoints
			for (let i = 0; i + 1 < wps.length; i++) {
				const a = wps[i]
				const b = wps[i + 1]
				if (!a || !b) continue
				const index = this.coords.length
				this.coords.push(a.x, a.y, b.x, b.y)
				const lo = Math.floor(Math.min(a.x, b.x) / CELL)
				const hi = Math.floor(Math.max(a.x, b.x) / CELL)
				for (let c = lo; c <= hi; c++) {
					const cell = this.cells.get(c)
					if (cell) cell.push(index)
					else this.cells.set(c, [index])
				}
			}
		}
	}

	/** How many indexed segments the segment a→b properly crosses. */
	crossings(a: Waypoint, b: Waypoint): number {
		const minX = Math.min(a.x, b.x)
		const maxX = Math.max(a.x, b.x)
		const minY = Math.min(a.y, b.y)
		const maxY = Math.max(a.y, b.y)
		const lo = Math.floor(minX / CELL)
		const hi = Math.floor(maxX / CELL)
		const seen = hi > lo ? new Set<number>() : undefined
		const c = this.coords
		let count = 0
		for (let cell = lo; cell <= hi; cell++) {
			for (const i of this.cells.get(cell) ?? []) {
				if (seen) {
					if (seen.has(i)) continue
					seen.add(i)
				}
				const x1 = c[i] ?? 0
				const y1 = c[i + 1] ?? 0
				const x2 = c[i + 2] ?? 0
				const y2 = c[i + 3] ?? 0
				if (Math.max(x1, x2) < minX || Math.min(x1, x2) > maxX) continue
				if (Math.max(y1, y2) < minY || Math.min(y1, y2) > maxY) continue
				if (properlyCross(a, b, { x: x1, y: y1 }, { x: x2, y: y2 })) count++
			}
		}
		return count
	}
}

function properlyCross(p: Waypoint, q: Waypoint, r: Waypoint, t: Waypoint): boolean {
	const side = (o: Waypoint, a: Waypoint, b: Waypoint): number =>
		Math.sign((a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x))
	const s1 = side(p, q, r)
	const s2 = side(p, q, t)
	const s3 = side(r, t, p)
	const s4 = side(r, t, q)
	return s1 !== 0 && s2 !== 0 && s3 !== 0 && s4 !== 0 && s1 !== s2 && s3 !== s4
}
