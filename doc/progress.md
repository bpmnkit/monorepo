# Progress

## 2026-03-02 — Tauri desktop app

### `apps/desktop` — new Tauri v2 desktop application

- New `@bpmn-sdk/desktop` package: Vite frontend (same editor as landing) wrapped in a Tauri v2 native window
- **Tauri Rust backend** (`src-tauri/`): minimal setup — no plugins, just `std::process::Command` to spawn the AI server
- **AI server auto-start**: on launch, spawns `node ai-server.cjs` from the bundled resource directory; silently skipped if Node.js is unavailable or resource not present (dev mode)
- **Minimal binary**: `opt-level = "s"`, `lto = true`, `panic = "abort"`, `strip = true` — target ~3–5 MB installer vs 85+ MB for Electron
- **Vite config**: `port: 1420`, `clearScreen: false`, `src-tauri/**` excluded from watch
- **Icon generation**: `scripts/gen-icons.mjs` generates placeholder 32×128×256px PNGs using pure Node.js built-ins (`zlib.deflateSync`); replace with `pnpm tauri icon icon.png` for production
- **AI server bundling** (`@bpmn-sdk/ai-server`): new `bundle` script using `esbuild` produces `dist/bundle.cjs` — single-file CJS bundle with only Node.js built-in dependencies
- **Root scripts**: `desktop:dev` and `desktop:build` shortcuts; `@tauri-apps/cli` and `esbuild` added to root devDeps
- Tauri `src-tauri/` excluded from Biome linting via `biome.json`

### Run commands

- `pnpm desktop:dev` — open editor in a native window with hot-reload
- `pnpm desktop:build` — bundle ai-server + compile Rust + produce installer

## 2026-03-02 — Side dock refinements

### `packages/editor` — dock moved + redesigned

- Moved `dock.ts` from `apps/landing/src/` to `packages/editor/src/`; exported `createSideDock` + `SideDock` from `@bpmn-sdk/editor`
- **Collapse handle redesign**: replaced tab-strip button with a 20×52px pill handle anchored at `left: -20px; top: 50%` on the dock's left edge — always visible and accessible
- **Collapse fix**: set `el.style.width` directly in `collapse()`/`expand()` to override inline style; `--collapsed` CSS class now only hides tab-strip + panes
- **Resize fix**: disable `transition: width` on mousedown, restore on mouseup — instantaneous drag feedback
- **Watermark fix**: set `--bpmn-dock-width` CSS variable on `document.body`; dock CSS overrides `.bpmn-watermark { right: calc(var(--bpmn-dock-width) + 8px) }` so watermark always stays left of dock
- **Empty state info**: Properties pane shows File and Process name rows when no element is selected; `dock.setDiagramInfo(processName, fileName)` updates them; `dock.showPanel()`/`hidePanel()` replace direct `propertiesEmptyState` manipulation
- `SideDock` API: removed `propertiesEmptyState`; added `showPanel()`, `hidePanel()`, `setDiagramInfo()`

### `apps/landing/src/editor.ts`

- Import `createSideDock` from `@bpmn-sdk/editor` (no longer local file)
- Use `dock.showPanel()`/`dock.hidePanel()` in config panel callbacks
- Track `currentFileName` from `onTabActivate`; update `dock.setDiagramInfo()` on tab change and `diagram:change`

## 2026-03-02 — Unified right sidebar dock

### `apps/landing` — `dock.ts` new module

- Added `createSideDock()` factory returning a `SideDock` with Properties and AI tabs
- Width-based collapse (38px strip when collapsed; full width when expanded) with smooth `transition: width 0.22s ease`
- Resize handle on left edge: drag to resize 280–700px; persists to `localStorage` (`bpmn-side-dock-width`)
- Collapsed state persisted to `localStorage` (`bpmn-side-dock-collapsed`); restored on page load
- Collapse button stays visible in the 38px strip so the dock can always be re-expanded manually
- Dark default + `[data-bpmn-hud-theme="light"]` overrides

### `@bpmn-sdk/canvas-plugin-config-panel` — hosted mode

- `ConfigPanelOptions` gains `container?`, `onPanelShow?`, `onPanelHide?` optional fields
- `ConfigPanelRenderer` constructor gains `opts?` bag for the three new fields
- In hosted mode (`container` set): adds `bpmn-cfg-full--hosted` class, skips standalone resize handle and collapse button, appends to `container` instead of `document.body`
- `onPanelShow` called after panel is appended; `onPanelHide` called after panel is removed
- CSS: `.bpmn-cfg-full--hosted` overrides `position: static`, suppresses standalone controls

### `@bpmn-sdk/canvas-plugin-ai-bridge` — docked mode

- `AiBridgePluginOptions` gains `container?` and `onOpen?` optional fields
- In docked mode: panel gets `ai-panel--docked` class, appended to `container`; button click calls `onOpen?.()` then `p.open()` (no toggle)
- CSS: `.ai-panel--docked` overrides `position: static` + `transform: none`, always `display: flex`; hides standalone close button

### `apps/landing/src/editor.ts`

- Imports and creates `SideDock`; appends to `document.body`
- `configPanel` wired with `container: dock.propertiesPane` + `onPanelShow` / `onPanelHide` callbacks
- `aiBridgePlugin` wired with `container: dock.aiPane` + `onOpen` callback
- Element selected → dock expands, Properties tab active, empty state hidden
- AI button clicked → dock expands, AI tab active

## 2026-03-02 — AI chat backend selector + bug fixes

### `canvas-plugin-ai-bridge` — backend selector

- Added `<select>` dropdown (Auto / Claude / Copilot) to the AI panel header
- Selection persisted in `localStorage` (`bpmn-sdk-ai-backend`); passed as `backend` field in POST body
- Added `.ai-backend-select` CSS (dark + light theme)

### `ai-server` — multi-backend detection

- `/status` now detects **all** available adapters in parallel and returns `{ ready, backend, available: string[] }`
- `/chat` accepts optional `backend` field in body; picks requested adapter, falls back to first available

### Bug fixes

- Fixed SSE error field mismatch: server sends `{ type: "error", message: "..." }` but client was reading `event.text` → now reads `event.message ?? event.text ?? "AI error"`
- Fixed double "Error:" prefix in error display: `err instanceof Error ? err.message : String(err)` instead of `` `Error: ${String(err)}` ``

## 2026-03-02 — AI integration

### Compact BPMN format in `@bpmn-sdk/core`

New token-efficient representation for AI contexts (5-10x smaller than raw XML):

- **Created** `packages/bpmn-sdk/src/bpmn/compact.ts` — `compactify(defs): CompactDiagram` and `expand(compact): BpmnDefinitions`
- `CompactDiagram` → `{ id, processes: [{ id, name?, elements, flows }] }`
- `CompactElement` → `{ id, type, name?, jobType?, calledProcess?, formId?, decisionId?, eventType?, attachedTo? }`
- `CompactFlow` → `{ id, from, to, name?, condition? }`
- `expand()` auto-lays-out the process via `layoutProcess()` and builds a full `BpmnDefinitions` with DI
- Exported from `@bpmn-sdk/core` main index

### Layout + ELEMENT_SIZES exported from `@bpmn-sdk/core`

- Added `layoutProcess`, `layoutFlowNodes`, `ELEMENT_SIZES`, and layout types (`Bounds`, `LayoutNode`, `LayoutEdge`, `LayoutResult`, `Waypoint`) to main `packages/bpmn-sdk/src/index.ts`

### `StorageApi.getCurrentContext()`

- **Modified** `canvas-plugins/storage/src/storage-api.ts` — new `getCurrentContext(): { projectId: string; fileId: string } | null` public method

### New `apps/ai-server`

Local HTTP server bridging the editor to CLI-based AI tools:

- **Created** `apps/ai-server/` — private Node.js ESM package
- `GET /status` → `{ ready: boolean, backend: "claude" | "copilot" | null }`
- `POST /chat` → SSE stream: `{"type":"token","text":"..."}` events → `{"type":"done"}`
- Claude adapter: spawns `claude -p "..." --output-format stream-json`, parses streaming JSON events
- Copilot adapter: spawns `gh copilot explain` (best-effort fallback)
- Auto-detects available CLI at request time
- `pnpm ai-server` root script to start it (port 3033 or `AI_SERVER_PORT` env var)
- Added `@types/node: ^22.0.0` to root devDependencies

### New `@bpmn-sdk/canvas-plugin-ai-bridge`

Canvas plugin providing AI chat panel in the editor:

