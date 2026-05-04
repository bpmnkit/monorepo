import type { Bounds, Waypoint } from "./types.js"

const GRID_RES = 10
const OBSTACLE_MARGIN = 6
const TURN_PENALTY = 20
const OCCUPIED_EDGE_COST = 50
const CANVAS_EXTEND = 80

const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

/** Minimal binary min-heap keyed by f-score. */
class MinHeap {
	private data: Array<{ f: number; key: number }> = []

	push(f: number, key: number): void {
		this.data.push({ f, key })
		this.bubbleUp(this.data.length - 1)
	}

	pop(): { f: number; key: number } | undefined {
		const top = this.data[0]
		const last = this.data.pop()
		if (this.data.length > 0 && last !== undefined) {
			this.data[0] = last
			this.sinkDown(0)
		}
		return top
	}

	get size(): number {
		return this.data.length
	}

	private bubbleUp(startIdx: number): void {
		let i = startIdx
		while (i > 0) {
			const parent = (i - 1) >> 1
			const d = this.data[i]
			const p = this.data[parent]
			if (!d || !p || p.f <= d.f) break
			this.data[i] = p
			this.data[parent] = d
			i = parent
		}
	}

	private sinkDown(startIdx: number): void {
		let i = startIdx
		for (;;) {
			const left = 2 * i + 1
			const right = 2 * i + 2
			let smallest = i
			const d = this.data[smallest]
			const l = this.data[left]
			const r = this.data[right]
			if (l && l.f < (d?.f ?? Number.POSITIVE_INFINITY)) smallest = left
			const s = this.data[smallest]
			if (r && r.f < (s?.f ?? Number.POSITIVE_INFINITY)) smallest = right
			if (smallest === i) break
			const tmp = this.data[i]
			const sm = this.data[smallest]
			if (!tmp || !sm) break
			this.data[i] = sm
			this.data[smallest] = tmp
			i = smallest
		}
	}
}

/**
 * Route a single edge using A* on a 10px grid.
 * source/target are center points of source/target nodes.
 * obstacles are node bounding boxes to avoid (inflated by 6px margin).
 *
 * occupiedCells — optional shared set (keys: absGx * 65536 + absGy).
 *   Cells already in the set incur an extra OCCUPIED_EDGE_COST penalty, steering
 *   subsequent edges away from corridors already used by earlier edges.
 *   Successfully routed cells are added to the set so the next call sees them.
 *
 * Returns simplified orthogonal waypoints.
 */
