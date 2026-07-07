# Spec: Deterministic BPMN Generation Pipeline & Claude Code Skills v2

**Status:** Ready for implementation (handoff)
**Date:** 2026-07-07
**Background & rationale:** [`doc/ai-bpmn-generation-analysis.md`](ai-bpmn-generation-analysis.md) — gap IDs (G1–G12) referenced below are defined there.
**Goal:** From a natural-language request in Claude Code, produce Camunda-8-flavored, *executable* BPMN — with correctly configured connectors (e.g. Slack outbound), AI agentic sub-processes, valid FEEL, and valid DI — in **at most one revision iteration**. Everything mechanical is deterministic; the model only does semantic work.

---

## 0. Ground rules for the implementer

- Follow `CLAUDE.md`: TypeScript strict, Biome clean, Vitest, devDependencies in root `package.json`, new published packages must complete the "Adding a New Package" checklist (readme/license scripts, `check-packages.mjs` exit 0).
- **Never let an LLM-facing surface accept or emit raw BPMN XML for authoring.** All authoring goes through typed structures (ProcessPlan, builder options); XML/DI is compiler output.
- Work package order matters: WP0 → WP1 → WP2 → WP3 → WP4 → WP5 → WP6 → WP7 → WP8. WP1/WP2 can proceed in parallel; WP3 depends on both; WP6 depends on WP3–WP5.
- Each WP lists acceptance criteria (AC). A WP is done when its ACs pass plus `pnpm turbo build typecheck check test` is green.
- Update `doc/progress.md` per change and check off `doc/roadmap.md` items you add (WP8 adds the roadmap section).

### Verified constants (byte-checked against `packages/plugins/src/config-panel-bpmn/templates/generated.ts` — do not re-derive from memory)

Connector task-definition types (selection):

```
io.camunda:slack:1            io.camunda:sendgrid:1        io.camunda:http-json:1
io.camunda:email:1            io.camunda:connector-kafka:1 io.camunda:connector-rabbitmq:1
io.camunda:aws-lambda:1       io.camunda:aws-sqs:1         io.camunda:aws-sns:1
io.camunda:google-sheets:1    io.camunda:connector-jdbc:1  io.camunda:soap:1
io.camunda.agenticai:aiagent-job-worker:1     (AI Agent Sub-process, template id io.camunda.connectors.agenticai.aiagent.jobworker.v1)
io.camunda.agenticai:aiagent:1                (AI Agent Task,       template id io.camunda.connectors.agenticai.aiagent.v1)
io.camunda.agenticai:adhoctoolsschema:1       io.camunda.agenticai:mcpclient:0
io.camunda.agenticai:mcpremoteclient:0        io.camunda.agenticai:a2aclient:0
```

AI Agent (job-worker template) property binding keys (selection; all exist in the bundled template): `provider.type`; per provider: `provider.anthropic.model.model`, `provider.anthropic.model.parameters.{maxTokens,temperature,topP,topK}`, analogous keys for `bedrock`, `azureOpenAi`, `googleVertexAi`, `openai`, `openaiCompatible`; `data.systemPrompt.prompt`; `data.userPrompt.prompt`; `data.memory.storage.type`; `data.limits.maxModelCalls`; `outputCollection`; `outputElement`; `retries`.

Agentic facts (verified against docs.camunda.io + camunda/connectors, 2026-07):
- There is **no** `zeebe:adHocImplementation` attribute. Job-worker implementation = `zeebe:taskDefinition` present on the `adHocSubProcess`.
- Tools are **root-node activities** (no incoming sequence flows, not boundary events) inside the ad-hoc sub-process. Tool name = element **ID**; description = element **documentation** (fallback: name); input schema derived from **`fromAi()`** calls in the activity's input mappings.
- `fromAi(value, description?, type?, schema?, options?)` — `value` must reference `toolCall.<param>`. Tool result variable: `toolCallResult`. Canonical aggregation: `zeebe:adHoc outputCollection="toolCallResults"`, `outputElement="={id: toolCall._meta.id, name: toolCall._meta.name, content: toolCallResult}"`.
- Camunda user task = `zeebe:userTask` extension element (default since 8.6); prefer it over job-worker user tasks.

