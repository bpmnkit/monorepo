import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnLaneSet } from "../../bpmn/bpmn-model.js"
import type { Bounds } from "../types.js"
import { ELEMENT_SIZES } from "../types.js"
import type { BandLayout } from "./bands.js"
import type { SemanticGraph } from "./graph.js"

/** Geometry constants. Layout may add space beyond these; it never takes any back. */
export const H_GAP = 100
export const V_GAP = 80
export const COMPONENT_GAP = 80
export const LANE_PADDING = 40
export const BOUNDARY_SIZE = 36

const DEFAULT_SIZE = { width: 100, height: 80 }

export interface Placement {
	/** Absolute bounds per flow node, boundary events included. */
	bounds: Map<string, Bounds>
	/** Lane bands in top-to-bottom order, empty when the scope has no lanes. */
	lanes: Array<{ id: string; bounds: Bounds }>
	/**
	 * Mid-x of the empty gutter in front of each rank. Vertical runs belong
	 * here: placement never puts a shape in a gutter, so these lines are clear.
	 */
	gutterX: Map<number, number>
}

export function sizeOf(
	el: BpmnFlowElement,
	childExtent?: Bounds,
): { width: number; height: number } {
	if (childExtent) return { width: childExtent.width, height: childExtent.height }
	return ELEMENT_SIZES[el.type] ?? DEFAULT_SIZE
}

/**
 * Turn ranks and bands into coordinates.
 *
 * Ranks become columns sized by their widest node, bands become rows sized by
 * their tallest. Nodes are centred in both, so any two nodes sharing a band
 * share a centre line and the spine routes as one straight segment.
 */
export function place(
	graph: SemanticGraph,
	bandLayout: BandLayout,
	sizes: Map<string, { width: number; height: number }>,
	laneSet: BpmnLaneSet | undefined,
): Placement {
	const bounds = new Map<string, Bounds>()
	const componentOf = new Map<string, number>()
	for (let i = 0; i < graph.components.length; i++) {
		for (const id of graph.components[i] ?? []) componentOf.set(id, i)
	}

	// ── Columns: one per rank, shared across components so flow stays aligned ──
	const colWidth = new Map<number, number>()
	for (const node of graph.nodes) {
		const rank = graph.ranks.get(node.id) ?? 0
		const size = sizes.get(node.id) ?? DEFAULT_SIZE
		colWidth.set(rank, Math.max(colWidth.get(rank) ?? 0, size.width))
	}
	const colX = new Map<number, number>()
	const gutterX = new Map<number, number>()
	let x = 0
	for (const rank of [...colWidth.keys()].sort((a, b) => a - b)) {
		colX.set(rank, x)
		gutterX.set(rank, x - H_GAP / 2)
		x += (colWidth.get(rank) ?? 0) + H_GAP
	}

	// ── Rows: one per band, laid out per component then stacked ──
	let cursorY = 0
	for (let component = 0; component < graph.components.length; component++) {
		const members = (graph.components[component] ?? []).filter((id) => graph.byId.has(id))
		if (members.length === 0) continue

		const rowHeight = new Map<number, number>()
		for (const id of members) {
			const band = bandLayout.bands.get(id) ?? 0
			const size = sizes.get(id) ?? DEFAULT_SIZE
			rowHeight.set(band, Math.max(rowHeight.get(band) ?? 0, size.height))
		}
		const rowY = new Map<number, number>()
		let y = cursorY
		for (const band of [...rowHeight.keys()].sort((a, b) => a - b)) {
			rowY.set(band, y)
			y += (rowHeight.get(band) ?? 0) + V_GAP
		}

		for (const id of members) {
			const size = sizes.get(id) ?? DEFAULT_SIZE
			const rank = graph.ranks.get(id) ?? 0
			const band = bandLayout.bands.get(id) ?? 0
			const cw = colWidth.get(rank) ?? size.width
			const rh = rowHeight.get(band) ?? size.height
			bounds.set(id, {
				x: (colX.get(rank) ?? 0) + (cw - size.width) / 2,
				y: (rowY.get(band) ?? 0) + (rh - size.height) / 2,
				width: size.width,
				height: size.height,
			})
		}

		cursorY = y - V_GAP + COMPONENT_GAP
	}

	separateSameCell(graph, bandLayout, bounds)
	const lanes = laneSet ? applyLanes(graph, laneSet, bounds) : []
	dockBoundaryEvents(graph, bounds)
	return { bounds, lanes, gutterX }
}

