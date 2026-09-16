# Workflow patterns — Routing — Static parallel branches

Imagine you want some tasks known during design time to be carried out in parallel. Refer to [Workflow Pattern 2: Parallel Split](http://www.workflowpatterns.com/patterns/control/new/wcp2.php) and [Workflow Pattern 33: Generalized AND-Join](http://www.workflowpatterns.com/patterns/control/new/wcp33.php): "The divergence of a branch into two or more parallel branches each of which execute concurrently" plus "the convergence of two or more branches into a single subsequent branch."

In BPMN, this is implemented using [parallel gateways (AND)](https://docs.camunda.io/docs/next/components/modeler/bpmn/parallel-gateways/parallel-gateways):

Diagram (BPMN):
  start → parallel gateway
    — "Task A" → parallel gateway → end
    — "Task B" → (back to parallel gateway)
    — "Task C" → (back to parallel gateway)

**(1)**

This AND-gateway splits the flow into concurrent paths so that Task A, B, and C are executed in parallel.

**(2)**

This AND-gateway waits for Task A, B, and C to complete before the flow can move on.

You can read more about it in [our BPMN primer: gateways - steering flow](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer#gateways-steering-flow).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
