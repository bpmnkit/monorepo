---
"@bpmnkit/engine": minor
"@bpmnkit/plugins": patch
---

The TypeScript simulator now executes the BPMN semantics it used to skip:

- **Boundary events.** A non-interrupting boundary event no longer ends its activity: the
  activity keeps running and the boundary path starts, once per repetition for a timer cycle.
  Message and signal boundary events, interrupting or not, are new. An error a job worker
  throws with `job.throwError(code, message)` is caught by an error boundary event or error
  event sub-process like an error end event; uncaught, it still fails the instance.
- **Event-based gateway**: arms the message, timer and signal catch events (and receive
  tasks) after it; the first to fire wins and the others are cancelled.
- **Call activities** run a process deployed in the same engine as a child instance, with
  Zeebe's variable propagation (`propagateAllParentVariables`, `propagateAllChildVariables`,
  input and output mappings). Errors and escalations the child does not catch reach the call
  activity; a failed job in the child fails the caller. A process that is not deployed still
  completes the call activity, now with an `element:warning` event.
- **Event sub-processes** with message, timer, signal, error and escalation start events,
  interrupting or not, in a process or a sub-process.
- **Signals** (throw, end, catch, start, boundary) broadcast to every instance of the engine;
  new `engine.broadcastSignal(name, variables?)` and `instance.deliverSignal(name, variables?)`.
  **Escalations** propagate through scopes and call activities like errors, and do not fail
  the instance when nobody catches them.
- **Multi-instance** tasks and sub-processes, parallel and sequential: `inputCollection`,
  `inputElement`, `outputCollection`, `outputElement`, `loopCardinality` and
  `completionCondition`.
- **Link events**, **compensation** (handlers of completed activities, in reverse order;
  `activityRef`), and the **complex gateway** splitting like an inclusive one.
- **Messages**: `deliverMessage(name, variables?, correlationKey?)` matches the message name
  as well as its id, merges the variables, honours `zeebe:subscription` correlation keys on
  the event or its message, reaches waiting call-activity children, and returns whether
  anything received it.
- **Variables** follow Zeebe's propagation: input mappings are local to their element, a
  result updates the nearest scope that defines the variable or else the process scope, and
  with output mappings only the mapped variables leave the element. New
  `VariableStore.propagate`.
- New `element:terminated` and `element:warning` events. `engine.start` runs only the none
  start events when a process also has event start events.
- Fixed: a split whose first branch ended at once finished the scope before its other
  branches ran; a job result arriving after an interrupting event moved the token on.

`@bpmnkit/plugins`: token highlighting clears an element that an interrupting event
terminated.
