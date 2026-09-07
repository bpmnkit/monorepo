import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { compactify, expand } from "../src/bpmn/compact.js"
import {
	OperationError,
	applyBpmnOperations,
	reconcileCompact,
} from "../src/bpmn/full-operations.js"
import { Bpmn } from "../src/bpmn/index.js"
import { applyOperations } from "../src/bpmn/operations.js"
import { semanticHash } from "../src/bpmn/semantic-hash.js"

const fixture = (name: string) =>
	readFileSync(join(import.meta.dirname, "fixtures", "roundtrip", name), "utf-8")

const MINIMAL = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:zeebe="http://camunda.org/schema/zeebe/1.0" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S"><bpmn:outgoing>F</bpmn:outgoing></bpmn:startEvent>
    <bpmn:serviceTask id="T" name="Work">
      <bpmn:extensionElements>
        <zeebe:taskDefinition type="do-work" retries="5" />
        <zeebe:ioMapping>
          <zeebe:input source="=customer.id" target="customerId" />
        </zeebe:ioMapping>
        <zeebe:taskHeaders><zeebe:header key="team" value="ops" /></zeebe:taskHeaders>
      </bpmn:extensionElements>
      <bpmn:incoming>F</bpmn:incoming>
      <bpmn:outgoing>F2</bpmn:outgoing>
    </bpmn:serviceTask>
    <bpmn:endEvent id="E"><bpmn:incoming>F2</bpmn:incoming></bpmn:endEvent>
    <bpmn:sequenceFlow id="F" sourceRef="S" targetRef="T" />
    <bpmn:sequenceFlow id="F2" sourceRef="T" targetRef="E" />
  </bpmn:process>
