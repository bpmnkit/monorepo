# Render Library Gap Analysis — @bpmnkit/canvas vs. bpmn.io (bpmn-js / diagram-js)

**Date:** 2026-07-05
**Benchmark versions:** bpmn-js **18.19.0**, diagram-js **15.18.1** (verified against source + changelogs)
**Scope:** `packages/canvas` (viewer) and the rendering-relevant parts of `packages/editor`, `packages/core`, `packages/plugins`, compared against the bpmn.io stack. This is an analysis and implementation spec only — nothing here is implemented yet. Each backlog item is written so it can be picked up and implemented independently.

---

## 1. Executive summary

`@bpmnkit/canvas` is a ~2.4k LOC zero-dependency SVG BPMN **viewer**; `@bpmnkit/editor` (~10k LOC) reuses its low-level render functions and adds a full modeling UI. Together they already cover a surprising amount of bpmn-js's surface: all core flow-node rendering, pools/lanes, boundary events, external labels, orthogonal routing with obstacle avoidance, full editing (create/move/resize/connect/bendpoints/space tool/lasso), inline label editing, snapping guides, undo/redo, copy/paste, DI color, auto-layout, and DI writing.

The gaps fall into three bands:

1. **Rendering correctness (P0)** — real-world diagrams render *incompletely or wrongly* today: collapsed-subprocess planes are silently invisible (only `diagrams[0]` is rendered), data objects/stores/groups don't exist in the model or renderer, task-level loop/multi-instance/compensation markers are missing, only the first event definition is drawn, and message flows / conditional flows lack their spec-required decorations.
2. **Architectural foundations (P1)** — the canvas has no element registry, no incremental update path (every change re-renders the whole scene), no generic overlay or marker API, no hover/dblclick/contextmenu events, approximate text wrapping, and no connection docking. These block most roadmap items (badges, variable-flow, timeline scrubber, live mode) and cap editor performance.
3. **Editor parity & polish (P2/P3)** — deep copy/paste, a real rules engine, align/distribute, search, i18n, and testing depth.

Where bpmnkit is **ahead** of bpmn.io and should defend its position: zero runtime dependencies, plain MIT license (bpmn-js requires a permanent "powered by bpmn.io" watermark), first-class theming/dark mode, built-in auto-layout, SSR static SVG export in core, port deconfliction + obstacle-avoiding routing (bpmn-js has neither by default), keyboard accessibility of diagram *content* (bpmn-js only covers editor chrome), Zeebe connector template icons, and touch support (bpmn.io **removed** touch entirely in 2024).

---

## 2. Architecture comparison

| Dimension | bpmn.io (diagram-js + bpmn-js) | bpmnkit (canvas + editor) |
|---|---|---|
| Composition | didi dependency injection; every service replaceable via module override | Direct classes; `CanvasPlugin { install(api) }` with a narrow `CanvasApi` |
| Model | moddle/bpmn-moddle metamodel (full BPMN 2.0 + BPMNDI schema, extensible via `moddleExtensions`); dual model (diagram-js element ↔ businessObject + di) | Hand-written typed AST in `@bpmnkit/core` (`bpmn-model.ts`), zero-dep XML parser, DI modeled as `BpmnDiShape`/`BpmnDiEdge`; single model, renderer walks DI plane directly |
| Scene graph | `ElementRegistry` (id → element + gfx), `GraphicsFactory` with incremental `update()`, per-element `<g>` structure (`djs-visual` + invisible `djs-hit` + `djs-outline`), named z-indexed layers, multi-root planes | Four static layers (containers → edges → shapes → labels), `RenderedShape[]`/`RenderedEdge[]` arrays rebuilt on every `load()`; full-scene teardown via `innerHTML = ""` on every change |
| Events | Priority-ordered `EventBus`; dozens of interaction + lifecycle events; render hooks (`render.shape`) | Typed emitter with 6 events (`element:click/focus/blur`, `viewport:change`, `diagram:load/clear`); editor adds 4 more |
| Extension of rendering | `BaseRenderer` subclass at priority; per-element override | None — `render()` is a closed function; only CSS class hooks |
| Command stack | Command objects + `CommandInterceptor` (pre/post hooks power 42 BPMN behaviors); dirty-element re-render | Array of full deep-copied `BpmnDefinitions` snapshots (max 100); full re-render per step (`packages/editor/src/command-stack.ts`) |
| Rules | Priority-chained `RuleProvider` (`BpmnRules`: connection legality, containment, attach, resize) | `packages/editor/src/rules.ts` — 15 lines |
| Hit testing | Browser-native SVG events on fat invisible hit geometry (stroke-width 15), per-element | `document.elementFromPoint` + `closest("[data-bpmnkit-id]")`; wide transparent stroke on edges only |
| Text | `TextRenderer`: real measurement (offscreen canvas `measureText` since 15.12), word-wrap + hyphenation into `<tspan>`s | `wrapText()` with fixed 6.5px average char width estimate (`packages/canvas/src/renderer.ts:28-54`) |
| Planes | Multi-root canvas; drilldown module with breadcrumbs for collapsed subprocesses | Only `defs.diagrams[0].plane` rendered (`renderer.ts:867`) |
| Licensing | MIT-style **with mandatory watermark** | Plain MIT — a genuine adoption advantage |

**Structural finding (internal):** `@bpmnkit/editor` does not wrap `BpmnCanvas` — it re-imports `render`, `ViewportController`, `KeyboardHandler`, `createDefs`, `createGrid`, `injectStyles` and rebuilds its own host (`packages/editor/src/editor.ts:1-9`). Viewer and editor therefore duplicate scene lifecycle code and any new canvas capability (overlays, markers, incremental render) must be threaded into both. P1-1 addresses this.

---

## 3. Feature matrix

Legend: ✅ full · 🟡 partial · ❌ missing. "bk" = bpmnkit.

### 3.1 Viewer / rendering

