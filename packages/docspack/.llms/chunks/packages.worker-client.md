# @bpmnkit/worker-client

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

---
Source: https://bpmnkit.com/docs/packages/worker-client
