# Message events — Intermediate message catch events

When an intermediate message catch event is entered, a corresponding message subscription is created. The process instance stops at this point and waits until the message is correlated. When a message is correlated, the catch event is completed and the process instance continues.

Inside an [ad-hoc sub-process](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses), an intermediate message catch event can also serve as an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) tool, for example to model a step where the agent sends a message and waits for a reply. See [message catch events as tools](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-tool-definitions#message-catch-events-as-tools) for the unique-correlation-key requirement that pattern needs.

**Note**
An alternative to intermediate message catch events is a [receive task](https://docs.camunda.io/docs/next/components/modeler/bpmn/receive-tasks/receive-tasks), which behaves the same but can be used together with boundary events.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/message-events/message-events