| Feature | bpmn-js | bk | Notes (bk refs) |
|---|---|---|---|
| Tasks (8 types) + icons | ✅ | ✅ | `renderer.ts:152-185`; bonus: `zeebe:modelerTemplateIcon` as `<image>` |
| Sub-process / transaction / ad-hoc / event sub-process | ✅ | ✅ | markers `renderer.ts:243-259` |
| Call activity | ✅ | 🟡 | styled border only; **no collapsed `+` marker** |
| Loop / multi-instance / compensation markers **on tasks** | ✅ | ❌ | only sub-processes get MI markers (`renderer.ts:494-499`) |
| Gateways (5) | ✅ | ✅ | `renderer.ts:222-239` |
| Events × definitions | ✅ (13+, incl. Multiple/ParallelMultiple, first N markers) | 🟡 | 10 types (`renderer.ts:189-218`); only `eventDefinitions[0]` drawn (`renderer.ts:402-411`); no multiple/parallelMultiple |
| Boundary events (incl. non-interrupting dashed) | ✅ | ✅ | `renderer.ts:389-398` |
| Pools & lanes (horizontal) | ✅ | ✅ | `renderer.ts:557-635` |
| Vertical pools/lanes | ✅ (16.0) | ❌ | `isHorizontal` parsed but unused |
| Data object / store / input / output + data associations | ✅ | ❌ | absent from model **and** renderer |
| Group artifact | ✅ | ❌ | absent from model and renderer |
| Text annotations | ✅ | ✅ | `renderer.ts:637-672` |
| Sequence flow: default slash | ✅ | ✅ | `renderer.ts:733-758` |
| Sequence flow: conditional (diamond) marker | ✅ | ❌ | |
| Message flow endpoint decorations (source circle, envelope, initiating/non-initiating) | ✅ | ❌ | plain dashed line + arrow (`renderer.ts:877-889`) |
| Association directionality (arrowheads per `associationDirection`) | ✅ | ❌ | `renderAssociation` `renderer.ts:770-778` |
| Connection cropping/docking to shape outline | ✅ (`path-intersection`) | ❌ | edges meet bounding-box port midpoints (`editor/src/geometry.ts:256-268`) |
| Rounded connection corners | ✅ | ✅ | `waypointsToRoundedPath` `renderer.ts:94-144` |
| External labels (events/gateways/edges) | ✅ | ✅ | `renderer.ts:962-995` |
| Real text measurement / wrapping | ✅ | ❌ | fixed 6.5px estimate |
| Collapsed subprocess drilldown (planes, breadcrumbs) | ✅ (9.0+) | ❌ | only `diagrams[0]` rendered |
| DI colors (bioc + BPMN-in-Color) | ✅ read/write | 🟡 | read: bioc + omg color (`core/src/.../di-color.ts`); write on edit ✅; **BPMN-in-Color label color not applied to labels** |
| Import warnings for missing/duplicate DI | ✅ | ❌ | DI-less elements silently invisible; `checkDiCompleteness` exists in core but unwired |
| Choreography / conversation | ❌ (needs 3rd-party chor-js) | ❌ | parity — explicit non-goal |
| Zoom/pan/pinch, zoom-to-cursor | ✅ | ✅ | `viewport.ts`; pinch works (bpmn.io removed touch!) |
| Fit viewport / zoom API | ✅ (`zoom('fit-viewport')`, `scrollToElement`, `getAbsoluteBBox`) | 🟡 | `fitView()` only; no scroll/zoom-to-element; **ResizeObserver force-refits, destroying user viewport** (`canvas.ts:200-205`) |
| Marker API (add/remove CSS class by id) | ✅ | 🟡 | only fixed `highlight(ids, "changed"|"new")` (`canvas.ts:353-366`) |
| HTML overlays anchored to elements (minZoom/maxZoom/scale) | ✅ | ❌ | roadmap items (badges, variable-flow, timeline) blocked on this |
| Interaction events: hover/out/dblclick/contextmenu | ✅ | ❌ | click only |
| Incremental re-render of changed elements | ✅ | ❌ | full teardown per change |
| Export SVG/PNG from viewer | ✅ (`saveSVG`) | 🟡 | core has separate static `exportSvg` (server-side); no export of the *live* canvas |
| Minimap | ✅ (diagram-js-minimap) | ✅ | `packages/plugins/src/minimap` |
| Token simulation / execution highlight | ✅ (bpmn-js-token-simulation) | ✅ | `packages/plugins/src/token-highlight` + process-runner |
| Themes / dark mode | ❌ (DIY CSS) | ✅ | light/dark/auto/neon — bk advantage |
| Keyboard nav over diagram content + ARIA roles | ❌ | ✅ | `keyboard.ts`, `role`/`aria-label` per shape — bk advantage |
| Watermark-free MIT | ❌ | ✅ | bk advantage |

### 3.2 Editor

| Feature | bpmn-js | bk | Notes |
|---|---|---|---|
| Select / multi-select / lasso | ✅ | ✅ | `state-machine.ts` |
| Move with boundary/children cascade | ✅ | ✅ | `modeling.ts:619-795` |
| Resize | ✅ | ✅ | 8 handles |
| Connect / reconnect endpoints | ✅ | ✅ | |
| Bendpoints insert/move/cleanup | ✅ | ✅ | `modeling.ts:1206-1301` |
| Connection **segment move** | ✅ | 🟡 | `moveEdgeSegment` exists (`modeling.ts:1173-1200`) but state machine never routes to it |
| Palette / context pad | ✅ | ✅ | `hud.ts` |
| Replace/morph menu | ✅ (rich popup) | 🟡 | `changeElementType` (`modeling.ts:1309-1500`) + HUD wrench; narrower coverage than ReplaceMenuProvider (no loop/MI toggles, collapsed↔expanded) |
| Snapping: guides + equal spacing | ✅ | ✅ | bk also snaps spacing — good |
| Grid snapping (snap-to-grid) | ✅ | ❌ | dot grid is visual only |
| Space tool | ✅ | ✅ | |
| Auto-place appended elements | ✅ | ✅ | `editor.ts:1266-1345` |
| Undo/redo | ✅ command-based, interceptors, dirty-only re-render | 🟡 | full-snapshot array, full re-render |
| Copy/paste | ✅ deep (subprocess children), cut, duplicate | 🟡 | top-level only, src+tgt both selected; no cut |
| Rules engine | ✅ BpmnRules | 🟡 | 15-line stub |
| BPMN behaviors (semantic side-effects) | ✅ 42 modules | 🟡 | partial equivalents inline in `modeling.ts` |
| Direct label editing | ✅ | ✅ | contenteditable overlay |
| Label positions / resizable external labels | ✅ (18.16) | 🟡 | 8 fixed positions; no label resize |
| Align / distribute commands | ✅ | ❌ | guides exist, explicit commands don't |
| Search pad | ✅ (heavily improved 15.x) | 🟡 | studio command palette exists; nothing in editor core |
| Attach/detach boundary events by drag | ✅ | ✅ | `snapToBoundary` |
| Vertical pools | ✅ | ❌ | |
| Collapse/expand subprocess | ✅ (plane lifecycle) | ❌ | depends on P0-1 |
| i18n | ✅ translate service | ❌ | strings hardcoded |
| Touch editing | ❌ (removed 2024) | 🟡 | viewer pan/pinch yes; editing gestures untested |
| Spatial index | ❌ (fat-stroke native hit testing) | ❌ | both O(n); parity |
| Properties panel | ✅ (separate pkg) | ✅ | config-panel plugin + dock |

