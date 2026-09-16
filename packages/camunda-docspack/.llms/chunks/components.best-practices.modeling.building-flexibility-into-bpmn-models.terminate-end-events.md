# Building flexibility into BPMN models — Terminate end events

To build flexibility into process models, it is also useful to remember that the termination end event just terminates the scope within which it is defined and therefore _not_ always the whole process instance. With that technique, it becomes possible to cancel some activities inside a subprocess while completing it successfully and leaving it via the typical outgoing path.

Diagram (BPMN):
  start "..." → "..." → subprocess → "..." → end "..."

**(1)**

As soon as one of our two activities achieves the result, we can cancel the other one...

**(2)**

...and successfully complete the subprocess and normally continue with our follow-up work.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
