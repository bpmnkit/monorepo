# Testing Processes — Jobs

Each job type in the deployed BPMN gets a worker. What the worker does depends on whether
the type has a mock:

- **Mocked**: the mock handles the job.
- **Not mocked**: the job waits. You complete it with `run.completeJob(...)`, as Zeebe
  would wait for a worker.

```typescript
t.mockJob("payment", { result: { paid: true } })                   // complete with variables
t.mockJob("payment", { fail: "card declined" })                    // fail the job
t.mockJob("payment", { throwError: { code: "DECLINED" } })         // throw a BPMN error
t.mockJob("payment", (job) => ({ paid: job.variables.amount < 100 })) // compute; throw to fail

const payment = t.mockJob("payment", { result: { paid: true } })
payment.calls           // every job the mock handled: elementId, variables, headers, ...
payment.restore()       // later jobs of this type wait for completeJob again
```

To drive a waiting job, name its element id or its job type:

```typescript
run.jobs                                   // [{ elementId: "ship", type: "ship", ... }]
await run.completeJob("ship", { trackingId: "1Z999" })
await run.failJob("ship", "carrier down")
await run.throwError("ship", "NO_STOCK", "Out of stock")
```

A Camunda user task (`zeebe:userTask`, no job type) is a job of type `userTask`. Complete
it by its element id: `await run.completeJob("review", { approved: true })`. If no job is
waiting at the id, the error lists the jobs and elements that are waiting.

---
Source: https://bpmnkit.com/docs/guides/testing-processes
