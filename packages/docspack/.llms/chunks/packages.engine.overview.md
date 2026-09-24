# @bpmnkit/engine — Overview

`@bpmnkit/engine` is a lightweight BPMN 2.0 process *simulator* that runs entirely in the
JavaScript runtime — no external services required. It is built for tests, demos and
step-through debugging, not for running production processes.

**What the TypeScript simulator executes:**
- Service and user tasks (dispatched to registered job workers), script tasks (FEEL),
  business rule tasks (DMN); manual, send, receive and plain tasks pass straight through
- Exclusive (with default flow), parallel, inclusive and event-based gateways. An event-based
  gateway arms the message, timer and signal catch events (and receive tasks) after it; the
  first to fire takes its branch and the others are cancelled. A complex gateway splits like
  an inclusive one: every flow whose condition holds, else the default flow
- Start events: none, and signal (see `broadcastSignal`). End events: none, terminate, error,
  escalation, signal and compensation
- Intermediate catch events: timer (ISO 8601 duration, date and cycle), message, signal and
  link. Intermediate throw events: signal, escalation, link and compensation
- Boundary events: timer, message and signal — interrupting, or non-interrupting, in which
  case the activity keeps running and a timer cycle fires once per repetition — plus error and
  escalation. An error a job worker throws with `job.throwError(code, …)` is caught like one
  from an error end event
- Errors and escalations propagate outwards: a boundary event on the throwing task, then per
  scope an event sub-process of the scope and a boundary event on the activity running it, up
  to the call activity that started the instance. An uncaught error fails the instance; an
  uncaught escalation does not
- Embedded sub-processes, transactions and event sub-processes (message, timer, signal, error
  and escalation start events, interrupting or not), in the process or in a sub-process
- Call activities: when `zeebe:calledElement processId` names a process deployed in the same
  engine, it runs as a child instance. By default every parent variable is copied in and every
  child variable propagates back (`propagateAllParentVariables` / `propagateAllChildVariables`
  turn that off); output mappings pick what returns. A failed job in the child fails the
  caller. A process that is not deployed completes the call activity with an `element:warning`
  event
- Multi-instance tasks and sub-processes, parallel and sequential: `zeebe:loopCharacteristics`
  `inputCollection` / `inputElement` / `outputCollection` / `outputElement`, `loopCardinality`,
  and `completionCondition` with `numberOfInstances`, `numberOfActiveInstances`,
  `numberOfCompletedInstances` and `numberOfTerminatedInstances`. Each iteration has its own
  scope with `loopCounter`
- Compensation: a compensation throw or end event runs the handlers (`isForCompensation`
  activities associated with a compensation boundary event) of the activities completed in
  its scope, including inside completed sub-processes, one after another in reverse
  completion order, and waits for them. `activityRef` limits it to one activity
- Zeebe IO mappings, and DMN decisions through `@bpmnkit/feel`

**What it does not execute.** Ad-hoc sub-processes without a task definition complete without
running their inner activities. Conditional events are not evaluated: a conditional catch
event passes straight through, and conditional boundary and start events never fire. A message
start event of a top-level process does not start instances, and transaction cancel events
are not modelled. Inclusive and complex *joins* do not wait for the other branches — each
arriving token passes through — and a complex gateway's activation condition is ignored.
Zeebe invokes compensation handlers all at once rather than in reverse order, and supports
compensation event sub-processes, which the simulator does not. In `beforeComplete` (step)
mode, timers on catch events and event-based gateways fire without waiting; boundary and
event sub-process timers keep real time. For Zeebe semantics, `@bpmnkit/engine/wasm-runner`
runs the same scenarios on the Reebe engine compiled to WebAssembly (experimental).

---
Source: https://bpmnkit.com/docs/packages/engine
