# `philippfromme/bpmn-sdk` — analysis and adoption plan

_2026-09-07 · evaluated against `packages/core` at `45d3401`, SDK at `3b660b2` (v0.1.0)_

## Verdict

`bpmn-sdk` is roughly 10,700 lines against `@bpmnkit/core`'s 23,000, and it does far less:
no DMN, no forms, no FEEL, no layout engine of its own, no browser support, no viewer,
no editor, no engine, no CLI. On feature breadth BPMN Kit is not close to being behind.

It is ahead on exactly one axis, and that axis is **correctness of the model layer**.
`bpmn-sdk` is built on `bpmn-moddle`, so its object model is the BPMN and Zeebe moddle
descriptors themselves — every element and property the descriptors define round-trips,
by construction. `@bpmnkit/core` hand-writes its model as a closed TypeScript subset, so
anything the subset does not name is dropped on write, silently.

That is not a theoretical difference. Measured against twelve real Camunda 8 blueprints,
`Bpmn.parse()` → `Bpmn.export()` loses data in **eleven of twelve files**, including
**22 `zeebe:subscription` elements across nine files**. A `zeebe:subscription` is the
message correlation key. A process round-tripped through BPMN Kit today still deploys to
Camunda 8, still looks right in a modeler, and never correlates a message again.

Nothing in this document requires adopting `bpmn-moddle` or giving up the zero-dependency,
browser-safe design of `@bpmnkit/core`. The four things worth taking are a **fidelity
contract**, a **verified write boundary**, a **full-model edit path**, and two **CI gates**.

> **Licensing.** `bpmn-sdk` ships no `LICENSE` file and no `license` field in its
> `package.json`. It is therefore all-rights-reserved: **do not copy code, tests, or
> fixtures from it.** Every action item below is an independent implementation of an idea.
> The blueprint corpus in §4 must be sourced from Camunda's public blueprint marketplace
> directly, with provenance recorded, not lifted from that repository. §7.0 states the
> clean-room rule this work is done under; §7.1 traces every measured gap to the item
> that closes it, so "all gaps implemented" is a checkable condition rather than a claim.

---

## 1. What `bpmn-sdk` is

A Node-only library (`node:fs`, `node:crypto`, `node:path` throughout) with one entry
point, `Bpmn`, offering four ways in:

| Entry point | Purpose |
|---|---|
| `Bpmn.createProcess(id)` | fluent single-process construction |
| `Bpmn.createCollaboration(id)` | pools, messages, message flows |
| `Bpmn.open(file)` | exact-ID editing of an existing file |
| `Bpmn.create()` | empty descriptor-backed model |

Its architecture is four separated layers, and the separation is the point:

```
bpmn-moddle + zeebe-bpmn-moddle descriptors
        │
        ├── build time: @bpmn-io/moddle-types-generator → generated .d.ts
        │
        └── runtime:  model-loader.ts   parse + profile resolution
                      project.ts        semantic projection + canonical hash
                      model.ts          exact-ID mutation API
                      model-runtime.ts  serialize → reload → verify → write
                      output.ts         atomic file replacement
```

`packages/core` has no equivalent of the last three. `bpmn-parser.ts` and
`bpmn-serializer.ts` are a matched pair with nothing checking that they agree.

---

## 2. Scope, side by side

| Capability | `bpmn-sdk` | `@bpmnkit/core` |
|---|---|---|
| BPMN parse / serialize | via `bpmn-moddle` | own parser (`xml-parser.ts`, 552 LOC) |
| Model completeness | descriptor-complete | hand-written subset |
| Fluent process builder | yes | yes, richer (auto-join, `element()`, annotations) |
| Fluent collaboration builder | yes | **no** — builder always emits `collaborations: []` |
| Continue an existing model fluently | `continueProcess(id).at(node)` | **no** |
| Exact-ID edit of full model | yes | **no** — edits go through lossy `CompactDiagram` |
| Custom moddle extensions | descriptor-validated | raw `XmlElement[]`, unvalidated |
| Verified write boundary | yes | **no** |
| Semantic hash / change report | yes | **no** |
| Atomic file write | yes | no (plain `writeFile`) |
| Layout | delegates to `bpmn-auto-layout` | own semantic + grid engines, benchmarked |
| Diagram Interchange | always discarded and regenerated | preserved, completeness-checked, colours |
| Static analysis | 6 diagnostics | `optimize/` — 11 categories, ~40 rules, auto-fix |
| DMN / forms / FEEL | none | full |
| Browser support | none (Node-only) | yes, zero runtime deps |
| Camunda 8 REST client | none | `@bpmnkit/api`, 180 operations |
| Connectors, engine, canvas, editor, CLI, docs | none | yes |

---

## 3. Where `bpmn-sdk` is genuinely ahead

### 3.1 A descriptor-driven model instead of a hand-written one

`model-types.generated.ts` (1,008 lines) is generated at build time from the bundled
`bpmn.json`, `bpmndi.json`, `dc.json`, `di.json` and `zeebe.json` descriptors. It produces
a `SupportedElementType` union, per-type `ElementProperties<T>`, and a classification map
that labels every descriptor property `scalar` | `reference` | `contained-child` |
`presentation`. `npm run check:types` regenerates and diffs, so a descriptor bump that
changes the spec surface fails the build rather than drifting.

`packages/core/src/bpmn/bpmn-model.ts` is 657 hand-maintained lines. It has drifted, and
nothing detects the drift.

### 3.2 The write boundary (`model-runtime.ts`)

`write()` is the only serialization boundary in the library, and it does five things
before a byte reaches disk:

1. Refuses unsupported extension data rather than dropping it.
2. Computes the expected semantic hash from the in-memory model.
3. Serializes; optionally lays out; **reloads the serialized XML**.
4. Fails with `MODEL_VERIFICATION_FAILED` if the reloaded semantic hash differs, or if
   serialization introduced parse warnings or unresolved references that the input did
   not have.
