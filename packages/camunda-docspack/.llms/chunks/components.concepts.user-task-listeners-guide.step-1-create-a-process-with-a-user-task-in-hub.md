# Example user task listener — Step 1: Create a process with a user task in Hub

1. Launch **Camunda Hub**.
2. In your workspace, open or create a project.
3. In your project, create a new BPMN file.
4. Add a user task named `Assigned by creating task listener`.


## Step 2: Select the user task

1. Click the **user task**.
2. In the right-hand **properties panel**, scroll to **Task listeners**.


## Step 3: Define a task listener

Add a new task listener to the user task and define its properties:

1. Click the plus sign in the **Task listeners** section to add a new task listener.
2. Under **Event type**, select **Creating**.
3. Under **Listener type**, enter `assign_new_task`.

![Creating listener is defined with type assign_new_task](./assets/user-task-listeners-guide/3-creating-listener-defined.png)

**Info**
You've now defined a **creating** task listener for this user task. When a process instance arrives at this user task, the `creating` event is triggered, and a job of type `assign_new_task` is created. A job worker can then activate this job to execute the external logic and complete it, approving the creation of the user task.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners-guide
