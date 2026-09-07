import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { ProcessBuilder } from "../src/bpmn/bpmn-builder.js"
import type { BpmnDefinitions } from "../src/bpmn/bpmn-model.js"
import { Bpmn, diffSemantics, semanticHash } from "../src/index.js"

/**
 * Extending an existing file used to mean regenerating it, which meant losing
 * everything the builder has no opinion about — the collaboration, lanes,
 * diagram interchange, other processes, unmodelled content. These tests are
 * mostly about what does *not* change.
 */

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "roundtrip")

function fixture(name: string): BpmnDefinitions {
	return Bpmn.parse(readFileSync(join(CORPUS, name), "utf-8"))
}

describe("continueProcess — the untouched remainder", () => {
	/**
	 * The sharpest assertion here: continuing a process and building it without
	 * adding anything must give back the same document. Anything the round trip
	 * through the builder quietly normalises shows up as a changed hash.
	 */
	for (const file of readdirSync(CORPUS).filter((name) => name.endsWith(".bpmn"))) {
		it(`changes nothing when nothing is built — ${file}`, () => {
			const before = fixture(file)
			for (const process of before.processes) {
				const after = Bpmn.continueProcess(before, process.id).build()
				expect(diffSemantics(before, after), `${file} / ${process.id}`).toEqual({
					added: [],
					removed: [],
					changed: [],
				})
			}
		})
	}

	it("keeps the collaboration, the other process and the lanes", () => {
		const before = fixture("02-collaboration.bpmn")
		const after = Bpmn.continueProcess(before, "Process_buyer")
			.insertAfter("Task_place_order")
			.serviceTask("Task_notify", { name: "Notify", taskType: "notify" })
			.build()

		expect(after.collaborations).toEqual(before.collaborations)
		expect(after.processes.find((p) => p.id === "Process_seller")).toEqual(
			before.processes.find((p) => p.id === "Process_seller"),
		)
		expect(after.processes.find((p) => p.id === "Process_buyer")?.laneSet).toEqual(
			before.processes.find((p) => p.id === "Process_buyer")?.laneSet,
		)
	})

	it("keeps diagram interchange and unmodelled content", () => {
		const withDi = fixture("06-events-and-containers.bpmn")
		expect(Bpmn.continueProcess(withDi, "Process_events").build().diagrams).toEqual(withDi.diagrams)

		const withUnknown = fixture("07-unmodelled-content.bpmn")
		expect(Bpmn.continueProcess(withUnknown, "Process_unmodelled").build().unknownChildren).toEqual(
			withUnknown.unknownChildren,
		)
	})

	it("does not mutate the model it was given", () => {
		const before = fixture("02-collaboration.bpmn")
		const snapshot = semanticHash(before)
		Bpmn.continueProcess(before, "Process_buyer")
			.insertAfter("Task_place_order")
			.serviceTask("Task_notify", { taskType: "notify" })
			.build()
		expect(semanticHash(before)).toBe(snapshot)
	})

	it("adds only what was asked for", () => {
		const before = fixture("02-collaboration.bpmn")
		const after = Bpmn.continueProcess(before, "Process_buyer")
			.insertAfter("Task_place_order")
			.serviceTask("Task_notify", { taskType: "notify" })
			.build()

		const { added, removed, changed } = diffSemantics(before, after)
		expect(removed).toEqual([])
		expect(added).toContain("Task_notify")
		// The spliced flow, the node it now leaves, and the process that gained a
		// child. Nothing else may move.
		expect(changed.map((entry) => entry.id).sort()).toEqual([
			"Flow_b2",
			"Process_buyer",
			"Task_place_order",
		])
	})
})

describe("continueProcess — insertAfter", () => {
	function buyer(): BpmnDefinitions {
		return fixture("02-collaboration.bpmn")
	}

	/**
	 * The existing edge keeps its id and its target and only changes where it
	 * starts, so an edge nobody asked to move keeps its identity in the diagram
	 * and in a diff.
	 */
	it("splices into the path, keeping the existing flow's id and target", () => {
		const after = Bpmn.continueProcess(buyer(), "Process_buyer")
			.insertAfter("Task_place_order")
			.serviceTask("Task_notify", { taskType: "notify" })
			.build()
		const flows = after.processes.find((p) => p.id === "Process_buyer")?.sequenceFlows ?? []
		expect(flows.find((f) => f.id === "Flow_b2")).toMatchObject({
			sourceRef: "Task_notify",
			targetRef: "End_buyer",
		})
		expect(flows.filter((f) => f.targetRef === "Task_notify")).toHaveLength(1)
	})

	it("splices a whole chain, not just one element", () => {
		const after = Bpmn.continueProcess(buyer(), "Process_buyer")
			.insertAfter("Task_place_order")
			.serviceTask("a", { taskType: "a" })
			.serviceTask("b", { taskType: "b" })
			.build()
		const flows = after.processes.find((p) => p.id === "Process_buyer")?.sequenceFlows ?? []
		expect(flows.find((f) => f.id === "Flow_b2")?.sourceRef).toBe("b")
	})

	it("is a no-op when nothing is built after it", () => {
		const before = buyer()
		const after = Bpmn.continueProcess(before, "Process_buyer")
			.insertAfter("Task_place_order")
			.build()
		expect(diffSemantics(before, after)).toEqual({ added: [], removed: [], changed: [] })
	})

	it("refuses a node with nothing to insert into", () => {
		expect(() => Bpmn.continueProcess(buyer(), "Process_buyer").insertAfter("End_buyer")).toThrow(
			/no outgoing sequence flow/,
		)
	})

	it("refuses when 'after' is ambiguous", () => {
		const forked = Bpmn.createProcess("p")
			.startEvent("s")
			.exclusiveGateway("g")
			.branch("left", (b) => b.serviceTask("l", { taskType: "l" }))
			.branch("right", (b) => b.serviceTask("r", { taskType: "r" }))
			.build()
		expect(() => Bpmn.continueProcess(forked, "p").insertAfter("g")).toThrow(
			/outgoing sequence flows, so "after" is ambiguous/,
		)
	})
})

