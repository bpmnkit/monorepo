import { describe, expect, it } from "vitest"
import { parseDmn } from "../src/dmn/dmn-parser.js"
import { serializeDmn } from "../src/dmn/dmn-serializer.js"
import { exportDmnPreserving, preserveDmnFormatting } from "../src/dmn/preserving-writer.js"

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

describe("exportDmnPreserving", () => {
	it("returns the file untouched when the model has not changed", () => {
		expect(exportDmnPreserving(XML, parseDmn(XML))).toBe(XML)
	})

	it("keeps a comment a plain write would drop", () => {
		const edited = parseDmn(XML)
		const output = edited.decisions[0]?.decisionTable.outputs[0]
		if (output !== undefined) output.label = "Risk band"

		expect(exportDmnPreserving(XML, edited)).toContain("Ordered by intent")
		expect(serializeDmn(edited)).not.toContain("Ordered by intent")
	})

	it("changes one line to edit one rule", () => {
		const edited = parseDmn(XML)
		const entry = edited.decisions[0]?.decisionTable.rules[1]?.outputEntries[0]
		if (entry !== undefined) entry.text = '"critical"'
		const result = exportDmnPreserving(XML, edited)

		const before = XML.split("\n")
		const after = result.split("\n")
		const changed = after.filter((line, index) => line !== before[index]).length
		expect(changed).toBe(1)
		expect(result).toContain('"critical"')
	})

	it("follows a reordering of rules, because rule order is the decision", () => {
		// The strategy that keeps the file's own sibling order would undo this
		// edit exactly. Every strategy is checked against a plain write before it
		// is used, and that check is what stops it.
		const edited = parseDmn(XML)
		const rules = edited.decisions[0]?.decisionTable.rules
		if (rules !== undefined) rules.reverse()

		const result = preserveDmnFormatting(XML, serializeDmn(edited))
		expect(ruleOrder(result.xml)).toEqual(["r2", "r1"])
		expect(result.outcome).toBe("reordered")
	})

	it("says what a plain write says, whatever it did to the bytes", () => {
		const edited = parseDmn(XML)
		const rules = edited.decisions[0]?.decisionTable.rules
		if (rules !== undefined) rules.reverse()
		const result = exportDmnPreserving(XML, edited)
		expect(parseDmn(result)).toEqual(parseDmn(serializeDmn(edited)))
	})
})
