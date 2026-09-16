# Global user task listeners — Execution order

For a given event on a task instance:

- Global listeners run in the order defined by the `priority` property of each listener.
  - Listeners with a higher priority are executed first.
  - Listeners with the same priority are sorted by their `id` in lexicographical order to ensure a deterministic execution order.
- Model-level listeners run next, in the order defined in the BPMN model.
- Global listeners marked with `after-non-global: true` (Unified Configuration) or `afterNonGlobal: true` (API) run after model-level listeners.


## Supported features

Global listeners support the same features as model-level user task listeners:

- [Blocking behavior](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#blocking-behavior).
- [Triggering on a specific lifecycle event](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#trigger-a-user-task-listener).
- [Accessing user task data in job workers](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#accessing-user-task-data), in particular:
  - Task-specific data, such as, assignee, due date, or priority.
  - Attributes changed by the event, either through an `updating` event or because of corrections done by previous listeners.
  - Headers defined in the user task model.
- [Correcting user task data](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#correcting-user-task-data).
- [Denying lifecycle transitions](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#denying-the-lifecycle-transition).
- [Incident recovery](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#incident-recovery).

Additionally, you can configure a single global listener to be triggered by multiple lifecycle events, possibly all of them.

---
Source: https://docs.camunda.io/docs/next/components/concepts/global-user-task-listeners
