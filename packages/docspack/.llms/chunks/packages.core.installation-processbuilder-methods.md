# @bpmnkit/core — Installation — ProcessBuilder methods

All builder methods return `this` for chaining.

| Method | Description |
|---|---|
| `.startEvent(id, options?)` | Add a start event |
| `.endEvent(id, options?)` | Add an end event |
| `.serviceTask(id, options?)` | Add a service task |
| `.userTask(id, options?)` | Add a user task |
| `.scriptTask(id, options?)` | Add a script task |
| `.sendTask(id, options?)` | Add a send task |
| `.receiveTask(id, options?)` | Add a receive task |
| `.businessRuleTask(id, options?)` | Add a business rule task |
| `.manualTask(id, options?)` | Add a manual task — work done outside the engine, no job worker |
| `.task(id, options?)` | Add an abstract task with no Zeebe extensions |
| `.exclusiveGateway(id, options?)` | Add an XOR gateway |
| `.parallelGateway(id, options?)` | Add a parallel gateway |
| `.inclusiveGateway(id, options?)` | Add an inclusive gateway |
| `.eventBasedGateway(id, options?)` | Add an event-based gateway |
| `.complexGateway(id, options?)` | Add a complex gateway (aspirational — Zeebe does not execute these) |
| `.subProcess(id, builder, options?)` | Add an embedded sub-process |
| `.adHocSubProcess(id, builder, options?)` | Add an ad-hoc sub-process |
| `.eventSubProcess(id, builder, options?)` | Add an event sub-process (emits `subProcess triggeredByEvent="true"`) |
| `.transaction(id, builder, options?)` | Add a transaction sub-process (atomic scope) |
| `.callActivity(id, options?)` | Add a call activity |
| `.intermediateCatchEvent(id, options?)` | Add a catch event |
| `.intermediateThrowEvent(id, options?)` | Add a throw event |
| `.branch(id, builder)` | Define a gateway branch |
| `.boundaryEvent(id, options)` | Attach a boundary event to the previous task |
| `.withBoundary(id, options, handler)` | Attach a boundary event and build its error/timeout path; cursor auto-restores to the main flow after the handler |
| `.defaults(options)` | Set process-wide defaults (e.g. `{ serviceTask: { retries: "5" } }`) applied to all subsequent tasks |
| `.disconnectedStartEvent(id?, options?)` | Add a start event with no auto-connection to the current cursor — alias for `addStartEvent` |
| `.withAutoLayout()` | Apply Sugiyama layout before building |
| `.build(options?)` | Return the completed `BpmnDefinitions`. Pass `{ explicitJoins: true }` to refuse inferred join gateways — see below |

Every BPMN element type the model knows is reachable from a builder chain, except the three
data types (`dataObject`, `dataObjectReference`, `dataStoreReference`) — those are wired by
data associations rather than sequence flows, so the chain has nowhere to put them. A
compile-time table, `BUILDER_COVERAGE`, holds the SDK to that: adding an element type without
a builder method fails the build. Run `pnpm --filter @bpmnkit/core check:builder` to print it.

---
Source: https://bpmnkit.com/docs/packages/core
