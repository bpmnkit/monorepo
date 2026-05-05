import { describe, expect, it } from "vitest"
import type { BpmnFlowElement, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js"
import { detectBackEdges, makeDAG } from "../src/layout/v2/dag.js"
import { V2Graph } from "../src/layout/v2/graph.js"
import { assignCoordinates, assignTracks } from "../src/layout/v2/grid.js"
import { alignGatewayPairs, assignLayers, injectDummies } from "../src/layout/v2/layers.js"
import { identifyTrunk } from "../src/layout/v2/trunk.js"
import { CELL_SIZE, TRACK_Y } from "../src/layout/v2/types.js"
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

	it("prefers the default flow from a gateway", () => {
		// exclusiveGateway with default→"ok", non-default→"alt"
		// both paths lead to endEvent
		const gwNode = {
			id: "gw",
			type: "exclusiveGateway" as const,
			default: "f_ok",
			incoming: [],
			outgoing: [],
			extensionElements: [],
			unknownAttributes: {},
		}
		const nodes: BpmnFlowElement[] = [
			bpmnNode("s", "startEvent"),
			gwNode,
			bpmnNode("ok"),
			bpmnNode("alt"),
			bpmnNode("e", "endEvent"),
		]
		const flows: BpmnSequenceFlow[] = [
			bpmnFlow("f_start", "s", "gw"),
			{
				id: "f_ok",
				sourceRef: "gw",
				targetRef: "ok",
				extensionElements: [],
				unknownAttributes: {},
			},
			{
				id: "f_alt",
				sourceRef: "gw",
				targetRef: "alt",
				extensionElements: [],
				unknownAttributes: {},
			},
			bpmnFlow("f_ok_end", "ok", "e"),
			bpmnFlow("f_alt_end", "alt", "e"),
		]
		const { graph, nodeIndex } = buildV2Graph(nodes, flows)
		const trunk = identifyTrunk(graph, nodeIndex, flows)
		expect(trunk.has("ok")).toBe(true)
		expect(trunk.has("alt")).toBe(false)
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

describe("assignLayers", () => {
	it("assigns layer 0 to source, increments along chain", () => {
		const g = new V2Graph()
		for (const id of ["a", "b", "c"]) g.addNode(makeNode(id))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "b", targetId: "c", isBackEdge: false, waypoints: [] })
		assignLayers(g)
		expect(g.nodes.get("a")?.layer).toBe(0)
		expect(g.nodes.get("b")?.layer).toBe(1)
		expect(g.nodes.get("c")?.layer).toBe(2)
	})

	it("uses longest-path for fork/join", () => {
		// S → A → B → J (long path), S → J (short path)
		// J.layer should be max(B.layer+1, S.layer+1) = 3
		const g = new V2Graph()
		for (const id of ["S", "A", "B", "J"]) g.addNode(makeNode(id))
		g.addEdge({ id: "e1", sourceId: "S", targetId: "A", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "A", targetId: "B", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e3", sourceId: "B", targetId: "J", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e4", sourceId: "S", targetId: "J", isBackEdge: false, waypoints: [] })
		assignLayers(g)
		expect(g.nodes.get("J")?.layer).toBe(3)
	})

	it("handles multiple roots", () => {
		const g = new V2Graph()
		for (const id of ["r1", "r2", "c"]) g.addNode(makeNode(id))
		g.addEdge({ id: "e1", sourceId: "r1", targetId: "c", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "r2", targetId: "c", isBackEdge: false, waypoints: [] })
		assignLayers(g)
		expect(g.nodes.get("r1")?.layer).toBe(0)
		expect(g.nodes.get("r2")?.layer).toBe(0)
		expect(g.nodes.get("c")?.layer).toBe(1)
	})
})

describe("alignGatewayPairs", () => {
	it("corrects join gateway layer when set too low", () => {
		// split → A → B → C → join, split → join (direct)
		// After assignLayers: split=0, A=1, B=2, C=3, join=4, after=5
		// Manually set join too low to simulate a case where correction is needed
		const g = new V2Graph()
		g.addNode({ ...makeNode("split"), type: "exclusiveGateway" })
		g.addNode(makeNode("A"))
		g.addNode(makeNode("B"))
		g.addNode(makeNode("C"))
		g.addNode({ ...makeNode("join"), type: "exclusiveGateway" })
		g.addNode(makeNode("after")) // node after join
		g.addEdge({ id: "e1", sourceId: "split", targetId: "A", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "A", targetId: "B", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e3", sourceId: "B", targetId: "C", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e4", sourceId: "C", targetId: "join", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e5", sourceId: "split", targetId: "join", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e6", sourceId: "join", targetId: "after", isBackEdge: false, waypoints: [] })
		assignLayers(g) // places: split=0, A=1, B=2, C=3, join=4, after=5
		// Force join layer too low to test correction:
		const joinNode = g.nodes.get("join")
		const afterNode = g.nodes.get("after")
		if (joinNode) joinNode.layer = 1
		if (afterNode) afterNode.layer = 2
		alignGatewayPairs(g, new Map())
		// join should be corrected to maxBranchLayer(3) + 1 = 4
		expect(g.nodes.get("join")?.layer).toBe(4)
		// after should be cascaded: was 2, shift = 4-1=3, after = 2+3 = 5
		expect(g.nodes.get("after")?.layer).toBe(5)
		// branch nodes should NOT be shifted (they're between split and join)
		expect(g.nodes.get("C")?.layer).toBe(3) // unchanged
	})

	it("does not shift unrelated nodes outside the gateway block", () => {
		// Two separate parallel paths; alignment of one should not affect the other
		const g = new V2Graph()
		g.addNode({ ...makeNode("split"), type: "exclusiveGateway" })
		g.addNode(makeNode("A"))
		g.addNode(makeNode("B"))
		g.addNode({ ...makeNode("join"), type: "exclusiveGateway" })
		g.addNode(makeNode("unrelated")) // separate node at same layer as join
		g.addEdge({ id: "e1", sourceId: "split", targetId: "A", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e2", sourceId: "A", targetId: "B", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e3", sourceId: "B", targetId: "join", isBackEdge: false, waypoints: [] })
		g.addEdge({ id: "e4", sourceId: "split", targetId: "join", isBackEdge: false, waypoints: [] })
		assignLayers(g)
		const unrelatedNode = g.nodes.get("unrelated")
		const naturalJoinLayer = g.nodes.get("join")?.layer ?? 2
		if (unrelatedNode) unrelatedNode.layer = naturalJoinLayer // same layer as join
		const joinNode = g.nodes.get("join")
		if (joinNode) joinNode.layer = 0 // force too low
		alignGatewayPairs(g, new Map())
		// unrelated should NOT be shifted
		expect(g.nodes.get("unrelated")?.layer).toBe(naturalJoinLayer)
	})
})

describe("injectDummies", () => {
	it("inserts dummy nodes for edges spanning 3 layers", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0 })
		g.addNode({ ...makeNode("b"), layer: 3 }) // spans layers 0→1→2→3
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		const aug = injectDummies(g, new Set(["e1"]))
		const dummies = [...aug.nodes.values()].filter((n) => n.isDummy)
		expect(dummies).toHaveLength(2) // layers 1 and 2
		for (const d of dummies) {
			expect(d.width).toBe(0)
			expect(d.height).toBe(0)
		}
	})

	it("does not inject dummies for same-layer or adjacent-layer edges", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0 })
		g.addNode({ ...makeNode("b"), layer: 1 })
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		const aug = injectDummies(g, new Set(["e1"]))
		expect([...aug.nodes.values()].filter((n) => n.isDummy)).toHaveLength(0)
	})

	it("passes through __rev edges without dummy injection", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0 })
		g.addNode({ ...makeNode("b"), layer: 3 })
		g.addEdge({ id: "e1__rev", sourceId: "b", targetId: "a", isBackEdge: false, waypoints: [] })
		const aug = injectDummies(g, new Set())
		expect([...aug.nodes.values()].filter((n) => n.isDummy)).toHaveLength(0)
		expect(aug.edges.has("e1__rev")).toBe(true)
	})
})

