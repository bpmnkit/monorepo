# User task listeners — Implement a user task listener — Correcting user task data

User task listeners can correct user task data before the lifecycle transition is finalized. Corrections allow user task listeners to update specific attributes of the user task, such as the assignee, due date, follow-up date, candidate users, candidate groups, and priority. These corrections are immediately available to any subsequent task listeners and are applied to the user task when the lifecycle transition is finalized, without triggering the `UPDATING` lifecycle event.

If a lifecycle transition is denied by a listener, no corrections are applied to the user task.

Below is an example of how to correct the user task data from a job worker while completing the user task listener job in Java:

```java
final JobHandler completeTaskListenerJobWithCorrectionsHandler =
    (jobClient, job) ->
        jobClient
            .newCompleteCommand(job)
            // highlight-start
            .withResult(
                r -> r.forUserTask()
                    .correctAssignee("john_doe")                    // assigns the user task to 'john_doe'
                    .correctDueDate(null)                           // preserves the current 'dueDate'
                    .correctFollowUpDate("")                        // clears the 'followUpDate'
                    .correctCandidateUsers(List.of("alice", "bob")) // sets candidate users
                    .correctCandidateGroups(List.of())              // clears the candidate groups
                    .correctPriority(80))                           // sets the priority to 80
            // highlight-end
            .send();

client.newWorker()
    .jobType("user-task-listener-completion") // type of the user task listener job
    .handler(completeTaskListenerJobWithCorrectionsHandler)
    .open();
```

#### On correcting the assignee

The assignee can be corrected in the `creating` listener only if the process hasn't specified an assignee for this user task already. For example, if the user task's `assignee` expression evaluates to `null`.

**Tip**
To set an assignee when creating the user task, review [specifying the assignee in the process](https://docs.camunda.io/docs/next/components/concepts/components/modeler/bpmn/user-tasks/user-tasks#assignments), or verify the assignee is not yet defined by the process by [accessing the `assignee` attribute in the job headers](#accessing-user-task-data).

To change the assignee specified by the process, correct it with the `assigning` event.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
