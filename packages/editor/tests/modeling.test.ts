import { describe, expect, it } from "vitest"
import {
	changeElementType,
	copyElements,
	createConnection,
	createEmptyDefinitions,
	createShape,
	deleteElements,
	insertShapeOnEdge,
	moveShapes,
	pasteElements,
	resizeShape,
	updateLabel,
} from "../src/modeling.js"

describe("createEmptyDefinitions", () => {
	it("returns a valid BpmnDefinitions with one process and one diagram", () => {
		const defs = createEmptyDefinitions()
		expect(defs.id).toBeTruthy()
		expect(defs.processes).toHaveLength(1)
		expect(defs.diagrams).toHaveLength(1)
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		expect(proc.flowElements).toHaveLength(0)
		expect(proc.sequenceFlows).toHaveLength(0)
		const plane = defs.diagrams[0]?.plane
		if (!plane) throw new Error("no plane")
		expect(plane.shapes).toHaveLength(0)
		expect(plane.edges).toHaveLength(0)
	})

	it("plane.bpmnElement references the process id", () => {
		const defs = createEmptyDefinitions()
		const proc = defs.processes[0]
		const plane = defs.diagrams[0]?.plane
		if (!proc || !plane) throw new Error("missing data")
		expect(plane.bpmnElement).toBe(proc.id)
	})
})

describe("createShape", () => {
	it("creates a startEvent in process.flowElements and plane.shapes", () => {
		const base = createEmptyDefinitions()
		const { defs, id } = createShape(base, "startEvent", { x: 10, y: 20, width: 36, height: 36 })
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === id)
		expect(el).toBeDefined()
		expect(el?.type).toBe("startEvent")
		const shape = defs.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === id)
		expect(shape).toBeDefined()
		expect(shape?.bounds.x).toBe(10)
		expect(shape?.bounds.y).toBe(20)
	})

	it("creates a serviceTask with correct type", () => {
		const base = createEmptyDefinitions()
		const { defs, id } = createShape(base, "serviceTask", {
			x: 100,
			y: 60,
			width: 100,
			height: 80,
		})
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === id)
		expect(el?.type).toBe("serviceTask")
	})

	it("creates an exclusiveGateway with correct type", () => {
		const base = createEmptyDefinitions()
		const { defs, id } = createShape(base, "exclusiveGateway", {
			x: 200,
			y: 60,
			width: 50,
			height: 50,
		})
		const proc = defs.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === id)
		expect(el?.type).toBe("exclusiveGateway")
	})

	it("returns a new definitions without mutating the original", () => {
		const base = createEmptyDefinitions()
		const { defs } = createShape(base, "endEvent", { x: 0, y: 0, width: 36, height: 36 })
		expect(defs).not.toBe(base)
		const origProc = base.processes[0]
		if (!origProc) throw new Error("no process")
		expect(origProc.flowElements).toHaveLength(0)
	})
})

describe("createConnection", () => {
	it("adds sequenceFlow to process and edge to plane", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 200, y: 0, width: 36, height: 36 })
		defs = r2.defs

		const { defs: connected, id } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])

		const proc = connected.processes[0]
		if (!proc) throw new Error("no process")
		const sf = proc.sequenceFlows.find((f) => f.id === id)
		expect(sf).toBeDefined()
		expect(sf?.sourceRef).toBe(r1.id)
		expect(sf?.targetRef).toBe(r2.id)

		const edge = connected.diagrams[0]?.plane.edges.find((e) => e.bpmnElement === id)
		expect(edge).toBeDefined()
		expect(edge?.waypoints).toHaveLength(2)
	})

	it("updates source.outgoing and target.incoming", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 200, y: 0, width: 36, height: 36 })
		defs = r2.defs

		const { defs: connected, id: flowId } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])

		const proc = connected.processes[0]
		if (!proc) throw new Error("no process")
		const src = proc.flowElements.find((el) => el.id === r1.id)
		const tgt = proc.flowElements.find((el) => el.id === r2.id)
		expect(src?.outgoing).toContain(flowId)
		expect(tgt?.incoming).toContain(flowId)
	})
})

