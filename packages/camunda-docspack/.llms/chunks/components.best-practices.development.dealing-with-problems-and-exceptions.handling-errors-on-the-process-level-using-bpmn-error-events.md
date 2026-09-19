# Dealing with problems and exceptions — Handling errors on the process level — Using BPMN error events

A common way to resolve these deviations is using a BPMN error event, which allows a process model to react to errors within a task. For example:

Diagram (BPMN):
  start "..." → user task "Provide shipping address" → service task "Generate invoice" → service task "Send invoice to customer" → exclusive gateway → intermediate catch event "Wait until next business day" → "..." → end "..."

**(1)**

We decide that we want to deal with an exception in the process: in case the invoice cannot be sent automatically...

**(2)**

...we assign a task to a human user, who is now in charge of taking care of delivering the invoice.

Learn more about the usage of [error events](https://docs.camunda.io/docs/next/components/modeler/bpmn/error-events/error-events) in the user guide.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/development/dealing-with-problems-and-exceptions
