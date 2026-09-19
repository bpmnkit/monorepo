# Connecting the workflow engine with your world — Connectors

The glue code is relatively simple, but you need to write code. You might prefer using an out-of-the-box component, connecting Zeebe with the technology you need just by configuration. This component is called a **Connector**.

A connector can be uni or bidirectional and is typically one dedicated application that implements the connection that translates in one or both directions of communication. Such a connector might also be helpful in case integrations are not that simple anymore.

![Connectors](connecting-the-workflow-engine-with-your-world-assets/connector.png)

For example, the [HTTP connector](https://github.com/camunda-community-hub/zeebe-http-worker) is a one-way connector that contains a job worker that can process service tasks doing HTTP calls as visualized in the example in the following figure:

![REST connectors](connecting-the-workflow-engine-with-your-world-assets/rest-connector.png)

Another example is the [Kafka connector](https://github.com/camunda-community-hub/kafka-connect-zeebe), as illustrated below.

![Kafka connector](connecting-the-workflow-engine-with-your-world-assets/kafka-connector.png)

This is a bidirectional connector which contains a Kafka listener for forwarding Kafka records to Zeebe and also a job worker which creates Kafka records every time a service task is executed. In other words, the connector helps Kafka exchange events with Zeebe; it does not replace Zeebe's own workflow execution or state handling. This is illustrated by the following example:

![Kafka connector Details](connecting-the-workflow-engine-with-your-world-assets/kafka-connector-details.png)

### Out-of-the-box connectors

As well as Camunda-maintained connectors, additional connectors are maintained by the community (made up of consultants, partners, customers, and enthusiastic individuals). You can find a list of connectors in the [Camunda Marketplace](https://marketplace.camunda.com/).

### Reusing your own integration logic by extracting connectors

If you need to integrate with certain infrastructure regularly, for example your CRM system, you might also want to create your own CRM connector, run it centralized, and reuse it in various applications.

In general, we recommend not to start such connectors too early. Don’t forget that such a connector gets hard to adjust once in production and reused across multiple applications. Also, it is often much harder to extract all configuration parameters correctly and fill them from within the process, than it would be to have bespoke glue code in the programming language of your choice.

Therefore, only extract a full-blown connector if you understand exactly what you need.

Don’t forget about the possibility to extract common glue code in a simple library that is then used at different places.

**Note**
Updating a library that is used in various other applications can be harder than updating one central connector. In this case, the best approach depends on your scenario.

Whenever you have such glue code running and really understand the implications of making it a connector, as well as the value it will bring, it can make a lot of sense.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
