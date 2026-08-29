# @bpmnkit/worker-client — `client.poll(jobType, options?)`

Async generator. Continuously polls Zeebe for jobs of the given type. Pauses 5 seconds
between polls when no jobs are available.

```typescript
for await (const job of client.poll("my-job-type", { maxJobs: 10, timeout: 60_000 })) {
  // handle job
}
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `maxJobs` | `number` | `5` | Maximum jobs to activate per poll request |
| `timeout` | `number` | `300_000` | Activation lock timeout in milliseconds |

### Yields `ActivatedJob`

Each iteration yields a job with these fields and methods:

```typescript
interface ActivatedJob {
  key: string                            // unique job key
  jobType: string                        // job type from BPMN task definition
  processInstanceKey: string
  bpmnProcessId: string
  elementId: string
  retries: number                        // remaining retries — use to pass to fail()
  variables: Record<string, unknown>     // process variables from the instance

  complete(variables?: Record<string, unknown>): Promise<void>
  fail(message: string, retries?: number): Promise<void>
  throwError(errorCode: string, message: string, variables?: Record<string, unknown>): Promise<void>
}
```

---
Source: https://bpmnkit.com/docs/packages/worker-client
