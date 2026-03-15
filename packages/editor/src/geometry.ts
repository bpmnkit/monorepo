import type { RenderedShape, ViewportState } from "@bpmnkit/canvas"
import type { BpmnBounds, BpmnWaypoint } from "@bpmnkit/core"
import type { DiagPoint, HandleDir, LabelPosition, PortDir } from "./types.js"

// ── Coordinate conversion ────────────────────────────────────────────────────

/**
 * Converts client (screen) coordinates to diagram coordinates accounting for
 * the current viewport transform.
 */
export function screenToDiagram(
	screenX: number,
	screenY: number,
	viewport: ViewportState,
	svgRect: DOMRect,
): DiagPoint {
	return {
		x: (screenX - svgRect.left - viewport.tx) / viewport.scale,
		y: (screenY - svgRect.top - viewport.ty) / viewport.scale,
	}
}

/**
 * Converts diagram coordinates to client (screen) coordinates.
 */
export function diagramToScreen(
	diagX: number,
	diagY: number,
	viewport: ViewportState,
	svgRect: DOMRect,
): { x: number; y: number } {
	return {
		x: diagX * viewport.scale + viewport.tx + svgRect.left,
		y: diagY * viewport.scale + viewport.ty + svgRect.top,
	}
}

// ── Hit testing ───────────────────────────────────────────────────────────────

/**
 * Returns the topmost shape that contains the diagram-space point (x, y),
 * or null if none. Iterates in reverse render order (last = top).
 */
export function hitTestShape(shapes: RenderedShape[], x: number, y: number): RenderedShape | null {
	for (let i = shapes.length - 1; i >= 0; i--) {
		const shape = shapes[i]
		if (!shape) continue
		const b = shape.shape.bounds
		if (x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
			return shape
		}
	}
	return null
}

// ── Handle positions ──────────────────────────────────────────────────────────

/** Returns the 8 handle positions (diagram space) for a shape's bounding box. */
export function handlePositions(bounds: BpmnBounds): Record<HandleDir, DiagPoint> {
	const { x, y, width, height } = bounds
	const cx = x + width / 2
	const cy = y + height / 2
	return {
		nw: { x, y },
		n: { x: cx, y },
		ne: { x: x + width, y },
		e: { x: x + width, y: cy },
		se: { x: x + width, y: y + height },
		s: { x: cx, y: y + height },
		sw: { x, y: y + height },
		w: { x, y: cy },
	}
}

// ── Port positions ────────────────────────────────────────────────────────────

/** Returns the 4 connection port positions (diagram space) for a shape. */
export function portPositions(bounds: BpmnBounds): Array<{ x: number; y: number; dir: PortDir }> {
	const { x, y, width, height } = bounds
	return [
		{ x: x + width / 2, y, dir: "top" as PortDir },
		{ x: x + width, y: y + height / 2, dir: "right" as PortDir },
		{ x: x + width / 2, y: y + height, dir: "bottom" as PortDir },
		{ x, y: y + height / 2, dir: "left" as PortDir },
	]
}

// ── Resize ────────────────────────────────────────────────────────────────────

const MIN_SIZE = 20

/**
 * Applies a resize handle drag to produce new bounds.
 * `diagX` and `diagY` are the current cursor position in diagram space.
 */
export function applyResize(
	original: BpmnBounds,
	handle: HandleDir,
	diagX: number,
	diagY: number,
): BpmnBounds {
	let { x, y, width, height } = original
	const right = x + width
	const bottom = y + height

	switch (handle) {
		case "nw":
			x = Math.min(diagX, right - MIN_SIZE)
			y = Math.min(diagY, bottom - MIN_SIZE)
			width = right - x
			height = bottom - y
			break
		case "n":
			y = Math.min(diagY, bottom - MIN_SIZE)
			height = bottom - y
			break
		case "ne":
			y = Math.min(diagY, bottom - MIN_SIZE)
			width = Math.max(diagX - x, MIN_SIZE)
			height = bottom - y
			break
		case "e":
			width = Math.max(diagX - x, MIN_SIZE)
			break
		case "se":
			width = Math.max(diagX - x, MIN_SIZE)
			height = Math.max(diagY - y, MIN_SIZE)
			break
		case "s":
			height = Math.max(diagY - y, MIN_SIZE)
			break
		case "sw":
			x = Math.min(diagX, right - MIN_SIZE)
			width = right - x
			height = Math.max(diagY - y, MIN_SIZE)
			break
		case "w":
			x = Math.min(diagX, right - MIN_SIZE)
			width = right - x
			break
	}

	return { x, y, width, height }
}

