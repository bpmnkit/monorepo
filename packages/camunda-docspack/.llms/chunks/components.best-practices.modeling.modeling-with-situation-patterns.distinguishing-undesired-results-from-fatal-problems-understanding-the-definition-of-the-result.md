# Modeling with situation patterns — Distinguishing undesired results from fatal problems — Understanding the definition of the result

What we want to consider to be a valid result for a process step depends on assumptions and definitions. We might have chosen to model the process above with slightly different execution semantics, while achieving the same business semantics:

Diagram (BPMN):
  start "Credit card application received" → service task "Evaluate credit-worthiness" → user task "Issue credit card" → end "Credit card application accepted"

**(1)**

The only valid result for the step "Ensure credit-worthiness" is knowing that the customer is in fact credit-worthy. Therefore, any other condition must be modeled with an error boundary event.

To advance clarity by means of process models, it is absolutely crucial for modelers to have a clear mental definition of the _result_ a specific step produces, and as a consequence, to be able to distinguish _undesired results_ from _fatal problems_ hindering us to achieve any result for the step.

While there is not necessarily a right way to decide what to consider as a valid result for your step, the business reader will typically have a mental preference to observe certain business issues, either more as undesired outcomes or more as fatal problems. However, for the executable pools, your discretion to decide about a step's result might also be limited when using, for example, service contracts which are already pre-defined.

The same distinction applies to a step carried out by an [AI agent](https://docs.camunda.io/docs/next/reference/glossary#ai-agent). The response the agent returns when its loop ends is a valid result you check with a gateway, even when that response is a negative one. An error the agent itself raises, such as reaching its configured maximum number of model calls, is a fatal problem you catch with a boundary [error event](https://docs.camunda.io/docs/next/components/connectors/out-of-the-box-connectors/agentic-ai-aiagent-subprocess#error-handling).

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-with-situation-patterns
