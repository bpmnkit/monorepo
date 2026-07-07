---
name: deploy
description: Gate a BPMN process on deploy-readiness, then deploy it to local Reebe or Camunda 8. Usage: /bpmnkit:deploy [file.bpmn] [--local|--camunda]
---

Deploy the BPMN process: $ARGUMENTS

## 1. Determine target file and destination

Extract the `.bpmn` filename from $ARGUMENTS (find the single `.bpmn` in cwd, or ask, if not given). Extract `--local` or `--camunda`; default `--local`.

## 2. Gate on deploy-readiness

```sh
casen lint lint <file>.bpmn --profile deploy
```

If this reports any errors, **stop and fix them first** (or hand off to `/bpmnkit:review`) — do not deploy a process with deploy-profile errors.

## 3. Deploy

```sh
casen deploy deploy <file>.bpmn                     # local Reebe
casen deploy deploy <file>.bpmn --target camunda8   # active Camunda 8 profile
```

If local deploy fails to connect: tell the user to start Reebe first — `casen reebe start --port 26500` (matches the default `ZEEBE_ADDRESS` this command targets) — then retry.

If Camunda 8 deploy fails with "No active Camunda 8 profile": tell the user to run `casen profile create <name> --base-url <url> --auth-type bearer --token <token>` (or `casen profile import` from a Camunda Console credentials file), then `casen profile use <name>`, then retry.

## 4. Verify

```sh
casen process-definition list --output json
```

Show the row matching the deployed process id/version.

## 5. Summarize and remind

```
Deployed: <process-id>  version: <N>  target: <local|camunda8>
```

Remind the user: scaffolded workers still need to be started (`casen worker start`) and any secrets the process references (`{{secrets.NAME}}`) must be provisioned in the target engine's secret store before instances that reach them will succeed.
