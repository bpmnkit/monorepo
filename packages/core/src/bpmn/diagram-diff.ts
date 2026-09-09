import type { BpmnDefinitions, BpmnDiEdge, BpmnDiShape } from "./bpmn-model.js"
import { diffSemantics } from "./semantic-hash.js"

/**
 * How an element differs between two versions of a diagram.
 *
 * - `added` — present only in the later model.
 * - `removed` — present only in the earlier model.
 * - `changed` — the model changed (a property, an expression, an extension).
 * - `moved` — the model is identical but the picture is not: position, size,
 *   waypoints, label placement, or a diagram flag such as collapsed/expanded.
 *
 * An element that is both changed and moved is reported as `changed` — a
 * semantic change is what a reviewer needs to see first.
 */
export type BpmnDiffCategory = "added" | "removed" | "changed" | "moved"

/**
 * How many differences fall on one diagram plane.
 *
 * A plane is a drawing surface: the process itself, and one more for each
 * collapsed sub-process. A viewer shows one at a time, so a change inside a
 * collapsed sub-process is invisible until the reader drills into it — these
 * counts are what tells them there is something down there to look at.
 */
export interface BpmnDiffPlaneSummary {
	/** The plane's `bpmnElement` — the process or sub-process it draws. */
	readonly id: string
	readonly added: number
	readonly removed: number
	readonly changed: number
	readonly moved: number
	readonly total: number
}

/**
 * What changed between two diagrams, as element ids per category.
 *
 * Restricted to elements that carry diagram interchange on at least one side —
 * those are exactly the elements a canvas can show. A change with nothing to
 * draw (a `targetNamespace`, an exporter attribute) is not a visual diff and is
 * left out, so the counts match what the reviewer actually sees.
 */
export interface BpmnDiffResult {
	readonly added: readonly string[]
	readonly removed: readonly string[]
	readonly changed: readonly string[]
	readonly moved: readonly string[]
	/** `added.length + removed.length + changed.length + moved.length`. */
	readonly total: number
	/** Per-plane breakdown, planes with no differences omitted, ordered by id. */
	readonly planes: readonly BpmnDiffPlaneSummary[]
}

/**
 * Rounds to two decimals so re-serialising a file cannot register as a move.
 * BPMN coordinates are usually integers, but a round trip through a modeler can
 * leave `100` as `100.00000000000001`.
 */
function round(value: number): number {
	return Math.round(value * 100) / 100
}

function shapeKey(shape: BpmnDiShape): string {
	const { x, y, width, height } = shape.bounds
	const label = shape.label?.bounds
	return [
		round(x),
		round(y),
		round(width),
		round(height),
		shape.isExpanded ?? "",
		shape.isMarkerVisible ?? "",
		shape.isHorizontal ?? "",
		label === undefined ? "" : `${round(label.x)},${round(label.y)}`,
	].join("|")
}

function edgeKey(edge: BpmnDiEdge): string {
	const label = edge.label?.bounds
	return [
		edge.waypoints.map((p) => `${round(p.x)},${round(p.y)}`).join(" "),
		label === undefined ? "" : `${round(label.x)},${round(label.y)}`,
	].join("|")
}

/** Where an element is drawn, and the geometry that decides whether it moved. */
interface Placement {
	readonly plane: string
	readonly key: string
}

/** Indexes every element that carries diagram interchange, in any plane. */
function indexLayout(definitions: BpmnDefinitions): Map<string, Placement> {
	const index = new Map<string, Placement>()
	for (const diagram of definitions.diagrams) {
		const plane = diagram.plane.bpmnElement
		for (const shape of diagram.plane.shapes) {
			index.set(shape.bpmnElement, { plane, key: shapeKey(shape) })
		}
		for (const edge of diagram.plane.edges) {
			index.set(edge.bpmnElement, { plane, key: edgeKey(edge) })
		}
	}
	return index
}

/** Mutable accumulator behind {@link BpmnDiffPlaneSummary}. */
type PlaneCounts = { [K in BpmnDiffCategory]: number }

function summarisePlanes(
	assignments: ReadonlyArray<readonly [string, BpmnDiffCategory]>,
): BpmnDiffPlaneSummary[] {
	const counts = new Map<string, PlaneCounts>()
	for (const [plane, category] of assignments) {
		const entry = counts.get(plane) ?? { added: 0, removed: 0, changed: 0, moved: 0 }
		entry[category] += 1
		counts.set(plane, entry)
	}

	return [...counts.entries()]
		.map(([id, c]) => ({
			id,
			...c,
			total: c.added + c.removed + c.changed + c.moved,
		}))
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Compares two BPMN diagrams and reports what a reviewer would see change.
 *
 * The semantic half is {@link diffSemantics}, which excludes diagram
 * interchange by design — so a pure layout change reads as "no change" there.
 * This adds the layout half back as its own category, which is the difference
 * between a model diff and a *diagram* diff.
 *
 * @param before - The earlier model.
 * @param after - The later model.
 *
 * @example
 * ```typescript
 * const result = diffDiagram(Bpmn.parse(oldXml), Bpmn.parse(newXml));
 * console.log(`${result.changed.length} changed, ${result.moved.length} moved`);
 * for (const plane of result.planes) {
 *   console.log(`  ${plane.id}: ${plane.total}`);
 * }
 * ```
 */
export function diffDiagram(before: BpmnDefinitions, after: BpmnDefinitions): BpmnDiffResult {
	const beforeLayout = indexLayout(before)
	const afterLayout = indexLayout(after)

	/** Ids a canvas could draw on one side or the other. */
	const drawable = new Set([...beforeLayout.keys(), ...afterLayout.keys()])

	const semantic = diffSemantics(before, after)
	const added = semantic.added.filter((id) => drawable.has(id))
	const removed = semantic.removed.filter((id) => drawable.has(id))
	const changed = semantic.changed.map((entry) => entry.id).filter((id) => drawable.has(id))

	const changedIds = new Set(changed)
	const moved: string[] = []
	for (const [id, placement] of afterLayout) {
		if (changedIds.has(id)) continue
		const previous = beforeLayout.get(id)
		if (previous !== undefined && previous.key !== placement.key) moved.push(id)
	}
	moved.sort()

	// An element is attributed to the plane that still draws it; only a removal
	// has no later plane to belong to.
	const planeOf = (id: string): string | undefined =>
		(afterLayout.get(id) ?? beforeLayout.get(id))?.plane

	const assignments: Array<readonly [string, BpmnDiffCategory]> = []
	for (const [category, ids] of [
		["added", added],
		["removed", removed],
		["changed", changed],
		["moved", moved],
	] as const) {
		for (const id of ids) {
			const plane = planeOf(id)
			if (plane !== undefined) assignments.push([plane, category])
		}
	}

	return {
		added,
		removed,
		changed,
		moved,
		total: added.length + removed.length + changed.length + moved.length,
		planes: summarisePlanes(assignments),
	}
}
