# Building Processes with AI — Lightweight alternative: `casen skills install`

If you don't want the full plugin, four minimal slash commands are available directly from the CLI — see [AIKit Skills](/docs/cli/skills):

```sh
casen skills install
```

This installs `/implement`, `/review`, `/test`, `/deploy` into `.claude/commands/`. Same underlying pipeline, less scaffolding around it (no `/extend`/`/agent`/`/connect`, no generated reference docs).


## What gets created

```
project/
  invoice-approval.plan.json         ← the source of truth — edit this, not the XML
  invoice-approval.bpmn              ← compiled by casen synth
  invoice-approval.bpmn.tests.json   ← scenarios, if the plan had a `tests` array
  workers/
    validate-invoice/
      index.ts                       ← implement the job logic here
      package.json
      tsconfig.json
      README.md
```

---
Source: https://bpmnkit.com/docs/guides/ai-implement
