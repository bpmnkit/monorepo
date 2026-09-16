# Execution listeners — Incident recovery

During execution listener processing, issues can arise that lead to [incidents](https://docs.camunda.io/docs/next/components/concepts/incidents). For example, these incidents can occur due to job execution failures or problems during expression evaluation.

### Job execution failure

If an execution listener job fails (for example, if an external service is unavailable), it is retried according to the `retries` property.

If all retries are exhausted and the job still fails, the process halts, and an incident is raised. Once the incident is resolved, only the listener with the failed job is retried, allowing the process to resume from the point of failure without re-executing successfully completed listeners.

### Expression evaluation failure

Incidents can also occur during the evaluation of an execution listener's properties (for example, due to incorrect variable mapping or expression syntax).

If this happens, all listeners of the same event type (`start`, `end`, or `cancel`) that were processed before the failure are re-executed once the issue is resolved, even if they had previously completed successfully.

---
Source: https://docs.camunda.io/docs/next/components/concepts/execution-listeners
