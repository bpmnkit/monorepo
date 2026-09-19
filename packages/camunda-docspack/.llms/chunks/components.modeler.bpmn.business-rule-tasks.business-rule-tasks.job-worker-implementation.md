# Business rule tasks — Job worker implementation

A business rule task does not have to evaluate a decision modeled with DMN. Instead, you can also
use [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers) to implement your business rule task.

A job worker implementation can be defined using the `zeebe:taskDefinition` extension element.

Business rule tasks with a job worker implementation behave exactly like [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks). The differences between these task
types are the visual representation (i.e. the task marker) and the semantics for the model.

When a process instance enters a business rule task with alternative task implementation, it creates
a corresponding job and waits for its completion. A job worker should request jobs of this job type
and process them. When the job is completed, the process instance continues.

A business rule task must define a [job type](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-definition) the same way as a service task does. This is used as reference to specify which job workers request the respective business rule task job. For example, `order-items`. Note that `type` can be specified as any static value (`myType`) or as a FEEL [expression](https://docs.camunda.io/docs/next/components/concepts/expressions) prefixed by `=` that evaluates to any FEEL string; for example, `= "order-" + priorityGroup`.

Use [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-headers) to pass static parameters to the job
worker (for example, the key of the decision to evaluate).

Define [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
the [same way as a service task does](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#variable-mappings)
to transform the variables passed to the job worker, or to customize how the variables of the job merge.

### Job priority

This task type supports `zeebe:jobPriorityDefinition` when implemented as a job worker.

You can define job priority on the process as a default and override it on this task.
For priority behavior and limitations, see [Job prioritization](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-prioritization).

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks
