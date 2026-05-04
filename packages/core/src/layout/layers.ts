import type { BpmnSequenceFlow } from "../bpmn/bpmn-model.js"
import type { DirectedGraph } from "./graph.js"
import { topologicalSort } from "./graph.js"

/**
 * Assign layers using longest-path algorithm.
 * Each node gets a layer equal to the longest path from any source to it.
 * This produces a left-to-right layout where layers represent columns.
 */
export function assignLayers(graph: DirectedGraph): Map<string, number> {
	const sorted = topologicalSort(graph)
	const layers = new Map<string, number>()

	// Initialize all nodes at layer 0
	for (const id of sorted) {
		layers.set(id, 0)
	}

	// Forward pass: each node's layer = max(predecessor layers) + 1
	for (const id of sorted) {
		const preds = graph.predecessors.get(id) ?? []
		if (preds.length > 0) {
			let maxPredLayer = 0
			for (const pred of preds) {
				const predLayer = layers.get(pred) ?? 0
				if (predLayer >= maxPredLayer) {
					maxPredLayer = predLayer + 1
				}
			}
			layers.set(id, maxPredLayer)
		}
	}

	return layers
}

/**
 * Group nodes by their assigned layer.
 * Returns an array of arrays, where index = layer number.
 */
export function groupByLayer(layers: Map<string, number>): string[][] {
	let maxLayer = 0
	for (const layer of layers.values()) {
		if (layer > maxLayer) maxLayer = layer
	}

	const groups: string[][] = []
	for (let i = 0; i <= maxLayer; i++) {
		groups.push([])
	}

	for (const [id, layer] of layers) {
		groups[layer]?.push(id)
	}

	return groups
}

export interface DummyInjectionResult {
	augmentedGraph: DirectedGraph
	augmentedLayers: Map<string, number>
	/** Maps flow ID → ordered dummy node IDs from source toward target (excludes real endpoints). */
	dummyChains: Map<string, string[]>
}

/**
 * Insert dummy nodes for edges that skip more than one layer.
 * Each skipped layer gets a 0×0 virtual node; these are used as routing waypoints
 * by the crossing-minimizer and edge router, then filtered from output.
 *
 * Back-edges are excluded — they use above/below routing instead.
 */
export function injectDummyNodes(
	graph: DirectedGraph,
	layers: Map<string, number>,
	sequenceFlows: BpmnSequenceFlow[],
	backEdgeIds: ReadonlySet<string>,
): DummyInjectionResult {
	// Clone adjacency lists so we don't mutate the DAG
	const augSucc = new Map<string, string[]>()
	const augPred = new Map<string, string[]>()
	for (const id of graph.nodes) {
		augSucc.set(id, [...(graph.successors.get(id) ?? [])])
		augPred.set(id, [...(graph.predecessors.get(id) ?? [])])
	}
	const augLayers = new Map(layers)
	const allNodeIds = [...graph.nodes]
	const dummyChains = new Map<string, string[]>()

	for (const flow of sequenceFlows) {
		if (backEdgeIds.has(flow.id)) continue

		const srcLayer = layers.get(flow.sourceRef) ?? 0
		const tgtLayer = layers.get(flow.targetRef) ?? 0
		const span = tgtLayer - srcLayer
		if (span <= 1) continue

		// One dummy per skipped intermediate layer
		const chain: string[] = []
		for (let l = srcLayer + 1; l < tgtLayer; l++) {
			chain.push(`__dummy_${flow.id}_${l}`)
		}
		dummyChains.set(flow.id, chain)

		// Register dummy nodes
		for (let i = 0; i < chain.length; i++) {
			const dummyId = chain[i]
			if (!dummyId) continue
			const dummyLayer = srcLayer + 1 + i
			augSucc.set(dummyId, [])
			augPred.set(dummyId, [])
			augLayers.set(dummyId, dummyLayer)
			allNodeIds.push(dummyId)
		}

		// Rewire: source → d0 → d1 → … → target
		// Replace target in source's successor list with first dummy
		const firstDummy = chain[0]
		if (!firstDummy) continue
		const srcSucc = augSucc.get(flow.sourceRef)
		if (srcSucc) {
			const srcIdx = srcSucc.indexOf(flow.targetRef)
			if (srcIdx >= 0) srcSucc.splice(srcIdx, 1, firstDummy)
		}
		augPred.get(firstDummy)?.push(flow.sourceRef)

		// Wire consecutive dummies
		for (let i = 0; i < chain.length - 1; i++) {
			const cur = chain[i]
			const next = chain[i + 1]
			if (cur && next) {
				augSucc.get(cur)?.push(next)
				augPred.get(next)?.push(cur)
			}
		}

		// Wire last dummy → target
		const last = chain[chain.length - 1]
		if (!last) continue
		augSucc.get(last)?.push(flow.targetRef)
		const tgtPred = augPred.get(flow.targetRef)
		if (tgtPred) {
			const tgtIdx = tgtPred.indexOf(flow.sourceRef)
			if (tgtIdx >= 0) tgtPred.splice(tgtIdx, 1, last)
		}
	}

	return {
		augmentedGraph: { nodes: allNodeIds, successors: augSucc, predecessors: augPred },
		augmentedLayers: augLayers,
		dummyChains,
	}
}
