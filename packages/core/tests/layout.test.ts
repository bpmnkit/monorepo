import { describe, expect, it } from "vitest";
import type { BpmnFlowElement, BpmnProcess, BpmnSequenceFlow } from "../src/bpmn/bpmn-model.js";
import {
	alignBranchBaselines,
	alignSplitJoinPairs,
	assignCoordinates,
	findBaselinePath,
} from "../src/layout/coordinates.js";
import { minimizeCrossings } from "../src/layout/crossing.js";
import {
	buildGraph,
	detectBackEdges,
	reverseBackEdges,
	topologicalSort,
} from "../src/layout/graph.js";
import { assignLayers, groupByLayer } from "../src/layout/layers.js";
import { layoutProcess } from "../src/layout/layout-engine.js";
import { assertNoOverlap } from "../src/layout/overlap.js";
import { assignGatewayPorts, resolveTargetPort, routeEdges } from "../src/layout/routing.js";
import type { PortSide } from "../src/layout/routing.js";
import { VERTICAL_SPACING } from "../src/layout/types.js";
import type { LayoutNode, LayoutResult } from "../src/layout/types.js";

// Helper: create a simple flow element with required fields
function node(id: string, type: BpmnFlowElement["type"] = "serviceTask"): BpmnFlowElement {
	const base = {
		id,
		incoming: [] as string[],
		outgoing: [] as string[],
		extensionElements: [],
		unknownAttributes: {},
	};
	switch (type) {
		case "startEvent":
			return { ...base, type: "startEvent", eventDefinitions: [] };
		case "endEvent":
			return { ...base, type: "endEvent", eventDefinitions: [] };
		case "intermediateThrowEvent":
			return { ...base, type: "intermediateThrowEvent", eventDefinitions: [] };
		case "intermediateCatchEvent":
			return { ...base, type: "intermediateCatchEvent", eventDefinitions: [] };
		case "boundaryEvent":
			return { ...base, type: "boundaryEvent", attachedToRef: "", eventDefinitions: [] };
		case "exclusiveGateway":
			return { ...base, type: "exclusiveGateway" };
		case "parallelGateway":
			return { ...base, type: "parallelGateway" };
		case "inclusiveGateway":
			return { ...base, type: "inclusiveGateway" };
		case "eventBasedGateway":
			return { ...base, type: "eventBasedGateway" };
		case "callActivity":
			return { ...base, type: "callActivity" };
		case "adHocSubProcess":
			return {
				...base,
				type: "adHocSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		case "subProcess":
			return {
				...base,
				type: "subProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		case "eventSubProcess":
			return {
				...base,
				type: "eventSubProcess",
				flowElements: [],
				sequenceFlows: [],
				textAnnotations: [],
				associations: [],
			};
		default:
			return { ...base, type };
	}
}

// Helper: create a sequence flow
function flow(id: string, source: string, target: string): BpmnSequenceFlow {
	return { id, sourceRef: source, targetRef: target, extensionElements: [], unknownAttributes: {} };
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
	};
}

describe("Graph utilities", () => {
	it("builds adjacency lists from nodes and flows", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);

		expect(graph.nodes).toEqual(["a", "b", "c"]);
		expect(graph.successors.get("a")).toEqual(["b"]);
		expect(graph.successors.get("b")).toEqual(["c"]);
		expect(graph.predecessors.get("c")).toEqual(["b"]);
	});

	it("detects back-edges in a cycle", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c"), flow("f3", "c", "a")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);

		expect(backEdges).toHaveLength(1);
		expect(backEdges[0]?.sourceRef).toBe("c");
		expect(backEdges[0]?.targetRef).toBe("a");
	});

	it("detects no back-edges in a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);

		expect(backEdges).toHaveLength(0);
	});

	it("reverses back-edges to create a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c"), flow("f3", "c", "a")];
		const graph = buildGraph(nodes, flows);
		const backEdges = detectBackEdges(graph, flows);
		const dag = reverseBackEdges(graph, backEdges);

		// c→a should be reversed to a→c
		expect(dag.successors.get("c")).toEqual([]);
		expect(dag.successors.get("a")).toContain("c");
	});

	it("topologically sorts a DAG", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const sorted = topologicalSort(graph);

		expect(sorted.indexOf("a")).toBeLessThan(sorted.indexOf("b"));
		expect(sorted.indexOf("b")).toBeLessThan(sorted.indexOf("c"));
	});
});

describe("Layer assignment", () => {
	it("assigns layers using longest-path", () => {
		const nodes = [node("a"), node("b"), node("c")];
		const flows = [flow("f1", "a", "b"), flow("f2", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);

		expect(layers.get("a")).toBe(0);
		expect(layers.get("b")).toBe(1);
		expect(layers.get("c")).toBe(2);
	});

	it("groups nodes by layer", () => {
		const nodes = [node("a"), node("b"), node("c"), node("d")];
		const flows = [
			flow("f1", "a", "b"),
			flow("f2", "a", "c"),
			flow("f3", "b", "d"),
			flow("f4", "c", "d"),
		];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);
		const groups = groupByLayer(layers);

		expect(groups[0]).toContain("a");
		expect(groups[1]).toContain("b");
		expect(groups[1]).toContain("c");
		expect(groups[2]).toContain("d");
	});
});

