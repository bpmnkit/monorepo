# Job workers — Completing or failing jobs — Using job result

Job workers can provide a **job result** for [user task listeners](https://docs.camunda.io/docs/next/components/concepts/components/concepts/user-task-listeners).

Job results are used to define:

1. **Corrections**: Updates to specific user task attributes, such as assignee, due date, follow-up date, candidate users, candidate groups, and priority, before the task transition is finalized. For more details, see [correcting user task data](https://docs.camunda.io/docs/next/components/concepts/components/concepts/user-task-listeners#correcting-user-task-data).
2. **Denial**: Indicates that the lifecycle transition should be explicitly denied. Denying the task lifecycle transition rolls back the user task to the previous state, and discards any corrections made by previous listeners. For more details, see [denying the operation](https://docs.camunda.io/docs/next/components/concepts/components/concepts/user-task-listeners#denying-the-operation).

Below is an example of using job result:

```java
final JobHandler userTaskListenerHandler =
    (jobClient, job) -> {
        boolean shouldDeny = someValidationLogic(job);

        jobClient
            .newCompleteCommand(job)
            // highlight-start
            .withResult(
                r -> r.forUserTask()
                    .correctAssignee("john_doe")
                    .correctPriority(42)
                    .deny(shouldDeny)) // deny based on validation logic
            // highlight-end
            .send();
    };
```

If both corrections and denial are provided in the same job result (for example, `.correctAssignee(...)` and `.deny(true)`), the job completion command will be rejected. To avoid this, ensure the job is either completed with corrections (without denial set to `true`) or denied (without corrections).

**Info**

The `corrections` and `deny` features are currently available only for user task listener jobs.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
