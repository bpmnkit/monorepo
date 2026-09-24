# @bpmnkit/worker-client — When the engine refuses a call

`complete`, `fail` and `throwError` reject when the engine answers with an error status — for
example because the job has timed out and been handed to another worker, or was cancelled. The
error message names the job key, the status and the response body. Catch it where you settle
the job if your worker should keep going:

```typescript
try {
  await job.complete({ sent: true })
} catch (err) {
  console.error(err instanceof Error ? err.message : err)
}
```

Before this change these calls resolved even when the engine had refused them, so a lost
completion went unnoticed.

---
Source: https://bpmnkit.com/docs/packages/worker-client
