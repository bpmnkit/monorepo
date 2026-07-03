import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type {
	BpmnDefinitions,
	BpmnFlowElement,
	BpmnLane,
	BpmnProcess,
	BpmnSequenceFlow,
} from "../src/bpmn/bpmn-model.js"
import { layoutFlowNodes, layoutProcess } from "../src/layout/layout-engine.js"
import { assertNoOverlap } from "../src/layout/overlap.js"
import type { LayoutNode, LayoutResult } from "../src/layout/types.js"

// Helper: create a simple flow element with required fields
function node(id: string, type: BpmnFlowElement["type"] = "serviceTask"): BpmnFlowElement {
	const base = {
		id,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [],
		unknownAttributes: {},
	}
	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] }
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] }
		case "intermediateThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [] }
		case "intermediateCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [] }
		case "boundaryEvent":
			return { ...base, type: "boundaryEvent", attachedToRef: "", eventDefinitions: [] }
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" }
		case "parallelGateway":
			return { ...base, type: "parallelGateway" }
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" }
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" }
		case "callActivity":
			return { ...base, type: "callActivity" }
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		case "eventSubProcess":
			return {
				...base,
				type: "eventSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			}
		default:
			return { ...base, type }
	}
}

// Helper: create a sequence flow
function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} }
}

// Helper: create a BpmnProcess
function proc(
	id: string,
	flowElements: BpmnFlowElement[],
	sequenceFlows: BpmnSequenceFlow[],
): BpmnProcess {
	return {
		id,
		flowElements,
		sequenceFlows,
		extensionElements: [],
		textAnnotations: [],
		associations: [],
		unknownAttributes: {},
	}
}

