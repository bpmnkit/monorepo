---
title: Standalone Workers
description: Build, run, and deploy TypeScript workers that connect to Zeebe without any BPMNKit dependency.
sidebar:
  order: 6
---

Workers are TypeScript programs that poll Zeebe for jobs and execute business logic.
They depend only on `@bpmnkit/worker-client` — no BPMNKit SDK required at runtime.
Run them anywhere: terminal, Docker, serverless, or via `casen worker start`.

## Scaffold a worker

The fastest way to get a worker is via the `/implement` skill, which scaffolds workers for
every service task in a generated process. You can also scaffold manually using the MCP tool:

```
Call worker_scaffold with jobType: "com.example:send-invoice:1"
```

Or generate one directly from Claude Code:

```
/implement a worker that sends invoices via SendGrid
```

Either way, the result is a directory in `./workers/`:

```
workers/
  send-invoice/
    index.ts          ← implement handle() here
    package.json
    tsconfig.json
    README.md
```

## Anatomy of a worker

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

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `ZEEBE_ADDRESS` | no | Zeebe REST base URL (default: `http://localhost:26500`) |
| `ZEEBE_CLIENT_ID` | Camunda SaaS only | OAuth2 client ID |
| `ZEEBE_CLIENT_SECRET` | Camunda SaaS only | OAuth2 client secret |
| `ZEEBE_TOKEN_URL` | no | OAuth2 token URL (default: Camunda SaaS endpoint) |
| `ZEEBE_TOKEN_AUDIENCE` | no | OAuth2 audience (default: `zeebe.camunda.io`) |

For local development with reebe, only `ZEEBE_ADDRESS` matters (or leave it at the default).

## Running workers

### Development (tsx, no build step)

```sh
cd workers/send-invoice
npm install
npm start          # runs: tsx index.ts
```

### Production (compiled JS)

```sh
cd workers/send-invoice
npm install
npm run build      # runs: tsc
npm run start:prod # runs: node dist/index.js
```

### All workers at once

```sh
casen worker start
```

To start a specific worker:

```sh
casen worker start send-invoice
```

## Docker

Each scaffolded worker includes a multi-stage `Dockerfile` recipe in its README:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY index.ts tsconfig.json ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
CMD ["node", "dist/index.js"]
```

Build and run:

```sh
docker build -t my-org/send-invoice .
docker run -e ZEEBE_ADDRESS=http://reebe:26500 my-org/send-invoice
```

## Camunda SaaS

For Camunda 8 cloud, pass OAuth2 credentials as environment variables:

```sh
ZEEBE_ADDRESS=https://your-cluster.bru-2.zeebe.camunda.io:443 \
ZEEBE_CLIENT_ID=... \
ZEEBE_CLIENT_SECRET=... \
npm run start:prod
```

`@bpmnkit/worker-client` handles OAuth2 token fetching and caching automatically.

## Listing available workers

```sh
casen worker start --help
```

Or from Claude Code, call `worker_list` to see all built-in and scaffolded workers:

```
worker_list()
```

Built-in workers (provided by the proxy):

| Job type | Description |
|---|---|
| `bpmnkit:llm:1` | Call an LLM and return the response text |
| `bpmnkit:cli:1` | Run a shell command |
| `bpmnkit:http:scrape:1` | Fetch and extract text from a URL |
| `bpmnkit:fs:read:1` | Read a file from the local filesystem |
| `bpmnkit:fs:write:1` | Write content to a file |
| `bpmnkit:fs:append:1` | Append content to a file |
| `bpmnkit:fs:list:1` | List files in a directory |
| `bpmnkit:js:1` | Evaluate a JavaScript expression |
| `bpmnkit:email:fetch:1` | Fetch email from an IMAP mailbox |
| `bpmnkit:email:send:1` | Send email via SMTP |

## See also

- [`@bpmnkit/worker-client`](/docs/packages/worker-client) — full API reference
- [AI-Driven Implementation](/docs/guides/ai-implement) — scaffold workers as part of `/implement`
