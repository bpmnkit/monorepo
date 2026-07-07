# BPMN generation eval harness

Golden-prompt evaluation harness for AI-driven BPMN generation (WP7 of `doc/spec-bpmn-generation-skills.md`). Dev-only, not published.

## Modes

**Plan-level (default, CI-safe, no LLM call).** Every prompt directory that ships a `fixture.plan.json` is run through the real deterministic pipeline: `casen synth` → `casen lint --profile deploy` → `casen test` → an attempted `casen deploy deploy` against local Reebe. This never shells out to an LLM, so it's safe to run in CI. When `reebe-server` isn't reachable at `ZEEBE_ADDRESS` (e.g. this monorepo's sandboxed dev environments, which lack the Rust toolchain to build it), the deploy dimension is reported as **skipped**, not failed — the report is explicit about how many prompts actually got a deploy attempt vs. how many were skipped.

```sh
pnpm --filter @bpmnkit/cli build   # the harness shells out to the built CLI
node scripts/eval-generation/run-eval.mjs
```

**Full LLM (opt-in via `--full`).** Every prompt (including the one with no fixture, which expects a clarifying question rather than a diagram) is handed to a headless `claude -p "<prompt>" --plugin-dir plugins-claude/bpmnkit-claude --output-format json` invocation in a fresh temp directory. The resulting `.bpmn` file (if any) is run through the same lint/test/deploy gates, plus wall time and (best-effort, depends on the installed `claude` CLI's `--output-format json` shape) token cost. Requires `claude` on `PATH`; falls back to plan-level-only with a one-line notice when it isn't found. **Not run in CI** — this mode makes real, potentially slow/costly LLM calls.

```sh
node scripts/eval-generation/run-eval.mjs --full
```

## Output

`eval-report.json` (machine-readable) and `eval-report.md` (human-readable summary), both written next to this README and printed to stdout.

## The golden prompts

15 prompts in `prompts/<NN-slug>/`, each with:

- `prompt.md` — the natural-language request
- `expected.json` — `{ id, category, description, assertions? }`; `expectClarification: true` instead of `assertions` for the one ambiguous prompt
- `fixture.plan.json` — a hand-authored, pre-verified `ProcessPlan` (omitted only for the ambiguous prompt) — every one of these compiles with zero `casen synth` problems and zero `casen lint --profile deploy` errors, verified while writing this harness
- `base.bpmn` — only for the `extend` prompt, the pre-existing process the delta plan merges into

| # | Prompt | Category |
|---|---|---|
| 01 | Slack-notify-ops | connector |
| 02 | Multi-branch approval | gateway |
| 03 | Agentic support triage | agentic |
| 04 | Extend: add timer boundary | extend |
| 05 | Message-correlated payment | messaging |
| 06 | Multi-instance email notify | multi-instance |
| 07 | Error boundary + refund | error-handling |
| 08 | Long onboarding process (25+ elements) | long-process |
| 09 | Ambiguous "notify the team" | ambiguous |
| 10 | Email connector (SendGrid) | connector |
| 11 | HTTP connector | connector |
| 12 | Business rule task / DMN | dmn |
| 13 | Parallel gateway fulfillment | gateway |
| 14 | User task with candidate groups | user-task |
| 15 | Timer boundary retry | timer |

## Two real bugs this harness caught while it was being written

Writing and verifying these fixtures against the real pipeline (not just eyeballing plausible-looking JSON) surfaced two genuine bugs, both fixed in the same change that added this harness:

1. **`packages/core/src/bpmn/agentic.ts`** — a `fromAi()` tool param whose `target` collided with a connector-resolved static `zeebe:input` produced two `<zeebe:input>` entries for the same target.
2. **`packages/connectors/src/apply.ts` / `apps/cli/src/commands/lint.ts`** — the deploy-lint's `connector/missing-required` check conflated "unknown value key" problems with "missing required value" problems, so a bundled template whose `id`-based property key differs from its raw `zeebe:input` binding name (e.g. SendGrid's `mailType` property, id `"mailType"`, bound to `"unMappedFieldNotUseInModel.mailType"`) produced a **false-positive** deploy-blocking error. `ApplyProblem` now carries a `kind` discriminant so only genuine `"missing-required"` problems feed the deploy gate.

## Baseline

Run this harness's plan-level subset before/after future changes to the plan compiler, optimizer, or connector catalog to catch regressions the unit test suites don't — e.g. a connector template update changing a required-field set, or an optimizer change introducing a new deploy-profile false positive.
