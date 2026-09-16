# Example user task listener — Step 8: Verify the result in Operate and Tasklist

Now that the task listener is running, the listener job will have been handled and completed. Let's see what effects this has had.

1. Navigate to Operate and see that the listener that was **Active** previously, has now been **Completed**.

   ![Listener has been completed in Operate](./assets/user-task-listeners-guide/8.1-verify-listener-completed.png)

2. Navigate to Tasklist and see that the task is available and assigned to the assignee or manager that you provided.

   ![Task is assigned in Tasklist](./assets/user-task-listeners-guide/8.2-verify-task-assigned.png)


## Suggestions for further exploration

To build your understanding of task listeners, you can also:

- Stop the listener application.
- Start a new instance of the process, and notice that the task does not appear in Tasklist.
- Check Operate, and notice that a creating listener is active.
- Restart the listener application and notice that the listener failed, and an incident is raised.
- Set a variable `assignee` or `manager` in the process instance, and resolve the incident.
- Check Tasklist, and notice that the task is assigned to the assignee or manager that you provided.

Further, you can try the following:

- Add a separate listener for another event type, and [trigger that event](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#trigger-a-user-task-listener).
- [Access the user task's data](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#accessing-user-task-data) from the **activated job**.
- [Correct the assignee](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#correcting-user-task-data) in the listener by adding a **job result** to the complete job command.
- [Deny the assignment](https://docs.camunda.io/docs/next/components/concepts/user-task-listeners#denying-the-lifecycle-transition) from the listener to avoid the task's assignment altogether.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners-guide
