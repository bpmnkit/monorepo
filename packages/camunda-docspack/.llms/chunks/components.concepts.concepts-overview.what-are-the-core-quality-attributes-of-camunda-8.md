# Introduction to Camunda 8 — What are the core quality attributes of Camunda 8?

Camunda 8 is designed to operate on a very large scale. To achieve this, it provides:

- **Horizontal scalability** and no dependence on an external database; [Zeebe](https://docs.camunda.io/docs/next/components/zeebe/zeebe-overview) (the workflow engine inside Camunda 8) writes data directly to the file system on the same servers where it is deployed. Zeebe enables distribution processing across a cluster of machines to deliver high throughput.
- **High availability and fault tolerance** via a pre-configured replication mechanism, ensuring Camunda 8 can recover from machine or software failure with no data loss and minimal downtime, including AI agents, which resume with their conversation state and progress intact. This ensures the system as a whole remains available without requiring manual action.
- **Audit trail** as all process-relevant events, including every AI agent decision and tool call, are written to an append-only log, providing an audit trail and a history of the state of a process.
- **Reactive publish-subscribe interaction model** which enables microservices that connect to Camunda 8 to maintain a high degree of control and autonomy, including control over processing rates. These properties make Camunda 8 resilient, scalable, and reactive.
- **Visual processes modeled in ISO-standard BPMN 2.0** so technical and business stakeholders can collaborate on process design in a widely-used modeling language.
- **Language-agnostic client model** makes it possible to build a client in nearly any programming language an organization uses to automate work.
- **Operational ease of use** because, as a SaaS provider, we take care of all operational details.

---
Source: https://docs.camunda.io/docs/next/components/concepts/concepts-overview
