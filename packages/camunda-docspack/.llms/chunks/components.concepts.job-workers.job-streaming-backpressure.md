# Job workers — Job streaming — Backpressure

To avoid workers overloaded with too many jobs, e.g. running out of memory:

- The workers rely on the [built-in gRPC flow control mechanism](https://grpc.io/docs/guides/flow-control/).
- Or, if lacking for your language of choice, [the built-in HTTP/2 stream flow control](https://httpwg.org/specs/rfc7540.html#FlowControl), e.g. Golang implementation of gRPC.

Essentially, as jobs are pushed downstream from the broker to the client, they're first buffered in the gateway where the direct client connection resides. The gateway only sends as much data as the client can consume over a specific connection. If it notices its send buffers fill up, it marks a client as `not-ready`. This can happen, for example, if the client's receive method is blocked/suspended.

If a client is not ready to receive a job, the gateway instead tries to re-route the job to another logically equivalent worker. If this fails (e.g. all workers connected to a specific gateway are not ready), the job is returned to the broker. There, it may be retried to another gateway, if and only if it has a logically equivalent worker.

#### Implementing backpressure

If you're using the raw `StreamActivatedJobs` RPC, or want to add support for this to your client of choice, the criteria to apply backpressure is to stall the underlying HTTP/2 transport. To do so, you may need to block the thread in which the gRPC stream is running (e.g. Java), or suspend the coroutine (e.g. Kotlin, Go). Once the transport stops receiving, this causes the gateway's send buffers to fill up, and effectively apply backpressure.

If you wish to test this, you can do so by simulating a very slow worker with your new implementation. Then, start generating many jobs on the server side (e.g. create many process instances with lots of jobs). You should then observe backpressure via server side metrics, or many `Job.YIELD` commands written to the log.

Refer to the [client implementations](https://github.com/camunda/camunda/tree/main/clients) for more information.

#### Detecting backpressure

There are different ways to detect backpressure.

On the client side, you can use the job worker metrics to do so. For example, by subtracting the rate of handled jobs (i.e. `camunda.client.worker.job.handled`) from the rate of activated jobs (i.e. `camunda.client.worker.job.activated`), you can estimate the rate of queued jobs. If this is too close to the `maxJobsActive` consistently, this may indicate you need to scale your worker deployment.

**Warning: Deprecated metrics**
The following metrics are deprecated and will be removed in version 8.10:

- `zeebe.client.worker.job.activated`, replace with `camunda.client.worker.job.activated`
- `zeebe.client.worker.job.handled`, replace with `camunda.client.worker.job.handled`

Please update your monitoring integrations to use the new metrics before upgrading to version 8.10.

**Note**
If you're using Prometheus, you can use the following query to estimate the queue size of your workers. We recommend adding a job type label to be able to group per workload, e.g. `sum(zeebe_client_worker_job_activated_total - zeebe_client_worker_job_handled_total) by (jobType)`

On the server side (e.g. if you're running a self-managed cluster), you can measure the rate of jobs which are not pushed due to clients which are not ready via the metric `zeebe_broker_jobs_push_fail_try_count_total{code="BLOCKED"}`. If the rate of this metric is high for a sustained amount of time, it may be a good indicator that you need to scale your workers. Unfortunately, on the server side we don't differentiate between clients, so this metric doesn't tell you which worker deployment needs to be scaled. We thus recommend using client metrics whenever possible.

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