describe("Crossing minimization", () => {
	it("preserves all nodes after minimization", () => {
		const nodes = [node("a"), node("b"), node("c"), node("d")];
		const flows = [flow("f1", "a", "c"), flow("f2", "a", "d"), flow("f3", "b", "c")];
		const graph = buildGraph(nodes, flows);
		const layers = assignLayers(graph);
		const groups = groupByLayer(layers);
		const result = minimizeCrossings(groups, graph);

		const allNodes = result.flat();
		expect(allNodes).toContain("a");
		expect(allNodes).toContain("b");
		expect(allNodes).toContain("c");
		expect(allNodes).toContain("d");
	});
});

describe("Coordinate assignment", () => {
	it("assigns coordinates with correct element sizes", () => {
		const flowNodes = [
			node("start", "startEvent"),
			node("task", "serviceTask"),
			node("end", "endEvent"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["start"], ["task"], ["end"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const startNode = result.find((n) => n.id === "start");
		const taskNode = result.find((n) => n.id === "task");
		const endNode = result.find((n) => n.id === "end");
		expect(startNode).toBeDefined();
		expect(taskNode).toBeDefined();
		expect(endNode).toBeDefined();
		if (!startNode || !taskNode || !endNode) return;

		expect(startNode.bounds.width).toBe(36);
		expect(startNode.bounds.height).toBe(36);
		expect(taskNode.bounds.width).toBe(100);
		expect(taskNode.bounds.height).toBe(80);
		expect(endNode.bounds.width).toBe(36);
		expect(endNode.bounds.height).toBe(36);
	});

	it("ensures horizontal spacing between layers", () => {
		const flowNodes = [node("start", "startEvent"), node("task", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["start"], ["task"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const startNode = result.find((n) => n.id === "start");
		const taskNode = result.find((n) => n.id === "task");
		expect(startNode).toBeDefined();
		expect(taskNode).toBeDefined();
		if (!startNode || !taskNode) return;

		// Task should be at least 80px (HORIZONTAL_SPACING) after start's right edge
		const startRight = startNode.bounds.x + startNode.bounds.width;
		expect(taskNode.bounds.x).toBeGreaterThanOrEqual(startRight + 80 - 1);
	});

	it("ensures vertical spacing between nodes in the same layer", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a", "b"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		const nodeA = result.find((n) => n.id === "a");
		const nodeB = result.find((n) => n.id === "b");
		expect(nodeA).toBeDefined();
		expect(nodeB).toBeDefined();
		if (!nodeA || !nodeB) return;

		const gap = nodeB.bounds.y - (nodeA.bounds.y + nodeA.bounds.height);
		expect(gap).toBeGreaterThanOrEqual(VERTICAL_SPACING - 1);
	});
});

describe("Edge routing", () => {
	it("routes forward edges with orthogonal segments", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a"], ["b"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
		const flows = [flow("f1", "a", "b")];
		const edges = routeEdges(flows, nodeMap, []);

		expect(edges).toHaveLength(1);
		const edge = edges[0];
		expect(edge).toBeDefined();
		if (!edge) return;
		expect(edge.waypoints.length).toBeGreaterThanOrEqual(2);

		// All segments should be orthogonal
		for (let i = 1; i < edge.waypoints.length; i++) {
			const prev = edge.waypoints[i - 1];
			const curr = edge.waypoints[i];
			if (!prev || !curr) continue;
			const isHorizontal = Math.abs(prev.y - curr.y) < 1;
			const isVertical = Math.abs(prev.x - curr.x) < 1;
			expect(isHorizontal || isVertical).toBe(true);
		}
	});

	it("routes back-edges above or below all nodes", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a"], ["b"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
		const flows = [flow("f1", "b", "a")];
		const backEdges = [{ flowId: "f1", sourceRef: "b", targetRef: "a" }];
		const edges = routeEdges(flows, nodeMap, backEdges);

		expect(edges).toHaveLength(1);
		const edge = edges[0];
		expect(edge).toBeDefined();
		if (!edge) return;

		// Back-edge should route above or below all nodes (shortest path)
		const minNodeY = Math.min(...layoutNodes.map((n) => n.bounds.y));
		const maxNodeY = Math.max(...layoutNodes.map((n) => n.bounds.y + n.bounds.height));
		const lowestWaypointY = Math.min(...edge.waypoints.map((w) => w.y));
		const highestWaypointY = Math.max(...edge.waypoints.map((w) => w.y));
		const routesAbove = lowestWaypointY < minNodeY;
		const routesBelow = highestWaypointY > maxNodeY;
		expect(routesAbove || routesBelow).toBe(true);
	});
});

describe("Gateway port assignment", () => {
	// Helper: create a named sequence flow
	function namedFlow(id: string, source: string, target: string, name?: string): BpmnSequenceFlow {
		return {
			id,
			sourceRef: source,
			targetRef: target,
			name,
			extensionElements: [],
			unknownAttributes: {},
		};
	}

	// Helper: create a minimal LayoutNode at a given position
	function layoutNode(id: string, type: BpmnFlowElement["type"], x: number, y: number): LayoutNode {
		const size =
			type === "exclusiveGateway" || type === "parallelGateway"
				? { width: 36, height: 36 }
				: { width: 100, height: 80 };
		return { id, type, bounds: { x, y, ...size }, layer: 0, position: 0 };
	}

	it("assigns right port for single outgoing edge", () => {
		const flows = [namedFlow("f1", "gw", "t1")];
		const nodeMap = new Map<string, LayoutNode>([
			["gw", layoutNode("gw", "exclusiveGateway", 0, 0)],
			["t1", layoutNode("t1", "serviceTask", 200, 0)],
		]);

		const ports = assignGatewayPorts(flows, nodeMap);

		expect(ports.get("f1")).toBe("right");
	});

	it("assigns top and bottom for 2 outgoing edges (even)", () => {
		const flows = [namedFlow("f1", "gw", "t1"), namedFlow("f2", "gw", "t2")];
		const nodeMap = new Map<string, LayoutNode>([
			["gw", layoutNode("gw", "exclusiveGateway", 0, 100)],
			["t1", layoutNode("t1", "serviceTask", 200, 0)],
			["t2", layoutNode("t2", "serviceTask", 200, 200)],
		]);

		const ports = assignGatewayPorts(flows, nodeMap);

		expect(ports.get("f1")).toBe("top");
		expect(ports.get("f2")).toBe("bottom");
		expect([...ports.values()].filter((p) => p === "right")).toHaveLength(0);
	});

	it("assigns top, right, bottom for 3 outgoing edges (odd)", () => {
		const flows = [
			namedFlow("f1", "gw", "t1"),
			namedFlow("f2", "gw", "t2"),
			namedFlow("f3", "gw", "t3"),
		];
		const nodeMap = new Map<string, LayoutNode>([
			["gw", layoutNode("gw", "exclusiveGateway", 0, 150)],
			["t1", layoutNode("t1", "serviceTask", 200, 0)],
			["t2", layoutNode("t2", "serviceTask", 200, 150)],
			["t3", layoutNode("t3", "serviceTask", 200, 300)],
		]);

		const ports = assignGatewayPorts(flows, nodeMap);

		expect(ports.get("f1")).toBe("top");
		expect(ports.get("f2")).toBe("right");
		expect(ports.get("f3")).toBe("bottom");
	});

	it("distributes 5 outgoing edges: 2 top, 1 right, 2 bottom", () => {
		const flows = Array.from({ length: 5 }, (_, i) => namedFlow(`f${i}`, "gw", `t${i}`));
		const nodeMap = new Map<string, LayoutNode>([
			["gw", layoutNode("gw", "parallelGateway", 0, 200)],
			...Array.from(
				{ length: 5 },
				(_, i) =>
					[`t${i}`, layoutNode(`t${i}`, "serviceTask", 200, i * 100)] as [string, LayoutNode],
			),
		]);

		const ports = assignGatewayPorts(flows, nodeMap);

		const sides = [...ports.values()];
		expect(sides.filter((s) => s === "top")).toHaveLength(2);
		expect(sides.filter((s) => s === "right")).toHaveLength(1);
		expect(sides.filter((s) => s === "bottom")).toHaveLength(2);
	});

	it("distributes 4 outgoing edges: 2 top, 2 bottom (no right)", () => {
		const flows = Array.from({ length: 4 }, (_, i) => namedFlow(`f${i}`, "gw", `t${i}`));
		const nodeMap = new Map<string, LayoutNode>([
			["gw", layoutNode("gw", "inclusiveGateway", 0, 200)],
			...Array.from(
				{ length: 4 },
				(_, i) =>
					[`t${i}`, layoutNode(`t${i}`, "serviceTask", 200, i * 100)] as [string, LayoutNode],
			),
		]);

		const ports = assignGatewayPorts(flows, nodeMap);

		const sides = [...ports.values()];
		expect(sides.filter((s) => s === "top")).toHaveLength(2);
		expect(sides.filter((s) => s === "right")).toHaveLength(0);
		expect(sides.filter((s) => s === "bottom")).toHaveLength(2);
	});

	it("returns empty map for no outgoing edges", () => {
		const ports = assignGatewayPorts([], new Map());
		expect(ports.size).toBe(0);
	});

	it("gateway edges exit from correct port positions in routed edges", () => {
		const flowNodes = [
			node("gw", "exclusiveGateway"),
			node("t1", "serviceTask"),
			node("t2", "serviceTask"),
			node("t3", "serviceTask"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["gw"], ["t1", "t2", "t3"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);
		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

		const flows = [flow("f1", "gw", "t1"), flow("f2", "gw", "t2"), flow("f3", "gw", "t3")];
		const edges = routeEdges(flows, nodeMap, []);

		expect(edges).toHaveLength(3);

		const gwNode = layoutNodes.find((n) => n.id === "gw");
		expect(gwNode).toBeDefined();
		if (!gwNode) return;
		const gwCenterX = gwNode.bounds.x + gwNode.bounds.width / 2;
		const gwRight = gwNode.bounds.x + gwNode.bounds.width;
		const gwTop = gwNode.bounds.y;
		const gwBottom = gwNode.bounds.y + gwNode.bounds.height;

		// Sort edges by target y to match port assignment order
		const sortedEdges = [...edges].sort((a, b) => {
			const tA = nodeMap.get(a.targetRef);
			const tB = nodeMap.get(b.targetRef);
			if (!tA || !tB) return 0;
			return tA.bounds.y + tA.bounds.height / 2 - (tB.bounds.y + tB.bounds.height / 2);
		});

		// Top-port edge: starts at gateway's top center
		const topEdge = sortedEdges[0];
		expect(topEdge).toBeDefined();
		if (!topEdge) return;
		expect(topEdge.waypoints[0]?.x).toBeCloseTo(gwCenterX, 0);
		expect(topEdge.waypoints[0]?.y).toBeCloseTo(gwTop, 0);

		// Right-port edge: starts at gateway's right center
		const rightEdge = sortedEdges[1];
		expect(rightEdge).toBeDefined();
		if (!rightEdge) return;
		expect(rightEdge.waypoints[0]?.x).toBeCloseTo(gwRight, 0);

		// Bottom-port edge: starts at gateway's bottom center
		const bottomEdge = sortedEdges[2];
		expect(bottomEdge).toBeDefined();
		if (!bottomEdge) return;
		expect(bottomEdge.waypoints[0]?.x).toBeCloseTo(gwCenterX, 0);
		expect(bottomEdge.waypoints[0]?.y).toBeCloseTo(gwBottom, 0);

		// All segments should be orthogonal
		for (const edge of edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const prev = edge.waypoints[i - 1];
				const curr = edge.waypoints[i];
				if (!prev || !curr) continue;
				const isH = Math.abs(prev.y - curr.y) < 1;
				const isV = Math.abs(prev.x - curr.x) < 1;
				expect(isH || isV).toBe(true);
			}
		}
	});

	it("non-gateway sources always use right port", () => {
		const flowNodes = [
			node("task", "serviceTask"),
			node("t1", "serviceTask"),
			node("t2", "serviceTask"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["task"], ["t1", "t2"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);
		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

		const flows = [flow("f1", "task", "t1"), flow("f2", "task", "t2")];
		const edges = routeEdges(flows, nodeMap, []);

		const taskNode = layoutNodes.find((n) => n.id === "task");
		expect(taskNode).toBeDefined();
		if (!taskNode) return;
		const taskRight = taskNode.bounds.x + taskNode.bounds.width;

		// Both edges should start from the right side (not top/bottom)
		for (const edge of edges) {
			expect(edge.waypoints[0]?.x).toBeCloseTo(taskRight, 0);
		}
	});
});

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
		};

		expect(() => assertNoOverlap(result)).not.toThrow();
	});

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
		};

		expect(() => assertNoOverlap(result)).toThrow(/overlap/i);
	});
});

