import { Bpmn } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { computeBpmnDiff } from "../../src/diff/diff.js"

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
	return computeBpmnDiff(Bpmn.parse(beforeXml), Bpmn.parse(afterXml))
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("computeBpmnDiff", () => {
	it("reports nothing for two identical models", () => {
		const result = diff(makeXml(), makeXml())
		expect(result).toMatchObject({ added: [], removed: [], changed: [], moved: [], total: 0 })
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
