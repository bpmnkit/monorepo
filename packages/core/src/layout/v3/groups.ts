/**
 * v3 layout — Step 2: attach atomic segments to parent groups.
 *
 * Two kinds of parent group:
 *
 *   gateway-pair      All segments that flow between a split gateway and its
 *                     matching join gateway.  The matching join is the first
 *                     junction node reachable from every branch of the split.
 *
 *   event-attachment  Segments whose fromId is a boundaryEvent (or
 *                     intermediateCatchEvent used as a fork) are attached to
 *                     the host task that carries the event.
 *
 * Groups are hierarchical: a gateway-pair group that lies inside another
 * gateway-pair's scope becomes a child group of the outer one.
 */
import type {
	BpmnBoundaryEvent,
	BpmnFlowElement,
	BpmnSequenceFlow,
} from "../../bpmn/bpmn-model.js"
import { computeTopoDepths } from "./segments.js"
import type { AtomicSegment, SegmentGroup } from "./types.js"

// ── Forward adjacency (re-built here to avoid coupling to segments.ts internals) ─

function buildFwdAdj(
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): {
	outAdj: Map<string, string[]>
	inAdj: Map<string, string[]>
} {
	const outAdj = new Map<string, string[]>()
	const inAdj = new Map<string, string[]>()
	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) continue
		outAdj.set(f.sourceRef, [...(outAdj.get(f.sourceRef) ?? []), f.targetRef])
		inAdj.set(f.targetRef, [...(inAdj.get(f.targetRef) ?? []), f.sourceRef])
	}
	return { outAdj, inAdj }
}

// ── Join finder ────────────────────────────────────────────────────────────────

/**
 * Given a split junction S with multiple forward successors, find its matching
 * join J: the first junction (in topological order) that is reachable from
 * every branch of S.
 *
 * Returns null when no such junction exists (e.g. loop entry points where one
 * branch is a back-edge source with no forward continuation).
 */
function findMatchingJoin(
	splitId: string,
	outAdj: Map<string, string[]>,
	isJunction: (id: string) => boolean,
	topoDepths: Map<string, number>,
): string | null {
	const branches = outAdj.get(splitId) ?? []
	if (branches.length <= 1) return null

	// BFS from each branch independently; collect all reachable nodes per branch.
	const branchReachable: Set<string>[] = branches.map((start) => {
		const reachable = new Set<string>()
		const queue: string[] = [start]
		while (queue.length > 0) {
			const cur = queue.shift()!
			if (reachable.has(cur)) continue
			reachable.add(cur)
			for (const s of outAdj.get(cur) ?? []) queue.push(s)
		}
		return reachable
	})

	// A junction J qualifies as join if every branch can reach it.
	// Pick the qualifying junction with the smallest topological depth.
	let bestId: string | null = null
	let bestDepth = Infinity

	for (const reachable of branchReachable) {
		for (const id of reachable) {
			if (!isJunction(id) || id === splitId) continue
			if (!branchReachable.every((r) => r.has(id))) continue
			const d = topoDepths.get(id) ?? Infinity
			if (d < bestDepth) {
				bestDepth = d
				bestId = id
			}
		}
	}

	return bestId
}

// ── Scope check ────────────────────────────────────────────────────────────────

/**
 * Returns the set of node IDs reachable from `startId` without crossing
 * `stopId` (i.e. the scope between a split and its join, exclusive of stopId).
 */
