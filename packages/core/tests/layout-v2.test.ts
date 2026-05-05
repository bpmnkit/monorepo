import { describe, expect, it } from "vitest"
import type { BpmnFlowElement, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js"
import { detectBackEdges, makeDAG } from "../src/layout/v2/dag.js"
import { V2Graph } from "../src/layout/v2/graph.js"
import { identifyTrunk } from "../src/layout/v2/trunk.js"
import type { V2Node } from "../src/layout/v2/types.js"

function makeNode(id: string, type = "task"): V2Node {
	return {
		id,
		type,
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

function bpmnNode(
	id: string,
	type: BpmnFlowElement["type"] = "serviceTask",
	name?: string,
): BpmnFlowElement {
	const base = {
		id,
		name,
		incoming: [],
		outgoing: [],
		extensionElements: [],
		unknownAttributes: {},
	}
	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] }
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] }
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" }
		default:
			return { ...base, type } as BpmnFlowElement
	}
}

function bpmnFlow(id: string, src: string, tgt: string, name?: string): BpmnSequenceFlow {
	return { id, name, sourceRef: src, targetRef: tgt, extensionElements: [], unknownAttributes: {} }
}

function buildV2Graph(
	nodes: BpmnFlowElement[],
	flows: BpmnSequenceFlow[],
): { graph: V2Graph; nodeIndex: Map<string, BpmnFlowElement> } {
	const graph = new V2Graph()
	const nodeIndex = new Map<string, BpmnFlowElement>()
	for (const n of nodes) {
		nodeIndex.set(n.id, n)
		graph.addNode(makeNode(n.id, n.type))
	}
	for (const f of flows) {
		graph.addEdge({
			id: f.id,
			sourceId: f.sourceRef,
			targetId: f.targetRef,
			isBackEdge: false,
			waypoints: [],
		})
	}
	return { graph, nodeIndex }
}

describe("identifyTrunk", () => {
	it("marks the direct happy-path as trunk", () => {
		const nodes = [bpmnNode("s", "startEvent"), bpmnNode("t"), bpmnNode("e", "endEvent")]
		const flows = [bpmnFlow("f1", "s", "t"), bpmnFlow("f2", "t", "e")]
		const { graph, nodeIndex } = buildV2Graph(nodes, flows)
		const trunk = identifyTrunk(graph, nodeIndex, flows)
		expect(trunk.has("s")).toBe(true)
		expect(trunk.has("t")).toBe(true)
		expect(trunk.has("e")).toBe(true)
	})

	it("avoids paths with rejection-labelled flows", () => {
		const nodes = [
			bpmnNode("s", "startEvent"),
			bpmnNode("ok"),
			bpmnNode("rej"),
			bpmnNode("e", "endEvent"),
		]
		const flows = [
			bpmnFlow("f1", "s", "ok"),
			bpmnFlow("f2", "s", "rej", "Reject"),
			bpmnFlow("f3", "ok", "e"),
			bpmnFlow("f4", "rej", "e"),
		]
		const { graph, nodeIndex } = buildV2Graph(nodes, flows)
		const trunk = identifyTrunk(graph, nodeIndex, flows)
		expect(trunk.has("ok")).toBe(true)
		expect(trunk.has("rej")).toBe(false)
	})

	it("returns empty set when no startEvent", () => {
		const nodes = [bpmnNode("t"), bpmnNode("e", "endEvent")]
		const flows = [bpmnFlow("f1", "t", "e")]
		const { graph, nodeIndex } = buildV2Graph(nodes, flows)
		const trunk = identifyTrunk(graph, nodeIndex, flows)
		expect(trunk.size).toBe(0)
	})
})

describe("detectBackEdges", () => {
	it("finds cycle edges", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addNode(makeNode("c"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "b", targetId: "c", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e3", sourceId: "c", targetId: "a", isBackEdge: false, waypoints: [] })
		const back = detectBackEdges(g)
		expect(back).toHaveLength(1)
		expect(back[0]?.edgeId).toBe("e3")
	})

	it("finds no back-edges in a DAG", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		expect(detectBackEdges(g)).toHaveLength(0)
	})
})

describe("makeDAG", () => {
	it("reverses back-edges so cycle becomes DAG", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "b", targetId: "a", isBackEdge: false, waypoints: [] })
		const back = detectBackEdges(g)
		const dag = makeDAG(g, back)
		// b→a should be reversed; DAG successors of b should not include a
		expect(dag.getSuccessors("b")).not.toContain("a")
	})

	it("marks original back-edge with isBackEdge=true", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "b", targetId: "a", isBackEdge: false, waypoints: [] })
		const back = detectBackEdges(g)
		makeDAG(g, back)
		const backEdgeId = back[0]?.edgeId
		expect(g.edges.get(backEdgeId ?? "")?.isBackEdge).toBe(true)
	})
})

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
