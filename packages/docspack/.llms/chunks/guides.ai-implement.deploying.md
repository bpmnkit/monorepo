# Building Processes with AI — Deploying

```
Deploy to local Reebe, deploy to Camunda 8, or skip?
```

- **Local Reebe** — deploys via `ZEEBE_ADDRESS` (default `http://localhost:26500`). Start Reebe first: `casen reebe start --port 26500`.
- **Camunda 8** — deploys using the active `casen` profile. Set one up with `casen profile create`.
- **Skip** — leaves the plan and BPMN file on disk for manual review and deployment.


## Implementing workers

Each scaffolded worker uses `@bpmnkit/worker-client`'s real polling API:

```typescript
// workers/validate-invoice/index.ts
import { createWorkerClient } from "@bpmnkit/worker-client"

const client = createWorkerClient({ workerName: "validate-invoice-worker" })

for await (const job of client.poll("validate-invoice:1")) {
  try {
    // TODO: implement invoice validation
    await job.complete({ /* output variables */ })
  } catch (err) {
    await job.fail(String(err))
  }
}
```

Start a worker for development:

```sh
cd workers/validate-invoice
npm install
npm start
```

Or start all workers at once:

```sh
casen worker start
```

See [Standalone Workers](/guides/workers-standalone/) for deployment options.

---
Source: https://docs.bpmnkit.com/guides/ai-implement/
