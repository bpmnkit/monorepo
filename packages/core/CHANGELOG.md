# @bpmnkit/core

## 0.3.0

### Minor Changes

- 1d2ec66: Writing a model back to a file is now an edit, not a rewrite.

  A visual editor serialises the whole model, so saving a diagram used to reformat the file to
  this toolkit's output and bury one change in a rewrite of everything. The new writers put the
  serialiser's _content_ into the file's own _bytes_: what the model changed changes, and
  nothing else does. Over sixteen real diagrams, renaming one element is **313 changed lines
  with a plain write and 32 with this one**, and opening a file and saving it unchanged is
  **0** — byte for byte.

  **XML — `preserveFormatting(original, updated, options)` and
  `preserveFormattingVerified(original, updated, read)`.** A span-annotated parse of both
  documents, a structural diff, and text edits spliced into the original. Indentation,
  attribute order, namespace prefixes, comments and processing instructions all survive.
  Attribute values are compared _decoded_, so `&#10;` is never rewritten as `&#xA;`; an
  inserted element is re-indented by depth to the siblings it lands among.

  The two strategies that pay off most are ones no generic XML tool may assume: keeping the
  file's own sibling order, and keeping an attribute the serialiser dropped as a schema
  default. Whether either is correct is a fact about a _schema_. So `preserveFormattingVerified`
  **tries and then checks** — it parses its own output with the caller's reader, compares it to
  a plain write, and falls back a rung when they disagree, with the plain write as the floor.
  That check is not ceremony: DMN rule order is the decision under hit policy `FIRST`, and it is
  what stops the sibling-order strategy silently undoing a deliberate reordering of rules.

  **JSON — `preserveJsonFormatting(original, updated)`.** The file's indentation, key order and
  trailing newline are kept, and numbers and strings are compared by _value_, so `1.0` is never
  rewritten as `1` nor `\u00e9` as `é`. It needs no strategies and no injected reader, because
  JSON answers generically what XML cannot: an object is an unordered collection of members and
  an array is an ordered sequence (RFC 8259), so key order is always kept, item order always
  followed, and deep equality under those rules is an exact statement of "this says what the
  update says". The patch checks itself against it.

  **Per format**, each supplying its own parser as the check:
  - `exportPreserving()` / `exportPreservingResult()` / `preserveBpmnFormatting()` for BPMN
  - `exportDmnPreserving()` / `preserveDmnFormatting()` for DMN
  - `exportFormPreserving()` / `preserveFormFormatting()` for `.form` files, which are JSON and
    were the worst case: `exportForm` writes `JSON.stringify(…, null, 2)` in its own key order,
    so a form indented with tabs came back with all 109 of its lines rewritten the first time
    anyone touched it. That, and the four-space and minified cases, are all **0** now, and
    relabelling one field changes **one line** whichever way the file is written.

  **Also exported**, for a caller that wants the layer underneath: `parseXmlSpans` /
  `parseJsonSpans` and their node types, and `escapeAttr` / `escapeText`. The XML parser now
  takes an optional `cursor` sink that reports source offsets, off by default so the hot parse
  path pays nothing for it.

  Every writer falls back to a plain write rather than guessing when the original will not parse
  or is a different document entirely, and reports which it did.

- 1d2ec66: Static analysis reaches the canvas, and stops accusing engine-neutral diagrams.

  `casen lint` has had five categories of rules for a while and none of them were visible while
  modelling. `@bpmnkit/plugins/lint` puts them on the diagram: a marker on every offending
  element (worst severity wins, so a task with an error and three warnings reads as an error), a
  control in the corner counting them, and clicking it steps through them one at a time. It
  re-lints after an edit, debounced, so typing a name does not re-run the analysis per keystroke.

  **`lintDiagram(defs, options)` in `@bpmnkit/core`** is the seam a host needs. Two things it adds
  over calling `optimize` directly, both about handing findings somewhere else:
  - The result is **serialisable**. An `OptimizationFinding` carries an `applyFix` function, so it
    cannot cross a `postMessage` or a JSON boundary; a `LintDiagnostic` says `fixable: true` and
    leaves the fix where it can still be called. It also names the diagram plane each finding is
    on, since a viewer shows one plane at a time.
  - The **rules match the model**. A diagram that names no `modeler:executionPlatform` is no longer
    judged against Camunda 8 deployability. This was measured, not assumed: on an engine-neutral
    model every other category either stays quiet or reports something structural that holds
    regardless, while `deploy` calls a plain service task an **error** for having no
    `zeebe:taskDefinition` — a demand its author never signed up for.

  **`casen lint` changes behaviour** to match: on a model with no execution platform it skips the
  `deploy`, `connector` and `agentic` categories and says why. `--profile deploy` forces them back
  on, since asking for the deploy gate is asking for those rules. Both surfaces ask
  `lintCategories` the same question rather than each keeping their own list.

