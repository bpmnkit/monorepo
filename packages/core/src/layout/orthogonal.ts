import type { Bounds, Waypoint } from "./types.js"

/** Which side of a shape a route leaves or enters by. */
export type Side = "top" | "right" | "bottom" | "left"

/** A point on a shape's border a route may use, with an optional preference cost. */
export interface Port {
	point: Waypoint
	side: Side
	/** Added to every route through this port, so preferred sides win ties. */
	cost?: number
}

export interface OrthogonalRequest {
	from: Port[]
	to: Port[]
	/** Shapes the route must not pass through; the endpoints themselves excluded. */
	obstacles: Bounds[]
	/** How many already-routed segments the segment a→b would cut across. */
	crossings?: (a: Waypoint, b: Waypoint) => number
	/** Clearance kept from obstacles where the route has room for it. */
	margin?: number
}

/** Stub every route leaves a port by before it may turn. */
const STUB = 12
const DEFAULT_MARGIN = 16
/** A bend costs as much as this much extra length. */
const BEND_COST = 40
/** A crossing costs as much as this much extra length. */
const CROSSING_COST = 160
/** Negative: running along a shape's outline counts as passing through it. */
const TOLERANCE = -1
/** How far around the two endpoints the first, cheaper search looks. */
const REGION = 240

const DIRS: ReadonlyArray<readonly [number, number]> = [
	[0, -1],
	[1, 0],
	[0, 1],
	[-1, 0],
]
const SIDE_DIR: Record<Side, number> = { top: 0, right: 1, bottom: 2, left: 3 }

/**
 * Obstacle-aware orthogonal routing: a shortest path, with bends and crossings
 * charged as extra length, over the sparse grid of lines that run just clear of
 * every obstacle edge (an orthogonal visibility graph). Used where the cheap
 * candidate routes all hit something, so its cost only lands on the hard cases.
 *
 * Returns `null` when no clear route exists at all.
 */
export function routeOrthogonal(request: OrthogonalRequest): Waypoint[] | null {
	const margin = request.margin ?? DEFAULT_MARGIN
	const near = nearObstacles(request, REGION)
	return (
		search(request, near, margin) ??
		(near.length < request.obstacles.length ? search(request, request.obstacles, margin) : null)
	)
}

function nearObstacles(request: OrthogonalRequest, reach: number): Bounds[] {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	for (const port of [...request.from, ...request.to]) {
		minX = Math.min(minX, port.point.x)
		minY = Math.min(minY, port.point.y)
		maxX = Math.max(maxX, port.point.x)
		maxY = Math.max(maxY, port.point.y)
	}
	return request.obstacles.filter(
		(o) =>
			o.x < maxX + reach &&
			o.x + o.width > minX - reach &&
			o.y < maxY + reach &&
			o.y + o.height > minY - reach,
	)
}

function stubOf(port: Port): Waypoint {
	const [dx, dy] = DIRS[SIDE_DIR[port.side]] ?? [0, 0]
	return { x: port.point.x + dx * STUB, y: port.point.y + dy * STUB }
}

/** Sorted, de-duplicated coordinates. */
function axis(values: number[]): number[] {
	const sorted = values.map((v) => Math.round(v * 2) / 2).sort((a, b) => a - b)
	const out: number[] = []
	for (const v of sorted) if (out[out.length - 1] !== v) out.push(v)
	return out
}

function segmentBlocked(a: Waypoint, b: Waypoint, obstacles: Bounds[]): boolean {
	const minX = Math.min(a.x, b.x)
	const maxX = Math.max(a.x, b.x)
	const minY = Math.min(a.y, b.y)
	const maxY = Math.max(a.y, b.y)
	for (const o of obstacles) {
		if (maxX <= o.x + TOLERANCE || o.x + o.width - TOLERANCE <= minX) continue
		if (maxY <= o.y + TOLERANCE || o.y + o.height - TOLERANCE <= minY) continue
		return true
	}
	return false
}

/** Index of `v` in a sorted array (exact match expected). */
function indexOf(sorted: number[], v: number): number {
	const target = Math.round(v * 2) / 2
	let lo = 0
	let hi = sorted.length - 1
	while (lo <= hi) {
		const mid = (lo + hi) >> 1
		const m = sorted[mid] ?? 0
		if (m === target) return mid
		if (m < target) lo = mid + 1
		else hi = mid - 1
	}
	return -1
}

/** First index whose value is greater than `v`. */
function upper(sorted: number[], v: number): number {
	let lo = 0
	let hi = sorted.length
	while (lo < hi) {
		const mid = (lo + hi) >> 1
		if ((sorted[mid] ?? 0) <= v) lo = mid + 1
		else hi = mid
	}
	return lo
}

function search(
	request: OrthogonalRequest,
	obstacles: Bounds[],
	margin: number,
): Waypoint[] | null {
	const starts = request.from
		.map((port) => ({ port, stub: stubOf(port) }))
		.filter(({ port, stub }) => !segmentBlocked(port.point, stub, request.obstacles))
	const ends = request.to
		.map((port) => ({ port, stub: stubOf(port) }))
		.filter(({ port, stub }) => !segmentBlocked(port.point, stub, request.obstacles))
	if (starts.length === 0 || ends.length === 0) return null

	const xsRaw: number[] = []
	const ysRaw: number[] = []
	for (const { stub } of [...starts, ...ends]) {
		xsRaw.push(stub.x)
		ysRaw.push(stub.y)
	}
	for (const o of obstacles) {
		xsRaw.push(o.x - margin, o.x + o.width + margin)
		ysRaw.push(o.y - margin, o.y + o.height + margin)
	}
	const xs = axis(xsRaw)
	const ys = axis(ysRaw)
	const nx = xs.length
	const ny = ys.length

	// Blocked grid steps: hBlocked[j * nx + i] is the step (i, j) → (i + 1, j),
	// vBlocked[j * nx + i] the step (i, j) → (i, j + 1). Every obstacle marks the
	// steps that would pass through it, so no step is tested against every shape.
	const hBlocked = new Uint8Array(nx * ny)
	const vBlocked = new Uint8Array(nx * ny)
	for (const o of request.obstacles) {
		const left = o.x + TOLERANCE
		const right = o.x + o.width - TOLERANCE
		const top = o.y + TOLERANCE
		const bottom = o.y + o.height - TOLERANCE
		if (right <= left || bottom <= top) continue
		// Rows strictly inside the obstacle's vertical span.
		// Steps (i, i + 1) overlapping (left, right): from the last line at or
		// before `left` up to the last line before `right`.
		const iFrom = Math.max(0, upper(xs, left) - 1)
		const jFrom = Math.max(0, upper(ys, top) - 1)
		for (let j = upper(ys, top); j < ny && (ys[j] ?? 0) < bottom; j++) {
			for (let i = iFrom; i + 1 < nx && (xs[i] ?? 0) < right; i++) hBlocked[j * nx + i] = 1
		}
		for (let i = upper(xs, left); i < nx && (xs[i] ?? 0) < right; i++) {
			for (let j = jFrom; j + 1 < ny && (ys[j] ?? 0) < bottom; j++) vBlocked[j * nx + i] = 1
		}
	}

	const goal = new Map<number, number>()
	for (const { port, stub } of ends) {
		const i = indexOf(xs, stub.x)
		const j = indexOf(ys, stub.y)
		if (i < 0 || j < 0) continue
		// The final move runs into the target, opposite to the port's outward side.
		const inward = (SIDE_DIR[port.side] + 2) % 4
		const key = (j * nx + i) * 4 + inward
		const cost = (port.cost ?? 0) + STUB
		goal.set(key, Math.min(goal.get(key) ?? Number.POSITIVE_INFINITY, cost))
	}
	if (goal.size === 0) return null

	const goalPoints = ends.map((e) => e.stub)
	const heuristic = (x: number, y: number): number => {
		let best = Number.POSITIVE_INFINITY
		for (const p of goalPoints) best = Math.min(best, Math.abs(p.x - x) + Math.abs(p.y - y))
		return best
	}

	const states = nx * ny * 4
	const dist = new Float64Array(states).fill(Number.POSITIVE_INFINITY)
	const prev = new Int32Array(states).fill(-1)
	const heap = new MinHeap()

	for (const { port, stub } of starts) {
		const i = indexOf(xs, stub.x)
		const j = indexOf(ys, stub.y)
		if (i < 0 || j < 0) continue
		const state = (j * nx + i) * 4 + SIDE_DIR[port.side]
		const cost = (port.cost ?? 0) + STUB
		if (cost < (dist[state] ?? 0)) {
			dist[state] = cost
			prev[state] = -2 - request.from.indexOf(port)
			heap.push(state, cost + heuristic(stub.x, stub.y))
		}
	}

	let best = -1
	let bestCost = Number.POSITIVE_INFINITY
	while (heap.size > 0) {
		const [state, priority] = heap.pop()
		if (priority >= bestCost) break
		const d = dist[state] ?? 0
		const dir = state & 3
		const cell = state >> 2
		const i = cell % nx
		const j = (cell - i) / nx
		const x = xs[i] ?? 0
		const y = ys[j] ?? 0
		if (d + heuristic(x, y) < priority - 1e-6) continue

		// Arrive at a goal stub: finish, turning in if needed.
		for (let finalDir = 0; finalDir < 4; finalDir++) {
			const extra = goal.get(cell * 4 + finalDir)
			if (extra === undefined) continue
			if (finalDir === (dir + 2) % 4) continue
			const total = d + extra + (finalDir === dir ? 0 : BEND_COST)
			if (total < bestCost) {
				bestCost = total
				best = state
			}
		}

		for (let nd = 0; nd < 4; nd++) {
			if (nd === (dir + 2) % 4) continue
			const [dx, dy] = DIRS[nd] ?? [0, 0]
			const ni = i + dx
			const nj = j + dy
			if (ni < 0 || nj < 0 || ni >= nx || nj >= ny) continue
			const blocked =
				dx !== 0
					? hBlocked[j * nx + Math.min(i, ni)] === 1
					: vBlocked[Math.min(j, nj) * nx + i] === 1
			if (blocked) continue
			const nxv = xs[ni] ?? 0
			const nyv = ys[nj] ?? 0
			let cost = d + Math.abs(nxv - x) + Math.abs(nyv - y)
			if (nd !== dir) cost += BEND_COST
			if (request.crossings) {
				cost += CROSSING_COST * request.crossings({ x, y }, { x: nxv, y: nyv })
			}
			const next = (nj * nx + ni) * 4 + nd
			if (cost < (dist[next] ?? 0)) {
				dist[next] = cost
				prev[next] = state
				heap.push(next, cost + heuristic(nxv, nyv))
			}
		}
	}
	if (best < 0) return null

	// Walk back to the start stub, then add the ports at either end.
	const points: Waypoint[] = []
	let state = best
	let startPort: Port | undefined
	for (;;) {
		const cell = state >> 2
		const i = cell % nx
		const j = (cell - i) / nx
		points.push({ x: xs[i] ?? 0, y: ys[j] ?? 0 })
		const p = prev[state] ?? -1
		if (p <= -2) {
			startPort = request.from[-2 - p]
			break
		}
		state = p
	}
	points.reverse()
	if (!startPort) return null
	const last = points[points.length - 1]
	const endPort = ends.find(({ stub }) => last && stub.x === last.x && stub.y === last.y)
	if (!endPort) return null
	return simplify([startPort.point, ...points, endPort.port.point])
}

