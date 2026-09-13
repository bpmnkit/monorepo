#!/usr/bin/env node
/**
 * bench-ai-generation — score recorded LLM BPMN-generation runs
 *
 * Usage:  node scripts/bench-ai-generation.mjs [--out <file>] [--print]
 *
 * Reads the recordings in `apps/demo/recordings/` — real streamed runs of the
 * same prompt against three generation strategies — and scores each resulting
 * diagram with `@bpmnkit/core` itself: does it parse, is its diagram
 * interchange complete, how many lint errors does it carry.
 *
 * The reduced result is written to `apps/landing/src/generated/ai-benchmark.ts`,
 * which the landing page reads. Recordings carry the full token stream (~1.4 MB),
 * so the page gets this summary rather than importing them.
 *
 * This is a point-in-time measurement, not a live fact, so it is generated on
 * demand rather than on every build: re-run it when recordings are added.
 *
 * Requires a build: `pnpm turbo build --filter @bpmnkit/core`.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Bpmn, checkDiCompleteness, lintDiagram } from "../packages/core/dist/index.js"

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)))
const RECORDINGS = join(ROOT, "apps/demo/recordings")
const DEFAULT_OUT = join(ROOT, "apps/landing/src/generated/ai-benchmark.ts")

/** The three strategies, in the order the page presents them. */
const STRATEGIES = ["without-sdk", "with-sdk", "with-sdk-compact"]

/** Scenario ids in ascending order of process complexity. */
const SCENARIOS = ["loan-approval", "kyc", "quote-to-cash"]

const args = process.argv.slice(2)
const outArg = args.indexOf("--out")
const out = outArg !== -1 ? resolve(args[outArg + 1]) : DEFAULT_OUT

/**
 * The model every recording was produced with. Recorded out of band — the
 * recordings predate the panel storing it, and a benchmark that does not name
 * its model is not a benchmark.
 */
const MODEL = "claude-opus-4-8"

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Scores one panel's output.
 *
 * A run is `usable` only if it produced XML, that XML parses, and its diagram
 * interchange is complete — a process whose elements have no shape cannot be
 * opened in a modeler, whatever else is right about it.
 */
function score(panel) {
	const run = {
		ms: panel.durationMs,
		inputTokens: panel.usage?.inputTokens ?? null,
		outputTokens: panel.usage?.outputTokens ?? null,
		produced: panel.result.type === "bpmn",
		parsed: false,
		diComplete: false,
		missingShapes: null,
		missingEdges: null,
		lintErrors: null,
		elements: null,
	}
	if (panel.result.type !== "bpmn") return run

	let defs
	try {
		defs = Bpmn.parse(panel.result.xml)
	} catch {
		return run
	}
	run.parsed = true

	const di = checkDiCompleteness(defs)
	run.missingShapes = di.missingShapes.length
	run.missingEdges = di.missingEdges.length
	run.diComplete = di.missingShapes.length === 0 && di.missingEdges.length === 0

	// Engine rules are forced on: every scenario prompt asks for Camunda 8, so
	// deployability findings are ones the author did sign up for.
	run.lintErrors = lintDiagram(defs, { forceEngineRules: true }).counts.error ?? 0

	let elements = 0
	const walk = (list) => {
		for (const el of list) {
			elements++
			if (el.flowElements?.length) walk(el.flowElements)
		}
	}
	for (const process of defs.processes) walk(process.flowElements)
	run.elements = elements

	return run
}

// ── Collect ───────────────────────────────────────────────────────────────────

const runs = []
const recordedAt = []
for (const file of readdirSync(RECORDINGS)
	.filter((f) => f.endsWith(".json"))
	.sort()) {
	const recording = JSON.parse(readFileSync(join(RECORDINGS, file), "utf8"))
	recordedAt.push(recording.recordedAt)
	// The earliest recordings predate `scenarioId`; their filename carries it.
	const scenario = recording.scenarioId ?? file.replace(/-\d{4}-\d{2}-\d{2}[a-z]?\.json$/, "")
	for (const strategy of STRATEGIES) {
		const panel = recording.panels[strategy]
		if (!panel) continue
		runs.push({ recording: file.replace(/\.json$/, ""), scenario, strategy, ...score(panel) })
	}
}

// ── Aggregate ─────────────────────────────────────────────────────────────────