// ── Waypoints ─────────────────────────────────────────────────────────────────

/**
 * Computes orthogonal (H/V only) waypoints between two shapes.
 * Picks exit/entry ports based on relative position: prefers L-shaped (one-bend) routes
 * over Z-shaped (two-bend) routes. For gateways or events below/above the source,
 * uses the bottom/top port rather than always exiting right.
 */
export function computeWaypoints(src: BpmnBounds, tgt: BpmnBounds): BpmnWaypoint[] {
	const srcCx = src.x + src.width / 2
	const srcCy = src.y + src.height / 2
	const tgtCx = tgt.x + tgt.width / 2
	const tgtCy = tgt.y + tgt.height / 2

	const dx = tgtCx - srcCx
	const dy = tgtCy - srcCy
	const absDx = Math.abs(dx)
	const absDy = Math.abs(dy)

	let srcPort: PortDir
	let tgtPort: PortDir

	if (absDx >= absDy) {
		// Target is predominantly to the side
		srcPort = dx >= 0 ? "right" : "left"
		if (absDy < 2) {
			// Same height → straight horizontal
			tgtPort = dx >= 0 ? "left" : "right"
		} else {
			// Vertical offset → L-style: enter from top or bottom
			tgtPort = dy > 0 ? "top" : "bottom"
		}
	} else {
		// Target is predominantly above or below
		srcPort = dy > 0 ? "bottom" : "top"
		if (absDx < 2) {
			// Same X → straight vertical
			tgtPort = dy > 0 ? "top" : "bottom"
		} else {
			// Horizontal offset → L-style: enter from left or right
			tgtPort = dx > 0 ? "left" : "right"
		}
	}

	return computeWaypointsWithPorts(src, srcPort, tgt, tgtPort)
}

// ── Label position ────────────────────────────────────────────────────────────

const LABEL_W = 80
const LABEL_H = 20
const LABEL_GAP = 6

/**
 * Computes the absolute diagram-space bounds for an external label given a
 * position option and the shape it belongs to.
 */
export function labelBoundsForPosition(shape: BpmnBounds, position: LabelPosition): BpmnBounds {
	const cx = shape.x + shape.width / 2
	const cy = shape.y + shape.height / 2
	const right = shape.x + shape.width
	const bottom = shape.y + shape.height
	switch (position) {
		case "bottom":
			return { x: cx - LABEL_W / 2, y: bottom + LABEL_GAP, width: LABEL_W, height: LABEL_H }
		case "top":
			return {
				x: cx - LABEL_W / 2,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			}
		case "left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: cy - LABEL_H / 2,
				width: LABEL_W,
				height: LABEL_H,
			}
		case "right":
			return { x: right + LABEL_GAP, y: cy - LABEL_H / 2, width: LABEL_W, height: LABEL_H }
		case "bottom-left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: bottom + LABEL_GAP,
				width: LABEL_W,
				height: LABEL_H,
			}
		case "bottom-right":
			return { x: right + LABEL_GAP, y: bottom + LABEL_GAP, width: LABEL_W, height: LABEL_H }
		case "top-left":
			return {
				x: shape.x - LABEL_GAP - LABEL_W,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			}
		case "top-right":
			return {
				x: right + LABEL_GAP,
				y: shape.y - LABEL_GAP - LABEL_H,
				width: LABEL_W,
				height: LABEL_H,
			}
	}
}

// ── Port helpers ──────────────────────────────────────────────────────────────

/** Returns the midpoint of a specific port edge in diagram space. */
export function portPoint(bounds: BpmnBounds, port: PortDir): DiagPoint {
	const { x, y, width, height } = bounds
	switch (port) {
		case "top":
			return { x: x + width / 2, y }
		case "right":
			return { x: x + width, y: y + height / 2 }
		case "bottom":
			return { x: x + width / 2, y: y + height }
		case "left":
			return { x, y: y + height / 2 }
	}
}

/** Returns which port of `bounds` is nearest to `pos` in diagram space. */
export function closestPort(pos: DiagPoint, bounds: BpmnBounds): PortDir {
	const dirs: PortDir[] = ["top", "right", "bottom", "left"]
	let best: PortDir = "right"
	let minDist = Number.POSITIVE_INFINITY
	for (const dir of dirs) {
		const pt = portPoint(bounds, dir)
		const d = Math.hypot(pos.x - pt.x, pos.y - pt.y)
		if (d < minDist) {
			minDist = d
			best = dir
		}
	}
	return best
}