/**
 * Two nodes can land in the same rank and band — a parallel split whose
 * branches were compacted onto one band, for instance. Push the later ones
 * down in declaration order until the cell is clear.
 */
function separateSameCell(
	graph: SemanticGraph,
	bandLayout: BandLayout,
	bounds: Map<string, Bounds>,
): void {
	const componentOf = new Map<string, number>()
	for (let i = 0; i < graph.components.length; i++) {
		for (const id of graph.components[i] ?? []) componentOf.set(id, i)
	}

	// Scoped per component: components occupy their own vertical space already,
	// so two nodes sharing a rank and band across components do not collide.
	const cells = new Map<string, string[]>()
	for (const node of graph.nodes) {
		const rank = graph.ranks.get(node.id) ?? 0
		const band = bandLayout.bands.get(node.id) ?? 0
		const key = `${componentOf.get(node.id) ?? 0}:${rank}:${band}`
		const list = cells.get(key)
		if (list) list.push(node.id)
		else cells.set(key, [node.id])
	}

	for (const ids of cells.values()) {
		if (ids.length < 2) continue
		let offset = 0
		for (const id of ids) {
			const b = bounds.get(id)
			if (!b) continue
			b.y += offset
			offset += b.height + V_GAP
		}
	}
}

/**
 * Move every node into the lane it belongs to, then size the lanes to their
 * content. Ranks are untouched, so left-to-right flow survives the shift.
 *
 * Nested lane sets keep both levels: leaf lanes take a band each, and an
 * ancestor lane spans the bands of its descendants.
 */
function applyLanes(
	graph: SemanticGraph,
	laneSet: BpmnLaneSet,
	bounds: Map<string, Bounds>,
): Array<{ id: string; bounds: Bounds }> {
	const tree = laneTree(laneSet)
	if (tree.length === 0) return []

	const leaves: LaneNode[] = []
	const collectLeaves = (nodes: LaneNode[]): void => {
		for (const node of nodes) {
			if (node.children.length > 0) collectLeaves(node.children)
			else leaves.push(node)
		}
	}
	collectLeaves(tree)

	const laneOf = new Map<string, LaneNode>()
	for (const leaf of leaves) {
		for (const ref of leaf.refs) laneOf.set(ref, leaf)
	}

	const members = new Map<string, string[]>()
	for (const leaf of leaves) members.set(leaf.id, [])
	const orphans: string[] = []
	for (const node of graph.nodes) {
		const lane = laneOf.get(node.id)
		const list = lane ? members.get(lane.id) : undefined
		if (list) list.push(node.id)
		else orphans.push(node.id)
	}

	let minX = Number.POSITIVE_INFINITY
	let maxX = Number.NEGATIVE_INFINITY
	for (const b of bounds.values()) {
		minX = Math.min(minX, b.x)
		maxX = Math.max(maxX, b.x + b.width)
	}
	if (!Number.isFinite(minX)) return []

	const width = maxX - minX + 2 * LANE_PADDING
	const left = minX - LANE_PADDING
	const span = new Map<string, { top: number; bottom: number }>()
	let top = 0

	for (const leaf of leaves) {
		const own = (members.get(leaf.id) ?? [])
			.map((n) => bounds.get(n))
			.filter((b): b is Bounds => b !== undefined)
		let height = 2 * LANE_PADDING + BOUNDARY_SIZE
		if (own.length > 0) {
			const lowest = Math.min(...own.map((b) => b.y))
			height = Math.max(...own.map((b) => b.y + b.height)) - lowest + 2 * LANE_PADDING
			const shift = top + LANE_PADDING - lowest
			for (const b of own) b.y += shift
		}
		span.set(leaf.id, { top, bottom: top + height })
		top += height
	}

	// Unclaimed nodes keep a band of their own rather than being attributed to a
	// lane they are not a member of.
	if (orphans.length > 0) {
		const own = orphans.map((n) => bounds.get(n)).filter((b): b is Bounds => b !== undefined)
		if (own.length > 0) {
			const shift = top + LANE_PADDING - Math.min(...own.map((b) => b.y))
			for (const b of own) b.y += shift
		}
	}

	const slots: Array<{ id: string; bounds: Bounds }> = []
	const emit = (nodes: LaneNode[]): { top: number; bottom: number } | null => {
		let extent: { top: number; bottom: number } | null = null
		for (const node of nodes) {
			const own = node.children.length > 0 ? emit(node.children) : (span.get(node.id) ?? null)
			if (!own) continue
			if (node.children.length > 0) span.set(node.id, own)
			slots.push({
				id: node.id,
				bounds: { x: left, y: own.top, width, height: own.bottom - own.top },
			})
			extent = extent
				? { top: Math.min(extent.top, own.top), bottom: Math.max(extent.bottom, own.bottom) }
				: own
		}
		return extent
	}
	emit(tree)

	// Outermost first, so a parent lane is drawn behind the lanes it contains.
	return slots.sort((a, b) => b.bounds.height - a.bounds.height || a.bounds.y - b.bounds.y)
}

