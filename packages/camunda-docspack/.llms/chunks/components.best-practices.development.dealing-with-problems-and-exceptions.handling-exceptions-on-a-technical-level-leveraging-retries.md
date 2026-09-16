# Dealing with problems and exceptions — Handling exceptions on a technical level — Leveraging retries

Using the [`FailJob `](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#failjob-rpc) API is pretty handy to leverage the built-in retry mechanism of Zeebe. The initial number of retries is set in the BPMN process model:

```xml
    <bpmn:serviceTask id="TaskRetrieveMoney">
      <bpmn:extensionElements>
        <zeebe:taskDefinition retries="5" />
      </bpmn:extensionElements>
    </bpmn:serviceTask>
```

This number is typically decremented with every attempt to execute the service task. Note that you need to do that in your worker code. Example in Java:

```java
  @JobWorker(type = "retrieveMoney", autoComplete = false)
  public void retrieveMoney(final JobClient client, final ActivatedJob job) {
    try {
        // your code
    } catch (Exception ex) {
        jobClient.newFailCommand(job)
          .retries(job.getRetries()-1) // <1>: Decrement retries
          .errorMessage("Could not retrieve money due to: " + ex.getMessage()) // <2>
          .send()
          .exceptionally(t -> {throw new RuntimeException("Could not fail job: " + t.getMessage(), t);});
    }
  }
```

**(1)**

Decrement the retries by one.

**(2)**

Provide a meaningful error message, as this will be displayed to a human operator once an incident is created in Operate.

Example in Node.js:

```js
zbc.createWorker("retrieveMoney", (job) => {
  try {
    // ...
  } catch (e) {
    job.fail("Could not retrieve money due to: " + e.message, job.retries - 1);
  }
});
```

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
