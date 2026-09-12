import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/index.js"

/**
 * Ids the builder generates have to survive a rebuild, because generated BPMN
 * is regenerated constantly and reviewed as a diff. Nothing here calls
 * `resetIdCounter()`: the point is that stability does not depend on it.
 */

type Definitions = ReturnType<ReturnType<typeof Bpmn.createProcess>["build"]>

function firstProcess(defs: Definitions) {
	const process = defs.processes[0]
	expect(process).toBeDefined()
	return process as NonNullable<typeof process>
}

function defined<T>(value: T | undefined | null, msg?: string): T {
	expect(value, msg).toBeDefined()
	return value as T
}

function flowIds(defs: Definitions): string[] {
	return firstProcess(defs).sequenceFlows.map((flow) => flow.id)
}

/** XML NCName: what a BPMN id attribute is allowed to be. */
const NC_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/

describe("stable sequence flow ids", () => {
	it("names a flow after the elements it connects", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("validate", { taskType: "validate" })
			.endEvent("done")
			.build()

		expect(flowIds(defs)).toEqual(["Flow_start_validate", "Flow_validate_done"])
	})

	it("gives the same model the same ids on every build", () => {
		const build = () =>
			Bpmn.createProcess("p")
				.startEvent("start")
				.serviceTask("validate", { taskType: "validate" })
				.exclusiveGateway("gw")
				.branch("approved", (b) =>
					b.condition("= ok").serviceTask("ship", { taskType: "ship" }).connectTo("done"),
				)
				.branch("rejected", (b) => b.defaultFlow().connectTo("done"))
				.endEvent("done")
				.build()

		expect(flowIds(build())).toEqual(flowIds(build()))
	})

	it("leaves existing flow ids alone when an unrelated element is added", () => {
		const before = flowIds(
			Bpmn.createProcess("p")
				.startEvent("start")
				.serviceTask("validate", { taskType: "validate" })
				.endEvent("done")
				.build(),
		)

		const after = flowIds(
			Bpmn.createProcess("p")
				.startEvent("start")
				.serviceTask("validate", { taskType: "validate" })
				.serviceTask("audit", { taskType: "audit" })
				.endEvent("done")
				.build(),
		)

		expect(before).toContain("Flow_start_validate")
		expect(after).toContain("Flow_start_validate")
	})

	it("does not renumber flows when branches are reordered", () => {
		const build = (first: "approved" | "rejected") =>
			Bpmn.createProcess("p")
				.startEvent("start")
				.exclusiveGateway("gw")
				.branch(first, (b) => b.connectTo("done"))
				.branch(first === "approved" ? "rejected" : "approved", (b) => b.connectTo("done"))
				.endEvent("done")
				.build()

		expect(flowIds(build("approved")).sort()).toEqual(flowIds(build("rejected")).sort())
	})

	it("tells two flows between the same pair apart by branch name", () => {
		// Both branches converge on the join gateway the builder infers, so the
		// pair alone cannot name them.
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.exclusiveGateway("gw")
			.branch("approved", (b) => b.connectTo("done"))
			.branch("rejected", (b) => b.connectTo("done"))
			.endEvent("done")
			.build()

		expect(flowIds(defs)).toContain("Flow_gw_gw_join_approved")
		expect(flowIds(defs)).toContain("Flow_gw_gw_join_rejected")
	})

	it("falls back to the condition when two flows share a pair and have no name", () => {
		const conditions = ["= total > 100", "= total <= 100"] as const
		const build = ([first, second]: readonly [string, string]) =>
			Bpmn.createProcess("p")
				.startEvent("start")
				.exclusiveGateway("gw")
				.branch("", (b) => b.condition(first).connectTo("done"))
				.branch("", (b) => b.condition(second).connectTo("done"))
				.endEvent("done")
				.build()

		const ids = flowIds(build(conditions)).filter((id) => id.startsWith("Flow_gw_gw_join_"))
		expect(new Set(ids).size).toBe(2)
		// Derived from the conditions, so declaring the branches the other way
		// round hands each flow the same id it had before.
		expect(flowIds(build([conditions[1], conditions[0]])).sort()).toEqual(
			flowIds(build(conditions)).sort(),
		)
	})

	it("numbers genuinely identical edges rather than colliding", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.exclusiveGateway("gw")
			.endEvent("done")
			.element("gw")
			.connectTo("done")
			.build()

		const ids = flowIds(defs)
		expect(new Set(ids).size).toBe(ids.length)
		expect(ids).toContain("Flow_gw_gw_join")
		expect(ids).toContain("Flow_gw_gw_join_2")
	})

	it("keeps the gateway default pointing at its branch", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("start")
				.exclusiveGateway("gw")
				.branch("approved", (b) => b.condition("= ok").connectTo("done"))
				.branch("rejected", (b) => b.defaultFlow().connectTo("done"))
				.endEvent("done")
				.build(),
		)

		const gateway = defined(process.flowElements.find((el) => el.id === "gw"))
		const defaultFlowId = gateway.type === "exclusiveGateway" ? gateway.default : undefined
		const defaultFlow = defined(
			process.sequenceFlows.find((flow) => flow.id === defaultFlowId),
			"gateway default must name a flow that exists",
		)
		expect(defaultFlow.name).toBe("rejected")
	})

	it("names a backward flow after the loop it closes", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("work", { taskType: "work" })
			.exclusiveGateway("gw")
			.branch("retry", (b) => b.connectTo("work"))
			.branch("done", (b) => b.endEvent("finished"))
			.build()

		expect(flowIds(defs)).toContain("Flow_gw_work")
	})

	it("names a spliced flow after where it ended up, not where it started", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("work", { taskType: "work" })
			.endEvent("done")
			.insertAfter("start")
			.serviceTask("check", { taskType: "check" })
			.build()

		expect(flowIds(defs).sort()).toEqual(["Flow_check_work", "Flow_start_check", "Flow_work_done"])
	})

	it("names flows inside a sub-process the same way", () => {
		const process = firstProcess(
			Bpmn.createProcess("p")
				.startEvent("start")
				.subProcess("sub", {}, (s) =>
					s.startEvent("subStart").serviceTask("inner", { taskType: "inner" }).endEvent("subEnd"),
				)
				.endEvent("done")
				.build(),
		)

		const sub = defined(process.flowElements.find((el) => el.id === "sub"))
		const innerFlows = sub.type === "subProcess" ? (sub.sequenceFlows ?? []) : []
		expect(innerFlows.map((flow) => flow.id)).toEqual(["Flow_subStart_inner", "Flow_inner_subEnd"])
	})

	it("emits ids that are valid XML names even from awkward branch names", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.exclusiveGateway("gw")
			.branch("≥ 1 000 € / überfällig!", (b) => b.connectTo("done"))
			.branch("< 1 000 €", (b) => b.connectTo("done"))
			.endEvent("done")
			.build()

		for (const id of flowIds(defs)) expect(id).toMatch(NC_NAME)
		expect(new Set(flowIds(defs)).size).toBe(flowIds(defs).length)
	})

	it("never collides with an element id", () => {
		// "work" wants the id the second task already occupies.
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("work", { taskType: "work" })
			.serviceTask("Flow_start_work", { taskType: "collide" })
			.build()

		const process = firstProcess(defs)
		const ids = [...process.flowElements.map((el) => el.id), ...flowIds(defs)]
		expect(new Set(ids).size).toBe(ids.length)
	})

	describe("continuing a parsed document", () => {
		const source = () =>
			Bpmn.createProcess("p")
				.startEvent("start")
				.serviceTask("validate", { taskType: "validate" })
				.endEvent("done")
				.build()

		it("keeps the ids the document already had", () => {
			const continued = Bpmn.continueProcess(source(), "p")
				.insertAfter("validate")
				.serviceTask("audit", { taskType: "audit" })
				.build()

			const ids = flowIds(continued)
			// Both flows the document arrived with, including the spliced one — it
			// now runs audit → done, and keeping its id is the point.
			expect(ids).toContain("Flow_start_validate")
			expect(ids).toContain("Flow_validate_done")
			expect(ids).toContain("Flow_validate_audit")
		})

		it("does not reuse a preserved id for a new flow", () => {
			const handWritten = source()
			// A document whose own flow already occupies the id the builder would
			// otherwise derive for the one it is about to add.
			defined(firstProcess(handWritten).sequenceFlows[0]).id = "Flow_validate_audit"

			const continued = Bpmn.continueProcess(handWritten, "p")
				.insertAfter("validate")
				.serviceTask("audit", { taskType: "audit" })
				.build()

			const ids = flowIds(continued)
			expect(ids).toContain("Flow_validate_audit")
			expect(ids).toContain("Flow_validate_audit_2")
			expect(new Set(ids).size).toBe(ids.length)
		})
	})
})

