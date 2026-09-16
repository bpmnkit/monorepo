# Testing process definitions — Writing process tests in Java

This section describes how to write process tests as unit tests in Java. We are working on additional information for writing tests in other languages, such as Node.js or C#.

When using Java, most customers use Spring Boot, so we describe this approach in this best practice. While this is a common setup for customers, it is not the only one. Find more examples of plain Java process tests in [Getting Started with Camunda Process Test](https://docs.camunda.io/docs/next/apis-tools/testing/getting-started).

If your process hands a step to an AI agent, the same Camunda Process Test setup applies, but the tool calls the agent makes are not fixed in advance. See [test your AI agents](https://docs.camunda.io/docs/next/components/agentic-orchestration/evaluate-agents/test-ai-agents#step-4-handle-non-deterministic-flow-paths) for more details.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/testing-process-definitions
