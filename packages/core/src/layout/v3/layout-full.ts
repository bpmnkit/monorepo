/**
 * v3 layout — Step 7: assemble all groups at their process positions.
 *
 * Four-phase placement:
 *   Phase 1 — gateway-pair GROUP placements.  Split/join gateways and interior
 *             task nodes are anchored at their process offsets.  Child groups are
 *             placed recursively, anchored to the last placed interior node of
 *             the parent branch that leads to the child split.
 *   Phase 2 — connector SEGMENT placements.  Interior nodes (nodeIds) start at
 *             pl.x when their fromId is already placed (owned by a group), or at
 *             pl.x + fromSize + NODE_GAP when fromId is an unowned junction (e.g.
 *             a start event).  After interior nodes, any unowned toId is appended.
 *   Phase 3 — event-attachment GROUP placements.  Host tasks are already in
 *             `placed` (by Phase 1 or Phase 2).  Boundary/intermediate events and
 *             their downstream nodes are positioned relative to the host task's
 *             actual coordinates.  Must run last so host position is authoritative.
 *   Phase 4 — fallback for any remaining unplaced nodes (e.g. back-edge dead-end
 *             tasks, orphan junctions).  Each is placed to the right of its
 *             rightmost placed forward predecessor.
 */
import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import { ELEMENT_SIZES } from "../types.js"
import type { GroupLayout, NodeLayout } from "./layout-group.js"
import type { ProcessLayout } from "./layout-process.js"
import type { AtomicSegment, SegmentGroup } from "./types.js"

const NODE_GAP = 40

export interface FullLayout {
	width: number
	height: number
	nodes: NodeLayout[]
}

// ── Child group placement ──────────────────────────────────────────────────────

/**
 * Recursively place child gateway-pair groups.  For each child group whose
 * split has not yet been placed, find the last placed interior node of the
 * parent branch segment that leads to the child split and anchor the child
 * group layout there.
 */
function placeChildGroups(
	grp: SegmentGroup,
	placed: Map<string, NodeLayout>,
	groupLayouts: Map<string, GroupLayout>,
	groupMap: Map<string, SegmentGroup>,
	segMap: Map<string, AtomicSegment>,
): void {
	for (const childId of grp.childGroupIds) {
		const child = groupMap.get(childId)
		const childGl = groupLayouts.get(childId)
		if (!child || !childGl || !child.splitId) continue

		if (!placed.has(child.splitId)) {
			// Locate the parent branch segment whose toId === child.splitId
			let anchorX: number | undefined
			let anchorCY: number | undefined

			for (const segId of grp.segmentIds) {
				const seg = segMap.get(segId)
				if (!seg || seg.toId !== child.splitId) continue

				if (seg.nodeIds.length > 0) {
					const lastId = seg.nodeIds[seg.nodeIds.length - 1]
					const lastPlaced = lastId ? placed.get(lastId) : undefined
					if (lastPlaced) {
						anchorX = lastPlaced.x + lastPlaced.width + NODE_GAP
						anchorCY = lastPlaced.y + lastPlaced.height / 2
					}
				} else if (seg.fromId) {
					const fromPlaced = placed.get(seg.fromId)
					if (fromPlaced) {
						anchorX = fromPlaced.x + fromPlaced.width + NODE_GAP
						anchorCY = fromPlaced.y + fromPlaced.height / 2
					}
				}
				break
			}

			if (anchorX !== undefined && anchorCY !== undefined) {
				// Compute where the split sits vertically within the child group layout
				const splitInLayout = childGl.nodes.find((n) => n.id === child.splitId)
				const splitCenterYInLayout = splitInLayout
					? splitInLayout.y + splitInLayout.height / 2
					: childGl.height / 2

				const offsetX = anchorX
				const offsetY = anchorCY - splitCenterYInLayout

				for (const nl of childGl.nodes) {
					if (!placed.has(nl.id)) {
						placed.set(nl.id, {
							id: nl.id,
							x: offsetX + nl.x,
							y: offsetY + nl.y,
							width: nl.width,
							height: nl.height,
						})
					}
				}
			}
		}

		// Always recurse for grandchild groups
		placeChildGroups(child, placed, groupLayouts, groupMap, segMap)
	}
}

// ── Main export ────────────────────────────────────────────────────────────────

