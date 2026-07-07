---
name: test
description: Run scenario tests on a BPMN process file and report path coverage. Usage: /bpmnkit:test [file.bpmn]
---

Run scenario tests: $ARGUMENTS

## 1. Determine target file and scenarios

Extract the `.bpmn` filename from $ARGUMENTS, or find the single `.bpmn` in cwd, or ask. Look for a sidecar `<file>.bpmn.tests.json` next to it (written automatically by `casen synth` from a plan's `tests` array). If it doesn't exist:

- If a `.plan.json` for this file exists (or can be produced via `casen plan extract <file>.bpmn`), add a `tests` array covering the happy path and every gateway branch / error boundary (see `references/plan-format.md`), then `casen synth <plan>.json --merge <file>.bpmn` to regenerate the sidecar.
- Otherwise, hand-write `<file>.bpmn.tests.json` directly: an array of `{ id, name, inputs?, mocks?: { [jobType]: { outputs? } | { error? } }, expect?: { path?, variables? } }`.

## 2. Run

```sh
casen test <file>.bpmn
```

## 3. Report

```
**Scenario Results**
| Scenario | Result | Details |
|----------|--------|---------|
| happy-path | ✓ PASS | (Nms) |
| error-path | ✗ FAIL | field: expected X, got Y |
```

## 4. Coverage

Cross-reference the process's gateway branches and error/timer boundaries against which scenarios' `expect.path` actually exercise them. Report any uncovered branch:

```
Uncovered paths:
- Gateway "check-stock" → branch "out-of-stock" has no test scenario
- Boundary "payment_error" (errorCode PAYMENT_FAILED) has no test scenario
```

## 5. Summary

"X/Y scenarios passed. N branch(es)/boundary(ies) uncovered."
