# Process instance suspension — Suspend and resume a process instance

Use the REST API to suspend or resume a single process instance:

- [Suspend a process instance](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/suspend-process-instance.api)
- [Resume a process instance](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resume-process-instance.api)

You can also suspend or resume multiple instances at once using batch operations:

- [Suspend process instances (batch)](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/suspend-process-instances-batch-operation.api)
- [Resume process instances (batch)](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/resume-process-instances-batch-operation.api)

**Note**
You can also suspend and resume process instances in Operate. See the [Operate user guide](https://docs.camunda.io/docs/next/components/operate/userguide/suspend-resume-process-instance).

A suspended process instance appears in search results with a `SUSPENDED` state. Filtering for `ACTIVE` instances does not include suspended instances.

---
Source: https://docs.camunda.io/docs/next/components/concepts/process-instance-suspension