describe("assignTracks", () => {
	it("puts trunk nodes on track 2", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("b"))
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		assignTracks(g, new Set(["a", "b"]), new Set(), [], new Map())
		expect(g.nodes.get("a")?.track).toBe(2)
		expect(g.nodes.get("b")?.track).toBe(2)
	})

	it("puts rejection-named nodes on track 4", () => {
		const g = new V2Graph()
		g.addNode(makeNode("a"))
		g.addNode(makeNode("rej"))
		const flows = [bpmnFlow("f1", "a", "rej", "Reject")]
		g.addEdge({ id: "f1", sourceId: "a", targetId: "rej", isBackEdge: false, waypoints: [] })
		const nodeIndex = new Map<string, BpmnFlowElement>([
			["a", bpmnNode("a")],
			["rej", bpmnNode("rej", "serviceTask", "Reject Task")],
		])
		assignTracks(g, new Set(["a"]), new Set(), flows, nodeIndex)
		expect(g.nodes.get("rej")?.track).toBe(4)
	})

	it("puts back-edge source nodes on track 1", () => {
		const g = new V2Graph()
		g.addNode(makeNode("loop"))
		const flows = [bpmnFlow("f_back", "loop", "start")]
		assignTracks(g, new Set(), new Set(["f_back"]), flows, new Map())
		expect(g.nodes.get("loop")?.track).toBe(1)
		expect(g.nodes.get("loop")?.isBackEdgeSource).toBe(true)
	})

	it("puts alternate nodes on track 3", () => {
		const g = new V2Graph()
		g.addNode(makeNode("alt"))
		assignTracks(g, new Set(), new Set(), [], new Map())
		expect(g.nodes.get("alt")?.track).toBe(3)
	})

	it("puts dummy nodes on track 2 regardless of trunk membership", () => {
		const g = new V2Graph()
		const dummy = { ...makeNode("d"), isDummy: true }
		g.addNode(dummy)
		assignTracks(g, new Set(), new Set(), [], new Map())
		expect(g.nodes.get("d")?.track).toBe(2)
	})
})

