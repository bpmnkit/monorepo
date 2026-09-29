# Introduction to Camunda 8 — What are the Camunda 8 components?

### Connectors

Connectors communicate with any system or technology, reducing the time it takes to automate and orchestrate business processes. [Outbound connectors](https://docs.camunda.io/docs/next/reference/glossary#outbound-connector) trigger events outside of Camunda, while [inbound connectors](https://docs.camunda.io/docs/next/reference/glossary#inbound-connector) allow processes running on Camunda to receive messages from external systems. Connectors also serve as the tool layer for AI agents, enabling agents to interact with external systems in a governed, reusable way. Browse connectors in [Camunda Marketplace](https://marketplace.camunda.com/).

### AI agents

Build governed [AI agents](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) with guardrails so they can solve complex problems with autonomy. Camunda's [agentic BPMN](https://docs.camunda.io/docs/next/components/agentic-orchestration/ai-agents) lets teams model deterministic process logic and dynamic agentic behavior, such as reasoning loops, memory, prompts, RAG, and human‑in‑the‑loop boundaries, in one unified, executable model.

### Forms

Some automated processes require human contribution and interaction. [Create and implement custom forms](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/modeling/utilize-forms) that give work instructions, collect information, and help people make decisions about the tasks they need to complete.

### Tasklist

[Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist) offers a lightweight, user-friendly interface for human work, tightly integrated with custom forms. It provides an out-of-the-box user interface for tasks so teams can rapidly iterate on process development without having to build a custom frontend application.

### Workflow and decision engine

[Zeebe](https://docs.camunda.io/docs/next/components/zeebe/zeebe-overview) is a distributed workflow and decision engine that replaces a traditional relational database with an event streaming, message-based architecture. This approach eliminates database bottlenecks, ensures horizontal scalability, and provides built-in resilience.

### Operate

With [Operate](https://docs.camunda.io/docs/next/components/operate/operate-introduction), teams can monitor running processes, troubleshoot and resolve incidents, and modify and migrate process instances. Trace process flows in real time, investigate failures, modify variables, and resume execution where needed, all within the context of the end-to-end business process. For AI-assisted processes, Operate provides visibility into agent actions and decisions at runtime, enabling teams to detect and resolve unexpected behavior.

### Optimize

[Optimize](https://docs.camunda.io/docs/next/components/optimize/what-is-optimize) leverages process execution data to continuously [provide actionable insights](https://docs.camunda.io/docs/next/components/optimize/improve-processes-with-optimize). Optimize specializes in BPMN-based analysis and can show users exactly what their process model needs for successful execution.

### Camunda Hub

[Camunda Hub](https://docs.camunda.io/docs/next/components/hub/index) is a unified platform for managing organizational resources and delivering business processes. It's organized into two levels: organization and workspace.

- **Organization level**: This is the management and governance layer. Center of excellence teams govern the infrastructure and tooling delivery teams need, including managing users, runtime environments, a catalog of shared reusable resources, and workspaces.
- **Workspace level**: This is the process modeling and delivery layer. Delivery teams design business process and decision models, discover and use approved catalog assets, and deploy projects to development, testing, staging, and production environments.

With this separation, center of excellence teams govern infrastructure and standards at the organization level, while delivery teams work within organizational guardrails to design, test, and deploy business solutions at the workspace level.

### Desktop Modeler

[Desktop Modeler](https://docs.camunda.io/docs/next/components/modeler/desktop-modeler/index) is a standalone desktop application for modeling business processes. Desktop Modeler gives business users and developers an intuitive way to design fully-executable process and decision models so their intent is clear, structured, and directly usable by developers. At the same time, Desktop Modeler integrates into your preferred IDE and local filesystem for a professional software development setup.

---
Source: https://docs.camunda.io/docs/next/components/concepts/concepts-overview
