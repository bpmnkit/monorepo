# Drop — Share & Co-edit — Running your own

Drop is a single Cloudflare Worker in the monorepo (`apps/drop`), MIT-licensed like
everything else. Files live in D1 as the typed `@bpmnkit/core` model alongside the
byte-faithful original; presence and live editing are a Durable Object per share.

```sh
pnpm --filter @bpmnkit/drop build
wrangler d1 migrations apply bpmnkit-drop --local
wrangler dev --local --port 8787 \
  --var DROP_ADMIN_TOKEN:devtoken --var REPORT_IP_SALT:devsalt
```

That runs the Worker, D1 and the Durable Object in a local simulator, so the whole app works
offline with no Cloudflare account. For a real deployment,
`pnpm --filter @bpmnkit/drop provision` is an idempotent script that creates the database,
applies the migrations, builds the client bundles and deploys the Worker; re-running it
skips whatever is already in place. See `apps/drop/DEPLOY.md` for the full runbook.

---
Source: https://bpmnkit.com/docs/guides/drop
