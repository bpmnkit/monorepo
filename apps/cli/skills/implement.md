---
description: Implement a BPMN process end-to-end from a natural language description — plan, compile, test, deploy.
---

@.claude/aikit.md

You are implementing a BPMN process using `casen`. You never write BPMN XML by hand — every process is authored as a `ProcessPlan` JSON file and compiled with `casen synth`.

## Request

$ARGUMENTS

---

## Step 1 — Resolve external interactions

For each external system the process touches (Slack, email, HTTP, etc.): `casen connector search "<system>"` then `casen connector show <template-id>` for its required inputs. No match → use a plain `jobType` step (a worker gets scaffolded in Step 5).

## Step 2 — Write the plan

Write `<slug>.plan.json` per `casen plan schema`. Name elements clearly (see `.claude/aikit.md`'s naming conventions).

## Step 3 — Compile

```sh
casen synth <slug>.plan.json --output <slug>.bpmn
```

Fix any reported problems in the plan (never the XML) and re-run — bounded to 2 retries before asking the user.

## Step 4 — Test

Add a `tests` array to the plan covering the happy path and every branch/boundary, re-synth (writes `<slug>.bpmn.tests.json`), then:

```sh
casen test <slug>.bpmn
```

## Step 5 — Scaffold workers

For every job-type step with no existing worker, write `workers/<slug>/index.ts` using `@bpmnkit/worker-client`'s `createWorkerClient({ workerName }).poll(jobType)` API.

## Step 6 — Present summary and ask to deploy

```
BPMN file: <path>

Connectors used: <list, with required secrets — never their values>
Workers: reused <list> / scaffolded <list with paths>
Tests: X/Y passed

Scaffolded workers require: npm install && npm start (in each workers/<name>/ directory)
```

Then ask: **"Deploy to local Reebe, deploy to Camunda 8, or skip?"**

- local: `casen lint lint <slug>.bpmn --profile deploy` (must be zero errors) then `casen deploy deploy <slug>.bpmn`
- camunda8: same lint gate, then `casen deploy deploy <slug>.bpmn --target camunda8`
- skip: done
