# Demo Scenario Selector — Design

## Goal

The demo currently generates one hardcoded scenario ("Loan Approval") in both the with-SDK and without-SDK panels. Add two more scenarios — Quote-to-Cash (deliberately large/complex, to stress-test how the SDK approach scales vs. raw-XML-from-memory) and KYC — and let the user pick which scenario "Run Demo" targets.

## Scope decisions

- Only the **scenario prompt** (the business description passed as the `-p` argument to the `claude` CLI) varies per scenario. Both system prompts (`WITHOUT_SDK_SYSTEM_PROMPT`, the SDK system prompt built by `buildSdkSystemPrompt`) stay fixed and scenario-independent — including the single worked example (`03-loan-approval.ts`) used to teach the SDK's fluent-builder pattern. Reusing one example for every scenario is the more honest stress test: it shows whether the SDK approach generalizes from a single example as scenario complexity grows, rather than hand-holding the harder scenarios with a matching example.
- The scenario picker is **live-mode only**. It controls which scenario "Run Demo" runs against. The existing "Load a recording…" dropdown is untouched — it keeps listing all saved recordings by name across all scenarios, unfiltered, exactly as today. Replay-only (static site) mode is unchanged: same auto-play-most-recent-recording behavior, no new scenario UI (there's no backend there to run a new scenario against anyway).

## Scenario prompts

```
Generate a Loan Approval BPMN process for Camunda 8. It should include:
- Credit score check via REST connector
- Exclusive gateway for pre-screening (reject below 580)
- DMN business rule task for risk scoring
- User task for manual underwriter review
- Separate end events for approved and rejected outcomes

Output code only. No explanation. No markdown prose outside the code block.
```

```
Generate a Quote-to-Cash BPMN process for Camunda 8. It should include:
- Quote/offer generation from a product catalog with tiered pricing
- Exclusive gateway for discount approval: manager approval above one threshold,
  escalating to VP approval above a higher threshold
- Contract generation and e-signature via a REST connector to an external
  e-signature service
- Exclusive gateway routing standard orders directly to provisioning, or complex
  bundled orders through a dedicated multi-line provisioning subprocess
- Multi-instance subprocess provisioning each ordered line item in parallel
- Invoice generation triggered once provisioning completes
- Payment processing via a REST connector to a payment gateway
- Event-based gateway for payment outcome: paid immediately, or move to a
  dunning subprocess
- Dunning/cash-collection subprocess with escalating reminder cycles (timer
  boundary events on each reminder) before escalating to a collections agency
- Separate end events for: contract rejected, payment received, and written
  off after collections failure

Output code only. No explanation. No markdown prose outside the code block.
```

```
Generate a KYC (Know Your Customer) onboarding BPMN process for Camunda 8. It
should include:
- Identity document upload and verification via a REST connector to an OCR
  service
- Exclusive gateway on document quality: reject and loop back to re-upload
  (up to 2 retries) if verification fails
- Sanctions and PEP (politically exposed person) screening via a REST
  connector
- Risk-based gateway routing to standard due diligence or enhanced due
  diligence based on the screening result
- User task for enhanced due diligence manual review by a compliance officer
- DMN business rule task for final risk classification
- Separate end events for approved, rejected, and escalated-to-compliance
  outcomes

Output code only. No explanation. No markdown prose outside the code block.
```

Scenario ids: `loan-approval`, `quote-to-cash`, `kyc`. Labels: "Loan Approval", "Quote-to-Cash", "KYC". `loan-approval` is the default (matches current behavior for existing recordings that predate this feature).

## Backend

### `server/scenarios.ts` (new)

```typescript
export interface Scenario {
	id: string
	label: string
	prompt: string
}

export const DEFAULT_SCENARIO_ID = "loan-approval"

export const SCENARIOS: Scenario[] = [
	{ id: "loan-approval", label: "Loan Approval", prompt: LOAN_APPROVAL_PROMPT },
	{ id: "quote-to-cash", label: "Quote-to-Cash", prompt: QUOTE_TO_CASH_PROMPT },
	{ id: "kyc", label: "KYC", prompt: KYC_PROMPT },
]

export function getScenario(id: string): Scenario | undefined {
	return SCENARIOS.find((s) => s.id === id)
}
```

`system-prompt.ts` loses the `SCENARIO_PROMPT` export (moved into `scenarios.ts` as `LOAN_APPROVAL_PROMPT`); `WITHOUT_SDK_SYSTEM_PROMPT` and `buildSdkSystemPrompt` are untouched.

### `server/index.ts` changes

- New route: `GET /scenarios` → `c.json(SCENARIOS)`.
- `GET /prompts` drops the `scenario` field — becomes `{ withSdk, withoutSdk }` only (both are scenario-independent).
- `GET /stream/with-sdk` and `GET /stream/without-sdk` read `c.req.query("scenario") ?? DEFAULT_SCENARIO_ID`, look it up via `getScenario`. Unknown id → `400` with a JSON error body (fail fast, no silent fallback to a default on a bad explicit value — only an *absent* param defaults).
- `streamLlm` gains a `scenarioPrompt` parameter (currently hardcodes the old `SCENARIO_PROMPT` constant as the `-p` argument): signature becomes `streamLlm(scenarioPrompt, systemPrompt, onChunk)`.

## Frontend

### `shared/recording-types.ts`

`Recording` gains an optional field: `scenarioId?: string`. The 3 existing recording files predate this field; every read site treats a missing `scenarioId` as `"loan-approval"`.

### New frontend constant (small, deliberate duplication)

A hardcoded `id → label` map (3 entries, ids matching `server/scenarios.ts`) so the header title can show a label without a network round-trip in replay-only/static builds — comment cross-references `server/scenarios.ts` so the two stay in sync if a scenario is ever added.

### `src/App.tsx`

- New state: `selectedScenarioId` (default `"loan-approval"`), `scenarios` (fetched from `GET /scenarios` alongside the existing `/prompts` fetch, live mode only).
- New `Select` next to the "Run Demo" button (live mode only) listing the 3 scenarios by label, bound to `selectedScenarioId`.
- `runLive()` passes the query param: `new LiveSource(\`/stream/with-sdk?scenario=${selectedScenarioId}\`)` (and same for without-sdk). No change needed to `LiveSource` itself — it already takes a plain URL string.
- `activeScenarioPrompt()`: if replaying, unchanged (`selectedRecording.scenarioPrompt`); if live, looks up `selectedScenarioId` in the fetched `scenarios` list instead of `prompts.scenario`.
- Header title: computed label from `selectedRecording?.scenarioId ?? selectedScenarioId` (replaying vs. live) through the frontend id→label map, defaulting to `"loan-approval"`'s label when a legacy recording has no `scenarioId`.
- `recordingData` gains `scenarioId: selectedScenarioId` (only relevant for live runs — `selectedRecording` is always null when a fresh `recordingData` is built).
- `SaveRecordingModal`'s `defaultName` becomes `${selectedScenarioId}-${date}` instead of the hardcoded `loan-approval-${date}` prefix.

No changes needed to `ComparePanel.tsx`, `sources.ts`, `PromptModal.tsx`, `SaveRecordingModal.tsx`, `recordings-store.ts`, or `recordings.ts` — all already generic over whatever prompt/recording data they're handed.

## Testing

- `server/scenarios.test.ts` (new): `getScenario` returns the right scenario by id, returns `undefined` for an unknown id; each of the 3 prompts contains its scenario's defining keyword (mirrors the existing `SCENARIO_PROMPT` test being removed from `system-prompt.test.ts`).
- `server/system-prompt.test.ts`: remove the `SCENARIO_PROMPT` describe block (moved to `scenarios.test.ts`).
- Live smoke test (manual, same pattern used for the token-usage fix): hit `/stream/with-sdk?scenario=quote-to-cash` and `/stream/with-sdk?scenario=kyc` against the real `claude` CLI once each, confirm a valid BPMN/TS result comes back and the SSE `usage` field is present.

## Out of scope

- No admin UI for adding/editing scenarios — the 3 are a fixed, hardcoded set.
- No per-scenario SDK example files.
- No filtering of the existing recordings dropdown by scenario.
- No pre-built recordings for quote-to-cash/KYC — the user records their own via the existing "Save Recording" flow once satisfied with a live run.