---

## WP0 — Bug fixes & hygiene (G2, G9)

Small, independent, do first.

1. **`scripts/update-connectors.mjs`**: fix `OUT_FILE` to `packages/plugins/src/config-panel-bpmn/templates/generated.ts`. Add a generated header with fetch timestamp + per-template `version` capture, and emit a sibling `catalog-meta.json` (`{ fetchedAt, count, source }`). Run it once and commit the refreshed catalog.
2. **Plugin skills**: fix `casen lint lint` → `casen lint` in `plugins-claude/bpmnkit-claude/skills/generate/SKILL.md` and `skills/ascii/SKILL.md` (superseded by WP6, but fix now so the current plugin works).
3. **`bpmn_deploy` schema drift**: align `plugins-claude/bpmnkit-claude/skills/deploy/SKILL.md` to the actual tool signature (`path`, `target: "local"|"camunda8"`) in `apps/proxy/src/aikit-mcp.ts`.
4. **Stale worker template** in `skills/worker/SKILL.md`: replace the inline fallback with the real `createWorkerClient(...).poll()` API from `@bpmnkit/worker-client`.
5. **`/test` over-promise**: until WP5 lands, reword plugin `test` skill to state structural analysis + worker coverage (what `bpmn_simulate` actually does).

**AC:** `node scripts/update-connectors.mjs` regenerates the catalog in place; `pnpm biome check .` green; a manual read of the four skill files shows no reference to nonexistent flags/args.

---

## WP1 — `@bpmnkit/connectors`: catalog + complete deterministic application (G2, G10)

New published package `packages/connectors` (complete the new-package checklist). It owns the OOTB template catalog and the apply logic, so **core stays UI-free and plugins stop being the gatekeeper**.

### 1.1 Move & re-export

- Move `templates/generated.ts` (and regeneration target) + `template-types.ts` from `packages/plugins/src/config-panel-bpmn/` into `packages/connectors/src/`. `packages/plugins` re-exports from `@bpmnkit/connectors` for backward compat (keep existing public names working).
- Update `scripts/update-connectors.mjs` accordingly.

### 1.2 Catalog API

```ts
export interface ConnectorSummary {
  id: string            // template id, e.g. "io.camunda.connectors.Slack.v1"
  name: string          // "Slack Outbound Connector"
  taskType?: string     // "io.camunda:slack:1" (absent for inbound)
  appliesTo: string[]   // bpmn element types
  direction: "outbound" | "inbound-start" | "inbound-intermediate" | "inbound-boundary"
  keywords: string[]    // derived from name/description/category
  requiredInputs: ConnectorInputSpec[]   // key, label, type, choices?, isSecret (FEEL "{{secrets.*}}" convention), default?
  optionalInputs: ConnectorInputSpec[]
}
export function listConnectors(): ConnectorSummary[]
export function searchConnectors(query: string): ConnectorSummary[]  // keyword scoring like patterns' findPattern
export function getTemplate(id: string): ElementTemplate | undefined
```

`requiredInputs` derivation: template properties with `constraints.notEmpty` (or equivalent) that are not `Hidden`, respecting `condition`al visibility for the *default* branch of dropdowns (document the simplification: conditional groups resolve against provided values at apply time).

### 1.3 Complete apply

```ts
export interface ApplyResult {
  serviceTask?: ServiceTaskOptions          // for outbound / bpmn:ServiceTask
  adHocSubProcess?: Partial<AdHocSubProcessOptions>  // for agentic templates
  startEvent?: Partial<StartEventOptions>   // inbound start (zeebe:properties)
  boundaryEvent?: Partial<BoundaryEventOptions>
  problems: ApplyProblem[]                  // missing required values, unknown keys, FEEL parse errors in values
}
export function applyConnectorTemplate(
  templateId: string,
  values: Record<string, string>,
): ApplyResult
```

