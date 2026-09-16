# Workflow patterns — Handling errors

Handling exceptions well is one of the most important capabilities of a workflow engine, and it needs built-in support from the modeling language.

You might also want to look into our [best practice: modeling beyond the happy path](https://docs.camunda.io/docs/next/components/best-practices/modeling/modeling-beyond-the-happy-path) to understand possibilities.

### Error scopes

The reaction to errors might need to be different depending on the current state of the process. This can be achieved by using [subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/embedded-subprocesses/embedded-subprocesses) in combination with either [boundary events](https://docs.camunda.io/docs/next/components/modeler/bpmn/events#boundary-events) or [event subprocesses](https://docs.camunda.io/docs/next/components/modeler/bpmn/event-subprocesses/event-subprocesses).

Diagram (BPMN):
  start "..." → subprocess "Clearing" → exclusive gateway → subprocess "..." → end "..."

**(1)**

This boundary error event is attached to the subprocess "clearing" and only catches errors within that subprocess. The idea here would be that in case of any clearing service not being available, the order is assumed cleared. Note that this example is mainly built for illustration, and does not necessarily mean this is the best way to solve this business requirement.

**(2)**

Alternatively, this error event subprocess is triggered whenever there is a fraud detected, independent of whether the error occurs in any of the subprocesses or the main process.

### Catch errors per type

You might need to react to different event types differently, which is possible by using the [error type](https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events#defining-the-error) known to BPMN:

Diagram (BPMN):
  start "..." → service task "Validate customer data" → "..." → end "..."

**(1)**

---
Source: https://docs.camunda.io/docs/next/components/concepts/workflow-patterns
