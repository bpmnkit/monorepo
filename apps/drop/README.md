# @bpmnkit/drop

BPMN Kit Drop — drop a BPMN, DMN, or Camunda Form file (or several) and get a short,
shareable link at `bpmnkit.com/drop/:shareId` that renders it read-only in the browser,
with a live "N viewing" indicator. Inspired by [Cloudflare Drop](https://www.cloudflare.com/drop/).

A single Cloudflare Worker serves the UI and API; files are stored in D1 as the typed
JSON model from `@bpmnkit/core` alongside the byte-faithful original; presence is a
Durable Object per share. Design rationale: [`doc/drop-spec.md`](../../doc/drop-spec.md).

## Layout

```
src/
  worker.ts        Worker entry: router + scheduled (retention) + PresenceRoom export
  presence.ts      Durable Object — hibernating-WebSocket viewer count
  env.ts           Binding types
  routes/          upload, share pages, raw/json download, reports, admin
  lib/             ids, validate (parse via @bpmnkit/core), meta, db (D1), http, pages (HTML)
  client/          browser bundles: drop.ts, viewer.ts, admin.ts (built to public/drop/assets)
  shared/          constants used by both Worker and client
migrations/        D1 schema
```

## Develop

```sh
pnpm --filter @bpmnkit/drop build       # bundle client (esbuild) + build workspace deps
pnpm --filter @bpmnkit/drop typecheck   # worker (workers-types) + client (DOM) tsconfigs
pnpm --filter @bpmnkit/drop test        # vitest — validation, ids, security regressions
pnpm --filter @bpmnkit/drop check       # biome
```

## Run it locally (no Cloudflare account)

`wrangler dev` runs the Worker, D1, and the Durable Object in a local simulator, so the
whole app works offline. From `apps/drop`:

```sh
pnpm build                                        # produce public/drop/assets/*.js
wrangler d1 migrations apply bpmnkit-drop --local # create the local SQLite schema
wrangler dev --local --port 8787 \
  --var DROP_ADMIN_TOKEN:devtoken --var REPORT_IP_SALT:devsalt
```

Then open <http://localhost:8787/drop>, drop a file from `bpmn-samples/`, and follow the
short link. The admin page is at <http://localhost:8787/drop/admin> (paste `devtoken`).

Quick API smoke test:

```sh
# upload → returns { shareId, url, files }
curl -s -X POST http://localhost:8787/drop/api/drops \
  -F files=@../../bpmn-samples/order-process.bpmn
# then, with the shareId:
curl -s http://localhost:8787/drop/<shareId>/manifest.json
curl -s "http://localhost:8787/drop/<shareId>/f/order-process.bpmn"          # original
curl -s "http://localhost:8787/drop/<shareId>/f/order-process.bpmn?format=json"  # model
```

The local D1 lives under `.wrangler/state` (gitignored); delete it to reset.

## Deploy (one-time setup)

1. `wrangler d1 create bpmnkit-drop` → copy the id into `wrangler.jsonc` (`database_id`).
2. `wrangler secret put DROP_ADMIN_TOKEN` — operator token for `/drop/admin` and admin API.
3. `wrangler secret put REPORT_IP_SALT` — salt for hashing reporter IPs.
4. Bump `TOS_VERSION` in `wrangler.jsonc` whenever the Terms/Privacy pages change.
5. Enable the `bpmnkit.com/drop*` route in `wrangler.jsonc` (`routes`).

CI (`.github/workflows/deploy-drop.yml`) runs `d1 migrations apply` then `wrangler deploy`
on pushes to `main` that touch this app or its rendering dependencies.
