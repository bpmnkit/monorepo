# Size your environment — Sizing requirements and influencing factors — Job worker capacity

Even when your cluster has spare throughput capacity, an undersized job worker can still allow jobs to accumulate in the backlog. Worker capacity requires its own sizing exercise, separate from cluster sizing.

The workflow engine delivers jobs to workers through two paths that share a worker's capacity but behave differently: [Job streaming pushes a job as soon as it becomes available for activation](https://docs.camunda.io/docs/next/components/concepts/job-workers#how-job-streaming-and-polling-deliver-jobs), while polling is the only path that drains jobs already queued in the backlog.

Therefore, healthy throughput does not indicate whether the backlog is draining; they are independent signals. The backlog can continue to grow after workers recover from an outage, even when throughput appears to have fully recovered. See [impact of worker downtime on a realistic load test](https://camunda.github.io/zeebe-chaos/2026/08/06/worker-downtime-throughput-recovery) for more details.

**Note**
There is currently no built-in metric that directly reports the size of this backlog.

Size the worker’s capacity according to its concurrency model and the job timeout. For the Java client’s fixed-thread-pool model, see [sizing `maxJobsActive` against execution threads](https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers#size-maxjobsactive-against-execution-threads). Other client SDKs implement worker capacity differently and are not covered by this formula.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/architecture/sizing-your-environment
