# Writing good workers — Client library examples — C#

Using the [C# client](https://github.com/camunda/camunda-platform-get-started/tree/master/csharp), you can write worker code like this:

```csharp
zeebeClient.NewWorker()
  .JobType("payment")
  .Handler(JobHandler)
  .HandlerThreads(3)
  .Name("MyPaymentWorker")
  .Open()
```

You can observe that you can set a number of handler threads. Interestingly, this is a naming legacy. The C# client uses the [Dataflow Task Parallel Library (TPL)](https://docs.microsoft.com/en-us/dotnet/standard/parallel-programming/dataflow-task-parallel-library) to implement parallelism, so the thread count configures the degree of parallelism allowed to TPL in reality. Internally, this is implemented as a mixture of event loop and threading, which is an implementation detail of TPL. This is a great foundation to scale the worker.

You need to provide a handler. For this handler, you have to make sure to write non-blocking code; the following example shows this for a REST call using the [HttpClient](https://docs.microsoft.com/en-us/dotnet/api/system.net.http.httpclient?view=net-5.0) library:

```csharp
private static async void NonBlockingJobHandler(IJobClient jobClient, IJob activatedJob)
{
  Log.LogInformation("Invoke REST call...");
  var response = await httpClient.GetAsync("/");
  Log.LogInformation("...finished. Complete Job...");
  var result = await jobClient.NewCompleteJobCommand(activatedJob).Send();
  counter.inc();
}
```

The code is executed in parallel, [as you can observe in the logs](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/results/dotnet-nonblocking.log). Interestingly, the following code runs even faster for me, but [that’s a topic for another discussion](https://stackoverflow.com/questions/21403023/performance-of-task-continuewith-in-non-async-method-vs-using-async-await):

```csharp
private static void NonBlockingJobHandler(IJobClient jobClient, IJob activatedJob)
{
  Log.LogInformation("Invoke REST call...");
  var response = httpClient.GetAsync("/").ContinueWith( response => {
    Log.LogInformation("...finished. Complete Job...");
    jobClient.NewCompleteJobCommand(activatedJob).Send().ContinueWith( result => {
      if (result.Exception==null) {
        counter.inc();
      } else {
        Log.LogInformation("...could not do REST call because of: " + result.Exception);
      }
    });
  });
}
```

In contrast to Node.js, you can also write **blocking code** in C# if you want to (or more probable: it happens by accident):

```csharp
private static async void BlockingJobHandler(IJobClient jobClient, IJob activatedJob)
{
  Log.LogInformation("Invoke REST call...");
  var response = httpClient.GetAsync("/").Result;
  Log.LogInformation("...finished. Complete Job...");
  await jobClient.NewCompleteJobCommand(activatedJob).Send();
  counter.inc();
}
```

The degree of parallelism is down to one again, [according to the logs](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/results/dotnet-blocking-thread-1.log). So C# is comparable to Java, just that the typically used C# libraries are reactive by default, whereas Java still knows just too many blocking libraries. The recommendations for C#:

|              | Blocking code                                                                                                                          | Reactive code                                                                                                    |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Parallelism  | Some parallelism is possibly by a thread pool, which is used by the client library.                                                    | A processing loop combined with an internal thread pool, both are details of the framework and runtime platform. |
| **Use when** | **Rarely**, and only if you don't have requirements to process jobs in parallel or might even want to reduce the level or parallelism. | This should be the **default**                                                                                   |
|              | Your developers are not familiar with reactive programming                                                                             | You need to scale and have IO-intensive glue code (e.g. remote service calls like REST)                          |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