---

## 4. Where bpmnkit should NOT copy bpmn.io

- **No didi/DI container.** The plugin API + a richer event surface achieves extensibility at a fraction of the complexity. Keep classes direct.
- **No moddle.** The typed AST in core is a feature (strict TS, zero deps). Extend the AST instead.
- **No viewport culling / WebGL.** bpmn-js doesn't cull either; revisit only with evidence (>2–3k elements).
- **Choreography/conversation diagrams.** bpmn-js doesn't render them either; explicit non-goal.
- **Snapshot undo can stay** (see P2-6) — fix its costs, don't rebuild bpmn-js's command architecture.

---

## 5. Prioritized backlog

Effort: **S** ≤ 1 day · **M** ≤ 3 days · **L** ≤ 2 weeks. Items are ordered within each band. Every item lists acceptance criteria (AC) — implement tests for each AC (Vitest, happy-dom, following `packages/canvas/tests/canvas.test.ts` style).

### P0 — Rendering correctness (real diagrams render wrong today)

#### P0-1 · Multi-plane rendering + collapsed-subprocess drilldown — **L** — ✅ DONE (viewer) (2026-07-05)
Core adds `planeForElement()`/`listPlaneElementIds()` (`packages/core/src/bpmn/di-planes.ts`). The renderer's `render()`/`computeDiagramBounds()` now take an explicit `targetPlane` (+ `drillableIds`), and `BpmnCanvas` tracks a current plane and breadcrumb stack: `getPlanes()`, `showPlane(planeElementId)`, and a `plane:change` event. Collapsed sub-processes that own a plane render a clickable drill-down `+` button (`data-bpmnkit-drilldown`); a breadcrumb bar navigates back. Multi-`BPMNDiagram` files list all planes and each renders. Single-plane files are unchanged (`load()`/`render()` back-compatible via optional params). Tests in `collapsed sub-process drilldown` (6). **Deferred:** in-sub-process *editing* in `@bpmnkit/editor` (spec item #4) — the editor still renders the primary plane only; plane-switching the editor's state machine + DI writes is a separate change.

**Problem:** `render()` reads only `defs.diagrams[0].plane` (`packages/canvas/src/renderer.ts:867`). BPMN files from Camunda Modeler/bpmn-js put collapsed-subprocess content on **separate `BPMNDiagram` planes** — that content is silently invisible. Multi-diagram files lose everything after the first diagram.
**Spec:**
1. Core already parses all diagrams (`bpmn-parser.ts:668-748`); add a resolver `planeForElement(defs, bpmnElementId)` in core that maps plane → its `bpmnElement` (process / collapsed subprocess id).
2. Canvas: introduce a *current plane* concept. `load()` renders the primary plane; add `canvas.showPlane(planeOrElementId)` and `canvas.getPlanes()`. Rendered state (`_shapes`, `_edges`, keyboard shape list, fit bounds) becomes per-plane.
3. Drilldown UX: when a shape is a collapsed subprocess (`BpmnDiShape.isExpanded === false`) that has its own plane, render a drill-down affordance (corner icon, like bpmn-js) and emit `plane:change` on navigation. Breadcrumb bar in the host (viewer: simple; editor: reuse HUD).
4. Editor: plane switching must re-target the state machine + modeling ops to the active plane's shapes/edges; DI writes go to the correct plane.
5. `computeDiagramBounds` takes a plane argument.
**AC:**
- A bpmn-js-authored file with a collapsed subprocess renders the parent plane, shows the drilldown marker, and `showPlane(subprocessId)` renders the child content.
- Breadcrumb navigates back; `plane:change` fires with old/new plane ids.
- Multi-`BPMNDiagram` file: `getPlanes()` lists all; each renders.
- Existing single-plane files behave exactly as before (no API break: `load()` unchanged).

#### P0-2 · Data objects, data stores, data associations, Groups — **L** — ✅ DONE (shapes) (2026-07-05)
Core models `dataObject`, `dataObjectReference` (`dataObjectRef`, `isCollection`), `dataStoreReference` (`dataStoreRef`) as flow elements and `group` (`categoryValueRef`) as an artifact (`groups` array on every container + collaboration); full parse + serialize round-trip (test `data-elements.test.ts`) + `isBpmnDataObject*` type guards. Renderer draws the data object reference (document with folded corner + collection marker), data store reference (cylinder), and group (dashed rounded rect, border-only hit target, into the containers layer); data references get external labels. Tests in `data elements & groups`. **Deferred:** `dataInputAssociation`/`dataOutputAssociation` full modeling (they currently render via the dashed-association fallback — visible but without the open arrowhead), `categoryValue` label resolution for groups, and editor palette/create entries (consistent with the P0-1 editor deferral).

