# Workflow patterns — Reacting to events — Broadcasts and engine-wide events

While messages are always targeted at one specific process instance, you might also want to inform many processes about an event at once. For example, you might regularly adjust certain customer scoring rules that always should be taken into account immediately. This can be implemented using the [signal event](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage).

Diagram (BPMN):
  start "..." → service task "Score customer" → subprocess "Onboarding" → end "..."

**(1)**

The signal event is caught and in this case interrupts the onboarding to go back to score the customer again.

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