5. Writes atomically — temp file plus `rename`, `link` for create-exclusive, refuses an
   output path that aliases the source, refuses to replace without `force: true`.

This is the single most valuable idea in the repository. It converts "the serializer might
be wrong" from a latent risk into a build failure. BPMN Kit has no equivalent: the CLI
writes with a bare `writeFile` and never re-reads what it wrote.

### 3.3 Semantic projection and canonical hashing (`project.ts`)

`projectElement()` walks an element through its moddle descriptor and emits canonical JSON,
classifying each property and **excluding presentation data by construction** —
`bpmndi`, `dc`, `di`, `bioc`, `color` prefixes, plus `zeebe:modelerTemplateIcon` (a
base64 SVG that would otherwise dominate a diff). `semanticHash()` canonicalizes key order
and SHA-256s the result.

Two consequences worth having:

- **Layout is provably semantics-preserving.** Re-laying out a diagram cannot change the
  hash, so DI churn can never be confused with a model change.
- **`write()` returns a change report** — `{ added, changed, removed }` keyed by element
  ID, with before/after projections. That is exactly the diff an AI review loop or a
  `casen` command needs to show a user what it is about to do.

### 3.4 Fidelity as an executable gate

`blueprint-fixtures.test.ts` round-trips twelve real Camunda blueprints and asserts the
semantic hash is unchanged. `generator-examples.test.ts` executes each example script and
gates four things at once: script size (≤ 2,500 bytes), execution time (≤ 5 s), write
success, and zero parse/reference/extension diagnostics after reload.

The script-size gate is an unusual and good idea for an agent-facing SDK: it makes
"the API is concise enough for a model to emit" a number that CI enforces.

### 3.5 A publish gate that actually consumes the package

`scripts/check-package.mjs` runs `npm pack`, installs the tarball into a temp project,
imports it from JavaScript, and type-checks a TypeScript consumer under
`--strict --module NodeNext`. `scripts/check-packages.mjs` in this repo validates
`package.json` metadata fields only (143 lines, no `pack`, no install, no exports check),
so a broken `exports` map or a missing `.d.ts` ships.

### 3.6 Explicit topology as a design rule

`bpmn-sdk` never infers a join, a branch condition, a default flow, a loop target, or a
cursor position. `ProcessBuilder.continue()` requires both the process ID and the node ID.
`@bpmnkit/core`'s builder calls `insertJoinGateways()` and infers joins.

This is a real trade-off, not a defect on either side — BPMN Kit's inference is what makes
its builder terse. It is worth naming in the docs so callers know which contract they are
under, and worth offering an opt-out for generated code that wants to be explicit.

---

## 4. The measured fidelity gap

Twelve Camunda 8 blueprints, parsed and re-exported with `@bpmnkit/core@0.1.2` built from
`45d3401`, comparing element counts by tag name. `A → B` means A occurrences in the input,
B in the output.

### 4.1 `Bpmn.parse()` → `Bpmn.export()`

| Blueprint | Loss |
|---|---|
| ai-email-support-agent | `zeebe:subscription` 1 → 0 |
| bank-customer-complaint-dispute-handling | `zeebe:subscription` 3 → 0 |
| capital-market-trade-exception-remediation | `zeebe:subscription` 3 → 0 |
| car-rental-booking-process | `zeebe:subscription` 2 → 0 |
| communication-agent | `zeebe:subscription` 4 → 0 |
| enforcing-sla | `zeebe:subscription` 2 → 0 |
| event-registration | `bpmn:dataOutputAssociation` 1 → 0, `bpmn:targetRef` 1 → 0 |
| fraud-detection-process | **none** |
| intelligent-routing-with-openai | none (empty `extensionElements` elided) |
| safeguard-agent | `zeebe:subscription` 1 → 0 |
| servicenow-integration-blueprint | `zeebe:subscription` 3 → 0, `bpmn:category` 6 → 0, `bpmn:categoryValue` 6 → 0, `bpmn:dataInputAssociation` 3 → 0, `bpmn:dataOutputAssociation` 4 → 0, `bpmn:property` 3 → 0, `bpmn:sourceRef` 3 → 0, `bpmn:targetRef` 7 → 0, `bpmn:documentation` 1 → 0 |
| telco-service-order-fulfillment-retail | `zeebe:subscription` 3 → 0 |

Reduced to a minimal case:

```xml
<bpmn:message id="Msg_1" name="OrderPlaced">
  <bpmn:extensionElements>
    <zeebe:subscription correlationKey="=orderId" />
  </bpmn:extensionElements>
</bpmn:message>
<bpmn:process id="P" isExecutable="true">
  <bpmn:documentation>Doc on process</bpmn:documentation>
  ...
</bpmn:process>
```

round-trips to:

```xml
<bpmn:message id="Msg_1" name="OrderPlaced"/>
<bpmn:process id="P" isExecutable="true">
  ...
</bpmn:process>
```

**Root causes**, all in `packages/core/src/bpmn/bpmn-model.ts`:

- `BpmnMessage`, `BpmnError`, `BpmnEscalation`, `BpmnSignal`, `BpmnParticipant`,
  `BpmnMessageFlow`, `BpmnLane`, `BpmnTextAnnotation`, `BpmnAssociation` and `BpmnGroup`
  have **no `extensionElements` field** and no `documentation` field. `BpmnError` and
  `BpmnSignal` do not even carry `unknownAttributes`.
- `bpmn-parser.ts` has no case for `category`, `categoryValue`, `dataInputAssociation`,
  `dataOutputAssociation`, `property`, `ioSpecification`, `correlationKey`,
  `itemDefinition`, `import`, or `resourceRole`. Unhandled means dropped.
- Process-level `documentation` is parsed for flow nodes but not for `bpmn:process`.

Flow-node `extensionElements` and flow-node `documentation` **are** preserved — this is a
gap at the edges of the model, not a systemic parser failure.

### 4.2 `compactify()` → `applyOperations()` → `expand()`

