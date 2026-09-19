# Writing good workers — Client library examples — Node.js client

Using the [Node.js client](https://github.com/camunda/camunda-8-js-sdk), your worker code will look like this, assuming that you use Axios to do rest calls (but of course any other library is fine as well):

```js
zbc.createWorker({
  taskType: "rest",
  taskHandler: (job) => {
    console.log("Invoke REST call...");
    axios
      .get(PAYMENT_URL)
      .then((response) => {
        console.log("...finished. Complete Job...");
        job.complete().then((result) => {
          incCounter();
        });
      })
      .catch((error) => {
        job.fail("Could not invoke REST API: " + error.message);
      });
  },
});
```

This is **reactive code**. And a really interesting observation is that reactive programming is so deep in the JavaScript language that it is impossible to write blocking code, even code that looks blocking is still [executed in a non-blocking fashion](https://github.com/berndruecker/camunda-cloud-clients-parallel-job-execution/blob/main/results/nodejs-blocking.log).

Node.js code scales pretty well and there is no specific thread pool defined or necessary. The Camunda 8 Node.js client library also [uses reactive programming internally](https://github.com/camunda/camunda-8-js-sdk/blob/main/src/zeebe/zb/ZBWorker.ts#L27).

This makes the recommendation very straight-forward:

|              | Reactive code                  |
| ------------ | ------------------------------ |
| Parallelism  | Event loop provided by Node.js |
| **Use when** | Always                         |

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers
