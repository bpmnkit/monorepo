# Standalone Workers — Anatomy of a worker

```typescript
// workers/send-invoice/index.ts
import { createWorkerClient } from "@bpmnkit/worker-client"

const JOB_TYPE = "com.example:send-invoice:1"
const WORKER_NAME = "send-invoice"

const client = createWorkerClient({ workerName: WORKER_NAME })

interface Inputs {
  invoiceId: unknown // Invoice ID to send
  recipientEmail: unknown // Recipient email address
}

interface Outputs {
  // (no outputs defined)
}

async function handle(variables: Inputs): Promise<Outputs> {
  // TODO: implement send invoice logic
  throw new Error("Not implemented")
}

console.log(`[${WORKER_NAME}] polling ${JOB_TYPE}`)

for await (const job of client.poll(JOB_TYPE)) {
  try {
    const outputs = await handle(job.variables as Inputs)
    await job.complete(outputs)
    console.log(`[${WORKER_NAME}] completed ${job.key}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await job.fail(msg, job.retries - 1)
    console.error(`[${WORKER_NAME}] failed ${job.key}: ${msg}`)
  }
}
```

---
Source: https://docs.bpmnkit.com/guides/workers-standalone/
