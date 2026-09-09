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

### Phase 4 — Editor invariants and navigation

Small, self-contained, and collectively what makes the editor feel like a tool rather than a
canvas. This phase also establishes the **port pattern** every later host depends on: a feature
is a plugin talking to an injected port, never to a host API.

- [ ] **Engine-neutral models stay engine-neutral** — opening a model with no execution platform
      must never stamp one on. Today we are exposed to silent contamination of a diagram authored
      elsewhere. Adopt as an invariant in `@bpmnkit/editor` with a regression test, whether or not
      a View/Design/Implement mode strip is ever built
- [ ] Keyboard flow navigation: Tab / Shift+Tab along sequence flows, cycle the outgoing flows at
      a fan-out, Enter to follow, drill in and out of sub-processes. Extends the keyboard and ARIA
      commitment `@bpmnkit/canvas` already advertises
- [ ] Go-to-reference through an injected resolver port — Call Activity → process, Business Rule
      Task → DMN, User Task → form. Generalises what `apps/drop` already does within a drop; the
      action hides itself when the target does not resolve
- [ ] Document the port pattern once, in `doc/`, so studio, desktop, drop and any extension wire
      features the same way

### Phase 5 — VS Code extension, read and review

Scoped deliberately to what read-only unlocks. The prerequisites are unusually well met:
`@bpmnkit/canvas` is framework-agnostic plain DOM with CSS-variable theming, `apps/drop` proves
the stack bundles to browser ESM, `apps/desktop` proves editor plus plugins compose into a host
shell. A read-only extension sidesteps VS Code's custom-editor document protocol entirely, which
is the part that looks trivial and is not.

- [ ] Extension host scaffold + webview message protocol (`apps/vscode`)
- [ ] Read-only custom editors for `.bpmn`, `.dmn`, `.form` via `@bpmnkit/canvas` and the
      `dmn-viewer` / `form-viewer` plugins, plus minimap and zoom
- [ ] Visual diff for `.bpmn` in the Source Control panel and from an Explorer two-file compare
      (Phase 1's engine, wired to the host)
- [ ] `casen lint` findings in the Problems panel, run in the extension host where Node is
      available and `@bpmnkit/core` runs unchanged (Phase 3's host-facing seam)
- [ ] Theme follows the active VS Code theme
- [ ] Marketplace listing, README, and a support posture stated up front given the pre-1.0 badge

### Phase 6 — VS Code extension, what only this stack can do

Differentiation, not parity. None of this exists in the Marketplace today.

- [ ] Step-through simulation of the open diagram with `@bpmnkit/engine` and token highlighting
- [ ] FEEL playground as a webview panel
- [ ] Deploy and start an instance against a `casen` profile
- [ ] ASCII rendering of a diagram, for pasting into a code review

### Phase 7 — Deferred

Real, but each is either lower value or presumes something that does not exist yet.

- [ ] Payload files discovered from `.camunda/payloads/`, so starting an instance with test data
      is a pick rather than a paste
- [ ] UI localisation. The hook exists (`@bpmnkit/editor`'s `Translate`) and ships English only.
      The adaptable part is the *method*: harvest the strings the running editor actually
      requests and treat any key the harvest never observed as dead
- [ ] Detail cards in the connector/template picker — implementation binding and property preview
      before applying
- [ ] VS Code editing. Only after Phase 4 lands, and only with the custom-editor document
      protocol (dirty state, hot exit, external edits, conflicting text-editor edits) treated as
      its own piece of work
- [ ] Template marketplace — elegant, but it presumes an established base of shared template
      repositories. Phase 2 has to come first, and prove demand

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
