import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/index.js"

/**
 * The builder infers a join gateway where several branches of one gateway reach
 * the same element. That is a help to someone reading the chain they just wrote,
 * and a trap for generated code, which cannot see the element it did not emit.
 * `{ explicitJoins: true }` turns the help into a refusal.
 */

function converging(options?: Parameters<ReturnType<typeof Bpmn.createProcess>["build"]>[0]) {
	return Bpmn.createProcess("proc")
		.startEvent("s")
		.exclusiveGateway("gw")
		.branch("a", (b) =>
			b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("after"),
		)
		.branch("b", (b) => b.defaultFlow().connectTo("after"))
		.serviceTask("after", { name: "After", taskType: "z" })
		.endEvent("end")
		.build(options)
}

describe("explicitJoins", () => {
	it("infers a join by default", () => {
		const process = converging().processes[0]
		expect(process?.flowElements.map((element) => element.id)).toContain("gw_join")
	})

	it("refuses the inference when asked to", () => {
		expect(() => converging({ explicitJoins: true })).toThrow(/Inferred join gateways/)
	})

	it("names the gateway it would have inserted", () => {
		// "Something was inferred" without "what" leaves you diffing two models to
		// find out; the id is what you pass to .connectTo().
		expect(() => converging({ explicitJoins: true })).toThrow(/gw_join/)
	})

	it("still honours the old name", () => {
		expect(() => converging({ strict: true })).toThrow(/Inferred join gateways/)
	})

	it("prefers explicitJoins when both are given", () => {
		expect(() => converging({ explicitJoins: false, strict: true })).not.toThrow()
	})

	function declaredJoin(joinType: "exclusiveGateway" | "parallelGateway") {
		const builder = Bpmn.createProcess("proc")
			.startEvent("s")
			.exclusiveGateway("gw")
			.branch("a", (b) =>
				b.condition("= x").serviceTask("t1", { name: "A", taskType: "a" }).connectTo("join"),
			)
			.branch("b", (b) => b.defaultFlow().connectTo("join"))
		const joined =
			joinType === "exclusiveGateway"
				? builder.exclusiveGateway("join")
				: builder.parallelGateway("join")
		return () => joined.endEvent("end").build({ explicitJoins: true })
	}

	it("passes when the join is declared", () => {
		expect(declaredJoin("exclusiveGateway")).not.toThrow()
	})

	/**
	 * The declared join has to *match the split*. A parallel join under an
	 * exclusive split is not the gateway the inference would have added, so the
	 * inference still fires — and the refusal is the only thing that tells you,
	 * which is exactly the case generated code gets wrong.
	 */
	it("still refuses a declared join of the wrong type", () => {
		expect(declaredJoin("parallelGateway")).toThrow(/Inferred join gateways/)
	})

	/**
	 * Continuing a parsed model never infers joins, so the option has nothing to
	 * refuse — asking for explicitness on a builder that is already explicit must
	 * not invent a failure.
	 */
	it("is a no-op when continuing an existing model", () => {
		const before = Bpmn.parse(Bpmn.export(converging()))
		expect(() => Bpmn.continueProcess(before, "proc").build({ explicitJoins: true })).not.toThrow()
	})
})