function scopeBetween(
	startId: string,
	stopId: string,
	outAdj: Map<string, string[]>,
): Set<string> {
	const inScope = new Set<string>()
	const queue: string[] = [startId]
	while (queue.length > 0) {
		const cur = queue.shift()!
		if (inScope.has(cur) || cur === stopId) continue
		inScope.add(cur)
		for (const s of outAdj.get(cur) ?? []) queue.push(s)
	}
	return inScope
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Build the segment group hierarchy from a flat list of atomic segments.
 *
 * The returned array is flat (both top-level and nested groups); the nesting
 * is expressed via `childGroupIds` so the caller can reconstruct the tree.
 */
export function findSegmentGroups(
	segments: AtomicSegment[],
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): SegmentGroup[] {
	const { outAdj, inAdj } = buildFwdAdj(sequenceFlows, backEdgeIds)
	const topoDepths = computeTopoDepths(flowNodes, outAdj, inAdj)
	const nodeMap = new Map(flowNodes.map((n) => [n.id, n]))

	const isJunction = (id: string): boolean =>
		(inAdj.get(id)?.length ?? 0) !== 1 || (outAdj.get(id)?.length ?? 0) !== 1

	const groups: SegmentGroup[] = []
	let nextId = 0

	// ── 1. Gateway-pair groups ───────────────────────────────────────────────
	// Collect segments by their fromId split junction.
	const segsByFromId = new Map<string, AtomicSegment[]>()
	for (const seg of segments) {
		if (!seg.fromId) continue
		const fromNode = nodeMap.get(seg.fromId)
		// Only split gateways (out-degree > 1 in fwd graph) spawn groups.
		if ((outAdj.get(seg.fromId)?.length ?? 0) <= 1) continue
		// Boundary events are handled separately.
		if (fromNode?.type === "boundaryEvent") continue
		const list = segsByFromId.get(seg.fromId) ?? []
		list.push(seg)
		segsByFromId.set(seg.fromId, list)
	}

	const gatewayGroups: SegmentGroup[] = []

	for (const [splitId, branchSegs] of segsByFromId) {
		if (branchSegs.length < 1) continue

		const joinId = findMatchingJoin(splitId, outAdj, isJunction, topoDepths)

		gatewayGroups.push({
			id: `grp-${nextId++}`,
			kind: "gateway-pair",
			splitId,
			joinId: joinId ?? undefined,
			segmentIds: branchSegs.map((s) => s.id),
			childGroupIds: [],
		})
	}

	// Sort gateway groups by topological depth of their split (outer first).
	gatewayGroups.sort(
		(a, b) =>
			(topoDepths.get(a.splitId ?? "") ?? 0) -
			(topoDepths.get(b.splitId ?? "") ?? 0),
	)

	// ── 2. Build nesting hierarchy for gateway-pair groups ───────────────────
	// A group G_inner is a child of G_outer when G_inner's split lies within
	// G_outer's scope (reachable from G_outer's split, before G_outer's join).
	for (const outer of gatewayGroups) {
		if (!outer.splitId || !outer.joinId) continue
		const outerScope = scopeBetween(outer.splitId, outer.joinId, outAdj)

		for (const inner of gatewayGroups) {
			if (inner === outer) continue
			if (inner.splitId && outerScope.has(inner.splitId)) {
				outer.childGroupIds.push(inner.id)
			}
		}
	}

	// Keep only direct children (remove transitively inherited children).
	// G is a direct child of outer when no other child of outer is also an
	// ancestor of G.
	const groupById = new Map<string, SegmentGroup>()
	for (const g of gatewayGroups) groupById.set(g.id, g)

	for (const outer of gatewayGroups) {
		const directChildren: string[] = []
		for (const cId of outer.childGroupIds) {
			const c = groupById.get(cId)!
			const isGrandchild = outer.childGroupIds.some((otherId) => {
				if (otherId === cId) return false
				const other = groupById.get(otherId)
				return other?.childGroupIds.includes(cId) ?? false
			})
			if (!isGrandchild) directChildren.push(cId)
		}
		outer.childGroupIds = directChildren
	}

	groups.push(...gatewayGroups)

	// ── 3. Event-attachment groups ───────────────────────────────────────────
	for (const seg of segments) {
		if (!seg.fromId) continue
		const fromNode = nodeMap.get(seg.fromId)
		if (!fromNode) continue

		let hostNodeId: string | undefined
		let eventNodeId: string | undefined

		if (fromNode.type === "boundaryEvent") {
			const bEvent = fromNode as BpmnBoundaryEvent
			hostNodeId = bEvent.attachedToRef
			eventNodeId = fromNode.id
		} else if (
			fromNode.type === "intermediateCatchEvent" ||
			fromNode.type === "intermediateThrowEvent"
		) {
			// Intermediate events that act as segment boundaries (out-degree > 1
			// or in-degree > 1) get their own event group.
			eventNodeId = fromNode.id
		}

		if (!eventNodeId) continue

		groups.push({
			id: `grp-${nextId++}`,
			kind: "event-attachment",
			hostNodeId,
			eventNodeId,
			segmentIds: [seg.id],
			childGroupIds: [],
		})
	}

	return groups
}
