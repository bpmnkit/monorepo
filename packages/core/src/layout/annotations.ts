// packages/core/src/layout/annotations.ts
/**
 * Text-annotation packer. Port of the layout phase of
 * tmp/01-annotation-layouting.cjs (lines 96-389), adapted to operate on
 * already-parsed LayoutNode[] / Bounds instead of regex-parsed BPMN DI
 * shapes. Constants, formulas and control flow match the reference exactly.
 */
import type { BpmnProcess } from "../bpmn/bpmn-model.js"
import type { Bounds, LayoutNode, Waypoint } from "./types.js"

const ANN_WIDTH = 200 // fixed annotation width
const FONT_CHAR_WIDTH = 6.4 // approximate avg char width @ 12px Arial
const FONT_LINE_HEIGHT = 14.4 // line-height @ 12px
const PADDING_X = 18 // 9px each side
const PADDING_Y = 14 // top + bottom
const ANN_GAP = 20 // min gap between two annotations
const ELEMENT_GAP = 30 // min gap between annotation and a non-annotation shape
const PREFERRED_OFFSET = 50 // preferred gap to associated element
const MIN_HEIGHT = 30
const HORIZONTAL_SHIFTS = [0, 60, -60, 120, -120, 180, -180, 240, -240]
/** Cost added to a candidate whose association line would cross a shape. */
const BLOCKED_LINE_COST = 10_000

function computeHeight(text: string, width: number): number {
	if (!text || !text.trim()) return MIN_HEIGHT
	const inner = Math.max(40, width - PADDING_X)
	const cpl = Math.max(1, Math.floor(inner / FONT_CHAR_WIDTH))
	let totalLines = 0
	for (const para of text.split(/\r?\n/)) {
		const words = para.split(/\s+/).filter(Boolean)
		if (words.length === 0) {
			totalLines += 1
			continue
		}
		let lineLen = 0
		let lines = 1
		for (const w of words) {
			let len = w.length
			// Hard-break very long words
			while (len > cpl) {
				if (lineLen > 0) {
					lines += 1
					lineLen = 0
				}
				lines += 1
				len -= cpl
			}
			if (lineLen === 0) lineLen = len
			else if (lineLen + 1 + len <= cpl) lineLen += 1 + len
			else {
				lines += 1
				lineLen = len
			}
		}
		totalLines += lines
	}
	return Math.max(MIN_HEIGHT, Math.ceil(totalLines * FONT_LINE_HEIGHT + PADDING_Y))
}

function center(b: Bounds): { cx: number; cy: number } {
	return { cx: b.x + b.width / 2, cy: b.y + b.height / 2 }
}

function clampX(x: number, b: Bounds): number {
	return Math.max(b.x, Math.min(x, b.x + b.width))
}

function clampY(y: number, b: Bounds): number {
	return Math.max(b.y, Math.min(y, b.y + b.height))
}

/** Modal (most-common, 20px-bucketed) center-Y of large (task-sized) nodes. */
function computeMainFlowY(layoutNodes: LayoutNode[]): number {
	const cys = layoutNodes
		.filter((n) => n.bounds.height >= 60)
		.map((n) => n.bounds.y + n.bounds.height / 2)
	if (cys.length === 0) return 370
	const buckets = new Map<number, number>()
	for (const cy of cys) {
		const k = Math.round(cy / 20) * 20
		buckets.set(k, (buckets.get(k) ?? 0) + 1)
	}
	const sortedKeys = [...buckets.keys()].sort((a, b) => a - b)
	let bestKey = sortedKeys[0] as number
	let bestCount = -1
	for (const k of sortedKeys) {
		const count = buckets.get(k) as number
		if (count > bestCount) {
			bestCount = count
			bestKey = k
		}
	}
	return bestKey
}

/** Elements at or above the main flow keep their annotation "above"; elements clearly below get "below". */
function naturalSide(elemBounds: Bounds, mainFlowY: number): "above" | "below" {
	const cy = elemBounds.y + elemBounds.height / 2
	return cy > mainFlowY + 60 ? "below" : "above"
}

interface PackItem {
	id: string
	bounds: Bounds
	side: "above" | "below"
	linked: LayoutNode
}

