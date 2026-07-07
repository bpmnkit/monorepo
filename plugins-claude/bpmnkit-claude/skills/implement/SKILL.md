---
name: implement
description: Implement a BPMN process end-to-end from a natural language description — writes a ProcessPlan, compiles it deterministically, tests it, and offers to deploy. Usage: /bpmnkit:implement <description>
---

Implement a BPMN process for: $ARGUMENTS

You never write BPMN XML by hand. Every step below produces or consumes a `ProcessPlan` JSON file, compiled deterministically by `casen synth`.

Before starting, read `references/plan-format.md`. If the request involves any external system (Slack, email, HTTP, a database, cloud service, etc.), also read `references/connectors.md`. If it involves an AI agent / LLM-in-the-loop step, also read `references/agentic.md`. Read `references/modeling-style.md` for naming conventions. Skim `references/feel.md` whenever you write a gateway condition or any FEEL expression.

## 1. Clarify only genuinely ambiguous requirements

If the description is clear enough to model, don't ask anything — proceed. If something is genuinely ambiguous (e.g. "notify the team" without saying how, or a missing decision threshold), batch every question into one turn. Don't ask about things you can reasonably default (element naming, retry counts).

## 2. Check for a reusable domain pattern

```sh
casen pattern list
casen pattern get <id-or-description>
```

If a pattern matches the domain (e.g. invoice approval, employee onboarding), use its `readme` (regulatory/domain considerations) and `workers` (realistic job specs) as context while writing the plan in step 3. Its `template` field is a rough structural reference in an older compact-diagram shape, not a `ProcessPlan` — don't paste it in as-is. No match is normal; proceed without one.

## 3. Resolve external interactions

For each external system interaction the process needs:

```sh
casen connector search "<system name or capability>"
casen connector show <template-id>
```

Use the required/optional input keys from `show` output to build the plan's `connector.values`. Never guess a property key — if `search` finds nothing, fall back to a plain `jobType` step (a scaffolded worker will be needed — see step 7).

## 4. Write the plan

Write `<slug>.plan.json` following `references/plan-format.md`. Naming and structure follow `references/modeling-style.md`. Give every step and boundary a clear name.

## 5. Compile

```sh
casen synth <slug>.plan.json --output <slug>.bpmn
```

If problems are reported, they're keyed by JSON path (e.g. `steps[2].connector.values.token`) — fix the **plan**, never hand-edit the XML, and re-run. Bound this to 2 retries; if still failing, surface the problems to the user instead of guessing further.

## 6. Test

If the plan didn't already include a `tests` array, add scenarios covering the happy path and every gateway branch / error boundary, then re-run step 5 (synth writes `<slug>.bpmn.tests.json` from `plan.tests` automatically). Run:

```sh
casen test <slug>.bpmn
```

## 7. Scaffold missing workers

For every `serviceTask`/tool step whose `jobType` has no existing worker (no connector was used and no prior scaffold exists), write a worker stub at `workers/<job-type-slug>/index.ts` using the real `@bpmnkit/worker-client` API:

```typescript
import { createWorkerClient } from "@bpmnkit/worker-client"

const client = createWorkerClient({ workerName: "<job-type-slug>-worker" })

for await (const job of client.poll("<job-type>")) {
  try {
    // TODO: implement the job logic
    await job.complete({ /* output variables */ })
  } catch (err) {
    await job.fail(String(err))
  }
}
```

## 8. Summarize

Print a summary: element count, connectors used (and which secrets they need — never their values), worker coverage (reused vs. scaffolded), test pass/fail counts.

## 9. Ask about deployment

Ask: **"Deploy to local Reebe, deploy to Camunda 8, or skip?"**

- local: `casen deploy deploy <slug>.bpmn`
- camunda8: `casen deploy deploy <slug>.bpmn --target camunda8`
- skip: done

Before a local deploy, make sure Reebe is reachable — if not, tell the user to run `casen reebe start --port 26500` (the default `ZEEBE_ADDRESS` local reebe deploys against) in another terminal first.
