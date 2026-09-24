---
"@bpmnkit/core": minor
"@bpmnkit/cli": minor
"@bpmnkit/worker-client": minor
---

Typed code generation from BPMN, and a worker contract check.

`@bpmnkit/core` adds `generateProcessTypes(definitions | definitions[], options?)`, which returns TypeScript source, and `extractProcessContract`, which returns the same contract as data. Both are pure and deterministic. The source types the process ids and every static job type: its input variables, its output, its task headers as literal types, and the error codes that catch events handle. It also types message names (with correlation keys), signal names, error codes and escalation codes, and a `JobTypes` map for typed workers. Values are `unknown` and keys are exact. The typed workers guide documents the rules.

`casen generate types` (`casen gen types`) writes the file from BPMN files, directories or globs. `--check` exits 1 when the file is stale. `--check-workers <glob>` reports BPMN job types that have no worker and worker registrations that match no job type. This scan is a heuristic. `--strict` makes it exit 1 on a mismatch.

`@bpmnkit/worker-client`: `createWorkerClient<JobTypes>()` types `job.variables`, `job.complete()`, `job.throwError()` and the new `job.customHeaders` by job type. Without a type argument, the client is untyped as before.
