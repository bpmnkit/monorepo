import { describe, expect, it } from "vitest"
import { V2Graph } from "../src/layout/v2/graph.js"
import type { V2Node } from "../src/layout/v2/types.js"

function makeNode(id: string): V2Node {
	return {
		id,
		type: "task",
		width: 100,
		height: 80,
		x: 0,
		y: 0,
		layer: 0,
		track: 2,
		isTrunk: false,
		isBackEdgeSource: false,
		isDummy: false,
	}
}

describe("V2Graph", () => {
	it("tracks successors and predecessors after addEdge", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({
			id: "e1",
			sourceId: "a",
			targetId: "b",
			isBackEdge: false,
			waypoints: [],
		})

		expect(g.getSuccessors("a")).toEqual(["b"])
		expect(g.getPredecessors("b")).toEqual(["a"])
		expect(g.getSuccessors("b")).toEqual([])
		expect(g.getPredecessors("a")).toEqual([])
	})

	it("does not duplicate successors when same edge re-added", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] }) // same id
		expect(g.getSuccessors("a")).toHaveLength(1)
		expect(g.edges.size).toBe(1)
	})

	it("allows two distinct edges between the same node pair (multigraph)", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		expect(g.edges.size).toBe(2)
		expect(g.getSuccessors("a")).toHaveLength(2) // both edges appear
		expect(g.getPredecessors("b")).toHaveLength(2)
	})
})
