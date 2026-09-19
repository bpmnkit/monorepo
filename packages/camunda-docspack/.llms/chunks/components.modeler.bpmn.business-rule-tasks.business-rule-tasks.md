# Business rule tasks

A business rule task is used to model the evaluation of a business rule.

A business rule task is used to model the evaluation of a business rule. For example, a decision
modeled in [Decision Model and Notation](https://www.omg.org/dmn/) (DMN).

![task](assets/business-rule-task.png)

**Info**
Camunda 8 supports alternative task implementations for the business rule task. If you want
to use your own implementation for a business rule task, refer to the [job worker
implementation](#job-worker-implementation) section below. The sections before this job worker implementation apply to the DMN
decision implementation only.

**Info**
If you only want to evaluate a DMN decision, you can use the
[`EvaluateDecision`](https://docs.camunda.io/docs/next/apis-tools/zeebe-api/gateway-service#evaluatedecision-rpc) API.

When the process instance arrives at a business rule task, a decision is evaluated using the
internal DMN decision engine. Once the decision is made, the process instance continues.

If the decision evaluation is unsuccessful, an [incident](https://docs.camunda.io/docs/next/components/concepts/incidents) is
raised at the business rule task. When the incident is resolved, the decision is evaluated again.

Used as a tool inside an [ad-hoc sub-process](https://docs.camunda.io/docs/next/components/modeler/bpmn/ad-hoc-subprocesses/ad-hoc-subprocesses), a business rule task lets an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent) delegate part of its decision to a governed DMN decision instead of LLM reasoning, keeping that step deterministic. See [AI agent tool definitions](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-tool-definitions) for how tools are declared.

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/business-rule-tasks/business-rule-tasks
