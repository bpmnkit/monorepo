# Example user task listener — Step 5: Deploy and run the process

1. In your diagram, click **Deploy & run**.
2. Select your deployment stage.
3. Add an `assignee` or `manager` variable as JSON data. For example, `{ "assignee": "john.doe@camunda.com" }`.
4. Click **Deploy & run**.


## Step 6: Understand what happens to the user task

Now, we'll explore what happened to the user task. We'll see that the listener blocks the creation.

1. Navigate to **Tasklist** and notice that there is no task in Tasklist yet.

   ![No tasks found in Tasklist](./assets/user-task-listeners-guide/6.2-no-tasks-found.png)

2. Navigate to **Operate** to see your process instance with a token waiting at the user task by clicking on the active process instance in the **Dashboard**.

   ![Active process instances in Operate Dashboard](./assets/user-task-listeners-guide/6.3-active-process-instances.png)

3. Click the **Process instance key** to [inspect the process instance](https://docs.camunda.io/docs/next/components/operate/userguide/basic-operate-navigation#inspect-a-process-instance).

   ![Inspect process instance in Operate](./assets/user-task-listeners-guide/6.4-inspect-process-instance.png)

4. Click the user task and then click the **Listeners** tab to see that the **Creating** listener is **Active**.

   ![Inspect listeners for user task in Operate](./assets/user-task-listeners-guide/6.5-inspect-listeners.png)

5. Take a moment to understand the properties of the listener, for example verify that the listener type is what you defined in the process model. This listener is a job that can be activated and handled by a job worker.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners-guide
