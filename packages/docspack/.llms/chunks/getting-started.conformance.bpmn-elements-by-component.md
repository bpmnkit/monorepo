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
incident, with Zeebe's message, on the instance that was completing; resolving it evaluates the
condition again. Undefined and manual tasks pass through, and a flow element written as an
empty tag (`<bpmn:userTask id="x"/>`) is read like one with children. A complex gateway fails
deployment, as in Zeebe, which does not execute it. An ad-hoc sub-process activates its
inner elements, each in its own activation, from `activeElementsCollection` or from the job
result of its job worker implementation (such as the AI Agent Sub-process), completes by
its `completionCondition` or the job result, and creates the job again after each
activation. It creates the `adHocSubProcessElements` variable with the elements it can
activate and their `fromAi()` parameters in Zeebe's shape: a parameter is named by its whole
reference (`toolCall.orderId`), a `fromAi()` call on any reference is listed, and a field that
is null or empty is left out. The TypeScript engine gives the same shape, and a test checks
that the two agree. The gRPC calls pass their `variables` documents on as variables and
reject a document that is not a JSON object, as Zeebe's gateway does, and
Reebe's REST API can activate elements of an active one
(`POST /v2/element-instances/ad-hoc-activities/{key}/activation`). Every scenario of the
[template gallery](/docs/guides/templates) passes on it.

---
Source: https://bpmnkit.com/docs/getting-started/conformance
