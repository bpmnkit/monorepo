# Process instance migration — Migrate job worker user tasks to Camunda user tasks

You can migrate user tasks with a job worker implementation to Camunda user tasks by providing mapping instructions between the source and target user tasks.

The target Camunda user task preserves `candidate groups`, `candidate users`, `due date`, `follow-up date`, and the `form id` or `form key` from the source task, as well as `customHeaders` set in the job.

The target user task uses the [priority](https://docs.camunda.io/docs/next/components/tasklist/userguide/defining-task-priorities) defined in the target user task definition, or a default value of 50 if none is defined.

**Important**
When you migrate a job worker user task to a Camunda user task:

- Embedded forms are not supported. The form defined in the target user task definition is used.
- The current `assignee` is not preserved. The task is assigned to the initial assignee defined in the target user task definition.

**Note**
Incidents on the job worker user task need to be resolved before migrating to a Camunda user task, otherwise the migration will fail.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-migration
