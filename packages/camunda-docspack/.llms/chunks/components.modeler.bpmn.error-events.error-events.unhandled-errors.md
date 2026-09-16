# Error events — Unhandled errors

When an error is thrown and not caught, an [**incident**](https://docs.camunda.io/docs/next/components/concepts/incidents) (for example, `Unhandled error event`) is raised to indicate the failure. The incident is attached to the corresponding element where the error was thrown (that is, the task of the processed job or the error end event).

When you resolve the incident attached to a task, it ignores the error, re-enables the job, and allows it to be activated and completed by a job worker once again.

The incident attached to an error end event cannot be resolved by a user because the failure is in the process itself. The process cannot be changed to catch the error for this process instance.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events
