import { describe, expect, it } from "vitest"
import type { FormDefinition } from "../src/form/form-model.js"
import { parseForm } from "../src/form/form-parser.js"
import { exportForm } from "../src/form/form-serializer.js"
import { exportFormPreserving, preserveFormFormatting } from "../src/form/preserving-writer.js"

/**
 * A form as the Camunda modeler writes one: components first, metadata last,
 * two-space indentation, trailing newline. None of that is what `exportForm`
 * produces, which is the whole problem.
 */
const FORM = `{
  "components": [
    {
      "label": "Reason for approval",
      "type": "textfield",
      "layout": {
        "row": "Row_0abc123",
        "columns": null
      },
      "id": "Field_reason",
      "key": "reason",
      "validate": {
        "required": true
      }
    },
    {
      "label": "Amount",
      "type": "number",
      "layout": {
        "row": "Row_0def456",
        "columns": null
      },
      "id": "Field_amount",
      "key": "amount"
    }
  ],
  "type": "default",
  "id": "approval-form",
  "executionPlatform": "Camunda Cloud",
  "executionPlatformVersion": "8.6.0",
  "exporter": {
    "name": "Camunda Modeler",
    "version": "5.28.0"
  },
  "schemaVersion": 17
}
`

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
function sameAsPlainWrite(result: string, form: FormDefinition): void {
	expect(JSON.parse(result)).toEqual(JSON.parse(exportForm(form)))
}

const model = (): FormDefinition => parseForm(FORM)

/** The same form, written the other ways a repository might hold it. */
const variants = {
	"as the modeler writes it": FORM,
	"tab-indented": `${JSON.stringify(JSON.parse(FORM), null, "\t")}\n`,
	"four spaces": `${JSON.stringify(JSON.parse(FORM), null, 4)}\n`,
	minified: JSON.stringify(JSON.parse(FORM)),
}

describe("exportFormPreserving", () => {
	it("returns the file untouched when the form has not changed", () => {
		expect(exportFormPreserving(FORM, model())).toBe(FORM)
	})

	it("keeps the file's key order, which a plain write does not", () => {
		// `exportForm` writes metadata first and `type` last; the modeler writes
		// components first and metadata last. Nothing about either is meaningful.
		expect(exportFormPreserving(FORM, model()).indexOf(`"components"`)).toBeLessThan(
			exportFormPreserving(FORM, model()).indexOf(`"schemaVersion"`),
		)
		expect(exportForm(model()).indexOf(`"components"`)).toBeGreaterThan(
			exportForm(model()).indexOf(`"schemaVersion"`),
		)
	})

	it("changes one line to relabel one field", () => {
		const edited = model()
		const field = edited.components[0]
		if (field !== undefined) field.label = "Why are you approving this?"
		const result = exportFormPreserving(FORM, edited)

		expect(lineDiff(FORM, result)).toEqual({ removed: 1, added: 1 })
		expect(result).toContain(`"label": "Why are you approving this?"`)
		sameAsPlainWrite(result, edited)
	})

	it("keeps the trailing newline", () => {
		const edited = model()
		const field = edited.components[0]
		if (field !== undefined) field.label = "Changed"
		expect(exportFormPreserving(FORM, edited).endsWith("}\n")).toBe(true)
		expect(exportForm(edited).endsWith("}\n")).toBe(false)
	})

	it("removes a field and takes its lines with it", () => {
		const edited = model()
		edited.components = edited.components.filter((c) => c.id !== "Field_amount")
		const result = exportFormPreserving(FORM, edited)

		expect(result).not.toContain("Field_amount")
		expect(lineDiff(FORM, result).added).toBe(0)
		sameAsPlainWrite(result, edited)
	})

	it("adds a field without disturbing the one already there", () => {
		const edited = model()
		const template = edited.components[1]
		if (template !== undefined) {
			edited.components.push({
				...structuredClone(template),
				id: "Field_note",
				key: "note",
				label: "Note",
				type: "textfield",
			} as never)
		}
		const result = exportFormPreserving(FORM, edited)

		expect(result).toContain("Field_note")
		expect(result).toContain(`"label": "Reason for approval"`)
		expect(lineDiff(FORM, result).removed).toBe(0)
		sameAsPlainWrite(result, edited)
	})

	it("follows a reordering of fields, because a form's order is its order", () => {
		const edited = model()
		edited.components.reverse()
		const result = exportFormPreserving(FORM, edited)

		expect(result.indexOf("Field_amount")).toBeLessThan(result.indexOf("Field_reason"))
		sameAsPlainWrite(result, edited)
	})

	it("falls back to a plain write when the original is not a form", () => {
		const result = preserveFormFormatting("not json at all", exportForm(model()))
		expect(result.outcome).toBe("rewritten")
		expect(result.json).toBe(exportForm(model()))
	})

	// ── However the file happens to be written ────────────────────────────────

	describe.each(Object.entries(variants))("%s", (_name, text) => {
		it("comes back byte for byte when nothing changed", () => {
			expect(exportFormPreserving(text, parseForm(text))).toBe(text)
		})

		it("says exactly what a plain write says", () => {
			const edited = parseForm(text)
			const field = edited.components[0]
			if (field !== undefined) field.label = "Renamed by the editor"
			sameAsPlainWrite(exportFormPreserving(text, edited), edited)
		})

		it("keeps a relabel to the line the label is on", () => {
			const edited = parseForm(text)
			const field = edited.components[0]
			if (field !== undefined) field.label = "Renamed by the editor"
			// One line, on every one of them — including the minified file, where
			// the one line is the whole document.
			expect(lineDiff(text, exportFormPreserving(text, edited))).toEqual({
				removed: 1,
				added: 1,
			})
		})
	})
})
