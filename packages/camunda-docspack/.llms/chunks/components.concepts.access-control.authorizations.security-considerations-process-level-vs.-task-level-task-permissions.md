# Orchestration Cluster authorization — Security considerations — Process-level vs. task-level task permissions

When configuring access to user tasks, keep the following in mind:

- Granting `READ_USER_TASK` or `UPDATE_USER_TASK` on `Process Definition` gives broad access to all user tasks for that process definition.
- These process‑level permissions override task‑level checks: if a user has the required process‑level permission, the engine does not evaluate `User Task` authorizations for the same operation.

For most scenarios:

- Assign process‑level task permissions only to trusted roles such as task managers or administrators.
- Use `User Task` property‑based authorizations (and the default Task Worker role) to limit regular task workers to tasks where they are assignee, candidate user, or in a candidate group.

---
Source: https://docs.camunda.io/docs/next/components/concepts/access-control/authorizations
