// packages/core/src/layout/grid/grid-router.ts
import type { Bounds, Waypoint } from "../types.js"
import { GRID_CELL_HEIGHT, GRID_CELL_WIDTH } from "../types.js"
import type { Grid } from "./grid.js"

/** Routing endpoint: absolute bounds plus grid position. */
export interface RoutableNode {
	id: string
	bounds: Bounds
	row: number
	col: number
	/** Child grid dims when this node is an expanded subprocess. */
	childGrid?: { rows: number; cols: number }
	/** For boundary events: the host's childGrid (if the host is expanded). */
	hostChildGrid?: { rows: number; cols: number }
}

const H = GRID_CELL_HEIGHT // 140
const W = GRID_CELL_WIDTH // 150
const HALF_H = H / 2 // 70
const HALF_W = W / 2 // 75
const TASK_HALF_HEIGHT = 40
const BOUNDARY_STEM = 20

type Dir = "t" | "r" | "b" | "l"

function mid(b: Bounds): Waypoint {
	return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

function dock(point: Waypoint, rect: Bounds, dir: Dir): Waypoint {
	switch (dir) {
		case "t":
			return { x: point.x, y: rect.y }
		case "b":
			return { x: point.x, y: rect.y + rect.height }
		case "l":
			return { x: rect.x, y: point.y }
		case "r":
			return { x: rect.x + rect.width, y: point.y }
	}
}

function sourceGridOf(node: RoutableNode): { rows: number; cols: number } | undefined {
	return node.childGrid ?? node.hostChildGrid
}

/**
 * Compute orthogonal waypoints between two grid-placed nodes.
 * Port of bpmn-auto-layout's connectElements (lib/utils/layoutUtil.js:52),
 * with the level shift applied consistently (upstream drops it for
 * subprocess children).
 */
export function connectElements(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
	shift: { x: number; y: number },
	expandedRowsByRow: Map<number, number>,
): Waypoint[] {
	const sMid = mid(source.bounds)
	const tMid = mid(target.bounds)
	const dX = target.col - source.col
	const dY = target.row - source.row
	const cellTop = (row: number): number => row * H + shift.y
	const cellLeft = (col: number): number => col * W + shift.x
	const srcGrid = sourceGridOf(source)

	// Self-loop
	if (dX === 0 && dY === 0 && source.id === target.id) {
		const loopX = cellLeft(source.col) + (srcGrid ? (srcGrid.cols + 1) * W : W)
		const topY = cellTop(source.row)
		return [
			dock(sMid, source.bounds, "r"),
			{ x: loopX, y: sMid.y },
			{ x: loopX, y: topY },
			{ x: tMid.x, y: topY },
			dock(tMid, target.bounds, "t"),
		]
	}

	// Back-edge (loop closing leftwards)
	if (dX < 0) {
		if (sMid.y >= tMid.y) {
			const extraRows = srcGrid ? srcGrid.rows + 1 : 1 + (expandedRowsByRow.get(source.row) ?? 0)
			const downY = cellTop(source.row) + extraRows * H
			return [
				dock(sMid, source.bounds, "b"),
				{ x: sMid.x, y: downY },
				{ x: tMid.x, y: downY },
				dock(tMid, target.bounds, "b"),
			]
		}
		const upY = sMid.y - HALF_H
		return [
			dock(sMid, source.bounds, "t"),
			{ x: sMid.x, y: upY },
			{ x: tMid.x, y: upY },
			dock(tMid, target.bounds, "t"),
		]
	}

	// Same row, forward
	if (dY === 0) {
		if (isDirectPathBlocked(source, target, grid)) {
			const extraRows = srcGrid ? srcGrid.rows + 1 : 1
			const underY = cellTop(source.row) + extraRows * H
			return [
				dock(sMid, source.bounds, "b"),
				{ x: sMid.x, y: underY },
				{ x: tMid.x, y: underY },
				dock(tMid, target.bounds, "b"),
			]
		}
		const first = dock(sMid, source.bounds, "r")
		const last = dock(tMid, target.bounds, "l")
		// Expanded boxes dock at header height, not box middle
		if (source.childGrid) first.y = source.bounds.y + TASK_HALF_HEIGHT
		if (target.childGrid) last.y = target.bounds.y + TASK_HALF_HEIGHT
		if (first.y !== last.y) {
			// header-height correction created a step — resolve with an L
			return collapseCollinear([first, { x: last.x, y: first.y }, last])
		}
		return [first, last]
	}

	// Same column, vertical
	if (dX === 0) {
		if (isDirectPathBlocked(source, target, grid)) {
			const yOff = -Math.sign(dY) * HALF_H
			return [
				dock(sMid, source.bounds, "r"),
				{ x: sMid.x + HALF_W, y: sMid.y },
				{ x: sMid.x + HALF_W, y: tMid.y + yOff },
				{ x: tMid.x, y: tMid.y + yOff },
				dock(tMid, target.bounds, yOff > 0 ? "b" : "t"),
			]
		}
		return [
			dock(sMid, source.bounds, dY > 0 ? "b" : "t"),
			dock(tMid, target.bounds, dY > 0 ? "t" : "b"),
		]
	}

	// Diagonal forward: try the single-bend route
	const direct = directManhattan(source, target, grid, dY)
	if (direct) return direct

	// Fallback: 6-point S-route
	const yOff = -Math.sign(dY) * HALF_H
	return [
		dock(sMid, source.bounds, "r"),
		{ x: sMid.x + HALF_W, y: sMid.y },
		{ x: sMid.x + HALF_W, y: tMid.y + yOff },
		{ x: tMid.x - HALF_W, y: tMid.y + yOff },
		{ x: tMid.x - HALF_W, y: tMid.y },
		dock(tMid, target.bounds, "l"),
	]
}

function directManhattan(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
	dY: number,
): Waypoint[] | undefined {
	const sMid = mid(source.bounds)
	const tMid = mid(target.bounds)
	if (dY > 0) {
		// bend at (targetRow, sourceCol): down, then right
		const count =
			grid.getElementsInRange(
				{ row: source.row, col: source.col },
				{ row: target.row, col: source.col },
			).length +
			grid.getElementsInRange(
				{ row: target.row, col: source.col },
				{ row: target.row, col: target.col },
			).length
		if (count > 2) return undefined
		return [
			dock(sMid, source.bounds, "b"),
			{ x: sMid.x, y: tMid.y },
			dock(tMid, target.bounds, "l"),
		]
	}
	// bend at (sourceRow, targetCol): right, then up
	const count =
		grid.getElementsInRange(
			{ row: source.row, col: source.col },
			{ row: source.row, col: target.col },
		).length +
		grid.getElementsInRange(
			{ row: source.row, col: target.col },
			{ row: target.row, col: target.col },
		).length
	if (count > 2) return undefined
	return [dock(sMid, source.bounds, "r"), { x: tMid.x, y: sMid.y }, dock(tMid, target.bounds, "b")]
}

function isDirectPathBlocked(
	source: RoutableNode,
	target: RoutableNode,
	grid: Grid<{ id: string }>,
): boolean {
	// Each range is counted only when there is movement along that axis —
	// otherwise a same-row edge would double-count its target and always block.
	let total = 0
	if (target.col !== source.col) {
		total += grid.getElementsInRange(
			{ row: source.row, col: source.col },
			{ row: source.row, col: target.col },
		).length
	}
	if (target.row !== source.row) {
		total += grid.getElementsInRange(
			{ row: source.row, col: target.col },
			{ row: target.row, col: target.col },
		).length
	}
	return total > 2
}

/** Force an edge to leave through a boundary event's bottom docking point. */
export function ensureExitBottom(be: Bounds, waypoints: Waypoint[]): Waypoint[] {
	if (waypoints.length === 0) return waypoints
	const exit = { x: be.x + be.width / 2, y: be.y + be.height }
	const stemY = exit.y + BOUNDARY_STEM
	const rest = waypoints.slice(1)
	const rejoin = rest[0] ?? exit
	return collapseCollinear([exit, { x: exit.x, y: stemY }, { x: rejoin.x, y: stemY }, ...rest])
}

/** Remove intermediate waypoints that lie on a straight segment; round coordinates. */
export function collapseCollinear(waypoints: Waypoint[]): Waypoint[] {
	const rounded = waypoints.map((w) => ({ x: Math.round(w.x), y: Math.round(w.y) }))
	const out: Waypoint[] = []
	for (const p of rounded) {
		const a = out[out.length - 2]
		const b = out[out.length - 1]
		if (b && b.x === p.x && b.y === p.y) continue
		if (a && b && ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y))) {
			out[out.length - 1] = p
			continue
		}
		out.push(p)
	}
	return out
}
