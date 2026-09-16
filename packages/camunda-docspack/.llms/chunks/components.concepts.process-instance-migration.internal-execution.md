# Process instance migration — Internal Execution

In the following example, we will explain the internal execution steps of process instance migration.
It is recommended that you read these steps to fully understand the power of process instance migration.

Migration of a process instance consists of the following steps:

- Validation
- Migration of process instance, and global variables
- Migration of each active element (including associated jobs, incidents, local variables, and event subscriptions)

If any of the steps fail, the migration is rejected and a rejection message that explains the reason is returned.
For example, if a mapping is not provided for an active element, the migration is rejected with an error message indicating that the mapping is missing.
As a result, the process instance will not be migrated and remains in its current state.
The migration runs in a **transactional** manner, meaning that it is migrating all active elements or nothing.

### Validation

The migration plan is validated before the migration is executed.
The validation starts with validating the mapping instructions provided in the migration plan.
For example, the validation checks if the source element ID refers to an existing element in the process instance's process definition.
Later, while attempting to migrate each active element, each limitation mentioned in the [limitations section](#limitations) is validated.
For example, the flow scope of an active element is validated to ensure that it is not changed during migration.

### Migration of process instance, and global variables

After all validations are successful, the migration of the outermost active element which is the process instance itself is started.
At this point, the process instance's `processDefinitionKey`, `bpmnProcessId`, and `version` properties are updated to the target process definition.
The global variables are also migrated to the target process definition.

### Migration of each active element

The execution of the migration is done in a breadth-first manner.
The first active child instance of the process instance is migrated followed by the migration of the next active child instance.
Later, the migration of the active child instances of each active child instance is executed.
In this stage, jobs, incidents, local variables, and event subscriptions contained in each active element is also migrated.

While traversing each active element, the migration plan is used to determine the target element for each active element.
For each active element, `processDefinitionKey`, `bpmnProcessId`, `elementId`, `version` properties are updated to the target process definition.

#### Migration of catch event subscriptions

The following operations are performed in respective order for each active element as the execution continues to migrate each active element:

- If a catch event exists in the source process instance and is not part of the migration plan, the subscription to the catch event is removed.
- If a catch event exists in the target process definition and is not part of the migration plan, a new subscription is created for the catch event.
- If a catch event in the source process is mapped to a catch event in the target process, the subscription is migrated.

While migrating each catch event subscriptions, the catch event's `processDefinitionKey`, `bpmnProcessId`, `elementId` properties are updated to the target process definition.
**Note**
It is **possible** to change the interrupting status during catch event subscription migration.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
