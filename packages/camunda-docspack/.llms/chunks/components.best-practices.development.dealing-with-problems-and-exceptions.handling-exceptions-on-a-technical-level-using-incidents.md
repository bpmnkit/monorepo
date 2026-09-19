# Dealing with problems and exceptions — Handling exceptions on a technical level — Using incidents

Whenever a job fails with a retry count of `0`, an incident is raised. An incident requires human intervention, typically using Operate. Refer to [incidents in the Operate docs](https://docs.camunda.io/docs/next/components/operate/userguide/resolve-incidents-update-variables).

For example, this behavior also applies to tools called by an AI agent. Each tool the agent selects runs as an ordinary BPMN activity, so retries and incidents work as described above. See [how the feedback loop works](https://docs.camunda.io/docs/next/components/agentic-orchestration/ai-agents#how-the-feedback-loop-works).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