Requirements:
- Handle **all** binding kinds: `zeebe:taskDefinition(:type)`, `zeebe:input`, `zeebe:output`, `zeebe:taskHeader`, **`zeebe:property`** (currently dropped — the 823-binding gap), and template `Hidden` fixed values. Respect dropdown `condition` chains (only apply bindings whose conditions are satisfied by the chosen values).
- Set `modelerTemplate` / `modelerTemplateVersion` / icon (already supported by `ServiceTaskOptions`).
- **Validate**: every `requiredInput` present (or defaulted); unknown value keys rejected; values that are FEEL (`=`-prefixed or `feel: required` properties) parse-validated via `@bpmnkit/feel` — problems returned, never thrown, so callers can render actionable messages.
- Inbound templates map to `zeebe:properties` on the event (core already supports `StartEventOptions.zeebeProperties`).
- Port the existing plugin function to delegate here (`templateToServiceTaskOptions` becomes a thin wrapper; keep its tests passing).

### 1.4 Generated reference doc for skills

`node scripts/generate-connector-reference.mjs` → writes `plugins-claude/bpmnkit-claude/references/connectors.md`: one section per template with template id, task type, direction, required/optional inputs (marking secrets with the `{{secrets.NAME}}` convention), and a 5-line usage example in ProcessPlan form (WP3). Keep it token-lean: a compact index table at top, details below. Regenerated by the same CI step as the catalog.

**AC:**
- Unit tests: applying `io.camunda.connectors.Slack.v1` with `{method: "chat.postMessage", "data.channel": "#ops", "data.text": "=\"hi\"", token: "{{secrets.SLACK_OAUTH_TOKEN}}"}` yields a `ServiceTaskOptions` whose serialized XML contains `zeebe:taskDefinition type="io.camunda:slack:1"` and the exact input mappings the real template defines; omitting `token` yields a `problems` entry naming `token`.
- A template using `zeebe:property` bindings round-trips them into `ServiceTaskOptions.zeebeProperties` (add the field if missing) and serialized XML.
- `searchConnectors("slack")[0].id === "io.camunda.connectors.Slack.v1"`; `searchConnectors("send email")` surfaces SendGrid/Email templates.
- Snapshot test: reference doc generation is deterministic.

---

## WP2 — Core builder: agentic constructor + executable-process gaps (G3, G6)

All in `packages/core`.

### 2.1 `bpmn:completionCondition` on ad-hoc sub-process

`AdHocSubProcessOptions.completionCondition?: string` and `cancelRemainingInstances?: boolean` → serialize as `<bpmn:completionCondition xsi:type="bpmn:tFormalExpression">` child and the `cancelRemainingInstances` attribute; parser round-trips both.

### 2.2 High-level AI Agent constructor

New `packages/core/src/bpmn/agentic.ts`:

```ts
export interface AiAgentToolSpec {
  id: string                       // tool name (element ID) — enforce [A-Za-z_][\w-]* and uniqueness
  description: string              // → element documentation
  kind: "connector" | "jobWorker" | "userTask" | "scriptTask"
  // connector: templateId + values (delegates to @bpmnkit/connectors via a caller-supplied resolver
  //            to avoid a core→connectors dependency; see note below)
  serviceTask?: ServiceTaskOptions // pre-resolved options (what the resolver returns)
  jobType?: string                 // for kind=jobWorker
  params: Array<{                  // → fromAi() input mappings
    name: string                   // toolCall.<name>
    description: string
    type?: "string" | "number" | "boolean" | "integer" | "array" | "object"
    required?: boolean
    schema?: object                // JSON schema for complex params, serialized into fromAi 4th arg
    target: string                 // input mapping target variable, or "<merge:EXPR>" to embed
                                   //   the fromAi() call inside a larger FEEL expression
  }>
  resultExpression?: string        // FEEL producing toolCallResult (default: "=result")
}

export interface AiAgentOptions {
  id: string
  name?: string
  provider: "anthropic" | "bedrock" | "azureOpenAi" | "googleVertexAi" | "openai" | "openaiCompatible"
  model: string                            // e.g. "claude-sonnet-5"
  systemPrompt: string
  userPrompt: string                       // usually a FEEL expr over process vars
  memory?: { storageType?: string }
  limits?: { maxModelCalls?: number }
  parameters?: { maxTokens?: number; temperature?: number; topP?: number; topK?: number }
  auth: Record<string, string>             // provider auth values, secrets convention
  outputVariable?: string                  // response mapping
  tools: AiAgentToolSpec[]
}
```

