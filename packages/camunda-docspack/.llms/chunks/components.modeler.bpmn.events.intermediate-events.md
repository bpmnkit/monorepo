# Overview — Intermediate events

Diagram (BPMN):
  start "..." → intermediate throw event "Send message A (intermediate throw event)" → intermediate catch event "Wait for msg. B (intermediate catch event)" → end "..."

**(1)**

**(2)**


## Boundary events

Boundary events provide a way to model what should happen if an event occurs while an activity is active. For example, if a process is waiting on a user task to happen which is taking too long, an intermediate timer catch event can be attached to the task, with an outgoing sequence flow to notification task, allowing the modeler to automate and sending a reminder email to the user.

Diagram (BPMN):
  start "..." → user task "Do something" → end "..."

**(1)**

---
Source: https://docs.camunda.io/docs/next/components/modeler/bpmn/events
