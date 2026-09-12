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
  worker.ts        Worker entry: router + scheduled (retention) + DocRoom export
  room.ts          Durable Object — hibernating-WebSocket viewer count, and the
                   batched view/retention write it flushes to D1 on an alarm
  env.ts           Binding types
  routes/          upload, share pages, raw/json download, reports, admin, ai-review,
                   versions (history + restore)
  lib/             ids, validate, meta, db (D1), versions (the milestone ring), http,
                   pages (HTML), demo (in-memory demo drop), review (deterministic
                   optimizer pass), ai (Workers AI + cache)
  client/          browser bundles: drop, viewer, admin, landing (built to public/drop/assets)
  shared/          constants used by both Worker and client
migrations/        D1 schema (0001 core, 0002 AI review, 0003 version log)
```

## Develop

```sh
pnpm --filter @bpmnkit/drop build       # bundle client (esbuild) + build workspace deps
pnpm --filter @bpmnkit/drop typecheck   # worker (workers-types) + client (DOM) tsconfigs
pnpm --filter @bpmnkit/drop test        # vitest — validation, ids, security, the version
                                        # log and view batching (real SQL via node:sqlite)
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

To exercise the **edit challenge** locally, add Cloudflare's documented test keys — they work
against the real `siteverify` and always pass:

```sh
--var TURNSTILE_SITE_KEY:1x00000000000000000000AA \
--var TURNSTILE_SECRET:1x0000000000000000000000000000000AA
```

Swap in `2x00000000000000000000AB` / `2x0000000000000000000000000000000AA` for a challenge that
always fails. With neither var set, claims are not challenged and the widget never loads — which
is the default, so editing works offline with no Cloudflare account.

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

**Edit challenge (optional, recommended in production):** a drop is editable by anyone with the
link, so `claim` — taking the edit baton — is challenged with
[Turnstile](https://developers.cloudflare.com/turnstile/). One challenge per editing session, not
per keystroke: invisible to a person who takes the baton once and edits for half an hour, and a
real cost to a script that wants to rewrite every drop it can find. Add `TURNSTILE_SITE_KEY` to
the `vars` in `wrangler.jsonc` (it is public and rendered into the page) and
`wrangler secret put TURNSTILE_SECRET`. With neither, claims are not challenged. **With the
secret but no site key, every claim fails** — deliberately, since a half-configured check that
quietly disabled itself would be worse than one that is loudly broken.

**AI review (optional, closed beta):** unset by default — the feature is off and its
button never renders. To open it to invited users, `wrangler secret put AI_PASSCODE` and
share the code privately. Rotate the secret to lock everyone out; delete it to turn the
feature off. `AI_MODEL` and `AI_DAILY_BUDGET` (neurons/day) are tunable vars. Before
enabling in production, do one manual live run against the real `AI` binding to confirm
the model returns schema-valid JSON.

CI (`.github/workflows/deploy-drop.yml`) runs `d1 migrations apply` then `wrangler deploy`
on pushes to `main` that touch this app or its rendering dependencies.
