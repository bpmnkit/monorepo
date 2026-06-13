/**
 * v3 layout — Step 8: assign virtual tracks (horizontal rows) and reposition nodes.
 *
 * Track assignment rules:
 *   - Main connector segments → track 0.
 *   - Gateway-pair groups: split/join stay on parent track.  Branches are sorted
 *     by element count (descending).  Most elements → same track as gateway.
 *     Second most → one track above (track - 1).  Third → one below (track + 1).
 *     Alternating above/below thereafter.  Already-used tracks are skipped.
 *   - Event-attachment paths (boundary / intermediate event forks): downstream
 *     nodes get the next available track below the main flow.
 *   - Boundary events themselves are NOT assigned a track; they are re-anchored
 *     to their host task after all other nodes are repositioned.
 *
 * Track height is fixed at TRACK_HEIGHT pixels.  All nodes are vertically
 * centered within their track.
 */
import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import { ELEMENT_SIZES } from "../types.js"
import type { FullLayout } from "./layout-full.js"
import type { NodeLayout } from "./layout-group.js"
import type { AtomicSegment, SegmentGroup } from "./types.js"

export const TRACK_HEIGHT = 160

export interface TrackBand {
	track: number
	y: number
	height: number
}

export interface TrackLayout {
	width: number
	height: number
	nodes: NodeLayout[]
	trackBands: TrackBand[]
	/** Track number used for back-edge (loop-back) nodes, or null if none. */
	backTrack: number | null
}

// ── Track assignment ───────────────────────────────────────────────────────────

function nodeSize(id: string, flowNodes: BpmnFlowElement[]): { width: number; height: number } {
	const n = flowNodes.find((f) => f.id === id)
	return n ? (ELEMENT_SIZES[n.type] ?? { width: 100, height: 80 }) : { width: 100, height: 80 }
}

/**
 * Count all interior nodes reachable from a segment, including those inside
 * child groups that are on this segment's branch.
 */
function countBranchElements(
	segId: string,
	parentGroup: SegmentGroup,
	allGroups: SegmentGroup[],
	segMap: Map<string, AtomicSegment>,
	groupMap: Map<string, SegmentGroup>,
): number {
	const seg = segMap.get(segId)
	if (!seg) return 0
	let count = seg.nodeIds.length

	// Add elements from any child group whose split is this segment's toId
	for (const childId of parentGroup.childGroupIds) {
		const child = groupMap.get(childId)
		if (!child?.splitId) continue
		if (seg.toId === child.splitId || seg.nodeIds.includes(child.splitId)) {
			for (const cSegId of child.segmentIds) {
				count += countBranchElements(cSegId, child, allGroups, segMap, groupMap)
			}
		}
	}

	return count
}

function processGatewayPairGroup(
	group: SegmentGroup,
	baseTrack: number,
	allGroups: SegmentGroup[],
	segMap: Map<string, AtomicSegment>,
	groupMap: Map<string, SegmentGroup>,
	nodeTrack: Map<string, number>,
	globalUsed: Set<number>,
): void {
	if (group.splitId) nodeTrack.set(group.splitId, baseTrack)
	if (group.joinId) nodeTrack.set(group.joinId, baseTrack)

	const branchSegs = group.segmentIds
		.map((id) => segMap.get(id))
		.filter((s): s is AtomicSegment => s !== undefined)
		.sort(
			(a, b) =>
				countBranchElements(b.id, group, allGroups, segMap, groupMap) -
				countBranchElements(a.id, group, allGroups, segMap, groupMap),
		)

	let above = baseTrack - 1
	let below = baseTrack + 1

	for (let i = 0; i < branchSegs.length; i++) {
		let branchTrack: number

		if (i === 0) {
			branchTrack = baseTrack
		} else if (i % 2 === 1) {
			while (globalUsed.has(above)) above--
			branchTrack = above
			above--
		} else {
			while (globalUsed.has(below)) below++
			branchTrack = below
			below++
		}

		globalUsed.add(branchTrack)

		const seg = branchSegs[i]
		if (!seg) continue
		for (const nid of seg.nodeIds) nodeTrack.set(nid, branchTrack)

		// Recurse into child groups on this branch
		for (const childId of group.childGroupIds) {
			const child = groupMap.get(childId)
			if (!child?.splitId) continue
			if (seg.toId === child.splitId || seg.nodeIds.includes(child.splitId)) {
				processGatewayPairGroup(
					child,
					branchTrack,
					allGroups,
					segMap,
					groupMap,
					nodeTrack,
					globalUsed,
				)
			}
		}
	}
}

