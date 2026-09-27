# Job workers — Job leasing — Example

The following example activates jobs with a lease and completes the job using the matching lease token.

```java
client
    .newWorker()
    .jobType("process-payment")
    .handler(
        (jobClient, job) -> {
            // process the job ...

            jobClient
                // highlight-start
                .newCompleteCommand(job.getKey())
                .withJobLeaseToken(job.getJobLeaseToken())
                // highlight-end
                .send();
        })
    // highlight-start
    .withLease(true)
    // highlight-end
    .open();
```

When you build a command from the activated job itself, the client carries the job's lease token for you automatically:

```java
client
    .newWorker()
    .jobType("process-payment")
    .handler(
        (jobClient, job) -> {
            // process the job ...

            // highlight-start
            jobClient.newCompleteCommand(job).send();
            // highlight-end
        })
    // highlight-start
    .withLease(true)
    // highlight-end
    .open();
```

---
Source: https://docs.camunda.io/docs/next/components/concepts/job-workers