/**
 * Derives which port of `bounds` a waypoint exits from / enters at.
 * Uses the dominant axis between the waypoint and the shape centre.
 */
export function portFromWaypoint(wp: BpmnWaypoint, bounds: BpmnBounds): PortDir {
	const cx = bounds.x + bounds.width / 2
	const cy = bounds.y + bounds.height / 2
	const dx = wp.x - cx
	const dy = wp.y - cy
	const hw = bounds.width / 2
	const hh = bounds.height / 2
	// Normalise to unit aspect ratio so thin shapes behave correctly
	if (Math.abs(dx / hw) >= Math.abs(dy / hh)) {
		return dx >= 0 ? "right" : "left"
	}
	return dy >= 0 ? "bottom" : "top"
}

/**
 * Computes orthogonal waypoints connecting two shapes via explicit exit/entry
 * ports.  All segments are horizontal or vertical.
 */
/**
 * Routes orthogonal waypoints between two explicit points given their exit/entry directions.
 * All segments are horizontal or vertical.
 */
export function routeOrthogonal(
	E: DiagPoint,
	srcPort: PortDir,
	P: DiagPoint,
	tgtPort: PortDir,
): BpmnWaypoint[] {
	if (Math.hypot(E.x - P.x, E.y - P.y) < 2) return [E, P]

	const srcH = srcPort === "left" || srcPort === "right"
	const tgtH = tgtPort === "left" || tgtPort === "right"

	if (srcH && tgtH) {
		if (Math.abs(E.y - P.y) < 2) return [E, P]
		if (srcPort === tgtPort) {
			// Same-direction ports → U-route
			const loopX = srcPort === "right" ? Math.max(E.x, P.x) + 50 : Math.min(E.x, P.x) - 50
			return [E, { x: loopX, y: E.y }, { x: loopX, y: P.y }, P]
		}
		const midX = Math.round((E.x + P.x) / 2)
		return [E, { x: midX, y: E.y }, { x: midX, y: P.y }, P]
	}

	if (!srcH && !tgtH) {
		if (Math.abs(E.x - P.x) < 2) return [E, P]
		if (srcPort === tgtPort) {
			const loopY = srcPort === "bottom" ? Math.max(E.y, P.y) + 50 : Math.min(E.y, P.y) - 50
			return [E, { x: E.x, y: loopY }, { x: P.x, y: loopY }, P]
		}
		const midY = Math.round((E.y + P.y) / 2)
		return [E, { x: E.x, y: midY }, { x: P.x, y: midY }, P]
	}

	if (srcH && !tgtH) {
		// Horizontal exit → vertical entry: L-route
		return [E, { x: P.x, y: E.y }, P]
	}
	// Vertical exit → horizontal entry: L-route
	return [E, { x: E.x, y: P.y }, P]
}

export function computeWaypointsWithPorts(
	src: BpmnBounds,
	srcPort: PortDir,
	tgt: BpmnBounds,
	tgtPort: PortDir,
): BpmnWaypoint[] {
	return routeOrthogonal(portPoint(src, srcPort), srcPort, portPoint(tgt, tgtPort), tgtPort)
}

// ── Obstacle-avoiding routing ─────────────────────────────────────────────────

function hSegIntersectsRect(x1: number, x2: number, y: number, r: BpmnBounds, m: number): boolean {
	if (y <= r.y + m || y >= r.y + r.height - m) return false
	return Math.max(x1, x2) > r.x + m && Math.min(x1, x2) < r.x + r.width - m
}

function vSegIntersectsRect(y1: number, y2: number, x: number, r: BpmnBounds, m: number): boolean {
	if (x <= r.x + m || x >= r.x + r.width - m) return false
	return Math.max(y1, y2) > r.y + m && Math.min(y1, y2) < r.y + r.height - m
}

export function waypointsIntersectObstacles(wps: BpmnWaypoint[], obstacles: BpmnBounds[]): boolean {
	const m = 2
	for (let i = 0; i < wps.length - 1; i++) {
		const a = wps[i]
		const b = wps[i + 1]
		if (!a || !b) continue
		const isH = Math.abs(a.y - b.y) < 1
		for (const obs of obstacles) {
			if (
				isH ? hSegIntersectsRect(a.x, b.x, a.y, obs, m) : vSegIntersectsRect(a.y, b.y, a.x, obs, m)
			)
				return true
		}
	}
	return false
}

/**
 * Returns true if any intermediate waypoint (not the first or last) lies strictly
 * inside the shape's bounding box.  This catches routes that enter the source or
 * target shape's interior before reaching the connection point — a situation that
 * waypointsIntersectObstacles cannot detect because src/tgt are excluded from the
 * obstacles list.
 */
