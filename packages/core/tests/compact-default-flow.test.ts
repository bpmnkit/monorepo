import { describe, expect, it } from "vitest"
import type { CompactDiagram } from "../src/bpmn/compact.js"
import { compactify, expand } from "../src/bpmn/compact.js"
import { reconcileCompact } from "../src/bpmn/full-operations.js"
import { Bpmn } from "../src/bpmn/index.js"

/**
 * `CompactFlow` carried a condition but had no way to say which branch was the
 * gateway's default, so a model returning a `CompactDiagram` — the format BPMN
 * Kit asks it for — could not produce one however well it had read the
 * documentation. An exclusive gateway whose conditions are all false and which
 * has no default deadlocks at runtime, and `compactify` dropped an existing
 * `bpmn:default` on the way out, so a round trip lost it too.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P" name="Proc" isExecutable="true">
    <bpmn:startEvent id="S">
      <bpmn:outgoing>F1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:exclusiveGateway id="G" name="Over 10,000?" default="F3">
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
      <bpmn:outgoing>F3</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:userTask id="Approve" name="Approve">
      <bpmn:incoming>F2</bpmn:incoming>
    </bpmn:userTask>
    <bpmn:endEvent id="E">
      <bpmn:incoming>F3</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="G" />
    <bpmn:sequenceFlow id="F2" sourceRef="G" targetRef="Approve">
      <bpmn:conditionExpression xsi:type="bpmn:tFormalExpression" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">= total &gt; 10000</bpmn:conditionExpression>
    </bpmn:sequenceFlow>
    <bpmn:sequenceFlow id="F3" sourceRef="G" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`

/** The shape a model returns: two branches, one of them marked. */
const COMPACT: CompactDiagram = {
	id: "d",
	processes: [
		{
			id: "P",
			elements: [
				{ id: "S", type: "startEvent" },
				{ id: "G", type: "exclusiveGateway", name: "Over 10,000?" },
				{ id: "Approve", type: "userTask", name: "Approve" },
				{ id: "E", type: "endEvent" },
			],
			flows: [
				{ id: "F1", from: "S", to: "G" },
				{ id: "F2", from: "G", to: "Approve", condition: "= total > 10000" },
				{ id: "F3", from: "G", to: "E", isDefault: true },
			],
		},
	],
}

function gateway(xml: string) {
	const element = Bpmn.parse(xml).processes[0]?.flowElements.find((el) => el.id === "G")
	if (element?.type !== "exclusiveGateway") throw new Error("G is not an exclusive gateway")
	return element
}

describe("compactify", () => {
	it("marks the flow the gateway points at", () => {
		const flows = compactify(Bpmn.parse(XML)).processes[0]?.flows ?? []
		expect(flows.find((flow) => flow.id === "F3")?.isDefault).toBe(true)
		expect(flows.find((flow) => flow.id === "F2")?.isDefault).toBeUndefined()
	})

	it("survives a round trip through expand", () => {
		const restored = expand(compactify(Bpmn.parse(XML)))
		expect(gateway(Bpmn.export(restored)).default).toBe("F3")
	})
})

describe("expand", () => {
	it("turns isDefault into the gateway's default attribute", () => {
		const xml = Bpmn.export(expand(COMPACT))
		expect(gateway(xml).default).toBe("F3")
		expect(xml).toContain('default="F3"')
	})

	it("leaves a gateway with no marked branch alone", () => {
		const none = structuredClone(COMPACT)
		// biome-ignore lint/performance/noDelete: the absence is the thing under test
		delete none.processes[0]?.flows[2]?.isDefault
		expect(gateway(Bpmn.export(expand(none))).default).toBeUndefined()
	})

	it("refuses two defaults on one gateway", () => {
		const two = structuredClone(COMPACT)
		const flow = two.processes[0]?.flows[1]
		if (flow) flow.isDefault = true
		expect(() => expand(two)).toThrow(/marks two flows as default, "F2" and "F3"/)
	})

	it("refuses a default on something that cannot carry one", () => {
		const wrong = structuredClone(COMPACT)
		const flow = wrong.processes[0]?.flows[0]
		if (flow) flow.isDefault = true
		expect(() => expand(wrong)).toThrow(/leaves a startEvent/)
	})

	it("works inside a sub-process", () => {
		const nested: CompactDiagram = {
			id: "d",
			processes: [
				{
					id: "P",
					elements: [
						{
							id: "Sub",
							type: "subProcess",
							children: {
								elements: [
									{ id: "SubG", type: "exclusiveGateway" },
									{ id: "A", type: "task" },
									{ id: "B", type: "task" },
								],
								flows: [
									{ id: "SF1", from: "SubG", to: "A", condition: "= ok" },
									{ id: "SF2", from: "SubG", to: "B", isDefault: true },
								],
							},
						},
					],
					flows: [],
				},
			],
		}
		expect(Bpmn.export(expand(nested))).toContain('default="SF2"')
	})
})

describe("reconcileCompact", () => {
	it("sets a default on a file it did not author", () => {
		const plain = XML.replace(' default="F3"', "")
		const { definitions } = reconcileCompact(Bpmn.parse(plain), COMPACT)
		expect(gateway(Bpmn.export(definitions)).default).toBe("F3")
	})

	it("clears one the compact input no longer marks", () => {
		const without = structuredClone(COMPACT)
		// biome-ignore lint/performance/noDelete: the absence is the thing under test
		delete without.processes[0]?.flows[2]?.isDefault
		const { definitions } = reconcileCompact(Bpmn.parse(XML), without)
		expect(gateway(Bpmn.export(definitions)).default).toBeUndefined()
	})
})
