# Drop v2 — AI Process Review & Engaging Landing Page (Plan & Spec)

> Status: **proposal / not implemented** — written 2026-07-10.
> Builds on [`doc/drop-spec.md`](drop-spec.md) (shipped in `apps/drop`, PR #145).
> Scope: (1) what Cloudflare's AI free tier gives us, (2) an "AI process review" feature for Drop built on it + `@bpmnkit/core`, (3) a landing-page redesign that sells the product the way [cloudflare.com/drop](https://www.cloudflare.com/drop/) does.

---

## Part 1 — Cloudflare Workers AI: what the free tier includes

Numbers from the official [Workers AI pricing page](https://developers.cloudflare.com/workers-ai/platform/pricing/) (fetched 2026-07-10):

- **10,000 Neurons per day free**, on both Free and Paid Workers plans, no credit card. Resets daily at 00:00 UTC. Overage on paid: **$0.011 / 1,000 neurons**.
- The binding is zero-ops: `env.AI.run(model, { messages })` from the same Worker that already serves Drop — no API key, no second vendor, same request context as D1.
- Relevant text-generation models and their neuron cost:

| Model | Input (per M tokens) | Output (per M tokens) |
|---|---|---|
| `@cf/openai/gpt-oss-120b` | 31,818 n ($0.35) | 68,182 n ($0.75) |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 26,668 n ($0.293) | 204,805 n ($2.253) |
| `@cf/meta/llama-3.1-8b-instruct` | 25,608 n ($0.282) | 75,147 n ($0.827) |
| `@cf/mistral/mistral-7b-instruct` | 10,000 n ($0.11) | 17,300 n ($0.19) |

### What one BPMN review costs

`compactify()` from `@bpmnkit/core` was built exactly for this — a token-efficient JSON form of a diagram. A typical 25–40-element process compacts to **~1.5–3k tokens**; add deterministic findings (~0.5k) and a system prompt (~0.5k) → **~4k input, ~800 output** per review:

| Model | Neurons / review | Free reviews / day |
|---|---|---|
| GPT-OSS 120B | ~180 | **~55** |
| Llama 3.3 70B | ~270 | ~37 |
| Llama 3.1 8B | ~160 | ~62 |

**Verdict: comfortably enough** for a rate-limited launch feature — and with per-content-hash caching (§2.4) each *unique* diagram costs neurons only once, so real capacity is far higher than raw calls/day. If Drop outgrows the free tier, ~$0.002/review on the paid meter is a rounding error.

**Recommended model: `@cf/openai/gpt-oss-120b`** — strongest reasoning of the set, and its *output* tokens (which dominate a review) are 3× cheaper than Llama 70B's. `llama-3.1-8b-instruct` as the configurable "budget mode" fallback.

---

## Part 2 — Feature spec: "AI Process Review" in Drop

### 2.1 The idea

Every shared diagram gets a one-click, read-only **AI review**: a prioritized, plain-language assessment of the process — risks, anti-patterns, naming, missing error handling — rendered as a panel next to the viewer. It turns Drop from "look at my diagram" into "get feedback on my diagram", which is a reason to *come back* and a reason to *share the link onward*.

### 2.2 Architecture: deterministic core + LLM narration (hybrid)

The monorepo already has a deterministic analysis engine — don't make the LLM guess what code can prove:

1. **Deterministic pass (free, instant, isomorphic)** — in the Worker, run on the stored model:
   - `optimize(defs)` → `OptimizationReport` (categorized, severity-ranked findings)
   - the 15+ pattern-advisor rules (`packages/core/.../optimize/patterns.ts`: missing error boundaries, gateways without default flows, parallel variable conflicts, catch-and-swallow, …)
   - `analyzeVariableFlow(defs)` → unread/unwritten variables
2. **LLM pass (Workers AI)** — gets the `compactify()` JSON + the deterministic findings and produces what rules can't: a prioritized executive summary, *why each finding matters in this specific process*, higher-level modeling smells (task granularity, unclear happy path, misleading names, missing business context), and 3–5 concrete next steps.
3. The panel shows **LLM narrative on top, deterministic findings beneath** — if the AI budget is exhausted or the model errors, the deterministic section still renders. The feature degrades, never breaks.

**Structured output**: use Workers AI's JSON-schema response format so the model returns `{ summary, score, suggestions: [{ elementId?, title, why, severity }] }` — parseable, renderable, and each `elementId` becomes a click-to-highlight on the canvas (`@bpmnkit/canvas` already has element highlighting).

### 2.3 UX

- Share-page toolbar gains **"✨ AI review"** (BPMN tabs only, v1). Click → right-side panel slides in, streams/loads the review.
- Each suggestion is a card: severity dot, title, one-paragraph "why", and — when it references an element — hovering highlights that element on the canvas.
- Footer of the panel: model name, "AI can be wrong — review before acting", and neuron-friendly caching notice ("analysis is cached for this diagram").
- If cached: renders instantly for every subsequent viewer (this is what makes the feature feel magical when a link is shared in a team channel).

### 2.4 Data & budget model

```sql
CREATE TABLE ai_reviews (
  content_hash TEXT PRIMARY KEY,   -- same hash as files.content_hash
  model        TEXT NOT NULL,
  review       TEXT NOT NULL,      -- validated JSON from the schema above
  neurons_est  INTEGER,            -- estimated cost, for the budget ledger
  created_at   INTEGER NOT NULL
);
CREATE TABLE ai_budget (           -- one row per UTC day
  day    TEXT PRIMARY KEY,         -- '2026-07-10'
  spent  INTEGER NOT NULL DEFAULT 0
);
```

- **Cache by `content_hash`** — identical diagrams (re-drops, forwarded links) never re-spend neurons.
- **Daily guard**: before calling the model, check `ai_budget.spent < AI_DAILY_BUDGET` (wrangler var, default ~8,000 neurons — leave headroom). Over budget → `429 { retryAt }`, panel says "AI reviews are busy today" and shows deterministic findings only.
- **Rate limit**: 3 uncached AI reviews per IP-hash per hour (reuses the report-flow salted-hash approach).

### 2.5 API & config

| Route | Method | Behavior |
|---|---|---|
| `/drop/api/ai-review/:shareId/:filename` | POST | Cache hit → `200` review. Miss → deterministic pass + `env.AI.run(...)` → validate against schema → store → `200`. Budget exhausted → `429` with deterministic findings included |

`wrangler.jsonc`: add `"ai": { "binding": "AI" }` and vars `AI_MODEL` (default `@cf/openai/gpt-oss-120b`), `AI_DAILY_BUDGET`. No new dependencies — `env.AI.run` is a platform binding.

### 2.6 Safety & guardrails

- **Prompt injection**: diagram names/documentation are attacker-controlled and go into the prompt. Mitigations: system prompt states the diagram is untrusted data; **JSON-schema output** (free-text can't smuggle markup); the panel renders every string as text nodes (same XSS discipline as the rest of Drop); reviews are advisory-only.
- **No mutations in v1** — the AI never edits the diagram. (v2 idea: have the model emit `BpmnOperation[]`, validate by `applyOperations` + re-parse on a copy, and offer a "preview improved diagram" tab — the operations DSL makes this verifiable, not vibes. Explicitly out of scope now.)
- **Dev caveat**: the `AI` binding in `wrangler dev` proxies to the real API (needs a logged-in CF account) — tests therefore mock `env.AI` and assert on the pipeline around it; the deterministic pass is fully testable offline.

---

## Part 3 — Landing page v2: sell it like cloudflare.com/drop

### 3.1 What CF Drop's page does right (and we currently don't)

Cloudflare Drop's page is one promise ("Drop a folder or zip. See your site live in seconds."), one gesture (the **whole page** accepts the drag), and **instant gratification** — you experience the product before reading about it. Our current page *describes*; theirs *demonstrates*. The redesign closes that gap with five moves:

### 3.2 The five moves

**1. The whole page is the drop zone.**
Dragging a file **anywhere** over the page dims it and shows a full-viewport overlay — "Release to share your diagram" with an animated dashed border. The hero card remains as the visible affordance, but every pixel accepts the drop (plus `Ctrl/Cmd+V`: pasting raw BPMN XML anywhere creates a drop — the ultimate low-friction path for people who have XML in a clipboard, not a file).

**2. A live diagram in the hero — show, don't tell.**
Replace static hero space with a **real `@bpmnkit/canvas`** rendering a polished sample process, edges drawing themselves in on load (CSS `stroke-dashoffset` animation) and a subtle token pulse traveling the happy path on loop. Caption: *"This is what people see when they open your link."* Gated behind `prefers-reduced-motion`; pure CSS + the already-shipped viewer bundle, zero new deps, CSP untouched.

**3. "No file handy? Open the demo drop."**
One button → a **pinned demo drop** (a real share: BPMN + linked DMN + form, seeded once, `expires_at = NULL`) so a visitor experiences the full share page — tabs, cross-file links, presence, downloads — in one click and zero writes. This is CF Drop's "live in seconds" moment, adapted: the fastest possible path from curiosity to product.

**4. "What people drop" — use cases as rendered mini-diagrams, not icons.**
A card row where each card contains an actual small rendered diagram (static SVG via `exportSvg` at build time) plus one concrete sentence:
- *Code review* — "Attach the process next to the PR that implements it."
- *Incident channel* — "Stop describing the flow in Slack. Drop it."
- *Docs & tickets* — "A link that renders beats a stale screenshot."
- *Teaching & workshops* — "Hand every student the same live diagram."
- *Client handoff* — "Send a process draft without asking anyone to install a modeler."
Each card links to a matching pinned sample drop.

**5. Proof and depth below the fold.**
- **Live counters** from D1 ("12,480 diagrams shared · 96,210 views"), cached 60 s — CF-style network-effect proof. Hidden below a threshold so early numbers don't undermine it.
- **For developers**: a dark terminal block — `curl -F files=@order.bpmn https://bpmnkit.com/drop/api/drops` → the JSON response → `/manifest.json` and `?format=json` one-liners. (CF Drop's audience overlap: people who love "no account, has an API".)
- **AI review teaser** (ships with Part 2): a mock suggestion card stack — "3 tasks lack error boundaries · variable `orderId` written twice in parallel branches" — with the ✨ button.
- **Compact FAQ** (`<details>`): How long do links last? Who can see my diagram? What formats? Is it really free? File limits?
- Keep the existing Terms/Privacy notice placement (upload gating stays unchanged).

### 3.3 Page order

1. Hero: headline + full-page drop affordance + live canvas demo + "Open the demo drop"
2. What people drop (5 mini-diagram cards)
3. How it works (existing 3 steps, tightened)
4. AI review teaser *(after Part 2 ships)*
5. For developers (curl block)
6. Live counters + FAQ + footer

Headline direction (current one is close, sharpen the promise): **"Drop a BPMN file. Get a link that renders."** — sub: "Share living diagrams — not screenshots — with anyone, in seconds. No account."

### 3.4 Implementation notes

- Everything stays static-assets + the existing Worker; the hero demo reuses `viewer.js`'s canvas import (a second small entry `landing.js`).
- Sample mini-SVGs generated at build time by `scripts/build-client.mjs` calling `exportSvg` — no runtime cost.
- Counters: `SELECT COUNT(*) FROM drops` + `SUM(view_count)` behind `/drop/api/stats`, `Cache-Control: max-age=60`.
- Demo drops seeded by a small `scripts/seed-demo.mjs` (runs via `wrangler d1 execute`; pinned via `expires_at = NULL`); their share ids become build-time constants.
- No new dependencies, CSP unchanged (`'self'` only), all animation `prefers-reduced-motion`-gated.

---

## Part 4 — Phased plan

Each phase ends green (`build`, `typecheck`, `test`, `check`) and is verified with Playwright screenshots like the v1 work.

1. **Landing v2 — structure & demo** — full-page drop target + paste-to-drop, hero live canvas with draw-in animation, demo-drop seeding + button. *Verify: drag-anywhere overlay appears; paste of sample XML creates a drop; hero canvas renders; demo link opens a working share page.*
2. **Landing v2 — story** — use-case cards (build-time SVGs), developer curl block, stats endpoint + counters, FAQ. *Verify: screenshots; `/drop/api/stats` cached and correct.*
3. **AI review — deterministic backbone** — findings endpoint running `optimize` + patterns + variable flow in the Worker; panel UI rendering them (no LLM yet). *Verify: known-bad fixture yields expected findings; XSS test with hostile element names in findings.*
4. **AI review — Workers AI** — `AI` binding, JSON-schema prompt, `ai_reviews` cache, `ai_budget` guard, rate limits; panel gains the narrative section; landing teaser section. *Verify: mocked `env.AI` unit tests (schema validation, cache hit, budget 429); one manual live run against the real binding before enabling the route.*
5. **Polish** — element click-to-highlight from suggestions, model attribution, docs (`progress.md`, `features.md`, README).

## Open questions

1. **Who can trigger an uncached AI review** — any viewer (recommended: it's the growth loop) or only fresh uploads?
2. **Daily budget split** — is 8k of the 10k neurons/day for reviews right, or should Drop stay under e.g. 5k to leave room for future AI features?
3. **Landing counters** — comfortable showing real totals publicly from day one, or keep them hidden until the numbers look healthy?
4. Ship order: landing v2 first (pure win, no risk) then AI, or AI first? Recommendation: **landing first**, AI teaser lands with the AI phase.

## Sources

- [Workers AI pricing (official)](https://developers.cloudflare.com/workers-ai/platform/pricing/) — free tier & per-model neurons
- [Workers AI product page](https://www.cloudflare.com/products/workers-ai/)
- [Cloudflare Drop](https://www.cloudflare.com/drop/) · [changelog post](https://developers.cloudflare.com/changelog/post/2026-07-08-cloudflare-drag-and-drop/) — UX reference (full-page drag, instant result, claim-to-keep)
