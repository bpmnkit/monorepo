/**
 * v3 layout — Step 10: path routing.
 *
 * This step may reposition elements if doing so improves path clarity.
 *
 * Boundary-event south rule:
 *   Downstream paths from boundary/intermediate events always exit south,
 *   then turn east. If a gateway in the same (col, track) also needs a south
 *   path, the gateway is shifted east by one column to clear the corridor.
 *
 * Path priorities (highest first):
 *   straight — same track, target strictly east.
 *   L        — one bend; boundary events use south-first; gateways use the
 *              side facing the target; regular elements use east-first.
 *   Z        — two bends; fallback when L would cross an existing segment.
 *   U        — back-edges and westward edges: south corridor (below all tracks)
 *              preferred; north corridor used when back-track is at the bottom.
 *
 * Crossing avoidance:
 *   Horizontal and vertical path segments are tracked per grid cell.
 *   When a proposed segment would cross an already-occupied perpendicular
 *   segment, the alternate L direction (or a Z-path) is tried instead.
 */
import type { BpmnBoundaryEvent, BpmnFlowElement, BpmnSequenceFlow } from "../../bpmn/bpmn-model.js"
import { COLUMN_WIDTH, type ColumnBand, type ColumnLayout } from "./layout-columns.js"
import type { NodeLayout } from "./layout-group.js"
import { TRACK_HEIGHT, type TrackBand, type TrackLayout } from "./layout-tracks.js"

export type EdgeKind = "straight" | "L" | "Z" | "U"

export interface Point {
	x: number
	y: number
}

export interface EdgeRoute {
	edgeId: string
	sourceId: string
	targetId: string
	points: Point[]
	kind: EdgeKind
}

export interface PathLayout {
	width: number
	height: number
	nodes: NodeLayout[]
	edges: EdgeRoute[]
	columnBands: ColumnBand[]
	trackBands: TrackBand[]
	backTrack: number | null
}

const U_MARGIN = 48

function isGatewayType(type: string): boolean {
	return type.includes("Gateway") || type === "complexGateway"
}

