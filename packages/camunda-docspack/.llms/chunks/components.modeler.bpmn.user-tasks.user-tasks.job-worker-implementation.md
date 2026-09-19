# User tasks — Job worker implementation

A user task does not have to be managed by Zeebe. You can implement custom user task logic using Job workers.

To define a Job worker implementation for a user task, simply remove the `zeebe:userTask` extension element from the task. User tasks implemented via Job workers behave similarly to service tasks, with two key differences:

- Visual representation: The visual marker distinguishes user tasks from service tasks.
- Model semantics: The interpretation and purpose in the process model differ.

**Info**
The job worker implementation for user tasks is deprecated. We recommend using [Camunda user tasks](#camunda-user-tasks) instead for enhanced functionality and adherence to best practices. For a detailed comparison of task implementation types and guidance on migrating to Camunda user tasks, see the [migration guide](https://docs.camunda.io/docs/next/apis-tools/migration-manuals/migrate-to-camunda-user-tasks).

When a process instance reaches a user task with a Job worker implementation:

1. Zeebe creates a corresponding job and waits for its completion.
2. A Job worker processes jobs of the type io.camunda.zeebe:userTask.
3. Once the job is completed, the process instance resumes execution.

Use [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-headers) to pass static parameters to the job
worker.

Define [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
the [same way as a service task does](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#variable-mappings)
to transform the variables passed to the job worker, or to customize how the variables of the job merge.

### Limitations

User tasks implemented using Job workers come with significant limitations when compared to [Camunda user tasks](#camunda-user-tasks):

1. **API compatibility**:
   You cannot use the [Orchestration Cluster REST API](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/orchestration-cluster-api-rest-overview) to manage user tasks based on job workers. These tasks are restricted to the functionality provided for [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks).

2. **Lifecycle management**:
   The Zeebe engine provides no visibility into lifecycle and state management features of Job worker-based user tasks. This means that you must handle these aspects in your custom application, outside the engine. Consider this approach only if your use case requires a highly specific user task implementation that cannot be achieved with Camunda user tasks.

3. **Reduced metrics and reporting**:
   Metrics and reporting for such user tasks are limited to the capabilities available for service tasks. This means you lose access to user task-specific insights provided by the Zeebe engine.

4. **Task-specific operations**:
   Assignments, scheduling, and other user task-specific details are included in the job as [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-headers). These must be handled in your custom implementation. Advanced user task features offered by Camunda are not available for Job worker-based user tasks.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
