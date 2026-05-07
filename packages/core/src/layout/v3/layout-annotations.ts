/**
 * v3 layout — Step 11: text annotation placement.
 *
 * For each text annotation linked to a flow node via an association, finds the
 * nearest free grid cell (no other node or annotation occupies it) and positions
 * the annotation there.  Search order: N, S, NW, NE, SW, SE — then repeat with
 * one additional track further north/south per iteration.
 *
 * Annotation width is estimated from the character count of the text, rounded up
 * to a whole number of columns.  One annotation per grid cell; cells occupied by
 * existing flow nodes or already-placed annotations are skipped.
 */
import type { BpmnAssociation, BpmnTextAnnotation } from "../../bpmn/bpmn-model.js"
import { COLUMN_WIDTH } from "./layout-columns.js"
import type { PathLayout, Point } from "./layout-paths.js"
import { TRACK_HEIGHT } from "./layout-tracks.js"

// Average px per character (monospace approximation).
const CHAR_WIDTH = 7
// Padding inside annotation box (left/right total).
const ANN_PAD_X = 16
// Fixed annotation height — shorter than a full track.
const ANN_HEIGHT = 80
// Maximum annotation width in grid columns.
const MAX_ANN_COLS = 3
// Max search depth (expands N/S by this many extra tracks beyond the direct neighbour).
const MAX_DEPTH = 5

export interface AnnotationNodeLayout {
	id: string
	x: number
	y: number
	width: number
	height: number
	text: string
}

export interface AnnotationEdge {
	associationId: string
	anchorId: string
	annotationId: string
	/** Two-point connector: from anchor to annotation (or nearest edges). */
	points: Point[]
}

export interface AnnotationLayout extends PathLayout {
	annotationNodes: AnnotationNodeLayout[]
	annotationEdges: AnnotationEdge[]
}

