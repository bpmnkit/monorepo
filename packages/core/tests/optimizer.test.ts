import { describe, expect, it } from "vitest"
import type { BpmnFlowElement, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js"
import {
	OptGraph,
	calculateLayoutCost,
	initializeOptGraph,
	layoutResultToOptGraph,
	mutateGraphRandomly,
	optimizeLayoutResult,
} from "../src/layout/optimizer.js"
import type { OptEdge, OptNode } from "../src/layout/optimizer.js"
import type { LayoutResult } from "../src/layout/types.js"

// ============================================================================
// Helpers
// ============================================================================

function makeNode(id: string, x: number, y: number, w = 100, h = 80): OptNode {
	return { id, x, y, width: w, height: h }
}

function makeEdge(id: string, src: string, tgt: string, ...wps: Array<[number, number]>): OptEdge {
	return { id, sourceId: src, targetId: tgt, waypoints: wps.map(([x, y]) => ({ x, y })) }
}

function makeGraph(nodes: OptNode[], edges: OptEdge[]): OptGraph {
	return new OptGraph(new Map(nodes.map((n) => [n.id, n])), new Map(edges.map((e) => [e.id, e])))
}

function minimalLayoutResult(): LayoutResult {
	return {
		nodes: [
			{
				id: "n1",
				type: "serviceTask",
				bounds: { x: 50, y: 460, width: 100, height: 80 },
				layer: 0,
				position: 0,
			},
			{
				id: "n2",
				type: "serviceTask",
				bounds: { x: 300, y: 460, width: 100, height: 80 },
				layer: 1,
				position: 0,
			},
		],
		edges: [
			{
				id: "e1",
				sourceRef: "n1",
				targetRef: "n2",
				waypoints: [
					{ x: 150, y: 500 },
					{ x: 300, y: 500 },
				],
			},
		],
	}
}

// ============================================================================
// Module 1: OptGraph
// ============================================================================

describe("OptGraph.clone", () => {
	it("creates a fully independent copy", () => {
		const graph = makeGraph(
			[makeNode("n1", 10, 20)],
			[makeEdge("e1", "n1", "n2", [10, 60], [200, 60])],
		)
		const copy = graph.clone()

		// Mutate original
		const n = graph.nodes.get("n1")
		if (n) n.x = 999
		const e = graph.edges.get("e1")
		const wp = e?.waypoints[0]
		if (wp) wp.x = 999

		// Copy must be unchanged
		expect(copy.nodes.get("n1")?.x).toBe(10)
		expect(copy.edges.get("e1")?.waypoints[0]?.x).toBe(10)
	})
})

// ============================================================================
// Module 2: calculateLayoutCost
// ============================================================================

describe("calculateLayoutCost", () => {
	it("returns 0 for an empty graph", () => {
		expect(calculateLayoutCost(makeGraph([], []))).toBe(0)
	})

	it("returns 0 for a single isolated node", () => {
		expect(calculateLayoutCost(makeGraph([makeNode("n1", 0, 0)], []))).toBe(0)
	})

	it("penalises overlapping nodes by 10,000", () => {
		// n1 and n2 overlap: n1 right edge at 100, n2 left edge at 50
		const graph = makeGraph([makeNode("n1", 0, 0, 100, 80), makeNode("n2", 50, 0, 100, 80)], [])
		expect(calculateLayoutCost(graph)).toBeGreaterThanOrEqual(10000)
	})

	it("does not penalise touching (non-overlapping) nodes", () => {
		// n1 ends at x=100, n2 starts at x=100 — touching but not overlapping
		const graph = makeGraph([makeNode("n1", 0, 0, 100, 80), makeNode("n2", 100, 0, 100, 80)], [])
		expect(calculateLayoutCost(graph)).toBe(0)
	})

	it("penalises non-orthogonal segments by 500 each", () => {
		// Diagonal segment (both dx and dy non-zero) on unconnected edge
		const graph = makeGraph(
			[makeNode("n1", 0, 0, 10, 10), makeNode("n2", 300, 200, 10, 10)],
			[makeEdge("e1", "n1", "n2", [10, 5], [300, 205])],
		)
		const cost = calculateLayoutCost(graph)
		expect(cost).toBeGreaterThanOrEqual(500)
	})

	it("penalises a bend by 50", () => {
		// Straight edge (no bends)
		const straight = makeGraph(
			[makeNode("n1", 0, 200, 10, 10), makeNode("n2", 500, 200, 10, 10)],
			[makeEdge("e1", "n1", "n2", [10, 205], [500, 205])],
		)
		// Edge with one bend
		const bent = makeGraph(
			[makeNode("n1", 0, 200, 10, 10), makeNode("n2", 500, 200, 10, 10)],
			[makeEdge("e1", "n1", "n2", [10, 205], [255, 100], [500, 205])],
		)
		expect(calculateLayoutCost(bent)).toBeGreaterThan(calculateLayoutCost(straight))
	})

	it("penalises edges crossing through nodes by 5,000", () => {
		// n3 sits in the middle of the edge e1's path
		const withObstacle = makeGraph(
			[
				makeNode("n1", 0, 200, 10, 10),
				makeNode("n2", 500, 200, 10, 10),
				makeNode("n3", 200, 180, 60, 60),
			],
			[makeEdge("e1", "n1", "n2", [10, 205], [500, 205])],
		)
		const withoutObstacle = makeGraph(
			[makeNode("n1", 0, 200, 10, 10), makeNode("n2", 500, 200, 10, 10)],
			[makeEdge("e1", "n1", "n2", [10, 205], [500, 205])],
		)
		expect(calculateLayoutCost(withObstacle)).toBeGreaterThan(calculateLayoutCost(withoutObstacle))
	})

	it("penalises un-aligned connected nodes", () => {
		// n1 and n2 at same Y — aligned
		const aligned = makeGraph(
			[makeNode("n1", 0, 200, 100, 80), makeNode("n2", 300, 200, 100, 80)],
			[makeEdge("e1", "n1", "n2", [100, 240], [300, 240])],
		)
		// n1 and n2 at very different Y — misaligned
		const misaligned = makeGraph(
			[makeNode("n1", 0, 0, 100, 80), makeNode("n2", 300, 500, 100, 80)],
			[makeEdge("e1", "n1", "n2", [100, 40], [300, 540])],
		)
		expect(calculateLayoutCost(misaligned)).toBeGreaterThan(calculateLayoutCost(aligned))
	})
})

// ============================================================================
// Module 3: initializeOptGraph
// ============================================================================

describe("initializeOptGraph", () => {
	it("creates nodes for all flow elements", () => {
		const nodes: BpmnFlowElement[] = [
			{
				id: "start",
				type: "startEvent",
				incoming: [],
				outgoing: ["f1"],
				extensionElements: [],
				unknownAttributes: {},
				eventDefinitions: [],
			},
			{
				id: "task1",
				type: "serviceTask",
				incoming: ["f1"],
				outgoing: [],
				extensionElements: [],
				unknownAttributes: {},
			},
		]
		const flows: BpmnSequenceFlow[] = [
			{
				id: "f1",
				sourceRef: "start",
				targetRef: "task1",
				extensionElements: [],
				unknownAttributes: {},
			},
		]
		const graph = initializeOptGraph(nodes, flows)
		expect(graph.nodes.size).toBe(2)
		expect(graph.edges.size).toBe(1)
	})

	it("places start node at a lower layer than connected nodes", () => {
		const nodes: BpmnFlowElement[] = [
			{
				id: "start",
				type: "startEvent",
				incoming: [],
				outgoing: ["f1"],
				extensionElements: [],
				unknownAttributes: {},
				eventDefinitions: [],
			},
			{
				id: "task1",
				type: "serviceTask",
				incoming: ["f1"],
				outgoing: [],
				extensionElements: [],
				unknownAttributes: {},
			},
		]
		const flows: BpmnSequenceFlow[] = [
			{
				id: "f1",
				sourceRef: "start",
				targetRef: "task1",
				extensionElements: [],
				unknownAttributes: {},
			},
		]
		const graph = initializeOptGraph(nodes, flows)
		const start = graph.nodes.get("start")
		const task = graph.nodes.get("task1")
		// start is in an earlier layer → lower X
		expect(start?.x).toBeLessThan(task?.x ?? Number.POSITIVE_INFINITY)
	})
})

// ============================================================================
// Module 4: mutateGraphRandomly
// ============================================================================

describe("mutateGraphRandomly", () => {
	it("always changes something in the graph", () => {
		// Run 20 times: at least one must mutate (probabilistic but near-certain)
		const graph = makeGraph(
			[makeNode("n1", 100, 200), makeNode("n2", 400, 200)],
			[makeEdge("e1", "n1", "n2", [200, 240], [400, 240])],
		)

		let changed = false
		for (let i = 0; i < 20; i++) {
			const before = JSON.stringify({
				nodes: [...graph.nodes.values()],
				edges: [...graph.edges.values()],
			})
			mutateGraphRandomly(graph)
			const after = JSON.stringify({
				nodes: [...graph.nodes.values()],
				edges: [...graph.edges.values()],
			})
			if (before !== after) {
				changed = true
				break
			}
		}
		expect(changed).toBe(true)
	})

	it("does not crash on a graph with no edges", () => {
		const graph = makeGraph([makeNode("n1", 0, 0)], [])
		expect(() => mutateGraphRandomly(graph)).not.toThrow()
	})

	it("does not crash on an empty graph", () => {
		expect(() => mutateGraphRandomly(makeGraph([], []))).not.toThrow()
	})
})

// ============================================================================
// Module 5: optimizeLayoutResult
// ============================================================================

describe("optimizeLayoutResult", () => {
	it("returns the input unchanged when empty", () => {
		const empty: LayoutResult = { nodes: [], edges: [] }
		expect(optimizeLayoutResult(empty, 10)).toEqual(empty)
	})

	it("preserves node and edge count", () => {
		const result = minimalLayoutResult()
		const optimised = optimizeLayoutResult(result, 50)
		expect(optimised.nodes).toHaveLength(result.nodes.length)
		expect(optimised.edges).toHaveLength(result.edges.length)
	})

	it("preserves node ids and types", () => {
		const result = minimalLayoutResult()
		const optimised = optimizeLayoutResult(result, 50)
		const ids = optimised.nodes.map((n) => n.id).sort()
		expect(ids).toEqual(["n1", "n2"])
		expect(optimised.nodes[0]?.type).toBe("serviceTask")
	})

	it("does not modify the original result", () => {
		const result = minimalLayoutResult()
		const originalX = result.nodes[0]?.bounds.x
		optimizeLayoutResult(result, 50)
		expect(result.nodes[0]?.bounds.x).toBe(originalX)
	})
})

// ============================================================================
// layoutResultToOptGraph
// ============================================================================

describe("layoutResultToOptGraph", () => {
	it("converts nodes and edges correctly", () => {
		const result = minimalLayoutResult()
		const graph = layoutResultToOptGraph(result)
		expect(graph.nodes.size).toBe(2)
		expect(graph.edges.size).toBe(1)
		expect(graph.nodes.get("n1")?.x).toBe(50)
		expect(graph.nodes.get("n1")?.y).toBe(460)
		expect(graph.edges.get("e1")?.waypoints).toHaveLength(2)
	})

	it("excludes dummy nodes", () => {
		const result: LayoutResult = {
			nodes: [
				{
					id: "real",
					type: "serviceTask",
					bounds: { x: 0, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 0,
				},
				{
					id: "dummy",
					type: "serviceTask",
					bounds: { x: 100, y: 0, width: 0, height: 0 },
					layer: 1,
					position: 0,
					isDummy: true,
				},
			],
			edges: [],
		}
		const graph = layoutResultToOptGraph(result)
		expect(graph.nodes.size).toBe(1)
		expect(graph.nodes.has("dummy")).toBe(false)
	})
})
