import { Dmn } from "@bpmnkit/core"
import type { DmnDecisionTable } from "@bpmnkit/core"
import type { RenderOptions } from "./types.js"

// ── Box-drawing characters ───────────────────────────────────────────────────

const H = "═"
const V = "║"
const TL = "╔"
const TR = "╗"
const BL = "╚"
const BR = "╝"
const TM = "╦"
const BM = "╩"
const LM = "╠"
const RM = "╣"
const MM = "╬"

// ── Helpers ──────────────────────────────────────────────────────────────────

function pad(s: string, w: number): string {
	return s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length)
}

function repeat(ch: string, n: number): string {
	return n <= 0 ? "" : ch.repeat(n)
}

// ── Decision table renderer ──────────────────────────────────────────────────

function renderTable(name: string | undefined, table: DmnDecisionTable): string {
	const { hitPolicy, aggregation, inputs, outputs, rules } = table

	// Column widths: pad each column to at least the header label width
	const numW = Math.max(1, String(rules.length).length)

	const inputWidths = inputs.map((inp, i) => {
		const headerW = (inp.label ?? inp.inputExpression.text ?? `In${i}`).length
		const entryW = rules.reduce((m, r) => {
			const t = r.inputEntries[i]?.text ?? ""
			return Math.max(m, t.length)
		}, 0)
		return Math.max(headerW, entryW, 4)
	})

	const outputWidths = outputs.map((out, i) => {
		const headerW = (out.label ?? out.name ?? `Out${i}`).length
		const entryW = rules.reduce((m, r) => {
			const t = r.outputEntries[i]?.text ?? ""
			return Math.max(m, t.length)
		}, 0)
		return Math.max(headerW, entryW, 4)
	})

	// Hit policy label for the # column header cell
	const policy = hitPolicy ?? "UNIQUE"
	const policyLabel = aggregation ? `${policy}(${aggregation[0]})` : policy
	const numHeader = pad(policyLabel, numW)

	// Build column separators
	const numBar = repeat(H, numW + 2)
	const inputBars = inputWidths.map((w) => repeat(H, w + 2))
	const outputBars = outputWidths.map((w) => repeat(H, w + 2))

	const allBars = [numBar, ...inputBars, ...outputBars]

	function topRow(): string {
		return TL + allBars.join(TM) + TR
	}
	function midRow(): string {
		return LM + allBars.join(MM) + RM
	}
	function botRow(): string {
		return BL + allBars.join(BM) + BR
	}
	function cell(s: string, w: number): string {
		return ` ${pad(s, w)} `
	}

	const lines: string[] = []

	// Header above the table
	const tableTitle = name ? `${name}` : "Decision"
	const hitLine = ` [${policy}${aggregation ? `/${aggregation}` : ""}]`
	lines.push(tableTitle + hitLine)
	lines.push("─".repeat(tableTitle.length + hitLine.length))
	lines.push("")

	// Top border
	lines.push(topRow())

	// Column headers
	const headerCells = [
		cell(numHeader, numW),
		...inputs.map((inp, i) =>
			cell(inp.label ?? inp.inputExpression.text ?? `In${i}`, inputWidths[i] ?? 0),
		),
		...outputs.map((out, i) => cell(out.label ?? out.name ?? `Out${i}`, outputWidths[i] ?? 0)),
	]
	lines.push(V + headerCells.join(V) + V)

	// Separator
	lines.push(midRow())

	// Rules
	if (rules.length === 0) {
		const emptyW = allBars.reduce((s, b) => s + b.length, 0) + allBars.length - 1
		lines.push(`${V} ${pad("(no rules)", emptyW)} ${V}`)
	} else {
		for (let r = 0; r < rules.length; r++) {
			const rule = rules[r]
			if (!rule) continue
			const ruleCells = [
				cell(String(r + 1), numW),
				...inputs.map((_, i) => cell(rule.inputEntries[i]?.text ?? "", inputWidths[i] ?? 0)),
				...outputs.map((_, i) => cell(rule.outputEntries[i]?.text ?? "", outputWidths[i] ?? 0)),
			]
			lines.push(V + ruleCells.join(V) + V)
		}
	}

	// Bottom border
	lines.push(botRow())

	return lines.join("\n")
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a DMN XML string as ASCII art.
 *
 * Each decision with a decision table is rendered as a labeled table with
 * box-drawing characters. Multiple decisions are separated by a blank line.
 */
export function renderDmnAscii(xml: string, options?: RenderOptions): string {
	const defs = Dmn.parse(xml)

	const decisions = defs.decisions.filter((d) => d.decisionTable)
	if (decisions.length === 0) return "(no decision tables)"

	const blocks = decisions.map((d) => renderTable(d.name, d.decisionTable as DmnDecisionTable))

	const body = blocks.join("\n\n")

	const title = resolveTitle(options, defs.name)
	if (!title) return body

	const line = "─".repeat(title.length)
	return `${title}\n${line}\n\n${body}`
}

function resolveTitle(
	options: RenderOptions | undefined,
	definitionsName: string | undefined,
): string | undefined {
	if (options?.title === false) return undefined
	if (typeof options?.title === "string") return options.title
	return definitionsName ?? undefined
}
