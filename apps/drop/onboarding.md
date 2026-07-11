# BPMN Kit Drop — Onboarding

A hands-on guide to using, running, and operating **BPMN Kit Drop** — the
`bpmnkit.com/drop` service. It complements [`README.md`](./README.md) (which is
develop/deploy reference) by walking three roles through the app end to end:

- [**Users**](#1-for-users) — share a diagram, view a shared one, ask for an AI review.
- [**Developers**](#2-for-developers) — run it locally, understand the layout, extend it.
- [**Operators**](#3-for-operators) — deploy, moderate, and turn the AI beta on/off.

Design rationale lives in [`doc/drop-spec.md`](../../doc/drop-spec.md) (v1) and
[`doc/drop-v2-spec.md`](../../doc/drop-v2-spec.md) (landing + AI review).

---

## What it is

Drop a BPMN, DMN, or Camunda Form file (or several) onto the page and get a short,
shareable link — `bpmnkit.com/drop/:shareId` — that renders it read-only in the
browser with a live "N viewing" indicator. Nothing to install, no account.

It is a single Cloudflare Worker:

- **UI + API** are served by one Worker (`apps/drop`).
- **Storage** is D1 (SQLite): each file is kept both as the typed JSON model from
  `@bpmnkit/core` and as the byte-faithful original.
- **Presence** ("N viewing") is a Durable Object per share, over hibernating WebSockets.
- **Rendering** uses `@bpmnkit/core` + `@bpmnkit/canvas` + `@bpmnkit/plugins` — no
  external diagram libraries.
- **AI review** (optional, closed beta) uses Workers AI plus the `@bpmnkit/core`
  optimizer, gated behind an operator passcode.

Limits and lifecycle (from `src/shared/constants.ts`):

| Property | Value |
|---|---|
| Max files per drop | 20 |
| Max size per file | 900 KB |
| Max total per drop | 5 MB |
| Accepted extensions | `.bpmn` `.dmn` `.form` `.xml` `.json` |
| Retention | 90 days after the **last view** (sliding TTL); admin can pin |

---

## 1. For users

### Share a file

1. Go to **`/drop`**.
2. Drop files anywhere on the page, click to pick them, or **paste** copied file
   contents. Files are validated in your browser first — invalid ones fail
   immediately with a clear reason, before anything is uploaded.
3. You get a short link like `/drop/aB3x9Kp2mNq`. Send it to anyone.

### View a shared file

Open the link. You'll see the diagram read-only, with:

- **File tabs** if the drop has several files.
- **Cross-file navigation** — a user task carrying a `formId`, or a business-rule
  task carrying a `decisionId`, is clickable and jumps to that referenced file's tab.
- **Live presence** — a "N viewing" count that updates as people come and go.
- **Download** — grab the original bytes, or the `@bpmnkit/core` JSON model.

### Try it without uploading anything

A built-in demo drop is always live at **`/drop/demo-loan-approval`** — a
loan-approval BPMN wired to a credit-risk DMN and a loan-application Form. It's
served from memory (no database row), so it exists on any fresh deploy.

### Ask for an AI review (if enabled)

On a BPMN share page, if the operator has opened the closed beta you'll see a
**"AI review"** button. The first time, it asks for an access code (given to you
privately). Then it returns:

- A short plain-language **summary** of the process.
- **Suggestions**, each with a why and a severity. Hover or tap a suggestion to
  highlight the element it refers to on the diagram.
- **Automated checks** from the deterministic optimizer, always shown even when
  the AI narrative is unavailable.

Your code is remembered in this browser (localStorage) so you don't re-enter it.
If the code is wrong or has been rotated, you'll be asked for it again.

### Report abuse

Every share page has a report link (copyright, malicious, personal data, other).
Reports are rate-limited per IP and reviewed by an operator.

---

## 2. For developers

Everything runs offline in the `workerd` simulator — **no Cloudflare account
needed** to develop.

### Prerequisites

- Node.js (repo LTS), `pnpm`, and a repo bootstrap: from the monorepo root run
  `pnpm install`.
- `wrangler` is available via the workspace (`pnpm --filter @bpmnkit/drop exec wrangler …`)
  or globally.

### First run

From `apps/drop`:

```sh
pnpm build                                        # bundle client (esbuild) + deps
wrangler d1 migrations apply bpmnkit-drop --local # create local SQLite schema
wrangler dev --local --port 8787 \
  --var DROP_ADMIN_TOKEN:devtoken --var REPORT_IP_SALT:devsalt
```

Open <http://localhost:8787/drop>. The demo drop is at
<http://localhost:8787/drop/demo-loan-approval>; admin is at
<http://localhost:8787/drop/admin> (paste `devtoken`).

Re-run `wrangler d1 migrations apply bpmnkit-drop --local` after pulling to pick up
new migrations (e.g. `0002_ai_review`). The local D1 lives under
`.wrangler/state` (gitignored) — delete it to reset.

### Develop the AI review locally

Add `--var AI_PASSCODE:devcode` to `wrangler dev`. The passcode gate, per-IP
attempt limiting, D1 caching, and daily budget guard all work offline. The LLM
narrative itself needs a real Cloudflare account for the `AI` binding, so locally
the feature **gracefully degrades** to "automated checks only" with a note — which
is exactly what production does when the model is unavailable or the budget is spent.

### The gate (build / typecheck / test / lint)

Every change must leave this green:

```sh
pnpm turbo build typecheck test check --filter @bpmnkit/drop
```

Individually:

```sh
pnpm --filter @bpmnkit/drop build       # esbuild client bundles + generated usecases.json
pnpm --filter @bpmnkit/drop typecheck   # worker (workers-types) + client (DOM) tsconfigs
pnpm --filter @bpmnkit/drop test        # vitest — validation, ids, review, ai-review, security
pnpm --filter @bpmnkit/drop check       # biome (tabs, double quotes)
```

### Layout

```
src/
  worker.ts        Worker entry: router + scheduled (retention) + PresenceRoom export
  presence.ts      Durable Object — hibernating-WebSocket viewer count
  env.ts           Binding + var types
  routes/          upload, share pages (drop.ts), raw/json download, reports,
                   admin, ai-review, stats
  lib/             ids, validate, meta, db (D1), http, pages (HTML), demo
                   (in-memory demo drop), review (deterministic optimizer pass),
                   ai (Workers AI + D1 cache/budget)
  client/          browser bundles: drop, viewer, admin, landing
                   (built to public/drop/assets — gitignored)
  shared/          constants used by both Worker and client
migrations/        D1 schema (0001 core, 0002 AI review)
scripts/           build-client.mjs (esbuild + generates usecases.json)
public/            static assets served by the ASSETS binding
```

### Request routing (from `src/worker.ts`)

Everything the Worker owns is under `/drop`:

| Method + path | Purpose |
|---|---|
| `GET /drop` | Landing / drop page |
| `POST /drop/api/drops` | Upload — returns `{ shareId, url, files }` |
| `GET /drop/:id` | Share (viewer) page |
| `GET /drop/:id/manifest.json` | File manifest for a share |
| `GET /drop/:id/f/:filename` | Original bytes (add `?format=json` for the model) |
| `GET /drop/api/stats` | Live counters (60s cache) |
| `POST /drop/api/reports` | File an abuse report |
| `POST /drop/api/ai-review/:id/:filename` | AI review (closed beta; 404 if off) |
| `GET /drop/api/presence/:id` | WebSocket upgrade → Durable Object |
| `/drop/api/admin/*` | Admin API (Bearer `DROP_ADMIN_TOKEN`) |
| `GET /drop/terms`, `/drop/privacy`, `/drop/admin` | Static pages |

### Quick API smoke test

```sh
# upload → { shareId, url, files }
curl -s -X POST http://localhost:8787/drop/api/drops \
  -F files=@../../bpmn-samples/order-process.bpmn
# then, with the shareId:
curl -s http://localhost:8787/drop/<shareId>/manifest.json
curl -s "http://localhost:8787/drop/<shareId>/f/order-process.bpmn"               # original
curl -s "http://localhost:8787/drop/<shareId>/f/order-process.bpmn?format=json"   # model

# AI review (needs --var AI_PASSCODE:devcode running):
curl -s -X POST http://localhost:8787/drop/api/ai-review/<shareId>/order-process.bpmn \
  -H "X-Drop-AI-Code: devcode"
```

### House rules (enforced by CLAUDE.md + the specs)

- **Zero new npm dependencies** — build on `@bpmnkit/*` and platform APIs.
- **TypeScript strict**, **Biome clean** (tabs, double quotes).
- **CSP stays `default-src 'self'`.** All animation is `prefers-reduced-motion`-gated.
- **Every model- or user-supplied string is rendered via `textContent`** (never
  `innerHTML`) — the diagram is untrusted input. XSS regressions have tests.
- **The passcode/admin token never appears in URLs, HTML, or the client bundle** —
  only the boolean `aiEnabled` reaches the browser. The code travels in the
  `X-Drop-AI-Code` request header.
- Keep `doc/progress.md`, `doc/features.md`, and `doc/roadmap.md` current with each change.

---

## 3. For operators

### One-command setup (recommended)

After `wrangler login`, run the provisioning script — it does everything below
and deploys:

```sh
pnpm --filter @bpmnkit/drop provision    # or: cd apps/drop && node scripts/provision.mjs
```

It is **idempotent** (safe to re-run) and:

1. Creates the D1 database `bpmnkit-drop` if missing and writes its id into `wrangler.jsonc`.
2. Applies the D1 migrations remotely.
3. Optionally routes `bpmnkit.com/drop*` to the Worker (prompts; default no — otherwise it
   stays on its `*.workers.dev` URL).
4. Builds the client bundles and deploys the Worker.
5. Generates and sets `DROP_ADMIN_TOKEN` and `REPORT_IP_SALT` (auto), and prompts whether to
   set `AI_PASSCODE` now (hidden input). Existing secrets are kept, not overwritten.

The **admin token is printed once** at the end — save it; it's what you paste at `/drop/admin`.

Bump `TOS_VERSION` in `wrangler.jsonc` whenever the Terms/Privacy pages change (it is
recorded on each drop).

### Manual setup (equivalent steps)

1. `wrangler d1 create bpmnkit-drop` → copy the id into `wrangler.jsonc`
   (`d1_databases[0].database_id`, currently `REPLACE_WITH_D1_DATABASE_ID`).
2. `wrangler secret put DROP_ADMIN_TOKEN` — operator token for `/drop/admin` and the admin API.
3. `wrangler secret put REPORT_IP_SALT` — salt for hashing reporter IPs.
4. Bump `TOS_VERSION` in `wrangler.jsonc` whenever the Terms/Privacy pages change
   (it is recorded on each drop).
5. Enable the `bpmnkit.com/drop*` route in `wrangler.jsonc` (`routes`, currently
   commented out).

Migrations run on deploy via CI (`.github/workflows/deploy-drop.yml`:
`d1 migrations apply` then `wrangler deploy`) on pushes to `main` that touch this
app or its rendering dependencies. The retention cron runs daily at 03:17 UTC and
deletes drops past their sliding TTL.

### Moderation

`/drop/admin` (paste the `DROP_ADMIN_TOKEN`) lists open reports. The admin API,
authenticated with `Authorization: Bearer <DROP_ADMIN_TOKEN>`:

| Method + path | Effect |
|---|---|
| `GET /drop/api/admin/reports?status=open` | List reports |
| `PATCH /drop/api/admin/reports/:id` | Body `{ "status": "resolved" \| "dismissed" }` |
| `GET /drop/api/admin/drops/:shareId` | Inspect a drop |
| `DELETE /drop/api/admin/drops/:shareId` | Delete it (`?ban=1` also bans its content hash) |

### Turning the AI review beta on and off

The feature is **off by default** — the button never renders and the endpoint
returns 404 — until the secret is present.

```sh
wrangler secret put AI_PASSCODE     # open the beta; share the code privately
wrangler secret put AI_PASSCODE     # run again to rotate (locks out old holders)
wrangler secret delete AI_PASSCODE  # turn the feature fully off
```

Tunable vars in `wrangler.jsonc`:

- `AI_MODEL` — default `@cf/openai/gpt-oss-120b`.
- `AI_DAILY_BUDGET` — neurons/day (default `8000`). When spent, the service returns
  deterministic checks with a "busy today" note instead of calling the model.

**Before enabling in production, do one manual live run** against the real `AI`
binding to confirm the model returns schema-valid JSON:

```sh
# with the deployed Worker (or `wrangler dev --remote`) and AI_PASSCODE set:
curl -s -X POST https://bpmnkit.com/drop/api/ai-review/demo-loan-approval/loan-approval.bpmn \
  -H "X-Drop-AI-Code: <the-passcode>"
```

You should get JSON with a non-null `model`, a `summary`, and `suggestions`. If
`model` is `null` with a `note`, the binding or budget wasn't available — check
the account's Workers AI access and the daily budget.

### How the AI request is protected (operational view)

Order of checks in `handleAiReview` (`src/routes/ai-review.ts`):

1. **404** if `AI_PASSCODE` is unset (feature invisible).
2. File must exist and be **BPMN** (else 400).
3. **Passcode gate** — constant-time compare. Wrong code with fewer than 5 failed
   attempts this hour → 401; the 5th+ → 429. Attempts are counted per hashed IP.
4. **Deterministic checks** always computed (the safety net).
5. **Cache hit** on the file's content hash → returned with `cached: true`, no neurons spent.
6. **Budget guard** — if today's neurons are exhausted, return deterministic + note.
7. **Model call** → cache the result, add to the day's budget.

Any model error degrades to deterministic + note rather than failing the request.