/** Drop duplicate points and the middle of straight runs. */
function simplify(points: Waypoint[]): Waypoint[] {
	const out: Waypoint[] = []
	for (const p of points) {
		const last = out[out.length - 1]
		if (last && last.x === p.x && last.y === p.y) continue
		out.push(p)
		while (out.length >= 3) {
			const a = out[out.length - 3]
			const b = out[out.length - 2]
			const c = out[out.length - 1]
			if (!a || !b || !c) break
			if ((a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)) out.splice(-2, 1)
			else break
		}
	}
	return out
}

/** Binary min-heap of states keyed by priority. */
class MinHeap {
	private readonly items: number[] = []
	private readonly keys: number[] = []

	get size(): number {
		return this.items.length
	}

	push(item: number, key: number): void {
		const items = this.items
		const keys = this.keys
		let i = items.length
		items.push(item)
		keys.push(key)
		while (i > 0) {
			const parent = (i - 1) >> 1
			if ((keys[parent] ?? 0) <= key) break
			items[i] = items[parent] ?? 0
			keys[i] = keys[parent] ?? 0
			i = parent
		}
		items[i] = item
		keys[i] = key
	}

	pop(): [number, number] {
		const items = this.items
		const keys = this.keys
		const top: [number, number] = [items[0] ?? 0, keys[0] ?? 0]
		const lastItem = items.pop() ?? 0
		const lastKey = keys.pop() ?? 0
		const n = items.length
		if (n > 0) {
			let i = 0
			for (;;) {
				const l = 2 * i + 1
				if (l >= n) break
				const r = l + 1
				const c = r < n && (keys[r] ?? 0) < (keys[l] ?? 0) ? r : l
				if ((keys[c] ?? 0) >= lastKey) break
				items[i] = items[c] ?? 0
				keys[i] = keys[c] ?? 0
				i = c
			}
			items[i] = lastItem
			keys[i] = lastKey
		}
		return top
	}
}

/** The four side-centre ports of a rectangle, each charged `cost[side]` when given. */
export function sidePorts(b: Bounds, cost: Partial<Record<Side, number>> = {}): Port[] {
	const cx = b.x + b.width / 2
	const cy = b.y + b.height / 2
	const ports: Port[] = [
		{ point: { x: cx, y: b.y }, side: "top" },
		{ point: { x: b.x + b.width, y: cy }, side: "right" },
		{ point: { x: cx, y: b.y + b.height }, side: "bottom" },
		{ point: { x: b.x, y: cy }, side: "left" },
	]
	for (const port of ports) {
		const c = cost[port.side]
		if (c !== undefined) port.cost = c
	}
	return ports.filter((port) => port.cost === undefined || Number.isFinite(port.cost))
}
