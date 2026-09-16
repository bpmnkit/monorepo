# Creating readable process models — Helpful practices — Avoid modeling retry behavior

A common idea is to model retry behavior into your process models. This _should be avoided_ in general. The following process model shows a typical example of this anti pattern:

Diagram (BPMN):
  start "..." → service task "Call service" → exclusive gateway → service task "Call next service" → end "..."

All operations use cases put into the model can be handled via Camunda tooling, e.g. by [retrying](https://docs.camunda.io/docs/next/components/concepts/job-workers#completing-or-failing-jobs) or [Camunda Operate](https://docs.camunda.io/docs/next/components/operate/operate-introduction).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/creating-readable-process-models
