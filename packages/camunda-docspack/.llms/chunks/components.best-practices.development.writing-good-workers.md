# Writing good workers

Service tasks within Camunda 8 require you to set a task type and implement job workers who perform whatever needs to be performed.

[Service tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/service-tasks/service-tasks) within Camunda 8 require you to set a task type and implement [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers) who perform whatever needs to be performed. This describes that you might want to:

1. Write all glue code in one application, separating different classes or functions for the different task types.
2. Think about idempotency and read or write as little data as possible from/to the process.
3. If you use Java 21 or later, prefer virtual threads for parallel workers that perform blocking I/O. Use reactive or async code when your runtime already uses it, or when you need extremely high throughput or low latency.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