- 1d2ec66: Visual BPMN diff — a diagram diff, not a model diff.

  `diffDiagram(before, after)` joins `diffSemantics` in `@bpmnkit/core`. The semantic half
  excludes diagram interchange by design, so a task somebody dragged reads there as no change at
  all; `diffDiagram` adds the layout half back as its own `moved` category, computed from DI
  (bounds, waypoints, label placement, and flags such as collapsed/expanded). An element that
  both changed and moved is reported as changed. The result covers only elements carrying DI on
  one side or the other — a changed `targetNamespace` has nothing to draw — and carries a
  per-plane breakdown, since a viewer shows one plane at a time and a change inside a collapsed
  sub-process is otherwise invisible.

  `@bpmnkit/plugins/diff` renders it: `createBpmnDiff()` returns a pair of canvas plugins, one
  per version. Install them on two canvases and every element is marked on the side that can
  show it, a legend counts each category and names how many differences sit on a plane the
  canvas is not currently showing, and panning or zooming either canvas moves the other.

  `casen diff bpmn <before> <after>` reports the same thing in a terminal, naming elements rather
  than printing bare ids, with `--format json`, `--ascii`, and `--exit-code` to gate a pipeline.

### Patch Changes

- 1d2ec66: The DMN preserving write now preserves the file.

  `exportDmnPreserving` shipped with the first cut of the preserving writer and did not deliver
  what it claimed. Measured on two real Camunda decisions — a risk score and a loan eligibility
  table, each with a `dmndi:DMNDI` diagram section — a save that changed nothing came back with
  **six and eighteen lines rewritten**, whichever way the file was indented. Both are **0** now,
  and editing a single rule changes **two** lines instead of between 12 and 90.

  Two defects, neither of which the existing tests could see, because they used a hand-written
  decision with no diagram section and one hit policy:
  - **`preserveFormatting` refused to pair an element carrying an `id` in the file and none in
    the update.** The rule was there to stop a deliberate _move_ being undone, and it was too
    broad: two elements can only have been matched by id in the first place if they both carry
    one, so one side lacking an id means there is no move to preserve — it is simply the
    everyday case where the model does not hold an id the file does. DMN is exactly that case:
    `DMNDiagram` and `DMNShape` are named in the file and not in the model, so a decision's
    entire `DMNDI` block was deleted and written out again on every save. Narrowed to "leave the
    pair alone only when _both_ sides have an id".
  - **`serializeDmn` dropped `hitPolicy="UNIQUE"` as the schema default while `parseDmn` read
    it**, so `parse(export(m))` no longer equalled `m`. A preserving write checks itself against
    exactly that comparison before it uses anything it kept, so one omitted attribute cost the
    file _every_ other thing the write was preserving. `hitPolicy` is now written whenever the
    model has one. This is the only change visible to a caller that does not use the preserving
    writer: `serializeDmn` emits an attribute on `decisionTable` that it previously left out,
    and the value is the one the model already carried.

  BPMN was re-measured with the narrowed pairing rule in place: no regression.