`ProcessBuilder.aiAgent(opts: AiAgentOptions)` (and on sub-process/branch builders) assembles, deterministically:
- an `adHocSubProcess` with `zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1"` (retries default 3),
- io-mappings/properties exactly as the bundled `agenticai.aiagent.jobworker.v1` template defines for the chosen provider (**resolve bindings from the template at build time — do not hard-code the mapping table**; accept the template JSON via the resolver so core has no data dependency),
- `zeebe:adHoc outputCollection="toolCallResults"` + canonical `outputElement` (overridable),
- one **root-node activity per tool** (no incoming/outgoing flows), with `documentation` = description, input mappings `target: params[i].target`, `source: "=fromAi(toolCall.<name>, \"<description>\", \"<type>\"...)"` (string-escape correctly; support the merge form), output mapping producing `toolCallResult`,
- optional `completionCondition`.

Note on layering: `aiAgent` takes pre-resolved `ServiceTaskOptions` for connector tools (callers use `@bpmnkit/connectors.applyConnectorTemplate` first). The `casen`/plan layer (WP3) wires the two; core stays dependency-clean.

Also add `aiAgentTask()` (service-task variant, `io.camunda.agenticai:aiagent:1`, `data.tools.containerElementId` pointing at a separately-built toolbox ad-hoc sub-process) — lower priority, but the type should exist.

### 2.3 Executable-process builder gaps

- `UserTaskOptions`: `assignee?`, `candidateGroups?`, `candidateUsers?` → `zeebe:assignmentDefinition`; `dueDate?`, `followUpDate?` → `zeebe:taskSchedule`; `priority?` → `zeebe:priorityDefinition`. Default user tasks to `zeebe:userTask` (Camunda user task) unless `jobWorker: true`.
- **Message correlation**: `messageName` options on receive tasks / message catch (intermediate, boundary, start-in-event-subprocess) gain `correlationKey?: string` → emit `<bpmn:message>` with `zeebe:subscription correlationKey="..."`. This is required for deployable message catches — add a WP4 lint rule to match.
- Parser round-trip for everything added.

**AC:** builder unit tests produce XML that (a) loads in `Bpmn.parse` round-trip clean, (b) passes `casen lint --profile deploy` (WP4), and (c) **deploys successfully to a local Reebe** (integration test, `apps/reebe` embedded mode) for: a process with an `aiAgent` containing 2 tools (one Slack connector tool, one jobWorker tool with 2 typed params), and a process with a correlated message boundary + assigned user task. Snapshot-test the agent XML against a hand-verified fixture mirroring Camunda's documented shape.

---

## WP3 — ProcessPlan IR + compiler (G1, G8, G11)

New module `packages/core/src/plan/` (exported from core; no new package) + CLI commands.

### 3.1 Plan types (the LLM-facing contract)

