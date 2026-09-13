import { describe, expect, it } from "vitest"
import { HEADLINE, META, RELIABILITY, REPLAY, ROWS, STRATEGIES } from "../src/data/ai-benchmark.js"
import { AI_BENCHMARK, type BenchmarkRun } from "../src/generated/ai-benchmark.js"

/**
 * `src/generated/ai-benchmark.ts` is written by `scripts/bench-ai-generation.mjs`
 * and committed. Unlike `ecosystem.ts` it is not regenerated on build — it is a
 * frozen measurement — so a hand-edit or a half-finished regeneration would
 * otherwise reach the homepage silently, under numbers presented as measured.
 *
 * The summaries are therefore recomputed here from the run-level rows they were
 * derived from, which needs neither the recordings nor a built `@bpmnkit/core`.
 */

function median(values: readonly number[]): number {
	const sorted = [...values].sort((a, b) => a - b)
	const mid = sorted.length / 2
	return sorted.length % 2
		? (sorted[Math.floor(mid)] as number)
		: ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2
}

const runsOf = (predicate: (r: BenchmarkRun) => boolean): BenchmarkRun[] =>
	AI_BENCHMARK.runs.filter(predicate)

describe("generated benchmark dataset", () => {
	it("summarises the runs it ships", () => {
		for (const strategy of AI_BENCHMARK.strategies) {
			const subset = runsOf((r) => r.strategy === strategy)
			const summary = AI_BENCHMARK.byStrategy[strategy]
			expect(summary, strategy).toBeDefined()
			expect(summary?.runs, strategy).toBe(subset.length)
			expect(summary?.medianMs, strategy).toBe(median(subset.map((r) => r.ms)))
			expect(summary?.produced, strategy).toBe(subset.filter((r) => r.produced).length)
			expect(summary?.usable, strategy).toBe(
				subset.filter((r) => r.produced && r.parsed && r.diComplete).length,
			)
		}
	})

	it("summarises every scenario cell from the same rows", () => {
		for (const scenario of AI_BENCHMARK.scenarios) {
			for (const [strategy, summary] of Object.entries(AI_BENCHMARK.byScenario[scenario] ?? {})) {
				const subset = runsOf((r) => r.scenario === scenario && r.strategy === strategy)
				expect(summary.runs, `${scenario}/${strategy}`).toBe(subset.length)
				expect(summary.medianMs, `${scenario}/${strategy}`).toBe(median(subset.map((r) => r.ms)))
			}
		}
	})

	it("counts every run exactly once", () => {
		expect(AI_BENCHMARK.runs).toHaveLength(AI_BENCHMARK.totalRuns)
		for (const run of AI_BENCHMARK.runs) {
			expect(AI_BENCHMARK.strategies).toContain(run.strategy)
			expect(AI_BENCHMARK.scenarios).toContain(run.scenario)
		}
	})

	it("never reports more usable runs than it ran", () => {
		for (const { strategy, runs, produced, usable } of RELIABILITY) {
			expect(produced, strategy.id).toBeLessThanOrEqual(runs)
			expect(usable, strategy.id).toBeLessThanOrEqual(produced)
		}
	})

	it("names the model and the window it was measured in", () => {
		expect(META.model).not.toBe("")
		expect(META.recordedFrom <= META.recordedTo).toBe(true)
	})
})

describe("derived figures the homepage quotes", () => {
	it("gives every scenario a cell per strategy, in order", () => {
		expect(ROWS).toHaveLength(AI_BENCHMARK.scenarios.length)
		for (const row of ROWS) expect(row.cells).toHaveLength(STRATEGIES.length)
	})

	it("measures ratios against the raw-XML baseline", () => {
		const baseline = STRATEGIES.findIndex((s) => s.baseline)
		expect(baseline).toBeGreaterThanOrEqual(0)
		for (const row of ROWS) {
			const base = row.cells[baseline]
			expect(base, row.scenario.id).not.toBeNull()
			expect(base?.speedup).toBe(1)
			expect(base?.outputRatio).toBe(1)
			expect(base?.totalRatio).toBe(1)

			for (const cell of row.cells) {
				if (!cell || !base) continue
				expect(cell.speedup).toBeCloseTo(base.medianMs / cell.medianMs, 10)
			}
		}
	})

	it("reports headline ranges that span the scenarios", () => {
		for (const [name, range] of Object.entries(HEADLINE)) {
			expect(Number.isFinite(range.low), name).toBe(true)
			expect(Number.isFinite(range.high), name).toBe(true)
			expect(range.low, name).toBeLessThanOrEqual(range.high)
		}
	})

	it("keeps the compact path ahead of raw XML on every scenario", () => {
		const compact = STRATEGIES.findIndex((s) => s.id === "with-sdk-compact")
		for (const row of ROWS) {
			const cell = row.cells[compact]
			if (!cell) continue
			expect(cell.speedup, row.scenario.id).toBeGreaterThan(1)
			expect(cell.outputRatio ?? 0, row.scenario.id).toBeGreaterThan(1)
		}
	})
})

/**
 * The replay is the one figure on the page that is not from the recordings: it
 * re-runs their code against the current build. It is quoted next to the
 * measured table, so it has to stay consistent with the runs it summarises — and
 * with the recordings, which say how many `with-sdk` runs there were to replay.
 */
describe("replay against the current build", () => {
	it("summarises the runs it ships", () => {
		expect(REPLAY.runs).toHaveLength(REPLAY.totalRuns)
		expect(REPLAY.usable).toBe(REPLAY.runs.filter((r) => r.usable).length)
		expect(REPLAY.originallyUsable).toBe(REPLAY.runs.filter((r) => r.originallyUsable).length)
		expect(REPLAY.recovered).toBe(REPLAY.runs.filter((r) => !r.originallyUsable && r.usable).length)
	})

	it("covers every recorded builder run", () => {
		const recorded = AI_BENCHMARK.runs.filter((r) => r.strategy === "with-sdk")
		expect(REPLAY.totalRuns).toBe(recorded.length)
		expect([...REPLAY.runs].map((r) => r.recording).sort()).toEqual(
			[...recorded].map((r) => r.recording.replace(/\.json$/, "")).sort(),
		)
	})

	it("agrees with the measured table on what originally worked", () => {
		const usableWhenRecorded = AI_BENCHMARK.runs.filter(
			(r) => r.strategy === "with-sdk" && r.produced && r.parsed && r.diComplete,
		).length
		expect(REPLAY.originallyUsable).toBe(usableWhenRecorded)
	})

	it("regresses nothing — a run that passed when recorded still passes", () => {
		const regressions = REPLAY.runs.filter((r) => r.originallyUsable && !r.usable)
		expect(regressions.map((r) => `${r.recording}: ${r.error}`)).toEqual([])
		expect(REPLAY.regressed).toBe(0)
	})

	it("names the core version it ran against", () => {
		expect(REPLAY.coreVersion).toMatch(/^\d+\.\d+\.\d+/)
	})
})
