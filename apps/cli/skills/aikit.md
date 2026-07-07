# BPMNKit — Reference

This file is installed to `.claude/aikit.md` by `casen skills install`. The skill files (`/implement`, `/review`, `/test`, `/deploy`) reference it with `@.claude/aikit.md`.

These are lightweight, CLI-only slash commands. For the full skill set — `/bpmnkit:implement`, `/bpmnkit:extend`, `/bpmnkit:agent`, `/bpmnkit:connect`, plus generated reference docs (`plan-format.md`, `connectors.md`, `agentic.md`, `feel.md`) — install the Claude Code plugin instead:

```sh
/plugin marketplace add github:bpmnkit/monorepo
/plugin install bpmnkit
```

---

## The pipeline

Every process is authored as a `ProcessPlan` JSON file, never hand-written BPMN XML:

```
<name>.plan.json  →  casen synth  →  <name>.bpmn (+ <name>.bpmn.tests.json if plan.tests is set)
```

`casen plan schema` prints the full `ProcessPlan` format reference. `casen plan extract <file>.bpmn` lifts an existing process back into plan form (for `/extend`-style changes).

## Key commands

| Command | Does |
|---|---|
| `casen plan schema` | Print the `ProcessPlan` JSON format reference |
| `casen plan extract <file>.bpmn` | Lift an existing process into `<file>.plan.json` |
| `casen synth <plan>.json --output <file>.bpmn` | Compile a plan to laid-out, deployable BPMN |
| `casen synth <plan>.json --merge <file>.bpmn --output <file>.bpmn` | Compile a delta plan and merge it into an existing process |
| `casen connector search "<query>"` | Find a Camunda connector template by name/keyword |
| `casen connector show <template-id>` | Required/optional input keys, task type, direction |
| `casen lint lint <file>.bpmn` | Full static analysis (all categories) |
| `casen lint lint <file>.bpmn --profile deploy` | Deploy-readiness gate — errors only |
| `casen lint lint <file>.bpmn --fix` | Apply auto-fixable findings, write back |
| `casen test <file>.bpmn` | Run scenarios from `<file>.bpmn.tests.json` |
| `casen deploy deploy <file>.bpmn [--target camunda8]` | Deploy to local Reebe (default) or Camunda 8 |
| `casen worker start` | Start every scaffolded worker in `./workers/` |

## Conventions

- A value starting with `=` is a FEEL expression; without it, it's a literal string.
- Secrets always use the `{{secrets.NAME}}` placeholder — never a literal credential.
- Every plan step's `id`/`name` should follow Camunda naming conventions ("Verb Object" tasks, "Object + past participle" start events, "?" gateway questions) — see the full plugin's `references/modeling-style.md` for the complete list.
- Worker stubs use `@bpmnkit/worker-client`'s `createWorkerClient({ workerName }).poll(jobType)` API, written to `workers/<slug>/index.ts`.
