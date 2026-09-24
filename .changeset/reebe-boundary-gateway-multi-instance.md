---
"@bpmnkit/reebe-wasm": patch
---

Reebe now runs timer boundary events, event-based gateways and multi-instance activities as Zeebe does.

- Timer, message and signal boundary events are armed when their activity activates and cancelled when it completes or is terminated. The due time is evaluated with FEEL against the instance variables; durations, dates and cycles (`R3/PT10M`) are supported. An interrupting boundary terminates the activity, with its jobs, user tasks, inner elements and called process; a non-interrupting one leaves it running, and a timer cycle repeats.
- An event-based gateway arms the catch events and receive tasks after it instead of entering them. The first to trigger wins and the others' timers and subscriptions are cancelled. A message published before the gateway was reached correlates at once.
- Multi-instance runs in parallel or in sequence on every task type, sub-process and call activity. Each instance has local `inputElement` and `loopCounter` variables; `outputCollection` is filled in input order and handed to the enclosing scope when the loop ends; `completionCondition` (with `numberOfInstances`, `numberOfActiveInstances`, `numberOfCompletedInstances` and `numberOfTerminatedInstances`) ends the loop early and terminates the remaining instances. `isSequential` and `<bpmn:completionCondition>` are read from the BPMN elements where Zeebe puts them. Boundary events attach to the multi-instance body.
- Expressions see the variables of their element's scopes, inner first, and variables a job or message completes with go to the nearest scope that has them, else the process.
- A message correlates only to open subscriptions, so a used-up subscription no longer completes its element again.
