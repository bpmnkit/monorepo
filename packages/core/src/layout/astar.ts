import type { Bounds, Waypoint } from "./types.js"

const OBSTACLE_PAD = 20
const TURN_PENALTY = 5000
const OCCUPIED_PENALTY = 2000

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
 * Route a single edge using an Orthogonal Channel Router on a Grid-Visibility Graph.
 *
 * Algorithm:
 *   1. Pad each obstacle by OBSTACLE_PAD on all sides.
 *   2. Build a sparse channel grid from padded-box edges, centers, and port coordinates.
 *   3. Block grid segments whose midpoints fall strictly inside any padded box.
 *   4. Run direction-aware A* with a turn penalty and a shared-segment penalty.
 *   5. Simplify collinear waypoints.
 *
 * obstacles must already exclude the source and target nodes so their padded boxes
 * do not block the entry/exit segments.
 *
 * occupiedCells accumulates segment keys (min(v1,v2)*numV + max(v1,v2)) across calls
 * so that later edges are steered away from corridors already in use.
 */
export function routeEdgeAstar(
	source: { x: number; y: number },
	target: { x: number; y: number },
	obstacles: Bounds[],
	_canvasWidth: number,
	_canvasHeight: number,
	occupiedCells?: Set<number>,
): Waypoint[] {
	// Step 1: padded bounding boxes
	const padded = obstacles.map((b) => ({
		left: b.x - OBSTACLE_PAD,
		right: b.x + b.width + OBSTACLE_PAD,
		top: b.y - OBSTACLE_PAD,
		bottom: b.y + b.height + OBSTACLE_PAD,
	}))

	// Step 2: discrete channel grid
	// X coords: left, right, and horizontal center of every padded box + port X values
	// Y coords: top, bottom, and vertical center of every padded box + port Y values
	const xSet = new Set<number>([source.x, target.x])
	const ySet = new Set<number>([source.y, target.y])
	for (const p of padded) {
		xSet.add(p.left)
		xSet.add(p.right)
		xSet.add((p.left + p.right) / 2)
		ySet.add(p.top)
		ySet.add(p.bottom)
		ySet.add((p.top + p.bottom) / 2)
	}
	const gridX = Array.from(xSet).sort((a, b) => a - b)
	const gridY = Array.from(ySet).sort((a, b) => a - b)

	const numX = gridX.length
	const numY = gridY.length
	const numV = numX * numY

	const xIdx = new Map<number, number>()
	const yIdx = new Map<number, number>()
	gridX.forEach((x, i) => xIdx.set(x, i))
	gridY.forEach((y, j) => yIdx.set(y, j))

	const srcXi = xIdx.get(source.x) ?? 0
	const srcYi = yIdx.get(source.y) ?? 0
	const tgtXi = xIdx.get(target.x) ?? 0
	const tgtYi = yIdx.get(target.y) ?? 0
	const srcV = srcXi * numY + srcYi
	const tgtV = tgtXi * numY + tgtYi

	if (srcV === tgtV) return [source, target]

	const tx = gridX[tgtXi] ?? target.x
	const ty = gridY[tgtYi] ?? target.y

	// Step 3: precompute blocked segments
	// A segment is blocked when its midpoint falls strictly inside any padded box.
	function midBlocked(mx: number, my: number): boolean {
		for (const p of padded) {
			if (mx > p.left && mx < p.right && my > p.top && my < p.bottom) return true
		}
		return false
	}

	function segKey(v1: number, v2: number): number {
		return (v1 < v2 ? v1 : v2) * numV + (v1 < v2 ? v2 : v1)
	}

	const blockedSeg = new Set<number>()
	// Horizontal segments
	for (let xi = 0; xi < numX - 1; xi++) {
		const gx1 = gridX[xi] ?? 0
		const gx2 = gridX[xi + 1] ?? 0
		const mx = (gx1 + gx2) / 2
		for (let yi = 0; yi < numY; yi++) {
			const my = gridY[yi] ?? 0
			if (midBlocked(mx, my)) {
				blockedSeg.add(segKey(xi * numY + yi, (xi + 1) * numY + yi))
			}
		}
	}
	// Vertical segments
	for (let xi = 0; xi < numX; xi++) {
		const gx = gridX[xi] ?? 0
		for (let yi = 0; yi < numY - 1; yi++) {
			const gy1 = gridY[yi] ?? 0
			const gy2 = gridY[yi + 1] ?? 0
			const my = (gy1 + gy2) / 2
			if (midBlocked(gx, my)) {
				blockedSeg.add(segKey(xi * numY + yi, xi * numY + (yi + 1)))
			}
		}
	}

	// Step 4: direction-aware A* on the channel grid
	// State = vertex * 4 + direction (0=+xi, 1=+yi, 2=-xi, 3=-yi)
	const DXI = [1, 0, -1, 0]
	const DYI = [0, 1, 0, -1]
	const INF = Number.MAX_SAFE_INTEGER
	const g = new Float64Array(numV * 4).fill(INF)
	const par = new Int32Array(numV * 4).fill(-1)
	const heap = new MinHeap()
	const h0 = Math.abs(tx - source.x) + Math.abs(ty - source.y)
	for (let d = 0; d < 4; d++) {
		const k = srcV * 4 + d
		g[k] = 0
		heap.push(h0, k)
	}

	while (heap.size > 0) {
		const item = heap.pop()
		if (!item) break
		const { key } = item
		const curDir = key & 3
		const curV = key >> 2
		const curXi = Math.floor(curV / numY)
		const curYi = curV - curXi * numY
		const curGval = g[key] ?? INF

		if (curV === tgtV) {
			// Reconstruct path from target back to source
			const path: Waypoint[] = []
			let k = key
			while (k >= 0) {
				const v = k >> 2
				const xi = Math.floor(v / numY)
				const yi = v - xi * numY
				const px = gridX[xi]
				const py = gridY[yi]
				if (px !== undefined && py !== undefined) path.push({ x: px, y: py })
				const pk = par[k] ?? -1
				if (pk < 0) break
				if (occupiedCells) occupiedCells.add(segKey(v, pk >> 2))
				k = pk
			}
			path.reverse()
			return simplifyPath(path)
		}

		const cgx = gridX[curXi] ?? 0
		const cgy = gridY[curYi] ?? 0

		for (let nd = 0; nd < 4; nd++) {
			const nxi = curXi + (DXI[nd] ?? 0)
			const nyi = curYi + (DYI[nd] ?? 0)
			if (nxi < 0 || nxi >= numX || nyi < 0 || nyi >= numY) continue
			const nV = nxi * numY + nyi
			const sk = segKey(curV, nV)
			if (blockedSeg.has(sk)) continue
			const nKey = nV * 4 + nd
			const ngx = gridX[nxi] ?? 0
			const ngy = gridY[nyi] ?? 0
			const dist = Math.abs(ngx - cgx) + Math.abs(ngy - cgy)
			const turnCost = nd !== curDir ? TURN_PENALTY : 0
			const occCost = occupiedCells?.has(sk) ? OCCUPIED_PENALTY : 0
			const newG = curGval + dist + turnCost + occCost
			if (newG < (g[nKey] ?? INF)) {
				g[nKey] = newG
				par[nKey] = key
				const h = Math.abs(tx - ngx) + Math.abs(ty - ngy)
				heap.push(newG + h, nKey)
			}
		}
	}

	// No path found — straight line fallback
	return [source, target]
}

/** Remove collinear intermediate waypoints. */
function simplifyPath(path: Waypoint[]): Waypoint[] {
	if (path.length <= 2) return path
	const result: Waypoint[] = []
	const first = path[0]
	if (first) result.push(first)
	for (let i = 1; i < path.length - 1; i++) {
		const prev = path[i - 1]
		const curr = path[i]
		const next = path[i + 1]
		if (!prev || !curr || !next) continue
		const collinear =
			(prev.x === curr.x && curr.x === next.x) || (prev.y === curr.y && curr.y === next.y)
		if (!collinear) result.push(curr)
	}
	const last = path[path.length - 1]
	if (last) result.push(last)
	return result
}
