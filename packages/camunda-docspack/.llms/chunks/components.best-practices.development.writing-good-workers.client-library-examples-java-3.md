# Writing good workers — Client library examples — Java (3)

Size `maxJobsActive` so your worker's queue stays within its job deadlines, with some margin:

```text
maxJobsActive < numJobWorkerExecutionThreads × (jobTimeout / averageHandlerDuration)
```

For example, with 30 execution threads, a job timeout of 1,800 ms, and an average handler duration of 300 ms, `maxJobsActive` should remain below 180 (`30 × (1800 / 300)`). A higher value allows more jobs to queue behind busy threads than can be completed before their deadlines. As a result, jobs may time out and be redelivered to other workers instead of completing.

Size the job timeout against your worst-case handler duration, not the average. The timeout serves two purposes at once: it's the broker's deadline for redelivering a job to another worker, and, if [job streaming](https://docs.camunda.io/docs/next/components/concepts/job-workers#job-streaming) is enabled, it also determines how long a pushed job can wait for an available capacity slot before it is dropped and retried. A handler that occasionally takes longer than average will exceed a timeout sized only for the average case.

**Note**
This formula and the `maxJobsActive` capacity model it describes are specific to the Java client’s worker implementation, which uses a shared semaphore to limit both pushed and polled jobs. Other client SDKs implement worker capacity differently. Check your client’s documentation for the equivalent tuning parameters.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