function assignNodeTracks(
	groups: SegmentGroup[],
	segments: AtomicSegment[],
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): { nodeTrack: Map<string, number>; backTrack: number | null } {
	const nodeTrack = new Map<string, number>()
	const segMap = new Map(segments.map((s) => [s.id, s]))
	const groupMap = new Map(groups.map((g) => [g.id, g]))
	const ownedSegIds = new Set(groups.flatMap((g) => g.segmentIds))
	const childGroupIds = new Set(groups.flatMap((g) => g.childGroupIds))
	const boundaryEventIds = new Set(
		flowNodes.filter((n) => n.type === "boundaryEvent").map((n) => n.id),
	)

	const globalUsed = new Set<number>([0])

	// Connector segments (not owned by any group) → track 0
	for (const seg of segments) {
		if (ownedSegIds.has(seg.id)) continue
		for (const nid of seg.nodeIds) nodeTrack.set(nid, 0)
		if (seg.fromId && !boundaryEventIds.has(seg.fromId)) nodeTrack.set(seg.fromId, 0)
		if (seg.toId) nodeTrack.set(seg.toId, 0)
	}

	// Top-level gateway-pair groups
	for (const g of groups) {
		if (childGroupIds.has(g.id)) continue
		if (g.kind !== "gateway-pair") continue
		processGatewayPairGroup(g, 0, groups, segMap, groupMap, nodeTrack, globalUsed)
	}

	// Event-attachment groups: place downstream nodes on the next track below main flow
	// Multiple event-attachment paths share tracks if their X ranges don't conflict —
	// for simplicity, each group gets the next available track ≥ 1.
	let nextEventTrack = 1
	for (const g of groups) {
		if (g.kind !== "event-attachment") continue

		while (globalUsed.has(nextEventTrack)) nextEventTrack++
		const eventTrack = nextEventTrack
		globalUsed.add(eventTrack)

		for (const segId of g.segmentIds) {
			const seg = segMap.get(segId)
			if (!seg) continue
			for (const nid of seg.nodeIds) nodeTrack.set(nid, eventTrack)
			if (seg.toId) nodeTrack.set(seg.toId, eventTrack)
		}

		nextEventTrack++
	}

	// Back-edge source nodes: nodes that have at least one back-edge output but
	// no forward output (fwd-out = 0).  These loop-back nodes get a dedicated
	// track below all current tracks so the return arc is visually separated.
	const fwdOutDegree = new Map<string, number>()
	const hasBackOut = new Set<string>()
	for (const sf of sequenceFlows) {
		if (backEdgeIds.has(sf.id)) {
			hasBackOut.add(sf.sourceRef)
		} else {
			fwdOutDegree.set(sf.sourceRef, (fwdOutDegree.get(sf.sourceRef) ?? 0) + 1)
		}
	}

	let backTrack = nextEventTrack
	while (globalUsed.has(backTrack)) backTrack++

	let anyBack = false
	for (const fn of flowNodes) {
		if (fn.type === "boundaryEvent") continue
		if (nodeTrack.has(fn.id)) continue
		if ((fwdOutDegree.get(fn.id) ?? 0) === 0 && hasBackOut.has(fn.id)) {
			nodeTrack.set(fn.id, backTrack)
			anyBack = true
		}
	}
	if (anyBack) globalUsed.add(backTrack)

	return { nodeTrack, backTrack: anyBack ? backTrack : null }
}

// ── Main export ────────────────────────────────────────────────────────────────