describe("stable root definition ids", () => {
	it("names a message after the message name", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start", { messageName: "Order Received" })
			.endEvent("done")
			.build()

		expect(defs.messages.map((message) => message.id)).toEqual(["Message_Order_Received"])
	})

	it("names errors, signals and escalations after their code or name", () => {
		const defs = Bpmn.createProcess("p")
			.startEvent("start")
			.serviceTask("work", { taskType: "work" })
			.boundaryEvent("boundary", { attachedToRef: "work", errorCode: "OUT_OF_STOCK" })
			.endEvent("signalled", { signalName: "Order Cancelled" })
			.element("work")
			.endEvent("escalated", { escalationCode: "NEEDS_REVIEW" })
			.build()

		expect(defs.errors.map((error) => error.id)).toEqual(["Error_OUT_OF_STOCK"])
		expect(defs.signals.map((signal) => signal.id)).toEqual(["Signal_Order_Cancelled"])
		expect(defs.escalations.map((escalation) => escalation.id)).toEqual(["Escalation_NEEDS_REVIEW"])
	})

	it("gives the same definitions the same ids on every build", () => {
		const build = () =>
			Bpmn.createProcess("p")
				.startEvent("start", { messageName: "Order Received" })
				.endEvent("done", { signalName: "Order Shipped" })
				.build()

		expect(build().messages).toEqual(build().messages)
		expect(build().signals).toEqual(build().signals)
	})

	it("declares a message shared by two pools once", () => {
		const defs = Bpmn.createDiagram("d")
			.process("buyer", (p) => p.startEvent("buyerStart", { messageName: "Order" }).endEvent("b"))
			.process("seller", (p) => p.startEvent("sellerStart", { messageName: "Order" }).endEvent("s"))
			.participant("buyerPool", { processId: "buyer" })
			.participant("sellerPool", { processId: "seller" })
			.build()

		expect(defs.messages.map((message) => message.id)).toEqual(["Message_Order"])
	})
})
