# Building flexibility into BPMN models — Boundary events to add activities on triggers

BPMN allows us to attach events to the boundary of activities to trigger some follow-up action. By modeling such an event as either **interrupting** or **non-interrupting**, we can decide to do the activities either _instead of_ the activity we attach the event to, or _in addition to_ it.

Diagram (BPMN):
  "Carry out default activity"
  boundary event "Something happens" → "Instead, carry out this activity"
  "Carry out default activity"
  boundary event "Some time elapses" → "In addition, carry out this activity"
  note: We cancel this activity in case "something happens"
  note: We continue this activity in case "some time elapses"

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
