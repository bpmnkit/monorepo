# Receive tasks

Receive tasks reference a message; these are used to wait until a proper message is received.

Receive tasks reference a message; these are used to wait until a proper message is received.

![Receive Tasks](assets/receive-tasks.png)

When a receive task is entered, a corresponding message subscription is created. The process instance stops at this point and waits until the message is correlated.

A message can be published using one of the Zeebe clients. When the message is correlated, the receive task is completed and the process instance continues.

**Note**
An alternative to receive tasks is [a message intermediate catch event](https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events), which behaves the same way but can be used together with event-based gateways.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks
