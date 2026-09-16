# Workflow patterns — Reacting to events — Correlation mechanisms

Mapping external messages to an existing process instance is called [message correlation](https://docs.camunda.io/docs/next/components/concepts/messages). This is a crucial functionality to ensure you can communicate with process instances from the outside.

There are two main problems to solve:

1. How to find the right process instance? In Camunda, this is solved by a `message name` and a `correlation key` (e.g. `orderCanceled` and `order-42`).

2. How to persist messages if a process instance is not yet ready to receive that message yet? In Camunda, this is solved by having an internal message store and a `time to live` attached to messages. This is related to [Workflow Pattern 24: Persistent Trigger](http://www.workflowpatterns.com/patterns/control/new/wcp24.php)

You can find more information in [our documentation about messages](https://docs.camunda.io/docs/next/components/concepts/messages).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
