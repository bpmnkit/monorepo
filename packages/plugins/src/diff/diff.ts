import type { BpmnDefinitions, BpmnDiEdge, BpmnDiShape } from "@bpmnkit/core"
import { diffSemantics } from "@bpmnkit/core"

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

/**
 * Indexes every element that carries diagram interchange, in any plane, by the
 * geometry that decides whether it moved.
 */
function indexLayout(definitions: BpmnDefinitions): Map<string, string> {
	const index = new Map<string, string>()
	for (const diagram of definitions.diagrams) {
		for (const shape of diagram.plane.shapes) index.set(shape.bpmnElement, shapeKey(shape))
		for (const edge of diagram.plane.edges) index.set(edge.bpmnElement, edgeKey(edge))
	}
	return index
}

/**
 * Compares two BPMN models and reports what a reviewer would see change.
 *
 * The semantic half is `diffSemantics` from `@bpmnkit/core`, which excludes
 * diagram interchange by design — so a pure layout change reads as "no change"
 * there. This adds the layout half back as its own category, which is the
 * difference between a model diff and a *diagram* diff.
 *
 * @param before - The earlier model.
 * @param after - The later model.
 *
 * @example
 * ```typescript
 * const result = computeBpmnDiff(Bpmn.parse(oldXml), Bpmn.parse(newXml));
 * console.log(`${result.changed.length} changed, ${result.moved.length} moved`);
 * ```
 */
export function computeBpmnDiff(before: BpmnDefinitions, after: BpmnDefinitions): BpmnDiffResult {
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
	for (const [id, key] of afterLayout) {
		if (changedIds.has(id)) continue
		const previous = beforeLayout.get(id)
		if (previous !== undefined && previous !== key) moved.push(id)
	}
	moved.sort()

	return {
		added,
		removed,
		changed,
		moved,
		total: added.length + removed.length + changed.length + moved.length,
	}
}
