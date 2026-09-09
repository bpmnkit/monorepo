import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/bpmn/index.js"
import { type TypeCoverage, descriptorCoverage } from "./support/descriptor-coverage.js"

/**
 * The check that stops the hand-written model drifting from the specification.
 *
 * `bpmn-model.ts` is maintained by hand, so a construct the BPMN or Zeebe
 * descriptors define can go unnoticed — which is how the losses in
 * `doc/bpmn-sdk-comparison.md` §4 accumulated in the first place. This probes
 * every concrete type in the vendored descriptors and requires that it survives
 * a round trip, either as a typed field (`modelled`) or verbatim (`preserved`).
 *
 * A new descriptor version that widens the surface fails here rather than
 * quietly widening the loss.
 */

/**
 * Types the probe cannot place meaningfully, each reviewed.
 *
 * These are base types the descriptors do not mark abstract but which never
 * appear as elements in a real document — you write `dataInputAssociation`, not
 * `dataAssociation`. The probe has nowhere sensible to put them, so it puts them
 * in the most permissive slot the schema allows and they do not come back. The
 * test below proves their concrete forms do survive, which is what actually
 * matters.
 */
const ACCEPTED_DROPS: Array<{ type: string; parent: string; reason: string }> = [
	{
		type: "bpmn:DataAssociation",
		parent: "bpmn:Lane",
		reason:
			"Base type; documents contain dataInputAssociation / dataOutputAssociation, both modelled",
	},
	{
		type: "bpmn:ItemAwareElement",
		parent: "bpmn:Lane",
		reason:
			"Base type; documents contain dataObject, dataObjectReference, dataStoreReference and property, all covered",
	},
	{
		type: "bpmn:Assignment",
		parent: "bpmn:DataAssociation",
		reason: "Probed inside the base type above, which itself never appears",
	},
	{
		type: "bpmn:FormalExpression",
		parent: "bpmn:DataAssociation",
		reason: "Probed inside the base type above, which itself never appears",
	},
	{
		type: "bpmn:DataState",
		parent: "bpmn:ItemAwareElement",
		reason: "Probed inside the base type above, which itself never appears",
	},
	{
		type: "bpmn:ImplicitThrowEvent",
		parent: "bpmn:ComplexBehaviorDefinition",
		reason:
			"Reached only through a chain the probe builds from base types; the real nesting is covered",
	},
]

/**
 * Types with no containment path from `bpmn:definitions`.
 *
 * Both describe *extension mechanisms* rather than document content — they say
 * how a schema extension is declared, and never appear inside a BPMN file.
 */
const ACCEPTED_UNPROBED: Array<{ type: string; reason: string }> = [
	{ type: "bpmn:ExtensionAttributeDefinition", reason: "Schema-extension metadata, not content" },
	{ type: "bpmn:ExtensionDefinition", reason: "Schema-extension metadata, not content" },
]

function describeRow(row: TypeCoverage): string {
	return `${row.type} (in ${row.parent ?? "—"})`
}

describe("descriptor coverage", () => {
	const rows = descriptorCoverage()

	it("probes the whole descriptor surface", () => {
		// A sanity floor: if this collapses, the probe stopped working rather than
		// the model getting smaller.
		expect(rows.length).toBeGreaterThan(120)
	})

	it("drops nothing that is not already accepted", () => {
		const accepted = new Set(ACCEPTED_DROPS.map((entry) => `${entry.type}|${entry.parent}`))
		const unexpected = rows
			.filter((row) => row.coverage === "dropped")
			.filter((row) => !accepted.has(`${row.type}|${row.parent}`))
			.map(describeRow)

		expect(
			unexpected,
			[
				"These descriptor types do not survive a round trip.",
				"Model them, or let them reach unknownChildren, or — if the probe simply has",
				"nowhere sensible to put them — add them to ACCEPTED_DROPS with a reason and a",
				"test showing the form that does appear in real documents survives.",
			].join(" "),
		).toEqual([])
	})

	it("still drops every accepted entry", () => {
		const dropped = new Set(
			rows.filter((row) => row.coverage === "dropped").map((row) => `${row.type}|${row.parent}`),
		)
		const stale = ACCEPTED_DROPS.filter(
			(entry) => !dropped.has(`${entry.type}|${entry.parent}`),
		).map((entry) => `${entry.type} — ${entry.reason}`)

		expect(
			stale,
			"These no longer drop. Delete the ACCEPTED_DROPS entry — that deletion is the record of progress.",
		).toEqual([])
	})

	it("leaves nothing unprobed that is not already accepted", () => {
		const accepted = new Set(ACCEPTED_UNPROBED.map((entry) => entry.type))
		const unexpected = rows
			.filter((row) => row.coverage === "unprobed")
			.filter((row) => !accepted.has(row.type))
			.map((row) => `${row.type} — ${row.reason}`)

		expect(
			unexpected,
			"The probe could not build a document for these. Fix the probe, or accept them with a reason.",
		).toEqual([])
	})

	it("still cannot probe every accepted entry", () => {
		const unprobed = new Set(
			rows.filter((row) => row.coverage === "unprobed").map((row) => row.type),
		)
		expect(
			ACCEPTED_UNPROBED.filter((entry) => !unprobed.has(entry.type)).map((e) => e.type),
		).toEqual([])
	})

	it("covers the Zeebe extension surface", () => {
		const zeebe = rows.filter((row) => row.type.startsWith("zeebe:"))
		expect(zeebe.length).toBeGreaterThan(20)
		expect(zeebe.filter((row) => row.coverage === "dropped")).toEqual([])
	})
})

/**
 * The evidence behind `ACCEPTED_DROPS`: every one of those types is reachable in
 * a real document through a concrete form, and that form round-trips. Without
 * this the accept-list would be an assertion rather than a finding.
 */
describe("the forms behind the accepted drops do survive", () => {
	const CONCRETE = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:dataObjectReference id="DOR" />
    <bpmn:serviceTask id="T">
      <bpmn:dataInputAssociation id="DIA">
        <bpmn:sourceRef>DOR</bpmn:sourceRef>
        <bpmn:assignment id="A"><bpmn:from>=x</bpmn:from><bpmn:to>=y</bpmn:to></bpmn:assignment>
      </bpmn:dataInputAssociation>
      <bpmn:multiInstanceLoopCharacteristics id="MI">
        <bpmn:complexBehaviorDefinition id="CBD">
          <bpmn:condition xsi:type="bpmn:tFormalExpression">=go</bpmn:condition>
          <bpmn:event id="ITE" />
        </bpmn:complexBehaviorDefinition>
      </bpmn:multiInstanceLoopCharacteristics>
    </bpmn:serviceTask>
    <bpmn:dataObject id="DO"><bpmn:dataState id="DS" name="ready" /></bpmn:dataObject>
  </bpmn:process>
</bpmn:definitions>`

	const exported = Bpmn.export(Bpmn.parse(CONCRETE))

	for (const element of [
		"bpmn:assignment",
		"bpmn:complexBehaviorDefinition",
		"bpmn:condition",
		"bpmn:event",
		"bpmn:dataState",
		"bpmn:dataInputAssociation",
	]) {
		it(`keeps ${element}`, () => {
			expect(exported).toContain(`<${element}`)
		})
	}
})
