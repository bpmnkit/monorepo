# Features

## Cascivo design system — studio (2026-06-20)

Migrating the studio console to the [cascivo](https://cascivo.com) design system
(`@cascivo/react`), replacing the Radix + Tailwind UI layer. Stage 0 foundation
landed: dependencies, a cascivo↔`@bpmnkit/ui` brand-token bridge
(`apps/studio/src/styles/cascivo.css`), and a staged migration plan
(`doc/cascivo-migration.md`). Scope: studio, `@bpmnkit/operate`, desktop.

## BPMN Builder SDK improvements (2026-06-13)

Nine incremental improvements to `@bpmnkit/core`'s `bpmn-builder.ts` API:

| # | Feature | Entry point |
|---|---|---|
| 1 | Element factory functions extracted (refactor + `userTask` `formId` fix) | internal |
| 2 | Gateway/branch support in `SubProcessContentBuilder` | `SubProcessContentBuilder.exclusiveGateway()`, `.branch()`, etc. |
| 3 | Build-time validation + strict mode | `Bpmn.createProcess(..., { strict: true })` |
| 4 | Ergonomic boundary event attachment | `ProcessBuilder.withBoundary(config, cb)` |
| 5 | Service task type default + `disconnectedStartEvent()` alias | `ProcessBuilder.disconnectedStartEvent()` |
| 6 | Multi-process diagram builder | `Bpmn.createDiagram(id).process(...).build()` |
| 7 | `EXPORTER_VERSION` constant (replaces hardcoded `"0.0.1"`) | internal constant in `bpmn-builder.ts` |
| 8 | **`executionPlatformVersion` setter** (2026-06-26) | `ProcessBuilder.executionPlatformVersion("8.x.0")`, `DiagramBuilder.executionPlatformVersion("8.x.0")` |
| 9 | **Fluent text annotations + DI** (2026-06-26) | `.textAnnotation(text)`, `.annotate(elementId, text)` on `ProcessBuilder`, `BranchBuilder`, `SubProcessContentBuilder`; annotation shapes/edges in `withAutoLayout()` |
| 10 | **Abstract `.task()` method** (2026-06-28) | `ProcessBuilder.task()` / `BranchBuilder.task()` / `SubProcessContentBuilder.task()` — emits abstract `<bpmn:task>` with no Zeebe extensions, for documentation-grade diagrams. |

## CLI — `casen generate` and `casen view` (2026-04-25)

### `casen generate bpmn` — Generate BPMN files from parameters or JSON

Two input modes:

**Template mode** — predefined patterns:
```sh
casen generate bpmn --template minimal --process-id order --name "Order Processing"
casen generate bpmn --template approval --process-id leave-request
casen generate bpmn --template parallel --process-id enrichment
casen generate bpmn --template error-boundary --process-id resilient-job
casen generate bpmn --template event-subprocess --process-id with-error-handler
casen generate bpmn --template timer-start --process-id nightly-sync
casen generate bpmn --template message-start --process-id message-driven
```

**Definition mode** — full control via CompactDiagram JSON (AI path):
```sh
# Pass JSON inline
casen generate bpmn --definition '{"id":"Defs","processes":[...]}'

# Pipe from AI output or file
echo '{"id":"Defs","processes":[...]}' | casen generate bpmn --output my-process.bpmn

# Print the full JSON schema reference
casen generate bpmn --help-schema
```

**Templates** (auto-layout applied to all):

| Template | Pattern |
|---|---|
| `empty` | Start event only |
| `minimal` | Start → service task → end |
| `user-task` | Start → user task → end |
| `call-activity` | Start → call activity → end |
| `business-rule` | Start → business rule task → end |
| `approval` | Start → user task → XOR gateway → approve/reject paths |
| `parallel` | Start → parallel fork → 2 tasks → join → end |
| `inclusive` | Start → inclusive gateway → 2 conditional tasks → merge → end |
| `timer-start` | Timer start event → service task → end |
| `message-start` | Message start event → service task → end |
| `error-boundary` | Service task with error boundary → two end events |
| `subprocess` | Start → sub-process (with inner flow) → end |
| `event-subprocess` | Process with non-interrupting error event sub-process |

**All flags:**

| Flag | Short | Description | Default |
|---|---|---|---|
| `--process-id` | `-i` | Process ID (template mode) | `process` |
| `--name` | `-n` | Process display name (template mode) | — |
| `--output` | `-o` | Output path (`-` for stdout) | `<process-id>.bpmn` |
| `--template` | | Template name | `minimal` |
| `--definition` | `-d` | CompactDiagram JSON string | — |
| `--help-schema` | | Print JSON schema reference and exit | — |
| `--input` | `-f` | Existing .bpmn file to modify | — |
| `--patch` | | Patch JSON `{elements:[...],flows:[...]}` to add to `--input` | — |
| `--dump-compact` | | Print compact JSON of `--input` for AI inspection | — |

**Modifying existing files** (`--input` mode):

```sh
# Step 1 — inspect existing file as compact JSON (AI reads this to learn element IDs)
casen generate bpmn --input order.bpmn --dump-compact

# Step 2 — add a new path to an existing gateway
casen generate bpmn --input order.bpmn \
  --patch '{"elements":[{"id":"notify","type":"serviceTask","name":"Notify","jobType":"notify-worker"},{"id":"end-notify","type":"endEvent","name":"Notified"}],"flows":[{"id":"fn1","from":"gw","to":"notify","condition":"= urgent"},{"id":"fn2","from":"notify","to":"end-notify"}]}'

# Or pipe the patch from AI
echo '{...}' | casen generate bpmn --input order.bpmn

# Re-apply auto-layout without changes (normalize positions)
casen generate bpmn --input messy.bpmn --output clean.bpmn
```

Patch mode targets the first process in the file. The patch JSON is `{elements:[...], flows:[...]}` where flows can reference existing element IDs already in the file.

**CompactDiagram JSON schema** (shown by `--help-schema`):

The `--definition` flag and stdin accept a `CompactDiagram` JSON object — the same compact format used internally by the AI improvement tools. It supports all 23 BPMN element types, all event definition types, boundary events, sub-processes, and Zeebe extensions (job type, task headers, form references, decision references).

---

### `casen view` — View BPMN, DMN, and Form files in the browser

Spawns a local HTTP server (default port 3044) and opens the system browser. All renderers work server-side — no dependencies required in the browser.

**Subcommands:**

| Command | Input | Rendering |
|---|---|---|
| `casen view open <paths>` | Any mix of .bpmn/.dmn/.form files or folders | Auto-detects by extension |
| `casen view bpmn <paths>` | .bpmn files or folders | SVG (via `exportSvg`) |
| `casen view dmn <paths>` | .dmn files or folders | ASCII table (monospace) |
| `casen view form <paths>` | .form files or folders | ASCII layout (monospace) |

**Folder support:** Pass a directory path — all matching files are scanned and each gets its own tab.

```sh
# View a single BPMN file
casen view bpmn process.bpmn

# View all .bpmn files in a folder
casen view bpmn ./processes/

# View multiple specific files with tabs
casen view bpmn order.bpmn payment.bpmn

# View a DMN decision table
casen view dmn eligibility.dmn

# View all DMN files in a folder
casen view dmn ./decisions/

# View a Camunda form
casen view form approval.form

# View any mix of types (auto-detect)
casen view open ./project/

# Mixed explicit files
casen view open order.bpmn routing.dmn review.form

# Dark theme, custom port, no auto-open
casen view bpmn process.bpmn --theme dark --port 8080 --no-open
```

**Flags (all subcommands):**

| Flag | Description | Default |
|---|---|---|
| `--port` | Local server port | `3044` |
| `--theme` | `light` or `dark` | `light` |
| `--no-open` | Do not open browser automatically | false |

Press `Ctrl+C` in the terminal to stop the server.

---

## Claude Code Plugin — `/plugin install bpmnkit` (2026-04-17)

A Claude Code plugin that makes Claude AI-first for BPMN workflows. Install once, works automatically.

**Prerequisite:** `npm install -g @bpmnkit/cli`

**Install:** `/plugin install bpmnkit` (or `claude --plugin-dir plugins-claude/bpmnkit-claude` locally)

### Skills (slash commands)

| Skill | What it does |
|---|---|
| `/bpmnkit:generate <description>` | Natural language → BPMN file + ASCII preview |
| `/bpmnkit:review [file]` | Static analysis: pattern checks, variable flow, findings by severity |
| `/bpmnkit:deploy [file] [--local\|--camunda]` | Deploy to local reebe or Camunda 8 |
| `/bpmnkit:worker <job-type>` | Scaffold TypeScript worker using `@bpmnkit/worker-client` |
| `/bpmnkit:test [file]` | Run scenario tests, show path coverage |
| `/bpmnkit:instances [id] [--active\|--failed]` | List running process instances |
| `/bpmnkit:incidents [--process-id X]` | List open incidents with suggested actions |
| `/bpmnkit:ascii <file>` | Render BPMN/DMN/Form as Unicode ASCII art |

### Agents

| Agent | What it does |
|---|---|
| `process-builder` | End-to-end: describe → generate → validate → scaffold workers → deploy |
| `incident-resolver` | Triage → root cause analysis → propose fix → execute → verify |

### Hooks

- **SessionStart** — checks `casen` is installed, auto-starts proxy in background
- **PostToolUse** — silently lints any `.bpmn` file written during the session

### MCP

Connects to the existing `aikit-mcp.js` server via `casen proxy mcp` (10 tools: `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`, `bpmn_run_history`, `worker_list`, `worker_scaffold`, `pattern_list`, `pattern_get`).

---

## AIKit MCP — `form_create` Tool (2026-04-21)

Generates a Camunda Form JSON file for a user task in a BPMN process. Called by the `/design` skill and available directly via the AIKit MCP server.

## AIKit MCP — `dmn_create` Tool (2026-04-21)

Generates a DMN decision table XML file for a business rule task in a BPMN process. Called by the `/design` skill and available directly via the AIKit MCP server.

## CLI Skill — `/design` (2026-04-21)

Design-only workflow skill for Claude Code. Given a process description, generates the BPMN flow diagram, Camunda Form JSON for every user task, and DMN decision tables for every business rule task. Does not scaffold workers or prompt for deployment.

Install with `casen skills install`.

## CLI — Start Proxy & Reebe from the CLI (2026-04-03)

The `casen` CLI is now the single entry point for starting local infrastructure:

| Command | What it does |
|---|---|
| `casen proxy` | Start the AI bridge + Camunda API proxy server (port 3033) |
| `casen proxy start --port 4000` | Start on a custom port |
| `casen reebe` | Start the Reebe workflow engine with embedded SQLite (port 8080) |
| `casen reebe start --database-url postgres://…` | Start with PostgreSQL |
| `casen reebe start --port 9090` | Start on a custom port |

Both commands appear in the pinned section of the main TUI and stream server output directly to the terminal.

## Local Automation Workflows — Phase 4: Multi-Instance & Flow UX (2026-04-02)

Sub-processes can now be configured as multi-instance loops directly from the config panel, with visual feedback on the canvas and variable scope visibility in the variable-flow overlay.

**Multi-instance config panel** (select any sub-process):
- "Process each item in a list" action button — one click to configure parallel for-each with `item` as the element variable
- Loop type dropdown (Parallel / Sequential), Collection (FEEL), and Element variable fields appear after setup
- Fields are hidden when no loop is configured, keeping the panel clean

**Canvas markers** — multi-instance sub-processes show standard BPMN bottom markers:
- Parallel: three vertical lines `|||` to the right of the expand `+` marker
- Sequential: three horizontal lines `≡` to the right of the expand `+` marker

**Variable flow overlay** — the iteration variable (e.g. `email`) is now shown in scope tooltips for sequence flows inside multi-instance sub-processes. Inner elements that produce additional variables also appear in scope.

**BPMN model** — `BpmnMultiInstanceLoopCharacteristics` now carries `isSequential?: boolean`, parsed from and serialized to the native BPMN `isSequential` attribute. The builder's `MultiInstanceOptions.isSequential` field is now wired through.

## Local Automation Workflows — Phase 3: Connector UX (2026-04-02) — `packages/plugins`

Built-in workers are now a first-class part of the connector catalog with full form UI.

**Connector catalog panel** (Ctrl+K → "Browse connectors…"):
- "Built-in Workers" tab: card grid for all 8 bpmnkit workers — always visible, no proxy needed
- "Community APIs" tab: 30+ OpenAPI-backed connector entries with search
- Click "Use" on a worker card to register it; select any service task to apply via the Connector field
- Footer: Import from URL / Import from file actions

**Template form renderer** — all worker fields rendered correctly in the config panel:
- Text with `feel: "optional"` → FEEL expression field with toggle (prompts, paths, content)
- Dropdown → searchable select (model picker, events picker)
- Boolean → toggle (ignore exit code)
- Number → numeric text field (timeout)
- `{{secrets.NAME}}` syntax works in any String/Text field (documented in field descriptions)

**Static templates** in `packages/plugins/src/connector-catalog/builtin-templates.ts`:
- 8 templates always embedded in the plugin — no network call needed to discover workers

## Local Automation Workflows — Phase 2: Triggers (2026-04-02) — `apps/proxy`

Workflows now start automatically without a "Run" click.

**Webhook trigger** (`POST /webhooks/:processId`):
- Any HTTP client can start a process instance; request body becomes process variables
- Optional `WEBHOOK_TOKEN` env var for Bearer token protection

**Timer trigger** (scan + schedule):
- Parses `<timeDuration>`, `<timeDate>`, `<timeCycle>` from deployed BPMN timer start events
- ISO 8601 duration/date/repeating-interval support (`PT1H`, `R/PT30M`, `2026-01-01T00:00:00Z`)
- Persists last-fired timestamps to `~/.bpmnkit/timer-state.json`

**File-watcher trigger** (`io.bpmnkit:trigger:file-watch:1`):
- Service tasks with `watchPath` header trigger a process instance on file add/change
- `glob` header for filename filtering; `events` header for add/change/all
- Injects `{ filePath, fileName, fileContent, relativePath, eventType }` as process variables

**Connector catalog integration**:
- Built-in worker templates auto-loaded from proxy on Studio startup and shown in the connector catalog

Set `BPMNKIT_TRIGGERS=false` to disable all triggers.

## Local Automation Workflows — Phase 1 (2026-04-02) — `apps/proxy`

bpmnkit now executes BPMN service tasks locally. Deploy a diagram to a running reebe instance and the
proxy's built-in worker daemon picks up jobs automatically.

**Built-in workers** (all configurable via element templates, no code required):

| Job type | Purpose |
|---|---|
| `io.bpmnkit:cli:1` | Run any shell command; `{{var}}` interpolation; outputs stdout/stderr/exitCode |
| `io.bpmnkit:llm:1` | Call Claude/Copilot/Gemini with a prompt; auto-detects available adapter |
| `io.bpmnkit:fs:read:1` | Read a file into a process variable |
| `io.bpmnkit:fs:write:1` | Write a process variable to a file |
| `io.bpmnkit:fs:append:1` | Append to a file |
| `io.bpmnkit:fs:list:1` | List a directory into an array variable |
| `io.bpmnkit:js:1` | Evaluate a JS expression with process variables in scope |

- `GET /worker-templates` — serves element template JSON for all built-in workers
- `GET /status` — now includes `workers` object with active state, job types, poll count
- Set `BPMNKIT_WORKERS=false` to disable the daemon

## Connector Secrets (2026-04-02) — `packages/engine`, `apps/proxy`, `apps/studio`

Use `{{secrets.NAME}}` in REST connector fields (URL, auth token, headers) to keep credentials out of BPMN diagrams — matching Camunda's native secrets syntax.

- **`SecretResolver` interface** (`@bpmnkit/engine`) — pluggable resolution strategy; `EnvSecretResolver` for standalone/Node.js
- **Proxy endpoint** (`POST /secrets/:name`) — proxy encrypts env var values with a client-supplied AES-256-GCM key before sending; the key is ephemeral (generated fresh on each Studio boot) and never stored
- **Session key store** (`useSecretsStore`) — generates key on boot, caches resolved secrets for the session, exposes `proxySecretResolver` for use in job workers
- **WASM adapter** — resolves secrets in URL, headers, and auth token before making HTTP calls
- **TS engine** — resolves secrets in IO mapping inputs and task headers at job execution time
- **Settings panel** — scans all BPMN models for `{{secrets.*}}` references and shows which are configured vs missing in the proxy environment

## File System Persistence & Project Management (2026-04-01) — `apps/proxy`, `apps/studio`, `packages/plugins`

Studio models can now be stored as real files on disk instead of (or alongside) browser IndexedDB.

- **Two storage modes**: _Local (IndexedDB)_ — the always-available default; _Project_ — a folder on the machine running the proxy, selectable in Settings.
- **Proxy FS API** (`/fs/*`): 10 new endpoints for tree listing, file read/write/delete/move, folder creation, and sidecar metadata; only `.bpmn`, `.dmn`, `.form`, `.md` files are served.
- **Sidecar metadata** (`.bpmnkit/<file>.meta.json`): stores stable UUID, deployment links, test scenarios, and run-variable defaults alongside the source file so everything is checkable into git.
- **Project registry**: configured projects stored in browser IndexedDB; the active project is remembered across reloads via `localStorage`.
- **Folder tree UI**: when a project is selected, the Models page shows a collapsible folder tree sidebar and shows only the files in the selected folder.
- **Move to... dialog**: move files between folders within the same project.
- **Markdown files** (`.md`): standalone notes in the project; opened with a plain textarea editor that auto-saves.
- **Test scenario persistence**: process-runner now supports `onSaveScenarios`/`onLoadScenarios` callbacks; in FS mode, scenarios are written into the sidecar file next to the BPMN.

Full specification: [`doc/projects-files.md`](projects-files.md)

## Process Input Validation (2026-03-29) — `packages/core`, `packages/plugins`, `apps/studio`

Validates process input variables at the start event using a companion Collect-hit-policy DMN table.

- **`buildValidationDmn(startEventId, variables)`** (`@bpmnkit/core`): generates a DMN decision table from `InputVariableDef[]` — one input column per variable, one rule per violation (required, type, min/max, minLength/maxLength, regex pattern).
- **`insertValidationStructure` / `removeValidationStructure`** (`@bpmnkit/core`): splice a Business Rule Task + XOR gateway + error end event after the start event; the happy-path flow requires `count(validationErrors) = 0`; `VALIDATION_FAILED` BPMN error thrown on violation. Fully reversible.
- **Start Event config panel "Input Validation" group** (`@bpmnkit/plugins/config-panel-bpmn`): Add/Edit/Remove actions with a modal variable editor (name, type, required, numeric/string constraints).
- **Process runner variable hints** (`@bpmnkit/plugins/process-runner`): reads input column names from the companion DMN and displays them as hint chips above the Play panel variable input.
- **Studio companion deploy** (`apps/studio`): all deploy paths auto-detect `zeebe:calledDecision` references in the BPMN XML and bundle matching DMN models as multipart companions; creating a validation DMN auto-saves it as a new studio model; Edit navigates to it.

## AI-Assisted BPMN Improvement (2026-03-28) — `apps/proxy`, `packages/core`, `packages/plugins`, `apps/cli`

Token-efficient pipeline for AI-powered BPMN analysis and improvement.

- **`POST /improve` proxy endpoint**: 4-phase pipeline — auto-fix (zero AI tokens), residual analysis, AI explanation + `BpmnOperation[]` output (~5× fewer tokens than full XML regeneration), apply ops and emit final XML via SSE.
- **`BpmnOperation` + `applyOperations()`** (`packages/core`): discriminated union (7 op types) + pure functional apply step; exported from `@bpmnkit/core`.
- **Sub-process support in compact format** (`packages/core/bpmn/compact.ts`): `CompactElement.children` for nested processes; `compactify()` recurses, `expand()` reconstructs.
- **Canvas highlight API** (`packages/canvas`): `highlight(ids, variant)` marks elements amber (`"changed"`) or green (`"new"`); `clearHighlights()` removes all marks.
- **AI panel improve flow** (`packages/plugins/ai-bridge`): "✦ Improve" streams explanation, shows auto-fix count + op diff list, renders canvas preview with highlights, "Apply to diagram" button.
- **CLI `bpmn improve <file> [--auto]`** (`apps/cli`): streams AI explanation + shows diff; `--auto` writes result back to file; `--server` for custom proxy URL.
- **CLI `bpmn lint --fix`** (`apps/cli`): applies all auto-fixable static analysis findings and writes the BPMN file in place.

## Studio Process Runner + Scenario Testing (2026-03-28) — `apps/studio`, `packages/plugins`

Play mode and scenario-based BPMN testing are wired into the Studio model editor.

- **Play button in HUD**: click to enter in-browser simulation — runs the current diagram against the TypeScript engine (`@bpmnkit/engine`) with real-time token highlights.
- **Play panel sub-tabs**: Variables, FEEL, Errors, Input (configurable start variables).
- **Tests as first-class dock tab**: dedicated "Tests" tab in the side dock, always accessible without entering play mode.
- **Scenario runner**: each scenario runs against a fresh `@bpmnkit/reebe-wasm` WASM engine instance for authoritative, isolated results.
- **Visual scenario editor**: click ✎ on any scenario to open a point-and-click editor:
  - **Start Variables**: key=value editor for process inputs.
  - **Task Outputs**: auto-populated task cards from the diagram; click a card (or click the element on the canvas) to configure output variables and optional error injection per task.
  - **Expected Variables**: key=value assertions checked after the run.
  - **Inline failure diff**: last run failures shown directly in the editor.
- **Scenario-based testing**: define named test scenarios with input variables, per-task mock outputs/errors, and assertions (expected path + expected variables). Results show pass/fail with per-field diffs. Scenarios persist in IndexedDB scoped to the model.
- **Run all / run one**: run all scenarios at once or individually, with live pass/fail status per scenario.
- **Chaos import**: after a chaos run, import triggered injections as draft test scenarios.
- **AI generate** (when configured): generate draft scenarios from the current BPMN via AI.

## BPMNkit Studio (2026-03-24) — `apps/studio` + `packages/user-tasks`

A unified Preact web application replacing fragmented Camunda tooling (Modeler, Operate, Tasklist).

- **Shell**: 3-column layout (Sidebar / main content / AI Drawer), theme switching (light/dark/neon), developer/operator mode toggle that reorders sidebar navigation.
- **Cluster connection**: proxy-based (localhost:3033), profile selection via `ClusterPicker` dropdown, `x-profile` header on all requests.
- **Dashboard**: `StatusHeader` (profile, status dot, tags, last-updated ticker, refresh button), `IncidentBanner` (dismissible full-width alert), `OfflinePanel` (proxy-down replacement), `GettingStarted` strip (3-step onboarding for empty clusters), stat cards with pinging live-alert dot, improved empty states with CTAs, sparkline time-series, auto-refresh every 15s.
- **Models**: local BPMN/DMN/Form files stored in IndexedDB. Grid and list views, `DiagramPreview` via offscreen BpmnCanvas + IntersectionObserver, create/import/delete with confirmation dialogs.
- **Model Editor**: full-height `BpmnEditor`, 2-second debounced auto-save, ⌘S immediate save, deployed-versions sidebar panel.
- **Definitions**: searchable/filterable table of deployed process definitions; detail page with BpmnCanvas + token-highlight + metadata sidebar.
- **Instances**: filterable table with state pills, bulk cancel, detail page with BpmnCanvas overlay, variable tree (recursive), incidents tab.
- **Incidents**: filterable table, detail page with BpmnCanvas highlighting the failing element in red via `tokenPlugin.api.setError()`.
- **User Tasks**: filterable table with overdue highlighting, detail page with form rendering via `@bpmnkit/plugins/form-viewer`, claim/unclaim/complete actions.
- **Decisions**: browsable DMN decision table list and detail view.
- **AI Drawer**: context-aware chat — in editor view mounts the full `createAiPanel` (BPMN context, XML preview, Apply button, companion file creation); in all other views uses text chat via `/operate/chat`. Accepts initial messages transferred from the command palette.
- **Command Palette AI Chat**: typing a query + selecting "Ask AI" transforms the palette into an inline chat modal (no context switch). Chat is context-aware: uses `/chat` with BPMN context on model pages, `/operate/chat` elsewhere. Returns XML → "Diagram ready" + Apply button. "Sidebar" button moves the conversation to the AI Drawer.
- **Incident AI**: IncidentDetail sidebar has a third "AI" tab that calls `/operate/incident-assist` for structured root-cause / remediation analysis (matching Operate's implementation).
- **Command Palette**: ⌘K dialog with arrow-key navigation, fuzzy word-prefix matching, match highlighting, styled `<kbd>` shortcuts, footer hint bar.
- **Zen / Presentation Mode**: ⌘K → "Start Presentation Mode" hides all Studio chrome (TopBar, Sidebar, AI Drawer, save bar, editor HUD toolbars) for a distraction-free BPMN view.
- **`@bpmnkit/user-tasks`**: standalone vanilla TS widget (`createUserTaskWidget`) for embedding task completion forms in any host page.

## Hot Reload Live Mode (2026-03-22) — `packages/plugins/live-mode`

- **`createLiveModePlugin(options)`**: Canvas plugin that keeps a running Zeebe process instance in sync with the diagram as you edit.
  - Toolbar toggle button and status pill (OFF / CONNECTING / LIVE / ERROR / BLOCKED / TESTS FAIL).
  - Auto-deploys via the proxy on every diagram change (debounced 500ms).
  - Maintains dev instance across reloads via IndexedDB persistence.
  - Auto-migrates the running instance to each new version; shows conflict banner with "Start fresh" on migration failure.
  - Polls active element instances and drives token-highlight canvas overlay.
  - Variable inspector: hover an active element → tooltip showing live variable values.
  - Sandbox guard: blocked when the active profile is tagged as production.
  - Optional test-green gate: require `runTests()` to pass before each deploy.

## Story Mode (2026-03-22) — `packages/core/bpmn/story.ts`, `packages/plugins/story-view`

- **`renderStoryHtml(defs, options?)`** (`@bpmnkit/core`): Pure HTML string renderer (no DOM). Topologically sorts flow elements (Kahn's algorithm, cycle-safe), groups by swim lane, renders typed cards with role-colored left borders. Gateway cards show outgoing conditions. `standalone: true` produces a complete self-contained HTML document.
- **`createStoryViewPlugin(options?)`**: Canvas plugin with `📖 Story` toggle. Renders story HTML from current definitions and mounts it in the editor container. Comment threads per element stored in IndexedDB. AI condition summarizer hook for plain-English FEEL translations.

## CLI lint & story commands (2026-03-22) — `apps/cli`

- **`casen lint <file.bpmn>`**: Runs all static analysis (`optimize()`) on a BPMN file, prints findings with symbols, exits 1 on errors. Supports `--categories` filter and `--format json`.
- **`casen story <file.bpmn>`**: Renders a BPMN process as a standalone story-mode HTML file. Supports `--output` and `--theme dark|light`.

## Variable Flow Analysis (2026-03-22) — `packages/core/optimize`, `packages/plugins/variable-flow`

- **`analyzeVariableFlow(process)`**: Static analysis engine that scans IO mapping inputs/outputs and sequence flow FEEL conditions to build a producer/consumer graph, then emits:
  - `data-flow/undefined-variable` (warning) — variable consumed but never produced anywhere in the process; includes Levenshtein ≤ 2 typo suggestions.
  - `data-flow/dead-output` (info) — variable produced but never consumed downstream.
  - `data-flow/role` (info) — per-element metadata listing which variables it reads and writes (used by the canvas overlay).
- **`extractFeelIdentifiers(expr)`**: Parses a FEEL expression string, walks the AST, and returns all variable name references (excluding ~95 built-in function names).
- **`createVariableFlowPlugin()`**: Canvas overlay plugin — colors elements green (writes), blue (reads), teal (reads & writes). Hovering any colored element shows a tooltip table listing each variable and whether it's read or written. Includes a legend.

## Time-Travel Simulation Debugger (2026-03-22) — `packages/plugins/process-runner`

- **Event log recording**: Every engine event is pushed to an in-memory log (capped at 10,000) during simulation runs.
- **Timeline scrubber**: Range input above the tab bar. Dragging left enters time-travel mode; the Variables/FEEL/Errors tabs instantly update to show state at the selected event index.
- **State projection**: `computeStateAt(idx)` replays the event log up to index idx and returns projected variable state, FEEL evals, and errors — O(n) pass, no re-execution.
- **Live / Replay**: "Live" button returns to the tail of the log. "Replay from here" snapshots variable state at the scrub point and starts a fresh engine run with those variables as inputs.

## Scenario-Based Testing (2026-03-22) — `packages/engine`, `packages/plugins/process-runner`, `apps/cli`

- **`runScenario(engine, defs, scenario)`** (`@bpmnkit/engine`): Runs a single test scenario against a BPMN definition with mock job workers. Supports path assertions (expected element visit order) and variable assertions (expected final state). Returns a typed `ScenarioResult` with `passed`, `failures`, `visitedElements`, `finalVariables`, `errors`, `durationMs`.
- **`.bpmn.tests.json` sidecar format**: Scenarios as a JSON array of `ProcessScenario` objects — each has `id`, `name`, `inputs`, `mocks` (keyed by task type), and `expect.path`/`expect.variables`.
- **Tests tab** in process runner panel: Create/delete scenarios, run all or individually, see pass/fail per scenario, and expand failure diffs showing field/expected/actual.
- **`casen test <file.bpmn>`**: CLI command that reads a BPMN file and its `.bpmn.tests.json` sidecar, runs all scenarios, prints PASS/FAIL with diffs, and exits 1 if any scenario fails.

## Pattern Advisor Plugin (2026-03-22) — `packages/plugins/pattern-advisor`

- **`createPatternAdvisorPlugin`**: Canvas plugin that continuously analyzes the loaded process against 15 production-failure patterns and surfaces findings in a persistent side panel.
- **15 pattern rules** across two new severity levels: error (blocks deploy), warning (advisory), info (hygiene). Rules cover missing error boundaries on HTTP tasks, sub-processes, call activities; exclusive gateway without default flow; parallel variable conflicts; user tasks without SLA timers; catch-and-swallow error handlers; literal-only FEEL conditions; duplicate job types; empty annotations; and more.
- **Reactive analysis**: Re-runs on every diagram change — no manual trigger needed.
- **Canvas badges**: Affected elements get a colored ring (red/amber/blue) indicating the worst finding severity.
- **Per-finding actions**: [Apply Fix] for auto-fixable patterns; [Dismiss] to suppress a finding without fixing it.
- **Deploy guard integration**: Error-severity pattern findings (e.g. HTTP task without error boundary) automatically block the deploy plugin — same as the existing optimizer guard.

## Chaos Simulation Mode (2026-03-22) — `packages/plugins/process-runner`

- **Chaos toggle** in the process runner toolbar (visible when idle): enables random failure injection for the next simulation run.
- **20% default probability**: Each eligible task (service, send, business-rule, script) is independently rolled at 20% chance of receiving an injection.
- **Three injection types**: `service-failure` (task throws an error — reveals missing error boundaries), `null-response` (task completes but returns nothing — reveals missing null guards downstream), `random-delay` (500–2500ms artificial delay — reveals timer boundary gaps).
- **Errors tab summary**: The chaos schedule is printed to the Errors tab before execution begins, showing which elements were targeted and with which injection type.

## Deploy Plugin (2026-03-20) — `packages/plugins/deploy`

- **`createDeployPlugin`**: Editor sidebar plugin (new "Deploy" tab in SideDock) for deploying processes and starting instances without leaving the editor.
- **Proxy-first**: All Camunda API calls are routed through the proxy server (`casen proxy start`) to avoid CORS issues. Shows an offline hint with the start command when the proxy is not running.
- **Profile selector**: Loads available CLI profiles from `/profiles` and passes the selected profile via `x-profile` header on all requests — same mechanism as `@bpmnkit/operate`.
- **Cluster health check**: Calls `GET /api/v2/topology` before allowing deploy; shows broker count and gateway version, or blocks with an error if the cluster is unreachable.
- **Optimizer guard**: Runs `optimize(defs)` before every deploy attempt. Errors block the Deploy button; warnings are shown but non-blocking.
- **One-click deploy**: `POST /api/v2/deployments` with the current BPMN XML as multipart/form-data, using the editor filename as the resource name.
- **Start Instance**: Shown automatically when the current process definition is already deployed (checked via `POST /api/v2/process-definitions/search`). Accepts optional JSON variables and opens the started instance in the operate app via a `#/instances/{key}` deep link.

## Connector Catalog Plugin (2026-03-18) — `packages/plugins/connector-catalog`

- **`createConnectorCatalogPlugin`**: Canvas plugin that wires `@bpmnkit/connector-gen` into the editor via the command palette. Press Ctrl+K / ⌘K, search for an API name (GitHub, Stripe, Slack, Anthropic, …), and the spec is fetched, templates generated, and registered in the connector selector — all in the current session.
- **30+ catalog entries**: All built-in `connector-gen` catalog entries (GitHub, Stripe, Jira, Slack, Notion, OpenAI, Discord, PagerDuty, etc.) appear as individual commands.
- **Custom URL import**: "Import from OpenAPI URL…" command accepts any OpenAPI 3.x spec URL for private or custom APIs.
- **Zero UI friction**: No dialog, no file picker. Commands appear in the existing command palette; a toast confirms success or surfaces errors.

## Mobile Editor Usability (2026-03-17) — `packages/editor`, `packages/plugins`, `apps/desktop`

- **Fix zoom stuck after pinch-to-zoom**: `pointercancel` now resets the state machine, unlocking the viewport when a system gesture interrupts an editor drag.
- **Sidebar auto-collapse**: On viewports ≤600px the side dock starts collapsed so it doesn't overlay the screen.
- **Simplified mobile HUD**: Top-center toolbar and bottom-left toolbar are hidden on mobile. Bottom-center toolbar repositions to the bottom-left corner with its existing collapse toggle.
- **Mobile "Edit" menu**: On mobile viewports, the main menu gains an "Edit" submenu with Undo, Redo, Delete, Duplicate, Select All, and Auto-layout actions.
- **Unified file tab on mobile**: The per-type grouped tab bar is replaced by a single tab showing the active file. A unified dropdown lists all open files across all types (with type badges) when multiple files are open.

## OpenAPI → Camunda Connector Generator (2026-03-14) — `packages/connector-gen`, `apps/cli`

- **`@bpmnkit/connector-gen`**: Zero-dep (+ `yaml`) library that converts OpenAPI 3.x specs to Camunda REST connector element templates.
- **Strategy A**: one `.json` template per API operation; job type `io.camunda:http-json:1`.
- **URL handling**: Hidden field for plain paths; FEEL expression (`="https://base/" + param + "/rest"`) for paths with `{param}` variables.
- **Auth**: 5-type auth block (noAuth, API key, Basic, Bearer, OAuth2 Client Credentials) with conditions; auto-detected from `securitySchemes` or overrideable via `--auth`.
- **Body expansion**: `--expand-body` decomposes top-level request body properties into individual typed fields (String / Number / Boolean).
- **Catalog**: 30 built-in API entries across payments, messaging, CRM, monitoring, AI, and more — `casen connector generate --api <id>`; `casen connector catalog` lists all entries.
- **Output**: one file per operation (default) or all in one array file (`--format array`); `--dry-run` prints to stdout.
- **CLI commands**: `casen connector generate` + `casen connector catalog`.

## Interactive Learning Center (2026-03-13) — `apps/learn`, `packages/astro-shared`

- **`apps/learn`**: Astro v6 app (port 4322) with interactive BPMN tutorials. Tutorial catalog, per-tutorial overview, and step-by-step pages with live BpmnEditor embedded in a split-pane layout.
- **`packages/astro-shared`**: Shared CSS package (`@bpmnkit/astro-shared`) providing `tokens.css` (oklch design tokens), `background.css` (aurora orbs + dot grid + grain), and `site.ts` (SITE metadata).
- **Tutorial 1 — "Getting started"**: 5-step no-install tutorial: run a process, add a task, connect it with a sequence flow, name it, then run again. Uses `BpmnEditor` + `Engine` + `ProcessRunnerPlugin`.
- **Progress tracking**: localStorage-based progress (`bpmn_learn_progress`), including saved BPMN XML carried across steps, step completion state, and continue-from-last-step support.
- **Hint system**: Progressive hint reveal with tiered styling; up to N hints per step.
- **Validation**: `manual`, `bpmn-element-count`, `bpmn-has-connection`, `bpmn-element-labeled` validators; success/error banners; completion overlay with CSS confetti.

## Auto-layout (2026-03-11) — `packages/core`, `packages/editor`

- **`Bpmn.autoLayout(xml)`**: applies the Sugiyama layered layout to all processes in a BPMN XML string and returns updated XML with replaced BPMNDi positions.
- **`applyAutoLayout(defs)`**: exported from `@bpmnkit/core` — operates on `BpmnDefinitions` directly; handles plain processes and collaborations with pools/lanes; pool and lane shapes carry `isHorizontal: true`.
- **`BpmnEditor.autoLayout()`**: undoable auto-layout command in the editor; triggers `fitView` after layout.
- **Auto-layout button**: HUD action bar now has an auto-layout button (grid icon) between `btnTopMore` and optional inject buttons.
- **`BpmnDiShape.isHorizontal`**: new optional field parsed and serialized round-trip by parser/serializer.

## ASCII rendering for DMN and Forms (2026-03-11) — `packages/ascii`

- **`renderDmnAscii(xml, options?)`**: renders DMN decision tables as double-line box-drawing ASCII grids. Column widths auto-fit to content; hit policy in header; multiple decisions separated by blank lines.
- **`renderFormAscii(json, options?)`**: renders Camunda Form JSON as text-mode mock-up. Supports all component types: inputs, selects, radios, checkboxes, buttons, groups, dynamic lists, tables, and display components.
- **`RenderOptions.title`**: control whether a title header is prepended (`false` to suppress, string to override, default uses file/definition name).

## Shared design system (2026-03-11) — `packages/ui`

- **`@bpmnkit/ui`**: Shared design tokens, theme management, and primitive UI components for all bpmn-sdk frontends.
- **Design tokens**: `--bpmnkit-bg`, `--bpmnkit-surface`, `--bpmnkit-surface-2`, `--bpmnkit-border`, `--bpmnkit-fg`, `--bpmnkit-fg-muted`, `--bpmnkit-accent` (blue), `--bpmnkit-success/warn/danger`, `--bpmnkit-radius`, `--bpmnkit-nav-bg/fg`. Light default, dark via `[data-theme="dark"]`.
- **Theme management**: `resolveTheme` (auto→light|dark), `persistTheme`/`loadPersistedTheme` (localStorage), `applyTheme` (sets `data-theme` on element).
- **Theme switcher component**: `createThemeSwitcher({ initial, onChange, persist })` — button+dropdown with Dark/Light/System options, icon updates to reflect selection.
- **Shared components**: `badge(state)`, `cell(text)`, `createStatsCard(label, value, mod)`, `createTable<T>(options)` — generic, use `--bpmnkit-*` tokens.
- **Icon library**: `IC_UI` — SVG icons for theme (moon/sun/auto/check) and navigation (dashboard/processes/instances/incidents/jobs/tasks).



## Monitoring & Operations frontend (2026-03-10) — `packages/operate`

- **`@bpmnkit/operate`**: Zero-dependency monitoring frontend. `createOperate({ container, mock?, proxyUrl?, profile?, theme? })` mounts full monitoring UI.
- **Dashboard**: Stats cards for active instances, open incidents, active jobs, pending tasks, deployed processes. Clickable cards navigate to respective views.
- **Processes view**: Table of deployed process definitions with name, ID, version, tag, tenant.
- **Instances view**: Paginated table with state filter bar (All / Active / Completed / Terminated). Incident warning indicator per row.
- **Instance detail**: BPMN canvas rendering with token-highlight (active = amber glow, visited = green tint, edge animations). Sidebar tabs: Variables, Incidents.
- **Incidents view**: Table with error type, message, process, instance, state, age.
- **Jobs view**: Table with type, worker, retries, state, error message.
- **User Tasks view**: Table with name, assignee, process, state, due date, priority.
- **Profile picker**: Header dropdown populated from `GET /profiles`; switching reconnects all SSE streams.
- **Mock/demo mode**: Self-contained fixture data, no proxy needed. Used at `/operate` on landing page.
- **SSE architecture**: proxy polls Camunda server-side, pushes events to frontend — clean frontend, no polling timers client-side.



## Landing page DMN/Form examples and live playground (2026-03-10) — `apps/landing`

- **DMN & Forms section**: New landing page section with 3-tab showcase — DMN decision table builder, Camunda Form scaffold, and a full BPMN process referencing both (userTask → formId, businessRuleTask → decisionId).
- **Live playground**: New interactive section where visitors write `Bpmn` / `Dmn` / `Form` builder code in a textarea and see the rendered BPMN diagram update instantly. `Ctrl+Enter` to run. Tab key inserts spaces. 4 example presets (linear flow, approval flow, DMN+Form, parallel gateway). Renders via `BpmnCanvas`.
- **AI companion file offer**: After applying an AI-generated BPMN with `businessRuleTask` or `userTask` references, the chat offers to scaffold the referenced DMN / Form files and open them as new tabs.

## DMN/Form layout, compact format, and MCP multi-type support (2026-03-10) — `packages/core`, `apps/ai-server`

- **DMN fluent builder**: `Dmn.createDecisionTable(id)` → `.name()` → `.input({ label, expression, typeRef })` → `.output({ label, name, typeRef })` → `.rule({ inputs, outputs })` → `.hitPolicy()` → `.build()`. Produces a `DmnDefinitions` object serializable via `Dmn.export(defs)`.
- **DMN auto-layout**: `layoutDmn(defs)` assigns DMNDI positions to all DRG elements using a left-to-right layered layout based on the requirement DAG. Sizes: decision=180×80, inputData=125×45, knowledgeSource=100×63, BKM=160×80. Exposed as `Dmn.layout()`.
- **DMN parse/export**: `Dmn.parse(xml)` → `DmnDefinitions`; `Dmn.export(defs)` → XML string. `Dmn.makeEmpty()` creates a minimal DmnDefinitions with one empty decision table.
- **DMN benchmark**: `benchmarkDmnLayout(xml, fileName)` compares auto-layout vs reference DMNDI. Exported from `@bpmnkit/core`.
- **DMN compact format**: `compactifyDmn(defs) → CompactDmn` / `expandDmn(compact) → DmnDefinitions` — token-efficient AI format. Exposed as `Dmn.compactify()` / `Dmn.expand()`.
- **Form scaffold**: `Form.makeEmpty(id?)` creates a minimal `FormDefinition` (schemaVersion 16, submit button). Extend `components` array with typed field objects.
- **Form compact format**: `compactifyForm(def) → CompactForm` / `expandForm(compact) → FormDefinition`. Exposed as `Form.compactify()` / `Form.expand()`.
- **Form parse/export**: `Form.parse(json)` → `FormDefinition`; `Form.export(def)` → JSON string.
- **BPMN cross-references**: `Bpmn.createProcess()` builder supports `userTask(id, { formId })` (links Camunda Form via zeebe:formDefinition) and `businessRuleTask(id, { decisionId, resultVariable })` (links DMN via zeebe:calledDecision).
- **MCP server multi-type**: `mcp-server.ts` now detects file type from content (BPMN/DMN/Form), exposes type-appropriate tool sets, and saves in the correct format. `compose_diagram` Bridge API works for all three types.
- **Bench script extended**: `scripts/bench-layout.mjs` processes `.bpmn`, `.dmn`, and `.form` files with type-specific reporting and summary.

## Auto-layout benchmark + compactness improvements (2026-03-10) — `packages/core`

- **`benchmarkLayout` API**: full pipeline to compare auto-generated positions against reference BPMN DI data — `benchmarkLayout`, `parseReferenceLayout`, `generateAutoLayout`, `compareLayouts`, `formatBenchmarkResult` exported from `@bpmnkit/core`.
- **Tighter spacing**: `GRID_CELL_WIDTH` reduced 200→130 (width ratio 1.51→1.0 vs bpmn.io reference), `GRID_CELL_HEIGHT` reduced 160→140 (140px parallel branch spacing matches bpmn.io).
- **Gateway labels below**: gateway labels now render centered below the diamond (standard BPMN convention).
- **`scripts/bench-layout.mjs`**: CLI benchmark script over any folder of `.bpmn` files; reports avg/p90/max distance, width/height ratio, order violations per file.
- **Reference BPMN samples**: `bpmn-samples/order-process.bpmn`, `bpmn-samples/parallel-approval.bpmn`.

## Layout + optimizer improvements (2026-03-09) — `packages/core`

- **Back-edge loop alignment**: `alignBranchBaselines` and `findBaselinePath` now correctly handle nodes with multiple successors caused by back-edge reversal, keeping sequential tasks on the main path aligned to the same center-y baseline.
- **`flow/multi-incoming-task` rule**: new optimizer rule detects non-gateway elements with more than 1 incoming flow and auto-fixes by inserting an exclusive gateway join.

## AI-assisted diagram design UX (2026-03-08) — `packages/editor`, `apps/landing`

- **New-diagram onboarding**: freshly-created diagrams show a full-coverage overlay instead of the canvas; three action cards let users choose "Start from scratch", "Generate example diagram", or "Ask AI"
- **Element-level Ask AI**: sparkle button in the contextual toolbar below any selected BPMN element; opens the AI chat panel with the element already in context
- `initEditorHud` returns `{ setActive, showOnboarding, hideOnboarding }` for lifecycle integration
- `HudOptions`: `onStartFromScratch`, `onGenerateExample`, `onAskAi` callbacks

## Camunda Admin API (SaaS) SDK + CLI (2026-03-06) — `packages/api`, `apps/cli`

Full support for the Camunda Console Admin API alongside the existing C8 REST API.

- **`AdminApiClient`** — generated from the SaaS Console swagger (`console.cloud.camunda.io`), same runtime as `CamundaClient` (OAuth2, retry, cache, typed events). Exported from `@bpmnkit/api`.
- **Admin API resources**: `MetaResource`, `MembersResource`, `ClustersResource`, `ActivityResource` — typed methods for every Admin API endpoint.
- **CLI command groups**: `casen meta`, `casen members`, `casen clusters`, `casen activity` — full list/get/create/delete/update support mirroring the C8 command structure.
- **Per-profile `apiType`**: each saved profile is tagged as `"c8"` (default) or `"admin"`. The CLI routes `getClient()` vs `getAdminClient()` accordingly.
- **`profile create --api-type admin`**: explicitly set the API type when creating a profile.
- **Auto-detect on `profile import`**: credentials files containing `CAMUNDA_CONSOLE_CLIENT_ID` or `CAMUNDA_CONSOLE_BASE_URL` are automatically classified as Admin API profiles; all others remain C8.
- **Admin env vars**: `CAMUNDA_CONSOLE_CLIENT_ID`, `CAMUNDA_CONSOLE_CLIENT_SECRET`, `CAMUNDA_OAUTH_URL`, `CAMUNDA_CONSOLE_BASE_URL`, `CAMUNDA_CONSOLE_OAUTH_AUDIENCE`.
- **Code generation**: `pnpm run generate:admin` in `packages/api`; tag derivation from URL path segments handles the tagless Admin API swagger.

## Process Runner Canvas Plugin (2026-03-03) — `canvas-plugins/process-runner`

Interactive BPMN execution toolbar embedded directly on the canvas.

- **Auto-play** — runs the entire process instance immediately with no configuration.
- **Play with JSON payload** — modal dialog lets you supply initial variables as a JSON object before executing.
- **Step-by-step** — starts in step mode; execution pauses after each element's I/O mapping. Click "→ Next" to advance one step at a time.
- **Stop** — cancels the running instance at any point.
- **Token-highlight integration** — pass `tokenHighlight: createTokenHighlightPlugin()` to see active/visited nodes and edges update in real-time.
- **Auto-deploy** — subscribes to `diagram:load`; automatically deploys the loaded diagram into the engine so the toolbar is always ready.
- **Structural typing** — depends only on `@bpmnkit/canvas`; engine and token-highlight are accepted via structural interfaces, no hard runtime coupling.

## Token Highlight Canvas Plugin (2026-03-03) — `canvas-plugins/token-highlight`

Visualizes live process execution state on the BPMN canvas when paired with `@bpmnkit/engine`.

- **Active elements** — amber glow pulse; marks nodes where a token is currently present.
- **Visited elements** — green tint; marks nodes the token has already left.
- **Active/visited edges** — colored and animated sequence flows; only highlights edges whose source has been visited, so untaken gateway branches stay neutral.
- **`trackInstance(instance)`** — one call auto-wires to any `ProcessInstance` via structural typing (no engine dependency required).
- **Manual API** — `setActive()`, `addVisited()`, `clear()` for custom control.

## BPMN Simulation Engine (2026-03-03) — `packages/engine` (`@bpmnkit/engine`)

Lightweight, zero-external-dependency BPMN simulation engine for browser and Node.js.

- **`Engine`** — Deploy BPMN/DMN/Form definitions; start process instances with optional input variables; register job workers by type.
- **`ProcessInstance`** — Token-based execution; `onChange(callback)` → real-time `ProcessEvent` stream; `cancel()`; `activeElements` / `state` / `variables_snapshot`.
- **Job workers** — Register handlers for service/user tasks. Auto-completes in simulation mode when no handler is registered.
- **Gateways** — Exclusive (condition eval), Parallel (split+join), Inclusive (all matching flows).
- **Timers** — ISO 8601 durations/dates/cycles via `setTimeout`.
- **DMN** — Business rule tasks evaluate decision tables via `@bpmnkit/feel`; supports all major hit policies.
- **Sub-processes** — Isolated child scope; completes when all tokens in sub-scope are consumed.
- **Error propagation** — Error end events propagate through scope chain to the nearest error boundary event.

## Native Rust AI server with embedded QuickJS (2026-03-03) — `apps/ai-server-rs`

The Tauri desktop app now bundles two native Rust binaries instead of a Node.js bundle:

- **`ai-server`** — HTTP server on port 3033 (axum, CORS, SSE). Detects and proxies Claude/Copilot/Gemini CLIs. Converts CompactDiagram ↔ BPMN XML via the embedded `@bpmnkit/core` bridge.
- **`bpmn-mcp`** — stdio MCP server (JSON-RPC 2.0). Used as the LLM's tool executor when MCP is supported. Maintains stateful BPMN diagram in-memory via the bridge.

**Core bridge** (`bridge.ts` → `bridge.bundle.js` → `include_str!`): `@bpmnkit/core` is compiled to an IIFE JS bundle at Rust build time and evaluated in a dedicated QuickJS (`rquickjs`) thread. When core changes, rebuilding the Rust package automatically picks up the update — no divergence between JS and Rust.

No Node.js required on the user's machine for the desktop app.

## History tab in sidebar dock (2026-03-03) — `canvas-plugins/history`, `packages/editor`

A dedicated "History" tab sits between Properties and AI in the right sidebar. It shows a chronological list of AI checkpoints for the currently open file with one-click restore (confirm dialog). The tab is disabled for in-memory files that have no storage context.

Day-based checkpoint retention: up to 50 checkpoints from today + 1 (latest) per day for the last 10 days. Older entries are pruned automatically on each save.

## MCP-based AI diagram editing (2026-03-03) — `apps/ai-server`

The AI server exposes a minimal stdio MCP server (`mcp-server.ts`) that gives the LLM structured tools to read and modify BPMN diagrams. Zero external dependencies — pure Node.js built-ins + `@bpmnkit/core`.

Tools: `get_diagram`, `add_elements`, `remove_elements`, `update_element`, `set_condition`, `add_http_call`, `replace_diagram`.

`add_http_call` always sets `jobType: "io.camunda:http-json:1"` — the Camunda HTTP REST connector is baked into the tool signature so the LLM can't use the wrong task type.

Adapters supported:
- **Claude** (`claude -p --mcp-config --allowedTools --strict-mcp-config`) — full MCP
- **Copilot** (`copilot -p --additional-mcp-config --allow-all-tools`, new `@github/copilot` GA Feb 2026) — full MCP
- **Gemini** (`gemini -p --yolo`) — fallback to system-prompt approach (no per-invocation MCP)

All diagram changes go through `expand()` + `Bpmn.export()` in core; the client receives validated XML via `{ type: "xml" }` SSE and never manipulates BPMN directly.

## Core-mediated AI pipeline (2026-03-03) — `apps/ai-server`

All AI chat requests now flow exclusively through the `@bpmnkit/core` package on the server:

1. **Operations format** — LLM outputs targeted ops (`add`, `remove`, `update`, `condition`) instead of re-generating the entire diagram for small changes. This is much more efficient for common tasks (add a node, rename, set a condition, add a REST connector task type).
2. **Fallback full diagram** — LLM can still output a full `CompactDiagram` for new diagrams or structural rewrites.
3. **Server-side validation** — `parseResponse()` applies ops to the current diagram, then `expand()` + `Bpmn.export()` validate and serialize the result. The frontend receives ready-made XML via a `{ type: "xml" }` SSE event.
4. **No client-side XML manipulation** — the apply button in the AI panel uses the server-produced XML directly.

## AI quick actions (2026-03-03) — `canvas-plugins/ai-bridge`

One-click AI operations on the current diagram, accessible via a quick-actions bar above the chat input:

- **Improve diagram** — analyzes the open diagram and returns an improved version in one shot, covering:
  - Sub-process consolidation (groups 3+ consecutive related tasks)
  - Simplification (removes redundant gateways and over-engineered paths)
  - Name normalization (verb-noun title case, consistent tone)
  - FEEL expression cleanup (minimal, readable conditions)
- Backend uses the core `optimize()` engine to pre-detect concrete issues (FEEL complexity, flow problems, task-reuse opportunities) before calling the LLM — the LLM receives a specific list of what to fix, not a generic "improve" instruction
- After streaming, the server validates the LLM's output by calling `expand()` + `Bpmn.export()` from core, then emits the result as a `{ type: "xml" }` SSE event — the client applies it directly without any client-side XML parsing
- The response appears as a normal AI message with an "Apply to diagram" button

## Tauri desktop app (2026-03-02) — `apps/desktop`

Native desktop application wrapping the BPMN Kit editor using Tauri v2:

- **Identical editor** to the browser version — same plugins, sidebar dock, AI integration
- **AI server auto-start** — on launch, spawns the bundled Node.js AI server automatically; no manual `pnpm ai-server` required
- **Small binary** — ~3–5 MB installer (vs 85+ MB Electron) via minimal Tauri features + release profile optimizations (`lto`, `opt-level = "s"`, `strip`)
- **Hot-reload dev** — `pnpm desktop:dev` opens a native window with Vite HMR
- **Cross-platform** — targets Linux/macOS/Windows via native OS WebView (WebKitGTK / WKWebView / Edge WebView2)
- **Placeholder icons** generated via `scripts/gen-icons.mjs`; replace with `pnpm tauri icon icon.png`

## Unified right sidebar dock (2026-03-02) — `apps/landing` + plugins

VS Code / Figma style dock that unifies the Properties config panel and the AI chat panel:

- **Single right dock** with Properties and AI tabs; no overlap, no z-index fighting
- **Properties tab**: shows config panel for selected element; "Select an element…" empty state when nothing selected
- **AI tab**: shows full AI chat panel (SSE streaming, Apply button, checkpoint history)
- **Collapse/expand**: width-based collapse (38px strip) — button always accessible; state persisted to `localStorage`
- **Resize**: left-edge drag; width 280–700px, persisted to `localStorage`
- **Auto-expand**: selecting an element expands dock to Properties tab; clicking AI button expands to AI tab
- **Backward compatible**: both plugins work without `container` (standalone/body mode unchanged)

## AI integration (2026-03-02) — `apps/ai-server` + `@bpmnkit/canvas-plugin-ai-bridge`

Local AI assistant for BPMN diagram creation and modification:

- **AI panel** in the editor (right-side slide-in) with streaming chat interface
- **Auto-apply**: AI responses containing a `CompactDiagram` JSON block get an "Apply to diagram" button; applies via `expand()` + auto-layout
- **Checkpoints**: IndexedDB stores up to 50 checkpoints per project/file; "History" button shows list with restore
- **Local server** (`pnpm ai-server`, port 3033): bridges browser to CLI-based AI — Claude CLI (`--output-format stream-json`) and GitHub Copilot CLI
- **Compact format** (`compactify`/`expand`): 5-10x token reduction vs raw XML; exported from `@bpmnkit/core`

## Reference navigation in element toolbar (2026-03-02) — `@bpmnkit/editor` HUD

When a BPMN element with a linked reference is selected, the cfg toolbar shows navigation buttons:

- **Call activity**: if `processId` set → "ProcessName ↗" navigate button; else → "Link process ▾" dropdown with available processes + "New process…" input modal
- **User task**: if `formId` set → "FormId ↗" navigate button; else → "Link form ▾" dropdown
- **Business rule task**: if `decisionId` set → "DecisionId ↗" navigate button; else → "Link decision ▾" dropdown
- Reference action buttons removed from config panel; process/form/decision text fields remain for manual editing

## Optimize plugin (2026-03-02) — `@bpmnkit/canvas-plugin-optimize`

New self-contained canvas plugin encapsulating the two-phase optimize dialog:

- `createOptimizePlugin(options)` returns `{ name, install(), button }` — button is injected into the HUD as `optimizeButton`
- Dialog logic (styles, phase 1 findings list, phase 2 results) fully self-contained in the plugin

## Custom storage dialogs (2026-03-02) — `@bpmnkit/canvas-plugin-storage`

All browser `prompt()`/`confirm()` calls replaced with themed custom modals:

- `showInputDialog(opts): Promise<string | null>` — text input modal with title, placeholder, default value
- `showConfirmDialog(opts): Promise<boolean>` — confirmation modal with optional `danger` styling
- Both exported from `@bpmnkit/canvas-plugin-storage`; used in storage and storage-tabs-bridge

## Optimize button (2026-03-02) — editor HUD + landing app

"Optimize Diagram" button in the BPMN editor action bar (wand+sparkle icon):

- **Phase 1** — shows all findings from `optimize(defs)` with severity badges; auto-fixable findings are pre-checked
- **Phase 2** — after applying selected fixes, shows results with "Open generated process in new tab" for extracted sub-processes
- Supports dark and light HUD themes
- Example diagram "Customer Notification Flow" on the welcome screen demonstrates 4 finding types

## `optimize()` — Static BPMN Optimization Analyzer (2026-03-02) — `@bpmnkit/core`

New `optimize(defs, options?)` function exported from `@bpmnkit/core`:

- **11 finding types** across 3 categories: `feel`, `flow`, `task-reuse`
- **FEEL analysis**: detects empty conditions, missing default flows, complex expressions (length/nesting/operators/variables), complex IO mappings, duplicate expressions
- **Flow analysis**: detects unreachable elements, dead-end nodes, missing end events, redundant gateways, empty sub-processes
- **Task reuse**: clusters service tasks by similarity (taskType + headers + IO) and flags groups that can be extracted to reusable call activities
- **`applyFix`** on each applicable finding mutates `defs` in-place; task reuse fix returns a generated `BpmnDefinitions` for the extracted sub-process
- **Configurable thresholds** via `OptimizeOptions`: FEEL length/nesting/operator/variable thresholds, reuse group minimum size, category filter

## Storage-tabs integration bridge (2026-03-02) — `@bpmnkit/canvas-plugin-storage-tabs-bridge`

New package that wires storage and tabs together so client apps don't need to manually manage the cross-plugin state:

- **`createStorageTabsBridge(options)`** — single factory that creates `tabsPlugin`, `storagePlugin`, and `bridgePlugin` pre-wired together
- **Tab↔file maps** — automatically tracks which tab corresponds to which storage file; handles project open/leave/rename
- **MRU tracking** — per-project most-recently-used file list; loaded on project open, updated on tab activate
- **File-search commands** — registers "Switch to file" and "Rename current file" commands in the command palette (when `palette` option provided)
- **Ctrl+E file switcher** — full keyboard-navigable switcher overlay; E to cycle, Tab/→ to search mode, Ctrl-release to commit
- **Auto-save** — wires `onTabChange` to `storageApi.scheduleSave` for DMN/Form tabs
- **Built-in download** — serializes BPMN/DMN/Form and triggers browser download (overridable)
- **Built-in recent projects** — maps `storageApi.getRecentProjects()` to welcome screen dropdown
- **`persistTheme`** on `BpmnEditor` — reads/writes `localStorage "bpmn-theme"` automatically
- **`enableFileImport`** on `createTabsPlugin` — built-in hidden file input + drag-and-drop; `api.openFilePicker()` to trigger programmatically
- **`Bpmn.makeEmpty()` / `Bpmn.SAMPLE_XML`** — convenience factories in `@bpmnkit/core`
- **`Dmn.makeEmpty()`** — returns minimal `DmnDefinitions` with one empty decision table

## DMN DRD Canvas (2026-03-01) — `@bpmnkit/canvas-plugin-dmn-editor` + `@bpmnkit/core`

- **Full DRG element model** — `DmnInputData`, `DmnKnowledgeSource`, `DmnBusinessKnowledgeModel`, `DmnTextAnnotation`, `DmnAssociation`, all three requirement types (`DmnInformationRequirement`, `DmnKnowledgeRequirement`, `DmnAuthorityRequirement`), waypoints, and diagram edges
- **Parser/serializer roundtrip** — all DRG elements, requirement child elements, and DMNDI edges (with `di:waypoint`) are parsed and serialized; `decisionTable` is now optional on decisions
- **Interactive SVG DRD canvas** — pan/zoom, drag-to-move nodes, connect mode, inline label editing, keyboard delete, auto-layout for nodes without diagram positions
- **5 node shapes**: Decision (rect), InputData (stadium), KnowledgeSource (wavy-bottom rect), BKM (clipped-corner rect), TextAnnotation (open bracket)
- **4 edge types**: InformationRequirement (solid filled arrow), KnowledgeRequirement (dashed open-V arrow), AuthorityRequirement (dashed + open circle), Association (dotted)
- **Toolbar**: add node buttons for each type, Connect tool, zoom controls
- **DRD as primary view** — opening a DMN file shows the DRD canvas; double-click a Decision → decision table; "← DRD" back button returns to DRD
- **Zero external dependencies** — pure TypeScript/DOM SVG rendering

## Form Editor drag-and-drop redesign (2026-02-28) — `@bpmnkit/canvas-plugin-form-editor`

- Three-panel layout: Palette (260px fixed) | Canvas (flex, scrollable) | Properties (300px fixed)
- **Palette**: 5 groups (Input, Selection, Presentation, Containers, Action); icon grid; live search; click or drag to add
- **Canvas**: card-based visual form preview; drop zones between cards; empty state; nested containers with inner drop zones
- **Drag-and-drop**: native HTML5 DnD; palette→canvas (copy), card→card (move); drop-zone highlight; self-move prevention
- **Component previews**: per-type non-interactive previews (faux input, textarea, select, checkbox, radio, button, badge, separator, spacer, image)
- **Properties panel**: colored icon header; label/key/required/text/expression/options inputs; label updates preview live without refocusing
- **CSS**: light theme by default; dark via `.dark` class; `--fe-*` CSS variables

## DMN Editor feature parity (2026-02-28) — `@bpmnkit/canvas-plugin-dmn-editor`

- Single-row column headers with "When"/"And" (inputs) and "Then"/"And" (outputs) clause labels
- Hit policy in table corner — abbreviated (U/F/A/P/C/C+/C</C>/C#/R/O); select overlay to change
- Collect aggregation: C, C+ (SUM), C< (MIN), C> (MAX), C# (COUNT)
- TypeRef dropdown per column — editable; round-trips through XML
- Annotations column bound to `rule.description`
- Context menu — right-click row number: add above/below/remove; right-click column header: add left/right/remove
- Double border separating input from output sections
- Light theme as default; dark theme via `.dark` class
- `DmnAggregation` type added to `@bpmnkit/core`; parsed and serialized in `aggregation` XML attribute

## DMN Editor + Form Editor (2026-02-27) — `@bpmnkit/canvas-plugin-dmn-editor` + `@bpmnkit/canvas-plugin-form-editor`

- **`@bpmnkit/canvas-plugin-dmn-editor`** — native editable decision table; zero external dependencies
  - **`DmnEditor`** class with `loadXML(xml)`, `getXML()`, `onChange(handler)`, `destroy()` API
  - Parses XML via `Dmn.parse`; serializes on demand via `Dmn.export`; model kept in memory
  - Editable decision name + hit policy dropdown per decision
  - Add / remove input columns, output columns, and rules (rows)
  - Each cell is a `<textarea>` bound directly to the model; structural changes trigger full re-render from model
  - CSS injected via `injectDmnEditorStyles()` — `--dme-*` CSS variables; dark default / `.light` override pattern

- **`@bpmnkit/canvas-plugin-form-editor`** — native two-panel form component editor; zero external dependencies
  - **`FormEditor`** class with `loadSchema(schema)`, `getSchema()`, `onChange(handler)`, `destroy()` API
  - Parses schema via `Form.parse`; exports via `Form.export`
  - Left panel: component list with type badge, label, up/down reorder, delete; nested containers shown indented
  - Right panel: property editor for selected component (label, key, required, options list, etc.)
  - "Add" dropdown grouped by Fields / Display / Advanced / Layout; all standard form component types supported
  - CSS injected via `injectFormEditorStyles()` — `--fe-*` CSS variables; dark default / `.light` override pattern

- **Tabs plugin wired for editing** — `@bpmnkit/canvas-plugin-tabs` mounts `DmnEditor` / `FormEditor`; `tab.config` kept in sync on every change
  - **`onTabChange(tabId, config)`** callback — fires whenever a DMN or Form tab's content changes; used for auto-save
  - Cleanup on tab close / `destroy()`

- **Auto-save wired in landing app** — `onTabChange` triggers `storagePlugin.api.scheduleSave()` for DMN and Form tabs

## IndexedDB Storage Plugin (2026-02-26, overhauled 2026-02-27) — `@bpmnkit/canvas-plugin-storage`

- **`@bpmnkit/canvas-plugin-storage`** — persists BPMN / DMN / Form files in the browser's IndexedDB in a `workspace → project → files` hierarchy
  - **Native IndexedDB** — zero-dependency wrapper; supports `get/add/update/delete`, `orderBy`, `where().equals()` with `toArray/sortBy/delete`, and `filter`
  - **6 record types**: `WorkspaceRecord`, `ProjectRecord`, `FileRecord` (with `isShared` and `gitPath`), `FileContentRecord`, `ProjectMruRecord` (per-project Ctrl+Tab history)
  - **Auto-save** — 500 ms debounce triggered by `diagram:change`; forced flush on page hide / `beforeunload`; multi-tab safe; bumps project `updatedAt` on each save
  - **Main-menu integration** — workspace/project navigation via drill-down menu (no sidebar); "Open Project", "Save All to Project", "Leave Project" actions in the ⋮ menu
  - **Welcome screen on load** — always shows welcome screen on startup; no auto-restore; `getRecentProjects()` provides top-10 recently-saved projects for the welcome dropdown
  - **`onLeaveProject` callback** — called when "Leave" is clicked; wired to close all tabs and show the welcome screen
  - **Export project as ZIP** — "Export Project…" in the main menu downloads a `.zip` of all project files; built-in CRC-32 + ZIP STORE implementation, no external dependencies
  - **Shared files** — any file can be marked `isShared: true` to make it accessible for cross-workspace reference resolution
  - **GitHub-sync ready** — every `FileRecord` carries a `gitPath: string | null` field reserved for future bidirectional GitHub sync
  - **`createStoragePlugin(options)`** returns `CanvasPlugin & { api: StorageApi }`; requires `mainMenu` and `getOpenTabs` options
  - **Project mode** — when a project is open: tabs cannot be closed by the user; all project files are always open; "Rename current file…" appears in the main menu; `onRenameCurrentFile` callback updates the tab display name
  - **MRU per project** — `getMru(projectId)` / `pushMruFile(projectId, fileId)` persist the most-recently-used file order in IndexedDB; used for Ctrl+Tab switching

## Main Menu Plugin (enhanced 2026-02-26, restyled 2026-02-27) — `@bpmnkit/canvas-plugin-main-menu`

- **`MainMenuApi`** — programmatic API: `setTitle(text)` updates title span; `setDynamicItems(fn)` injects items on every open
- **`MenuDrill`** — drill-down menu items with back-navigation stack; clicking drills into sub-menu; "← Back" button returns to parent
- **`MenuInfo`** — passive info row with optional action button (e.g. "Leave" for active project indicator)
- Theme picker now behind a "Theme" drill item instead of flat in root dropdown
- **Integrated into tab bar** — panel is flush with the tab bar (right-anchored, 36px tall, matching dark/light background colors); auto-reserves 160px via CSS `:has()` so the tab labels are never hidden behind it

## BPMN Element Config — Event Types (2026-02-27) — `@bpmnkit/canvas-plugin-config-panel-bpmn`

- **Timer events** — timerStartEvent, timerCatchEvent, timer boundaryEvent: "Timer type" select (Cycle / Duration / Date) + FEEL expression field for the chosen type; writes `BpmnTimerEventDefinition`
- **Message events** — messageStartEvent, messageCatchEvent, messageEndEvent, messageThrowEvent, message boundaryEvent, receiveTask: "Message name" + "Correlation key" FEEL fields; writes `zeebe:message` extension element
- **Signal events** — signal start/catch/throw/end events and signal boundaryEvent: "Signal name" FEEL field; writes `zeebe:signal` extension element
- **Error events** — errorEndEvent and error boundaryEvent: "Error code" FEEL field; writes `zeebe:error` extension element
- **Escalation events** — escalation end/throw/catch events and escalation boundaryEvent: "Escalation code" FEEL field; writes `zeebe:escalation` extension element
- **Conditional events** — conditionalStartEvent, conditionalCatchEvent, conditional boundaryEvent: "Condition expression" FEEL field; writes `BpmnConditionalEventDefinition.condition`
- **Intermediate events** — all intermediate catch/throw events with any of the above definitions show the matching schema; plain intermediate events show name + documentation
- **Boundary events** — all boundary event variants (timer/message/signal/error/escalation/conditional) show their respective event-specific schemas; `boundaryEvent` type is now registered
- **General element coverage** — `subProcess`, `transaction`, `manualTask`, `task` (generic), `complexGateway` added; all show name + documentation

## BPMN Element Config — Call Activity, Script Task, Sequence Flow (2026-02-26, updated 2026-02-26)

- **Call activity** — configure `zeebe:calledElement processId` and `propagateAllChildVariables` in the config panel; "Select process…" button picks from open BPMN tabs; "New process" button creates a new blank BPMN and auto-links it; optional "Open Process ↗" action button navigates to the matching BPMN tab; navigate icon button in the element toolbar (HUD) above a selected call activity
- **Script task** — configure `zeebe:script expression` (FEEL expression, textarea) and `resultVariable`; replaces the generic name-only panel
- **Sequence flow condition expression** — clicking any sequence flow (edge) opens the config panel showing an editable `conditionExpression` FEEL textarea; works for gateway outgoing edges and any other flows; empty expression removes the condition element from the XML

## FEEL Language Support (2026-02-26) — `@bpmnkit/feel` + `@bpmnkit/canvas-plugin-feel-playground`

- **`@bpmnkit/feel`** — pure TypeScript FEEL engine; zero runtime dependencies; works in Node.js and browser
  - **Lexer** — position-aware tokenizer with full FEEL token set (temporal literals, backtick names, `..`, `**`, comments)
  - **Parser** — Pratt parser; `parseExpression()` and `parseUnaryTests()` entry points; greedy multi-word name resolution; error recovery
  - **Evaluator** — tree-walking evaluator; three-valued logic; ~60 built-in functions (string, numeric, list, context, temporal, range)
  - **Formatter** — pretty printer with configurable line-length-aware wrapping
  - **Highlighter** — `annotate()` / `highlightToHtml()` / `highlightFeel`; semantic token classification
- **`@bpmnkit/canvas-plugin-feel-playground`** — interactive FEEL panel in the editor
  - Expression and Unary-Tests modes; syntax-highlighted textarea; JSON context input; live evaluation; theme-aware (light/dark)
  - Opens as a full tab via `tabsPlugin.api.openTab({ type: "feel" })` — accessible from the command palette (Ctrl+K), the ⋯ main menu, and the welcome screen
  - `buildFeelPlaygroundPanel(onClose?)` exported for embedding in any container; `createFeelPlaygroundPlugin()` retained as a standalone overlay variant
- **`@bpmnkit/canvas-plugin-dmn-viewer` migration** — `feel.ts` now re-exports from `@bpmnkit/feel`; DMN cell highlighting uses the full FEEL highlighter

## Welcome Screen Examples (2026-02-26, updated 2026-02-27) — `@bpmnkit/canvas-plugin-tabs` + `apps/landing`

- **"Open recent" dropdown** — `getRecentProjects` option renders a dropdown button below "Import files…"; shows up to 10 most recently saved projects (Workspace / Project format); disabled when none; rebuilt on each welcome screen show
- **Dynamic sections on welcome screen** — `getWelcomeSections` option accepts a `() => WelcomeSection[]`; rebuilt on each show
- **Example entries on welcome screen** — the `examples` option accepts a `WelcomeExample[]`; each entry has a badge (BPMN / DMN / FORM / MULTI), label, optional description, and an `onOpen()` callback
- **4 built-in examples in the landing app**:
  - *Order Validation* (BPMN) — linear service-task flow
  - *Shipping Cost* (DMN) — FIRST hit-policy decision table: weight × destination
  - *Support Ticket* (FORM) — subject, category, priority, description, attachment
  - *Loan Application Flow* (MULTI) — BPMN + Credit Risk DMN + Application Form; opens all three tabs and registers resources in the resolver

## Welcome Screen + Grouped Tabs (2026-02-26, updated 2026-02-27) — `@bpmnkit/canvas-plugin-tabs`

- **Welcome screen** — shown when no tabs are open (and always on initial load); centered card with BPMN icon, title, "New diagram", "Import files…", and optional "Open recent" dropdown button; theme-aware (light/dark); `onNewDiagram` / `onImportFiles` / `onWelcomeShow` option callbacks
- **Plugin-managed tab XML** — subscribes to `diagram:change` internally; keeps `tab.config.xml` up to date for all open BPMN tabs; eliminates the need for client apps to track per-tab XML manually
- **Plugin-managed process tracking** — automatically parses BPMN XML on `openTab` and `diagram:change`; exposes `navigateToProcess(id)`, `getAvailableProcesses()`, `getAllTabContent()`, `closeAllTabs()` on `TabsApi`
- **Raw source toggle** — `</>` icon button in the bottom-left HUD panel; overlays a monospace `<pre>` with BPMN XML / DMN XML / Form JSON; stays in sync with live edits; disabled for FEEL tabs; button exposed via `TabsApi.rawModeButton` and placed in the HUD by `initEditorHud()`
- **Grouped tabs** — at most 3 tabs in the bar (one per type: BPMN, DMN, FORM); each group tab shows the active file name and a type badge; chevron opens a dropdown listing all files of that type; per-file close buttons in dropdown; close button on tab itself when group has only one file

## Multi-file Import + Tab Navigation in Editor (2026-02-26) — `apps/landing` + `canvas-plugins/*`

- **Import files via menu** — "Import files…" in the top-right menu opens a file picker accepting `.bpmn`, `.xml`, `.dmn`, `.form`, `.json`; each file opens in a separate tab
- **Drag-and-drop import** — drop any supported file onto the canvas to open it in a new tab
- **BPMN tab switching** — clicking a BPMN tab loads that diagram into the editor; BPMN panes are transparent so the editor canvas shows through
- **DMN/Form cross-navigation** — "Open Decision ↗" / "Open Form ↗" buttons in the config panel open the referenced file in a tab using the same `InMemoryFileResolver` populated by imports
- **`menuItems` option** added to main-menu plugin for injecting custom actions above the Theme section

## DMN Viewer + Form Viewer + Tabs Plugin (2026-02-26)

### `@bpmnkit/canvas-plugin-dmn-viewer`
- **Read-only DMN decision table viewer** — renders any `DmnDefinitions` as an HTML table; hit policy badge; input/output columns with type annotations
- **FEEL syntax highlighting** — tokenizes FEEL expressions in decision cells; colors keywords, strings, numbers, operators, ranges, function calls
- **Light/dark/auto themes** via CSS custom properties
- **`createDmnViewerPlugin(options)`** — canvas plugin wrapper; opens DMN viewer on click of call activities with `zeebe:calledDecision`

### `@bpmnkit/canvas-plugin-form-viewer`
- **Read-only Form viewer** — renders all 21 Camunda Form component types; built entirely in-repo (no `@bpmn-io/form-js` dependency)
- **Row-based grid layout** — respects `layout.row` grouping from the form schema
- **`createFormViewerPlugin(options)`** — canvas plugin wrapper; opens Form viewer on click of user tasks with `zeebe:formDefinition`

### `@bpmnkit/canvas-plugin-tabs`
- **Tab bar overlay** — fixed tab strip inside the canvas container for BPMN/DMN/Form tabs
- **`FileResolver` abstraction** — pluggable interface for resolving file references; `InMemoryFileResolver` default; designed for future FS/SaaS backends
- **`TabsApi`** — programmatic `openDecision(id)` / `openForm(id)` + full tab lifecycle management
- **Warning badge** — shown when a referenced DMN/Form file is not registered
- **Close-tab download prompt** — closing a tab with in-memory content shows a dialog (Cancel / Close without saving / Download & Close); the download callback serializes BPMN/DMN/Form to their respective formats and triggers a browser file download

### `@bpmnkit/core` — Extended form and Zeebe model
- **13 new Form component types** — number, datetime, button, taglist, table, image, dynamiclist, iframe, separator, spacer, documentPreview, html, expression, filepicker; `FormUnknownComponent` catch-all
- **`ZeebeFormDefinition`** and **`ZeebeCalledDecision`** typed interfaces in `ZeebeExtensions`

### `@bpmnkit/canvas-plugin-config-panel` + `config-panel-bpmn`
- **`"action"` FieldType** — clickable button fields in the config panel with `onClick` callback
- **Typed userTask panel** — `formId` field + "Open Form ↗" button wired to the tabs plugin
- **Typed businessRuleTask panel** — `decisionId` + `resultVariable` fields + "Open Decision ↗" button wired to the tabs plugin

## SubProcess Containment + Sticky Movement (2026-02-25) — `@bpmnkit/editor`
- **Sticky movement** — moving a subprocess moves all descendant shapes with it
- **Containment on create** — shapes dropped inside a subprocess become children in the BPMN model
- **Cascade delete** — deleting a subprocess removes all descendants from both the model and DI
- **Recursive label/connection updates** — renaming and connecting works for elements at any nesting depth

## Agentic AI Subprocess (2026-02-25) — `@bpmnkit/editor` + `@bpmnkit/canvas-plugin-config-panel-bpmn` + `@bpmnkit/core`
- **`adHocSubProcess` creatable in the editor** — appears in the Activities palette group (with tilde icon); 200×120 default size; resizable; type-switchable via `changeElementType`
- **AI Agent template wired end-to-end** — selecting the `io.camunda.connectors.agenticai.aiagent.jobworker.v1` template in the config panel's "Template" dropdown writes `zeebe:taskDefinition type="io.camunda.agenticai:aiagent-job-worker:1"`, `zeebe:adHoc outputCollection="toolCallResults"` + `outputElement` FEEL expression, and all required IO mappings and task headers; `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` are stamped on the element
- **`ZeebeAdHoc` typed interface** in `@bpmnkit/core` — `outputCollection`, `outputElement`, `activeElementsCollection`; `zeebeExtensionsToXmlElements` serialises it
- **`zeebe:adHoc` template binding** — `TemplateBinding` union extended; template engine reads/writes all three `zeebe:adHoc` properties correctly
- **Template-aware config panel for `adHocSubProcess`** — shows "Custom" or AI Agent template selector; `resolve()` delegates to full template form when template is active; clearing the template removes all modelerTemplate attributes

## Config Panel: Template Adapter Fix + Required Field Indicators (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel` + `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **Template adapter bug fixed** — changing any field while a connector template was active reverted the panel to the generic service task form (the write path used the base adapter which strips `zeebe:modelerTemplate`); now correctly uses the template-resolved adapter for all writes
- **Required field asterisk** — fields with `constraints.notEmpty: true` in connector templates show a red `*` next to the label
- **Required field red border** — input/select/textarea gets a red border when a required field is empty; clears as soon as the user enters a value

## Connector Template Icons in Canvas (2026-02-25) — `@bpmnkit/canvas` + `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **Template icon rendering** — when a service task has `zeebe:modelerTemplateIcon` set (data URI from the connector template), the canvas renderer displays it as an SVG `<image>` in the top-left icon slot instead of the generic gear icon; works for all 116 Camunda connectors
- **Icon stamped on apply** — the config panel template engine writes `zeebe:modelerTemplateIcon` to the BPMN element whenever a connector template is applied, so the icon persists in the saved XML

## Connector Templates + Core Builder Integration (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **`templateToServiceTaskOptions(template, values)`** — converts any of the 116 connector templates into `ServiceTaskOptions` for the `Bpmn` builder; use any connector programmatically without hand-crafting extension XML
- **`CAMUNDA_CONNECTOR_TEMPLATES`** exported from the public API — find templates by id or name for programmatic use

## All 116 Camunda Connector Templates (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn`
- **`pnpm update-connectors`** — fetches all OOTB templates from the Camunda marketplace and regenerates `canvas-plugins/config-panel-bpmn/src/templates/generated.ts`
- **116 connectors** available in the connector selector: REST, Slack, Salesforce, ServiceNow, GitHub, Twilio, AWS EventBridge/Lambda/SQS/SNS, Azure, Google Sheets, WhatsApp, Facebook Messenger, and 100+ more
- **Template-ID-keyed selector** — each connector has its own distinct dropdown entry regardless of whether multiple connectors share the same underlying task definition type

## Element Templates System (2026-02-25) — `@bpmnkit/canvas-plugin-config-panel-bpmn` + `@bpmnkit/canvas-plugin-config-panel`
- **Camunda element template types** — full TypeScript type definitions (`ElementTemplate`, `TemplateProperty`, `TemplateBinding`, `TemplateCondition`) matching the Camunda zeebe-element-templates-json-schema
- **Template engine** — `buildRegistrationFromTemplate(template)` converts any element template descriptor to a `PanelSchema` + `PanelAdapter` pair; all binding types, condition types, and property types supported
- **REST Outbound Connector** — official Camunda template (`io.camunda.connectors.HttpJson.v2` v12) bundled; 8 groups, 5 auth modes (noAuth, API key, Basic, Bearer, OAuth 2.0), full output/error/retry configuration
- **Dynamic schema resolution** — `PanelAdapter.resolve?()` hook: config panel switches to the template-specific form when `zeebe:modelerTemplate` is present; re-renders on diagram change without losing state
- **`registerTemplate(template)`** — runtime API to register additional connector templates
- **`restConnector()` builder** — now stamps `zeebe:modelerTemplate` so programmatically-generated BPMN is recognized by the editor's template panel automatically

## Event Subgroups, Boundary Events & Ghost Fix (2026-02-25) — `@bpmnkit/editor`
- **3 event palette groups** — Start Events (5), End Events (7), Intermediate Events (10); each group contains only compatible types for type-switching
- **20 specific event palette types** — every BPMN event variant has a dedicated `CreateShapeType` with preset event definition; icons show the appropriate marker inside the ring
- **Boundary events** — any intermediate event type can be attached to an activity by hovering over it during creation; dashed blue highlight indicates attachment target; the event is positioned on the nearest boundary edge; boundary events move and delete with their host
- **Ghost shape preview** — the ghost preview now renders the correct shape for every element type (double ring for intermediate events, correct ring weight for start/end, diamond for gateways, bracket for annotations)
- **Type-switch restriction** — the configure toolbar only shows types within the same event subgroup; start, end, and intermediate events cannot be changed to each other
- **Escape to cancel** — canvas host auto-focuses when a create tool is activated, so Escape always cancels creation

## Full BPMN Element Type Coverage (2026-02-25) — `@bpmnkit/core` + `@bpmnkit/canvas` + `@bpmnkit/editor`
- **New core model types** — `BpmnTask`, `BpmnManualTask`, `BpmnTransaction`, `BpmnComplexGateway`; `BpmnLane`/`BpmnLaneSet` swimlane hierarchy; `BpmnMessageFlow` for inter-pool communication; five new event definition types (conditional, link, cancel, terminate, compensate)
- **Pool & lane rendering** — pools and lanes render as container rects with rotated title bars; correct nesting in the renderer
- **Message flow rendering** — dashed inter-pool arrows between participants
- **Non-interrupting boundary events** — dashed inner ring distinguishes non-interrupting from interrupting boundary events
- **Transaction subprocess** — double inner border distinguishes transaction subprocesses
- **New event markers** — conditional, link, cancel, terminate, compensate; complete event marker set
- **Complex gateway** — asterisk marker; added to creatable types with proper default bounds
- **21 element creation commands** — command palette and shape palette updated to cover all standard BPMN elements

## Element Colors & Text Annotations (2026-02-25) — `@bpmnkit/editor` + `@bpmnkit/canvas` + `@bpmnkit/core`
- **Shape colors** — `bioc:fill`/`bioc:stroke` (bpmn-js) and `color:background-color`/`color:border-color` (OMG) attributes rendered as inline fill/stroke on shape bodies; fully round-trips through import/export
- **Color picker** — 6 preset color swatches in the contextual toolbar for any selected flow element; clicking active swatch clears the color
- **Text annotations** — `BpmnTextAnnotation` text rendered inside the bracket shape; correct in both viewer and editor
- **Create annotation** — "Text Annotation" tool in the shape palette (Annotations group); click canvas to place; label editor opens immediately
- **Linked annotation** — "Add annotation" button in contextual toolbar creates an annotation linked to the selected shape via a `BpmnAssociation` edge
- **Annotation editing** — double-click annotation to edit its text; standard label editor
- **Cascade delete** — deleting a flow element also removes linked associations and their DI edges; deleting an annotation removes the association edges pointing to it
- **Association move** — moving a shape recomputes association edge waypoints
- **`DiColor` helpers** — `readDiColor`, `writeDiColor`, `BIOC_NS`, `COLOR_NS` exported from `@bpmnkit/core`

## BPMN Diagram Editor (2026-02-23) — `@bpmnkit/editor`
- **Full diagram editing** — create, move, resize, connect, delete, label-edit, undo/redo, copy/paste; type switching within BPMN groups
- **Edge split on drop** — drag a shape over a sequence flow to highlight it (green); release to insert the shape between source and target, splitting the edge
- **Configure bar (above element)** — shows all element types in the same BPMN group for quick type switching; label position picker for events and gateways
- **Group toolbar** — bottom toolbar shows one button per BPMN group (Events, Activities, Gateways); click to use last-selected type; long-press (500ms) opens a horizontal picker with all types in the group; standard BPMN notation icons throughout
- **`changeElementType(id, newType)`** — changes a flow element's type while preserving id, name, and connections
- **Orthogonal edges** — all sequence flows rendered as H/V-only Z-shaped paths; routes recomputed on shape move; endpoint repositioning via drag
- **Obstacle-avoiding edge routing** — new edges automatically route around existing shapes by trying all 16 port combinations and picking the first non-intersecting route
- **Edge segment drag** — hover over an edge segment to reveal a blue dot (projected cursor position) and a resize cursor (`ns-resize` for horizontal, `ew-resize` for vertical); drag perpendicularly to move the entire segment while keeping adjacent segments orthogonal
- **Edge waypoint insertion** — drag an edge at a shallower (more parallel) angle to insert a free-form bend point; diagonal edges allowed for waypoint insertion only
- **Edge endpoint repositioning** — click edge to select; drag start/end balls to reposition on source/target port (top/right/bottom/left); route recomputed via port-aware orthogonal routing
- **External label positions** — events and gateways show labels outside the shape; 8 positions via `setLabelPosition(id, pos)`; contextual toolbar compass icon to choose
- **Magnet snap** — shapes snap to aligned edges/centers of neighbors during drag; blue dashed guide lines shown
- **Contextual toolbar** — arrow icon to draw freehand connections; quick-add buttons for connected elements; label position picker for events/gateways
- **Tool system** — `setTool("select" | "pan" | "space" | "create:serviceTask" | ...)` with `editor:tool` event
- **Space tool** — click-and-drag to push elements apart; drag right/left to move elements in that half, drag up/down to move elements in that half; axis locks after 4px; amber dashed guide line shown; edges remain connected
- **Selection** — click, shift-click, rubber-band box-select; `setSelection(ids)` API; `editor:select` event; edge selection independent of shape selection
- **Undo/redo** — snapshot-based `CommandStack` (100 entries); `canUndo()` / `canRedo()` queries
- **Inline label editing** — double-click activates `contenteditable` div positioned over the shape
- **Copy/paste** — clipboard preserves inter-element flows; all IDs regenerated on paste with configurable offset
- **Export** — `exportXml()` returns BPMN 2.0 XML; `loadDefinitions(defs)` for programmatic model loading
- **Plugin compatibility** — identical `CanvasApi`; minimap and other canvas plugins work unchanged
- **Keyboard shortcuts** — Delete (shapes and edges), Ctrl+Z/Y, Ctrl+A, Ctrl+C/V, Escape
- **Events** — `diagram:change`, `editor:select`, `editor:tool` extend `CanvasEvents`

## Watermark Plugin (2026-02-25) — `@bpmnkit/canvas-plugin-watermark`
- **Attribution bar** — bottom-right overlay bar with configurable links and an optional square SVG logo; logo is always rightmost
- **`createWatermarkPlugin({ links?, logo? })`** — factory; `links` is an array of `{ label, url }` objects; `logo` is an SVG markup string
- Works with both canvas viewer and editor

## Canvas Plugins Workspace (2026-02-23) — `canvas-plugins/*`
- New pnpm workspace `canvas-plugins/*` for first-party canvas plugin packages
- **`@bpmnkit/canvas-plugin-minimap`** — minimap as an opt-in plugin; install via `plugins: [createMinimapPlugin()]`; handles `diagram:load`, `viewport:change`, `diagram:clear`; navigates via `CanvasApi.setViewport()`; fully self-contained CSS injection
- **`@bpmnkit/canvas-plugin-command-palette`** (2026-02-24) — Ctrl+K / ⌘K command palette; built-in commands: toggle theme, zoom to 100%/fit, export BPMN XML, zen mode; `addCommands(cmds)` extension point; works with both canvas viewer and editor
- **`@bpmnkit/canvas-plugin-command-palette-editor`** (2026-02-24) — editor extension plugin adding 21 BPMN element creation commands to the palette; requires `@bpmnkit/canvas-plugin-command-palette`
- **`@bpmnkit/canvas-plugin-config-panel`** (2026-02-24) — schema-driven property panel; `registerSchema(type, schema, adapter)` for extensible element forms; compact right-rail panel for single-element selection; 65%-wide full overlay with grouped tabs; auto-save on change; in-place value refresh preserves focus
- **`@bpmnkit/canvas-plugin-config-panel-bpmn`** (2026-02-24) — BPMN schemas for all standard element types; full Zeebe REST connector form for service tasks (method, URL, headers, body, auth, output mapping, retries)

## BPMN Canvas Viewer (2026-02-23) — `@bpmnkit/canvas`
- **Zero-dependency SVG viewer** — renders BPMN diagrams parsed by `@bpmnkit/core` with no external runtime deps
- **Framework-agnostic** — plain TypeScript/DOM; works in React, Vue, Svelte, or vanilla JS
- **Pan & zoom** — pointer-drag panning, mouse-wheel / two-finger pinch zoom, zoom-toward-cursor; RAF-batched at 60fps
- **Infinite dot-grid** — SVG `<pattern>` background that scrolls with the viewport
- **Minimap** — 160×100px overview; click-to-pan; synced viewport indicator rectangle
- **Themes** — `"light"` / `"dark"` / `"auto"` (follows `prefers-color-scheme`); implemented via CSS custom properties
- **Fit modes** — `"contain"` (scale to fit), `"center"` (1:1 centred), `"none"` (no auto-fit)
- **Accessibility** — `role="application"`, focusable shapes (Tab/Shift+Tab), keyboard pan/zoom/fit, Enter/Space to activate
- **Plugin system** — `CanvasPlugin` with `install(CanvasApi)` / `uninstall()` lifecycle
- **Events** — `diagram:load`, `diagram:clear`, `element:click`, `element:focus`, `element:blur`, `viewport:change`; `on()` returns unsubscribe fn
- **Zoom controls** — built-in +/−/⊡ buttons
- **Auto-refit** — ResizeObserver re-fits diagram on container resize
- **Small bundle** — 112KB JS / 25.95KB gzip

## Roundtrip Tests (2026-02-18)
- **34 example files tested** — 30 BPMN, 1 DMN, 3 Form files roundtrip through parse→export→re-parse
- **Typed model comparison** — validates semantic equivalence at the model level, not byte-level XML
- **XML-level roundtrip** — additional structural validation at the raw XML element tree level

## BPMN Support (2026-02-19)
- **Parse BPMN XML** — `Bpmn.parse(xml)` parses BPMN XML into a typed `BpmnDefinitions` model
- **Export BPMN XML** — `Bpmn.export(model)` serializes a `BpmnDefinitions` model back to BPMN XML
- **Fluent builder** — `Bpmn.createProcess(id)` creates processes with method chaining
- **Auto-layout** — `.withAutoLayout()` populates diagram interchange (shapes + edges) via Sugiyama layout engine
  - Opt-in: call `.withAutoLayout()` on `ProcessBuilder` before `.build()`
  - Without it, `diagrams` array remains empty (backward-compatible)
  - Handles gateway branches, sub-process containment, and orthogonal edge routing
  - Element sizing: events 36×36, tasks 100×80, gateways 36×36
  - Virtual grid: 200×160 cells with centered element placement
  - Baseline path alignment: process spine (start → gateways → end) shares same Y
  - L-shaped edge routing preferred over Z-shaped
  - Split gateways receive edges from left; join gateways from top/bottom/left based on position
  - Expanded sub-processes: containers with children are auto-sized and children laid out inside
  - Layout data survives export→parse→export round-trips
- **Gateway support** — exclusive, parallel, inclusive, event-based gateways with `branch(name, callback)` pattern
- **Auto-join gateways** — split gateways automatically get matching join gateways inserted when branches converge (BPMN best practice)
- **Loop support** — `connectTo(targetId)` for merge points and back-edge loops
- **Sub-process builders** — `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with nested content; `eventSubProcess()` emits canonical `<bpmn:subProcess triggeredByEvent="true">` with no illegal sequence flows; start events inside event sub-processes accept `isInterrupting: false` for non-interrupting triggers
- **Multi-instance** — parallel/sequential multi-instance with Zeebe extension elements
- **Aspirational elements** — sendTask, receiveTask, businessRuleTask builders
- **REST connector builder** — `restConnector(id, config)` convenience method generates service tasks with `io.camunda:http-json:1` task type, IO mappings (method, url, auth, body, headers, queryParameters, timeouts), and task headers (resultVariable, resultExpression, retryBackoff)
- **Extension preservation** — zeebe:*, modeler:*, camunda:* extensions roundtrip as `XmlElement[]`
- **Root-level messages** — `bpmn:message` elements parsed, preserved, and serialized at definitions level
- **Message start events** — builder creates proper `<bpmn:message>` root elements with ID references
- **Webhook/connector config** — `zeebe:properties` support for connector configuration (e.g. webhook inbound type, method, context)
- **Agentic AI sub-process** — `adHocSubProcess()` supports full AI agent pattern: `taskDefinition`, `ioMapping`, `taskHeaders`, `outputCollection`/`outputElement` on `zeebe:adHoc`, modeler template attributes
- **Call activity** — `callActivity(id, {processId, propagateAllChildVariables})` with `zeebe:calledElement` extension
- **Diagram interchange** — BPMNDI shapes and edges preserved on roundtrip

## Form Support (2026-02-18)
- **Parse Form JSON** — `Form.parse(json)` parses Camunda Form JSON into a typed `FormDefinition` model
- **Export Form JSON** — `Form.export(model)` serializes a `FormDefinition` model to JSON
- **8 component types** — text, textfield, textarea, select, radio, checkbox, checklist, group
- **Recursive groups** — nested group components with arbitrary depth

## DMN Support (2026-02-18)
- **Parse DMN XML** — `Dmn.parse(xml)` parses DMN XML into a typed `DmnDefinitions` model
- **Export DMN XML** — `Dmn.export(model)` serializes a `DmnDefinitions` model back to DMN XML
- **Fluent builder** — `Dmn.createDecisionTable(id)` creates decision tables with method chaining
- **Multi-output tables** — support for 2+ output columns per decision table
- **Hit policies** — UNIQUE (default), FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY
- **Roundtrip fidelity** — semantic equivalence preserved on parse→export cycle
- **Namespace preservation** — DMN, DMNDI, DC, modeler namespace declarations roundtrip correctly

## AIKit — Intent-Driven Process Automation (2026-04-04)

- **`/implement` skill** — Claude Code slash command: pattern lookup → BPMN generation → worker wiring → validation → coverage check → deploy prompt
- **`/review` skill** — validate any BPMN file, structured findings by severity, auto-fix offer
- **`/test` skill** — process structure analysis, worker coverage report, scenario suggestions
- **`/deploy` skill** — validation gate + deploy to local reebe or Camunda 8
- **`casen skills install`** — copies bundled skill files to `.claude/commands/` in any project
- **BPMNKit AIKit MCP server** (`bpmn-aikit` binary) — 11 MCP tools callable by Claude: `bpmn_create`, `bpmn_read`, `bpmn_update`, `bpmn_validate`, `bpmn_deploy`, `bpmn_simulate`, `bpmn_run_history`, `worker_list`, `worker_scaffold`, `pattern_list`, `pattern_get`
- **`@bpmnkit/patterns` package** — domain pattern library with 7 seed patterns: invoice-approval, employee-onboarding, supplier-contract-review, incident-response, loan-origination, content-moderation, order-fulfillment
- **Pattern schema** — each pattern includes: domain readme (regulations, conventions), compact BPMN template, worker specs with real API options, and common variations
- **Keyword-based pattern matching** — `findPattern(query)` matches user descriptions to patterns via keyword scoring
- **`@bpmnkit/worker-client` package** — thin Zeebe REST client for standalone workers; OAuth2 support for Camunda SaaS; `createWorkerClient()` + async `poll()` generator
- **Worker scaffolder** — `worker_scaffold` MCP tool generates TypeScript workers (`index.ts`) using `@bpmnkit/worker-client`; `tsx` for dev (no build step), `tsc` for production; multi-stage Docker in README
- **`casen worker start [name]`** — starts scaffolded workers from `./workers/` directory via `npm start`
- **`.claude/mcp.json`** — project-level MCP config registers `bpmnkit-aikit` server with Claude Code automatically

## Code Mode MCP Tools (2026-06-13)

Implements the Cloudflare Code Mode pattern: two meta-tools per domain replace enumerated API tools. The AI writes JS to introspect a spec, then writes JS to call the API.

### Camunda REST API (`camunda_search` + `camunda_execute`)
- **`camunda_search`** — runs arbitrary JS in a sandboxed V8 isolate (`isolated-vm`) with `CAMUNDA_SPEC` in scope (34 resource groups, 179 methods); returns whatever the code returns as JSON. Use to explore the API before executing.
- **`camunda_execute`** — runs arbitrary JS in a sandboxed V8 isolate with a `camunda` Proxy that routes `camunda.resource.method(args)` calls to a real `CamundaClient` on the host. Full Camunda REST API accessible in one tool.
- **`CAMUNDA_SPEC`** — auto-generated from `@bpmnkit/api` types; includes description, endpoint, params, returns for every method.
- **Sandbox** — `isolated-vm` V8 isolate per call; 64 MB memory limit; 5s timeout for search, 10s for execute; host never exposed beyond explicit `ivm.Reference` dispatch function.

### TypeScript SDK (`sdk_search` + `sdk_execute`)
- **`sdk_search`** — runs arbitrary JS in a Node `vm` context with `SDK_SPEC` in scope (5 SDK functions + compact diagram shape); returns whatever the code returns as JSON.
- **`sdk_execute`** — runs arbitrary JS with `sdk.{parse, exportXml, optimize, layout, analyzeVariables}` helpers bound to `@bpmnkit/core`; optional `xml` argument pre-loaded into context. Use to generate, transform, or analyze BPMN diagrams.
- **`SDK_SPEC`** — documents each SDK function with description, params, returns, usage example.
