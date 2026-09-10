import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { DmnDefinitions } from "../src/dmn/dmn-model.js"
import { parseDmn } from "../src/dmn/dmn-parser.js"
import { serializeDmn } from "../src/dmn/dmn-serializer.js"
import { exportDmnPreserving, preserveDmnFormatting } from "../src/dmn/preserving-writer.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "dmn")
const files = readdirSync(FIXTURES).filter((name) => name.endsWith(".dmn"))
const read = (name: string): string => readFileSync(join(FIXTURES, name), "utf8")

/**
 * Lines removed and added between two documents.
 *
 * A real diff: deleting lines shifts everything after them, and counting those
 * as changes would report a minimal edit as a rewrite.
 */
function lineDiff(a: string, b: string): { removed: number; added: number } {
	const left = a.split("\n")
	const right = b.split("\n")
	const table = Array.from({ length: left.length + 1 }, () => new Int32Array(right.length + 1))
	for (let i = left.length - 1; i >= 0; i -= 1) {
		for (let j = right.length - 1; j >= 0; j -= 1) {
			const row = table[i] as Int32Array
			const next = table[i + 1] as Int32Array
			row[j] =
				left[i] === right[j]
					? (next[j + 1] as number) + 1
					: Math.max(next[j] as number, row[j + 1] as number)
		}
	}
	const common = (table[0] as Int32Array)[0] as number
	return { removed: left.length - common, added: right.length - common }
}

/** The invariant: a preserved write says exactly what a plain write says. */
function sameAsPlainWrite(result: string, definitions: DmnDefinitions): void {
	expect(JSON.parse(JSON.stringify(parseDmn(result)))).toEqual(
		JSON.parse(JSON.stringify(parseDmn(serializeDmn(definitions)))),
	)
}

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
  id="Definitions_1" name="Risk" namespace="http://camunda.org/schema/1.0/dmn">
  <!-- Ordered by intent: the first match wins. -->
  <decision id="risk" name="Risk score">
    <decisionTable id="table" hitPolicy="FIRST">
      <input id="in1" label="Amount">
        <inputExpression id="ie1" typeRef="number">
          <text>amount</text>
        </inputExpression>
      </input>
      <output id="out1" label="Risk" name="risk" typeRef="string" />
      <rule id="r1">
        <inputEntry id="ue1"><text>&lt; 100</text></inputEntry>
        <outputEntry id="oe1"><text>"low"</text></outputEntry>
      </rule>
      <rule id="r2">
        <inputEntry id="ue2"><text>&gt;= 100</text></inputEntry>
        <outputEntry id="oe2"><text>"high"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>`

/** Rule ids in the order they are written. */
const ruleOrder = (xml: string): string[] =>
	[...xml.matchAll(/<rule id="([^"]+)"/g)].map((match) => match[1] as string)

const table = (definitions: DmnDefinitions) => {
	const decision = definitions.decisions[0]
	if (decision === undefined) throw new Error("no decision")
	return decision.decisionTable
}

describe("exportDmnPreserving", () => {
	it("returns the file untouched when the model has not changed", () => {
		expect(exportDmnPreserving(XML, parseDmn(XML))).toBe(XML)
	})

	it("keeps a comment a plain write would drop", () => {
		const edited = parseDmn(XML)
		const output = table(edited).outputs[0]
		if (output !== undefined) output.label = "Risk band"

		expect(exportDmnPreserving(XML, edited)).toContain("Ordered by intent")
		expect(serializeDmn(edited)).not.toContain("Ordered by intent")
	})

	it("changes one line to edit one rule", () => {
		const edited = parseDmn(XML)
		const entry = table(edited).rules[1]?.outputEntries[0]
		if (entry !== undefined) entry.text = '"critical"'
		const result = exportDmnPreserving(XML, edited)

		expect(lineDiff(XML, result)).toEqual({ removed: 1, added: 1 })
		expect(result).toContain('"critical"')
		sameAsPlainWrite(result, edited)
	})

	it("follows a reordering of rules, because rule order is the decision", () => {
		// The strategy that keeps the file's own sibling order would undo this
		// edit exactly. Every strategy is checked against a plain write before it
		// is used, and that check is what stops it.
		const edited = parseDmn(XML)
		table(edited).rules.reverse()

		const result = preserveDmnFormatting(XML, serializeDmn(edited))
		expect(ruleOrder(result.xml)).toEqual(["r2", "r1"])
		expect(result.outcome).toBe("reordered")
	})

	it("says what a plain write says, whatever it did to the bytes", () => {
		const edited = parseDmn(XML)
		table(edited).rules.reverse()
		sameAsPlainWrite(exportDmnPreserving(XML, edited), edited)
	})

	it("removes a rule and takes its lines with it", () => {
		const edited = parseDmn(XML)
		const rules = table(edited).rules
		rules.splice(0, 1)
		const result = exportDmnPreserving(XML, edited)

		expect(result).not.toContain(`id="r1"`)
		expect(lineDiff(XML, result).added).toBe(0)
		sameAsPlainWrite(result, edited)
	})

	it("adds a rule without disturbing the ones around it", () => {
		const edited = parseDmn(XML)
		const rules = table(edited).rules
		const template = rules[0]
		if (template !== undefined) {
			rules.push({
				...structuredClone(template),
				id: "r3",
				inputEntries: [{ id: "ue3", text: "> 1000" }],
				outputEntries: [{ id: "oe3", text: '"severe"' }],
			})
		}
		const result = exportDmnPreserving(XML, edited)

		expect(result).toContain(`id="r3"`)
		expect(result).toContain(`<rule id="r1">`)
		expect(lineDiff(XML, result).removed).toBe(0)
		sameAsPlainWrite(result, edited)
	})

	it("falls back to a plain write when the original is not this document", () => {
		const result = preserveDmnFormatting(
			`<?xml version="1.0"?>\n<html><body/></html>`,
			serializeDmn(parseDmn(XML)),
		)
		expect(result.outcome).toBe("rewritten")
	})

	// ── Files as a modeler actually writes them ───────────────────────────────

	describe.each(files)("%s", (name) => {
		const original = read(name)

		/** The same decision, written the other ways a repository might hold it. */
		const variants = {
			"as the modeler writes it": original,
			// Two spaces to tabs, which is the change that used to rewrite the file.
			"tab-indented": original.replace(/^( +)/gm, (run) => "\t".repeat(run.length / 2)),
		}

		describe.each(Object.entries(variants))("%s", (_variant, text) => {
			it("comes back byte for byte when nothing changed", () => {
				expect(exportDmnPreserving(text, parseDmn(text))).toBe(text)
			})

			it("keeps an edit to one rule to one line", () => {
				const edited = parseDmn(text)
				const entry = table(edited).rules[0]?.outputEntries[0]
				if (entry === undefined) return
				entry.text = '"edited by the editor"'
				const result = exportDmnPreserving(text, edited)

				expect(lineDiff(text, result)).toEqual({ removed: 1, added: 1 })
				sameAsPlainWrite(result, edited)
			})

			it("keeps the diagram section a plain write would strip identity from", () => {
				// A `DMNShape` carries an id the model does not, so without pairing an
				// element whose id the update lost, the whole DMNDI block is deleted
				// and written out again on every save.
				const edited = parseDmn(text)
				const entry = table(edited).rules[0]?.outputEntries[0]
				if (entry !== undefined) entry.text = '"edited"'
				const result = exportDmnPreserving(text, edited)

				for (const id of [...text.matchAll(/<dmndi:\w+ id="([^"]+)"/g)]) {
					expect(result).toContain(id[1] as string)
				}
			})
		})
	})
})
