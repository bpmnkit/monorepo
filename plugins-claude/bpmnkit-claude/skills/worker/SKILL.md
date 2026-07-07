---
name: worker
description: Scaffold a TypeScript worker file for a BPMN service task job type. Usage: /bpmnkit:worker <job-type>
---

Scaffold a worker for job type: $ARGUMENTS

Steps:
1. Parse $ARGUMENTS to get the job type string (e.g. `order-validator`, `send-email`).
2. Call `worker_scaffold` MCP tool with `jobType: "<job-type>"`. It returns a TypeScript worker file using `@bpmnkit/worker-client`.
3. Create a `workers/` directory if it doesn't exist (check with Bash: `ls workers/ 2>/dev/null || mkdir workers`).
4. Write the result to `workers/<job-type>.ts` using the Write tool.
5. Show the generated file contents.
6. Print next steps:
   ```
   Next steps:
   1. Edit workers/<job-type>.ts — implement the job logic
   2. Run the worker: node workers/<job-type>.ts
   3. Or start all workers: casen worker start
   ```

If `worker_scaffold` is unavailable, generate this template directly:

```typescript
import { createWorkerClient } from "@bpmnkit/worker-client"

const JOB_TYPE = "<job-type>"

const client = createWorkerClient({ workerName: "<job-type>-worker" })

async function run() {
  for await (const job of client.poll(JOB_TYPE)) {
    try {
      const variables = job.variables

      // TODO: implement job logic

      await job.complete({ /* output variables */ })
    } catch (err) {
      await job.fail(String(err))
    }
  }
}

run().catch(console.error)
```
