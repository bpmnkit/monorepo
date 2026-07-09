# BPMN Kit Drop — Plan & Spec

> Status: **approved plan / not implemented** — written 2026-07-09, decisions resolved 2026-07-09 (see §12).
> Inspiration: [Cloudflare Drop](https://www.cloudflare.com/drop/) (launched 2026-07-08): drag a folder onto a page, get a live shareable URL instantly, no account required.

BPMN Kit Drop brings the same zero-friction idea to process artifacts: drop **BPMN**, **DMN**, and **Camunda Form** files on `bpmnkit.com/drop`, get a short shareable link (`bpmnkit.com/drop/:shareId`) that renders them in the browser — plus a live "N people viewing" indicator.

---

## 1. Goals & Non-Goals

### Goals

- **Zero friction**: no account, no login. Drop files → get a link in under two seconds.
- **Multi-file drops**: a drop can contain several related files (e.g. a BPMN process plus the forms and DMN decisions it references); links between them resolve inside the viewer.
- **First-class rendering**: shared links open a read-only viewer, not a file download.
- **JSON-native storage**: files are converted to the typed JSON model from `@bpmnkit/core` and stored in Cloudflare D1 (SQLite), making them queryable and renderable without re-parsing XML on every view.
- **Live presence**: viewers of a drop see how many others are currently looking at it.
- **Moderated**: uploads acknowledge the Terms of Use & Privacy Policy, every share page has a "Report abuse" action, and the operator has an admin way to delete (and ban) shares.
- **bpmnkit only**: all BPMN/DMN/Form parsing, validation, and rendering uses this monorepo's packages — no `bpmn-js`, no `dmn-js`, no form-js.

### Non-Goals (v1)

- Editing shared files (view-only; "open in Studio" can come later).
- Accounts, ownership, or a "my drops" dashboard.
- Real-time collaborative cursors — presence is a head-count, not multiplayer editing.

---

## 2. User Experience

### 2.1 Drop page — `bpmnkit.com/drop`

1. Full-page drop zone (plus a file picker button for mobile). Accepts one or **multiple** files — `.bpmn`, `.dmn`, `.form`, and `.xml`/`.json` with content sniffing. Limits: **20 files, 1 MB per file, 5 MB per drop** (§5).
2. Beneath the drop zone, a permanent notice: *"By uploading you agree to the [Terms of Use](/drop/terms) and acknowledge the [Privacy Policy](/drop/privacy)."* — passive acknowledgment (Cloudflare-Drop-style), no checkbox friction. See §9.3.
3. **Client-side validation before upload**: every file is parsed in the browser with `@bpmnkit/core` (`Bpmn.parse` / `Dmn.parse` / `Form.parse`). Invalid files get an immediate, actionable error (parser errors include position info) and nothing is uploaded. All-or-nothing: one bad file fails the whole drop with a per-file error list.
4. On success the client uploads the files, receives `{ shareId, url }`, and shows:
   - the short URL with a copy button,
   - an inline preview (the same viewer as the share page),
   - expiry information (see §7 Retention).

### 2.2 Share page — `bpmnkit.com/drop/:shareId`

- **File tabs** when the drop has more than one file (reusing the interaction model of the `tabs` plugin in `@bpmnkit/plugins`); single-file drops show no tab bar. The primary file (first BPMN, else first DMN, else first form) opens by default; `?file=<filename>` deep-links a tab.
- Read-only viewer per artifact type:
  - **BPMN** → `@bpmnkit/canvas` (pan/zoom) with `zoom-controls` and `minimap` plugins from `@bpmnkit/plugins`.
  - **DMN** → `dmn-viewer` plugin (DRD + decision tables).
  - **Form** → `form-viewer` plugin (read-only form rendering).
- **Cross-file navigation**: a BPMN `userTask` with a `formId` or a `businessRuleTask` with a `decisionId` that resolves to another file in the drop becomes clickable and switches to that file's tab — `@bpmnkit/plugins`' `file-resolver` already implements exactly this resolution.
- Header: drop title (primary file's model name, falling back to filename), type badges, created date, view count.
- Actions: **Download original** (current file), **Download JSON** (the stored model), **Copy link**. For BPMN dropped as XML, "Download JSON" gives the converted model; the reverse (`serializeBpmn`) can offer XML for JSON-native drops.
- **Presence badge**: "3 viewing now", updated live (§6).
- Footer: a discreet **"Report abuse"** link (§9.4) and Terms/Privacy links.
- Unknown/expired/deleted `shareId` → friendly 404 with a link back to the drop page.

### 2.3 Raw/API access

- `GET /drop/:shareId/manifest.json` → drop metadata + file list.
- `GET /drop/:shareId/f/:filename` → original file bytes, correct `Content-Type`, `Content-Disposition`.
- `GET /drop/:shareId/f/:filename.json` → stored JSON model (useful for tooling / AI agents).

---

## 3. Architecture Overview

```
Browser ──────────────┐
  drop page (client-side parse via @bpmnkit/core)
  share page (viewer via @bpmnkit/canvas + @bpmnkit/plugins, file tabs)
                      │
                      ▼
Cloudflare Worker  apps/drop  (route: bpmnkit.com/drop*)
  ├─ static assets (drop page, share shell, viewer bundle, terms/privacy, admin page)
  ├─ REST API (upload, fetch, raw download, reports, admin)
  ├─ D1 binding  ──► drops / files / file_content / reports / banned_hashes
  └─ Durable Object binding ──► one PresenceRoom per shareId (WebSocket head-count)
```

- **New app `apps/drop`** in this monorepo: a single Cloudflare Worker serving both the static UI (via Workers Static Assets) and the API. ESM, TypeScript strict, zero runtime dependencies beyond workspace packages (`@bpmnkit/core`, `@bpmnkit/canvas`, `@bpmnkit/plugins`, `@bpmnkit/ui`) — consistent with the repo's zero-dependency philosophy. A tiny hand-rolled router is enough; no framework needed.
- **Server re-validation**: the Worker re-parses every upload with `@bpmnkit/core` (same code as the client — it is isomorphic, zero-dep TypeScript). Client validation is UX; server validation is the trust boundary.
- **Routing to `bpmnkit.com/drop`**: the `bpmnkit.com` zone is already on Cloudflare — `apps/landing` deploys to Cloudflare Pages (project `bpmn-sdk-landing`, `.github/workflows/deploy-pages.yml`). A Workers route `bpmnkit.com/drop*` takes precedence over the Pages custom domain on the same zone, so `/drop` is carved out without touching the landing app. Deployment: a new `.github/workflows/deploy-drop.yml` mirroring the existing deploy workflows (`wrangler deploy` + `wrangler d1 migrations apply`).
- **Branding**: bpmnkit brand tokens from `@bpmnkit/ui` — `@import "@bpmnkit/ui/tokens.css"` in the pages' stylesheet (or `injectUiStyles()` in the viewer bundle), all colors as `var(--bpmnkit-*, <fallback>)`, light/dark supported. No hardcoded brand colors, per repo policy.

### Why not extend `apps/landing`/Astro?

The share page needs server rendering per `shareId` (title/OG tags per drop) plus an API plus WebSockets — that's a Worker, not a static Astro build. The drop UI itself is a handful of small pages; building them as plain static HTML + a bundled viewer script keeps the app dependency-free, and the `@bpmnkit/ui` tokens keep it visually consistent with bpmnkit.com.

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
4. **Derived metadata** extracted at upload time into queryable columns/JSON per file: model name, process/decision/form id, element counts, `executionPlatform`/version, SHA-256 content hash (`ETag`, ban checks).

Security note: `packages/core/src/xml/xml-parser.ts` skips `<!DOCTYPE …>` and decodes only the five predefined XML entities — no XXE or entity-expansion (billion-laughs) surface. This should be pinned with a regression test in the drop app anyway.

---

## 5. Data Model (Cloudflare D1)

D1 hard limits that shape the schema: **1 MiB max row size**, 10 GB max database size ([docs](https://developers.cloudflare.com/d1/platform/limits/)). Content lives in a separate table, one row per file per representation:

```sql
CREATE TABLE drops (
  id              TEXT PRIMARY KEY,          -- shareId (§5.1)
  file_count      INTEGER NOT NULL,
  size_total      INTEGER NOT NULL,
  tos_version     TEXT NOT NULL,             -- Terms version acknowledged at upload (§9.3)
  created_at      INTEGER NOT NULL,          -- epoch ms
  last_viewed_at  INTEGER NOT NULL,
  view_count      INTEGER NOT NULL DEFAULT 0,
  expires_at      INTEGER                    -- NULL = keep (admin-pinned)
);

CREATE TABLE files (
  id              TEXT PRIMARY KEY,          -- random short id
  drop_id         TEXT NOT NULL REFERENCES drops(id) ON DELETE CASCADE,
  position        INTEGER NOT NULL,          -- upload order; tab order
  kind            TEXT NOT NULL CHECK (kind IN ('bpmn','dmn','form')),
  filename        TEXT NOT NULL,             -- sanitized, unique per drop
  name            TEXT,                      -- model name (process/decision/form)
  content_hash    TEXT NOT NULL,             -- sha256 hex of original bytes
  size_original   INTEGER NOT NULL,
  size_json       INTEGER NOT NULL,
  meta            TEXT NOT NULL,             -- JSON: element counts, ids, platform…
  UNIQUE (drop_id, filename)
);

CREATE TABLE file_content (
  file_id TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  rep     TEXT NOT NULL CHECK (rep IN ('original','json')),
  body    TEXT NOT NULL,                     -- ≤ ~900 KB (stay under 1 MiB row cap)
  PRIMARY KEY (file_id, rep)
);

CREATE TABLE reports (                       -- abuse reports (§9.4)
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  drop_id     TEXT NOT NULL,                 -- no FK: report survives drop deletion (audit)
  reason      TEXT NOT NULL,                 -- category: copyright | malicious | personal-data | other
  details     TEXT,
  reporter    TEXT,                          -- salted SHA-256 of reporter IP (dedup/rate-limit)
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at  INTEGER NOT NULL
);

CREATE TABLE banned_hashes (                 -- deleted-for-cause content can't come back (§9.5)
  content_hash TEXT PRIMARY KEY,
  reason       TEXT,
  created_at   INTEGER NOT NULL
);

CREATE INDEX idx_files_drop     ON files(drop_id, position);
CREATE INDEX idx_files_hash     ON files(content_hash);
CREATE INDEX idx_drops_expires  ON drops(expires_at);
CREATE INDEX idx_reports_status ON reports(status, created_at);
```

- **Caps: 1 MB per file, 20 files / 5 MB per drop** (pre- and post-parse checks). Real-world BPMN/DMN/Form files are almost always well under this; the per-file cap also keeps every representation inside one D1 row. If genuinely larger files ever matter, originals move to R2 (10 GB free) with no schema change beyond dropping the `original` rows — explicitly out of scope for v1.
- Every uploaded file's `content_hash` is checked against `banned_hashes`; a hit rejects the whole drop with a neutral `422`.

### 5.1 Share IDs

- 11 characters, base58 (no `0/O/I/l`), from `crypto.getRandomValues` → ~64 bits of entropy. Unguessable, unlistable; there is no public index. Collision handled by retry on unique-constraint failure.
- Links are secret-URL access ("anyone with the link"), same trust model as Cloudflare Drop / secret gists.

---

## 6. Presence — "who's viewing"

### Is there a free SaaS for this?

Yes — several offer presence as a feature with a free tier: [Ably](https://ably.com/docs/api/realtime-sdk/presence) (free tier ≈ 200 concurrent connections, 6M msgs/month, first-class presence API), Pusher (100 connections / 200k msgs/day), Liveblocks (presence-focused, free tier), Supabase Realtime.

### Decision: don't use one — use Cloudflare Durable Objects

Since the stack is already Cloudflare (Worker + D1), a **Durable Object per shareId** is the natural fit and avoids a second vendor, a second SDK, and an API key in the client:

- Durable Objects are available **on the Workers Free plan** (SQLite-backed), and the **WebSocket Hibernation API** means an idle viewer costs essentially nothing — the DO is evicted from memory between messages while sockets stay connected.
- `PresenceRoom` DO: accepts WebSocket upgrades at `GET /drop/api/presence/:shareId`, tracks connected socket count, broadcasts `{ viewers: n }` on join/leave. ~60 lines of code, no external service.
- Client: viewer page opens the WebSocket, renders the count in the page header. Graceful fallback: if the socket fails, hide the badge — presence is decorative, never blocking.
- Anonymous head-count only ("3 viewing"). No identity exists (no accounts), so "who" is at most a per-tab random animal/color name — nice-to-have, not v1.
- Bonus: the same DO debounces `view_count`/`last_viewed_at` writes to D1 instead of writing on every page load.

PartyKit (now part of Cloudflare) wraps this same primitive; direct DO usage keeps us dependency-free.

---

## 7. Retention & Expiry

**Decision: sliding TTL — a drop expires 90 days after its last view.** `expires_at = last_viewed_at + 90 days`, refreshed by the debounced DO write; a scheduled Worker (cron trigger, daily) deletes expired rows. Expiry is stated on the drop page, the share page, and the Privacy Policy. Links people actually use never die; abandoned ones self-clean.

Admin deletion (§9.5) removes a drop immediately, independent of expiry. `expires_at = NULL` is reserved as an admin "pin" for drops that should never expire (e.g. official samples).

---

## 8. API (v1)

### Public

| Route | Method | Description |
|---|---|---|
| `/drop` | GET | Drop page (static) |
| `/drop/api/drops` | POST | `multipart/form-data`, 1–20 files. Validates all, converts, stores atomically. → `201 { shareId, url, expiresAt, files: [{ filename, kind, name }] }`. Errors: `400` unparseable (per-file parser messages), `413` size caps, `422` banned content, `429` rate-limited |
| `/drop/:shareId` | GET | Share page (server-rendered shell: per-drop `<title>`/OG tags + viewer bootstrap; `?file=` selects a tab) |
| `/drop/:shareId/manifest.json` | GET | Drop metadata + file list |
| `/drop/:shareId/f/:filename` | GET | Original bytes (`ETag: content_hash`) |
| `/drop/:shareId/f/:filename.json` | GET | Stored JSON model |
| `/drop/api/presence/:shareId` | GET (WS upgrade) | Presence WebSocket → `{ viewers: n }` broadcasts |
| `/drop/api/reports` | POST | Abuse report: `{ shareId, reason, details? }` → `201`. Rate-limited; one open report per drop per reporter hash |
| `/drop/terms`, `/drop/privacy` | GET | Terms of Use / Privacy Policy (static) |

### Admin (Bearer `DROP_ADMIN_TOKEN`, §9.5)

| Route | Method | Description |
|---|---|---|
| `/drop/api/admin/reports?status=open` | GET | List reports with drop metadata |
| `/drop/api/admin/reports/:id` | PATCH | `{ status: 'resolved' \| 'dismissed' }` |
| `/drop/api/admin/drops/:shareId` | GET | Full metadata + file list for review |
| `/drop/api/admin/drops/:shareId?ban=1` | DELETE | Delete drop (cascade). With `ban=1`, also insert all its content hashes into `banned_hashes` and mark open reports resolved |
| `/drop/admin` | GET | Minimal static admin page (§9.5) |

There is no public delete endpoint (no ownership to authenticate). A signed "deletion token" returned at upload time is a cheap v1.1 addition if wanted.

---

## 9. Trust, Safety & Moderation

### 9.1 Validation is the gate

Only content that parses as BPMN/DMN/Form is stored — this is not a generic file host. Server-side re-parse is mandatory. Size caps (§5) and **rate limiting** on `POST` routes (Cloudflare rate-limiting rules per IP; Turnstile on upload only if abuse actually appears — don't add friction preemptively).

### 9.2 Technical hardening

- **XSS**: element names/documentation from uploaded files are attacker-controlled. `@bpmnkit/canvas` renders labels as SVG text nodes (not innerHTML) — verify and pin with a test (`<img onerror=…>` as an element name). Same for filename echoes and OG-tag interpolation in the share shell. CSP: `default-src 'self'`, no inline script.
- **XML safety**: parser already ignores DOCTYPE/custom entities (§4) — add a regression test with an XXE/billion-laughs payload.
- **Content-Disposition/Type** on `/f/:filename`: serve XML as `application/octet-stream` with `X-Content-Type-Options: nosniff` so browsers never render dropped XML as a document.
- **Secret URLs**: `noindex` on share pages, no public listing, 64-bit random ids.

### 9.3 Terms & Privacy acknowledgment

- Upload is gated by passive acknowledgment: the notice sits directly under the drop zone (§2.1), and the accepted `tos_version` is recorded on the drop row for audit.
- **Content task (pre-launch): write `/drop/terms` and `/drop/privacy`.** They must at minimum cover: what is stored (uploaded files + derived JSON) and where (Cloudflare D1), the 90-day-since-last-view retention (§7), that share links are secret-URL public ("anyone with the link"), that IPs are processed transiently for rate limiting and stored only as salted hashes on abuse reports, that there are no accounts/tracking cookies, the acceptable-use policy the admin enforces, and an abuse/takedown contact (the report flow, §9.4). *Not legal advice — have the texts reviewed.*

### 9.4 Abuse reporting

- Every share page footer has **"Report abuse"** → small dialog: category (`copyright`, `malicious`, `personal-data`, `other`) + optional free text → `POST /drop/api/reports`.
- Reports are stored in D1 (`reports`), never shown publicly. Reporter IP is stored only as a salted hash, used to rate-limit and to collapse duplicate reports per drop.
- Reported drops stay visible until the admin acts — automatic take-down on N reports is deliberately **not** in v1 (trivially griefable for secret links). Revisit only with evidence.
- Optional v1.1: e-mail notification on new reports via Cloudflare Email Routing, so the admin doesn't have to poll the admin page.

### 9.5 Admin moderation

- Auth: single operator secret `DROP_ADMIN_TOKEN` (set via `wrangler secret put`), sent as `Authorization: Bearer …`, constant-time compared. No admin accounts/UI framework — one trusted operator.
- **Admin page `/drop/admin`** (static, token pasted at runtime and kept in memory only): lists open reports with drop metadata and preview links, one-click **Delete** / **Delete + ban content** / **Dismiss report**. Everything it does is also plain `curl` against the §8 admin endpoints.
- **Delete** removes the drop and cascades to files/content; the share URL turns 404. **Delete + ban** additionally writes all the drop's `content_hash`es to `banned_hashes`, so re-uploading the same bytes is rejected (`422`) — policy violations don't come back under a fresh shareId.
- Admin can also delete unreported drops directly by shareId (the `DELETE` endpoint doesn't require a report to exist).

---

## 10. Implementation Plan

Each phase ends green: `pnpm turbo build`, `pnpm turbo typecheck`, `pnpm turbo test`, `pnpm biome check .`.

1. **Scaffold `apps/drop`** — Worker + wrangler config (D1 + DO bindings, static assets), tiny router, D1 migrations, `@bpmnkit/ui` token wiring. *Verify: `wrangler dev` serves the drop page locally with bpmnkit styling; migration applies to local D1.*
2. **Upload pipeline (multi-file)** — POST endpoint: per-file sniff → parse (`@bpmnkit/core`) → caps + ban check → metadata extraction → atomic store → shareId. *Verify: Vitest tests for sniffing/validation/caps/ban/atomicity using files from `bpmn-samples/`; mixed-validity drop rejected with per-file errors.*
3. **Share page + BPMN viewer + tabs** — server-rendered shell, viewer bundle on `@bpmnkit/canvas` + `zoom-controls` + `minimap`, file tabs, manifest/raw/JSON downloads. *Verify: Playwright smoke test — drop two samples, follow the link, tabs switch, SVG renders, downloads byte-identical to input.*
4. **DMN + Form viewers + cross-file links** — `dmn-viewer`/`form-viewer` per kind; `file-resolver` wiring so `formId`/`decisionId` jump between tabs. *Verify: BPMN+form+DMN fixture — clicking the user task opens the form tab.*
5. **Presence DO** — `PresenceRoom` with hibernating WebSockets, viewer badge, debounced view-count/`expires_at` writes. *Verify: two browser contexts on one shareId both show "2 viewing"; count drops on close.*
6. **Moderation & reporting** — reports endpoint + dialog, admin endpoints, `/drop/admin` page, `banned_hashes` enforcement. *Verify: report → appears in admin list → delete+ban → share 404s and re-upload of same bytes rejected.*
7. **Retention + hardening + policy pages** — cron cleanup, rate limits, CSP, XSS/XXE regression tests, `noindex`, terms/privacy pages (content per §9.3). *Verify: expired fixture removed by cron handler test; security tests pass; upload notice links resolve.*
8. **Deploy + route** — production D1, secrets, `deploy-drop.yml` workflow, route `bpmnkit.com/drop*` on the zone (precedence over the Pages custom domain), production smoke test.

Repo housekeeping when implementation starts: `apps/drop` is deploy-only (not published to npm), so the "Adding a New Package" README/LICENSE script requirements don't apply, but `doc/progress.md`, `doc/features.md`, and `doc/roadmap.md` updates do.

## Cost

Everything fits Cloudflare's free tier at hobby/launch scale: Workers free plan (100k req/day), D1 free (5 GB, 100k writes/day — one drop = a handful of writes), Durable Objects free (SQLite-backed, hibernated WebSockets), no R2 needed. First paid trigger would be sustained traffic beyond 100k requests/day — a good problem.

---

## 11. Future Ideas (explicitly not v1)

- **"Open in Studio"**: hand the drop off to `apps/studio` for editing a copy.
- **Social preview images**: `exportSvg` from `@bpmnkit/core` already renders server-side SVG; rasterizing for `og:image` needs a wasm rasterizer (new dependency — decide then).
- **ASCII preview** for terminal users via `@bpmnkit/ascii` (`curl bpmnkit.com/drop/:id.txt`).
- **Download all as `.zip`** (a minimal store-only ZIP writer is ~100 lines, no dependency needed).
- **Deletion tokens** for uploaders, QR codes, password-protected drops, report-notification e-mails (§9.4).

---

## 12. Decisions (resolved 2026-07-09)

| Question | Decision |
|---|---|
| Host | **`bpmnkit.com/drop`** — zone already on Cloudflare; Worker route carved out next to the Pages-hosted landing (§3) |
| Retention | **90-day sliding TTL** since last view + daily cron cleanup (§7) |
| Moderation | **Admin delete** via token-protected endpoints + minimal `/drop/admin` page, with optional content-hash ban (§9.5) |
| Multi-file | **Yes, in v1** — up to 20 files/drop with tabbed viewer and cross-file `formId`/`decisionId` navigation (§2, §5) |
| Branding | **bpmnkit tokens** (`@bpmnkit/ui`, `--bpmnkit-*` vars, light/dark) (§3) |
| Policies | Upload = passive acknowledgment of Terms/Privacy, `tos_version` recorded (§9.3) |
| Abuse | Public **"Report abuse"** flow on every share page, feeding the admin queue (§9.4) |
| Presence | **Durable Objects**, no external SaaS (§6) |
