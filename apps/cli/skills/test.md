---
description: Run scenario tests on a BPMN process file and report path coverage.
---

@.claude/aikit.md

Run scenario tests: $ARGUMENTS

If no file is given, find the single `.bpmn` in cwd or ask.

## Step 1 — Ensure scenarios exist

Look for `<file>.bpmn.tests.json` (written automatically by `casen synth` from a plan's `tests` array). If missing: `casen plan extract <file>.bpmn`, add a `tests` array covering the happy path and every branch/boundary, then `casen synth <plan>.json --merge <file>.bpmn` to regenerate it — or hand-write the sidecar directly (array of `{ id, name, inputs?, mocks?, expect? }`).

## Step 2 — Run

```sh
casen test <file>.bpmn
```

## Step 3 — Report

```
| Scenario | Result | Details |
|----------|--------|---------|
| happy-path | ✓ PASS | (Nms) |
| error-path | ✗ FAIL | field: expected X, got Y |
```

## Step 4 — Coverage

Cross-reference gateway branches and error/timer boundaries against which scenarios exercise them; report anything uncovered.

## Step 5 — Summary

"X/Y scenarios passed. N branch(es)/boundary(ies) uncovered."