- 1d2ec66: Keyboard navigation, go-to-reference, and a namespace the writer was forgetting.

  **`@bpmnkit/plugins/flow-navigation`** — Tab follows a sequence flow out, Shift+Tab follows it
  back, and at a fan-out Tab picks between the outgoing flows rather than guessing. Enter follows
  the selected flow or drills into a collapsed sub-process; `u` drills back out. The canvas binds
  Tab itself, to document order, so this intercepts in the capture phase and only stops the event
  when it has somewhere to go — a dead end still falls through rather than trapping the user.

  **`@bpmnkit/plugins/model-navigation`** — jump from a Call Activity to its process, a Business
  Rule Task to its decision, a User Task to its form. The plugin reads what an element points at;
  an injected `ReferencePort` decides whether that resolves and what opening it means, so the
  same plugin serves the studio, a drop and an editor extension without knowing what a file is.
  Availability is optimistic and then corrected, and a resolve that lands after the diagram
  changed is discarded rather than applied.

  **`CanvasApi` gains `getPlanes()` and `showPlane()`.** `BpmnCanvas` had both; plugins could not
  reach them, so no plugin could drill into a sub-process.

  **A serializer fix, found while verifying that an engine-neutral model stays engine-neutral.**
  The writer emitted only the namespaces a model was parsed with, so giving a neutral diagram a
  `zeebe:taskDefinition` — which is what applying a connector template does — exported a prefix
  bound to nothing. That document is not namespace-well-formed and a conforming reader may reject
  it. Extension prefixes the document uses are now declared, and one the model already bound
  anywhere — including on a nested element — is left alone. Scoped to extension namespaces on
  purpose: the structural ones the serializer emits itself are a separate gap, recorded on the
  roadmap, because repairing them here would change the model a round trip produces.

  The invariant itself held and is now covered: opening a neutral model and writing it back never
  stamps `modeler:executionPlatform` on it, and a model that does name an engine keeps it verbatim.

## 0.2.0

### Minor Changes

- 00a65f5: Full-fidelity BPMN round-trip and a model layer measured against the moddle descriptors.

  `Bpmn.parse()` → `Bpmn.export()` previously lost data on 11 of 12 real Camunda 8 blueprints,
  including `zeebe:subscription` correlation keys — a silent corruption of message correlation.
  The model now covers what it dropped, and anything it still does not name survives as
  unmodelled content instead of disappearing.
  - **Round-trip fidelity**: `bpmn:category`/`categoryValue`, data input/output associations,
    process-level documentation and other previously dropped constructs are preserved. A
    round-trip corpus test and a descriptor coverage gate (`check:descriptors`) fail on any type
    or property the model starts dropping again.
  - **`Bpmn.continueProcess(definitions, processId)`**: extend a parsed model in place. Other
    processes, the collaboration, lanes, diagram interchange and unmodelled content survive —
    the input is not mutated.
  - **`applyBpmnOperations(definitions, operations, options)`** and **`reconcileCompact()`**:
    apply edits to the full model rather than to the lossy compact projection, and report
    operations that were skipped instead of dropping them in silence.
  - **`@bpmnkit/core/node` subpath**: `writeBpmn()` writes a file and reads it back to verify it,
    throwing `WriteError`/`WriteVerificationError`. The root entry point stays free of `node:`
    builtins, so it keeps working in browsers, workers and edge runtimes.
  - **`semanticHash()`, `projectSemantics()`, `diffSemantics()`, `sha256Hex()`**: compare models
    by meaning, so a moved shape no longer reads as a changed process.
  - **Zeebe placement**: `ensureZeebeExtension()`, `assertZeebePlacement()`,
    `isZeebePlacementAllowed()` and the generated `ZEEBE_PLACEMENT` table refuse extensions on
    elements that cannot carry them, with `ZeebePlacementError`.
  - **`DiagramBuilder` collaborations**: pooled diagrams can now be built, not only parsed —
    participants, message flows and lanes.
  - **`BuildOptions.explicitJoins`**: refuse inferred join gateways and name the ones that would
    have been added. `strict` keeps working and is deprecated in its favour.

## 0.1.2

### Patch Changes

- 9cd1942: Improvements around AI integration
- Updated dependencies [9cd1942]
  - @bpmnkit/feel@0.0.20

## 0.1.1

### Patch Changes

- c8f04ae: Improved rendering

## 0.1.0

### Minor Changes