export function layoutWithPaths(
	columnLayout: ColumnLayout,
	trackLayout: TrackLayout,
	flowNodes: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: Set<string>,
): PathLayout {
	// ── Mutable node positions ────────────────────────────────────────────────
	// Clone — this step may shift gateways east to clear boundary-event paths.
	const nodePosMap = new Map<string, NodeLayout>()
	for (const nl of columnLayout.nodes) nodePosMap.set(nl.id, { ...nl })

	const flowNodeMap = new Map(flowNodes.map((n) => [n.id, n]))

	const boundaryEventIds = new Set(
		flowNodes.filter((n) => n.type === "boundaryEvent").map((n) => n.id),
	)

	const beHosts = new Map<string, string>() // beId → hostId
	for (const fn of flowNodes) {
		if (fn.type === "boundaryEvent") beHosts.set(fn.id, (fn as BpmnBoundaryEvent).attachedToRef)
	}

	const trackBands = trackLayout.trackBands
	const colBands = columnLayout.columnBands
	const trackMin = trackBands.length > 0 ? Math.min(...trackBands.map((b) => b.track)) : 0
	const trackMax = trackBands.length > 0 ? Math.max(...trackBands.map((b) => b.track)) : 0

	// ── Grid helpers ──────────────────────────────────────────────────────────

	function colOf(nl: NodeLayout): number {
		const cx = nl.x + nl.width / 2
		for (const b of colBands) if (cx >= b.x && cx < b.x + COLUMN_WIDTH) return b.column
		return Math.floor(cx / COLUMN_WIDTH)
	}

	function trackOf(nl: NodeLayout): number {
		const cy = nl.y + nl.height / 2
		for (const b of trackBands) if (cy >= b.y && cy < b.y + TRACK_HEIGHT) return b.track
		return Math.floor(cy / TRACK_HEIGHT) + trackMin
	}

	function trackCenterY(track: number): number {
		const b = trackBands.find((b) => b.track === track)
		return b ? b.y + TRACK_HEIGHT / 2 : (track - trackMin) * TRACK_HEIGHT + TRACK_HEIGHT / 2
	}

	function colCenterX(col: number): number {
		const b = colBands.find((b) => b.column === col)
		return b ? b.x + COLUMN_WIDTH / 2 : col * COLUMN_WIDTH + COLUMN_WIDTH / 2
	}

	// ── Phase 1: Resolve boundary-event / gateway south-path conflicts ────────

	// Boundary events with outgoing forward paths need a south exit corridor.
	// Compute the column each boundary event's south exit falls in.
	const beSouthCol = new Map<string, number>() // beId → column
	const beSouthTrack = new Map<string, number>() // beId → track
	for (const sf of sequenceFlows) {
		if (backEdgeIds.has(sf.id) || !boundaryEventIds.has(sf.sourceRef)) continue
		const beNl = nodePosMap.get(sf.sourceRef)
		if (!beNl) continue
		beSouthCol.set(sf.sourceRef, colOf(beNl))
		beSouthTrack.set(sf.sourceRef, trackOf(beNl))
	}

	// Gateways with south-going successors and their column/track.
	const gwSouth = new Map<string, { col: number; track: number }>() // gwId → {col,track}
	for (const sf of sequenceFlows) {
		if (backEdgeIds.has(sf.id)) continue
		const srcType = flowNodeMap.get(sf.sourceRef)?.type ?? ""
		if (!isGatewayType(srcType)) continue
		const srcNl = nodePosMap.get(sf.sourceRef)
		const tgtNl = nodePosMap.get(sf.targetRef)
		if (!srcNl || !tgtNl) continue
		if (trackOf(tgtNl) > trackOf(srcNl))
			gwSouth.set(sf.sourceRef, { col: colOf(srcNl), track: trackOf(srcNl) })
	}

	// Detect conflicts: gateway and boundary event share (col, track) with south paths.
	for (const [beId, beCol] of beSouthCol) {
		const beTrack = beSouthTrack.get(beId) ?? 0
		for (const [gwId, gwInfo] of gwSouth) {
			if (gwInfo.col !== beCol || gwInfo.track !== beTrack) continue
			// Shift gateway east by one column to clear the boundary-event south corridor.
			const gwNl = nodePosMap.get(gwId)
			if (!gwNl) continue
			nodePosMap.set(gwId, { ...gwNl, x: gwNl.x + COLUMN_WIDTH })
			gwSouth.set(gwId, { col: gwInfo.col + 1, track: gwInfo.track })
		}
	}

	// ── Phase 1b: Clear gateway south corridors ──────────────────────────────
	// When a gateway has south-going forward edges and elements on a south track
	// occupy the same column, shift the gateway and all same-track elements east
	// by one column, repeating until the south corridor below the gateway is clear.
	// Other-track elements at col ≥ gwCol also shift unless they have an incoming
	// forward edge from a source that was west of the gateway's original column.
	// Boundary events re-anchor to their (possibly shifted) host tasks each pass.
	{
		const clearedGateways = new Set<string>()
		for (const sf of sequenceFlows) {
			if (backEdgeIds.has(sf.id)) continue
			const srcFnType = flowNodeMap.get(sf.sourceRef)?.type ?? ""
			if (!isGatewayType(srcFnType)) continue
			if (clearedGateways.has(sf.sourceRef)) continue

			const gw = nodePosMap.get(sf.sourceRef)
			const tgt0 = nodePosMap.get(sf.targetRef)
			if (!gw || !tgt0) continue
			const gwTrack = trackOf(gw)
			if (trackOf(tgt0) <= gwTrack) continue
			clearedGateways.add(sf.sourceRef)

			// Capture original gateway column before any shifts for this gateway.
			const originalGwCol = colOf(nodePosMap.get(sf.sourceRef)!)

			// Nodes that have at least one incoming non-back edge from a source
			// that is NOT being shifted — these must not be shifted.
			// Same-track elements at col >= originalGwCol are in the shift set,
			// so their outgoing edges don't count as "west incoming".
			const hasWestIncoming = new Set<string>()
			for (const flow of sequenceFlows) {
				if (backEdgeIds.has(flow.id)) continue
				const flowSrc = nodePosMap.get(flow.sourceRef)
				if (!flowSrc) continue
				// Skip sources that are being shifted (same track, col >= originalGwCol).
				if (trackOf(flowSrc) === gwTrack && colOf(flowSrc) >= originalGwCol) continue
				if (colOf(flowSrc) <= originalGwCol) {
					hasWestIncoming.add(flow.targetRef)
				}
			}

			for (let attempt = 0; attempt < 10; attempt++) {
				const currGw = nodePosMap.get(sf.sourceRef)
				if (!currGw) break
				const gwCol = colOf(currGw)

				let blocked = false
				for (const [nid, nl] of nodePosMap) {
					if (nid === sf.sourceRef) continue
					if (boundaryEventIds.has(nid)) continue
					if (trackOf(nl) <= gwTrack) continue
					if (colOf(nl) !== gwCol) continue
					blocked = true
					break
				}
				if (!blocked) break

				// Shift same-track elements at col ≥ gwCol east by one column.
				for (const [nid, nl] of [...nodePosMap.entries()]) {
					if (boundaryEventIds.has(nid)) continue
					if (trackOf(nl) !== gwTrack) continue
					if (colOf(nl) < gwCol) continue
					nodePosMap.set(nid, { ...nl, x: nl.x + COLUMN_WIDTH })
				}

				// Shift other-track elements at col ≥ gwCol that have no west incoming.
				for (const [nid, nl] of [...nodePosMap.entries()]) {
					if (boundaryEventIds.has(nid)) continue
					if (trackOf(nl) === gwTrack) continue
					if (colOf(nl) < gwCol) continue
					if (hasWestIncoming.has(nid)) continue
					nodePosMap.set(nid, { ...nl, x: nl.x + COLUMN_WIDTH })
				}

				// Re-anchor boundary events to their (possibly shifted) host tasks.
				for (const fn of flowNodes) {
					if (fn.type !== "boundaryEvent") continue
					const be = fn as BpmnBoundaryEvent
					const host = nodePosMap.get(be.attachedToRef)
					const beNl = nodePosMap.get(be.id)
					if (!host || !beNl) continue
					nodePosMap.set(be.id, { ...beNl, x: host.x + host.width - beNl.width / 2 })
				}
			}
		}
	}

	// ── Phase 2: Segment occupancy — geometric crossing detection ────────────
	// Store actual routed segments so crossing checks use exact geometry instead
	// of grid-cell approximations (which produce false positives).
	const routedSegs: [Point, Point][] = []

	function occupyPoints(pts: Point[]): void {
		for (let i = 0; i < pts.length - 1; i++) {
			const p1 = pts[i]
			const p2 = pts[i + 1]
			if (p1 && p2) routedSegs.push([p1, p2])
		}
	}

	// Geometric intersection of two axis-aligned segments.
	// Returns true when they properly cross (T or + shape), not merely touch at endpoints.
	function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
		const eps = 4
		const pH = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x)
		const qH = Math.abs(q2.y - q1.y) < Math.abs(q2.x - q1.x)
		if (pH === qH) return false // parallel — ignore collinear overlap
		const [h, v] = pH
			? [
					{ p1, p2 },
					{ p1: q1, p2: q2 },
				]
			: [
					{ p1: q1, p2: q2 },
					{ p1, p2 },
				]
		const hy = (h.p1.y + h.p2.y) / 2
		const hx1 = Math.min(h.p1.x, h.p2.x)
		const hx2 = Math.max(h.p1.x, h.p2.x)
		const vx = (v.p1.x + v.p2.x) / 2
		const vy1 = Math.min(v.p1.y, v.p2.y)
		const vy2 = Math.max(v.p1.y, v.p2.y)
		return vx > hx1 + eps && vx < hx2 - eps && hy > vy1 + eps && hy < vy2 - eps
	}

	function checkCrossing(pts: Point[]): boolean {
		for (let i = 0; i < pts.length - 1; i++) {
			const p1 = pts[i]
			const p2 = pts[i + 1]
			if (!p1 || !p2) continue
			for (const [q1, q2] of routedSegs) {
				if (segmentsIntersect(p1, p2, q1, q2)) return true
			}
		}
		return false
	}

	// Combined check: no path-path crossing AND no path passing through an intermediate node.
	function isClear(pts: Point[], srcId: string, tgtId: string): boolean {
		if (checkCrossing(pts)) return false
		for (let i = 0; i < pts.length - 1; i++) {
			const p1 = pts[i]
			const p2 = pts[i + 1]
			if (!p1 || !p2) continue
			for (const [nid, nl] of nodePosMap) {
				if (nid === srcId || nid === tgtId) continue
				if (boundaryEventIds.has(nid)) continue
				if (segmentCrossesNode(p1, p2, nl)) return false
			}
		}
		return true
	}

	// Find minimum x ≥ startX where a vertical segment from y1 to y2 clears all
	// intermediate nodes and already-routed horizontal segments.
	function clearDescentX(
		startX: number,
		y1: number,
		y2: number,
		srcId: string,
		tgtId: string,
	): number {
		const yMin = Math.min(y1, y2)
		const yMax = Math.max(y1, y2)
		const eps = 4
		let x = startX
		let changed = true
		while (changed) {
			changed = false
			for (const [nid, nl] of nodePosMap) {
				if (nid === srcId || nid === tgtId) continue
				if (boundaryEventIds.has(nid)) continue
				if (nl.y + nl.height <= yMin + eps || nl.y >= yMax - eps) continue
				if (x <= nl.x + eps || x >= nl.x + nl.width - eps) continue
				x = nl.x + nl.width + eps
				changed = true
			}
			for (const [q1, q2] of routedSegs) {
				if (Math.abs(q2.y - q1.y) >= Math.abs(q2.x - q1.x)) continue
				const qy = (q1.y + q2.y) / 2
				if (qy <= yMin + eps || qy >= yMax - eps) continue
				const qx1 = Math.min(q1.x, q2.x)
				const qx2 = Math.max(q1.x, q2.x)
				if (x <= qx1 + eps || x >= qx2 - eps) continue
				x = qx2 + eps
				changed = true
			}
		}
		return x
	}

	// ── Phase 3: U-path corridor ──────────────────────────────────────────────
	const topY = Math.min(...trackBands.map((b) => b.y))
	const botY = Math.max(...trackBands.map((b) => b.y + TRACK_HEIGHT))
	const backTrack = trackLayout.backTrack

	// Always use south corridor — there is always room below the lowest band.
	const uCorrBase = botY + U_MARGIN
	const uCorrYUsed = new Map<string, number>()
	function uCorrYFor(srcX: number, tgtX: number): number {
		const x1 = Math.min(srcX, tgtX)
		const x2 = Math.max(srcX, tgtX)
		let y = uCorrBase
		for (const [rangeKey, rangeY] of uCorrYUsed) {
			const [rx1, rx2] = rangeKey.split(",").map(Number) as [number, number]
			if (rx1 < x2 && rx2 > x1 && Math.abs(rangeY - y) < 8) y = rangeY + U_MARGIN / 2
		}
		uCorrYUsed.set(`${x1},${x2}`, y)
		return y
	}

	// ── Geometric segment-to-node crossing test ───────────────────────────────
	// Returns true when a path segment visually passes through a node's bounding box.
	function segmentCrossesNode(p1: Point, p2: Point, nl: NodeLayout): boolean {
		const eps = 2
		const dx = Math.abs(p2.x - p1.x)
		const dy = Math.abs(p2.y - p1.y)
		if (dy < dx) {
			// Horizontal — check y inside node height band
			const y = (p1.y + p2.y) / 2
			if (y <= nl.y + eps || y >= nl.y + nl.height - eps) return false
			const x1 = Math.min(p1.x, p2.x)
			const x2 = Math.max(p1.x, p2.x)
			return x2 > nl.x + eps && x1 < nl.x + nl.width - eps
		}
		// Vertical — check x inside node width band
		const x = (p1.x + p2.x) / 2
		if (x <= nl.x + eps || x >= nl.x + nl.width - eps) return false
		const y1 = Math.min(p1.y, p2.y)
		const y2 = Math.max(p1.y, p2.y)
		return y2 > nl.y + eps && y1 < nl.y + nl.height - eps
	}

	// ── Phase 4: Route all edges (re-callable) ────────────────────────────────

	type EdgeSpec = { sf: BpmnSequenceFlow; priority: number }

	const specs: EdgeSpec[] = []
	for (const sf of sequenceFlows) {
		const isBe = boundaryEventIds.has(sf.sourceRef)
		const isBack = backEdgeIds.has(sf.id)
		const srcType = flowNodeMap.get(sf.sourceRef)?.type ?? ""
		const srcNl = nodePosMap.get(sf.sourceRef)
		const tgtNl = nodePosMap.get(sf.targetRef)
		if (!srcNl || !tgtNl) continue
		const sTrack = trackOf(srcNl)
		const tTrack = trackOf(tgtNl)
		const sCol = colOf(srcNl)
		const tCol = colOf(tgtNl)
		const straight = sTrack === tTrack && tCol >= sCol && !isBack && !isBe
		let priority: number
		if (straight) priority = 0
		else if (isBe) priority = 1
		else if (isGatewayType(srcType) && !isBack) priority = 2
		else if (!isBack) priority = 3
		else priority = 4
		specs.push({ sf, priority })
	}
	specs.sort((a, b) => a.priority - b.priority)

	// Y-level above all track-0 elements used as "skip lane" for same-track paths
	// that would cross intermediate nodes. Safely above tasks (y≥200) and events.
	const skipAboveY = topY - 12

	function routeAll(): EdgeRoute[] {
		routedSegs.length = 0
		const result: EdgeRoute[] = []

		for (const { sf } of specs) {
			const src = nodePosMap.get(sf.sourceRef)
			const tgt = nodePosMap.get(sf.targetRef)
			if (!src || !tgt) continue

			const srcType = flowNodeMap.get(sf.sourceRef)?.type ?? "task"
			const isBe = boundaryEventIds.has(sf.sourceRef)
			const isBack = backEdgeIds.has(sf.id)

			const srcCx = src.x + src.width / 2
			const srcCy = src.y + src.height / 2
			const tgtCx = tgt.x + tgt.width / 2
			const tgtCy = tgt.y + tgt.height / 2
			const tgtType = flowNodeMap.get(sf.targetRef)?.type ?? ""
			const isGwGw = isGatewayType(srcType) && isGatewayType(tgtType)

			const sCol = colOf(src)
			const sTrack = trackOf(src)
			const tCol = colOf(tgt)
			const tTrack = trackOf(tgt)

			let route: { points: Point[]; kind: EdgeKind }

			// ── Boundary event: south-first L (or U-path if target is westward) ──
			if (isBe && tCol >= sCol) {
				const exitY = src.y + src.height
				const targetY = trackCenterY(tTrack)
				route = {
					kind: "L",
					points: [
						{ x: srcCx, y: exitY },
						{ x: srcCx, y: targetY },
						{ x: tgt.x, y: tgtCy },
					],
				}
			}

			// ── U-path: back-edges, westward edges, westward boundary events ──────
			else if (isBack || tCol < sCol) {
				if (isGwGw && !isBack) {
					// gw→gw westward cross-track: try direct west-exit Z before the south U-loop.
					// Source exits west; target entered from east (opposite side).
					const midBendX = colCenterX(Math.floor((sCol + tCol) / 2))
					const wExitPts: Point[] = [
						{ x: src.x, y: srcCy },
						{ x: midBendX, y: srcCy },
						{ x: midBendX, y: tgtCy },
						{ x: tgt.x + tgt.width, y: tgtCy },
					]
					if (isClear(wExitPts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "L", points: wExitPts }
					} else {
						// north/south exit → enter east of target
						const exitY = tTrack > sTrack ? src.y + src.height : src.y
						const nsPts: Point[] = [
							{ x: srcCx, y: exitY },
							{ x: srcCx, y: tgtCy },
							{ x: tgt.x + tgt.width, y: tgtCy },
						]
						if (isClear(nsPts, sf.sourceRef, sf.targetRef)) {
							route = { kind: "L", points: nsPts }
						} else {
							const corrY = uCorrYFor(src.x + src.width + U_MARGIN / 2, tgt.x - U_MARGIN / 2)
							route = {
								kind: "U",
								points: [
									{ x: src.x + src.width, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: corrY },
									{ x: tgt.x - U_MARGIN / 2, y: corrY },
									{ x: tgt.x - U_MARGIN / 2, y: tgtCy },
									{ x: tgt.x, y: tgtCy },
								],
							}
						}
					}
				} else if (!isBack && isGatewayType(srcType) && tTrack > sTrack) {
					// Gateway shifted east of its south-going target (Phase 1b):
					// exit south face, descend to target level, enter target from east side.
					const exitY2 = src.y + src.height
					const sFPts: Point[] = [
						{ x: srcCx, y: exitY2 },
						{ x: srcCx, y: tgtCy },
						{ x: tgt.x + tgt.width, y: tgtCy },
					]
					if (isClear(sFPts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "L", points: sFPts }
					} else {
						const descentX2 = clearDescentX(srcCx, exitY2, tgtCy, sf.sourceRef, sf.targetRef)
						const zPts2: Point[] = [
							{ x: srcCx, y: exitY2 },
							{ x: descentX2, y: exitY2 },
							{ x: descentX2, y: tgtCy },
							{ x: tgt.x + tgt.width, y: tgtCy },
						]
						if (isClear(zPts2, sf.sourceRef, sf.targetRef)) {
							route = { kind: "Z", points: zPts2 }
						} else {
							const corrY2 = uCorrYFor(src.x + src.width + U_MARGIN / 2, tgt.x - U_MARGIN / 2)
							route = {
								kind: "U",
								points: [
									{ x: src.x + src.width, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: corrY2 },
									{ x: tgt.x - U_MARGIN / 2, y: corrY2 },
									{ x: tgt.x - U_MARGIN / 2, y: tgtCy },
									{ x: tgt.x, y: tgtCy },
								],
							}
						}
					}
				} else if (!isBack && isGatewayType(srcType) && tTrack === sTrack) {
					// Same-track westward gateway (Phase 1b shifted east of same-track target):
					// try south-face → tgtCy → east face; fall back to tight south corridor.
					const exitY3 = src.y + src.height
					const directPts: Point[] = [
						{ x: srcCx, y: exitY3 },
						{ x: srcCx, y: tgtCy },
						{ x: tgt.x + tgt.width, y: tgtCy },
					]
					if (isClear(directPts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "L", points: directPts }
					} else {
						const tightCorrY = exitY3 + U_MARGIN
						const tightPts: Point[] = [
							{ x: srcCx, y: exitY3 },
							{ x: srcCx, y: tightCorrY },
							{ x: tgt.x + tgt.width + U_MARGIN, y: tightCorrY },
							{ x: tgt.x + tgt.width + U_MARGIN, y: tgtCy },
							{ x: tgt.x + tgt.width, y: tgtCy },
						]
						if (isClear(tightPts, sf.sourceRef, sf.targetRef)) {
							route = { kind: "U", points: tightPts }
						} else {
							const corrY3 = uCorrYFor(src.x + src.width + U_MARGIN / 2, tgt.x - U_MARGIN / 2)
							route = {
								kind: "U",
								points: [
									{ x: src.x + src.width, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: srcCy },
									{ x: src.x + src.width + U_MARGIN / 2, y: corrY3 },
									{ x: tgt.x - U_MARGIN / 2, y: corrY3 },
									{ x: tgt.x - U_MARGIN / 2, y: tgtCy },
									{ x: tgt.x, y: tgtCy },
								],
							}
						}
					}
				} else {
					const corrY = uCorrYFor(src.x + src.width + U_MARGIN / 2, tgt.x - U_MARGIN / 2)
					route = {
						kind: "U",
						points: [
							{ x: src.x + src.width, y: srcCy },
							{ x: src.x + src.width + U_MARGIN / 2, y: srcCy },
							{ x: src.x + src.width + U_MARGIN / 2, y: corrY },
							{ x: tgt.x - U_MARGIN / 2, y: corrY },
							{ x: tgt.x - U_MARGIN / 2, y: tgtCy },
							{ x: tgt.x, y: tgtCy },
						],
					}
				}
			}

			// ── Straight / same-track skip ────────────────────────────────────────
			else if (sTrack === tTrack && tCol >= sCol) {
				const p1: Point = { x: src.x + src.width, y: srcCy }
				const p2: Point = { x: tgt.x, y: tgtCy }
				// Check if the horizontal segment passes through any intermediate node.
				const crossesIntermediate = [...nodePosMap.values()].some(
					(nl) =>
						nl.id !== sf.sourceRef &&
						nl.id !== sf.targetRef &&
						!boundaryEventIds.has(nl.id) &&
						segmentCrossesNode(p1, p2, nl),
				)
				if (!crossesIntermediate) {
					route = { kind: "straight", points: [p1, p2] }
				} else if (isGwGw) {
					// gw→gw blocked: arch via same side (top or bottom center) of both gateways.
					const archAbovePts: Point[] = [
						{ x: srcCx, y: src.y },
						{ x: srcCx, y: skipAboveY },
						{ x: tgtCx, y: skipAboveY },
						{ x: tgtCx, y: tgt.y },
					]
					if (isClear(archAbovePts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "Z", points: archAbovePts }
					} else {
						const archBelowY = botY + U_MARGIN
						const archBelowPts: Point[] = [
							{ x: srcCx, y: src.y + src.height },
							{ x: srcCx, y: archBelowY },
							{ x: tgtCx, y: archBelowY },
							{ x: tgtCx, y: tgt.y + tgt.height },
						]
						if (isClear(archBelowPts, sf.sourceRef, sf.targetRef)) {
							route = { kind: "Z", points: archBelowPts }
						} else {
							route = {
								kind: "Z",
								points: [
									{ x: src.x + src.width, y: src.y },
									{ x: src.x + src.width, y: skipAboveY },
									{ x: tgt.x, y: skipAboveY },
									{ x: tgt.x, y: tgt.y },
								],
							}
						}
					}
				} else {
					// Route above elements: exit top-right of src, travel at skipAboveY, enter top-left of tgt.
					route = {
						kind: "Z",
						points: [
							{ x: src.x + src.width, y: src.y },
							{ x: src.x + src.width, y: skipAboveY },
							{ x: tgt.x, y: skipAboveY },
							{ x: tgt.x, y: tgt.y },
						],
					}
				}
			}

			// ── Same cell (degenerate) ────────────────────────────────────────────
			else if (sCol === tCol && sTrack === tTrack) {
				route = {
					kind: "straight",
					points: [
						{ x: src.x + src.width, y: srcCy },
						{ x: tgt.x, y: tgtCy },
					],
				}
			}

			// ── Gateway cross-track: prefer matching-side exit ───────────────────
			else if (isGatewayType(srcType) && tTrack !== sTrack) {
				const exitY = tTrack > sTrack ? src.y + src.height : src.y
				const bendX = colCenterX(tCol)
				const vFirstPts: Point[] = [
					{ x: srcCx, y: exitY },
					{ x: srcCx, y: tgtCy },
					{ x: tgt.x, y: tgtCy },
				]
				const eFirstPts: Point[] = [
					{ x: src.x + src.width, y: srcCy },
					{ x: bendX, y: srcCy },
					{ x: bendX, y: tgtCy },
					{ x: tgt.x, y: tgtCy },
				]
				// gw→gw: east-exit first (matches flow direction), then vertical.
				// gw→other: vertical exit first (toward target's track), then east.
				const [first, second] = isGwGw ? [eFirstPts, vFirstPts] : [vFirstPts, eFirstPts]
				if (isClear(first, sf.sourceRef, sf.targetRef)) {
					route = { kind: "L", points: first }
				} else if (isClear(second, sf.sourceRef, sf.targetRef)) {
					route = { kind: "L", points: second }
				} else if (tTrack > sTrack) {
					// South: exit bottom face of gateway, shift east past blockers,
					// then descend — produces a path that visually exits the south vertex.
					const descentX = clearDescentX(srcCx, exitY, tgtCy, sf.sourceRef, sf.targetRef)
					const compactPts: Point[] = [
						{ x: srcCx, y: exitY },
						{ x: descentX, y: exitY },
						{ x: descentX, y: tgtCy },
						{ x: tgt.x, y: tgtCy },
					]
					if (isClear(compactPts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "Z", points: compactPts }
					} else {
						route = {
							kind: "Z",
							points: [
								{ x: srcCx, y: exitY },
								{ x: srcCx, y: botY + U_MARGIN },
								{ x: tgt.x, y: botY + U_MARGIN },
								{ x: tgt.x, y: tgtCy },
							],
						}
					}
				} else {
					route = {
						kind: "Z",
						points: [
							{ x: srcCx, y: exitY },
							{ x: srcCx, y: skipAboveY },
							{ x: tgt.x, y: skipAboveY },
							{ x: tgt.x, y: tgtCy },
						],
					}
				}
			}

			// ── Regular element: east-first L, south-first L, then skip-above Z ──
			else {
				const bendX = colCenterX(tCol)
				const eFirstPts: Point[] = [
					{ x: src.x + src.width, y: srcCy },
					{ x: bendX, y: srcCy },
					{ x: bendX, y: tgtCy },
					{ x: tgt.x, y: tgtCy },
				]
				if (isClear(eFirstPts, sf.sourceRef, sf.targetRef)) {
					route = { kind: "L", points: eFirstPts }
				} else {
					const exitY = tTrack > sTrack ? src.y + src.height : src.y
					const sFirstPts: Point[] = [
						{ x: srcCx, y: exitY },
						{ x: srcCx, y: tgtCy },
						{ x: tgt.x, y: tgtCy },
					]
					if (isClear(sFirstPts, sf.sourceRef, sf.targetRef)) {
						route = { kind: "L", points: sFirstPts }
					} else if (tTrack > sTrack) {
						const descentX = clearDescentX(
							src.x + src.width,
							srcCy,
							tgtCy,
							sf.sourceRef,
							sf.targetRef,
						)
						const compactPts: Point[] = [
							{ x: src.x + src.width, y: srcCy },
							{ x: descentX, y: srcCy },
							{ x: descentX, y: tgtCy },
							{ x: tgt.x, y: tgtCy },
						]
						if (isClear(compactPts, sf.sourceRef, sf.targetRef)) {
							route = { kind: "Z", points: compactPts }
						} else {
							route = {
								kind: "Z",
								points: [
									{ x: src.x + src.width, y: srcCy },
									{ x: src.x + src.width, y: botY + U_MARGIN },
									{ x: tgt.x, y: botY + U_MARGIN },
									{ x: tgt.x, y: tgtCy },
								],
							}
						}
					} else {
						route = {
							kind: "Z",
							points: [
								{ x: src.x + src.width, y: srcCy },
								{ x: src.x + src.width, y: skipAboveY },
								{ x: tgt.x, y: skipAboveY },
								{ x: tgt.x, y: tgtCy },
							],
						}
					}
				}
			}

			occupyPoints(route.points)
			result.push({ edgeId: sf.id, sourceId: sf.sourceRef, targetId: sf.targetRef, ...route })
		}

		return result
	}

	let edges = routeAll()

	// ── Phase 5: Shift nodes crossed by non-straight path segments ────────────
	// Detect segments (non-horizontal-straight) that pass through non-endpoint
	// nodes. Shift those nodes east by one column, propagate, re-anchor boundary
	// events, then re-route. Repeat until stable (max 10 passes).
	for (let iter = 0; iter < 10; iter++) {
		const toShift = new Set<string>()

		for (const edge of edges) {
			if (edge.kind === "straight") continue // skip straight edges
			for (let si = 0; si + 1 < edge.points.length; si++) {
				const p1 = edge.points[si]
				const p2 = edge.points[si + 1]
				if (!p1 || !p2) continue
				for (const [nid, nl] of nodePosMap) {
					if (nid === edge.sourceId || nid === edge.targetId) continue
					if (boundaryEventIds.has(nid)) continue
					if (segmentCrossesNode(p1, p2, nl)) toShift.add(nid)
				}
			}
		}

		if (toShift.size === 0) break

		for (const nid of toShift) {
			const nl = nodePosMap.get(nid)
			if (nl) nodePosMap.set(nid, { ...nl, x: nl.x + COLUMN_WIDTH })
		}

		// Propagate: successors must remain east of their predecessors.
		let propChanged = true
		while (propChanged) {
			propChanged = false
			for (const sf of sequenceFlows) {
				if (backEdgeIds.has(sf.id)) continue
				const srcNl = nodePosMap.get(sf.sourceRef)
				const tgtNl = nodePosMap.get(sf.targetRef)
				if (!srcNl || !tgtNl) continue
				const minX = srcNl.x + srcNl.width
				if (tgtNl.x < minX) {
					const nextCol = Math.ceil(minX / COLUMN_WIDTH)
					nodePosMap.set(sf.targetRef, {
						...tgtNl,
						x: nextCol * COLUMN_WIDTH + Math.max(0, (COLUMN_WIDTH - tgtNl.width) / 2),
					})
					propChanged = true
				}
			}
		}

		// Re-anchor boundary events to their (potentially shifted) host tasks.
		for (const fn of flowNodes) {
			if (fn.type !== "boundaryEvent") continue
			const be = fn as BpmnBoundaryEvent
			const host = nodePosMap.get(be.attachedToRef)
			const beNl = nodePosMap.get(be.id)
			if (!host || !beNl) continue
			nodePosMap.set(be.id, { ...beNl, x: host.x + host.width - beNl.width / 2 })
		}

		// Re-route with updated positions.
		uCorrYUsed.clear()
		edges = routeAll()
	}

	// ── Output ────────────────────────────────────────────────────────────────
	const nodes = [...nodePosMap.values()]
	const width = nodes.reduce((acc, n) => Math.max(acc, n.x + n.width), columnLayout.width)

	return {
		width,
		height: columnLayout.height,
		nodes,
		edges,
		columnBands: columnLayout.columnBands,
		trackBands,
		backTrack,
	}
}
