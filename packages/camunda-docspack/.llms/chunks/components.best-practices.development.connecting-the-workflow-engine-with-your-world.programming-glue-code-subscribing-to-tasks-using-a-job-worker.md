# Connecting the workflow engine with your world — Programming glue code — Subscribing to tasks using a job worker

To implement service tasks of a process model, you can write code that subscribes to the workflow engine. In essence, you will write some glue code that is called whenever a service task is reached (which internally creates a job, hence the name).

**Glue code in Java:**

```java
class ExampleJobHandler implements JobHandler {
  public void handle(final JobClient client, final ActivatedJob job) {
    // here: business logic that is executed with every job
    client.newCompleteCommand(job.getKey()).send()
      .exceptionally( throwable -> { throw new RuntimeException("Could not complete job " + job, throwable); });;
  }
}
```

**Glue code in Node.js:**

```js
function handler(job, complete, worker) {
  // here: business logic that is executed with every job
  complete.success();
}
```

Now, this handler needs to be connected to Zeebe, which is generally done by subscriptions, which internally use long polling to retrieve jobs.

**Open subscription via the Zeebe Java client:**

```java
zeebeClient
  .newWorker()
  .jobType("serviceA")
  .handler(new ExampleJobHandler())
  .timeout(Duration.ofSeconds(10))
  .open()) {waitUntilSystemInput("exit");}
```

**Open subscription via the Zeebe Node.js client:**

```js
zbc.createWorker({
  taskType: "serviceA",
  taskHandler: handler,
});
```

You can also use integrations in certain programming frameworks, like the [Camunda Spring Boot Starter](https://docs.camunda.io/docs/next/apis-tools/camunda-spring-boot-starter/getting-started) in the Java world, which starts the job worker and implements the subscription automatically in the background for your glue code.

**A subscription for your glue code is opened automatically by the Spring integration:**

```java
@JobWorker(type = "serviceA")
public void handleJobFoo(final JobClient client, final ActivatedJob job) {
  // here: business logic that is executed with every job
  // you do not need to call "complete" on the job, as autoComplete is turned on above
}
```

There is also documentation on [how to write a good job worker](https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
