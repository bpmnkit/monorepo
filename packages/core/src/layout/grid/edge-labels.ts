import { LABEL_CHAR_WIDTH, LABEL_HEIGHT, LABEL_MIN_WIDTH, LABEL_VERTICAL_OFFSET } from "../types.js"
import type { Bounds, LayoutEdge, LayoutNode, Waypoint } from "../types.js"

/** Collision tolerance in pixels — small overlap allowed for rounding. */
const LABEL_COLLISION_TOLERANCE = 2

/** Number of slide steps along a segment when searching for clear space. */
const LABEL_SLIDE_STEPS = 10

function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return !(
		a.x + a.width + LABEL_COLLISION_TOLERANCE <= b.x ||
		b.x + b.width + LABEL_COLLISION_TOLERANCE <= a.x ||
		a.y + a.height + LABEL_COLLISION_TOLERANCE <= b.y ||
		b.y + b.height + LABEL_COLLISION_TOLERANCE <= a.y
	)
}

/**
 * Collision-aware edge label placement.
 * For each labeled edge, generates candidate positions on the longest segment
 * and picks the first one that doesn't overlap nodes or already-placed labels.
 */
export function placeEdgeLabels(edges: LayoutEdge[], nodeMap: Map<string, LayoutNode>): void {
	const occupied: Bounds[] = []

	// Collect all node bounds as obstacles
	for (const node of nodeMap.values()) {
		occupied.push(node.bounds)
		if (node.labelBounds) occupied.push(node.labelBounds)
	}

	for (const edge of edges) {
		if (!edge.label) continue

		const labelWidth = Math.max(edge.label.length * LABEL_CHAR_WIDTH, LABEL_MIN_WIDTH)
		const labelHeight = LABEL_HEIGHT

		// Find the longest segment
		const { segStart, segEnd } = findLongestSegment(edge.waypoints)

		// Generate candidate positions along the segment
		const candidates = generateLabelCandidates(segStart, segEnd, labelWidth, labelHeight)

		// Pick the first non-overlapping candidate
		let placed = false
		for (const candidate of candidates) {
			if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
				edge.labelBounds = candidate
				occupied.push(candidate)
				placed = true
				break
			}
		}

		// Fallback: slide along segment to find clear space
		if (!placed) {
			const fallback = slideLabelAlongSegment(segStart, segEnd, labelWidth, labelHeight, occupied)
			if (fallback) {
				edge.labelBounds = fallback
				occupied.push(fallback)
			}
			// If no clear position exists, leave labelBounds undefined (text preserved in edge.label)
		}
	}
}

function findLongestSegment(waypoints: Waypoint[]): { segStart: Waypoint; segEnd: Waypoint } {
	let bestLen = 0
	let bestStart: Waypoint = waypoints[0] ?? { x: 0, y: 0 }
	let bestEnd: Waypoint = waypoints[1] ?? waypoints[0] ?? { x: 0, y: 0 }

	for (let i = 1; i < waypoints.length; i++) {
		const a = waypoints[i - 1]
		const b = waypoints[i]
		if (!a || !b) continue
		const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
		if (len > bestLen) {
			bestLen = len
			bestStart = a
			bestEnd = b
		}
	}

	return { segStart: bestStart, segEnd: bestEnd }
}

function generateLabelCandidates(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
): Bounds[] {
	const candidates: Bounds[] = []
	// Positions along segment: 0.5, 0.25, 0.75, 0.33, 0.67
	const fractions = [0.5, 0.25, 0.75, 0.33, 0.67]
	// Perpendicular offsets: above, below
	const offsets = [-LABEL_VERTICAL_OFFSET - labelHeight, LABEL_VERTICAL_OFFSET]

	for (const f of fractions) {
		const px = segStart.x + (segEnd.x - segStart.x) * f
		const py = segStart.y + (segEnd.y - segStart.y) * f

		for (const offset of offsets) {
			// Determine perpendicular direction
			const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1
			let lx: number
			let ly: number

			if (isHorizontal) {
				lx = px - labelWidth / 2
				ly = py + offset
			} else {
				lx = px + offset
				ly = py - labelHeight / 2
			}

			candidates.push({ x: lx, y: ly, width: labelWidth, height: labelHeight })
		}
	}

	return candidates
}

function slideLabelAlongSegment(
	segStart: Waypoint,
	segEnd: Waypoint,
	labelWidth: number,
	labelHeight: number,
	occupied: Bounds[],
): Bounds | undefined {
	const isHorizontal = Math.abs(segEnd.y - segStart.y) < 1

	for (let step = 0; step <= LABEL_SLIDE_STEPS; step++) {
		const t = step / LABEL_SLIDE_STEPS
		const px = segStart.x + (segEnd.x - segStart.x) * t
		const py = segStart.y + (segEnd.y - segStart.y) * t

		const candidate: Bounds = isHorizontal
			? {
					x: px - labelWidth / 2,
					y: py - labelHeight - LABEL_VERTICAL_OFFSET,
					width: labelWidth,
					height: labelHeight,
				}
			: {
					x: px - labelWidth - LABEL_VERTICAL_OFFSET,
					y: py - labelHeight / 2,
					width: labelWidth,
					height: labelHeight,
				}

		if (!occupied.some((ob) => boundsOverlap(candidate, ob))) {
			return candidate
		}
	}

	// No clear position found — skip label placement rather than forcing an overlap
	return undefined
}