**Problem:** `dataObject`, `dataObjectReference`, `dataStoreReference`, `dataInput/Output`, `dataInputAssociation`/`dataOutputAssociation`, and `bpmn:group` (+ `categoryValue`) are absent from the core model union (`packages/core/src/bpmn/bpmn-model.ts:354-377`) and from the renderer. These are common in real diagrams; today they render as invisible placeholders (`renderer.ts:947-953`).
**Spec:**
1. **Core model:** add typed nodes for the above, parse + serialize them (round-trip test), including `dataObjectReference.dataObjectRef`, `dataStoreReference`, task-level `dataInputAssociation`/`dataOutputAssociation` (source/targetRef, waypoints DI), `group.categoryValueRef` → `categoryValue.value` (label).
2. **Renderer:** data object = document shape with folded corner (+ collection marker ⦀ when `isCollection`); data store = cylinder; group = dashed rounded rect, label top-left, **non-interactive for hit testing except its border**; data associations = dotted line with open arrowhead.
3. **Layer order:** groups render into the containers layer; data associations into edges layer.
4. **Editor:** add to palette (`element-groups.ts`), create/move/resize (group resizable), rules: data associations connect activity↔data only.
5. **Auto-layout:** treat data objects/stores like annotations (packed adjacent to their association source) — extend `packAnnotations`-style placement; groups get DI pass-through (never auto-moved).
**AC:**
- Round-trip parse→serialize preserves all new elements byte-equivalently (modulo attribute order).
- Camunda-authored fixture with data object + store + associations renders all of them with correct shapes/markers.
- Palette creates each; undo/redo works; DI written on create/move.

#### P0-3 · Activity markers: loop, multi-instance, compensation, call-activity `+` — **M** — ✅ DONE (2026-07-05)
Implemented in `packages/canvas/src/renderer.ts` via a unified `activityMarkers()` helper (multi-instance parallel/sequential, compensation, ad-hoc, and the collapsed `+` for call activities and collapsed sub-processes). Standard loop (`↻`) is deferred — it is not yet in the core model (`multiInstanceLoopCharacteristics` only). Tests in `packages/canvas/tests/canvas.test.ts` (`activity markers`).

**Problem:** Task-level `standardLoopCharacteristics` / `multiInstanceLoopCharacteristics` / `isForCompensation` render nothing (`renderTask` has no bottom-marker block, `renderer.ts:427-513`); collapsed call activities lack the `+` marker. Sub-process MI markers exist (`renderer.ts:243-259`) but loop and compensation are missing there too.
**Spec:** Add a shared `activityMarkers(el, width, height)` helper emitting a centered bottom row of 14×14 markers, in BPMN spec order: loop ↻ | MI ‖ (parallel) / ≡ (sequential) | compensation ⏪ | ad-hoc ~ | sub-process/call-activity `+`. Multiple markers space 4px apart, row centered at `(width/2, height-10)`. Model already carries `loopCharacteristics` (`bpmn-model.ts:154-158`); add `standardLoop?: boolean` and `isForCompensation?: boolean` to the activity types + parser if missing.
**AC:** each marker renders per fixture; combinations (loop + compensation) lay out side-by-side; sub-process keeps existing `+`/`~` behavior; call activity gets `+` box.

#### P0-4 · Event definition completeness — **S/M** — ✅ DONE (2026-07-05)
Events with more than one event definition now render the "multiple" pentagon (filled when throwing) via `multipleEventMarker()` in `packages/canvas/src/renderer.ts`. `parallelMultiple` (the unfilled `+`) is deferred pending a `parallelMultiple` model field — the parser does not yet read that attribute. Test in `event definition markers`.

**Problem:** Only `eventDefinitions[0]` is drawn (`renderer.ts:402-411`); `multiple` (pentagon) and `parallelMultiple` (unfilled `+`) are unhandled in `eventMarker` (`renderer.ts:189-218`).
**Spec:** If `eventDefinitions.length > 1`, render the *multiple* pentagon (filled when throwing) — matching bpmn-js; add pentagon and parallel-`+` markers; verify catch-vs-throw fill for every definition type against bpmn-js's BpmnRenderer table.
**AC:** fixture matrix (event kind × definition) snapshot-tested; multi-definition event shows pentagon.

#### P0-5 · Connection decorations: conditional flow, message flow endpoints, association direction — **M** — ✅ DONE (2026-07-05)
`createDefs()` now builds `open-arrow`, `conditional` (diamond), and `message-start` (circle) markers alongside the filled arrowhead. Conditional sequence flows from non-gateway sources get a source diamond (mutually exclusive with the default-flow slash); message flows get a hollow source circle + open arrowhead; directed associations get open arrowheads per `associationDirection` (`One`/`Both`). Tests in `connection decorations`. Note: non-initiating message-flow styling (needs `messageVisibleKind` DI) is deferred.

**Problem:** Missing spec-required visuals: conditional sequence flow diamond at source (flow has `conditionExpression` and source is an activity); message flow open circle at source + open (unfilled) arrowhead; association arrowheads per `associationDirection` (`None|One|Both`). Message flows currently reuse the solid sequence-flow arrowhead (`renderer.ts:877-889`).
**Spec:** Extend `createDefs` (`renderer.ts:787-798`) with per-instance markers: `open-arrow`, `diamond`, `circle`. Apply: sequence flow `marker-start` diamond when conditional; message flow `marker-start` circle + `marker-end` open-arrow; association `marker-end`/`marker-start` thin open arrows per direction. Data associations (P0-2) reuse open-arrow.
**AC:** fixtures for each decoration; default-flow slash + conditional diamond are mutually exclusive on the same flow (default wins, matching bpmn-js).

#### P0-6 · DI-less elements: import warnings + opt-in auto-layout fallback — **M** — ✅ DONE (viewer) (2026-07-05)
`loadDefinitions()` runs `checkDiCompleteness`, exposes it via `canvas.getImportWarnings()` and a second `diagram:load` payload arg (`ImportWarnings`), and `console.warn`s once when DI is missing. New `layoutMissingDi: "off" | "all"` option (default `"off"`): when `"all"` and any DI is missing, a copy is `applyAutoLayout`-ed for rendering — the caller's model is never mutated (verified by test), and warnings still describe the source gaps. Tests in `DI completeness`. **Deferred:** the editor "Layout missing elements" banner + undoable auto-layout command (spec item #3) — consistent with the P0-1/P1-1 editor deferrals; the editor emits empty warnings for now.

