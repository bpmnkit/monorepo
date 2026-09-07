import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { Bpmn } from "../src/index.js"
import { diffSignatures, formatChange, xmlSignature } from "./support/xml-signature.js"

/**
 * The round-trip fidelity gate.
 *
 * `Bpmn.parse()` → `Bpmn.export()` is expected to preserve the document. Where
 * it does not, the loss is listed here, so that:
 *
 * - a **new** loss fails the build, and
 * - a **fixed** loss also fails the build, as a stale entry to delete.
 *
 * The second half is what makes this a ratchet rather than a snapshot. Closing
 * the model gaps (roadmap item A3) means deleting entries from this file until
 * only `normalised` ones remain.
 *
 * Adding a fixture requires no code change — drop a `.bpmn` file into
 * `tests/fixtures/roundtrip/` and run the suite. See that directory's
 * PROVENANCE.md before adding files sourced from elsewhere.
 */

interface AllowedChange {
	/** Signature feature, exactly as `formatChange` spells the left-hand side. */
	feature: string
	/**
	 * `gap` — content the SDK drops. A3 must close it; the entry then goes.
	 * `normalised` — a deliberate, semantics-preserving rewrite. Permanent.
	 */
	kind: "gap" | "normalised"
	reason: string
}

const G1 =
	"G1: extensionElements are not modelled on root bpmn:message, so zeebe:subscription correlation keys are dropped"
const G3 = "G3: documentation is not modelled on bpmn:definitions or bpmn:process"
const G4 = "G4: bpmn:category and bpmn:categoryValue are not modelled, so group labels are dropped"
const G5 = "G5: data associations and bpmn:property are not modelled, so data wiring is dropped"
const G22 =
	"G22: loopCardinality and completionCondition are not modelled on bpmn:multiInstanceLoopCharacteristics"
const G23 = "G23: extensionElements are not modelled on bpmn:collaboration"

const OPTIONAL_FALSE =
	"Serialised only when true; BPMN treats the absent attribute as false, so the round trip is stable and semantics are unchanged"

