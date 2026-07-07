---
name: deploy
description: Deploy a BPMN process to local reebe or Camunda 8. Usage: /bpmnkit:deploy [file.bpmn] [--local|--camunda]
---

Deploy the BPMN process: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS:
   - Extract filename (ends in `.bpmn`). If not provided, find the single `.bpmn` file in cwd (or ask).
   - Extract target flag: `--local` or `--camunda`. Default: `--local`.
2. Call `bpmn_deploy` MCP tool with:
   - `path`: the file path (not file contents — the tool reads the file itself)
   - `target`: `"local"` or `"camunda8"` based on the flag
3. Show the deployment result:
   ```
   Deployed: <process-id>  version: <N>  target: <local|camunda8>
   ```
5. Verify by running `casen process-definition list --output json` via Bash and showing the matching row.
6. If deploy fails with a connection error, suggest: "Start the proxy with `casen proxy start`, or for Camunda check your endpoint config."
