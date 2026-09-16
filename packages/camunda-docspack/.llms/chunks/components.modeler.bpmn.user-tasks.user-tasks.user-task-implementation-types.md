# User tasks — User task implementation types

A default user task implementation type is the **Camunda user task** with the `zeebe:userTask` extension element.
It is the recommended implementation type that is introduced on Camunda version 8.6.

Alternatively, user tasks can be implemented with **Job workers** by removing the `zeebe:userTask` extension element.
Refer to the [Job worker implementation](#job-worker-implementation) section for details.


## Camunda user tasks

Camunda user tasks support assignments, scheduling, task updates, variable mappings, and a form for a user task as detailed in the following sections.

**Note**
The Camunda user task implementation type was previously referred to as the **Zeebe user task**.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
