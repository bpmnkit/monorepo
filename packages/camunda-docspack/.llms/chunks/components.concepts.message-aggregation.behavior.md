# Message aggregation — Behavior

The first message with a unique correlation key starts a process instance.

Each subsequent message with that same key is correlated to the same instance and appended to the list.

Once three messages are received (`count(messages) == 3`), the process continues to the **Process Aggregated Messages** task.


## Publishing messages

Here’s an example in Java using the Zeebe client:

```java
final ZeebeClient client = ZeebeClient.newClientBuilder().build();

for (int i = 0; i < 3; i++) {
  client.newPublishMessageCommand()
      .messageName("Message_Received")
      .correlationKey("order-123")
      .timeToLive(Duration.ofMinutes(5))
      .variables(Map.of(
          "message", "iteration #" + i + " order-123 " + Instant.now(),
          "correlation_key", "order-123"))
      .send()
      .join();
}
```

The first message starts the workflow; the next two correlate to the existing instance.

---
Source: https://docs.camunda.io/docs/next/components/concepts/message-aggregation
