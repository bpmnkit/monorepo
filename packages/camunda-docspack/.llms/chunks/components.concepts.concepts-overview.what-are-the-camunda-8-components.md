# Introduction to Camunda 8 — What are the Camunda 8 components?

### Modeler

Design fully-executable process and decision models that reduce misalignment and handoff friction while giving engineers the freedom they need to build the right solution. Camunda Modeler gives business users an intuitive way to model processes and decisions using the BPMN and DMN standards so their intent is clear, structured, and directly usable by developers. Developers can take the model as-is and build scalable, flexible solutions without worrying about losing alignment with business intent. Available via [Camunda Hub](https://docs.camunda.io/docs/next/components/hub/workspace/modeler/index) and a dedicated [desktop app](https://docs.camunda.io/docs/next/components/modeler/desktop-modeler/index).

#### Connectors

Connectors communicate with any system or technology, reducing the time it takes to automate and orchestrate business processes. [Outbound connectors](https://docs.camunda.io/docs/next/reference/glossary#outbound-connector) trigger events outside of Camunda, while [inbound connectors](https://docs.camunda.io/docs/next/reference/glossary#inbound-connector) allow processes running on Camunda to receive messages from external systems. Connectors also serve as the tool layer for AI agents, enabling agents to interact with external systems in a governed, reusable way. Browse connectors in [Camunda Marketplace](https://marketplace.camunda.com/).

#### AI agents

Build governed [AI agents](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) with guardrails so they can solve complex problems with autonomy. Camunda's [agentic BPMN](https://docs.camunda.io/docs/next/components/agentic-orchestration/ai-agents) lets teams model deterministic process logic and dynamic agentic behavior, such as reasoning loops, memory, prompts, RAG, and human‑in‑the‑loop boundaries, in one unified, executable model.

#### Forms

Some automated processes require human contribution and interaction. [Create and implement custom forms](https://docs.camunda.io/docs/next/components/modeler/forms/utilizing-forms) that give work instructions, collect information, and help people make decisions about the tasks they need to complete.

### Tasklist

[Tasklist](https://docs.camunda.io/docs/next/components/tasklist/introduction-to-tasklist) offers a lightweight, user-friendly interface for human work, tightly integrated with custom forms. It provides an out-of-the-box user interface for tasks so teams can rapidly iterate on process development without having to build a custom frontend application.

### Workflow and decision engine

[Zeebe](https://docs.camunda.io/docs/next/components/zeebe/zeebe-overview) is a distributed workflow and decision engine that replaces a traditional relational database with an event streaming, message-based architecture. This approach eliminates database bottlenecks, ensures horizontal scalability, and provides built-in resilience.

### Operate

With [Operate](https://docs.camunda.io/docs/next/components/operate/operate-introduction), teams can monitor running processes, troubleshoot and resolve incidents, and modify and migrate process instances. Trace process flows in real time, investigate failures, modify variables, and resume execution where needed, all within the context of the end-to-end business process. For AI-assisted processes, Operate provides visibility into agent actions and decisions at runtime, enabling teams to detect and resolve unexpected behavior.

### Optimize

[Optimize](https://docs.camunda.io/docs/next/components/optimize/what-is-optimize) leverages process execution data to continuously [provide actionable insights](https://docs.camunda.io/docs/next/components/optimize/improve-processes-with-optimize). Optimize specializes in BPMN-based analysis and can show users exactly what their process model needs for successful execution.

### Camunda Hub

With [Camunda Hub](https://docs.camunda.io/docs/next/components/hub/index), you'll manage organizational resources, analyze operations and business value, and deliver agentic processes at scale with Camunda Hub.

---
Source: https://docs.camunda.io/docs/next/components/concepts/concepts-overview
