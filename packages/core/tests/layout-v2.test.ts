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
		track: 1,
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

	it("does not duplicate successors when the same edge is added twice", () => {
		const g = new V2Graph()
		g.addNode(makeNode("x"))
		g.addNode(makeNode("y"))
		const edge = {
			id: "e2",
			sourceId: "x",
			targetId: "y",
			isBackEdge: false,
			waypoints: [],
		}
		g.addEdge(edge)
		g.addEdge(edge)

		expect(g.getSuccessors("x")).toEqual(["y"])
		expect(g.getPredecessors("y")).toEqual(["x"])
	})
})