export function routeEntersShape(wps: BpmnWaypoint[], shape: BpmnBounds): boolean {
	const m = 2
	for (let i = 1; i < wps.length - 1; i++) {
		const wp = wps[i]
		if (!wp) continue
		if (
			wp.x > shape.x + m &&
			wp.x < shape.x + shape.width - m &&
			wp.y > shape.y + m &&
			wp.y < shape.y + shape.height - m
		)
			return true
	}
	return false
}

// Port-pair iteration order for the 16-combo search.
// Ordered to try the most visually natural routes first:
//  1. Straight-through pairs (horizontal then vertical)
//  2. L-route pairs
//  3. U-route pairs (same-direction, widest detour)
const PORT_PAIRS: [PortDir, PortDir][] = [
	["right", "left"],
	["left", "right"],
	["bottom", "top"],
	["top", "bottom"],
	["right", "top"],
	["right", "bottom"],
	["left", "top"],
	["left", "bottom"],
	["bottom", "right"],
	["bottom", "left"],
	["top", "right"],
	["top", "left"],
	["right", "right"],
	["left", "left"],
	["bottom", "bottom"],
	["top", "top"],
]

/**
 * Computes waypoints between two shapes, routing around obstacle shapes and
 * never passing through the source or target shape's own interior.
 *
 * Strategy:
 *  1. Try the default (most natural) route.
 *  2. Try all 16 port-pair combinations in natural-first order.
 *  3. Try explicit bypass corridors above/below/left/right of each obstacle.
 *  4. Fall back to the default route as an absolute last resort.
 */
export function computeWaypointsAvoiding(
	src: BpmnBounds,
	tgt: BpmnBounds,
	obstacles: BpmnBounds[],
): BpmnWaypoint[] {
	// A route is invalid if it hits an external obstacle OR if it routes through
	// the interior of the source or target shape itself.
	const isBlocked = (wps: BpmnWaypoint[]): boolean =>
		waypointsIntersectObstacles(wps, obstacles) ||
		routeEntersShape(wps, src) ||
		routeEntersShape(wps, tgt)

	const defaultWps = computeWaypoints(src, tgt)
	if (!isBlocked(defaultWps)) return defaultWps

	for (const [srcPort, tgtPort] of PORT_PAIRS) {
		const wps = computeWaypointsWithPorts(src, srcPort, tgt, tgtPort)
		if (!isBlocked(wps)) return wps
	}

	// All 16 midpoint combos failed — try explicit bypass corridors around each obstacle.
	// The corridor route shape is: E → {E.x, bypassY} → {P.x, bypassY} → P  (Y bypasses)
	//                          or: E → {bypassX, E.y} → {bypassX, P.y} → P  (X bypasses)
	const PAD = 30
	for (const obs of obstacles) {
		for (const bypassY of [obs.y - PAD, obs.y + obs.height + PAD]) {
			for (const [sp, tp] of PORT_PAIRS) {
				const E = portPoint(src, sp)
				const P = portPoint(tgt, tp)
				const wps: BpmnWaypoint[] = [E, { x: E.x, y: bypassY }, { x: P.x, y: bypassY }, P]
				if (!isBlocked(wps)) return wps
			}
		}
		for (const bypassX of [obs.x - PAD, obs.x + obs.width + PAD]) {
			for (const [sp, tp] of PORT_PAIRS) {
				const E = portPoint(src, sp)
				const P = portPoint(tgt, tp)
				const wps: BpmnWaypoint[] = [E, { x: bypassX, y: E.y }, { x: bypassX, y: P.y }, P]
				if (!isBlocked(wps)) return wps
			}
		}
	}

	return defaultWps
}

// ── Selection bounds ──────────────────────────────────────────────────────────

/**
 * Returns the bounding box that encloses all selected shapes, or null if none.
 */
export function selectionBounds(shapes: RenderedShape[], ids: string[]): BpmnBounds | null {
	let minX = Number.POSITIVE_INFINITY
	let minY = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	let maxY = Number.NEGATIVE_INFINITY
	let found = false

	for (const shape of shapes) {
		if (!ids.includes(shape.id)) continue
		found = true
		const { x, y, width, height } = shape.shape.bounds
		minX = Math.min(minX, x)
		minY = Math.min(minY, y)
		maxX = Math.max(maxX, x + width)
		maxY = Math.max(maxY, y + height)
	}

	if (!found) return null
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}
