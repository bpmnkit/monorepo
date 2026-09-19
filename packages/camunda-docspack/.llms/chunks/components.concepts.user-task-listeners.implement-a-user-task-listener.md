# User task listeners — Implement a user task listener

User task listeners are implemented using [job workers](https://docs.camunda.io/docs/next/components/concepts/job-workers), similar to execution listeners and service task jobs. The job worker processes the task listener job, can apply corrections, and may optionally deny the lifecycle transition.

See the [job worker documentation](https://docs.camunda.io/docs/next/apis-tools/java-client/job-worker) for examples of how to create a job worker and handler that can also process user task listener jobs.

---
Source: https://docs.camunda.io/docs/next/components/concepts/user-task-listeners