function overlapsPadded(a: Bounds, others: Bounds[], padding: number): boolean {
	for (const b of others) {
		if (
			a.x - padding < b.x + b.width &&
			a.x + a.width + padding > b.x &&
			a.y - padding < b.y + b.height &&
			a.y + a.height + padding > b.y
		)
			return true
	}
	return false
}

/**
 * Sizes and packs text annotations around their linked elements without
 * overlapping each other or any other layout node (incl. node labels).
 * Returns final Bounds per annotation id; annotations with no resolvable
 * association target (no association at all, or the linked element isn't
 * in `layoutNodes`) still get an entry — they're placed at a fixed fallback
 * origin and pushed clear of everything else already placed, mirroring the
 * pre-port fallback in auto-layout.ts's computeAnnotationLocalBounds.
 */
export function packAnnotations(
	process: BpmnProcess,
	layoutNodes: LayoutNode[],
): Map<string, Bounds> {
	const result = new Map<string, Bounds>()
	if (process.textAnnotations.length === 0) return result

	const annotationIds = new Set(process.textAnnotations.map((a) => a.id))
	const elementForAnnotation = new Map<string, string>()
	for (const assoc of process.associations) {
		if (annotationIds.has(assoc.targetRef))
			elementForAnnotation.set(assoc.targetRef, assoc.sourceRef)
		else if (annotationIds.has(assoc.sourceRef))
			elementForAnnotation.set(assoc.sourceRef, assoc.targetRef)
	}

	const nodeById = new Map(layoutNodes.map((n) => [n.id, n]))
	const mainFlowY = computeMainFlowY(layoutNodes)

	const items: PackItem[] = []
	const unlinked: Array<{ id: string; width: number; height: number }> = []
	for (const ann of process.textAnnotations) {
		const linkedId = elementForAnnotation.get(ann.id)
		const linked = linkedId ? nodeById.get(linkedId) : undefined
		const width = ANN_WIDTH
		const height = computeHeight(ann.text ?? "", width)
		if (!linked) {
			unlinked.push({ id: ann.id, width, height })
			continue
		}
		const side = naturalSide(linked.bounds, mainFlowY)
		const lc = center(linked.bounds)
		items.push({
			id: ann.id,
			bounds: { x: Math.round(lc.cx - width / 2), y: 0, width, height },
			side,
			linked,
		})
	}

	const obstacles: Bounds[] = []
	for (const n of layoutNodes) {
		obstacles.push(n.bounds)
		if (n.labelBounds) obstacles.push(n.labelBounds)
	}

	function packSide(side: "above" | "below") {
		const list = items
			.filter((it) => it.side === side)
			.sort((a, b) => center(a.linked.bounds).cx - center(b.linked.bounds).cx)

		const placed: PackItem[] = []
		for (const item of list) {
			const linked = item.linked
			const lc = center(linked.bounds)
			const naturalX = Math.round(lc.cx - item.bounds.width / 2)
			const naturalY =
				side === "above"
					? linked.bounds.y - PREFERRED_OFFSET - item.bounds.height
					: linked.bounds.y + linked.bounds.height + PREFERRED_OFFSET

			let best = { x: naturalX, y: naturalY, cost: Number.POSITIVE_INFINITY }
			for (const dx of HORIZONTAL_SHIFTS) {
				const candidateX = naturalX + dx
				const ax1 = candidateX
				const ax2 = candidateX + item.bounds.width

				const intervals: Array<{ top: number; bottom: number }> = []
				for (const other of placed) {
					const ox1 = other.bounds.x
					const ox2 = ox1 + other.bounds.width
					if (ax2 + ANN_GAP <= ox1 || ox2 + ANN_GAP <= ax1) continue
					intervals.push({
						top: other.bounds.y - ANN_GAP,
						bottom: other.bounds.y + other.bounds.height + ANN_GAP,
					})
				}
				for (const sh of obstacles) {
					const sx1 = sh.x
					const sx2 = sx1 + sh.width
					if (ax2 + ELEMENT_GAP <= sx1 || sx2 + ELEMENT_GAP <= ax1) continue
					intervals.push({ top: sh.y - ELEMENT_GAP, bottom: sh.y + sh.height + ELEMENT_GAP })
				}

				let y = naturalY
				let changed = true
				while (changed) {
					changed = false
					for (const iv of intervals) {
						if (y + item.bounds.height > iv.top && y < iv.bottom) {
							y = side === "above" ? iv.top - item.bounds.height : iv.bottom
							changed = true
						}
					}
				}

				// A clear box is not enough: the association line drawn back to the
				// element must not cut through anything either.
				const candidate: Bounds = {
					x: candidateX,
					y,
					width: item.bounds.width,
					height: item.bounds.height,
				}
				const { pElem, pAnn } = associationWaypoints(linked.bounds, candidate)
				const crosses = obstacles.some(
					(sh) => sh !== linked.bounds && segmentHitsBox(pElem, pAnn, sh),
				)
				const cost =
					Math.hypot(candidateX - naturalX, y - naturalY) + (crosses ? BLOCKED_LINE_COST : 0)
				if (cost < best.cost) best = { x: candidateX, y, cost }
			}

			item.bounds.x = Math.round(best.x)
			item.bounds.y = Math.round(best.y)
			placed.push(item)
		}
	}

	packSide("above")
	packSide("below")

	for (const item of items) result.set(item.id, item.bounds)

	// Fallback placement for annotations with no resolvable linked element:
	// start at a fixed origin and push straight down until clear of every
	// node/label obstacle and every already-placed annotation (linked or
	// unlinked), so they never overlap anything.
	const annObstacles = items.map((it) => it.bounds)
	for (const u of unlinked) {
		const bounds: Bounds = { x: 0, y: 0, width: u.width, height: u.height }
		while (
			overlapsPadded(bounds, obstacles, ELEMENT_GAP) ||
			overlapsPadded(bounds, annObstacles, ANN_GAP)
		) {
			bounds.y += u.height + ANN_GAP
		}
		annObstacles.push(bounds)
		result.set(u.id, bounds)
	}

	return result
}

