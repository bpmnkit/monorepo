# `bpmn-auto-layout` 2.0.0-alpha.2 — evaluation for bpmnkit

_2026-08-20 · evaluated against `packages/core/src/layout` (the grid engine behind `applyAutoLayout`)_

## Verdict

The upstream rewrite is real and it is better than our engine on every layout-quality
measurement we can make. It fixes two things our engine gets **wrong**, not merely
suboptimal: lane membership and black-box pools.

Its `Promise` is **not** a real asynchrony barrier — the layout is synchronous inside and
can be driven synchronously (verified below), so adopting it does not force our public API
to go async. What it does cost is a patched dependency chain, 45 KB gzipped in the browser,
and a latency tail on collaborations (median 36 ms, worst case ~1–1.9 s) against our
engine's 0.3 ms.

Recommendation: **do not swap the engine wholesale today.** Adopt it behind a flag where
the latency tail is harmless — the CLI, the proxy, `compilePlan`/`mergePlan` — keep the
grid engine as the default for canvas/editor, and re-evaluate when 2.0 goes stable.
Independently, fix the three correctness gaps the benchmark exposed in our own engine —
they are ours to fix regardless of what we do about the dependency.

## What changed upstream

`1.3.0` (2026-03-11) → `2.0.0-alpha.0/1/2` (2026-07-22 … 07-24). It is a rewrite, not an
increment:

- **The grid layouter is gone.** 2.0 is a "semantic BPMN layout" — a constrained layered
  algorithm with ranks for left-to-right progress, *semantic bands* for vertical narrative
  role (happy path in the middle, exception paths below), recursive container layout, and
  a separate orthogonal routing pass. Documented as a layout contract in
  [`docs/LAYOUT.md`](https://github.com/bpmn-io/bpmn-auto-layout/blob/main/docs/LAYOUT.md).
  Layout is deterministic: declaration order breaks ties, so the same input is byte-identical
  on every run.
- **Collaboration support.** Pools (including empty/black-box ones), message flows, groups,
  artifacts, data associations.
- **Diagnostics.** `layoutProcess` now resolves `{ xml, warnings }` (breaking) with
  `LayoutWarning { name, code, elementId, relatedElementIds }` — observed codes
  `GROUP_MEMBERS_NOT_FOUND`, `DI_NOT_CREATED` — and rejects unlayoutable input with a
  coded `LayoutError` instead of emitting misleading geometry.
- **Source is TypeScript now** (~15k LOC), 161 fixtures, snapshot + metrics-baseline tests.
- **A CLI**: `npx bpmn-auto-layout diagram.bpmn [--output … | --stdout]`.
- **Node ≥ 22** on `main` (the published alpha.2 still declares `engines: node >= 18`,
  but the README already says 22.12 — the `package.json` field is stale).

Still a **pre-release**: `dist-tags.latest` is `1.3.0`, `next` is the alpha. Only three
exports — `layoutProcess`, `LayoutError`, `LayoutWarning`.

## How it compares to our engine — measured

Corpus: upstream's 161 test fixtures (Camunda blueprints, 8-tutorials,
consulting diagrams, plus synthetic per-feature cases). 158 ship the **original**
hand/tool-made DI, which serves as the reference layout. Both engines were run on the
same input; results were parsed back with `Bpmn.parse` and compared with our own
`compareLayouts` / `checkDiCompleteness`. Scripts are not committed — they live in the
session scratchpad; the numbers below are reproducible from the fixture set.

| | bpmnkit grid engine | `2.0.0-alpha.2` |
|---|---|---|
| Failures / throws | 0 / 161 | 0 / 161 |
| Avg deviation from reference DI | 348 px | **227 px** |
| Closer to the reference layout | 39 fixtures | **122 fixtures** |
| Flow-direction violations | 9 | **7** |
| Incomplete DI (missing shapes/edges) | **240** | 6 |
| Elements outside their assigned lane | **43 / 257** | **0 / 257** |
| Sub-process planes dropped | **43** (23 fixtures) | 0 |
| Edges routed through unrelated shapes | 68 | **13** |
| Edge crossings | 275 | **200** |
| Median / p90 / max runtime | **0.3 / 0.7 / 3.2 ms** | 7 / 78 / **1947 ms** |

