import type { DmnDecision } from "@bpmnkit/core"
import { describe, expect, it } from "vitest"
import { evaluateDecision } from "../src/dmn.js"

function makeDecision(
	hitPolicy: import("@bpmnkit/core").HitPolicy,
	inputs: { label: string; expression: string }[],
	outputs: { name: string }[],
	rules: { inputEntries: string[]; outputEntries: string[] }[],
	aggregation?: import("@bpmnkit/core").DmnAggregation,
): DmnDecision {
	return {
		id: "Decision_1",
		decisionTable: {
			id: "Table_1",
			hitPolicy,
			aggregation,
			inputs: inputs.map((inp, i) => ({
				id: `Input_${i}`,
				label: inp.label,
				inputExpression: { id: `InputExpr_${i}`, text: inp.expression },
			})),
			outputs: outputs.map((out, i) => ({
				id: `Output_${i}`,
				name: out.name,
			})),
			rules: rules.map((r, i) => ({
				id: `Rule_${i}`,
				inputEntries: r.inputEntries.map((t, j) => ({ id: `IE_${i}_${j}`, text: t })),
				outputEntries: r.outputEntries.map((t, j) => ({ id: `OE_${i}_${j}`, text: t })),
			})),
		},
		informationRequirements: [],
		knowledgeRequirements: [],
		authorityRequirements: [],
	}
}

describe("evaluateDecision", () => {
	it("UNIQUE — returns first match (single output)", () => {
		const d = makeDecision(
			"UNIQUE",
			[{ label: "age", expression: "age" }],
			[{ name: "category" }],
			[
				{ inputEntries: ["< 18"], outputEntries: ['"minor"'] },
				{ inputEntries: [">= 18"], outputEntries: ['"adult"'] },
			],
		)
		expect(evaluateDecision(d, { age: 25 })).toBe("adult")
		expect(evaluateDecision(d, { age: 12 })).toBe("minor")
	})

	it("UNIQUE — returns null when no rule matches", () => {
		const d = makeDecision(
			"UNIQUE",
			[{ label: "x", expression: "x" }],
			[{ name: "out" }],
			[{ inputEntries: ["1"], outputEntries: ['"one"'] }],
		)
		expect(evaluateDecision(d, { x: 99 })).toBeNull()
	})

	it("FIRST — stops at first match", () => {
		const d = makeDecision(
			"FIRST",
			[{ label: "x", expression: "x" }],
			[{ name: "out" }],
			[
				{ inputEntries: ["> 0"], outputEntries: ['"positive"'] },
				{ inputEntries: ["> 5"], outputEntries: ['"big"'] },
			],
		)
		expect(evaluateDecision(d, { x: 10 })).toBe("positive")
	})

	it("COLLECT SUM aggregation", () => {
		const d = makeDecision(
			"COLLECT",
			[{ label: "category", expression: "category" }],
			[{ name: "discount" }],
			[
				{ inputEntries: ['"A"'], outputEntries: ["10"] },
				{ inputEntries: ['"A"'], outputEntries: ["5"] },
			],
			"SUM",
		)
		expect(evaluateDecision(d, { category: "A" })).toBe(15)
	})

	it("COLLECT COUNT aggregation", () => {
		const d = makeDecision(
			"COLLECT",
			[{ label: "v", expression: "v" }],
			[{ name: "n" }],
			[
				{ inputEntries: ["> 0"], outputEntries: ["1"] },
				{ inputEntries: ["> 0"], outputEntries: ["1"] },
				{ inputEntries: ["> 0"], outputEntries: ["1"] },
			],
			"COUNT",
		)
		expect(evaluateDecision(d, { v: 5 })).toBe(3)
	})

	it("RULE ORDER — returns list of matches", () => {
		const d = makeDecision(
			"RULE ORDER",
			[{ label: "x", expression: "x" }],
			[{ name: "out" }],
			[
				{ inputEntries: ["> 0"], outputEntries: ['"pos"'] },
				{ inputEntries: ["> 10"], outputEntries: ['"big"'] },
			],
		)
		expect(evaluateDecision(d, { x: 20 })).toEqual(["pos", "big"])
	})

	it("empty input entry matches any value", () => {
		const d = makeDecision(
			"UNIQUE",
			[{ label: "x", expression: "x" }],
			[{ name: "out" }],
			[{ inputEntries: [""], outputEntries: ['"always"'] }],
		)
		expect(evaluateDecision(d, { x: "anything" })).toBe("always")
	})

	it("returns null when decisionTable is undefined", () => {
		const d: DmnDecision = {
			id: "d",
			informationRequirements: [],
			knowledgeRequirements: [],
			authorityRequirements: [],
		}
		expect(evaluateDecision(d, {})).toBeNull()
	})
})
