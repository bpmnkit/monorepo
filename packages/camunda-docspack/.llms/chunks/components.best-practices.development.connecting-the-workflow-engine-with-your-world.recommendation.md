# Connecting the workflow engine with your world — Recommendation

As a general rule of thumb, prefer custom glue code whenever you don’t have a good reason to go with an existing connector.

A good reason to use connectors is if you need to solve complex integrations where little customization is needed, such as the [Camunda RPA bridge](https://docs.camunda.org/manual/latest/user-guide/camunda-bpm-rpa-bridge/) to connect RPA bots (soon to be available for Camunda 8).

Good use of connectors are also scenarios where you don’t need custom glue code. For example, when orchestrating serverless functions on AWS with the [AWS Lambda connector](https://github.com/camunda-community-hub/zeebe-lambda-worker). This connector can be operated once and used in different processes.

Some use cases also allow you to create a **reusable generic adapter**; for example, to send status events to your business intelligence system.

But there are also common downsides with connectors. First, the possibilities are limited to what the creator of the connector has foreseen. In reality, you might have slightly different requirements and hit a limitation of a connector.

Second, the connector requires you to operate this connector in addition to your own application. The complexity associated with this depends on your environment.

Third, testing your glue code gets harder, as you can’t easily hook in mocks into such a connector as you could in your own glue code.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
