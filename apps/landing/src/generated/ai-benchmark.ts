/**
 * Measured results of generating BPMN diagrams with an LLM, three ways.
 *
 * **Auto-generated** by `scripts/bench-ai-generation.mjs` from the recordings in
 * `apps/demo/recordings/` — real streamed runs, scored with `@bpmnkit/core`
 * itself. Do not edit by hand; re-run the script when recordings are added.
 *
 * A frozen measurement rather than a live fact, so it is not regenerated on
 * build. Editorial copy lives in `../data/ai-benchmark.ts`; this file carries
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

export const AI_BENCHMARK: BenchmarkDataset = {
	"generatedBy": "scripts/bench-ai-generation.mjs",
	"model": "claude-opus-4-8",
	"recordedFrom": "2026-07-01",
	"recordedTo": "2026-07-03",
	"recordings": 12,
	"strategies": [
		"without-sdk",
		"with-sdk",
		"with-sdk-compact"
	],
	"scenarios": [
		"loan-approval",
		"kyc",
		"quote-to-cash"
	],
	"totalRuns": 29,
	"byStrategy": {
		"without-sdk": {
			"runs": 12,
			"medianMs": 119477.5,
			"medianOutputTokens": 12425,
			"medianInputTokens": 487,
			"medianTotalTokens": 12912,
			"produced": 12,
			"usable": 10,
			"medianElements": 14
		},
		"with-sdk": {
			"runs": 12,
			"medianMs": 32289.5,
			"medianOutputTokens": 3023,
			"medianInputTokens": 10652,
			"medianTotalTokens": 13675,
			"produced": 9,
			"usable": 9,
			"medianElements": 16
		},
		"with-sdk-compact": {
			"runs": 5,
			"medianMs": 16170,
			"medianOutputTokens": 1020,
			"medianInputTokens": 2415,
			"medianTotalTokens": 3435,
			"produced": 5,
			"usable": 5,
			"medianElements": 16
		}
	},
	"byScenario": {
		"loan-approval": {
			"without-sdk": {
				"runs": 5,
				"medianMs": 49425,
				"medianOutputTokens": 5123,
				"medianInputTokens": 355,
				"medianTotalTokens": 5478,
				"produced": 5,
				"usable": 5,
				"medianElements": 8
			},
			"with-sdk": {
				"runs": 5,
				"medianMs": 17724,
				"medianOutputTokens": 1520,
				"medianInputTokens": 10467,
				"medianTotalTokens": 11975,
				"produced": 5,
				"usable": 5,
				"medianElements": 16
			},
			"with-sdk-compact": {
				"runs": 2,
				"medianMs": 12825.5,
				"medianOutputTokens": 769,
				"medianInputTokens": 2283,
				"medianTotalTokens": 3052,
				"produced": 2,
				"usable": 2,
				"medianElements": 14
			}
		},
		"kyc": {
			"without-sdk": {
				"runs": 2,
				"medianMs": 119477.5,
				"medianOutputTokens": 12258.5,
				"medianInputTokens": 487,
				"medianTotalTokens": 12745.5,
				"produced": 2,
				"usable": 2,
				"medianElements": 14
			},
			"with-sdk": {
				"runs": 2,
				"medianMs": 32289.5,
				"medianOutputTokens": 2648,
				"medianInputTokens": 10625.5,
				"medianTotalTokens": 13273.5,
				"produced": 2,
				"usable": 2,
				"medianElements": 21
			},
			"with-sdk-compact": {
				"runs": 2,
				"medianMs": 16172.5,
				"medianOutputTokens": 1026,
				"medianInputTokens": 2415,
				"medianTotalTokens": 3441,
				"produced": 2,
				"usable": 2,
				"medianElements": 15.5
			}
		},
		"quote-to-cash": {
			"without-sdk": {
				"runs": 5,
				"medianMs": 307300,
				"medianOutputTokens": 31772,
				"medianInputTokens": 603,
				"medianTotalTokens": 32375,
				"produced": 5,
				"usable": 3,
				"medianElements": 39
			},
			"with-sdk": {
				"runs": 5,
				"medianMs": 130996,
				"medianOutputTokens": 11793,
				"medianInputTokens": 10715,
				"medianTotalTokens": 22508,
				"produced": 2,
				"usable": 2,
				"medianElements": 34
			},
			"with-sdk-compact": {
				"runs": 1,
				"medianMs": 67936,
				"medianOutputTokens": 6006,
				"medianInputTokens": 2531,
				"medianTotalTokens": 8537,
				"produced": 1,
				"usable": 1,
				"medianElements": 40
			}
		}
	},
	"runs": [
		{
			"recording": "kyc-2026-07-02",
			"scenario": "kyc",
			"strategy": "without-sdk",
			"ms": 115620,
			"inputTokens": 487,
			"outputTokens": 12425,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 5,
			"elements": 14
		},
		{
			"recording": "kyc-2026-07-02",
			"scenario": "kyc",
			"strategy": "with-sdk",
			"ms": 28274,
			"inputTokens": 10599,
			"outputTokens": 2273,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 21
		},
		{
			"recording": "kyc-2026-07-02",
			"scenario": "kyc",
			"strategy": "with-sdk-compact",
			"ms": 16170,
			"inputTokens": 2415,
			"outputTokens": 1020,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 9,
			"elements": 15
		},
		{
			"recording": "kyc-2026-07-03",
			"scenario": "kyc",
			"strategy": "without-sdk",
			"ms": 123335,
			"inputTokens": 487,
			"outputTokens": 12092,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 14
		},
		{
			"recording": "kyc-2026-07-03",
			"scenario": "kyc",
			"strategy": "with-sdk",
			"ms": 36305,
			"inputTokens": 10652,
			"outputTokens": 3023,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 5,
			"elements": 21
		},
		{
			"recording": "kyc-2026-07-03",
			"scenario": "kyc",
			"strategy": "with-sdk-compact",
			"ms": 16175,
			"inputTokens": 2415,
			"outputTokens": 1032,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 7,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-01",
			"scenario": "loan-approval",
			"strategy": "without-sdk",
			"ms": 49425,
			"inputTokens": null,
			"outputTokens": null,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 8
		},
		{
			"recording": "loan-approval-2026-07-01",
			"scenario": "loan-approval",
			"strategy": "with-sdk",
			"ms": 19670,
			"inputTokens": null,
			"outputTokens": null,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-01b",
			"scenario": "loan-approval",
			"strategy": "without-sdk",
			"ms": 46791,
			"inputTokens": 355,
			"outputTokens": 5079,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 8
		},
		{
			"recording": "loan-approval-2026-07-01b",
			"scenario": "loan-approval",
			"strategy": "with-sdk",
			"ms": 17724,
			"inputTokens": 2,
			"outputTokens": 1519,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-01c",
			"scenario": "loan-approval",
			"strategy": "without-sdk",
			"ms": 52325,
			"inputTokens": 355,
			"outputTokens": 5441,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 8
		},
		{
			"recording": "loan-approval-2026-07-01c",
			"scenario": "loan-approval",
			"strategy": "with-sdk",
			"ms": 17306,
			"inputTokens": 10467,
			"outputTokens": 1495,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-02",
			"scenario": "loan-approval",
			"strategy": "without-sdk",
			"ms": 48426,
			"inputTokens": 355,
			"outputTokens": 5035,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 8
		},
		{
			"recording": "loan-approval-2026-07-02",
			"scenario": "loan-approval",
			"strategy": "with-sdk",
			"ms": 17438,
			"inputTokens": 10467,
			"outputTokens": 1521,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-02",
			"scenario": "loan-approval",
			"strategy": "with-sdk-compact",
			"ms": 14026,
			"inputTokens": 2283,
			"outputTokens": 894,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 7,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-03",
			"scenario": "loan-approval",
			"strategy": "without-sdk",
			"ms": 50991,
			"inputTokens": 355,
			"outputTokens": 5167,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 8
		},
		{
			"recording": "loan-approval-2026-07-03",
			"scenario": "loan-approval",
			"strategy": "with-sdk",
			"ms": 18993,
			"inputTokens": 10520,
			"outputTokens": 1645,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 16
		},
		{
			"recording": "loan-approval-2026-07-03",
			"scenario": "loan-approval",
			"strategy": "with-sdk-compact",
			"ms": 11625,
			"inputTokens": 2283,
			"outputTokens": 644,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 4,
			"elements": 12
		},
		{
			"recording": "quote-to-cash-2026-07-01",
			"scenario": "quote-to-cash",
			"strategy": "without-sdk",
			"ms": 210845,
			"inputTokens": 603,
			"outputTokens": 24174,
			"produced": true,
			"parsed": true,
			"diComplete": false,
			"missingShapes": 16,
			"missingEdges": 13,
			"lintErrors": 6,
			"elements": 39
		},
		{
			"recording": "quote-to-cash-2026-07-01",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk",
			"ms": 83104,
			"inputTokens": 10715,
			"outputTokens": 7415,
			"produced": false,
			"parsed": false,
			"diComplete": false,
			"missingShapes": null,
			"missingEdges": null,
			"lintErrors": null,
			"elements": null
		},
		{
			"recording": "quote-to-cash-2026-07-02",
			"scenario": "quote-to-cash",
			"strategy": "without-sdk",
			"ms": 364210,
			"inputTokens": 603,
			"outputTokens": 37609,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 6,
			"elements": 42
		},
		{
			"recording": "quote-to-cash-2026-07-02",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk",
			"ms": 189986,
			"inputTokens": 10715,
			"outputTokens": 17649,
			"produced": false,
			"parsed": false,
			"diComplete": false,
			"missingShapes": null,
			"missingEdges": null,
			"lintErrors": null,
			"elements": null
		},
		{
			"recording": "quote-to-cash-2026-07-02b",
			"scenario": "quote-to-cash",
			"strategy": "without-sdk",
			"ms": 307300,
			"inputTokens": 603,
			"outputTokens": 31772,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 5,
			"elements": 41
		},
		{
			"recording": "quote-to-cash-2026-07-02b",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk",
			"ms": 130996,
			"inputTokens": 10715,
			"outputTokens": 11793,
			"produced": false,
			"parsed": false,
			"diComplete": false,
			"missingShapes": null,
			"missingEdges": null,
			"lintErrors": null,
			"elements": null
		},
		{
			"recording": "quote-to-cash-2026-07-02c",
			"scenario": "quote-to-cash",
			"strategy": "without-sdk",
			"ms": 245840,
			"inputTokens": 603,
			"outputTokens": 26103,
			"produced": true,
			"parsed": true,
			"diComplete": false,
			"missingShapes": 16,
			"missingEdges": 13,
			"lintErrors": 6,
			"elements": 39
		},
		{
			"recording": "quote-to-cash-2026-07-02c",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk",
			"ms": 113860,
			"inputTokens": 10715,
			"outputTokens": 10401,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 6,
			"elements": 35
		},
		{
			"recording": "quote-to-cash-2026-07-03",
			"scenario": "quote-to-cash",
			"strategy": "without-sdk",
			"ms": 361480,
			"inputTokens": 603,
			"outputTokens": 33826,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 6,
			"elements": 35
		},
		{
			"recording": "quote-to-cash-2026-07-03",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk",
			"ms": 200200,
			"inputTokens": 10768,
			"outputTokens": 17426,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 8,
			"elements": 33
		},
		{
			"recording": "quote-to-cash-2026-07-03",
			"scenario": "quote-to-cash",
			"strategy": "with-sdk-compact",
			"ms": 67936,
			"inputTokens": 2531,
			"outputTokens": 6006,
			"produced": true,
			"parsed": true,
			"diComplete": true,
			"missingShapes": 0,
			"missingEdges": 0,
			"lintErrors": 11,
			"elements": 40
		}
	]
}
