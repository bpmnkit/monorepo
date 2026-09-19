# Job workers

Learn more about job workers, a service that can perform a particular task in a process. Each time that task needs to be performed, it is represented by a job.

A [job worker](https://docs.camunda.io/docs/next/reference/glossary#job-worker) is a service capable of performing a particular task in a process. Each time that task needs to be performed, it is represented by a [job](https://docs.camunda.io/docs/next/reference/glossary#job).
For example, [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) tool calls use this mechanism. Each activity inside an [ad-hoc sub-process](https://docs.camunda.io/docs/next/reference/glossary#ad-hoc-sub-process) acts as a tool and is executed as a job, like any other task in the process.

A job has the following properties:

- **Type**: Describes the work item and is defined in each task in the process. The type is referenced by workers to request the jobs they are able to perform.

**Important**
This is a case-sensitive field, if supported by the underlying operating system. For example, `orderProcess` refers to a different worker than `OrderProcess`.

**Note**
Job worker types are subject to backend-dependent length limits: up to **32,768 characters** with Elasticsearch/OpenSearch-backed secondary storage and up to **256 characters** with RDBMS-backed secondary storage. If you use RDBMS, or might migrate to it later, keep job types within the 256-character limit.

- **Custom headers**: Additional static metadata that is defined in the process. Custom headers are used to configure reusable job workers (e.g. a `notify Slack` worker might read out the Slack channel from its header.)
- **Key**: Unique key to identify a job. The key is used to hand in the results of a job execution, or to report failures during job execution.
- **Variables**: The contextual/business data of the process instance required by the worker to do its work.
- **Tags**: Immutable labels copied from the process instance at job creation. This is great for providing additional metadata (e.g., `reference:1234`, `team:accounting`, `trace-id:3004`). See [tags](#tags) and [process instance creation tags](https://docs.camunda.io/docs/next/components/concepts/process-instance-creation#tags).

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
