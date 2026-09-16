# Understanding human task management — Deciding about your task list frontend — Considerations for using third party task lists

When integrating a third party tasklist, you must plan for the following aspects. You will need to take care of:

- _Creating_ tasks in the third party tasklist based on the user tasks created by Camunda.
- _Completing_ tasks in Camunda and move on process execution based on user action in the third party tasklist.
- _Cancelling_ tasks, triggered by Camunda or triggered by the user in the third-party tasklist.
- Transferring _business data_ to be edited in the third-party tasklist back and forth.

Your third party tasklist application also needs to allow for some programmatic control of the lifecycle of its tasks. The third-party application _must have_ the ability:

- To programmatically _create_ a new task.
- To _hook in code_ which programmatically informs other systems that the user is about to change a task's state.
- To _manage custom attributes_ connected to a task and programmatically access them.

Additionally, it _should have_ the ability

- To programmatically _delete_ a task which was cancelled in Camunda. Without this possibility such tasks remain in the users tasklist and would need to be removed manually. Depending on the way you integrate the task completion mechanism, when the user tries to complete such tasks, they would immediately observe an error or the action would just not matter anymore and serve as a removal from the list.

Transfer just the minimal amount of business data in between Camunda and your third-party tasklist application.

For creating tasks, transfer just the taskId and important business data references/ids to your domain objects. As much as possible should be retrieved later, and just when needed (e.g. when displaying task forms to the user) by requesting data from the process engine or by requesting data directly from other systems.

For completing tasks, transfer just the business data which originated from Camunda and was changed by the user. This means, in case you just maintain references, nothing needs to be transferred back. All other business data changed by the user will be directly transferred to the affected systems.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/understanding-human-tasks-management
