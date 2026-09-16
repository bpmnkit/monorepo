# Messages

Learn how process instances can respond to incoming messages.

[Process instances](https://docs.camunda.io/docs/next/reference/glossary#process-instance) can respond to incoming [messages](https://docs.camunda.io/docs/next/reference/glossary#message). Published messages must be mapped onto a process instance. This step is called [message correlation](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events#message-correlation).


## Message subscriptions

A message is not sent to a process instance directly. Instead, the message correlation is based on subscriptions that contain the `message name` and the `correlation key` (also known as the correlation value).

![Message Correlation](assets/message-correlation.png)

A subscription is opened when a process instance awaits a message; for example, when entering a message catch event. The message name is defined either statically in the process (e.g. `Money collected`) or dynamically as an expression. The correlation key is defined dynamically as an expression (for example, `= orderId`). The expressions are evaluated on activating the message catch event. The results of the evaluations are used as message name and as correlation key of the subscription (e.g. `"order-123"`).

**Note**
Message names and correlation keys are subject to backend-dependent length limits. They support up to **32,768 characters** with Elasticsearch/OpenSearch-backed secondary storage and up to **256 characters** with RDBMS-backed secondary storage. Length is enforced using Java string length semantics, so the effective visible-character limit can be lower for characters represented as surrogate pairs in Java.

When a message is published and the message name and correlation key match to a subscription, the message is correlated to the corresponding process instance. If no proper subscription is opened, the message is discarded.

A subscription is closed when the corresponding element (e.g. the message catch event), or its scope is left. After a subscription is opened, it is not updated (for example, when the referenced process variable is changed.)

   Publish message via Orchestration Cluster REST API
   

```
curl -L 'http://localhost:8080/v2/messages/publication' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
  "name": "Money collected",
  "correlationKey": "order-123"
}'
```

See the [API reference for publish message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/publish-message.api) for more information, including additional request fields and code samples.
When you require immediate feedback if the message was correlated to an open subscription, you can use `Correlate message` via Orchestration Cluster REST API. If correlation is successful it will return the first process instance key the message correlated with.

```
curl -L 'http://localhost:8080/v2/messages/correlation' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-d '{
"name": "Money collected",
"correlationKey": "order-123"
}'
```

See the [API reference for correlate message](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/correlate-message.api) for more information, including additional request fields and code samples.

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
