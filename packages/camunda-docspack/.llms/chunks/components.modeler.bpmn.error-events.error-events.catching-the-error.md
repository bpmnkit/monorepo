# Error events — Catching the error

A thrown error can be caught by an error catch event, specifically using an error **boundary event** or an error **event
subprocess**.

![process with error catch event](assets/error-catch-events.png)

Starting at the scope where the error was thrown, the error code is matched against the attached error boundary events
and error event subprocesses at that level. An error is caught by the first event in the scope hierarchy matching the
error code. At each scope, the error is either caught, or propagated to the parent scope.

If the process instance is created via call activity, the error can also be caught in the calling parent process
instance.

It is not possible to define multiple error catch events with the same `errorCode` in a single scope. It is also not
permitted to have multiple error catch-all events in a single scope. However, it is possible to define both an error catch event referencing an error with a particular `errorCode` and an error catch-all event within the same scope. When this happens, the error catch event
that matches the `errorCode` is prioritized.

Error boundary events and error event subprocesses must be interrupting. This means the process instance will not
continue along the regular path, but instead follow the path that leads out of the catching error event.

If the error is thrown for a job, the associated task is terminated first. To continue the execution, the error boundary
event or error event subprocess that caught the error is activated.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
