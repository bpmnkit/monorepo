# Job workers — Requesting jobs

Job workers request jobs of a certain type on a regular interval (i.e. polling). This interval and the number of jobs requested are configurable in the [Zeebe client](https://docs.camunda.io/docs/next/apis-tools/working-with-apis-tools).

If one or more jobs of the requested type are available, [Zeebe](https://docs.camunda.io/docs/next/components/zeebe/zeebe-overview) (the workflow engine inside Camunda 8) streams activated jobs to the worker. Upon receiving jobs, a worker performs them and sends back a `complete` or `fail` command for each job, depending on if the job could be completed successfully.

For example, the following process might generate three different types of jobs: `process-payment`, `fetch-items`, and `ship-parcel`:

![order-process-model](assets/order-process.png)

Three different job workers, one for each job type, could request jobs from Zeebe:

![zeebe-job-workers-requesting-jobs](assets/zeebe-job-workers-graphic.png)

Many workers can request the same job type to scale up processing. In this scenario, Zeebe ensures each job is sent to only one of the workers.

Such a job is considered activated until the job is completed, failed, or the job activation times out.

If a job's variables contain secret references, the job is handed out only once those references have been resolved. A job that is still waiting is not returned by the request and does not count against **MaxJobsToActivate**, so jobs behind it are still activated, and it becomes available again on its own once resolution completes. See [secret resolution and job activation](https://docs.camunda.io/docs/next/components/concepts/secret-resolution-and-job-activation).

On requesting jobs, the following properties can be set:

- **Worker**: The identifier of the worker used for auditing purposes.
- **Timeout**: The time a job is assigned to the worker. If a job is not completed within this time, it can be reassigned by Zeebe to another worker.
- **MaxJobsToActivate**: The maximum number of jobs which should be activated by this request.
- **FetchVariables**: A list of required variable names. If the list is empty, all variables of the process instance are requested.

### Long polling

Ordinarily, a request for jobs can be completed immediately when no jobs are available.

To find a job to work on, the worker must poll again for available jobs. This leads to workers repeatedly sending requests until a job is available.

This is expensive in terms of resource usage, because both the worker and the server are performing a lot of unproductive work. Zeebe supports **long polling** for available jobs to better utilize resources.

With **long polling**, a request is kept open while no jobs are available. The request is completed when at least one job becomes available.

**Long polling** is set during [job activation with the parameter `request-timeout`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#activatejobs-rpc).

### Job queuing

Zeebe decouples creation of jobs from performing the work on them. It is always possible to create jobs at the highest possible rate, regardless if there is a job worker available to work on them. This is possible because Zeebe queues jobs until workers request them.

This increases the resilience of the overall system. Camunda 8 is highly available so job workers don't have to be highly available. Zeebe queues all jobs during any job worker outages, and progress resumes as soon as workers are available.

This also insulates job workers against sudden bursts in traffic. Because workers request jobs, they have full control over the rate at which they take on new jobs.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
