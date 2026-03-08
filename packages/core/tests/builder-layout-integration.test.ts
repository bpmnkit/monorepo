import { beforeEach, describe, expect, it } from "vitest";
import type { BpmnDiEdge, BpmnDiShape, BpmnDiagram } from "../src/bpmn/bpmn-model.js";
import { Bpmn, resetIdCounter } from "../src/index.js";

/** Extracts the first process from BpmnDefinitions with a runtime assertion. */
function firstProcess(defs: ReturnType<ReturnType<typeof Bpmn.createProcess>["build"]>) {
	const p = defs.processes[0];
	expect(p).toBeDefined();
	return p as NonNullable<typeof p>;
}

/** Extracts the first diagram with assertion. */
function firstDiagram(
	defs: ReturnType<ReturnType<typeof Bpmn.createProcess>["build"]>,
): BpmnDiagram {
	expect(defs.diagrams).toHaveLength(1);
	const d = defs.diagrams[0];
	expect(d).toBeDefined();
	return d as NonNullable<typeof d>;
}

/** Returns shape by bpmnElement id, asserting it exists. */
function shapeFor(shapes: BpmnDiShape[], elementId: string): BpmnDiShape {
	const s = shapes.find((sh) => sh.bpmnElement === elementId);
	expect(s, `shape for ${elementId}`).toBeDefined();
	return s as NonNullable<typeof s>;
}

/** Returns edge by bpmnElement id, asserting it exists. */
function edgeFor(edges: BpmnDiEdge[], elementId: string): BpmnDiEdge {
	const e = edges.find((ed) => ed.bpmnElement === elementId);
	expect(e, `edge for ${elementId}`).toBeDefined();
	return e as NonNullable<typeof e>;
}

/** Checks that two shapes do not overlap. */
function shapesDoNotOverlap(a: BpmnDiShape, b: BpmnDiShape): void {
	const aRight = a.bounds.x + a.bounds.width;
	const aBottom = a.bounds.y + a.bounds.height;
	const bRight = b.bounds.x + b.bounds.width;
	const bBottom = b.bounds.y + b.bounds.height;
	const separated =
		aRight <= b.bounds.x || bRight <= a.bounds.x || aBottom <= b.bounds.y || bBottom <= a.bounds.y;
	expect(separated, `shapes ${a.bpmnElement} and ${b.bpmnElement} overlap`).toBe(true);
}

