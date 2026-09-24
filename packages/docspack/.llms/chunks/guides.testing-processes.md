# Testing Processes

Camunda's own process-testing library, Camunda Process Test, is written for Java, and its
JavaScript port starts a Zeebe container. `@bpmnkit/engine/testing` gives TypeScript teams
the same style of test without either. It runs your BPMN on the in-process
[simulator](/docs/guides/simulation), so a test file is ordinary Vitest or Jest and a whole
suite finishes in milliseconds.

It gives you:

- **Job mocks** by job type, with fixed results, failures, BPMN errors or a handler.
- **Manual job completion** for tasks you want to drive step by step, user tasks included.
- **Connector mocks** that map a fake response through the task's `resultVariable` and
  `resultExpression`, the same way the connector runtime does.
- **A virtual clock.** `advanceTime("P1D")` fires timers at once, with no real waiting.
- **Matchers** such as `toHaveCompleted()`, `toHavePassed([...])` and
  `toHaveVariables({...})`.
- **Path coverage** of the flow nodes and sequence flows your runs reached.
- **AI agent mocks** that script or replay which tools an agent calls. See
  [Testing AI Agents](/docs/guides/testing-ai-agents).

The simulator is not Zeebe. Before you rely on a test, read
[what the simulator does not execute](#what-the-simulator-does-not-execute).

---
Source: https://bpmnkit.com/docs/guides/testing-processes
