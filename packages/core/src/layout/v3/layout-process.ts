/**
 * v3 layout — Step 6: compute process-level positions.
 *
 * Arranges connector segments and top-level groups in a horizontal sequence.
 * Groups use their GroupLayout dimensions; connector segments use their
 * estimatedWidth / estimatedHeight.  All elements are vertically centered
 * around a common midline.
 */
import type { GroupLayout } from "./layout-group.js"
import type { ProcessFlow } from "./process-flow.js"
import type { AtomicSegment } from "./types.js"

const ELEMENT_GAP = 100 // horizontal gap between adjacent process elements

export interface ProcessPlacement {
	kind: "segment" | "group"
	id: string
	x: number
	y: number
	width: number
	height: number
}

export interface ProcessLayout {
	width: number
	height: number
	placements: ProcessPlacement[]
}

export function layoutProcess(
	flow: ProcessFlow,
	groupLayouts: Map<string, GroupLayout>,
	segments: AtomicSegment[],
): ProcessLayout {
	const segMap = new Map(segments.map((s) => [s.id, s]))
	const placements: ProcessPlacement[] = []
	let x = 0
	let maxH = 0

	for (const el of flow.elements) {
		let w: number
		let h: number

		if (el.kind === "segment") {
			const seg = segMap.get(el.id)
			w = Math.max(seg?.estimatedWidth ?? 100, 80)
			h = Math.max(seg?.estimatedHeight ?? 80, 60)
		} else {
			const layout = groupLayouts.get(el.id)
			w = layout?.width ?? 200
			h = layout?.height ?? 100
		}

		placements.push({ kind: el.kind, id: el.id, x, y: 0, width: w, height: h })
		x += w + ELEMENT_GAP
		maxH = Math.max(maxH, h)
	}

	for (const p of placements) p.y = (maxH - p.height) / 2

	const last = placements[placements.length - 1]
	return {
		width: last ? last.x + last.width : 0,
		height: maxH,
		placements,
	}
}
