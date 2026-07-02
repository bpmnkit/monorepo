# Demo "With SDK Compact Mode" — Design

## Goal

Add a third demo run alongside the existing "With SDK" (fluent TypeScript builder) and "Without SDK" (raw XML) runs: **"With SDK (Compact)"**, where Claude represents the process in a terse, purpose-built line-based notation instead of writing TypeScript. The point is to demonstrate that the SDK can achieve meaningfully less generated output (~47% smaller than the equivalent builder code for the loan-approval example) without losing any information relative to what the SDK's own Compact Format already captures.

## Background: why not just use `compactify()`/`expand()`'s JSON directly

`@bpmnkit/core` already exports a "Compact Format" (`compactify()`/`expand()`, `CompactDiagram`/`CompactElement`/`CompactFlow`/`CompactProcess` types) explicitly documented as a token-efficient AI/LLM representation. Two things ruled out asking Claude to emit that JSON directly:

1. **It's lossy relative to the full builder API** — `compactify()` cannot represent REST connector input mappings (URL/method/auth — only a single result-variable output survives), multi-instance/loop characteristics, gateway `default` flow markers, message/error/signal refs, text annotations, or documentation. This is accepted as an honest, disclosed tradeoff — same posture as "Without SDK" already sometimes failing outright in this demo. No attempt is made to hide or work around it.
2. **Pretty-printed JSON is actually *larger* than the equivalent builder TypeScript** (measured: 5861 vs 4593 bytes for the loan-approval example), and even minified JSON is only ~12% smaller (3509 vs ~4000 bytes with comments/blank lines stripped) — because JSON's punctuation (quotes on every key and string, braces, colons, commas) accounts for roughly 43% of the minified size, while the actual content (ids, names, FEEL expressions) is irreducible without losing information.

So instead, a custom low-punctuation DSL was designed that decodes into the exact same `CompactDiagram` shape `compactify()` already produces — same information ceiling as the SDK's Compact Format, denser encoding of it.

## The Compact Notation DSL

One line per element or flow; self-describing `key=value` fields (only emitted when present, same "optional field = zero cost" property `CompactElement` already has); 2-space indentation for subprocess nesting. Measured on the loan-approval example: **2117 bytes vs. ~4000 bytes for the equivalent builder TypeScript — a 47% reduction — with zero additional information loss beyond what `compactify()` already accepts.**

### Grammar

```
process <id> ["<name>"]              — exactly one, first line

<tag> <id> ["<name>"] [field=value ...]     — an element

<fromId> -> <toId> ["<name>"] [if="<condition>"]   — a flow
  (a line is a flow if its 2nd token is exactly `->`; otherwise it's
  dispatched as an element by tag)

Indent child lines by 2 spaces under a sub/adhoc/eventsub line — a line
back at the parent's indent (or less) ends the nested block.
```

Tags:

| Tag | BPMN element type |
|---|---|
| `start` | startEvent |
| `end` | endEvent |
| `task` | task (generic) |
| `service` | serviceTask |
| `user` | userTask |
| `script` | scriptTask |
| `rule` | businessRuleTask |
| `send` | sendTask |
| `receive` | receiveTask |
| `call` | callActivity |
| `xgw` / `pgw` / `igw` / `egw` | exclusive/parallel/inclusive/event-based gateway |
| `boundary` | boundaryEvent |
| `throw` / `catch` | intermediate throw/catch event |
| `sub` / `adhoc` / `eventsub` | subProcess / adHocSubProcess / eventSubProcess |

Fields (all optional, order-independent):

| Field | Maps to |
|---|---|
| `job=<value>` | `jobType` |
| `h.<key>=<value>` | one `taskHeaders` entry (repeatable) |
| `call=<value>` | `calledProcess` |
| `form=<value>` | `formId` |
| `decision=<value>` | `decisionId` |
| `result=<value>` | `resultVariable` |
| `event=<value>` | `eventType` |
| `at=<value>` | `attachedTo` (boundary event host) |
| `noninterrupt` | bare flag → `interrupting: false` |

Quoting rule: `name` and `if=` (condition) values are always double-quoted when present (they may contain spaces); every other field value is an unquoted space-free token.

### Worked example (the loan-approval scenario, verbatim)

