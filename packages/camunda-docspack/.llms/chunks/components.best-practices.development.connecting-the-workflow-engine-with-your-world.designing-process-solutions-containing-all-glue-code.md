# Connecting the workflow engine with your world — Designing process solutions containing all glue code

Typical applications will include multiple pieces of glue code in one codebase.

![Architecture with glue code](connecting-the-workflow-engine-with-your-world-assets/architecture.png)

For example, the onboarding microservice shown in the figure above includes:

- A REST endpoint that starts a process instance (1)
- The process definition itself (2), probably auto-deployed to the workflow engine during the startup of the application.
- Glue code subscribing to the two service tasks that shall call a remote REST API (3) and (4).

A job worker will be started automatically as part of the application to handle the subscriptions. In this example, the application is written in Java, but again, it could be [any supported programming language](https://docs.camunda.io/docs/next/apis-tools/working-with-apis-tools).

As discussed in [writing good workers](https://docs.camunda.io/docs/next/components/best-practices/development/writing-good-workers), you typically will bundle all workers within one process solution, but there are exceptions where it makes sense to have single workers as separate application.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/connecting-the-workflow-engine-with-your-world