```ts
export interface ProcessPlan {
  version: 1
  process: { id: string; name?: string; versionTag?: string }
  inputs?: Array<{ name: string; type: string; required?: boolean; description?: string }> // → start-event documentation (+ optional validation DMN via existing input-validation.ts)
  steps: PlanStep[]              // ordered; control flow via explicit gateway/branch steps
  tests?: PlanScenario[]         // compiled to <file>.bpmn.tests.json
}

export type PlanStep =
  | { kind: "start"; id?: string; name?: string; timer?: {...}; message?: { name: string };
      connector?: { template: string; values: Record<string,string> } }        // inbound templates
  | { kind: "connector"; id?: string; name: string; template: string;
      values: Record<string,string>; resultVariable?: string; retries?: number;
      errorBoundary?: { errorCode?: string; then: PlanStep[] } }
  | { kind: "serviceTask"; id?: string; name: string; jobType: string;
      inputs?: Record<string,string>; outputs?: Record<string,string>; ... }
  | { kind: "userTask"; ...assignment/schedule/form fields... }
  | { kind: "businessRuleTask" | "scriptTask" | "sendTask" | "receiveTask" | "callActivity"; ... }
  | { kind: "aiAgent"; ...AiAgentOptions with tools as nested PlanSteps or connector refs... }
  | { kind: "gateway"; gatewayType: "exclusive"|"parallel"|"inclusive"|"eventBased"; name?: string;
      branches: Array<{ name?: string; condition?: string; default?: boolean; steps: PlanStep[];
                        joinsTo?: "next" | "end" | string }> }
  | { kind: "subProcess" | "eventSubProcess"; name: string; steps: PlanStep[]; multiInstance?: {...} }
  | { kind: "wait"; ...timer/message intermediate catch (message requires correlationKey)... }
  | { kind: "end"; name?: string; error?: { code: string }; terminate?: boolean }
  | { kind: "raw"; builder: ...escape hatch: typed builder options...  }
```

Design constraints: every string that is FEEL is documented as FEEL in the schema descriptions (the compiler validates); IDs are optional (compiler derives stable, readable IDs from names — `slugify`, dedupe with suffixes); `steps` order defines the happy path so the model never writes sequence-flow lists for the common case.

Export a **JSON Schema** (`processPlanJsonSchema()` — generate from the types with a small hand-maintained schema, or zod if already in-repo; do **not** add a heavy codegen dep) so plans are validated with precise error paths before compilation.

### 3.2 Compiler

```ts
export interface SynthResult { defs: BpmnDefinitions; xml: string; problems: PlanProblem[]; tests?: string }
export function compilePlan(plan: ProcessPlan, opts?: { templates?: TemplateResolver }): SynthResult
```

Pipeline: schema-validate → resolve connectors (`@bpmnkit/connectors.applyConnectorTemplate`; collect problems) → parse-validate every FEEL field (`@bpmnkit/feel`) → build via `ProcessBuilder`/`aiAgent` → `applyAutoLayout` → run `optimize()`; auto-apply safe fixes; remaining error-severity findings become problems. Deterministic: same plan in, same XML out (stable IDs, no timestamps/randomness).

### 3.3 Extract & merge (extending existing processes)

- `extractPlan(defs: BpmnDefinitions): { plan: ProcessPlan; residue: ResidueMap }` — lossless lift: anything the plan can't express (unknown extensions, manual DI edits, exotic elements) is kept in `residue` keyed by element ID and re-attached on synth. Elements untouched by a merge must be **byte-stable** in output XML.
- `mergePlan(existing: BpmnDefinitions, delta: ProcessPlan)` — compiles the delta and applies it via `applyOperations` semantics rather than full regeneration; auto-layout only for new/moved elements (use existing layout for untouched ones).

### 3.4 CLI

- `casen synth <plan.json> [-o out.bpmn] [--merge existing.bpmn] [--json]` — exits non-zero on problems, printing them with JSON paths into the plan (so the model can self-correct in one step).
- `casen plan extract <file.bpmn> [-o plan.json]`
- `casen plan schema` — prints the JSON Schema (skills reference it).
- `casen connector search <query> [--json]`, `casen connector show <templateId>` (from WP1).

