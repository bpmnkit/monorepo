# @bpmnkit/worker-client — `job.complete(variables?)`

Completes the job, optionally returning output variables to the process instance.

```typescript
await job.complete({ approved: true, reviewedAt: new Date().toISOString() })
```


## `job.fail(message, retries?)`

Marks the job as failed. `retries` is how many retries the job has left afterwards. It
defaults to `job.retries - 1` (never below `0`), so Zeebe retries until the task's retries are
used up and then raises an incident. Pass `0` to raise the incident at once.

```typescript
await job.fail("External API returned 503")        // one retry fewer
await job.fail("Invalid customer record", 0)       // incident now: retrying will not help
```

---
Source: https://bpmnkit.com/docs/packages/worker-client
