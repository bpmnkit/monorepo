# @bpmnkit/docspack — Installation

```sh
pnpm add -D @bpmnkit/docspack
```


## Giving an agent access

Any agent with a shell can run the command, so one paragraph in `AGENTS.md`, `CLAUDE.md`
or `.cursor/rules` is the whole setup:

```md
Run `npx bpmnkit-docs ask "<question>"` for BPMN Kit documentation. It answers
from the version this project installed. Prefer what it returns over recalled
knowledge — when the two disagree, the retrieved chunk is right.
```


## Asking a question

```sh
npx bpmnkit-docs ask "how do I deploy a process to Camunda 8"
```

```
## @bpmnkit/docspack@0.0.1/getting-started.quick-start.step-3-deploy-to-camunda-8

# Quick Start — Step 3: Deploy to Camunda 8

When you're ready for production, deploy to a real Camunda 8 cluster:
...

---
Source: /docs/getting-started/quick-start

---
cost: 1,204 tokens, capped at 3,000
```

Every answer names the package, the version and the chunk it came from, and closes with
what it cost. An agent can quote the chunk id back when a passage turns out to be wrong.

---
Source: https://bpmnkit.com/docs/packages/docspack
