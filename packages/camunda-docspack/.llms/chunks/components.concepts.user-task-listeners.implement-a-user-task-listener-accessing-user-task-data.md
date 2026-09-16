# User task listeners — Implement a user task listener — Accessing user task data

User task-specific data, such as `assignee` and `priority`, are accessible through the `userTask` property of the user task listener job.  
The following user task attributes can be accessed from the activated job's `userTask` property:

| Attribute           | Description                                                                                                                                                                                   |
| :------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`            | A custom action value provided along with the request that triggered this event. If none was provided, it defaults to one of `assign`, `claim`, `update`, or `complete`.                      |
| `assignee`          | The user assigned to the task. If not specified, the task is unassigned. Refer to [assignments](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#assignments) for more details.              |
| `candidateGroups`   | Specifies the groups of users that the task can be assigned to. Refer to [assignments](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#assignments) for more details.                       |
| `candidateUsers`    | Specifies the users that the task can be assigned to. Refer to [assignments](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#assignments) for more details.                                 |
| `changedAttributes` | Lists the user task attributes that have changed with the event. Refer to the [changed attributes](#changed-attributes) section below for more details.                                       |
| `dueDate`           | Specifies the due date of the task. Refer to [scheduling](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#scheduling) for more details.                                                     |
| `followUpDate`      | Specifies the follow-up date of the task. Refer to [scheduling](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#scheduling) for more details.                                               |
| `formKey`           | The form linked to the user task, referenced by its uniquely identifying key. Refer to [user task forms](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#user-task-forms) for more details. |
| `priority`          | The task’s priority level. Refer to [priority](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#define-user-task-priority) for more details.                                                 |
| `userTaskKey`       | The unique key identifying the user task.                                                                                                                                                     |

Below is an example of accessing the `assignee` value from the activated job in Java:

```java
final JobHandler userTaskListenerHandler =
    (jobClient, job) -> {
        // Access the 'assignee' from the job's user task property
        // highlight-start
        final String assignee = job.getUserTask().getAssignee();
        // highlight-end

        System.out.println("The assignee for this user task is: " + assignee);

        // remaining job handler logic
    };
```

This user task data can be leveraged to customize the behavior of the user task listener job worker.

#### Changed attributes

The `changedAttributes` attribute lists which user task attributes have changed with the event.

**Note**
User task data corrections are taken into account.
For example, consider a user task with three `assigning` listeners defined.
When assigning the user task, the first listener sees the `assignee` attribute in the `changedAttributes`.
If it corrects the priority, a subsequent assigning listener sees both the `assignee` and the `priority` attributes as changed attributes.
Now, this second listener corrects the priority back to the value it had before assigning.
The third listener sees only the `assignee` attribute as changed attribute, because the priority is no longer changed with the event.

#### Task headers

Configured [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks#task-headers) on the user task are available in the job's custom headers.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