describe("Layout engine (integration)", () => {
	it("lays out a simple linear process", () => {
		const process = proc(
			"process1",
			[node("start", "startEvent"), node("task1", "serviceTask"), node("end", "endEvent")],
			[flow("f1", "start", "task1"), flow("f2", "task1", "end")],
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(3);
		expect(result.edges).toHaveLength(2);

		// All edges should be orthogonal
		for (const edge of result.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const prev = edge.waypoints[i - 1];
				const curr = edge.waypoints[i];
				if (!prev || !curr) continue;
				const isHorizontal = Math.abs(prev.y - curr.y) < 1;
				const isVertical = Math.abs(prev.x - curr.x) < 1;
				expect(isHorizontal || isVertical).toBe(true);
			}
		}
	});

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
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(6);
		expect(result.edges).toHaveLength(6);

		// taskA and taskB should be in the same layer (column) at different y positions
		const taskA = result.nodes.find((n) => n.id === "taskA");
		const taskB = result.nodes.find((n) => n.id === "taskB");
		expect(taskA).toBeDefined();
		expect(taskB).toBeDefined();
		if (!taskA || !taskB) return;
		expect(taskA.layer).toBe(taskB.layer);
		expect(taskA.bounds.y).not.toBe(taskB.bounds.y);
	});

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
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(4);
		expect(result.edges).toHaveLength(4);

		// The back-edge should route above other elements
		const backEdge = result.edges.find((e) => e.id === "f4");
		expect(backEdge).toBeDefined();
		if (!backEdge) return;
		expect(backEdge.waypoints.length).toBeGreaterThan(2);
	});

	it("lays out a 9-branch exclusive gateway", () => {
		const branches = Array.from({ length: 9 }, (_, i) => `branch${i}`);
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
		);

		const result = layoutProcess(process);

		expect(result.nodes).toHaveLength(13); // start + gw1 + 9 branches + gw2 + end
		expect(result.edges).toHaveLength(20); // f0 + 9 fan-out + 9 fan-in + fend

		// All 9 branches should be in the same layer
		const branchNodes = result.nodes.filter((n) => n.id.startsWith("branch"));
		const branchLayers = new Set(branchNodes.map((n) => n.layer));
		expect(branchLayers.size).toBe(1);

		// No overlaps
		expect(() => assertNoOverlap(result)).not.toThrow();
	});

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
		);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(6);
		expect(() => assertNoOverlap(result)).not.toThrow();
	});

	it("lays out a process with named elements (label bounds)", () => {
		const namedStart = node("start", "startEvent");
		namedStart.name = "Begin";
		const namedGw = node("gw", "exclusiveGateway");
		namedGw.name = "Decision";

		const process = proc(
			"process6",
			[namedStart, node("task", "serviceTask"), namedGw, node("end", "endEvent")],
			[flow("f1", "start", "task"), flow("f2", "task", "gw"), flow("f3", "gw", "end")],
		);

		const result = layoutProcess(process);

		const startNode = result.nodes.find((n) => n.id === "start");
		const gwNode = result.nodes.find((n) => n.id === "gw");
		expect(startNode).toBeDefined();
		expect(gwNode).toBeDefined();
		if (!startNode || !gwNode) return;

		// Start event label should be below the element
		expect(startNode.labelBounds).toBeDefined();
		expect(startNode.labelBounds?.y).toBeGreaterThan(startNode.bounds.y + startNode.bounds.height);

		// Gateway label should be above the element
		expect(gwNode.labelBounds).toBeDefined();
		expect(gwNode.labelBounds?.y).toBeLessThan(gwNode.bounds.y);
	});

	it("lays out a sub-process expanded with children inside", () => {
		const subprocess = node("sub", "adHocSubProcess") as BpmnFlowElement & {
			flowElements: BpmnFlowElement[];
			sequenceFlows: BpmnSequenceFlow[];
		};
		subprocess.flowElements = [node("child1", "serviceTask"), node("child2", "serviceTask")];
		subprocess.sequenceFlows = [flow("cf1", "child1", "child2")];

		const process = proc(
			"process7",
			[node("start", "startEvent"), subprocess, node("end", "endEvent")],
			[flow("f1", "start", "sub"), flow("f2", "sub", "end")],
		);

		const result = layoutProcess(process);

		const parentNode = result.nodes.find((n) => n.id === "sub");
		expect(parentNode).toBeDefined();
		if (!parentNode) return;
		// Expanded sub-process is larger than a regular task
		expect(parentNode.bounds.width).toBeGreaterThan(100);
		expect(parentNode.bounds.height).toBeGreaterThan(80);
		expect(parentNode.isExpanded).toBe(true);

		// Child nodes are in the layout result
		const child1 = result.nodes.find((n) => n.id === "child1");
		const child2 = result.nodes.find((n) => n.id === "child2");
		expect(child1).toBeDefined();
		expect(child2).toBeDefined();
	});

	it("handles an empty process", () => {
		const process = proc("empty", [], []);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(0);
		expect(result.edges).toHaveLength(0);
	});

	it("handles disconnected nodes", () => {
		const process = proc("disconnected", [node("a", "serviceTask"), node("b", "serviceTask")], []);

		const result = layoutProcess(process);
		expect(result.nodes).toHaveLength(2);
		expect(() => assertNoOverlap(result)).not.toThrow();
	});
});

