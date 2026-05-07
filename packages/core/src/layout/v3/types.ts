/**
 * v3 layout engine — types.
 *
 * The v3 engine works bottom-up: it first identifies atomic segments that can
 * be laid out independently, computes their intrinsic dimensions, then composes
 * them into the final diagram.
 */

// ── Segment groups ────────────────────────────────────────────────────────────

/**
 * A group that owns a set of segments and optionally nests child groups.
 *
 * gateway-pair    — segments flowing between a split and its matching join.
 * event-attachment — segment(s) triggered by a boundary / intermediate event
 *                    attached to a specific host node.
 */
export type SegmentGroupKind = "gateway-pair" | "event-attachment"

export interface SegmentGroup {
	id: string
	kind: SegmentGroupKind
	/** Ordered segment IDs that are direct members of this group. */
	segmentIds: string[]
	/** Nested child group IDs (gateway pairs or event paths inside this group). */
	childGroupIds: string[]
	// gateway-pair fields:
	splitId?: string
	joinId?: string
	// event-attachment fields:
	hostNodeId?: string  // the task/activity the event is attached to
	eventNodeId?: string // the boundary or intermediate-catch event node
}

// ── Atomic segments ───────────────────────────────────────────────────────────

/** A linear sequence of non-junction nodes between two boundary junctions. */
export type AtomicSegmentKind =
	| "linear" // plain task sequence between two gateways / start / end
	| "event-path" // sequence whose first node is an intermediate / boundary event

export interface AtomicSegment {
	id: string
	kind: AtomicSegmentKind
	/** Ordered node IDs in the sequence (boundary junctions excluded). */
	nodeIds: string[]
	/** Forward edge IDs that connect consecutive nodes within the segment. */
	edgeIds: string[]
	/** The junction (gateway / start event) that precedes this segment. */
	fromId: string | null
	/** The junction (gateway / end event) that follows this segment. */
	toId: string | null
	/** Estimated pixel width when laid out left-to-right. */
	estimatedWidth: number
	/** Estimated pixel height (tallest element in segment). */
	estimatedHeight: number
}
