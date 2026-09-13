import { describe, expect, it } from "vitest"
import { compactify, expand } from "../src/bpmn/compact.js"
import { applyBpmnOperations } from "../src/bpmn/full-operations.js"
import { Bpmn } from "../src/bpmn/index.js"
import { applyOperations } from "../src/bpmn/operations.js"

/**
 * `compactify()` used to drop `<bpmn:documentation>` on the way into the compact
 * model, so `expand()` could not put it back: a single `rename` op cost the file
 * the documentation of every element in it, silently. That text is not
 * decoration in Camunda 8 — on an ad-hoc sub-process child it is the tool
 * description handed to the LLM, and on a start event it is the process input
 * contract.
 */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="d" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="P" name="Proc">
    <bpmn:documentation>Handles one support request.</bpmn:documentation>
    <bpmn:startEvent id="S">
      <bpmn:documentation>Expects: userId, amount.</bpmn:documentation>
      <bpmn:outgoing>F1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Task_X" name="X">
      <bpmn:documentation>Call this to look up a user by ID.</bpmn:documentation>
      <bpmn:incoming>F1</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:exclusiveGateway id="G">
      <bpmn:documentation>Branches on the amount.</bpmn:documentation>
      <bpmn:incoming>F2</bpmn:incoming>
    </bpmn:exclusiveGateway>
    <bpmn:adHocSubProcess id="Agent">
      <bpmn:documentation>Resolves the request autonomously.</bpmn:documentation>
      <bpmn:serviceTask id="Tool_ListUsers" name="List users">
        <bpmn:documentation>Call this to retrieve all users.</bpmn:documentation>
      </bpmn:serviceTask>
    </bpmn:adHocSubProcess>
    <bpmn:sequenceFlow id="F1" sourceRef="S" targetRef="Task_X"/>
    <bpmn:sequenceFlow id="F2" sourceRef="Task_X" targetRef="G"/>
  </bpmn:process>
</bpmn:definitions>`

const DOCS = [
	"Handles one support request.",
	"Expects: userId, amount.",
	"Call this to look up a user by ID.",
	"Branches on the amount.",
	"Resolves the request autonomously.",
	"Call this to retrieve all users.",
]

describe("compactify/expand documentation round-trip", () => {
	it("preserves documentation on every element type, nested ones included", () => {
		const out = Bpmn.export(expand(compactify(Bpmn.parse(XML))))
		for (const doc of DOCS) expect(out).toContain(`<bpmn:documentation>${doc}</bpmn:documentation>`)
	})

	it("keeps documentation through an empty operation list", () => {
		const out = Bpmn.export(expand(applyOperations(compactify(Bpmn.parse(XML)), [])))
		for (const doc of DOCS) expect(out).toContain(doc)
	})

	it("keeps documentation on an element a rename and a redirect_flow target", () => {
		const compact = applyOperations(compactify(Bpmn.parse(XML)), [
			{ op: "rename", id: "Task_X", name: "Renamed" },
			{ op: "redirect_flow", id: "F2", to: "Agent" },
		])
		const restored = expand(compact).processes[0]
		const task = restored?.flowElements.find((el) => el.id === "Task_X")

		expect(task?.name).toBe("Renamed")
		expect(task?.documentation).toBe("Call this to look up a user by ID.")
		for (const doc of DOCS) expect(Bpmn.export(expand(compact))).toContain(doc)
	})

	it("sets documentation through an update patch", () => {
		const compact = applyOperations(compactify(Bpmn.parse(XML)), [
			{ op: "update", id: "Tool_ListUsers", patch: { documentation: "Returns id, name, email." } },
		])
		const agent = expand(compact).processes[0]?.flowElements.find((el) => el.id === "Agent")
		if (agent?.type !== "adHocSubProcess") throw new Error("expected adHocSubProcess")

		expect(agent.flowElements.find((el) => el.id === "Tool_ListUsers")?.documentation).toBe(
			"Returns id, name, email.",
		)
	})

	it("sets documentation through an update patch on the full model too", () => {
		const { definitions } = applyBpmnOperations(Bpmn.parse(XML), [
			{ op: "update", id: "Task_X", patch: { documentation: "Replaced." } },
		])
		const task = definitions.processes[0]?.flowElements.find((el) => el.id === "Task_X")

		expect(task?.documentation).toBe("Replaced.")
	})

	it("carries builder-set documentation through the operations API", () => {
		const defs = Bpmn.createProcess("P")
			.startEvent("S")
			.userTask("Task_Y", { name: "Y", documentation: "Approve if the amount exceeds 500." })
			.endEvent("E")
			.build()

		const out = Bpmn.export(expand(applyOperations(compactify(defs), [])))
		expect(out).toContain(
			"<bpmn:documentation>Approve if the amount exceeds 500.</bpmn:documentation>",
		)
	})
})
