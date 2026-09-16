# Element templates

An element template is a way to extend the Modeler with domain-specific diagram elements.

An **element template** extends the [Modeler](https://docs.camunda.io/docs/next/components/modeler/about-modeler) with domain-specific diagram elements, such as service and user tasks. They allow you to customize how a BPMN element is displayed and how it can be configured by process developers.

The example below shows how a generic service task can be transformed into a customized user interface that guides users through its configuration:

| Without an element template                                                                        | With an element template                                                                          |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| ![Service task without an element template](assets/element-templates/service-task-no-template.svg) | ![Service task with an element template](assets/element-templates/service-task-with-template.svg) |
|               |               |

**Tip**
[Connector templates](https://docs.camunda.io/docs/next/components/connectors/custom-built-connectors/connector-templates) are a specific type of element template. For example, the [AI Agent Sub-process connector](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-subprocess) template configures an AI agent's ad-hoc sub-process using this same mechanism.

---
Source: https://docs.camunda.io/docs/next/components/concepts/element-templates