describe("Branch baseline alignment", () => {
	it("aligns linear sequence nodes to the same y-coordinate", () => {
		// s → a → b → e: all should share the same center-y
		const process = proc(
			"linear",
			[node("s", "startEvent"), node("a"), node("b"), node("e", "endEvent")],
			[flow("f1", "s", "a"), flow("f2", "a", "b"), flow("f3", "b", "e")],
		);

		const result = layoutProcess(process);
		const centerYs = result.nodes.map((n) => n.bounds.y + n.bounds.height / 2);
		const first = centerYs[0];
		expect(first).toBeDefined();
		for (const cy of centerYs) {
			expect(cy).toBeCloseTo(first as number, 0);
		}
	});

	it("keeps branches on different y from the main flow", () => {
		// s → gw → a (top branch) → join → e
		//       → b (bottom branch) → join
		const process = proc(
			"branching",
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
				flow("f2", "gw", "a"),
				flow("f3", "gw", "b"),
				flow("f4", "a", "join"),
				flow("f5", "b", "join"),
				flow("f6", "join", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
		const aCenter = (nodeMap.get("a")?.bounds.y ?? 0) + (nodeMap.get("a")?.bounds.height ?? 0) / 2;
		const bCenter = (nodeMap.get("b")?.bounds.y ?? 0) + (nodeMap.get("b")?.bounds.height ?? 0) / 2;
		// Branches should be on different y-coordinates
		expect(Math.abs(aCenter - bCenter)).toBeGreaterThan(10);
	});
});

describe("Split/Join Y-alignment", () => {
	it("aligns fork and join gateways to the same y-coordinate", () => {
		const process = proc(
			"fork-join",
			[
				node("s", "startEvent"),
				node("fork", "parallelGateway"),
				node("a"),
				node("b"),
				node("join", "parallelGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "fork"),
				flow("f2", "fork", "a"),
				flow("f3", "fork", "b"),
				flow("f4", "a", "join"),
				flow("f5", "b", "join"),
				flow("f6", "join", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
		const forkCenterY =
			(nodeMap.get("fork")?.bounds.y ?? 0) + (nodeMap.get("fork")?.bounds.height ?? 0) / 2;
		const joinCenterY =
			(nodeMap.get("join")?.bounds.y ?? 0) + (nodeMap.get("join")?.bounds.height ?? 0) / 2;
		expect(forkCenterY).toBeCloseTo(joinCenterY, 0);
	});

	it("aligns exclusive gateway split/join pairs", () => {
		const process = proc(
			"excl-fork-join",
			[
				node("s", "startEvent"),
				node("split", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("merge", "exclusiveGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "split"),
				flow("f2", "split", "a"),
				flow("f3", "split", "b"),
				flow("f4", "a", "merge"),
				flow("f5", "b", "merge"),
				flow("f6", "merge", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));
		const splitCenterY =
			(nodeMap.get("split")?.bounds.y ?? 0) + (nodeMap.get("split")?.bounds.height ?? 0) / 2;
		const mergeCenterY =
			(nodeMap.get("merge")?.bounds.y ?? 0) + (nodeMap.get("merge")?.bounds.height ?? 0) / 2;
		expect(splitCenterY).toBeCloseTo(mergeCenterY, 0);
	});
});

describe("Edge label collision avoidance", () => {
	it("places edge labels without overlapping nodes", () => {
		const process = proc(
			"labeled",
			[node("s", "startEvent"), node("a"), node("e", "endEvent")],
			[
				{ ...flow("f1", "s", "a"), name: "Go to A" },
				{ ...flow("f2", "a", "e"), name: "Finish" },
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));

		for (const edge of result.edges) {
			if (!edge.labelBounds) continue;
			for (const n of result.nodes) {
				// Check label doesn't overlap any non-parent/child node
				const lOverlap =
					edge.labelBounds.x < n.bounds.x + n.bounds.width &&
					edge.labelBounds.x + edge.labelBounds.width > n.bounds.x &&
					edge.labelBounds.y < n.bounds.y + n.bounds.height &&
					edge.labelBounds.y + edge.labelBounds.height > n.bounds.y;
				if (lOverlap) {
					// Allow overlap with source/target only
					expect([edge.sourceRef, edge.targetRef]).toContain(n.id);
				}
			}
		}
	});

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
		);

		const result = layoutProcess(process);
		const labels = result.edges
			.filter((e) => e.labelBounds)
			.map((e) => e.labelBounds as NonNullable<typeof e.labelBounds>);

		// Check no two labels overlap
		for (let i = 0; i < labels.length; i++) {
			for (let j = i + 1; j < labels.length; j++) {
				const a = labels[i];
				const b = labels[j];
				if (!a || !b) continue;
				const overlap =
					a.x < b.x + b.width &&
					a.x + a.width > b.x &&
					a.y < b.y + b.height &&
					a.y + a.height > b.y;
				expect(overlap).toBe(false);
			}
		}
	});
});

describe("Edge routing efficiency", () => {
	it("uses 2 or fewer bends for simple forward edges", () => {
		const process = proc(
			"simple",
			[node("s", "startEvent"), node("a"), node("e", "endEvent")],
			[flow("f1", "s", "a"), flow("f2", "a", "e")],
		);

		const result = layoutProcess(process);
		for (const edge of result.edges) {
			// Each edge should have at most 4 waypoints (= 2 bends)
			expect(edge.waypoints.length).toBeLessThanOrEqual(4);
		}
	});

	it("gateway port routes have comparable or fewer bends than right-only", () => {
		// 3-branch gateway: one right, one top, one bottom
		const process = proc(
			"gw-bends",
			[
				node("s", "startEvent"),
				node("gw", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("c"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "gw"),
				flow("f2", "gw", "a"),
				flow("f3", "gw", "b"),
				flow("f4", "gw", "c"),
				flow("f5", "a", "e"),
				flow("f6", "b", "e"),
				flow("f7", "c", "e"),
			],
		);

		const result = layoutProcess(process);
		// All gateway outgoing edges should route with ≤ 4 waypoints (2 bends)
		const gwEdges = result.edges.filter((e) => e.sourceRef === "gw");
		for (const edge of gwEdges) {
			expect(edge.waypoints.length).toBeLessThanOrEqual(4);
		}
	});
});

describe("resolveTargetPort", () => {
	function portNode(id: string, type: string, x: number, y: number): LayoutNode {
		const isGateway = [
			"exclusiveGateway",
			"parallelGateway",
			"inclusiveGateway",
			"eventBasedGateway",
		].includes(type);
		const w = isGateway ? 36 : 100;
		const h = isGateway ? 36 : 80;
		return {
			id,
			type,
			bounds: { x, y, width: w, height: h },
			labelBounds: undefined,
		};
	}

	it("returns left for non-gateway targets regardless of Y position", () => {
		const source = portNode("gw", "exclusiveGateway", 0, 100);
		const taskAbove = portNode("t1", "serviceTask", 200, 0);
		const taskBelow = portNode("t2", "serviceTask", 200, 300);
		const taskSameY = portNode("t3", "serviceTask", 200, 100);
		const startEvt = portNode("s1", "startEvent", 200, 0);
		const subProc = portNode("sp1", "subProcess", 200, 300);
		const noJoins = new Set<string>();

		expect(resolveTargetPort(source, taskAbove, noJoins)).toBe("left");
		expect(resolveTargetPort(source, taskBelow, noJoins)).toBe("left");
		expect(resolveTargetPort(source, taskSameY, noJoins)).toBe("left");
		expect(resolveTargetPort(source, startEvt, noJoins)).toBe("left");
		expect(resolveTargetPort(source, subProc, noJoins)).toBe("left");
	});

	it("returns left for split (non-join) gateways regardless of Y position", () => {
		const source = portNode("t1", "serviceTask", 0, 100);
		const splitGw = portNode("gw1", "exclusiveGateway", 200, 200);
		const noJoins = new Set<string>();

		expect(resolveTargetPort(source, splitGw, noJoins)).toBe("left");
	});

	it("returns top/bottom/left for join gateway targets based on relative Y", () => {
		const source = portNode("gw1", "exclusiveGateway", 0, 100);
		const gwBelow = portNode("gw2", "parallelGateway", 200, 200);
		const gwAbove = portNode("gw3", "inclusiveGateway", 200, 0);
		const gwSameY = portNode("gw4", "eventBasedGateway", 200, 100);
		const joinIds = new Set(["gw2", "gw3", "gw4", "gw5", "gw6"]);

		expect(resolveTargetPort(source, gwBelow, joinIds)).toBe("top");
		expect(resolveTargetPort(source, gwAbove, joinIds)).toBe("bottom");
		expect(resolveTargetPort(source, gwSameY, joinIds)).toBe("left");

		const gwAlmostSameY = portNode("gw5", "exclusiveGateway", 200, 100.5);
		expect(resolveTargetPort(source, gwAlmostSameY, joinIds)).toBe("left");

		const gwJustOutside = portNode("gw6", "exclusiveGateway", 200, 102);
		expect(resolveTargetPort(source, gwJustOutside, joinIds)).toBe("top");
	});
});

describe("Grid-based coordinate system", () => {
	it("places elements centered in 200×160 grid cells", () => {
		const flowNodes = [
			node("start", "startEvent"),
			node("task", "serviceTask"),
			node("end", "endEvent"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["start"], ["task"], ["end"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);

		// Each element should be centered within its grid cell (200×160)
		for (const n of result) {
			const cellX = n.layer * 200;
			const centerX = cellX + 100;
			const nodeCenterX = n.bounds.x + n.bounds.width / 2;
			expect(nodeCenterX).toBeCloseTo(centerX, 0);
		}
	});

	it("respects grid spacing between layers", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a"], ["b"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);
		const nodeA = result.find((n) => n.id === "a");
		const nodeB = result.find((n) => n.id === "b");
		expect(nodeA).toBeDefined();
		expect(nodeB).toBeDefined();
		if (!nodeA || !nodeB) return;

		// Layer 0 starts at x=0, layer 1 at x=200 (grid cell width)
		expect(nodeB.bounds.x - nodeA.bounds.x).toBe(200);
	});

	it("grid spacing between nodes in same layer is 160px cell height", () => {
		const flowNodes = [node("a", "serviceTask"), node("b", "serviceTask")];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["a", "b"]];

		const result = assignCoordinates(orderedLayers, nodeIndex);
		const nodeA = result.find((n) => n.id === "a");
		const nodeB = result.find((n) => n.id === "b");
		expect(nodeA).toBeDefined();
		expect(nodeB).toBeDefined();
		if (!nodeA || !nodeB) return;

		// Nodes should be in adjacent grid rows (160px apart center-to-center)
		const centerA = nodeA.bounds.y + nodeA.bounds.height / 2;
		const centerB = nodeB.bounds.y + nodeB.bounds.height / 2;
		expect(Math.abs(centerB - centerA)).toBeCloseTo(160, 0);
	});
});

describe("L-shaped edge preference", () => {
	it("produces L-shaped edges (1 bend) instead of Z-shaped (2 bends) for forward edges", () => {
		const flowNodes = [
			node("gw", "exclusiveGateway"),
			node("t1", "serviceTask"),
			node("t2", "serviceTask"),
		];
		const nodeIndex = new Map(flowNodes.map((n) => [n.id, n]));
		const orderedLayers = [["gw"], ["t1", "t2"]];
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);
		const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

		const flows = [flow("f1", "gw", "t1"), flow("f2", "gw", "t2")];
		const edges = routeEdges(flows, nodeMap, []);

		// Each edge from a port should have at most 3 waypoints (L-shape = 1 bend)
		for (const edge of edges) {
			expect(edge.waypoints.length).toBeLessThanOrEqual(3);
		}
	});
});

describe("Early-return baseline", () => {
	it("positions shorter branches off the split gateway baseline", () => {
		const process = proc(
			"early-return",
			[
				node("s", "startEvent"),
				node("gw", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("c"),
				node("join", "exclusiveGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "gw"),
				flow("f2", "gw", "a"),
				flow("f3", "gw", "b"),
				flow("f4", "a", "join"),
				flow("f5", "b", "c"),
				flow("f6", "c", "join"),
				flow("f7", "join", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));

		const gwNode = nodeMap.get("gw");
		const aNode = nodeMap.get("a"); // short branch
		expect(gwNode).toBeDefined();
		expect(aNode).toBeDefined();
		if (!gwNode || !aNode) return;

		const gwCenterY = gwNode.bounds.y + gwNode.bounds.height / 2;
		const aCenterY = aNode.bounds.y + aNode.bounds.height / 2;

		// Short branch "a" should NOT be on the same Y as the gateway
		expect(Math.abs(aCenterY - gwCenterY)).toBeGreaterThan(10);
	});
});

describe("Baseline path detection", () => {
	it("finds the spine path (start → gateways → end) skipping branch content", () => {
		const elements = [
			node("s", "startEvent"),
			node("t1"),
			node("gw1", "exclusiveGateway"),
			node("t2"),
			node("t3"),
			node("t4"),
			node("gw2", "exclusiveGateway"),
			node("t5"),
			node("e", "endEvent"),
		];
		const flows = [
			flow("f1", "s", "t1"),
			flow("f2", "t1", "gw1"),
			flow("f3", "gw1", "t2"),
			flow("f4", "t2", "t3"),
			flow("f5", "t3", "gw2"),
			flow("f6", "gw1", "t4"),
			flow("f7", "t4", "gw2"),
			flow("f8", "gw2", "t5"),
			flow("f9", "t5", "e"),
		];
		const graph = buildGraph(elements, flows);
		const backEdges = detectBackEdges(graph, flows);
		const dag = backEdges.length > 0 ? reverseBackEdges(graph, backEdges) : graph;
		const layers = assignLayers(dag);
		const layerGroups = groupByLayer(layers);
		const orderedLayers = minimizeCrossings(layerGroups, dag);
		const nodeIndex = new Map(elements.map((n) => [n.id, n]));
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const baseline = findBaselinePath(layoutNodes, dag);
		// Should include start, t1, gw1, gw2, t5, end — NOT branch content (t2, t3, t4)
		expect(baseline).toContain("s");
		expect(baseline).toContain("t1");
		expect(baseline).toContain("gw1");
		expect(baseline).toContain("gw2");
		expect(baseline).toContain("t5");
		expect(baseline).toContain("e");
		expect(baseline).not.toContain("t2");
		expect(baseline).not.toContain("t3");
		expect(baseline).not.toContain("t4");
	});

	it("stops at split without a gateway successor or join", () => {
		const elements = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("a"),
			node("b"),
		];
		const flows = [flow("f1", "s", "gw"), flow("f2", "gw", "a"), flow("f3", "gw", "b")];
		const graph = buildGraph(elements, flows);
		const dag = graph;
		const layers = assignLayers(dag);
		const layerGroups = groupByLayer(layers);
		const orderedLayers = minimizeCrossings(layerGroups, dag);
		const nodeIndex = new Map(elements.map((n) => [n.id, n]));
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const baseline = findBaselinePath(layoutNodes, dag);
		// No gateway successor and no join → baseline stops at split
		expect(baseline).toEqual(["s", "gw"]);
	});

	it("follows the gateway successor when one branch is a dead-end", () => {
		const elements = [
			node("s", "startEvent"),
			node("gw", "exclusiveGateway"),
			node("deadEnd"),
			node("continue", "parallelGateway"),
			node("t1"),
			node("e", "endEvent"),
		];
		const flows = [
			flow("f1", "s", "gw"),
			flow("f2", "gw", "deadEnd"),
			flow("f3", "gw", "continue"),
			flow("f4", "continue", "t1"),
			flow("f5", "t1", "e"),
		];
		const graph = buildGraph(elements, flows);
		const dag = graph;
		const layers = assignLayers(dag);
		const layerGroups = groupByLayer(layers);
		const orderedLayers = minimizeCrossings(layerGroups, dag);
		const nodeIndex = new Map(elements.map((n) => [n.id, n]));
		const layoutNodes = assignCoordinates(orderedLayers, nodeIndex);

		const baseline = findBaselinePath(layoutNodes, dag);
		// Should follow gw → continue (gateway) → t1 → e, NOT gw → deadEnd
		expect(baseline).toContain("s");
		expect(baseline).toContain("gw");
		expect(baseline).toContain("continue");
		expect(baseline).toContain("t1");
		expect(baseline).toContain("e");
		expect(baseline).not.toContain("deadEnd");
	});
});

describe("Baseline Y-alignment", () => {
	it("aligns all baseline nodes to the same center-Y", () => {
		const process = proc(
			"bp",
			[
				node("s", "startEvent"),
				node("t1"),
				node("gw1", "exclusiveGateway"),
				node("t2"),
				node("t3"),
				node("t4"),
				node("gw2", "exclusiveGateway"),
				node("t5"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "t1"),
				flow("f2", "t1", "gw1"),
				flow("f3", "gw1", "t2"),
				flow("f4", "t2", "t3"),
				flow("f5", "t3", "gw2"),
				flow("f6", "gw1", "t4"),
				flow("f7", "t4", "gw2"),
				flow("f8", "gw2", "t5"),
				flow("f9", "t5", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));

		const baselineIds = ["s", "t1", "gw1", "gw2", "t5", "e"];
		const centerYs = baselineIds.map((id) => {
			const n = nodeMap.get(id);
			expect(n).toBeDefined();
			return (n?.bounds.y ?? 0) + (n?.bounds.height ?? 0) / 2;
		});

		// All baseline nodes should share the same center-Y
		const baselineY = centerYs[0] ?? 0;
		for (const cy of centerYs) {
			expect(Math.abs(cy - baselineY)).toBeLessThan(1);
		}
	});

	it("branch nodes are not on the baseline Y", () => {
		const process = proc(
			"bp",
			[
				node("s", "startEvent"),
				node("gw1", "exclusiveGateway"),
				node("a"),
				node("b"),
				node("gw2", "exclusiveGateway"),
				node("e", "endEvent"),
			],
			[
				flow("f1", "s", "gw1"),
				flow("f2", "gw1", "a"),
				flow("f3", "gw1", "b"),
				flow("f4", "a", "gw2"),
				flow("f5", "b", "gw2"),
				flow("f6", "gw2", "e"),
			],
		);

		const result = layoutProcess(process);
		const nodeMap = new Map(result.nodes.map((n) => [n.id, n]));

		const gw1 = nodeMap.get("gw1");
		const aNode = nodeMap.get("a");
		const bNode = nodeMap.get("b");
		expect(gw1).toBeDefined();
		expect(aNode).toBeDefined();
		expect(bNode).toBeDefined();
		if (!gw1 || !aNode || !bNode) return;

		const gw1CenterY = gw1.bounds.y + gw1.bounds.height / 2;
		const aCenterY = aNode.bounds.y + aNode.bounds.height / 2;
		const bCenterY = bNode.bounds.y + bNode.bounds.height / 2;

		// At least one branch should be off the baseline
		expect(Math.abs(aCenterY - gw1CenterY) > 10 || Math.abs(bCenterY - gw1CenterY) > 10).toBe(true);
	});
});
