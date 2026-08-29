# Building Processes with AI

BPMNKit's AI pipeline never asks an LLM to write BPMN XML. Every process is authored as a
`ProcessPlan` JSON file and compiled deterministically by `casen synth` — this is what makes
generated processes reliably valid, deployable, and easy to diff. The LLM's job is narrower and
more reliable: write the plan, resolve connectors, and fix reported problems.


## The pipeline

```
"implement X" (natural language)
        │
        ▼
  ProcessPlan JSON  ──casen synth──▶  laid-out, deployable .bpmn
        │                                    │
        │                            casen lint --profile deploy
        │                                    │
        └──casen plan extract◀────────  casen test
                (for later edits)
```

1. **Check for a reusable domain pattern** — `casen pattern list`/`get` (see [Pattern Library](/docs/guides/patterns)) surfaces domain context (regulations, conventions) and realistic worker specs, used as reference while writing the plan below — not pasted in as a `ProcessPlan` directly.
2. **Resolve external interactions** — `casen connector search "<system>"` / `casen connector show <template-id>` find the right Camunda connector template and its required inputs, instead of guessing property keys.
3. **Write the plan** — a `ProcessPlan` JSON file (`casen plan schema` prints the full format reference).
4. **Compile** — `casen synth <plan>.json --output <file>.bpmn`. Problems are reported keyed by JSON path (e.g. `steps[2].connector.values.token`) — fix the plan, never the XML, and re-run.
5. **Test** — a `tests` array in the plan compiles to a `<file>.bpmn.tests.json` sidecar automatically; run it with `casen test <file>.bpmn`.
6. **Deploy-readiness gate** — `casen lint <file>.bpmn --profile deploy` must report zero errors before deploying.
7. **Deploy** — `casen deploy deploy <file>.bpmn` (local Reebe) or `--target camunda8`.

---
Source: https://bpmnkit.com/docs/guides/ai-implement