describe("Overlap assertion", () => {
	it("passes for non-overlapping elements", () => {
		const result: LayoutResult = {
			nodes: [
				{
					id: "a",
					type: "serviceTask",
					bounds: { x: 0, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 0,
				},
				{
					id: "b",
					type: "serviceTask",
					bounds: { x: 200, y: 0, width: 100, height: 80 },
					layer: 1,
					position: 0,
				},
			],
			edges: [],
		}

		expect(() => assertNoOverlap(result)).not.toThrow()
	})

	it("throws for overlapping elements", () => {
		const result: LayoutResult = {
			nodes: [
				{
					id: "a",
					type: "serviceTask",
					bounds: { x: 0, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 0,
				},
				{
					id: "b",
					type: "serviceTask",
					bounds: { x: 50, y: 0, width: 100, height: 80 },
					layer: 0,
					position: 1,
				},
			],
			edges: [],
		}

		expect(() => assertNoOverlap(result)).toThrow(/overlap/i)
	})
})

describe("Layout engine (integration)", () => {
	it("lays out a simple linear process", () => {
		const process = proc(
			"process1",
			[node("start", "startEvent"), node("task1", "serviceTask"), node("end", "endEvent")],
			[flow("f1", "start", "task1"), flow("f2", "task1", "end")],
		)

		const result = layoutProcess(process)

		expect(result.nodes).toHaveLength(3)
		expect(result.edges).toHaveLength(2)

		// All edges should be orthogonal
		for (const edge of result.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const prev = edge.waypoints[i - 1]
				const curr = edge.waypoints[i]
				if (!prev || !curr) continue
				const isHorizontal = Math.abs(prev.y - curr.y) < 1
				const isVertical = Math.abs(prev.x - curr.x) < 1
				expect(isHorizontal || isVertical).toBe(true)
			}
		}
	})

	it("lays out a process with exclusive gateway branching", () => {
		const process = proc(
			"process2",
			[
				node("start", "startEvent"),
				node("gw1", "exclusiveGateway"),
				node("taskA", "serviceTask"),
				node("taskB", "serviceTask"),
				node("gw2", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "gw1"),
				flow("f2", "gw1", "taskA"),
				flow("f3", "gw1", "taskB"),
				flow("f4", "taskA", "gw2"),
				flow("f5", "taskB", "gw2"),
				flow("f6", "gw2", "end"),
			],
		)

		const result = layoutProcess(process)

		expect(result.nodes).toHaveLength(6)
		expect(result.edges).toHaveLength(6)

		// taskA and taskB should be in the same layer (column) at different y positions
		const taskA = result.nodes.find((n) => n.id === "taskA")
		const taskB = result.nodes.find((n) => n.id === "taskB")
		expect(taskA).toBeDefined()
		expect(taskB).toBeDefined()
		if (!taskA || !taskB) return
		expect(taskA.layer).toBe(taskB.layer)
		expect(taskA.bounds.y).not.toBe(taskB.bounds.y)
	})

	it("lays out a process with a loop (back-edge)", () => {
		const process = proc(
			"process3",
			[
				node("start", "startEvent"),
				node("task", "serviceTask"),
				node("gw", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "task"),
				flow("f2", "task", "gw"),
				flow("f3", "gw", "end"),
				flow("f4", "gw", "task"), // loop back
			],
		)

		const result = layoutProcess(process)

		expect(result.nodes).toHaveLength(4)
		expect(result.edges).toHaveLength(4)

		// The back-edge should route around other elements (more than a direct segment)
		const backEdge = result.edges.find((e) => e.id === "f4")
		expect(backEdge).toBeDefined()
		if (!backEdge) return
		expect(backEdge.waypoints.length).toBeGreaterThan(2)
	})

	it("lays out a 9-branch exclusive gateway", () => {
		const branches = Array.from({ length: 9 }, (_, i) => `branch${i}`)
		const process = proc(
			"process4",
			[
				node("start", "startEvent"),
				node("gw1", "exclusiveGateway"),
				...branches.map((b) => node(b, "callActivity")),
				node("gw2", "exclusiveGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f0", "start", "gw1"),
				...branches.map((b, i) => flow(`fb${i}`, "gw1", b)),
				...branches.map((b, i) => flow(`fm${i}`, b, "gw2")),
				flow("fend", "gw2", "end"),
			],
		)

		const result = layoutProcess(process)

		expect(result.nodes).toHaveLength(13) // start + gw1 + 9 branches + gw2 + end
		expect(result.edges).toHaveLength(20) // f0 + 9 fan-out + 9 fan-in + fend

		// All 9 branches should be in the same layer
		const branchNodes = result.nodes.filter((n) => n.id.startsWith("branch"))
		const branchLayers = new Set(branchNodes.map((n) => n.layer))
		expect(branchLayers.size).toBe(1)

		// No overlaps
		expect(() => assertNoOverlap(result)).not.toThrow()
	})

	it("lays out a process with parallel gateway", () => {
		const process = proc(
			"process5",
			[
				node("start", "startEvent"),
				node("fork", "parallelGateway"),
				node("taskA", "serviceTask"),
				node("taskB", "serviceTask"),
				node("join", "parallelGateway"),
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "fork"),
				flow("f2", "fork", "taskA"),
				flow("f3", "fork", "taskB"),
				flow("f4", "taskA", "join"),
				flow("f5", "taskB", "join"),
				flow("f6", "join", "end"),
			],
		)

		const result = layoutProcess(process)
		expect(result.nodes).toHaveLength(6)
		expect(() => assertNoOverlap(result)).not.toThrow()
	})

	it("lays out a process with named elements (label bounds)", () => {
		const namedStart = node("start", "startEvent")
		namedStart.name = "Begin"
		const namedGw = node("gw", "exclusiveGateway")
		namedGw.name = "Decision"

		const process = proc(
			"process6",
			[namedStart, node("task", "serviceTask"), namedGw, node("end", "endEvent")],
			[flow("f1", "start", "task"), flow("f2", "task", "gw"), flow("f3", "gw", "end")],
		)

		const result = layoutProcess(process)

		const startNode = result.nodes.find((n) => n.id === "start")
		const gwNode = result.nodes.find((n) => n.id === "gw")
		expect(startNode).toBeDefined()
		expect(gwNode).toBeDefined()
		if (!startNode || !gwNode) return

		// Start event label should be below the element
		expect(startNode.labelBounds).toBeDefined()
		expect(startNode.labelBounds?.y).toBeGreaterThan(startNode.bounds.y + startNode.bounds.height)

		// Gateway label should be below the element
		expect(gwNode.labelBounds).toBeDefined()
		expect(gwNode.labelBounds?.y).toBeGreaterThan(gwNode.bounds.y + gwNode.bounds.height)
	})

	it("lays out a sub-process expanded with children inside", () => {
		const subprocess = node("sub", "adHocSubProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[]
			sequenceFlows: BpmnSequenceFlow[]
		}
		subprocess.flowElements = [node("child1", "serviceTask"), node("child2", "serviceTask")]
		subprocess.sequenceFlows = [flow("cf1", "child1", "child2")]

		const process = proc(
			"process7",
			[node("start", "startEvent"), subprocess, node("end", "endEvent")],
			[flow("f1", "start", "sub"), flow("f2", "sub", "end")],
		)

		const result = layoutProcess(process)

		const parentNode = result.nodes.find((n) => n.id === "sub")
		expect(parentNode).toBeDefined()
		if (!parentNode) return
		// Expanded sub-process is larger than a regular task
		expect(parentNode.bounds.width).toBeGreaterThan(100)
		expect(parentNode.bounds.height).toBeGreaterThan(80)
		expect(parentNode.isExpanded).toBe(true)

		// Child nodes are in the layout result
		const child1 = result.nodes.find((n) => n.id === "child1")
		const child2 = result.nodes.find((n) => n.id === "child2")
		expect(child1).toBeDefined()
		expect(child2).toBeDefined()
	})

	it("expanded subprocess has at least 50px padding on each side around its content", () => {
		const subprocess = node("sub", "subProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[]
			sequenceFlows: BpmnSequenceFlow[]
		}
		subprocess.flowElements = [node("c1", "serviceTask")]
		subprocess.sequenceFlows = []

		const process = proc(
			"p_padding",
			[node("s", "startEvent"), subprocess, node("e", "endEvent")],
			[flow("f1", "s", "sub"), flow("f2", "sub", "e")],
		)

		const result = layoutProcess(process)
		const container = result.nodes.find((n) => n.id === "sub")
		const child = result.nodes.find((n) => n.id === "c1")
		expect(container).toBeDefined()
		expect(child).toBeDefined()
		if (!container || !child) return

		// Child must be at least 50px inside each container edge
		expect(child.bounds.x - container.bounds.x).toBeGreaterThanOrEqual(49)
		expect(child.bounds.y - container.bounds.y).toBeGreaterThanOrEqual(49)
		expect(
			container.bounds.x + container.bounds.width - (child.bounds.x + child.bounds.width),
		).toBeGreaterThanOrEqual(49)
		expect(
			container.bounds.y + container.bounds.height - (child.bounds.y + child.bounds.height),
		).toBeGreaterThanOrEqual(49)
	})

	it("handles an empty process", () => {
		const process = proc("empty", [], [])

		const result = layoutProcess(process)
		expect(result.nodes).toHaveLength(0)
		expect(result.edges).toHaveLength(0)
	})

	it("handles disconnected nodes", () => {
		const process = proc("disconnected", [node("a", "serviceTask"), node("b", "serviceTask")], [])

		const result = layoutProcess(process)
		expect(result.nodes).toHaveLength(2)
		expect(() => assertNoOverlap(result)).not.toThrow()
	})

	it("does not throw overlap when subprocess children shift with container", () => {
		const subproc = node("agent-loop", "adHocSubProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[]
			sequenceFlows: BpmnSequenceFlow[]
		}
		subproc.flowElements = [
			node("think", "serviceTask"),
			node("act", "serviceTask"),
			node("observe", "serviceTask"),
		]
		subproc.sequenceFlows = []

		const process = proc(
			"ai-support-agent",
			[
				node("start", "startEvent"),
				node("classify", "serviceTask"),
				subproc,
				node("end", "endEvent"),
			],
			[
				flow("f1", "start", "classify"),
				flow("f2", "classify", "agent-loop"),
				flow("f3", "agent-loop", "end"),
			],
		)

		expect(() => layoutProcess(process)).not.toThrow()
		const result = layoutProcess(process)
		expect(() => assertNoOverlap(result)).not.toThrow()

		// Children must be inside the container
		const container = result.nodes.find((n) => n.id === "agent-loop")
		const think = result.nodes.find((n) => n.id === "think")
		expect(container).toBeDefined()
		expect(think).toBeDefined()
		if (!container || !think) return
		expect(think.bounds.x).toBeGreaterThanOrEqual(container.bounds.x)
		expect(think.bounds.y).toBeGreaterThanOrEqual(container.bounds.y)
		expect(think.bounds.x + think.bounds.width).toBeLessThanOrEqual(
			container.bounds.x + container.bounds.width,
		)
		expect(think.bounds.y + think.bounds.height).toBeLessThanOrEqual(
			container.bounds.y + container.bounds.height,
		)
	})

	it("adHocSubProcess with 6 disconnected tools wraps into multiple grid rows", () => {
		const subproc = node("agent", "adHocSubProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[]
			sequenceFlows: BpmnSequenceFlow[]
		}
		subproc.flowElements = [
			node("t1", "serviceTask"),
			node("t2", "serviceTask"),
			node("t3", "serviceTask"),
			node("t4", "serviceTask"),
			node("t5", "serviceTask"),
			node("t6", "serviceTask"),
		]
		subproc.sequenceFlows = []

		const process = proc(
			"p_grid",
			[node("s", "startEvent"), subproc, node("e", "endEvent")],
			[flow("f1", "s", "agent"), flow("f2", "agent", "e")],
		)

		const result = layoutProcess(process)

		const container = result.nodes.find((n) => n.id === "agent")
		const toolNodes = ["t1", "t2", "t3", "t4", "t5", "t6"].map((id) =>
			result.nodes.find((n) => n.id === id),
		)
		expect(container).toBeDefined()
		for (const n of toolNodes) expect(n).toBeDefined()
		if (!container) return
		const defined = toolNodes.filter(Boolean) as LayoutNode[]

		// Must have at least 2 distinct Y rows (grid wrapped)
		const yValues = new Set(defined.map((n) => n.bounds.y))
		expect(yValues.size).toBeGreaterThan(1)

		// All tools inside the container
		for (const n of defined) {
			expect(n.bounds.x).toBeGreaterThanOrEqual(container.bounds.x)
			expect(n.bounds.y).toBeGreaterThanOrEqual(container.bounds.y)
			expect(n.bounds.x + n.bounds.width).toBeLessThanOrEqual(
				container.bounds.x + container.bounds.width + 1,
			)
			expect(n.bounds.y + n.bounds.height).toBeLessThanOrEqual(
				container.bounds.y + container.bounds.height + 1,
			)
		}

		// No overlaps
		expect(() => assertNoOverlap(result)).not.toThrow()
	})
})

