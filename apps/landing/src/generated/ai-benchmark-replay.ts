/**
 * The recorded SDK generations, re-run against the current `@bpmnkit/core`.
 *
 * **Auto-generated** by `scripts/bench-ai-replay.mjs`. The model's code is
 * frozen in the recordings, so replaying it isolates what the *library* changed
 * from what the model would do differently today. Do not edit by hand.
 *
 * This is a measurement, not a projection — but of the library only. A fresh
 * generation would also reflect prompt changes, and is not covered here.
 */

/** One recorded `with-sdk` run, re-executed. */
export interface ReplayRun {
	readonly recording: string
	readonly scenario: string
	/** Whether the run counted as usable when it was recorded. */
	readonly originallyUsable: boolean
	/** False when the recording carried no extractable code to re-run. */
	readonly replayed: boolean
	/** Parsed, and every element has a shape — the benchmark's own bar. */
	readonly usable: boolean
	readonly elements: number | null
	readonly error: string | null
}

export interface ReplayDataset {
	readonly generatedBy: string
	/** The `@bpmnkit/core` version the replay ran against. */
	readonly coreVersion: string
	readonly totalRuns: number
	readonly originallyUsable: number
	readonly usable: number
	readonly byScenario: Readonly<
		Record<string, { readonly runs: number; readonly originallyUsable: number; readonly usable: number }>
	>
	readonly runs: readonly ReplayRun[]
}

export const AI_BENCHMARK_REPLAY: ReplayDataset = {
	"generatedBy": "scripts/bench-ai-replay.mjs",
	"coreVersion": "0.4.0",
	"totalRuns": 12,
	"originallyUsable": 9,
	"usable": 12,
	"byScenario": {
		"kyc": {
			"runs": 2,
			"originallyUsable": 2,
			"usable": 2
		},
		"loan-approval": {
			"runs": 5,
			"originallyUsable": 5,
			"usable": 5
		},
		"quote-to-cash": {
			"runs": 5,
			"originallyUsable": 2,
			"usable": 5
		}
	},
	"runs": [
		{
			"recording": "kyc-2026-07-02",
			"scenario": "kyc",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 21,
			"error": null
		},
		{
			"recording": "kyc-2026-07-03",
			"scenario": "kyc",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 21,
			"error": null
		},
		{
			"recording": "loan-approval-2026-07-01",
			"scenario": "loan-approval",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 16,
			"error": null
		},
		{
			"recording": "loan-approval-2026-07-01b",
			"scenario": "loan-approval",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 16,
			"error": null
		},
		{
			"recording": "loan-approval-2026-07-01c",
			"scenario": "loan-approval",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 16,
			"error": null
		},
		{
			"recording": "loan-approval-2026-07-02",
			"scenario": "loan-approval",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 16,
			"error": null
		},
		{
			"recording": "loan-approval-2026-07-03",
			"scenario": "loan-approval",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 16,
			"error": null
		},
		{
			"recording": "quote-to-cash-2026-07-01",
			"scenario": "quote-to-cash",
			"originallyUsable": false,
			"replayed": true,
			"usable": true,
			"elements": 38,
			"error": null
		},
		{
			"recording": "quote-to-cash-2026-07-02",
			"scenario": "quote-to-cash",
			"originallyUsable": false,
			"replayed": true,
			"usable": true,
			"elements": 31,
			"error": null
		},
		{
			"recording": "quote-to-cash-2026-07-02b",
			"scenario": "quote-to-cash",
			"originallyUsable": false,
			"replayed": true,
			"usable": true,
			"elements": 37,
			"error": null
		},
		{
			"recording": "quote-to-cash-2026-07-02c",
			"scenario": "quote-to-cash",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 35,
			"error": null
		},
		{
			"recording": "quote-to-cash-2026-07-03",
			"scenario": "quote-to-cash",
			"originallyUsable": true,
			"replayed": true,
			"usable": true,
			"elements": 33,
			"error": null
		}
	]
}
