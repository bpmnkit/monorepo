/**
 * Editorial framing for the AI-generation benchmark.
 *
 * The numbers themselves are generated into `../generated/ai-benchmark.ts` by
 * `scripts/bench-ai-generation.mjs`; this file names the strategies, orders the
 * scenarios and derives the ratios the landing page quotes. Nothing here
 * invents a figure — every value is read from the generated dataset.
 */

import { AI_BENCHMARK, type BenchmarkSummary } from "../generated/ai-benchmark.js"

/** The baseline every ratio is measured against: asking the model for raw XML. */
const BASELINE = "without-sdk"

export interface Strategy {
	readonly id: string
	readonly label: string
	/** What the model was actually given, in one line. */
	readonly blurb: string
	/** Whether this is the alternative being compared against. */
	readonly baseline: boolean
}

export const STRATEGIES: readonly Strategy[] = [
	{
		id: "without-sdk",
		label: "Raw BPMN 2.0 XML",
		blurb: "The model writes the XML itself — elements, references and every x/y coordinate.",
		baseline: true,
	},
	{
		id: "with-sdk",
		label: "@bpmnkit/core builder",
		blurb: "The model writes a typed builder chain. The SDK compiles it and lays it out.",
		baseline: false,
	},
	{
		id: "with-sdk-compact",
		label: "BPMN Kit compact notation",
		blurb: "The model writes one line per element. expand() turns it into BPMN, auto-laid-out.",
		baseline: false,
	},
]

export interface Scenario {
	readonly id: string
	readonly label: string
	/** What the prompt asked for, in one line. */
	readonly blurb: string
}

export const SCENARIOS: readonly Scenario[] = [
	{
		id: "loan-approval",
		label: "Loan approval",
		blurb: "REST credit check, a pre-screening gateway, a DMN risk score, manual underwriting.",
	},
	{
		id: "kyc",
		label: "KYC onboarding",
		blurb: "OCR verification with a bounded retry loop, sanctions screening, risk-based routing.",
	},
	{
		id: "quote-to-cash",
		label: "Quote-to-cash",
		blurb:
			"Tiered approvals, e-signature, a multi-instance provisioning subprocess, dunning with timers.",
	},
]

export interface Cell extends BenchmarkSummary {
	readonly seconds: number
	/** Times slower/faster than the raw-XML baseline. 1 for the baseline itself. */
	readonly speedup: number
	/** Baseline output tokens ÷ this strategy's. */
	readonly outputRatio: number | null
	/** Baseline total (input + output) tokens ÷ this strategy's. */
	readonly totalRatio: number | null
}

export interface ScenarioRow {
	readonly scenario: Scenario
	readonly cells: readonly (Cell | null)[]
}

function cell(summary: BenchmarkSummary, base: BenchmarkSummary): Cell {
	return {
		...summary,
		seconds: summary.medianMs / 1000,
		speedup: base.medianMs / summary.medianMs,
		outputRatio:
			base.medianOutputTokens !== null && summary.medianOutputTokens
				? base.medianOutputTokens / summary.medianOutputTokens
				: null,
		totalRatio:
			base.medianTotalTokens !== null && summary.medianTotalTokens
				? base.medianTotalTokens / summary.medianTotalTokens
				: null,
	}
}

/** One row per scenario, cells in `STRATEGIES` order. */
export const ROWS: readonly ScenarioRow[] = SCENARIOS.map((scenario) => {
	const byStrategy = AI_BENCHMARK.byScenario[scenario.id] ?? {}
	const base = byStrategy[BASELINE]
	return {
		scenario,
		cells: STRATEGIES.map((strategy) => {
			const summary = byStrategy[strategy.id]
			return summary && base ? cell(summary, base) : null
		}),
	}
})

function range(values: readonly number[]): { readonly low: number; readonly high: number } {
	return { low: Math.min(...values), high: Math.max(...values) }
}

function cellsFor(strategyId: string): readonly Cell[] {
	const index = STRATEGIES.findIndex((s) => s.id === strategyId)
	return ROWS.map((row) => row.cells[index]).filter((c): c is Cell => c !== null)
}

const compact = cellsFor("with-sdk-compact")

/**
 * Headline figures for the compact path, expressed as the range across the
 * three scenarios rather than a single pooled number — the strategies were not
 * run the same number of times on each scenario, so a pooled median would
 * compare different workloads.
 */
export const HEADLINE = {
	speedup: range(compact.map((c) => c.speedup)),
	outputRatio: range(compact.map((c) => c.outputRatio ?? Number.NaN)),
	totalRatio: range(compact.map((c) => c.totalRatio ?? Number.NaN)),
} as const

/** Produced-and-renderable counts across every recorded run, per strategy. */
export const RELIABILITY = STRATEGIES.flatMap((strategy) => {
	const summary = AI_BENCHMARK.byStrategy[strategy.id]
	return summary ? [{ strategy, ...summary }] : []
})

export const META = AI_BENCHMARK
