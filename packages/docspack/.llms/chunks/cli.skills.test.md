# AIKit Skills — `/test`

Run scenario tests on a BPMN process and report path/branch coverage.

```
/test invoice-approval.bpmn
```

**What it does:**

1. Looks for the `<file>.bpmn.tests.json` sidecar (written automatically by `casen synth` from a plan's `tests` array); writes one if missing
2. Runs `casen test <file>.bpmn`
3. Cross-references gateway branches and error/timer boundaries against which scenarios exercise them
4. Reports pass/fail counts and any uncovered paths

**Example output:**

```
| Scenario | Result | Details |
|----------|--------|---------|
| happy-path | ✓ PASS | (12ms) |
| rejection-path | ✓ PASS | (9ms) |

Uncovered paths:
- Boundary "sla-timeout" (timer, 48h) has no test scenario

2/2 scenarios passed. 1 boundary uncovered.
```

---

---
Source: https://bpmnkit.com/docs/cli/skills
