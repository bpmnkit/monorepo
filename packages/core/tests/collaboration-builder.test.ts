import { describe, expect, it } from "vitest"
import { applyAutoLayout } from "../src/bpmn/auto-layout.js"
import type { BpmnDefinitions } from "../src/bpmn/bpmn-model.js"
import { Bpmn } from "../src/index.js"

/**
 * `DiagramBuilder` hard-coded `collaborations: []`, so a pooled diagram was the
 * one shape the SDK could parse, lay out and render but not build. These tests
 * are mostly about the two halves meeting: what the builder produces has to
 * survive export, come back the same on parse, and lay out into pools.
 */

function twoPools(): BpmnDefinitions {
	return Bpmn.createDiagram("Order")
		.process("order", (p) =>
			p.startEvent("o_start").serviceTask("o_send", { taskType: "send" }).endEvent("o_end"),
		)
		.process("supply", (p) =>
			p.startEvent("s_start").serviceTask("s_recv", { taskType: "recv" }).endEvent("s_end"),
		)
		.participant("P_Buyer", { name: "Buyer", processId: "order" })
		.participant("P_Seller", { name: "Seller", processId: "supply" })
		.message("Msg_Order", { name: "order placed", correlationKey: "= orderId" })
		.messageFlow("MF_1", {
			source: "o_send",
			target: "s_recv",
			name: "order",
			messageRef: "Msg_Order",
		})
		.build()
}

describe("collaboration builder", () => {
	it("emits no collaboration when none was declared", () => {
		const defs = Bpmn.createDiagram("d")
			.process("p", (b) => b.startEvent("s").endEvent("e"))
			.build()
		// An empty <bpmn:collaboration/> is not a neutral addition: a modeler reads
		// it as "this document is pooled" and renders every process pool-less.
		expect(defs.collaborations).toEqual([])
		expect(Bpmn.export(defs)).not.toContain("collaboration")
	})

	it("builds participants, message flows and messages", () => {
		const collaboration = twoPools().collaborations[0]
		expect(collaboration?.id).toBe("Collaboration_1")
		expect(collaboration?.participants.map((p) => [p.id, p.processRef])).toEqual([
			["P_Buyer", "order"],
			["P_Seller", "supply"],
		])
		expect(collaboration?.messageFlows[0]).toMatchObject({
			id: "MF_1",
			sourceRef: "o_send",
			targetRef: "s_recv",
			messageRef: "Msg_Order",
		})
	})

	it("uses the ids it is given, verbatim", () => {
		const xml = Bpmn.export(twoPools())
		for (const id of ["P_Buyer", "P_Seller", "MF_1", "Msg_Order", "Collaboration_1"]) {
			expect(xml).toContain(`id="${id}"`)
		}
	})

	it("renames the collaboration on request", () => {
		const defs = Bpmn.createDiagram("d")
			.process("p", (b) => b.startEvent("s").endEvent("e"))
			.collaborationId("Collab_Custom")
			.participant("Pool", { processId: "p" })
			.build()
		expect(defs.collaborations[0]?.id).toBe("Collab_Custom")
	})

	it("carries a correlation key onto the message", () => {
		expect(twoPools().messages.find((m) => m.id === "Msg_Order")?.extensionElements).toEqual([
			{ name: "zeebe:subscription", attributes: { correlationKey: "= orderId" }, children: [] },
		])
	})

	it("models a black box participant", () => {
		const defs = Bpmn.createDiagram("d")
			.process("p", (b) => b.startEvent("s").serviceTask("t", { taskType: "t" }).endEvent("e"))
			.participant("Us", { processId: "p" })
			.participant("Them", { name: "Counterparty" })
			.messageFlow("MF", { source: "t", target: "Them" })
			.build()
		expect(defs.collaborations[0]?.participants[1]).toEqual({
			id: "Them",
			name: "Counterparty",
			unknownAttributes: {},
		})
	})

	it("survives export and parse unchanged", () => {
		const built = twoPools()
		const reparsed = Bpmn.parse(Bpmn.export(built))
		expect(reparsed.collaborations).toEqual(built.collaborations)
	})

	it("serialises the same document a second time", () => {
		const once = Bpmn.export(twoPools())
		expect(Bpmn.export(Bpmn.parse(once))).toBe(once)
	})

	/**
	 * Found by the round-trip assertion above. `messageRef` was read into the
	 * typed field *and* kept in `unknownAttributes`, because it was missing from
	 * the parser's known-attribute list. Harmless on the wire — the serialiser
	 * writes the typed field last, so the value was correct either way — but it
	 * makes `unknownAttributes` untrue about what the SDK models.
	 */
	it("does not also keep messageRef as an unknown attribute", () => {
		const flow = Bpmn.parse(Bpmn.export(twoPools())).collaborations[0]?.messageFlows[0]
		expect(flow?.messageRef).toBe("Msg_Order")
		expect(flow?.unknownAttributes).toEqual({})
	})

	it("lays out into pools with message flow edges", () => {
		const plane = applyAutoLayout(twoPools()).diagrams[0]?.plane
		const pools = (plane?.shapes ?? []).filter((shape) => shape.bpmnElement.startsWith("P_"))
		expect(pools.map((shape) => shape.bpmnElement)).toEqual(["P_Buyer", "P_Seller"])
		// Two pools, one above the other — not stacked at the same origin.
		expect(pools[0]?.bounds.y).not.toBe(pools[1]?.bounds.y)
		expect((plane?.edges ?? []).map((edge) => edge.bpmnElement)).toContain("MF_1")
	})
})