export function layoutWithAnnotations(
	pathLayout: PathLayout,
	textAnnotations: BpmnTextAnnotation[],
	associations: BpmnAssociation[],
): AnnotationLayout {
	if (textAnnotations.length === 0) {
		return { ...pathLayout, annotationNodes: [], annotationEdges: [] }
	}

	const { columnBands, trackBands, nodes } = pathLayout

	const trackMin = trackBands.length > 0 ? Math.min(...trackBands.map((b) => b.track)) : 0
	const minBand = trackBands.find((b) => b.track === trackMin)
	const minBandY = minBand?.y ?? 0

	// ── Grid helpers ──────────────────────────────────────────────────────────

	function colOf(nx: number, nw: number): number {
		const cx = nx + nw / 2
		for (const b of columnBands) if (cx >= b.x && cx < b.x + COLUMN_WIDTH) return b.column
		return Math.floor(cx / COLUMN_WIDTH)
	}

	function trackOf(ny: number, nh: number): number {
		const cy = ny + nh / 2
		for (const b of trackBands) if (cy >= b.y && cy < b.y + TRACK_HEIGHT) return b.track
		return Math.floor((cy - minBandY) / TRACK_HEIGHT) + trackMin
	}

	function cellX(col: number): number {
		const b = columnBands.find((b) => b.column === col)
		return b ? b.x : col * COLUMN_WIDTH
	}

	function cellY(track: number): number {
		const b = trackBands.find((b) => b.track === track)
		if (b) return b.y
		return minBandY + (track - trackMin) * TRACK_HEIGHT
	}

	// ── Occupied cells ────────────────────────────────────────────────────────
	// A cell key is "col,track"; multi-column nodes occupy multiple keys.

	const occupied = new Set<string>()

	for (const n of nodes) {
		const col = colOf(n.x, n.width)
		const track = trackOf(n.y, n.height)
		const span = Math.max(1, Math.ceil(n.width / COLUMN_WIDTH))
		for (let c = col; c < col + span; c++) occupied.add(`${c},${track}`)
	}

	function isFree(col: number, track: number, widthInCols: number): boolean {
		for (let c = col; c < col + widthInCols; c++) {
			if (occupied.has(`${c},${track}`)) return false
		}
		return true
	}

	function markOccupied(col: number, track: number, widthInCols: number): void {
		for (let c = col; c < col + widthInCols; c++) occupied.add(`${c},${track}`)
	}

	// ── Candidate generation ──────────────────────────────────────────────────
	// Order per depth: N, S, NW, NE, SW, SE
	// Each depth d uses track offset d+1 for N/S variants and column offset 1
	// for the diagonal variants.  Column offset stays fixed at ±1 as the user
	// asked for "one additional track to the north/south" not extra columns.

	function buildCandidates(col: number, track: number): Array<[number, number]> {
		const out: Array<[number, number]> = []
		for (let d = 0; d < MAX_DEPTH; d++) {
			const nt = track - (d + 1)
			const st = track + (d + 1)
			out.push([col, nt]) // N
			out.push([col, st]) // S
			out.push([col - 1, nt]) // NW
			out.push([col + 1, nt]) // NE
			out.push([col - 1, st]) // SW
			out.push([col + 1, st]) // SE
		}
		return out
	}

	// ── Association edge ─────────────────────────────────────────────────────
	// Connect from the anchor face closest to the annotation (by separation distance),
	// centering on that face.  Produces straight or L-shaped connectors.

	function buildEdge(
		anchor: (typeof nodes)[0],
		ax: number,
		ay: number,
		aw: number,
		ah: number,
	): Point[] {
		const anchorCx = anchor.x + anchor.width / 2
		const anchorCy = anchor.y + anchor.height / 2
		const annCx = ax + aw / 2
		const annCy = ay + ah / 2

		// Signed distance from annotation center to each anchor face (positive = annotation on that side).
		const dN = anchor.y - annCy
		const dS = annCy - (anchor.y + anchor.height)
		const dW = anchor.x - annCx
		const dE = annCx - (anchor.x + anchor.width)

		// Pick the face with the largest positive separation.
		const best = [
			{ face: "N" as const, d: dN, srcX: anchorCx, srcY: anchor.y, tgtX: annCx, tgtY: ay + ah },
			{
				face: "S" as const,
				d: dS,
				srcX: anchorCx,
				srcY: anchor.y + anchor.height,
				tgtX: annCx,
				tgtY: ay,
			},
			{ face: "W" as const, d: dW, srcX: anchor.x, srcY: anchorCy, tgtX: ax + aw, tgtY: annCy },
			{
				face: "E" as const,
				d: dE,
				srcX: anchor.x + anchor.width,
				srcY: anchorCy,
				tgtX: ax,
				tgtY: annCy,
			},
		]
			.filter((c) => c.d >= 0)
			.sort((a, b) => b.d - a.d)[0] ?? {
			face: "E" as const,
			d: 0,
			srcX: anchor.x + anchor.width,
			srcY: anchorCy,
			tgtX: ax,
			tgtY: annCy,
		}

		const { face, srcX, srcY, tgtX, tgtY } = best

		if (Math.abs(srcX - tgtX) < 4 || Math.abs(srcY - tgtY) < 4) {
			return [
				{ x: srcX, y: srcY },
				{ x: tgtX, y: tgtY },
			]
		}

		// L-shape: vertical-first for N/S faces, horizontal-first for E/W faces.
		if (face === "N" || face === "S") {
			return [
				{ x: srcX, y: srcY },
				{ x: srcX, y: tgtY },
				{ x: tgtX, y: tgtY },
			]
		}
		return [
			{ x: srcX, y: srcY },
			{ x: tgtX, y: srcY },
			{ x: tgtX, y: tgtY },
		]
	}

	// ── Anchor lookup ─────────────────────────────────────────────────────────

	const nodeMap = new Map(nodes.map((n) => [n.id, n]))
	const annSet = new Set(textAnnotations.map((a) => a.id))

	// For each annotation, find the associated flow node.
	const annToAnchor = new Map<string, string>() // annotationId → nodeId
	const annToAssocId = new Map<string, string>() // annotationId → associationId

	for (const assoc of associations) {
		if (annSet.has(assoc.sourceRef) && nodeMap.has(assoc.targetRef)) {
			annToAnchor.set(assoc.sourceRef, assoc.targetRef)
			annToAssocId.set(assoc.sourceRef, assoc.id)
		} else if (annSet.has(assoc.targetRef) && nodeMap.has(assoc.sourceRef)) {
			annToAnchor.set(assoc.targetRef, assoc.sourceRef)
			annToAssocId.set(assoc.targetRef, assoc.id)
		}
	}

	// ── Place annotations ─────────────────────────────────────────────────────

	const annotationNodes: AnnotationNodeLayout[] = []
	const annotationEdges: AnnotationEdge[] = []

	for (const ann of textAnnotations) {
		const anchorId = annToAnchor.get(ann.id)
		if (!anchorId) continue

		const anchor = nodeMap.get(anchorId)
		if (!anchor) continue

		const text = ann.text ?? ""
		const widthInCols = Math.min(
			MAX_ANN_COLS,
			Math.max(1, Math.ceil((text.length * CHAR_WIDTH) / COLUMN_WIDTH)),
		)

		const anchorCol = colOf(anchor.x, anchor.width)
		const anchorTrack = trackOf(anchor.y, anchor.height)

		// Find first free candidate.
		let placed: { col: number; track: number } | null = null
		for (const [col, track] of buildCandidates(anchorCol, anchorTrack)) {
			if (col < 0) continue
			if (isFree(col, track, widthInCols)) {
				placed = { col, track }
				break
			}
		}

		// Last-resort: place two tracks north of anchor regardless of occupancy.
		if (!placed) placed = { col: anchorCol, track: anchorTrack - (MAX_DEPTH + 1) }

		markOccupied(placed.col, placed.track, widthInCols)

		const annX = cellX(placed.col) + ANN_PAD_X / 2
		const annW = widthInCols * COLUMN_WIDTH - ANN_PAD_X
		const annY = cellY(placed.track) + (TRACK_HEIGHT - ANN_HEIGHT) / 2

		annotationNodes.push({
			id: ann.id,
			x: annX,
			y: annY,
			width: annW,
			height: ANN_HEIGHT,
			text,
		})

		const points = buildEdge(anchor, annX, annY, annW, ANN_HEIGHT)

		annotationEdges.push({
			associationId: annToAssocId.get(ann.id) ?? ann.id,
			anchorId,
			annotationId: ann.id,
			points,
		})
	}

	// ── Update canvas bounds ──────────────────────────────────────────────────

	const width = annotationNodes.reduce((acc, n) => Math.max(acc, n.x + n.width), pathLayout.width)
	const minY = annotationNodes.reduce((acc, n) => Math.min(acc, n.y), 0)
	const height = annotationNodes.reduce(
		(acc, n) => Math.max(acc, n.y + n.height - minY),
		pathLayout.height,
	)

	return {
		...pathLayout,
		width,
		height,
		annotationNodes,
		annotationEdges,
	}
}
