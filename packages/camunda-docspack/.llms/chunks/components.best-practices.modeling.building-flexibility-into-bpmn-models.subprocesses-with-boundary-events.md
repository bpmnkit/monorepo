# Building flexibility into BPMN models — Subprocesses with boundary events

By attaching boundary events not just to individual activities, but also to subprocesses, we can flexibly define the area or scope for which we want to trigger some flexible activities.

Diagram (BPMN):
  start "..." → "..." → subprocess → end "..."

**(1)**

While we are occupied with carrying out some area of activities, in a scope of our process...

**(2)**

...an event might occur, which causes us...

**(3)**

...to carry out this activity in addition to continuing with ordinary work.

---
Source: https://docs.camunda.io/docs/next/components/best-practices/modeling/building-flexibility-into-bpmn-models
