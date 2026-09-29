# @bpmnkit/worker-client

## 0.1.0

### Minor Changes

- 56ad670: Typed code generation from BPMN, and a worker contract check.

  `@bpmnkit/core` adds `generateProcessTypes(definitions | definitions[], options?)`, which returns TypeScript source, and `extractProcessContract`, which returns the same contract as data. Both are pure and deterministic. The source types the process ids and every static job type: its input variables, its output, its task headers as literal types, and the error codes that catch events handle. It also types message names (with correlation keys), signal names, error codes and escalation codes, and a `JobTypes` map for typed workers. Values are `unknown` and keys are exact. The typed workers guide documents the rules.

  `casen generate types` (`casen gen types`) writes the file from BPMN files, directories or globs. `--check` exits 1 when the file is stale. `--check-workers <glob>` reports BPMN job types that have no worker and worker registrations that match no job type. This scan is a heuristic. `--strict` makes it exit 1 on a mismatch.

  `@bpmnkit/worker-client`: `createWorkerClient<JobTypes>()` types `job.variables`, `job.complete()`, `job.throwError()` and the new `job.customHeaders` by job type. Without a type argument, the client is untyped as before.

- 56ad670: - `job.fail(message)` now defaults `retries` to `job.retries - 1` (never below 0), so the engine retries until the task's retries are used up. It used to default to `0`, which raised an incident on the first failure. Pass `0` explicitly for the old behaviour.
  - `poll()` no longer retries forever on errors retrying cannot fix. Rejected credentials (a 4xx from the token endpoint) or a 4xx from the engine end the loop: the generator throws with the status and response body. Transient errors (network, 408, 429, 5xx) are still retried and are now reported to the new `onError` option, by default as a warning on stderr.
  - Activation long-polls with the new `requestTimeout` option (default 20 s); an idle worker still starts at most one poll every 5 seconds.

### Patch Changes

- 56ad670: Each README now shows the package's product tier (Core, Tools or Experimental) and what that tier promises. The `@bpmnkit/reebe-wasm` README and description say that Reebe is a dev/test engine, not for production: a clean-room implementation of the Zeebe API, not affiliated with Camunda.
- 56ad670: `job.complete()`, `job.fail()` and `job.throwError()` now reject when the engine refuses the call (for example a 404 for a job that has already timed out, or a 401), with the job key, the status and the response body in the message. Before, they resolved as if the call had worked. A worker that awaits these calls without a `try` now stops on such an error, where before the failure was silent.

  The `fail()` doc comment now says what the package page already said: `retries` defaults to `0`, which raises an incident; pass `job.retries - 1` to let the engine retry.

## 0.0.6

### Patch Changes

- 9d412da: Coordinated release of every published package

  `@bpmnkit/core` carries fixes that have been on `main` since the last release but never
  shipped — `compactify()`/`expand()` keeping `<bpmn:documentation>` through the operations
  API (#150) among them, which is still reported as reproducing because the newest artifact
  on npm predates the fix. Bumping every publishable package releases the workspace as one
  set, so no consumer resolves a core that a sibling package was never built against.

  Nothing here changes behaviour beyond what each package's own changesets describe.

## 0.0.5

### Patch Changes

- 9cd1942: Improvements around AI integration

## 0.0.4

### Patch Changes

- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations

## 0.0.3

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

## 0.0.2

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation
