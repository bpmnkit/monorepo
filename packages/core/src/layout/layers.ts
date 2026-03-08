import type { DirectedGraph } from "./graph.js";
import { topologicalSort } from "./graph.js";

/**
 * Assign layers using longest-path algorithm.
 * Each node gets a layer equal to the longest path from any source to it.
 * This produces a left-to-right layout where layers represent columns.
 */
export function assignLayers(graph: DirectedGraph): Map<string, number> {
	const sorted = topologicalSort(graph);
	const layers = new Map<string, number>();

	// Initialize all nodes at layer 0
	for (const id of sorted) {
		layers.set(id, 0);
	}

	// Forward pass: each node's layer = max(predecessor layers) + 1
	for (const id of sorted) {
		const preds = graph.predecessors.get(id) ?? [];
		if (preds.length > 0) {
			let maxPredLayer = 0;
			for (const pred of preds) {
				const predLayer = layers.get(pred) ?? 0;
				if (predLayer >= maxPredLayer) {
					maxPredLayer = predLayer + 1;
				}
			}
			layers.set(id, maxPredLayer);
		}
	}

	return layers;
}

/**
 * Group nodes by their assigned layer.
 * Returns an array of arrays, where index = layer number.
 */
export function groupByLayer(layers: Map<string, number>): string[][] {
	let maxLayer = 0;
	for (const layer of layers.values()) {
		if (layer > maxLayer) maxLayer = layer;
	}

	const groups: string[][] = [];
	for (let i = 0; i <= maxLayer; i++) {
		groups.push([]);
	}

	for (const [id, layer] of layers) {
		groups[layer]?.push(id);
	}

	return groups;
}
