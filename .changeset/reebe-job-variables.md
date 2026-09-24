---
"@bpmnkit/reebe-wasm": patch
---

An activated job now carries the variables visible from its element — the process variables, enclosing scopes and its own input mappings, inner scopes winning — as Zeebe hands them to a worker. Every job used to carry `{}`, so a worker running against Reebe received no process variables.
