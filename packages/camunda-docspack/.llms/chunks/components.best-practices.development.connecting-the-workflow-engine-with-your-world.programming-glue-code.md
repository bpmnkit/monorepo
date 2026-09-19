# Connecting the workflow engine with your world — Programming glue code

To write code that connects to Zeebe, you typically embed [the Zeebe client library](https://docs.camunda.io/docs/next/apis-tools/working-with-apis-tools) into your application. An application can of course also be a service or microservice.

If you have multiple applications that connect to Zeebe, all of them will require the client library. If you want to use a programming language where no such client library exists, you can [generate a gRPC client yourself](https://camunda.com/blog/2018/11/grpc-generating-a-zeebe-python-client/).

![Clients to Zeebe](connecting-the-workflow-engine-with-your-world-assets/clients.png)

Your application can basically do two things with the client:

1. **Actively call Zeebe**, for example, to start process instances, correlate messages, or deploy process definitions.
2. **Subscribe to tasks** created in the workflow engine in the context of BPMN service tasks.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
