# Messages — Message uniqueness

A message can have an optional message ID — a unique ID to ensure the message is published and processed only once (i.e. idempotency). The ID can be any string; for example, a request ID, a tracking number, or the offset/position in a message queue.

A message is rejected and not correlated if a message with the same name, the same correlation key, and the same ID is already buffered. After the message is discarded from the buffer, a message with the same name, correlation key, and ID can be published again.

The uniqueness check is disabled when no message ID is set.

   Publish message with message ID via Orchestration Cluster REST API
   

```
curl -L 'http://localhost:8080/v2/messages/publication' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "name": "Money collected",
  "correlationKey": "order-123",
  "messageId": "tracking-12345"
}'
```

See the [API reference for publish message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/publish-message.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
