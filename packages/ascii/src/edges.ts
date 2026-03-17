import type { AsciiGrid } from "./grid.js"
import { truncate } from "./util.js"

/**
 * Draw an edge using explicit source/target port sides.
 *
 * srcPort — which side the edge exits the source element:
 *   "right"  → standard horizontal exit (srcCol = first col after right border, srcRow = midRow)
 *   "top"    → exits the top of source   (srcCol = midCol, srcRow = midRow)
 *   "bottom" → exits the bottom of source (srcCol = midCol, srcRow = midRow)
 *
 * dstPort — which side the edge enters the target element:
 *   "left"   → standard horizontal entry (dstCol = left border col, dstRow = midRow)
 *   "top"    → enters the top of target   (dstCol = midCol, dstRow = midRow)
 *   "bottom" → enters the bottom of target (dstCol = midCol, dstRow = midRow)
 *
 * For top/bottom ports the element's middle row (midRow) is passed as srcRow/dstRow;
 * this function offsets by ±2 to reach the actual visible exit/entry row (one row
 * outside the 3-row element box).
 */
export function drawPortedEdge(
	grid: AsciiGrid,
	srcCol: number,
	srcRow: number,
	srcPort: "right" | "top" | "bottom",
	dstCol: number,
	dstRow: number,
	dstPort: "left" | "top" | "bottom",
	label?: string,
): void {
	if (srcPort === "right" && dstPort === "left") {
		drawEdge(grid, srcCol, srcRow, dstCol, dstRow, label)
		return
	}

	// top exit → left entry
	if (srcPort === "top" && dstPort === "left") {
		if (srcRow > dstRow) {
			// Target is ABOVE: go up from gateway top to target row, corner, then right
			grid.setLine(srcCol, dstRow, "┌")
			for (let r = dstRow + 1; r < srcRow - 1; r++) grid.setLine(srcCol, r, "│")
			drawHorizontalSegment(grid, srcCol + 1, dstCol - 2, dstRow)
			grid.set(dstCol - 1, dstRow, "►")
			if (label) {
				const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
				grid.write(mid, dstRow - 1, truncate(label, dstCol - srcCol))
			}
		} else {
			// Target is at same row or below: route ABOVE the diagram via routeRow=1,
			// then descend to target row.  Path: up↑ at srcCol → right→ at routeRow → down↓ at dstCol-1 → ►
			const routeRow = 1
			grid.setLine(srcCol, routeRow, "└") // ↑ meets →
			for (let r = routeRow + 1; r < srcRow - 1; r++) grid.setLine(srcCol, r, "│")
			drawHorizontalSegment(grid, srcCol + 1, dstCol - 2, routeRow)
			grid.setLine(dstCol - 1, routeRow, "┐") // ← meets ↓
			for (let r = routeRow + 1; r < dstRow; r++) grid.setLine(dstCol - 1, r, "│")
			grid.set(dstCol - 1, dstRow, "►")
			if (label) {
				const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
				grid.write(mid, routeRow - 1, truncate(label, dstCol - srcCol))
			}
		}
		return
	}

	// bottom exit → left entry
	if (srcPort === "bottom" && dstPort === "left") {
		if (srcRow < dstRow) {
			// Target is BELOW: go down from gateway bottom to target row, corner, then right
			grid.setLine(srcCol, dstRow, "└")
			for (let r = srcRow + 2; r < dstRow; r++) grid.setLine(srcCol, r, "│")
			drawHorizontalSegment(grid, srcCol + 1, dstCol - 2, dstRow)
			grid.set(dstCol - 1, dstRow, "►")
			if (label) {
				const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
				grid.write(mid, dstRow - 1, truncate(label, dstCol - srcCol))
			}
		} else {
			// Target is at same row or above: route BELOW the diagram, then ascend to target row.
			// Path: down↓ at srcCol → right→ at routeRow → up↑ at dstCol-1 → ►
			const routeRow = grid.rows - 2
			grid.setLine(srcCol, routeRow, "┌") // ↓ meets →
			for (let r = srcRow + 2; r < routeRow; r++) grid.setLine(srcCol, r, "│")
			drawHorizontalSegment(grid, srcCol + 1, dstCol - 2, routeRow)
			grid.setLine(dstCol - 1, routeRow, "┘") // ← meets ↑
			for (let r = dstRow + 1; r < routeRow; r++) grid.setLine(dstCol - 1, r, "│")
			grid.set(dstCol - 1, dstRow, "►")
			if (label) {
				const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
				grid.write(mid, routeRow + 1, truncate(label, dstCol - srcCol))
			}
		}
		return
	}

	// right exit → top entry: horizontal right to target center-col, then vertical DOWN to target top
	if (srcPort === "right" && dstPort === "top") {
		if (srcRow >= dstRow) {
			drawEdge(grid, srcCol, srcRow, dstCol, dstRow, label)
			return
		}
		// Corner at (dstCol, srcRow): connecting left (← from src) and down (↓ to dst top)
		drawHorizontalSegment(grid, srcCol, dstCol - 1, srcRow)
		grid.setLine(dstCol, srcRow, "┐")
		for (let r = srcRow + 1; r < dstRow - 2; r++) grid.setLine(dstCol, r, "│")
		grid.set(dstCol, dstRow - 2, "▼")
		if (label) {
			const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
			grid.write(mid, srcRow - 1, truncate(label, dstCol - srcCol))
		}
		return
	}

	// right exit → bottom entry: horizontal right to target center-col, then vertical UP to target bottom
	if (srcPort === "right" && dstPort === "bottom") {
		if (srcRow <= dstRow) {
			drawEdge(grid, srcCol, srcRow, dstCol, dstRow, label)
			return
		}
		// Corner at (dstCol, srcRow): connecting left (← from src) and up (↑ to dst bottom)
		drawHorizontalSegment(grid, srcCol, dstCol - 1, srcRow)
		grid.setLine(dstCol, srcRow, "┘")
		for (let r = dstRow + 3; r < srcRow; r++) grid.setLine(dstCol, r, "│")
		grid.set(dstCol, dstRow + 2, "▲")
		if (label) {
			const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
			grid.write(mid, srcRow - 1, truncate(label, dstCol - srcCol))
		}
		return
	}

	// Fallback for any other combination
	drawEdge(grid, srcCol, srcRow, dstCol, dstRow, label)
}

