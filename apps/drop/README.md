# @bpmnkit/drop

BPMN Kit Drop — drop a BPMN, DMN, or Camunda Form file (or several) and get a short,
shareable link at `bpmnkit.com/drop/:shareId` that renders it read-only in the browser,
with a live "N viewing" indicator. Inspired by [Cloudflare Drop](https://www.cloudflare.com/drop/).

A single Cloudflare Worker serves the UI and API; files are stored in D1 as the typed
JSON model from `@bpmnkit/core` alongside the byte-faithful original; presence is a
Durable Object per share. The landing page is a live demo (whole-page drop target,
paste-to-drop, and a rendered hero diagram); a built-in **demo drop** is served from
memory (no D1 row) so a fresh deploy has a working example immediately. An optional,
closed-beta **AI process review** (Workers AI + `@bpmnkit/core`'s optimizer) is gated
behind an operator passcode. Design rationale: [`doc/drop-spec.md`](../../doc/drop-spec.md)
and [`doc/drop-v2-spec.md`](../../doc/drop-v2-spec.md).

## Layout

```
src/
  worker.ts        Worker entry: router + scheduled (retention) + PresenceRoom export
  presence.ts      Durable Object — hibernating-WebSocket viewer count
  env.ts           Binding types
  routes/          upload, share pages, raw/json download, reports, admin, ai-review
  lib/             ids, validate, meta, db (D1), http, pages (HTML), demo (in-memory
                   demo drop), review (deterministic optimizer pass), ai (Workers AI + cache)
  client/          browser bundles: drop, viewer, admin, landing (built to public/drop/assets)
  shared/          constants used by both Worker and client
migrations/        D1 schema (0001 core, 0002 AI review)
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
The built-in demo drop is at <http://localhost:8787/drop/demo-loan-approval>.

To exercise the **AI review** locally, add `--var AI_PASSCODE:devcode`. The passcode gate,
D1 caching, budget guard, and deterministic findings all work offline; the LLM narrative
itself needs a real Cloudflare account for the `AI` binding, so locally it gracefully
degrades to "automated checks only" with a note. Run `wrangler d1 migrations apply
bpmnkit-drop --local` after pulling to pick up the `0002_ai_review` tables.

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

## Deploy

Fastest path — after `wrangler login`, run the idempotent provisioning script, which
creates the D1 database, applies migrations, builds, deploys, and sets the secrets
(auto-generating the admin token and IP salt, prompting for the optional `AI_PASSCODE`):

```sh
pnpm --filter @bpmnkit/drop provision
```

### One-time setup (what the script automates)

1. `wrangler d1 create bpmnkit-drop` → copy the id into `wrangler.jsonc` (`database_id`).
2. `wrangler secret put DROP_ADMIN_TOKEN` — operator token for `/drop/admin` and admin API.
3. `wrangler secret put REPORT_IP_SALT` — salt for hashing reporter IPs.
4. Bump `TOS_VERSION` in `wrangler.jsonc` whenever the Terms/Privacy pages change.
5. Enable the `bpmnkit.com/drop*` route in `wrangler.jsonc` (`routes`).

**AI review (optional, closed beta):** unset by default — the feature is off and its
button never renders. To open it to invited users, `wrangler secret put AI_PASSCODE` and
share the code privately. Rotate the secret to lock everyone out; delete it to turn the
feature off. `AI_MODEL` and `AI_DAILY_BUDGET` (neurons/day) are tunable vars. Before
enabling in production, do one manual live run against the real `AI` binding to confirm
the model returns schema-valid JSON.

CI (`.github/workflows/deploy-drop.yml`) runs `d1 migrations apply` then `wrangler deploy`
on pushes to `main` that touch this app or its rendering dependencies.