- **Created** `canvas-plugins/ai-bridge/` — `createAiBridgePlugin(options)` returns `{ name, install(), button }`
- AI panel fixed to right side, toggles open/closed via HUD button
- Chat UI: message history, streaming tokens, code block rendering
- Extracts `CompactDiagram` from AI responses (```json block) → "Apply to diagram" button
- Apply: auto-saves checkpoint → `expand(compact)` → `Bpmn.export()` → `loadXml()`
- IndexedDB checkpoint system (`bpmn-sdk-ai` database, max 50 per project+file)
- History modal: lists checkpoints with timestamps, restore-on-click
- Server status indicator (shows startup instructions when server not running)
- Dark/light theme via `[data-bpmn-hud-theme]`

### Wired in landing app

- **Modified** `packages/editor/src/hud.ts` — added `aiButton?: HTMLButtonElement | null` to `HudOptions`
- **Modified** `apps/landing/src/editor.ts` — imports `createAiBridgePlugin`, creates plugin, passes `aiButton` to `initEditorHud`
- **Modified** `apps/landing/package.json` — added `@bpmn-sdk/canvas-plugin-ai-bridge: workspace:*`

## 2026-03-02 — Three-part editor refactor

### Task 1 — Optimize dialog extracted to `@bpmn-sdk/canvas-plugin-optimize`

New self-contained canvas plugin; landing app no longer has inline dialog code.

- **Created** `canvas-plugins/optimize/` — `createOptimizePlugin(options)` factory; returns `{ name, install(), button }`. The button is passed to `initEditorHud` as `optimizeButton`.
- **Deleted** `apps/landing/src/optimize-dialog.ts` — dialog code moved verbatim into the plugin.
- **Modified** `packages/editor/src/hud.ts` — `HudOptions.onOptimize` replaced with `optimizeButton?: HTMLButtonElement | null`; `IC.optimize` button construction removed.
- **Modified** `packages/editor/src/icons.ts` — removed `IC.optimize`.
- **Modified** `apps/landing/src/editor.ts` — imports and wires `createOptimizePlugin`; passes `optimizePlugin.button` to `initEditorHud`.

### Task 2 — Reference management moved to element cfg toolbar

Process/form/decision linking UI removed from config-panel and re-implemented in the HUD cfg toolbar.

- **Modified** `packages/editor/src/hud.ts` — new `HudOptions` fields (`getAvailableProcesses`, `createProcess`, `openDecision`, `getAvailableDecisions`, `openForm`, `getAvailableForms`); `buildCfgToolbar` now shows link/navigate buttons for callActivity, userTask, businessRuleTask.
- **Created** `packages/editor/src/modal.ts` — `showHudInputModal` for "New process…" input.
- **Modified** `packages/editor/src/css.ts` — added `.ref-link-btn` CSS class.
- **Modified** `canvas-plugins/tabs/src/tabs-plugin.ts` — added `getAvailableDecisions()` and `getAvailableForms()` to `TabsApi`.
- **Modified** `canvas-plugins/config-panel-bpmn/src/index.ts` — removed `__selectProcess`, `__newProcess`, `__openProcess`, `__openForm`, `__openDecision` action fields; simplified `ConfigPanelBpmnOptions` to only `openFeelPlayground`.
- **Modified** `apps/landing/src/editor.ts` — moved callbacks from `createConfigPanelBpmnPlugin` to `initEditorHud`; added `getAvailableDecisions`/`getAvailableForms`.

### Task 3 — Browser dialogs replaced with custom modals

All `prompt()`/`confirm()` calls in storage and storage-tabs-bridge replaced with themed custom modals.

- **Created** `canvas-plugins/storage/src/dialog.ts` — `showInputDialog(opts): Promise<string | null>` and `showConfirmDialog(opts): Promise<boolean>`; exported from storage package.
- **Modified** `canvas-plugins/storage/src/index.ts` — 5 browser dialog calls replaced.
- **Modified** `canvas-plugins/storage-tabs-bridge/src/index.ts` — `prompt()` replaced with `showInputDialog`.

## 2026-03-02 — Optimize button in BPMN editor

Two-phase "Optimize Diagram" dialog wired into the editor HUD:

### Files added
- `apps/landing/src/optimize-dialog.ts` — modal dialog: Phase 1 lists findings with checkboxes for auto-fixable items; Phase 2 shows applied fix descriptions with "Open generated process in new tab" buttons

### Files modified
- `packages/editor/src/icons.ts` — added `IC.optimize` (wand + sparkle icon)
- `packages/editor/src/hud.ts` — added `HudOptions.onOptimize?` callback + "Optimize" button in the action bar
- `apps/landing/src/editor.ts` — wires `onOptimize` to open the dialog via `optimize(defs)` + `editor.load()`
- `apps/landing/src/examples.ts` — added "Customer Notification Flow" example with 4 deliberate optimization findings (`feel/empty-condition`, `feel/missing-default-flow`, `flow/dead-end`, `task/reusable-group`)

## 2026-03-02 — `optimize()` — Static BPMN Optimization Analyzer in `@bpmn-sdk/core`

New `optimize(defs, options?)` function that performs static analysis on a `BpmnDefinitions` object and returns an `OptimizationReport` with actionable findings and optional in-place fixes.

### Files added

- `packages/bpmn-sdk/src/bpmn/optimize/types.ts` — Public types (`OptimizationFinding`, `OptimizationReport`, `OptimizeOptions`, `ApplyFixResult`)
- `packages/bpmn-sdk/src/bpmn/optimize/utils.ts` — Internal graph helpers (flow index, BFS reachability, Zeebe extension readers, mutation helpers)
- `packages/bpmn-sdk/src/bpmn/optimize/feel.ts` — FEEL expression analyzer (5 finding types)
- `packages/bpmn-sdk/src/bpmn/optimize/flow.ts` — Flow structure analyzer (5 finding types)
- `packages/bpmn-sdk/src/bpmn/optimize/tasks.ts` — Service task similarity + call activity extraction
- `packages/bpmn-sdk/src/bpmn/optimize/index.ts` — `optimize()` entry point
- `packages/bpmn-sdk/tests/optimize.test.ts` — 25 new tests (all passing)

### Finding types

| ID | Category | Severity |
|---|---|---|
| `feel/empty-condition` | feel | error |
| `feel/missing-default-flow` | feel | warning |
| `feel/complex-condition` | feel | warning |
| `feel/complex-io-mapping` | feel | info |
| `feel/duplicate-expression` | feel | info |
| `flow/unreachable` | flow | error |
| `flow/dead-end` | flow | warning |
| `flow/no-end-event` | flow | warning |
| `flow/redundant-gateway` | flow | info |
| `flow/empty-subprocess` | flow | warning |
| `task/reusable-group` | task-reuse | warning |

### Fixes with `applyFix`

- `feel/missing-default-flow` — sets gateway `default` attribute
- `flow/dead-end` — generates and inserts an `EndEvent` with sequence flow
- `flow/redundant-gateway` — removes gateway, reconnects source→target directly
- `task/reusable-group` — replaces tasks with `callActivity`, returns extracted `BpmnDefinitions`

---

## 2026-03-02 — Developer-experience refactor: storage-tabs-bridge + API improvements

### New package: `@bpmn-sdk/canvas-plugin-storage-tabs-bridge`
Extracted all cross-plugin wiring from `apps/landing/src/editor.ts` into a new standalone package. Reduces integration boilerplate from ~800 to ~180 lines.

- `createStorageTabsBridge(options)` creates and wires `tabsPlugin`, `storagePlugin`, and `bridgePlugin` together
- Owns tab↔file maps, MRU tracking, file-search palette commands, and the Ctrl+E file switcher
- `getExamples: (api: TabsApi) => WelcomeExample[]` — lazy factory for welcome screen examples
- Built-in `onDownloadTab` default (serialize to BPMN/DMN/Form + browser download)
- Built-in `getRecentProjects` mapped from storage API
- Built-in `onOpenFile` / `onRenameCurrentFile` / `onLeaveProject` wiring

### New: `Bpmn.makeEmpty(processId?, processName?)` — minimal empty BPMN XML
### New: `Bpmn.SAMPLE_XML` — 3-node sample diagram constant
### New: `SAMPLE_BPMN_XML` named export from `@bpmn-sdk/core`
### New: `Dmn.makeEmpty()` — returns a minimal `DmnDefinitions` with one empty decision table
### New: `EditorOptions.persistTheme` — reads/writes `localStorage "bpmn-theme"` automatically in `BpmnEditor`
### New: `TabsPluginOptions.enableFileImport` — built-in file picker + drag-and-drop in the tabs plugin
### New: `TabsApi.openFilePicker()` — programmatic file picker trigger

## 2026-03-02 — Dark mode: full propagation fix + localStorage theme persistence

### Fix: menus and config panel not themed after theme switch
Three root causes, three targeted fixes:

1. **`packages/editor/src/editor.ts`** — Added `get container(): HTMLElement` getter returning the host element (`bpmn-canvas-host` div), so external code can observe `data-theme` attribute changes without relying on internal fields.

2. **`packages/editor/src/hud.ts`** — `document.body.dataset.bpmnHudTheme` was set once at HUD init (always the initial theme) and never updated. Added a `MutationObserver` on `editor.container` that calls `syncHudTheme()` whenever `data-theme` changes. This keeps the HUD toolbars and config panel (which use `[data-bpmn-hud-theme]` selectors on body) in sync with the active theme.

3. **`canvas-plugins/main-menu/src/css.ts`** — The main menu dropdown is `position: fixed` and appended directly to `document.body`, outside the `.bpmn-canvas-host` element. The CSS custom properties (`--bpmn-overlay-bg`, `--bpmn-text`, `--bpmn-overlay-border`, `--bpmn-highlight`) are defined on `.bpmn-canvas-host[data-theme="dark"]` and do not cascade to body-level elements. Added `[data-bpmn-hud-theme="dark"]` overrides for all dropdown elements with explicit Catppuccin dark palette colors.

### Feature: theme preference persisted to localStorage
- **`apps/landing/src/editor.ts`** — Reads `"bpmn-theme"` from `localStorage` on startup (defaults to `"light"`) and passes it as the initial `theme` option to `BpmnEditor`. A `MutationObserver` on `editor.container` watches for `data-theme` changes and writes the resolved theme back to `localStorage`, so the preference survives page reloads.

## 2026-03-02 — DMN DRD canvas: snap alignment + quick-add connected elements

### Feature: snap/magnet alignment during node drag
When dragging a node, its left/center/right edges and top/center/bottom edges are compared against all other nodes (threshold: 8 px / scale). On a match the drag position snaps to the aligned anchor and a dashed blue guide line is rendered across the canvas in diagram space. Guide lines clear on mouse-up.

### Feature: quick-add connected elements from contextual toolbar
The contextual toolbar now shows icon buttons for every node type that can be connected FROM the current selection, based on DMN connection rules:
- **Decision / InputData** → Decision, Annotation
- **KnowledgeSource** → Decision, KnowledgeSource, BKM, Annotation
- **BKM** → Decision, BKM, Annotation
- **TextAnnotation** → (none)

Clicking a quick-add button uses smart placement (tries right → below → above, gap ×1–6) to find a non-overlapping position, creates the new node, auto-connects it with the correct edge type, and selects it.

**Files:** `canvas-plugins/dmn-editor/src/drd-canvas.ts`, `canvas-plugins/dmn-editor/src/css.ts`

## 2026-03-02 — DMN DRD canvas: dot grid, floating toolbars, contextual toolbar

### Feature: dot-grid background
SVG `<pattern>` with 20×20 tile, synced to the viewport transform on every pan/zoom/drag. Matches the BPMN editor look.

### Feature: bottom-center floating toolbar (glass panel)
The old top-bar with text buttons is replaced by an absolute-positioned floating glass panel at the bottom-center of the canvas. Contains SVG mini-shape icon buttons for each DRG element type (Decision, InputData, KnowledgeSource, BKM | TextAnnotation).

### Feature: contextual toolbar below selected node
When a node is selected, a floating glass panel appears 8px below it. Contents:
- Decision nodes: **Edit Table** | Connect → | Delete
- Other nodes: Connect → | Delete
The panel follows the node during drag and repositions on pan/zoom.

### Feature: connect mode from contextual toolbar
Removed the global "Connect" toggle. Connect mode is now initiated from the Connect button in the contextual toolbar, with the source node pre-set. Clicking a target creates the connection; clicking empty space or pressing Escape cancels.

**Files:** `canvas-plugins/dmn-editor/src/drd-canvas.ts`, `canvas-plugins/dmn-editor/src/css.ts`

## 2026-03-01 — DMN DRD (Decision Requirements Diagram) support

### Feature: full DRG element model in `@bpmn-sdk/core`
Expanded `DmnDefinitions` with all standard DMN DRG element types:
- `DmnInputData`, `DmnKnowledgeSource`, `DmnBusinessKnowledgeModel`, `DmnTextAnnotation`, `DmnAssociation`
- `DmnInformationRequirement`, `DmnKnowledgeRequirement`, `DmnAuthorityRequirement`
- `DmnWaypoint`, `DmnDiagramEdge`
- `DmnDecision.decisionTable` made optional; requirement arrays added to `DmnDecision`, `DmnKnowledgeSource`, `DmnBusinessKnowledgeModel`
- `DmnDiagram.edges` added for DMNDI edge roundtrip

### Feature: full parser/serializer roundtrip for all DRG elements
- Parser: `parseDmn` now reads `inputData`, `knowledgeSource`, `businessKnowledgeModel`, `textAnnotation`, `association` elements and all requirement child elements; `DMNEdge` waypoints parsed
- Serializer: `serializeDmn` writes all new element types, requirement children, and DMNDI edges
- Builder: `DmnBuilder.build()` initialises all new arrays; `edges: []` added to diagram

### Feature: interactive SVG DRD canvas (`@bpmn-sdk/canvas-plugin-dmn-editor`)
New `DrdCanvas` class (~920 lines) in `drd-canvas.ts`:
- **5 node shapes**: Decision (rectangle), InputData (stadium/rounded ends), KnowledgeSource (wavy-bottom rect), BusinessKnowledgeModel (clipped-corner rect), TextAnnotation (open bracket)
- **4 edge types**: InformationRequirement (solid filled arrow), KnowledgeRequirement (dashed open-V), AuthorityRequirement (dashed + open circle at source), Association (dotted)
- **Pan/zoom**: mouse-wheel zoom, pointer-drag panning
- **Node drag**: move nodes; position written back to DMNDI diagram shapes
- **Connect mode**: toolbar button activates two-click connect; connection type inferred from source/target node types
- **Delete**: keyboard Delete/Backspace removes selected node or edge; requirements/associations cleaned from model
- **Inline label edit**: double-click node shows `<foreignObject><input>` for in-place renaming
- **Auto-layout**: nodes without existing diagram positions placed in a grid automatically
- **Toolbar**: "Add Decision", "Add Input Data", "Add Knowledge Source", "Add BKM", "Add Annotation", "Connect", zoom controls
- **Double-click decision** → switches to decision table view

### Feature: DRD as primary view in DMN Editor
`dmn-editor.ts` refactored with a `"drd" | "table"` view state:
- DRD canvas is shown first when loading a DMN file
- Double-clicking a Decision node navigates to its decision table with a "← DRD" back bar
- Decision table auto-creates an empty `decisionTable` if the decision has none yet
- `destroy()` cleans up the DRD canvas properly

**Files:** `packages/bpmn-sdk/src/dmn/dmn-model.ts`, `dmn-parser.ts`, `dmn-serializer.ts`, `dmn-builder.ts`, `packages/bpmn-sdk/src/index.ts`, `canvas-plugins/dmn-editor/src/drd-canvas.ts`, `canvas-plugins/dmn-editor/src/dmn-editor.ts`, `canvas-plugins/dmn-editor/src/css.ts`, `canvas-plugins/tabs/src/tabs-plugin.ts`, `canvas-plugins/tabs/tests/tabs-plugin.test.ts`, `apps/landing/src/examples.ts`

## 2026-03-01 — Config panel: FEEL syntax validation + unified error detection

### Fix: invalid FEEL expressions now flagged as errors
Added module-level `hasFEELSyntaxError(val)` that catches structural errors in any value starting with `"="`:
- Empty body (`=` or `= `)
- Trailing binary operator (`="asdasfd"-` → trailing `-`)
- Unclosed string literal (`="hello`)
- Unbalanced brackets (`=someFunc(x`)
- Unmatched closing bracket

Validation applies to **any field** whose value starts with `=`, not just `feel-expression` typed fields — matching Camunda Zeebe semantics where `=` always signals a FEEL expression.

### Refactor: unified `_fieldHasError(field, val)` across all validation paths
Replaced the scattered `_isEffectivelyEmpty` checks with a single `_fieldHasError` that covers both required-empty AND invalid-FEEL. All four validation sites (field border, tab dot, guide bar, canvas badge) now use the same predicate. Guide bar text updated from "required fields" to "fields to fix" since it now covers both categories.

**Files:** `canvas-plugins/config-panel/src/renderer.ts`

## 2026-03-01 — Config panel: badge accuracy, field guide, FEEL validation

### Fix: canvas badge no longer shows errors for condition-hidden fields
`_updateBadges` now skips required fields whose condition function returns false (i.e. fields the user cannot see). This was the primary cause of the "still shows error after filling everything" frustration — hidden-but-required fields were being counted.

### Fix: FEEL expression "=" treated as empty
Added `_isEffectivelyEmpty(field, val)` which treats a `feel-expression` value of just `"="` (with optional whitespace) as effectively empty. Used in all validation paths: field border, tab dot, guide bar, and canvas badge.

### Feature: field guide assistant ("Start / Next" navigator)
A guide bar is now omnipresent between the search box and the tabs when any required field is missing. It shows the count ("3 required fields") and a **Start →** button. Clicking navigates to the first missing field (switches tab, scrolls into view, focuses the input). The button becomes **Next →** for subsequent clicks, cycling through remaining missing fields in group order. The bar disappears automatically when all required fields are filled.

**Files:** `canvas-plugins/config-panel/src/renderer.ts`, `canvas-plugins/config-panel/src/css.ts`

## 2026-03-01 — Config panel: improved validation UX

### Tab error dots
Each config panel tab now shows a small red dot (CSS `::after`) when that group contains at least one required field with an empty value. Dots update in real time as the user types. Only visible fields are counted (conditionally-hidden required fields are excluded).

### Enhanced field invalid styling
Invalid required fields now show a solid red left-border accent (`border-left: 2px solid #f87171`) on the field wrapper in addition to the vivid red input border, making the exact property that needs fixing immediately obvious.

### Canvas badge tooltip
The canvas "!" badge now includes an SVG `<title>` listing the specific missing field names (e.g. "Required: API Endpoint, Authentication"). Hovering the badge shows a native browser tooltip identifying exactly which fields need attention.

**Files:** `canvas-plugins/config-panel/src/renderer.ts`, `canvas-plugins/config-panel/src/css.ts`

## 2026-03-01 — Config panel: connector name in header + validation badges

### Feature: connector/template name in inspector header
When a connector template is active on a service task, the panel header now shows the template name (e.g. "REST Connector") between the element type line and the element name. Implemented via a new optional `templateName?` field on `PanelSchema`, set to `template.name` in `buildRegistrationFromTemplate`, and rendered as `.bpmn-cfg-full-template` in the panel header.

**Files:** `canvas-plugins/config-panel/src/types.ts`, `canvas-plugins/config-panel/src/renderer.ts`, `canvas-plugins/config-panel/src/css.ts`, `canvas-plugins/config-panel-bpmn/src/template-engine.ts`

### Feature: validation badges on canvas elements
Canvas shapes with at least one required config field that is empty now show a small red badge (circle with "!") at the top-right corner of the shape in the SVG diagram. Badges live in a dedicated `<g class="bpmn-cfg-badge-layer">` appended to `api.viewportEl` so they follow pan and zoom automatically. Updated on every `diagram:change` event. Badge rendering is opt-in — only active when `getSvgViewport` and `getShapes` callbacks are provided to the renderer (which `index.ts` now does).

**Files:** `canvas-plugins/config-panel/src/renderer.ts`, `canvas-plugins/config-panel/src/index.ts`

## 2026-03-01 — Config panel bug fixes: connector switching + HTML hints

### Bug: couldn't change connector once a template was applied
Once a connector template was stamped on a service task, `resolve()` replaced the generic schema (which has the connector dropdown) with the template schema, which had no way to get back. Fixed by adding a **"Change connector"** action button as the first field in every template's General group. Clicking it writes a sentinel value `__change_connector: "remove"` which the template adapter's `write()` intercepts — it strips `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` from `unknownAttributes`, causing `resolve()` to return null on the next render and the generic connector selector to reappear.

**Files:** `canvas-plugins/config-panel-bpmn/src/template-engine.ts`

### Bug: hint text showed raw HTML tags
Template property `description` fields contain HTML (e.g. `<a href="...">documentation</a>` links). These were rendered with `textContent`, so users saw literal `<a href=...>` text. Fixed by switching to `innerHTML`.

**Files:** `canvas-plugins/config-panel/src/renderer.ts`

## 2026-03-01 — Config Panel UX: search, docs link, tooltip, tab hiding, localStorage width

### Investigation findings
- **Tabs**: appropriate for connector templates (2–9 groups, 10–50 fields each) but visual noise for built-in schemas with a single group. Fixed by auto-hiding the tab bar when ≤ 1 visible group.
- **Finding properties**: without search, users must click through tabs to locate a specific property. Fixed with full-text search.
- **Help/support**: 102/115 connector templates have `documentationRef` but it was never surfaced in the UI. Template `tooltip` per-field was also unmapped. Both now wired.
- **Examples**: `placeholder` and `hint` already serve as examples for most fields; a dedicated `example` field type is a future enhancement.

### Changes

**`canvas-plugins/config-panel/src/types.ts`**
- Added `docsUrl?: string` to `PanelSchema` (panel-level docs URL)
- Added `tooltip?: string` to `FieldSchema` (hover tooltip on field label)

**`canvas-plugins/config-panel/src/renderer.ts`**
- **localStorage width** — panel width restored from `localStorage` on construction; saved on every resize drag
- **Search** — search bar (below header) filters all fields across all groups by label. Results show group name as section header. Tabs+body hidden while search is active; restored on clear. Escape key clears search.
- **Docs link** — `?` button in header shown when `reg.schema.docsUrl` is set; opens documentation in new tab
- **Tooltip** — `field.tooltip` rendered as `title` attribute on field label, toggle label, and action button
- **Single-group tab bar auto-hide** — `_syncTabsAreaVisibility()` hides the `.bpmn-cfg-tabs-area` when ≤ 1 group is visible; called on initial render and after every group visibility change

**`canvas-plugins/config-panel/src/css.ts`**
- Added search bar, search results, and search-group-label styles
- Added `.bpmn-cfg-docs-link` styles (circular `?` badge)
- Added `cursor: help` on `.bpmn-cfg-field-label[title]` and `.bpmn-cfg-toggle-label[title]`
- Added collapsed-state hiding for new elements (`search-bar`, `docs-link`, `search-results`)

**`canvas-plugins/config-panel-bpmn/src/template-engine.ts`**
- `prop.tooltip` → `FieldSchema.tooltip`
- `template.documentationRef` → `schema.docsUrl`

## 2026-03-01 — Config Panel: resizable width, vertical offset, tab scroll arrows

### `canvas-plugins/config-panel` — UX refinements

- **Resizable width** — A 5px drag handle on the left edge of the inspector panel lets users resize it between 240px and 600px. The chosen width persists across node selections (stored as `_panelWidth`). Dragging is blocked when the panel is collapsed. Inline `style.width` is cleared when collapsing and restored on expand.
- **Vertical offset** — `top: 36px` (matches the `canvas-plugin-tabs` bar height) so the inspector panel no longer overlaps the tab bar.
- **Tab scroll arrows** — The tabs bar is now wrapped in a `.bpmn-cfg-tabs-area` flex container. When tab buttons overflow the available width, ‹ and › arrow buttons appear on the left/right edges to scroll by 100px. Buttons are shown/hidden dynamically via `_updateTabScrollBtns()`, called after render, on scroll, on tab switch, and on group-visibility changes.

## 2026-03-01 — Config Panel: Persistent Inspector Panel (Pattern 1)

Replaced the two-click compact+overlay UX with a single persistent fixed-width right-side inspector panel.

### `canvas-plugins/config-panel` — Changes

- **`renderer.ts`** — Removed compact panel, overlay, backdrop, `_centerSelected`, and `_fullOpen` state. Added `_panelEl` and `_collapsed` state. Single `_showPanel()` method replaces `_showCompact()`+`_showFull()`. Panel now opens immediately on first node click and persists across selections. Collapse toggle button (‹/›) in header preserves preference across node switches. Constructor no longer takes `getViewport`/`setViewport` params.
- **`css.ts`** — Removed all compact/configure-btn/overlay/backdrop styles and their light-theme overrides. Updated `.bpmn-cfg-full` to `position: fixed; right: 0; width: 320px; transition: width 0.2s ease`. Added `.bpmn-cfg-full--collapsed` (collapses to 40px strip), `.bpmn-cfg-collapse-btn`, and collapsed-header centering rule.
- **`index.ts`** — Removed `getViewport`/`setViewport` arguments from `ConfigPanelRenderer` constructor call.
- **`tests/index.test.ts`** — Updated test name and selector from `.bpmn-cfg-compact` to `.bpmn-cfg-full`.

## 2026-02-28 — Form Editor drag-and-drop redesign (form-js parity)

Rewrote `FormEditor` (`canvas-plugins/form-editor`) with a three-panel drag-and-drop layout matching form-js.

### `canvas-plugins/form-editor` — Complete rewrite

- **Three-panel layout** — Palette (260px) | Canvas (flex) | Properties (300px)
- **Palette** — 5 color-coded groups (Input/blue, Selection/green, Presentation/amber, Containers/purple, Action/red); icon grid ~72×72px per item; live search filter; click to append, drag to place
- **Canvas** — Visual card-based preview of form structure; drop zones between cards (8px→24px→36px on drag/hover); empty state with drag target; container cards (group/dynamiclist) render nested drop zones
- **Drag-and-drop** — HTML5 native DnD; palette→canvas (copy), canvas→canvas (move); drop zone highlight on hover; card opacity on drag; self-referential drop prevention for containers
- **Component previews** — Non-interactive per-type previews: faux input/textarea/select/checkbox/radio/button/badge/separator/spacer/image
- **Properties panel** — Colored icon header; property inputs for label, key, required, text, html, source, url, expression, and options list; label change updates canvas preview without re-rendering props (preserves focus)
- **CSS redesign** — Light default, `.dark` class override; `--fe-*` CSS variables throughout

### Files changed
- **`canvas-plugins/form-editor/src/form-editor.ts`** — complete rewrite
- **`canvas-plugins/form-editor/src/css.ts`** — complete redesign

## 2026-02-28 — DMN Editor feature parity with dmn-js

Redesigned `DmnEditor` to match the dmn-js visual language and feature set.

### `packages/bpmn-sdk` — Aggregation support
- **`dmn-model.ts`** — added `DmnAggregation` type (`"SUM" | "MIN" | "MAX" | "COUNT"`) and `aggregation?` field on `DmnDecisionTable`
- **`dmn-parser.ts`** — parses `aggregation` attribute from `<decisionTable>`
- **`dmn-serializer.ts`** — serializes `aggregation` attribute when present
- **`index.ts`** — exports `DmnAggregation` type

### `canvas-plugins/dmn-editor` — Major redesign
- **Single-row column headers** replacing the previous two-row (type + col) layout
- **Hit policy cell** — top-left table corner shows abbreviated policy (U/F/A/P/C/C+/C</C>/C#/R/O); transparent `<select>` overlay for changing it; supports all 11 combinations of hit policy + aggregation
- **Clause labels** — "When"/"And" on input columns, "Then"/"And" on output columns
- **TypeRef dropdowns** — `<select>` in each column header footer; editable per-column; updates `inputExpression.typeRef` or `output.typeRef` on change
- **Annotations column** — rightmost column with "Annotation" clause label; bound to `rule.description`; fully round-trips through XML
- **Context menu** — right-click on row-number cell: add rule above/below, remove rule; right-click on column header: add input/output left/right, remove column
- **Collect aggregation** — COLLECT hit policy now has 5 variants: C, C+ (SUM), C< (MIN), C> (MAX), C# (COUNT)
- **Light theme as default** — clean white background with blue hit-policy accent and section tints
- **Double border** — 3px double border separates last input column from first output column
- **CSS redesign** — Arial font, 14px base, new `--dme-*` variables for clause text, hit policy cell, section colors, annotation column, context menu

## 2026-02-27 — Native DMN + Form editors (zero external deps)

Replaced `dmn-js` and `@bpmn-io/form-js-editor` with fully in-repo native implementations.

### `canvas-plugins/dmn-editor`
- **Rewrote `DmnEditor`** — native editable decision table; no external deps
  - Parses XML once via `Dmn.parse`; serializes on demand via `Dmn.export`; model stays in memory during editing
  - Editable name input + hit policy `<select>` per decision
  - Add / remove input and output columns; add / remove rules (rows)
  - Each cell is a `<textarea>` bound directly to the model entry; re-render only on structural changes
  - New **`css.ts`** — `injectDmnEditorStyles()` injects scoped `--dme-*` CSS variables; same dark-default / `.light` override pattern as the viewer
  - Removed `dmn-js` dependency; added `@bpmn-sdk/core: workspace:*`

### `canvas-plugins/form-editor`
- **Rewrote `FormEditor`** — native two-panel component editor; no external deps
  - Parses schema via `Form.parse`; exports via `Form.export`
  - Left panel: scrollable list of all components (flat + nested groups); click to select; up/down reorder; delete
  - Right panel: property editor for selected component (label, key, required, options list, etc.)
  - "Add" button opens a popup dropdown grouped by category (Fields / Display / Advanced / Layout)
  - Supports all component types: `textfield`, `textarea`, `number`, `select`, `radio`, `checkbox`, `checklist`, `taglist`, `filepicker`, `datetime`, `expression`, `table`, `text`, `html`, `image`, `button`, `separator`, `spacer`, `iframe`, `group`, `dynamiclist`
  - New **`css.ts`** — `injectFormEditorStyles()` injects scoped `--fe-*` CSS variables
  - Removed `@bpmn-io/form-js-editor` dependency; added `@bpmn-sdk/core: workspace:*`

### Other changes
- **Root `package.json`** — removed `dmn-js` and `@bpmn-io/form-js-editor` from `dependencies`
- **`apps/landing/src/editor.ts`** — removed the 6 CSS import lines for dmn-js / form-js-editor assets
- **`canvas-plugins/tabs/tests/tabs-plugin.test.ts`** — removed `vi.mock` blocks; native DOM editors run fine in happy-dom

## 2026-02-27 — DMN and Form editing

### New packages
- **`canvas-plugins/dmn-editor`** → `@bpmn-sdk/canvas-plugin-dmn-editor` — thin wrapper around `dmn-js` DmnModeler; exports `DmnEditor` class with `loadXML(xml)`, `getXML()`, `onChange(handler)`, and `destroy()` API; no TypeScript types shipped by dmn-js so uses `@ts-expect-error` import suppression
- **`canvas-plugins/form-editor`** → `@bpmn-sdk/canvas-plugin-form-editor` — wraps `@bpmn-io/form-js-editor` FormEditor; exports `FormEditor` class with `loadSchema(schema)`, `getSchema()`, `onChange(handler)`, and `destroy()` API

### `canvas-plugins/tabs`
- **DMN tabs now editable** — replaces the read-only `DmnViewer` with `DmnEditor` (dmn-js DmnModeler); the editor is initialized with the XML exported from the tab's `DmnDefinitions`; on every `commandStack.changed` event the XML is re-exported, parsed back to `DmnDefinitions`, and stored in the tab config
- **Form tabs now editable** — replaces the read-only `FormViewer` with `FormEditor` (`@bpmn-io/form-js-editor`); the editor is initialized with the JSON exported from the tab's `FormDefinition`; on every `changed` event the schema is exported, parsed, and stored in the tab config
- **`onTabChange` callback** — new optional `TabsPluginOptions.onTabChange(tabId, config)` called whenever a DMN or Form tab's content changes; used by the landing app to trigger auto-save
- **Dependency swap** — `@bpmn-sdk/canvas-plugin-dmn-viewer` and `@bpmn-sdk/canvas-plugin-form-viewer` removed from deps; `@bpmn-sdk/canvas-plugin-dmn-editor` and `@bpmn-sdk/canvas-plugin-form-editor` added
- **Tests updated** — DMN fixture updated to correct `DmnDefinitions` structure (with proper `decisionTable` + namespace); editor packages mocked in tests so dmn-js/inferno rendering is skipped in happy-dom

### `apps/landing`
- **CSS assets** — dmn-js and form-js-editor CSS files imported as Vite side-effects at the top of `editor.ts`; `vite-env.d.ts` added with `/// <reference types="vite/client" />` so TypeScript accepts CSS imports
- **Auto-save for DMN/Form** — `onTabChange` callback wired to `storagePlugin.api.scheduleSave()` so edits in the DMN or Form editor are auto-saved with the same 500 ms debounce as BPMN

### Root
- `dmn-js ^17.7.0` and `@bpmn-io/form-js-editor ^1.19.0` added to root `package.json` devDependencies

## 2026-02-27 — File switcher: Alt-Tab-style cycle mode

### `apps/landing`
- **Ctrl+E (hold) cycle behavior** — pressing Ctrl+E opens the file switcher pre-focused on the second MRU entry; each additional E press (while Ctrl is still held) cycles to the next file in the list; releasing Ctrl commits the selection and switches to that file
- **Search mode via Tab / ArrowRight** — pressing Tab or ArrowRight while in cycle mode focuses the search input and detaches the Ctrl-release commit; the switcher now stays open until Enter (commit), Esc (cancel), or a click; ArrowDown/Up navigate the list from either mode
- **kbd hint updated** — hint row now shows `E cycle  Tab search  Esc close`
- **scrollIntoView** — `updateFocus()` scrolls the highlighted item into view when the list overflows

## 2026-02-27 — Properties panel feature parity

### `canvas-plugins/config-panel-bpmn`
- **Timer events** — new `TIMER_SCHEMA` + `TIMER_ADAPTER`; shows "Timer type" select (Cycle / Duration / Date) and the matching FEEL expression field; handles `startEvent`, `intermediateCatchEvent`, `boundaryEvent` with timer definitions; reads/writes `BpmnTimerEventDefinition` fields directly
- **Message events** — new `MESSAGE_EVENT_SCHEMA` + `MESSAGE_ADAPTER`; shows "Message name" and "Correlation key" FEEL fields; reads/writes `zeebe:message` extension element; applies to `messageCatchEvent`, `messageStartEvent`, `messageEndEvent`, `messageThrowEvent`, `boundaryEvent` with message def, and `receiveTask`
- **Signal events** — new `SIGNAL_EVENT_SCHEMA` + `SIGNAL_ADAPTER`; "Signal name" FEEL field; reads/writes `zeebe:signal` extension; applies to all signal variants and `boundaryEvent`
- **Error events** — new `ERROR_EVENT_SCHEMA` + `ERROR_ADAPTER`; "Error code" FEEL field; reads/writes `zeebe:error` extension; applies to `errorEndEvent` and error `boundaryEvent`
- **Escalation events** — new `ESCALATION_EVENT_SCHEMA` + `ESCALATION_ADAPTER`; "Escalation code" FEEL field; reads/writes `zeebe:escalation` extension; applies to escalation throw/catch variants
- **Conditional events** — new `CONDITIONAL_EVENT_SCHEMA` + `CONDITIONAL_ADAPTER`; "Condition expression" FEEL field; reads/writes `BpmnConditionalEventDefinition.condition`; applies to conditional start, catch, and boundary events
- **Event dispatcher adapters** — `START_EVENT_ADAPTER`, `END_EVENT_ADAPTER`, `CATCH_EVENT_ADAPTER`, `THROW_EVENT_ADAPTER`, `BOUNDARY_EVENT_ADAPTER` each use `resolve()` to delegate to the matching event-specific schema based on `eventDefinitions[0].type`; plain events (no definition) fall back to `GENERAL_SCHEMA`
- **New general types** — `subProcess`, `transaction`, `manualTask`, `task`, `complexGateway` added to `GENERAL_TYPES`; `receiveTask` promoted to the `MESSAGE_EVENT_SCHEMA`; `startEvent` and `endEvent` moved to their own dispatcher adapters
- **Zeebe event extension helpers** — `parseZeebeMessage`, `parseZeebeSignal`, `parseZeebeError`, `parseZeebeEscalation` added to `util.ts`

## 2026-02-27 — File switcher palette (Ctrl+E)

### `apps/landing`
- **`Ctrl+E` / `Cmd+E` file switcher** — opens a palette (identical visual to the command palette) showing all open project files in MRU order; pre-focuses the second entry (most-recently previous file); supports text filtering, arrow-key navigation, Enter to switch, Esc to close; closed by pressing `Ctrl+E` again; only active when a project is open; reuses command palette CSS classes from `@bpmn-sdk/canvas-plugin-command-palette`; `storageFileToType` cache added to show file type badge in each row; shortcut chosen because it is left-hand accessible, non-conflicting with browser tab management, and mirrors IntelliJ's "Recent Files" shortcut

## 2026-02-27 — Project mode: no-close tabs, all-files-open, file search, rename, Ctrl+Tab MRU

### `canvas-plugins/storage`
- **`ProjectMruRecord` type** — new `{ projectId, fileIds[] }` record type in `types.ts`; IndexedDB DB_VERSION bumped to 12; `projectMru` object store added in `db.ts`
- **`StorageApi.getMru` / `pushMruFile`** — `getMru(projectId)` returns stored MRU file-ID list; `pushMruFile(projectId, fileId)` prepends to the list (deduplicated, max 50 entries)
- **`StoragePluginOptions.onRenameCurrentFile`** — new optional callback called after a file is renamed via the main menu; allows the caller to update the tab display name
- **Rename in main menu** — when a project is open and a file is active, "Rename current file…" appears in the storage plugin's dynamic menu items

### `canvas-plugins/tabs`
- **`TabsApi.setProjectMode(enabled)`** — enables or disables project mode; re-renders the tab bar
- **`TabsApi.renameTab(id, name)`** — updates a tab's display name and re-renders the tab bar
- **No-close in project mode** — `requestClose` is a no-op in project mode; close buttons are hidden in both the tab bar and the group dropdown

### `apps/landing`
- **All files always open** — `openProject` already calls `onOpenFile` for each file; `storageFileIdToTabId` and `storageFileToName` maps track the correspondence
- **Project mode toggle** — `storagePlugin.api.onChange()` calls `tabsPlugin.api.setProjectMode(!!projectId)` whenever the current project changes
- **File-search commands** — `rebuildFileCommands()` registers one command-palette command per open project file (search by name → switch to that tab); deregistered when leaving a project
- **Rename current file** — command palette includes "Rename current file…" when in project mode; updates name in the display, maps, and IndexedDB; also accessible via main menu
- **MRU persistence** — `tabMruOrder` maintained in memory; order loaded from IndexedDB on project open and persisted on every tab switch via `pushMruFile`; Ctrl+Tab handler not implemented (browser reserves the shortcut and cannot be overridden); file switching available via Ctrl+K command palette

## 2026-02-27 — Edge waypoint hover dot fix + snap guides

### `packages/editor`
- **Fix: `_nearestSegment` for diagonal edges** — replaced the orthogonal-only projection (`x = a.x` / `y = a.y`) with a proper perpendicular dot-product projection onto the segment line (`t = clamp((P-A)·(B-A)/|B-A|², 0, 1)`, `proj = A + t*(B-A)`); the hover dot now appears at the geometrically correct nearest point on any segment orientation; `isHoriz` is now determined by `|dy| ≤ |dx|` (predominant direction) rather than requiring near-zero delta
- **Waypoint snap (magnet lines)** — new `_snapWaypoint(pt)` helper snaps a diagram point to shape bounds key positions (left/center-x/right + top/center-y/bottom) and all edge waypoints within an 8px/scale threshold; returns snapped point and alignment guide lines; applied to both `previewWaypointInsert` / `commitWaypointInsert` and `previewWaypointMove` / `commitWaypointMove`; alignment guides cleared on commit and cancel

## 2026-02-27 — Edge waypoint interaction redesign

### `packages/editor`
- **Waypoint angle balls** — hovering over any edge now shows blue circles (`bpmn-edge-waypoint-ball`) at every intermediate waypoint (bend point); visible only on hover, hidden when cursor leaves; new SVG layer `_edgeWaypointsG` in `OverlayRenderer`; `setEdgeWaypointBalls(waypoints, edgeId)` method added
- **Move existing waypoints** — clicking and dragging a waypoint ball moves the bend point; `HitResult` extended with `edge-waypoint { id, wpIdx, pt }` variant; state machine states `pointing-edge-waypoint` and `dragging-edge-waypoint` added; `previewWaypointMove` / `commitWaypointMove` / `cancelWaypointMove` callbacks
- **Collinear waypoint removal** — after every waypoint insert or move, `removeCollinearWaypoints()` runs and removes any intermediate waypoint that lies exactly on the straight line between its neighbours; prevents accumulation of redundant bend points
- **Segment drag simplified** — removed direction-based disambiguation; dragging any edge segment always inserts a new waypoint (no more segment-shift mode); `dragging-edge-segment` state, `previewSegmentMove` / `commitSegmentMove` / `cancelSegmentMove` callbacks, and `setCursor` callback all removed
- **`HitResult` & `Callbacks`** — `edge-waypoint` type added; `previewSegmentMove`, `commitSegmentMove`, `cancelSegmentMove`, `setCursor` removed from `Callbacks`; waypoint move and ball show/hide callbacks added
- **`modeling.ts` additions** — `moveEdgeWaypoint(defs, edgeId, wpIdx, pt)` and `removeCollinearWaypoints(defs, edgeId)`

## 2026-02-27 — Edge improvements, raw mode button relocation, obstacle routing

### `canvas-plugins/tabs`
- **Raw mode button relocated** — raw source toggle button removed from the tab bar; exposed via `TabsApi.rawModeButton`; tab bar CSS for `.bpmn-raw-mode-btn` removed

### `packages/editor`
- **Raw mode button in HUD** — `HudOptions` accepts `rawModeButton?: HTMLButtonElement | null`; when provided the button is styled as a `hud-btn` and appended (with a separator) to the bottom-left HUD panel
- **Obstacle-avoiding edge routing** — new `computeWaypointsAvoiding(src, tgt, obstacles)` in `geometry.ts`; tries all 16 port combinations and returns the first route that does not intersect any obstacle shape (2 px margin); used in `_doConnect()` and `addConnectedElement()` so new edges automatically route around existing elements
- **Edge segment drag** — hovering over an edge segment shows a blue dot at the projected cursor position and changes the cursor to `ns-resize` (horizontal segment) or `ew-resize` (vertical); dragging perpendicularly (steeper than 45°) moves the entire segment while maintaining orthogonality of the adjacent segments; state machine states: `pointing-edge-segment`, `dragging-edge-segment`
- **Edge waypoint insertion** — dragging an edge at a shallower angle (more parallel than perpendicular) inserts a new free-form waypoint at the drag position; diagonal movements allowed; state machine state: `dragging-edge-waypoint-new`
- **`HitResult` extended** — new `edge-segment` variant `{ type, id, segIdx, isHoriz, projPt }` returned by `_hitTest()` when hovering an edge; `_nearestSegment()` helper computes the nearest segment and its projection
- **`modeling.ts` additions** — `moveEdgeSegment(defs, edgeId, segIdx, isHoriz, delta)` and `insertEdgeWaypoint(defs, edgeId, segIdx, pt)`
- **Overlay** — new `_edgeHoverDotG` SVG layer and `setEdgeHoverDot(pt|null)` method; blue dot styled with `.bpmn-edge-hover-dot`

### `apps/landing`
- Passes `rawModeButton: tabsPlugin.api.rawModeButton` to `initEditorHud()`

## 2026-02-27 — Unified tab bar (HUD + main menu integration)

### `canvas-plugins/main-menu`
- **Flush tab bar layout** — `.bpmn-main-menu-panel` restyled from a floating card (`top: 12px; right: 12px; border-radius: 8px; box-shadow`) to a flush right-side segment of the tab bar (`top: 0; right: 0; height: 36px; border-radius: 0; box-shadow: none; border-left: 1px solid`); background matches the tabs dark/light theme (`#181825` / `#f0f4f8`) via `[data-theme="dark"]` selector
- **Auto padding-right** — CSS `:has()` rule adds `padding-right: 160px` to `.bpmn-tabs` whenever `.bpmn-main-menu-panel` is visible, preventing the raw-mode button from scrolling under the menu

### `packages/editor`
- **HUD top-center flush** — `#hud-top-center` moved to `top: 0; height: 36px`; `#hud-top-center.panel` overrides strip the floating card (transparent background, no blur, no border-radius, no shadow) for both dark and light themes; center action buttons (undo/redo/delete/etc.) now sit visually inside the tab bar row

## 2026-02-27 — Export project ZIP, new file shortcuts, raw source toggle

### `canvas-plugins/storage`
- **Export project as ZIP** — new "Export Project…" action in the main menu when a project is open; builds a ZIP (STORE method, no external deps) from all project files and triggers a browser download named `<project>.zip`; pure TypeScript ZIP implementation in `src/export.ts` with CRC-32 and full central directory
- **`StorageApi.getProjectName(id)`** — looks up a project name from the in-memory cache; used by the ZIP exporter

### `canvas-plugins/tabs`
- **Raw/rendered toggle** — `</>` icon button at the right end of the tab bar; toggles a raw source overlay (`<pre>`) showing the current tab's BPMN XML, DMN XML, or Form JSON; disabled for FEEL tabs; stays in sync with `diagram:change` events; per-session state persists while tabs are open, resets on `closeAllTabs()`

### `apps/landing`
- **"New…" drill menu** — top-right menu now has a "New…" drill-down with three entries: "New BPMN diagram" (empty with a start event), "New DMN table" (minimal decision table), "New Form" (empty form)
- New helper `makeEmptyDmnXml()` for blank DMN table XML

## 2026-02-27 — Leave workspace, recent projects dropdown, plugin-managed tab XML/processes

### `canvas-plugins/tabs`
- **`closeAllTabs()`** — new `TabsApi` method that closes all tabs without a confirmation dialog and shows the welcome screen
- **`navigateToProcess(processId)`** — new `TabsApi` method; the plugin now internally tracks which BPMN process is in which tab (populated when `openTab` is called and updated on `diagram:change`)
- **`getAvailableProcesses()`** — new `TabsApi` method; returns all tracked process IDs with display names
- **`getAllTabContent()`** — new `TabsApi` method; returns serialized content (XML / DMN / Form JSON) for all non-FEEL tabs; BPMN tabs use the current (post-edit) XML
- **Auto XML tracking** — subscribes to `diagram:change` in `install()`; updates the active BPMN tab's `config.xml` in place so `onTabActivate` always receives the latest content
- **"Open recent" dropdown** — new `getRecentProjects` option on `TabsPluginOptions`; when provided, renders a dropdown button below "Import files…" on the welcome screen; disabled when no projects available; rebuilt each time the welcome screen is shown
- Exported new types: `WelcomeRecentItem`, `TabContentSnapshot`

### `canvas-plugins/storage`
- **`onLeaveProject` option** — called when the user clicks "Leave" in the project info bar; used by the landing app to close all tabs and show the welcome screen
- **No auto-restore on load** — `install()` no longer opens last-project files on startup; the welcome screen is always shown initially; `getRecentProjects()` enables explicit re-opening
- **`StorageApi.getRecentProjects()`** — returns top 10 projects sorted by `updatedAt` (most recently saved first), including workspace info; uses in-memory cache
- **Project `updatedAt` bumped on auto-save** — `_persistContent` now also updates the project's `updatedAt` timestamp and in-memory cache entry so `getRecentProjects()` stays sorted

### `apps/landing`
- **"Leave Workspace" → welcome screen** — wired `onLeaveProject: () => tabsPlugin.api.closeAllTabs()`
- **Simplified `editor.ts`** — removed `tabCurrentXml`, `activeBpmnTabId`, `openTabConfigs`, `bpmnProcessToTabId`, `bpmnProcessNames` maps; removed `diagram:change` subscription; replaced `getOpenTabs` with `tabsPlugin.api.getAllTabContent()`; replaced manual process navigation with `tabsPlugin.api.navigateToProcess()` and `tabsPlugin.api.getAvailableProcesses()`
- `getWelcomeSections` replaced by `getRecentProjects` (dropdown shows 10 most recently saved projects)

## 2026-02-27 — Remove Dexie dependency; fix auto-save tab content reset

### `canvas-plugins/storage`
- **Removed Dexie**: replaced with a minimal native IndexedDB wrapper (`db.ts`) that matches the same API surface — no external dependency, no change to `storage-api.ts`
- Native wrapper supports: `get`, `add`, `update`, `delete`, `orderBy().toArray()`, `where().equals().toArray/sortBy/delete()`, `filter().toArray()`; all operations are Promise-based using modern IndexedDB (microtask-safe transactions)

### `apps/landing`
- **Auto-save fix**: `onTabActivate` was reloading `config.xml` (the original XML from when the tab was created) every time a BPMN tab was reactivated, making the editor appear to lose edits on every tab switch; now a `tabCurrentXml` map tracks the latest XML per tab (updated on every `diagram:change`), and reactivation uses that map so the editor always shows the most recent content
- `openTabConfigs` (used by "Save All to Project") is also kept in sync via the `diagram:change` listener

## 2026-02-26 — Bug fixes: auto-save, welcome screen project navigation, call activity process linking

### `canvas-plugins/config-panel`
- `FieldSchema.onClick` now receives a `setValue(key, val)` second argument so action buttons can write field values back without re-rendering the whole panel

### `canvas-plugins/config-panel-bpmn`
- Call Activity panel: added "Select process…" action button (prompt with numbered list of open BPMN tabs) and "New process" action button (prompt for name → create blank BPMN tab → auto-link)
- `ConfigPanelBpmnOptions` extended with `getAvailableProcesses()` and `createProcess(name, onCreated)` callbacks

### `canvas-plugins/tabs`
- Added `WelcomeSection` / `WelcomeSectionItem` interfaces and `getWelcomeSections` option to `TabsPluginOptions`
- Dynamic sections (workspace/project/file links) are rebuilt and injected into the welcome screen on every show

### `apps/landing`
- **Auto-save fix**: `setCurrentFileId(file.id)` is now called immediately after `tabIdToStorageFileId.set()` inside `onOpenFile`, preventing the race where `onTabActivate` fired before the map was populated
- `bpmnProcessNames` map tracks BPMN tab names for use in call activity selection dialogs
- `makeEmptyBpmnXml(processId, processName)` helper generates a minimal BPMN for new process tabs
- `getWelcomeSections` wired: surfaces workspace → project → file navigation from the welcome screen
- `getAvailableProcesses` and `createProcess` wired into `createConfigPanelBpmnPlugin`

## 2026-02-26 — Storage plugin overhaul: main-menu integration, drill-down nav, project persistence

### `canvas-plugins/main-menu`
- Added `MenuDrill` type — clicking replaces dropdown content with a back-navigable sub-menu (nav stack)
- Added `MenuInfo` type — passive info row with optional inline action button
- `MenuItem` union extended: `MenuAction | MenuSeparator | MenuDrill | MenuInfo`
- `createMainMenuPlugin` now returns `CanvasPlugin & { api: MainMenuApi }`
- `MainMenuApi.setTitle(text)` — dynamically updates the title span
- `MainMenuApi.setDynamicItems(fn)` — items prepended on each menu open (rebuilt from fn on every open)
- Theme picker moved behind a `MenuDrill` ("Theme") instead of being flat in the root dropdown
- Drill-down nav stack: back button + level title shown when inside a drill level
- Dropdown `min-width` widened to 220 px; added CSS for back row, level title, arrow indicator, info row

### `canvas-plugins/storage`
- **Sidebar removed** — `sidebar.ts` and `css.ts` emptied; no more toggle button or left panel
- Depends on `@bpmn-sdk/canvas-plugin-main-menu: workspace:*` (new dep + tsconfig reference)
- **`StorageApi` additions**: `_currentProjectId` (persisted to `localStorage`); in-memory caches (`_workspaces`, `_projects` map); `initialize()` loads caches + restores last-opened project; `openProject(id)` sets current + opens all files; `saveTabsToProject(projectId, wsId, tabs)` upserts tabs as files
- All mutating methods update in-memory caches synchronously before calling `_notify()`
- **`StoragePluginOptions`**: adds `mainMenu`, `getOpenTabs()`, `initialTitle`
- `createStoragePlugin` wires `mainMenu.api.setDynamicItems` with workspace→project drill-down navigation; "Open Project" drill loads files + sets title; "Save All to Project" drill upserts open tabs; "Leave Project" clears project context + restores title; `onChange` refreshes menu items on next open

### `apps/landing`
- `mainMenuPlugin` created separately and passed to both `BpmnEditor` and `createStoragePlugin`
- `openTabConfigs` map tracks latest content of each open tab (name, type, content) for "Save All to Project"
- `onTabActivate` snapshots content into `openTabConfigs` for bpmn/dmn/form tabs

## 2026-02-26 — IndexedDB storage plugin

### `canvas-plugins/storage` (new — `@bpmn-sdk/canvas-plugin-storage`)
- **StorageApi** — full CRUD for workspaces, projects, and files backed by Dexie v4 / IndexedDB; `createWorkspace`, `createProject`, `createFile`, `renameFile`, `setFileShared`, `deleteFile`, `openFile`; `onChange` listeners notify subscribers (sidebar re-renders)
- **AutoSave** — 500 ms debounce per file; captures content snapshot at schedule time; forced `flush()` on `document.visibilitychange hidden` and `window.beforeunload`
- **StorageSidebar** — collapsible DOM left panel (260 px); toggle button floats at top-left of the editor container; expandable workspace → project → file tree; inline + / rename / delete / share-toggle action buttons; empty-state messages
- **File templates** — inline minimal BPMN / DMN / Form XML/JSON templates for new-file creation
- **`createStoragePlugin(options)`** — factory returning `CanvasPlugin & { api: StorageApi }`; subscribes to `diagram:change` via the BpmnEditor runtime cast pattern; injects CSS via `injectStorageStyles()`
- **`FileRecord.isShared`** — boolean flag; shared files surface as a cross-workspace reference pool
- **`FileRecord.gitPath`** — nullable string; reserved for future bidirectional GitHub sync

### `apps/landing`
- Added `@bpmn-sdk/canvas-plugin-storage` dependency and wired `createStoragePlugin` in `editor.ts`
- `onOpenFile` callback opens BPMN / DMN / Form tabs via the tabs plugin and populates the existing in-memory resolver
- `tabIdToStorageFileId` map tracks which tabs were opened from storage; `onTabActivate` updates `storagePlugin.api.setCurrentFileId` so auto-save always targets the correct file

## 2026-02-26 — Editor UX improvements: default color reset, FEEL = prefix stripping, default gateway edge marker

### `packages/editor`
- **Color picker — default option** — added a "no color" swatch (shown first with a diagonal slash indicator) to the color picker; clicking it calls `editor.updateColor(sourceId, {})` to revert to the default styling; swatch is shown as active when no custom color is set

### `packages/canvas`
- **Default gateway edge** — `renderEdge` now renders a small perpendicular slash mark near the source end of sequence flows that are the default flow of their source gateway (exclusive / inclusive / complex); `buildIndex` tracks `defaultFlowIds` by scanning gateway `default` attributes

### `canvas-plugins/config-panel-bpmn`
- **FEEL `=` prefix stripping** — "Open in FEEL Playground ↗" callbacks now strip a leading `= ` (Camunda notation) before passing the expression to the playground, preventing a parse error in expression mode
- **Default flow toggle** — sequence flow config panel gains an `isDefault` toggle field; `SEQUENCE_FLOW_ADAPTER.read` checks whether the source gateway's `default` equals the flow ID; `write` updates the gateway's `default` attribute accordingly

## 2026-02-26 — Editor UX improvements: collapsed toolbars, entity decoding, FEEL expression fields, edge config

### `packages/editor`
- **cfgToolbar type button** — collapsed all element-type variant buttons into a single icon button showing the current type; clicking opens a type-change picker above (same appearance as the group picker in the bottom toolbar)
- **ctxToolbar color swatch** — collapsed the 6 color swatches into a single swatch showing the current color; clicking opens a color picker below the toolbar
- **Edge selection** — `_setEdgeSelected` now emits `editor:select` with `[edgeId]` so subscribers (config panel, HUD) are notified when an edge is selected; `getElementType` returns `"sequenceFlow"` for edge IDs

### `packages/bpmn-sdk`
- **XML entity decoding** — `readAttrValue` and `readText` in `xml-parser.ts` now decode XML entities (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`) and numeric character references (`&#10;`, `&#xA;`, etc.); `escapeAttr` and `escapeText` updated to properly re-encode decoded values on serialization; attribute whitespace (`\n`, `\r`, `\t`) re-encoded as `&#10;` / `&#13;` / `&#9;`

### `canvas-plugins/config-panel`
- New `"feel-expression"` `FieldType`: renders a syntax-highlighted textarea overlay + optional "Open in FEEL Playground ↗" button
- `FieldSchema` gains optional `highlight?: (text: string) => string` and `openInPlayground?: (values) => void` callbacks
- Added FEEL token CSS classes to the config panel stylesheet

### `canvas-plugins/config-panel-bpmn`
- `expression` field on script task and `conditionExpression` on sequence flow now use `type: "feel-expression"` with `highlightToHtml` from `@bpmn-sdk/feel`
- Added `openFeelPlayground?: (expression: string) => void` to `ConfigPanelBpmnOptions`
- Added `@bpmn-sdk/feel` as a dependency

### `canvas-plugins/feel-playground`
- `buildFeelPlaygroundPanel` gains optional `initialExpression?: string` parameter that pre-fills and evaluates the expression on open

### `canvas-plugins/tabs`
- `TabConfig` feel variant gains optional `expression?: string` field; tabs plugin passes it to `buildFeelPlaygroundPanel`

### `apps/landing`
- `openFeelPlayground` callback wired up in `createConfigPanelBpmnPlugin` — opens a feel tab with the expression pre-filled

## 2026-02-26 — Call activity, script task & sequence flow config panel support

### `canvas-plugins/config-panel-bpmn`
- **Call activity** — new schema and adapter: `name`, `processId` (called process ID), `propagateAllChildVariables` (toggle), optional "Open Process ↗" action button, `documentation`; reads and writes `zeebe:calledElement` raw extension element
- **Script task** — replaced GENERAL_SCHEMA entry with a dedicated schema: `name`, `expression` (FEEL textarea), `resultVariable`, `documentation`; reads and writes `zeebe:script` raw extension element
- **Sequence flow / condition expression** — new `SEQUENCE_FLOW_SCHEMA` and `SEQUENCE_FLOW_ADAPTER`: `name` + `conditionExpression` (FEEL textarea); reads and writes `BpmnSequenceFlow.conditionExpression`; registered under the key `"sequenceFlow"`
- Added `openProcess?` to `ConfigPanelBpmnOptions`; new `findSequenceFlow`, `updateSequenceFlow`, `parseCalledElement`, `parseZeebeScript` helpers in `util.ts`

### `canvas-plugins/config-panel`
- `onSelect` now passes `api.getEdges()` to the renderer
- `ConfigPanelRenderer.onSelect(ids, shapes, edges)` — when the selected ID matches no shape, falls back to edge lookup: checks if the ID is in the rendered edges and is a sequence flow in the definitions, then opens the `"sequenceFlow"` schema

### `packages/editor` — HUD navigate button
- `initEditorHud(editor, options?)` gains an optional `HudOptions` parameter with `openProcess?: (processId: string) => void`
- `buildCfgToolbar` adds an "Open Process" icon button above a selected call activity when `processId` is set and `options.openProcess` is provided
- `HudOptions` exported from `@bpmn-sdk/editor`

### `apps/landing`
- `bpmnProcessToTabId` map tracks process ID → tab ID when BPMN files are imported or new diagrams are created
- `initEditorHud` and `createConfigPanelBpmnPlugin` both receive `openProcess` callbacks that activate the matching BPMN tab

## 2026-02-26 — FEEL Playground tab integration + fixes

### `packages/canvas` + `packages/editor` — keyboard fix
- `KeyboardHandler._onKeyDown` now skips handling when the event target is `INPUT`, `TEXTAREA`, or a `contenteditable` element — fixes arrow keys being captured while typing in overlaid form controls
- `BpmnEditor._onKeyDown` (and via it, the state machine) gets the same guard — fixes Delete/Backspace being `preventDefault`-ed when typing in the FEEL playground, because the tabs plugin mounts content inside `api.container` (`this._host`) so textarea events bubble to the editor's keydown handler

### `canvas-plugins/feel-playground`
- `buildFeelPlaygroundPanel(onClose?: () => void): HTMLDivElement` extracted as a public export — used by both the overlay plugin and the tabs plugin
- `createFeelPlaygroundPlugin()` refactored to a thin wrapper using a `.feel-playground-overlay` div with a close callback
- CSS rewritten with light/dark theme support via `[data-theme="dark"]` ancestor selectors matching the canvas container; previously used hardcoded dark colors

### `canvas-plugins/tabs` — FEEL tab type
- `TabConfig` union extended with `{ type: "feel"; name?: string }`
- `GROUP_TYPES` includes `"feel"`; feel badge colors added (amber: `#d97706` light, `#fab387` dark)
- `mountTabContent` for `feel` type: injects playground styles and mounts `buildFeelPlaygroundPanel()` in the pane (no close button, fills the pane)
- Welcome screen badge `feel` style added

### `apps/landing`
- FEEL Playground opened as a proper tab (`tabsPlugin.api.openTab({ type: "feel" })`) instead of an overlay — accessible from the command palette, the ⋯ main menu, and the welcome screen examples list
- `createFeelPlaygroundPlugin()` removed from the editor plugins array; direct `@bpmn-sdk/canvas-plugin-feel-playground` dependency removed from `landing/package.json` (tabs handles it)
- "FEEL Playground" added to `makeExamples()` with FEEL badge

## 2026-02-26 — FEEL Language Support

### `packages/feel` — `@bpmn-sdk/feel`
- **Lexer** (`lexer.ts`) — position-aware tokenizer; handles temporal literals (`@"..."`), backtick names, `..`/`**` operators, block/line comments; 16 tests
- **AST** (`ast.ts`) — discriminated union `FeelNode` with start/end positions on every node; range nodes use `low`/`high` to avoid position field conflicts
- **Parser** (`parser.ts`) — Pratt recursive-descent; two entry points: `parseExpression()` and `parseUnaryTests()`; greedy multi-word name resolution via `BUILTIN_PREFIXES`; error recovery with synchronization points; 42 tests
- **Built-ins** (`builtins.ts`) — ~60 functions across conversion, string, numeric, list, context, temporal, and range categories; dual calling convention (scalar and list arguments)
- **Evaluator** (`evaluator.ts`) — tree-walking evaluator; three-valued `and`/`or` logic; path access, filter, `for`/`some`/`every`, named args; `evaluateUnaryTests()` entry point; 75 tests
- **Formatter** (`formatter.ts`) — pretty printer with line-length-aware wrapping; round-trip tests; 20 tests
- **Highlighter** (`highlighter.ts`) — `annotate()` returns `AnnotatedToken[]`; `highlightToHtml()` returns HTML with `feel-*` CSS classes; `highlightFeel` backward-compat alias
- Zero runtime dependencies; 153 tests total; passes biome and TypeScript strict mode

### `canvas-plugins/feel-playground` — `@bpmn-sdk/canvas-plugin-feel-playground`
- **Interactive FEEL panel** — Expression / Unary-Tests mode toggle; syntax-highlighted textarea overlay; JSON context input; live result display with type-colored output; error display; 10 pre-built examples
- **`createFeelPlaygroundPlugin()`** — returns `FeelPlaygroundPlugin` (extends `CanvasPlugin` with `show()`)
- Wired into the landing page editor via a "FEEL Playground" command palette entry (Ctrl+K)

### `canvas-plugins/dmn-viewer` — migrated
- `src/feel.ts` replaced with thin re-exports from `@bpmn-sdk/feel`; `highlightFeel`/`tokenizeFeel` now use the full FEEL lexer and highlighter; `FeelToken`/`FeelTokenType` re-exported as `AnnotatedToken`/`HighlightKind`

## 2026-02-26 — Welcome Screen Examples

### `canvas-plugins/tabs`
- **`WelcomeExample` interface** — `{ label, description?, badge?, onOpen: () => void }`; exported from the plugin
- **`examples` option** added to `TabsPluginOptions`; when non-empty, the welcome screen renders a divider, "Examples" heading, and a scrollable list of clickable example entries with badge, label, description, and a chevron arrow
- **CSS** — example list, badges (type-coloured: BPMN=blue, DMN=purple, FORM=green, MULTI=orange), hover and active states; dark/light theme variants

### `apps/landing` — examples.ts + editor.ts
- **Shipping Cost DMN** — FIRST hit-policy decision table: package weight × destination → shipping cost + carrier; 4 rules
- **Support Ticket Form** — subject, category (select), priority (radio), description, file attachment, submit button
- **Loan Application (MULTI)** — BPMN with a `userTask` linked to `form-loan-application` and a `businessRuleTask` linked to `decision-credit-risk`; Credit Risk DMN (UNIQUE, 4 rules: credit score × amount → risk level + approved + max); Loan Application Form (name, DOB, employment, income, amount, purpose, notes, consent, submit); opening the multi-file example registers DMN + Form in the resolver and opens all three tabs
- **`makeExamples(api, resolver)`** factory exported from `examples.ts`; returns 4 `WelcomeExample` items (Order Validation BPMN, Shipping Cost DMN, Support Ticket FORM, Loan Application MULTI)
- **`editor.ts`** passes `examples` via a lazy getter so `tabsPlugin.api` is available when the welcome screen renders during `install()`

## 2026-02-26 — Welcome Screen + Grouped Tabs

### `canvas-plugins/tabs`
- **Welcome screen** — shown on install before any tab is opened; centered card with a BPMN process icon, title, subtitle, "New diagram" and "Import files…" buttons; supports light/dark theme via `data-theme`; hidden when first tab opens, reappears when last tab is closed
- **`onNewDiagram` / `onImportFiles` options** added to `TabsPluginOptions` to wire up the welcome screen buttons
- **Grouped tabs** — the tab bar now shows at most three group tabs (one per type: BPMN, DMN, FORM); each group displays the active file's name with a type badge; a chevron (▾) appears when multiple files of the same type are open and opens a fixed-position dropdown listing all files with per-file close buttons; when a group has only one file, the close button is on the tab itself
- **`groupActiveId` map** — tracks the last-activated tab ID per type so group tabs remember which file was last selected
- **`renderTabBar()`** — replaces per-tab DOM management with a single function that rebuilds the tab bar from scratch; safe because at most 3 group tabs exist
- **Body-level dropdown** — appended to `document.body` as `position: fixed` to avoid z-index/clipping issues; outside-click handler closes it; cleaned up on `uninstall()`
- **Tests** — 17 tests covering welcome screen show/hide, button callbacks, grouping, chevron/close-button logic, active file name, and tab lifecycle

### `apps/landing` — editor.ts
- **`onNewDiagram`** callback opens a new BPMN tab with `SAMPLE_XML`
- **`onImportFiles`** callback triggers the existing hidden `<input type="file">` element

## 2026-02-26 — Close-Tab Download Prompt

### `canvas-plugins/tabs`
- **`onDownloadTab` option** — new `TabsPluginOptions.onDownloadTab?: (config: TabConfig) => void` callback; when provided, the "Download & Close" button appears in the close dialog
- **`hasContent()` helper** — returns `false` for the initial BPMN tab (`xml: ""`), so closing the main diagram pane skips the dialog entirely
- **`showCloseDialog()`** — in-canvas modal overlay with Cancel / "Close without saving" / "Download & Close" buttons, Escape key dismissal, and correct light/dark theming via `data-theme`
- **Dialog CSS** — `.bpmn-close-overlay` / `.bpmn-close-dialog` added to `css.ts` with full light and dark CSS variable sets

### `apps/landing` — editor.ts
- **`onDownloadTab` callback** — serializes the tab content (`config.xml` for BPMN, `Dmn.export(defs)` for DMN, `Form.export(form)` for Form), creates a `Blob`, triggers a browser download via an `<a>` element with `download` attribute, then revokes the object URL

## 2026-02-26 — UX Fixes: Theme, Z-index, Toolbar Visibility, Content Width

### `canvas-plugins/tabs`
- **Theme detection fix** — the tabs plugin was watching `data-bpmn-theme` via MutationObserver, but the canvas sets `data-theme` (absent = light, `"dark"` = dark). Fixed both the initial detection and the observer attribute filter/callback to use `data-theme`

### `canvas-plugins/main-menu`
- **Z-index raised** — `.bpmn-main-menu-panel` z-index increased from 10 to 110 so the title/menu button renders above the tab bar (which is z-index 100)

### `canvas-plugins/dmn-viewer`
- **Content width** — `.dmn-viewer` no longer has `padding`; a new `.dmn-viewer-body` inner wrapper provides `max-width: 1100px; margin: 0 auto; padding: 24px`, centering the decision table horizontally with a reasonable max-width

### `canvas-plugins/form-viewer`
- **Content width** — same pattern: `.form-viewer-body` with `max-width: 680px; margin: 0 auto; padding: 24px`; the form renders narrower, centered, matching standard form UX conventions

### `apps/landing` — editor.ts
- **Toolbar visibility** — `onTabActivate` now toggles `display: none` on `#hud-top-center`, `#hud-bottom-left`, `#hud-bottom-center` when switching to DMN/Form tabs; toolbars reappear on return to BPMN
- **Config panel auto-close** — `onTabActivate` calls `editor.setSelection([])` on non-BPMN tabs, which fires `editor:select` with empty IDs, causing the config panel and contextual toolbars to close automatically; also closes the panel when "Open Decision ↗" / "Open Form ↗" navigation triggers a tab switch

## 2026-02-26 — Editor Integration: Multi-file Import + Tabs

### `apps/landing` — editor.ts
- **`InMemoryFileResolver`** created and shared between the tabs plugin and the config panel bpmn callbacks
- **`createTabsPlugin`** added to the editor plugin stack with `onTabActivate` wired to `editor.load(xml)` for BPMN tabs
- **`createConfigPanelBpmnPlugin`** now receives `openDecision` and `openForm` callbacks that delegate to `tabsPlugin.api.openDecision/openForm`
- **Multi-file import via menu** — "Import files…" entry in the main-menu dropdown opens a `<input type="file" multiple>` accepting `.bpmn`, `.xml`, `.dmn`, `.form`, `.json`; each file is parsed and opened in its own tab
- **Drag-and-drop** — `dragover`/`drop` handlers on `#editor-container` accept dropped files; same parsing and tab-opening logic
- `.bpmn`/`.xml` → BPMN tab (loaded into the editor via `onTabActivate`); `.dmn` → DMN tab (registered in resolver); `.form`/`.json` → Form tab (registered in resolver)

### `canvas-plugins/main-menu` — menuItems extension
- **`menuItems?: MenuItem[]`** added to `MainMenuOptions`; supports `MenuAction` (label + optional icon + onClick) and `MenuSeparator`
- Custom items render above the Theme section with an automatic separator; theme section wrapped in a `display:contents` div so `buildThemeItems` rebuilds only that portion
- **`.bpmn-menu-drop-sep`** CSS added for the separator rule

### `canvas-plugins/tabs` — onTabActivate + transparent BPMN panes
- **`onTabActivate?: (id, config) => void`** added to `TabsPluginOptions`; called in `setActiveTab` after the tab is made active
- **BPMN panes** are now empty (no text note) and transparent — the main canvas SVG shows through
- **`pointer-events: none`** applied to the content area when a BPMN tab is active so the canvas remains fully interactive; restored when a DMN/Form tab is active

## 2026-02-26 — DMN Viewer, Form Viewer, Tabs Plugin, Extended Core Model

### `@bpmn-sdk/core` — Zeebe extensions + full Form component set
- **`ZeebeFormDefinition`** and **`ZeebeCalledDecision`** typed interfaces added to `zeebe-extensions.ts`; `ZeebeExtensions` grows `formDefinition?` and `calledDecision?` fields; `zeebeExtensionsToXmlElements` serialises both
- **`bpmn-builder.ts`** updated: `userTask()` now writes `formDefinition: { formId }` and `businessRuleTask()` writes `calledDecision: { decisionId, resultVariable }` using typed fields instead of raw `XmlElement[]`
- **13 new Form component types** — `number`, `datetime`, `button`, `taglist`, `table`, `image`, `dynamiclist`, `iframe`, `separator`, `spacer`, `documentPreview`, `html`, `expression`, `filepicker`
- **`FormUnknownComponent`** catch-all added; parser now handles unknown types leniently instead of throwing
- `form-serializer.ts` updated to handle all component types via explicit type assertions (workaround for discriminated union narrowing issue with catch-all type)
- All new types exported from `packages/bpmn-sdk/src/index.ts`

### `canvas-plugins/dmn-viewer` — New package `@bpmn-sdk/canvas-plugin-dmn-viewer`
- **`DmnViewer` class** — `load(defs)`, `clear()`, `setTheme()`, `destroy()`; renders `DmnDefinitions` as an HTML decision table with hit policy badge
- **FEEL syntax highlighting** — `tokenizeFeel()` / `highlightFeel()` tokenize FEEL expressions into keyword, string, number, operator, range, function, comment spans; colored via CSS custom properties
- **Light/dark themes** — CSS custom properties; `setTheme("light"|"dark"|"auto")`; auto follows `prefers-color-scheme`
- **`createDmnViewerPlugin(options)`** — thin `CanvasPlugin` wrapper; responds to `element:click` on call activities referencing a decision via `zeebe:calledDecision`

### `canvas-plugins/form-viewer` — New package `@bpmn-sdk/canvas-plugin-form-viewer`
- **`FormViewer` class** — `load(form)`, `clear()`, `setTheme()`, `destroy()`; renders all 21 `FormComponent` types
- **Row-based grid layout** — components grouped by `layout.row`; side-by-side rendering within a row
- **All 21 component types rendered** — textfield, textarea, number, datetime, select, radio, checkbox, checklist, taglist, button, group, dynamiclist, table, image, iframe, separator, spacer, documentPreview, html, expression, filepicker, and unknown passthrough
- **Minimal markdown** — `text` components support `#`/`##` headers, `**bold**`, `_italic_`
- **`createFormViewerPlugin(options)`** — thin `CanvasPlugin` wrapper; responds to `element:click` on user tasks with a `zeebe:formDefinition`

### `canvas-plugins/tabs` — New package `@bpmn-sdk/canvas-plugin-tabs`
- **`FileResolver` interface** — `resolveDmn(decisionId)`, `resolveForm(formId)`, `resolveBpmn(processId)`; pluggable abstraction for in-memory, file system, or SaaS backends
- **`InMemoryFileResolver`** — default implementation using Maps; `registerDmn(defs)` / `registerForm(form)` / `registerBpmn(id, xml)` to populate at runtime
- **Tab bar overlay** — fixed overlay inside the canvas container; tabs for BPMN/DMN/Form files; close button per tab; active tab highlighted
- **`TabsApi`** — `openTab()`, `closeTab()`, `setActiveTab()`, `getActiveTabId()`, `getTabIds()`, `openDecision(decisionId)`, `openForm(formId)` public API
- **Warning badge** — shown when referenced file is not found in the file resolver registry
- **`createTabsPlugin(options)`** — factory returning `CanvasPlugin & { api: TabsApi }`

### `canvas-plugins/config-panel` + `config-panel-bpmn` — Typed userTask/businessRuleTask panels
- **`"action"` FieldType** added to `config-panel`; `FieldSchema.onClick` callback invoked when the action button is clicked
- **`.bpmn-cfg-action-btn`** button styles added (light and dark themes)
- **`makeUserTaskSchema(onOpenForm?)`** — config panel schema for user tasks: `formId` text field + conditional "Open Form ↗" action button
- **`USER_TASK_ADAPTER`** — reads/writes `zeebe:formDefinition/@formId` via typed `ext.formDefinition`
- **`makeBusinessRuleTaskSchema(onOpenDecision?)`** — schema for business rule tasks: `decisionId`, `resultVariable` fields + conditional "Open Decision ↗" action button
- **`BUSINESS_RULE_TASK_ADAPTER`** — reads/writes `zeebe:calledDecision` via typed `ext.calledDecision`
- **`ConfigPanelBpmnOptions`** — `openDecision?` and `openForm?` callback options on the plugin factory
- `createConfigPanelBpmnPlugin(configPanel, options?)` registers userTask and businessRuleTask with their specific schemas
- `parseZeebeExtensions` in `util.ts` updated to parse `formDefinition` and `calledDecision` extension elements

## 2026-02-26 — Landing Page Editor Link + Mobile Editor Responsiveness

### `apps/landing` — Editor discoverability
- **"Try the Editor →" button** added to hero section with a gradient `btn-editor` style (accent → green)
- **Footer link** to `/editor` added alongside GitHub and npm links

### `@bpmn-sdk/editor` — Collapsible HUD toolbars on mobile (≤600px)
- **Bottom-center toolbar** (`#hud-bottom-center`) starts collapsed on mobile; tapping the toggle button expands it to full width; auto-collapses after selecting any tool or element group
- **Top-center toolbar** (`#hud-top-center`) same pattern; auto-collapses after undo/redo/delete/duplicate
- Toggle button icons update to reflect the currently active tool (bottom-center) or show the undo icon (top-center)
- Tapping outside an expanded toolbar collapses it; expanding one collapses the other
- Desktop layout unchanged — toggle buttons hidden via CSS media query

## 2026-02-25 — SubProcess Containment + Sticky Movement

### `@bpmn-sdk/editor` — Container-aware modeling operations

- **Sticky movement** — moving an `adHocSubProcess` (or any subprocess/transaction) also moves all descendant DI shapes; edge waypoints for flows inside or connected to the subprocess are updated correctly using a new `collectAllSequenceFlows` helper that searches all nesting levels
- **Containment on create** — when a new shape is dropped inside a subprocess's DI bounds, `createShape` detects the innermost container via `findContainerForPoint` and nests the new `BpmnFlowElement` inside it via `addToContainer`; the DI shape is always added flat to `diagram.plane.shapes`
- **Cascade delete** — deleting a subprocess recursively collects all descendant element and flow IDs via `collectDescendantIds`, then `removeFromContainers` removes them from all nesting levels; DI shapes and edges for descendants are also removed
- **Recursive label update** — `updateLabel` now uses `updateNameInElements` which searches all nesting levels; renaming a task inside a subprocess now works
- **Recursive incoming/outgoing update** — `createConnection` now uses `updateRefInElements` so connecting subprocess-child elements correctly updates their `incoming`/`outgoing` refs

## 2026-02-25 — Agentic AI Subprocess Support

### `@bpmn-sdk/core` — `ZeebeAdHoc` typed interface
- **`ZeebeAdHoc`** interface added to `zeebe-extensions.ts`: `outputCollection`, `outputElement`, `activeElementsCollection` fields
- **`ZeebeExtensions.adHoc`** field added; `zeebeExtensionsToXmlElements` now serialises `zeebe:adHoc` element when present

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Full AI Agent template support
- **`TemplateBinding`** union extended with `{ type: "zeebe:adHoc"; property: "outputCollection" | "outputElement" | "activeElementsCollection" }` in `template-types.ts`
- **`getPropertyKey`** handles `zeebe:adHoc` → `adHoc.${property}` key
- **`readPropertyValue`** reads `zeebe:adHoc` attributes via `getAdHocAttr(el.extensionElements, property)`; `el` parameter widened to include `extensionElements`
- **`applyBinding`** accepts new `adHocProps` accumulator; populates it for `zeebe:adHoc` bindings
- **Template engine `write`**: adds `"adHoc"` to `ZEEBE_LOCAL` set (prevents duplicate elements); passes `adHocProps` to `zeebeExtensionsToXmlElements` → produces correct `<zeebe:adHoc outputCollection="toolCallResults" outputElement="..."/>` in the XML
- **`getAdHocAttr`** helper added to `util.ts`
- **`ADHOC_SUBPROCESS_TEMPLATES`** — filters `CAMUNDA_CONNECTOR_TEMPLATES` to templates that apply to `bpmn:SubProcess` (including `io.camunda.connectors.agenticai.aiagent.jobworker.v1`)
- **`ADHOC_OPTIONS`** dropdown — "Custom" + all ad-hoc subprocess templates, sorted alphabetically
- **`GENERIC_ADHOC_SCHEMA` + `ADHOC_SUBPROCESS_ADAPTER`** — template-aware config panel for `adHocSubProcess`; `resolve()` hook delegates to the AI Agent template registration when `zeebe:modelerTemplate` is set; `write()` stamps `zeebe:modelerTemplate` and delegates to template adapter; clearing sets connector to "" and removes all modelerTemplate attributes
- **`adHocSubProcess`** registered in `createConfigPanelBpmnPlugin.install()`
- **6 new tests** in `index.test.ts` covering registration, read/write, resolve, template delegation, and clearing

### `@bpmn-sdk/editor` — Ad-hoc subprocess as a creatable element
- **`CreateShapeType`**: `"adHocSubProcess"` added to the union
- **`RESIZABLE_TYPES`**: `"adHocSubProcess"` added
- **`ELEMENT_TYPE_LABELS`**: `adHocSubProcess: "Ad-hoc Sub-Process"` added
- **`ELEMENT_GROUPS`**: `"adHocSubProcess"` added to the Activities group (after `subProcess`, before `transaction`)
- **`makeFlowElement`**: `case "adHocSubProcess"` — creates element with empty `flowElements`, `sequenceFlows`, `textAnnotations`, `associations`
- **`changeElementType`**: `case "adHocSubProcess"` — preserves child contents when changing to/from ad-hoc subprocess
- **`defaultBounds`**: `"adHocSubProcess"` added alongside `"subProcess"` and `"transaction"` — 200×120 px
- **`icons.ts`**: `adHocSubProcess` SVG icon added (rounded rect + tilde wave marker, matches BPMN standard notation)

## 2026-02-25 — Config Panel: Template Adapter Bug Fix + Required Field Indicators

### `@bpmn-sdk/canvas-plugin-config-panel` — Bug fix + required field UI
- **Bug**: `_applyField` was always using the base registered adapter (`this._schemas.get(type)`) instead of `this._effectiveReg` (the template-resolved adapter). The generic `SERVICE_TASK_ADAPTER.write()` explicitly strips `zeebe:modelerTemplate`, causing the template panel to revert to the generic service task form whenever a field was changed while a connector template was active. Fixed by resolving `effective = this._effectiveReg ?? reg` and using `effective.adapter.write()` + `effective.schema` in `_applyField`.
- **Feature**: Required field visual indication — `FieldSchema` gains an optional `required?: boolean` field; when set, a red asterisk (`*`) is shown next to the label and the input/select/textarea gets a red border when empty. Validation state is refreshed on every field change and on diagram reload.
- **`_refreshValidation(schema)`** — new method that toggles `.bpmn-cfg-field--invalid` on field wrappers for required fields with empty values; called from `_applyField` and `onDiagramChange`.
- **`FIELD_WRAPPER_ATTR`** now stamped on every field wrapper (not just conditional ones) so both `_refreshConditionals` and `_refreshValidation` can query by key.
- **CSS**: `.bpmn-cfg-required-star` (red `#f87171`) and `.bpmn-cfg-field--invalid` border style added to `css.ts`.

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Propagate `required` from templates
- **`propToFieldSchema`** — sets `required: true` on the generated `FieldSchema` when `prop.constraints?.notEmpty === true`; all Camunda connector template fields marked `notEmpty` now show the required indicator in the config panel.

## 2026-02-25 — Connector Template Icons Rendered in Canvas

### `@bpmn-sdk/canvas` — Template icon rendering
- **`renderer.ts`** — `renderTask()` checks `el.unknownAttributes["zeebe:modelerTemplateIcon"]`; if present, renders an SVG `<image>` element (14×14 at position 4,4) with `href` set to the data URI instead of the hardcoded gear icon; standard task type icons are unaffected
- **1 new test** in `canvas.test.ts`: verifies `<image>` is rendered and gear icon circles are absent when `modelerTemplateIcon` is set

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Stamp icon on template apply
- **`template-engine.ts`** — `adapter.write()` now includes `zeebe:modelerTemplateIcon` in `unknownAttributes` when the template has `icon.contents`; icon is persisted to the BPMN element whenever a connector template is applied via the UI

## 2026-02-25 — Connector Templates Usable via Core Builder

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — `templateToServiceTaskOptions`
- **`templateToServiceTaskOptions(template, values)`** — converts any `ElementTemplate` + user-provided values into `ServiceTaskOptions` for the core `Bpmn` builder; applies Hidden property defaults and user values to zeebe bindings
- **`CAMUNDA_CONNECTOR_TEMPLATES`** — now exported from the package public API
- **3 new tests** in `tests/template-to-service-task.test.ts`: Kafka connector options, full Bpmn build integration, REST connector template defaults

## 2026-02-25 — Camunda Connector Templates: Fetch, Generate, Integrate

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — All 116 Camunda connectors
- **`scripts/update-connectors.mjs`** — new script that fetches all OOTB connector templates from the Camunda marketplace (`marketplace.cloud.camunda.io/api/v1/ootb-connectors`), resolves each template's `ref` URL, and writes `canvas-plugins/config-panel-bpmn/src/templates/generated.ts` with all templates as a typed array
- **`pnpm update-connectors`** — root-level script to regenerate `generated.ts` at any time
- **`generated.ts`** excluded from Biome linting (`biome.json` `files.ignore`)
- **116 connector templates** registered in `TEMPLATE_REGISTRY` at startup (all OOTB Camunda connectors: REST, Slack, Salesforce, ServiceNow, GitHub, Twilio, AWS, Azure, Google, WhatsApp, Facebook, etc.)
- **Connector selector** shows all 116 service-task connectors (one entry per template id, no collisions even when multiple connectors share the same underlying task type)
- **Write path** accepts template id directly from CONNECTOR_OPTIONS, with backward-compat fallback to task type → template id map
- **`TASK_TYPE_TO_TEMPLATE_ID`** built with first-wins per task type for backward-compat detection
- **Deleted `rest-connector.ts`** — hand-written REST template superseded by `generated.ts`

## 2026-02-25 — Element Templates System + REST Connector Template

### `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Template-aware property panel
- **Element template types** — `ElementTemplate`, `TemplateProperty`, `TemplateBinding`, `TemplateCondition` TypeScript types matching the Camunda element templates JSON schema
- **Template engine** — `buildRegistrationFromTemplate(template)` converts any element template descriptor into a `PanelSchema` + `PanelAdapter` pair; handles all binding types (`zeebe:input`, `zeebe:taskHeader`, `zeebe:taskDefinition`), condition types (`equals`, `oneOf`, `allMatch`), and property types (`String`, `Text`, `Dropdown`, `Boolean`, `Number`, `Hidden`)
- **REST Outbound Connector template** — official Camunda template (`io.camunda.connectors.HttpJson.v2`, version 12) bundled as TypeScript; covers all 8 groups: Authentication (noAuth/apiKey/basic/bearer/OAuth 2.0), HTTP endpoint, Timeout, Payload, Output mapping, Error handling, Retries
- **Dynamic schema resolution** — `PanelAdapter.resolve?()` mechanism: when `zeebe:modelerTemplate` attribute is detected on an element (or inferred from known task type), the panel switches to the template-specific form automatically
- **Template application** — selecting a connector in the generic service task form stamps `zeebe:modelerTemplate` + delegates all field writes to the template adapter (including template-specific fields like URL, method, auth)
- **`registerTemplate(template)`** — public API on the plugin for registering additional element templates at runtime
- **`TEMPLATE_ID_TO_TASK_TYPE` / `TASK_TYPE_TO_TEMPLATE_ID`** maps for bidirectional connector detection
- **Backward compatibility** — elements with known task definition types (e.g. `io.camunda:http-json:1`) but without `zeebe:modelerTemplate` are still detected and shown with the correct template form

### `@bpmn-sdk/canvas-plugin-config-panel` — Dynamic registration
- **`PanelAdapter.resolve?(defs, id)`** — optional method that overrides the schema+adapter for a specific element instance; renderer calls it on every select and diagram-change event
- **Re-render on schema change** — when `resolve?` returns a different registration (e.g. template applied), the compact/full panel re-renders automatically without requiring a manual re-select

### `@bpmn-sdk/core` — Builder
- **`restConnector()` stamps `zeebe:modelerTemplate`** — builder now sets `zeebe:modelerTemplate: "io.camunda.connectors.HttpJson.v2"` and `zeebe:modelerTemplateVersion: "12"` on the element; programmatically generated BPMN is now recognized by the editor's template panel

## 2026-02-25 — Intermediate Event Subgroups, Boundary Events, Ghost Fix

### `@bpmn-sdk/editor` — Event system overhaul
- **3 event subgroups** — single "Events" palette group replaced with `startEvents` (5 types), `endEvents` (7 types), `intermediateEvents` (10 types)
- **20 new `CreateShapeType` values** — one per BPMN event variant: `messageStartEvent`, `timerStartEvent`, `conditionalStartEvent`, `signalStartEvent`; `messageEndEvent`, `escalationEndEvent`, `errorEndEvent`, `compensationEndEvent`, `signalEndEvent`, `terminateEndEvent`; `messageCatchEvent`, `messageThrowEvent`, `timerCatchEvent`, `escalationThrowEvent`, `conditionalCatchEvent`, `linkCatchEvent`, `linkThrowEvent`, `compensationThrowEvent`, `signalCatchEvent`, `signalThrowEvent`
- **`makeFlowElement` / `changeElementType`** — all 20 new types map to the correct BPMN base type (`startEvent`, `endEvent`, `intermediateCatchEvent`, `intermediateThrowEvent`) with the right `eventDefinitions` entry
- **Type-switch restriction** — types can only change within their subgroup: start events ↔ start events, end ↔ end, intermediate ↔ intermediate (enforced by group membership)
- **`getElementType` resolution** — returns specific palette type (e.g. `"messageCatchEvent"`) by inspecting `eventDefinitions[0]`; cfg toolbar highlights the correct active variant
- **Boundary events** — creating any intermediate event type while hovering over an activity shows a dashed blue highlight on the host; on click, a `boundaryEvent` is created attached to that activity at the cursor's nearest boundary point; `cancelActivity = true` by default
- **`createBoundaryEvent(defs, hostId, eventDefType, bounds)`** — new modeling function; creates `BpmnBoundaryEvent` in `process.flowElements` + DI shape
- **`moveShapes` cascade** — moving an activity automatically also moves its attached boundary events
- **`deleteElements` cascade** — deleting an activity also deletes its attached boundary events
- **Ghost shape preview fix** — `overlay.ts::setGhostCreate` now renders correct shape per type: thin circle (start), thick circle (end), double ring (intermediate), diamond (gateway), bracket (annotation), rounded rect (activities)
- **`defaultBoundsForType` in overlay.ts** — fixed to cover all event and gateway types (36×36 for events, 50×50 for gateways)
- **Escape key to cancel** — canvas host is now focused when entering create mode, ensuring Escape key correctly cancels creation
- **39 element commands** — command palette and shape palette now cover all BPMN element variants (was 21, now 39)

## 2026-02-25 — Full BPMN Element Type Coverage

### `@bpmn-sdk/core` — New model types
- **`BpmnTask`**, **`BpmnManualTask`**, **`BpmnTransaction`**, **`BpmnComplexGateway`** — new flow element interfaces added to the discriminated union
- **`BpmnLane`**, **`BpmnLaneSet`** — swimlane hierarchy; `BpmnProcess.laneSet` optional field
- **`BpmnMessageFlow`** — inter-pool communication; `BpmnCollaboration.messageFlows` array
- **New event definitions** — `BpmnConditionalEventDefinition`, `BpmnLinkEventDefinition`, `BpmnCancelEventDefinition`, `BpmnTerminateEventDefinition`, `BpmnCompensateEventDefinition`; all added to `BpmnEventDefinition` union
- **Parser** — full parse support for all new types including `parseLaneSet`, `parseLane`, `parseMessageFlow`; `compensation` → `compensate` event def rename
- **Serializer** — full serialize support for all new types; `serializeLaneSet`, `serializeLane`, `serializeMessageFlow`
- **Builder** — `makeFlowElement` extended with task, manualTask, complexGateway, transaction cases

### `@bpmn-sdk/canvas` — New renderers
- **Pool/lane rendering** — `renderPool` and `renderLane` produce container rects with rotated title bars; `ModelIndex` now indexes `participants` and `lanes` maps
- **Message flow rendering** — dashed inter-pool arrows rendered in the edge loop via `messageFlowIds` Set
- **Non-interrupting boundary events** — dashed inner ring via new `.bpmn-event-inner-dashed` CSS class when `cancelActivity === false`
- **Transaction** — double inner border rect inside the task body
- **New event markers** — conditional (document icon), link (arrow), cancel (X), terminate (filled circle); `compensation` renamed to `compensate`
- **New gateway marker** — complexGateway asterisk (diagonal + cross paths)
- **New task icon** — manualTask (hand SVG path)

### `@bpmn-sdk/editor` — New creatable types
- **8 new `CreateShapeType` values** — `intermediateThrowEvent`, `intermediateCatchEvent`, `task`, `manualTask`, `callActivity`, `subProcess`, `transaction`, `complexGateway`
- **`RESIZABLE_TYPES`** — task, manualTask, callActivity, subProcess, transaction added
- **`defaultBounds`** — intermediate events 36×36; complexGateway 50×50; subProcess/transaction 200×120
- **Element groups** — events group gains intermediate throw/catch; activities group gains task, manualTask, callActivity, subProcess, transaction; gateways group gains complexGateway
- **Icons** — all 8 new types have dedicated SVG icons
- **`EXTERNAL_LABEL_TYPES`** — intermediateThrowEvent, intermediateCatchEvent, complexGateway added (external label placement)
- **`makeFlowElement` / `changeElementType`** — all 8 new types handled in modeling operations

### `@bpmn-sdk/canvas-plugin-command-palette-editor`
- Updated command count: 21 element creation commands (was 13); test updated accordingly

## 2026-02-25 — Watermark Plugin

### `@bpmn-sdk/canvas-plugin-watermark` (NEW)
- **`createWatermarkPlugin(options?)`** — bottom-right attribution bar; renders configurable links and an optional square SVG logo; logo is always the rightmost element; fully self-contained CSS injection
- **`WatermarkLink`** / **`WatermarkOptions`** interfaces exported
- 7 tests; added to `canvas-plugins/*` workspace

### `@bpmn-sdk/landing` — editor page
- Added watermark plugin with a "Github" link (`https://github.com/bpmn-sdk/monorepo`) and a BPMN-flow square SVG logo (start event → task → end event on blue rounded square)

## 2026-02-25 — Annotation Bug Fixes

### `@bpmn-sdk/canvas`
- **Annotation selection** — added transparent `<rect>` fill covering the full bounding area so the entire annotation rectangle is clickable/draggable
- **Bracket path** — changed from short-stub to full-width open-right bracket (`M w 0 L 0 0 L 0 h L w h`) matching standard BPMN notation
- **Annotation text position** — text now centred in the full shape area (`cx = width/2, cy = height/2, maxW = width - 8`)

## 2026-02-25 — Colors & Text Annotations

### `@bpmn-sdk/core` — `DiColor` helpers
- **NEW `packages/bpmn-sdk/src/bpmn/di-color.ts`** — `DiColor` interface, `readDiColor`, `writeDiColor`, `BIOC_NS`, `COLOR_NS` re-exported from `@bpmn-sdk/core`

### `@bpmn-sdk/canvas` — Color rendering + annotation text
- **`RenderedShape.annotation?: BpmnTextAnnotation`** — annotation object available on rendered shapes
- **Color rendering** — `applyColor(el, shape)` helper reads `bioc:fill`/`bioc:stroke` (+ OMG namespace equivalents) from DI `unknownAttributes` and applies inline `style` on shape bodies (task rect, event outer circle, gateway diamond)
- **Annotation text** — `renderAnnotation` now accepts a `text` param and renders wrapped text inside the bracket
- **Model index** — `buildIndex` now indexes `textAnnotations` from all processes and collaborations

### `@bpmn-sdk/editor` — New tools, color editing, annotation editing
- **`textAnnotation` type** — added to `CreateShapeType`, `ELEMENT_GROUPS` ("Annotations" group), `ELEMENT_TYPE_LABELS`, `RESIZABLE_TYPES`, `defaultBounds`
- **`createAnnotation(defs, bounds, text?)`** — creates a `BpmnTextAnnotation` + DI shape
- **`createAnnotationWithLink(defs, bounds, sourceId, sourceBounds, text?)`** — creates annotation + `BpmnAssociation` + DI edge
- **`updateShapeColor(defs, id, color)`** — writes `bioc:`/`color:` attributes via `writeDiColor`; adds namespaces to definitions
- **`updateLabel`** — extended to update `text` on `BpmnTextAnnotation`
- **`deleteElements`** — cascades to remove linked associations (and their DI edges) when a flow element or annotation is deleted
- **`moveShapes`** — recomputes association edge waypoints when source or target shape moves
- **`editor.createAnnotationFor(sourceId)`** — creates a linked annotation above-right of source; opens label editor
- **`editor.updateColor(id, color)`** — applies color or clears it (pass `{}`)
- **Double-click annotation** — opens label editor via existing `_startLabelEdit` (now reads `textAnnotations.text`)
- **Annotation resize** — `_isResizable`/`_getResizableIds` now include annotation shapes
- **HUD color swatches** — 6 preset color swatches in ctx toolbar for all non-annotation flow elements; clicking active swatch clears the color
- **HUD annotation button** — "Add text annotation" button in ctx toolbar creates a linked annotation

## 2026-02-25

### `@bpmn-sdk/canvas-plugin-config-panel` + `@bpmn-sdk/canvas-plugin-config-panel-bpmn` — Connector selector
- **`FieldSchema.condition`** — new optional field; hides a field when the predicate returns false, mirroring the existing `GroupSchema.condition` at the individual-field level
- **`ConfigPanelRenderer._refreshConditionals`** — new method updates both field-level and group/tab visibility; called synchronously from `_applyField` (immediate UI) and `onDiagramChange` (after external model update)
- **Service task "Connector" selector** — replaces the raw `taskType` text input with a `connector` select dropdown:
  - `""` → **Custom** — shows a `taskType` text field for the Zeebe job type string
  - `"io.camunda:http-json:1"` → **REST Connector** — hides the task-type field; shows Request / Authentication / Output tab groups
- **Adapter logic** — `read()` derives `connector` value from `taskDefinition.type`; `write()` only emits REST ioMapping / taskHeaders when REST connector is selected (switching to Custom clears REST-specific extensions)
- **4 new tests** in `canvas-plugins/config-panel-bpmn/tests/index.test.ts`

## 2026-02-24

### Config panel fixes (round 2)

- **z-index**: Overlay and compact panel both raised to `z-index: 9999` — always above HUD toolbars
- **Centering**: When the full panel opens, the selected element is panned to the horizontal/vertical center of the left 35% darkened area (preserving zoom). Closing the panel re-centers the element at the global screen center
- **Tabs**: Section navigation replaced with proper underline tabs; only one group's content is visible at a time; active tab highlighted in blue; switching tabs is instant (show/hide, no DOM rebuild)
- **Conditional REST fields**: Service task REST connector groups (Request, Authentication, Output) are now hidden by default and only shown when `taskType === "io.camunda:http-json:1"`; tabs for hidden groups also disappear; if the active tab becomes hidden (e.g. clearing the task type), the first visible tab is auto-activated
- `GroupSchema.condition?: (values) => boolean` — new optional field to conditionally show/hide groups and their tabs

### Config panel plugins

Two new canvas plugin packages for schema-driven element property editing:

- **`@bpmn-sdk/canvas-plugin-config-panel`** — core infrastructure
  - `createConfigPanelPlugin({ getDefinitions, applyChange })` factory
  - `ConfigPanelPlugin` extends `CanvasPlugin` with `registerSchema(type, schema, adapter)`
  - Schema-driven rendering: `FieldSchema` (text, select, textarea, toggle), `GroupSchema`, `PanelSchema`
  - `PanelAdapter` interface: `read(defs, id) → values`, `write(defs, id, values) → BpmnDefinitions`
  - Compact panel: `position: fixed; right: 12px; top: 12px; width: 280px` dark glass panel shown when 1 element is selected
  - Full overlay: 65%-width right panel with dimmed backdrop, tab navigation between groups, full form
  - Auto-save on field `change` event; `_refreshInputs()` updates values in-place without re-render (preserves focus)
  - Subscribes to `editor:select` and `diagram:change` via `api.on` type cast

- **`@bpmn-sdk/canvas-plugin-config-panel-bpmn`** — BPMN element schemas
  - Registers general schema (name + documentation) for: startEvent, endEvent, userTask, scriptTask, sendTask, receiveTask, businessRuleTask, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway
  - Full REST connector form for serviceTask: General (name, taskType, retries, documentation), Request (method, url, headers, queryParameters, body, timeouts), Authentication (authType, authToken), Output (resultVariable, resultExpression, retryBackoff)
  - Zeebe extension parsing and serialization via `parseZeebeExtensions` / `zeebeExtensionsToXmlElements`
  - Immutable `updateFlowElement(defs, id, fn)` helper for model updates

- **`BpmnEditor`** — added `getDefinitions()` and `applyChange(fn)` public methods
- **`@bpmn-sdk/core`** — now exports `zeebeExtensionsToXmlElements`
- Both plugins integrated in `apps/landing` with full keyboard/event wiring

### Zen mode: view-only restriction

- Added `BpmnEditor.setReadOnly(enabled: boolean)` public method
- When enabled: clears the current selection and all in-progress overlays, forces the state machine into pan mode
- When disabled: restores select mode via `setTool("select")` (emits `editor:tool` event so HUD updates)
- Four guard points prevent any editing action while read-only:
  - `setTool` — returns early so tool cannot be changed from outside
  - `_executeCommand` — no-ops all diagram mutations (move, resize, delete, connect, paste, etc.)
  - `_startLabelEdit` — prevents the label editor from opening
  - `_onKeyDown` — blocks Ctrl+Z/Y/C/V/A and all state-machine keyboard shortcuts
- Pan and zoom (wheel + pointer drag) continue to work through the viewport controller and pan-mode state machine
- Wired in `apps/landing/src/editor.ts`: `onZenModeChange` now calls `editorRef?.setReadOnly(active)` alongside hiding the HUD elements

### Editor improvements (round 3)

#### Smart placement for contextual toolbar "add connected element"
- `addConnectedElement` now uses `_smartPlaceBounds` to pick the best free direction instead of always placing to the right
- Priority order: **right → bottom → top**
- Skips directions that already have an outgoing connection from the source (e.g., gateways that already have a branch going right use bottom/top instead)
- Skips positions that would overlap any existing element (10 px margin)
- If all three default positions are blocked, increases the vertical gap in 60 px steps (up to 6×) for bottom/top until a clear spot is found
- Fallback: very large rightward gap if all attempts fail
- New private method `_overlapsAny(bounds)` — simple AABB overlap check with margin
- Fixed: `inclusiveGateway` and `eventBasedGateway` now correctly get 50×50 dimensions (was previously only exclusive/parallel)

#### Distance arrows with spacing magnet snap
- During element move, equal-spacing positions between elements now snap (magnet) and show orange distance arrows
- New `_computeSpacingSnap(dx, dy)` method: detects all pairs of static shapes with a horizontal or vertical gap; if the moving element is within the snap threshold of the same gap distance, snaps to that equal-spacing position
- Horizontal snap: checks if moving element can be placed to the right of B or left of A with the same gap as A↔B
- Vertical snap: checks if moving element can be placed below B or above A with the same gap as A↔B
- `_previewTranslate` now combines alignment snap and spacing snap per axis, preferring the one requiring the smaller adjustment; spacing wins when it fires and alignment does not (or spacing is closer)
- Distance guides rendered as orange lines with perpendicular tick marks at each end (`bpmn-dist-guide` CSS class, `#f97316`)
- `OverlayRenderer.setDistanceGuides(guides)` — new method rendering H/V guide segments with tick caps into a dedicated `_distG` group
- Distance guides are cleared on cancel and commit (alongside alignment guides)

### Editor improvements (round 2)

#### Ghost preview: edge-drop highlight during create
- When the ghost element's center hovers over an existing sequence flow, the edge changes to the split-highlight color (indicating the element will be inserted into that edge on click)
- New `_findCreateEdgeDrop(bounds)` method — same proximity check as the drag-move edge drop
- New `_setCreateEdgeDropHighlight(edgeId)` method — uses existing `.bpmn-edge-split-highlight` CSS class
- `_doCreate` uses `insertShapeOnEdge` when a target edge is highlighted, same as drag-move commit

#### Ghost preview + move: magnet alignment guides
- Create mode: ghost element snaps to alignment guides from existing shapes before placement
  - New `_computeCreateSnap(bounds)` — finds closest alignment in x/y within 8/scale px threshold
  - New `_computeCreateGuides(bounds)` — generates alignment guide lines at matched coordinates
  - `_ghostSnapCenter` stores the snapped center; `_doCreate` uses it as the actual placement point
- Regular move: alignment guides now also compare against the dragging element's **original position** (virtual ghost)
  - `_computeSnap` and `_computeAlignGuides` add original bounds of moving shapes to the static reference set
  - A guide appears when the element aligns with where it started, letting users precisely return to the original spot

#### New connections: L-style routing (one bend instead of two)
- `computeWaypoints` in `geometry.ts` rewritten to pick ports based on relative direction instead of always exiting right/entering left
- `absDx >= absDy`: exits right/left, enters top/bottom (L-shape) unless same height (straight)
- `absDy > absDx`: exits bottom/top, enters left/right (L-shape) unless same X (straight vertical)
- Gateways below/above the source automatically use the bottom/top port instead of the right port
- Affects new connections, contextual toolbar "add connected element", edge-split insertion, and connection preview

### Editor improvements

#### Ghost/preview on element creation
- When a create tool is active (e.g. `create:serviceTask`), moving the mouse now shows a translucent shape preview following the cursor
- Implemented by calling `overlay.setGhostCreate(mode.elementType, diag)` in `_onPointerMove` whenever the state machine is in create mode
- Ghost is cleared on commit (`_doCreate`) and on cancel/tool-switch (`setTool`)
- Escape key already cancelled create mode; ghost now also disappears on Escape

#### Orthogonal connection preview
- The connection ghost line during arrow drawing is now orthogonal (H/V/L/Z segments) instead of a diagonal straight line
- `overlay.setGhostConnection()` signature changed from `(src: BpmnBounds, end: DiagPoint)` to `(waypoints: BpmnWaypoint[] | null)` — rendered as a `<polyline>` matching committed edge style
- `previewConnect` callback in `editor.ts` computes waypoints via `computeWaypoints(src, cursor)` before passing to overlay

#### Fix: arrow source port preserved when target is moved
- **Bug**: manually re-routing an arrow's source endpoint would snap back when the target element was moved
- **Cause**: `moveShapes` in `modeling.ts` called `computeWaypoints` (always exits right, enters left) when one endpoint moved, discarding user-set ports
- **Fix**: derive ports from pre-move waypoints using `portFromWaypoint`, then call `computeWaypointsWithPorts` to preserve the user's chosen exit/entry direction while recomputing the route geometry

#### Default theme changed to light
- `apps/landing/src/editor.ts`: `theme: "dark"` → `theme: "light"`

### Refactor: move editor HUD logic to `@bpmn-sdk/editor`
- Extracted all HUD code (~600 lines) from `apps/landing/src/editor.ts` into `packages/editor`
- New `packages/editor/src/icons.ts` — `IC` SVG icon object (internal, not re-exported from index)
- New `packages/editor/src/hud.ts` — `initEditorHud(editor: BpmnEditor): void` — all group buttons, context/configure toolbars, zoom widget, action bar, dropdown management, keyboard shortcuts
- `@bpmn-sdk/editor` now exports `initEditorHud` from `index.ts`
- `apps/landing/src/editor.ts` reduced to ~75 lines: imports, SAMPLE_XML, plugin setup, `new BpmnEditor(...)`, `initEditorHud(editor)`

### Refactor: move BPMN domain metadata to `@bpmn-sdk/editor`
- Extracted element group taxonomy, display names, external-label types, valid label positions, and contextual-add types into `packages/editor/src/element-groups.ts`
- New exports: `ELEMENT_GROUPS`, `ELEMENT_TYPE_LABELS`, `EXTERNAL_LABEL_TYPES`, `CONTEXTUAL_ADD_TYPES`, `getElementGroup()`, `getValidLabelPositions()`, `ElementGroup` type
- `apps/landing/src/editor.ts` now imports these from `@bpmn-sdk/editor`; no BPMN semantics defined in landing
- `@bpmn-sdk/canvas-plugin-command-palette-editor` derives its 12 commands from `ELEMENT_GROUPS` + `ELEMENT_TYPE_LABELS`; all 4 tests pass

### Command palette plugins — `@bpmn-sdk/canvas-plugin-command-palette` + `@bpmn-sdk/canvas-plugin-command-palette-editor`
- **`@bpmn-sdk/canvas-plugin-command-palette`** — base Ctrl+K / ⌘K command palette for both canvas and editor
  - Built-in commands: toggle theme (dark → light → auto cycle), zoom to 100%, zoom to fit, export as BPMN XML, zen mode
  - **Zen mode**: adds `bpmn-zen-mode` class to container (hides `.bpmn-zoom-controls` / `.bpmn-main-menu-panel` via CSS), hides dot grid rects in SVG, calls `onZenModeChange` callback for external HUD hiding
  - `CommandPalettePlugin.addCommands(cmds): () => void` — extension point; returns deregister function
  - Module-level singleton ensures only one palette open at a time across all instances
  - Theme-aware: resolves "auto" via `window.matchMedia`; light theme applies `bpmn-palette--light` class
  - 14 tests in `canvas-plugins/command-palette/tests/index.test.ts`
- **`@bpmn-sdk/canvas-plugin-command-palette-editor`** — extends base palette with 12 BPMN element creation commands
  - Commands: Add Start Event, Add End Event, Add Service/User/Script/Send/Receive/Business Rule Task, Add Exclusive/Parallel/Inclusive/Event-based Gateway
  - Activates via `setTool("create:X")` using lazy `editorRef` pattern (avoids circular dependency at construction time)
  - Deregisters all commands on `uninstall()`; 4 tests in `canvas-plugins/command-palette-editor/tests/index.test.ts`
- **Landing page**: palette wired with `onZenModeChange` hiding `.hud` elements; editor plugin uses lazy `editorRef`

### `@bpmn-sdk/editor` — Space tool
- **Space tool** (`"space"`) added to `Tool` type; `setTool("space")` activates it
- **Behavior**: click and hold anywhere on the canvas, then drag to push elements apart:
  - Drag right → all elements whose center is to the right of the click x-position move right by the drag distance
  - Drag left → all elements to the left of the click x-position move left
  - Drag down → all elements below the click y-position move down
  - Drag up → all elements above the click y-position move up
  - Axis locks after 4 diagram-space pixels of movement (dominant axis wins)
  - Edges are recomputed on commit via `moveShapes` (existing behavior)
- **Visual feedback**: amber dashed split-line (`.bpmn-space-line`) drawn at the drag origin during drag
- **Implementation**: new `SpaceSub` state (`idle` / `dragging`), `{ mode: "space" }` EditorMode variant, `previewSpace`/`commitSpace`/`cancelSpace` callbacks, `setSpacePreview` on `OverlayRenderer`
- **Landing editor**: space button added to bottom toolbar between Select/Hand buttons and the element groups

### Editor toolbar — standard BPMN groups, icons, long-press picker
- **Undo/redo icons** fixed: replaced confusing arc-based icons with clean U-shaped curved-arrow icons (polyline arrowhead + D-shaped arc body), matching standard design-tool conventions
- **Bottom toolbar redesigned**: replaced individual element buttons with one button per BPMN group (Events, Activities, Gateways); clicking uses the last-selected element type; holding 500ms opens a horizontal group picker showing all element types in that group
- **Group picker**: floating panel appears above the button; selecting an element type sets it as the group default and activates the create tool
- **Extended `CreateShapeType`**: added `sendTask`, `receiveTask`, `businessRuleTask`, `inclusiveGateway`, `eventBasedGateway`; all wired in `makeFlowElement`, `changeElementType`, `defaultBounds`, and `RESIZABLE_TYPES`
- **Standard BPMN icons**: all toolbar icons follow BPMN 2.0 notation — events as circles (thin=start, thick=end), activities as rounded rectangles with type markers (gear/person/lines/filled-envelope/outlined-envelope/grid), gateways as diamonds with type markers (X/+/O/double-circle)
- **Configure bar (above element)** now shows all element types in the same BPMN group, using the same full group switcher; previously only showed 2–3 hardcoded options
- **`EXTERNAL_LABEL_TYPES`** extended to include `inclusiveGateway` and `eventBasedGateway`

## 2026-02-23 (6)

### `@bpmn-sdk/editor` — Configure bar, edge split, label fix, scriptTask
- **Fix: label moves with shape** — `moveShapes` now also translates `BpmnDiShape.label.bounds` by `(dx, dy)` when present; previously external labels on events/gateways stayed behind when the shape was moved
- **Edge split on drop** — dragging a shape over an existing sequence flow highlights the edge in green; dropping inserts the shape between source and target (original edge removed, two new connections created); edges connected to the dragged shape are excluded; `insertShapeOnEdge(defs, edgeId, shapeId)` new modeling function
- **Configure bar above element** — a new HUD panel appears above the selected element with type-switching buttons and label-position picker; replaces label position from the below bar
  - Tasks: service task / user task / script task type switcher (active button shows current type)
  - Gateways: exclusive gateway / parallel gateway type switcher + label position
  - Events: label position only
- **`changeElementType(id, newType)`** — new `BpmnEditor` public method; preserves element id, name, incoming, and outgoing; uses new `changeElementType(defs, id, newType)` modeling function
- **`scriptTask` added** to `CreateShapeType`; added to `RESIZABLE_TYPES`; `makeFlowElement` handles it; ghost create shape renders as rectangle (correct for tasks)
- **5 new tests** in `tests/modeling.test.ts`: label-bounds translation, changeElementType (gateway, task, scriptTask), insertShapeOnEdge split

## 2026-02-23 (5)

### `@bpmn-sdk/editor` — Label positions and edge endpoint repositioning
- **External labels for events/gateways**: canvas renderer always renders external labels for startEvent, endEvent, intermediateEvents, boundaryEvent, exclusiveGateway, parallelGateway, inclusiveGateway, eventBasedGateway when the element has a name; default position is bottom-centered (80×20px, 6px gap)
- **`setLabelPosition(shapeId, position)`**: new `BpmnEditor` public method; accepts 8 positions: `"bottom" | "top" | "left" | "right" | "bottom-left" | "bottom-right" | "top-left" | "top-right"`; persists label bounds in BPMN DI
- **Label position dropdown**: contextual toolbar now shows a compass icon for events and gateways; clicking opens a dropdown with 4 options (events) or 8 options (gateways)
- **End event in contextual toolbar**: end events now show a contextual toolbar with the label position option (previously hidden entirely)
- **`LabelPosition` type exported** from `@bpmn-sdk/editor`
- **Edge selection**: clicking on a sequence flow line selects it and shows draggable endpoint balls at start and end; edge and shape selection are mutually exclusive
- **Edge endpoint repositioning**: dragging an endpoint ball snaps it to the nearest port (top/right/bottom/left) of the source or target shape; route is recomputed orthogonally via `computeWaypointsWithPorts`
- **Transparent edge hit areas**: invisible 12px-wide stroke polylines added to each edge group for easier clicking
- **Delete edge**: pressing Delete/Backspace while an edge is selected removes it
- **`deleteElements` handles flow IDs**: `deleteElements` now also removes sequence flows when their own ID is in the `ids` array (not just when their source/target is deleted)
- **Port-aware waypoint routing** (`computeWaypointsWithPorts`): H+H (Z or U), V+V (Z or U), H+V / V+H (L-route) — all combinations handled orthogonally

## 2026-02-23 (4)

### `@bpmn-sdk/editor` — UX improvements
- **Orthogonal edges**: `computeWaypoints` now produces H/V-only paths (Z-shape with 4 waypoints or straight horizontal); `boundaryPoint` diagonal routing removed
- **Edge recompute on move**: `moveShapes` recomputes orthogonal waypoints from updated shape bounds when only one endpoint moves
- **Hover port balls removed**: `OverlayRenderer.setHovered` no longer renders connection port circles — connections are initiated exclusively via the contextual toolbar
- **Arrow button in contextual toolbar**: clicking the arrow icon enters connection-drawing mode; user then clicks any target shape to complete the connection
- **`startConnectionFrom(sourceId)`**: new `BpmnEditor` public method to programmatically enter connecting mode from a specific source shape
- **Click-to-connect state machine**: `EditorStateMachine.onPointerDown` now handles the `connecting` sub-state — a click commits or cancels the in-progress connection (supports ctx-toolbar flow alongside existing drag-from-port flow)
- **Magnet snap helpers**: during shape translate, cursor snaps to aligned edges/centers of non-selected shapes within 8 screen pixels; blue dashed alignment guides rendered in overlay while dragging
- **Landing page 100% zoom**: editor now opens at `fit: "center"` (1:1 scale) instead of `fit: "contain"`

## 2026-02-23 (3)

### `@bpmn-sdk/editor` package — BPMN diagram editor
- New package `packages/editor` (`@bpmn-sdk/editor`) — a full BPMN 2.0 diagram editor built on top of `@bpmn-sdk/canvas` internals
- **Create shapes**: start/end events, service/user tasks, exclusive/parallel gateways via `setTool("create:serviceTask")` etc.
- **Connect shapes**: drag from shape port to draw sequence flows with auto-computed waypoints
- **Move shapes**: drag to reposition; multi-select moves all selected shapes together
- **Resize shapes**: 8-handle resize with minimum size enforcement (20×20)
- **Delete elements**: removes shapes and all connected sequence flows; cleans up incoming/outgoing references
- **Undo/redo**: snapshot-based `CommandStack` (up to 100 snapshots); `undo()`, `redo()`, `canUndo()`, `canRedo()`
- **Selection**: click to select, shift-click to add/remove, rubber-band drag to box-select, `setSelection(ids)` API
- **Label editing**: double-click shape → `contenteditable` div positioned over SVG; commits on blur/Enter, cancels on Escape
- **Copy/paste**: `Ctrl+C` / `Ctrl+V` with offset; all IDs regenerated on paste
- **Export**: `exportXml()` returns BPMN XML via `Bpmn.export()`; load via `load(xml)` or `loadDefinitions(defs)`
- **Events**: `diagram:change`, `editor:select`, `editor:tool` (all extend `CanvasEvents`); `on()` returns unsubscribe fn
- **Plugin compatibility**: identical `CanvasApi` for plugins; minimap plugin works unchanged
- **Keyboard shortcuts**: Delete/Backspace (delete), Ctrl+Z/Y (undo/redo), Ctrl+A (select all), Ctrl+C/V (copy/paste), Escape (cancel/deselect)
- **Architecture**: 15 source files — `id.ts`, `types.ts`, `rules.ts`, `geometry.ts`, `modeling.ts`, `command-stack.ts`, `css.ts`, `overlay.ts`, `label-editor.ts`, `state-machine.ts`, `editor.ts`, `index.ts`
- **45 tests** across 3 test files: `modeling.test.ts` (15), `command-stack.test.ts` (13), `editor.test.ts` (17)
- Modified `packages/canvas/src/viewport.ts`: added `lock(locked: boolean)` method (prevents panning during drags/resizes)
- Modified `packages/canvas/src/index.ts`: exported internals (`ViewportController`, `render`, `KeyboardHandler`, `injectStyles`, etc.)
- Modified root `tsconfig.json`: added `packages/editor` reference
- Verification: `pnpm turbo build typecheck check test` — 6/6 tasks pass, 45 tests pass, zero errors

## 2026-02-23 (2)

### `canvas-plugins/` workspace — minimap extracted as a plugin
- New pnpm workspace glob `canvas-plugins/*` added to `pnpm-workspace.yaml`
- New package `canvas-plugins/minimap` → `@bpmn-sdk/canvas-plugin-minimap`
  - `Minimap` class moved from `packages/canvas/src/minimap.ts` — import `ViewportState` from `@bpmn-sdk/canvas`, `BpmnDefinitions` from `@bpmn-sdk/core`
  - Added `Minimap.clear()` method (clears shapes, edges, resets viewport rect)
  - Minimap CSS extracted to `canvas-plugins/minimap/src/css.ts` with its own `injectMinimapStyles()` / `MINIMAP_STYLE_ID`
  - `createMinimapPlugin()` factory returns a `CanvasPlugin` that: installs minimap into `api.container`, subscribes to `diagram:load` / `viewport:change` / `diagram:clear`, navigates by calling `api.setViewport()`, and tears everything down on `uninstall()`
  - 9 tests in `canvas-plugins/minimap/tests/minimap-plugin.test.ts`
- Removed from `packages/canvas`: `minimap.ts`, `CanvasOptions.minimap`, minimap CSS, `_minimap` field, `_showMinimap` field, `_syncMinimap()` method, minimap construction and update calls, `--bpmn-viewport-fill`/`--bpmn-viewport-stroke` CSS vars
- Landing page updated: imports `createMinimapPlugin` from `@bpmn-sdk/canvas-plugin-minimap`, passes it via `plugins: [createMinimapPlugin()]`; removed `minimap: true` option
- Verification: `pnpm turbo build typecheck check test` — 15/15 tasks pass, zero errors

## 2026-02-23

### `@bpmn-sdk/canvas` package — BPMN diagram viewer
- New package `packages/canvas` (`@bpmn-sdk/canvas`) — a zero-dependency, framework-agnostic SVG BPMN viewer
- **SVG rendering**: shapes (events, tasks, gateways, annotations), edges with arrowheads, text labels — all layered (edges → shapes → labels)
- **Viewport**: pan (pointer drag), zoom (wheel + pinch), click-vs-drag discrimination (4px threshold), RAF-batched transforms for 60fps
- **Infinite dot-grid** via SVG `<pattern>` with `patternTransform` synced to viewport
- **Minimap**: 160×100px overview in bottom-right corner; simplified rects/circles + polylines; click-to-pan
- **Themes**: light (default), dark (`data-theme="dark"` attribute), auto (follows `prefers-color-scheme`)
- **Fit modes**: `"contain"` (scale to fit), `"center"` (1:1 zoom, centred), `"none"` (no auto-fit)
- **Accessibility**: `role="application"`, focusable shape elements (`tabindex="-1"`), Tab/Shift+Tab navigation, Enter/Space to click, arrow keys to pan, +/- to zoom, 0 to fit
- **Plugin system**: `CanvasPlugin` interface with `install(api: CanvasApi)` / `uninstall()` lifecycle; `CanvasApi` exposes shapes, edges, viewport, events
- **Events**: `diagram:load`, `diagram:clear`, `element:click`, `element:focus`, `element:blur`, `viewport:change`; `on()` returns unsubscribe function
- **CSS injection**: `injectStyles()` idempotently injects styles once; all CSS via custom properties for easy theming
- **ResizeObserver**: auto re-fits on container resize
- **Zoom controls**: +/−/⊡ buttons injected into DOM
- **14 tests** in `packages/canvas/tests/canvas.test.ts` (happy-dom environment)
- **Landing page updated**: replaced `bpmn-js` with `@bpmn-sdk/canvas`; removed bpmn.io CSS; diagrams render in dark theme with grid + minimap
- **Bundle size**: 112KB JS / 25.95KB gzip (vs bpmn-js which is ~500KB+)
- **GitHub Actions fix**: `.github/workflows/deploy-pages.yml` — changed `actions/upload-pages-artifact@v3` to `actions/upload-artifact@v4` (required by `actions/deploy-pages@v4`)
- Verification: `pnpm turbo build typecheck check test` — 11/11 tasks pass, zero errors

## 2026-02-21

### XML Output Tabs on Landing Page
- Each example panel now has Diagram / XML Output sub-tabs.
- Users can switch between the live rendered BPMN diagram and the raw XML source.
- XML content is populated from the examples data and HTML-escaped for display.

### Landing Page
- **Landing page app**: Created `apps/landing/` — a Vite-built static site showcasing the SDK.
- Hero section with strong AI-native hook, feature cards (zero deps, auto-layout, type-safe, roundtrip fidelity, Camunda 8 ready).
- Side-by-side comparison: raw BPMN XML vs fluent SDK API.
- Interactive examples with tabbed code snippets and live BPMN diagram rendering via bpmn-js (bpmn.io).
- Four examples: Simple Process, Decision Gateway, Parallel Execution, AI Agent (with adHocSubProcess).
- Getting Started section with 3-step quick start.
- Added `apps/*` to pnpm workspace, `vite` as root devDependency.
- GitHub Actions workflow (`.github/workflows/deploy-pages.yml`) for automatic deployment to GitHub Pages.
- Verification: `pnpm verify` — all tasks pass (SDK 308 tests + landing build/typecheck/check).

### Remove fast-xml-parser dependency (zero runtime dependencies)
- **Custom XML parser/serializer**: Replaced the `fast-xml-parser` dependency with a lightweight custom implementation (~200 lines) in `packages/bpmn-sdk/src/xml/xml-parser.ts`. The SDK now has **zero runtime dependencies**.
- The custom parser handles namespaced elements/attributes, self-closing tags, text content, CDATA sections, and skips processing instructions/comments — everything needed for BPMN and DMN XML.
- The serializer produces formatted XML with 2-space indentation, self-closing empty elements, and `&quot;` escaping in attributes.
- Entity/character references are passed through unchanged (matching the previous `processEntities: false` behavior).
- Public API (`parseXml`, `serializeXml`, `XmlElement` type) unchanged.
- Verification: `pnpm verify` — 308 tests pass, zero errors

## 2026-02-20

### Auto-Join Gateways (BPMN Best Practice)
- **Automatic join gateway insertion**: When multiple branches from the same split gateway converge on a non-gateway target, a matching join gateway is automatically inserted before the target. For example, an exclusive gateway split automatically gets a matching exclusive join gateway.
- The algorithm traces back from targets with 2+ incoming flows to identify which split gateway they belong to, then inserts a join of the same type.
- Existing manually-created join gateways are detected and not duplicated.
- Early-return branches (with distinct targets) are not affected.
- `ServiceTaskOptions.name` is now mandatory — all service tasks must have a name.
- Vertical center-Y alignment fix: expanded sub-processes are re-centered on their original baseline after expansion.
- Verification: `pnpm verify` — 308 tests pass, zero errors

### Expanded Sub-Processes & modelerTemplateIcon Support
- **Expanded sub-process layout**: Sub-processes with child elements are now expanded on the canvas — children are recursively laid out inside the container using the full Sugiyama layout pipeline. The `layoutSubProcesses()` function (previously unused) is now integrated into the layout engine after phase 4g. Expanded sub-processes have `isExpanded="true"` in the BPMN diagram.
- **Post-expansion cascade**: After subprocess expansion, a cascade pass ensures all subsequent layers maintain minimum 50px horizontal gap, preventing element/label overlaps.
- **`modelerTemplateIcon` on all builders**: Fixed `SubProcessContentBuilder.serviceTask()` to set `zeebe:modelerTemplate`, `zeebe:modelerTemplateVersion`, and `zeebe:modelerTemplateIcon` attributes (was missing — `ProcessBuilder` and `BranchBuilder` already had this support).
- **Updated agent workflow example**: Added `modelerTemplateIcon` to all template-bearing elements (webhook start event, AI agent ad-hoc subprocess, Slack service tasks, HTTP JSON tool tasks). Tool service tasks inside the ad-hoc subprocess now render with proper icons and are visible on the expanded canvas.
- Verification: `pnpm verify` — 305 tests pass, zero errors

### New Element Support from examples2/
- **`bpmn:message` root element**: Added `BpmnMessage` model type, `messages` array on `BpmnDefinitions`, parser/serializer support for `<bpmn:message>` at definitions level. Messages are now preserved during parse→export roundtrip.
- **`zeebe:properties` extension**: Added `ZeebeProperties`/`ZeebePropertyEntry` interfaces to `ZeebeExtensions`. Builder support via `zeebeProperties` option on `StartEventOptions`. Used for webhook/connector configuration.
- **Enhanced message start events**: `startEvent()` with `messageName` now creates a proper root-level `<bpmn:message>` element and references it by ID. Also supports `zeebeProperties`, `modelerTemplate`, `modelerTemplateVersion`, `modelerTemplateIcon` options.
- **Enhanced `adHocSubProcess` for AI agent pattern**: Added `taskDefinition`, `ioMapping`, `taskHeaders`, `outputCollection`, `outputElement`, and modeler template options to `AdHocSubProcessOptions`. Supports the agentic AI subprocess pattern (e.g., Camunda AI Agent with tool tasks).
- **Roundtrip tests for examples2/**: 3 example files (Fetch Features, Fetch Notes, PDP Product Board Filtering) all roundtrip correctly. Added 11 new roundtrip tests and 7 element parsing tests.
- Verification: `pnpm verify` — 305 tests pass, zero errors

### Minimum Row Gap Between Elements & Gateway Label Position
- **Minimum row gap**: `distributeSplitBranches()` now uses two-pass processing (multi-branch first, single-branch second) with peer-aware gap enforcement. Single-branch gateways check all chain nodes against layer peers and push further away if any gap would be less than `GRID_CELL_HEIGHT/2` (80px).
- **Gateway labels**: Labels moved from centered-above to **top-right** position (`x = bounds.right + 4, y = bounds.top - labelHeight - 4`), preventing overlap with upward edge paths.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Symmetric Branch Distribution for Split Gateways
- **Symmetric branches**: Added `distributeSplitBranches()` — branches of split gateways with 2+ non-baseline branches are now equally distributed above and below the gateway center Y, spaced by `GRID_CELL_HEIGHT` (160px)
- **Single-branch gateways**: Gateways with exactly 1 non-baseline branch (e.g., early-return splits) now place the branch a full `GRID_CELL_HEIGHT` away from the gateway center, ensuring clear separation from inner gateway branches
- **Layer overlap resolution**: Added `resolveLayerOverlaps()` — after redistribution, overlapping nodes within the same layer are pushed apart with minimum gap, and coordinates are normalized to ensure no negative Y values
- Example result: `parallelStart` (cy=251) branches at processPayment (cy=171) and checkInventory (cy=331); early return at notifyRejection/endRejected (cy=91) — one full grid row above
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Collapsed Sub-Processes & Baseline Continuation Through Early-Return Splits
- **Collapsed sub-processes**: Sub-processes now render at 100×80 (same as regular tasks) instead of being expanded to show child elements. Removed the sub-process expansion phase from the layout engine.
- **Baseline continuation**: `findContinuationSuccessor()` now correctly follows gateway successors as baseline continuation points. When a split gateway has one early-return branch (dead-end) and one branch leading to another gateway, the gateway branch is chosen as the baseline continuation. Non-gateway branches are never promoted to the baseline.
- **Overlap fix**: Fixed 3 test failures caused by branch nodes being incorrectly placed on the baseline (overlapping siblings). The fix ensures that only gateway successors are followed as continuation, preventing branch content from being aligned to the baseline Y.
- Verification: `pnpm verify` — 288 tests pass, zero errors

### Baseline Path Alignment & Gateway Edge Fix
- **Baseline path detection**: Added `findBaselinePath()` that identifies the process "spine" — the sequence of nodes every path must traverse (start event → gateways → end event), skipping branch content
- **Baseline Y-alignment**: Added `alignBaselinePath()` that forces all spine nodes to share the same center-Y, ensuring start and end events are horizontally aligned
- **Gateway incoming edge fix**: Updated `resolveTargetPort()` to distinguish split (starting) vs join (closing) gateways:
  - Split gateways: incoming edges always connect from the left
  - Join gateways: incoming edges connect based on relative position (above→top, below→bottom, same Y→left)
- Added 5 new tests: baseline path detection (2), baseline Y-alignment (2), split gateway left-side port (1)
- Verification: `pnpm verify` — 287 tests pass, zero errors

### XML Attribute Value Escaping Fix
- Fixed `serializeXml()` to escape `"` as `&quot;` in XML attribute values
- Root cause: `fast-xml-parser` `XMLBuilder` with `processEntities: false` writes attribute values verbatim, producing invalid XML when values contain double quotes (e.g., FEEL expressions like `=erpBaseUrl + "/api/orders"`)
- Added regression test for attribute escaping and roundtrip
- Regenerated `order-process.bpmn` with proper escaping
- Verification: `pnpm verify` — 282 tests pass, zero errors

### Grid-Based Layout & Edge Routing Improvements
- **Virtual grid system**: Replaced cumulative-offset coordinate assignment with a 200×160 virtual grid
  - All elements placed in grid cells, centered horizontally and vertically within cells
  - Grid cells merge automatically for oversized elements (e.g., expanded sub-processes)
  - Grid constants: `GRID_CELL_WIDTH=200`, `GRID_CELL_HEIGHT=160`
- **Gateway size**: Changed gateway dimensions from 50×50 to 36×36 (matching BPMN standard)
- **L-shaped edge routing**: Forward edges now prefer L-shaped paths (1 bend) over Z-shaped paths (2 bends)
  - `routeForwardEdge()` produces horizontal→vertical L-shape instead of horizontal→vertical→horizontal Z-shape
  - `routeFromPortDirect()` also uses L-shaped routing from top/bottom ports
- **Early-return branch positioning**: Added `ensureEarlyReturnOffBaseline()` — shorter branches at gateway splits are swapped off the baseline so they're never on the split gateway's center-y
- **Edge connection rules** (unchanged, verified):
  - Non-gateway elements: outgoing from right center, incoming to left center
  - Starting gateways: incoming on left, vertically centered
  - Closing gateways: incoming from top/bottom/left based on relative position
- Added 5 new tests: grid cell centering, grid layer spacing, grid row spacing, L-shaped edge preference, early-return off-baseline
- Verification: `pnpm verify` — build, typecheck, check, test (281 pass) — all zero errors

### Edge Routing & Vertical Spacing Improvements
- Changed `VERTICAL_SPACING` from 80px to 160px for better visual separation between branches
- Added `resolveTargetPort()` to determine edge entry side: non-gateway targets always enter from the left; gateway targets enter top/bottom/left based on source relative Y position (with +/-1px tolerance)
- Integrated `resolveTargetPort` into `routeForwardEdge()` and `routeFromPortDirect()` for correct target-side routing
- Added 2 new `resolveTargetPort` test cases (non-gateway always left, gateway Y-based with tolerance)
- Added 2 integration tests in `builder-layout-integration.test.ts` for non-gateway left-entry and branch vertical spacing
- Verification: `pnpm turbo build`, `pnpm turbo test` (276 pass), `pnpm biome check .`, `pnpm turbo typecheck` — all zero errors

## 2026-02-19

### Layout Engine QA Fixes — Branch Alignment, Split/Join, Labels, Routing
- **Branch baseline alignment**: Added `alignBranchBaselines()` to `coordinates.ts` — nodes in linear sequences (non-gateway, single-pred/single-succ chains) now share the same center-y coordinate
- **Split/join Y-alignment**: Added `alignSplitJoinPairs()` to `coordinates.ts` — merge gateways are forced to the same y-coordinate as their corresponding split gateway
- **Edge label collision avoidance**: Replaced simple midpoint label placement with collision-aware system in `routing.ts`:
  - Generates 5 candidate positions along the longest edge segment (at 25%/33%/50%/67%/75%) with above/below offsets
  - Greedy placement: processes labels in order, picks first non-overlapping candidate
  - Fallback: slides label along segment in 10 steps to find clear space
- **Edge routing efficiency**: `routeFromPort()` now compares assigned-port route against right-port route by bend count, preferring the assigned port unless right-only gives strictly fewer bends; back-edges now evaluate routing above vs. below all nodes and pick the shorter path
- **VERTICAL_SPACING test fix**: Updated test to check against imported `VERTICAL_SPACING` constant instead of hardcoded `60`
- Integrated `alignBranchBaselines` and `alignSplitJoinPairs` as phases 4b/4c in `layout-engine.ts`
- Added 8 new tests: linear baseline alignment, branch divergence, fork/join parallel alignment, fork/join exclusive alignment, label-node non-overlap, label-label non-overlap, forward edge bend limit, gateway bend efficiency
- All 272 tests pass, zero lint errors, zero build warnings

### Gateway Port Assignment for Auto-Layout
- Added gateway port assignment logic to `routing.ts` — gateway outgoing edges now follow BPMN port conventions
  - Odd outgoing edges: middle edge exits right, upper half exits top, lower half exits bottom
  - Even outgoing edges: upper half exits top, lower half exits bottom (no right port)
  - Single outgoing edge: exits right (straight horizontal)
- Added `routeFromPort()` Z-shaped routing from top/bottom ports, keeping vertical segments in the safe mid-zone between layers
- Exported `assignGatewayPorts` and `PortSide` type for direct unit testing
- 8 new tests covering port assignment (1/2/3/4/5 edges, empty, waypoint positions, non-gateway passthrough)
- All 277 tests pass, zero lint errors, zero build warnings

### Auto-Layout Documentation
- Added auto-layout section to README with full usage example showing `.withAutoLayout()` on a gateway workflow
- Added `withAutoLayout()` to builder methods table in API reference under new "Layout" category
- Expanded `doc/features.md` auto-layout entry with configuration details (opt-in behavior, element sizing, round-trip fidelity)

### Builder Layout Integration Tests
- Added `builder-layout-integration.test.ts` with 15 integration tests verifying auto-layout data generation for builder-created workflows
- Tests cover: shape/edge completeness, valid bounds, no overlaps, left-to-right ordering, DI ID conventions, orthogonal edge routing, element-type sizing, subprocess child containment, complex multi-pattern workflows, export→parse roundtrip, double roundtrip, and XML element verification
- Added round-trip position stability test to `bpmn-builder.test.ts`
- Updated `examples/create-workflow.ts` to use `.withAutoLayout()`
- Regenerated `order-process.bpmn` example output with layout data

## 2026-02-18

### Builder errorCode→errorRef Fix
- Fixed `buildEventDefinitions` to auto-generate a root `BpmnError` element when `errorCode` is provided without `errorRef`, ensuring boundary events built with only `errorCode` serialize with a valid `errorRef`

### Review Fixes
- Fixed `buildEventDefinitions` to pass `timeDate` and `timeCycle` into timer event definitions
- Fixed `buildEventDefinitions` to store `messageName`/`signalName`/`escalationCode` as `messageRef`/`signalRef`/`escalationRef`
- Added `timeDate`, `timeCycle` (and attribute maps) to `BpmnTimerEventDefinition` model type
- Added `timeDate`/`timeCycle` parsing and serialization for XML roundtrip support
- Added duplicate ID check when merging branch elements into the main process
- Removed `.swarm` session artifacts from version control and added to `.gitignore`

### Comprehensive README Rewrite
- Rewrote root `README.md` with best-practices structure matching top-tier SDKs
- Added "Why this SDK?" section with value propositions
- Added feature matrix table (BPMN/DMN/Forms × Parse/Build/Export)
- Added advanced examples: REST connector, parallel branches, boundary events, sub-processes, roundtrip workflow, type narrowing
- Added "Best Practices" section: descriptive IDs, discriminated unions, branch patterns, roundtrip modifications, composable processes
- Enhanced API reference with return types and categorized builder methods table
- Added semantic versioning guidance to contributing section

### Enhanced README and Changesets
- Enhanced root `README.md` with badges (npm, TypeScript, license), table of contents, requirements section, yarn install option, expanded contributing guide with code quality expectations and release workflow
- Added TypeScript usage section with discriminated union type narrowing examples
- Added REST connector convenience builder example
- Fixed README code examples to use correct `taskType` property name (was `type`)
- Added MIT `LICENSE` file
- Changesets (`@changesets/cli`, `@changesets/changelog-github`) configured for version management and publishing
- Committed `.changeset/` directory with `config.json` and `README.md`
- Fixed changeset config to use `@changesets/changelog-github` with repo setting for PR/author links
- Added `changeset`, `version-packages`, and `release` scripts to root `package.json`
- Removed accidentally committed `.swarm/` session artifacts from version control
- Added `.swarm` to `.gitignore`
- Added auto-layout feature to README feature list
- Added GitHub Actions CI workflow (build, typecheck, lint, test on push/PR)
- Added GitHub Actions Release workflow using `changesets/action` for automated version PRs and npm publishing

### Timer Event Definition Attribute Roundtrip Fix
- Added `timeDateAttributes` and `timeCycleAttributes` to `BpmnTimerEventDefinition` model
- Parser now extracts attributes (e.g. `xsi:type`) from `timeDate` and `timeCycle` elements, matching existing `timeDuration` handling
- Serializer now emits those attributes on roundtrip, preventing loss of `xsi:type`

## 2026-02-19

### Auto-Layout for ProcessBuilder
- Added `withAutoLayout()` fluent method to `ProcessBuilder` — when enabled, `build()` runs the Sugiyama layout engine and populates `BpmnDiagram` with DI shapes (bounds) and edges (waypoints)
- Layout-to-DI conversion maps `LayoutResult` nodes/edges to `BpmnDiShape`/`BpmnDiEdge` with proper element references
- Without `withAutoLayout()`, behavior is unchanged (`diagrams: []`)
- 4 new tests: default empty diagrams, linear flow DI, gateway branch DI, export→parse roundtrip with DI

### BPMN Fluent Builder API — Full Implementation
- Rewrote `bpmn-builder.ts` with complete fluent builder API (~1400 lines)
- **Gateway branching**: `branch(name, callback)` with `BranchBuilder` sub-builders
  - `condition(expression)` sets FEEL condition on branch sequence flow
  - `defaultFlow()` marks branch as gateway default path
  - Both conditions and defaults work with direct `connectTo()` (no intermediate elements)
- **Flow control**: `connectTo(id)` for merging branches and creating loops (backward references)
- **Navigation**: `element(id)` repositions builder at existing element for additional outgoing flows
- **Multiple start events**: `addStartEvent()` creates disconnected start events for parallel paths
- **Boundary events**: `boundaryEvent(id, options)` attached to activities with error/timer/message/signal support
- **Event definitions**: Timer (duration/date/cycle), message, signal, escalation on start/intermediate/boundary events
- **Ad-hoc sub-process**: `activeElementsCollection` and `loopCharacteristics` with full zeebe extension support
- **Modeler template**: `modelerTemplate`, `modelerTemplateVersion`, `modelerTemplateIcon` on service tasks
- **Version tag**: `versionTag(tag)` on process
- **`build()` returns `BpmnDefinitions`** (not just `BpmnProcess`) with full namespace declarations
- **Aspirational elements**: inclusive gateway, event-based gateway, sub-process, event sub-process, send/receive tasks
- Added `BpmnMessageEventDefinition` and `BpmnSignalEventDefinition` to model types
- Updated `src/index.ts` exports for all new option types
- 52 builder tests covering all features including 9-branch fan-out pattern
- Fixed existing tests (rest-connector, roundtrip) for new `build()` return type
- All 226 tests pass, zero lint errors, zero build warnings

### BPMN Builder Unit Tests (52 tests)
- Extended BPMN model with aspirational types: `sendTask`, `receiveTask`, `eventSubProcess`, `BpmnSubProcess`, `BpmnInclusiveGateway`, `BpmnEventBasedGateway`
- Rewrote `ProcessBuilder` with full gateway support: exclusive, parallel, inclusive, event-based
- Added `branch(name, callback)` pattern with `BranchBuilder` for gateway fan-out
- Added `connectTo(targetId)` for merge points and loop patterns
- Added sub-process builders: `adHocSubProcess()`, `subProcess()`, `eventSubProcess()` with `SubProcessContentBuilder`
- Added multi-instance configuration (parallel/sequential) with Zeebe extension elements
- Added aspirational element builders: `sendTask()`, `receiveTask()`, `businessRuleTask()`
- Added `recomputeIncomingOutgoing()` to fix up incoming/outgoing arrays at build time
- 52 comprehensive tests covering: linear flow, all validated element types, all aspirational types, exclusive gateway (2-branch and 9-branch fan-out), parallel gateway (2 and 3 branches), inclusive gateway, event-based gateway, loops via connectTo, ad-hoc sub-processes with multi-instance, sub-processes, event sub-processes, boundary events, error handling, complex nested patterns

### BPMN Parser/Serializer Lint Cleanup
- Fixed 14 `noNonNullAssertion` lint errors in `bpmn-roundtrip.test.ts`
- Added bounds-checked `at()` helper to replace `arr[i]!` patterns
- Replaced `find()!` with proper `undefined` checks and early returns
- All 226 tests pass, zero lint errors, zero build warnings

### REST Connector Convenience Builder
- Implemented `restConnector(id, config)` as syntactic sugar on `ProcessBuilder`
- Generates `io.camunda:http-json:1` service tasks with proper Zeebe extensions
- Supports GET/POST/PATCH/PUT/DELETE methods, bearer/noAuth authentication
- IO mapping inputs: method, url, authentication, body, headers, queryParameters, timeouts
- Task headers: resultVariable, resultExpression, retryBackoff (only when configured)
- Headers and queryParameters accept both FEEL strings and Record<string, string> (auto-serialized)
- 16 tests covering all patterns including real-world GitHub API example
- Fixed tests to work with updated `build()` return type (`BpmnDefinitions`)

## 2026-02-18

### QA Fixes
- Fixed duplicate `message`/`signal` switch cases in `bpmn-serializer.ts` (caused build failure)
- Fixed sub-process child node positioning in layout engine — children now correctly track parent shifts after `reassignXCoordinates`
- Auto-formatted `bpmn-serializer.ts` with Biome

### Roundtrip Tests for All Example Files
- Fixed build errors in BPMN builder and layout modules (model type alignment)
- Verified Vitest roundtrip tests for all 34 example files (30 BPMN, 1 DMN, 3 Form)
- BPMN roundtrip: parse → serialize → re-parse → deep model comparison (BpmnDefinitions)
- DMN roundtrip: parse → export → re-parse → field-level comparison (DmnDefinitions)
- Form roundtrip: parse → export → re-parse → deep equality (FormDefinition)
- XML-level roundtrip: parse → serialize → re-parse → structural comparison (XmlElement tree)
- All 169 roundtrip-related tests pass

### BPMN Support
- Added BPMN model types (`BpmnDefinitions`, `BpmnProcess`, `BpmnFlowElement` discriminated union, DI types)
- Added BPMN XML parser (`Bpmn.parse()`) with support for all element types in examples
- Added BPMN XML serializer (`Bpmn.export()`) with namespace-aware reconstruction
- Added `Bpmn.createProcess()` fluent builder with service tasks, script tasks, user tasks, call activities, REST connector sugar
- Added Form model types, parser (`Form.parse()`), serializer (`Form.export()`), and builder
- Added auto-layout engine (Sugiyama/layered algorithm with sub-process support)

### DMN Support
- Added DMN model types (`DmnDefinitions`, `DmnDecision`, `DmnDecisionTable`, `DmnInput`, `DmnOutput`, `DmnRule`)
- Added generic XML parser/serializer using `fast-xml-parser` with namespace-aware roundtrip support
- Added DMN XML parser (`Dmn.parse()`)
- Added DMN XML serializer (`Dmn.export()`)
- Added `Dmn.createDecisionTable()` fluent builder with:
  - Input columns (label, expression, typeRef)
  - Output columns (label, name, typeRef) — multi-output support
  - Rules with input/output entries and descriptions
  - All 7 hit policies (UNIQUE, FIRST, ANY, COLLECT, RULE ORDER, OUTPUT ORDER, PRIORITY)
  - Auto-generated diagram shapes
  - XML export via `.toXml()`
- Added shared `XmlElement` type for opaque extension element preservation
- Added roundtrip test against `Github>Slack users.dmn` (2-output table, 21 rules)
- Set up monorepo infrastructure (pnpm, Turborepo, Biome, Vitest, TypeScript strict)
