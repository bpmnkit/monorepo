# Send tasks — Defining a task

A send task must define a [job type](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-definition) the same
way as a service task does. It specifies the type of job that workers should subscribe to (e.g. `kafka` or `mail`).

Use [task headers](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#task-headers) to pass static parameters to the job
worker (e.g. the name of the topic to publish the message to).

Define [variable mappings](https://docs.camunda.io/docs/next/components/concepts/variables#inputoutput-variable-mappings)
the [same way as a service task does](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks#variable-mappings)
to transform the variables passed to the job worker, or to customize how the variables of the job merge.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks
