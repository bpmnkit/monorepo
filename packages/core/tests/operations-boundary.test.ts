import { describe, expect, it } from "vitest"
import { compactify, expand } from "../src/bpmn/compact.js"
import { applyBpmnOperations, reconcileCompact } from "../src/bpmn/full-operations.js"
import { Bpmn } from "../src/bpmn/index.js"
import { applyOperations } from "../src/bpmn/operations.js"

/**
 * Regression for #183. `applyOperations()` took whatever it was handed. With a
 * non-empty operation list that surfaced as `diagram.processes is not iterable`,
 * naming an internal field rather than the mistake; with an empty one it handed
 * the input straight back, which reads as "the pipeline ran and preserved
 * everything" when nothing ran at all.
 */

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" id="D" targetNamespace="x">
  <bpmn:process id="P" isExecutable="true">
    <bpmn:startEvent id="S" name="Start" />
  </bpmn:process>
</bpmn:definitions>`

describe("compact-diagram boundary", () => {
	it("rejects raw XML instead of returning it unchanged", () => {
		expect(() => applyOperations(XML as never, [])).toThrow(TypeError)
		expect(() => applyOperations(XML as never, [])).toThrow(
			"applyOperations expects a CompactDiagram, received a string. Pass compactify(Bpmn.parse(xml)) if you have raw XML.",
		)
	})

	it("rejects raw XML with a non-empty operation list", () => {
		expect(() => applyOperations(XML as never, [{ op: "rename", id: "S", name: "X" }])).toThrow(
			/expects a CompactDiagram, received a string/,
		)
	})

	it("names the half-done conversion when given a parsed model", () => {
		expect(() => applyOperations(Bpmn.parse(XML) as never, [])).toThrow(
			"applyOperations expects a CompactDiagram, received a BpmnDefinitions. Pass compactify(defs).",
		)
	})

	it.each([
		["null", null],
		["undefined", undefined],
		["an array", []],
		["a number", 7],
	])("rejects %s", (received, value) => {
		expect(() => applyOperations(value as never, [])).toThrow(
			`applyOperations expects a CompactDiagram, received ${received}.`,
		)
	})

	it("rejects an object whose processes are not compact processes", () => {
		expect(() => applyOperations({ id: "d", processes: [{ id: "p" }] } as never, [])).toThrow(
			"applyOperations expects a CompactDiagram, received one whose processes[0] has no elements and flows arrays.",
		)
	})

	it("guards expand() and reconcileCompact() the same way", () => {
		expect(() => expand(XML as never)).toThrow(/^expand expects a CompactDiagram/)
		expect(() => reconcileCompact(Bpmn.parse(XML), XML as never)).toThrow(
			/^reconcileCompact expects a CompactDiagram/,
		)
	})

	it("still accepts a real compact diagram, empty processes included", () => {
		const compact = compactify(Bpmn.parse(XML))
		expect(applyOperations(compact, [{ op: "rename", id: "S", name: "Begin" }])).toEqual({
			...compact,
			processes: [
				{ ...compact.processes[0], elements: [{ id: "S", type: "startEvent", name: "Begin" }] },
			],
		})
		expect(() => expand({ id: "d", processes: [] })).not.toThrow()
	})
})

describe("bpmn-definitions boundary", () => {
	it("rejects raw XML with the parse it is missing", () => {
		expect(() => compactify(XML as never)).toThrow(
			"compactify expects a BpmnDefinitions, received a string. Pass Bpmn.parse(xml) if you have raw XML.",
		)
	})

	it("rejects a compact diagram where a parsed model belongs", () => {
		const compact = compactify(Bpmn.parse(XML))
		expect(() => applyBpmnOperations(compact as never, [])).toThrow(
			"applyBpmnOperations expects a BpmnDefinitions, received a CompactDiagram. Pass the parsed model, not the compact projection.",
		)
		expect(() => reconcileCompact(compact as never, compact)).toThrow(
			/^reconcileCompact expects a BpmnDefinitions/,
		)
	})

	it("still accepts a real parsed model", () => {
		const definitions = Bpmn.parse(XML)
		expect(applyBpmnOperations(definitions, []).applied).toBe(0)
		expect(compactify(definitions).processes).toHaveLength(1)
	})
})