/** Whether a straight segment passes through a box. */
function segmentHitsBox(a: Waypoint, b: Waypoint, box: Bounds): boolean {
	const minX = Math.min(a.x, b.x)
	const maxX = Math.max(a.x, b.x)
	const minY = Math.min(a.y, b.y)
	const maxY = Math.max(a.y, b.y)
	if (maxX <= box.x || box.x + box.width <= minX) return false
	if (maxY <= box.y || box.y + box.height <= minY) return false
	if (a.x === b.x || a.y === b.y) return true

	// Diagonal: the box is hit unless all four corners fall on one side of it.
	const side = (p: { x: number; y: number }): number =>
		Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x))
	const corners = [
		{ x: box.x, y: box.y },
		{ x: box.x + box.width, y: box.y },
		{ x: box.x + box.width, y: box.y + box.height },
		{ x: box.x, y: box.y + box.height },
	]
	const first = side(corners[0] ?? { x: 0, y: 0 })
	return corners.some((corner) => side(corner) !== first)
}

/**
 * Edge-to-edge, clamped association waypoints between a linked element and
 * its annotation. Port of `chooseWaypoints` (tmp/01-annotation-layouting.cjs:365-389).
 */
export function associationWaypoints(
	elementBounds: Bounds,
	annotationBounds: Bounds,
): { pElem: Waypoint; pAnn: Waypoint } {
	const ec = center(elementBounds)
	const ac = center(annotationBounds)
	if (annotationBounds.y + annotationBounds.height <= elementBounds.y) {
		return {
			pElem: { x: clampX(ac.cx, elementBounds), y: elementBounds.y },
			pAnn: { x: clampX(ec.cx, annotationBounds), y: annotationBounds.y + annotationBounds.height },
		}
	}
	if (annotationBounds.y >= elementBounds.y + elementBounds.height) {
		return {
			pElem: { x: clampX(ac.cx, elementBounds), y: elementBounds.y + elementBounds.height },
			pAnn: { x: clampX(ec.cx, annotationBounds), y: annotationBounds.y },
		}
	}
	if (annotationBounds.x >= elementBounds.x + elementBounds.width) {
		return {
			pElem: { x: elementBounds.x + elementBounds.width, y: clampY(ac.cy, elementBounds) },
			pAnn: { x: annotationBounds.x, y: clampY(ec.cy, annotationBounds) },
		}
	}
	return {
		pElem: { x: elementBounds.x, y: clampY(ac.cy, elementBounds) },
		pAnn: { x: annotationBounds.x + annotationBounds.width, y: clampY(ec.cy, annotationBounds) },
	}
}