describe("moveShapes", () => {
	it("updates bounds of moved shapes", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "serviceTask", {
			x: 100,
			y: 100,
			width: 100,
			height: 80,
		})
		defs = d2

		const moved = moveShapes(defs, [{ id, dx: 50, dy: 30 }])
		const shape = moved.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === id)
		expect(shape?.bounds.x).toBe(150)
		expect(shape?.bounds.y).toBe(130)
	})

	it("translates edge waypoints when both endpoints move", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 200, y: 0, width: 36, height: 36 })
		defs = r2.defs
		const { defs: d3 } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])
		defs = d3

		const moved = moveShapes(defs, [
			{ id: r1.id, dx: 10, dy: 10 },
			{ id: r2.id, dx: 10, dy: 10 },
		])
		const edge = moved.diagrams[0]?.plane.edges[0]
		expect(edge?.waypoints[0]?.x).toBe(46)
		expect(edge?.waypoints[0]?.y).toBe(28)
	})
})

describe("resizeShape", () => {
	it("updates bounds of the target shape", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "serviceTask", {
			x: 100,
			y: 100,
			width: 100,
			height: 80,
		})
		defs = d2

		const resized = resizeShape(defs, id, { x: 90, y: 90, width: 120, height: 90 })
		const shape = resized.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === id)
		expect(shape?.bounds.width).toBe(120)
		expect(shape?.bounds.height).toBe(90)
	})
})

describe("deleteElements", () => {
	it("removes the shape and connected flows", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 200, y: 0, width: 36, height: 36 })
		defs = r2.defs
		const { defs: d3, id: flowId } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])
		defs = d3

		const after = deleteElements(defs, [r1.id])

		const proc = after.processes[0]
		if (!proc) throw new Error("no process")
		expect(proc.flowElements.find((el) => el.id === r1.id)).toBeUndefined()
		expect(proc.sequenceFlows.find((sf) => sf.id === flowId)).toBeUndefined()

		const plane = after.diagrams[0]?.plane
		if (!plane) throw new Error("no plane")
		expect(plane.shapes.find((s) => s.bpmnElement === r1.id)).toBeUndefined()
		expect(plane.edges.find((e) => e.bpmnElement === flowId)).toBeUndefined()
	})

	it("cleans up incoming/outgoing on remaining elements", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 200, y: 0, width: 36, height: 36 })
		defs = r2.defs
		const { defs: d3, id: flowId } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])
		defs = d3

		const after = deleteElements(defs, [r1.id])
		const proc = after.processes[0]
		if (!proc) throw new Error("no process")
		const endEl = proc.flowElements.find((el) => el.id === r2.id)
		expect(endEl?.incoming).not.toContain(flowId)
	})
})

describe("updateLabel", () => {
	it("updates the name of a flow element", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "serviceTask", {
			x: 0,
			y: 0,
			width: 100,
			height: 80,
		})
		defs = d2

		const updated = updateLabel(defs, id, "My Task")
		const proc = updated.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === id)
		expect(el?.name).toBe("My Task")
	})
})

describe("moveShapes label bounds", () => {
	it("translates label.bounds when shape has an external label", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "startEvent", {
			x: 100,
			y: 100,
			width: 36,
			height: 36,
		})
		defs = d2

		// Manually set label.bounds on the DI shape
		const diagram = defs.diagrams[0]
		if (!diagram) throw new Error("no diagram")
		const shapes = diagram.plane.shapes.map((s) =>
			s.bpmnElement === id
				? { ...s, label: { bounds: { x: 109, y: 144, width: 80, height: 20 } } }
				: s,
		)
		defs = {
			...defs,
			diagrams: [{ ...diagram, plane: { ...diagram.plane, shapes } }, ...defs.diagrams.slice(1)],
		}

		const moved = moveShapes(defs, [{ id, dx: 30, dy: -20 }])
		const shape = moved.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === id)
		expect(shape?.bounds.x).toBe(130)
		expect(shape?.bounds.y).toBe(80)
		expect(shape?.label?.bounds.x).toBe(139) // 109 + 30
		expect(shape?.label?.bounds.y).toBe(124) // 144 - 20
	})
})

