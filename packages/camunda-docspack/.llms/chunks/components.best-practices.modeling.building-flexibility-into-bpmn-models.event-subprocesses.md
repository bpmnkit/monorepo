# Building flexibility into BPMN models — Event subprocesses

Sometimes we need to build in flexible activities which are carried out at any point in time. In such cases, we can leverage BPMN's event-based subprocesses.

Diagram (BPMN):
  start "..." → "Carry out a first activity" → "Carry out a second activity" → "Carry out a third activity" → end "..."
  note: We cancel the whole process instance in case "something happens"
  note: We continue the whole process instance in case "some time elapses"

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
