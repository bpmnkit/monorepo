# Processes

Processes are flowchart-like blueprints that define the orchestration of tasks.

A [process](https://docs.camunda.io/docs/next/reference/glossary#process) is a defined sequence of distinct steps or tasks representing your business logic. For example, an e-commerce shopping experience or onboarding a new employee.

Process orchestration is the technology that coordinates the various moving parts, or endpoints, of a business process, and sometimes ties multiple processes together. It helps you work with the people, systems, and devices you already have, while achieving goals around end-to-end process automation.

With Camunda, you can orchestrate [human tasks](https://docs.camunda.io/docs/next/guides/getting-started-orchestrate-human-tasks), [microservices](https://docs.camunda.io/docs/next/guides/getting-started-example), [APIs](https://docs.camunda.io/docs/next/guides/getting-started-orchestrate-apis), and [AI agents](https://docs.camunda.io/docs/next/guides/getting-started-agentic-orchestration) as endpoints in the same process. For example, an order fulfillment process could run a fixed sequence of steps, then hand off a step to an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) that decides which tools to call, before returning control to the next fixed step.

A **[job worker](https://docs.camunda.io/docs/next/components/concepts/job-workers)** implements the business logic required to complete a task. You can choose to write a worker as a microservice, or also as part of a classical 3-tier application, as a \(lambda\) function, via command line tools, etc.

Running a process broadly requires three steps:

1. Deploy a process to Camunda 8.
2. Implement and register job workers for tasks in the workflows.
3. Create new instances of the process.

However, if you haven't yet, design the process:

---
Source: https://docs.camunda.io/docs/next/components/concepts/processes
