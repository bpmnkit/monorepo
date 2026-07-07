# AI-Driven BPMN Generation — Deep Analysis & Evaluation

**Date:** 2026-07-07
**Scope:** How the whole monorepo performs for *"user describes a process in natural language → Claude Code produces Camunda-flavored, executable BPMN"* — with connectors (e.g. Slack → service task with the Slack outbound connector), AI agentic sub-processes, longer/complex processes, and extension of existing processes. Target: it must *just work* with minimal iterations — all properties set, flows valid, FEEL valid.
**Companion spec (implementation handoff):** [`doc/spec-bpmn-generation-skills.md`](spec-bpmn-generation-skills.md)

---

## 1. Executive summary

The monorepo already contains **~90 % of the deterministic machinery** needed for reliable AI-driven BPMN generation — a fluent builder with auto-layout, a 40-rule linter with auto-fixes, a full FEEL parser, a real local execution engine (Reebe/WASM), 116 bundled Camunda OOTB connector templates *including the complete agentic-AI family*, and a deploy pipeline. What is missing is not capability but **connection and contract**:

1. **The AI-facing format is too lossy.** Generation flows through `CompactDiagram`, which cannot express connector properties, io-mappings, `fromAi()` tool parameters, assignments, or message correlation — so even a perfect plan cannot be materialized faithfully through the current AI path.
2. **The deterministic connector-apply API exists but is unreachable and incomplete.** `templateToServiceTaskOptions()` lives in a UI plugin, silently drops all `zeebe:property` bindings (823 occurrences across bundled templates), handles outbound service tasks only, and is not exposed to any skill, CLI command, or MCP tool.
3. **The agentic building blocks exist but there is no high-level constructor.** The model, builder, and templates all know about `zeebe:adHoc` and `io.camunda.agenticai:aiagent-job-worker:1`, but nothing assembles a correct AI Agent sub-process (provider bindings, prompts, tool root-nodes with `fromAi()` input mappings, output collection) in one deterministic call.
4. **Validation has the wrong blind spots for AI output.** The linter never surfaces FEEL *parse errors*, never checks that a service task has a `zeebe:taskDefinition`, and knows nothing about connector-template required fields — exactly the three most common LLM failure modes (Camunda's own copilot research confirms: invalid DI, broken FEEL, wrong connector props).
5. **The current generation architecture is non-deterministic at the wrong layer.** `bpmn_create` spawns a *nested* `claude` CLI through the proxy. When the caller *is already Claude Code*, this adds a second LLM, a proxy daemon, and schema drift — three failure sources — while removing the calling model's context.
6. **Two overlapping skill sets have drifted apart** (plugin `/bpmnkit:*` vs bundled `/implement`), with concrete bugs (`casen lint lint`, `bpmn_deploy` argument mismatch, `/test` promising execution coverage that the structural-only `bpmn_simulate` cannot deliver).

**The core proposal:** introduce a typed, complete **ProcessPlan** intermediate representation plus a deterministic **plan compiler**, expose connector application and AI-agent construction as deterministic SDK/CLI operations, upgrade the linter to a deploy-grade gate, and rebuild the skills as thin orchestrators where Claude does *only* the semantic work (intent → plan, FEEL authoring, connector selection) and the SDK does *everything mechanical* (XML, DI, IDs, properties, validation, testing, deployment). Section 7 gives the full deterministic/non-deterministic split; the spec details the work packages.

---

## 2. How generation works today

### 2.1 The current pipeline

```
Claude Code skill (/implement, /bpmnkit:generate)
  → MCP tool bpmn_create            (apps/proxy/src/aikit-mcp.ts)
    → POST /chat on local proxy      (SSE, requires `casen proxy start`)
      → claude adapter SPAWNS A NESTED `claude` CLI
        (apps/proxy/src/adapters/claude.ts — --dangerously-skip-permissions,
         temp settings, CLAUDECODE guard stripped)
        → nested model drives editor MCP tools (compose_diagram, add_elements,
          add_http_call, set_condition …  apps/proxy/src/mcp-server.ts)
          → CompactDiagram JSON → expand() → applyAutoLayout() → BPMN XML
  → aikit-mcp writes the .bpmn file
```

Two things are genuinely right about this design and must be preserved:

- **BPMN XML is never hand-written by the LLM.** The model emits structured `CompactDiagram` JSON; `@bpmnkit/core` materializes valid XML *with correct BPMN DI* via the Sugiyama layout engine. This is the single most important existing asset.
- **`apps/proxy/src/prompt.ts` encodes a mature Camunda modeling style guide** (Verb-Object task naming, event naming, gateway-as-question, happy-path-on-centerline, join-gateway rules). This knowledge should be lifted into the new skills verbatim.

What is wrong:

- **The nested-LLM hop.** When Claude Code is the caller, `bpmn_create` delegates semantic work to a *second* model process with *less* context than the caller (no conversation history, no repo context), behind a proxy daemon that must be running, with its own auth/permission bypass logic. Latency, fragility, and quality all suffer. The proxy path remains the right design for Studio's AI drawer (browser UI, multi-backend) — but skills should not route through it.
- **The compact format is the ceiling.** `CompactElement` (packages/core/src/bpmn/compact.ts) carries `jobType`, `taskHeaders`, `calledProcess`, `formId`, `decisionId`, `resultVariable`, `eventType`, `attachedTo`, `interrupting`, `children` — and nothing else. No io-mappings, no `zeebe:properties`, no documentation (needed as AI-agent tool descriptions), no assignment definitions, no message correlation keys, no completion conditions, no connector template references. Any process that needs a properly configured connector or an agentic sub-process **cannot be expressed** in the format the AI is asked to produce.

### 2.2 The two skill surfaces

| Surface | Skills | Backend | State |
|---|---|---|---|
| `plugins-claude/bpmnkit-claude/` | generate, review, deploy, worker, test, instances, incidents, ascii + 2 agents | `casen proxy mcp` → same `aikit-mcp.js` | `casen lint lint` bug (×2), `bpmn_deploy(xml,…)` vs actual `(path,…)` schema drift, worker fallback template uses a stale client API, `/test` over-promises |
| root `.claude/` + `apps/cli/skills/` | implement, review, test, deploy | `node apps/proxy/dist/aikit-mcp.js` | flagship `/implement` orchestrates 4 subagents; `bpmn_simulate` it relies on is structural-only ("Phase 1") |

Both are front-ends over the same MCP server, yet their tool schemas and instructions have drifted. The consolidation is overdue and is part of the spec.

---

## 3. Package-by-package evaluation (in the context of AI generation)

| Package / app | Role in generation | Verdict |
|---|---|---|
| `packages/core` | Fluent builder (`Bpmn.createProcess`), parser/serializer, compact format, **Sugiyama auto-layout incl. lanes/collaborations**, optimizer (6 analyzers, ~40 rules, many with `applyFix`), operations (`applyOperations` patch ops), DMN + Form builders, input-validation DMN generator | **Excellent substrate.** Gaps: no `assignmentDefinition`/`taskSchedule`/`priorityDefinition`/message `subscription` in builder; no `bpmn:completionCondition` on ad-hoc sub-process; no pool/lane/message-flow *creation*; compact format lossy (see §2.1) |
| `packages/feel` | Full FEEL tokenizer/parser/evaluator, 87 builtins, unary tests, `ParseError[]` with positions | **Underused.** Parse errors are available but the BPMN linter never surfaces them; unknown variables silently evaluate to `null` (semantic checking exists only via core's variable-flow analysis) |
| `packages/core/src/bpmn/optimize/` | The linter: flow, feel (heuristic), naming, patterns (15 Camunda best-practice rules), task-reuse, variable-flow (real FEEL parsing, produces/consumes graph, typo suggestions) | **Good but not deploy-grade.** Missing: FEEL parse-error rule, `serviceTask` without `taskDefinition`, message catch without `correlationKey`, connector-template required-prop checks, agentic-structure rules |
| `packages/engine` | Zero-dep TS simulation engine + scenario harness (`runScenario`: worker mocks, path & variable assertions, FEEL eval trace) | **Solid for simple flows;** `callActivity`, `eventSubProcess`, `adHocSubProcess` are auto-completed, not executed (instance.ts:382) — cannot verify agentic processes |
| `apps/reebe` / `reebe-wasm` (+ `@bpmnkit/engine/wasm-runner`) | Rust Camunda-8-REST drop-in engine; WASM build powers `casen test` (`runScenarioWasm`) | **The real verification asset.** Deploy-parity validator (`reebe-bpmn/src/validator.rs`) enforces what Zeebe rejects — incl. the "service task needs taskDefinition" rule the TS linter lacks. Local deploy-and-run is the honest "does it execute" check |
| `packages/api`, `profiles`, `worker-client`, `user-tasks`, `operate` | 180-op typed Camunda 8 REST client, OAuth profiles, thin worker runtime, task UI, ops UI | **Complete for deploy/run.** No gaps relevant to generation |
| `packages/patterns` | 7 domain patterns (keywords, readme, worker specs, compact template) + `findPattern` | Good retrieval seeds; templates inherit compact-format lossiness (no connectors/agents in patterns yet) |
| `packages/connector-gen` | OpenAPI/Swagger → generic `io.camunda:http-json:1` element templates; 100-API catalog (18,145 endpoints) | Useful long-tail fallback ("any REST API becomes a connector"); everything maps to http-json; disconnected from the OOTB catalog |
| `packages/plugins/src/config-panel-bpmn` | **116 bundled Camunda OOTB element templates** (Slack `io.camunda:slack:1`, SendGrid, HTTP, Kafka, AWS, and the full `io.camunda.agenticai:*` family) + `templateToServiceTaskOptions()` | **The key unexposed asset.** Apply API drops `zeebe:property` bindings (823 across the catalog), is outbound-only, does no required-field validation, and lives in a UI package no skill can reach. `scripts/update-connectors.mjs` writes to a stale path (`canvas-plugins/…`) — regeneration is broken |
| `apps/proxy` | AI brain: aikit MCP (15 tools incl. undocumented `camunda_search`/`camunda_execute` code-mode), editor MCP, multi-backend adapters, system prompts, 10 built-in runtime workers | Right for Studio; wrong as the skill backend (nested LLM). `prompt.ts` best-practice content should be extracted into skill references |
| `apps/cli` (`casen`) | `lint` (+ `--fix`), `test` (WASM scenarios from `.bpmn.tests.json`), `reebe start`, `worker start`, ~180 generated C8 REST commands, `skills install` | Good deterministic surface for skills (Claude Code is Bash-native). Missing: `connector` search/apply, `synth`/plan compile, an `agent` scaffold, and a first-class `deploy` alias |
| `plugins-cli/casen-worker-ai` | Runtime AI job workers (`com.bpmnkit.ai.classify/summarize/extract/decide`) with BPMN error codes | Ready-made palette for "AI inside the process" — should be first-class citizens in generation knowledge |

---

## 4. Camunda agentic-AI landscape (researched, verified against bundled templates)

Facts the spec hard-codes were verified in two independent ways: web research against docs.camunda.io / camunda/connectors, and **byte-level greps of the bundled templates in this repo** (`packages/plugins/src/config-panel-bpmn/templates/generated.ts`).

- **Timeline:** AI Agent connector alpha in 8.7/8.8-alphas → **GA in 8.8 (Oct 2025)** → 8.9 (Apr 2026) added ad-hoc sub-process migration, runtime modification inside multi-instance ad-hoc sub-processes, a built-in cluster MCP server, and A2A client connectors. The repo builder already defaults `executionPlatformVersion` to `8.9.0`.
- **Two modeling approaches:**
  1. **AI Agent Sub-process connector** (recommended): the ad-hoc sub-process *itself* carries `zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1"`; the engine/connector run the tool loop internally. Template `io.camunda.connectors.agenticai.aiagent.jobworker.v1` — **bundled in this repo.**
  2. **AI Agent Task connector** (`io.camunda.agenticai:aiagent:1` on a service task) paired with a separate ad-hoc sub-process toolbox referenced via `data.tools.containerElementId`, feedback loop modeled explicitly.
- **There is no `zeebe:adHocImplementation` attribute.** Job-worker vs BPMN-native implementation of an ad-hoc sub-process is determined solely by the presence of a `zeebe:taskDefinition` on the `adHocSubProcess`. The repo's `ZeebeExtensions.adHoc` + `AdHocSubProcessOptions.taskDefinition` already model this correctly.
- **Tools = root-node activities** inside the ad-hoc sub-process (no incoming sequence flows, not boundary events). Tool **name = element ID**, **description = element documentation** (fallback: element name), **input schema = derived from `fromAi()` calls** in the activity's input mappings.
- **`fromAi(value, description?, type?, schema?, options?)`** — `value` must reference `toolCall.<param>`; the function is a runtime no-op carrying schema metadata. Tool results map to `toolCallResult`; the sub-process aggregates via `zeebe:adHoc outputCollection="toolCallResults"` / `outputElement="={id: toolCall._meta.id, name: toolCall._meta.name, content: toolCallResult}"`.
- **Verified template binding keys (local):** `provider.type`, `provider.anthropic.model.model` (+ maxTokens/temperature/topP/topK), equivalents for bedrock/azureOpenAi/googleVertexAi/openai/openaiCompatible, `data.systemPrompt.prompt`, `data.userPrompt.prompt`, `data.memory.storage.type`, `data.limits.maxModelCalls`, `outputCollection`, `outputElement`, and the connectors' `retries`/error/response groups.
- **Verified connector type strings (local):** `io.camunda:slack:1`, `io.camunda:sendgrid:1`, `io.camunda:http-json:1`, `io.camunda:email:1`, `io.camunda:connector-kafka:1`, `io.camunda:aws-lambda:1`, … plus `io.camunda.agenticai:aiagent-job-worker:1`, `io.camunda.agenticai:aiagent:1`, `io.camunda.agenticai:adhoctoolsschema:1`, `io.camunda.agenticai:mcpclient:0`, `io.camunda.agenticai:mcpremoteclient:0`, `io.camunda.agenticai:a2aclient:0`.
- **Camunda's own copilot findings** name the recurring LLM failure modes: invalid DI, broken FEEL, wrong connector properties — precisely the three things the deterministic pipeline below eliminates by construction.

---

## 5. Gap analysis — why "just works in ≤1 iteration" fails today

Each gap cites evidence; G-numbers are referenced by the spec's work packages.

- **G1 — Lossy AI-facing IR.** `CompactElement` cannot express io-mappings, `zeebe:properties`, documentation, assignments, correlation, completion conditions, connector template refs, or `fromAi()` tool params (packages/core/src/bpmn/compact.ts:21-77). Consequence: connector-flavored or agentic processes are impossible to generate through the current path regardless of model quality.
- **G2 — Connector application unreachable & incomplete.** `templateToServiceTaskOptions()` (packages/plugins/src/config-panel-bpmn/template-to-service-task.ts) resolves `zeebe:property` keys (line 19) but `applyBinding()` never routes them (lines 30-38) → any template relying on `zeebe:property` (823 bindings) silently loses configuration. Outbound service tasks only — no inbound/webhook/message-start/boundary templates. Not exposed via CLI/MCP/skill. No required-field validation. And `scripts/update-connectors.mjs` `OUT_FILE` points at the pre-migration `canvas-plugins/` path, so catalog refresh is broken.
- **G3 — No deterministic AI-agent constructor.** Builder supports `adHocSubProcess` with `taskDefinition`/`ioMapping`/`outputCollection`/`outputElement`, but: no `bpmn:completionCondition` emission (only multi-instance `completionCondition` exists — bpmn-builder.ts:227), no helper that assembles provider bindings + prompts + memory + limits from the verified template, no `tool()` helper that generates `fromAi()` input mappings + `toolCallResult` output + documentation, no validation of the root-node rule.
- **G4 — FEEL validity is not enforced.** `@bpmnkit/feel.parseExpression` returns precise `ParseError[]`, but optimize/feel.ts only does heuristic complexity scoring; a syntactically broken condition, io-mapping, or `fromAi()` expression sails through lint and dies at deploy/runtime. Unknown-variable detection exists (variable-flow) but parse errors do not.
- **G5 — Lint ≠ deploy gate.** Zeebe-parity checks live only in Reebe's Rust validator (validator.rs: service task must have non-empty `taskDefinition` type, call activity needs `processId`, message start needs message name, …). The TS linter — the thing skills call — lacks all of them, so "lint green" does not mean "deploys".
- **G6 — Builder blind spots for executable processes.** No `zeebe:assignmentDefinition` / `taskSchedule` / `priorityDefinition` (user tasks), **no message `subscription`/`correlationKey`** (required for every message catch in Camunda 8 — an executable-process blocker), no transaction/conditional/link events, no pool/lane/message-flow creation.
- **G7 — Verification can't cover agentic constructs.** TS engine auto-completes `adHocSubProcess`/`callActivity`; the WASM path executes more but there is no scripted "mock agent" (deterministic tool-call sequence) to dry-run an agentic process; `bpmn_simulate` (the tool skills call) is structural-only while `/test` claims path coverage.
- **G8 — Nested-LLM generation architecture** (§2.1): second model, proxy daemon dependency, permission bypass, context loss, latency.
- **G9 — Skill drift & bugs:** `casen lint lint` (generate, ascii skills), `bpmn_deploy` argument mismatch, stale worker fallback template, duplicated skill sets with divergent instructions.
- **G10 — No connector/agentic knowledge for the model.** Nothing tells Claude which of the 116 templates exist, their type strings, required fields, or secret conventions (`{{secrets.SLACK_OAUTH_TOKEN}}`); nothing documents the agentic pattern. The model is expected to know Camunda connector schemas from training data — the exact "wrong connector props" failure mode.
- **G11 — Editing path loses data.** `bpmn_update` round-trips through the compact format, so editing an existing process that contains connector properties or agentic extensions would *strip them* (G1 applied to edits). `applyOperations` (surgical patch ops) exists but has no connector/agent-aware operations and no skill uses it as the primary edit path.
- **G12 — No outcome measurement.** There is no eval harness — no fixture prompts with expected outcomes, no "deploys-green on Reebe" metric — so skill quality changes are unmeasurable.

---

## 6. Target architecture

```
User intent (NL, possibly + existing .bpmn)
        │
        ▼  Claude (non-deterministic, high-value)
   ┌────────────────────────────────────────────┐
   │ /bpmnkit:implement | :extend | :agent      │
   │  1. clarify intent, decompose the process  │
   │  2. search connector catalog (casen        │
   │     connector search "slack")              │
   │  3. author ProcessPlan JSON (typed IR)     │
   │     incl. FEEL expressions, agent tools    │
   └────────────────────────────────────────────┘
        │ plan.json
        ▼  Deterministic (SDK/CLI — same result every time)
   ┌────────────────────────────────────────────┐
   │ casen synth plan.json -o process.bpmn      │
   │  • schema-validate plan (JSON Schema)      │
   │  • parse-validate every FEEL expression    │
   │  • apply connector templates (all binding  │
   │    kinds, required-field check, secrets)   │
   │  • assemble AI Agent sub-process + fromAi  │
   │  • builder → XML + auto-layout (DI)        │
   │  • lint --profile deploy (Zeebe parity)    │
   └────────────────────────────────────────────┘
        │ process.bpmn (+ scaffolded workers, forms, DMN)
        ▼  Verify loop (deterministic)
   casen test  (WASM scenario execution, mocked workers/agent)
   casen reebe start + deploy  (real engine, real validator)
        │ findings ─→ Claude patches the PLAN (not the XML), re-synth
        ▼
   deploy to Camunda 8 (profile) — /bpmnkit:deploy
```

The feedback loop is *plan-level*, not XML-level: when lint/test/deploy reports a finding, Claude edits the ProcessPlan (or the FEEL expression) and re-synthesizes. XML and DI are never touched by the model, so they can never be the thing that's broken. For **extending existing processes**, the same IR is used in reverse: a *lossless* `casen plan extract process.bpmn` lifts the full model (preserving unknown extensions verbatim) into plan form; Claude edits; `synth --merge` applies the delta via `applyOperations` so untouched elements are byte-stable.

### The Slack example, end to end

> "When an order fails validation, notify #ops on Slack."

1. Skill: `casen connector search slack` → `io.camunda.connectors.Slack.v1` (`io.camunda:slack:1`), required: `token` (secret), `method`, `data.channel`, `data.text`.
2. Claude writes into the plan: `{ kind: "connector", template: "io.camunda.connectors.Slack.v1", name: "Notify #ops of failed validation", values: { method: "chat.postMessage", "data.channel": "#ops", "data.text": "=\"Order \" + orderId + \" failed validation: \" + validationError", token: "{{secrets.SLACK_OAUTH_TOKEN}}" }, resultVariable: "slackResult" }`.
3. `casen synth` applies the template deterministically (task definition type, io-mappings, properties, error/retry groups), parse-validates the FEEL, lints (Slack task gets its error-boundary check), lays out DI.
4. `casen test` runs the scenario with the Slack job mocked; deploy to Reebe proves engine acceptance. One iteration.

---

## 7. Deterministic vs non-deterministic — the contract

**Principle:** the model decides *what*; the SDK decides *how it is written down*. Anything with a single correct output given the inputs is deterministic code. The model never authors XML, DI, IDs, or connector property keys.

| Concern | Owner | Mechanism |
|---|---|---|
| Intent extraction, clarifying questions, process decomposition | **Claude** | skill instructions |
| Pattern retrieval & adaptation | Claude, seeded deterministically | `findPattern`, pattern library |
| Connector *selection* (which template fits "send a Slack message") | **Claude** | `casen connector search` over the catalog + generated reference doc |
| Connector *application* (type string, bindings, io-mappings, properties, defaults) | **Deterministic** | `applyConnectorTemplate` (new, complete) |
| FEEL *authoring* (conditions, mappings, prompts) | **Claude** | plan fields |
| FEEL *validation* (syntax, undefined variables, typo suggestions) | **Deterministic** | `parseExpression` + variable-flow, as blocking lint rules |
| Agent design (system prompt, which tools, tool descriptions, limits) | **Claude** | plan `aiAgent` step |
| Agent assembly (template bindings, `zeebe:adHoc`, `fromAi()` mappings, `toolCallResult`, completion condition) | **Deterministic** | `aiAgentSubProcess()` builder API |
| Element naming per Camunda conventions | Claude, checked deterministically | naming lint rules |
| IDs, XML, BPMN DI/layout, namespaces, platform attributes | **Deterministic** | builder + auto-layout (already exists) |
| Structural correctness (gateways, joins, boundaries, defaults) | **Deterministic** | builder fix-ups + optimize `applyFix` |
| Worker scaffolding | **Deterministic** | `worker_scaffold` (exists) |
| Test *scenario derivation* (which paths/mocks matter) | **Claude** | plan/tests authoring |
| Test *execution* & assertion | **Deterministic** | `casen test` (WASM Reebe) |
| Deploy-readiness gate | **Deterministic** | `casen lint --profile deploy` (Zeebe-parity rules) |
| Deployment & verification | **Deterministic** | Reebe / `@bpmnkit/api` |
| Incident diagnosis narrative | **Claude** | incidents skill (existing) |

Rule of thumb encoded in every skill: **if the model finds itself typing `zeebe:` or `bpmndi:` or inventing a connector property key, the pipeline is being used wrong.**

---

## 8. Proposed skill set (consolidated, single plugin)

One plugin (`plugins-claude/bpmnkit-claude`), CLI-first (Bash + files — no proxy daemon, no nested LLM; the aikit MCP remains for non-Claude-Code hosts and Studio):

| Skill | Purpose |
|---|---|
| `/bpmnkit:implement` | NL → plan → synth → lint → test → (ask) deploy. The flagship; handles long/complex processes by decomposing into sub-processes/call activities per plan schema |
| `/bpmnkit:extend` | Modify an existing `.bpmn`: `plan extract` → targeted plan delta → `synth --merge` (lossless for untouched elements) |
| `/bpmnkit:agent` | Add/modify an AI Agent sub-process: provider, prompts, memory, limits + tools (connectors, workers, user tasks) with `fromAi()` params — on top of the same plan/synth path |
| `/bpmnkit:connect` | Map a step to a connector: search catalog, gather required values (secrets by convention), apply |
| `/bpmnkit:review` | `casen lint --profile deploy` + variable-flow; findings grouped, auto-fixes offered |
| `/bpmnkit:test` | Derive scenarios from plan/structure → `.bpmn.tests.json` → `casen test` (real WASM execution — honest coverage) |
| `/bpmnkit:deploy` | Lint-gate → Reebe or Camunda 8 profile → verify instance startable |
| `/bpmnkit:instances`, `/bpmnkit:incidents` | Keep as-is (operate on live clusters; already CLI-based) |

Shared, **generated** reference docs shipped with the plugin (regenerated from the template catalog so they can't drift): `references/connectors.md` (type strings, required fields, secret conventions for all 116 templates), `references/agentic.md` (patterns, `fromAi`, verified binding keys), `references/feel.md` (syntax + builtins from `@bpmnkit/feel`), `references/plan-format.md` (ProcessPlan schema with examples).

---

## 9. Risks & open questions

1. **Template currency.** The bundled catalog has no freshness metadata and its regeneration script is broken (G2). The spec adds metadata + fixes the script; pinning agentic template versions (`.v1` GA vs `.v0` preview) matters as Camunda iterates fast here.
2. **Reebe fidelity for agentic elements.** The AI Agent connector is a *connector runtime* feature, not an engine feature. Local verification can validate structure + mock the agent job, but the real tool loop only runs against a cluster with the connector runtime. The spec scopes local agent verification to schema/structure + scripted tool-sequence mocks, and treats a staging C8 deploy as the final gate.
3. **Plan schema scope creep.** The IR must cover the 95 % case without becoming a second BPMN. Mitigation: plan supports an `escape` step carrying raw builder options; anything unrepresentable falls back to `applyOperations` on the full model.
4. **Two FEEL/engine implementations (TS vs Rust)** can drift; parse-validation uses TS while runtime is Rust/Zeebe. Acceptable (syntax is stable), but conformance fixtures shared by both are cheap insurance and included in the spec's eval harness.
5. **Camunda 7 flavor** is out of scope — the entire stack (profiles, api, reebe) is Camunda 8-only, and that focus is correct.

---

## 10. Plan overview

Detailed work packages, file-level changes, APIs, and acceptance criteria are in [`doc/spec-bpmn-generation-skills.md`](spec-bpmn-generation-skills.md). Sequence:

- **WP0** — Bug fixes & hygiene (broken regen path, `lint lint`, deploy schema drift, template freshness metadata)
- **WP1** — `@bpmnkit/connectors`: catalog + complete deterministic template application + search + generated reference docs
- **WP2** — Core builder: AI Agent sub-process constructor, `fromAi` helpers, completion condition, user-task assignment, message correlation
- **WP3** — ProcessPlan IR + compiler (`casen synth`, `casen plan extract`, lossless merge)
- **WP4** — Deploy-grade validation (FEEL parse errors, Zeebe-parity rules, connector & agentic rules)
- **WP5** — Verification: WASM scenario coverage for containers, scripted agent mocks, honest `bpmn_simulate`
- **WP6** — Skills v2 (consolidated plugin, CLI-first, generated references)
- **WP7** — Golden-prompt eval harness (deploys-green rate, zero-error lint, scenario pass, iteration count)
- **WP8** — Documentation & roadmap updates

Everything in WP1–WP5 is deterministic machinery; WP6 is the thin orchestration layer; WP7 makes quality measurable. That ordering is deliberate: skills are only as reliable as the deterministic floor beneath them.
