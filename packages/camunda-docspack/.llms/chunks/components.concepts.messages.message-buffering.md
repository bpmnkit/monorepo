# Messages — Message buffering

Messages can be buffered for a given time. Buffering can be useful in a situation when it's not guaranteed the subscription is opened before the message is published.

A message has a **time-to-live (TTL)** which specifies for how long it's buffered. Within this time, the message can be correlated to a process instance.

When a subscription is opened, it polls the buffer for a proper message. If a proper message exists, it is correlated to the corresponding process instance. In case multiple messages match to the subscription, the first published message is correlated (like a FIFO queue).

The buffering of a message is disabled when its TTL is set to zero. If no proper subscription is open, the message is discarded.

   Publish message with TTL via Orchestration Cluster REST API
   

```
curl -L 'http://localhost:8080/v2/messages/publication' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "name": "Money collected",
  "correlationKey": "order-123",
  "timeToLive": 3600000
}'
```

See the [API reference for publish message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/publish-message.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
