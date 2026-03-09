import type { DmnAggregation, DmnDecision, DmnInput, HitPolicy } from "@bpmn-sdk/core"
import { evaluate, evaluateUnaryTests, parseExpression, parseUnaryTests } from "@bpmn-sdk/feel"
import type { FeelValue } from "@bpmn-sdk/feel"

/**
 * Evaluate a DMN decision table against the provided variables.
 * Returns the result per the table's hit policy.
 */
export function evaluateDecision(decision: DmnDecision, vars: Record<string, unknown>): unknown {
	const table = decision.decisionTable
	if (table === undefined) return null

	const hitPolicy: HitPolicy = table.hitPolicy ?? "UNIQUE"
	const matchedOutputs: Record<string, unknown>[] = []

	for (const rule of table.rules) {
		if (ruleMatches(table.inputs, rule.inputEntries, vars)) {
			const output: Record<string, unknown> = {}
			for (let i = 0; i < table.outputs.length; i++) {
				const col = table.outputs[i]
				const entry = rule.outputEntries[i]
				if (col === undefined || entry === undefined) continue
				const colName = col.name ?? col.label ?? col.id
				output[colName] = evalOutputEntry(entry.text, vars)
			}
			matchedOutputs.push(output)
			if (hitPolicy === "FIRST") break
		}
	}

	return buildResult(hitPolicy, table.aggregation, matchedOutputs, table.outputs.length)
}

function ruleMatches(
	inputs: DmnInput[],
	inputEntries: { id: string; text: string }[],
	vars: Record<string, unknown>,
): boolean {
	const feelVars = vars as Record<string, FeelValue>
	for (let i = 0; i < inputs.length; i++) {
		const col = inputs[i]
		const entry = inputEntries[i]
		if (col === undefined || entry === undefined) continue
		if (entry.text.trim() === "") continue // empty = "any"
		const inputExpr = col.inputExpression.text ?? ""
		const inputValue =
			inputExpr.trim() === "" ? null : (evalExpression(inputExpr, vars) as FeelValue)
		const parsed = parseUnaryTests(entry.text)
		if (parsed.ast === null) continue
		if (!evaluateUnaryTests(parsed.ast, inputValue, { vars: feelVars })) return false
	}
	return true
}

function evalExpression(expr: string, vars: Record<string, unknown>): unknown {
	const parsed = parseExpression(expr.trim())
	if (parsed.ast === null) return undefined
	return evaluate(parsed.ast, { vars: vars as Record<string, FeelValue> })
}

function evalOutputEntry(text: string, vars: Record<string, unknown>): unknown {
	if (text.trim() === "") return null
	return evalExpression(text, vars)
}

function buildResult(
	hitPolicy: HitPolicy,
	aggregation: DmnAggregation | undefined,
	rows: Record<string, unknown>[],
	outputCount: number,
): unknown {
	if (rows.length === 0) return null
	const singleOutput = outputCount === 1

	switch (hitPolicy) {
		case "UNIQUE":
		case "FIRST":
		case "ANY": {
			const row = rows[0]
			if (row === undefined) return null
			return singleOutput ? firstValue(row) : row
		}
		case "RULE ORDER":
		case "OUTPUT ORDER":
		case "PRIORITY": {
			if (singleOutput) return rows.map(firstValue)
			return rows
		}
		case "COLLECT": {
			if (aggregation === undefined) {
				if (singleOutput) return rows.map(firstValue)
				return rows
			}
			const values = rows.map(firstValue).filter((v): v is number => typeof v === "number")
			return aggregate(aggregation, values)
		}
		default:
			return null
	}
}

function firstValue(row: Record<string, unknown>): unknown {
	for (const k of Object.keys(row)) {
		return row[k]
	}
	return null
}

function aggregate(op: DmnAggregation, values: number[]): number | null {
	if (values.length === 0) return null
	switch (op) {
		case "SUM":
			return values.reduce((a, b) => a + b, 0)
		case "MIN":
			return Math.min(...values)
		case "MAX":
			return Math.max(...values)
		case "COUNT":
			return values.length
		default:
			return null
	}
}