describe("changeElementType", () => {
	it("changes exclusiveGateway to parallelGateway", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "exclusiveGateway", {
			x: 0,
			y: 0,
			width: 50,
			height: 50,
		})
		defs = d2

		const changed = changeElementType(defs, id, "parallelGateway")
		const proc = changed.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === id)
		expect(el?.type).toBe("parallelGateway")
	})

	it("preserves id, name, incoming, and outgoing", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 0, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "serviceTask", { x: 100, y: 0, width: 100, height: 80 })
		defs = r2.defs
		const { defs: d3 } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 18 },
			{ x: 100, y: 40 },
		])
		defs = d3

		const changed = changeElementType(defs, r2.id, "userTask")
		const proc = changed.processes[0]
		if (!proc) throw new Error("no process")
		const el = proc.flowElements.find((e) => e.id === r2.id)
		expect(el?.id).toBe(r2.id)
		expect(el?.type).toBe("userTask")
		expect(el?.incoming).toHaveLength(1)
	})

	it("supports scriptTask type", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id } = createShape(defs, "serviceTask", {
			x: 0,
			y: 0,
			width: 100,
			height: 80,
		})
		defs = d2
		const changed = changeElementType(defs, id, "scriptTask")
		const proc = changed.processes[0]
		if (!proc) throw new Error("no process")
		expect(proc.flowElements.find((e) => e.id === id)?.type).toBe("scriptTask")
	})
})

describe("insertShapeOnEdge", () => {
	it("splits the edge into two connections", () => {
		let defs = createEmptyDefinitions()
		const r1 = createShape(defs, "startEvent", { x: 0, y: 92, width: 36, height: 36 })
		defs = r1.defs
		const r2 = createShape(defs, "endEvent", { x: 300, y: 92, width: 36, height: 36 })
		defs = r2.defs
		const r3 = createShape(defs, "serviceTask", { x: 130, y: 70, width: 100, height: 80 })
		defs = r3.defs
		const { defs: d4, id: edgeId } = createConnection(defs, r1.id, r2.id, [
			{ x: 36, y: 110 },
			{ x: 300, y: 110 },
		])
		defs = d4

		const result = insertShapeOnEdge(defs, edgeId, r3.id)
		const proc = result.processes[0]
		if (!proc) throw new Error("no process")

		// Original edge removed
		expect(proc.sequenceFlows.find((sf) => sf.id === edgeId)).toBeUndefined()
		// Two new flows: r1→r3 and r3→r2
		const flowsFrom1 = proc.sequenceFlows.filter((sf) => sf.sourceRef === r1.id)
		const flowsTo2 = proc.sequenceFlows.filter((sf) => sf.targetRef === r2.id)
		expect(flowsFrom1).toHaveLength(1)
		expect(flowsTo2).toHaveLength(1)
		expect(flowsFrom1[0]?.targetRef).toBe(r3.id)
		expect(flowsTo2[0]?.sourceRef).toBe(r3.id)
	})
})

describe("copyElements + pasteElements", () => {
	it("generates new IDs and offsets positions", () => {
		let defs = createEmptyDefinitions()
		const { defs: d2, id: id1 } = createShape(defs, "startEvent", {
			x: 0,
			y: 0,
			width: 36,
			height: 36,
		})
		defs = d2
		const { defs: d3, id: id2 } = createShape(defs, "endEvent", {
			x: 200,
			y: 0,
			width: 36,
			height: 36,
		})
		defs = d3
		const { defs: d4 } = createConnection(defs, id1, id2, [
			{ x: 36, y: 18 },
			{ x: 200, y: 18 },
		])
		defs = d4

		const clipboard = copyElements(defs, [id1, id2])
		expect(clipboard.elements).toHaveLength(2)
		expect(clipboard.flows).toHaveLength(1)

		const { defs: pasted, newIds } = pasteElements(defs, clipboard, 50, 50)
		const proc = pasted.processes[0]
		if (!proc) throw new Error("no process")

		// Two original + two pasted shapes
		expect(proc.flowElements).toHaveLength(4)

		// New IDs are different from original
		const newId1 = newIds.get(id1)
		const newId2 = newIds.get(id2)
		expect(newId1).toBeDefined()
		expect(newId2).toBeDefined()
		expect(newId1).not.toBe(id1)
		expect(newId2).not.toBe(id2)

		// Offset applied to pasted shape
		const pastedShape = pasted.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === newId1)
		expect(pastedShape?.bounds.x).toBe(50) // 0 + 50
		expect(pastedShape?.bounds.y).toBe(50) // 0 + 50
	})
})