- b90111f: Replaced the Sugiyama/block-tree auto-layout pipeline with a grid-based layout engine.
  - **New grid layout engine**: `applyAutoLayout`/`Bpmn.autoLayout()` now place flow nodes on a fixed-cell grid (150×140) instead of layered Sugiyama columns, with a Manhattan-style router for orthogonal edges. Output geometry changes for existing diagrams, but the public API (`Bpmn.autoLayout(xml)`, `applyAutoLayout(defs)`) is unchanged.
  - **Message-flow routing** (new capability): `applyAutoLayout` now emits DI for `messageFlow` elements in collaborations, docking on the nearest edge between source/target shapes (flow nodes or pools) with a straight or orthogonal 4-point route.
  - **DI completeness checker** (new capability): `checkDiCompleteness(defs)` is now exported — walks a `BpmnDefinitions` tree and reports any flow node, sequence flow, text annotation, association, participant, or message flow missing a corresponding DI shape/edge.
  - **Text-annotation packing improvements**: annotations are now packed above/below the content bounding box with overlap and crossing avoidance, replacing the previous local-bounds heuristic.
  - **Export removals**: `buildBlockTree`, `applyBlockLayout`, `routeEdgeAstar`, and `assignGridRows` are no longer exported from `@bpmnkit/core` — they were internals of the removed Sugiyama/block-tree pipeline with no external replacement (the grid engine's equivalents are not part of the public API).
  - **Fix**: `exportSvg` rendered pool/lane background rectangles after (on top of) their child shapes, making collaboration diagrams render with blank pool interiors. Pool/lane backgrounds now render first.

### Patch Changes

- b90111f: Improved Layouting

## 0.0.27

### Patch Changes

- 5ea5318: Improved Layouting

## 0.0.26

### Patch Changes

- c93b45d: Minor fixes
- c93b45d: Several improvements and bugfixes.

## 0.0.25

### Patch Changes

- 7916980: Fix illegal BPMN

## 0.0.24

### Patch Changes

- e9ac598: SDK improvements
- dcf850a: Improvements
- d6d1860: Several bugfixes and feature implementations
- Updated dependencies [dcf850a]
- Updated dependencies [d6d1860]
  - @bpmnkit/feel@0.0.19

## 0.0.23

### Patch Changes

- [#97](https://github.com/bpmnkit/monorepo/pull/97) [`c9aa98d`](https://github.com/bpmnkit/monorepo/commit/c9aa98d6430ec2022278631dae7c281aae9ae499) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improved Autolayout

- [#95](https://github.com/bpmnkit/monorepo/pull/95) [`5897d0f`](https://github.com/bpmnkit/monorepo/commit/5897d0f77a9d29dc7e88c5123f467686ff6e1960) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improve auto-layout

## 0.0.22

### Patch Changes

- [#89](https://github.com/bpmnkit/monorepo/pull/89) [`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c) Thanks [@urbanisierung](https://github.com/urbanisierung)! - docs

- Updated dependencies [[`d576e97`](https://github.com/bpmnkit/monorepo/commit/d576e97736b9056c7e6c8cbac585957dc4cd297c)]:
  - @bpmnkit/feel@0.0.18

## 0.0.21

### Patch Changes

- [#81](https://github.com/bpmnkit/monorepo/pull/81) [`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`d79affd`](https://github.com/bpmnkit/monorepo/commit/d79affda9b61f5edc400e00b23c54ab037f9ce40)]:
  - @bpmnkit/feel@0.0.17

## 0.0.20

### Patch Changes

- [`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Minor fixes.

- Updated dependencies [[`802e1dd`](https://github.com/bpmnkit/monorepo/commit/802e1dde53dfda07371e6a83dcf0e05e2650d0a2)]:
  - @bpmnkit/feel@0.0.16

## 0.0.19

### Patch Changes

- [#76](https://github.com/bpmnkit/monorepo/pull/76) [`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI preparation

- Updated dependencies [[`8d1a978`](https://github.com/bpmnkit/monorepo/commit/8d1a978e0b8c321106d95226134cbba6433ab4af)]:
  - @bpmnkit/feel@0.0.15

## 0.0.18

### Patch Changes

- [#74](https://github.com/bpmnkit/monorepo/pull/74) [`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Test suites, simulation mode, improved reebe-wasm

- Updated dependencies [[`e356b98`](https://github.com/bpmnkit/monorepo/commit/e356b98a6b281f825e757cb6e480e50369789d08)]:
  - @bpmnkit/feel@0.0.14

## 0.0.17

### Patch Changes

- [#70](https://github.com/bpmnkit/monorepo/pull/70) [`3f3b8f7`](https://github.com/bpmnkit/monorepo/commit/3f3b8f777cfb192582452757d86dc53b3de8059d) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Input Validation

## 0.0.16

### Patch Changes

- [#66](https://github.com/bpmnkit/monorepo/pull/66) [`270078c`](https://github.com/bpmnkit/monorepo/commit/270078c52fce2c2a567fa1b4b9d6de8001c6f18e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Improved AI capabilities.

## 0.0.15

### Patch Changes

- [#58](https://github.com/bpmnkit/monorepo/pull/58) [`4953231`](https://github.com/bpmnkit/monorepo/commit/49532315a01c884d2a50375e6ea0148d6e294034) Thanks [@urbanisierung](https://github.com/urbanisierung)! - UX improvements

## 0.0.14

### Patch Changes

- [#53](https://github.com/bpmnkit/monorepo/pull/53) [`e9c16e0`](https://github.com/bpmnkit/monorepo/commit/e9c16e0e8f1d786feb10293a8abb2489846402db) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Introduction of CLI plugins, support for more services.

## 0.0.13

### Patch Changes

- [#49](https://github.com/bpmnkit/monorepo/pull/49) [`7918d12`](https://github.com/bpmnkit/monorepo/commit/7918d120740b85a2c4a363ff7dd9605d4f0f8a0d) Thanks [@urbanisierung](https://github.com/urbanisierung)! - AI in CLI, improved AI search in Operate, improved ASCII rendering

## 0.0.12

### Patch Changes

- [#47](https://github.com/bpmnkit/monorepo/pull/47) [`89e73af`](https://github.com/bpmnkit/monorepo/commit/89e73af16532adb580a338eb8e4996d29b361283) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design, AI, OpenAPI

## 0.0.11

### Patch Changes

- [#44](https://github.com/bpmnkit/monorepo/pull/44) [`da36cc5`](https://github.com/bpmnkit/monorepo/commit/da36cc54f36abaf0bebd686d4996d516037fd36b) Thanks [@urbanisierung](https://github.com/urbanisierung)! - New logo

## 0.0.10

### Patch Changes

- [#42](https://github.com/bpmnkit/monorepo/pull/42) [`adb60ed`](https://github.com/bpmnkit/monorepo/commit/adb60ed90f675b3565edb7d82d937acce518c837) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Proper README

## 0.0.9

### Patch Changes

- [#39](https://github.com/bpmnkit/monorepo/pull/39) [`0b7e74b`](https://github.com/bpmnkit/monorepo/commit/0b7e74ba66e35ef5361ac35dccf695f4f0671d6a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Renamed from @bpmn-sdk/_ to @bpmnkit/_. Update your imports.

## 0.0.8

### Patch Changes

- [#34](https://github.com/bpmnkit/monorepo/pull/34) [`a918a93`](https://github.com/bpmnkit/monorepo/commit/a918a93d3d57f69c93c963da1b2710a3467a1b19) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Design changes

## 0.0.7

### Patch Changes

- [#32](https://github.com/bpmnkit/monorepo/pull/32) [`1120205`](https://github.com/bpmnkit/monorepo/commit/11202057baaf25f9a29c9a3a90b1f1f1fc002b64) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate and CLI improvements

## 0.0.6

### Patch Changes

- [#30](https://github.com/bpmnkit/monorepo/pull/30) [`42ddd02`](https://github.com/bpmnkit/monorepo/commit/42ddd0255759ce35a14533cbc7667542ba9dac2e) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Operate, CLI, api

## 0.0.5

### Patch Changes

- [#28](https://github.com/bpmnkit/monorepo/pull/28) [`42455c0`](https://github.com/bpmnkit/monorepo/commit/42455c00033f3526a5cffdd0f68b973a5d556fec) Thanks [@urbanisierung](https://github.com/urbanisierung)! - SDK improvements, operate, editor UX improvements

## 0.0.4

### Patch Changes

- [#26](https://github.com/bpmnkit/monorepo/pull/26) [`454f119`](https://github.com/bpmnkit/monorepo/commit/454f1192d919ad0397f2e1d2f24de5acb1a38156) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Docs, Logo, AI improvements

## 0.0.3

### Patch Changes

- [`ee1610b`](https://github.com/bpmnkit/monorepo/commit/ee1610b2c310e8ae9e063632a53479656309920a) Thanks [@urbanisierung](https://github.com/urbanisierung)! - Fix package.json

## 0.0.2

### Patch Changes

- [#22](https://github.com/bpmnkit/monorepo/pull/22) [`7470bd9`](https://github.com/bpmnkit/monorepo/commit/7470bd92c37b13ab9895a784ae667e933aa4b072) Thanks [@urbanisierung](https://github.com/urbanisierung)! - First ready features.
