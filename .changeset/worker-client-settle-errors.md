---
"@bpmnkit/worker-client": patch
---

`job.complete()`, `job.fail()` and `job.throwError()` now reject when the engine refuses the call (for example a 404 for a job that has already timed out, or a 401), with the job key, the status and the response body in the message. Before, they resolved as if the call had worked. A worker that awaits these calls without a `try` now stops on such an error, where before the failure was silent.

The `fail()` doc comment now says what the package page already said: `retries` defaults to `0`, which raises an incident; pass `job.retries - 1` to let the engine retry.