export function assembleFullLayout(
	processLayout: ProcessLayout,
	groupLayouts: Map<string, GroupLayout>,
	segments: AtomicSegment[],
	flowNodes: BpmnFlowElement[],
	groups: SegmentGroup[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
	sizeOverrides?: Map<string, { width: number; height: number }>,
): FullLayout {
	const placed = new Map<string, NodeLayout>()
	const nodeMap = new Map(flowNodes.map((n) => [n.id, n]))
	const segMap = new Map(segments.map((s) => [s.id, s]))
	const groupMap = new Map(groups.map((g) => [g.id, g]))

	function nodeSize(id: string): { width: number; height: number } {
		const n = nodeMap.get(id)
		return (
			sizeOverrides?.get(id) ??
			(n ? (ELEMENT_SIZES[n.type] ?? { width: 100, height: 80 }) : { width: 100, height: 80 })
		)
	}

	function placeNode(id: string, x: number, y: number): void {
		if (placed.has(id)) return
		const sz = nodeSize(id)
		placed.set(id, { id, x, y: y - sz.height / 2, width: sz.width, height: sz.height })
	}

	// ── Phase 1: gateway-pair groups ──────────────────────────────────────────────
	for (const pl of processLayout.placements) {
		if (pl.kind !== "group") continue
		const grp = groupMap.get(pl.id)
		if (grp?.kind !== "gateway-pair") continue
		const gl = groupLayouts.get(pl.id)
		if (!gl) continue
		for (const nl of gl.nodes) {
			if (!placed.has(nl.id)) {
				placed.set(nl.id, {
					id: nl.id,
					x: pl.x + nl.x,
					y: pl.y + nl.y,
					width: nl.width,
					height: nl.height,
				})
			}
		}
		// Place child groups recursively, anchored to the placed parent branch nodes
		placeChildGroups(grp, placed, groupLayouts, groupMap, segMap)
	}

	// ── Phase 2: connector segments ───────────────────────────────────────────────
	for (const pl of processLayout.placements) {
		if (pl.kind !== "segment") continue
		const seg = segMap.get(pl.id)
		if (!seg) continue
		const cy = pl.y + pl.height / 2

		// fromId: place it at pl.x only if it wasn't already placed by a group.
		// Advance nx past it only in that case.
		let nx = pl.x
		if (seg.fromId !== null) {
			if (!placed.has(seg.fromId)) {
				placeNode(seg.fromId, pl.x, cy)
				nx = pl.x + nodeSize(seg.fromId).width + NODE_GAP
			}
			// If already placed (owned junction): interior nodes start at pl.x
		}

		for (const nid of seg.nodeIds) {
			const sz = nodeSize(nid)
			placed.set(nid, { id: nid, x: nx, y: cy - sz.height / 2, width: sz.width, height: sz.height })
			nx += sz.width + NODE_GAP
		}

		// toId: append after interior nodes only if unowned
		if (seg.toId !== null && !placed.has(seg.toId)) {
			placeNode(seg.toId, nx, cy)
		}
	}

	// ── Phase 3: event-attachment groups ──────────────────────────────────────────
	// Iterate groups directly (event-attachment groups are not in processLayout).
	// Host tasks are now in `placed` (from Phase 1 or 2).  Place boundary events
	// and downstream nodes relative to the host task's authoritative position.
	// In the group layout, the host is at (0,0), so each node's (nl.x, nl.y) is
	// its offset from the host origin — translate directly.
	for (const grp of groups) {
		if (grp.kind !== "event-attachment") continue
		const gl = groupLayouts.get(grp.id)
		if (!gl) continue

		const hostId = grp.hostNodeId
		const hostPlaced = hostId ? placed.get(hostId) : undefined

		for (const nl of gl.nodes) {
			if (placed.has(nl.id)) continue
			if (nl.id === hostId) continue

			if (hostPlaced) {
				placed.set(nl.id, {
					id: nl.id,
					x: hostPlaced.x + nl.x,
					y: hostPlaced.y + nl.y,
					width: nl.width,
					height: nl.height,
				})
			} else {
				// No host found — fall back to positioning at end of canvas
				const nx =
					[...placed.values()].reduce((acc, n) => Math.max(acc, n.x + n.width), 0) + NODE_GAP
				placed.set(nl.id, {
					id: nl.id,
					x: nx + nl.x,
					y: nl.y,
					width: nl.width,
					height: nl.height,
				})
			}
		}
	}

	// ── Phase 3b: Orphaned boundary events ───────────────────────────────────────
	// Boundary events with no event-attachment group (e.g. when their sole
	// outgoing edge goes directly to another junction, producing no segment) are
	// not handled by Phase 3.  Anchor them to their host task's bottom-right edge.
	for (const fn of flowNodes) {
		if (fn.type !== "boundaryEvent") continue
		if (placed.has(fn.id)) continue
		const be = fn as BpmnBoundaryEvent
		const host = placed.get(be.attachedToRef)
		if (!host) continue
		const beSz = nodeSize(fn.id)
		placed.set(fn.id, {
			id: fn.id,
			x: host.x + host.width - beSz.width / 2,
			y: host.y + host.height - beSz.height / 2,
			width: beSz.width,
			height: beSz.height,
		})
	}

	// ── Phase 4: fallback for uncovered nodes ─────────────────────────────────────
	// Nodes not placed by phases 1-3 (e.g. back-edge dead-end tasks, orphan
	// junctions with no interior segment) are placed to the right of their
	// rightmost placed forward predecessor.  Iterate until no more progress.
	let progress = true
	while (progress) {
		progress = false
		for (const fn of flowNodes) {
			if (placed.has(fn.id)) continue
			if (fn.type === "boundaryEvent") continue

			let bestX = Number.NEGATIVE_INFINITY
			let bestCY = 0
			for (const sf of sequenceFlows) {
				if (sf.targetRef !== fn.id || backEdgeIds.has(sf.id)) continue
				const pred = placed.get(sf.sourceRef)
				if (!pred) continue
				const rx = pred.x + pred.width
				if (rx > bestX) {
					bestX = rx
					bestCY = pred.y + pred.height / 2
				}
			}

			if (bestX === Number.NEGATIVE_INFINITY) continue

			const sz = nodeSize(fn.id)
			placed.set(fn.id, {
				id: fn.id,
				x: bestX + NODE_GAP,
				y: bestCY - sz.height / 2,
				width: sz.width,
				height: sz.height,
			})
			progress = true
		}
	}

	const nodes = [...placed.values()]
	const width = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 0)
	const height = nodes.reduce((acc, n) => Math.max(acc, n.y + n.height), 0)
	return { width, height, nodes }
}
