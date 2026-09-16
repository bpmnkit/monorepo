# User task listeners — Implement a user task listener — Denying the lifecycle transition

User task listeners can deny the user task lifecycle transition belonging to the lifecycle event. For example, it can deny the completion of a task in reaction to the completing event, effectively preventing a user request to complete the task.

When a lifecycle transition is denied:

- **Corrections discarded**: Any corrections made by preceding listeners within the same lifecycle transition are discarded.
- **Task state preserved**: The user task retains its state and data as if the lifecycle event never occurred.

This capability is particularly useful for implementing validation logic or enforcing business rules before allowing a user task lifecycle transition to proceed.

Below is an example of how to deny a user task lifecycle transition from a job worker while completing the user task listener job in Java:

```java
final JobHandler denyUserTaskLifecycleTransitionHandler =
    (jobClient, job) ->
        jobClient
            .newCompleteCommand(job)
            // highlight-start
            .withResult(r -> r.forUserTask().deny(true))
            // highlight-end
            .send();
```

Not all events can be denied. For example, it's not possible to deny the creation or cancelation of a user task.
Currently, user task listeners can deny the lifecycle transition for the following events:

- `assigning`
- `updating`
- `completing`

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
