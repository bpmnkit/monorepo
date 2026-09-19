# Writing good workers — Client library examples — Java (2)

This code uses the reactive approach to use the Zeebe API:

```
client.newCompleteCommand(job.getKey()).send()
  .thenApply(jobResponse -> {
    counter.inc();
    return jobResponse;
  })
  .exceptionally(t -> {
    throw new RuntimeException("Could not complete job: " + t.getMessage(), t);
  });
```

With this reactive glue code, you don’t need to worry about thread pools in the workers anymore, as this is handled under the hood from the frameworks or the Java runtime. [You can observe in the logs](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/results/java-nonblocking.log) that many jobs are now executed in parallel — and even by the same thread in a loop within milliseconds.

```
10:54:07.105 [pool-4-thread-1] Invoke REST call…
[…] 30–40 times!
10:54:07.421 [pool-4-thread-1] Invoke REST call…
10:54:07.451 [ctor-http-nio-3] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-7] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-2] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-5] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-1] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-6] …finished. Complete Job…
10:54:07.451 [ctor-http-nio-4] …finished. Complete Job…
[…]
10:54:08.090 [pool-4-thread-1] Invoke REST call…
10:54:08.091 [pool-4-thread-1] Invoke REST call…
[…]
10:54:08.167 [ault-executor-2] …completed (56). Current throughput (jobs/s ): 56, Max: 56
10:54:08.167 [ault-executor-1] …completed (54). Current throughput (jobs/s ): 54, Max: 54
10:54:08.167 [ault-executor-0] …completed (55). Current throughput (jobs/s ): 55, Max: 55
```

These observations yield the following recommendations for Java:

|              | Blocking code on platform threads                                                                                                                                                      | Blocking code on virtual threads                                                                                      | Reactive code                                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Parallelism  | Some parallelism is possible with a thread pool, which is used by the client library. The default thread pool size is one, which needs to be adjusted in the config in order to scale. | Many blocked operations can run concurrently without tying each blocked operation to a platform thread.               | A processing loop combined with an internal thread pool, both are details of the framework and runtime platform.                           |
| **Use when** | You don't have requirements to process jobs in parallel.                                                                                                                               | You use Java 21 or later, need to process I/O-bound jobs in parallel, and want to keep straightforward blocking code. | Your client stack already uses reactive programming, or you need extremely high throughput or low latency and have measured the tradeoffs. |
|              | You intentionally want to limit parallelism with a small worker thread pool.                                                                                                           | This should be the default for Java workers that need parallel I/O and don't otherwise require reactive programming.  | Your developers are familiar with reactive programming and the added complexity is acceptable.                                             |

#### Size `maxJobsActive` against execution threads

For workers backed by a fixed execution thread pool (blocking or virtual threads), `maxJobsActive` defines the queue length and bounds the number of jobs a worker holds at once, but it isn't a throughput knob: throughput is `numJobWorkerExecutionThreads / handlerDuration`. Increasing `maxJobsActive` beyond what your execution threads and job timeouts can support only lengthens the queue within the worker; it does not make jobs complete faster.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
