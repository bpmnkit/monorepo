# Workflow patterns — Reacting to events — Events from subprocesses

Sometimes, a subprocess needs to communicate with its parent process without ending the subprocess yet. BPMN allows this by an [escalation event](https://docs.camunda.io/docs/next/components/modeler/bpmn/bpmn-coverage).

Diagram (BPMN):
  start "Order placed" → call activity "Clearing" → call activity "Manufacturing" → call activity "Shipping" → call activity "Invoicing" → end "Order fulfilled"

**(1)**

An escalation event can be thrown from any of the called subprocesses and is picked up by its parent to start something in parallel, as this is a non-interrupting event (dashed line).

The subprocess can raise the escalation any time:

Diagram (BPMN):
  start "..." → "Add manufacturing order to plan" → exclusive gateway "Will the manufacturing be completed in time?"
    — [No: =not(completedInTime)] intermediate throw event "Raise escalation "delay expected"" → exclusive gateway → "...do all the things required for manufacturing" → end "..."
    — [Yes: =completedInTime] (back to exclusive gateway)

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
