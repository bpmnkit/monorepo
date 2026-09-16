# Service tasks

Learn more about service tasks which represent a work item in the process with a specific type. When a service task is entered, a corresponding job is created.

A service task represents a work item in the process with a specific type.

![process](../assets/order-process.png)

When a service task is entered, a corresponding job is created. The process instance stops here and waits until the job is complete.

A [job worker](https://docs.camunda.io/docs/next/components/concepts/job-workers) can subscribe to the job type, process the jobs, and complete them using one of the Zeebe clients. When the job is complete, the service task is completed and the process instance continues.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks
