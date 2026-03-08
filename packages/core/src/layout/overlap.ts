import type { Bounds, LayoutNode, LayoutResult } from "./types.js";

/**
 * Assert that no two element bounding boxes overlap and
 * no element overlaps a label.
 * Label-vs-label overlaps are allowed when both labels belong to
 * a node and an edge connected to that node.
 * Throws if any overlap is detected.
 */
export function assertNoOverlap(result: LayoutResult): void {
	const allBounds: Array<{ id: string; kind: string; bounds: Bounds }> = [];

	for (const node of result.nodes) {
		allBounds.push({ id: node.id, kind: "element", bounds: node.bounds });
		if (node.labelBounds) {
			allBounds.push({ id: `${node.id}-label`, kind: "label", bounds: node.labelBounds });
		}
	}

	// Track which nodes are connected to which edges
	const edgeEndpoints = new Set<string>();
	for (const edge of result.edges) {
		if (edge.labelBounds) {
			allBounds.push({ id: `${edge.id}-label`, kind: "label", bounds: edge.labelBounds });
		}
		edgeEndpoints.add(`${edge.id}:${edge.sourceRef}`);
		edgeEndpoints.add(`${edge.id}:${edge.targetRef}`);
	}

	for (let i = 0; i < allBounds.length; i++) {
		for (let j = i + 1; j < allBounds.length; j++) {
			const a = allBounds[i];
			if (!a) continue;
			const b = allBounds[j];
			if (!b) continue;

			// Skip label-to-same-element overlap checks (labels belong to their element)
			if (a.id.replace("-label", "") === b.id.replace("-label", "")) continue;

			// Skip label-vs-label overlaps between a node and its connected edge
			if (a.kind === "label" && b.kind === "label") {
				if (areConnectedLabels(a.id, b.id, edgeEndpoints)) continue;
			}

			// Skip checking elements that are in a parent-child relationship
			// (sub-process children are inside the sub-process bounds by design)

			if (boundsOverlap(a.bounds, b.bounds)) {
				// Check if one is a sub-process containing the other
				if (isContainedWithin(a.bounds, b.bounds) || isContainedWithin(b.bounds, a.bounds)) {
					continue;
				}
				throw new Error(
					`Layout overlap detected: ${a.kind} "${a.id}" overlaps with ${b.kind} "${b.id}"`,
				);
			}
		}
	}
}

/** Check if two labels belong to a node and an edge connected to that node. */
function areConnectedLabels(idA: string, idB: string, edgeEndpoints: Set<string>): boolean {
	const baseA = idA.replace("-label", "");
	const baseB = idB.replace("-label", "");
	return edgeEndpoints.has(`${baseA}:${baseB}`) || edgeEndpoints.has(`${baseB}:${baseA}`);
}

/** Check if two bounding boxes overlap (exclusive of touching edges). */
function boundsOverlap(a: Bounds, b: Bounds): boolean {
	return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Check if bounds `inner` is fully contained within `outer`. */
function isContainedWithin(inner: Bounds, outer: Bounds): boolean {
	return (
		inner.x >= outer.x &&
		inner.y >= outer.y &&
		inner.x + inner.width <= outer.x + outer.width &&
		inner.y + inner.height <= outer.y + outer.height
	);
}
