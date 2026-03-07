import type { AsciiGrid } from "./grid.js";
import { truncate } from "./util.js";

// ── Layout constants ────────────────────────────────────────────────────────

/** Total character width of a task box (including the two │ borders). */
export const TASK_W = 24;
/** Total character width of an event compact box (including borders). */
export const ELEM_W = 11;
/**
 * Total character width of a gateway box (including the two border chars).
 * Narrower than event boxes; corners use / and \ to suggest a rotated square.
 *
 * /───────\
 * │ × Lbl │
 * \───────/
 */
export const GATEWAY_W = 9;
/** Character width of one logical grid cell (one Sugiyama layer). */
export const CELL_W = 28;
/** Character height of one logical grid cell (one Sugiyama position). */
export const CELL_H = 8;

// Derived inner widths (space available for content inside the borders)
const TASK_INNER = TASK_W - 2; // 22
const ELEM_INNER = ELEM_W - 2; // 9

// ── Element classification ──────────────────────────────────────────────────

function isTaskLike(type: string): boolean {
	return (
		type === "task" ||
		type === "serviceTask" ||
		type === "userTask" ||
		type === "scriptTask" ||
		type === "sendTask" ||
		type === "receiveTask" ||
		type === "businessRuleTask" ||
		type === "manualTask" ||
		type === "callActivity" ||
		type === "subProcess" ||
		type === "adHocSubProcess" ||
		type === "eventSubProcess" ||
		type === "transaction"
	);
}

function isGateway(type: string): boolean {
	return (
		type === "exclusiveGateway" ||
		type === "parallelGateway" ||
		type === "inclusiveGateway" ||
		type === "eventBasedGateway" ||
		type === "complexGateway"
	);
}

// ── Label / marker helpers ──────────────────────────────────────────────────

/** Short type tag prepended to task content, e.g. "[svc] ". */
function taskTag(type: string): string {
	switch (type) {
		case "serviceTask":
			return "[svc] ";
		case "userTask":
			return "[usr] ";
		case "scriptTask":
			return "[scr] ";
		case "sendTask":
			return "[snd] ";
		case "receiveTask":
			return "[rcv] ";
		case "businessRuleTask":
			return "[dmn] ";
		case "manualTask":
			return "[man] ";
		case "callActivity":
			return "[cal] ";
		case "subProcess":
		case "adHocSubProcess":
		case "eventSubProcess":
			return "[sub] ";
		case "transaction":
			return "[txn] ";
		default:
			return "";
	}
}

/** Single Unicode marker shown inside an event or gateway shape. */
function elementMarker(type: string): string {
	switch (type) {
		case "startEvent":
			return "○";
		case "endEvent":
			return "●";
		case "intermediateCatchEvent":
			return "◎";
		case "intermediateThrowEvent":
			return "◉";
		case "boundaryEvent":
			return "◈";
		case "exclusiveGateway":
			return "×";
		case "parallelGateway":
			return "+";
		case "inclusiveGateway":
			return "◇";
		case "eventBasedGateway":
			return "?";
		case "complexGateway":
			return "✱";
		default:
			return "·";
	}
}

// ── Position helpers ────────────────────────────────────────────────────────

/** Width of the element drawn for this type. */
function elemW(type: string): number {
	if (isTaskLike(type)) return TASK_W;
	if (isGateway(type)) return GATEWAY_W;
	return ELEM_W;
}

/** Top-left column of an element within its cell. */
export function elemCol(type: string, layer: number): number {
	return layer * CELL_W + Math.floor((CELL_W - elemW(type)) / 2);
}

/** Top-left row of a task or event element within its cell (3 rows tall). */
export function elemRow(position: number): number {
	// Centre the 3-row element vertically within the cell
	return position * CELL_H + Math.floor((CELL_H - 3) / 2);
}

/**
 * Column of the right exit connection point (first column AFTER the element's
 * right border — where an outgoing edge begins).
 */
export function exitCol(type: string, layer: number): number {
	return elemCol(type, layer) + elemW(type);
}

