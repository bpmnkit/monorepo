# Service integration patterns with BPMN — Integrating services with BPMN events — Message type on the wire != BPMN message type

There is one important detail worth mentioning in the context of message response patterns: The message type used in BPMN models does not have to be exactly the message type you get on the wire. When you correlate technical messages, e.g. from AMQP, you typically write a piece of glue code that receives the message and calls the workflow engine API. This is described in [connecting the workflow engine with your world](https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world), including a code example. In this glue code you can do various transformations, for example:

- Messages on different message queues could lead to the same BPMN message type, probably having some additional parameter in the payload indicating the origin.
- Some message header or payload attributes could be used to select between different BPMN message types being used.

It is probably not best practice to be as inconsistent as possible between technical message types and BPMN message types. Still, the flexibility of a custom mapping might be beneficial in some cases.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/service-integration-patterns
