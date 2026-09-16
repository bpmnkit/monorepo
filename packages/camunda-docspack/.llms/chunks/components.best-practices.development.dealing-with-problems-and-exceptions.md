# Dealing with problems and exceptions

Take a closer look at understanding workers, handling exceptions on a technical level, leveraging retries, using incidents, and more.


## Understanding workers

**Caution: Camunda 8 only**
The description of workers targets Camunda 8, even if [external tasks in Camunda 7](https://docs.camunda.org/manual/latest/user-guide/process-engine/external-tasks/) are conceptually similar.

First, let's briefly examine how a worker operates.

Whenever a process instance arrives at a service task, a new job is created and pushed to an internal persistent queue within Camunda 8. A client application can subscribe to these jobs with the workflow engine by the task type name (which is comparable to a queue name).

If there is no worker subscribed when a job is created, the job is simply put in a queue. If multiple workers are subscribed, they are competing consumers, and jobs are distributed among them.

![Worker concept](dealing-with-problems-and-exceptions-assets/worker-concept.png)

Whenever the worker has finished whatever it needs to do (like invoking the REST endpoint), it sends another call to the workflow engine, which [can be one of these three](https://docs.camunda.io/docs/next/components/concepts/job-workers#completing-or-failing-jobs):

- [`CompleteJob`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#completejob-rpc): The service task went well, the process instance can move on.
- [`FailJob `](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#failjob-rpc): The service task failed, and the workflow engine should handle this failure. There are two possibilities:
  - `remaining retries > 0`: The job is retried.
  - `remaining retries <= 0`: An [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) is raised and the job is not retried until the incident is resolved.
- [`ThrowError`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#throwerror-rpc): A BPMN error is reported, which typically is handled on the BPMN level.

As the glue code in the worker is external to the workflow engine, there is **no technical transaction spanning both components**. Technical transactions refer to ACID (atomic, consistent, isolated, durable) properties, mostly known from relational databases.

If, for example, your application leverages those capabilities, your business logic is either successfully committed as a whole, or rolled back completely in case of any error. However, those ACID transactions cannot be applied to distributed systems (the talk [lost in transaction](https://www.youtube.com/watch?v=WRR26jJNh68) elaborates on this). In other words, things can get out of sync if either the job handler or the workflow engine fails.

A typical example scenario is the following, where a worker calls a REST endpoint to invoke business logic:

![Typical call chain](dealing-with-problems-and-exceptions-assets/typical-call-chain.png)

Technical ACID transaction will only be applied in the business application. The job worker mostly needs to handle exceptions on a technical level, e.g. to control retry behavior, or pass it on to the process level, where you might need to implement business transactions.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
