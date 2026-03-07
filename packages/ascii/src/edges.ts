import type { AsciiGrid } from "./grid.js";
import { truncate } from "./util.js";

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
		drawBackwardEdge(grid, srcCol, srcRow, dstCol, dstRow);
		return;
	}

	if (srcRow === dstRow) {
		drawHorizontal(grid, srcCol, dstCol, srcRow, label);
		return;
	}

	// L-shaped route: bend immediately after the source exit so that multiple
	// outgoing edges from the same element diverge right at the exit point,
	// producing clean ├ junctions rather than a shared horizontal segment.
	const midCol = srcCol + 1;
	const goingDown = dstRow > srcRow;

	// Horizontal leg: srcCol → midCol-1
	drawHorizontalSegment(grid, srcCol, midCol - 1, srcRow);

	// Turn at (midCol, srcRow)
	grid.setLine(midCol, srcRow, goingDown ? "┐" : "┘");

	// Vertical leg
	const rowLo = Math.min(srcRow, dstRow);
	const rowHi = Math.max(srcRow, dstRow);
	for (let r = rowLo + 1; r < rowHi; r++) {
		grid.setLine(midCol, r, "│");
	}

	// Turn at (midCol, dstRow)
	grid.setLine(midCol, dstRow, goingDown ? "└" : "┌");

	// Horizontal leg: midCol+1 → dstCol-2, then arrow
	drawHorizontalSegment(grid, midCol + 1, dstCol - 2, dstRow);
	grid.set(dstCol - 1, dstRow, "►");

	// Label: float above the first horizontal segment's midpoint
	if (label) {
		const labelCol = Math.floor((srcCol + midCol) / 2) - Math.floor(label.length / 2);
		grid.write(labelCol, srcRow - 1, truncate(label, midCol - srcCol));
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
	drawHorizontalSegment(grid, srcCol, dstCol - 2, row);
	grid.set(dstCol - 1, row, "►");

	if (label) {
		const mid = Math.floor((srcCol + dstCol) / 2) - Math.floor(label.length / 2);
		grid.write(mid, row - 1, truncate(label, dstCol - srcCol));
	}
}

/** Fill `─` characters from col `a` to col `b` inclusive on the given row.
 *  Uses setLine so characters merge correctly at junctions (e.g. ─+┐→┬, ─+│→┼). */
function drawHorizontalSegment(grid: AsciiGrid, a: number, b: number, row: number): void {
	for (let c = a; c <= b; c++) {
		grid.setLine(c, row, "─");
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
	const routeRow = 0;

	// Vertical up from srcRow to routeRow
	for (let r = routeRow + 1; r < srcRow; r++) {
		grid.setLine(srcCol, r, "│");
	}
	grid.setLine(srcCol, srcRow, "┘");
	grid.setLine(srcCol, routeRow, "┐");

	// Horizontal along routeRow from dstCol+1 to srcCol-1
	for (let c = dstCol + 1; c < srcCol; c++) {
		grid.setLine(c, routeRow, "─");
	}
	grid.setLine(dstCol, routeRow, "┌");

	// Vertical down from routeRow to dstRow
	for (let r = routeRow + 1; r < dstRow; r++) {
		grid.setLine(dstCol, r, "│");
	}
	grid.set(dstCol - 1, dstRow, "►");
}
