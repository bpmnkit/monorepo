# Roadmap

Feature roadmap for the BPMN Kit monorepo. Items are ordered by phase within each section.
Check `[x]` when an item is complete.

---

## Builder Experience

> Full proposal and design rationale: [`doc/builder-experience.md`](builder-experience.md)

### Phase 1 — Correctness Foundations

Low effort, high signal. Extend existing infrastructure without new concepts.

**Pattern Advisor** (`packages/plugins/src/pattern-advisor`, `packages/core/src/bpmn/optimize/patterns.ts`)

- [x] Define `PatternFinding` interface and integrate with existing `OptimizationFinding` system
- [x] Implement 15 pattern rules (see `builder-experience.md` §Proposal 3 for the full list):
  - [x] HTTP/REST service task without error boundary
  - [x] Exclusive gateway without default flow
  - [x] Sub-process without error boundary
  - [x] Call activity with no error propagation
  - [x] Parallel branches writing the same variable
  - [x] User task without timer boundary
  - [x] Service task output mapping with no result consumer
  - [x] Error boundary leading directly to end event (catch-and-swallow)
  - [x] Exclusive gateway with only one outgoing flow
  - [x] Undocumented process start variables
  - [x] Timer boundary with duration 0
  - [x] Boundary event with no outgoing flow
  - [x] Empty text annotation
  - [x] Duplicate job type across multiple service tasks
  - [x] FEEL condition using only literal values (never changes at runtime)
- [x] New `pattern-advisor` canvas plugin: persistent side panel with per-element findings
- [x] Canvas badge indicator on affected elements
- [x] [Apply Fix] for auto-fixable patterns; [Dismiss] per element
- [x] Wire `error`-severity patterns into the deploy plugin's optimizer guard

**Chaos Simulation Mode** (`packages/plugins/src/process-runner`)

- [x] Add "Chaos" toggle to the process runner panel
- [x] Implement chaos worker wrapper with configurable failure probability (default 20%)
- [x] Injection types: service failure, null response, random delay
- [x] Post-run summary: "N paths led to stuck instances, M unhandled errors found"
- [x] Export chaos findings as draft test scenarios (Proposal 2 format)

---

### Phase 2 — Static Analysis

Medium effort. New optimize module and canvas overlay plugin.

**Variable Flow Analysis** (`packages/core/src/bpmn/optimize/variable-flow.ts`, `packages/plugins/src/variable-flow`)

- [x] FEEL identifier extractor: walk `@bpmnkit/feel` AST, collect `Name` nodes (excluding built-ins)
- [x] Build variable scope graph: walk `BpmnDefinitions` graph tracking producers/consumers per path
  - [x] IO mapping output targets → variable producers
  - [x] IO mapping input sources → variable consumers (FEEL identifiers)
  - [x] Script task `resultVariable` → variable producer
  - [x] Sequence flow `conditionExpression.text` → variable consumers (FEEL identifiers)
- [x] Implement findings:
  - [x] Variable referenced in condition but never set on that path
  - [x] Variable set but never consumed downstream
  - [x] IO mapping input source references undefined variable
  - [x] Fuzzy-match suggestions for likely typos (Levenshtein distance ≤ 2)
- [x] Integrate with `optimize()` as a new category `"data-flow"`
- [x] Variable flow canvas overlay plugin:
  - [x] Color elements by role: producer / consumer / both
  - [x] Hover element → variable read/write table tooltip
- [x] Hover sequence flow → variables in scope at that edge
- [x] Add variable flow context to AI bridge compact format

**Time-Travel Simulation Debugger** (`packages/plugins/src/process-runner`)

- [x] Record engine event log during simulation (capped at 10,000 events)
- [x] Timeline scrubber UI below the canvas
- [x] State projection at time T: replay events up to T for variables, token positions, FEEL evals
- [x] Variables tab, FEEL tab, and token highlight update to show state at T
- [x] "Replay from here" button

**Process Input Validation** (`packages/core`, `packages/plugins`, `apps/studio`)

- [x] `buildValidationDmn(startEventId, variables)` — generate DMN Collect-hit-policy table from `InputVariableDef[]` (`@bpmnkit/core`)
- [x] `insertValidationStructure` / `removeValidationStructure` — splice BRT + XOR gateway + error end event after start event, restore on remove (`@bpmnkit/core`)
- [x] `findValidationStructure` / `getValidationInputNames` — detect existing structure and read variable names from DMN (`@bpmnkit/core`)
- [x] Start Event config panel "Input Validation" group: Add/Edit/Remove actions via modal wizard (`@bpmnkit/plugins/config-panel-bpmn`)
- [x] Process runner variable hints: reads input column names from companion DMN, shows chips in Play panel (`@bpmnkit/plugins/process-runner`)
- [x] Studio wiring: `onCreateValidationDmn` saves DMN as a new model, `onEditValidationDmn` navigates to it, deploy auto-bundles referenced DMN companions (`apps/studio`)

---

### Phase 3 — Test Contracts

Medium effort. Closes the process correctness gap end-to-end.

**Scenario-Based Testing — Process Spec** (`packages/plugins/src/process-runner`, `apps/cli`)

- [x] Define `.bpmn.tests.json` sidecar format (`ProcessScenario` type in `@bpmnkit/engine`)
- [x] Test runner: `@bpmnkit/engine` with per-scenario job worker mocks (`packages/engine/src/scenario.ts`)
- [x] Path assertion: compare `instance.visitedElements` against `expect.path`
- [x] Variable assertion: deep equality on final scope variables against `expect.variables`
- [x] "Tests" tab in the process runner panel:
  - [x] Scenario list with pass/fail badges
  - [x] Run all / run selected buttons
  - [x] Expandable diff on failure: expected vs actual path, variable mismatches highlighted
- [x] Storage plugin integration: auto-discover and open sidecar test file alongside BPMN
- [x] CLI command: `casen test <file.bpmn>` — runs all scenarios, reports pass/fail
- [x] AI integration: "Generate test scenarios" uses compact format → drafts scenario JSON
      covering all gateway branches and error paths
- [x] Integration with Phase 1 chaos: chaos findings exportable as failing test scenarios

---

### Phase 4 — Live Feedback Loop

High effort. Operationally transformative — closes the design/production gap.

**Hot Reload Development — Process Live** (`packages/plugins/src/live-mode`)

- [x] "Live" toggle in editor toolbar; requires proxy connection and a sandbox profile
- [x] Auto-deploy on save: debounced (500ms) `POST /api/v2/deployments` via deploy plugin
- [x] Dev instance lifecycle: start on enable, maintain key across sessions (stored in IndexedDB)
- [x] Auto-migration: `POST /api/v2/process-instances/{key}/migration` on every redeploy
- [x] Migration conflict detection: compare element ID sets; surface mapping UI if instance is
      waiting at a removed element
- [x] Live token overlay: poll active element instances; drive token-highlight canvas API
- [x] Variable inspector: hover element → show live variable values from running instance
- [x] Sandbox guard: Live mode disabled when active profile is tagged as production
- [x] Integration with Phase 3 tests: Live mode only enabled when test suite is green (configurable)

---

### Phase 5 — Collaboration

Medium effort. Expands the builder experience to non-technical stakeholders.