/**
 * Draw an orthogonal sequence-flow edge from a source exit point to a target
 * entry point, with an optional short label floated above the edge mid-point.
 *
 * `srcCol` — first column after the source element's right border.
 * `dstCol` — column of the target element's left border (arrow lands at dstCol-1).
 *
 * Routing strategy:
 *   • Same row  → direct horizontal  ──────►
 *   • Going down → right + turn-down + right  ──┐ / └──►
 *   • Going up   → right + turn-up   + right  ──┘ / ┌──►
 *   • Backward   → route above the diagram via row 0
 */
export function drawEdge(
	grid: AsciiGrid,
	srcCol: number,
	srcRow: number,
	dstCol: number,
	dstRow: number,
	label?: string,
): void {
	if (dstCol <= srcCol) {
		drawBackwardEdge(grid, srcCol, srcRow, dstCol, dstRow)
		return
	}

	if (srcRow === dstRow) {
		drawHorizontal(grid, srcCol, dstCol, srcRow, label)
		return
	}

	// L-shaped route: bend immediately after the source exit so that multiple
	// outgoing edges from the same element diverge right at the exit point,
	// producing clean ├ junctions rather than a shared horizontal segment.
	const midCol = srcCol + 1
	const goingDown = dstRow > srcRow

	// Horizontal leg: srcCol → midCol-1
	drawHorizontalSegment(grid, srcCol, midCol - 1, srcRow)

	// Turn at (midCol, srcRow)
	grid.setLine(midCol, srcRow, goingDown ? "┐" : "┘")

	// Vertical leg
	const rowLo = Math.min(srcRow, dstRow)
	const rowHi = Math.max(srcRow, dstRow)
	for (let r = rowLo + 1; r < rowHi; r++) {
		grid.setLine(midCol, r, "│")
	}

	// Turn at (midCol, dstRow)
	grid.setLine(midCol, dstRow, goingDown ? "└" : "┌")

	// Horizontal leg: midCol+1 → dstCol-2, then arrow
	drawHorizontalSegment(grid, midCol + 1, dstCol - 2, dstRow)
	grid.set(dstCol - 1, dstRow, "►")

	// Label: float above the first horizontal segment's midpoint
	if (label) {
		const labelCol = Math.floor((srcCol + midCol) / 2) - Math.floor(label.length / 2)
		grid.write(labelCol, srcRow - 1, truncate(label, midCol - srcCol))
	}
}

/** Draw a straight horizontal edge from srcCol to dstCol on the given row. */
function drawHorizontal(
	grid: AsciiGrid,
	srcCol: number,
	dstCol: number,
	row: number,
	label?: string,
): void {
	drawHorizontalSegment(grid, srcCol, dstCol - 2, row)
	grid.set(dstCol - 1, row, "►")

	if (label) {
		const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2)
		grid.write(mid, row - 1, truncate(label, dstCol - srcCol))
	}
}

/** Fill `─` characters from col `a` to col `b` inclusive on the given row.
 *  Uses setLine so characters merge correctly at junctions (e.g. ─+┐→┬, ─+│→┼). */
function drawHorizontalSegment(grid: AsciiGrid, a: number, b: number, row: number): void {
	for (let c = a; c <= b; c++) {
		grid.setLine(c, row, "─")
	}
}

/**
 * Backward (loop) edge: routes above the diagram (row 0) so it doesn't
 * collide with forward-direction elements.
 *
 * Route: go up from src to row 0, go left to dstCol, go down to dst.
 */
function drawBackwardEdge(
	grid: AsciiGrid,
	srcCol: number,
	srcRow: number,
	dstCol: number,
	dstRow: number,
): void {
	const routeRow = 0

	// Vertical up from srcRow to routeRow
	for (let r = routeRow + 1; r < srcRow; r++) {
		grid.setLine(srcCol, r, "│")
	}
	grid.setLine(srcCol, srcRow, "┘")
	grid.setLine(srcCol, routeRow, "┐")

	// Horizontal along routeRow from dstCol+1 to srcCol-1
	for (let c = dstCol + 1; c < srcCol; c++) {
		grid.setLine(c, routeRow, "─")
	}
	grid.setLine(dstCol, routeRow, "┌")

	// Vertical down from routeRow to dstRow
	for (let r = routeRow + 1; r < dstRow; r++) {
		grid.setLine(dstCol, r, "│")
	}
	grid.set(dstCol - 1, dstRow, "►")
}
