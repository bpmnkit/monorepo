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

## Completed

*(Items moved here from above as they ship)*