function median(values) {
	const sorted = [...values].sort((a, b) => a - b)
	const mid = sorted.length / 2
	return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Medians rather than means: run counts per cell are small and uneven, and one
 * 364-second outlier should not become the headline.
 */
function summarise(subset) {
	const outputTokens = subset.map((r) => r.outputTokens).filter((t) => t !== null)
	const inputTokens = subset.map((r) => r.inputTokens).filter((t) => t !== null)
	return {
		runs: subset.length,
		medianMs: median(subset.map((r) => r.ms)),
		medianOutputTokens: outputTokens.length ? median(outputTokens) : null,
		medianInputTokens: inputTokens.length ? median(inputTokens) : null,
		medianTotalTokens: (() => {
			const totals = subset
				.filter((r) => r.inputTokens !== null && r.outputTokens !== null)
				.map((r) => r.inputTokens + r.outputTokens)
			return totals.length ? median(totals) : null
		})(),
		produced: subset.filter((r) => r.produced).length,
		usable: subset.filter((r) => r.produced && r.parsed && r.diComplete).length,
		medianElements: (() => {
			const els = subset.map((r) => r.elements).filter((e) => e !== null)
			return els.length ? median(els) : null
		})(),
	}
}

const byStrategy = {}
for (const strategy of STRATEGIES)
	byStrategy[strategy] = summarise(runs.filter((r) => r.strategy === strategy))

const byScenario = {}
for (const scenario of SCENARIOS) {
	byScenario[scenario] = {}
	for (const strategy of STRATEGIES) {
		const subset = runs.filter((r) => r.scenario === scenario && r.strategy === strategy)
		if (subset.length) byScenario[scenario][strategy] = summarise(subset)
	}
}

const dataset = {
	generatedBy: "scripts/bench-ai-generation.mjs",
	model: MODEL,
	recordedFrom: recordedAt.reduce((a, b) => (a < b ? a : b)).slice(0, 10),
	recordedTo: recordedAt.reduce((a, b) => (a > b ? a : b)).slice(0, 10),
	recordings: recordedAt.length,
	strategies: STRATEGIES,
	scenarios: SCENARIOS,
	totalRuns: runs.length,
	byStrategy,
	byScenario,
	runs,
}

const HEADER = `/**
 * Measured results of generating BPMN diagrams with an LLM, three ways.
 *
 * **Auto-generated** by \`scripts/bench-ai-generation.mjs\` from the recordings in
 * \`apps/demo/recordings/\` — real streamed runs, scored with \`@bpmnkit/core\`
 * itself. Do not edit by hand; re-run the script when recordings are added.
 *
 * A frozen measurement rather than a live fact, so it is not regenerated on
 * build. Editorial copy lives in \`../data/ai-benchmark.ts\`; this file carries
 * only numbers.
 */

/** One strategy's scored outcome for one recorded run. */
export interface BenchmarkRun {
	readonly recording: string
	readonly scenario: string
	readonly strategy: string
	/** Wall-clock time of the streamed generation, in milliseconds. */
	readonly ms: number
	readonly inputTokens: number | null
	readonly outputTokens: number | null
	/** Whether the strategy returned BPMN at all, rather than failing. */
	readonly produced: boolean
	readonly parsed: boolean
	/** Whether every element and flow has diagram interchange — i.e. it renders. */
	readonly diComplete: boolean
	readonly missingShapes: number | null
	readonly missingEdges: number | null
	readonly lintErrors: number | null
	readonly elements: number | null
}

/** Medians over a set of runs. Medians, because the cells are small and uneven. */
export interface BenchmarkSummary {
	readonly runs: number
	readonly medianMs: number
	readonly medianOutputTokens: number | null
	readonly medianInputTokens: number | null
	readonly medianTotalTokens: number | null
	readonly produced: number
	/** Produced, parsed, and renderable — the only count that means "it worked". */
	readonly usable: number
	readonly medianElements: number | null
}

export interface BenchmarkDataset {
	readonly generatedBy: string
	readonly model: string
	readonly recordedFrom: string
	readonly recordedTo: string
	readonly recordings: number
	readonly strategies: readonly string[]
	readonly scenarios: readonly string[]
	readonly totalRuns: number
	readonly byStrategy: Readonly<Record<string, BenchmarkSummary>>
	readonly byScenario: Readonly<Record<string, Readonly<Record<string, BenchmarkSummary>>>>
	readonly runs: readonly BenchmarkRun[]
}

export const AI_BENCHMARK: BenchmarkDataset = `

writeFileSync(out, `${HEADER}${JSON.stringify(dataset, null, "\t")} as const\n`)
console.log(`wrote ${out} — ${runs.length} runs`)

if (args.includes("--print")) {
	for (const scenario of SCENARIOS) {
		console.log(`\n${scenario}`)
		for (const strategy of STRATEGIES) {
			const s = byScenario[scenario][strategy]
			if (!s) continue
			console.log(
				`  ${strategy.padEnd(17)} n=${s.runs}  ${(s.medianMs / 1000).toFixed(1).padStart(6)}s  out=${String(s.medianOutputTokens).padStart(6)}  total=${String(s.medianTotalTokens).padStart(6)}  usable=${s.usable}/${s.runs}`,
			)
		}
	}
}
