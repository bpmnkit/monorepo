import { Bpmn, GRID_CELL_HEIGHT, layoutFlowNodes } from "@bpmnkit/core"
import type { LayoutEdge, LayoutNode } from "@bpmnkit/core"
import { drawPortedEdge } from "./edges.js"
import { AsciiGrid } from "./grid.js"
import { CELL_H, CELL_W, drawElement, entryCol, exitCol, midCol } from "./shapes.js"
import type { RenderOptions } from "./types.js"

/**
 * Convert a node's pixel bounds to its ASCII mid-row (the middle of its 3-row box).
 *
 * The layout engine centers each element vertically within a GRID_CELL_HEIGHT-pixel
 * tall cell.  By recovering the cell's y-offset we get a stable ascii row index
 * regardless of element type, and the centering applied by `centerLayersVertically`
 * is preserved (e.g. a join node after 3 parallel branches appears in the middle).
 */
function nodeMidRow(node: LayoutNode): number {
	// Recover the cell's top y (element is centred inside its cell)
	const cellY = node.bounds.y + node.bounds.height / 2 - GRID_CELL_HEIGHT / 2
	// Scale from pixel rows to ASCII rows (CELL_H ascii rows per GRID_CELL_HEIGHT pixels)
	const asciiCellRow = Math.round((cellY / GRID_CELL_HEIGHT) * CELL_H)
	// midRow = cell top + vertical padding + 1 (same formula as the old elemRow+1)
	return asciiCellRow + Math.floor((CELL_H - 3) / 2) + 1
}

const GATEWAY_TYPES = new Set([
	"exclusiveGateway",
	"parallelGateway",
	"inclusiveGateway",
	"eventBasedGateway",
	"complexGateway",
])

/**
 * Render a BPMN XML string as a Unicode box-drawing ASCII diagram.
 *
 * Uses the same Sugiyama layout engine as the canvas renderer to position
 * elements, then maps each element to a fixed-size ASCII box and routes
 * sequence flows as orthogonal lines.
 */
export function renderBpmnAscii(xml: string, options?: RenderOptions): string {
	const defs = Bpmn.parse(xml)
	const process = defs.processes[0]
	if (!process) return "(empty)"

	// Use layoutFlowNodes directly to skip the overlap assertion — the ASCII renderer
	// re-scales pixel coords to character rows so pixel-level overlaps are harmless.
	const layout = layoutFlowNodes(process.flowElements, process.sequenceFlows)
	const { nodes, edges } = layout
	if (nodes.length === 0) return "(empty)"

	// Compute grid dimensions from the layout's layer extents and pixel bounds
	const maxLayer = Math.max(...nodes.map((n) => n.layer))
	const maxMidRow = Math.max(...nodes.map(nodeMidRow))
	const gridCols = (maxLayer + 1) * CELL_W + 4
	// Element bottom is at maxMidRow+1; leave CELL_H rows of padding below.
	const gridRows = maxMidRow + CELL_H + 1

	const grid = new AsciiGrid(gridCols, gridRows)

	// Build an id → node map for O(1) edge-endpoint look-up
	const nodeById = new Map<string, LayoutNode>()
	for (const node of nodes) nodeById.set(node.id, node)

	// Pre-compute port assignments for all edges
	const ports = computeEdgePorts(edges, nodeById)

	// Draw edges first so that shapes render on top of any edge overlap
	for (const edge of edges) {
		const src = nodeById.get(edge.sourceRef)
		const dst = nodeById.get(edge.targetRef)
		if (!src || !dst) continue

		const { srcPort, dstPort } = ports.get(edge.id) ?? { srcPort: "right", dstPort: "left" }

		drawPortedEdge(
			grid,
			srcPort === "right" ? exitCol(src.type, src.layer) : midCol(src.type, src.layer),
			nodeMidRow(src),
			srcPort,
			dstPort === "left" ? entryCol(dst.type, dst.layer) : midCol(dst.type, dst.layer),
			nodeMidRow(dst),
			dstPort,
			edge.label,
		)
	}

	// Draw element boxes on top
	for (const node of nodes) {
		drawElement(grid, node.type, node.layer, nodeMidRow(node) - 1, node.label)
	}

	const diagram = grid.toString()

	// Optional title header
	const title = resolveTitle(options, process.name)
	if (!title) return diagram

	const line = "─".repeat(title.length)
	return `${title}\n${line}\n\n${diagram}`
}

