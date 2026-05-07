/**
 * v3 layout — Step 1: atomic segment detection.
 *
 * Finds all "atomic segments": maximal linear sequences of non-junction nodes
 * in the forward DAG.  Each segment can be laid out independently and its
 * intrinsic dimensions computed before any global composition.
 *
 * A "junction" is any node whose forward in-degree ≠ 1 or out-degree ≠ 1:
 *   - start events (in=0), end events (out=0)
 *   - split gateways (out>1), join gateways (in>1)
 *   - nodes reached from / leading to multiple paths due to back-edge removal
 *
 * Back-edges (loop-creating edges) are excluded from the forward graph so
 * that cycle-closing nodes are not mistakenly treated as junctions.
 */
import type { BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import { ELEMENT_SIZES } from "../types.js"
import type { AtomicSegment, AtomicSegmentKind } from "./types.js"

const NODE_GAP = 40 // horizontal gap between nodes within a segment

// ── Back-edge detection ────────────────────────────────────────────────────────

/**
 * DFS-based back-edge detection.
 * Returns the set of sequence flow IDs that create cycles (back-edges).
 */
export function detectBackEdges(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): Set<string> {
	const adj = new Map<string, { targetId: string; edgeId: string }[]>()
	for (const f of sequenceFlows) {
		const list = adj.get(f.sourceRef) ?? []
		list.push({ targetId: f.targetRef, edgeId: f.id })
		adj.set(f.sourceRef, list)
	}

	const backEdgeIds = new Set<string>()
	const state = new Map<string, "white" | "gray" | "black">()

	function dfs(id: string): void {
		state.set(id, "gray")
		for (const { targetId, edgeId } of adj.get(id) ?? []) {
			const s = state.get(targetId) ?? "white"
			if (s === "gray") backEdgeIds.add(edgeId)
			else if (s === "white") dfs(targetId)
		}
		state.set(id, "black")
	}

	for (const n of flowNodes) {
		if (!state.has(n.id)) dfs(n.id)
	}

	return backEdgeIds
}

// ── Forward adjacency ──────────────────────────────────────────────────────────

interface ForwardAdj {
	outAdj: Map<string, string[]>
	inAdj: Map<string, string[]>
	/** "srcId→tgtId" → edgeId */
	edgeMap: Map<string, string>
}

function buildForwardAdj(
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): ForwardAdj {
	const outAdj = new Map<string, string[]>()
	const inAdj = new Map<string, string[]>()
	const edgeMap = new Map<string, string>()

	for (const f of sequenceFlows) {
		if (backEdgeIds.has(f.id)) continue
		outAdj.set(f.sourceRef, [...(outAdj.get(f.sourceRef) ?? []), f.targetRef])
		inAdj.set(f.targetRef, [...(inAdj.get(f.targetRef) ?? []), f.sourceRef])
		edgeMap.set(`${f.sourceRef}→${f.targetRef}`, f.id)
	}

	return { outAdj, inAdj, edgeMap }
}

// ── Topological depths ─────────────────────────────────────────────────────────

/**
 * BFS longest-path from zero-in-degree nodes.
 * Returns a map from node ID to its topological depth (0 = start).
 */
export function computeTopoDepths(
	flowNodes: BpmnFlowElement[],
	outAdj: Map<string, string[]>,
	inAdj: Map<string, string[]>,
): Map<string, number> {
	const depth = new Map<string, number>()
	const remaining = new Map<string, number>()

	for (const n of flowNodes) remaining.set(n.id, inAdj.get(n.id)?.length ?? 0)

	const queue: string[] = flowNodes
		.filter((n) => (remaining.get(n.id) ?? 0) === 0)
		.map((n) => {
			depth.set(n.id, 0)
			return n.id
		})

	while (queue.length > 0) {
		const cur = queue.shift()!
		const d = depth.get(cur) ?? 0
		for (const succ of outAdj.get(cur) ?? []) {
			const nd = d + 1
			if (!depth.has(succ) || depth.get(succ)! < nd) depth.set(succ, nd)
			const rem = (remaining.get(succ) ?? 1) - 1
			remaining.set(succ, rem)
			if (rem === 0) queue.push(succ)
		}
	}

	return depth
}

// ── Atomic segment detection ───────────────────────────────────────────────────

/**
 * Identify all atomic segments in the forward DAG.
 *
 * Algorithm:
 *  1. Build the forward adjacency (back-edges excluded).
 *  2. Classify every node as a "junction" (split, join, start, end) or "interior".
 *  3. For each junction, walk forward into each non-junction successor until
 *     the next junction is reached.  That walk is one atomic segment.
 *  4. Estimate each segment's intrinsic pixel dimensions.
 */
export function findAtomicSegments(
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): AtomicSegment[] {
	const { outAdj, inAdj, edgeMap } = buildForwardAdj(sequenceFlows, backEdgeIds)
	const topoDepths = computeTopoDepths(flowNodes, outAdj, inAdj)
	const nodeMap = new Map(flowNodes.map((n) => [n.id, n]))

	const isJunction = (id: string): boolean =>
		(inAdj.get(id)?.length ?? 0) !== 1 || (outAdj.get(id)?.length ?? 0) !== 1

	// Process junctions in topological order so upstream segments are found first
	const junctions = flowNodes
		.filter((n) => isJunction(n.id))
		.sort((a, b) => (topoDepths.get(a.id) ?? 0) - (topoDepths.get(b.id) ?? 0))

	const segments: AtomicSegment[] = []
	const claimed = new Set<string>() // non-junction nodes already in a segment

	for (const junction of junctions) {
		for (const succId of outAdj.get(junction.id) ?? []) {
			// Skip: direct junction→junction edge (no interior nodes)
			if (isJunction(succId) || claimed.has(succId)) continue

			// Walk the linear interior
			const nodeIds: string[] = []
			const edgeIds: string[] = []
			let prev = junction.id
			let cur: string | undefined = succId

			while (cur && !isJunction(cur) && !claimed.has(cur)) {
				nodeIds.push(cur)
				claimed.add(cur)
				const eId = edgeMap.get(`${prev}→${cur}`)
				if (eId) edgeIds.push(eId)
				prev = cur
				cur = (outAdj.get(cur) ?? [])[0]
			}

			if (nodeIds.length === 0) continue

			// kind: "event-path" if the first node is an intermediate or boundary event
			const firstNode = nodeMap.get(nodeIds[0] ?? "")
			const kind: AtomicSegmentKind =
				firstNode &&
				(firstNode.type === "intermediateCatchEvent" ||
					firstNode.type === "intermediateThrowEvent" ||
					firstNode.type === "boundaryEvent")
					? "event-path"
					: "linear"

			// Estimate dimensions for a horizontal left-to-right layout
			let estW = 0
			let estH = 0
			for (const id of nodeIds) {
				const bn = nodeMap.get(id)
				const sz = bn
					? (ELEMENT_SIZES[bn.type] ?? { width: 100, height: 80 })
					: { width: 100, height: 80 }
				estW += sz.width + NODE_GAP
				estH = Math.max(estH, sz.height)
			}
			estW = Math.max(0, estW - NODE_GAP) // no trailing gap

			segments.push({
				id: `seg-${segments.length}`,
				kind,
				nodeIds,
				edgeIds,
				fromId: junction.id,
				toId: cur ?? null,
				estimatedWidth: estW,
				estimatedHeight: estH,
			})
		}
	}

	return segments
}
