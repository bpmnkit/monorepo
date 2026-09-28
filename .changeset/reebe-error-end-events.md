---
"@bpmnkit/reebe-wasm": patch
---

Reebe now follows Zeebe in several places the template gallery scenarios rely on.

- An error end event throws its error code. The nearest enclosing catcher takes it: an error boundary event on a sub-process or call activity, or an error event sub-process. The scope it interrupts is terminated, with its jobs canceled. An uncaught error raises an `UNHANDLED_ERROR_EVENT` incident. Errors thrown by job workers now use the same path, so they also reach boundaries on enclosing sub-processes. Escalation end and intermediate throw events propagate the same way, and an uncaught escalation is not an incident.
- `errorRef` and `escalationRef` resolve to the `errorCode` and `escalationCode` of the root `<error>` and `<escalation>`.
- An ad-hoc sub-process with a job worker implementation (the AI Agent Sub-process) runs as its job, and completing the job completes it. An ad-hoc sub-process without one raises an incident. Before, its inner elements were read as top-level elements and deployment failed.
- A decision table with one output column returns that column's value, not a one-entry context.
- A FEEL variable that does not exist is `null`, not an evaluation error.
- An incident an element asks for, such as a failed I/O mapping, is now recorded. Before, it was dropped and the element waited with no incident.
- New `complete_user_task(key, variables)` completes a native `zeebe:userTask`. `snapshot()` also returns `userTasks` and `messageSubscriptions`.
