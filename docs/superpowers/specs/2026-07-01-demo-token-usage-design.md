# BPMN Comparison Demo — Token Usage in the Comparison

**Date:** 2026-07-01
**Branch:** video-demonstration
**Builds on:** `apps/demo`'s existing timer/duration-banner feature (see `docs/superpowers/specs/2026-07-01-demo-cascivo-recording-design.md`)

## Overview

Extend the existing per-panel timer and duration-comparison banner to also show token usage (input/output tokens spent), so the "with SDK" vs "without SDK" comparison covers cost/efficiency, not just speed.

## Data Source

The `claude` CLI's final NDJSON line for a `-p` run (`{"type":"result", ...}`) carries a `usage` object with `input_tokens`/`output_tokens` for the entire exchange (confirmed by direct invocation — see below). This is a single-shot, non-interactive call, so this one line's usage figures represent the whole run; no aggregation across turns is needed.

```json
{"input_tokens": 2441, "output_tokens": 13, "cache_creation_input_tokens": 15136, "cache_read_input_tokens": 0, ...}
```

Only `input_tokens` and `output_tokens` are surfaced — matching what was asked for. Cache-related fields are not shown; they're a distinct concept (prompt caching) and would muddy a "tokens spent" comparison the user didn't ask for.

## Server Changes (`apps/demo/server/index.ts`)

- New parser `extractResultUsage(event: unknown): TokenUsage | null`, following the same defensive `typeof`/`in`-checked pattern as the existing `extractDeltaText` — this is parsing untrusted subprocess output, same as before.
- `streamLlm()`'s return type changes from `Promise<string>` to `Promise<{ text: string; usage: TokenUsage | null }>`. While iterating NDJSON lines, in addition to extracting chunk deltas, also check each line for `extractResultUsage`; capture the last non-null result (there's only ever one `result` line per run, but capturing the last is defensively correct either way).
- Both `/stream/with-sdk` and `/stream/without-sdk` route handlers destructure `{ text, usage }` from `streamLlm()` and include `usage` in whichever terminal SSE event fires — `bpmn` on success, `error` on extraction/execution failure. Usage reflects real spend even on the error path, since the LLM call itself already completed by the time extraction or `tsx` execution fails.
- If `streamLlm()` throws before ever reaching a `result` line (spawn failure, non-zero exit with no result), the route's outer catch has no `usage` to include — it sends `usage: null`.

## Shared Type Changes (`apps/demo/shared/recording-types.ts`)

```ts
export interface TokenUsage {
	inputTokens: number
	outputTokens: number
}

export interface RecordedPanel {
	systemPrompt: string
	chunks: { t: number; text: string }[]
	durationMs: number
	usage?: TokenUsage | null
	result: { type: "bpmn"; xml: string } | { type: "error"; message: string }
}
```

`usage` is optional (`?:`) specifically so the existing `apps/demo/recordings/loan-approval-2026-07-01.json` — saved before this feature existed — still parses as a valid `Recording` with no changes. Frontend code treats `undefined` and `null` identically: "no token data for this run."

## Frontend Changes

**`apps/demo/src/sources.ts`:**
- `PanelSourceHandlers.onBpmn: (xml: string, usage: TokenUsage | null) => void`
- `PanelSourceHandlers.onError: (message: string, usage: TokenUsage | null) => void`
- `LiveSource` parses `usage` from the enriched SSE payload and passes it through.
- `ReplaySource` reads `this.panel.usage ?? null` and passes it through at the scheduled terminal-event time.
- `PanelRunResult` (`Omit<RecordedPanel, "systemPrompt">`) automatically gains `usage` since it flows through `RecordedPanel`.

**New `apps/demo/src/format-tokens.ts`:** a pure `formatTokenCount(n: number): string` helper — numbers ≥ 1000 render as `"8.1k"` (one decimal, rounded), smaller numbers render as-is (`"340"`). Small, testable, reused by both `ComparePanel` and the banner.

**`apps/demo/src/ComparePanel.tsx`:**
- New `usage` state, set from the `onBpmn`/`onError` callback's new parameter.
- Rendered next to the existing elapsed-timer display: `12.3s · 8.1k in / 340 out`. When `usage` is `null` (still running, or a crashed/pre-feature run), only the timer shows — no placeholder text.
- `usage` included in the object passed to `onFinish` (part of `PanelRunResult`).

**`apps/demo/src/duration-banner.ts` → renamed `apps/demo/src/comparison-banner.ts`:**
- Function renamed `buildDurationBanner` → `buildComparisonBanner` (its job now covers both duration and tokens — the old name undersells it).
- When both `withSdk.usage` and `withoutSdk.usage` are non-null: one combined line —
  `"With SDK: 12.3s, 8.1k in / 340 out · Without SDK: 45.1s, 450 in / 890 out · SDK was 3.7× faster, used 18× more input tokens"`.
  The "faster"/"more input tokens" comparisons each independently pick whichever side actually wins — no hardcoded direction, matching the existing duration-comparison logic.
- When either side's `usage` is missing: falls back to the original duration-only line (no token clause, no crash, no fake "0 in / 0 out").
- The "X× more input tokens" comparison uses only `inputTokens` (not a combined total) — the with-SDK system prompt is large (README + types + full example), so input tokens are the dimension where the contrast is real and worth calling out; output tokens are comparatively similar between the two runs and don't need their own ratio clause.

**`apps/demo/src/App.tsx`:** import/call updates for the renamed function; no other changes — `recordingData` assembly already spreads the full `PanelRunResult` (now including `usage`) into each `RecordedPanel`, so new recordings automatically capture token data with no extra wiring.

## Testing

- `format-tokens.test.ts`: boundary cases (999 → "999", 1000 → "1.0k", 8140 → "8.1k", 0 → "0").
- `comparison-banner.test.ts` (replacing `duration-banner.test.ts`): the existing 3 duration-only cases, plus new cases — both-usage-present (full combined line, correct winner picked for each clause independently), one-side-missing-usage (duration-only fallback), both-missing-usage (duration-only fallback).
- `sources.test.ts`: extend the existing `ReplaySource` tests to assert `onBpmn`/`onError` receive the recorded panel's `usage` (or `null` when absent).
- No new test needed for `extractResultUsage` in isolation beyond what the existing `streamLlm`-level live verification already covers — mirrors the precedent set by `extractDeltaText`, which also has no dedicated unit test (both are internal parsing helpers exercised end-to-end by the live smoke test).

## Out of Scope

- Cache-token fields (`cache_creation_input_tokens`, `cache_read_input_tokens`) — not part of what was asked for.
- Cost/dollar estimation — the ask was specifically "how many tokens," not cost.
- Backfilling `usage` into the existing pre-feature recording — it simply lacks token data going forward; no migration step.
