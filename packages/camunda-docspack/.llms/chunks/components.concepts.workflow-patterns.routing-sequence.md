# Workflow patterns — Routing — Sequence

Refer to [Workflow Pattern 1: Sequence](http://www.workflowpatterns.com/patterns/control/basic/wcp1.php): "A task in a process is enabled after the completion of a preceding task in the same process."

This is implemented by a [sequence flow](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer#sequence-flow-controlling-the-flow-of-execution) connecting two activities:

Diagram (BPMN):
  start → "Task A" → "Task B" → end

**(1)**

You can read more about it in [our BPMN primer: sequence flows - controlling the flow of execution](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-primer#sequence-flow-controlling-the-flow-of-execution).

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