describe("continueProcess — at", () => {
	function open(): BpmnDefinitions {
		// A task with no outgoing flow: an unfinished path, which is what `at` is for.
		return Bpmn.parse(
			Bpmn.export(
				Bpmn.createProcess("p").startEvent("s").serviceTask("t", { taskType: "t" }).build(),
			),
		)
	}

	it("continues from a node whose path is open", () => {
		const after = Bpmn.continueProcess(open(), "p").at("t").endEvent("e").build()
		const process = after.processes[0]
		expect(process?.flowElements.map((element) => element.id)).toContain("e")
		expect(process?.sequenceFlows.some((f) => f.sourceRef === "t" && f.targetRef === "e")).toBe(
			true,
		)
	})

	it("refuses a node that is not in this process", () => {
		expect(() => Bpmn.continueProcess(open(), "p").at("ghost")).toThrow(/is not a flow node/)
	})

	it("refuses a node nested in a sub-process", () => {
		const nested = Bpmn.createProcess("p")
			.startEvent("s")
			.subProcess("sub", (inner) => {
				inner.startEvent("in_s").serviceTask("in_t", { taskType: "t" })
			})
			.build()
		expect(() => Bpmn.continueProcess(nested, "p").at("in_t")).toThrow(/is not a flow node/)
	})

	it("refuses to continue from an end event", () => {
		const before = fixture("02-collaboration.bpmn")
		expect(() => Bpmn.continueProcess(before, "Process_buyer").at("End_buyer")).toThrow(
			/end event has no outgoing sequence flow/,
		)
	})

	it("refuses a node that would gain a second outgoing flow, and says what to use", () => {
		const before = fixture("02-collaboration.bpmn")
		expect(() => Bpmn.continueProcess(before, "Process_buyer").at("Task_place_order")).toThrow(
			/uncontrolled split. Use insertAfter\("Task_place_order"\)/,
		)
	})

	it("allows a gateway, where several outgoing flows are the point", () => {
		const forked = Bpmn.createProcess("p")
			.startEvent("s")
			.exclusiveGateway("g")
			.branch("left", (b) => b.serviceTask("l", { taskType: "l" }))
			.build()
		expect(() => Bpmn.continueProcess(forked, "p").at("g")).not.toThrow()
	})
})

describe("continueProcess — refusals and reuse", () => {
	it("names the processes it does have", () => {
		expect(() => Bpmn.continueProcess(fixture("02-collaboration.bpmn"), "nope")).toThrow(
			/"Process_buyer", "Process_seller"/,
		)
	})

	it("is reachable as a static on ProcessBuilder", () => {
		expect(ProcessBuilder.from(fixture("01-root-elements.bpmn"), "Process_roots")).toBeInstanceOf(
			ProcessBuilder,
		)
	})

	it("reuses an existing root message rather than declaring a second", () => {
		const before = fixture("01-root-elements.bpmn")
		const existing = before.messages[0]
		expect(existing).toBeDefined()
		const after = Bpmn.continueProcess(before, "Process_roots")
			.insertAfter("Start_order")
			.intermediateCatchEvent("catch", {
				messageName: existing?.name as string,
				correlationKey: "= id",
			})
			.build()
		expect(after.messages.filter((m) => m.name === existing?.name)).toHaveLength(1)
	})

	/**
	 * `insertJoinGateways` reads the whole topology, so on a parsed model it
	 * retargets edges the caller never touched. Continue mode does not run it, and
	 * this guard is the backstop if anything else tries.
	 */
	it("refuses to rewire a flow the document already had", () => {
		const before = fixture("06-events-and-containers.bpmn")
		const builder = Bpmn.continueProcess(before, "Process_events")
		const flows = (
			builder as unknown as { sequenceFlows: Array<{ id: string; targetRef: string }> }
		).sequenceFlows
		const victim = flows[0]
		expect(victim).toBeDefined()
		if (victim !== undefined) victim.targetRef = "End_ok"
		expect(() => builder.build()).toThrow(/would rewire sequence flows this document already had/)
	})

	it("adds a version tag without dropping the process's other extensions", () => {
		const before = fixture("05-zeebe-extensions.bpmn")
		const process = before.processes[0]
		expect(process).toBeDefined()
		const existing = (process?.extensionElements ?? []).map((element) => element.name)
		const after = Bpmn.continueProcess(before, process?.id as string)
			.versionTag("v2")
			.build()
		const names = (after.processes[0]?.extensionElements ?? []).map((element) => element.name)
		expect(names).toEqual(expect.arrayContaining(existing))
		expect(names).toContain("zeebe:versionTag")
	})

	it("leaves isExecutable alone unless asked", () => {
		const before = fixture("02-collaboration.bpmn")
		const seller = before.processes.find((p) => p.id === "Process_seller")
		const after = Bpmn.continueProcess(before, "Process_seller").build()
		expect(after.processes.find((p) => p.id === "Process_seller")?.isExecutable).toBe(
			seller?.isExecutable,
		)

		const changed = Bpmn.continueProcess(before, "Process_seller").executable(true).build()
		expect(changed.processes.find((p) => p.id === "Process_seller")?.isExecutable).toBe(true)
	})
})
