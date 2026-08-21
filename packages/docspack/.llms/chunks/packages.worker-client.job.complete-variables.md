# @bpmnkit/worker-client — `job.complete(variables?)`

Completes the job, optionally returning output variables to the process instance.

```typescript
await job.complete({ approved: true, reviewedAt: new Date().toISOString() })
```


## `job.fail(message, retries?)`

Marks the job as failed. Zeebe will retry (or raise an incident if retries reach zero).
`retries` defaults to `0` if not provided — pass `job.retries - 1` to decrement.

```typescript
await job.fail("External API returned 503", job.retries - 1)
```


## `job.throwError(errorCode, message, variables?)`

Throws a BPMN error that can be caught by an error boundary event on the task in the diagram.

```typescript
await job.throwError("PAYMENT_DECLINED", "Card declined by issuer", { code: "05" })
```

---
Source: https://docs.bpmnkit.com/packages/worker-client/
