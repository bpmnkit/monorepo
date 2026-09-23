# Conformance — BPMN elements by component

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

---
Source: https://bpmnkit.com/docs/getting-started/conformance
