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
> directly, with provenance recorded, not lifted from that repository.

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

Priorities: **P0** = silent data loss users cannot detect; **P1** = closes a real
capability gap; **P2** = worth doing when the area is next touched.

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

- Vendor `zeebe.json` (Apache-2.0, from `zeebe-bpmn-moddle`) into `packages/core` and
  generate a build-time table of `{ type → { validOwners, properties } }`.
- `zeebe-extensions.ts` gains `ensureExtension(owner, type)` which rejects a placement the
  descriptor does not allow — `zeebe:formDefinition` only on a user task,
  `zeebe:subscription` only on a message, and so on.
- A generation script plus a `--check` mode in CI, so a descriptor bump that changes the
  surface fails the build instead of drifting (this is `bpmn-sdk`'s `check:types` pattern).

Effort: ~3 days. Naturally sequenced after A3.

### A8 — Collaboration builder (P1)

`DiagramBuilder` cannot produce a collaboration at all — it hard-codes
`collaborations: []` (`bpmn-builder.ts:2532`, `:2687`) — even though the parser, the layout
engines and the canvas all handle collaborations. Add `.participant()`, `.message()` and
`.messageFlow()` with exact IDs, mirroring `CollaborationBuilder`'s shape.

Effort: ~3 days. Verify against the existing `collaboration-layout.test.ts` fixtures.

### A9 — Continue an existing model fluently (P1)

`ProcessBuilder.from(defs, processId).at(nodeId)` — resume fluent construction at a named
node of a parsed model, so extending a file does not mean regenerating it. Requires the
same explicitness `bpmn-sdk` enforces: both IDs named, the node must be a flow node
directly contained by that process, continuing from an end event is terminal.

Pairs with A5: "open, edit, write" becomes the default story for existing files, and
"generate from scratch" is reserved for new ones.

Effort: ~2 days.

### A10 — Publish gate that consumes the tarball (P2)

Extend `scripts/check-packages.mjs` (or add `scripts/check-package-consumable.mjs`) to,
for each published package: `npm pack`, install the tarball into a temp project, import it
from ESM, and type-check a strict `NodeNext` consumer. Twenty-two published packages makes
this slow — run it in the release workflow, not on every PR.

Effort: ~2 days.

### A11 — Agent-facing ergonomics (P2)

- **Script-size gate.** Add a size and wall-clock budget to the example scripts under
  `apps/examples`, the way `generator-examples.test.ts` does. It keeps the API concise
  enough for a model to emit correctly, and makes regressions in that property visible.
- **Explicitness opt-out.** `ProcessBuilder` infers joins via `insertJoinGateways()`.
  Document the contract, and add `{ explicitJoins: true }` for generated code that wants
  to declare its own.

### Sequencing

```
A1 fidelity gate ──┬── A3 model gaps ──┬── A7 descriptor-checked extensions
                   │                   └── A6 docs correction (after A3 lands)
A2 semantic hash ──┴── A4 write boundary ── A5 CLI/MCP re-target
                                              └── A9 continue-existing ── A8 collaboration builder
A10, A11 independent
```

A5's CLI guard and A6's factual correction do not depend on anything and should ship first.

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
