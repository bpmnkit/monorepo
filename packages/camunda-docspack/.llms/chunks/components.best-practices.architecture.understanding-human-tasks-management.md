# Understanding human task management

Use Camunda task management features or implement your requirements in a generic way for readable models.


## Using task assignment features

The lifecycle of human task orchestration (like assigning, delegating, and completing tasks) is mostly a generic issue. There is no need to model common aspects into all your processes, if often makes models unreadable. Use Camunda task management features or implement your requirements in a generic way.

![Task assignment](understanding-human-tasks-management-assets/human-tasks.png)

So every task can be assigned to either a group of people, or a specific individual. An individual can 'claim' a task, indicating that they are picking the task from the pool (to avoid multiple people working on the same task).

As a general rule, you should assign human tasks, like [user tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks) or [manual tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/manual-tasks/manual-tasks), in your business process to _groups of people_ instead of specific individuals.

```xml
<bpmn:userTask id="task_approve_vacation">
  <bpmn:extensionElements>
    <zeebe:assignmentDefinition candidateGroups="manager" />
  </bpmn:extensionElements>
```

Then, require individual members of that group to explicitly _claim tasks_ before working on them. This way, you avoid different people working on the same task at the same time. Refer to [`assign`](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/assign-user-task.api).

You can also directly claim tasks in Camunda Tasklist with the click of a button.

![Claim](understanding-human-tasks-management-assets/claim.png)

While assigning users to groups is advised, it's not the only option. You could always assign a task to a _single person_ who is supposed to complete the task (e.g. the individual 'customer' of your process or a coworker having specific knowledge for the case). You will need to have access to the specific person relevant for your process instance, e.g. via a process variable:

```xml
<bpmn:userTask id="task_approve_vacation">
  <bpmn:extensionElements>
    <zeebe:assignmentDefinition assignee="=assistant_username" />
  </bpmn:extensionElements>
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/understanding-human-tasks-management
