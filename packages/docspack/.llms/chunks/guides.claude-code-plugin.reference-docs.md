# Claude Code Plugin — Reference docs

Every skill reads the relevant reference doc before authoring a plan:

| File | Contents |
|---|---|
| `references/plan-format.md` | The `ProcessPlan` JSON schema + annotated, tested examples |
| `references/connectors.md` | The 116-template Camunda connector catalog index |
| `references/agentic.md` | The AI Agent Sub-process pattern, binding keys, a full example |
| `references/feel.md` | FEEL syntax crib sheet + the `"="`-means-expression convention |
| `references/modeling-style.md` | Camunda naming/structure conventions |

---


## Agents

### `process-builder`

Builds a complete BPMN process end-to-end from a description. Invoke directly:

```
Build me an invoice approval process for accounts payable
```

**What it does:**

1. Asks clarifying questions (error paths, user tasks, deploy target)
2. Checks domain patterns (`casen pattern list`/`get`)
3. Resolves connectors, writes the plan
4. Compiles it with `casen synth`
5. Shows a preview and **waits for your approval**
6. Tests the process, fixing failures by adjusting the plan
7. Scaffolds a worker stub for every job type with no connector
8. Gates on `casen lint --profile deploy`, then deploys to the chosen target
9. Reports the process ID, files created, and next steps

---

### `incident-resolver`

Triages and resolves open Camunda incidents. Invoke directly:

```
Investigate and resolve the open incidents
```

**What it does:**

1. Fetches all open incidents (`casen incident list`)
2. Groups by process + error type, sorted by count
3. Investigates root cause per group
4. **Proposes a fix and waits for your approval** before executing
5. Executes approved fixes (retry jobs, resolve incidents, migrate instances)
6. Verifies the count dropped
7. Reports a resolution summary

---

---
Source: https://docs.bpmnkit.com/guides/claude-code-plugin/
