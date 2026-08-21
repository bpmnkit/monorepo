# Standalone Workers

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

---
Source: https://docs.bpmnkit.com/guides/workers-standalone/