describe("assignCoordinates", () => {
	it("places trunk node y-center near TRACK_Y[2]", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
		assignCoordinates(g)
		const n = g.nodes.get("a")
		expect(n).toBeDefined()
		if (!n) return
		const cy = n.y + n.height / 2
		expect(Math.abs(cy - (TRACK_Y[2] as number))).toBeLessThan(CELL_SIZE)
	})

	it("assigns increasing X for increasing layers", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
		g.addNode({ ...makeNode("b"), layer: 1, track: 2 as const })
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		assignCoordinates(g)
		expect(g.nodes.get("b")?.x).toBeGreaterThan(g.nodes.get("a")?.x)
	})

	it("snaps X and Y to CELL_SIZE", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
		assignCoordinates(g)
		const n = g.nodes.get("a")
		expect(n).toBeDefined()
		if (!n) return
		expect(n.x % CELL_SIZE).toBe(0)
		expect(n.y % CELL_SIZE).toBe(0)
	})

	it("stacks two nodes in same layer+track without overlap", () => {
		const g = new V2Graph()
		g.addNode({ ...makeNode("a"), layer: 0, track: 2 as const })
		g.addNode({ ...makeNode("b"), layer: 0, track: 2 as const })
		assignCoordinates(g)
		const a = g.nodes.get("a")
		const b = g.nodes.get("b")
		expect(a).toBeDefined()
		expect(b).toBeDefined()
		if (!a || !b) return
		const overlap = a.y < b.y + b.height && b.y < a.y + a.height
		expect(overlap).toBe(false)
	})

	it("uses annotationWidth to widen column gap", () => {
		const g = new V2Graph()
		const nAnnotated = { ...makeNode("a"), layer: 0, track: 2 as const, annotationWidth: 300 }
		const nNext = { ...makeNode("b"), layer: 1, track: 2 as const }
		g.addNode(nAnnotated)
		g.addNode(nNext)
		g.addEdge({ id: "e1", sourceId: "a", targetId: "b", isBackEdge: false, waypoints: [] })
		assignCoordinates(g)
		// snap(LEFT_MARGIN)=40, max(nodeWidth=100, annW/2=0)=100, gap=80 → snap(40+100+80)=snap(220)=240
		// With annotation: max(100, 300/2=150)=150 → snap(40+150+80)=snap(270)=280
		// (annotationWidth/2 = 150 > nodeWidth 100)
		expect(g.nodes.get("b")?.x).toBeGreaterThanOrEqual(280)
	})

	it("places dummy at correct intermediate layer X", () => {
		const g = new V2Graph()
		const a = { ...makeNode("a"), layer: 0, track: 2 as const }
		const b = { ...makeNode("b"), layer: 2, track: 2 as const }
		const dummy = {
			...makeNode("d"),
			layer: 1,
			isDummy: true,
			width: 0,
			height: 0,
			track: 2 as const,
		}
		g.addNode(a)
		g.addNode(b)
		g.addNode(dummy)
		assignCoordinates(g)
		// dummy.x should be between a.x and b.x (at the intermediate layer)
		expect(g.nodes.get("d")?.x).toBeGreaterThan(g.nodes.get("a")?.x)
		expect(g.nodes.get("d")?.x).toBeLessThan(g.nodes.get("b")?.x)
		// dummy.y should be TRACK_Y[2] (snapped)
		expect(g.nodes.get("d")?.y).toBe(TRACK_Y[2])
	})
})
