# Conformance — BPMN elements by component

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
(timer, message, signal, error, escalation, compensation, link, terminate) and
multi-instance. It has no complex gateway and no ad-hoc sub-process. Reebe is experimental,
and its behaviour is checked by its own tests rather than against Zeebe.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