```
process LoanApproval "Loan Approval Process"
start start "Application Received"
service fetchCreditScore "Fetch Credit Score" job=io.camunda:http-json:1 h.resultVariable=creditBureauResponse h.resultExpression="=creditBureauResponse.body"
xgw preScreen "Credit Score >= 580?"
service sendRejectionLetter "Send Rejection Letter" job=email-sender h.template=loan-rejected-credit
end endRejectedAutomatic "Rejected - Credit Score"
rule riskScoring "Calculate Risk Score" decision=loan-risk-scoring result=riskAssessment
xgw riskGateway "Risk Tier?"
script calculateRate "Calculate Interest Rate" result=interestRate
service generateOffer "Generate Loan Offer" job=offer-generator result=loanOfferId
user underwriterReview "Underwriter Review" form=underwriter-review-form
service sendHighRiskRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-risk
end endRejectedRisk "Rejected - High Risk"
xgw underwriterDecision "Underwriter Approved?"
service sendManualRejection "Send Rejection Letter" job=email-sender h.template=loan-rejected-underwriter
end endRejectedManual "Rejected - Underwriter"
service notifyApplicant "Send Offer to Applicant" job=email-sender h.template=loan-offer
end endApproved "Loan Approved"
start -> fetchCreditScore
fetchCreditScore -> preScreen
preScreen -> sendRejectionLetter "rejected-prescreening" if="=creditBureauResponse.score < 580"
sendRejectionLetter -> endRejectedAutomatic
preScreen -> riskScoring "passed-prescreening" if="=creditBureauResponse.score >= 580"
riskScoring -> riskGateway
riskGateway -> calculateRate "low-risk" if="=riskAssessment.tier = \"low\""
calculateRate -> generateOffer
generateOffer -> notifyApplicant
riskGateway -> underwriterReview "medium-risk" if="=riskAssessment.tier = \"medium\""
underwriterReview -> underwriterDecision
riskGateway -> sendHighRiskRejection "high-risk"
sendHighRiskRejection -> endRejectedRisk
underwriterDecision -> notifyApplicant "uw-approved" if="=underwriterApproved = true"
underwriterDecision -> sendManualRejection "uw-rejected"
sendManualRejection -> endRejectedManual
notifyApplicant -> endApproved
```

This file is stored as a static fixture (`apps/demo/server/fixtures/loan-approval.dsl`) and read verbatim into the system prompt — same pattern `buildSdkSystemPrompt` already uses for its builder-code worked example.

## Backend architecture

All new — no changes to the existing with-sdk/without-sdk execution paths.

- **`server/compact-dsl.ts`** — `parseCompactDsl(text: string): CompactDiagram`. A tokenizer splits each line into whitespace-separated tokens while treating a `"..."` span (with `\"`-escaped inner quotes) as one token even if it contains spaces — this is what lets `if="=riskAssessment.tier = \"low\""` parse as a single field token. A line-dispatch loop classifies each line (process header / flow — 2nd token is `->` / element — first token matches the tag table) and an indent-tracked stack routes nested lines into the correct `children.elements`/`children.flows` of the enclosing sub/adhoc/eventsub element. Throws a descriptive `Error` (including the line number) on anything unparseable — same posture as the rest of this pipeline (no silent recovery, the error surfaces through the same SSE `error` event the other two variants already use).
  - `CompactDiagram.id` (top-level, e.g. `"Definitions_1"`) and each `CompactFlow.id` are **not part of the DSL** — the LLM never specifies them, since they're generic plumbing IDs with no scenario-relevant content (matching how the fluent builder auto-generates flow IDs today via `generateId("Flow")`, never asking the caller to name them). The parser synthesizes a fixed diagram id and a sequential/generated id per flow when building the `CompactDiagram` object.
