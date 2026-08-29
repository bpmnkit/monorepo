# @bpmnkit/core — Installation — ProcessBuilder methods

All builder methods return `this` for chaining.

| Method | Description |
|---|---|
| `.startEvent(id, options?)` | Add a start event |
| `.endEvent(id, options?)` | Add an end event |
| `.serviceTask(id, options?)` | Add a service task |
| `.userTask(id, options?)` | Add a user task |
| `.scriptTask(id, options?)` | Add a script task |
| `.exclusiveGateway(id, options?)` | Add an XOR gateway |
| `.parallelGateway(id, options?)` | Add a parallel gateway |
| `.inclusiveGateway(id, options?)` | Add an inclusive gateway |
| `.eventBasedGateway(id, options?)` | Add an event-based gateway |
| `.subProcess(id, builder, options?)` | Add an embedded sub-process |
| `.callActivity(id, options?)` | Add a call activity |
| `.intermediateCatchEvent(id, options?)` | Add a catch event |
| `.intermediateThrowEvent(id, options?)` | Add a throw event |
| `.branch(id, builder)` | Define a gateway branch |
| `.boundaryEvent(id, options)` | Attach a boundary event to the previous task |
| `.withBoundary(id, options, handler)` | Attach a boundary event and build its error/timeout path; cursor auto-restores to the main flow after the handler |
| `.defaults(options)` | Set process-wide defaults (e.g. `{ serviceTask: { retries: "5" } }`) applied to all subsequent tasks |
| `.disconnectedStartEvent(id?, options?)` | Add a start event with no auto-connection to the current cursor — alias for `addStartEvent` |
| `.withAutoLayout()` | Apply Sugiyama layout before building |
| `.build(options?)` | Return the completed `BpmnDefinitions`. Pass `{ strict: true }` to throw if auto-join gateways are inserted (encourages explicit topology) |

---
Source: https://bpmnkit.com/docs/packages/core
