import { readFileSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { BpmnDefinitions } from "../src/bpmn/bpmn-model.js"
import { parseBpmn } from "../src/bpmn/bpmn-parser.js"
import { serializeBpmn } from "../src/bpmn/bpmn-serializer.js"
import { exportPreserving, exportPreservingResult } from "../src/bpmn/preserving-writer.js"

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "roundtrip")
const files = readdirSync(FIXTURES).filter((name) => name.endsWith(".bpmn"))

const read = (name: string): string => readFileSync(join(FIXTURES, name), "utf8")

/**
 * Lines removed and added between two documents.
 *
 * A real diff, not a line-by-line comparison: deleting five lines shifts
 * everything after them, and counting those as changes would report a minimal
 * edit as a rewrite.
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
function sameAsPlainWrite(result: string, definitions: BpmnDefinitions): void {
	expect(JSON.parse(JSON.stringify(parseBpmn(result)))).toEqual(
		JSON.parse(JSON.stringify(parseBpmn(serializeBpmn(definitions)))),
	)
}

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <!-- The comment a generator would throw away. -->
  <bpmn:process id="proc" name="Orders" isExecutable="false">
    <bpmn:startEvent id="start" name="Ordered" />
    <bpmn:serviceTask id="ship" name="Ship" />
    <bpmn:endEvent id="end" name="Done" />
    <bpmn:sequenceFlow id="f1" sourceRef="start" targetRef="ship" />
    <bpmn:sequenceFlow id="f2" sourceRef="ship" targetRef="end" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="d1"><bpmndi:BPMNPlane id="p1" bpmnElement="proc">
    <bpmndi:BPMNShape id="s1" bpmnElement="start"><dc:Bounds x="100" y="80" width="36" height="36" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s2" bpmnElement="ship"><dc:Bounds x="200" y="60" width="100" height="80" /></bpmndi:BPMNShape>
    <bpmndi:BPMNShape id="s3" bpmnElement="end"><dc:Bounds x="360" y="80" width="36" height="36" /></bpmndi:BPMNShape>
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>`

/** The model `XML` holds, ready to be edited by a test. */
const model = (): BpmnDefinitions => parseBpmn(XML)

const taskNamed = (definitions: BpmnDefinitions, id: string): { name?: string } =>
	(definitions.processes[0]?.flowElements ?? []).find((e) => e.id === id) as { name?: string }

