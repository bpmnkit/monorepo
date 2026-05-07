/**
 * v3 layout — Step 5: identify the process-level flow.
 *
 * A "process flow" is the ordered sequence of elements visible at the
 * top level once segment-grouping has been applied:
 *
 *   connector segment — a linear segment NOT owned by any SegmentGroup.
 *                       These appear between start/end events and the
 *                       split/join boundaries of top-level groups.
 *
 *   top-level group   — a SegmentGroup not nested inside any other group
 *                       (i.e. not referenced by any group's childGroupIds).
 *
 * Elements are ordered by topological depth of their entry node.
 */
import type { AtomicSegment, SegmentGroup } from "./types.js"

export type ProcessElementKind = "segment" | "group"

export interface ProcessElement {
	kind: ProcessElementKind
	id: string
}

export interface ProcessFlow {
	elements: ProcessElement[]
}

export function findProcessFlow(
	segments: AtomicSegment[],
	groups: SegmentGroup[],
	topoDepths: Map<string, number>,
): ProcessFlow {
	const ownedSegIds = new Set(groups.flatMap((g) => g.segmentIds))

	const childGroupIds = new Set<string>()
	for (const g of groups) for (const cId of g.childGroupIds) childGroupIds.add(cId)

	const elements: ProcessElement[] = []

	for (const seg of segments) {
		if (!ownedSegIds.has(seg.id)) elements.push({ kind: "segment", id: seg.id })
	}

	for (const g of groups) {
		// Event-attachment groups don't own a horizontal slot in the process flow:
		// their nodes are positioned relative to the host task (Phase 3 of assembleFullLayout).
		if (!childGroupIds.has(g.id) && g.kind !== "event-attachment") {
			elements.push({ kind: "group", id: g.id })
		}
	}

	const entryDepth = (el: ProcessElement): number => {
		if (el.kind === "segment") {
			const seg = segments.find((s) => s.id === el.id)
			return topoDepths.get(seg?.fromId ?? "") ?? 0
		}
		const g = groups.find((grp) => grp.id === el.id)
		return topoDepths.get(g?.splitId ?? g?.eventNodeId ?? "") ?? 0
	}

	elements.sort((a, b) => entryDepth(a) - entryDepth(b))
	return { elements }
}
