import type { DirectedGraph } from "./graph.js";

/**
 * Minimize edge crossings using the barycenter heuristic.
 * For each layer, order nodes by the average position of their neighbors
 * in the adjacent layer. Iterates a fixed number of passes.
 */
export function minimizeCrossings(
	layerGroups: string[][],
	graph: DirectedGraph,
	iterations = 4,
): string[][] {
	const result = layerGroups.map((layer) => [...layer]);

	for (let iter = 0; iter < iterations; iter++) {
		// Forward sweep (left to right): order by predecessor positions
		for (let i = 1; i < result.length; i++) {
			orderByBarycenter(result, i, graph, "predecessors");
		}
		// Backward sweep (right to left): order by successor positions
		for (let i = result.length - 2; i >= 0; i--) {
			orderByBarycenter(result, i, graph, "successors");
		}
	}

	return result;
}

function orderByBarycenter(
	layers: string[][],
	layerIndex: number,
	graph: DirectedGraph,
	direction: "predecessors" | "successors",
): void {
	const layer = layers[layerIndex];
	if (!layer) return;
	const adjacentLayer =
		direction === "predecessors" ? layers[layerIndex - 1] : layers[layerIndex + 1];

	if (!adjacentLayer || adjacentLayer.length === 0) return;

	// Build position index for the adjacent layer
	const posIndex = new Map<string, number>();
	for (let i = 0; i < adjacentLayer.length; i++) {
		const adjNode = adjacentLayer[i];
		if (!adjNode) continue;
		posIndex.set(adjNode, i);
	}

	// Compute barycenter for each node in current layer
	const barycenters = new Map<string, number>();
	for (const nodeId of layer) {
		const neighbors =
			direction === "predecessors"
				? (graph.predecessors.get(nodeId) ?? [])
				: (graph.successors.get(nodeId) ?? []);

		const adjacentPositions: number[] = [];
		for (const neighbor of neighbors) {
			const pos = posIndex.get(neighbor);
			if (pos !== undefined) {
				adjacentPositions.push(pos);
			}
		}

		if (adjacentPositions.length > 0) {
			const sum = adjacentPositions.reduce((a, b) => a + b, 0);
			barycenters.set(nodeId, sum / adjacentPositions.length);
		} else {
			// Keep original position for nodes without connections
			barycenters.set(nodeId, layer.indexOf(nodeId));
		}
	}

	// Sort by barycenter, preserving relative order for equal values
	layer.sort((a, b) => (barycenters.get(a) ?? 0) - (barycenters.get(b) ?? 0));
}