/** Pick the title string to show above the diagram (or undefined to suppress). */
function resolveTitle(
	options: RenderOptions | undefined,
	processName: string | undefined,
): string | undefined {
	if (options?.title === false) return undefined
	if (typeof options?.title === "string") return options.title
	return processName ?? undefined
}

type SrcPort = "right" | "top" | "bottom"
type DstPort = "left" | "top" | "bottom"

/**
 * Assign source and target ports for every edge.
 *
 * Source ports for gateway outgoing edges:
 *   N=1 → right
 *   N=2 → top, bottom
 *   N=3 → top, right (middle by target row), bottom
 *   N=4 → top, top, bottom, bottom
 *   N=5 → top, top, right, bottom, bottom  …and so on.
 *
 * Target ports are derived from the source port and relative positions:
 *   srcPort=top/bottom  → dstPort=left  (edge routes vertical then horizontal)
 *   srcPort=right, dst is gateway:
 *     source above dst → dstPort=top
 *     source below dst → dstPort=bottom
 *     same row         → dstPort=left
 *   all other targets  → dstPort=left
 */
function computeEdgePorts(
	edges: LayoutEdge[],
	nodeById: Map<string, LayoutNode>,
): Map<string, { srcPort: SrcPort; dstPort: DstPort }> {
	// ── Step 1: assign source ports ──────────────────────────────────────────
	const srcPorts = new Map<string, SrcPort>()

	// Collect forward gateway edges grouped by source
	const bySource = new Map<string, LayoutEdge[]>()
	for (const edge of edges) {
		const src = nodeById.get(edge.sourceRef)
		const dst = nodeById.get(edge.targetRef)
		// Back-edges (dst layer ≤ src layer) and non-gateway sources always exit right
		if (!src || !dst || !GATEWAY_TYPES.has(src.type) || dst.layer <= src.layer) {
			srcPorts.set(edge.id, "right")
			continue
		}
		const arr = bySource.get(edge.sourceRef) ?? []
		arr.push(edge)
		bySource.set(edge.sourceRef, arr)
	}

	for (const [, outgoing] of bySource) {
		const n = outgoing.length
		if (n === 1) {
			// biome-ignore lint/style/noNonNullAssertion: length=1 guarantees element
			srcPorts.set(outgoing[0]!.id, "right")
			continue
		}

		// Sort outgoing edges by their target's row position (ascending = topmost first)
		const sorted = [...outgoing].sort((a, b) => {
			const pa = nodeById.get(a.targetRef)?.position ?? 0
			const pb = nodeById.get(b.targetRef)?.position ?? 0
			return pa - pb
		})

		for (let i = 0; i < sorted.length; i++) {
			// biome-ignore lint/style/noNonNullAssertion: loop bounds guarantee element
			const edge = sorted[i]!
			let port: SrcPort
			if (n % 2 === 1) {
				// Odd: middle index → right, above → top, below → bottom
				const mid = Math.floor(n / 2)
				port = i < mid ? "top" : i === mid ? "right" : "bottom"
			} else {
				// Even: upper half → top, lower half → bottom (no right port)
				port = i < n / 2 ? "top" : "bottom"
			}
			srcPorts.set(edge.id, port)
		}
	}

	// ── Step 2: assign target ports ──────────────────────────────────────────
	const result = new Map<string, { srcPort: SrcPort; dstPort: DstPort }>()

	for (const edge of edges) {
		const srcPort = srcPorts.get(edge.id) ?? "right"
		let dstPort: DstPort = "left"

		// Top/bottom source ports route vertical-then-horizontal → always left entry.
		// Right source port into a gateway: entry side depends on relative row.
		if (srcPort === "right") {
			const src = nodeById.get(edge.sourceRef)
			const dst = nodeById.get(edge.targetRef)
			if (src && dst && GATEWAY_TYPES.has(dst.type)) {
				if (src.position < dst.position) dstPort = "top"
				else if (src.position > dst.position) dstPort = "bottom"
				// else same row → left (default)
			}
		}

		result.set(edge.id, { srcPort, dstPort })
	}

	return result
}