This is the path the CLI (`casen generate bpmn --input`), the MCP server
(`get_diagram` / `replace_diagram`) and the AI review loop all run on. It is far more
destructive, because `CompactElement` models about fifteen properties and discards the
rest by design.

Representative — `blueprint.telco-service-order-fulfillment-retail.bpmn`:

```
bpmn:collaboration 1→0   bpmn:participant 5→0    bpmn:messageFlow 16→0
bpmn:laneSet 1→0         bpmn:lane 1→0           bpmn:flowNodeRef 27→0
bpmn:message 3→0         bpmn:error 2→0          bpmn:textAnnotation 1→0
bpmn:multiInstanceLoopCharacteristics 2→0        zeebe:ioMapping 2→0
zeebe:properties 2→0     zeebe:script 2→0        zeebe:subscription 3→0
bpmndi:BPMNDiagram 3→1   bpmndi:BPMNShape 55→48  di:waypoint 129→97
```

Across the corpus the compact round trip loses **every collaboration, participant, message
flow, lane, data store, artifact and root-level message/error/escalation**, all
`zeebe:ioMapping` detail (`zeebe:input` 91 → 0 in one file), all `zeebe:userTask` markers,
and most DI.

`applyOperations()` compounds this: every operation is a silent no-op when the target ID
does not exist (`if (found) …` throughout, `operations.ts:100-160`), and `resolveContainer()`
falls back to the process root when `parent` does not resolve. An AI-generated patch that
misspells an ID reports success and changes nothing.

**The sharpest edge:** `casen generate bpmn --input model.bpmn` with no `--output`
**overwrites the input file in place** (`apps/cli/src/commands/generate.ts:670-676`) with
`expand(compactify(parse(xml)))` — a full lossy round trip — with no backup, no `--force`,
no verification, and a success message. Run on a real blueprint, it destroys pools, lanes,
message correlation and I/O mappings and says `Patched and written to model.bpmn`.

### 4.3 The documentation asserts the opposite

`apps/landing/src/content/docs/getting-started/concepts.md:90`:

> The parser preserves all attributes, extensions, and vendor-specific elements. Exporting
> the parsed object produces XML that is semantically equivalent to the input.

Both sentences are false as measured. The same page (line 80) also shows
`definitions.rootElements.find(el => el.$type === "bpmn:Process")` — `bpmn-moddle`'s API,
not ours; `BpmnDefinitions` exposes `processes`. This is shipped in `@bpmnkit/docspack`,
so agents are being told the guarantee holds.

---

## 5. Where BPMN Kit is ahead

Worth stating plainly, because the plan below should not erode any of it.

- **Diagram Interchange.** `bpmn-sdk` has exactly two layout modes and *both discard the
  existing diagram* — `layout: "auto"` regenerates the whole model's DI, `layout: "none"`
  writes none. A hand-arranged diagram cannot survive a write. BPMN Kit preserves DI,
  checks it for completeness (`di-check.ts`), addresses planes (`di-planes.ts`) and
  handles `bioc`/`color` extensions.
- **Layout.** BPMN Kit has its own semantic and grid engines with a benchmark harness that
  compares against reference layouts (`layout/bench.ts`). `bpmn-sdk` delegates to
  `bpmn-auto-layout`, which `doc/bpmn-auto-layout-evaluation.md` already evaluated and
  declined to adopt wholesale (45 KB gzipped, 36 ms median and ~1–1.9 s worst case on
  collaborations versus our 0.3 ms).
- **Static analysis.** `optimize/` spans 11 categories with auto-fixes and a pattern
  advisor. `bpmn-sdk`'s `processDiagnostics` has six checks, all of which we already cover.
- **Browser and zero dependencies.** `packages/core/src` imports nothing from `node:`.
  That is what lets `@bpmnkit/canvas`, `@bpmnkit/editor` and `@bpmnkit/plugins` exist.
  `bpmn-sdk` cannot run in a browser at all.
- **Everything else.** DMN, forms, FEEL, the execution engine, the Camunda 8 REST client,
  the connector catalog, `operate`, the CLI, the docs pack.

---

## 6. What not to adopt

- **`bpmn-moddle` as a runtime dependency.** It would break browser support, the
  zero-dependency promise, and the bundle budget for canvas/editor. The *idea* —
  descriptor-driven typing — is adoptable without the dependency; see A2.
- **Discarding DI on write.** A regression for us.
- **`bpmn-auto-layout`.** Already evaluated and declined.
- **Removing join inference from the builder.** It is a deliberate ergonomic choice.
  Document the contract and add an opt-out instead.
- **Any code, test or fixture copied from the repository.** No license (§ Verdict).

---

## 7. Action items

**Every gap in §4 gets closed.** The priority labels order the work, they do not select it:
**P0** = silent data loss users cannot detect, do first; **P1** = closes a real capability
gap; **P2** = depends on P0/P1 landing first. Nothing here is optional, and §7.1 is the
checklist that says so.

### 7.0 Clean-room rule

None of this is a port. The SDK is all-rights-reserved (§ Verdict), so it cannot be a
source — only the problem statement can be. Concretely:

- **Implement from this document and from the moddle JSON descriptors, never from the SDK's
  source.** §3 and §4 describe every behaviour to be built in prose and measurement; that
  is the whole specification. Do not open `bpmn-sdk`'s `.ts` files while writing the
  equivalent module, and do not keep a clone in the working tree.
- **The descriptors are an independent, licensed source.** `bpmn-moddle` and
  `zeebe-bpmn-moddle` are both **MIT** (verified 2026-09-07: `bpmn-moddle` © 2014 camunda
  Services GmbH; `zeebe-bpmn-moddle` © 2020–present Camunda Services GmbH). Their
  `bpmn.json` / `bpmndi.json` / `dc.json` / `di.json` / `zeebe.json` may be vendored or read
  at build time provided the MIT notice travels with them — record it in
  `packages/core/src/bpmn/descriptors/LICENSE` alongside the vendored files. The BPMN 2.0
  and DI specifications themselves (OMG) are the other legitimate source.
- **Fixtures come from Camunda, not from the SDK.** Same blueprints, sourced independently,
  with `PROVENANCE.md` recording URL, date and terms per file (A1).
- **Names and shapes will differ, and should.** Our API is `BpmnDefinitions` +
  `XmlElement`, not moddle elements; our hash is over our own projection; our write
  boundary is a free function, not a method on a `Bpmn` facade. Convergent naming for
  genuinely shared concepts (`semanticHash`, `layout: "none"`) is unavoidable and fine —
  copied structure is not.

### 7.1 Traceability — every measured gap to the item that closes it

| # | Measured gap (§4) | Evidence | Closed by | Verified by |
|---|---|---|---|---|
| G1 ✅ | `zeebe:subscription` dropped — 22 elements, 9/12 blueprints | §4.1, minimal repro | A3 (`extensionElements` on `BpmnMessage`) | A1 allow-list entry deleted; `zeebe-extensions` accessor test |
| G2 ✅ | `extensionElements` dropped on `BpmnError`, `BpmnEscalation`, `BpmnSignal`, `BpmnParticipant`, `BpmnMessageFlow`, `BpmnLane`, `BpmnTextAnnotation`, `BpmnAssociation`, `BpmnGroup` | §4.1 root cause | A3 | A1 corpus + per-type unit test |
| G3 ✅ | `bpmn:documentation` dropped on `bpmn:process` and `bpmn:definitions` | minimal repro | A3 | A1 corpus |
| G4 ✅ | `bpmn:category` / `bpmn:categoryValue` dropped — group labels | §4.1 servicenow | A3 | A1 corpus |
| G5 ✅ | `bpmn:dataInputAssociation` / `dataOutputAssociation` / `bpmn:property` / `sourceRef` / `targetRef` dropped | §4.1 servicenow, event-registration | A3 | A1 corpus |
| G6 ✅ | `unknownAttributes` missing on `BpmnError`, `BpmnSignal`, `BpmnLaneSet` | `bpmn-model.ts` read | A3 | per-type unit test |
| G7 ✅ | Unmodelled children silently dropped — `ioSpecification`, `correlationKey`, `itemDefinition`, `import`, `resourceRole`, and anything the spec adds later | parser has no case | A3 (`unknownChildren` catch-all — **preservation**, not modelling; model a type only when a consumer needs to read it) | A1 corpus + a synthetic fixture using each |
| G8 ✅ | No fidelity gate — parser and serializer are unchecked against each other | no such test exists | A1 | the suite itself; allow-list empty |
| G9 ✅ | No semantic hash; layout churn indistinguishable from a model change | no such module | A2 | auto-layout does not change the hash |
| G10 ✅ | No change report on write | no such module | A2 (`diffSemantics`) | golden diff per corpus fixture |
| G11 ✅ | No verified write boundary — nothing re-reads what it wrote | `writeFile` at 11 CLI sites | A4 | injected lossy serializer must be refused |
| G12 ✅ | Non-atomic writes; no overwrite guard; output may alias input | `apps/cli/src/commands/*` | A4 | interrupted-write and alias tests |
| G13 ✅ | `casen generate bpmn --input` overwrites its input with a lossy round trip | `generate.ts:670-676` | A5a | CLI test: refuses without `--output`/`--force` |
| G14 ✅ | `applyOperations()` no-ops silently on unresolved element/flow/parent IDs | `operations.ts:100-160` | A5b | unresolved-ID test expects a failure |
| G15 ✅ | Edit path runs through lossy `CompactDiagram` (CLI, MCP, AI review) | §4.2 | A5c | corpus edit round trip preserves hash |
| G16 ✅ | Docs assert a round-trip guarantee we do not hold; example uses `bpmn-moddle`'s API | `concepts.md:80,90` | A6 | docspack rebuilt; claim matches A1's result |
| G17 ✅ | Zeebe extensions writable to invalid owners; no descriptor validation | `zeebe-extensions.ts` | A7 | placement-rejection tests |
| G18 ✅ | Hand-written model drifts from the spec with nothing detecting it | §3.1 | A12 | coverage check fails on an unmodelled descriptor type |
| G19 ✅ | No collaboration builder — `collaborations: []` hard-coded | `bpmn-builder.ts:2532,2687` | A8 | build → parse → layout against existing collaboration fixtures |
| G20 ✅ | Cannot continue an existing model fluently; extending means regenerating | no such API | A9 | continue-and-write preserves the untouched remainder's hash |
| G21 ✅ | Publish gate checks metadata only — broken `exports` or missing `.d.ts` ships | `check-packages.mjs`, 143 lines | A10 | pack + install + strict typecheck per package |

| G22 ✅ | `bpmn:loopCardinality` and `bpmn:completionCondition` dropped — a multi-instance activity loses its cardinality and completion condition | A1 corpus, `06-events-and-containers.bpmn` | A3 | A1 allow-list entry deleted |
| G23 ✅ | `extensionElements` dropped on `bpmn:collaboration` | A1 corpus, `02-collaboration.bpmn` | A3 | A1 allow-list entry deleted |

G1–G7, G22 and G23 are one code change (A3) against one test (A1); they are listed
separately because each is an independently observable loss and each retires an allow-list
entry.

**Status: A1, A2, A3, A4, A5a, A5b, A5c and A6 shipped (2026-09-07).** G14 and G15 are
A5b/A5c's rows. `applyBpmnOperations` and `reconcileCompact` apply the operation vocabulary to
`BpmnDefinitions` and report unresolved ids instead of skipping them; the CLI patch path, the
proxy's `/improve` and the MCP server's `replace_diagram` all go through them now.

**Correction to this plan.** §7.1 and A5c said the MCP *mutation* tools apply to a compact
diagram. They do not — `add_elements`, `remove_elements`, `update_element`, `set_condition` and
`add_http_call` already mutated `BpmnDefinitions` directly. Only `replace_diagram` expanded
compact over the whole model, and only that one needed changing.

