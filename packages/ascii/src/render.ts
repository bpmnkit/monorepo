import { Bpmn, layoutProcess } from "@bpmn-sdk/core";
import type { LayoutNode } from "@bpmn-sdk/core";
import { drawEdge } from "./edges.js";
import { AsciiGrid } from "./grid.js";
import { CELL_H, CELL_W, drawElement, entryCol, exitCol, midRow } from "./shapes.js";
import type { RenderOptions } from "./types.js";

/**
 * Render a BPMN XML string as a Unicode box-drawing ASCII diagram.
 *
 * Uses the same Sugiyama layout engine as the canvas renderer to position
 * elements, then maps each element to a fixed-size ASCII box and routes
 * sequence flows as orthogonal lines.
 */
export function renderBpmnAscii(xml: string, options?: RenderOptions): string {
	const defs = Bpmn.parse(xml);
	const process = defs.processes[0];
	if (!process) return "(empty)";

	const layout = layoutProcess(process);
	const { nodes, edges } = layout;
	if (nodes.length === 0) return "(empty)";

	// Compute grid dimensions from the layout's layer/position extents
	const maxLayer = Math.max(...nodes.map((n) => n.layer));
	const maxPos = Math.max(...nodes.map((n) => n.position));
	// +2 padding on each axis, +1 because layers/positions are 0-indexed
	const gridCols = (maxLayer + 1) * CELL_W + 4;
	const gridRows = (maxPos + 1) * CELL_H + 4;

	const grid = new AsciiGrid(gridCols, gridRows);

	// Build an id → node map for O(1) edge-endpoint look-up
	const nodeById = new Map<string, LayoutNode>();
	for (const node of nodes) nodeById.set(node.id, node);

	// Draw edges first so that shapes render on top of any edge overlap
	for (const edge of edges) {
		const src = nodeById.get(edge.sourceRef);
		const dst = nodeById.get(edge.targetRef);
		if (!src || !dst) continue;

		drawEdge(
			grid,
			exitCol(src.type, src.layer),
			midRow(src.position),
			entryCol(dst.type, dst.layer),
			midRow(dst.position),
		);
	}

	// Draw element boxes on top
	for (const node of nodes) {
		drawElement(grid, node.type, node.layer, node.position, node.label);
	}

	const diagram = grid.toString();

	// Optional title header
	const title = resolveTitle(options, process.name);
	if (!title) return diagram;

	const line = "─".repeat(title.length);
	return `${title}\n${line}\n\n${diagram}`;
}

/** Pick the title string to show above the diagram (or undefined to suppress). */
function resolveTitle(
	options: RenderOptions | undefined,
	processName: string | undefined,
): string | undefined {
	if (options?.title === false) return undefined;
	if (typeof options?.title === "string") return options.title;
	return processName ?? undefined;
}
