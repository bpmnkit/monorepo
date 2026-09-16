# Service integration patterns with BPMN — Integrating services with BPMN tasks — Receive task

A [receive task](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks) waits for an asynchronous message. Receive tasks **should be used for incoming asynchronous messages or events**, like AMQP messages or Kafka records.

![Receive task](service-integration-patterns-assets/receive-task.png)

Receive tasks can be used to receive the response in asynchronous request/response scenarios, which is discussed next.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