**Status: A1, A2, A3, A4, A5a and A6 shipped (2026-09-07).** G11 and G12 are A4's rows:
`writeBpmn` in `packages/core/src/node/write.ts`, behind the `@bpmnkit/core/node` subpath so
the main entry stays free of `node:` builtins — verified by walking the 71 modules reachable
from `dist/index.js`, none of which import one.

**Status: A1, A2, A3, A5a and A6 shipped (2026-09-07).** G9 and G10 are A2's rows and are
marked ✅ too: `semanticHash`, `projectSemantics` and `diffSemantics` live in
`packages/core/src/bpmn/semantic-hash.ts`, synchronous and dependency-free so the browser
build and the future write boundary stay unencumbered.

**Status: all A3 rows closed (2026-09-07).** G1–G7, G22 and G23 are marked ✅ — the model
gaps are fixed and their allow-list entries deleted, leaving only the two `normalised`
entries. `packages/core/tests/roundtrip-corpus.test.ts` is the standing proof.

**G22 and G23 were found by the A1 corpus, not by §4.** The blueprints happened to use
multi-instance activities without a cardinality or completion condition, and to carry no
collaboration-level extensions, so the measurement in §4 could not see either. That is the
argument for keeping both kinds of fixture: the hand-written corpus covers the constructs
the parser *claims* to handle, and real-world files cover the ones nobody thought to look
for. G22 is the more serious of the two — a sequential or bounded loop silently becomes an
unbounded parallel one.

### A1 — Round-trip fidelity gate (P0, foundational)

Nothing else on this list can be verified without it, so it goes first.

- Assemble a corpus of 12–20 real Camunda 8 blueprints under
  `packages/core/tests/fixtures/blueprints/`, downloaded from Camunda's public blueprint
  marketplace with a `PROVENANCE.md` recording source URL, date and terms for each file.
  Do not copy them from `bpmn-sdk`.
- Add `packages/core/tests/roundtrip-corpus.test.ts`: for each fixture, assert
  `parse → export` preserves a **structural signature** — a normalized, DI-excluded,
  attribute-order-independent projection of the document tree. Start by comparing
  per-tag-name counts plus per-element attribute sets; that alone catches every loss in §4.
- Ship it **red-listed**: enumerate today's known losses as an explicit allow-list so the
  suite lands green and each subsequent fix deletes an entry. The allow-list going empty
  is the definition of done for A3.
- Verify: `pnpm --filter @bpmnkit/core test`.

Effort: ~1 day. Touches only `packages/core/tests/`.

### A2 — Semantic projection and hash (P0)

The primitive that A4, A5 and A7 all depend on.

- New `packages/core/src/bpmn/semantic-hash.ts`, zero dependencies, browser-safe:
  - `projectSemantics(defs): SemanticProjection` — canonical JSON of the model with DI,
    `bioc`/`color`, `zeebe:modelerTemplateIcon`, exporter metadata and key order excluded.
  - `semanticHash(defs): string` — SHA-256 over the canonical JSON. Use `crypto.subtle`
    (async) or a small in-repo SHA-256; **do not** import `node:crypto`.
  - `diffSemantics(before, after): { added, changed, removed }` keyed by element ID.
- Test that applying auto-layout does not change the hash. That single assertion is worth
  the whole module.
- Export from `packages/core/src/index.ts`.
- Verify: layout-invariance test plus a golden hash per corpus fixture.

Effort: ~2 days. Note the async wrinkle if `crypto.subtle` is used — decide up front
whether `semanticHash` is sync (own implementation) or async (WebCrypto). Sync is
preferable; it keeps `write()` and the diff report ergonomic.

### A3 — Close the model gaps the corpus exposes (P0)

Driven entirely by A1's allow-list. In `bpmn-model.ts`, `bpmn-parser.ts`,
`bpmn-serializer.ts`:

- Add `extensionElements: XmlElement[]` and `documentation?: string` to `BpmnMessage`,
  `BpmnError`, `BpmnEscalation`, `BpmnSignal`, `BpmnParticipant`, `BpmnMessageFlow`,
  `BpmnLane`, `BpmnTextAnnotation`, `BpmnAssociation`, `BpmnGroup`. Add
  `unknownAttributes` to `BpmnError`, `BpmnSignal` and `BpmnLaneSet`.
  **This alone fixes `zeebe:subscription` — 22 elements across 9 of 12 blueprints.**
- Add `documentation` to `BpmnProcess` and `BpmnDefinitions`.
- Model `bpmn:category` / `bpmn:categoryValue` (group labels).
- Model `bpmn:dataInputAssociation` / `bpmn:dataOutputAssociation` / `bpmn:property`
  (`sourceRef` / `targetRef` children included) on flow nodes.
- Add a catch-all: any direct child of a modeled container that the parser does not
  recognise is retained as a raw `XmlElement` in an `unknownChildren` array and re-emitted
  in document order. This converts every remaining and every *future* gap from silent loss
  into preservation, which is the property that actually matters.
- Consider a `zeebe:subscription`-specific accessor in `zeebe-extensions.ts` so the
  correlation key is reachable without walking raw XML.
- Verify: A1's allow-list drops to empty.

Effort: ~3 days. Additive to public types — no breaking change.

### A4 — `Bpmn.write()`: a verified, atomic write boundary (P1)

A Node-only module so `packages/core` stays browser-safe. Put it in
`packages/core/src/node/write.ts` behind a `./node` subpath export, or in a new
`@bpmnkit/io` package if the subpath complicates the bundle story.

- `writeBpmn(defs, { output, force, validate, layout })`:
  1. Compute expected hash (A2).
  2. Serialize; optionally lay out.
  3. **Re-parse the serialized XML** and recompute the hash.
  4. Throw `WriteVerificationError` on mismatch, listing the diverging element IDs.
  5. Write atomically: temp file plus `rename`; refuse an output that aliases the input;
     refuse to replace an existing file without `force`.
