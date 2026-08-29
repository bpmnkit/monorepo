---
title: "@bpmnkit/worker-client"
description: Thin Zeebe REST client for standalone workers — no BPMNKit SDK required at runtime.
sidebar:
  order: 6
---

`@bpmnkit/worker-client` is a thin TypeScript wrapper around the Zeebe REST API. It is the
only runtime dependency for scaffolded BPMNKit workers. It works with both local reebe and
Camunda 8 cloud.

## Installation

```sh
npm install @bpmnkit/worker-client
```

## Quick start

```typescript
import { createWorkerClient } from "@bpmnkit/worker-client"

const client = createWorkerClient()

for await (const job of client.poll("com.example:send-email:1")) {
  try {
    await sendEmail(job.variables)
    await job.complete({ sent: true })
  } catch (err) {
    await job.fail(err instanceof Error ? err.message : String(err))
  }
}
```

## `createWorkerClient(options?)`

Factory function. Reads connection details from environment variables by default.

```typescript
const client = createWorkerClient({
  address:      "http://localhost:26500",  // or ZEEBE_ADDRESS
  clientId:     "...",                     // or ZEEBE_CLIENT_ID
  clientSecret: "...",                     // or ZEEBE_CLIENT_SECRET
  tokenUrl:     "...",                     // or ZEEBE_TOKEN_URL
  audience:     "zeebe.camunda.io",        // or ZEEBE_TOKEN_AUDIENCE
  workerName:   "my-worker",              // sent during job activation
})
```

### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `address` | `string` | `ZEEBE_ADDRESS` or `http://localhost:26500` | Zeebe REST base URL |
| `clientId` | `string` | `ZEEBE_CLIENT_ID` | OAuth2 client ID (Camunda SaaS) |
| `clientSecret` | `string` | `ZEEBE_CLIENT_SECRET` | OAuth2 client secret (Camunda SaaS) |
| `tokenUrl` | `string` | `ZEEBE_TOKEN_URL` or Camunda SaaS endpoint | OAuth2 token URL |
| `audience` | `string` | `ZEEBE_TOKEN_AUDIENCE` or `zeebe.camunda.io` | OAuth2 audience |
| `workerName` | `string` | `"bpmnkit-worker"` | Worker name sent during activation |

### Returns

A `WorkerClient` object with a single `poll()` method.

## `client.poll(jobType, options?)`

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

## `job.complete(variables?)`

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

## OAuth2 (Camunda SaaS)

When `clientId` and `clientSecret` are present (either via options or env vars), the client
fetches an OAuth2 token before the first request and refreshes it automatically 60 seconds
before expiry. No manual token management required.

```sh
ZEEBE_ADDRESS=https://your-cluster.bru-2.zeebe.camunda.io:443
ZEEBE_CLIENT_ID=abc123
ZEEBE_CLIENT_SECRET=def456
node dist/index.js
```

## Environment variables

| Variable | Description |
|---|---|
| `ZEEBE_ADDRESS` | Zeebe REST base URL |
| `ZEEBE_CLIENT_ID` | OAuth2 client ID |
| `ZEEBE_CLIENT_SECRET` | OAuth2 client secret |
| `ZEEBE_TOKEN_URL` | OAuth2 token URL |
| `ZEEBE_TOKEN_AUDIENCE` | OAuth2 audience |

## See also

- [Standalone Workers](/docs/guides/workers-standalone) — scaffolding, running, and deploying workers
- [AI-Driven Implementation](/docs/guides/ai-implement) — generate workers automatically with `/implement`