Three of those rows are correctness bugs in *our* engine, and they are the interesting
result of this evaluation:

1. **Lanes are ignored.** `packages/core/src/layout/` contains no lane logic at all — the
   grid engine lays the process out as if lanes did not exist, and `auto-layout.ts` then
   tiles lane bands proportionally over the result. 17 % of lane-assigned elements end up
   in the wrong lane. On `lane.skipping-lanes.bpmn` we render one straight row through
   three lanes; upstream places each task in its own lane and routes vertically between
   them.
2. **Black-box pools get no DI.** `applyAutoLayout` skips participants whose `processRef`
   is missing or empty, and their message flows with them — 238 of our 240 missing DI
   entries, across 19 fixtures. Those pools silently disappear from the diagram.
3. **Sub-process planes are flattened.** We always emit exactly one `BPMNDiagram`, so a
   file with collapsed sub-process planes loses them (43 planes over 23 fixtures) and its
   contents get squashed into the root plane's coordinate space. Note the canvas already
   *supports* multi-plane drilldown (`doc/render-gap-analysis.md`, P0-1) — auto-layout is
   what destroys it.

The remaining 6 "incomplete DI" entries on the upstream side are not defects: 3 are
non-visual `bpmn:DataObject` elements that our completeness checker counts but which never
carry DI, and 3 belong to a second, unrelated plane in inputs that declare two — upstream
lays out the selected root only.

Caveats on these numbers: the corpus is upstream's own, chosen to cover what upstream
handles, so it is not neutral ground. "Deviation from reference DI" measures similarity to
the original human layout, which is a proxy for quality, not quality itself. The
overlap/crossing counts only cover DI each engine actually emitted, which flatters us —
shapes we never place cannot be overlapped.

## Integration assessment

### What works out of the box

- **Our XML is accepted.** `Bpmn.export()` output from all four repo samples
  (`bpmn-samples/*`, `apps/landing/diagram.bpmn`, the eval-generation base) laid out with
  zero warnings and complete DI.
- **Its XML is accepted by us.** `Bpmn.parse` round-trips all 161 outputs.
- **Extensions survive.** Round-tripping 161 fixtures through `bpmn-moddle` dropped no
  `zeebe:` or `camunda:` element or attribute. The only losses are the `bioc:`/`color:`
  namespace declarations, which exist solely for the DI that layout regenerates anyway.
- **Same replace-everything semantics** as `applyAutoLayout`: existing coordinates are
  discarded, so the editor's "Auto-layout" command and the canvas' `layoutMissingDi: "all"`
  path would behave as they do today.
- MIT, same license posture as ours.

### What blocks a drop-in swap

- **XML-only API, and sync only via patches.** `layoutProcess(xml): Promise<{ xml, warnings }>`
  is the entire surface — no model entry point, so every layout costs a
  model → XML → moddle → XML → model round-trip (~34 ms on our largest fixture, negligible
  next to the layout itself). A synchronous entry point requires patching three packages
  (see below); without those patches, adopting it in `@bpmnkit/core` means making
  `Bpmn.autoLayout()`, `builder.build()`, `compilePlan()` and `mergePlan()` async — a
  breaking change for consumers.
- **Latency tail on collaborations.** Median 7 ms for single-process diagrams (p90 41 ms),
  but 36 ms median / 211 ms p90 for collaborations, and 1–1.9 s on
  `process.application-processing.bpmn` (91 elements, 8 pools) where our engine takes
  2.2 ms. The driver is pool count, not element count — an 11-element collaboration costs
  211 ms while comparable single-process diagrams cost 5–12 ms. Going synchronous does not
  help here; it turns a 1-second `await` into a 1-second main-thread freeze, which is why
  upstream's README recommends a worker.
- **Browser weight.** 153 KB minified / 45 KB gzipped bundled with its `bpmn-moddle` +
  `min-dash` deps. `@bpmnkit/core` today has zero runtime dependencies and
  `@bpmnkit/canvas`/`editor` inherit that; "zero runtime dependencies" is listed in
  `doc/render-gap-analysis.md` as a position we hold *against* bpmn.io.
- **No type declarations.** The published `files` are `bin` + `dist`, and `dist` has no
  `.d.ts` — we would hand-write an ambient declaration to keep strict mode clean.
