# Connecting the workflow engine with your world — Programming glue code — Calling Zeebe

Using the Zeebe client’s API, you can communicate with the workflow engine. The two most important API calls are to start new process instances and to correlate messages to a process instance.

**Start process instances using the** [**Java Client**](https://docs.camunda.io/docs/next/apis-tools/java-client/getting-started)**:**

```java
processInstance = zeebeClient.newCreateInstanceCommand()
  .bpmnProcessId("someProcess").latestVersion()
  .variables( someProcessVariablesAsMap )
  .send()
  .exceptionally( throwable -> { throw new RuntimeException("Could not create new instance", throwable); });
```

<!-- **Start process instances using the** **Node.js client****:**

```js
const processInstance = await zbc.createWorkflowInstance({
  bpmnProcessId: "someProcess",
  version: 5,
  variables: {
    testData: "something",
  },
});
``` -->

**Correlate messages to process instances using the Java Client**:

```java
zeebeClient.newPublishMessageCommand() //
  .messageName("messageA")
  .messageId(uniqueMessageIdForDeduplication)
  .correlationKey(message.getCorrelationid())
  .variables(singletonMap("paymentInfo", "YeahWeCouldAddSomething"))
  .send()
  .exceptionally( throwable -> { throw new RuntimeException("Could not publish message " + message, throwable); });
```

**Correlate messages to process instances using the Node.js client**:

```js
zbc.publishMessage({
  name: "messageA",
  messageId: messageId,
  correlationKey: correlationId,
  variables: {
    valueToAddToWorkflowVariables: "here",
    status: "PROCESSED",
  },
  timeToLive: Duration.seconds.of(10),
});
```

This allows you to connect Zeebe with any external system by writing some custom glue code. We will look at common technology examples to illustrate this in a minute.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
