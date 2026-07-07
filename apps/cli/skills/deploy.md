---
description: Gate a BPMN process on deploy-readiness, then deploy it to local Reebe or Camunda 8.
---

@.claude/aikit.md

Deploy the BPMN process: $ARGUMENTS

Extract the `.bpmn` filename (find the single `.bpmn` in cwd, or ask, if not given) and destination (`--local` default, or `--camunda`).

## Step 1 — Gate on deploy-readiness

```sh
casen lint lint <file>.bpmn --profile deploy
```

If this reports any errors, stop and fix them first (or run `/review`) — do not deploy with deploy-profile errors.

## Step 2 — Deploy

```sh
casen deploy deploy <file>.bpmn                     # local Reebe
casen deploy deploy <file>.bpmn --target camunda8   # active Camunda 8 profile
```

Local deploy unreachable → tell the user to run `casen reebe start --port 26500` first, then retry. Camunda 8 deploy with no active profile → tell the user to run `casen profile create <name> --base-url <url> --auth-type bearer --token <token>` then `casen profile use <name>`, then retry.

## Step 3 — Verify and summarize

```sh
casen process-definition list --output json
```

Report: `Deployed: <process-id>  version: <N>  target: <local|camunda8>`.

If any scaffolded workers exist in `./workers/`, remind: `casen worker start`. Remind about any `{{secrets.NAME}}` the process references — they must be provisioned in the target engine's secret store.