- **Pre-release.** `next`-tagged alpha, three weeks old, with a breaking API change already
  in it and a Node-22 bump queued in `Unreleased`.
- **Its extra output partly outruns our renderer.** It emits DI for data objects, data
  stores and groups; per `doc/render-gap-analysis.md` those elements do not exist in our
  model or renderer yet, so that DI would parse but not draw.

### Can it run synchronously? Yes — with patches

The `Promise` is decorative. `layoutProcess` awaits exactly two things, `moddle.fromXML`
and `moddle.toXML`; everything between them (`layoutCollaboration` / `layoutProcessScope` /
`generateDiagrams`) is synchronous. And both moddle calls are themselves synchronous work
wrapped in a promise: `Writer.toXML` returns a string directly, and `moddle-xml`'s reader
runs `parser.parse(xml)` inside the `new Promise` executor — saxen is a synchronous SAX
parser, so the executor settles before it returns. The comment in `moddle-xml` claiming
"async XML parsing to keep the execution environment responsive" does not describe what the
code does; nothing ever yields.

Verified by building it. Patching three packages — `moddle-xml` (record the outcome the
executor already produces synchronously), `bpmn-moddle` (`fromXMLSync`/`toXMLSync`), and
`bpmn-auto-layout`'s bundle (a `layoutProcessSync` twin of the method, with the two `await`s
removed) — yields a fully synchronous entry point that:

- produces **byte-identical XML and identical warnings on all 161 fixtures**;
- completes without a microtask turn (a `queueMicrotask` scheduled just before the call has
  not run when it returns);
- runs at the same speed (972 ms vs 981 ms; 110 ms vs 113 ms; 3 ms vs 3 ms) — the promise
  wrapper costs nothing, confirming there was no real async work to begin with.

So the async signature is not a technical blocker for our sync API. The cost is
maintenance: three patches via `pnpm patch` (we already carry one, for
`@preact/signals-react`), one of them against a *generated rollup bundle* of a pre-release
that is still being rewritten — every alpha bump means re-applying it against regenerated
output. The cleaner version of this is upstream exposing a sync entry point; bpmn.io
maintains `bpmn-moddle` and `moddle-xml` too, so a `fromXMLSync` + `layoutProcessSync` is
theirs to add if asked.

## Options

1. **Adopt in non-interactive paths, behind a flag.** CLI, proxy and
   `compilePlan`/`mergePlan` can absorb both the latency tail and (if we skip the patches)
   an async signature. Keeps the grid engine as the default for canvas/editor. Smallest
   blast radius, gets the better layout where the diagrams are generated — which is where
   our layout quality actually matters most.
2. **Fix our engine using the benchmark as the target.** Lanes, black-box pools and
   multi-plane output are our three known-wrong behaviours; the harness in this evaluation
   gives a pass/fail signal for each. No new dependency, no patches, and it closes the
   correctness gap even if we never adopt upstream.
3. **Full swap once 2.0 is stable.** Needs either the sync patches or an async migration
   through the public API, a worker (or a size threshold that falls back to the grid engine)
   for the canvas' latency tail, and accepting the dependency + bundle cost. Defensible
   later, premature against an alpha.
4. **Do nothing and re-check at 2.0 final.**

1 and 2 are complementary and are what we would suggest doing; 3 stays open.

## Outcome (2026-08-20)

We took a variant of options 1 and 2: **implement their process-layout approach in our own
code**, no dependency and no vendored source. `packages/core/src/layout/semantic/` (~900
lines) follows the layout contract above — ranks, spine selection, semantic bands, lane
membership as a placement constraint, obstacle-aware orthogonal routing — against our own
AST, synchronously. `layoutProcess(process, engine)` defaults to it; the grid walk stays
behind `"grid"` and still serves `layoutFlowNodes()`.

Two things from the plan did **not** change, deliberately: collaboration assembly (pool
stacking and message flows) is still ours, so we never take on the pipeline that costs
upstream its latency tail; and the sync-patch route was not needed, since none of this is
a dependency any more.

Measured on the same corpus, ours before → ours after (upstream for reference):