**Problem:** Elements without `BPMNShape`/`BPMNEdge` silently don't render. bpmn-js at least returns import warnings. Core has `checkDiCompleteness` (`di-check.ts:20-53`) and `applyAutoLayout`, but nothing wires them in.
**Spec:**
1. `loadDefinitions()` runs `checkDiCompleteness`; result exposed on a new `diagram:load` payload field and a `canvas.getImportWarnings()` accessor. Console-warn once in dev.
2. New option `layoutMissingDi: "off" | "all"` (default `"off"`): when `"all"` and *any* DI is missing, run `applyAutoLayout` on a copy before rendering (never mutate caller's defs; never persist unless the editor commits it).
3. Editor: banner (like the duplicate-ID banner, `editor.ts:798-845`) offering "Layout missing elements" → runs auto-layout as an undoable command.
**AC:** DI-less fixture: warnings reported, nothing rendered by default; with `layoutMissingDi:"all"` everything renders; editor banner appears and its action is undoable.

### P1 — Architectural foundations (unblock roadmap + performance)

#### P1-1 · Element registry + incremental rendering; single scene layer shared by canvas & editor — **L** — ✅ DONE (registry + incremental) (2026-07-05)
New `Scene` class (`packages/canvas/src/scene.ts`) owns the four SVG layers + an id→graphics registry and renders a plane via the refactored, reusable renderer primitives (`buildRenderContext` + `renderEdgeGroup`/`renderShapeGroup`, extracted from the old monolithic `render()` loop). `Scene.updateElement(id)`/`removeElement(id)` re-render or drop a single element's `<g>` (and its external label) in place, copying CSS classes forward so markers/selection survive. `BpmnCanvas` consumes `Scene`: new O(1) `getElement`/`getGraphics`/`forEachElement`, a public `updateElement(id)` (re-syncs caches, reapplies markers, repositions overlays), and `_findElement` is now registry-backed. `render()` is kept as a thin back-compat wrapper (unused `markerId` param retained positionally) so the editor is untouched. Tests: `element registry` + `incremental update` — the MutationObserver test confirms updating one shape mutates only that element's graphics; 63 canvas tests. **Deferred (spec item #3 + host de-dup):** the editor still uses its own host and full-re-render path; migrating its host to a shared `Scene` and threading modeling dirty-ids into `updateElement` is a large, separate change (the `Scene`/renderer primitives are now exported so it can adopt them incrementally).

**Problem:** Every `load()`/edit tears down all four layers with `innerHTML = ""` and re-renders the world (`canvas.ts:226-257`); the editor re-implements the canvas host instead of composing it, so fixes land twice. No id→gfx lookup exists (consumers do `getShapes().find(...)` — O(n)).
**Spec:**
1. Extract a `Scene` class in `packages/canvas`: owns layers, `Map<string, RenderedShape|RenderedEdge>` registry, and per-element operations — `addElement(shapeOrEdgeDi)`, `updateElement(id)` (re-render one `<g>` in place, preserving markers/classes), `removeElement(id)`, `reorder(...)`. `render()` becomes "add all"; keep the pure per-type render functions as-is.
2. Public API: `canvas.getElement(id)`, `canvas.getGraphics(id)`, `canvas.forEachElement(fn)`. Deprecate nothing — `getShapes()/getEdges()` stay, backed by the registry.
3. Editor consumes `Scene` (delete its duplicated host/layer/defs setup): a modeling commit produces a *dirty-id set* (modeling ops in `modeling.ts` already know what they touched — thread ids through) → `scene.updateElement(id)` per dirty id instead of full re-render. Undo/redo diffs snapshot ids (cheap: compare per-id object identity since `modeling.ts` is immutable/structural-sharing).
4. Preserve external state across updates: CSS classes added via markers (P1-3), overlays (P1-2) re-anchored on `updateElement`.
**AC:**
- Editing one shape in a 500-element diagram touches only that element's `<g>` (assert via MutationObserver in test).
- Marker classes and overlays survive a move/resize of the element.
- Editor no longer imports `createDefs/createGrid/injectStyles` directly; one host implementation remains.
- All existing canvas/editor/plugins tests pass unchanged (API compatible).

#### P1-2 · Generic overlay API — **M** — ✅ DONE (2026-07-05)
New `OverlayManager` (`packages/canvas/src/overlays.ts`) provides `overlays.add/remove/get/clear` with `position` (top/bottom/left/right offsets, right/bottom via translate), `show:{minZoom,maxZoom}`, `scale` (bool or `{min,max}`, default scales 1:1), and `type` tags. Exposed as `canvas.overlays` / `editor.overlays` and on the `CanvasApi` plugin surface. Overlays live in a dedicated HTML layer above the SVG and reposition on `viewport:change` from each element's screen bbox; cleared on load/clear, torn down on destroy. Factored as a shared manager so the canvas and editor don't duplicate it (host adapter provides scale/bbox/subscription). Tests in `overlays` and `OverlayManager (positioning)`.

**Problem:** No element-anchored HTML overlays; roadmap explicitly needs them (pattern-advisor badges `roadmap.md:35-36`, optimize overlay `:52`, variable-flow `:68`, timeline `:77-79`). Token highlight resorts to CSS classes + detached side panels.
**Spec:** Port the bpmn-js overlays semantics into a canvas subsystem (no new package):
```ts
canvas.overlays.add(elementId, {
  position: { top?|bottom?: number, left?|right?: number },  // relative to element bbox
  html: string | HTMLElement,
  show?: { minZoom?: number, maxZoom?: number },
  scale?: boolean | { min?: number, max?: number },          // default true (scales with zoom)
  type?: string,                                             // tag for bulk ops
}): string                                                   // overlay id
canvas.overlays.remove(idOrFilter); canvas.overlays.get({ element?, type? })
```
Implementation: absolutely-positioned HTML layer above the SVG inside the host; container per element, repositioned on `viewport:change` (single rAF pass, transform on the layer — not per-overlay work) and on `updateElement` (P1-1). Remove on element removal / `clear()`.
**AC:** overlay tracks its element under pan/zoom/move; min/maxZoom hides/shows; `scale:false` keeps constant pixel size; destroy removes all DOM.

#### P1-3 · Generic marker API (generalize `highlight`) — **S** — ✅ DONE (2026-07-05)
`addMarker/removeMarker/hasMarker/toggleMarker(id, cls)` added to `BpmnCanvas`, the editor, and the `CanvasApi` plugin surface; `highlight()`/`clearHighlights()` reimplemented on top. Markers are tracked in a per-id set and cleared on load/clear. Full persistence across incremental `updateElement` lands with P1-1 (there is no incremental update path yet — every load re-renders). Tests in `marker API`.

**Problem:** `highlight(ids, "changed"|"new")` (`canvas.ts:353-366`) hardcodes two variants; token-highlight plugin pokes classLists directly.
**Spec:** `canvas.addMarker(id, cls)`, `removeMarker(id, cls)`, `hasMarker(id, cls)`, `toggleMarker(id, cls)` backed by the registry and *persisted across `updateElement`* (a marker set per id, re-applied on re-render). Reimplement `highlight()`/`clearHighlights()` on top (keep them — they're a good AI-diff convenience). Migrate token-highlight plugin to the API.
**AC:** marker survives incremental update; token-highlight tests pass on the new API; old `highlight()` behavior unchanged.

#### P1-4 · Interaction event parity: hover, dblclick, contextmenu, richer payloads — **S/M** — ✅ DONE (2026-07-05)
`element:hover`, `element:out`, `element:dblclick`, `element:contextmenu`, and `canvas:click` added to `CanvasEvents`. Hover uses `pointermove` with a last-hit memo and is suppressed while a button is held (panning). Resolution reuses `elementFromPoint` with an `event.target` fallback. Tests in `interaction events`. The richer `(id, event, element)` click payload is deferred (kept `(id, event)` to stay non-breaking).

**Problem:** Only `element:click` exists. Plugins can't build tooltips, hover effects, or context menus without re-implementing hit testing.
**Spec:** Add `element:hover`, `element:out`, `element:dblclick`, `element:contextmenu`, and `canvas:click` (background) to `CanvasEvents`, using the existing `elementFromPoint`+`closest` resolution; hover via `pointermove` with last-hit-id memo (emit only on change; suppress while panning). Payload: `(id, event, element: RenderedShape|RenderedEdge)` — extend click's payload too (non-breaking: extra arg).
**AC:** hover fires once per enter/leave; dblclick doesn't also fire during editor label-edit (editor already consumes dblclick — verify no double handling); contextmenu preventable by listener.

#### P1-5 · Real text measurement with SSR-safe fallback — **M** — ✅ DONE (2026-07-05)
New `measure.ts`: a lazily-created offscreen-canvas `measureText` measurer at the label font, memoized per string (cleared at 5k entries), with a probe that falls back to the 6.5px-average estimate when canvas metrics are unavailable/unreliable (SSR, happy-dom/jsdom). `wrapText(text, maxPx)` now measures each candidate and breaks a word wider than `maxPx` mid-word with a hyphen (bpmn-js parity). The canvas renderer imports it (removing its local estimate); core's static `exportSvg` is untouched (keeps its own estimate). Tests in `text wrapping`. Note: the wide-glyph-overflow case can only be exercised in a real browser (happy-dom has no metrics), so the hyphenation tests run against the deterministic fallback.

**Problem:** 6.5px-average wrapping (`renderer.ts:28-54`) mis-wraps: wide glyphs overflow shape borders, narrow text wraps too early; labels diverge from what users see in Camunda/bpmn-js. bpmn-js moved to offscreen-canvas `measureText` for accuracy *and* speed (diagram-js 15.12).
**Spec:** `measure.ts` module: lazily-created offscreen `<canvas>` 2D context, `ctx.font` from the resolved `--bpmnkit-font` (query once per canvas instance, invalidate on theme change); `measureWidth(text)` with per-(font,string) memo cap ~5k entries. `wrapText(text, maxPx, measure)` keeps its greedy algorithm but adds mid-word break with hyphen for words wider than maxPx (bpmn-js parity). Fallback: if `document`/canvas 2D unavailable (SSR/tests), use the current estimate — export unchanged behavior for `@bpmnkit/core`'s static `exportSvg`.
**AC:** long-word label breaks with hyphen; wide-glyph string ("WWWW…") doesn't overflow task border at default size; happy-dom tests still pass via fallback; measurement memo bounded.

#### P1-6 · Connection docking: crop edges to true shape outline — **M** — ✅ DONE (2026-07-05)
Pure-math `dockPoint()`/`cropWaypoints()` in `packages/canvas/src/renderer.ts` crop the first/last connection segments onto the source/target outline — circle (events), diamond (gateways), rectangle (everything else) — classified by `geomKind()`. Applied to sequence flows, message flows, and associations at render time; DI waypoints are never mutated (the editor's routing in `geometry.ts` is unchanged). Test in `connection docking`.

**Problem:** Edges terminate on the bounding box, so arrows float ~5px off circles (events) and diamonds (gateways). bpmn-js crops every connection with `path-intersection`.
**Spec:** Pure-math docking (no dependency): `dockPoint(shape, from)` intersecting the segment with the actual outline — circle (events), diamond (gateways), rounded rect (activities); applied at render time to first/last segment of sequence/message flows (do **not** rewrite DI waypoints — display-only cropping, like bpmn-js). Editor routing (`geometry.ts:256-268`) keeps producing bbox-port waypoints; cropping happens in `renderEdge`.
**AC:** arrow tip touches circle/diamond outline in fixtures (assert path end point within ε of analytic intersection); DI round-trip unchanged; degenerate segments (start inside shape) fall back to uncropped.

#### P1-7 · Viewport/navigation API completeness + stop viewport resets — **S/M** — ✅ DONE (2026-07-05)
Added `zoom(scaleOrFit, center)`, `viewbox()`, `scrollToElement(id)`, and `getAbsoluteBBox(id)` to `BpmnCanvas` and the `CanvasApi` (editor already had `fitView`/`setZoom`/`scrollToElement`; the four API methods are wired there too). The ResizeObserver now force-fits only while the user hasn't taken control of the viewport (`_userMovedViewport`, set on wheel, real pans, and explicit zoom/setViewport; reset on load). Tests in `viewport API`. Animated scroll and `padding` were dropped from scope (centering already brings the element into view).

**Problem:** No `zoomToElement`/`scrollToElement`/viewbox accessors; `resetZoom()` centers on `(w/2, h/2)` which is not "center the diagram"; the ResizeObserver **force-refits on every container resize**, silently destroying the user's pan/zoom (`canvas.ts:200-205`); studio/operate need "focus the failing element" (incident views currently can't).
**Spec:** Add `canvas.zoom(scaleOrFit?: number | "fit", center?: {x,y})`, `canvas.viewbox(): {x,y,width,height,scale}` (diagram coords), `canvas.scrollToElement(id, {padding})` (animate optional, 150ms), `canvas.getAbsoluteBBox(id)` (screen coords — needed by overlays consumers). Resize behavior: keep the *center point and scale* stable on resize instead of re-fitting; only auto-fit if the user never interacted (track a `_userMovedViewport` flag).
**AC:** `scrollToElement` brings an off-screen element into view at unchanged zoom; container resize preserves scale; `viewbox()` inverse-matches `setViewport`.

### P2 — Editor parity & robustness

#### P2-1 · Deep copy/paste + cut — **M**
Current paste handles only top-level flow elements whose source+target are both selected (`modeling.ts:1551-1664`). Spec: recursive clone of subprocess children (new ids throughout, internal flows + DI offset), include boundary events attached to copied hosts, include labels/colors; add cut (copy + delete as one undo step); keyboard Ctrl/Cmd+X. AC: copying a subprocess pastes a working deep clone; ids unique (`checkDiCompleteness` + duplicate-ID banner stay silent); one undo restores cut.

#### P2-2 · Rules engine — **M**
`rules.ts` is 15 lines. Spec: a `RuleProvider`-style chain (`canConnect(source, target, type)`, `canContain(parent, child)`, `canAttach`, `canResize`, `canMorph`) with BPMN defaults matching `BpmnRules`: no sequence flows across pools (message flow instead — auto-morph on connect like bpmn-js's ReplaceConnectionBehavior), no incoming flow to start / outgoing from end (currently enforced? verify), boundary events attach only to activities, event-based gateway targets restricted to catch events/receive tasks, lanes contain flow nodes only. State machine + HUD consult rules before enabling connect/append targets (visual feedback: forbidden cursor). AC: each rule has a positive+negative test; connect tool refuses illegal targets visually and in commit.

#### P2-3 · Wire connection segment move — **S** — ✅ DONE (2026-07-05)
`moveEdgeSegment` is now reachable. `_hitTest` computes `nearMidpoint` for an `edge-segment` hit; the state machine routes a segment-body drag (away from the midpoint) to a new `dragging-edge-segment` state driving `moveEdgeSegment` (orthogonal segment move), while a drag near the segment midpoint still inserts a waypoint (`dragging-edge-waypoint-new`). New `previewSegmentMove`/`commitSegmentMove`/`cancelSegmentMove` callbacks; commit runs through `removeCollinearWaypoints` and is a single undoable command. Tests: `segment-move.test.ts` (routing: move-vs-insert) and `modeling.test.ts` (`moveEdgeSegment` op geometry + immutability).

`moveEdgeSegment` (`modeling.ts:1173-1200`) is implemented but unreachable — `state-machine.ts:464-476` routes segment drags to waypoint-insert. Spec: drag on a segment *body* moves the segment orthogonally (bpmn-js behavior); drag on the midpoint ball inserts a waypoint (current behavior preserved via the existing hover affordances in `overlay.ts:406-436`). AC: dragging a horizontal segment moves it vertically keeping orthogonality; undo restores.

#### P2-4 · Align & distribute commands — **S** — ✅ DONE (2026-07-05)
`editor.alignSelected("left"|"center"|"right"|"top"|"middle"|"bottom")` and `editor.distributeSelected("horizontal"|"vertical")` — single undoable commands built on `moveShapes` (align needs ≥2 shapes, distribute ≥3, endpoints fixed with equal gaps). Wired into the HUD's "More actions" menu, which shows the align entries only for a multi-selection (≥2) and the distribute entries at ≥3. Tests: editor `align & distribute` (geometry + single-undo) and `HUD align menu` (menu visibility + click-aligns).

Guides exist; explicit commands don't. Spec: `editor.alignSelected("left"|"center"|"right"|"top"|"middle"|"bottom")`, `editor.distributeSelected("horizontal"|"vertical")` as single undoable commands (reuse `moveShapes`); HUD buttons appear for multi-selection (≥2 align, ≥3 distribute). AC: geometry assertions per axis; single undo step.

#### P2-5 · Diagram search — **S/M**
Spec: `canvas.find(query)` scoring name/id/type (word-prefix > substring, à la diagram-js 15.x search), and an editor Ctrl/Cmd+F pad listing matches, arrow-key navigation, Enter → `scrollToElement` + selection (depends P1-7). AC: query matches across planes (P0-1), keyboard-only operation works.

#### P2-6 · Command stack: labels, merge, memory — **M** — ✅ DONE (2026-07-05)
`CommandStack` entries are now `{ defs, label, key }`. `push(defs, label?, key?)` coalesces consecutive same-`key` pushes into one undo step (bursts like label typing / colour changes), and `undoLabel()`/`redoLabel()` expose the command name. The editor threads descriptive labels through every `_executeCommand` call (Move, Delete, Resize, Connect, Rename, Align, …), with coalesce keys for label edits (`label:<id>`) and colour changes (`color:<id>`); new `editor.getUndoLabel()`/`getRedoLabel()` feed the HUD undo/redo button tooltips. Memory: the stack already stores references, and `modeling.ts` ops structurally share — verified by a test asserting an untouched shape is the same object across snapshots (no deep-copy). Tests: `command-stack` (coalescing + labels), `modeling` (structural sharing), `editor` (undo labels).

Keep snapshots (simple, correct), fix costs: store `{label, defs}` entries; merge bursts (label typing, drag ticks — currently one snapshot per commit) via `commitCoalesced(label, key)` window; snapshots are already structurally shared by immutable `modeling.ts` updates — verify with a heap test and stop *deep-copying* if any path still does (`command-stack.ts:1-54`); expose `editor.getUndoLabel()/getRedoLabel()` for HUD tooltips. With P1-1, undo/redo re-renders dirty ids only. AC: 100 undo entries of a 1-element edit on a 500-element model stay < ~2× single-model heap; label-typing produces one undo step.

#### P2-7 · Vertical pools/lanes — **M** — ✅ DONE (rendering) (2026-07-05)
`renderPool`/`renderLane` refactored into a shared `renderSwimlane` that honours `BpmnDiShape.isHorizontal`: the default (horizontal) keeps the left title bar with rotated text; `isHorizontal === false` draws the title bar across the top with upright text. Test in `vertical pools`. **Deferred:** axis-aware editor resize/space-tool for vertical lanes (editor-side, consistent with prior editor deferrals); core's static `exportSvg` also still assumes horizontal.

`isHorizontal` is parsed (`bpmn-model.ts:528-570`) but ignored. Spec: render title bar on top (not left) when `isHorizontal === false`, lane stacking horizontal; editor resize/space-tool axis-aware; auto-layout may keep emitting horizontal (no change). AC: bpmn-js vertical-pool fixture renders equivalently.

#### P2-8 · Live-canvas SVG/PNG export — **S** — ✅ DONE (2026-07-05)
`canvas.exportSvg({ bounds?: "diagram" | "viewport" })` serializes the current plane to a standalone SVG: it clones the content layers (in diagram coordinates, excluding the pan/zoom transform), a `viewBox` framing the diagram (default) or visible region, the marker/pattern `<defs>`, and a `<style>` block containing `CANVAS_CSS` plus theme tokens resolved from the live host via `getComputedStyle` (so it renders with the right colours off-page; falls back to the CSS `var(...)` defaults where computed styles are unavailable). `canvas.exportPng(scale)` rasterizes it via `Image` + `<canvas>` (browser-only). Tests in `SVG export` (PNG is browser-only, not exercised in happy-dom).

Spec: `canvas.exportSvg({ plane?, bounds?: "diagram"|"viewport" }): string` — serialize the viewport group with inlined computed styles (walk `bpmnkit-*` classes → resolved CSS custom properties; themes make raw class export useless outside the page) + `canvas.exportPng(scale)` via `drawImage` on offscreen canvas (browser only). AC: exported SVG opens standalone with correct theme colors; PNG dimensions = bounds × scale.

### P3 — Polish & differentiators

- **P3-1 i18n (S/M):** injectable `translate(str, vars)` option on canvas/editor; sweep HUD/palette/banner strings through it; default identity. AC: German dictionary fixture localizes palette.
- **P3-2 Touch editing (M):** bpmn.io removed touch in 2024 — a differentiator. Long-press = context pad, drag handles sized ≥ 24px on coarse pointers (`pointer: coarse` media), double-tap = label edit. AC: Playwright touch-emulation smoke test.
- **P3-3 Accessibility deepening (M):** `aria-live` region announcing selection/edit results ("Task 'Review' moved"), focus outline distinct from selection, `aria-expanded` on collapsed subprocess (with P0-1), document a11y statement. Keep the existing lead over bpmn-js.
- **P3-4 Visual-regression + interaction test harness (M/L):** Playwright + pixel snapshots of a fixture gallery (every element type × light/dark; reuse `@resvg/resvg-js` already in devDeps for deterministic rasterization of static SVG), plus pointer-simulation tests for the state machine (drag-move, connect, bendpoint) — today the FSM has zero interaction tests. This should land **early** (ideally alongside P0 work) since P0 items are all visual.
- **P3-5 Spatial index (S/M, only on evidence):** if profiling shows snap/hit lookups hot on 1k+ element diagrams, add a simple uniform grid index behind `Scene` (P1-1) for `_nearestEdgeSegment`, snap candidates, and rubber-band tests. Don't build it speculatively.
- **P3-6 Replace-menu completeness (M):** extend `changeElementType` coverage to loop/MI toggles, collapsed↔expanded call activity/subprocess (with P0-1/P0-3), typed-event morphs; group entries like bpmn-js's ReplaceMenuProvider.

---

## 6. Suggested phasing for implementation

1. **Phase A (correctness + harness):** P3-4 harness first, then P0-3, P0-4, P0-5 (small, independent), P0-6.
2. **Phase B (foundations):** P1-1 (registry/scene) → P1-3 → P1-2 → P1-4 → P1-7; P1-5 and P1-6 parallel-safe.
3. **Phase C (big rocks):** P0-1 (planes/drilldown), P0-2 (data elements) — both easier after P1-1.
4. **Phase D (editor parity):** P2-1 … P2-8 in listed order.
5. **Phase E:** P3 items opportunistically.

Dependency notes: P0-1 and P0-2 touch `@bpmnkit/core` (model/parser) — coordinate with round-trip tests in `packages/core/tests/xml/`; P1-2/P1-3/P2-5/P2-6 assume P1-1's registry; P2-5 assumes P1-7.

Per-item conventions for the implementer: zero new runtime dependencies in `packages/canvas` (its "zero-dependency" claim is part of the package description and marketing); all new public API needs TSDoc + README regeneration via `node scripts/generate-readmes.mjs`; every item updates `doc/progress.md`; devDependencies only in root `package.json`; Vitest + happy-dom for unit tests, Playwright only in P3-4/P3-2.
