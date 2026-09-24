---
"@bpmnkit/reebe-wasm": patch
---

Reebe now runs timer and message start events, and completes flow scopes, as Zeebe does.

- Deploying a process schedules its timer start events: `timeDate` fires once, `timeCycle` repeats (`R/…`, `Rn/…`, and Spring-style cron such as `0 0 9-17 * * MON-FRI`), and each firing creates an instance at that start event. A new version cancels the previous version's timers. Start events of event sub-processes are unchanged: only error and escalation event sub-processes run.
- A published message whose name matches a message start event of a deployed process creates an instance with the message variables. With a correlation key, at most one instance started by that key is active at a time; a buffered message with the key starts the next instance when it ends. A new version closes the previous version's subscriptions; messages published before deployment do not start instances.
- Creating an instance starts it at its none start event only, not at its timer and message start events too.
- An embedded sub-process, and the process instance, complete only when no element instance is active inside them and no token is on its way to one. An end event no longer completes a sub-process while other branches in it are still running. An activity without outgoing sequence flows ends its path like an end event.
- A terminate end event terminates the other active elements of its own flow scope, then completes that scope (a sub-process takes its outgoing flow; at process level the instance completes). Elements outside the scope are untouched.
- Sequence flows inside sub-processes nested more than one level deep are taken.
