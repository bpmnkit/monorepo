# Writing good workers — Client library examples — Java

Using the [Java Client](https://github.com/camunda/camunda-platform-get-started/tree/master/java) you can write worker code like this:

```java
client.newWorker().jobType("retrieveMoney")
  .handler((jobClient, job) -> {
     //...
  }).open();
```

The [Camunda Spring Boot Starter](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started) provides a more elegant way of writing this, but also uses a normal worker from the Java client underneath. In this case, your code might look like this:

```java
@JobWorker(type = "retrieveMoney", autoComplete = false)
public void retrieveMoney(final JobClient client, final ActivatedJob job) {
  //...
}
```

In the background, a worker starts a polling component and [a thread pool](https://github.com/camunda-cloud/zeebe/blob/d24b31493b8e22ad3405ee183adfd5a546b7742e/clients/java/src/main/java/io/camunda/zeebe/client/impl/ZeebeClientImpl.java#L179-L183) to [handle the polled jobs](https://github.com/camunda/camunda/blob/d24b31493b8e22ad3405ee183adfd5a546b7742e/clients/java/src/main/java/io/camunda/zeebe/client/impl/worker/JobPoller.java#L109-L111). The [**default thread pool size is one**](https://github.com/camunda-cloud/zeebe/blob/760074f59bc1bcfb483fab4645501430f362a475/clients/java/src/main/java/io/camunda/zeebe/client/impl/ZeebeClientBuilderImpl.java#L49). If you need more, you can enable a thread pool:

```java
ZeebeClient client = ZeebeClient.newClientBuilder()
  .numJobWorkerExecutionThreads(5)
  .build();
```

In the Camunda Spring Boot Starter, you can do this using a [configuration](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/configuration#execution-threads).

Now, you can **leverage blocking code** for your REST call, for example, the `RestTemplate` inside Spring:

```java
@JobWorker(type = "rest", autoComplete = false)
public void blockingRestCall(final JobClient client, final ActivatedJob job) {
  LOGGER.info("Invoke REST call...");
  String response = restTemplate.getForObject( // <-- blocking call
    PAYMENT_URL, String.class);
  LOGGER.info("...finished. Complete Job...");
  client.newCompleteCommand(job.getKey()).send()
    .join(); // <-- this blocks to wait for the response
  LOGGER.info(counter.inc());
}
```

Doing so **limits** the degree of parallelism to the number of threads you have configured. You can [observe in the logs](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/results/java-blocking-thread-1.log) that jobs are executed sequentially when running with one thread ([the code is available on GitHub)](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/java-worker/src/main/java/io/berndruecker/experiments/cloudclient/java/RestInvocationWorker.java):

```
10:57:00.258 [pool-4-thread-1] Invoke REST call…
10:57:00.258 [ault-executor-0] Activated 32 jobs for worker default and job type rest
10:57:00.398 [pool-4-thread-1] …finished. Complete Job…
10:57:00.446 [pool-4-thread-1] …completed (1). Current throughput (jobs/s ): 1
10:57:00.446 [pool-4-thread-1] Invoke REST call…
10:57:00.562 [pool-4-thread-1] …finished. Complete Job…
10:57:00.648 [pool-4-thread-1] …completed (2). Current throughput (jobs/s ): 2
10:57:00.648 [pool-4-thread-1] Invoke REST call…
10:57:00.764 [pool-4-thread-1] …finished. Complete Job…10:57:00.805 [pool-4-thread-1] …completed (3). Current throughput (jobs/s ): 3
```

If you experience a large number of jobs, and these jobs are waiting for IO the whole time — as REST calls do — Java 21 virtual threads are usually a good default. You can also use **reactive programming**, especially for extremely high-throughput or low-latency scenarios where you have measured that its lower overhead matters. For the REST call, this means for example the Spring WebClient:

```java
@JobWorker(type = "rest", autoComplete = false)
public void nonBlockingRestCall(final JobClient client, final ActivatedJob job) {
  LOGGER.info("Invoke REST call...");
  Flux<String> paymentResponseFlux = WebClient.create()
    .get().uri(PAYMENT_URL).retrieve()
    .bodyToFlux(String.class);

  // non-blocking, so we register the callbacks (for happy and exceptional case)
  paymentResponseFlux.subscribe(
    response -> {
      LOGGER.info("...finished. Complete Job...");
      client.newCompleteCommand(job.getKey()).send()
         // non-blocking, so we register the callbacks (for happy and exceptional case)
         .thenApply(jobResponse -> { LOGGER.info(counter.inc()); return jobResponse;})
         .exceptionally(t -> {throw new RuntimeException("Could not complete job: " + t.getMessage(), t);});
    },
    exception -> {
       LOGGER.info("...REST invocation problem: " + exception.getMessage());
       client.newFailCommand(job.getKey())
         .retries(1)
         .errorMessage("Could not invoke REST API: " + exception.getMessage()).send()
         .exceptionally(t -> {throw new RuntimeException("Could not fail job: " + t.getMessage(), t);});
    }
  );
}
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
