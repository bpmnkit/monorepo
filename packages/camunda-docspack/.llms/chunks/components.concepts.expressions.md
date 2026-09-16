# Expressions

Expressions can be used to access variables and calculate values dynamically. This is useful when automating a process using BPMN and orchestrating human tasks.

Expressions can be used to access variables and calculate values dynamically.

This is particularly useful when [automating a process using BPMN](https://docs.camunda.io/docs/next/components/modeler/bpmn/automating-a-process-using-bpmn), [orchestrating human tasks](https://docs.camunda.io/docs/next/guides/getting-started-orchestrate-human-tasks), or implementing [agentic orchestration](https://docs.camunda.io/docs/next/components/agentic-orchestration/agentic-orchestration-overview).

Some attributes of BPMN elements _require_ an expression, for example, a [sequence flow condition](https://docs.camunda.io/docs/next/components/modeler/bpmn/exclusive-gateways/exclusive-gateways#conditions) on an exclusive
gateway. Other attributes can define an expression _optionally_ as an alternative to a static value, for example, a
[timer definition](https://docs.camunda.io/docs/next/components/modeler/bpmn/timer-events/timer-events#timers) of a timer catch event.

---
Source: https://docs.camunda.io/docs/next/components/concepts/expressions