**Story Mode** (`packages/plugins/src/story-view`, `packages/core/src/bpmn/story.ts`)

- [x] View mode toggle in main toolbar: Edit / Story
- [x] Topological sort of `BpmnDefinitions` → CSS flexbox column renderer (Kahn's algorithm, cycle-safe)
- [x] Swimlane layout: derive lanes from pool/lane names; default lane if no laneSet
- [x] Element card renderers:
  - [x] Service task → "System: [name]" card
  - [x] User task → "[Lane/role]: [name]" card with assignee if set
  - [x] Gateway → "Decision" card with outgoing conditions inline
  - [x] All element types mapped to roles with colored left borders
- [x] AI condition summarizer: calls `summarizeCondition` option, caches in-memory per condition
- [x] Read-only shareable link: opens process in story mode with no edit controls
- [x] Comment threads on elements:
  - [x] Stored in IndexedDB keyed by `${fileKey}:${elementId}`
  - [x] Visible in Story mode; comment count badge on card button
  - [x] Resolve/unresolve threads; author display name from active profile

---

## AIKit — Intent-Driven Process Automation

> Full spec: [`doc/aikit.md`](aikit.md)

### Phase 1 — MCP Foundation

- [x] `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`, `bpmn_run_history`
- [x] `worker_list`, `worker_scaffold`, `pattern_list`, `pattern_get`
- [x] Wire all tools into `bpmn-aikit` stdio MCP server
- [x] `.claude/mcp.json` project config

### Phase 2 — Pattern Library

- [x] `@bpmnkit/patterns` package with 7 seed patterns
- [x] `findPattern(query)` keyword-scoring match
- [x] Pattern schema: readme, template, workers, variations

### Phase 3 — Standalone Worker Infrastructure

- [x] `@bpmnkit/worker-client` — thin Zeebe REST wrapper with OAuth2 support
- [x] `worker_scaffold` upgraded to generate TypeScript using `@bpmnkit/worker-client`
- [x] `casen worker start [name]` — starts scaffolded workers from `./workers/`

### Phase 4 — Claude Code Skills

- [x] `/implement` — end-to-end orchestration skill
- [x] `/review`, `/test`, `/deploy` — standalone skills
- [x] `casen skills install` — copies bundled skills to `.claude/commands/`

### Phase 5 — Docs

- [x] `guides/ai-implement.md` — `/implement` walkthrough
- [x] `guides/workers-standalone.md` — standalone worker lifecycle
- [x] `packages/worker-client.md` — `@bpmnkit/worker-client` API reference
- [x] `guides/patterns.md` — pattern library guide
- [x] `cli/skills.md` — slash commands reference
- [x] Updated getting-started pages to mention AI-first workflow
- [x] Updated `cli/casen.md` with AIKit skills and worker commands sections

---

## AIKit v2 — Deterministic Generation Pipeline

> Full spec: [`doc/spec-bpmn-generation-skills.md`](spec-bpmn-generation-skills.md); analysis: [`doc/ai-bpmn-generation-analysis.md`](ai-bpmn-generation-analysis.md)

Supersedes Phase 1-4 of "AIKit — Intent-Driven Process Automation" above: the LLM never writes BPMN XML — every process is authored as a `ProcessPlan` JSON IR and compiled deterministically by `casen synth`.

- [x] **WP0 — Bug fixes & hygiene**: fixed `scripts/update-connectors.mjs`'s stale output path + added a `catalog-meta.json` sidecar; corrected the `deploy`/`worker` plugin skills to match the real tool/API signatures
- [x] **WP1 — `@bpmnkit/connectors`**: catalog (`listConnectors`/`searchConnectors`/`getTemplate`) + complete deterministic template application (`applyElementTemplate`/`applyConnectorTemplate`) covering every binding kind, dropdown-gated conditions, and FEEL validation
- [x] **WP2 — Core builder additions**: `buildAiAgentSubProcess()` (AI Agent Sub-process constructor with `fromAi()` tooling), `documentation`, `zeebe:properties`, ad-hoc `completionCondition`/`cancelRemainingInstances`, message `correlationKey`, user-task assignment/schedule/priority
- [x] **WP3 — ProcessPlan IR + compiler**: `compilePlan()`/`extractPlan()`/`mergePlan()`; `casen synth`, `casen plan extract|schema`, `casen connector search|list|show`
- [x] **WP4 — Deploy-grade validation**: `feel-syntax`, `deploy`, `agentic` optimizer categories + `connector/missing-required`; `casen lint --profile deploy` deploy-readiness gate
- [x] **WP5 — Honest simulation**: engine dispatches job-worker-backed ad-hoc sub-processes (e.g. AI Agent) through the job-mock mechanism; `bpmn_simulate` actually executes scenarios (`mode: "execution"`) instead of always doing structural-only analysis; `casen synth` writes a `.bpmn.tests.json` sidecar from `plan.tests`
- [x] **WP6 — Skills v2**: consolidated CLI-first `plugins-claude/bpmnkit-claude` plugin (`implement`/`extend`/`agent`/`connect`/`review`/`test`/`deploy`), no MCP server required; generated + hand-written reference docs; new `casen deploy deploy` command
- [x] **WP7 — Golden-prompt eval harness**: `scripts/eval-generation/` — 15 golden prompts, plan-level CI-safe subset + opt-in full-LLM mode
- [x] **WP8 — Documentation & roadmap**: this section + `doc/features.md`/`doc/progress.md` entries; `apps/docs` guides rewritten for the plan/synth flow (`guides/ai-implement.md`, new `guides/ai-agents.md`, `guides/claude-code-plugin.md`, `guides/patterns.md`), `cli/skills.md` rewritten CLI-first, `cli/casen.md`/`cli/connector.md` document `casen synth|plan|connector`; new `casen pattern list|get` CLI command (the domain-pattern lookup the skills/agent were missing); `packages/connectors` README reconfirmed via `scripts/generate-readmes.mjs`

---

## Documentation on the Landing Site

> Implemented 2026-08-29 — see [`doc/progress.md`](progress.md).

- [x] Move `apps/docs/src/content/docs` into `apps/landing/src/content/docs` as a `docs` content collection
- [x] `DocsLayout.astro` + `docs.css` — sidebar, table of contents, breadcrumb, prev/next pager, edit link, mobile drawer, all in the landing's design system
- [x] Auto-generated sidebar / pager / `/docs` index from the collection, ordered by `sidebar.order`
- [x] Shiki theme built from the site's `--code-*` tokens so Markdown code blocks match the hand-built panels
- [x] Client-side search over a build-time `/docs/search.json`, replacing Starlight's Pagefind
- [x] `llms.txt` indexes every doc page; `llms-full.txt` carries their full Markdown
- [x] Move the `cli/plugins.md` generator and the docspack source to the landing app
- [x] Delete `apps/docs` and `deploy-docs.yml`; repoint every `docs.bpmnkit.com` reference at `bpmnkit.com/docs`
- [x] `_redirects` for the four legacy path prefixes (`/getting-started`, `/guides`, `/packages`, `/cli`)
- [ ] **Manual, needs DNS access**: point `docs.bpmnkit.com` at the landing Pages project (or redirect it to `https://bpmnkit.com/docs`) and retire the `bpmn-sdk-docs` Pages project

---

## SEO & Discoverability

> Full plan: [`doc/seo-plan.md`](seo-plan.md)

- [x] **Phase 1 — Technical foundation**: shared `<Seo>` component + JSON-LD helpers (`packages/astro-shared`), `@astrojs/sitemap` wired into `landing`/`docs`/`learn`, `robots.txt` on all three, full canonical/OG/Twitter tags (fixed a `build.format: "file"` canonical bug — `Astro.url.pathname` resolved to literal `.html`/`.html` suffixes)
- [x] **Phase 2 — Domain & brand unification**: docs renamed "BPMN SDK" → "BPMN Kit" and its `site` URL fixed from `bpmn-sdk-docs.pages.dev` to `docs.bpmnkit.com` (was also serving fake `@bpmn-sdk/*` package names on the docs homepage — corrected to real `@bpmnkit/*`); `learn` given a `site` URL for the first time; cross-site nav/footer linking added across all three apps
- [x] **Phase 5 — Structured data**: `organizationJsonLd`/`softwareApplicationJsonLd`/`articleJsonLd`/`breadcrumbJsonLd`/`faqJsonLd` helpers, applied site-wide plus per-page on connectors, compare, blog, and glossary pages
- [x] **Phase 4 — Evergreen pages**: `/connectors` catalog (116 pages generated from `@bpmnkit/connectors`' real template data), `/compare/bpmn-js` + `/compare/camunda-modeler`, `/feel-functions` (all 87 real `@bpmnkit/feel` builtins, verified 1:1 against `builtinNames()`), `/use-cases` (4 pages: AI workflow generation, embedding the editor, Camunda 8 automation, process simulation), and a 12-entry `/glossary` on `learn.bpmnkit.com` (events, gateways, tasks, sub-processes, boundary events, message events, timer events, call activities — each with a generated diagram + runnable `@bpmnkit/core` example, cross-linked to the matching tutorial where one exists)
- [x] **Phase 3 — Blog**: `bpmnkit.com/blog` (Astro content collection + RSS), all 10 posts from the `doc/seo-plan.md` editorial calendar written and published
- [ ] **Phase 6 — Distribution & measurement**: can't be done from the repo (needs live domain/DNS access and third-party accounts) — full step-by-step checklist in [`doc/seo-phase6-checklist.md`](seo-phase6-checklist.md): Search Console + Bing Webmaster setup, analytics, backlink/outreach targets, and an ongoing measurement cadence

---

## CLI Enhancements

- [x] `casen test <file.bpmn>` — run process spec scenarios (Phase 3)
- [x] `casen lint <file.bpmn>` — run optimizer + pattern advisor + variable flow analysis,
      exit code 1 on errors (CI integration)
- [x] `casen story <file.bpmn>` — render story mode to static HTML for sharing without the editor

---

## BPMN Kit Drop (`bpmnkit.com/drop`)

> Full spec and design rationale: [`doc/drop-spec.md`](drop-spec.md) — implemented in `apps/drop` (2026-07-09).

- [x] Scaffold `apps/drop` — Cloudflare Worker, D1 migrations, static drop page with `@bpmnkit/ui` tokens
- [x] Multi-file upload pipeline — sniff/parse/validate via `@bpmnkit/core`, store original + JSON model in D1, ban-list check
- [x] Share page `/drop/:shareId` — read-only BPMN viewer (`@bpmnkit/canvas` + zoom/minimap plugins), file tabs, raw/JSON downloads
- [x] DMN + Form viewers (`dmn-viewer`, `form-viewer` plugins) + cross-file `formId`/`decisionId` navigation
- [x] Presence — Durable Object per shareId, hibernating WebSockets, "N viewing" badge
- [x] Moderation — abuse-report flow, admin endpoints + `/drop/admin` page, delete + content-hash ban
- [x] Retention cron + hardening (CSP, XSS/XXE regression tests) + Terms/Privacy pages
- [x] Deploy workflow (`deploy-drop.yml`); enabling the `bpmnkit.com/drop*` route requires live Cloudflare access (D1 id + secrets)

### Drop v2 — AI review & engaging landing

> Full analysis and spec: [`doc/drop-v2-spec.md`](drop-v2-spec.md) — decisions resolved (AI review is passcode-gated), ready to implement; hand-off notes in the spec's Part 5.

- [x] Landing v2 structure: full-page drop target, paste-to-drop, live hero canvas with draw-in animation, in-memory demo drop + button
- [x] Landing v2 story: use-case cards with build-time `exportSvg` mini-diagrams, developer curl block, `/drop/api/stats` counters, FAQ
- [x] AI review backbone: Worker endpoint running `optimize` (pattern advisor + variable flow + FEEL + naming + flow), findings panel (no LLM)
- [x] AI review LLM: Workers AI binding (`@cf/openai/gpt-oss-120b`), JSON-schema output, `ai_reviews` content-hash cache, `ai_budget` daily guard + attempt limiting, `AI_PASSCODE` secret gate (closed beta: `X-Drop-AI-Code` header, constant-time check, localStorage persistence)
- [x] Polish: suggestion→canvas element highlighting (hover + click), model attribution, docs

### Drop v3 — authoring and live single-writer editing

> Analysis, design and ordered plan: [`doc/drop-collaborative-editing-analysis.md`](drop-collaborative-editing-analysis.md),
> [`doc/drop-live-editing-design.md`](drop-live-editing-design.md),
> [`doc/drop-live-editing-plan.md`](drop-live-editing-plan.md). Simultaneous multi-writer editing
> was analysed and deliberately not chosen; one live writer with the others watching was.

**Track A — author, then drop**

- [x] A1 — "Share as a drop" in the `/editor` main menu: posts the open diagram to the existing
      `POST /drop/api/drops` (no Worker changes), dev-proxied so it stays same-origin
- [x] A2 — localStorage draft on `/editor`: written 1 s after the last edit and flushed on
      `pagehide`, offered back once per tab, cleared on a successful share

**Track B — the version log** (blocks every task that writes to a drop)

- [x] B1 — a `file_current` table (never write `file_content`), `file_versions`,
      `drops.updated_at`; serve current-else-original, `?v=0` pins the Original download
- [x] B2 — `appendMilestone()`: `(hour, session)` bucket, `content_hash` suppression, prune to 10
      — the pinned original plus ten milestones, eleven recoverable states per file, forever
- [x] B3 — history panel, `?v=n` version fetch, and per-milestone "layout only" / "model changed"
      labels derived from the stored hashes (no re-parse), with the bound stated in the panel
- [x] B4 — restore, as an append rather than a rewind

**Track C — browser history** — folded into D6. `apps/drop` has no editor to attach a change
handler to until the editor is loaded on claim, and the panel is only worth building next to the
server history it must be distinguished from. `@bpmnkit/plugins/history` takes opaque
`(projectId, fileId)` strings, so Drop passes `(shareId, filename)` when D6 lands.

- [x] C1 — `saveCheckpoint` on the editor's change handler, debounced *(landed with D6)*
- [x] C2 — `createHistoryPanel`, kept visibly separate from the server milestones *(landed with D6)*

**Track D — the room** (requires B)

- [x] D1 — `PresenceRoom` → `DocRoom` (wrangler `renamed_classes`), plus the debounced
      `view_count` / `expires_at` write `drop-spec.md` §6 described and never shipped: a socket
      join is the view, batched in the room's storage and flushed to D1 on a 60s alarm
- [x] D2 — the edit baton: claim / granted / denied / release / warning / revoked, with two
      distinct reclaims — a socket that stopped pinging (`getWebSocketAutoResponseTimestamp`)
      and a holder who is present but idle, the latter warned first and keyed on messages that
      wake the room rather than on heartbeats
- [x] D3 — `@bpmnkit/editor`: ids minted from a seed carried in the op, a `diagram:op` event
      beside `diagram:change`, and `getViewport`/`setViewport` public on both the canvas and the
      editor. `applyOp` is the editor's own mutation path too, so a local edit and its replay
      cannot drift
- [x] D4 — op protocol and server-side replay: the room runs the writer's op itself through
      `@bpmnkit/editor/headless`, judges the document that comes out (`checkIntegrity`), and only
      then makes it the state; the whole document lives in DO storage, so a hibernated room
      needs no op log to catch up
- [x] D5 — watcher replay with a hash check and resync: `DocWatcher` runs the same `applyOp` the
      writer and the room ran, compares the room's hash, and on any divergence throws its document
      away and asks for the current one — exactly once, however many ops arrive while it waits
- [x] D6 — editor loaded on claim via dynamic `import()` (25 KB gzipped, fetched on Edit and
      never by a reader), viewport carried across the swap, HUD only ever built for the writer;
      brings track C with it — local checkpoints every 30 s of dirty editing and an *On this
      device* panel beside *Saved milestones*, never merged
- [x] D7 — autosave: the object's storage takes every op, D1 is brought level 30 s after the
      first unsaved edit via `exportPreserving` (so an edited drop is not reformatted top to
      bottom), and a milestone is cut once per `(hour, session)` and refreshed on release

**Track E — hardening**

- [x] E1 — the three upload-time checks moved to edit time: the ban list is re-checked on every
      save (and the room halts on a hit), the row cap is enforced on the op rather than only on
      the save, and the entity tag names the version and the representation instead of being the
      content hash — which the XML and the JSON were sharing
- [x] E2 — Turnstile on `claim`: one challenge per editing session, verified in the room, with
      the widget rendered on Edit rather than on the page and the content policy widened only
      where it can appear. Off unless `TURNSTILE_SECRET` is set; set without a site key, every
      claim fails
- [x] E3 — three carve-outs enforced on the socket, not by hiding a button: the demo (no row to
      write to) offers *Edit a copy*, a pinned drop is read-only, and a file with more than one
      process is past what the editor addresses. Each refusal carries the reason
- [ ] E4 — retention slides on edit as well as view
- [ ] E5 — reports carry the version the reporter saw

### Design consistency — Drop + Editor on the landing system

> Design brief: flat, square, hairline-ruled, one terracotta accent, two type roles.
> Tokens live in `packages/ui` as `--bpmnkit-ds-*` (additive; the product palette is unchanged).

- [x] `--bpmnkit-ds-*` token set in `packages/ui` (`tokens.css` + mirrored `UI_TOKENS_CSS`)
- [x] Drop landing page rebuilt to the page spec — split hero, square dashed dropzone,
      hairline card grids, one dark band, code panel, single-open accordion, hairline footer
- [x] Drop's share viewer, diff, moderation and policy pages on the same system; no
      `border-radius` / `box-shadow` / `linear-gradient` and no hex outside the token block
- [x] Space Grotesk + Space Mono copied from the landing app into `public/drop/fonts/` at build
- [x] Editor chrome (`EDITOR_CSS`, `HUD_CSS`, side dock, input modal) flattened and squared;
      bordered groups with internal hairlines; mono uppercase labels; dashed accent selection
      halo that leaves the shape's own stroke alone
- [x] Editor start page + file-tab bar (`@bpmnkit/plugins/tabs`) — welcome panel, examples list
      as one bordered box, mono file-type marks in the one accent, wordmark in place of the logo
      lockup, tab underline on the row's own rule, dialogs and dropdown flattened
- [x] `apps/studio` — `src/styles/design-system.css` re-points `--bpmnkit-*` onto the
      design-system set (one seam for cascivo, Tailwind and the embedded editor); radius and
      shadow collapsed at the scale; circular marks kept; fonts self-hosted; default theme moved
      from `neon` to `light`
- [x] `--bpmnkit-chrome-*` tokens in `packages/editor/src/chrome.ts` — the per-theme ground,
      line, ink, accent and scrim every piece of editor chrome reads, declared once (the
      editor's `--hud-*` names were renamed into this set)
- [x] All remaining `@bpmnkit/plugins` panel chrome — the 12 tracked here plus 11 more found by
      sweeping for shadows rather than theme blocks (diff, lint, minimap, story-view,
      variable-flow, pattern-advisor, zoom-controls, presentation, feel-playground, dmn-editor,
      config-panel-bpmn). 1,060 lines net removed; invariants held by
      `tests/chrome-invariants.test.ts`
- [x] Flip the Editor shell to the light `--canvas` ground of the brief's mock — `:root` now
      carries the design system's light chrome, `BpmnEditor` defaults to `light`, and
      `@bpmnkit/canvas`'s light ground reads `--bpmnkit-ds-canvas`; `dark` and `neon` are
      opt-in from there
- [ ] Canvas dot grid (`@bpmnkit/canvas`)
- [ ] Properties-dock footer row (mono save/lines status + `Deploy ▶`) — no data source yet
- [ ] `flow-navigation` draws its keyboard cursor by recolouring the shape's own stroke; the
      brief wants a dashed halo *around* the shape, which needs a rendered overlay rather than
      a CSS change
- [ ] `story-view`'s `bpmnkit-sv-card--*` type modifiers are emitted nowhere in the repo —
      either wire them up or drop the rules

---

## IDE-Resident Modeling

> Full analysis and rationale: [`doc/miragon-bpmn-modeler-comparison.md`](miragon-bpmn-modeler-comparison.md)
> — measured against `Miragon/bpmn-modeler` (2026-09-09), the bpmn.io-based monorepo behind the
> `miragon-gmbh.vs-code-bpmn-modeler` Marketplace extension. Nothing there is liftable (it wraps
> bpmn.io; we reimplement it), so these are the *problems* worth solving, not code to copy.

Phases are ordered by value per unit of work, with dependencies respected. Each phase is
shippable on its own — nothing later is a prerequisite for the value of anything earlier.

### Phase 1 — Make the diff reachable ✅

The diff engine landed as a library; nothing in the product exposed it. Every later phase
reuses one of these surfaces.

- [x] `@bpmnkit/plugins/diff` — `createBpmnDiff()` paired canvas plugins, four categories,
      legend, synchronised viewports
- [x] `diffDiagram()` promoted to `@bpmnkit/core` (`src/bpmn/diagram-diff.ts`), beside
      `diffSemantics` — the CLI should not depend on a canvas-plugin package, and that is where
      a reader looks for it. The plugin re-exports it
- [x] `casen diff bpmn <before> <after>` (`apps/cli/src/commands/diff.ts`) — names elements
      rather than printing bare ids, `--format json` for scripting, `--exit-code` to gate a
      pipeline, `--ascii` to render both diagrams. Its own group, mirroring `casen view bpmn`,
      rather than the `casen bpmn diff` this list first proposed: the pinned groups are verbs
- [x] Two-pane diff view in `apps/studio` (`src/pages/ModelDiff.tsx`, `/models/diff`) — two
      pickers, a swap button, a summary bar, and a **Compare** entry point on the Models page.
      Comparing a file against *its own last saved version* is not included: nothing in the
      studio's storage keeps a previous version to compare against
- [x] Diff a shared drop against another (`apps/drop`) — `/drop/:a/diff/:b`, both drops resolved
      server-side so an expired share is a 404 rather than half a comparison; files paired by
      name with a picker per side
- [x] Sub-process planes — `diffDiagram` returns a per-plane breakdown, the legend says how many
      differences sit on a plane the canvas is not showing, and the CLI names the planes

### Phase 2 — Element templates by convention ✅

The largest capability gap found. `@bpmnkit/connectors` parsed the Zeebe element-template JSON
schema but only ever loaded the generated built-in catalogue — a user's own connectors could not
reach the editor at all.

- [x] Discover `.camunda/element-templates/*.json` (`@bpmnkit/connectors/node`), walking up from
      the diagram to the project root, nearest winning; folder name follows `configFolder`
- [x] `collectElementTemplates({ root })` — the opposite, downward walk. Resolution and
      validation are different questions: a CI check that only read the root would pass a project
      whose broken template sits beside a sub-folder's diagrams
- [x] Validation with paths (`properties[3].binding.type`) rather than a JSON-schema engine's
      `oneOf` noise; every problem at once, a rejected template named and skipped, one bad file
      never costing the good ones beside it. Warnings are separate from problems
- [x] Merge into the catalogue via `registerElementTemplates`, later registration winning on an
      id collision, so `listConnectors` / `getTemplate` / `searchConnectors` see a project's own
- [x] `casen connector validate [path]` — whole project or one file, `--format json`, non-zero
      exit for CI. `list` / `search` / `show` include workspace templates, with `--workspace`
      and `--config-folder`
- [x] Browser path: `GET /element-templates?root=…` on the proxy, `workspaceRoot` /
      `workspaceTemplates` on the connector-catalog plugin, wired from the studio's active project
- [x] `TemplateBinding` gains `bpmn:Message#property`,
      `bpmn:Message#zeebe:subscription#property` and `zeebe:linkedResource` — used by the bundled
      catalogue across 98 properties, admitted by neither the union nor `applyElementTemplate`

**Left open, deliberately:**

- [ ] Apply the inbound-message and linked-resource bindings. They validate and warn today; a
      template that depends on one still applies to nothing. This is inbound-connector support,
      a feature of its own rather than part of this phase
- [ ] Per-file template resolution in a browser host. A host registers one merged set for the
      whole project (deeper directories win, by the breadth-first order); the CLI resolves per
      file correctly, the editor does not. Needs the config panel to re-resolve as the open file
      changes

### Phase 3 — Findings on the canvas ✅

`casen lint` had five categories built on `packages/core/src/bpmn/optimize/` — arguably a better
rule set than bpmnlint's — and none of it was visible while modelling.

- [x] `@bpmnkit/plugins/lint` — a marker per offending element, worst severity winning, so a task
      with an error and three warnings reads as an error
- [x] Corner control counting each severity; clicking centres the next offending element and
      pulses it, wrapping around. Names how many findings sit on a plane the canvas is not showing
- [x] Debounced re-lint on `diagram:change` (300 ms default), and the engine layer picked from
      the model's `modeler:executionPlatform`
- [x] `lintDiagram()` in `@bpmnkit/core` — the host-facing seam. `LintDiagnostic` is plain data
      that survives a `postMessage`, which `OptimizationFinding` cannot because of its `applyFix`
      closure, and each diagnostic names the plane its elements are on
- [x] `casen lint` follows the same engine rule and says why it skipped the deployability
      categories; `--profile deploy` forces them back on. Both surfaces ask `lintCategories`
      rather than keeping separate lists
- [x] Installed in the studio editor, so findings appear where the modelling happens

**The engine rule was measured, not assumed.** On an engine-neutral model the full analysis
produces exactly one misleading finding — `deploy` calling a plain service task an error for
having no `zeebe:taskDefinition` — so only `deploy`, `connector` and `agentic` are dropped when
no platform is stamped.

**Noted:** `pattern-advisor` draws its own severity rings for the `pattern` category and now
overlaps this plugin's markers. Nothing installs it and it is a side-panel workflow rather than
canvas decoration, so it was left alone; installing both would double the rings.

### Phase 4 — Editor invariants and navigation ✅

Small, self-contained, and collectively what makes the editor feel like a tool rather than a
canvas. This phase also establishes the **port pattern** every later host depends on: a feature
is a plugin talking to an injected port, never to a host API.

- [x] **Engine-neutral models stay engine-neutral.** The invariant held already — parse → export,
      parse → edit → export, and a new diagram all leave the document alone — and is now covered
      in both directions: a neutral model never gains a platform, one that names an engine keeps
      it verbatim
- [x] **Serializer fix, found while verifying that.** The writer emitted only the namespaces a
      model was parsed with, so a neutral diagram given a `zeebe:taskDefinition` exported a prefix
      bound to nothing — not namespace-well-formed. Prefixes the document uses are now declared;
      ones the model already bound are left alone
- [x] `@bpmnkit/plugins/flow-navigation` — Tab / Shift+Tab along sequence flows, a choice rather
      than a guess at a fan-out, Enter to follow or drill in, `u` to drill out. Intercepts in the
      capture phase and only swallows the key when it moved, so a dead end falls through to the
      canvas's own document-order Tab
- [x] `@bpmnkit/plugins/model-navigation` — Call Activity → process, Business Rule Task →
      decision, User Task → form, in both the Camunda 8 extension shape and the Camunda 7
      attribute one, through an injected `ReferencePort`. Optimistic then corrected; a resolve
      that lands after the diagram changed is discarded
- [x] `CanvasApi` gains `getPlanes()` / `showPlane()` — `BpmnCanvas` had both and no plugin could
      reach them, so none could drill into a sub-process
- [x] [`doc/port-pattern.md`](port-pattern.md) — the four rules, the ports already in this repo,
      the two shapes that are not ports, and where the seam sits for data a host forwards
- [x] Both plugins installed in the studio editor

**Left open, deliberately:**

- [ ] A model that gains *diagram interchange* it never declared namespaces for still exports
      `bpmndi`/`dc`/`di` prefixes bound to nothing — `applyAutoLayout` on a model parsed without a
      diagram is the reachable case. The extension-prefix repair above deliberately excludes the
      structural prefixes: fixing them means either the serializer changing the model a round trip
      produces, or `applyAutoLayout` declaring them, and both collide with contracts
      `semanticHash` and the `writeBpmn` boundary hold constant on purpose. It wants its own
      decision, not a fix in passing

**Two things worth carrying forward.** A capture-phase listener runs before a bubble listener on
the same node regardless of registration order, and `stopPropagation()` there suppresses it —
verified in Chromium, not assumed, because the interception design depends on it. And unit tests
that mount `BpmnCanvas` do not exercise `BpmnEditor`: the editor reports `editor:select` where the
viewer reports `element:click`, and only a browser run caught the difference.

### Phase 5 — VS Code extension, read and review ✅

Scoped deliberately to what read-only unlocks. The prerequisites were unusually well met:
`@bpmnkit/canvas` is framework-agnostic plain DOM with CSS-variable theming, `apps/drop` proves
the stack bundles to browser ESM, `apps/desktop` proves editor plus plugins compose into a host
shell. A read-only extension sidesteps VS Code's custom-editor document protocol entirely, which
is the part that looks trivial and is not. **No package was changed to accommodate the
extension** — the seams Phases 1–4 built were the whole of what it needed.

- [x] Extension host scaffold + webview message protocol (`apps/vscode`, package name `bpmnkit`
      because a VS Code manifest name cannot carry an npm scope). esbuild builds two bundles with
      nothing in common: the host as CommonJS for Node with `vscode` external, the webviews as
      browser ESM. `src/shared/protocol.ts` names no `vscode` type and no DOM type, which is why
      both tsconfigs can include it
- [x] Read-only custom editors for `.bpmn`, `.dmn`, `.form` via `@bpmnkit/canvas` and the
      `dmn-viewer` / `form-viewer` plugins, plus minimap and zoom. `priority: "option"`, not
      `"default"`: the preview opens *beside* the text editor the way Markdown preview does,
      rather than taking over opening a file the extension cannot edit. It follows the open
      buffer as it is typed, and keeps the last drawing that parsed when the file is momentarily
      invalid
- [x] Visual diff for `.bpmn` from the Source Control panel and an Explorer two-file compare
      (Phase 1's engine, wired to the host). A webview panel rather than a diff editor: VS Code's
      diff editor pairs two *text* editors and a custom editor cannot stand in for either side.
      `HEAD` comes from the built-in Git extension's API, whose two needed methods are declared
      structurally rather than by adding a dependency
- [x] `casen lint` findings in the Problems panel, run in the extension host where Node is
      available and `@bpmnkit/core` runs unchanged (Phase 3's host-facing seam). Each finding is
      placed on the element that caused it by `src/host/locate.ts`, a scanner over the raw text —
      a parser is the wrong tool here, since `Bpmn.parse()` discards source positions and the file
      on screen is routinely mid-edit
- [x] Theme follows the active VS Code theme. Every `--bpmnkit-*` token is re-pointed at a
      `--vscode-*` variable **with a literal at the end of the chain**, written once per polarity:
      a missing custom property does not fall through to the value underneath, it poisons the
      declaration, and the first version would have rendered unstyled on any theme missing one
      colour
- [x] Marketplace listing, README, and a support posture stated up front given the pre-1.0 badge.
      `vsce package` produces a 205 KB `.vsix`; the icon is rendered from the site favicon and the
      licence copied from the repository root, so neither can drift

**Verified without VS Code.** The editor cannot run in this environment, so the built webview
bundles are loaded in Chromium with a stubbed `acquireVsCodeApi` — 18 checks covering all three
artifact kinds, the diff, the invalid-file path and both directions of the theme fallback. That
run is what caught the theme defect above. `tests/activation.test.ts` runs `activate()` against a
recorder and asserts the manifest and the implementation agree in both directions, which is the
one class of bug `vsce package` cannot see: a contributed command with no handler appears in the
palette and fails when picked.

**Left open, deliberately:**

- [ ] A `.bpmn` file the editor has not loaded as a text document is not analysed, so the Problems
      panel covers open files only. That is what every other VS Code linter does; analysing a
      whole workspace on activation is a different feature with a different cost
- [ ] No page on `bpmnkit.com/docs` yet — the Marketplace README is the only user-facing
      documentation for the extension

### Phase 6 — VS Code extension, what only this stack can do ✅

Differentiation, not parity. None of this exists in the Marketplace today. Like Phase 5,
almost all of it was assembly: the capabilities already existed as packages, and the work was
deciding where each one belongs in an editor.

- [x] Step-through simulation of the open diagram with `@bpmnkit/engine` and token
      highlighting. `@bpmnkit/plugins/process-runner` mounted in the webview rather than a
      second runner written for this host — Run, One Step, Cancel, live variables, FEEL
      evaluations, the replay timeline. The engine is TypeScript with no server and no Node
      dependency, so the diagram on screen executes inside the editor and nothing is deployed
- [x] FEEL playground as a webview panel, seeded from the editor's **selection** — the
      difference between a playground and a debugger. One panel, re-seeded rather than
      stacked, because the expression under the cursor changes far more often than the wish
      for another tab
- [x] Deploy and start an instance against a `casen` profile. The profile store the CLI
      writes is the only source of clusters, so there is no second place to configure one and
      no credentials in workspace settings. Deployment posts multipart the way `casen deploy`
      does; starting goes through the generated client, by definition **key** so the instance
      runs the version this deploy produced. More than one profile always asks
- [x] ASCII rendering of a diagram, for pasting into a code review. Fenced, because every
      destination collapses runs of spaces, and dedented — which meant dropping the title
      first, since a title at column zero leaves no shared indent to remove

**Two defects that only reuse could have found**, both fixed in `@bpmnkit/plugins` rather than
worked around in the host:

- The process runner offered a **Tests tab to a host that cannot run a scenario**, and it
  opened onto "Pass runScenario in options to enable the Tests tab" — an instruction addressed
  to whoever wrote the host, shown to its users. The tab is now conditional on there being a
  runner behind it
- `buildFeelPlaygroundPanel()` **built DOM without its stylesheet**. Both existing callers
  happened to inject it separately; a new one got a working evaluator that rendered as
  unstyled form controls. The builder now brings its own, which is id-guarded and therefore
  free for callers that still inject

**Left open, deliberately:**

- [ ] Scenario tests in the editor. The runner's Tests tab needs `runScenario` **and**
      somewhere to keep scenarios; in an editor that is a `.bpmn.tests.json` sidecar beside
      the diagram — the same file `casen test` already reads — not the IndexedDB the studio
      uses because it has no filesystem. That is a feature with a story of its own, not a
      checkbox on this phase, and hiding the tab is the honest interim

### Phase 7 — The deferred list, worked through ✅

Filed as "real, but lower value or presuming something that does not exist yet". Four of the
five turned out to be buildable now; the fifth is a decision, recorded below rather than left
as a box nobody will ever tick.

- [x] **Payload files discovered from `.camunda/payloads/`**, so starting an instance with
      test data is a pick rather than a paste. Same walk-up convention as element templates —
      root-first, so a payload beside the diagram overrides one at the project root sharing
      its name — and a file that is not a JSON **object** is reported rather than quietly
      starting an instance with nothing. The walk is deliberately *not* shared with
      `@bpmnkit/connectors/node`: it is thirty lines, the two conventions could diverge, and
      one consumer does not justify widening a published package's API. A second consumer
      (`casen deploy`, most likely) is when that changes
- [x] **UI localisation — the method, which was the adaptable part.** `createTranslationRecorder()`
      in `@bpmnkit/editor` is a `Translate` that records what it is asked for; the harvest in
      `tests/i18n-harvest.test.ts` runs a real editor, presses every button it can reach, and
      writes `packages/editor/i18n/en.json`. **The measurement is the point: the running
      editor asks for 58 strings and a grep over the source finds 11.** A conventional
      extractor would have shipped a full-looking catalogue covering under a fifth of the UI,
      because the editor builds most of its labels from element types at runtime. The test
      keeps the catalogue in step (`UPDATE_I18N=1` regenerates) and reports any greppable key
      the harvest never reached — dead, or reachable only by a path the exercise misses, and
      not safe to delete on a grep's say-so either way
- [x] **Detail cards in the connector/template picker** — implementation binding and property
      preview before applying. `summarizeTemplate()` was already computed for every catalogue
      listing and merely private; exporting it meant the panel reasons about templates through
      the same code the CLI does rather than a second copy in DOM. Selecting a card now opens
      the detail; the card's own button still applies straight away, for a reader who already
      knows. Fields whose name reads like a credential are marked there, before the template
      is applied rather than after
- [x] **VS Code editing.** The caution in this list was aimed at the wrong protocol.
      `CustomEditorProvider` hands you an opaque document and makes you implement dirty state,
      undo, hot exit, backup and external-change reconciliation — which is what "its own piece
      of work" meant. But these files are text, and a **`CustomTextEditorProvider`** is backed
      by the same `TextDocument` a text editor opens: every one of those problems is VS Code's,
      and a text editor open on the same file stops being a conflicting copy and becomes a
      second view of one document. What remained was a two-way sync with an echo in it, which
      is `document-sync.ts` and seven tests. `bpmnkit.editing.enabled` mounts the same editors
      with editing switched off

**Decided against: the template marketplace.** Not deferred again — declined, so nobody
re-opens the question without new information.

The stated precondition ("Phase 2 first, and prove demand") is now half met: Phase 2 shipped,
demand did not appear. But the real objection is the one the original entry did not name.
Applying an element template writes the extension elements that decide **what a task
executes**. A registry of third-party templates is therefore a supply-chain surface, and
building one needs provenance, publisher identity, versioning and a moderation story before
it needs a search box. What the entry actually wanted — templates that are not written by
hand — is already served twice over: `.camunda/element-templates/` puts a project's own
templates under version control where their review is the repository's review, and the
picker imports from a URL or a file for the one-off case. Revisit only with a concrete
publisher asking to distribute templates, and answer trust before search.

**Closed after the fact:**

- [x] **A formatting-preserving writer**, so a visual edit reads as an edit. Left open with
      this phase and built next — see the section below.

## Formatting-Preserving Writes

> Implemented 2026-09-10. `packages/core/src/xml/xml-patch.ts`,
> `packages/core/src/{bpmn,dmn}/preserving-writer.ts`.

A serializer given a model writes its own formatting, which is right for a new document and
wrong for an existing file: the first visual edit reformats every line, and the commit says
"the whole diagram" when it means "a box moved". Measured over sixteen real diagrams,
renaming one element changed **313 lines with a plain write and 32 with a preserving one** —
two per file, the line before and the line after. Opening and saving without editing anything
changed **0** lines on every one of them, against up to 62.

- [x] `parseXmlSpans()` — the document as a tree that remembers its own offsets. The existing
      scanner learned to record them behind an opt-in `XmlCursor`, so the parse every other
      part of the toolkit runs pays nothing
- [x] `preserveFormatting(original, updated)` — takes the file as it is and the file as the
      serializer would write it, and returns the second's content carried by the first's
      bytes. Attribute values are compared **decoded**, so `&#10;` is not rewritten as
      `&#xA;`; comments survive; an inserted element is re-indented to its new siblings
- [x] `preserveFormattingVerified(original, updated, read)` — the strategies that pay off
      most are the ones no generic XML tool may assume: keeping the file's own sibling order,
      and keeping an attribute the serializer dropped as a schema default. Both are **tried
      and then checked** with the caller's own reader, and the plain write is the floor
- [x] `exportPreserving()` for BPMN and `exportDmnPreserving()` for DMN, each supplying its
      own parser as the check
- [x] **DMN brought to parity.** It shipped with the first cut and was measurably worse:
      two real Camunda decisions came back with six and eighteen lines changed on a save that
      changed nothing, however the file was indented. Both are **0** now, and editing one rule
      changes **two** lines. Two defects, both found by measuring rather than by a failing
      test:
      - The patcher never paired an element that carries an `id` in the file and none in the
        update. That rule existed to stop a deliberate *move* being undone, and it was too
        broad: two elements can only have been matched by id if they both have one, so one
        side lacking an id means there is no move to preserve. Until this, a DMN file's entire
        `DMNDI` section — which names its `DMNDiagram` and `DMNShape`, where the model does
        not — was deleted and written out again on every save
      - `serializeDmn` dropped `hitPolicy="UNIQUE"` as the schema default while `parseDmn`
        read it, so `parse(export(m))` no longer equalled `m`. The preserving write checks
        itself against exactly that, so one dropped attribute cost the file *every* other
        thing the write was keeping. Fixed at the source, with a round-trip test
- [x] Wired into the VS Code editor: each edit is written against the document as it stands,
      and becomes the base for the next

**Why the check is not ceremony.** The model cannot represent the order a file writes its
children in — a process holds `flowElements` and `sequenceFlows` separately — so keeping the
file's order is worth more than keeping its indentation. But **DMN rule order is the
decision**: under hit policy `FIRST`, moving a rule changes the answer. The same strategy that
saves a BPMN file from reshuffling would silently undo that edit, and the only thing standing
between those two cases is parsing the result and comparing. There is a test for exactly that:
reordering DMN rules comes back reordered, with the outcome reported as `reordered`.

- [x] `preserveJsonFormatting(original, updated)` and `exportFormPreserving()` — the same for
      form files, which are JSON. `exportForm` writes `JSON.stringify(…, null, 2)` in its own
      key order, so a form indented with tabs came back with **every line rewritten** the first
      time anyone touched it: 109 changed lines on a 57-line file, 101 with four-space
      indentation, and a minified form blown out to 57 lines. All of them are **0** now, and
      relabelling one field changes **one line** whichever way the file is written

**Why the JSON one needs no strategies and no injected reader.** The XML version cannot know
whether sibling order carries meaning in a particular document, so it offers strategies and
makes the caller check. JSON has no schema-dependent semantics to be wrong about: an object is
an unordered collection of members and an array is an ordered sequence, both by RFC 8259. That
makes deep equality — key order ignored, item order respected — an *exact* statement of "this
says what the update says", so the patch checks itself and the form wrapper supplies nothing.

---

**Not adapting:** anything Camunda 7 (inline scripting, C7 properties, C7 deploy endpoints,
transaction boundaries) — this is a Camunda 8 toolkit; the clipboard bridge, which only exists
because bpmn-js assumes the system clipboard; and any bpmn.io dependency, which is the
differentiator itself.

---

## Core Model Fidelity

> Full analysis, evidence and sequencing: [`doc/bpmn-sdk-comparison.md`](bpmn-sdk-comparison.md)
> — measured against `philippfromme/bpmn-sdk` (2026-09-07). `Bpmn.parse()` → `Bpmn.export()`
> loses data on 11 of 12 real Camunda blueprints, including 22 `zeebe:subscription`
> correlation keys across 9 files.
>
> **Every gap is closed by an item below — none is optional.** The reference SDK is
> all-rights-reserved, so this is re-implementation from the written specification and from
> the MIT moddle descriptors, never a port: see §7.0 (clean-room rule) and §7.1 (the
> gap → item → verification matrix, G1–G21) in the analysis. Done means A1's allow-list is
> empty, A12's `dropped` set contains nothing but reviewed probe artifacts, and every
> §7.1 verification exists and passes.

### Phase 1 — Stop the silent loss

- [x] **A1** Round-trip fidelity corpus + gate — `packages/core/tests/roundtrip-corpus.test.ts`
      over `tests/fixtures/roundtrip/` with `PROVENANCE.md`. Structural signature computed by
      an independent scanner (`tests/support/xml-signature.ts`, not `src/xml`), landed
      red-listed so each fix deletes an allow-list entry, and a stale entry fails too. Corpus
      is 6 hand-written fixtures covering every §4 loss plus the parser's declared surface;
      it found two further gaps (G22, G23). **Still to add:** real-world models, which need a
      licensing decision per file — see the directory's PROVENANCE.md
- [x] **A5a** `casen generate bpmn --input` must not overwrite its input by default —
      require `--output` or `--force` (`apps/cli/src/commands/generate.ts`). The guard also
      runs before stdin is read, so an unwritable target fails fast
- [x] **A6** Correct the round-trip claim in
      `apps/landing/src/content/docs/getting-started/concepts.md` (asserted a guarantee we do
      not hold) and its `definitions.rootElements` example; the same falsehood in
      `guides/ai.md` and `packages/core.md` corrected too; docspack rebuilt
- [x] **A2** `semantic-hash.ts` — DI-excluded canonical projection, sync in-repo SHA-256
      (no `node:crypto`, no `crypto.subtle`, so `packages/core` stays browser-safe and callers
      stay synchronous), `diffSemantics()` attributing changes to the element that changed.
      Auto-layout invariance asserted across the whole corpus, plus golden hashes to catch a
      silent change to what counts as semantics
- [x] **A3** Close the model gaps the corpus exposes — `extensionElements` + `documentation`
      on root/collaboration/artifact/lane types, `bpmn:category`/`categoryValue`, data
      associations, multi-instance `loopCardinality`/`completionCondition` (G22), and an
      `unknownChildren` catch-all on `definitions`, `process`, `collaboration` and flow nodes.
      All nine A3 rows in §7.1 closed; the allow-list holds only the two `normalised` entries.
      **Not covered:** unmodelled children of lanes, artifacts and root elements (they carry
      `documentation` + `extensionElements` only), and a second `documentation` on one element

### Phase 2 — A verified write boundary

- [x] **A4** `writeBpmn()` — serialize, re-parse, compare semantic hash, write atomically;
      returns `{ destination, bytes, outputSha256, semanticHash, changes }` behind the
      `@bpmnkit/core/node` subpath. Refuses to replace without `force`, keeps the replaced
      file's permissions, and uses a hard link so two concurrent creates cannot both win.
      **No opt-out of verification** — see the module header for why. Note the boundary
      cannot catch *parser* losses (absent from both sides of the comparison); that stays A1's
      job
- [x] **A5b** Unresolved ids fail loudly. `applyBpmnOperations` is strict by default and
      all-or-nothing; `strict: false` returns typed problems instead. The old compact
      `applyOperations` is left as-is and is now documented as legacy — nothing calls it
- [x] **A5c** Operations re-targeted at `BpmnDefinitions` (`applyBpmnOperations`), plus
      `reconcileCompact` for applying a compact diagram as changes rather than expanding it
      over the model. `compactify()` documented as a read-only view. Call sites moved: the CLI
      `--patch` path, the proxy `/improve` (now takes `{ xml }`, compact only for the prompt),
      and the MCP `replace_diagram`. **The MCP mutation tools already applied to the full
      model** — the plan was wrong about that. **Remaining:** the MCP server writes with
      `writeFileSync`, not `writeBpmn`, because its code-mode bridge calls tools synchronously
      inside a `vm`; it now verifies the round trip inline, but adopting A4 there needs an
      async bridge first

### Phase 3 — Capability gaps

- [x] **A7** Descriptor-checked Zeebe extension writes — `scripts/generate-zeebe-placement.ts`
      resolves `zeebe.json`'s `meta.allowedIn` against the BPMN type graph into
      `src/bpmn/zeebe-placement.ts` (26 extensions). `ensureZeebeExtension` refuses a
      placement the schema forbids; `applyBpmnOperations` reports one as an operation problem
      without touching the element. `pnpm --filter @bpmnkit/core check:placement` fails on a
      descriptor bump that moves the surface, and a test runs it. Extensions the descriptor
      declares no owner for (`zeebe:subscription`, `zeebe:properties`) are allowed — the check
      rejects only what the schema positively forbids
- [x] **A12** Descriptor coverage check for the BPMN core model —
      `packages/core/tests/descriptor-coverage.test.ts` over the vendored `bpmn.json`,
      `bpmndi.json`, `dc.json`, `di.json`, `zeebe.json`. Round-trips a probe document per
      type and labels it `modelled` / `preserved` / `dropped`; CI fails on any drop outside
      a reviewed accept-list, and on an accept-list entry that no longer drops.
      151 types: 109 / 34 / 6 / 2 unprobed. `pnpm --filter @bpmnkit/core check:descriptors`
      prints the report. This is what stops the model drifting from the spec again after A3
      closed today's gaps
- [x] **A9** `ProcessBuilder.from(defs, processId)` (also `Bpmn.continueProcess`) with
      `.at(nodeId)` and `.insertAfter(nodeId)` — continue an existing model fluently instead of
      regenerating it. `build()` returns the source document with that process replaced;
      collaboration, lanes, diagram interchange, other processes and unmodelled content all
      survive. Continue mode never infers join gateways, and refuses to rewire a flow the
      document already had
- [x] **A8** Collaboration builder — `.participant()`, `.message()`, `.messageFlow()` and
      `.collaborationId()` on `DiagramBuilder`, ids verbatim, black-box participants
      supported. No participants means no collaboration element. `build()` refuses a
      collaboration a modeler would not open — reporting every problem at once — including a
      message flow that does not cross a pool boundary

### Phase 4 — Gates and ergonomics

- [x] **A10** Publish gate that packs, installs and type-checks each tarball —
      `scripts/check-package-consumable.mjs`, wired into the release workflow before publish.
      Checks every path a manifest declares is in the tarball, that no `workspace:` range
      survived packing, that each ESM entry imports, and that the shipped declarations compile
      under `strict` + `NodeNext` with `skipLibCheck` off. Found `@bpmnkit/proxy` shipping no
      `.d.ts` despite declaring `exports.types`, and three `plugins-cli` packages importing
      `@bpmnkit/cli-sdk` without declaring it
- [x] **A11** Script-size budget on the example scripts (`apps/examples/tests/budget.test.ts`,
      a ratchet in both directions on lines *and* elements, so neither verbosity nor deleting
      content passes) plus a generous per-example time ceiling; `{ explicitJoins: true }` on
      `build()` refuses inferred join gateways and names them, with `strict` kept as a
      deprecated alias. Also fixed: every example failed from a clean checkout because only
      `run-all` created `output/`

---

## Completed

*(Items moved here from above as they ship)*
