import { describe, expect, it } from "vitest"
import {
	BranchBuilder,
	ProcessBuilder,
	SubProcessContentBuilder,
} from "../src/bpmn/bpmn-builder.js"
import type { BpmnElementType } from "../src/bpmn/bpmn-model.js"
import {
	BUILDER_COVERAGE,
	type BuilderSupport,
	FLOW_BUILDER_NAMES,
	hasBuilderMethod,
} from "../src/bpmn/builder-coverage.js"
import { Bpmn } from "../src/bpmn/index.js"

/**
 * The check that stops the fluent builder drifting from the element model.
 *
 * `BUILDER_COVERAGE` already fails `tsc` when `BpmnElementType` grows, because
 * it is a total `Record` over that union. What the compiler cannot see is
 * whether the method each entry names actually exists — so this asserts the
 * other half: every named method is present on all three flow builders, and
 * every exemption still describes something the builder really does not offer.
 *
 * The gap this was written for: `manualTask`, `complexGateway` and
 * `transaction` were in the model, the parser, the serialiser, the layout and
 * the compact/JSON path, but had no builder method — so callers reached for the
 * XML instead.
 */

const BUILDERS = {
	ProcessBuilder: ProcessBuilder.prototype,
	BranchBuilder: BranchBuilder.prototype,
	SubProcessContentBuilder: SubProcessContentBuilder.prototype,
} as const

function entries(): Array<[BpmnElementType, BuilderSupport]> {
	return Object.entries(BUILDER_COVERAGE) as Array<[BpmnElementType, BuilderSupport]>
}

function hasMethod(prototype: object, name: string): boolean {
	return typeof (prototype as Record<string, unknown>)[name] === "function"
}

describe("builder coverage", () => {
	it("classifies every element type", () => {
		// The Record is total by construction; this catches the table being
		// emptied or stubbed rather than maintained.
		expect(entries().length).toBeGreaterThan(20)
	})

	it("names a builder class for each flow builder under test", () => {
		expect(Object.keys(BUILDERS).sort()).toEqual([...FLOW_BUILDER_NAMES].sort())
	})

	it.each(Object.entries(BUILDERS))("%s exposes every covered type", (_name, prototype) => {
		const missing = entries()
			.filter(([, support]) => hasBuilderMethod(support))
			.map(([type, support]) => ({ type, method: (support as { method: string }).method }))
			.filter((entry) => !hasMethod(prototype, entry.method))
			.map((entry) => `${entry.type} → .${entry.method}()`)

		expect(
			missing,
			[
				"These element types are covered in BUILDER_COVERAGE but the method is missing here.",
				"Add the method to this builder, or — if the type genuinely cannot be authored",
				"through the chain — move it to an exempt entry with a reason.",
			].join(" "),
		).toEqual([])
	})

	it("still has no method for any exempt type", () => {
		const stale = entries()
			.filter(([, support]) => !hasBuilderMethod(support))
			.flatMap(([type, support]) =>
				Object.entries(BUILDERS)
					.filter(([, prototype]) => hasMethod(prototype, type))
					.map(
						([name]) =>
							`${type} on ${name} — exempt because: ${(support as { exempt: string }).exempt}`,
					),
			)

		expect(
			stale,
			"These types now have a builder method. Replace the exempt entry with { method } — that replacement is the record of progress.",
		).toEqual([])
	})

	it("gives every exemption a reason", () => {
		const unreasoned = entries()
			.filter(([, support]) => !hasBuilderMethod(support))
			.filter(([, support]) => (support as { exempt: string }).exempt.trim().length === 0)
			.map(([type]) => type)

		expect(unreasoned, "An exemption without a reason is just a gap.").toEqual([])
	})
})

/**
 * The evidence behind the table: each type it claims a method for is reachable
 * from a builder chain and survives a round trip as that element. Without this
 * the table would assert coverage the methods do not actually deliver.
 */
describe("the newly covered types round-trip", () => {
	it("builds a manual task", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("P")
				.startEvent("s")
				.manualTask("m", { name: "Stamp the form" })
				.endEvent("e")
				.build(),
		)

		expect(xml).toContain('<bpmn:manualTask id="m" name="Stamp the form"')

		const parsed = Bpmn.parse(xml)
		expect(parsed.processes[0]?.flowElements.find((el) => el.id === "m")?.type).toBe("manualTask")
	})

	it("builds a complex gateway", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("P").startEvent("s").complexGateway("g").endEvent("e").build(),
		)

		expect(xml).toContain('<bpmn:complexGateway id="g"')
		expect(Bpmn.parse(xml).processes[0]?.flowElements.find((el) => el.id === "g")?.type).toBe(
			"complexGateway",
		)
	})

	it("builds a transaction with nested content", () => {
		const xml = Bpmn.export(
			Bpmn.createProcess("P")
				.startEvent("s")
				.transaction("tx", (b) => {
					b.startEvent("ts").serviceTask("book", { taskType: "booking" }).endEvent("te")
				})
				.endEvent("e")
				.build(),
		)

		expect(xml).toContain('<bpmn:transaction id="tx"')
		expect(xml).toContain('<bpmn:serviceTask id="book"')

		const tx = Bpmn.parse(xml).processes[0]?.flowElements.find((el) => el.id === "tx")
		expect(tx?.type).toBe("transaction")
		expect(tx && "flowElements" in tx ? tx.flowElements.map((el) => el.id) : []).toContain("book")
	})

	it("reaches all three from inside a branch and a sub-process", () => {
		const definitions = Bpmn.createProcess("P")
			.startEvent("s")
			.exclusiveGateway("g")
			.branch("left", (b) =>
				b
					.condition("= go")
					.manualTask("bm")
					.complexGateway("bg")
					.transaction("btx", (t) => {
						t.startEvent("bts").endEvent("bte")
					})
					.connectTo("join"),
			)
			.branch("right", (b) => b.defaultFlow().task("other").connectTo("join"))
			.exclusiveGateway("join")
			.subProcess("sub", (sp) => {
				sp.startEvent("ss")
					.manualTask("sm")
					.complexGateway("sg")
					.transaction("stx", (t) => {
						t.startEvent("sts").endEvent("ste")
					})
					.endEvent("se")
			})
			.endEvent("e")
			.build()

		const xml = Bpmn.export(definitions)
		for (const fragment of [
			'<bpmn:manualTask id="bm"',
			'<bpmn:complexGateway id="bg"',
			'<bpmn:transaction id="btx"',
			'<bpmn:manualTask id="sm"',
			'<bpmn:complexGateway id="sg"',
			'<bpmn:transaction id="stx"',
		]) {
			expect(xml).toContain(fragment)
		}

		// The round trip must not quietly drop the nested elements.
		expect(Bpmn.export(Bpmn.parse(xml))).toContain('<bpmn:transaction id="stx"')
	})

	it("emits event sub-processes in the spec form the table records", () => {
		// BPMN 2.0 has no bpmn:eventSubProcess element, so the builder emits
		// subProcess triggeredByEvent="true" — BUILDER_COVERAGE records that via
		// `emits`, and this is what makes the exception legible rather than a bug.
		const support = BUILDER_COVERAGE.eventSubProcess
		expect(hasBuilderMethod(support) && support.emits).toBe("subProcess")

		const xml = Bpmn.export(
			Bpmn.createProcess("P")
				.startEvent("s")
				.endEvent("e")
				.eventSubProcess("esp", (b) => {
					b.startEvent("es").endEvent("ee")
				})
				.build(),
		)

		expect(xml).toContain('triggeredByEvent="true"')
		expect(xml).not.toContain("<bpmn:eventSubProcess")
	})
})
