# Camunda Drop — Plan & Spec

> Status: **proposal / not implemented** — written 2026-07-09.
> Inspiration: [Cloudflare Drop](https://www.cloudflare.com/drop/) (launched 2026-07-08): drag a folder onto a page, get a live shareable URL instantly, no account required.

Camunda Drop brings the same zero-friction idea to process artifacts: drop a **BPMN**, **DMN**, or **Camunda Form** file on `camunda.directory/drop`, get a short shareable link (`camunda.directory/drop/:shareId`) that renders the diagram in the browser — plus a live "N people viewing" indicator.

---

## 1. Goals & Non-Goals

### Goals

- **Zero friction**: no account, no login. Drop a file → get a link in under two seconds.
- **First-class rendering**: shared links open a read-only viewer, not a file download.
- **JSON-native storage**: files are converted to the typed JSON model from `@bpmnkit/core` and stored in Cloudflare D1 (SQLite), making them queryable and renderable without re-parsing XML on every view.
- **Live presence**: viewers of a drop see how many others are currently looking at it.
- **bpmnkit only**: all BPMN/DMN/Form parsing, validation, and rendering uses this monorepo's packages — no `bpmn-js`, no `dmn-js`, no form-js.

### Non-Goals (v1)

- Editing shared files (view-only; "open in Studio" can come later).
- Accounts, ownership, or a "my drops" dashboard.
- Multi-file bundles (a BPMN referencing a Form/DMN by id) — see §11 Future.
- Real-time collaborative cursors — presence is a head-count, not multiplayer editing.

---

## 2. User Experience

### 2.1 Drop page — `camunda.directory/drop`

1. Full-page drop zone (plus a file picker button for mobile). Accepts `.bpmn`, `.dmn`, `.form`, and `.xml`/`.json` with content sniffing.
2. **Client-side validation before upload**: the file is parsed in the browser with `@bpmnkit/core` (`Bpmn.parse` / `Dmn.parse` / `Form.parse`). Invalid files get an immediate, actionable error (parser errors include position info) and nothing is uploaded.
3. On success the client uploads the file, receives `{ shareId, url }`, and shows:
   - the short URL with a copy button,
   - an inline preview (the same viewer as the share page),
   - expiry information (see §7 Retention).

### 2.2 Share page — `camunda.directory/drop/:shareId`

- Read-only viewer sized to the artifact type:
  - **BPMN** → `@bpmnkit/canvas` (pan/zoom) with `zoom-controls` and `minimap` plugins from `@bpmnkit/plugins`.
  - **DMN** → `dmn-viewer` plugin (DRD + decision tables).
  - **Form** → `form-viewer` plugin (read-only form rendering).
- Header: artifact name (from the model, falling back to filename), type badge, created date, view count.
- Actions: **Download original**, **Download JSON** (the stored model), **Copy link**. For BPMN dropped as XML, "Download JSON" gives the converted model; the reverse (`serializeBpmn`) can offer XML for JSON-native drops.
- **Presence badge**: "3 viewing now", updated live (§6).
- Unknown/expired `shareId` → friendly 404 with a link back to the drop page.

### 2.3 Raw/API access

- `GET /drop/:shareId/raw` → original file bytes, correct `Content-Type`, `Content-Disposition` with original filename.
- `GET /drop/:shareId.json` → stored JSON model (useful for tooling / AI agents).

---

## 3. Architecture Overview

```
Browser ──────────────┐
  drop page (client-side parse via @bpmnkit/core)
  share page (viewer via @bpmnkit/canvas + @bpmnkit/plugins)
                      │
                      ▼
Cloudflare Worker  apps/drop  (routes /drop/*)
  ├─ static assets (drop page, share page shell, viewer bundle)
  ├─ REST API (upload, fetch, raw download)
  ├─ D1 binding  ──► drops + drop_content tables (metadata + JSON + original)
  └─ Durable Object binding ──► one PresenceRoom per shareId (WebSocket head-count)
```

- **New app `apps/drop`** in this monorepo: a single Cloudflare Worker serving both the static UI (via Workers Static Assets) and the API. ESM, TypeScript strict, zero runtime dependencies beyond workspace packages (`@bpmnkit/core`, `@bpmnkit/canvas`, `@bpmnkit/plugins`, `@bpmnkit/ui` tokens) — consistent with the repo's zero-dependency philosophy. A tiny hand-rolled router is enough (~4 routes); no framework needed.
- **Server re-validation**: the Worker re-parses every upload with `@bpmnkit/core` (same code as the client — it is isomorphic, zero-dep TypeScript). Client validation is UX; server validation is the trust boundary.
- **Routing to `camunda.directory`**: if the `camunda.directory` zone is on Cloudflare, add a route `camunda.directory/drop*` → this Worker (the existing site keeps serving everything else). If the zone is not on Cloudflare, fall back to `drop.camunda.directory` as a subdomain. **Open question — see §12.**

### Why not reuse `apps/landing`/Astro?

The share page needs server rendering per `shareId` (title/OG tags per drop) plus an API plus WebSockets — that's a Worker, not a static Astro build. The drop UI itself is two small pages; building them as plain static HTML + a bundled viewer script keeps the app dependency-free. (If we later want it to visually merge into a larger Astro site, `packages/astro-shared` tokens can be imported either way.)

---

## 4. Storage Format — "better than XML"

`@bpmnkit/core` already defines the target format; nothing new needs to be invented:

| Input | Parse | Stored JSON model | Back to source |
|---|---|---|---|
| `.bpmn` (XML) | `parseBpmn(xml)` | `BpmnDefinitions` | `serializeBpmn(defs)` |
| `.dmn` (XML) | `Dmn.parse(xml)` | `DmnDefinitions` | `Dmn.serialize(defs)` |
| `.form` (JSON) | `Form.parse(json)` | Form model | `Form.serialize(model)` |

Decisions:

1. **Canonical stored format = the full typed model** (`BpmnDefinitions` etc.) serialized as JSON. It preserves DI (layout coordinates), Zeebe extensions, and colors, and is exactly what `@bpmnkit/canvas` renders from.
2. **Do NOT use the compact format** (`compactify`/`expandDmn`/…) for storage — it is intentionally lossy (drops DI and regenerates layout on expand). Compact is great for AI/token contexts, wrong for faithful sharing.
3. **Keep the original bytes too.** The parser is very good, but any parse→serialize round-trip can normalize whitespace, attribute order, or vendor extensions the model doesn't cover. "Download original" must be byte-faithful, so both representations are stored (original + JSON), each in its own row (§5).
4. **Derived metadata** extracted at upload time into queryable columns/JSON: model name, process/decision/form id, element counts, `executionPlatform`/version, SHA-256 content hash (dedup + `ETag`).

Security note: `packages/core/src/xml/xml-parser.ts` skips `<!DOCTYPE …>` and decodes only the five predefined XML entities — no XXE or entity-expansion (billion-laughs) surface. This should be pinned with a regression test in the drop app anyway.

---

## 5. Data Model (Cloudflare D1)

D1 hard limits that shape the schema: **1 MiB max row size**, 10 GB max database size ([docs](https://developers.cloudflare.com/d1/platform/limits/)). Storing original + JSON in one row would halve the effective file cap, so content lives in a separate table, one row per representation:

```sql
CREATE TABLE drops (
  id              TEXT PRIMARY KEY,          -- shareId (§5.1)
  kind            TEXT NOT NULL CHECK (kind IN ('bpmn','dmn','form')),
  filename        TEXT NOT NULL,             -- sanitized original filename
  name            TEXT,                      -- model name (process/decision/form)
  content_hash    TEXT NOT NULL,             -- sha256 hex of original bytes
  size_original   INTEGER NOT NULL,
  size_json       INTEGER NOT NULL,
  meta            TEXT NOT NULL,             -- JSON: element counts, ids, platform…
  created_at      INTEGER NOT NULL,          -- epoch ms
  last_viewed_at  INTEGER NOT NULL,
  view_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      INTEGER                    -- NULL = keep forever (§7)
);

CREATE TABLE drop_content (
  drop_id TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  rep     TEXT NOT NULL CHECK (rep IN ('original','json')),
  body    TEXT NOT NULL,                     -- ≤ ~900 KB (stay under 1 MiB row cap)
  PRIMARY KEY (drop_id, rep)
);

CREATE INDEX idx_drops_hash    ON drops(content_hash);
CREATE INDEX idx_drops_expires ON drops(expires_at);
```

- **Upload cap: 1 MB per file** (pre- and post-parse check). Real-world BPMN/DMN/Form files are almost always well under this; it also keeps every representation inside one D1 row. If genuinely larger files ever matter, originals move to R2 (10 GB free) with no schema change beyond dropping the `original` row — explicitly out of scope for v1.
- **Dedup (optional, cheap)**: on upload, look up `content_hash`; if an identical live drop exists, return its existing `shareId` instead of storing a copy.

### 5.1 Share IDs

- 11 characters, base58 (no `0/O/I/l`), from `crypto.getRandomValues` → ~64 bits of entropy. Unguessable, unlistable; there is no public index. Collision handled by retry on unique-constraint failure.
- Links are secret-URL access ("anyone with the link"), same trust model as Cloudflare Drop / secret gists.

---

## 6. Presence — "who's viewing"

### Is there a free SaaS for this?

Yes — several offer presence as a feature with a free tier: [Ably](https://ably.com/docs/api/realtime-sdk/presence) (free tier ≈ 200 concurrent connections, 6M msgs/month, first-class presence API), Pusher (100 connections / 200k msgs/day), Liveblocks (presence-focused, free tier), Supabase Realtime.

### Recommendation: don't use one — use Cloudflare Durable Objects

Since the stack is already Cloudflare (Worker + D1), a **Durable Object per shareId** is the natural fit and avoids a second vendor, a second SDK, and an API key in the client:

- Durable Objects are available **on the Workers Free plan** (SQLite-backed), and the **WebSocket Hibernation API** means an idle viewer costs essentially nothing — the DO is evicted from memory between messages while sockets stay connected.
- `PresenceRoom` DO: accepts WebSocket upgrades at `GET /drop/api/presence/:shareId`, tracks connected socket count, broadcasts `{ viewers: n }` on join/leave. ~60 lines of code, no external service.
- Client: viewer page opens the WebSocket, renders the count via a small badge (a natural fit for a `@bpmnkit/plugins`-style canvas overlay, or plain DOM in the page header). Graceful fallback: if the socket fails, hide the badge — presence is decorative, never blocking.
- Anonymous head-count only ("3 viewing"). No identity exists (no accounts), so "who" is at most a per-tab random animal/color name — nice-to-have, not v1.
- Bonus: the same DO can debounce `view_count`/`last_viewed_at` writes to D1 instead of writing on every page load.

PartyKit (now part of Cloudflare) wraps this same primitive; direct DO usage keeps us dependency-free.

---

## 7. Retention & Expiry

Cloudflare Drop expires unclaimed sites after 60 minutes. That is too aggressive here — a shared diagram link pasted into Slack should still work next week. Options:

| Option | Pros | Cons |
|---|---|---|
| A. Keep forever | simplest | abuse magnet, DB grows unbounded |
| B. **Fixed TTL, sliding on view — e.g. 90 days after last view** (recommended) | self-cleaning, links people actually use never die | needs a cleanup job |
| C. CF-Drop-style "claim to keep" | mirrors the inspiration | requires accounts — a non-goal |

Recommended: **Option B**. `expires_at = last_viewed_at + 90 days`, refreshed by the same debounced DO write; a scheduled Worker (cron trigger, daily) deletes expired rows. Expiry is stated on the drop page and share page. Exact TTL is an open question (§12).

---

## 8. API (v1)

| Route | Method | Description |
|---|---|---|
| `/drop` | GET | Drop page (static) |
| `/drop/api/drops` | POST | Body: file bytes + filename. Validates, converts, stores. → `201 { shareId, url, kind, name, expiresAt }`. Errors: `400` unparseable (with parser message), `413` > 1 MB, `429` rate-limited |
| `/drop/:shareId` | GET | Share page (server-rendered shell: per-drop `<title>`/OG tags + viewer bootstrap) |
| `/drop/:shareId.json` | GET | Stored JSON model (`ETag: content_hash`) |
| `/drop/:shareId/raw` | GET | Original bytes, original filename |
| `/drop/api/presence/:shareId` | GET (WS upgrade) | Presence WebSocket → `{ viewers: n }` broadcasts |

No delete endpoint in v1 (no ownership to authenticate); abuse handling is manual + expiry-based. A signed "deletion token" returned at upload time is a cheap v1.1 addition if wanted.

---

## 9. Abuse & Security

- **Validation is the gate**: only content that parses as BPMN/DMN/Form is stored — this is not a generic file host. Server-side re-parse is mandatory.
- **Size cap** 1 MB (§5) and **rate limiting** on `POST` (Cloudflare rate-limiting rules per IP; Turnstile on the upload only if abuse actually appears — don't add friction preemptively).
- **XSS**: element names/documentation from uploaded files are attacker-controlled. `@bpmnkit/canvas` renders labels as SVG text nodes (not innerHTML) — verify and pin with a test (`<img onerror=…>` as an element name). Same for filename echoes and OG-tag interpolation in the share shell. CSP: `default-src 'self'`, no inline script.
- **XML safety**: parser already ignores DOCTYPE/custom entities (§4) — add a regression test with an XXE/billion-laughs payload.
- **Content-Disposition/Type** on `/raw`: serve XML as `application/octet-stream` or with `X-Content-Type-Options: nosniff` so browsers never render dropped XML as a document.
- **Secret URLs**: `noindex` on share pages, no public listing, 64-bit random ids.

---

## 10. Implementation Plan

Each phase ends green: `pnpm turbo build`, `pnpm turbo typecheck`, `pnpm turbo test`, `pnpm biome check .`.

1. **Scaffold `apps/drop`** — Worker + wrangler config (D1 + DO bindings, static assets), tiny router, D1 migrations. *Verify: `wrangler dev` serves the drop page locally; migration applies to local D1.*
2. **Upload pipeline** — POST endpoint: sniff kind → parse (`@bpmnkit/core`) → extract metadata → store original + JSON → return shareId. *Verify: Vitest unit tests for sniffing/validation/cap/dedup using files from `bpmn-samples/`; invalid and oversized fixtures rejected with correct status codes.*
3. **Share page + BPMN viewer** — server-rendered shell, viewer bundle on `@bpmnkit/canvas` + `zoom-controls` + `minimap`, raw/JSON downloads. *Verify: Playwright smoke test — drop a sample, follow the link, SVG rendered, downloads byte-identical to input.*
4. **DMN + Form viewers** — wire `dmn-viewer` and `form-viewer` plugins per `kind`. *Verify: sample `.dmn`/`.form` fixtures render.*
5. **Presence DO** — `PresenceRoom` with hibernating WebSockets, viewer badge, debounced view-count writes. *Verify: two browser contexts on one shareId both show "2 viewing"; count drops on close.*
6. **Retention + hardening** — cron cleanup, rate limits, CSP, XSS/XXE regression tests, `noindex`. *Verify: expired fixture removed by cron handler test; security tests pass.*
7. **Deploy + route** — production D1, route `camunda.directory/drop*` (or subdomain per §12), smoke test in production.

Repo housekeeping when implementation starts: `apps/drop` is deploy-only (not published to npm), so the "Adding a New Package" README/LICENSE script requirements don't apply, but `doc/progress.md`, `doc/features.md`, and `doc/roadmap.md` updates do.

## Cost

Everything fits Cloudflare's free tier at hobby/launch scale: Workers free plan (100k req/day), D1 free (5 GB, 100k writes/day — one drop = ~3 writes), Durable Objects free (SQLite-backed, hibernated WebSockets), no R2 needed. First paid trigger would be sustained traffic beyond 100k requests/day — a good problem.

---

## 11. Future Ideas (explicitly not v1)

- **Bundles**: drop a BPMN + the forms/DMNs it references (`formId`/`decisionId` are already in the model) as one share with tabs — `packages/plugins` `tabs` + `file-resolver` already model linked files.
- **"Open in Studio"**: hand the drop off to `apps/studio` for editing a copy.
- **Social preview images**: `exportSvg` from `@bpmnkit/core` already renders server-side SVG; rasterizing for `og:image` needs a wasm rasterizer (new dependency — decide then).
- **ASCII preview** for terminal users via `@bpmnkit/ascii` (`curl camunda.directory/drop/:id.txt`).
- **Deletion tokens**, QR codes, password-protected drops.

---

## 12. Open Questions

1. **Where does `camunda.directory` live?** It is not in this monorepo. Is the zone on Cloudflare (so `/drop*` can route to the new Worker), and should `apps/drop` live here (recommended — it depends on workspace packages) or in the camunda.directory repo?
2. **Retention**: is 90-days-since-last-view right, or keep forever / shorter?
3. **Multi-file drops in v1?** Recommendation: single file for v1, bundles later (§11).
4. **Presence**: OK to build on Durable Objects (recommended, no external SaaS), or is an external service (Ably free tier) preferred for some reason?
5. **Branding**: does the drop UI use bpmnkit brand tokens (`@bpmnkit/ui`), or camunda.directory's own look?