export function routeEdgeAstar(
	source: { x: number; y: number },
	target: { x: number; y: number },
	obstacles: Bounds[],
	canvasWidth: number,
	canvasHeight: number,
	occupiedCells?: Set<number>,
): Waypoint[] {
	// Extend canvas to allow routing around edges
	const minX = Math.max(0, Math.min(source.x, target.x) - CANVAS_EXTEND)
	const minY = Math.max(0, Math.min(source.y, target.y) - CANVAS_EXTEND)
	const maxX = Math.max(source.x, target.x) + CANVAS_EXTEND + canvasWidth
	const maxY = Math.max(source.y, target.y) + CANVAS_EXTEND + canvasHeight

	const cols = Math.ceil((maxX - minX) / GRID_RES) + 1
	const rows = Math.ceil((maxY - minY) / GRID_RES) + 1

	// Absolute grid offset — maps local (lx, ly) → absolute (lx+offsetGx, ly+offsetGy)
	const offsetGx = Math.round(minX / GRID_RES)
	const offsetGy = Math.round(minY / GRID_RES)

	// Snap source and target to grid
	const sx = Math.round((source.x - minX) / GRID_RES)
	const sy = Math.round((source.y - minY) / GRID_RES)
	const tx = Math.round((target.x - minX) / GRID_RES)
	const ty = Math.round((target.y - minY) / GRID_RES)

	// If they're at the same grid cell, return straight line
	if (sx === tx && sy === ty) {
		return [source, target]
	}

	// Build blocked grid
	const blocked = new Uint8Array(cols * rows)
	for (const ob of obstacles) {
		const ox1 = Math.floor((ob.x - OBSTACLE_MARGIN - minX) / GRID_RES)
		const oy1 = Math.floor((ob.y - OBSTACLE_MARGIN - minY) / GRID_RES)
		const ox2 = Math.ceil((ob.x + ob.width + OBSTACLE_MARGIN - minX) / GRID_RES)
		const oy2 = Math.ceil((ob.y + ob.height + OBSTACLE_MARGIN - minY) / GRID_RES)

		for (let gy = Math.max(0, oy1); gy <= Math.min(rows - 1, oy2); gy++) {
			for (let gx = Math.max(0, ox1); gx <= Math.min(cols - 1, ox2); gx++) {
				blocked[gy * cols + gx] = 1
			}
		}
	}

	// Unblock source and target cells (they're inside nodes)
	blocked[sy * cols + sx] = 0
	blocked[ty * cols + tx] = 0

	// A* with direction-aware state: state = cell * 4 + dir
	const INF = Number.MAX_SAFE_INTEGER
	// g-scores per (cell, dir)
	const g = new Float32Array(cols * rows * 4).fill(INF)
	const parent = new Int32Array(cols * rows * 4).fill(-1)
	const parentDir = new Int8Array(cols * rows * 4).fill(-1)

	const heap = new MinHeap()

	// Initialize: try all 4 directions from source
	for (let d = 0; d < 4; d++) {
		const key = (sy * cols + sx) * 4 + d
		g[key] = 0
		const h = Math.abs(tx - sx) + Math.abs(ty - sy)
		heap.push(h, key)
	}

	while (heap.size > 0) {
		const item = heap.pop()
		if (!item) break
		const { key } = item
		const dir = key % 4
		const cell = (key - dir) / 4
		const cx = cell % cols
		const cy = (cell - cx) / cols

		if (cx === tx && cy === ty) {
			// Reconstruct path, marking each cell as occupied for subsequent edges
			const path: Array<{ x: number; y: number }> = []
			let k = key
			while (k !== -1) {
				const kDir = k % 4
				const kCell = (k - kDir) / 4
				const kx = kCell % cols
				const ky = (kCell - kx) / cols
				path.push({ x: kx * GRID_RES + minX, y: ky * GRID_RES + minY })
				if (occupiedCells) {
					occupiedCells.add((kx + offsetGx) * 65536 + (ky + offsetGy))
				}
				k = parent[k] ?? -1
			}
			path.reverse()
			return simplifyPath(path)
		}

		const gCur = g[key] ?? INF

		for (let nd = 0; nd < 4; nd++) {
			const nx = cx + (DX[nd] ?? 0)
			const ny = cy + (DY[nd] ?? 0)
			if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue
			const ncell = ny * cols + nx
			if (blocked[ncell]) continue

			const nkey = ncell * 4 + nd
			const turnCost = nd !== dir ? TURN_PENALTY : 0
			// Penalise cells already used by a previously routed edge
			let occupiedCost = 0
			if (occupiedCells) {
				const absKey = (nx + offsetGx) * 65536 + (ny + offsetGy)
				if (occupiedCells.has(absKey)) occupiedCost = OCCUPIED_EDGE_COST
			}
			const ng = gCur + 1 + turnCost + occupiedCost
			const prevG = g[nkey] ?? INF
			if (ng < prevG) {
				g[nkey] = ng
				parent[nkey] = key
				parentDir[nkey] = dir
				const h = Math.abs(tx - nx) + Math.abs(ty - ny)
				heap.push(ng + h, nkey)
			}
		}
	}

	// No path found — fall back to straight line
	return [source, target]
}

/** Remove collinear intermediate waypoints. */
function simplifyPath(path: Array<{ x: number; y: number }>): Waypoint[] {
	if (path.length <= 2) return path
	const result: Waypoint[] = [path[0] as Waypoint]
	for (let i = 1; i < path.length - 1; i++) {
		const prev = path[i - 1] as Waypoint
		const curr = path[i] as Waypoint
		const next = path[i + 1] as Waypoint
		const isCollinear =
			(Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5) ||
			(Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5)
		if (!isCollinear) {
			result.push(curr)
		}
	}
	result.push(path[path.length - 1] as Waypoint)
	return result
}