describe("exportPreserving", () => {
	it("returns the file untouched when the model has not changed", () => {
		expect(exportPreserving(XML, model())).toBe(XML)
	})

	it("changes one line to rename one element", () => {
		const edited = model()
		taskNamed(edited, "ship").name = "Dispatch"
		const result = exportPreserving(XML, edited)

		expect(lineDiff(XML, result)).toEqual({ removed: 1, added: 1 })
		expect(result).toContain(`<bpmn:serviceTask id="ship" name="Dispatch" />`)
		sameAsPlainWrite(result, edited)
	})

	it("changes one line to move one shape", () => {
		const edited = model()
		const shape = edited.diagrams[0]?.plane.shapes.find((s) => s.bpmnElement === "ship")
		if (shape !== undefined) shape.bounds.y += 40
		const result = exportPreserving(XML, edited)

		expect(lineDiff(XML, result)).toEqual({ removed: 1, added: 1 })
		expect(result).toContain(`y="100"`)
		sameAsPlainWrite(result, edited)
	})

	it("keeps a comment a plain write would drop", () => {
		const edited = model()
		taskNamed(edited, "ship").name = "Dispatch"
		expect(exportPreserving(XML, edited)).toContain("The comment a generator would throw away.")
		expect(serializeBpmn(edited)).not.toContain("The comment a generator would throw away.")
	})

	it("keeps an attribute the serializer omits as a default", () => {
		// `isExecutable="false"` is what the file says out loud; the writer drops
		// it because false is the default, and the file comes back changed for
		// nothing.
		expect(exportPreserving(XML, model())).toContain(`isExecutable="false"`)
	})

	it("still removes an attribute the user actually removed", () => {
		// The rung that keeps dropped attributes must not keep one the edit meant
		// to delete. The check against a plain write is what catches it.
		const edited = model()
		taskNamed(edited, "ship").name = undefined
		const result = exportPreserving(XML, edited)

		expect(result).not.toContain(`name="Ship"`)
		sameAsPlainWrite(result, edited)
	})

	it("keeps the file's own order for children the model cannot order", () => {
		// A process holds flow elements and sequence flows in separate lists, so
		// every plain write emits all of one then all of the other — reshuffling
		// any file that interleaved them.
		const interleaved = XML.replace(
			`    <bpmn:endEvent id="end" name="Done" />\n`,
			`    <bpmn:sequenceFlow id="f0" sourceRef="start" targetRef="end" />\n    <bpmn:endEvent id="end" name="Done" />\n`,
		)
		const edited = parseBpmn(interleaved)
		taskNamed(edited, "ship").name = "Dispatch"
		const result = exportPreserving(interleaved, edited)

		expect(lineDiff(interleaved, result)).toEqual({ removed: 1, added: 1 })
		sameAsPlainWrite(result, edited)
	})

	it("reports which strategy it used", () => {
		expect(exportPreservingResult(XML, model()).outcome).toBe("preserved")
	})

	it("falls back to a plain write when the original is not this document", () => {
		const other = `<?xml version="1.0"?>\n<html><body/></html>`
		const result = exportPreservingResult(other, model())
		expect(result.outcome).toBe("rewritten")
		expect(result.xml).toBe(serializeBpmn(model()))
	})

	it("falls back to a plain write when the original will not parse", () => {
		const result = exportPreservingResult("<bpmn:definitions", model())
		expect(result.outcome).toBe("rewritten")
		expect(result.xml).toBe(serializeBpmn(model()))
	})

	// ── Adding and removing ───────────────────────────────────────────────────

	it("adds an element without disturbing the ones around it", () => {
		const edited = model()
		const process = edited.processes[0]
		const template = process?.flowElements.find((e) => e.id === "ship")
		if (process !== undefined && template !== undefined) {
			process.flowElements.push({
				...structuredClone(template),
				id: "review",
				type: "userTask",
				name: "Review",
			} as never)
		}
		const result = exportPreserving(XML, edited)

		expect(result).toContain(`id="review"`)
		expect(result).toContain(`<bpmn:startEvent id="start" name="Ordered" />`)
		// Nothing is removed to add something: the file grows by the new element.
		expect(lineDiff(XML, result).removed).toBe(0)
		sameAsPlainWrite(result, edited)
	})

	it("removes an element and takes its line with it", () => {
		const edited = model()
		const process = edited.processes[0]
		if (process !== undefined) {
			process.flowElements = process.flowElements.filter((e) => e.id !== "ship")
			process.sequenceFlows = process.sequenceFlows.filter(
				(f) => f.sourceRef !== "ship" && f.targetRef !== "ship",
			)
		}
		const diagram = edited.diagrams[0]
		if (diagram !== undefined) {
			diagram.plane.shapes = diagram.plane.shapes.filter((s) => s.bpmnElement !== "ship")
		}
		const result = exportPreserving(XML, edited)

		expect(result).not.toContain(`id="ship"`)
		expect(result).toContain(`<bpmn:startEvent id="start" name="Ordered" />`)
		// Nothing is added to remove something, and the lines that go are the
		// element's own — the task, its two flows and its shape.
		expect(lineDiff(XML, result)).toEqual({ removed: 4, added: 0 })
		sameAsPlainWrite(result, edited)
	})

	// ── The invariant, over every fixture ─────────────────────────────────────

	describe.each(files)("%s", (name) => {
		it("comes back byte for byte when nothing changed", () => {
			const original = read(name)
			expect(exportPreserving(original, parseBpmn(original))).toBe(original)
		})

		it("says exactly what a plain write says, whatever it did to the bytes", () => {
			const original = read(name)
			const edited = parseBpmn(original)
			const first = edited.processes[0]?.flowElements[0]
			if (first !== undefined) first.name = "Renamed by an editor"
			const result = exportPreserving(original, edited)
			sameAsPlainWrite(result, edited)
		})

		it("keeps a rename to a single line", () => {
			const original = read(name)
			const edited = parseBpmn(original)
			const first = edited.processes[0]?.flowElements[0]
			if (first === undefined) return
			first.name = "Renamed by an editor"
			expect(lineDiff(original, exportPreserving(original, edited))).toEqual({
				removed: 1,
				added: 1,
			})
		})
	})
})
