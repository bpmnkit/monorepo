---
"@bpmnkit/worker-client": minor
---

- `job.fail(message)` now defaults `retries` to `job.retries - 1` (never below 0), so the engine retries until the task's retries are used up. It used to default to `0`, which raised an incident on the first failure. Pass `0` explicitly for the old behaviour.
- `poll()` no longer retries forever on errors retrying cannot fix. Rejected credentials (a 4xx from the token endpoint) or a 4xx from the engine end the loop: the generator throws with the status and response body. Transient errors (network, 408, 429, 5xx) are still retried and are now reported to the new `onError` option, by default as a warning on stderr.
- Activation long-polls with the new `requestTimeout` option (default 20 s); an idle worker still starts at most one poll every 5 seconds.