**AC:**
- Golden fixtures under `packages/core/tests/plan/`: ≥6 plans (Slack notification flow; order process with XOR + error boundary + user task w/ assignment; agentic triage with 3 tools; message-correlated wait; multi-instance subprocess; extend-merge case) each snapshot-tested (plan → XML) and **deployed to embedded Reebe in an integration test**.
- Compiling a plan with a broken FEEL condition fails with a problem pointing at `steps[2].branches[0].condition` and the parser's message/position.
- `plan extract` → `synth --merge` with an empty delta reproduces the input XML byte-for-byte (modulo XML header normalization — document any).

---

## WP4 — Deploy-grade validation (G4, G5; agentic rules from G3)

Extend `packages/core/src/bpmn/optimize/`:

1. **New analyzer `feel-syntax.ts`** (category `feel`, severity `error`): run `parseExpression`/`parseUnaryTests` over every FEEL surface — sequence-flow conditions, io-mapping sources, `completionCondition`, `zeebe:adHoc` expressions, script expressions, called-decision/element bindings, timer expressions (`=`-prefixed), `fromAi(...)` containing mappings. Findings carry the parse error message + position.
2. **New rules in a `deploy.ts` analyzer** (Zeebe/Reebe parity — mirror `apps/reebe/crates/reebe-bpmn/src/validator.rs`):
   - `deploy/service-task-no-type` (error): service/send/business-rule task without `taskDefinition` type *or* `calledDecision`. Skip tasks carrying a `modelerTemplate` whose template defines the type via hidden binding — resolve before flagging.
   - `deploy/call-activity-no-process` (error), `deploy/message-start-no-name` (error), `deploy/message-catch-no-correlation` (error — message intermediate/boundary/receive without `zeebe:subscription` correlationKey), `deploy/process-not-executable` (error).
