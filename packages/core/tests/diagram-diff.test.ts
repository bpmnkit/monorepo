import { describe, expect, it } from "vitest"
import { diffDiagram } from "../src/bpmn/diagram-diff.js"
import { Bpmn } from "../src/bpmn/index.js"

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Builds a two-element diagram whose geometry and task properties can be varied
 * independently, so each test changes exactly one thing.
 */
function makeXml(
	options: {
		taskX?: number
		taskName?: string
		taskType?: string
		extraTask?: boolean
		endWaypointY?: number
		taskExpanded?: boolean
	} = {},
): string {
	const {
		taskX = 200,
		taskName = "Do work",
		taskType = "worker",
		extraTask = false,
		endWaypointY = 118,
		taskExpanded,
	} = options

	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:zeebe="http://camunda.org/schema/zeebe/1.0"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start">
      <bpmn:outgoing>flow1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:serviceTask id="task" name="${taskName}">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="${taskType}" />
      </bpmn:extensionElements>
      <bpmn:incoming>flow1</bpmn:incoming>
    </bpmn:serviceTask>
    ${extraTask ? '<bpmn:serviceTask id="extra" name="Extra" />' : ""}
    <bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="task_di" bpmnElement="task"${
				taskExpanded === undefined ? "" : ` isExpanded="${taskExpanded}"`
			}>
        <dc:Bounds x="${taskX}" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      ${
				extraTask
					? `<bpmndi:BPMNShape id="extra_di" bpmnElement="extra">
        <dc:Bounds x="400" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>`
					: ""
			}
      <bpmndi:BPMNEdge id="flow1_di" bpmnElement="flow1">
        <di:waypoint x="136" y="118"/>
        <di:waypoint x="${taskX}" y="${endWaypointY}"/>
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

function diff(beforeXml: string, afterXml: string) {
	return diffDiagram(Bpmn.parse(beforeXml), Bpmn.parse(afterXml))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("diffDiagram", () => {
	it("reports nothing for two identical models", () => {
		const result = diff(makeXml(), makeXml())
		expect(result).toMatchObject({ added: [], removed: [], changed: [], moved: [], total: 0 })
		expect(result.planes).toEqual([])
	})

	it("reports an element present only in the later model as added", () => {
		const result = diff(makeXml(), makeXml({ extraTask: true }))
		expect(result.added).toEqual(["extra"])
		expect(result.removed).toEqual([])
		expect(result.total).toBe(1)
	})

	it("reports an element present only in the earlier model as removed", () => {
		const result = diff(makeXml({ extraTask: true }), makeXml())
		expect(result.removed).toEqual(["extra"])
		expect(result.added).toEqual([])
	})

	it("reports a renamed element as changed", () => {
		const result = diff(makeXml(), makeXml({ taskName: "Do other work" }))
		expect(result.changed).toEqual(["task"])
		expect(result.moved).toEqual([])
	})

	it("reports a changed Zeebe extension as changed", () => {
		const result = diff(makeXml(), makeXml({ taskType: "other-worker" }))
		expect(result.changed).toEqual(["task"])
	})

	it("reports a shape that only moved as moved, not changed", () => {
		const result = diff(makeXml(), makeXml({ taskX: 260 }))
		expect(result.changed).toEqual([])
		// The flow's own second waypoint tracks the task, so both moved.
		expect(result.moved).toEqual(["flow1", "task"])
	})

	it("reports an edge whose waypoints moved as moved", () => {
		const result = diff(makeXml(), makeXml({ endWaypointY: 140 }))
		expect(result.moved).toEqual(["flow1"])
		expect(result.changed).toEqual([])
	})

	it("treats a diagram-only flag change as moved", () => {
		const result = diff(makeXml({ taskExpanded: true }), makeXml({ taskExpanded: false }))
		expect(result.moved).toEqual(["task"])
		expect(result.changed).toEqual([])
	})

	it("prefers changed over moved when an element did both", () => {
		const result = diff(makeXml(), makeXml({ taskX: 260, taskName: "Renamed" }))
		expect(result.changed).toEqual(["task"])
		expect(result.moved).toEqual(["flow1"])
	})

	it("ignores a change with nothing on the canvas to show it", () => {
		const withOtherNamespace = makeXml().replace(
			'targetNamespace="http://bpmn.io/schema/bpmn"',
			'targetNamespace="http://example.com/other"',
		)
		expect(diff(makeXml(), withOtherNamespace).total).toBe(0)
	})

	it("is not fooled by element order or formatting", () => {
		const reordered = makeXml().replace(
			'<bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task" />',
			"",
		)
		const withFlowFirst = reordered.replace(
			'<bpmn:startEvent id="start" name="Start">',
			'<bpmn:sequenceFlow id="flow1" sourceRef="start" targetRef="task" />\n    <bpmn:startEvent id="start" name="Start">',
		)
		expect(diff(makeXml(), withFlowFirst).total).toBe(0)
	})

	it("does not report a move for sub-pixel coordinate noise", () => {
		const noisy = makeXml().replace('x="200" y="80"', 'x="200.000000001" y="80"')
		expect(diff(makeXml(), noisy).moved).toEqual([])
	})

	it("totals every category", () => {
		const result = diff(makeXml({ extraTask: true }), makeXml({ taskX: 260, taskName: "New" }))
		expect(result.total).toBe(
			result.added.length + result.removed.length + result.changed.length + result.moved.length,
		)
		expect(result.removed).toEqual(["extra"])
		expect(result.changed).toEqual(["task"])
	})
})

// ── Planes ────────────────────────────────────────────────────────────────────

/**
 * A model whose collapsed sub-process gets a plane of its own — the shape a
 * viewer shows one at a time, so a change inside it is invisible until the
 * reader drills in.
 */
function makeSubProcessXml(options: { innerName?: string; extraInner?: boolean } = {}): string {
	const { innerName = "Inner", extraInner = false } = options
	return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="proc" isExecutable="true">
    <bpmn:startEvent id="start" name="Start"/>
    <bpmn:subProcess id="sub" name="Sub">
      <bpmn:task id="inner" name="${innerName}"/>
      ${extraInner ? '<bpmn:task id="inner2" name="Inner 2"/>' : ""}
    </bpmn:subProcess>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram1">
    <bpmndi:BPMNPlane id="plane1" bpmnElement="proc">
      <bpmndi:BPMNShape id="start_di" bpmnElement="start">
        <dc:Bounds x="100" y="100" width="36" height="36"/>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="sub_di" bpmnElement="sub" isExpanded="false">
        <dc:Bounds x="200" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
  <bpmndi:BPMNDiagram id="diagram2">
    <bpmndi:BPMNPlane id="plane2" bpmnElement="sub">
      <bpmndi:BPMNShape id="inner_di" bpmnElement="inner">
        <dc:Bounds x="160" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>
      ${
				extraInner
					? `<bpmndi:BPMNShape id="inner2_di" bpmnElement="inner2">
        <dc:Bounds x="320" y="80" width="100" height="80"/>
      </bpmndi:BPMNShape>`
					: ""
			}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`
}

describe("diffDiagram — planes", () => {
	it("attributes a change to the plane that draws it", () => {
		const result = diff(makeSubProcessXml(), makeSubProcessXml({ innerName: "Renamed" }))
		expect(result.changed).toEqual(["inner"])
		expect(result.planes).toEqual([
			{ id: "sub", added: 0, removed: 0, changed: 1, moved: 0, total: 1 },
		])
	})

	it("reports the sub-process plane separately from the root", () => {
		const result = diff(
			makeSubProcessXml(),
			makeSubProcessXml({ innerName: "Renamed", extraInner: true }),
		)
		expect(result.total).toBe(3)
		// `sub` itself changed — it gained a child — and is drawn on the root plane;
		// the rename and the new task land on the plane `sub` opens.
		expect(result.planes).toEqual([
			{ id: "proc", added: 0, removed: 0, changed: 1, moved: 0, total: 1 },
			{ id: "sub", added: 1, removed: 0, changed: 1, moved: 0, total: 2 },
		])
	})

	it("attributes a removal to the plane that used to draw it", () => {
		const result = diff(makeSubProcessXml({ extraInner: true }), makeSubProcessXml())
		expect(result.removed).toEqual(["inner2"])
		expect(result.planes.find((p) => p.id === "sub")?.removed).toBe(1)
	})

	it("omits planes with no differences", () => {
		const result = diff(makeSubProcessXml(), makeSubProcessXml({ innerName: "Renamed" }))
		expect(result.planes.map((p) => p.id)).not.toContain("proc")
	})
})