- **`server/compact-executor.ts`** — `executeCompactDsl(dslText: string): string`. Calls `parseCompactDsl` → the SDK's own unchanged `expand()` → the SDK's own unchanged `Bpmn.export()`. Fully in-process and synchronous — no `tsx` subprocess, no temp directory, meaningfully simpler and faster than `sdk-executor.ts`'s path (which must execute arbitrary LLM-authored TypeScript).
- **`server/extractor.ts`** gains `extractCompactBlock(text: string): string | null`, mirroring `extractTsBlock`'s fenced-block-first, heuristic-fallback pattern, matching a ` ```compact ` fence.
- **`server/system-prompt.ts`** gains `buildCompactSystemPrompt(repoRoot: string): string` — reads the DSL fixture file and assembles: grammar explanation (the tables above, as prose) → worked example (the fixture, verbatim) → output instructions (emit only the compact notation, wrap in a single ` ```compact ` block, no prose, "use the exact same scenario logic as the full SDK — this is a terser representation of the identical process, not a simplified one"). Unlike `buildSdkSystemPrompt`, this does NOT include the SDK's README or raw type exports — the DSL is a distinct notation from the TypeScript API, so the full builder-API reference material would be irrelevant noise here.
- **`server/index.ts`**: new route `GET /stream/with-sdk-compact`, identical shape to `/stream/with-sdk` (scenario lookup + 400 on invalid, `streamLlm(scenario.prompt, COMPACT_SYSTEM_PROMPT, ...)`, then `extractCompactBlock` + `executeCompactDsl` instead of `extractTsBlock` + `executeSdkCode`, same SSE `chunk`/`done`/`bpmn`/`error` event shape). `GET /prompts` gains a third key.

## Data

`Recording.panels` gains `"with-sdk-compact"?: RecordedPanel` — **optional**, so the 8 existing recording files keep working with no migration. New recordings always populate it in practice, since "Run Demo" runs all three variants together.

## Frontend

- `Variant` widens to `"with-sdk" | "with-sdk-compact" | "without-sdk"`. `ComparePanel`'s `LABELS`/`BADGE_VARIANTS` maps gain `"with-sdk-compact"` → `"WITH SDK (COMPACT)"` / Cascivo `Badge` variant `"warning"` (confirmed against `@cascivo/react`'s actual `BadgeProps` — `'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline'` — distinct from `"success"`/`"destructive"` already used by the other two). The same color drives the `RaceChart` bar via `--bpmnkit-warn`.
- `RaceChart` is refactored from two fixed named props (`withSdk`/`withoutSdk`) to `{ rows: { id, label, colorVar, data: RaceChartPanelData }[] }`, rendered via `.map()` — the fixed-2-prop shape no longer fits with a third (and possibly future) row. `computeAxisMaxMs` takes an array of elapsed times instead of two fixed parameters.
- `App.tsx`: `Prompts` interface gains `withSdkCompact: string`; a third `usePanelRun` call and `useCallback` finish handler; `runLive()`/`replay()` construct a third `LiveSource`/`ReplaySource`; `activeSystemPrompt`/`PromptModal`'s title become a 3-way lookup instead of a ternary; the chart view's `rows` array and the detailed view's stacked `ComparePanel`s are both ordered `[with-sdk-compact, with-sdk, without-sdk]` — the new bar/row goes **above** "With SDK", per the request.
- `comparison-banner.ts` (`buildComparisonBanner`) is **unchanged** — it still only compares with-sdk vs. without-sdk. The new variant's own per-panel duration/token display (already inherent to `ComparePanel`/`RaceChart`) carries the "less code" story without needing new pairwise-comparison text logic for a third variant.

## Testing

- `compact-dsl.ts`: unit tests for the tokenizer (bare tokens, quoted values with embedded spaces, escaped inner quotes), each tag mapping, flow parsing (with/without name/condition), nested subprocess indentation (one level, and unclosed/malformed indentation errors), and the full loan-approval fixture round-tripping to a `CompactDiagram` matching what `compactify()` produces for the equivalent builder output.
- `compact-executor.ts`: unit test that a known-good DSL string produces valid BPMN XML (via `parseXml` round-trip or a structural check), and that a malformed DSL string throws.
- `extractor.ts`: unit tests for `extractCompactBlock` mirroring `extractTsBlock`'s existing test shape.
- No automated tests for `App.tsx`/`RaceChart.tsx` changes — matches this codebase's established precedent (verified via `tsc`/`biome`/manual dev-server checks, and a live smoke test against the real `claude` CLI for the new route end-to-end).

## Out of scope

- No changes to `compactify()`/`expand()` themselves, or to their lossiness — this is a demo-side compression front-end over the SDK's existing, unchanged Compact Format data model.
- No multi-process DSL documents (`process` line appears exactly once) — matches all three existing scenarios' actual shape.
- No changes to `comparison-banner.ts`'s comparison logic.
- No migration of existing recording files to add the new panel key.