3. **New analyzer `agentic.ts`**:
   - `agentic/tool-not-root` (error): activity inside an agent ad-hoc sub-process with incoming flows (unless it's clearly non-tool wiring — document heuristic).
   - `agentic/tool-no-description` (warning): tool activity without documentation.
   - `agentic/fromai-bad-ref` (error): `fromAi` first arg not referencing `toolCall.*`.
   - `agentic/no-output-collection` (warning), `agentic/limits-missing` (info: no `maxModelCalls`).
4. **Connector rule** `connector/missing-required` (error): element with `modelerTemplate` where a required template input has no binding value (uses `@bpmnkit/connectors`; wire via an injected resolver to keep core decoupled — `optimize(defs, { templates })`).
5. **Lint profiles**: `casen lint --profile deploy` = errors from `deploy/*`, `feel-syntax/*`, `connector/*`, `agentic/*` + existing error-severity rules; this is the gate skills and `synth` use. Default profile unchanged (back-compat).

**AC:** fixture BPMN files exercising each new rule (positive + negative); `casen lint --profile deploy` exits 1 on each violation with the element ID; a file that passes the profile deploys to embedded Reebe without validation errors (integration test proving parity); no false positives across `bpmn-samples/` and all pattern templates.

---

## WP5 — Verification: honest simulation (G7)

1. **WASM scenario coverage**: ensure `runScenarioWasm` executes `callActivity` (deploy child fixtures alongside), event sub-processes, and BPMN-native ad-hoc sub-processes. Document (and test) current Reebe behavior for an ad-hoc sub-process with a `taskDefinition` (job-worker implementation): it should surface as an activatable job.
2. **Scripted agent mock**: extend `ProcessScenario` with `agentMocks?: Record<string /*agent element id*/, { toolCalls: Array<{ tool: string; params: Record<string, unknown>; result: unknown }>; finalResponse?: unknown }>`. The scenario runner registers a job worker for `io.camunda.agenticai:aiagent-job-worker:1` (and `:hybrid1`) that replays the scripted sequence — activating the specified tool elements with `toolCall` variables and asserting each tool's `toolCallResult` — then completes the agent job with `finalResponse`. This dry-runs agentic processes deterministically without any LLM. If engine-level ad-hoc activation proves infeasible in WASM, fall back to *structural* tool verification (schema derivation from `fromAi` + tool reachability) and say so in the report — no silent downgrade.
3. **Make `bpmn_simulate` honest**: rename semantics — the MCP tool runs real scenarios via the WASM runner when scenarios are provided, structural analysis otherwise, and its response includes `mode: "execution" | "structural"`.
4. `casen test` accepts plan-embedded tests (`ProcessPlan.tests` compiled to `.bpmn.tests.json` by `synth`).

**AC:** an agentic golden fixture (WP3) runs under `casen test` with an agent mock: asserts the Slack tool received `toolCall.channel === "#ops"` and the process completes with the mocked final response; a broken tool io-mapping makes the scenario fail with a pointed diff.

---

## WP6 — Skills v2 (G8, G9, G10)

Rebuild `plugins-claude/bpmnkit-claude` as the single skill surface. Retire root `.claude/commands/*` duplicates (keep `casen skills install` installing the new set). **CLI-first**: skills use Bash (`casen …`) + Read/Write; no proxy daemon, no nested LLM, no MCP requirement in Claude Code. Keep the aikit MCP server for Studio/other hosts; its `bpmn_create` may later delegate to plan+synth, out of scope here.

Plugin layout:

```
plugins-claude/bpmnkit-claude/
  .claude-plugin/plugin.json         (drop mcpServers requirement; keep userConfig for camunda profile)
  hooks/hooks.json                   (keep PostToolUse lint-on-write of *.bpmn; drop proxy autostart)
  references/connectors.md           (GENERATED — WP1)
  references/agentic.md              (hand-written from §0 facts + 2 full plan examples)
  references/feel.md                 (GENERATED from @bpmnkit/feel builtins + syntax crib)
  references/plan-format.md          (GENERATED from JSON Schema + annotated examples)
  references/modeling-style.md       (extracted from apps/proxy/src/prompt.ts best-practices block)
  skills/implement/SKILL.md
  skills/extend/SKILL.md
  skills/agent/SKILL.md
  skills/connect/SKILL.md
  skills/review/SKILL.md
  skills/test/SKILL.md
  skills/deploy/SKILL.md
  skills/instances/SKILL.md          (keep, CLI-based)
  skills/incidents/SKILL.md          (keep, CLI-based)
  agents/process-builder.md          (updated to plan/synth flow)
  agents/incident-resolver.md        (keep)
```

Skill flows (each SKILL.md must instruct: read the relevant `references/*` file(s) first; never hand-write XML; on failure, fix the *plan*, re-synth):

- **`/bpmnkit:implement <description>`** — 1) clarify only genuinely ambiguous requirements (batch questions); 2) `casen connector search` for each external interaction; check `@bpmnkit/patterns` via `casen` pattern commands if a domain matches; 3) write `plan.json` (per `references/plan-format.md`, naming per `references/modeling-style.md`); 4) `casen synth plan.json -o <name>.bpmn` — if problems, fix plan, retry (bounded: 2 attempts, then surface); 5) `casen test <name>.bpmn` with plan-derived scenarios; 6) scaffold missing workers for bare `jobType` steps (`casen worker` scaffold path); 7) render summary (elements, connectors used + secrets needed, worker coverage, test results); 8) ask: deploy to local Reebe / Camunda 8 / skip.
- **`/bpmnkit:extend <file> <change request>`** — `casen plan extract` → targeted delta plan → `synth --merge` → lint/test → summary of the diff (element-level, not XML).
- **`/bpmnkit:agent <file?> <description>`** — design the agent: provider/model (default per user config), system prompt, tools (each mapped via connector search or existing worker job types, params with descriptions/types), limits; emit an `aiAgent` plan step; synth/merge; run agent-mock scenario; summarize the tool schema the LLM will see (from element docs + `fromAi`).
- **`/bpmnkit:connect <file> <step> <service>`** — search catalog → show required inputs incl. secrets → gather values → apply via delta plan → synth --merge.
- **`/bpmnkit:review [file]`** — `casen lint --profile deploy --json` + default profile; group errors/warnings/info; offer `--fix` for auto-fixable; explicit "deploy-ready: yes/no".
- **`/bpmnkit:test [file]`** — derive scenarios covering every gateway branch + error boundary (write `.bpmn.tests.json`), run `casen test`, report real pass/fail + which paths remain uncovered.
- **`/bpmnkit:deploy [file] [--local|--camunda]`** — `casen lint --profile deploy` gate → deploy (Reebe via local profile; C8 via active profile) → verify by starting a throwaway instance where safe → report version/key; remind about `casen worker start` and required secrets.

