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

## FEEL — 94.5% of the DMN TCK, 375 of 378 Camunda examples

`@bpmnkit/feel` passes **1,941 of the 2,053 FEEL test cases** in the
[DMN Technology Compatibility Kit](https://dmn-tck.github.io/tck/).

- The cases are extracted from a checkout of the TCK by
  `packages/feel/tasks/extract-tck-tests.mjs` and run by `packages/feel/tests/tck.test.ts`.
- The [DMN TCK workflow](https://github.com/bpmnkit/monorepo/actions/workflows/dmn-tck.yml)
  runs them against the latest TCK every Monday.
- The 112 cases that do not pass are listed in `KNOWN_FAILURES` in that test file, each with
  its reason. The run fails if a listed case starts passing, so the list cannot go stale.

The TCK's own [results table](https://dmn-tck.github.io/tck/) scores whole DMN engines across
every test, not only the FEEL cases. The figure above is not directly comparable with it, and
BPMN Kit has not submitted results.

**Camunda 8.** Zeebe evaluates FEEL with Camunda's own engine, which adds built-ins and
behaviour DMN does not define (`assert`, `partition`, `context put` with a key path, `to json`,
`fromAi`, …). There is no test suite for that dialect, so the measure is Camunda's
documentation: `@bpmnkit/feel` matches **375 of the 378 worked examples** in the FEEL pages of
the Camunda 8 docs.

- `packages/feel/tests/camunda-parity.test.ts` reads the examples from
  `@bpmnkit/camunda-docspack` at test time, evaluates each one, and compares the result with
  the documented one. It runs with the package's normal tests.
- Examples that cannot run standalone — signatures, results written in prose, anything that
  reads the clock — are skipped. `node packages/feel/tasks/extract-camunda-examples.mjs
  --skipped` lists each one with its reason.
- The three that differ are in `KNOWN_DIFFERENCES` in that file, and on the
  [FEEL page](/docs/packages/feel#camunda-parity): `round up` without a scale (twice), and
  moving a date and time without a zone into another zone.
- Camunda fails an evaluation that errors. This package returns `null`, as DMN specifies.

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
| Semantic content preserved | 22 / 22 |
| Diagram interchange preserved (bounds, waypoints, label styles, vendor DI attributes) | 22 / 22 |
| `exportPreserving` of an unchanged model is byte-identical | 22 / 22 |

What a plain export changes is listed per model in `ALLOWED` in
`packages/core/tests/roundtrip-corpus.test.ts`:
- `false` defaults such as `isForCompensation="false"` are not written back;
- an empty `<extensionElements/>` is not written back.

Neither loses content. The comparison is keyed by namespace, so
`<process>`, `<semantic:process>` and `<bpmn:process>` count as the same element.

Running the suite found seven models BPMN Kit could not open and several losses, all fixed
before these results were recorded:
- DI elements without the optional `id` or `bpmnElement` would not parse;
- a document with BPMN as its default namespace was written back as invalid XML;
- a default flow on an activity was dropped;
- so were documentation on sequence flows, the name of `<definitions>` and of a
  collaboration, and empty timer and condition expressions;
- extensions on data associations and label styles were lost;
- so were the `id` and `textFormat` attributes of `<documentation>`.

The results are BPMN Kit's own run of the suite's models, not a submission to the MIWG, which
publishes vendor-submitted results separately.

## BPMN elements by component

| Elements | Model | Renderer (`canvas`) | Editor palette | TS simulator (`engine`) |
|---|---|---|---|---|
| Service, user, script, business rule tasks | ✓ | ✓ | ✓ | Executed |
| Send, receive, manual and plain tasks | ✓ | ✓ | ✓ | Pass through |
| Exclusive, parallel, inclusive gateways | ✓ | ✓ | ✓ | Executed; inclusive joins do not wait |
| Event-based, complex gateways | ✓ | ✓ | ✓ | Event-based executed; complex splits like inclusive, without its activation condition |
| Embedded sub-process, transaction | ✓ | ✓ | ✓ | Executed (child scope); no transaction cancel events |
| Event sub-process, ad-hoc sub-process, call activity | ✓ | ✓ | ✓ | Event sub-process executed; call activity executed when the called process is deployed in the same engine; ad-hoc sub-process with a job worker executed (job results activate its tools), without one it passes through |
| Start / end: none, terminate, error | ✓ | ✓ | ✓ | Executed |
| Timer and message catch events | ✓ | ✓ | ✓ | Executed |
| Timer (interrupting) and error boundary events | ✓ | ✓ | ✓ | Executed, including errors thrown by job workers |
| Signal, escalation, compensation, conditional, link events | ✓ | ✓ | ✓ | Executed, except conditional events (not evaluated) |
| Message and non-interrupting boundary events | ✓ | ✓ | ✓ | Executed (timer, message, signal, escalation) |
| Multi-instance and loop markers | ✓ | ✓ | Properties panel | Multi-instance executed |
| Data objects, data stores, associations | ✓ | ✓ | — | — |
| Groups, text annotations | ✓ | ✓ | ✓ | — |
| Pools, lanes, message flows | ✓ | ✓ | ✓ | — |
| Choreography and conversation diagrams | — | — | — | — |

The TypeScript simulator is for tests, demos and step-through debugging. It follows Zeebe's
rules where it implements an element — error and escalation propagation through scopes and
call activities, variable propagation and mappings, multi-instance variables and completion
conditions — and `packages/engine/tests/semantics.test.ts` checks each one. It is not checked
against Zeebe itself, and it differs in the places the table notes: a call activity can only
call a process deployed in the same `Engine`, and it runs compensation handlers one at a time
in reverse order, as BPMN specifies, where Zeebe starts them all at once. For Zeebe semantics,
`@bpmnkit/engine/wasm-runner` runs the same scenarios on **Reebe** compiled to WebAssembly.
Reebe's model covers the task types, call activities, embedded and event sub-processes,
exclusive, parallel, inclusive and event-based gateways, catch, throw and boundary events
(timer, message, signal, error, escalation, terminate, link, compensation) and
multi-instance. Errors and escalations, from end events, throw events and job workers,
propagate out through sub-processes and call activities to a boundary event or an event
sub-process, which receives the variables a job worker threw the error with. An uncaught
error raises an incident. An exclusive gateway with no matching condition and no default
flow raises an incident, as does an inclusive split, and resolving it evaluates the gateway
again; resolving any incident raised while an element was activating retries that element
instance. A gateway condition that does not evaluate to a boolean (a missing variable is
`null`) raises an `EXTRACT_VALUE_ERROR` incident instead of counting as false, and resolving
it evaluates the gateway again. Parallel gateways, and every element other than an exclusive
or inclusive gateway, ignore conditions on their outgoing flows, as Zeebe does. A link throw
event continues at the link catch event of its name in the same scope, and deployment rejects
links that do not pair up. A compensation throw or end event starts, all at once, the
handlers of the activities that completed in its scope and in the completed sub-processes
inside it (or only `activityRef`), and waits for them; a throw event in an event
sub-process compensates the event sub-process and the scope around it. Every handler runs in
the throw event's scope, as in Zeebe, and, as in Zeebe, only a handler that completes releases
the throw event: one terminated on its own leaves it waiting. Timer, message and signal boundary events are armed when their activity starts and cancelled when it ends. An interrupting one
terminates the activity; a non-interrupting one leaves it running, and a timer cycle repeats.
An event-based gateway waits for the first of its events and cancels the others.
The timer, message and signal start events of event sub-processes are armed when their
process or sub-process starts and disarmed when it ends. An interrupting event sub-process
terminates the rest of its scope and triggers once; a non-interrupting one runs alongside,
as often as its event occurs. An inclusive gateway takes every flow whose condition holds,
or its default flow, and its join waits until no token in the scope can still reach an
incoming flow that has none. A token waiting at a parallel or inclusive join keeps its
scope active, as in Zeebe, even if the join can never fire.
Deploying a process schedules its timer start events (a date, a repeating interval or a cron
expression) and subscribes its message start events; a timer firing or a matching message
creates an instance, at most one active instance per message correlation key, and a new version
replaces the previous version's timers and subscriptions. A sub-process or process instance
completes only when nothing inside it is active any more, and a terminate end event ends the
rest of its own scope and completes that scope.
Multi-instance runs, in parallel or in sequence, on every task type, sub-process and call
activity. Each instance has its own `inputElement` and `loopCounter`, the output is collected
in input order, and a `completionCondition` ends the loop early. A multi-instance or ad-hoc
`completionCondition` that does not evaluate to a boolean raises an `EXTRACT_VALUE_ERROR`
incident, with Zeebe's message, on the instance that was completing (for an ad-hoc
sub-process, the activation or the event sub-process inside it that was completing);
resolving it evaluates the condition again. An ad-hoc `completionCondition` is evaluated in
the ad-hoc sub-process's own scope, as in Zeebe. Undefined and manual tasks pass through, and a flow element written as an
empty tag (`<bpmn:userTask id="x"/>`) is read like one with children. A complex gateway fails
deployment, as in Zeebe, which does not execute it. An ad-hoc sub-process activates its
inner elements, each in its own activation, from `activeElementsCollection` or from the job
result of its job worker implementation (such as the AI Agent Sub-process), completes by
its `completionCondition` or the job result, and creates the job again after each
activation. It creates the `adHocSubProcessElements` variable with the elements it can
activate and their `fromAi()` parameters in Zeebe's shape: a parameter is named by its whole
reference (`toolCall.orderId`), a `fromAi()` call on any reference is listed, and a field that
is null or empty is left out. The TypeScript engine gives the same shape, and a test checks
that the two agree. A `fromAi()` call that Zeebe rejects at deployment (a value that is not a
reference, a description or type that is not a string literal, a schema or options that is
not a context of literals, `null` included) fails the deployment with Zeebe's message, on
Reebe and in the TypeScript engine. The gRPC calls pass their `variables` documents on as
variables and reject a document that is not a JSON object, as Zeebe's gateway does, and
Reebe's REST API can activate elements of an active one
(`POST /v2/element-instances/ad-hoc-activities/{key}/activation`). Process instance
modification (REST `POST /v2/process-instances/{key}/modification` and gRPC
`ModifyProcessInstance`) activates elements, with ancestor selection and variables,
terminates element instances and moves them, with Zeebe's rules and rejection messages.
A redeployed DMN gets a new version when its content changes and keeps its version when it
does not, and a decision evaluates by its id (the latest version) or by its key. Every
scenario of the [template gallery](/docs/guides/templates) passes on it.

Reebe is a dev/test engine in the
[Experimental tier](/docs/getting-started/stability#product-tiers), not for production. It is
a clean-room implementation of the Zeebe API written from Camunda's public documentation, it
is not affiliated with Camunda, and its behaviour is checked by its own tests rather than
against Zeebe. "Zeebe" and "Camunda" are trademarks of Camunda Services GmbH.

## Zeebe extensions

Every `zeebe:` element in the vendored Zeebe descriptor is modelled or preserved, and 26 of
them are checked for placement — which BPMN element each may appear on — by
`packages/core/src/bpmn/zeebe-placement.ts`. That includes task definitions, IO mappings,
task headers, called decisions and elements, forms, user tasks, scripts, linked resources,
ad-hoc sub-process and AI agent settings, version tags, and execution and task listeners.

[Element templates](/docs/packages/connectors) (Camunda's connector template JSON) are applied
for outbound and inbound connectors. `applyTemplateToElement` writes the inbound bindings to
the element's message and its `zeebe:subscription` correlation key, where Camunda reads them,
and applies `zeebe:linkedResource` bindings.

Camunda 7 (`camunda:` extensions) is not modelled: those attributes and elements are kept on
round trip, including those on multi-instance loops and event definitions.
`convertCamunda7()` / `casen migrate c7` convert
Camunda 7 models to Camunda 8 and report what needs manual work. See
[Migrate from Camunda 7](/docs/guides/migrate-from-camunda-7).

## Linting — bpmnlint compatibility

`casen lint` and the VS Code extension read a project's `.bpmnlintrc`. All 28 of bpmnlint's
built-in rules map onto BPMN Kit findings: 21 exactly and 7 approximately. Six of the seven
differ mainly because BPMN Kit's flow and naming checks look only at the top level, not
inside sub-processes. When the project has bpmnlint installed, that bpmnlint runs the
configuration itself, so `bpmnlint-plugin-*` rules work too.
[bpmnlint Compatibility](/docs/guides/bpmnlint) has the rule-by-rule table. On the 16 `.bpmn`
files in this repository under `bpmnlint:all`, every rule marked exact reports the same
elements as bpmnlint.

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

- Choreography and conversation diagrams
- Camunda 7 extensions (preserved, not modelled; `casen migrate c7` converts them to Camunda 8)
- DMN boxed expressions and literal-expression decisions
- TS simulator: conditional events, message start events of a top-level process, transaction
  cancel events, compensation event sub-processes, inclusive and complex joins (they do not
  wait), complex gateway activation conditions, and inner activities of ad-hoc sub-processes
  without a job worker (`activeElementsCollection` is not evaluated)
- Reebe: a decision evaluation reports no `evaluatedDecisions` (matched rules and inputs);
  a redeployed BPMN process always gets a new version, even when it has not changed;
  single-node only, no published comparison with Zeebe, and no published performance figures

Found something this page gets wrong? [Open an issue](https://github.com/bpmnkit/monorepo/issues).
