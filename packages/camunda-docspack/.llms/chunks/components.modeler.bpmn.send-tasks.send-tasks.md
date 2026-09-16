# Send tasks

A send task is used to model the publication of a message to an external system.

A send task is used to model the publication of a message to an external system; for example, to a
Kafka topic or a mail server.

![task](assets/send-task.png)

Send tasks behave exactly like [service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks). Both task
types are based on jobs and [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers). The
differences between these task types are the visual representation (i.e. the task marker) and the
semantics for the model.

When a process instance enters a send task, it creates a corresponding job and waits for its
completion. A job worker should request jobs of this job type and process them. When the job is
complete, the process instance continues.

**Note**

Jobs for send tasks are not processed by Zeebe itself. To process them, provide
a job worker.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/send-tasks/send-tasks
