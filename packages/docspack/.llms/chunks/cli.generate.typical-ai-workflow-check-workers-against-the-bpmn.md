# casen generate — Typical AI workflow — Check workers against the BPMN

`--check-workers <glob>` scans TypeScript and JavaScript sources for job worker registrations. It
reports job types that have no worker, and workers whose job type no BPMN element uses. Add
`--strict` to exit 1 when there is a mismatch.

```sh
casen gen types processes/ --check-workers "src/**/*.ts" --strict
casen gen types processes/ --check-workers src,workers --format json
```

The scan is a heuristic. It finds a job type only when it is a string literal in one of these forms:

| Pattern | Client |
|---|---|
| `createWorker("type", …)` | zeebe-node (legacy) |
| `taskType: "type"` | zeebe-node, `@camunda8/sdk` |
| `.createJobWorker({ jobType: "type", … })` (or `type:`) | `@camunda8/orchestration-cluster-api` |
| `registerJobWorker("type", …)` | custom registries |
| `.poll("type")` | `@bpmnkit/worker-client` |

A job type held in a variable or built with `${…}` is not found. Job types that start with
`io.camunda` belong to Camunda connectors. The connector runtime runs them, so they are never
reported as missing a worker.

---
Source: https://bpmnkit.com/docs/cli/generate
