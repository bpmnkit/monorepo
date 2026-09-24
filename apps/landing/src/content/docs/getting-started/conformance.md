---
title: Conformance
description: What BPMN Kit implements of BPMN 2.0, DMN 1.3, FEEL and Camunda Forms — measured where a measurement exists, and with the gaps listed.
sidebar:
  order: 5
---

This page says how much of each standard BPMN Kit implements, and how that was checked. Where
there is a public test suite the number comes from it. Where there is not, the page lists what
is supported and what is missing, and links to the test that enforces it. Everything below
describes the current `main` branch.

## FEEL — 94.4% of the DMN TCK

`@bpmnkit/feel` passes **1,939 of the 2,053 FEEL test cases** in the
[DMN Technology Compatibility Kit](https://dmn-tck.github.io/tck/).

- The cases are extracted from a checkout of the TCK by
  `packages/feel/tasks/extract-tck-tests.mjs` and run by `packages/feel/tests/tck.test.ts`.
- The [DMN TCK workflow](https://github.com/bpmnkit/monorepo/actions/workflows/dmn-tck.yml)
  runs them against the latest TCK every Monday.
- The 114 cases that do not pass are listed in `KNOWN_FAILURES` in that test file, each with
  its reason. The run fails if a listed case starts passing, so the list cannot go stale.

The TCK's own [results table](https://dmn-tck.github.io/tck/) scores whole DMN engines across
every test, not only the FEEL cases. The figure above is not directly comparable with it, and
BPMN Kit has not submitted results.

## BPMN 2.0 — model and round trip

`@bpmnkit/core` parses and writes BPMN 2.0 XML. Coverage is measured against the BPMN, BPMN DI
and Zeebe moddle descriptors vendored into the repository, which list every type the
standard and Camunda 8 define (151 in total):

| Status | Types | Meaning |
|---|---|---|
| Modelled | 109 | Parsed into typed objects and written back |
| Preserved | 34 | Not modelled, but kept verbatim on round trip |
| Dropped | 6 | Lost on round trip — see below |
| Unprobed | 2 | Not reachable from `bpmn:definitions` |

The dropped types are the data-association internals (`Assignment`, `DataAssociation`,
`FormalExpression` inside one, `DataState`, `ItemAwareElement`) and `ImplicitThrowEvent`. The
`packages/core/tests/descriptor-coverage.test.ts` gate fails the build if a new type would be
dropped silently; `pnpm --filter @bpmnkit/core check:descriptors` prints the full report.

[Round-trip fidelity](/docs/getting-started/concepts#round-trip-fidelity) lists the
deliberate normalisations and the children that are still not preserved.

## BPMN Model Interchange (MIWG)

The [OMG BPMN Model Interchange Working Group test suite](https://github.com/bpmn-miwg/bpmn-miwg-test-suite)
is how BPMN tools show they can read and write each other's files. Its reference models
cover layout (`A.*`), the descriptive and analytic conformance classes (`B.*`) and complex
real-world scenarios (`C.*`). They were exported by Trisotech, Signavio, W4, BOC, itp commerce
and others, so they carry each vendor's namespaces, label styles and optional attributes.

All 22 reference models are part of the round-trip corpus (suite commit `2ff82d4`,
2026-09-21) and are checked on every build:

| Check | Result |
|---|---|
| Import (parse) | 22 / 22 |
| Export re-imports to the same model | 22 / 22 |
| Export is a fixed point (a second round trip changes nothing) | 22 / 22 |
| Semantic content preserved | 22 / 22, apart from attributes on `<documentation>` (2 models) |
| Diagram interchange preserved (bounds, waypoints, label styles, vendor DI attributes) | 22 / 22 |
| `exportPreserving` of an unchanged model is byte-identical | 22 / 22 |

What a plain export changes is listed per model in `ALLOWED` in
`packages/core/tests/roundtrip-corpus.test.ts`:
- `false` defaults such as `isForCompensation="false"` are not written back;
- an empty `<extensionElements/>` is not written back;
- the `id` and `textFormat` attributes of `<documentation>` are lost.

That last one is the only loss of content. The comparison is keyed by namespace, so
`<process>`, `<semantic:process>` and `<bpmn:process>` count as the same element.

Running the suite found seven models BPMN Kit could not open and several losses, all fixed
before these results were recorded:
- DI elements without the optional `id` or `bpmnElement` would not parse;
- a document with BPMN as its default namespace was written back as invalid XML;
- a default flow on an activity was dropped;
- so were documentation on sequence flows, the name of `<definitions>` and of a
  collaboration, and empty timer and condition expressions;
- extensions on data associations and label styles were lost.

The results are BPMN Kit's own run of the suite's models, not a submission to the MIWG, which
publishes vendor-submitted results separately.

## BPMN elements by component

| Elements | Model | Renderer (`canvas`) | Editor palette | TS simulator (`engine`) |
|---|---|---|---|---|
| Service, user, script, business rule tasks | ✓ | ✓ | ✓ | Executed |
| Send, receive, manual and plain tasks | ✓ | ✓ | ✓ | Pass through |
| Exclusive, parallel, inclusive gateways | ✓ | ✓ | ✓ | Executed |
| Event-based, complex gateways | ✓ | ✓ | ✓ | Completed without semantics |
| Embedded sub-process, transaction | ✓ | ✓ | ✓ | Executed (child scope) |
| Event sub-process, ad-hoc sub-process, call activity | ✓ | ✓ | ✓ | Completed without semantics |
| Start / end: none, terminate, error | ✓ | ✓ | ✓ | Executed |
| Timer and message catch events | ✓ | ✓ | ✓ | Executed |
| Timer (interrupting) and error boundary events | ✓ | ✓ | ✓ | Executed |
| Signal, escalation, compensation, conditional, link events | ✓ | ✓ | ✓ | Not modelled |
| Message and non-interrupting boundary events | ✓ | ✓ | ✓ | Not modelled |
| Multi-instance and loop markers | ✓ | ✓ | Properties panel | Not modelled |
| Data objects, data stores, associations | ✓ | ✓ | — | — |
| Groups, text annotations | ✓ | ✓ | ✓ | — |
| Pools, lanes, message flows | ✓ | ✓ | ✓ | — |
| Choreography and conversation diagrams | — | — | — | — |

The TypeScript simulator is for tests, demos and step-through debugging. For Zeebe semantics,
`@bpmnkit/engine/wasm-runner` runs the same scenarios on **Reebe** compiled to WebAssembly.
Reebe's model covers the task types, call activities, embedded and event sub-processes,
exclusive, parallel, inclusive and event-based gateways, catch, throw and boundary events
(timer, message, signal, error, escalation, compensation, link, terminate) and
multi-instance. It has no complex gateway and no ad-hoc sub-process. Reebe is experimental,
and its behaviour is checked by its own tests rather than against Zeebe.

## Zeebe extensions

Every `zeebe:` element in the vendored Zeebe descriptor is modelled or preserved, and 26 of
them are checked for placement — which BPMN element each may appear on — by
`packages/core/src/bpmn/zeebe-placement.ts`. That includes task definitions, IO mappings,
task headers, called decisions and elements, forms, user tasks, scripts, linked resources,
ad-hoc sub-process and AI agent settings, version tags, and execution and task listeners.

[Element templates](/docs/packages/connectors) (Camunda's connector template JSON) are applied
for outbound connectors. Inbound connector and linked-resource bindings are not applied yet.

Camunda 7 (`camunda:` extensions) is not supported: those attributes and elements are kept on
round trip but not modelled.

## DMN 1.3

- Decision tables with all seven hit policies (`UNIQUE`, `FIRST`, `ANY`, `COLLECT`,
  `RULE ORDER`, `OUTPUT ORDER`, `PRIORITY`) and the `COLLECT` aggregations (`SUM`, `MIN`,
  `MAX`, `COUNT`).
- Decision requirements graphs: input data, business knowledge models, knowledge sources, and
  information, knowledge and authority requirements, with DMNDI layout.
- Input and output `typeRef` is limited to `string`, `boolean`, `number` and `date`.
- Not modelled: literal-expression decisions and the boxed expressions of DMN 1.3
  (context, relation, list, invocation, function definition).

## Camunda Forms

Camunda form JSON at schema version 16, with 22 component types: text, text field, text area,
number, date/time, select, radio, checkbox, checklist, tag list, group, dynamic list, table,
image, document preview, iframe, HTML, expression, file picker, button, separator and spacer.

## Known gaps, in one list

- Attributes on `<documentation>` (`id`, `textFormat`) are not preserved
- Choreography and conversation diagrams
- Camunda 7 extensions (preserved, not modelled)
- Inbound connector templates
- DMN boxed expressions and literal-expression decisions
- TS simulator: call activities, event sub-processes, event-based and complex gateways,
  signal / escalation / compensation / conditional / link events, multi-instance,
  message and non-interrupting boundary events
- Reebe: complex gateway, ad-hoc sub-process, single-node only, no published comparison with
  Zeebe

Found something this page gets wrong? [Open an issue](https://github.com/bpmnkit/monorepo/issues).