interface LaneNode {
	id: string
	refs: string[]
	children: LaneNode[]
}

function laneTree(laneSet: BpmnLaneSet): LaneNode[] {
	return laneSet.lanes.map((lane) => ({
		id: lane.id,
		refs: lane.flowNodeRefs,
		children: lane.childLaneSet ? laneTree(lane.childLaneSet) : [],
	}))
}

/**
 * Dock boundary events on their host's edge — escalation on top, everything
 * else on the bottom — spread along it. Events sharing a side are ordered by
 * how far their handler runs, longest first, so long paths get the outer slot.
 */
function dockBoundaryEvents(graph: SemanticGraph, bounds: Map<string, Bounds>): void {
	for (const [hostId, events] of graph.attachers) {
		const host = bounds.get(hostId)
		if (!host) continue

		const sides = new Map<"top" | "bottom", BpmnBoundaryEvent[]>()
		for (const event of events) {
			const side = event.eventDefinitions.some((d) => d.type === "escalation") ? "top" : "bottom"
			const list = sides.get(side)
			if (list) list.push(event)
			else sides.set(side, [event])
		}

		for (const [side, list] of sides) {
			const ordered = [...list].sort(
				(a, b) => handlerReach(graph, b.id) - handlerReach(graph, a.id),
			)
			const n = ordered.length
			for (let i = 0; i < n; i++) {
				const event = ordered[i]
				if (!event) continue
				bounds.set(event.id, {
					x: host.x + ((i + 1) * host.width) / (n + 1) - BOUNDARY_SIZE / 2,
					y: (side === "top" ? host.y : host.y + host.height) - BOUNDARY_SIZE / 2,
					width: BOUNDARY_SIZE,
					height: BOUNDARY_SIZE,
				})
			}
		}
	}
}

/** How far the handler of a boundary event runs, in ranks. */
function handlerReach(graph: SemanticGraph, eventId: string): number {
	let reach = 0
	for (const [, flows] of graph.outgoing) {
		for (const flow of flows) {
			if (flow.sourceRef !== eventId) continue
			reach = Math.max(reach, graph.ranks.get(flow.targetRef) ?? 0)
		}
	}
	return reach
}