/**
 * A builder that emits a document a modeler refuses to open is worse than one
 * that refuses to build it. Each of these is a file that opens broken.
 */
describe("collaboration builder — refusals", () => {
	function build(configure: (b: ReturnType<typeof Bpmn.createDiagram>) => void): () => void {
		return () => {
			const builder = Bpmn.createDiagram("d").process("p", (b) =>
				b.startEvent("s").serviceTask("t", { taskType: "t" }).endEvent("e"),
			)
			configure(builder)
			builder.build()
		}
	}

	it("refuses a participant pointing at a process that is not there", () => {
		expect(build((b) => b.participant("Pool", { processId: "nope" }))).toThrow(
			/references process "nope"/,
		)
	})

	it("refuses two pools claiming the same process", () => {
		expect(
			build((b) => {
				b.participant("A", { processId: "p" })
				b.participant("B", { processId: "p" })
			}),
		).toThrow(/both reference process "p"/)
	})

	it("refuses a duplicate id", () => {
		expect(
			build((b) => {
				b.participant("Pool", { processId: "p" })
				b.participant("Pool", {})
			}),
		).toThrow(/Duplicate element ID "Pool"/)
	})

	it("refuses a message flow to something that does not exist", () => {
		expect(
			build((b) => {
				b.participant("Pool", { processId: "p" })
				b.participant("Other", {})
				b.messageFlow("MF", { source: "t", target: "ghost" })
			}),
		).toThrow(/names target "ghost"/)
	})

	/**
	 * The one worth having. A message flow is what crosses a pool boundary; one
	 * that starts and ends in the same pool should be a sequence flow, and every
	 * modeler rejects it.
	 */
	it("refuses a message flow that does not cross a pool boundary", () => {
		expect(
			build((b) => {
				b.participant("Pool", { processId: "p" })
				b.messageFlow("MF", { source: "s", target: "t" })
			}),
		).toThrow(/starts and ends in participant "Pool"/)
	})

	it("refuses a message flow naming an undeclared message", () => {
		expect(
			build((b) => {
				b.participant("Pool", { processId: "p" })
				b.participant("Other", {})
				b.messageFlow("MF", { source: "t", target: "Other", messageRef: "Msg_Ghost" })
			}),
		).toThrow(/references message "Msg_Ghost"/)
	})

	it("reports every problem at once rather than the first", () => {
		expect(build((b) => b.participant("Pool", { processId: "nope" }))).toThrow(
			/Invalid collaboration:/,
		)
		try {
			build((b) => {
				b.participant("A", { processId: "nope" })
				b.participant("B", { processId: "also-nope" })
			})()
			expect.unreachable()
		} catch (error) {
			expect((error as Error).message).toContain('"nope"')
			expect((error as Error).message).toContain('"also-nope"')
		}
	})

	it("accepts a flow node nested in a sub-process as an endpoint", () => {
		expect(
			build((b) => {
				b.process("q", (p) =>
					p.startEvent("qs").subProcess("sub", (inner) => {
						inner.startEvent("in_s").serviceTask("in_t", { taskType: "t" }).endEvent("in_e")
					}),
				)
				b.participant("Pool", { processId: "p" })
				b.participant("Q", { processId: "q" })
				b.messageFlow("MF", { source: "t", target: "in_t" })
			}),
		).not.toThrow()
	})
})