const ALLOWED: Record<string, AllowedChange[]> = {
	"01-root-elements.bpmn": [
		{ feature: "element:zeebe:subscription", kind: "gap", reason: G1 },
		{ feature: "attr:zeebe:subscription@correlationKey", kind: "gap", reason: G1 },
		{ feature: "child:bpmn:extensionElements > zeebe:subscription", kind: "gap", reason: G1 },
		{ feature: "child:bpmn:message > bpmn:extensionElements", kind: "gap", reason: G1 },
		{ feature: "element:bpmn:extensionElements", kind: "gap", reason: G1 },
		{ feature: "element:bpmn:documentation", kind: "gap", reason: G3 },
		{ feature: "text:bpmn:documentation", kind: "gap", reason: G3 },
		{ feature: "child:bpmn:definitions > bpmn:documentation", kind: "gap", reason: G3 },
		{ feature: "child:bpmn:process > bpmn:documentation", kind: "gap", reason: G3 },
	],
	"02-collaboration.bpmn": [
		{ feature: "element:bpmn:extensionElements", kind: "gap", reason: G23 },
		{ feature: "child:bpmn:collaboration > bpmn:extensionElements", kind: "gap", reason: G23 },
		{ feature: "element:zeebe:properties", kind: "gap", reason: G23 },
		{ feature: "element:zeebe:property", kind: "gap", reason: G23 },
		{ feature: "attr:zeebe:property@name", kind: "gap", reason: G23 },
		{ feature: "attr:zeebe:property@value", kind: "gap", reason: G23 },
		{ feature: "child:bpmn:extensionElements > zeebe:properties", kind: "gap", reason: G23 },
		{ feature: "child:zeebe:properties > zeebe:property", kind: "gap", reason: G23 },
		{ feature: "attr:bpmn:process@isExecutable", kind: "normalised", reason: OPTIONAL_FALSE },
	],
	"03-data-elements.bpmn": [
		{ feature: "element:bpmn:dataInputAssociation", kind: "gap", reason: G5 },
		{ feature: "element:bpmn:dataOutputAssociation", kind: "gap", reason: G5 },
		{ feature: "element:bpmn:property", kind: "gap", reason: G5 },
		{ feature: "element:bpmn:sourceRef", kind: "gap", reason: G5 },
		{ feature: "element:bpmn:targetRef", kind: "gap", reason: G5 },
		{ feature: "text:bpmn:sourceRef", kind: "gap", reason: G5 },
		{ feature: "text:bpmn:targetRef", kind: "gap", reason: G5 },
		{ feature: "attr:bpmn:dataInputAssociation@id", kind: "gap", reason: G5 },
		{ feature: "attr:bpmn:dataOutputAssociation@id", kind: "gap", reason: G5 },
		{ feature: "attr:bpmn:property@id", kind: "gap", reason: G5 },
		{ feature: "attr:bpmn:property@name", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:serviceTask > bpmn:dataInputAssociation", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:serviceTask > bpmn:dataOutputAssociation", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:serviceTask > bpmn:property", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:dataInputAssociation > bpmn:sourceRef", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:dataInputAssociation > bpmn:targetRef", kind: "gap", reason: G5 },
		{ feature: "child:bpmn:dataOutputAssociation > bpmn:targetRef", kind: "gap", reason: G5 },
	],
	"04-artifacts.bpmn": [
		{ feature: "element:bpmn:category", kind: "gap", reason: G4 },
		{ feature: "element:bpmn:categoryValue", kind: "gap", reason: G4 },
		{ feature: "attr:bpmn:category@id", kind: "gap", reason: G4 },
		{ feature: "attr:bpmn:categoryValue@id", kind: "gap", reason: G4 },
		{ feature: "attr:bpmn:categoryValue@value", kind: "gap", reason: G4 },
		{ feature: "child:bpmn:definitions > bpmn:category", kind: "gap", reason: G4 },
		{ feature: "child:bpmn:category > bpmn:categoryValue", kind: "gap", reason: G4 },
	],
	"05-zeebe-extensions.bpmn": [],
	"06-events-and-containers.bpmn": [
		{ feature: "element:bpmn:loopCardinality", kind: "gap", reason: G22 },
		{ feature: "element:bpmn:completionCondition", kind: "gap", reason: G22 },
		{ feature: "text:bpmn:loopCardinality", kind: "gap", reason: G22 },
		{ feature: "text:bpmn:completionCondition", kind: "gap", reason: G22 },
		{ feature: "attr:bpmn:loopCardinality@xsi:type", kind: "gap", reason: G22 },
		{ feature: "attr:bpmn:completionCondition@xsi:type", kind: "gap", reason: G22 },
		{
			feature: "child:bpmn:multiInstanceLoopCharacteristics > bpmn:loopCardinality",
			kind: "gap",
			reason: G22,
		},
		{
			feature: "child:bpmn:multiInstanceLoopCharacteristics > bpmn:completionCondition",
			kind: "gap",
			reason: G22,
		},
		{
			feature: "attr:bpmn:multiInstanceLoopCharacteristics@isSequential",
			kind: "normalised",
			reason: OPTIONAL_FALSE,
		},
	],
}

const fixtureDirectory = join(import.meta.dirname, "fixtures", "roundtrip")

function fixtures(): string[] {
	return readdirSync(fixtureDirectory)
		.filter((name) => name.endsWith(".bpmn"))
		.sort()
}

describe("BPMN round-trip fidelity", () => {
	it("has a corpus", () => {
		expect(fixtures().length).toBeGreaterThan(0)
	})

	it("lists every fixture in the allow-list", () => {
		// A fixture with no entry would otherwise be silently ungated.
		expect(fixtures().filter((name) => ALLOWED[name] === undefined)).toEqual([])
	})

	for (const name of fixtures()) {
		describe(name, () => {
			const source = readFileSync(join(fixtureDirectory, name), "utf-8")
			const exported = Bpmn.export(Bpmn.parse(source))
			const changes = diffSignatures(xmlSignature(source), xmlSignature(exported))
			const allowed = ALLOWED[name] ?? []
			const allowedFeatures = new Set(allowed.map((entry) => entry.feature))

			it("loses nothing that is not already known", () => {
				const unexpected = changes
					.filter((change) => !allowedFeatures.has(change.feature))
					.map(formatChange)

				expect(
					unexpected,
					[
						`${name} changed in a way this gate does not know about.`,
						"If the change is a loss, fix it. If it is a deliberate, semantics-preserving",
						'rewrite, add it to ALLOWED with kind "normalised" and say why.',
					].join(" "),
				).toEqual([])
			})

			it("still exhibits every known change", () => {
				const changed = new Set(changes.map((change) => change.feature))
				const stale = allowed
					.filter((entry) => !changed.has(entry.feature))
					.map((entry) => `${entry.feature} (${entry.kind}) — ${entry.reason}`)

				expect(
					stale,
					[
						`${name} no longer exhibits these changes.`,
						"If a gap is closed, delete its entry from ALLOWED — that deletion is how A3",
						"records progress.",
					].join(" "),
				).toEqual([])
			})

			it("re-exports identically the second time", () => {
				// Whatever the first pass normalises or drops, the second pass must be a
				// fixed point. A round trip that keeps changing the file would make every
				// save a fresh diff.
				const twice = Bpmn.export(Bpmn.parse(exported))
				expect(
					diffSignatures(xmlSignature(exported), xmlSignature(twice)).map(formatChange),
				).toEqual([])
			})
		})
	}
})