</bpmn:definitions>`

describe("applyBpmnOperations", () => {
	it("does not mutate the model it was given", () => {
		const definitions = Bpmn.parse(MINIMAL)
		const before = semanticHash(definitions)
		applyBpmnOperations(definitions, [{ op: "rename", id: "T", name: "Renamed" }])
		expect(semanticHash(definitions)).toBe(before)
	})

	it("renames an element", () => {
		const { definitions, applied } = applyBpmnOperations(Bpmn.parse(MINIMAL), [
			{ op: "rename", id: "T", name: "Approve invoice" },
		])
		expect(applied).toBe(1)
		expect(definitions.processes[0]?.flowElements.find((e) => e.id === "T")?.name).toBe(
			"Approve invoice",
		)
	})

	/**
	 * The reason this module exists. The same edit through the compact form
	 * rebuilds the element from fifteen modelled properties and drops the rest.
	 */
	it("keeps extensions the compact form cannot carry", () => {
		const { definitions } = applyBpmnOperations(Bpmn.parse(MINIMAL), [
			{ op: "rename", id: "T", name: "Renamed" },
		])
		const extensions = definitions.processes[0]?.flowElements.find(
			(e) => e.id === "T",
		)?.extensionElements

		expect(extensions?.map((e) => e.name).sort()).toEqual([
			"zeebe:ioMapping",
			"zeebe:taskDefinition",
			"zeebe:taskHeaders",
		])
		// retries and the input mapping are both outside the compact projection
		expect(extensions?.find((e) => e.name === "zeebe:taskDefinition")?.attributes.retries).toBe("5")
		expect(
			extensions?.find((e) => e.name === "zeebe:ioMapping")?.children[0]?.attributes.source,
		).toBe("=customer.id")
	})

	it("loses that detail through the compact path, which is the contrast", () => {
		const viaCompact = expand(
			applyOperations(compactify(Bpmn.parse(MINIMAL)), [
				{ op: "rename", id: "T", name: "Renamed" },
			]),
		)
		const extensions = viaCompact.processes[0]?.flowElements.find(
			(e) => e.id === "T",
		)?.extensionElements

		expect(
			extensions?.find((e) => e.name === "zeebe:taskDefinition")?.attributes.retries,
		).toBeUndefined()
		expect(extensions?.find((e) => e.name === "zeebe:ioMapping")).toBeUndefined()
	})

	it("patches one extension without disturbing the others", () => {
		const { definitions } = applyBpmnOperations(Bpmn.parse(MINIMAL), [
			{ op: "update", id: "T", patch: { jobType: "do-other-work" } },
		])
		const extensions = definitions.processes[0]?.flowElements.find(
			(e) => e.id === "T",
		)?.extensionElements

		expect(extensions?.find((e) => e.name === "zeebe:taskDefinition")?.attributes.type).toBe(
			"do-other-work",
		)
		expect(extensions?.find((e) => e.name === "zeebe:ioMapping")).toBeDefined()
		expect(extensions?.find((e) => e.name === "zeebe:taskHeaders")).toBeDefined()
	})

	it("preserves a whole document's pools, lanes and data wiring across an edit", () => {
		const source = Bpmn.parse(fixture("02-collaboration.bpmn"))
		const { definitions } = applyBpmnOperations(source, [
			{ op: "rename", id: "Task_place_order", name: "Submit the order" },
		])

		expect(definitions.collaborations[0]?.participants).toHaveLength(3)
		expect(definitions.collaborations[0]?.messageFlows).toHaveLength(2)
		expect(
			definitions.processes.find((p) => p.id === "Process_buyer")?.laneSet?.lanes,
		).toHaveLength(2)
		expect(definitions.messages).toHaveLength(1)
	})

	it("inserts, connects and removes", () => {
		const { definitions, applied } = applyBpmnOperations(Bpmn.parse(MINIMAL), [
			{ op: "insert", element: { id: "N", type: "userTask", name: "Notify" }, after: "T" },
			{ op: "delete_flow", id: "F2" },
			{ op: "add_flow", id: "F3", from: "T", to: "N" },
			{ op: "add_flow", id: "F4", from: "N", to: "E" },
		])

		expect(applied).toBe(4)
		const process = definitions.processes[0]
		expect(process?.flowElements.map((e) => e.id)).toEqual(["S", "T", "N", "E"])
		expect(process?.flowElements.find((e) => e.id === "N")?.incoming).toEqual(["F3"])
		expect(process?.flowElements.find((e) => e.id === "E")?.incoming).toEqual(["F4"])
	})

	it("removes the flows attached to a deleted element", () => {
		const { definitions } = applyBpmnOperations(Bpmn.parse(MINIMAL), [{ op: "delete", id: "T" }])
		const process = definitions.processes[0]
		expect(process?.sequenceFlows).toHaveLength(0)
		expect(process?.flowElements.find((e) => e.id === "S")?.outgoing).toEqual([])
	})

	it("redirects a flow and refreshes both endpoints", () => {
		const { definitions } = applyBpmnOperations(Bpmn.parse(MINIMAL), [
			{ op: "redirect_flow", id: "F", to: "E" },
		])
		const process = definitions.processes[0]
		expect(process?.flowElements.find((e) => e.id === "E")?.incoming.sort()).toEqual(["F", "F2"])
		expect(process?.flowElements.find((e) => e.id === "T")?.incoming).toEqual([])
	})
})

/**
 * Silence was the defect: every operation whose target did not exist used to be
 * skipped, so a patch with a misspelled id reported success and changed nothing.
 */
describe("applyBpmnOperations strictness", () => {
	const unresolved: Array<[string, Parameters<typeof applyBpmnOperations>[1][number]]> = [
		["rename", { op: "rename", id: "nope", name: "x" }],
		["update", { op: "update", id: "nope", patch: { name: "x" } }],
		["delete", { op: "delete", id: "nope" }],
		["delete_flow", { op: "delete_flow", id: "nope" }],
		["redirect_flow", { op: "redirect_flow", id: "nope", to: "E" }],
		["add_flow source", { op: "add_flow", from: "nope", to: "E" }],
		["add_flow target", { op: "add_flow", from: "S", to: "nope" }],
		["insert parent", { op: "insert", element: { id: "N", type: "task" }, parent: "nope" }],
		["insert anchor", { op: "insert", element: { id: "N", type: "task" }, after: "nope" }],
	]

	for (const [label, operation] of unresolved) {
		it(`throws on an unresolved id in ${label}`, () => {
			expect(() => applyBpmnOperations(Bpmn.parse(MINIMAL), [operation])).toThrow(OperationError)
		})
	}

	it("names the operation and the reason", () => {
		expect(() =>
			applyBpmnOperations(Bpmn.parse(MINIMAL), [{ op: "rename", id: "Taks_1", name: "x" }]),
		).toThrow(/\[0\] no element with id "Taks_1"/)
	})

	it("reports problems instead of throwing when asked", () => {
		const result = applyBpmnOperations(
			Bpmn.parse(MINIMAL),
			[
				{ op: "rename", id: "T", name: "Renamed" },
				{ op: "rename", id: "nope", name: "x" },
			],
			{ strict: false },
		)

		expect(result.applied).toBe(1)
		expect(result.problems).toHaveLength(1)
		expect(result.problems[0]?.index).toBe(1)
		expect(result.definitions.processes[0]?.flowElements.find((e) => e.id === "T")?.name).toBe(
			"Renamed",
		)
	})

	it("refuses a duplicate id rather than shadowing an element", () => {
		expect(() =>
			applyBpmnOperations(Bpmn.parse(MINIMAL), [
				{ op: "insert", element: { id: "T", type: "userTask" } },
			]),
		).toThrow(/already taken/)
	})

	it("refuses a type change, which would need a fresh element", () => {
		expect(() =>
			applyBpmnOperations(Bpmn.parse(MINIMAL), [
				{ op: "update", id: "T", patch: { type: "userTask" } },
			]),
		).toThrow(/delete and an insert/)
	})

	it("applies nothing at all when one operation in the list fails", () => {
		const definitions = Bpmn.parse(MINIMAL)
		expect(() =>
			applyBpmnOperations(definitions, [
				{ op: "rename", id: "T", name: "Renamed" },
				{ op: "rename", id: "nope", name: "x" },
			]),
		).toThrow(OperationError)
		expect(definitions.processes[0]?.flowElements.find((e) => e.id === "T")?.name).toBe("Work")
	})
})

/**
 * `replace_diagram` used to expand a compact diagram over the whole model,
 * which destroyed everything the compact form does not carry. Reconciling
 * applies the same input as changes instead.
 */
describe("reconcileCompact", () => {
	it("keeps extensions the compact input never described", () => {
		const source = Bpmn.parse(MINIMAL)
		const compact = compactify(source)
		const task = compact.processes[0]?.elements.find((e) => e.id === "T")
		if (task) task.name = "Renamed by an agent"

		const { definitions } = reconcileCompact(source, compact)
		const extensions = definitions.processes[0]?.flowElements.find(
			(e) => e.id === "T",
		)?.extensionElements

		expect(definitions.processes[0]?.flowElements.find((e) => e.id === "T")?.name).toBe(
			"Renamed by an agent",
		)
		expect(extensions?.find((e) => e.name === "zeebe:taskDefinition")?.attributes.retries).toBe("5")
		expect(extensions?.find((e) => e.name === "zeebe:ioMapping")).toBeDefined()
	})

	it("keeps pools, lanes and message flows the compact input cannot express", () => {
		const source = Bpmn.parse(fixture("02-collaboration.bpmn"))
		const { definitions } = reconcileCompact(source, compactify(source))

		expect(definitions.collaborations[0]?.participants).toHaveLength(3)
		expect(definitions.collaborations[0]?.messageFlows).toHaveLength(2)
		expect(
			definitions.processes.find((p) => p.id === "Process_buyer")?.laneSet?.lanes,
		).toHaveLength(2)
	})

	/**
	 * The sharpest property available: feeding a model its own compact view back
	 * must change nothing. Any asymmetry between what `compactify` reads and what
	 * the patch writes shows up here as drift, on every construct in the corpus.
	 */
	it("is a no-op when nothing in the compact view changed, across the corpus", () => {
		for (const name of readdirSync(join(import.meta.dirname, "fixtures", "roundtrip")).filter(
			(entry) => entry.endsWith(".bpmn"),
		)) {
			const source = Bpmn.parse(fixture(name))
			const { definitions } = reconcileCompact(source, compactify(source))
			expect(semanticHash(definitions), name).toBe(semanticHash(source))
		}
	})

	it("does not grow the model when applied repeatedly", () => {
		const source = Bpmn.parse(fixture("05-zeebe-extensions.bpmn"))
		const once = reconcileCompact(source, compactify(source)).definitions
		const twice = reconcileCompact(once, compactify(once)).definitions
		expect(semanticHash(twice)).toBe(semanticHash(source))
	})

	it("adds, removes and reconnects", () => {
		const source = Bpmn.parse(MINIMAL)
		const compact = compactify(source)
		const process = compact.processes[0]
		if (process) {
			process.elements = process.elements.filter((e) => e.id !== "T")
			process.elements.push({ id: "U", type: "userTask", name: "Review" })
			process.flows = [
				{ id: "F", from: "S", to: "U" },
				{ id: "F2", from: "U", to: "E" },
			]
		}

		const { definitions } = reconcileCompact(source, compact)
		const result = definitions.processes[0]
		expect(result?.flowElements.map((e) => e.id).sort()).toEqual(["E", "S", "U"])
		expect(result?.flowElements.find((e) => e.id === "U")?.incoming).toEqual(["F"])
	})

	it("puts new elements in the process the input named, not the first one", () => {
		const source = Bpmn.parse(fixture("02-collaboration.bpmn"))
		const compact = compactify(source)
		const seller = compact.processes.find((p) => p.id === "Process_seller")
		expect(seller).toBeDefined()
		seller?.elements.push({ id: "Task_seller_new", type: "serviceTask", name: "Pack" })

		const { definitions } = reconcileCompact(source, compact)
		expect(
			definitions.processes
				.find((p) => p.id === "Process_seller")
				?.flowElements.some((e) => e.id === "Task_seller_new"),
		).toBe(true)
		expect(
			definitions.processes
				.find((p) => p.id === "Process_buyer")
				?.flowElements.some((e) => e.id === "Task_seller_new"),
		).toBe(false)
	})

	it("does not remove a process the input did not mention", () => {
		const source = Bpmn.parse(fixture("02-collaboration.bpmn"))
		const compact = compactify(source)
		compact.processes = compact.processes.filter((p) => p.id === "Process_buyer")

		const { definitions } = reconcileCompact(source, compact)
		expect(definitions.processes.map((p) => p.id).sort()).toEqual([
			"Process_buyer",
			"Process_seller",
		])
	})

	it("creates a process the model does not have yet", () => {
		const source = Bpmn.parse(MINIMAL)
		const compact = compactify(source)
		compact.processes.push({
			id: "Process_new",
			elements: [{ id: "S2", type: "startEvent" }],
			flows: [],
		})

		const { definitions } = reconcileCompact(source, compact)
		expect(
			definitions.processes.find((p) => p.id === "Process_new")?.flowElements.map((e) => e.id),
		).toEqual(["S2"])
	})
})