describe("Edge label collision avoidance", () => {
	it("places edge labels without overlapping nodes", () => {
		const process = proc(
			"labeled",
			[node("s", "startEvent"), node("a"), node("e", "endEvent")],
			[
				{ ...flow("f1", "s", "a"), name: "Go to A" },
				{ ...flow("f2", "a", "e"), name: "Finish" },
			],
		)

		const result = layoutProcess(process)

		for (const edge of result.edges) {
			if (!edge.labelBounds) continue
			for (const n of result.nodes) {
				// Check label doesn't overlap any non-parent/child node
				const lOverlap =
					edge.labelBounds.x < n.bounds.x + n.bounds.width &&
					edge.labelBounds.x + edge.labelBounds.width > n.bounds.x &&
					edge.labelBounds.y < n.bounds.y + n.bounds.height &&
					edge.labelBounds.y + edge.labelBounds.height > n.bounds.y
				if (lOverlap) {
					// Allow overlap with source/target only
					expect([edge.sourceRef, edge.targetRef]).toContain(n.id)
				}
			}
		}
	})

	it("places multiple labels without overlapping each other", () => {
		const process = proc(
			"multi-label",
			[
				node("s", "startEvent"),
				node("gw", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("join", "exclusiveGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "gw"),
				{ ...flow("f2", "gw", "a"), name: "Path A" },
				{ ...flow("f3", "gw", "b"), name: "Path B" },
				flow("f4", "a", "join"),
				flow("f5", "b", "join"),
				flow("f6", "join", "e"),
			],
		)

		const result = layoutProcess(process)
		const labels = result.edges
			.filter((e) => e.labelBounds)
			.map((e) => e.labelBounds as NonNullable<typeof e.labelBounds>)

		// Check no two labels overlap
		for (let i = 0; i < labels.length; i++) {
			for (let j = i + 1; j < labels.length; j++) {
				const a = labels[i]
				const b = labels[j]
				if (!a || !b) continue
				const overlap =
					a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
				expect(overlap).toBe(false)
			}
		}
	})
})

describe("Grid-based coordinate system", () => {
	it("places elements centered in 150×140 grid cells", () => {
		const result = layoutFlowNodes(
			[node("start", "startEvent"), node("task", "serviceTask"), node("end", "endEvent")],
			[flow("f1", "start", "task"), flow("f2", "task", "end")],
		)

		// Each element should be centered within its grid cell (150×140);
		// layer === grid column, so centerX = col*150 + 75.
		for (const n of result.nodes) {
			const centerX = n.layer * 150 + 75
			const nodeCenterX = n.bounds.x + n.bounds.width / 2
			expect(nodeCenterX).toBeCloseTo(centerX, 0)
		}
	})

	it("respects grid spacing between layers", () => {
		const result = layoutFlowNodes(
			[node("a", "serviceTask"), node("b", "serviceTask")],
			[flow("f1", "a", "b")],
		)
		const nodeA = result.nodes.find((n) => n.id === "a")
		const nodeB = result.nodes.find((n) => n.id === "b")
		expect(nodeA).toBeDefined()
		expect(nodeB).toBeDefined()
		if (!nodeA || !nodeB) return

		// Column 0 starts at x=0, column 1 at x=150 (grid cell width)
		expect(nodeB.bounds.x - nodeA.bounds.x).toBe(150)
	})

	it("grid spacing between nodes in same column is 140px cell height", () => {
		// Two disconnected nodes stack in the same column, adjacent rows.
		const result = layoutFlowNodes([node("a", "serviceTask"), node("b", "serviceTask")], [])
		const nodeA = result.nodes.find((n) => n.id === "a")
		const nodeB = result.nodes.find((n) => n.id === "b")
		expect(nodeA).toBeDefined()
		expect(nodeB).toBeDefined()
		if (!nodeA || !nodeB) return

		expect(nodeA.layer).toBe(nodeB.layer)
		const centerA = nodeA.bounds.y + nodeA.bounds.height / 2
		const centerB = nodeB.bounds.y + nodeB.bounds.height / 2
		expect(Math.abs(centerB - centerA)).toBeCloseTo(140, 0)
	})
})

describe("Lane proportional height", () => {
	/** Build a minimal BpmnDefinitions with two lanes and a collaboration. */
	function makeProcess(
		laneANodes: BpmnFlowElement[],
		laneBNodes: BpmnFlowElement[],
	): BpmnDefinitions {
		const allNodes = [...laneANodes, ...laneBNodes]
		const laneA: BpmnLane = {
			id: "laneA",
			name: "Lane A",
			flowNodeRefs: laneANodes.map((n) => n.id),
			unknownAttributes: {},
		}
		const laneB: BpmnLane = {
			id: "laneB",
			name: "Lane B",
			flowNodeRefs: laneBNodes.map((n) => n.id),
			unknownAttributes: {},
		}
		const process: BpmnProcess = {
			id: "proc",
			extensionElements: [],
			flowElements: allNodes,
			sequenceFlows: [flow("f1", allNodes[0]?.id ?? "s", allNodes[allNodes.length - 1]?.id ?? "e")],
			textAnnotations: [],
			associations: [],
			laneSet: { id: "ls1", lanes: [laneA, laneB] },
			unknownAttributes: {},
		}
		return {
			id: "defs",
			targetNamespace: "http://bpmn.io/schema/bpmn",
			namespaces: {},
			unknownAttributes: {},
			processes: [process],
			collaborations: [
				{
					id: "collab",
					participants: [{ id: "part1", processRef: "proc", unknownAttributes: {} }],
					messageFlows: [],
					unknownAttributes: {},
				},
			],
			messages: [],
			errors: [],
			signals: [],
			escalations: [],
			diagrams: [],
		}
	}

	it("lane with more elements gets more height than lane with fewer elements", () => {
		// Lane A: 4 service tasks (will occupy more vertical space)
		const laneANodes = [
			node("a1", "serviceTask"),
			node("a2", "serviceTask"),
			node("a3", "serviceTask"),
			node("a4", "serviceTask"),
		]
		// Lane B: 1 service task (minimal vertical space)
		const laneBNodes = [node("b1", "serviceTask")]

		const defs = makeProcess(laneANodes, laneBNodes)
		const result = applyAutoLayout(defs)

		const diagram = result.diagrams[0]
		expect(diagram).toBeDefined()
		if (!diagram) return

		const laneAShape = diagram.plane.shapes.find((s) => s.bpmnElement === "laneA")
		const laneBShape = diagram.plane.shapes.find((s) => s.bpmnElement === "laneB")
		expect(laneAShape).toBeDefined()
		expect(laneBShape).toBeDefined()
		if (!laneAShape || !laneBShape) return

		// Lane A has 4 tasks vs 1 task — must be taller
		expect(laneAShape.bounds.height).toBeGreaterThan(laneBShape.bounds.height)
	})

	it("lane heights sum to pool height", () => {
		const laneANodes = [node("a1", "serviceTask"), node("a2", "serviceTask")]
		const laneBNodes = [node("b1", "serviceTask")]

		const defs = makeProcess(laneANodes, laneBNodes)
		const result = applyAutoLayout(defs)

		const diagram = result.diagrams[0]
		if (!diagram) return

		const laneShapes = diagram.plane.shapes.filter(
			(s) => s.bpmnElement === "laneA" || s.bpmnElement === "laneB",
		)
		const poolShape = diagram.plane.shapes.find((s) => s.bpmnElement === "part1")
		expect(laneShapes).toHaveLength(2)
		expect(poolShape).toBeDefined()
		if (!poolShape) return

		const totalLaneH = laneShapes.reduce((sum, s) => sum + s.bounds.height, 0)
		// Lane heights must sum to pool height (within 1px for rounding)
		expect(Math.abs(totalLaneH - poolShape.bounds.height)).toBeLessThanOrEqual(1)
	})
})