- Return `{ destination, outputSha256, semanticHash, changes }` (A2's diff).
- Verify: a test that injects a deliberately lossy serializer and asserts the write is
  refused, not silently completed.

Effort: ~2 days.

### A5 — Route the CLI and MCP edit paths off `CompactDiagram` (P0 for the CLI)

- **Immediate, small:** `casen generate bpmn --input` must not overwrite its input by
  default. Require `--output`, or require `--force` to replace in place, and route the
  write through A4. This is a one-file change in `apps/cli/src/commands/generate.ts` and
  it stops the worst case today. Ship it ahead of the rest of A5.
- `applyOperations()` must **fail loudly** on an unresolved element, flow or parent ID
  instead of no-op'ing. Return `{ diagram, problems }` or throw — either is better than
  silence. This is a behaviour change; gate it behind a `strict: true` option for one
  minor version, then flip the default.
- Re-target the operation set at `BpmnDefinitions` rather than `CompactDiagram`, so an
  edit does not require a lossy projection. Keep `compactify()` as what it is — a
  **read-only, token-efficient view for LLM prompts** — and say so in its doc comment and
  in the docs.
- Same for the MCP server: `get_diagram` may keep returning compact JSON, but
  `replace_diagram` and the mutation tools must apply to the full model.

Effort: ~1 day for the CLI guard, ~4 days for the operations re-target.

### A6 — Correct the documentation (P0, hours not days)

`apps/landing/src/content/docs/getting-started/concepts.md`:

- Replace the false round-trip guarantee with the guarantee we can actually make once A3
  lands, worded against the A1 corpus: which classes of content are preserved, and what
  `unknownChildren` does with the rest.
- Fix the `definitions.rootElements.find(...)` example to the real `BpmnDefinitions` shape.
- Document that `compactify()` is lossy and read-only.
- Rebuild the pack: `pnpm --filter @bpmnkit/docspack build`.

Until A3 lands this is a correction, not a downgrade — the current text is simply wrong.

### A7 — Descriptor-checked extension writes (P1)

Adopt the *idea* of `bpmn-sdk`'s `extensions.ensure()` without `bpmn-moddle`:

- Vendor `zeebe.json` from `zeebe-bpmn-moddle` (**MIT**, © 2020–present Camunda Services
  GmbH — carry the notice into `packages/core/src/bpmn/descriptors/LICENSE`) and generate a
  build-time table of `{ type → { validOwners, properties } }`. The descriptor is the
  independent source that makes this a re-implementation rather than a port (§7.0).
- `zeebe-extensions.ts` gains `ensureExtension(owner, type)` which rejects a placement the
  descriptor does not allow — `zeebe:formDefinition` only on a user task,
  `zeebe:subscription` only on a message, and so on.
- A generation script plus a `--check` mode in CI, so a descriptor bump that changes the
  surface fails the build instead of drifting (this is `bpmn-sdk`'s `check:types` pattern).

Effort: ~3 days. Naturally sequenced after A3.

**As shipped.** `scripts/generate-zeebe-placement.ts` resolves `zeebe.json`'s `meta.allowedIn`
against `bpmn.json`'s type graph and writes `src/bpmn/zeebe-placement.ts` — 26 extensions to
the concrete element names that may own them. All descriptor reasoning happens at generation
time, so the runtime is a set lookup and `packages/core/src` still reads no descriptor and
ships none.

Two things the plan did not anticipate:

- **`zeebe:subscription` cannot be checked.** The plan named it as the example
  (“only on a message”), but the descriptor declares no `allowedIn` for it, nor for
  `zeebe:properties`. The rule is therefore *reject only what the descriptor positively
  forbids* — an extension the table does not mention is allowed. Inventing the missing rule
  would have meant asserting our own opinion in the one place this item exists to avoid that.
- **A misplaced extension is a reported problem, not a thrown error, on the operations path.**
  Operations come from a model, so a bad placement is a thing that will happen rather than a
  programmer error. `applyBpmnOperations` checks placement *before* writing, so the operation
  stays atomic: strict mode throws `OperationError` as it does for any other bad operation,
  and a non-strict caller gets a problem naming the extension and the owner while the rest of
  the batch applies.

`--check` compares the parsed table rather than the file's bytes, because Biome owns the
generated file's formatting and a check that reports a stale table every time a line wraps
differently is a check that gets disabled.

### A8 — Collaboration builder (P1)

`DiagramBuilder` cannot produce a collaboration at all — it hard-codes
`collaborations: []` (`bpmn-builder.ts:2532`, `:2687`) — even though the parser, the layout
engines and the canvas all handle collaborations. Add `.participant()`, `.message()` and
`.messageFlow()` with exact IDs, mirroring `CollaborationBuilder`'s shape.

Effort: ~3 days. Verify against the existing `collaboration-layout.test.ts` fixtures.

**As shipped.** `.participant()`, `.message()`, `.messageFlow()` and `.collaborationId()` on
`DiagramBuilder`, all taking ids verbatim. Two decisions the plan did not cover:

- **No participants means no collaboration element.** Emitting an empty
  `<bpmn:collaboration/>` looks harmless and is not: a modeler reads it as "this document is
  pooled" and renders every process pool-less.
- **`build()` validates and reports every problem at once**, rather than emitting a document
  that opens broken. The rule worth having is that a message flow must cross a pool boundary —
  one that starts and ends in the same pool is a sequence flow, and it is easy to write by
  accident.

`ProcessBuilder.build()`'s `collaborations: []` at `bpmn-builder.ts:2532` is correct and stays:
a single-process build has no collaboration.

**The round-trip assertion found an unrelated model bug.** `messageRef` was missing from the
parser's known-attribute list, so it was stored twice — in the typed `BpmnMessageFlow.messageRef`
*and* in `unknownAttributes`. Harmless on the wire, since the serialiser writes the typed field
after spreading the unknown bag, but it makes `unknownAttributes` untrue about what the SDK
models. Fixed, with one golden semantic hash moved (`02-collaboration.bpmn`, the only fixture
carrying a `messageRef`).

Eleven more attributes are stored the same way and are **not** fixed here: `activityRef`,
`cancelRemainingInstances`, `isInterrupting`, `itemSubjectRef`, `signalRef`,
`triggeredByEvent`, and the generic `height`, `value`, `width`, `x`, `y`. The generic five
cannot simply join the global known-attribute set — that set is not per-element, so adding `x`
would silently drop a non-spec `x` on a task, which is a real loss where this is only a
cosmetic one. Closing it properly means per-element known-attribute sets.

### A9 — Continue an existing model fluently (P1)

`ProcessBuilder.from(defs, processId).at(nodeId)` — resume fluent construction at a named
node of a parsed model, so extending a file does not mean regenerating it. Requires the
same explicitness `bpmn-sdk` enforces: both IDs named, the node must be a flow node
directly contained by that process, continuing from an end event is terminal.

Pairs with A5: "open, edit, write" becomes the default story for existing files, and
"generate from scratch" is reserved for new ones.

Effort: ~2 days.

**As shipped.** `ProcessBuilder.from(defs, processId)`, also reachable as
`Bpmn.continueProcess(...)`, plus `.at(nodeId)` and `.insertAfter(nodeId)`. `build()` returns
the source document with that process's contents replaced, so nothing else in it moves.

- **`at()` alone was not a shippable feature.** In a linear `start → task → end`, every node
  but the end event already has an outgoing flow, so a strict `at()` refuses on all of them.
  Splicing into an existing path is the common case and needs its own verb: `insertAfter()`
  moves the existing flow's *source* only, so the edge keeps its id and its target and stays
  the same edge in the diagram and in a diff.
- **Continue mode does not run `insertJoinGateways`.** It reads the whole topology, so on a
  parsed model it retargets edges the caller never touched. `06-events-and-containers.bpmn` is
  such a document: a no-op continue would have invented `Gateway_check_join` and rerouted two
  existing flows into it. A guard refuses any rewiring of a pre-existing flow as a backstop.
- **`isExecutable` is left alone unless `executable()` is called.** BPMN reads the absent
  attribute as false, so writing the builder's `true` default onto a process that never carried
  it makes a non-executable process executable. A no-op continue on
  `02-collaboration.bpmn`'s seller process did exactly that before this was fixed.

Both were found by the same assertion: continuing every process in every corpus fixture and
building without adding anything must produce an empty `diffSemantics`.

### A12 — Descriptor coverage check for the BPMN core model (P1)

A3 closes today's gaps; this is what stops tomorrow's. It is the one gap in §4 that no
other item covers: G7's catch-all *preserves* unmodelled content, but nothing tells us
when the model has fallen behind the spec.

`bpmn-sdk` solves this by generating its whole type surface from the descriptors. We
cannot — that would mean `bpmn-moddle` at runtime (§6). The adaptable half is the
**check**, not the generation:

- Vendor `bpmn.json` / `bpmndi.json` / `dc.json` / `di.json` alongside `zeebe.json` (all
  MIT, same attribution as A7).
- A build-time script walks the descriptors and emits a coverage report:
  every descriptor type and property, labelled `modelled` (a named field on our types),
  `preserved` (reaches `unknownChildren` / `unknownAttributes`) or `dropped`.
- **`dropped` must be empty.** A `--check` mode fails CI on any entry, so a descriptor bump
  that widens the spec surface breaks the build instead of silently widening the loss.
- Keep an explicit, reviewed ignore-list for the presentation prefixes we deliberately
  handle structurally (`bpmndi`, `dc`, `di`) — the same exclusions A2's projection uses,
  so the two cannot disagree.

This also retires the question "is our model still a faithful subset?" — currently
unanswerable without the manual audit that produced §4.

Effort: ~3 days. Sequenced after A3 and A7 share the descriptor-vendoring work.

**As shipped**, in three ways different from the above:

- The check **probes** rather than walks. A static comparison of descriptor names against
  our field names would pass while the parser silently dropped the thing — the same
  blindness §4 was written about. Instead it builds a minimal document containing each
  type, round-trips it through `Bpmn.parse` → `Bpmn.export`, and reads the answer off the
  output. It is a Vitest gate (`tests/descriptor-coverage.test.ts`) rather than a build
  script, so it runs on every PR with the rest of the suite;
  `pnpm --filter @bpmnkit/core check:descriptors` prints the report behind it.
- It is per **type**, not per type *and property*. 151 types: 109 modelled, 34 preserved,
  6 dropped, 2 unprobed.
- **`dropped` is not empty, and the six are probe artifacts rather than losses.** They are
  base types the descriptors do not mark abstract but which never appear as elements in a
  document — you write `dataInputAssociation`, never `dataAssociation` — so the probe has
  nowhere real to put them. Each is listed in `ACCEPTED_DROPS` with a reason, the list is
  checked in *both* directions (a new drop fails; an entry that stops dropping fails, so
  the accept-list cannot outlive its cause), and a second test proves the concrete form
  behind each one does survive. That evidence is what keeps the accept-list a finding
  rather than an assertion.

The probe found one genuine gap while being built: `bpmn:complexBehaviorDefinition` was
dropped from multi-instance loop characteristics. `unknownChildren` was extended to
`BpmnMultiInstanceLoopCharacteristics` and `BpmnDataAssociation` to close it.

### A10 — Publish gate that consumes the tarball (P2)

Extend `scripts/check-packages.mjs` (or add `scripts/check-package-consumable.mjs`) to,
for each published package: `npm pack`, install the tarball into a temp project, import it
from ESM, and type-check a strict `NodeNext` consumer. Twenty-two published packages makes
this slow — run it in the release workflow, not on every PR.

Effort: ~2 days.

**As shipped**, `scripts/check-package-consumable.mjs`, wired into the release workflow
between the build and the publish. Three things the plan did not anticipate:

- **`npm pack` is the wrong tool.** It leaves `workspace:*` in the packed manifest, which
  installs nowhere. `pnpm pack` rewrites it to the real version. The gate also fails a tarball
  whose manifest still carries a `workspace:` range, since that is the thing that silently
  breaks a publish.
- **A filtered run has to pack everything anyway.** The overrides that make a consumer resolve
  `@bpmnkit/*` to *this* build must cover the whole set; packing only the filtered packages
  leaves siblings resolving from the registry, so a filtered run quietly tests the last
  published version of half the tree. An early run failed with a 404 that looked like a broken
  package and was a broken harness.
- **The cheapest check is the one that finds most of it.** Before any install: does every path
  the manifest declares — `main`, `types`, `module`, `bin`, every `exports` target — actually
  exist in the tarball? That is offline, takes a second, and is exactly the G21 failure.

**Four real bugs on the first run**, all of which would have shipped:

1. `@bpmnkit/proxy` declared `exports["."].types` but its `files` listed only `dist/**/*.js`,
   so no `.d.ts` was ever packed.
2. `@bpmnkit/plugins` shipped `dist/token-highlight/index.js` with an extensionless
   `import … from "./css"`, which Node ESM cannot resolve — `@bpmnkit/plugins/token-highlight`
   threw on import, and `@bpmnkit/operate` with it.
3. `@bpmnkit/casen-worker-http` and `@bpmnkit/casen-worker-ai` import `@bpmnkit/cli-sdk` at
   runtime while declaring no dependencies at all; the install cannot pull it, so importing
   them fails.
4. `@bpmnkit/casen-report` has the same undeclared dependency in its `.d.ts`, plus an
   undeclared `@bpmnkit/api`, so its published types do not resolve.

**Left as a finding, not a change:** `@bpmnkit/cli-sdk` is published on npm at 0.0.9 but is not
in `PUBLISHED`, so it gets no LICENSE sync, no generated README, no metadata check, and is not
part of the changesets release. The packages above now depend on it as `workspace:*`, which
`pnpm pack` resolves to whatever the workspace version is — if that is ever bumped without a
publish, their tarballs will reference a version npm does not have. Adding it to the release
set changes what gets published, which is not a call to make from here.

`PUBLISHED` moved to `scripts/published-packages.mjs`, since a fourth copy of the list is
exactly the drift a publish gate exists to prevent.

### A11 — Agent-facing ergonomics (P2)

- **Script-size gate.** Add a size and wall-clock budget to the example scripts under
  `apps/examples`, the way `generator-examples.test.ts` does. It keeps the API concise
  enough for a model to emit correctly, and makes regressions in that property visible.
- **Explicitness opt-out.** `ProcessBuilder` infers joins via `insertJoinGateways()`.
  Document the contract, and add `{ explicitJoins: true }` for generated code that wants
  to declare its own.

**As shipped.**

- **The wall-clock half of the budget was not worth asserting as written.** Each example
  spends one to three milliseconds inside the SDK; the rest of its ~1.4s is `tsx` starting up.
  A budget on the script's wall clock would have been a flaky test of someone else's tool, and
  CLAUDE.md forbids timing-dependent tests outright. The examples are imported in-process and
  timed there, against a ceiling about 100x the real figure — enough to catch a change in the
  shape of the layout algorithm, not enough to fire on a slow machine.
- **The size half is a ratchet on two numbers, not one.** Lines alone can be lowered by
  deleting content, so each example is pinned to its non-comment line count *and* the element
  count of the model it builds. Both are checked for equality: a longer file fails as a
  regression, a shorter one fails as a budget that needs tightening. A global
  lines-per-element ceiling backs it up in case someone waves the per-file numbers through.
- **`{ explicitJoins: true }` already existed as `{ strict: true }`.** The behaviour was there;
  the name was the problem — it says nothing about what it is strict *about*, and
  `applyBpmnOperations` takes a `strict` that means something else entirely. `explicitJoins` is
  now the documented name and `strict` still works. The message changed too: it now names the
  gateways it would have inserted, which is the id you pass to `.connectTo()`.
- **The contract has a subtlety worth stating.** A declared join only satisfies the check if it
  *matches the split*: an exclusive split converging on a parallel gateway is still inferred.
  Documented and tested.

**Found while measuring:** every example script failed from a clean checkout. Only `run-all.ts`
created `output/`, so `pnpm --filter @bpmnkit/examples 02` crashed on the write. Each example
now creates its own output directory.

### Sequencing

```
A1 fidelity gate ──┬── A3 model gaps ──┬── A7 zeebe descriptor checks ─┬── A12 coverage check
                   │                   └── A6 docs correction          │   (shares vendored
                   │                                                   │    descriptors)
A2 semantic hash ──┴── A4 write boundary ── A5b/A5c operations re-target
                                              └── A9 continue-existing ── A8 collaboration builder
A5a CLI overwrite guard, A10 publish gate, A11 ergonomics — independent
```

A5a's CLI guard and A6's factual correction depend on nothing and should ship first: one
stops active data destruction, the other stops us telling users it cannot happen.

Total: roughly 26 working days across twelve items. None is dropped — §7.1 is the
completion criterion, and it is only satisfied when A1's allow-list is empty, A12's
`dropped` set is empty, and every row's "verified by" test exists and passes.

---

## 8. Open questions

1. **Sync or async `semanticHash`?** A sync in-repo SHA-256 keeps `write()` and the diff
   report simple; `crypto.subtle` avoids the code but forces `async` through every caller.
   Recommendation: sync, in-repo.
2. **Does `unknownChildren` (A3) change the public `BpmnDefinitions` shape enough to need a
   major bump?** It is additive, so no — but every consumer that constructs a
   `BpmnProcess` literal in a test will need the field, unless it is optional.
3. **Where does the Node-only write boundary live** — a `./node` subpath of
   `@bpmnkit/core`, or a new `@bpmnkit/io` package? The subpath is less ceremony; a
   separate package keeps the browser bundle unambiguous.
4. **Is `applyOperations()` strictness a breaking change we take now or at 0.2?** It is
   currently silent-failure-by-default, which is the worst option; the question is only
   how fast to flip it.
