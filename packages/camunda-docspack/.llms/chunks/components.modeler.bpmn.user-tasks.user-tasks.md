# User tasks

A user task is used to model work that needs to be done by a human actor.

A user task is used to model work that needs to be done by a human and is assisted by a workflow engine or software application. This differs from [manual tasks](https://docs.camunda.io/docs/next/components/modeler/bpmn/manual-tasks/manual-tasks), which are not assisted by external tooling.

When the process instance arrives at a user task, a new user task instance is created at Zeebe.
The process instance stops at this point and waits until the user task instance is completed.
When the user task instance is completed, the process instance continues.

![user-task](assets/user-task.png)

Inside an [ad-hoc sub-process](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses), a user task is commonly the [human-in-the-loop](https://docs.camunda.io/docs/next/reference/glossary#human-in-the-loop-hitl) tool an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) calls to escalate a decision or request approval before continuing. See [designing agent orchestration workflows](https://docs.camunda.io/docs/next/components/agentic-orchestration/design-architecture#design-agent-orchestration-workflows) for this pattern.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/user-tasks/user-tasks