describe("Builder → auto-layout integration", () => {
	beforeEach(() => {
		resetIdCounter();
	});

	// -----------------------------------------------------------------------
	// Basic: every flow element gets a shape, every sequence flow gets an edge
	// -----------------------------------------------------------------------

	it("generates one shape per flow element and one edge per sequence flow", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t1", { name: "A", taskType: "a" })
			.serviceTask("t2", { name: "B", taskType: "b" })
			.endEvent("e")
			.build();

		const process = firstProcess(defs);
		const diagram = firstDiagram(defs);

		expect(diagram.plane.shapes).toHaveLength(process.flowElements.length);
		expect(diagram.plane.edges).toHaveLength(process.sequenceFlows.length);

		for (const el of process.flowElements) {
			shapeFor(diagram.plane.shapes, el.id);
		}
		for (const sf of process.sequenceFlows) {
			edgeFor(diagram.plane.edges, sf.id);
		}
	});

	// -----------------------------------------------------------------------
	// All shapes have positive width/height and non-negative coordinates
	// -----------------------------------------------------------------------

	it("all shapes have valid bounds with positive dimensions", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "a" }))
			.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "b" }))
			.exclusiveGateway("merge")
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		for (const shape of diagram.plane.shapes) {
			expect(shape.bounds.width, `${shape.bpmnElement} width`).toBeGreaterThan(0);
			expect(shape.bounds.height, `${shape.bpmnElement} height`).toBeGreaterThan(0);
			expect(shape.bounds.x, `${shape.bpmnElement} x`).toBeGreaterThanOrEqual(0);
			expect(shape.bounds.y, `${shape.bpmnElement} y`).toBeGreaterThanOrEqual(0);
		}
	});

	// -----------------------------------------------------------------------
	// All edges have at least 2 waypoints
	// -----------------------------------------------------------------------

	it("all edges have at least 2 waypoints", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t", { taskType: "job" })
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		for (const edge of diagram.plane.edges) {
			expect(edge.waypoints.length, `edge ${edge.bpmnElement}`).toBeGreaterThanOrEqual(2);
		}
	});

	// -----------------------------------------------------------------------
	// No shapes overlap each other
	// -----------------------------------------------------------------------

	it("no shapes overlap in a branching workflow", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.parallelGateway("fork")
			.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "a" }))
			.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "b" }))
			.branch("c", (b) => b.serviceTask("t3", { name: "C", taskType: "c" }))
			.parallelGateway("join")
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		const shapes = diagram.plane.shapes;
		for (let i = 0; i < shapes.length; i++) {
			for (let j = i + 1; j < shapes.length; j++) {
				shapesDoNotOverlap(shapes[i] as BpmnDiShape, shapes[j] as BpmnDiShape);
			}
		}
	});

	// -----------------------------------------------------------------------
	// Left-to-right ordering: elements later in the flow have higher x
	// -----------------------------------------------------------------------

	it("shapes follow left-to-right ordering for a linear flow", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t1", { taskType: "a" })
			.serviceTask("t2", { taskType: "b" })
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		const s = shapeFor(diagram.plane.shapes, "s");
		const t1 = shapeFor(diagram.plane.shapes, "t1");
		const t2 = shapeFor(diagram.plane.shapes, "t2");
		const e = shapeFor(diagram.plane.shapes, "e");

		expect(s.bounds.x).toBeLessThan(t1.bounds.x);
		expect(t1.bounds.x).toBeLessThan(t2.bounds.x);
		expect(t2.bounds.x).toBeLessThan(e.bounds.x);
	});

	// -----------------------------------------------------------------------
	// Diagram plane references the process
	// -----------------------------------------------------------------------

	it("diagram plane references the correct process id", () => {
		const defs = Bpmn.createProcess("myProcess")
			.withAutoLayout()
			.startEvent("s")
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		expect(diagram.plane.bpmnElement).toBe("myProcess");
		expect(diagram.id).toBe("myProcess_di");
		expect(diagram.plane.id).toBe("myProcess_di_plane");
	});

	// -----------------------------------------------------------------------
	// Shape IDs follow the convention: {elementId}_di
	// -----------------------------------------------------------------------

	it("shape and edge IDs follow {elementId}_di convention", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t", { taskType: "x" })
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		for (const shape of diagram.plane.shapes) {
			expect(shape.id).toBe(`${shape.bpmnElement}_di`);
		}
		for (const edge of diagram.plane.edges) {
			expect(edge.id).toBe(`${edge.bpmnElement}_di`);
		}
	});

	// -----------------------------------------------------------------------
	// Export → parse roundtrip preserves layout data
	// -----------------------------------------------------------------------

	it("layout data survives export → parse roundtrip", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t", { name: "Task", taskType: "job" })
			.endEvent("e")
			.build();

		const xml = Bpmn.export(defs);
		const parsed = Bpmn.parse(xml);

		const original = firstDiagram(defs);
		const roundtripped = firstDiagram(parsed);

		expect(roundtripped.plane.shapes).toHaveLength(original.plane.shapes.length);
		expect(roundtripped.plane.edges).toHaveLength(original.plane.edges.length);

		// Verify positions are preserved (not zeroed out)
		for (const shape of roundtripped.plane.shapes) {
			const orig = shapeFor(original.plane.shapes, shape.bpmnElement);
			expect(shape.bounds.x).toBeCloseTo(orig.bounds.x, 0);
			expect(shape.bounds.y).toBeCloseTo(orig.bounds.y, 0);
			expect(shape.bounds.width).toBeCloseTo(orig.bounds.width, 0);
			expect(shape.bounds.height).toBeCloseTo(orig.bounds.height, 0);
		}

		for (const edge of roundtripped.plane.edges) {
			const orig = edgeFor(original.plane.edges, edge.bpmnElement);
			expect(edge.waypoints).toHaveLength(orig.waypoints.length);
		}
	});

	// -----------------------------------------------------------------------
	// Double roundtrip: export → parse → export produces identical XML
	// -----------------------------------------------------------------------

	it("layout data survives double roundtrip (export → parse → export)", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t", { name: "Task", taskType: "job" })
			.endEvent("e")
			.build();

		const xml1 = Bpmn.export(defs);
		const parsed = Bpmn.parse(xml1);
		const xml2 = Bpmn.export(parsed);

		expect(xml2).toBe(xml1);
	});

	// -----------------------------------------------------------------------
	// Exported XML contains BPMNDiagram elements
	// -----------------------------------------------------------------------

	it("exported XML contains bpmndi:BPMNDiagram with shapes and edges", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t", { taskType: "job" })
			.endEvent("e")
			.build();

		const xml = Bpmn.export(defs);

		expect(xml).toContain("bpmndi:BPMNDiagram");
		expect(xml).toContain("bpmndi:BPMNPlane");
		expect(xml).toContain("bpmndi:BPMNShape");
		expect(xml).toContain("bpmndi:BPMNEdge");
		expect(xml).toContain("dc:Bounds");
		expect(xml).toContain("di:waypoint");
	});

	// -----------------------------------------------------------------------
	// Subprocess layout: children positioned within parent bounds
	// -----------------------------------------------------------------------

	it("subprocess is expanded with child shapes in the diagram", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.adHocSubProcess(
				"sub",
				(b) => b.serviceTask("c1", { taskType: "x" }).serviceTask("c2", { taskType: "y" }),
				{ name: "SubProcess" },
			)
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		const sub = shapeFor(diagram.plane.shapes, "sub");

		// Expanded: larger than a regular task
		expect(sub.bounds.width).toBeGreaterThan(100);
		expect(sub.bounds.height).toBeGreaterThan(80);
		expect(sub.isExpanded).toBe(true);

		// Child shapes are in the diagram
		const childShapes = diagram.plane.shapes.filter(
			(s) => s.bpmnElement === "c1" || s.bpmnElement === "c2",
		);
		expect(childShapes).toHaveLength(2);
	});

	// -----------------------------------------------------------------------
	// Complex workflow: order-processing style
	// -----------------------------------------------------------------------

	it("handles a complex multi-pattern workflow", () => {
		const defs = Bpmn.createProcess("order")
			.withAutoLayout()
			.name("Order Processing")
			.startEvent("start", { name: "Order Received" })
			.serviceTask("validate", { name: "Validate", taskType: "validate-order" })
			.exclusiveGateway("check")
			.branch("valid", (b) =>
				b
					.serviceTask("process", { name: "Process", taskType: "process-order" })
					.serviceTask("ship", { name: "Ship", taskType: "ship-order" }),
			)
			.branch("invalid", (b) =>
				b.serviceTask("reject", { name: "Reject", taskType: "reject-order" }),
			)
			.exclusiveGateway("merge")
			.endEvent("end", { name: "Done" })
			.build();

		const process = firstProcess(defs);
		const diagram = firstDiagram(defs);

		// Every element has a shape
		expect(diagram.plane.shapes).toHaveLength(process.flowElements.length);
		// Every sequence flow has an edge
		expect(diagram.plane.edges).toHaveLength(process.sequenceFlows.length);

		// Branching tasks at different y positions
		const processShape = shapeFor(diagram.plane.shapes, "process");
		const rejectShape = shapeFor(diagram.plane.shapes, "reject");
		expect(processShape.bounds.y).not.toBe(rejectShape.bounds.y);

		// No overlaps
		const shapes = diagram.plane.shapes;
		for (let i = 0; i < shapes.length; i++) {
			for (let j = i + 1; j < shapes.length; j++) {
				shapesDoNotOverlap(shapes[i] as BpmnDiShape, shapes[j] as BpmnDiShape);
			}
		}
	});

	// -----------------------------------------------------------------------
	// Without autoLayout: diagrams remain empty
	// -----------------------------------------------------------------------

	it("without withAutoLayout(), diagrams array is empty", () => {
		const defs = Bpmn.createProcess("p1")
			.startEvent("s")
			.serviceTask("t", { taskType: "job" })
			.endEvent("e")
			.build();

		expect(defs.diagrams).toHaveLength(0);
	});

	// -----------------------------------------------------------------------
	// Edge waypoints are orthogonal (horizontal or vertical segments)
	// -----------------------------------------------------------------------

	it("all edge waypoints form orthogonal segments", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.serviceTask("t1", { taskType: "a" })
			.serviceTask("t2", { taskType: "b" })
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		for (const edge of diagram.plane.edges) {
			for (let i = 1; i < edge.waypoints.length; i++) {
				const prev = edge.waypoints[i - 1];
				const curr = edge.waypoints[i];
				if (!prev || !curr) continue;
				const isHorizontal = Math.abs(prev.y - curr.y) < 1;
				const isVertical = Math.abs(prev.x - curr.x) < 1;
				expect(
					isHorizontal || isVertical,
					`edge ${edge.bpmnElement} segment ${i} is diagonal: (${prev.x},${prev.y})→(${curr.x},${curr.y})`,
				).toBe(true);
			}
		}
	});

	// -----------------------------------------------------------------------
	// Element-type sizing: events are 36×36, tasks are 100×80, gateways are 50×50
	// -----------------------------------------------------------------------

	it("element types have correct standard sizes", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("a", (b) => b.serviceTask("t", { taskType: "x" }))
			.exclusiveGateway("merge")
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		const startShape = shapeFor(diagram.plane.shapes, "s");
		const gwShape = shapeFor(diagram.plane.shapes, "gw");
		const taskShape = shapeFor(diagram.plane.shapes, "t");
		const endShape = shapeFor(diagram.plane.shapes, "e");

		expect(startShape.bounds.width).toBe(36);
		expect(startShape.bounds.height).toBe(36);
		expect(endShape.bounds.width).toBe(36);
		expect(endShape.bounds.height).toBe(36);
		expect(gwShape.bounds.width).toBe(36);
		expect(gwShape.bounds.height).toBe(36);
		expect(taskShape.bounds.width).toBe(100);
		expect(taskShape.bounds.height).toBe(80);
	});

	// -----------------------------------------------------------------------
	// Non-gateway targets receive edges from the left side
	// -----------------------------------------------------------------------

	it("edges entering non-gateway targets connect to the left side", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("upper", (b) => b.serviceTask("t1", { name: "Upper", taskType: "a" }))
			.branch("lower", (b) => b.serviceTask("t2", { name: "Lower", taskType: "b" }))
			.exclusiveGateway("merge")
			.endEvent("e")
			.build();

		const process = firstProcess(defs);
		const diagram = firstDiagram(defs);
		const t1Shape = shapeFor(diagram.plane.shapes, "t1");
		const t2Shape = shapeFor(diagram.plane.shapes, "t2");

		// Find the sequence flows targeting t1 and t2 by targetRef
		const sfToT1 = process.sequenceFlows.find((sf) => sf.targetRef === "t1");
		const sfToT2 = process.sequenceFlows.find((sf) => sf.targetRef === "t2");
		expect(sfToT1, "sequence flow targeting t1").toBeDefined();
		expect(sfToT2, "sequence flow targeting t2").toBeDefined();

		const edgeToT1 = edgeFor(diagram.plane.edges, sfToT1?.id ?? "");
		const edgeToT2 = edgeFor(diagram.plane.edges, sfToT2?.id ?? "");

		// Last waypoint of each edge must be at (left edge, center Y) of the target
		const lastT1 = edgeToT1.waypoints.at(-1);
		expect(lastT1).toBeDefined();
		expect(lastT1?.x, "t1 entry x at left edge").toBe(t1Shape.bounds.x);
		expect(lastT1?.y, "t1 entry y at center").toBeCloseTo(
			t1Shape.bounds.y + t1Shape.bounds.height / 2,
			0,
		);

		const lastT2 = edgeToT2.waypoints.at(-1);
		expect(lastT2).toBeDefined();
		expect(lastT2?.x, "t2 entry x at left edge").toBe(t2Shape.bounds.x);
		expect(lastT2?.y, "t2 entry y at center").toBeCloseTo(
			t2Shape.bounds.y + t2Shape.bounds.height / 2,
			0,
		);
	});

	// -----------------------------------------------------------------------
	// Vertical spacing between branches is adequate (VERTICAL_SPACING = 160)
	// -----------------------------------------------------------------------

	it("branch nodes have adequate vertical spacing after gateway split", () => {
		const defs = Bpmn.createProcess("p1")
			.withAutoLayout()
			.startEvent("s")
			.parallelGateway("fork")
			.branch("a", (b) => b.serviceTask("t1", { name: "A", taskType: "a" }))
			.branch("b", (b) => b.serviceTask("t2", { name: "B", taskType: "b" }))
			.parallelGateway("join")
			.endEvent("e")
			.build();

		const diagram = firstDiagram(defs);
		const t1Shape = shapeFor(diagram.plane.shapes, "t1");
		const t2Shape = shapeFor(diagram.plane.shapes, "t2");

		// Branches should be vertically separated by at least 80px gap (grid cell 160 - element 80)
		const upper = t1Shape.bounds.y < t2Shape.bounds.y ? t1Shape : t2Shape;
		const lower = t1Shape.bounds.y < t2Shape.bounds.y ? t2Shape : t1Shape;
		const gap = lower.bounds.y - (upper.bounds.y + upper.bounds.height);
		expect(gap).toBeGreaterThanOrEqual(79);
	});
});
