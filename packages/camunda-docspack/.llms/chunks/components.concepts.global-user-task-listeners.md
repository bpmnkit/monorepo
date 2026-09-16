# Global user task listeners

Configure cluster‑wide listeners that react to user task lifecycle events across all processes.

Global user task listeners are [user task listeners](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners) defined once for all processes in a cluster, instead of individually per [user task](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks).


## About global user task listeners

Use global listeners to react to user task lifecycle events across all processes without modifying BPMN models.

Global listeners are configured at the cluster level and behave like model-level user task listeners, using the same lifecycle events, blocking behavior, deny/correction semantics, payload structure, and incident handling.

They are particularly useful for:

- Replicating user task changes and context to external systems, such as audit, analytics, or custom Tasklist apps.
- Centralizing Service Level Agreements and notifications across all processes.
- Enforcing governance rules and validations. For example, pre-completion checks.
- Consistently applying due date and priority policies.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners
