# BPMN Kit — Market & Competitive Analysis

*Date: 2026-09-23. Scope: BPMN/DMN modeling & SDKs, BPMN engines & platforms, the wider
workflow / durable-execution / low-code / AI-agent ecosystem, and an honest audit of BPMN
Kit's own product and presentation.*

*Method: four parallel research passes — one internal audit of this repository, three web
research passes (vendor sites, release notes, GitHub API star counts, npm download API,
analyst reports, arXiv). Star counts and npm figures were taken on 2026-09-23. Vendor
self-reported numbers (ARR, customer counts) are marked "(vendor)". Market-size numbers vary
widely by methodology — treat them as ranges.*

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Where BPMN Kit stands today (internal audit)](#2-where-bpmn-kit-stands-today)
3. [Market map](#3-market-map)
4. [Segment A — BPMN/DMN modeling, rendering & SDKs](#4-segment-a--bpmndmn-modeling-rendering--sdks)
5. [Segment B — BPMN engines & process platforms](#5-segment-b--bpmn-engines--process-platforms)
6. [Segment C — Code-first durable execution](#6-segment-c--code-first-durable-execution)
7. [Segment D — Low-code / iPaaS automation](#7-segment-d--low-code--ipaas-automation)
8. [Segment E — AI agents, MCP and AI-generated BPMN](#8-segment-e--ai-agents-mcp-and-ai-generated-bpmn)
9. [Segment F — Canvas libraries & adjacent specs](#9-segment-f--canvas-libraries--adjacent-specs)
10. [Head-to-head feature matrix](#10-head-to-head-feature-matrix)
11. [What other libraries let you do that BPMN Kit does not (yet)](#11-what-other-libraries-let-you-do-that-bpmn-kit-does-not-yet)
12. [SWOT](#12-swot)
13. [Presentation audit — how BPMN Kit shows itself](#13-presentation-audit)
14. [Areas that need improvement — prioritised](#14-areas-that-need-improvement--prioritised)
15. [Positioning recommendation](#15-positioning-recommendation)
16. [Sources](#16-sources)

---

## 1. Executive summary

**The one-paragraph verdict.** BPMN Kit is, feature-for-feature, the broadest open-source
BPMN toolchain in the JavaScript/TypeScript ecosystem, and the only one that is (a) plain MIT
with no watermark, (b) built from scratch rather than on bpmn.io, and (c) designed for AI
agents (compact format, MCP, offline docspacks, Claude Code plugin). Its weaknesses are not
engineering depth in the core libraries — those are genuinely disciplined — but **adoption,
distribution, interoperability with the bpmn.io ecosystem, proof, and focus**. It has 9
GitHub stars against bpmn-js's ~9.7k and ~2k weekly downloads of `@bpmnkit/core` against
~176k of bpmn-js and ~270k of bpmn-moddle. Its product surface (27 published packages + 12
apps) is larger than a one-maintainer project can credibly present, and several surfaces
(VS Code extension, desktop app, Reebe, Studio) are half-shipped or invisible.

**Ten findings that matter most**

1. **The market moved to "code + generated picture" and "agents on a deterministic
   skeleton".** Temporal ($12.55B valuation, Sep 2026), Vercel Workflow (200K+ weekly npm
   downloads six months after GA), Inngest, Trigger.dev own the TypeScript developer. Every
   agent framework (LangGraph, Microsoft Agent Framework, Google ADK 2.0, Mastra, CrewAI Flows)
   reinvented a proprietary graph. BPMN is the only ISO-standard, executable, diagrammable
   graph — BPMN Kit's "BPMN as TypeScript" pitch sits exactly on that convergence line, but
   the site doesn't say so.
2. **Camunda closed its production path.** Since 8.6 (Oct 2024) self-managed production
   requires an Enterprise licence; Camunda 7 CE hit EOL on 2025-10-14. This produced (i)
   developer resentment, (ii) three Apache-2.0 C7 forks (Operaton, CIB seven, EximeeBPMS),
   and (iii) a **gap for free, local, Docker-free Camunda-semantics tooling** — which is
   BPMN Kit's strongest opening.
3. **Camunda is converging on BPMN Kit's feature list first-party.** c8ctl CLI (Node, alpha),
   official Claude Code skills, a cluster MCP server and a docs MCP server, BPMN/FEEL
   Copilot, Camunda Hub (8.10, Oct 2026), a rewritten TS client
   `@camunda8/orchestration-cluster-api`. BPMN Kit must differentiate on *offline,
   open, TypeScript-native, zero-infrastructure* — not on "has a CLI / has AI".
4. **bpmn.io is the gravity well.** Everyone (Camunda modelers, Miragon, SpiffArena,
   ProcessMaker, Chinese Vue wrappers) builds on it. Its **watermark licence** is the single
   most marketable differentiator BPMN Kit has — JointJS leads its own bpmn-js comparison with
   it — yet BPMN Kit only mentions it in passing.
5. **Interop is the adoption blocker, not features.** BPMN Kit does not read `.bpmnlintrc`
   / `bpmnlint-plugin-*`, is not tested against the OMG MIWG suite, doesn't support Camunda 7
   / Operaton / CIB seven, and its round-trip corpus is 6 hand-written fixtures. A team
   already on bpmn-js has no low-risk migration path.
6. **The BPMN + MCP + TypeScript niche is empty.** Top "bpmn mcp" GitHub repo: 45 stars;
   top Camunda MCP repo: 14. Camunda's official MCP covers runtime operations, not authoring.
   Flowable 2026.1 made its designer an MCP server — the first incumbent to do so. The window
   is open but closing.
7. **FEEL at 94% of the DMN TCK beats Camunda's own DMN-Scala (84.06%)** and no
   JavaScript engine is on the official TCK table. This is a real credibility asset that is
   **not on the website at all** — the site says "complete" instead.
8. **Presentation is honest but under-proven and under-distributed.** No logos,
   testimonials, Discord, star/download counters, template gallery, conformance statement,
   or blog post since July. The VS Code extension isn't on the Marketplace; the desktop app
   has no installer pipeline; Studio and Reebe aren't linked from the site.
9. **Several claims are stale or overreach:** "22 plugins" (there are 34), "every package is
   0.x / pre-1.0" (1.0.0 shipped 2026-09-19), "complete FEEL" (94%), "parse → modify →
   export with no data loss" (unknown children are dropped), engine README listing call
   activity / compensation / event-based gateway that the TS engine auto-completes or lacks,
   desktop "3–5 MB installer" with no release pipeline.
10. **Focus risk.** Rust Zeebe reimplementation, share-link SaaS (Drop), Studio, Operate
    clone, desktop app, learn site, docspacks, connectors catalog, CLI plugin SDK — on a bus
    factor of one. The market rewards a sharp wedge (React Flow, XState, Kestra) far more
    than breadth.

**Recommended positioning (details in §15):**

> **BPMN Kit — BPMN as TypeScript. Model, lint, simulate and test Camunda 8 processes in
> code, in the browser and in CI — no Docker, no licence key, no watermark. Built for you
> and your coding agent.**

---

## 2. Where BPMN Kit stands today

### 2.1 Inventory

| Layer | What exists | Maturity |
|---|---|---|
| Core SDK | `@bpmnkit/core` — BPMN/DMN/Form parse, fluent builder, serialise; semantic + grid auto-layout; ~40-rule optimizer/linter; compact AI format + streaming parser; `semanticHash`, `writeBpmn` verified write, format-preserving writers, diagram diff, collaboration builder. Zero third-party deps. ~49.5k LOC, ~1,027 tests | 1.0.0, strongest part of the repo |
| Rendering | `@bpmnkit/canvas` zero-dep SVG viewer (overlays, markers, multi-plane drilldown, SVG/PNG export); `@bpmnkit/editor` full modeler (undo/redo, align, copy/paste, rules, i18n hook, touch, aria-live); 34 plugins | 1.0.0 |
| Expressions | `@bpmnkit/feel` parser/evaluator/formatter/highlighter, 87 built-ins, **94% DMN TCK** (1,940/2,053), nightly TCK workflow | 1.0.0 |
| Execution | `@bpmnkit/engine` TS in-process *simulator*; **Reebe** — Rust Zeebe-compatible REST engine (Postgres/SQLite, event-sourced, single node, 292 Rust tests not in CI); `reebe-wasm` in-browser build | engine 1.0.0; Reebe 0.1.x private / experimental |
| Camunda integration | `@bpmnkit/api` (~180 typed ops, OAuth2), `worker-client`, `user-tasks`, `connectors` (116+ OOTB templates applied deterministically), `connector-gen` (OpenAPI → template, 100 bundled specs) | api/connectors 1.0.0; rest 0.x |
| Tools | `casen` CLI (deploy, instances, TUI, lint, diff, generate, test, view, skills) + plugin SDK; AI proxy + MCP server (Node) and Rust sidecar port; Operate-like UI; Studio (Preact) | CLI 1.0.0; others 0.x, thin tests |
| Surfaces | bpmnkit.com (Astro, 38 docs pages, playgrounds), learn.bpmnkit.com, **Drop** (share-link SaaS with live single-writer editing on Cloudflare), VS Code extension, Tauri desktop, demo (AI benchmark) | mixed |
| AI | docspack + camunda-docspack (offline BM25 docs for agents), Claude Code plugin (9 skills, 2 agents), patterns, AIKit ProcessPlan compiler | differentiated |

### 2.2 Signals

- Repo created 2026-02-18 (≈7 months). 9 stars, 1 fork, no Discussions, one human
  maintainer, AI-assisted.
- npm last month: core 5,374; feel 4,119; editor 1,777; canvas 1,670; engine 1,319; cli
  1,169 (likely inflated by internal dependency chains).
- ~2,650 TS tests; API-surface snapshot (1,484 exports) checked in CI; consumable-tarball
  check; stability policy. This release engineering is better than most projects 10× its
  age.
- Licence: MIT — but `apps/reebe` declares Apache-2.0 and `camunda-docspack` is CC-BY-SA-3.0
  (correctly noticed).

### 2.3 Known internal gaps (from `doc/` and the code)

- **Auto-layout quality** trails bpmn-auto-layout 2.0 on 161 upstream fixtures: 67 vs 13
  edges through shapes, 364 vs 200 crossings (lanes fixed). BPMN Kit is ~100× faster.
- **Round-trip fidelity**: corpus of 6 hand-written fixtures; unmodelled children of lanes,
  artifacts and root elements not covered; the MCP server writes with `writeFileSync`
  instead of `writeBpmn`.
- **No choreography/conversation diagrams, no MIWG testing, no Camunda 7.**
- **DMN**: typeRef limited to string/boolean/number/date; no boxed context/relation/
  invocation evidence; TCK used for FEEL only.
- **Element templates**: inbound connectors and linked-resource bindings not applied.
- **TS engine**: call activity / event sub-process auto-complete; no event-based or
  complex gateway, no compensation (only via the optional WASM runner).
- **Reebe**: compatibility and perf claims (~50 MB, <1 s start) unbenchmarked; Postgres
  compat suite skipped in CI; README still links the pre-monorepo repo.
- **Distribution**: VS Code extension not on the Marketplace; desktop has no installer
  build; Studio not linked; Reebe undocumented on site.
- **Stale internal docs**: `render-gap-analysis.md` ("nothing implemented") and
  `reebe-wasm-roadmap.md` (0/167 checked) contradict `progress.md`; `landing-page-analysis.md`
  has no status column; `CLAUDE.md` says React + Carbon, the code uses Preact/Radix/Tailwind.
- **No analytics** (SEO phase 6 open) — the project cannot currently measure its funnel.

---

## 3. Market map

```
                         VISUAL / STANDARD-FIRST
                                   ▲
      Signavio · ARIS · ADONIS     │     Camunda Web Modeler/Hub · Flowable Design
      Bizagi · Visual Paradigm     │     Trisotech · Cardanit
      (business modeling)          │     (BPMN platforms)
                                   │
      n8n · Zapier · Make          │     bpmn-js ecosystem · Miragon · KIE editors
      Power Automate · Workato     │     ProcessMaker modeler · bpmn-visualization
      Dify · Langflow (AI canvas)  │
 BUSINESS ─────────────────────────┼───────────────────────────────── DEVELOPER
 USER                              │                         ★ BPMN Kit (aims here:
      Pega · Appian · ServiceNow   │                           standard artifact,
      SAP Build · IBM watsonx      │                           code-first authoring)
      (enterprise low-code)        │     XState/Stately · Kestra (YAML↔visual)
                                   │     Step Functions (ASL + Workflow Studio)
                                   │     Temporal · Restate · Inngest · Trigger.dev
                                   │     Vercel Workflow · DBOS · Hatchet · Mastra
                                   │     LangGraph · MS Agent Framework · Google ADK
                                   ▼
                          CODE-FIRST / PROPRIETARY GRAPH
```

BPMN Kit's defensible quadrant is **developer-facing + standard-artifact**: the output is a
BPMN file a business analyst, an auditor and Camunda can all read, but the authoring
experience is a typed TypeScript library, CLI, tests and an agent. Nobody else occupies that
quadrant for Camunda 8 with a TypeScript-native, open toolchain.

### 3.1 Market size & analyst context

| Metric | Figure | Source |
|---|---|---|
| BPM market 2025 | $17.5B–$22.1B | IMARC / Fortune BI / TBRC |
| BPM market 2030 | $45.7B (15.1% CAGR) – $61.2B (20.3%) | TBRC / Grand View |
| Workflow automation 2025 | ~$24–25B → $40–54B by 2031–34 | Straits / Mordor |
| Agentic workflow orchestration 2026 | $3.53B → $14.8B by 2031 (33% CAGR) | Mordor |
| Gartner BOAT MQ 2026 | Pega Leader; Camunda Visionary | Gartner (Sep 2026) |
| Forrester | New "Adaptive Process Orchestration" category (Sep 2025); Landscape Q2 2026 (35 vendors), Wave due late 2026 | Forrester |
| Gartner caution | >40% of agentic AI projects cancelled by end of 2027 — used by BPMN vendors as the case for deterministic guardrails | Gartner |

### 3.2 Money flow (2025–26) — where developer mindshare is being bought

| Company | Latest | Category |
|---|---|---|
| Temporal | $550M Series E @ $12.55B (Sep 2026), $250M+ ARR | durable execution |
| n8n | $180M Series C @ $2.5B (Oct 2025); SAP invests @ $5.2B (May 2026); ~$100M ARR | low-code / agents |
| LangChain | $125M @ $1.25B (Oct 2025) | agent framework |
| Orkes (Conductor) | $60M Series B (Apr 2026) | orchestration |
| Kestra | $25M Series A (Mar 2026) | declarative orchestration |
| Mastra | $22M Series A (Apr 2026) | TS agents + workflows |
| Inngest | $21M Series A (Sep 2025) | durable functions |
| Trigger.dev | $16M Series A (Dec 2025) | TS durable tasks |
| Camunda | no raise since 2021; ~$200M ARR (vendor, Aug 2026) | BPMN platform |
| Consolidation | Prefect acquired Dagster (Jul 2026); Workday acquired Pipedream and Flowise (then archived Flowise); ProcessMaker merged into Decisions; Bonitasoft → Ofelia; Oracle retired OCI Process Automation (Apr 2026) | — |

**Implication:** the venture money is in code-first durable execution and AI-agent
orchestration, not in BPMN modeling. BPMN's commercial strength is enterprise installed base
+ governance. An OSS BPMN toolkit wins by being the bridge between those worlds, not by
competing with either head-on.

---

## 4. Segment A — BPMN/DMN modeling, rendering & SDKs

### 4.1 The bpmn.io family (the incumbent)

| Package | Licence | Weekly npm | Notes (2025–26) |
|---|---|---|---|
| bpmn-js | bpmn.io licence (**watermark mandatory**) | ~176k | 9.7k★; v18.30.0 released 2026-09-23; WCAG AA accent & focus (18.26), `@bpmn-io/theme` tokens (18.30), cross-editor copy/paste |
| bpmn-moddle | MIT | ~270k | Most-used BPMN package on npm |
| dmn-js | bpmn.io | ~26k | DRD, tables, literal & boxed expressions |
| form-js | bpmn.io | ~12k | v2.0.0 (2026-09-18) dropped Carbon coupling |
| bpmn-js-properties-panel | MIT | ~38k | Element templates UI (the de facto extension format) |
| bpmnlint (+ `@camunda/linting`) | MIT | ~40k (+5k) | `.bpmnlintrc`, presets, plugin ecosystem |
| bpmn-auto-layout | MIT | ~36k | Pools, lanes, sub-processes now covered; beats BPMN Kit on routing quality |
| bpmn-js-token-simulation | MIT | ~12k | Visual token flow only (no expression evaluation) |
| bpmn-js-differ | MIT | ~9.8k | Semantic diff; Miragon builds visual diff on it |
| feelin (nikku) | MIT | ~22k | Only other serious JS FEEL; claims "full TCK" but not on the official table |
| lezer-feel / @bpmn-io/feel-lint | MIT | ~27k / ~60k | FEEL editing & lint in Camunda modelers |

**Licence detail that matters:** the bpmn.io licence says the watermark code "MUST NOT be
removed or changed" and the watermark "must stay fully visible and not visually overlapped".
Anyone embedding a BPMN editor in a commercial product inherits that. BPMN Kit, JointJS+
(commercial), bpmn-visualization (Apache-2.0, view-only), ProcessMaker modeler (MIT,
JointJS) and the new Apache KIE editors (Apache-2.0) are the only watermark-free BPMN
renderers — and of those BPMN Kit is the only free, full-featured, Camunda-8-aware modeler.

### 4.2 Camunda's own modeling tools

- **Desktop Modeler** (MIT, Electron, 1.7k★, v5.51.1): BPMN/DMN/Forms, templates, deploy,
  lint, token simulation, plugins. No built-in i18n (Miragon plugin). Community MCP plugin
  exposes 19 modeling tools.
- **Web Modeler → Camunda Hub** (proprietary): roles, comments with @mentions, presence with
  canvas **locking + take-over** (not true co-editing), password-protected share links,
  iframe embedding, Git sync, versions, Play mode, template editor, process landscape.
  Merges with Console as **Camunda Hub** in 8.10 (Oct 2026).
- **AI**: BPMN Copilot (alpha, SaaS only, **no pools/lanes**, ~400 KB limit, 20–50 s per
  request), FEEL Copilot, AI form builder, official Claude Code skills (`/camunda-bpmn`,
  `/camunda-ai-agent`, `/camunda-connectors`, `/camunda-c8ctl`, `/camunda-docs`),
  Orchestration Cluster MCP + Docs MCP.
- **CLI/SDK**: c8ctl (`@camunda8/cli`, Node, ~730/week, 4.2.0-alpha has MCP proxy),
  `@camunda8/orchestration-cluster-api` (~12.5k/week, branded types, Zod), `@camunda8/sdk`
  (~11k/week). Java `zeebe-bpmn-model` fluent builder is the canonical BPMN-from-code API.

### 4.3 Other modelers

| Tool | Model | Relevance to BPMN Kit |
|---|---|---|
| **Miragon BPMN Modeler** | Apache-2.0 VS Code/Theia (bpmn.io inside); ~12.4k installs; C7, C8, Operaton, CIB seven; templates, deploy, visual diff, bpmnlint, 9–10 UI languages | **Direct competitor to BPMN Kit's VS Code extension** — and it is on the Marketplace |
| **Flowable Design** | Commercial; 2026.1: **Design as MCP server**, AI chat, in-designer model tests, Git with branches/PRs/diff | Sets the 2026 bar for "modeler + AI + tests + Git" |
| **SAP Signavio** | Commercial; text-to-process, Joule GA, BPMN simulation, Collaboration Hub | Business-analyst leader |
| **Trisotech** | Commercial; DMN reference (99.97% TCK), Method & Style validation | Standards credibility bar |
| **Bizagi / Visual Paradigm / Cardanit / ADONIS / ARIS / Horus** | Commercial/freemium; simulation, doc export (Word/PDF), AI generators with pools/lanes | Business-user expectations (doc export, simulation) |
| **Apache KIE editors 10.2** | Apache-2.0; new React/TS/Zustand SVG BPMN & DMN editors, DMN 1.6, standalone npm packages; VS Code extensions deprecated | Only other permissive, modern TS editor stack |
| **ProcessMaker Modeler** | MIT, Vue + JointJS | Permissive but tied to ProcessMaker (now Decisions) |
| **bpmn-visualization** | Apache-2.0, view-only, execution overlays; pre-1.0 | Competes with `@bpmnkit/canvas` for monitoring views |
| **Lucid / draw.io / Visio** | Shapes only — no semantic BPMN XML export | Not executable; BPMN Kit can target "draw.io users who hit the wall" |
| **BPMN Sketch Miner, BPMN-as-Code, bpmn-py, Mermaid issue #7699** | Text → BPMN | **Mermaid has no BPMN** (issue approved, not shipped). A text/Markdown BPMN dialect is an open gap BPMN Kit's compact format could fill |

### 4.4 Canvas SDKs competing for "embed a process canvas in my app"

| Library | Licence | Popularity | BPMN |
|---|---|---|---|
| React Flow / xyflow | MIT (+Pro) | 38.5k★, ~8–10M/week | none — de facto for custom workflow builders |
| JointJS / JointJS+ | MPL / commercial from ~$3.4k | 5.4k★ | BPMN in paid tier; claims virtualization to 100k elements |
| GoJS / yFiles | commercial | 8.5k★ / — | BPMN samples; yFiles has the best BPMN layout |
| maxGraph | Apache-2.0 | — | generic (mxGraph archived) |
| LogicFlow (Didi) | Apache-2.0 | 11.7k★ | BPMN adapter with round-trip bugs |

---

## 5. Segment B — BPMN engines & process platforms

### 5.1 Camunda 8 (the platform BPMN Kit targets)

- **8.8 (Oct 2025)**: Zeebe + Operate + Tasklist + Identity become one **Orchestration
  Cluster** with one REST API v2; CPT replaces Zeebe Process Test; new TS client.
- **8.9 (Apr 2026)**: RDBMS secondary storage (H2/Postgres/Oracle/MariaDB) — **C8 Run
  defaults to H2, no Elasticsearch**; MCP, A2A connectors, conditional events, Business ID,
  audit log; SDKs for Java, Node/TS, Python, C# (preview).
- **8.10 (Oct 2026)**: Processes MCP server, agent visibility in Operate (incl. LangGraph /
  CrewAI agents), physical tenants, Camunda Hub; **Zeebe Java client and ZPT removed**, most
  gRPC off by default.
- **Agentic**: AI Agent connector inside **ad-hoc sub-processes** (LLM picks the tools),
  MCP client, A2A. Camunda's report: 71% of orgs use agents, 11% of use cases reach
  production.
- **Licence**: Camunda License 1.0 since 8.6 — dev/test free, **production self-managed
  requires Enterprise**; SaaS free tier is modeling only. Connectors except REST need a
  licence in production.
- **Business**: ~$200M ARR (vendor), 700+ customers, 9 of top-10 US banks.
- **Weak spot in JS**: official JS SDK 32★, orchestration-cluster-api-js 4★; **no
  Docker-free JS test runtime** (`@camunda8/process-test` is an early preview requiring
  Testcontainers).

### 5.2 Camunda 7 EOL and the forks

- C7 CE final release 7.24 on 2025-10-14; repo archived; Enterprise support to April 2030.
- **Operaton** (Apache-2.0, community, 473★, 2.1.x, 2.2 Oct 2026), **CIB seven**
  (Apache-2.0 + EE, 2.2 May 2026, claims 1,000+ companies (vendor)), **EximeeBPMS** (banking,
  1.4 Sep 2026).
- Camunda's migration tooling (Analyzer, Diagram Converter, OpenRewrite, Data Migrator) is
  Java-centric.
- **BPMN Kit has zero C7 story** — Miragon supports all four runtimes.

### 5.3 Other engines

| Engine | Licence | Lang | ★ | Notes |
|---|---|---|---|---|
| Flowable | Apache-2.0 OSS + commercial | Java | 9.6k | 2026.1 "Agentic Case Platform": MCP in/out, guardrails, evaluators, WCAG 2.2; BPMN+CMMN+DMN |
| Activiti | Apache-2.0 | Java | 10.5k | Low momentum; modeler discontinued |
| jBPM / Apache KIE | Apache-2.0 | Java | 1.7k | KIE 10.2; SonataFlow (Serverless Workflow); Drools DMN 99.91% |
| Bonita → **Ofelia** | GPL + EE | Java | 176 | Rebranded June 2026 as "governed agentic AI" |
| ProcessMaker → **Decisions** | AGPL + commercial | PHP | 540 | Brand retired June 2026 |
| Imixs / Open-BPMN | EPL/GPL | Java | 418 | Eclipse GLSP modeler for VS Code/Theia |
| Elsa 3.8 | MIT | .NET | 7.9k | BPMN execution & import/export foundations (Sep 2026) |
| SpiffWorkflow / SpiffArena | LGPL-3 | Python | 1.9k / 147 | Pure-Python BPMN+DMN interpreter + arena |
| **bpmn-engine** (paed01) | MIT | JS | 967 | In-process interpreter, no Zeebe semantics |
| **bpmn-server** | MIT | TS | 246 | bpmn-engine + MongoDB persistence |
| QuantumBPM | commercial | — | — | BPMN 2.0 + DMN 1.5 **on top of Temporal** — proof of demand for "BPMN + durable execution" |
| Pega / Appian / ServiceNow / SAP Build / IBM watsonx / Bizagi / Nintex / Kissflow | proprietary | — | — | Enterprise low-code, all repositioned around agents |

**Implication:** the JavaScript BPMN execution space is small (bpmn-engine < 1k★) and
nobody offers an **embeddable, Zeebe-semantics, Docker-free** engine. `@bpmnkit/engine` +
`reebe-wasm` could be that — *if* conformance is proven and it is positioned as dev/test,
not a production Zeebe replacement (which would provoke Camunda and invite licence
questions).

### 5.4 Testing, simulation and operations

- **Testing**: Camunda Process Test (Java, Testcontainers or embedded H2); JS port is a
  Docker-requiring early preview; Flowable has in-designer model tests; SpiffWorkflow and
  bpmn-engine are unit-testable in-process.
- **Simulation**: bpmn-js-token-simulation (animation only), BIMP/QBP (Monte Carlo arrival
  rates & resources), Signavio (cost/time/resource), Cardanit (BPSim). **No one runs Camunda
  execution semantics in the browser** — BPMN Kit's engine does.
- **Operations**: Operate/Optimize are licensed; zeebe-simple-monitor (180★) is stagnant
  and can't follow 8.8; Flowable Control EOL end-2027. **There is no live OSS Operate
  replacement for C8** — `@bpmnkit/operate` could fill it (for dev clusters, C8 Run, SaaS
  trials).
- **Process mining** (adjacent, not a target): Celonis (Gartner "Process Intelligence"
  leader), UiPath, PM4Py (AGPL), Apromore (OSS archived), Disco, Camunda ProcessOS (beta).

---

## 6. Segment C — Code-first durable execution

| Product | Licence / model | ★ | Authoring | 2025–26 highlights |
|---|---|---|---|---|
| Temporal | MIT + Cloud | 23.3k | Code, many SDKs | Serverless Workers, Workflow Streams (durable LLM streaming), Worker Versioning, OpenAI Agents SDK & Google ADK integrations |
| Vercel Workflow | OSS + Vercel | 2.4k | `"use workflow"` / `"use step"` directives | GA Apr 2026; 100M+ runs; 200K+ weekly npm; "Worlds" adapters incl. Local World; `npx workflow web` inspector |
| Inngest | SSPL-style + cloud | 5.9k | `step.run`, `waitForEvent` | "Unbreakable Agents"; local Dev Server UI; `step.score()` evals |
| Trigger.dev | Apache-2.0 + cloud | 16.4k | TS tasks, no timeouts | v4; durable AI agents; MCP server; realtime to frontends |
| Restate | BSL→Apache + cloud | 4.5k | Code, virtual objects | 1.5/1.6 observability UI |
| DBOS | MIT | 1.6k+ | Library on Postgres/SQLite | Java/Go parity |
| Hatchet | MIT + cloud | 8.0k | Code DAGs | v1 on Postgres |
| Cloudflare Workflows | proprietary | — | TS/Python | **Auto-generated diagrams from code** (Feb 2026) |
| AWS Step Functions / Lambda durable functions | proprietary | — | ASL + Workflow Studio (VS Code) / imperative code | TestState API with mocks; durable functions (re:Invent 2025) |
| Azure Durable Functions / DTS / Logic Apps | proprietary | — | code + designer | DTS GA; Logic Apps Agent Loop GA |
| Conductor / Orkes | Apache-2.0 + cloud | 32.2k | JSON DSL + visual | "agentic workflow engine", prompt-to-workflow |
| Kestra | Apache-2.0 + EE | 28.3k | **YAML ↔ no-code ↔ AI copilot, in sync** | 1.0 Playground (re-run one task reusing outputs), 2.0 flows-as-agent-tools |
| Airflow / Prefect(+Dagster) / Argo / Windmill | various OSS | 47k / 24k+16k / 17k / 18k | Python / YAML / scripts | Prefect bought Dagster; Airflow 3 |
| Mastra / LangGraph / Effect Workflow | OSS | 28.3k / 42.2k / 16.2k | TS/Py graph code + Studio | LangGraph time-travel in Studio; Mastra playground graph |

**Patterns that matter:**
- The TypeScript developer's default is now `step.run()` or `"use workflow"`, not BPMN.
- **Visualisation is coming back — generated from code** (Cloudflare, Mastra, LangGraph
  Studio). Developers want the picture, not the XML. BPMN Kit's builder → auto-layout →
  diagram pipeline is precisely this, with a *standard* output.
- **Local dev in one command is table stakes** (`temporal server start-dev`, Inngest Dev
  Server, Vercel Local World, c8run). BPMN Kit has no single "dev" command that runs engine
  + UI.
- **Testing with mocks inside the project's own test runner** (Step Functions TestState,
  Temporal test env). BPMN Kit's `casen test` scenario runner exists but there is no
  first-class Vitest/Jest helper story on the site.

---

## 7. Segment D — Low-code / iPaaS automation

| Product | Licence | Scale | Notes |
|---|---|---|---|
| n8n | Sustainable Use (fair-code) | 205.8k★, ~$100M ARR, 10,000+ templates, 500+ integrations | "AI agents and workflows you can see and control"; MCP both ways; embedded in SAP Joule Studio |
| Zapier / Make (Celonis) / Workato / Tray.ai / Power Automate | proprietary | Zapier ~$310–400M ARR (reported) | All rebranded as "AI orchestration" |
| Pipedream | → Workday (Nov 2025) | — | Independence uncertain |
| Activepieces | MIT | 24.7k★ | ~400 MCP servers |
| Node-RED 5.0 | Apache-2.0 | 23.7k★ | Industrial/IoT |
| Retool Workflows/Agents | proprietary | — | Runs **on Temporal Cloud** |
| Dify / Langflow / Flowise | OSS variants | 157k / 155k / 55k★ | Flowise **archived** after Workday purchase — vendor-risk lesson |

**Lesson:** time-to-first-value in minutes + huge template gallery + code escape hatches +
MCP beats licence purity. BPMN Kit should *not* compete on integrations count (its 100
OpenAPI specs / 116 connector templates are a nice bonus, not a wedge), but it should copy
the **template-gallery-with-one-click-run** pattern.

---

## 8. Segment E — AI agents, MCP and AI-generated BPMN

### 8.1 Agent frameworks converge on graphs

LangGraph (42.2k★), CrewAI Flows (58.9k★), Microsoft Agent Framework 1.0 (Apr 2026, Pregel
graph workflows), Google ADK 2.0 (May 2026 Workflow Runtime — Google measured **56% fewer
tokens** for a graph workflow than a free-form agent), Mastra, Claude Agent SDK.
OpenAI is **shutting down its visual Agent Builder on 2026-11-30**. The industry consensus
is "deterministic skeleton + LLM steps + bounded agentic sub-loops + human-in-the-loop" —
which *is* BPMN (process = skeleton, service task = LLM call, ad-hoc sub-process = agent tool
loop, user task = HITL), and BPMN is the only ISO-standard (ISO/IEC 19510) version of it.

### 8.2 MCP for BPMN/Camunda (GitHub, 2026-09-23)

| Repo | ★ | Scope |
|---|---|---|
| Stieges/bpmn-generator | 45 | JSON → ElkJS layout → BPMN XML/SVG |
| lepoco/mcp-camunda | 14 | Camunda **7** ops (C#) |
| dattmavis/BPMN-MCP | 12 | Build BPMN programmatically |
| oisee/mcp-bpmn | 9 | TS BPMN MCP |
| JesseLeresche/Camunda-mcp | 5 | MCP inside Desktop Modeler (C7/C8, forms) |
| AlambritoDito/lila-modeler | 1 | **BPMN simulator + CLI + MCP** (Sep 2026) — closest conceptual overlap |
| Camunda official | — | Cluster ops MCP + Docs MCP (runtime, not authoring) |
| Flowable Design 2026.1 | — | **Designer as MCP server** (commercial) |

**Nobody offers author + validate + layout + simulate + deploy + version-pinned docs in one
open MCP toolchain for Camunda 8.** BPMN Kit does, but it is not listed in MCP directories
and the website does not lead with it.

### 8.3 Research on LLM → BPMN

- **ProMoAI** (van der Aalst et al.): LLM writes code that builds POWL (sound by
  construction) → BPMN; Claude 3.5 Sonnet best (0.93 vs 0.98 ground truth).
- **BEF4LLM** (arXiv 2601.21787): LLMs match humans on syntax/pragmatics, **trail on
  semantics and validity** → validators in the loop.
- **Multi-stage generation** (arXiv 2604.12105): validate by executing in SpiffWorkflow +
  LLM repair.
- **BPMN Assistant** (arXiv 2509.24592): JSON intermediate instead of XML.
- **Consensus recipe:** intermediate representation → deterministic compiler + layout →
  lint → execute → repair. **BPMN Kit implements this exact recipe** (compact format /
  ProcessPlan → builder → auto-layout → optimizer → engine) and already publishes a candid
  AI benchmark. It should cite this research on the site and extend the benchmark.

### 8.4 Docs for agents

llms.txt is ubiquitous; **Context7** (62.4k★) serves version-specific docs over MCP and
launched hosted **Docs7** (Sep 2026, $200/mo Pro). BPMN Kit's **docspack is offline and
pinned to the installed version** — a true differentiator for air-gapped/regulated users and
a candidate to spin out as its own product/format (docspack.dev already exists).

---

## 9. Segment F — Canvas libraries & adjacent specs

- **XState / Stately Studio** is the closest analogue to BPMN Kit's thesis: two-way code ↔
  diagram, simulation, AI generation, test generation, VS Code extension, inspector.
  Lessons: the OSS library (XState, 30.2k★) drives adoption far more than the Studio; the
  hosted runtime was hard to monetise; testimonials from big-name engineers mattered.
- **Serverless Workflow / "Open Workflow Specification"** (CNCF) reached 1.0 after ~5 years
  with low adoption — standards alone don't win; tooling does.
- **Arazzo 1.1** (OpenAPI Initiative): multi-step API workflows; complementary to BPMN
  service tasks (possible import target for `connector-gen`).
- **tldraw 4.0** moved to "free in dev, licence in prod" — another reminder that licence
  sensitivity is high and **"MIT forever" is a selling point** worth stating explicitly.

---

## 10. Head-to-head feature matrix

Legend: ✅ yes · ◐ partial · ❌ no · — n/a

| Capability | **BPMN Kit** | bpmn-js stack | Camunda Desktop | Camunda Web/Hub | Miragon | Flowable Design | Apache KIE | Stately (analogue) |
|---|---|---|---|---|---|---|---|---|
| Licence | **MIT, no watermark** | watermark | MIT (uses bpmn.io) | proprietary | Apache (bpmn.io inside) | commercial | Apache-2.0 | MIT lib / freemium studio |
| Language | TS, zero-dep core | JS | Electron | SaaS | TS | Java/TS | TS/React | TS |
| Typed code builder | ✅ fluent TS | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Auto-layout | ◐ fast, worse routing | ✅ bpmn-auto-layout | ◐ | ◐ | ❌ | ✅ | ◐ | ✅ |
| Viewer/modeler | ✅ own | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Properties panel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Element templates (Camunda schema) | ◐ outbound only | ✅ | ✅ | ✅ | ✅ | own | ❌ | — |
| Lint | ✅ own ~40 rules | ✅ bpmnlint | ✅ | ✅ | ✅ bpmnlint | ✅ | ◐ | ✅ |
| bpmnlint config/plugin compat | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | — |
| MIWG tested | ❌ | ✅ | ✅ | ✅ | via bpmn-js | ? | ? | — |
| Choreography | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| DMN editing | ✅ DMN 1.3 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ DMN 1.6 | — |
| FEEL engine | ✅ **94% TCK** | feelin (unlisted) | feel-scala | feel-scala (84%) | — | own | Drools 99.9% | — |
| Forms | ✅ Camunda schema | form-js | ✅ | ✅ | ✅ | own | ❌ | — |
| Execution-semantics simulation | ✅ TS engine + WASM | ❌ (token anim.) | token anim. | Play (needs cluster) | ◐ | model tests | test scenarios | ✅ |
| Scenario/unit tests | ✅ `casen test` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Visual diff | ✅ | lib | ❌ | versions | ✅ | ✅ | ❌ | — |
| Collaboration | ◐ Drop (single-writer baton) | ❌ | ❌ | ✅ roles/comments/lock | Git | ✅ Git/PR | ❌ | ◐ |
| Comments / @mentions | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ |
| AI generation | ✅ (pools/lanes, BYO CLI) | ❌ | ❌ | ◐ alpha, no lanes | planned | ✅ | ❌ | ✅ |
| MCP authoring server | ✅ (proxy) | ❌ | community | ❌ | ❌ | ✅ | ❌ | ❌ |
| Offline agent docs | ✅ docspack | ❌ | ❌ | Docs MCP (online) | ❌ | ❌ | ❌ | ❌ |
| CLI deploy/run | ✅ casen | ❌ | via c8ctl | c8ctl | ✅ | ❌ | ❌ | — |
| VS Code | ◐ **not on Marketplace** | basic ext | — | — | ✅ 12.4k installs | ❌ | deprecated | ✅ |
| Desktop | ◐ no installers | — | ✅ | — | Theia | — | — | — |
| Camunda 7 / Operaton / CIB7 | ❌ | ✅ | ✅ | ❌ | ✅ | — | — | — |
| i18n shipped languages | ◐ hook only | translate service | plugin | ✅ | ✅ 9–10 | ✅ | ✅ | ? |
| a11y | ✅ keyboard/aria-live | ✅ WCAG AA | ✅ | ✅ | ◐ | ✅ WCAG 2.2 | ? | ? |
| Operate-like monitoring | ◐ 0 tests | ❌ | ❌ | Operate (licensed) | ❌ | Hub | ❌ | inspector |
| Doc export (Word/PDF) | ❌ | ❌ | ❌ | ◐ | ❌ | ◐ | ❌ | ❌ |
| Adoption | 9★, ~2k/wk | 9.7k★, 176k/wk | 1.7k★ | enterprise | 12.4k installs | enterprise | small | 30k★ |

**Reading the matrix:** BPMN Kit wins on *breadth for developers* (builder, tests, simulation,
AI, MCP, docs, CLI, MIT) and loses on *ecosystem interop* (bpmnlint, MIWG, C7, templates
inbound), *distribution* (Marketplace, installers) and *team features* (comments, roles).

---

## 11. What other libraries let you do that BPMN Kit does not (yet)

**Modeling & standards**
- Round-trip certified against the **OMG MIWG** reference models (bpmn.io, Cardanit,
  Yaoqiang).
- Reuse existing **bpmnlint** rules, `.bpmnlintrc` configs and `bpmnlint-plugin-*`
  packages; Camunda-version-aware `@camunda/linting` rules.
- Model **choreography/conversation** diagrams (Horus; rare anywhere).
- Apply **inbound connector** templates and linked-resource bindings.
- **DMN 1.5/1.6** boxed expressions, full typeRef system (KIE, Trisotech).
- Layout quality of **bpmn-auto-layout 2.0 / yFiles** (fewer crossings, no edges through
  shapes).
- Handle **500–100k element** diagrams with virtualization (JointJS+ claim).
- **bpmn-js extension ecosystem** (hundreds of modules: color picker, custom renderers,
  bpmn-js-native-copy-paste) — BPMN Kit has no adapter.

**Runtimes**
- Target **Camunda 7 / Operaton / CIB seven / EximeeBPMS** (Miragon, Camunda Desktop).
- **C7 → C8 migration** analysis/conversion (Camunda tooling, Java-only).
- Run BPMN on a **durable execution engine** (QuantumBPM on Temporal).
- **Multi-node, replicated** production engine (Zeebe; Reebe is single-node, unproven).
- **Business simulation** — arrival rates, resources, cost (BIMP, Signavio, Cardanit BPSim).

**Team & business**
- **Comments, @mentions, roles, review workflows** (Web Modeler, Signavio Hub, Flowable).
- **Git sync with branches/PRs** inside the modeler (Web Modeler, Flowable 2026.1).
- **Documentation export** to Word/PDF/Excel (Bizagi).
- **Process landscape / repository** views (Web Modeler, Signavio, ARIS).
- **Shipped UI translations** (Miragon 9–10 languages).

**Developer experience**
- **One-command local dev** with engine + UI (Temporal, Inngest, Vercel).
- **Test helpers in the project's runner** with mocks (Step Functions TestState, Temporal,
  CPT).
- **Time-travel / re-run from step** (LangGraph Studio, Kestra Playground, Temporal
  history).
- **OpenTelemetry traces**, run timelines (Inngest, Temporal, Trigger.dev).
- **Two-way code ↔ diagram sync** (Stately, Kestra) — BPMN Kit has builder → diagram and
  `ProcessBuilder.from()`, but not live bidirectional editing of TS source.
- **Template gallery** with one-click run (n8n 10k, Kestra blueprints, Trigger.dev agent
  patterns).
- **Marketplace-installable IDE extension** (Miragon, Stately).

---

## 12. SWOT

| Strengths | Weaknesses |
|---|---|
| Only full MIT, watermark-free, Camunda-8-aware BPMN stack | 9★, ~2k/wk downloads, no community channel, no users shown |
| Typed TS builder + auto-layout + lint + simulator = the research-validated AI recipe | Bus factor 1; 27 packages + 12 apps spread thin |
| FEEL 94% TCK (beats Camunda's DMN-Scala 84%) | No bpmnlint / MIWG / C7 interop → high switching cost from bpmn.io |
| Agent-native: compact format, MCP, offline docspacks, Claude plugin, published AI benchmark | VS Code not on Marketplace; desktop without installers; Studio/Reebe hidden |
| Disciplined release engineering (API snapshot, stability policy, tarball checks) | Auto-layout routing below bpmn-auto-layout 2.0 |
| Browser-native execution (TS + WASM) — unique for Camunda semantics | Stale copy and overclaims erode the honest tone |
| Candid, engineering-grade tone | No analytics, no blog since July, no showcase |

| Opportunities | Threats |
|---|---|
| Camunda licence change → demand for free local/CI tooling | Camunda first-party convergence (c8ctl, Claude skills, MCP, Hub, Copilot) |
| C7 EOL (2025-10) → migration tooling for JS/TS shops and fork users | bpmn.io ecosystem gravity and daily release cadence |
| Empty BPMN+MCP niche; Flowable just validated "designer as MCP" | Code-first durable execution absorbing TS developers |
| Agent frameworks need a standard graph; governance (EU AI Act, ISO 42001) favours BPMN | Small new entrants (lila-modeler, bpmn-generator) moving fast |
| No live OSS Operate replacement for C8 | Legal/brand risk if Reebe is positioned as a production Zeebe replacement |
| Mermaid has no BPMN — a text BPMN dialect is open | Scope sprawl delaying the core wedge |
| JS DMN/FEEL: no JS engine on the TCK table | Camunda API churn (8.8→8.10) requiring constant client updates |

---

## 13. Presentation audit

Benchmarked against Temporal, Inngest, Trigger.dev, n8n, Stately, React Flow and Kestra — all
of which share nine patterns: one-line AI+reliability value prop; live code/demo above the
fold; numeric social proof; one-line local command; template/pattern gallery; logos &
testimonials; explicit open-source/no-lock-in; Discord/Slack; visible changelog.

| Pattern | Leaders | BPMN Kit today | Gap |
|---|---|---|---|
| One-line value prop | "Unbreakable Agents. Invisible Infra." | "41 lines of BPMN XML. Or 13 lines of TypeScript." (clever, but narrow); README: "complete TypeScript toolkit for Camunda 8" | Doesn't say *why now* (agents, licence, local) or *for whom* |
| Live demo above the fold | React Flow live hero; Stately "Try the editor" | Playground is section 7 of 11 | Move a runnable builder→diagram→simulate demo into the hero |
| Social proof numbers | stars, downloads, Discord members | none | Show npm downloads, TCK %, test count, packages at 1.0 |
| One-line local start | `temporal server start-dev` | Three-step quickstart | Needs `npx bpmnkit dev` / `npm create bpmnkit` |
| Template / pattern gallery | n8n 10k, Trigger.dev agent patterns | 7 seed patterns (not on site), 6 examples | 20–50 runnable BPMN templates incl. agent patterns, one-click "open in playground" |
| Logos / testimonials / case studies | all | none | Even 2–3 early users or a "built with" page |
| Open-source & licence stated | Trigger.dev, Kestra | eyebrow "MIT" | Make **"MIT — no watermark, no licence key, forever"** a headline and quote the bpmn.io clause on /compare |
| Community | Discord/Slack everywhere | GitHub + `mailto:` only | Open GitHub Discussions at minimum; Discord optional |
| Changelog / momentum | homepage changelog | 10 blog posts, **none since 2026-07-06**; 1.0 release not announced on the blog | Publish a 1.0 launch post; surface `progress.md` as a public changelog |
| Comparison pages | Inngest vs Temporal etc. | bpmn-js, Camunda Modeler only | Add Miragon, bpmn-auto-layout, feelin, bpmn-engine, c8ctl, Camunda SDK, Stately-style "BPMN vs code-first" |
| Conformance proof | Trisotech TCK, bpmn.io MIWG | FEEL 94% TCK not shown; no MIWG | Publish a conformance page (TCK %, element coverage, engine semantics matrix) |
| Audience paths | n8n (business + dev) | developer-only, "For process teams" is thin | Separate entry for analysts/architects: Drop, AI generation, governance |
| Distribution | Marketplace, installers, Docker one-liners | VS Code "Install →" leads to build-it-yourself; desktop claims installers that don't exist | Publish to VS Code Marketplace + Open VSX; either ship desktop builds or remove the claim |
| Product visibility | clear product nav | Studio, Reebe, Operate, proxy, user-tasks undocumented | Decide: promote (with docs) or label experimental / hide from README |

### 13.1 Concrete copy defects to fix now

1. `README.md:287` "Every package is on **0.x**" and `apps/landing/src/pages/index.astro:305`
   "Independently versioned and pre-1.0" — contradict the 1.0.0 release.
2. Plugin count "22" (README, plugins README) / "23" (package.json) vs **34** actual.
3. "Complete FEEL implementation" → "FEEL with 94% DMN TCK conformance" (and link the
   nightly result).
4. "Parse → modify → export with no data loss" → qualify, per
   `docs/getting-started/concepts.md:129`.
5. `packages/engine/README.md` lists event-based/complex gateways, compensation,
   escalation, call activity — the TS engine auto-completes or lacks them
   (`packages/engine/src/instance.ts:429`). Split "TS simulator" vs "WASM runner" support.
6. Desktop "3–5 MB installer for Windows, macOS, Linux" — no release workflow builds it.
7. `apps/reebe/README.md`: "gRPC API: No" while `reebe-grpc` exists; quick start clones
   `github.com/urbanisierung/reebe`; memory/startup claims unbenchmarked.
8. README repo tree calls `apps/` "Non-published" (cli, proxy, reebe-wasm are published).
9. Licence inconsistency: Reebe crates Apache-2.0 under an MIT-branded project — either
   align or explain.
10. Internal docs: mark `render-gap-analysis.md`, `reebe-wasm-roadmap.md` and
    `landing-page-analysis.md` with current status; update `CLAUDE.md` stack section
    (Preact/Radix/Tailwind, not React/Carbon).

---

## 14. Areas that need improvement — prioritised

### P0 — Credibility & distribution (weeks, low effort, high leverage)

> **Status (2026-09-23): done in code; four owner steps remain.** Items 1–4 and 6–8 are
> implemented; see the matching `doc/progress.md` entry. The owner still has to:
> - create the Marketplace publisher and Open VSX namespace, and add `VSCE_PAT` / `OVSX_PAT`
>   (item 2);
> - add the `CF_WEB_ANALYTICS_TOKEN` repository variable (item 6);
> - enable GitHub Discussions (item 5);
> - decide on `CLAUDE.md`'s stack section (§13.1 #10).

1. **Fix every stale claim listed in §13.1.** The site's honest tone is its best asset;
   each overclaim undermines it.
2. **Publish the VS Code extension** to the Marketplace and Open VSX. Miragon has 12.4k
   installs with a bpmn.io-based product; a watermark-free, lint + simulate + diff extension
   is competitive *if installable*.
3. **Ship desktop installers** via a Tauri release workflow — or remove the claim.
4. **Conformance page**: FEEL TCK 94% (vs Camunda DMN-Scala 84%), BPMN element coverage
   table (core / canvas / TS engine / WASM engine), descriptor coverage numbers, known gaps.
5. **1.0 launch post** + restart a changelog cadence; open GitHub Discussions.
6. **Add analytics** (privacy-friendly) so the funnel can be measured (roadmap SEO phase 6).
7. **"MIT, no watermark" headline** and a licence comparison on `/compare/bpmn-js`, quoting
   the bpmn.io clause verbatim.
8. Submit the MCP server to MCP directories; mention "Claude Code / Cursor can model,
   lint, simulate and deploy Camunda 8 processes" on the homepage.

### P1 — Interop (the adoption unlock, 1–3 months)

> **Status (2026-09-24): done.** See `doc/progress.md`.
> - **Item 9:** `.bpmnlintrc` is honoured. All 28 built-in rules are mapped exactly, in
>   every sub-process scope (compared with bpmnlint on 43 files, 2026-09-25), and the
>   project's own bpmnlint runs its plugins. The `@camunda/linting` Camunda-version rules
>   (2026-09-25): 52 of the 65 `bpmnlint-plugin-camunda-compat` 2.61 rules are reproduced and
>   3 more are covered by existing findings; they match the plugin on test fixtures under every
>   `camunda-cloud-*` config, and `extends: "plugin:camunda-compat/camunda-cloud-X-Y"` maps onto
>   them. The FEEL-analysis rules (`feel-compatibility`, `variable-name`, the agent `fromAi`
>   rules) and `no-loop` are not covered.
> - **Items 10 and 11:** all 22 MIWG reference models are in the round-trip corpus and pass.
> - **Item 12:** inbound and linked-resource templates apply. Per-file resolution
>   (2026-09-25): Studio asks the proxy for one model's templates
>   (`GET /element-templates?root=…&file=…`) and swaps them when another model opens.
>   `casen lint`, the `casen dev` checks and the VS Code Problems panel check connector inputs
>   against each diagram's own `.camunda/element-templates/` chain. bpmnkit.com/editor and Drop
>   have no filesystem and use the bundled templates. The VS Code and `casen dev` editors have
>   no properties panel yet, so their templates are used only by lint.
> - **Item 13:** vendor DI, label styles and default-namespace files are preserved.
> - **Item 14:** FEEL matches 375 of the 378 examples in Camunda's documentation.
>
> The MCP server now writes through `writeBpmn`. On 2026-09-25 labels began rendering in their
> label style's font, and sub-process scope was added to the 7 approximate lint rules: all 28
> now match bpmnlint exactly.

9. **bpmnlint compatibility**: read `.bpmnlintrc`, run `bpmnlint-plugin-*` rules through an
   adapter, map BPMN Kit's ~40 rules to bpmnlint rule names; import `@camunda/linting`
   Camunda-version rules.
10. **OMG MIWG test suite**: run reference models A/B/C through parse → serialise; publish
    results and submit them upstream.
11. **Grow the round-trip corpus** beyond 6 fixtures (Camunda blueprints, MIWG, public
    GitHub `.bpmn` files with permissive licences); close unmodelled-children loss; make
    the MCP server use `writeBpmn`.
12. **Element templates**: inbound connectors and linked-resource bindings; per-file
    resolution in browser hosts.
13. **Preserve bpmn.io artefacts**: `bioc:`/`color:` (already present), bpmn-js custom
    extension namespaces, Desktop Modeler `.camunda/element-templates/` convention.
14. **feel-scala parity suite** (Camunda behaviour beyond the TCK), since Camunda users care
    about what Zeebe does, not the spec.

### P2 — The developer loop (the wedge, 1–3 months)

> **Status (2026-09-24): done.** See `doc/progress.md`.
> - **Item 15:** `casen dev` runs editor, simulation, lint and scenario checks on save,
>   on the TS engine or Reebe WASM.
> - **Item 16:** `@bpmnkit/engine/testing` (+ `/testing/vitest`) with job, connector and
>   timer control and path assertions.
> - **Item 17:** the TS simulator now executes call activities, event sub-processes,
>   event-based gateways, signals, escalations, multi-instance, link events and
>   compensation, with Zeebe variable propagation. Reebe WASM correlates messages and keeps
>   job results.
> - **Item 18:** `casen generate types` with worker contract checks.
> - **Item 19:** the runner's scrubber redraws the tokens at each event.
> - **Item 20:** 25 runnable templates (7 AI-agent patterns), `casen template`, `/templates`.

15. **`npx bpmnkit dev`** (or `casen dev`): local engine (WASM) + editor + Operate-like view
    in one command, no Docker, no licence key — the Camunda equivalent of
    `temporal server start-dev`.
16. **Vitest/Jest test helpers**: `startInstance`, `completeJob`, `expectPath`,
    `mockConnector`, `mockAgentToolSelection` — plus path-coverage report and generated
    tests from the diagram. Market against Java-only CPT.
17. **Engine semantics matrix**: bring the TS simulator to parity on call activity,
    event-based gateway, event sub-process, compensation — or make the WASM runner the
    default and document it.
18. **Typed codegen from BPMN**: job types, variable shapes, message names → TS types for
    workers (`casen gen types`), plus contract checks between BPMN and workers.
19. **Time-travel in the simulator**: token-history scrubber, "re-run from here" (Kestra
    Playground pattern).
20. **Template gallery**: 20–50 runnable processes, incl. AI-agent patterns (routing,
    orchestrator/worker, evaluator/optimizer, human approval, ad-hoc tool loop), each with
    "open in playground" and "deploy with casen".

### P3 — Strategic bets (quarter+, pick deliberately)

21. **Camunda 7 → 8 migration assistant** (browser + CLI): lint C7 models for C8 gaps,
    convert `camunda:` → `zeebe:`, JUEL → FEEL hints, simulate on C8 semantics. Serves the
    C7 EE base (supported to 2030) and fork users. Optionally read/write C7/Operaton
    extensions.
22. **Agentic BPMN testing**: record/replay LLM tool selection inside ad-hoc sub-processes;
    deterministic mocks for the AI Agent connector — directly addresses Camunda's own "11%
    reach production" statistic.
23. **Auto-layout routing** to parity with bpmn-auto-layout 2.0 (edges through shapes,
    crossings), keeping the 100× speed advantage; publish the benchmark on `/auto-layout`.
24. **Text BPMN for Markdown** (Mermaid has none): a fenced ```bpmn-compact``` renderer
    plugin for Markdown/MDX/Docusaurus/Astro, built on the compact format + ASCII/SVG
    renderers.
25. **Lightweight Operate for dev clusters, C8 Run and SaaS trials** — only if tests and
    docs are brought up to 1.0 quality.
26. **Collaboration**: comments/@mentions on Drop; true CRDT co-editing would leapfrog Web
    Modeler's lock-and-take-over model (analysed in `doc/drop-collaborative-editing-analysis.md`).
27. **Docspack as a standalone product/format** (offline Context7 alternative).

### P4 — Focus & hygiene

28. **Prune or label the surface.** Tier products publicly: *Core* (core, canvas, editor,
    feel, engine, cli, api, connectors), *Tools* (VS Code, Drop, docspack, MCP),
    *Experimental* (Reebe, Studio, Operate, desktop, proxy-rs). Consider pausing Studio or
    merging it with Operate.
29. **Reebe positioning**: dev/test only, clean-room, no Camunda trademarks in the name of
    any hosted offering; run its Rust tests (incl. Postgres compat) in CI; publish bench
    results or drop the claims.
30. **Tests for 0-test packages** that are shown publicly (operate, patterns, profiles,
    user-tasks, worker-client, cli-sdk).
31. **Bus factor**: CONTRIBUTING "good first issues", a public roadmap board, and a
    maintainer-of-record for at least one area.
32. **Business-user path**: doc export (PDF/Word) from the editor/Drop; shipped UI
    translations beyond the i18n hook (Miragon ships 9–10).

---

## 15. Positioning recommendation

### 15.1 Recommended primary positioning

> **BPMN as TypeScript — for you and your coding agent.**
> Model, lint, simulate and test Camunda 8 processes in code, in the browser and in CI.
> No Docker, no licence key, no watermark. MIT.

Three proof pillars, each backed by a number on the homepage:

1. **Code-first, standard-output** — typed builder → auto-laid-out BPMN any Camunda tool
   opens. *(proof: XML vs TS hero, round-trip + MIWG results)*
2. **Local & free dev loop** — simulator + WASM engine + tests + `casen`. *(proof: `npx
   bpmnkit dev`, FEEL 94% TCK, engine semantics matrix)*
3. **Agent-native** — MCP server, offline version-pinned docspacks, compact format, Claude
   Code plugin, published generation benchmark. *(proof: benchmark numbers, research
   citations)*

Secondary message: **"MIT, no watermark"** for anyone embedding a BPMN editor in a product
(bpmn.io's licence is the reason JointJS+, bpmn-visualization and ProcessMaker exist).

### 15.2 Angles to avoid

- A general-purpose durable-execution runtime against Temporal.
- A production Zeebe replacement (legal, brand and trust risk with Camunda; unproven scale).
- An integrations/template-count race with n8n.
- A closed visual agent builder (OpenAI Agent Builder and Flowise are cautionary tales).
- Enterprise BPM suite features (process landscapes, governance portals) against Signavio
  and ARIS.

### 15.3 Relationship with Camunda

Position as a **complement to Camunda** ("works with any Camunda 8 — SaaS or
self-managed — and helps you get there faster"), not a competitor. That keeps the door open
to partnership/marketplace listing, aligns with Camunda's own push into TS tooling, and
avoids the licence-sensitive "free Zeebe" framing. The C7 EOL migration angle is where BPMN
Kit can be *useful to Camunda's sales motion* rather than against it.

---

## 16. Sources

**Camunda**
- Release notes 8.8: https://docs.camunda.io/docs/next/reference/announcements-release-notes/880/880-release-notes/
- 8.9: https://camunda.com/blog/2026/04/camunda-8-9-fastest-path-to-agentic-orchestration/
- 8.10 alpha3: https://camunda.com/blog/2026/07/inside-camunda-810-alpha3-the-architecture-that-makes-agentic-orchestration-trustworthy/
- Licensing: https://docs.camunda.io/docs/reference/licenses/ · https://camunda.com/blog/2024/10/camunda-licensing-what-you-need-to-know/
- ARR press release: https://camunda.com/press-releases/camunda-closing-in-on-200m-in-arr-doubling-revenue-in-record-time/
- C7 EE EOL extension: https://camunda.com/blog/2025/02/camunda-7-enterprise-end-of-life-extension/
- BPMN Copilot: https://docs.camunda.io/docs/components/early-access/alpha/bpmn-copilot/
- c8ctl: https://camunda.com/blog/2026/03/meet-c8ctl/
- TS client: https://docs.camunda.io/docs/apis-tools/typescript/oca-client/
- Web Modeler collaboration: https://docs.camunda.io/docs/components/modeler/web-modeler/collaboration/collaboration/
- Why BPMN still matters: https://camunda.com/blog/2026/04/why-bpmn-still-matters-especially-in-the-age-of-ai/
- JS process test preview: https://jwulf.github.io/camunda-process-test-js/

**bpmn.io & modelers**
- bpmn.io licence: https://bpmn.io/license/
- bpmn-js releases: https://github.com/bpmn-io/bpmn-js/releases
- form-js 2.0: https://github.com/bpmn-io/form-js/releases/tag/v2.0.0
- JointJS vs bpmn-js: https://www.jointjs.com/blog/jointjs-vs-bpmn-js-technical-comparison-for-production-bpmn-editors
- Miragon: https://github.com/Miragon/bpmn-modeler · https://marketplace.visualstudio.com/items?itemName=miragon-gmbh.vs-code-bpmn-modeler
- Flowable 2026.1: https://www.flowable.com/blog/releases/2026-1
- Apache KIE 10.2 editors: https://kie.apache.org/blog/new-generation-editors-kie-10-2/
- SAP Signavio text-to-process: https://news.sap.com/2025/03/sap-signavio-launches-ai-process-modeler-text-to-process/
- bpmn-visualization: https://github.com/process-analytics/bpmn-visualization-js
- MIWG: https://bpmn-miwg.github.io/bpmn-miwg-tools/
- DMN TCK: https://dmn-tck.github.io/tck/
- feelin: https://github.com/nikku/feelin
- Mermaid BPMN issue: https://github.com/mermaid-js/mermaid/issues/7699

**Engines & forks**
- Operaton: https://operaton.org/ · CIB seven: https://cibseven.org/en/ · EximeeBPMS: https://eximeebpms.org/
- C7→C8 migration tooling: https://github.com/camunda/camunda-7-to-8-migration-tooling
- Apache KIE 10.2: https://kie.apache.org/blog/kie_10_2_0_release/
- Elsa: https://docs.elsaworkflows.io/ · SpiffArena: https://github.com/sartography/spiff-arena
- bpmn-engine: https://www.npmjs.com/package/bpmn-engine · bpmn-server: https://github.com/bpmnServer/bpmn-server
- QuantumBPM: https://quantumbpm.com/blog/bpmn-on-temporal
- Oracle OCI PA EOL: https://blogs.oracle.com/integration/oracle-cloud-infrastructure-process-automation-end-of-life
- Pega Infinity 26: https://www.pega.com/about/news/press-releases/pega-infinity-26-now-available-deliver-predictable-outcomes-predictable

**Code-first, low-code, agents**
- Temporal $550M: https://finance.yahoo.com/technology/ai/articles/temporal-raises-550m-12-55b-123000285.html
- Temporal Replay 2026: https://temporal.io/blog/replay-2026-product-announcements
- Vercel Workflow: https://vercel.com/blog/introducing-workflow · https://workflow-sdk.dev/worlds
- Inngest Series A: https://www.inngest.com/blog/announcing-inngest-series-a
- Trigger.dev Series A: https://trigger.dev/blog/series-a
- Cloudflare workflow visualizer: https://developers.cloudflare.com/changelog/post/2026-02-03-workflows-visualizer/
- Orkes $60M: https://www.businesswire.com/news/home/20260423550324/en/
- Kestra Series A / 1.0 / 2.0: https://kestra.io/blogs/kestra-series-a · https://kestra.io/blogs/release-1-0 · https://kestra.io/blogs/release-2-0
- Prefect acquires Dagster: https://www.businesswire.com/news/home/20260713065285/en/
- n8n: https://sacra.com/c/n8n/ · https://blog.n8n.io/series-c/
- Workday–Pipedream: https://newsroom.workday.com/2025-11-19-Workday-Signs-Definitive-Agreement-to-Acquire-Pipedream
- MS Agent Framework 1.0: https://techcommunity.microsoft.com/blog/azuredevcommunityblog/the-future-of-agentic-ai-inside-microsoft-agent-framework-1-0/4510698
- Google ADK Go 2.0: https://developers.googleblog.com/announcing-adk-go-20/
- OpenAI AgentKit: https://openai.com/index/introducing-agentkit/
- Context7: https://github.com/upstash/context7
- Stately: https://stately.ai/ · xyflow: https://github.com/xyflow/xyflow · tldraw licence: https://tldraw.dev/community/license
- Open Workflow Specification 1.0: https://open-workflow-specification.org/blog/releases/release-100/
- Arazzo: https://spec.openapis.org/arazzo/latest.html

**Research**
- ProMoAI / LLM BPMN benchmark: https://link.springer.com/article/10.1007/s10270-025-01318-w
- BEF4LLM: https://arxiv.org/abs/2601.21787
- Multi-stage generation: https://arxiv.org/abs/2604.12105
- BPMN Assistant: https://arxiv.org/pdf/2509.24592

**Market & analysts**
- Grand View BPM: https://www.grandviewresearch.com/press-release/global-business-process-management-bpm-market
- Mordor agentic orchestration: https://www.mordorintelligence.com/industry-reports/agentic-ai-workflow-orchestration-platform-market
- Gartner BOAT 2026: https://page.camunda.com/2026-gartner-magic-quadrant-for-boat
- Forrester APO Landscape Q2 2026: https://www.forrester.com/report/the-adaptive-process-orchestration-software-landscape-q2-2026/RES194274
- Gartner agentic cancellation prediction: https://www.gartner.com/en/newsroom/press-releases/2025-06-25-gartner-predicts-over-40-percent-of-agentic-ai-projects-will-be-canceled-by-end-of-2027

*Caveats: the bpmn-js star count (~9.7k) came from its releases page because the bpmn-io
org is SAML-blocked for the GitHub API. ARR, customer counts and some adoption numbers are
vendor or tracker reports. The €99/month Camunda "starter" tier cited by third parties is
not on Camunda's pricing page and is omitted here.*
