# Messages — Message response

Publishing a message is a fire-and-forget action. As a user, you do not know if the correlation is a success.

To know if a published message was correlated (and to which process instance), use the [message correlation endpoint](https://docs.camunda.io/docs/next/apis-tools/orchestration-cluster-api-rest/specifications/correlate-message.api).

The message correlation endpoint works similarly to the message publish endpoint. However, the message correlation endpoint does not support [message buffering](#message-buffering). Any message published using this endpoint is either immediately correlated, or not correlated at all. This is due to the synchronous nature of requiring a response.

If a message correlated successfully, it returns a process instance key of an instance the message correlated with. This is only one key. It is possible that the message correlated to other process instances. These keys are not part of the response.

The response will always prioritize the creation of a new process instance ([message start event](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events#message-start-events)) over correlation with an existing process instance ([message catch event](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events#intermediate-message-catch-events) or [receive task](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks)).

---
Source: https://docs.camunda.io/docs/next/components/concepts/messages