export function layoutWithTracks(
	fullLayout: FullLayout,
	groups: SegmentGroup[],
	segments: AtomicSegment[],
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): TrackLayout {
	const { nodeTrack, backTrack } = assignNodeTracks(
		groups,
		segments,
		flowNodes,
		sequenceFlows,
		backEdgeIds,
	)

	const trackNums = [...new Set(nodeTrack.values())]
	const trackMin = trackNums.length > 0 ? Math.min(...trackNums) : 0
	const trackMax = trackNums.length > 0 ? Math.max(...trackNums) : 0

	const trackY = (t: number) => (t - trackMin) * TRACK_HEIGHT

	// Index full layout by id for quick lookup
	const fullNodes = new Map(fullLayout.nodes.map((n) => [n.id, n]))

	// Reposition non-boundary nodes using track Y
	const boundaryEventIds = new Set(
		flowNodes.filter((n) => n.type === "boundaryEvent").map((n) => n.id),
	)

	const placed = new Map<string, NodeLayout>()

	for (const nl of fullLayout.nodes) {
		if (boundaryEventIds.has(nl.id)) continue // handled below

		const track = nodeTrack.get(nl.id) ?? 0
		const cy = trackY(track) + TRACK_HEIGHT / 2
		placed.set(nl.id, { ...nl, y: cy - nl.height / 2 })
	}

	// Re-anchor boundary events to their (now re-tracked) host tasks
	for (const fn of flowNodes) {
		if (fn.type !== "boundaryEvent") continue
		const be = fn as BpmnBoundaryEvent
		const hostPlaced = placed.get(be.attachedToRef)
		const origBe = fullNodes.get(be.id)
		if (!origBe) continue

		if (hostPlaced) {
			placed.set(be.id, {
				id: be.id,
				x: hostPlaced.x + hostPlaced.width - origBe.width / 2,
				y: hostPlaced.y + hostPlaced.height - origBe.height / 2,
				width: origBe.width,
				height: origBe.height,
			})
		} else {
			placed.set(be.id, origBe)
		}
	}

	// ── S4: Center gateway branches around the split/join Y ──────────────────────
	// After track snapping, branches may be asymmetric around the gateway.
	// Shift all off-base-track branch nodes by the imbalance so the visual
	// midpoint of the branches aligns with the split/join center Y.
	// Only applied to top-level groups (not nested children — they're already
	// positioned within their parent branch's track band).
	{
		const segMap = new Map(segments.map((s) => [s.id, s]))
		const grpMap = new Map(groups.map((g) => [g.id, g]))
		const childGroupIds = new Set(groups.flatMap((g) => g.childGroupIds))

		const collectBranchCenters = (grp: SegmentGroup, baseTrack: number): number[] => {
			const centers: number[] = []
			for (const segId of grp.segmentIds) {
				const seg = segMap.get(segId)
				if (!seg) continue
				for (const nid of seg.nodeIds) {
					if ((nodeTrack.get(nid) ?? baseTrack) === baseTrack) continue
					const nl = placed.get(nid)
					if (nl) centers.push(nl.y + nl.height / 2)
				}
			}
			for (const childId of grp.childGroupIds) {
				const child = grpMap.get(childId)
				if (child) centers.push(...collectBranchCenters(child, baseTrack))
			}
			return centers
		}

		const shiftOffTrack = (grp: SegmentGroup, baseTrack: number, dy: number): void => {
			for (const segId of grp.segmentIds) {
				const seg = segMap.get(segId)
				if (!seg) continue
				for (const nid of seg.nodeIds) {
					if ((nodeTrack.get(nid) ?? baseTrack) === baseTrack) continue
					const nl = placed.get(nid)
					if (nl) placed.set(nid, { ...nl, y: nl.y + dy })
				}
				if (seg.toId && seg.toId !== grp.joinId) {
					const t = nodeTrack.get(seg.toId) ?? baseTrack
					if (t !== baseTrack) {
						const nl = placed.get(seg.toId)
						if (nl) placed.set(seg.toId, { ...nl, y: nl.y + dy })
					}
				}
			}
			for (const childId of grp.childGroupIds) {
				const child = grpMap.get(childId)
				if (child) shiftOffTrack(child, baseTrack, dy)
			}
		}

		for (const g of groups) {
			if (g.kind !== "gateway-pair") continue
			if (childGroupIds.has(g.id)) continue // nested groups center within their parent
			if (!g.splitId) continue

			const splitNl = placed.get(g.splitId)
			if (!splitNl) continue
			const baseTrack = nodeTrack.get(g.splitId) ?? 0
			const splitCY = splitNl.y + splitNl.height / 2

			const centers = collectBranchCenters(g, baseTrack)
			if (centers.length === 0) continue
			const branchMidY = (Math.min(...centers) + Math.max(...centers)) / 2
			const dy = splitCY - branchMidY
			if (Math.abs(dy) < TRACK_HEIGHT / 4) continue

			shiftOffTrack(g, baseTrack, dy)

			// Re-anchor boundary events on any shifted host.
			for (const fn of flowNodes) {
				if (fn.type !== "boundaryEvent") continue
				const be = fn as BpmnBoundaryEvent
				if ((nodeTrack.get(be.attachedToRef) ?? baseTrack) === baseTrack) continue
				const host = placed.get(be.attachedToRef)
				const beNl = placed.get(be.id)
				if (!host || !beNl) continue
				placed.set(be.id, { ...beNl, y: host.y + host.height - beNl.height / 2 })
			}
		}
	}

	const nodes = [...placed.values()]
	const width = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), 0)
	const height = (trackMax - trackMin + 1) * TRACK_HEIGHT

	const trackBands: TrackBand[] = []
	const trackNumSet = new Set([...trackNums])
	for (let t = trackMin; t <= trackMax; t++) {
		trackBands.push({ track: t, y: trackY(t), height: TRACK_HEIGHT })
	}

	return { width, height, nodes, trackBands, backTrack }
}
