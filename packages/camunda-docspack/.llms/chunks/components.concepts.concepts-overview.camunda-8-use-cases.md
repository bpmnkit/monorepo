# Introduction to Camunda 8 — Camunda 8 use cases

With Camunda 8, you can model, execute, and operate complex business processes from end to end, combining systems, human work, and AI agents.

Most real-world automation is distributed. A single business outcome (for example, customer onboarding, claims handling, or order fulfillment) often requires many independently deployed services and external systems. That makes it hard to keep the overall process visible, understand where work is waiting, and recover cleanly when something fails. Camunda provides a process orchestration layer that coordinates these endpoints without forcing you into a tightly-coupled architecture.

### Orchestrate distributed systems

Define process and decision logic using BPMN and DMN, then run it on a stateful, event-driven workflow engine designed for long-running, high-volume execution. This gives teams a consistent way to:

- Trigger work and correlate events across services.
- Handle retries and compensation when a step fails.
- Troubleshoot incidents across the full business process, not just within a single service.

[Learn about processes](https://docs.camunda.io/docs/next/components/concepts/processes)

### Coordinate human work

Many processes also require human input, either as a normal step (for example, review or approval) or as a fallback when automation can't proceed. With Camunda, you can model human tasks alongside automated steps, then assign, track, and escalate work so the process keeps moving.

For example, if customer onboarding is blocked waiting for a verification task, the process can route to the right person, enforce due dates, and make the delay visible in operations tooling.

[Learn about Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist)

### Orchestrate AI agents

Not every step in a process can be fully predetermined. When the right action depends on judgment, such as interpreting a document, deciding which check to run next, or triaging an exception, you can hand that step to an AI agent, then return to the fixed steps that follow. With Camunda, you can:

- Treat agents as process endpoints, just like a microservice or API call, and orchestrate them alongside deterministic steps and human checkpoints.
- Build agents directly in Camunda by modeling agent behavior such as planning loops, tool use, and reflection, including short-term and long-term memory and retrieval-augmented generation (RAG).
- Apply the same guardrails your process requires, such as role-based access control, compliance boundaries, incident recovery, and audit trails, to agent-driven steps.

Because agents run inside the same governed process, their actions are observable and auditable by default.

[Learn about agentic orchestration](https://docs.camunda.io/docs/next/components/agentic-orchestration/agentic-orchestration-overview)

### Common use cases

- Orchestrating microservices across complex integrations.
- Modernizing long-running processes that cross legacy systems.
- Coordinating human work with automation.
- Running AI-assisted steps, such as document interpretation or decision support, inside governed, end-to-end processes.

---
Source: https://docs.camunda.io/docs/next/components/concepts/concepts-overview
