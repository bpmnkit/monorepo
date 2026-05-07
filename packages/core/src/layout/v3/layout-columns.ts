/**
 * v3 layout — Step 9: assign column positions (horizontal grid).
 *
 * Column assignment rules:
 *   - Each non-boundary node gets a column index; column width = COLUMN_WIDTH px.
 *   - Initial column = max(pred.colEnd for all forward predecessors), 0 for roots.
 *   - colEnd = colStart + span − 1.
 *   - Span = ⌈nodeWidth / COLUMN_WIDTH⌉, minimum 1 (large elements span multiple cols).
 *   - Path-clear constraint: for each forward edge A→B, any node whose colStart
 *     falls within [A.colEnd, B.colStart) is a blocker — B is pushed right until
 *     the path is clear.  Repeats until stable.
 *   - No two nodes share a column index on the same track (naturally satisfied by
 *     the sequential structure of segments within a track).
 *   - Boundary events keep their offset from the host task; the host's new X is
 *     applied as a delta.
 *   - Y positions are preserved from the track layout.
 */
import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import type { NodeLayout } from "./layout-group.js"
import { TRACK_HEIGHT, type TrackLayout } from "./layout-tracks.js"

export const COLUMN_WIDTH = 160

export interface ColumnBand {
	column: number
	x: number
	width: number
}

export interface ColumnLayout {
	width: number
	height: number
	nodes: NodeLayout[]
	columnBands: ColumnBand[]
}

