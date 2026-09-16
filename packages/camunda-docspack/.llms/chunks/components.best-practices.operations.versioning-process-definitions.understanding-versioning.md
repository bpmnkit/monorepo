# Versioning process definitions — Understanding versioning

By default, deploying a process or decision definition means that the workflow engine will check if the version has changed. If it has, it will register that deployment as a new version of the definition. By default, running instances will continue to run on the basis of the version they started with, new instances will be created based on the latest version of that definition.

![Versions](versioning-process-definitions-assets/database-versions.png)

Agents in your process are versioned the same way. Deploying a new version of a process creates a new [agent definition](https://docs.camunda.io/docs/next/components/agentic-orchestration/agent-definitions-and-instances#agent-definitions) for each of its agent elements, bound to that process definition version.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/operations/versioning-process-definitions