**AC:** fresh Claude Code session with only the plugin installed: (1) "implement: when an order fails validation, notify #ops on slack" produces a `.bpmn` that passes `lint --profile deploy`, contains `io.camunda:slack:1` with channel/text/token bindings, and deploys to local Reebe — with **zero user corrections**; (2) "/bpmnkit:agent add a support-triage agent with tools: search KB (http), escalate to human (user task), post summary to slack" produces a valid agent sub-process passing the agentic lint rules; (3) `/bpmnkit:extend` on `bpmn-samples/order-process.bpmn` adding a timer boundary changes only the expected elements (XML diff limited to them).

---

## WP7 — Golden-prompt eval harness (G12)

`scripts/eval-generation/` (dev-only, not published):

- `prompts/*.md` — ≥15 golden prompts with expected-outcome assertions (JSON sidecar): the Slack case; multi-branch approval; agentic triage; extend-existing; message-correlated integration; multi-instance; error-compensation; long process (25+ elements); ambiguous prompt (expects a clarifying question, not a guess).
- `run-eval.mjs` — for each prompt: invoke `claude -p` headless with the plugin loaded (skip gracefully when `claude` unavailable; CI can run plan-level subset: hand-authored plans → synth → gates), then measure: **synth problems = 0**, `lint --profile deploy` = 0 errors, `casen test` pass rate, **deploys-green on embedded Reebe**, iteration count (number of synth attempts), wall time, token cost if available.
- Report `eval-report.json` + markdown summary. Baseline before WP6 merge, track after.

**AC:** harness runs the plan-level subset in CI (`pnpm turbo test` unaffected; separate script); full LLM run documented in the script header. Deploys-green rate on the plan-level subset = 100 %.

---

## WP8 — Documentation & roadmap

- `doc/roadmap.md`: add "AIKit v2 — Deterministic Generation Pipeline" section with WP0–WP7 as checkable items; check off as completed.
- `doc/features.md`, `doc/progress.md` entries per WP.
- `apps/docs`: update `guides/ai-implement.md` for the plan/synth flow; new `guides/ai-agents.md` (agentic generation); update `cli/skills.md`; document `casen synth|plan|connector`.
- `packages/connectors` README via `scripts/generate-readmes.mjs` (per CLAUDE.md).

---

## Out of scope (explicitly)

- Camunda 7 support; pools/lanes/collaboration *generation* (layout already works; builder API is a separate effort); BPMN Copilot-style in-Modeler UX; changing Studio's proxy-based AI drawer; A2A/MCP-client tool *runtime* wiring beyond template application; automatic secret provisioning.

## Definition of done (whole spec)

1. `pnpm turbo build typecheck check test` green; Biome zero warnings.
2. WP6 AC scenarios pass end-to-end on a machine with only `casen` + the plugin (no proxy running).
3. Eval harness plan-level subset: 100 % deploys-green, 0 lint errors, ≤1 synth retry per prompt.
4. No skill instructs the model to write BPMN XML, BPMN DI, element IDs, or connector property keys by hand — grep the plugin for `bpmndi`/`<bpmn:` to verify.