| | grid walk | semantic engine | `2.0.0-alpha.2` |
|---|---|---|---|
| Missing DI (shapes/edges) | 240 | **0** | 6 |
| Sub-process planes dropped | 43 | **0** | 0 |
| Elements outside their assigned lane | 43 / 257 | **0 / 257** | 0 / 257 |
| Flow-direction violations | 9 | **7** | 7 |
| Deviation from the original DI | 348 px | 262 px | **227 px** |
| Shape overlaps | 124 | 89 | **80** |
| Diagram area (Mpx) | 150 | **133** | 140 |
| Edges through unrelated shapes | 68 † | 35 | **13** |
| Edge crossings | 275 † | 234 | **200** |
| Edge bends | **650** † | 768 | 708 |
| Total edge length | **398k** † | 435k | 429k |
| Mean runtime | **0.4 ms** | 1.0 ms | 38 ms |

† Not comparable: the grid walk emitted no DI for black-box pools, so the message
flows docking onto them were never drawn and could not cross anything. The
semantic column draws the same connections upstream does.

The correctness gap on lanes is closed, DI is complete, and the output reads as BPMN — spine
through the middle, exceptions below, escalations above, skip edges nesting as arcs over the
flow.

Routing and placement have each had a pass since. Routing: message-flow legs may jog around
a blocking shape, candidates are scored by how many routed edges they would cross, and
detours are no longer penalised into never being chosen (crossings 493 → 425, routes through
shapes 78 → 49). Placement: the three rank and band refinements from the contract above were
each implemented and measured — nested joins sharing a rank occurs 6 times in the corpus,
handler-span reservation is metric-neutral, and band compaction had nothing to gain, since
bands already span at most 4 levels. The gains came instead from two gaps those measurements
exposed: nodes no traversal reaches were being dropped onto the spine, and annotation
placement never checked whether its own association line was clear (crossings 425 → 394).

The collaboration pipeline has since been ported in part — pool ordering by message-flow
relationships, and horizontal alignment of each process so its messages run straight down.
That took message flows crossing each other from 67 to 11, crossings overall from 394 to
283, and total edge length to within 1.5 % of upstream's, while keeping our own pool
stacking and the 1 ms runtime.

What is left is narrower than "collaborations", and the obvious explanation for it turned
out to be wrong. 106 of our 116 remaining message-vs-sequence crossings are vertical stems
crossing sequence flows *inside* a pool; upstream has 51 of exactly that kind. That is not
because our routing leaves more traffic in the way — our horizontal sequence-flow segments
(1854, 267k px, 143 px mean) are within 1 % of upstream's on every measure, and stem length
and pool height match too.

The real difference is the balance point. Upstream accepts **more** message-to-message
crossings than we do — 21 against our 11 — in exchange for message-to-sequence at 54 against
our 118. Three attempts at bending stems around the runs in our way (crossing-scored
candidates, stepping to a clear column, and the same with the bends spread apart) each moved
crossings from one class into another without netting out ahead, and were reverted.

Sequence-flow crossings have since been worked separately, and there the categories pointed
somewhere useful: flows converging on one join cross about as often in both engines, but
pairs of *unrelated* edges crossed twice as often in ours, which is band assignment rather
than routing. Reserving each branch's band out to its rejoin, and letting neighbouring bands
trade places when that untangles the edges running past them, took sequence × sequence from
146 to 120 against upstream's 118.

Loops were then found to account for the rest of the sequence-flow gap: band ordering had no
headroom left (the estimator counts 6 crossings across all 179 processes, an exhaustive
search finds 2), while 22 of 46 remaining unrelated-edge crossings involved a backward loop
against upstream's 5. Letting a loop take whichever side of the flow is clearer took
sequence × sequence to **101, below upstream's 118**.

Remaining gap by category, ours / upstream: sequence × sequence **101 / 118**, message ×
sequence 112 / 54, message × message 11 / 21, associations 10 / 1, routes through shapes
37 / 13. We are now ahead on sequence flows and on message-to-message; the
message-to-sequence column is the whole remaining difference, and the measurements above
say it is a balance point upstream chooses rather than a defect in ours.

The other two gaps this evaluation found are closed too, in DI emission rather than in the
engine: participants are walked in declaration order so a black-box pool keeps its band and
its message flows, and collapsed sub-processes keep their own `BPMNDiagram` for drilldown.
Auto-layout now emits DI for every element, connection and plane in the corpus — six fewer
omissions than upstream, which leaves the non-visual `bpmn:DataObject` and unrelated input
planes alone by design.
