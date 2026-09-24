# @bpmnkit/worker-client — `client.poll(jobType, options?)`

Async generator. Continuously polls Zeebe for jobs of the given type. Each activation request
long-polls: the engine holds it open for up to `requestTimeout` until a job is available. When
a poll comes back empty, the next one starts at least 5 seconds after it began.

Transient failures — a network error, `408`, `429`, a `5xx`, or a token endpoint that is down —
are passed to `onError` and retried. Anything retrying cannot fix, such as credentials the
token endpoint rejects or a `401`/`403`/`400` from the engine, ends the loop: the generator
throws, so a worker with a wrong secret stops with a message instead of idling forever.

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
| `requestTimeout` | `number` | `20_000` | How long the engine may hold an activation request open (long polling), in ms; `0` uses the engine default |
| `onError` | `(error: Error) => void` | warning on stderr | Called with each transient error before the poll is retried |

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
