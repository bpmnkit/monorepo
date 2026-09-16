# Script tasks — Job worker implementation

When the job worker implementation is used, script tasks behave exactly like [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks). Both task types are based on jobs and [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers). The differences between these task types are the visual representation (i.e. the task marker) and the
semantics for the model.

When a process instance enters a script task using a job worker implementation, it creates a corresponding job and waits
for its completion. A job worker should request jobs of this job type and process them. When the job is complete, the
process instance continues.

**Note**
Jobs for script tasks are not processed by Zeebe itself. To process them, provide a job worker.

### Defining a job worker script task

A script task must define a [job type](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-definition) the
same way a service task does. It specifies the type of job workers should subscribe to (e.g. `script`).

Use [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-headers) to pass static parameters to
the job worker (e.g. the script to evaluate). The community extension [Zeebe Script Worker](https://github.com/camunda-community-hub/zeebe-script-worker)
requires certain attributes to be set in the task headers.

Define [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
the [same way a service task does](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#variable-mappings)
to transform the variables passed to the job worker, or to customize how the variables of the job merge.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/script-tasks/script-tasks