export function layoutWithColumns(
	trackLayout: TrackLayout,
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): ColumnLayout {
	const nodeSet = new Set(trackLayout.nodes.map((n) => n.id))
	const boundaryEventIds = new Set(
		flowNodes.filter((n) => n.type === "boundaryEvent").map((n) => n.id),
	)
	const nlMap = new Map(trackLayout.nodes.map((n) => [n.id, n]))

	// Forward adjacency — all nodes including boundary events so that
	// downstream nodes on event-attachment paths get correct column assignments.
	const outAdj = new Map<string, string[]>()
	const inAdj = new Map<string, string[]>()
	for (const sf of sequenceFlows) {
		if (backEdgeIds.has(sf.id)) continue
		if (!nodeSet.has(sf.sourceRef) || !nodeSet.has(sf.targetRef)) continue
		outAdj.set(sf.sourceRef, [...(outAdj.get(sf.sourceRef) ?? []), sf.targetRef])
		inAdj.set(sf.targetRef, [...(inAdj.get(sf.targetRef) ?? []), sf.sourceRef])
	}

	const span = (nl: NodeLayout) => Math.max(1, Math.ceil(nl.width / COLUMN_WIDTH))

	// Kahn's topological column assignment:
	//   col[N] = max(col[P] + span[P]) over all forward predecessors P.
	const colStart = new Map<string, number>()
	const remaining = new Map<string, number>(
		trackLayout.nodes.map((nl) => [nl.id, inAdj.get(nl.id)?.length ?? 0]),
	)

	const queue = trackLayout.nodes
		.filter((nl) => (remaining.get(nl.id) ?? 0) === 0)
		.map((nl) => nl.id)
	for (const id of queue) colStart.set(id, 0)

	while (queue.length > 0) {
		const id = queue.shift()
		if (!id) break
		const nl = nlMap.get(id)
		if (!nl) continue
		const nextCol = (colStart.get(id) ?? 0) + span(nl)
		for (const succId of outAdj.get(id) ?? []) {
			colStart.set(succId, Math.max(colStart.get(succId) ?? 0, nextCol))
			const rem = (remaining.get(succId) ?? 1) - 1
			remaining.set(succId, rem)
			if (rem === 0) queue.push(succId)
		}
	}
	// Fallback: nodes unreachable from forward-graph roots (e.g. isolated nodes)
	for (const nl of trackLayout.nodes) {
		if (!colStart.has(nl.id)) colStart.set(nl.id, 0)
	}

	// ── Boundary event column fixup ───────────────────────────────────────────
	// Kahn's treats boundary events as roots (no incoming SFs) and assigns them
	// colStart=0. Fix: place each boundary event at its host's column so their
	// downstream paths exit south-east of the host, not from the process start.
	for (const fn of flowNodes) {
		if (fn.type !== "boundaryEvent") continue
		const be = fn as BpmnBoundaryEvent
		const hostCol = colStart.get(be.attachedToRef)
		if (hostCol === undefined) continue
		colStart.set(be.id, hostCol)
	}
	// Propagate the corrected positions to all successors transitively.
	{
		let propChanged = true
		while (propChanged) {
			propChanged = false
			for (const sf of sequenceFlows) {
				if (backEdgeIds.has(sf.id)) continue
				const aNl = nlMap.get(sf.sourceRef)
				if (!aNl) continue
				const aEnd = (colStart.get(sf.sourceRef) ?? 0) + span(aNl)
				const bStart = colStart.get(sf.targetRef) ?? 0
				if (bStart < aEnd) {
					colStart.set(sf.targetRef, aEnd)
					propChanged = true
				}
			}
		}
	}

	// Path-clear constraint: for each forward edge A→B, any node E whose colStart
	// lies in [A.colEnd, B.colStart) blocks the path — push B past E.
	// Iterate until stable (columns only ever increase → guaranteed termination).
	let changed = true
	while (changed) {
		changed = false
		for (const sf of sequenceFlows) {
			if (backEdgeIds.has(sf.id)) continue
			const aNl = nlMap.get(sf.sourceRef)
			const bNl = nlMap.get(sf.targetRef)
			if (!aNl || !bNl) continue
			const aEnd = (colStart.get(sf.sourceRef) ?? 0) + span(aNl)
			const bStart = colStart.get(sf.targetRef) ?? 0
			if (bStart <= aEnd) continue // B is already adjacent to or overlaps A

			let maxBlockerEnd = aEnd
			for (const el of trackLayout.nodes) {
				if (el.id === sf.sourceRef || el.id === sf.targetRef) continue
				const eStart = colStart.get(el.id) ?? 0
				if (eStart >= aEnd && eStart < bStart) {
					// E starts inside the gap — it blocks the path
					maxBlockerEnd = Math.max(maxBlockerEnd, eStart + span(el))
				}
			}

			if (maxBlockerEnd > bStart) {
				colStart.set(sf.targetRef, maxBlockerEnd)
				changed = true
			}
		}
	}

	// ── Cell collision resolution ─────────────────────────────────────────────────
	// Compute track for each non-boundary node from trackLayout bands.
	// Two nodes sharing (colStart, track) must be resolved by pushing right.
	const nlTrack = new Map<string, number>()
	for (const nl of trackLayout.nodes) {
		if (boundaryEventIds.has(nl.id)) continue
		const cy = nl.y + nl.height / 2
		let found = false
		for (const band of trackLayout.trackBands) {
			if (cy >= band.y && cy < band.y + TRACK_HEIGHT) {
				nlTrack.set(nl.id, band.track)
				found = true
				break
			}
		}
		if (!found) {
			const trackMin =
				trackLayout.trackBands.length > 0
					? Math.min(...trackLayout.trackBands.map((b) => b.track))
					: 0
			nlTrack.set(nl.id, Math.floor(cy / TRACK_HEIGHT) + trackMin)
		}
	}

	let collisionChanged = true
	while (collisionChanged) {
		collisionChanged = false

		// Build cell map: "col,track" → nodeId[]
		const cellMap = new Map<string, string[]>()
		for (const nl of trackLayout.nodes) {
			if (boundaryEventIds.has(nl.id)) continue
			const col = colStart.get(nl.id) ?? 0
			const track = nlTrack.get(nl.id) ?? 0
			const key = `${col},${track}`
			const arr = cellMap.get(key) ?? []
			arr.push(nl.id)
			cellMap.set(key, arr)
		}

		for (const ids of cellMap.values()) {
			if (ids.length <= 1) continue
			// Sort for determinism; push all but the first to the right
			ids.sort()
			for (let i = 1; i < ids.length; i++) {
				const id = ids[i]
				if (!id) continue
				const currentCol = colStart.get(id) ?? 0
				// Find lowest col > currentCol that is free at this track
				const track = nlTrack.get(id) ?? 0
				let newCol = currentCol + i
				while (
					cellMap.has(`${newCol},${track}`) &&
					!cellMap.get(`${newCol},${track}`)?.includes(id)
				) {
					newCol++
				}
				if (newCol !== currentCol) {
					colStart.set(id, newCol)
					collisionChanged = true
				}
			}
		}

		// After pushing, propagate successor constraints so A→B still has B after A.
		if (collisionChanged) {
			let propChanged = true
			while (propChanged) {
				propChanged = false
				for (const sf of sequenceFlows) {
					if (backEdgeIds.has(sf.id)) continue
					const aNl = nlMap.get(sf.sourceRef)
					if (!aNl) continue
					const aEnd = (colStart.get(sf.sourceRef) ?? 0) + span(aNl)
					const bStart = colStart.get(sf.targetRef) ?? 0
					if (bStart < aEnd) {
						colStart.set(sf.targetRef, aEnd)
						propChanged = true
					}
				}
			}
		}
	}

	// Build placed nodes: snap non-boundary nodes to column grid, center within span
	const placed = new Map<string, NodeLayout>()
	for (const nl of trackLayout.nodes) {
		if (boundaryEventIds.has(nl.id)) continue
		const col = colStart.get(nl.id) ?? 0
		const s = span(nl)
		const colX = col * COLUMN_WIDTH
		const colW = s * COLUMN_WIDTH
		placed.set(nl.id, { ...nl, x: colX + (colW - nl.width) / 2 })
	}

	// Re-anchor boundary events: shift by the same delta as their host task
	for (const fn of flowNodes) {
		if (fn.type !== "boundaryEvent") continue
		const be = fn as BpmnBoundaryEvent
		const origBe = nlMap.get(be.id)
		const origHost = nlMap.get(be.attachedToRef)
		const newHost = placed.get(be.attachedToRef)
		if (!origBe || !origHost || !newHost) {
			if (origBe) placed.set(be.id, origBe)
			continue
		}
		const deltaX = newHost.x - origHost.x
		placed.set(be.id, { ...origBe, x: origBe.x + deltaX })
	}

	// Compute column bands spanning all used columns
	let maxColEnd = 0
	for (const nl of trackLayout.nodes) {
		if (boundaryEventIds.has(nl.id)) continue
		const c = colStart.get(nl.id) ?? 0
		maxColEnd = Math.max(maxColEnd, c + span(nl) - 1)
	}
	const columnBands: ColumnBand[] = []
	for (let col = 0; col <= maxColEnd; col++) {
		columnBands.push({ column: col, x: col * COLUMN_WIDTH, width: COLUMN_WIDTH })
	}

	const nodes = [...placed.values()]
	const width = (maxColEnd + 1) * COLUMN_WIDTH
	return { width, height: trackLayout.height, nodes, columnBands }
}