/**
 * Column of the left entry connection point (the column OF the element's left
 * border — where an incoming edge arrow lands just before it).
 */
export function entryCol(type: string, layer: number): number {
	return elemCol(type, layer);
}

/** Row of the horizontal mid-point (used as the connection row for edges). */
export function midRow(position: number): number {
	return elemRow(position) + 1; // middle of the 3-row element
}

// ── Drawing ─────────────────────────────────────────────────────────────────

/** Draw any BPMN element onto the grid at its logical (layer, position). */
export function drawElement(
	grid: AsciiGrid,
	type: string,
	layer: number,
	position: number,
	label: string | undefined,
): void {
	const col = elemCol(type, layer);
	const name = label ?? "";

	if (isTaskLike(type)) {
		drawTaskBox(grid, col, elemRow(position), name, type);
	} else if (isGateway(type)) {
		drawGatewayBox(grid, col, elemRow(position), name, elementMarker(type));
	} else {
		drawCompactBox(grid, col, elemRow(position), name, elementMarker(type));
	}
}

/**
 * Rectangular task box — 3 rows tall, TASK_W wide.
 *
 * ┌──────────────────────┐
 * │ [tag] Label…         │
 * └──────────────────────┘
 */
function drawTaskBox(grid: AsciiGrid, col: number, row: number, label: string, type: string): void {
	const inner = TASK_INNER;

	// Top border
	grid.set(col, row, "┌");
	grid.write(col + 1, row, "─".repeat(inner));
	grid.set(col + inner + 1, row, "┐");

	// Middle row
	grid.set(col, row + 1, "│");
	const tag = taskTag(type);
	const content = truncate(tag + label, inner - 1); // -1 for leading space
	grid.write(col + 1, row + 1, ` ${content}`);
	grid.set(col + inner + 1, row + 1, "│");

	// Bottom border
	grid.set(col, row + 2, "└");
	grid.write(col + 1, row + 2, "─".repeat(inner));
	grid.set(col + inner + 1, row + 2, "┘");
}

/**
 * Compact rounded box for events — 3 rows tall, ELEM_W wide.
 *
 * ╭─────────╮
 * │ ○ Label │
 * ╰─────────╯
 */
function drawCompactBox(
	grid: AsciiGrid,
	col: number,
	row: number,
	label: string,
	marker: string,
): void {
	const inner = ELEM_INNER;

	// Top border (rounded)
	grid.set(col, row, "╭");
	grid.write(col + 1, row, "─".repeat(inner));
	grid.set(col + inner + 1, row, "╮");

	// Middle row: marker + label
	grid.set(col, row + 1, "│");
	const content = truncate(`${marker} ${label}`, inner - 1); // -1 for leading space
	grid.write(col + 1, row + 1, ` ${content}`);
	grid.set(col + inner + 1, row + 1, "│");

	// Bottom border (rounded)
	grid.set(col, row + 2, "╰");
	grid.write(col + 1, row + 2, "─".repeat(inner));
	grid.set(col + inner + 1, row + 2, "╯");
}

/**
 * Gateway box — 3 rows tall, GATEWAY_W wide. Diagonal / \ corners suggest a
 * rotated square. Marker + label shown inside.
 *
 * /─────────\
 * │ × Label │
 * \─────────/
 */
function drawGatewayBox(
	grid: AsciiGrid,
	col: number,
	row: number,
	label: string,
	marker: string,
): void {
	const inner = GATEWAY_W - 2;

	grid.set(col, row, "/");
	grid.write(col + 1, row, "─".repeat(inner));
	grid.set(col + inner + 1, row, "\\");

	grid.set(col, row + 1, "│");
	const content = truncate(`${marker} ${label}`, inner - 1); // -1 for leading space
	grid.write(col + 1, row + 1, ` ${content}`);
	grid.set(col + inner + 1, row + 1, "│");

	grid.set(col, row + 2, "\\");
	grid.write(col + 1, row + 2, "─".repeat(inner));
	grid.set(col + inner + 1, row + 2, "/");
}
