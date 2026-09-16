# Workflow patterns — Routing — Conditions (if/then)

Refer to [Workflow Pattern 4: Exclusive Choice](http://www.workflowpatterns.com/patterns/control/basic/wcp4.php): "The thread of control is immediately passed to precisely one of the outgoing branches."

This is implemented by an [exclusive gateway (XOR)](https://docs.camunda.io/docs/next/components/modeler/bpmn/exclusive-gateways/exclusive-gateways):

Diagram (BPMN):
  start "..." → "Task A" → exclusive gateway "x > 42"
    — [Yes: =x > 42] "Task B" → end "..."
    — [No: =not(x > 42)] "Task C" → end "..."

**(1)**

You can read more about it in [our BPMN primer: gateways - steering flow](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer#gateways-steering-flow).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
