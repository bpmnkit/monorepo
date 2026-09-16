# Routing events to processes — Technology examples for messages sent by external systems

In this section, we give examples for _technical messages_, which are received from other systems, typically by leveraging technologies like SOAP, REST, JMS, and others.

Diagram (BPMN): Invoice Receipt (Process Engine)
  start "Invoice received" → business rule task "Validate order" → intermediate catch event "Payment received" → call activity "Order Shipping" → end "Order processed"

**(1)**

You will need a mechanism receiving that message and routing it to the workflow engine. That could be a direct API call to Camunda. It could also be a AMQP or Kafka consumer or a SOAP endpoint using the Camunda API internally. It could even be a hotfolder polled by some framework like Apache Camel.

API examples for REST, AMQP, and Kafka are shown in [connecting the workflow engine with your world](https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/routing-events-to-processes
